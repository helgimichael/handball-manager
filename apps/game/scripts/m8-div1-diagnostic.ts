// HM-TRANSFER-REALISM M8C: player-level investigation of elite players who
// move INTO Division 1.
//
// OBSERVATION ONLY. Drives the same full-world career as
// transfer-realism-sim.ts and, every day, detects players who just joined a
// Division 1 club while elite (CA >= 140) and under 31. For each case it records
// identity, age, CA/PA, previous club/league, contract before and after, club
// history, the CPU log lines that produced the move, the PCDM breakdown of the
// move evaluated on the PREVIOUS day's state (the state the decision was made
// in), and which stronger clubs the player would have accepted at the time.
//
// Usage:
//   npx tsx scripts/m8-div1-diagnostic.ts --seasons 13 --seed tr-final-c --out <file.json>
import * as fs from "node:fs";
import { processDay } from "../lib/career/dailyTick";
import { addDays } from "../lib/career/dateUtils";
import { getClub } from "../lib/game-data";
import { clubCompetitionId } from "../lib/career/competitionMembership";
import { FREE_AGENT_CLUB_ID } from "../lib/career/contractExpiry";
import { playerAgeAtDate } from "../lib/development/developmentIntegration";
import { getPlayerContract, getPlayerContractStatus } from "../lib/economy/contractIntegration";
import { getCareerPlayer } from "../lib/career/careerWorld";
import { careerWorldClubIds } from "../lib/career/worldCompetitions";
import { assessSquadNeeds } from "../lib/career/cpuSquadNeeds";
import { acceptanceEstimate, playerCareerProfile, playerDecisionOnMove, marketContextFor, expectedRoleAt } from "../lib/transfers/careerDecision/stateAdapter";
import { clubLevelOf, environmentLevelOf, worldPoolClubIds } from "../lib/transfers/careerDecision/sportingStrength";
import { createFullWorldCareer } from "./lib/fullWorldCareer";
import type { CareerState } from "../lib/career/types";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const seasons = Number(arg("seasons", "13"));
const seed = arg("seed", "tr-final-c");
const out = arg("out", "");
const ELITE_CA = 140;

function leagueOf(state: CareerState, clubId: string): string {
  if (clubId === FREE_AGENT_CLUB_ID) return "FREE_AGENT";
  return clubCompetitionId(state, clubId) ?? "?";
}
const isDiv1 = (state: CareerState, clubId: string) => (clubCompetitionId(state, clubId) ?? "").startsWith("se_division1");
const r1 = (x: number) => Math.round(x * 10) / 10;

function div1Members(state: CareerState): Map<string, string> {
  const m = new Map<string, string>();
  for (const clubId of careerWorldClubIds(state)) {
    if (!isDiv1(state, clubId)) continue;
    for (const p of state.worldSquads[clubId] ?? []) m.set(p.id, clubId);
  }
  return m;
}

function caOf(state: CareerState, playerId: string): { ca: number; pa: number } | undefined {
  const player = getCareerPlayer(state, playerId);
  if (!player) return undefined;
  const r = (state.gameplayRatings[player.clubId] ?? []).find((x) => x.playerId === playerId);
  return r ? { ca: r.ca, pa: r.pa } : undefined;
}

/** Stronger clubs (Swedish top two tiers + world pool) the player would plausibly accept on the previous day. */
function strongerAlternatives(prev: CareerState, playerId: string, newClubId: string, refWage: number) {
  const newLevel = environmentLevelOf(prev, newClubId);
  const player = getCareerPlayer(prev, playerId)!;
  const candidates = [...careerWorldClubIds(prev).filter((id) => !isDiv1(prev, id)), ...worldPoolClubIds(prev)];
  const rows = candidates
    .filter((id) => id !== player.clubId && environmentLevelOf(prev, id) >= newLevel + 8)
    .map((id) => {
      const acceptance = acceptanceEstimate(prev, playerId, id, { wageEurPerMonth: refWage, contractYears: 3 });
      const swedish = !worldPoolClubIds(prev).includes(id);
      const need = swedish ? assessSquadNeeds(prev, id, prev.gameDate).positions.find((p) => p.position === player.position)?.level ?? "NONE" : "n/a";
      return { clubId: id, league: leagueOf(prev, id), envLevel: r1(environmentLevelOf(prev, id)), acceptance: r1(acceptance), expectedRole: expectedRoleAt(prev, playerId, id), positionNeed: need, squad: (prev.worldSquads[id] ?? []).length };
    })
    .filter((r) => r.acceptance >= 0.5)
    .sort((a, b) => b.envLevel - a.envLevel);
  return { count: rows.length, withPositionNeed: rows.filter((r) => r.positionNeed === "HIGH" || r.positionNeed === "MEDIUM").length, top: rows.slice(0, 6) };
}

let state = createFullWorldCareer(seed);
let date = state.gameDate;
const cases: unknown[] = [];
let members = div1Members(state);
const t0 = Date.now();

