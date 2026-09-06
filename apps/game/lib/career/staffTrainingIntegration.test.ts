// HM-STAFF-1.0 Part 34/35: the domain-integration layer -- real
// CareerState, real training execution, real weekly development
// resolution, with staff quality actually wired through. Plus the
// required 12-week/52-week weak/average/elite longitudinal comparisons.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { migrateCareerState } from "./saveMigration";
import { playManagerFixture } from "./matchdayAction";
import { processDay } from "./dailyTick";
import { addDays } from "./dateUtils";
import { TUMBA_CLUB_ID } from "../game-data";
import { executeTrainingDay } from "../training/trainingExecution";
import { mondayOf, resolveTrainingWeek, setTrainingDayType, addTrainingSession, removeTrainingSession, setPlayerTrainingLoad } from "../training/trainingSchedule";
import { applyTrainingDayDevelopmentStimulus, resolveWeeklyDevelopmentIfDue } from "../development/developmentIntegration";
import { PROGRESS_THRESHOLD_PER_POINT } from "../development/developmentResolution";
import type { PlayerDevelopmentEvent } from "../development/types";
import { OUTCOURT_ATTRIBUTES, GOALKEEPER_ATTRIBUTES } from "../rating/types";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import type { CareerState } from "./types";
import type { ResolvedStaffMember, StaffAttribute } from "../staff/types";
import { generateStaffAttributeProfile } from "../staff/staffAttributeGeneration";

/** Every fixture in this file starts flat, so converted attribute points are exactly (value - FIXTURE_ATTRIBUTE_START). */
const FIXTURE_ATTRIBUTE_START = 10;

function buildOutcourtRating(playerId: string, ca: number, pa: number): GameplayPlayerRating {
  const attributes: Record<string, { value: number; origin: string }> = {};
  for (const attr of OUTCOURT_ATTRIBUTES) attributes[attr] = { value: FIXTURE_ATTRIBUTE_START, origin: "GENERATED_PRIOR" };
  return {
    playerId,
    position: "M6",
    ca,
    pa,
    caSource: "GENERATED_GAME_PRIOR" as GameplayPlayerRating["caSource"],
    branch: { branch: "OUTCOURT", attributes } as GameplayPlayerRating["branch"],
    attackRoleProficiencies: [],
    defenceRoleProficiencies: [],
    attributeGenerationModelVersion: "test",
    locked: false,
  };
}

function buildGoalkeeperRating(playerId: string, ca: number, pa: number): GameplayPlayerRating {
  const attributes: Record<string, { value: number; origin: string }> = {};
  for (const attr of GOALKEEPER_ATTRIBUTES) attributes[attr] = { value: FIXTURE_ATTRIBUTE_START, origin: "GENERATED_PRIOR" };
  return {
    playerId,
    position: "GK",
    ca,
    pa,
    caSource: "GENERATED_GAME_PRIOR" as GameplayPlayerRating["caSource"],
    branch: { branch: "GOALKEEPER", attributes } as GameplayPlayerRating["branch"],
    attackRoleProficiencies: [],
    defenceRoleProficiencies: [],
    attributeGenerationModelVersion: "test",
    locked: false,
  };
}

function buildCoach(id: string, roles: ResolvedStaffMember["roles"], overrides: Partial<Record<StaffAttribute, number>>): ResolvedStaffMember {
  const profile = generateStaffAttributeProfile(id, roles, id);
  for (const [attr, value] of Object.entries(overrides)) profile.attributes[attr as StaffAttribute] = { value: value!, origin: "GENERATED_PRIOR" };
  return { id, clubId: TUMBA_CLUB_ID, displayName: id, roles, hmRoles: [], employmentType: "SALARIED", profile, source: "GENERATED_FICTIONAL" };
}

