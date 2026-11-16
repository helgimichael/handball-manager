// Arena Nights -- CMP-01g A "Stage path + bracket": Svenska Cupen as a stage timeline and a bracket built only
// from the saved ties (lib/competition/season.ts writes them). Read-only; no draw, format or rule is decided here.
import type { CareerState } from "../career/types";
import type { CompetitionTie, TieStage } from "./types";
import { SVENSKA_CUPEN } from "./rules";
import { STAGE_LABEL } from "./season";

export const CUP_STAGE_ORDER: readonly TieStage[] = ["CUP_GROUP", "CUP_R32", "CUP_R16", "CUP_QF", "CUP_SF", "CUP_F"];
export type StageStatus = "DONE" | "CURRENT" | "UPCOMING";
export interface CupStage { stage: TieStage; label: string; status: StageStatus; ties: number; own: "IN" | "THROUGH" | "OUT" | null }
export interface BracketTie { id: string; key: string; highClubId: string; lowClubId: string; score: string | null; legs: number; played: number; winnerClubId: string | null; own: boolean; fixtureIds: string[] }
export interface BracketRound { stage: TieStage; label: string; ties: BracketTie[] }
export interface CupCentre { ties: CompetitionTie[]; stages: CupStage[]; groups: CompetitionTie[]; bracket: BracketRound[]; ownOut: CompetitionTie | null; nextFixtureId: string | null }

const involves = (t: CompetitionTie, club: string) => !!t.clubIds?.includes(club) || t.highClubId === club || t.lowClubId === club;

export function cupCentre(state: CareerState): CupCentre {
  const me = state.playerClubId;
  const ties = Object.values(state.competitionTies ?? {}).filter((t) => t.competitionId === SVENSKA_CUPEN && t.seasonId === state.seasonId);
  const groups = ties.filter((t) => t.stage === "CUP_GROUP").sort((a, b) => a.key.localeCompare(b.key));
  const finished = (t: CompetitionTie) => t.stage === "CUP_GROUP" ? t.fixtureIds.length > 0 && t.fixtureIds.every((id) => state.results[id]) : !!t.winnerClubId;
  // The path starts at the first stage this season's cup actually has ties for (a format may enter at R16).
  const order = CUP_STAGE_ORDER.filter((s) => s !== "CUP_GROUP" || groups.length > 0);
  const first = order.findIndex((s) => ties.some((t) => t.stage === s));
  const present = first < 0 ? order : order.slice(first);
  let currentSeen = false;
  const stages = present.map((stage): CupStage => {
    const round = ties.filter((t) => t.stage === stage);
    const done = round.length > 0 && round.every(finished);
    let status: StageStatus = done ? "DONE" : "UPCOMING";
    if (!done && !currentSeen && (round.length > 0 || ties.length > 0)) { status = "CURRENT"; currentSeen = true; }
    const mine = round.filter((t) => involves(t, me));
    const own = !mine.length ? null : mine.some((t) => t.loserClubId === me) ? "OUT" : mine.some((t) => t.winnerClubId === me) || (stage === "CUP_GROUP" && ties.some((t) => t.stage !== "CUP_GROUP" && involves(t, me))) ? "THROUGH" : "IN";
    return { stage, label: STAGE_LABEL[stage], status, ties: round.length, own };
  });
  const bracket = (["CUP_R32", "CUP_R16", "CUP_QF", "CUP_SF", "CUP_F", "CUP_3RD"] as TieStage[]).map((stage): BracketRound => ({
    stage, label: STAGE_LABEL[stage],
    ties: ties.filter((t) => t.stage === stage).sort((a, b) => a.key.localeCompare(b.key)).map((t): BracketTie => {
      const legs = t.fixtureIds.map((id) => state.results[id]).filter((r): r is NonNullable<typeof r> => !!r);
      const agg: Record<string, number> = {};
      for (const r of legs) { agg[r.homeClubId] = (agg[r.homeClubId] ?? 0) + r.homeGoals; agg[r.awayClubId] = (agg[r.awayClubId] ?? 0) + r.awayGoals; }
      return { id: t.id, key: t.key, highClubId: t.highClubId, lowClubId: t.lowClubId, score: legs.length ? `${agg[t.highClubId] ?? 0}–${agg[t.lowClubId] ?? 0}` : null, legs: t.fixtureIds.length, played: legs.length, winnerClubId: t.winnerClubId ?? null, own: involves(t, me), fixtureIds: t.fixtureIds };
    }),
  })).filter((r) => r.ties.length > 0);
  const ownOut = ties.find((t) => t.loserClubId === me && t.stage !== "CUP_GROUP") ?? null;
  const next = state.fixtures.filter((f) => f.competitionId === SVENSKA_CUPEN && !state.results[f.id] && (f.homeClubId === me || f.awayClubId === me)).sort((a, b) => a.date.localeCompare(b.date))[0];
  return { ties, stages, groups, bracket, ownOut, nextFixtureId: next?.id ?? null };
}
