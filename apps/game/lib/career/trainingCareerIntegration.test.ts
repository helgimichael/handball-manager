// Historical match adapter regression. Production lifecycle is covered by productionMatch.test.ts.
// HM-TRAINING-1.0 Part 30/31: the match -> recovery -> training ->
// next-match loop, save migration, and the required deterministic
// weekly scenario. This is the domain-integration layer one level above
// lib/training/*.test.ts -- real CareerState, real calendar, real
// matchdayAction.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { continueCareerRhythm } from "./continueController";
import { processDay } from "./dailyTick";
import { playManagerFixtureLegacy as playManagerFixture } from "./legacy/matchday";
import { migrateCareerState } from "./saveMigration";
import { addDays } from "./dateUtils";
import { TUMBA_CLUB_ID } from "../game-data";
import { ENERGY_START_DEFAULT } from "../matchPlan/physicalModel";
import { addTrainingSession, mondayOf, removeTrainingSession, resolveTrainingWeek, setTrainingDayType } from "../training/trainingSchedule";
import { createLiveMatchSession } from "../liveMatch/liveMatchSession";
import { defaultTeamTacticalProfile } from "./teamTacticalProfile";
import type { CareerState } from "./types";

function freshState(seed: string) {
  return createNewCareerState(seed, TUMBA_CLUB_ID);
}

function twoManagerFixtures(state: CareerState) {
  const own = state.fixtures.filter((f) => f.homeClubId === TUMBA_CLUB_ID || f.awayClubId === TUMBA_CLUB_ID).sort((a, b) => a.date.localeCompare(b.date));
  return [own[0], own[1]];
}

/**
 * Finds the first consecutive pair of the manager's own fixtures that are
 * exactly 7 days apart -- a real single-match week, giving Part 31's own
 * scenario narrative (recovery, tactical, conditioning, rest, tactical,
 * match-preparation eve, next match) a full 7 days to actually play out
 * before the next kickoff. The real fixture list's gaps vary (4-10 days
 * depending on the generated season), so this searches for a genuine
 * occurrence rather than hand-picking or faking dates. Each edited day
 * below resolves its OWN training week independently (see `setDayType`/
 * `setDaySession`), so this does not require the fixture to fall on any
 * particular weekday -- only the 7-day gap itself matters.
 */
function sevenDayGapManagerFixtures(state: CareerState) {
  const own = state.fixtures.filter((f) => f.homeClubId === TUMBA_CLUB_ID || f.awayClubId === TUMBA_CLUB_ID).sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 0; i < own.length - 1; i++) {
    const gapDays = (Date.parse(own[i + 1].date) - Date.parse(own[i].date)) / 86_400_000;
    if (gapDays === 7) return [own[i], own[i + 1]] as const;
  }
  throw new Error("no 7-day-gap fixture pair found in the generated season -- scenario test needs one");
}

/** Sets `date`'s dayType, resolving/persisting that date's own week independently of any other date's edits. */
function setDayType(state: CareerState, date: string, dayType: Parameters<typeof setTrainingDayType>[2]): CareerState {
  const weekStart = mondayOf(date);
  const week = setTrainingDayType(resolveTrainingWeek(state, weekStart), date, dayType);
  return { ...state, trainingWeeks: { ...state.trainingWeeks, [weekStart]: week } };
}

/** Replaces `date`'s sessions with exactly `seed`, resolving/persisting that date's own week independently of any other date's edits. */
function setDaySession(state: CareerState, date: string, seed: Parameters<typeof addTrainingSession>[2]): CareerState {
  const weekStart = mondayOf(date);
  let week = resolveTrainingWeek(state, weekStart);
  const day = week.days.find((d) => d.date === date)!;
  for (const s of day.sessions) week = removeTrainingSession(week, date, s.id);
  week = addTrainingSession(week, date, seed);
  return { ...state, trainingWeeks: { ...state.trainingWeeks, [weekStart]: week } };
}

/**
 * Advances CONTINUE presses until `targetDate` has been processed --
 * NEVER auto-resolves a matchday itself (the caller decides when to
 * call playManagerFixture, exactly like a real manager session). If
 * `targetDate` is itself a fixture date, this returns with that
 * fixture's own MATCHDAY_READY event still pending/unresolved.
 */