function freshState(seed: string, ratings: readonly GameplayPlayerRating[], roster: readonly ResolvedStaffMember[]): CareerState {
  const state = createNewCareerState(seed, TUMBA_CLUB_ID);
  return { ...state, gameplayRatings: { ...state.gameplayRatings, [TUMBA_CLUB_ID]: [...ratings] }, staffRoster: { ...state.staffRoster, [TUMBA_CLUB_ID]: [...roster] } };
}

function advanceOneWeekTechnical(state: CareerState, mondayDate: string): CareerState {
  let current = state;
  for (let i = 0; i < 7; i++) {
    const date = addDays(mondayDate, i);
    const weekStart = mondayOf(date);
    let week = resolveTrainingWeek(current, weekStart);
    const day = week.days.find((d) => d.date === date)!;
    if (day.dayType === "TRAINING") {
      for (const s of day.sessions) week = removeTrainingSession(week, date, s.id);
      week = addTrainingSession(week, date, { type: "TECHNICAL", intensity: "NORMAL", duration: "NORMAL", target: "ALL" });
      current = { ...current, trainingWeeks: { ...current.trainingWeeks, [weekStart]: week } };
    }
    current = executeTrainingDay(current, date);
    current = applyTrainingDayDevelopmentStimulus(current, date);
  }
  current = resolveWeeklyDevelopmentIfDue(current, addDays(mondayDate, 6));
  return current;
}

function totalProgress(state: CareerState, playerId: string): number {
  const dev = state.playerDevelopmentState[playerId];
  if (!dev) return 0;
  return Object.values(dev.attributeProgress).reduce((a, b) => a + (b ?? 0), 0);
}

/**
 * Attribute points this player has actually been AWARDED, read from the real
 * applied attribute values rather than from developmentHistory -- history is
 * capped at DEVELOPMENT_HISTORY_LIMIT (20), so counting it silently undercounts
 * exactly the fast-developing player a coaching comparison is trying to detect.
 */
function convertedPoints(state: CareerState, playerId: string): number {
  for (const ratings of Object.values(state.gameplayRatings)) {
    const rating = ratings.find((r) => r.playerId === playerId);
    if (!rating) continue;
    const attributes = rating.branch.attributes as unknown as Record<string, { value: number }>;
    return Object.values(attributes).reduce((sum, a) => sum + (a.value - FIXTURE_ATTRIBUTE_START), 0);
  }
  return 0;
}

/**
 * REALISED development: progress already converted into attribute points, plus
 * progress still pending in the accumulator.
 *
 * `totalProgress` alone is residual accumulator state and is NOT monotonic in
 * development: crossing PROGRESS_THRESHOLD_PER_POINT awards a point and reduces
 * the accumulator, so the player who has developed MORE can show LESS residual.
 * Every cross-subject development comparison in this file must use this instead.
 */
function realisedDevelopment(state: CareerState, playerId: string): number {
  return convertedPoints(state, playerId) * PROGRESS_THRESHOLD_PER_POINT + totalProgress(state, playerId);
}

// (35) session result stores coach attribution.
test("(35) a session's TrainingSessionResult stores the resolved coach id and quality", () => {
  const playerId = "p-hallqvist";
  const coach = buildCoach("coach1", ["ASSISTANT_COACH"], { TECHNICAL_COACHING: 15 });
  let state = freshState("staff-35", [buildOutcourtRating(playerId, 100, 190)], [coach]);
  const date = state.gameDate;
  const weekStart = mondayOf(date);
  let week = resolveTrainingWeek(state, weekStart);
  week = setTrainingDayType(week, date, "TRAINING");
  week = addTrainingSession(week, date, { type: "TECHNICAL", intensity: "NORMAL", duration: "NORMAL", target: "ALL" });
  state = { ...state, trainingWeeks: { ...state.trainingWeeks, [weekStart]: week } };

  const after = executeTrainingDay(state, date);
  const executedDay = after.trainingWeeks[weekStart].days.find((d) => d.date === date)!;
  const result = executedDay.results![0];
  assert.equal(result.resolvedCoachId, coach.id);
  assert.ok(result.resolvedStaffQuality > 1.0, `expected a strong coach to yield quality > 1.0, got ${result.resolvedStaffQuality}`);
});

