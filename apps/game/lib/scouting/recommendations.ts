// HM-ALPHA3-M06: recruitment recommendations built ONLY from what the club
// knows. Every candidate is scored from the knowledge-gated view (the
// estimated star range, centred on the scouting estimate, never the truth)
// and the squad's real needs; a thin knowledge base means a wide range and
// a low confidence, both shown. Nothing here reads true ability for ranking.
import { getCareerClubSquad, getExternalCandidateClubs } from "../career/careerWorld";
import { getCareerPlayerRating } from "../career/careerRatingNormalization";
import { getFreeAgents } from "../career/contractExpiry";
import type { NeedLevel } from "../career/cpuSquadNeeds";
import { getPlayerScoutReports } from "../career/scouting";
import type { CareerState } from "../career/types";
import { playerAgeAtDate } from "../development/developmentIntegration";
import { getPlayerContractStatus, getPlayerMarketValueEur } from "../economy/contractIntegration";
import type { PlayerMock } from "../game-data";
import { getPlayerKnowledgePct } from "../knowledge/knowledgeIntegration";
import { resolvePlayerVisibility, type StarRange } from "../knowledge/playerVisibility";
import { resolveMarketValueRange, type MarketValueRange } from "../knowledge/scoutReportVisibility";
import { getManagerRecruitmentNeeds } from "../transfers/transferCentre";

export interface Recommendation {
  player: PlayerMock;
  clubId: string;
  knowledgePct: number;
  abilityRange: StarRange;
  potentialRange: StarRange | null;
  valueRange: MarketValueRange | null;
  needLevel: NeedLevel;
  /** 0-100: how sure the club is about this estimate (knowledge and the scout who reported). */
  confidencePct: number;
  /** Estimate-based fit score -- what the list is ordered by. */
  score: number;
  reasons: string[];
}

const NEED_WEIGHT: Record<NeedLevel, number> = { HIGH: 1.3, MEDIUM: 1.1, LOW: 0.9, NONE: 0.6 };
const MIN_KNOWLEDGE = 30;

/** Ranked recommendations for the manager's needs, from scouted and discovered players only. */
export function recruitmentRecommendations(state: CareerState, limit = 12): Recommendation[] {
  const needs = new Map(getManagerRecruitmentNeeds(state).map((n) => [n.position, n.level as NeedLevel]));
  const squadLevel = levelStars(state);
  const pool: { player: PlayerMock; clubId: string }[] = [
    ...getExternalCandidateClubs(state).flatMap((club) => getCareerClubSquad(state, club.id).map((player) => ({ player, clubId: club.id }))),
    ...getFreeAgents(state).map((player) => ({ player, clubId: "" })),
  ];
  const out: Recommendation[] = [];
  for (const { player, clubId } of pool) {
    const knowledgePct = getPlayerKnowledgePct(state, player.id, player.clubId);
    if (knowledgePct < MIN_KNOWLEDGE) continue;
    const rating = getCareerPlayerRating(state, player.id, clubId || undefined);
    if (!rating) continue;
    const report = getPlayerScoutReports(state, player.id)[0];
    const view = resolvePlayerVisibility({ ...rating, playerId: player.id }, knowledgePct, report?.scoutSuitability);
    const needLevel = needs.get(player.position) ?? "NONE";
    const ability = (view.abilityRange.min + view.abilityRange.max) / 2;
    const potential = view.potentialRange ? (view.potentialRange.min + view.potentialRange.max) / 2 : ability;
    const age = playerAgeAtDate(player.dateOfBirth, player.birthYear, state.gameDate);
    const youth = age !== null && age <= 22 ? Math.max(0, potential - ability) * 0.5 : 0;
    if (ability + youth < squadLevel - 0.5 && needLevel !== "HIGH") continue;
    const width = view.abilityRange.max - view.abilityRange.min;
    const confidencePct = Math.round(Math.min(95, knowledgePct * (report ? 0.6 + (report.scoutSuitability / 20) * 0.4 : 0.85)));
    const status = getPlayerContractStatus(state, player.id);
    const value = getPlayerMarketValueEur(state, player.id);
    const reasons: string[] = [];
    if (needLevel === "HIGH" || needLevel === "MEDIUM") reasons.push(`Fyller ett behov på ${player.position}`);
    if (ability >= squadLevel + 0.5) reasons.push("Bedöms höja lagets nivå");
    if (youth >= 0.5) reasons.push("Ung med utvecklingspotential");
    if (status === "FREE_AGENT") reasons.push("Kontraktslös -- ingen övergångssumma");
    else if (status === "EXPIRING" || status === "EXPIRING_SOON") reasons.push("Kort avtal kvar -- billigare");
    if (width >= 2) reasons.push("Osäker bild -- scouta mer innan beslut");
    out.push({
      player, clubId, knowledgePct,
      abilityRange: view.abilityRange, potentialRange: view.potentialRange,
      valueRange: value !== undefined ? resolveMarketValueRange(value, knowledgePct, player.id) : null,
      needLevel, confidencePct,
      score: (ability + youth) * NEED_WEIGHT[needLevel] - width * 0.15 + (status === "FREE_AGENT" ? 0.2 : 0),
      reasons,
    });
  }
  return out.sort((a, b) => b.score - a.score || a.player.id.localeCompare(b.player.id)).slice(0, limit);
}

/** The manager's own level in stars (own players are fully known). */
function levelStars(state: CareerState): number {
  const ratings = (state.gameplayRatings[state.playerClubId] ?? []).map((r) => r.ca).sort((a, b) => b - a).slice(0, 7);
  if (!ratings.length) return 3;
  const avg = ratings.reduce((s, v) => s + v, 0) / ratings.length;
  return resolvePlayerVisibility({ position: "M9", ca: avg, pa: avg, branch: { branch: "OUTCOURT", attributes: {} }, attackRoleProficiencies: [], defenceRoleProficiencies: [] }, 100).abilityRange.min;
}
