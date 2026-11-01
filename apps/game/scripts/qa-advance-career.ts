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
import { continueCareerRhythm } from "../lib/career/continueController";
import { playManagerFixtureLegacy } from "../lib/career/legacy/matchday";
import { rolloverSeason } from "../lib/career/seasonRollover";
import { CURRENT_SAVE_SCHEMA_VERSION, type CareerSave } from "../lib/save/saveRepository";
import type { CareerState } from "../lib/career/types";

const [clubId = "se_club_ifk_skovde_hk", until = "2026-12-05", out = "qa-save.json", seed = "hm-alpha3-qa"] = process.argv.slice(2);
const competitions = ["se_handbollsligan_herr", "swe-2"];
const squads = Object.assign({}, ...competitions.map((c) => snapshotWorldSquads(c)));
const ratings = Object.assign({}, ...competitions.map((c) => snapshotGameplayRatings(c)));
let state: CareerState = createNewCareerState(seed, clubId, squads, undefined, ratings);

function advance(stop: (s: CareerState) => boolean): void {
  for (let i = 0; i < 2000 && !stop(state); i++) {
    const { state: next, stopReason } = continueCareerRhythm(state);
    state = next;
    if (stopReason === "ACTION_REQUIRED" || stopReason === "ACTION_REQUIRED_PENDING") state = playManagerFixtureLegacy(state).state;
    if (stopReason === "SEASON_COMPLETE" || state.seasonComplete) break;
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