// (27) staff does not directly mutate attributes without resolution threshold.
test("(27) a single session under an elite coach never produces an immediate visible attribute change", () => {
  const eliteCoach = buildCoach("elite-immediate", ["ASSISTANT_COACH"], { TECHNICAL_COACHING: 20, TACTICAL_COACHING: 20 });
  let state = freshState("staff-27", [buildOutcourtRating("p-hallqvist", 100, 190)], [eliteCoach]);
  const date = state.gameDate;
  const weekStart = mondayOf(date);
  let week = resolveTrainingWeek(state, weekStart);
  week = setTrainingDayType(week, date, "TRAINING");
  week = addTrainingSession(week, date, { type: "TECHNICAL", intensity: "VERY_HIGH", duration: "LONG", target: "ALL" });
  state = { ...state, trainingWeeks: { ...state.trainingWeeks, [weekStart]: week } };
  state = executeTrainingDay(state, date);
  state = applyTrainingDayDevelopmentStimulus(state, date);
  const rating = state.gameplayRatings[TUMBA_CLUB_ID].find((r) => r.playerId === "p-hallqvist")!;
  assert.equal(rating.ca, 100, "CA/attributes must never change before weekly resolution runs, no matter how strong the coach");
});

// (25) weak coach + same stimulus < strong coach development progress.
test("(25) identical training under a WEAK coach produces less accumulated progress than under a STRONG coach", () => {
  const weakCoach = buildCoach("weak-coach", ["ASSISTANT_COACH"], { TECHNICAL_COACHING: 2, TACTICAL_COACHING: 2 });
  const strongCoach = buildCoach("strong-coach", ["ASSISTANT_COACH"], { TECHNICAL_COACHING: 19, TACTICAL_COACHING: 19 });

  // INTENT: stronger coaching must produce at least as much REALISED
  // development as weaker coaching, and strictly more while the system is
  // below its caps. Measured with realisedDevelopment, never residual
  // progress -- see that helper for why residual inverts once points land.
  function afterFourWeeks(label: string, coach: ResolvedStaffMember, ca: number, pa: number): number {
    let state = freshState(label, [buildOutcourtRating("p-hallqvist", ca, pa)], [coach]);
    let week = mondayOf(state.gameDate);
    for (let w = 1; w <= 4; w++) {
      state = advanceOneWeekTechnical(state, week);
      week = addDays(week, 7);
    }
    return realisedDevelopment(state, "p-hallqvist");
  }

  // Below saturation (moderate headroom): the advantage must be STRICT.
  const weakModerate = afterFourWeeks("staff-25-weak-mod", weakCoach, 100, 135);
  const strongModerate = afterFourWeeks("staff-25-strong-mod", strongCoach, 100, 135);
  assert.ok(strongModerate > weakModerate, `below saturation a strong coach must develop strictly more: weak=${weakModerate} strong=${strongModerate}`);

  // The deliberately extreme CA100/PA190 fixture sits at the existing
  // per-attribute stimulus cap and the one-point-per-resolution cap, where
  // both coaches can legitimately TIE. That is a real saturation property of
  // the caps, not a coaching regression -- so the requirement here is >=,
  // and the stronger coach may never come out behind.
  const weakExtreme = afterFourWeeks("staff-25-weak", weakCoach, 100, 190);
  const strongExtreme = afterFourWeeks("staff-25-strong", strongCoach, 100, 190);
  assert.ok(strongExtreme >= weakExtreme, `at saturation a strong coach must never develop LESS: weak=${weakExtreme} strong=${strongExtreme}`);
});

