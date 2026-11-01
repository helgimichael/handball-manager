// HM-ALPHA3-M01: characterisation tests for the CURRENT season transition,
// pinned before M3 (Season & Competition) changes formats. These describe
// what the game does today -- including its known simplifications (fixed
// 20 September kickoff, unchanged league membership) -- so any change in M3
// is a deliberate, visible test edit rather than an accident.
import test from "node:test";
import assert from "node:assert/strict";
import { simulateFixture } from "@handball-manager/game-simulation";
import { createNewCareerState } from "./newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { rolloverSeason } from "./seasonRollover";
import { checkSeasonComplete } from "./calendar";
import { seasonCompleteMessageId } from "./inboxEvents";
import { getLiveStandings } from "./standings";
import { computeSquadDerivedClubStrength } from "./squadDerivedClubStrength";
import { getCareerClubSquad } from "./careerWorld";
import { migrateCareerState } from "./saveMigration";
import type { CareerState } from "./types";

function freshCareer(): CareerState {
  return createNewCareerState("season-rollover-characterisation", "swe2-tumba", snapshotWorldSquads("swe-2"), undefined, snapshotGameplayRatings("swe-2"));
}

/** Every fixture played and the season flagged complete, the way the daily tick leaves it. */
function completedSeason(state: CareerState = freshCareer()): CareerState {
  const results = { ...state.results };
  for (const f of state.fixtures) {
    results[f.id] ??= simulateFixture(f, state.saveSeed, (id) => computeSquadDerivedClubStrength(id, getCareerClubSquad(state, id), state.gameplayRatings[id] ?? []));
  }
  const played = { ...state, results, gameDate: state.fixtures.at(-1)!.date };
  return checkSeasonComplete(played);
}

const leagueClubs = (state: CareerState) => [...new Set(state.fixtures.filter((f) => f.type === "LEAGUE").flatMap((f) => [f.homeClubId, f.awayClubId]))].sort();

test("rollover is a no-op until the season is complete, and during a live match", () => {
  const open = freshCareer();
  assert.equal(rolloverSeason(open), open);
  const done = completedSeason();
  const live = { ...done, productionMatch: {} as NonNullable<CareerState["productionMatch"]> };
  assert.equal(rolloverSeason(live), live);
});

test("season id advances one year and the new calendar starts on the fixed 20 September kickoff", () => {
  const done = completedSeason();
  const next = rolloverSeason(done);
  const year = Number(done.seasonId.slice(0, 4)) + 1;
  assert.equal(next.seasonId, `${year}/${String(year + 1).slice(-2)}`);
  assert.equal(next.seasonComplete, false);
  assert.equal(next.leagueKickoffDate, `${year}-09-20`);
  assert.equal(next.fixtures.map((f) => f.date).sort()[0], `${year}-09-20`);
  assert.equal(next.seasonStartDate, done.gameDate, "the new season starts from today; no offseason days are skipped");
  assert.equal(next.gameDate, done.gameDate);
});

test("league membership is unchanged and the new schedule is a full double round robin of league fixtures only", () => {
  const done = completedSeason();
  const next = rolloverSeason(done);
  const clubs = leagueClubs(done);
  assert.deepEqual(leagueClubs(next), clubs, "no promotion or relegation yet (M3)");
  assert.equal(next.fixtures.length, clubs.length * (clubs.length - 1));
  assert.ok(next.fixtures.every((f) => f.type === "LEAGUE"), "preseason cup and friendlies are not regenerated");
  for (const club of clubs) {
    const home = next.fixtures.filter((f) => f.homeClubId === club).length;
    const away = next.fixtures.filter((f) => f.awayClubId === club).length;
    assert.equal(home, clubs.length - 1, `${club} home games`);
    assert.equal(away, clubs.length - 1, `${club} away games`);
  }
});