function continueThrough(state: CareerState, targetDate: string): CareerState {
  let current = state;
  while (current.processedThroughDate < targetDate) {
    const result = continueCareerRhythm(current);
    current = result.state;
    if (result.daysProcessed === 0) break; // blocked (e.g. an earlier unresolved matchday) -- caller must resolve it first
  }
  return current;
}

/**
 * Advances EXACTLY one calendar date via `processDay` directly, regardless
 * of event priority. Unlike `continueCareerRhythm` (which can silently
 * sweep past many days in one press whenever only INFORMATION-priority
 * events occur), this is the correct primitive for a test that needs to
 * inspect state after every single day.
 */
function advanceOneDay(state: CareerState): CareerState {
  return processDay(state, addDays(state.processedThroughDate, 1)).state;
}

function advanceToDate(state: CareerState, targetDate: string): CareerState {
  let current = state;
  while (current.processedThroughDate < targetDate) {
    current = advanceOneDay(current);
  }
  return current;
}

// (18) match finishing energy seeds career physical state.
test("(18) a played match's finishing energy is written into playerPhysicalState", () => {
  const state = freshState("loop-seed-18");
  const [fixture1] = twoManagerFixtures(state);
  const afterMatchday = continueThrough(state, fixture1.date);
  const { state: afterMatch, result } = playManagerFixture(afterMatchday);
  assert.ok(result);
  const anyManagerPlayerId = Object.keys(afterMatch.playerPhysicalState)[0];
  assert.ok(anyManagerPlayerId, "expected at least one player's physical state to be seeded by the match");
  const entry = afterMatch.playerPhysicalState[anyManagerPlayerId];
  assert.equal(entry.lastUpdatedDate, fixture1.date);
  assert.ok(entry.currentEnergy >= 0 && entry.currentEnergy <= 100);
});

// (19) next match startingEnergy comes from career physical state.
test("(19)/(20) training between fixtures changes the next match's own starting energy -- the loop is real, not just fixture-local", () => {
  const state = freshState("loop-seed-19");
  const [fixture1, fixture2] = twoManagerFixtures(state);
  const afterMatchday1 = advanceToDate(state, fixture1.date);
  const { state: afterMatch1 } = playManagerFixture(afterMatchday1);

  const anyManagerPlayerId = Object.keys(afterMatch1.playerPhysicalState)[0];
  const finishingEnergyMatch1 = afterMatch1.playerPhysicalState[anyManagerPlayerId].currentEnergy;
  assert.ok(finishingEnergyMatch1 < ENERGY_START_DEFAULT, "a player active in match 1 should finish below 100");

  // The gap between these two fixtures can be short enough that light
  // default-template training lets energy fully recover to exactly
  // ENERGY_MAX before kickoff 2 -- a legitimate outcome that happens to
  // collide numerically with ENERGY_START_DEFAULT (both 100), making the
  // "not reset to a hardcoded default" proof ambiguous by coincidence.
  // Schedule real VERY_HIGH CONDITIONING on the non-eve days in between
  // (the fixture-aware builder still forces the eve-of-match day down to
  // a single low MATCH_PREPARATION session) so the carried-over energy
  // is unambiguously distinguishable from a hardcoded 100 reset, without
  // touching any production tuning constant.
  let betweenWeeks = afterMatch1;
  for (let d = addDays(fixture1.date, 1); d < fixture2.date; d = addDays(d, 1)) {
    const weekStart = mondayOf(d);
    let week = resolveTrainingWeek(betweenWeeks, weekStart);
    const day = week.days.find((day) => day.date === d)!;
    if (day.dayType !== "TRAINING") continue; // don't fight the fixture-aware eve-of-match/MATCH forcing
    for (const s of day.sessions) week = removeTrainingSession(week, d, s.id);
    week = addTrainingSession(week, d, { type: "CONDITIONING", intensity: "VERY_HIGH", duration: "LONG", target: "ALL" });
    betweenWeeks = { ...betweenWeeks, trainingWeeks: { ...betweenWeeks.trainingWeeks, [weekStart]: week } };
  }

  const afterMatchday2 = advanceToDate(betweenWeeks, fixture2.date);
  // The manager squad's own physical state, right before playing match 2,
  // must already reflect match 1's finishing energy plus whatever the
  // week of training/recovery in between did to it -- never a hard
  // reset back to 100.
  const preMatch2Energy = afterMatchday2.playerPhysicalState[anyManagerPlayerId].currentEnergy;
  assert.notEqual(preMatch2Energy, ENERGY_START_DEFAULT);

  const { state: afterMatch2, result: result2 } = playManagerFixture(afterMatchday2);
  assert.ok(result2);
  // And the SECOND match's own resolved trajectory must have started
  // from that carried-over value, not from 100 -- confirmed via the
  // persisted MatchPhysicalReport's own startingEnergy field.
  const report2 = afterMatch2.physicalReports[fixture2.id];
  const homeOrAway = report2.home[anyManagerPlayerId] ? report2.home : report2.away;
  const trajectory = homeOrAway[anyManagerPlayerId];
  if (trajectory) {
    assert.notEqual(trajectory.startingEnergy, ENERGY_START_DEFAULT, "match 2's own starting energy must reflect the career physical state, not a fresh 100");
  }
});