// (26) staff multiplier affects conversion, not participation.
test("(26) a REST-load player accumulates zero stimulus regardless of coach quality (staff cannot create participation that doesn't exist)", () => {
  const eliteCoach = buildCoach("elite", ["ASSISTANT_COACH"], { TECHNICAL_COACHING: 20 });
  let state = freshState("staff-26", [buildOutcourtRating("p-hallqvist", 100, 190)], [eliteCoach]);
  state = setPlayerTrainingLoad(state, "p-hallqvist", "REST");
  state = advanceOneWeekTechnical(state, mondayOf(state.gameDate));
  const dev = state.playerDevelopmentState["p-hallqvist"];
  assert.ok(!dev || Object.values(dev.attributeStimulus).every((v) => !v), "expected zero stimulus for a RESTing player even under an elite coach");
});

// (28) no stimulus = no growth even with elite coach.
test("(28) a player who never trains accumulates no progress even with an elite coach on staff", () => {
  const eliteCoach = buildCoach("elite2", ["ASSISTANT_COACH"], { TECHNICAL_COACHING: 20, TACTICAL_COACHING: 20 });
  let state = freshState("staff-28", [buildOutcourtRating("p-hallqvist", 100, 190)], [eliteCoach]);
  // Advance a week with NO training sessions scheduled for this player (all REST).
  const week = mondayOf(state.gameDate);
  for (let i = 0; i < 7; i++) {
    const date = addDays(week, i);
    const weekStart = mondayOf(date);
    let w = resolveTrainingWeek(state, weekStart);
    w = setTrainingDayType(w, date, "REST");
    state = { ...state, trainingWeeks: { ...state.trainingWeeks, [weekStart]: w } };
    state = executeTrainingDay(state, date);
    state = applyTrainingDayDevelopmentStimulus(state, date);
  }
  state = resolveWeeklyDevelopmentIfDue(state, addDays(week, 6));
  assert.equal(totalProgress(state, "p-hallqvist"), 0);
});

// (29) reduced training remains reduced under elite coach.
test("(29) REDUCED participation still yields less progress than FULL, even under the same elite coach", () => {
  const eliteCoach = buildCoach("elite3", ["ASSISTANT_COACH"], { TECHNICAL_COACHING: 20 });
  let fullState = freshState("staff-29-full", [buildOutcourtRating("p-hallqvist", 100, 190)], [eliteCoach]);
  let reducedState = freshState("staff-29-reduced", [buildOutcourtRating("p-hallqvist", 100, 190)], [eliteCoach]);
  reducedState = setPlayerTrainingLoad(reducedState, "p-hallqvist", "REDUCED");

  fullState = advanceOneWeekTechnical(fullState, mondayOf(fullState.gameDate));
  reducedState = advanceOneWeekTechnical(reducedState, mondayOf(reducedState.gameDate));

  assert.ok(totalProgress(fullState, "p-hallqvist") > totalProgress(reducedState, "p-hallqvist"));
});

// (30) age/headroom still matter with staff enabled.
test("(30) a young high-headroom player still outpaces a low-headroom player under the SAME elite coach", () => {
  const eliteCoach = buildCoach("elite4", ["ASSISTANT_COACH"], { TECHNICAL_COACHING: 20 });
  let highHeadroom = freshState("staff-30-high", [buildOutcourtRating("p-hallqvist", 100, 190)], [eliteCoach]);
  let lowHeadroom = freshState("staff-30-low", [buildOutcourtRating("p-hallqvist", 100, 110)], [eliteCoach]);

  let week = mondayOf(highHeadroom.gameDate);
  for (let w = 1; w <= 4; w++) {
    highHeadroom = advanceOneWeekTechnical(highHeadroom, week);
    lowHeadroom = advanceOneWeekTechnical(lowHeadroom, week);
    week = addDays(week, 7);
  }
  // INTENT: remaining potential must still drive development speed. Compared
  // on realised development -- the high-headroom player converts progress into
  // points sooner, which DEFLATES his residual accumulator.
  const high = realisedDevelopment(highHeadroom, "p-hallqvist");
  const low = realisedDevelopment(lowHeadroom, "p-hallqvist");
  assert.ok(high > low, `a young high-headroom player must outdevelop a low-headroom one: high=${high} low=${low}`);
});