test("the finished season is archived (final table and player stats) and season-scoped state is reset", () => {
  const done = completedSeason();
  const next = rolloverSeason(done);
  const archived = next.seasonHistory!.at(-1)!;
  assert.equal(next.seasonHistory!.length, (done.seasonHistory ?? []).length + 1);
  assert.equal(archived.seasonId, done.seasonId);
  assert.equal(archived.competitionId, done.competitionId);
  assert.deepEqual(archived.table, getLiveStandings(done));
  assert.deepEqual(archived.stats, done.playerSeasonStats);
  assert.deepEqual(next.results, {});
  assert.deepEqual(next.playerSeasonStats, {});
  assert.deepEqual(next.clubForm, {});
  assert.deepEqual(next.physicalReports, {});
  assert.deepEqual(next.matchPlans, {});
  assert.equal(next.activeMatchSession, null);
  assert.equal(next.productionMatch, null);
});

test("career-long state survives the transition untouched", () => {
  const done = completedSeason();
  const next = rolloverSeason(done);
  for (const key of ["playerClubId", "competitionId", "saveSeed", "playerContracts", "staffRoster", "worldSquads", "gameplayRatings", "playerSquadStatus", "clubEconomies", "workloadLedger"] as const) {
    assert.deepEqual(next[key as keyof CareerState], done[key as keyof CareerState], key);
  }
});

test("open career events and inbox actions are force-resolved; messages themselves are kept", () => {
  const done = completedSeason();
  const withOpen = { ...done, inbox: done.inbox.map((m, i) => (i === 0 ? { ...m, actionRequired: true, resolved: false } : m)) };
  const next = rolloverSeason(withOpen);
  assert.equal(next.inbox.length, withOpen.inbox.length);
  assert.ok(next.inbox.every((m) => m.resolved && !m.actionRequired));
  assert.ok(next.careerEvents.every((e) => e.resolved));
});

test("two consecutive seasons: unique fixture ids, two history entries, unique season-complete messages", () => {
  const first = completedSeason();
  const second = completedSeason(rolloverSeason(first));
  const third = rolloverSeason(second);
  assert.equal(third.seasonHistory!.length, 2);
  assert.notEqual(third.seasonHistory![0]!.seasonId, third.seasonHistory![1]!.seasonId);
  const ids = [...first.fixtures, ...second.fixtures, ...third.fixtures].filter((f) => f.type === "LEAGUE").map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length, "fixture ids never repeat across seasons");
  const seasonMessages = second.inbox.filter((m) => m.id.startsWith("season-complete:"));
  assert.deepEqual(seasonMessages.map((m) => m.id), [seasonCompleteMessageId(first.seasonId), seasonCompleteMessageId(second.seasonId)]);
  assert.equal(new Set(second.inbox.map((m) => m.id)).size, second.inbox.length, "every inbox id is unique");
});

test("season-complete message: stable per-season id, dated, appended exactly once", () => {
  const done = completedSeason();
  const message = done.inbox.find((m) => m.id === seasonCompleteMessageId(done.seasonId));
  assert.ok(message, "message exists");
  assert.equal(message!.date, done.gameDate, "carries the day the season ended");
  assert.equal(checkSeasonComplete(done), done, "idempotent once complete");
  // A second, independent run of the same season (a page reload re-runs the module) yields the same id.
  assert.equal(completedSeason().inbox.find((m) => m.id.startsWith("season-complete:"))!.id, message!.id);
});

test("an older save holding legacy career-msg ids still migrates and gets a non-colliding new message", () => {
  const done = completedSeason();
  const legacy = { ...done, seasonComplete: false, inbox: done.inbox.filter((m) => !m.id.startsWith("season-complete:")).concat({ ...done.inbox.find((m) => m.id.startsWith("season-complete:"))!, id: "career-msg-1", date: "" }) };
  const migrated = migrateCareerState(structuredClone(legacy));
  const completed = checkSeasonComplete({ ...migrated, seasonId: "2099/00" });
  const ids = completed.inbox.map((m) => m.id);
  assert.ok(ids.includes("career-msg-1"), "legacy message kept as it was");
  assert.ok(ids.includes(seasonCompleteMessageId("2099/00")));
  assert.equal(new Set(ids).size, ids.length);
});