// (29) training schedule survives save migration.
test("(29) an old-format save (no HM-TRAINING-1.0 fields at all) migrates safely and additively", () => {
  const state = freshState("migration-seed");
  const legacy = { ...state } as Partial<CareerState>;
  delete (legacy as Record<string, unknown>).trainingWeeks;
  delete (legacy as Record<string, unknown>).playerPhysicalState;
  delete (legacy as Record<string, unknown>).playerTrainingAssignments;

  const migrated = migrateCareerState(legacy as CareerState);
  assert.deepEqual(migrated.trainingWeeks, {});
  assert.deepEqual(migrated.playerPhysicalState, {});
  assert.deepEqual(migrated.playerTrainingAssignments, {});
});

test("migrateCareerState is idempotent for an already-migrated HM-TRAINING-1.0 state", () => {
  const state = freshState("migration-idempotent-seed");
  const once = migrateCareerState(state);
  const twice = migrateCareerState(once);
  assert.deepEqual(once, twice);
});

// (30) active LiveMatchSession blocks accidental calendar training progression.
test("(30) CONTINUE refuses to advance (and therefore cannot execute a new training day) while a matchday's own MATCHDAY_READY is still unresolved -- the existing ACTION_REQUIRED_PENDING gate already covers a live match", () => {
  const state = freshState("live-match-block-seed");
  const [fixture1] = twoManagerFixtures(state);
  const afterMatchday = continueThrough(state, fixture1.date);
  // Simulate "the match is live": an active session exists, and the
  // fixture's own MATCHDAY_READY event has NOT yet been resolved
  // (exactly the state a real Live Match is in from kickoff until
  // playManagerFixture actually runs).
  const withLiveSession: CareerState = { ...afterMatchday, activeMatchSession: createLiveMatchSession(fixture1.id, defaultTeamTacticalProfile()) };
  const result = continueCareerRhythm(withLiveSession);
  assert.equal(result.stopReason, "ACTION_REQUIRED_PENDING");
  assert.equal(result.daysProcessed, 0);
  assert.deepEqual(result.state.trainingWeeks, withLiveSession.trainingWeeks, "no new training day may have executed");
});

// ---------------------------------------------------------------------------
// Part 31: the required deterministic weekly scenario.
// ---------------------------------------------------------------------------