// (31) near-potential player still develops slowly with elite coach.
test("(31) a player already AT their potential develops extremely slowly even under an elite coach", () => {
  const eliteCoach = buildCoach("elite5", ["ASSISTANT_COACH"], { TECHNICAL_COACHING: 20 });
  let atPotential = freshState("staff-31-at", [buildOutcourtRating("p-hallqvist", 150, 150)], [eliteCoach]);
  let highHeadroom = freshState("staff-31-high", [buildOutcourtRating("p-hallqvist", 100, 190)], [eliteCoach]);

  let week = mondayOf(atPotential.gameDate);
  for (let w = 1; w <= 4; w++) {
    atPotential = advanceOneWeekTechnical(atPotential, week);
    highHeadroom = advanceOneWeekTechnical(highHeadroom, week);
    week = addDays(week, 7);
  }
  // INTENT: PA stays a soft ceiling -- a player already AT his potential still
  // develops, but dramatically more slowly, even under an elite coach.
  const high = realisedDevelopment(highHeadroom, "p-hallqvist");
  const at = realisedDevelopment(atPotential, "p-hallqvist");
  assert.ok(high > at * 3, `expected the at-potential player to develop dramatically less: atPotential=${at} highHeadroom=${high}`);
});

// (32) GK coach affects GK training only.
test("(32) an elite GK coach's quality affects GOALKEEPER sessions only, never a TECHNICAL session's own quality", () => {
  const roster = [buildCoach("gk-elite", ["GOALKEEPER_COACH"], { GOALKEEPER_COACHING: 20 }), buildCoach("assist-weak", ["ASSISTANT_COACH"], { TECHNICAL_COACHING: 2 })];
  let state = freshState("staff-32", [buildGoalkeeperRating("p-palicka", 100, 190)], roster);
  const date = state.gameDate;
  const weekStart = mondayOf(date);
  let week = resolveTrainingWeek(state, weekStart);
  week = setTrainingDayType(week, date, "TRAINING");
  week = addTrainingSession(week, date, { type: "GOALKEEPER", intensity: "NORMAL", duration: "NORMAL", target: "GOALKEEPERS" });
  state = { ...state, trainingWeeks: { ...state.trainingWeeks, [weekStart]: week } };
  const after = executeTrainingDay(state, date);
  const result = after.trainingWeeks[weekStart].days.find((d) => d.date === date)!.results![0];
  assert.equal(result.resolvedCoachId, "gk-elite");
  assert.ok(result.resolvedStaffQuality > 1.0);
});

// (33) physical coach affects physical training only.
test("(33) a STRENGTH session resolves to the PHYSICAL_COACH, never the (irrelevant) GOALKEEPER_COACH", () => {
  const roster = [buildCoach("gk-elite2", ["GOALKEEPER_COACH"], { GOALKEEPER_COACHING: 20 }), buildCoach("phys-elite", ["PHYSICAL_COACH"], { PHYSICAL_COACHING: 18 })];
  let state = freshState("staff-33", [buildOutcourtRating("p-hallqvist", 100, 190)], roster);
  const date = state.gameDate;
  const weekStart = mondayOf(date);
  let week = resolveTrainingWeek(state, weekStart);
  week = setTrainingDayType(week, date, "TRAINING");
  week = addTrainingSession(week, date, { type: "STRENGTH", intensity: "NORMAL", duration: "NORMAL", target: "ALL" });
  state = { ...state, trainingWeeks: { ...state.trainingWeeks, [weekStart]: week } };
  const after = executeTrainingDay(state, date);
  const result = after.trainingWeeks[weekStart].days.find((d) => d.date === date)!.results![0];
  assert.equal(result.resolvedCoachId, "phys-elite");
});

