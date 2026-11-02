// HM-ALPHA3 QA tool: plays a real career forward (manager fixtures resolved
// with the legacy fast matchday, everything else through the normal daily
// tick) and writes it as a CareerSave JSON a browser QA session can load.
//
//   node --import tsx scripts/qa-advance-career.ts <clubId> <untilDate|SEASON_END|NEXT_SEASON_END> <out.json> [seed]
//
// Development aid only: it never touches a real save.
import { writeFileSync } from "node:fs";
import { createNewCareerState } from "../lib/career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../lib/gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../lib/gameWorld/staffIdentitySnapshot";
import { continueCareerRhythm } from "../lib/career/continueController";
import { playManagerFixtureLegacy } from "../lib/career/legacy/matchday";
import { rolloverSeason } from "../lib/career/seasonRollover";
import { CURRENT_SAVE_SCHEMA_VERSION, type CareerSave } from "../lib/save/saveRepository";
import type { CareerState } from "../lib/career/types";

const [clubId = "se_club_ifk_skovde_hk", until = "2026-12-05", out = "qa-save.json", seed = "hm-alpha3-qa"] = process.argv.slice(2);
const competitions = ["se_handbollsligan_herr", "swe-2"];
const world = [...competitions, "se_division1_norra", "se_division1_sodra"];
const squads = Object.assign({}, ...world.map((c) => snapshotWorldSquads(c)));
const ratings = Object.assign({}, ...world.map((c) => snapshotGameplayRatings(c)));
// HM-ALPHA3-M04: real staff identities for both leagues, as a New Game loads them.
const staff = Object.assign({}, ...competitions.map((c) => snapshotAllClubsStaff(c)));
let state: CareerState = createNewCareerState(seed, clubId, squads, undefined, ratings, staff, "4_WEEKS");

function advance(stop: (s: CareerState) => boolean): void {
  for (let i = 0; i < 2000 && !stop(state); i++) {
    const { state: next, stopReason } = continueCareerRhythm(state);
    state = next;
    if (stopReason === "ACTION_REQUIRED" || stopReason === "ACTION_REQUIRED_PENDING") state = playManagerFixtureLegacy(state).state;
    if (stopReason === "SEASON_COMPLETE" || state.seasonComplete) break;
    if (process.env.QA_TRACE && i % 25 === 0) console.log(i, state.gameDate, state.seasonId, stopReason, state.seasonOutcome?.phase);
    if (process.env.QA_TRACE && state.gameDate > "2028-09-01") { for (const t of Object.values(state.competitionTies ?? {}).filter((t) => !t.winnerClubId && t.stage !== "CUP_GROUP")) console.log("UNDECIDED", t.key, t.stage, t.highClubId, t.lowClubId, t.fixtureIds.map((id) => [id, state.fixtures.find((f) => f.id === id)?.date, !!state.results[id]])); process.exit(0); }
  }
}

if (until === "SEASON_END" || until === "NEXT_SEASON_END") {
  advance((s) => s.seasonComplete);
  if (until === "NEXT_SEASON_END") {
    state = rolloverSeason(state);
    advance((s) => s.seasonComplete);
  }
} else {
  advance((s) => s.gameDate >= until);
}

const now = new Date().toISOString();
const save: CareerSave = {
  saveId: `save-qa-${seed}`,
  schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
  selectedNations: ["SWE"],
  selectedCompetitionIds: competitions,
  clubId,
  manager: { name: "QA Manager", nationality: "SWE", dateOfBirth: "1984-05-04" },
  gameDate: state.gameDate,
  createdAt: now,
  lastPlayedAt: now,
  careerState: state,
};
writeFileSync(out, JSON.stringify(save));
console.log(`wrote ${out}: ${state.gameDate} season ${state.seasonId} complete=${state.seasonComplete} statements=${state.clubFinances?.[clubId]?.statements.length ?? 0}`);
const o = state.seasonOutcome;
if (o) {
  const ties = Object.values(state.competitionTies ?? {});
  console.log(JSON.stringify({ phase: o.phase, both: o.bothTiersSimulated, champion: o.champion, runnerUp: o.runnerUp, cupWinner: o.cupWinner, winners: o.regularSeasonWinners, promoted: o.promoted, relegated: o.relegated, ties: ties.length, decided: ties.filter((t) => t.winnerClubId).length, awards: o.awards.filter((a) => a.id !== "ALL_STAR").map((a) => `${a.label}/${a.competitionId.slice(0, 6)}: ${a.playerId} ${a.value}`), deciders: Object.values(state.results).filter((r) => r.decider).map((r) => r.decider!.method).reduce((m: Record<string, number>, k) => ({ ...m, [k]: (m[k] ?? 0) + 1 }), {}) }, null, 1));
}
const prev = state.seasonHistory?.at(-1);
if (prev) console.log(JSON.stringify({ archived: prev.seasonId, champion: prev.outcome?.champion, membershipChanges: Object.keys(state.competitionMembership ?? {}).length, managerCompetition: state.competitionId, hblClubs: state.fixtures.filter((f) => f.type === "LEAGUE" && f.competitionId === "se_handbollsligan_herr").length, allsvFixtures: state.fixtures.filter((f) => f.type === "LEAGUE" && f.competitionId === "swe-2").length, uniqueIds: new Set(state.fixtures.map((f) => f.id)).size === state.fixtures.length }));