for (let season = 1; season <= seasons; season++) {
  for (let day = 0; day < 365; day++) {
    const prev = state;
    date = addDays(date, 1);
    state = processDay(state, date).state;
    const now = div1Members(state);
    for (const [playerId, clubId] of now) {
      if (members.get(playerId) === clubId) continue;
      const prevPlayer = getCareerPlayer(prev, playerId);
      if (!prevPlayer) continue; // a brand-new youth intake player
      const ratingPrev = caOf(prev, playerId);
      const age = playerAgeAtDate(prevPlayer.dateOfBirth, prevPlayer.birthYear, date);
      if (!ratingPrev || ratingPrev.ca < ELITE_CA || age === null || age >= 31) continue;
      const contractBefore = getPlayerContract(prev, playerId);
      const contractAfter = getPlayerContract(state, playerId);
      const years = contractAfter ? r1((Date.parse(contractAfter.contractEndDate) - Date.parse(date)) / (365 * 86_400_000)) : 3;
      const terms = { wageEurPerMonth: contractAfter?.wageEurPerMonth ?? 0, contractYears: Math.max(1, Math.round(years)) };
      const outcome = playerDecisionOnMove(prev, playerId, clubId, terms);
      const profile = playerCareerProfile(prev, playerId);
      const market = marketContextFor(prev, playerId);
      const logs = state.cpuDecisionLog.filter((e) => e.date === date && (e.clubId === clubId || e.summary.includes(playerId) || e.reason.includes(playerId))).map((e) => `${e.category} ${e.summary} :: ${e.reason}`);
      const history = state.playerClubHistory[playerId];
      cases.push({
        season, date, playerId, name: `${prevPlayer.firstName} ${prevPlayer.lastName}`, position: prevPlayer.position, nationality: prevPlayer.nationality, age,
        ca: ratingPrev.ca, pa: ratingPrev.pa,
        previousClub: getClub(prevPlayer.clubId)?.name ?? prevPlayer.clubId, previousLeague: leagueOf(prev, prevPlayer.clubId), previousEnvLevel: prevPlayer.clubId === FREE_AGENT_CLUB_ID ? null : r1(environmentLevelOf(prev, prevPlayer.clubId)),
        newClub: getClub(clubId)?.name ?? clubId, newLeague: leagueOf(state, clubId), newEnvLevel: r1(environmentLevelOf(prev, clubId)), newClubLevel: r1(clubLevelOf(prev, clubId)),
        contractBefore: contractBefore ? { clubId: contractBefore.clubId, wage: contractBefore.wageEurPerMonth, end: contractBefore.contractEndDate, status: getPlayerContractStatus(prev, playerId) } : null,
        contractAfter: contractAfter ? { wage: contractAfter.wageEurPerMonth, end: contractAfter.contractEndDate } : null,
        clubHistory: history ?? null,
        profile: profile ? { referenceWage: profile.referenceWageEurPerMonth, floorStrength: r1(profile.floorStrength), worldPercentile: r1(profile.worldPercentile) } : null,
        reservation: outcome.decision ? { source: outcome.decision.reservation.source, utility: r1(outcome.decision.reservation.utility * 100) / 100, threshold: Math.round(outcome.decision.threshold * 1000) / 1000 } : null,
        market: market ? { waitLevel: r1(market.waitLevel), waitRole: market.waitRole ?? null, monthsUnattached: r1(market.monthsUnattached), openMarket: market.openMarket, stayEnv: market.stay ? r1(market.stay.environmentLevel) : null, stayRole: market.stay?.role ?? null, international: market.internationalAlternative ? { clubId: market.internationalAlternative.clubId, env: r1(market.internationalAlternative.environmentLevel) } : null } : null,
        moveUtility: outcome.decision ? Math.round(outcome.decision.utility * 1000) / 1000 : null,
        moveComponents: outcome.decision?.evaluation.contributions ?? null,
        floorApplied: outcome.decision?.evaluation.floorApplied ?? null,
        acceptedByPcdmReplay: outcome.accept,
        reason: outcome.reason,
        cpuLog: logs.slice(0, 8),
        strongerAlternatives: strongerAlternatives(prev, playerId, clubId, profile ? Math.round(profile.referenceWageEurPerMonth * 1.1) : terms.wageEurPerMonth),
      });
      console.log(`[case] S${season} ${date} ${prevPlayer.firstName} ${prevPlayer.lastName} age ${age} CA ${ratingPrev.ca} ${leagueOf(prev, prevPlayer.clubId)} -> ${getClub(clubId)?.name} (${terms.wageEurPerMonth} EUR/${terms.contractYears}y) accept=${outcome.accept} res=${outcome.decision?.reservation.source}`);
    }
    members = now;
  }
  console.log(`S${season} ${date} cases ${cases.length} elapsed ${Math.round((Date.now() - t0) / 1000)}s`);
  if (out) fs.writeFileSync(out, JSON.stringify({ seed, seasons: season, cases }, null, 2));
}