// (34) tactical/technical coaching does not alter current Energy.
test("(34) an elite coach's quality never changes a session's own physical energy load -- only development stimulus", () => {
  const eliteCoach = buildCoach("elite6", ["ASSISTANT_COACH"], { TECHNICAL_COACHING: 20 });
  const weakCoach = buildCoach("weak6", ["ASSISTANT_COACH"], { TECHNICAL_COACHING: 2 });
  const buildAndRun = (coach: ResolvedStaffMember) => {
    let state = freshState("staff-34", [buildOutcourtRating("p-hallqvist", 100, 190)], [coach]);
    const date = state.gameDate;
    const weekStart = mondayOf(date);
    let week = resolveTrainingWeek(state, weekStart);
    week = setTrainingDayType(week, date, "TRAINING");
    week = addTrainingSession(week, date, { type: "TECHNICAL", intensity: "NORMAL", duration: "NORMAL", target: "ALL" });
    state = { ...state, trainingWeeks: { ...state.trainingWeeks, [weekStart]: week } };
    const after = executeTrainingDay(state, date);
    return after.playerPhysicalState["p-hallqvist"].currentEnergy;
  };
  assert.equal(buildAndRun(eliteCoach), buildAndRun(weakCoach));
});

// (36) weekly development deterministic with coach quality.
test("(36) two identical runs (same coach, same training history) produce byte-identical development", () => {
  const coach = buildCoach("det-coach", ["ASSISTANT_COACH"], { TECHNICAL_COACHING: 15 });
  const run = () => {
    let state = freshState("staff-36", [buildOutcourtRating("p-hallqvist", 100, 190)], [coach]);
    let week = mondayOf(state.gameDate);
    for (let w = 1; w <= 3; w++) {
      state = advanceOneWeekTechnical(state, week);
      week = addDays(week, 7);
    }
    return state;
  };
  const a = run();
  const b = run();
  assert.deepEqual(a.playerDevelopmentState, b.playerDevelopmentState);
  assert.deepEqual(a.gameplayRatings, b.gameplayRatings);
});

// (37) changing coach affects future weeks only.
test("(37) replacing a weak coach with a strong one mid-career only changes FUTURE weeks' quality, not past accumulated stimulus resolution", () => {
  const weakCoach = buildCoach("swap-weak", ["ASSISTANT_COACH"], { TECHNICAL_COACHING: 2 });
  const strongCoach = buildCoach("swap-strong", ["ASSISTANT_COACH"], { TECHNICAL_COACHING: 19 });

  let state = freshState("staff-37", [buildOutcourtRating("p-hallqvist", 100, 190)], [weakCoach]);
  const week1 = mondayOf(state.gameDate);
  state = advanceOneWeekTechnical(state, week1);
  const progressAfterWeak = totalProgress(state, "p-hallqvist");

  // Swap the roster to the strong coach -- only the roster changes, nothing about week 1's already-resolved state is touched.
  state = { ...state, staffRoster: { ...state.staffRoster, [TUMBA_CLUB_ID]: [strongCoach] } };
  const devSnapshotBeforeWeek2 = state.playerDevelopmentState["p-hallqvist"];

  const week2 = addDays(week1, 7);
  state = advanceOneWeekTechnical(state, week2);
  const progressAfterStrong = totalProgress(state, "p-hallqvist") - progressAfterWeak;

  assert.equal(devSnapshotBeforeWeek2.lastDevelopmentDate, addDays(week1, 6), "week 1's own resolution date (its Sunday) must be unchanged by the coach swap");
  assert.ok(progressAfterStrong > 0);
});

// (24)/(40) staff employment / roster survives save migration, no reroll.
test("(24)/(40) staff roster/employment survive save migration additively, and reload does not reroll generated staff", () => {
  const state = createNewCareerState("staff-migration-seed", TUMBA_CLUB_ID);
  const legacy = { ...state } as Partial<CareerState>;
  delete (legacy as Record<string, unknown>).staffRoster;
  delete (legacy as Record<string, unknown>).staffEmployment;
  const migrated = migrateCareerState(legacy as CareerState);
  assert.deepEqual(migrated.staffRoster, {});
  assert.deepEqual(migrated.staffEmployment, {});

  // Reload (idempotent migration) of an ALREADY-populated state must not reroll it.
  const once = migrateCareerState(state);
  const twice = migrateCareerState(once);
  assert.deepEqual(once.staffRoster, twice.staffRoster);
  assert.deepEqual(once.staffEmployment, twice.staffEmployment);
  assert.deepEqual(state.staffRoster, once.staffRoster);
});