test("Part 31 end-to-end scenario: match -> Sun recovery -> Mon tactical -> Tue high conditioning -> Wed rest -> Thu tactical -> Fri prep -> Sat next match", () => {
  const state = freshState("scenario-seed");
  const [fixture1, fixture2] = sevenDayGapManagerFixtures(state);

  const sunday = addDays(fixture1.date, 1);
  const monday = addDays(fixture1.date, 2);
  const tuesday = addDays(fixture1.date, 3);
  const wednesday = addDays(fixture1.date, 4);
  const thursday = addDays(fixture1.date, 5);

  let seeded = state;

  // Sunday: RECOVERY.
  seeded = setDayType(seeded, sunday, "RECOVERY");
  seeded = setDaySession(seeded, sunday, { type: "RECOVERY", intensity: "LOW", duration: "NORMAL", target: "ALL" });

  // Monday: normal tactical.
  seeded = setDaySession(seeded, monday, { type: "TEAM_TACTICAL", intensity: "NORMAL", duration: "NORMAL", target: "ALL", tacticalFocus: "GENERAL" });

  // Tuesday: high conditioning.
  seeded = setDaySession(seeded, tuesday, { type: "CONDITIONING", intensity: "HIGH", duration: "NORMAL", target: "ALL" });

  // Wednesday: rest.
  seeded = setDayType(seeded, wednesday, "REST");

  // Thursday: normal tactical.
  seeded = setDaySession(seeded, thursday, { type: "TEAM_TACTICAL", intensity: "NORMAL", duration: "NORMAL", target: "ALL", tacticalFocus: "GENERAL" });

  // Friday (day before fixture2) is left to the fixture-aware builder --
  // it is forced to a single low-intensity MATCH_PREPARATION session
  // automatically, satisfying Part 31's own "Friday: match preparation"
  // without any manual edit.

  // --- Execute the scenario for real, day by day, using actual engine output. ---
  const trajectory: { date: string; activity: string; energy: number | null }[] = [];
  const anyManagerPlayerId = Object.keys(seeded.playerStatuses)[0];

  let current = seeded;
  const afterMatchday1 = advanceToDate(current, fixture1.date);
  const { state: afterMatch1 } = playManagerFixture(afterMatchday1);
  trajectory.push({ date: fixture1.date, activity: "MATCH", energy: afterMatch1.playerPhysicalState[anyManagerPlayerId]?.currentEnergy ?? null });
  current = afterMatch1;

  for (const [date, label] of [
    [sunday, "RECOVERY"],
    [monday, "TRAINING (tactical)"],
    [tuesday, "TRAINING (high conditioning)"],
    [wednesday, "REST"],
    [thursday, "TRAINING (tactical)"],
  ] as const) {
    current = advanceToDate(current, date);
    trajectory.push({ date, activity: label, energy: current.playerPhysicalState[anyManagerPlayerId]?.currentEnergy ?? null });
  }

  const afterMatchday2 = advanceToDate(current, fixture2.date);
  const startingEnergyForMatch2 = afterMatchday2.playerPhysicalState[anyManagerPlayerId]?.currentEnergy ?? null;
  const { state: afterMatch2, result: result2 } = playManagerFixture(afterMatchday2);
  assert.ok(result2, "the second fixture must actually resolve");
  trajectory.push({ date: fixture2.date, activity: "NEXT MATCH (starting energy shown)", energy: startingEnergyForMatch2 });
  trajectory.push({ date: fixture2.date, activity: "NEXT MATCH (finishing energy)", energy: afterMatch2.playerPhysicalState[anyManagerPlayerId]?.currentEnergy ?? null });

  console.log("HM-TRAINING-1.0 Part 31 scenario trajectory (real engine output):", JSON.stringify(trajectory, null, 1));

  // Directional assertions -- never hand-faked, all from the trajectory just computed above.
  assert.ok(trajectory[0].energy !== null && trajectory[0].energy! < ENERGY_START_DEFAULT, "match 1 should leave the player below full energy");
  const afterRecoverySunday = trajectory[1].energy!;
  assert.ok(afterRecoverySunday > trajectory[0].energy!, "Sunday recovery should raise energy above the post-match value");
  const afterTuesdayConditioning = trajectory[3].energy!;
  const afterMondayTactical = trajectory[2].energy!;
  assert.ok(afterTuesdayConditioning < afterMondayTactical, "Tuesday's high conditioning session should reduce energy versus Monday's lighter tactical day");
  const afterWednesdayRest = trajectory[4].energy!;
  assert.ok(afterWednesdayRest > afterTuesdayConditioning, "Wednesday's rest day should raise energy above Tuesday's post-conditioning value");
  // Note: this well-managed week (two recovery-oriented days, a rest day,
  // and a light eve-of-match prep session) genuinely returns the player
  // to full ENERGY_MAX by kickoff 2 -- a legitimate outcome, not a
  // hardcoded-100 bug. The specific "never a fresh 100" acceptance proof
  // for Part 11/19/20 is covered separately by the "(19)/(20)" test
  // above, using a week deliberately loaded with enough hard training
  // that energy provably stays below max -- that is the right place to
  // assert non-default carry-over, not this narrative scenario.
  assert.ok(startingEnergyForMatch2 !== null, "the next match's own starting energy must be a real carried-over career value");
  const report2 = afterMatch2.physicalReports[fixture2.id];
  const trajectory2 = (report2.home[anyManagerPlayerId] ?? report2.away[anyManagerPlayerId]) as { startingEnergy: number } | undefined;
  if (trajectory2) {
    assert.equal(trajectory2.startingEnergy, startingEnergyForMatch2, "match 2's own resolved trajectory must have started from the exact carried-over career value, not a value it invented separately");
  }
});