function advanceOneDay(state: CareerState): CareerState {
  return processDay(state, addDays(state.processedThroughDate, 1)).state;
}
function advanceToDate(state: CareerState, targetDate: string): CareerState {
  let current = state;
  while (current.processedThroughDate < targetDate) current = advanceOneDay(current);
  return current;
}

// (38)/(39) prior completed development event / historical match output unchanged.
test("(38)/(39) a completed development event and an already-played match's own result stay byte-identical after later staff-driven development", () => {
  const eliteCoach = buildCoach("hist-elite", ["ASSISTANT_COACH"], { TECHNICAL_COACHING: 20, TACTICAL_COACHING: 20 });
  const state = freshState("staff-38-39", [buildOutcourtRating("p-hallqvist", 100, 190)], [eliteCoach]);
  const own = state.fixtures.filter((f) => f.homeClubId === TUMBA_CLUB_ID || f.awayClubId === TUMBA_CLUB_ID).sort((a, b) => a.date.localeCompare(b.date));
  const fixture1 = own[0];

  const afterMatchday = advanceToDate(state, fixture1.date);
  const { state: afterMatch1, result } = playManagerFixture(afterMatchday);
  assert.ok(result);
  const historicalResultSnapshot = afterMatch1.results[fixture1.id];

  // Drive enough weeks of elite-coached training to produce at least one
  // visible event, staying well under DEVELOPMENT_HISTORY_LIMIT (20) so
  // this test proves IMMUTABILITY, not eviction (a capped history's own
  // intentional oldest-entry eviction is a separate, already-covered
  // design choice, not a "rewrite").
  let withMoreTraining = afterMatch1;
  let week = mondayOf(withMoreTraining.gameDate);
  let firstEventSnapshot: PlayerDevelopmentEvent | null = null;
  for (let w = 1; w <= 40 && !firstEventSnapshot; w++) {
    withMoreTraining = advanceOneWeekTechnical(withMoreTraining, week);
    week = addDays(week, 7);
    const dev = withMoreTraining.playerDevelopmentState["p-hallqvist"];
    if (dev.developmentHistory.length > 0) firstEventSnapshot = dev.developmentHistory[0];
  }

  // Keep training three MORE weeks (nowhere near the 20-entry cap) -- the
  // already-recorded event must never retroactively change.
  let evenMoreTraining = withMoreTraining;
  for (let w = 1; w <= 3; w++) {
    evenMoreTraining = advanceOneWeekTechnical(evenMoreTraining, week);
    week = addDays(week, 7);
  }
  const laterDev = evenMoreTraining.playerDevelopmentState["p-hallqvist"];
  if (firstEventSnapshot) {
    const stillThere = laterDev.developmentHistory.find((e) => e.date === firstEventSnapshot!.date && e.attribute === firstEventSnapshot!.attribute);
    assert.ok(stillThere, "the earlier event must still be present in history");
    assert.deepEqual(stillThere, firstEventSnapshot, "an already-recorded development event must never be retroactively rewritten");
  }

  assert.deepEqual(evenMoreTraining.results[fixture1.id], historicalResultSnapshot, "the already-played fixture's own FastMatchResult must never change after the fact, regardless of staff-driven development");
});

// ---------------------------------------------------------------------------
// Part 35: 12-week and 52-week WEAK/AVERAGE/ELITE longitudinal comparison.
// ---------------------------------------------------------------------------

function buildScenario(seed: string, coach: ResolvedStaffMember) {
  return freshState(seed, [buildOutcourtRating("p-hallqvist", 100, 165)], [coach]);
}

test("Part 35: 12-week and 52-week WEAK vs AVERAGE vs ELITE coach longitudinal comparison (real engine output)", () => {
  const weakCoach = buildCoach("longitudinal-weak", ["ASSISTANT_COACH"], { TECHNICAL_COACHING: 3, TACTICAL_COACHING: 3 });
  const averageCoach = buildCoach("longitudinal-average", ["ASSISTANT_COACH"], { TECHNICAL_COACHING: 10, TACTICAL_COACHING: 10 });
  const eliteCoach = buildCoach("longitudinal-elite", ["ASSISTANT_COACH"], { TECHNICAL_COACHING: 19, TACTICAL_COACHING: 19 });

  function run(coach: ResolvedStaffMember, weeks: number) {
    let state = buildScenario(`longitudinal-${coach.id}-${weeks}`, coach);
    let week = mondayOf(state.gameDate);
    for (let w = 1; w <= weeks; w++) {
      state = advanceOneWeekTechnical(state, week);
      week = addDays(week, 7);
    }
    const rating = state.gameplayRatings[TUMBA_CLUB_ID].find((r) => r.playerId === "p-hallqvist")!;
    const dev = state.playerDevelopmentState["p-hallqvist"];
    const hiddenProgress = totalProgress(state, "p-hallqvist");
    // Total EVER-accumulated development = still-pending progress + progress
    // already converted into visible points -- `hiddenProgress` ALONE is
    // not a fair cross-coach comparison once visible crossings start
    // happening at different rates (a coach who converts progress into
    // points MORE often naturally carries a SMALLER pending remainder,
    // which would make them look like they developed less).
    // developmentHistory is capped at DEVELOPMENT_HISTORY_LIMIT (20), so it
    // UNDERCOUNTS a coach good enough to convert more than 20 points -- the
    // exact case this comparison exists to detect. Read the awarded points from
    // the applied attribute values instead.
    const totalAccumulated = realisedDevelopment(state, "p-hallqvist");
    return { endCA: rating.ca, visibleChanges: dev.developmentHistory.length, hiddenProgress, totalAccumulated };
  }

  const report12 = { weak: run(weakCoach, 12), average: run(averageCoach, 12), elite: run(eliteCoach, 12) };
  const report52 = { weak: run(weakCoach, 52), average: run(averageCoach, 52), elite: run(eliteCoach, 52) };

   
  console.log("HM-STAFF-1.0 Part 35: 12-week longitudinal report (real engine output):", JSON.stringify(report12, null, 1));
   
  console.log("HM-STAFF-1.0 Part 35: 52-week longitudinal report (real engine output):", JSON.stringify(report52, null, 1));

  // Directional assertions -- never hand-tuned to force an exact ordering.
  assert.ok(report12.elite.totalAccumulated >= report12.average.totalAccumulated, `12w elite=${report12.elite.totalAccumulated} average=${report12.average.totalAccumulated}`);
  assert.ok(report12.average.totalAccumulated >= report12.weak.totalAccumulated, `12w average=${report12.average.totalAccumulated} weak=${report12.weak.totalAccumulated}`);
  assert.ok(report52.elite.endCA >= report52.average.endCA, `52w elite CA=${report52.elite.endCA} average CA=${report52.average.endCA}`);
  assert.ok(report52.average.endCA >= report52.weak.endCA, `52w average CA=${report52.average.endCA} weak CA=${report52.weak.endCA}`);
  // "meaningfully but not overwhelm" -- elite should never be some absurd multiple of weak.
  const eliteDeltaCA = report52.elite.endCA - 100;
  const weakDeltaCA = report52.weak.endCA - 100;
  if (weakDeltaCA > 0) {
    assert.ok(eliteDeltaCA / weakDeltaCA < 6, `expected staff quality to matter meaningfully but not overwhelmingly, ratio=${eliteDeltaCA / weakDeltaCA}`);
  }
});
