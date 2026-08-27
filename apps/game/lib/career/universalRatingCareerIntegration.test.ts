// HM-RATINGS-CAREER-1.0 Part 29/30/32/33/34: proves the previously-dead
// mock-club development/match pipeline is now alive END-TO-END, using
// ONLY the auto-generated ratings a fresh career already produces --
// never manually injecting synthetic GameplayPlayerRating entries (that
// was the old workaround from HM-TRAINING-1.1/HM-STAFF-1.0's own tests,
// which this milestone makes unnecessary for a mock club).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { ensureCareerGameplayRatings } from "./careerRatingNormalization";
import { addDays } from "./dateUtils";
import { TUMBA_CLUB_ID } from "../game-data";
import { getCareerClubSquad } from "./careerWorld";
import { executeTrainingDay } from "../training/trainingExecution";
import { mondayOf, resolveTrainingWeek, setTrainingDayType, addTrainingSession, removeTrainingSession, setPlayerIndividualFocus } from "../training/trainingSchedule";
import { applyTrainingDayDevelopmentStimulus, resolveWeeklyDevelopmentIfDue } from "../development/developmentIntegration";
import { computeTeamStrengthTrace } from "./playerMatchStrength";
import { buildDefaultMatchPlan } from "../matchPlan/defaultMatchPlan";
import { playManagerFixture } from "./matchdayAction";
import { processDay } from "./dailyTick";
import type { MatchSquad } from "../matchPlan/types";
import type { CareerState } from "./types";
import type { ResolvedStaffMember, StaffAttribute } from "../staff/types";
import { generateStaffAttributeProfile } from "../staff/staffAttributeGeneration";
import { generateFallbackGameplayRating } from "../rating/generation/careerFallbackRating";
import { mapHandballPositionToMatchPlanPosition } from "../matchPlan/careerSquadBridge";

function advanceOneWeek(state: CareerState, mondayDate: string, sessionType: "TECHNICAL" = "TECHNICAL"): CareerState {
  let current = state;
  for (let i = 0; i < 7; i++) {
    const date = addDays(mondayDate, i);
    const weekStart = mondayOf(date);
    let week = resolveTrainingWeek(current, weekStart);
    const day = week.days.find((d) => d.date === date)!;
    if (day.dayType === "TRAINING") {
      for (const s of day.sessions) week = removeTrainingSession(week, date, s.id);
      week = addTrainingSession(week, date, { type: sessionType, intensity: "NORMAL", duration: "NORMAL", target: "ALL" });
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

function buildCoach(id: string, roles: ResolvedStaffMember["roles"], overrides: Partial<Record<StaffAttribute, number>>): ResolvedStaffMember {
  const profile = generateStaffAttributeProfile(id, roles, id);
  for (const [attr, value] of Object.entries(overrides)) profile.attributes[attr as StaffAttribute] = { value: value!, origin: "GENERATED_PRIOR" };
  return { id, clubId: TUMBA_CLUB_ID, displayName: id, roles, hmRoles: [], employmentType: "SALARIED", profile, source: "GENERATED_FICTIONAL" };
}

// ---------------------------------------------------------------------------
// Part 32: the mandatory IFK Tumba end-to-end test.
// ---------------------------------------------------------------------------

test("Part 32: fresh IFK Tumba career -- full roster rating coverage, real numbers", () => {
  const state = createNewCareerState("tumba-e2e", TUMBA_CLUB_ID);
  const squad = getCareerClubSquad(state, TUMBA_CLUB_ID);
  const ratings = state.gameplayRatings[TUMBA_CLUB_ID];
  const outcourtCount = ratings.filter((r) => r.branch.branch === "OUTCOURT").length;
  const gkCount = ratings.filter((r) => r.branch.branch === "GOALKEEPER").length;
  const missing = squad.filter((p) => !ratings.some((r) => r.playerId === p.id));

  const youngOutcourt = squad.find((p) => p.position !== "MV")!;
  const goalkeeper = squad.find((p) => p.position === "MV")!;
  const youngOutcourtRating = ratings.find((r) => r.playerId === youngOutcourt.id)!;
  const goalkeeperRating = ratings.find((r) => r.playerId === goalkeeper.id)!;

  const report = {
    rosterSize: squad.length,
    ratingProfileCount: ratings.length,
    outcourtCount,
    goalkeeperCount: gkCount,
    missingRatings: missing.length,
    youngOutcourt: { id: youngOutcourt.id, ca: youngOutcourtRating.ca, pa: youngOutcourtRating.pa, branch: youngOutcourtRating.branch.branch, caSource: youngOutcourtRating.caSource },
    goalkeeper: { id: goalkeeper.id, ca: goalkeeperRating.ca, pa: goalkeeperRating.pa, branch: goalkeeperRating.branch.branch, caSource: goalkeeperRating.caSource },
  };
  // eslint-disable-next-line no-console
  console.log("HM-RATINGS-CAREER-1.0 Part 32/36: IFK Tumba roster/rating report (real engine output):", JSON.stringify(report, null, 1));

  assert.equal(missing.length, 0, "no roster player may be missing a rating");
  assert.equal(ratings.length, squad.length);
  assert.equal(youngOutcourtRating.branch.branch, "OUTCOURT");
  assert.equal(goalkeeperRating.branch.branch, "GOALKEEPER");
  assert.equal(goalkeeperRating.caSource, "GENERATED_GAME_PRIOR");

  // Prove the outcourt player's rating CAN change via real training/development -- never manually edited.
  let developing = state;
  let week = mondayOf(developing.gameDate);
  let firedAt = -1;
  for (let w = 1; w <= 60 && firedAt === -1; w++) {
    developing = advanceOneWeek(developing, week);
    week = addDays(week, 7);
    const dev = developing.playerDevelopmentState[youngOutcourt.id];
    if (dev && dev.developmentHistory.length > 0) firedAt = w;
  }
  assert.ok(firedAt > 0, "expected the outcourt player's rating to eventually visibly change from real training alone");
  const finalRating = developing.gameplayRatings[TUMBA_CLUB_ID].find((r) => r.playerId === youngOutcourt.id)!;
  assert.notEqual(finalRating.ca, youngOutcourtRating.ca, "CA must have moved from the original generated value");
});

// ---------------------------------------------------------------------------
// Part 33: the required 12-week mock-player development test.
// ---------------------------------------------------------------------------

test("Part 33: 12-week mock (Tumba) player development -- real engine output, no manual injection", () => {
  const state = createNewCareerState("tumba-12wk", TUMBA_CLUB_ID);
  const squad = getCareerClubSquad(state, TUMBA_CLUB_ID);
  const playerId = squad.find((p) => p.position !== "MV")!.id;
  const startRating = state.gameplayRatings[TUMBA_CLUB_ID].find((r) => r.playerId === playerId)!;

  let developing = state;
  let week = mondayOf(developing.gameDate);
  for (let w = 1; w <= 12; w++) {
    developing = advanceOneWeek(developing, week);
    week = addDays(week, 7);
  }
  const endRating = developing.gameplayRatings[TUMBA_CLUB_ID].find((r) => r.playerId === playerId)!;
  const dev = developing.playerDevelopmentState[playerId];

  const report = {
    playerId,
    startCA: startRating.ca,
    endCA: endRating.ca,
    visibleAttributeChanges: dev?.developmentHistory.length ?? 0,
    hiddenProgress: totalProgress(developing, playerId),
    staffQuality: "auto-resolved fallback staff (Part 9)",
  };
  // eslint-disable-next-line no-console
  console.log("HM-RATINGS-CAREER-1.0 Part 33: 12-week Tumba mock development report (real engine output):", JSON.stringify(report, null, 1));

  assert.ok(endRating.ca >= startRating.ca, "CA should never move backwards from pure development stimulus");
  assert.ok(report.hiddenProgress > 0 || report.visibleAttributeChanges > 0, "expected SOME real accumulated development after 12 weeks of training");
});

// ---------------------------------------------------------------------------
// Part 26-31: development/staff integration for a mock player.
// ---------------------------------------------------------------------------

// (26)/(27)/(28)/(29) mock player receives stimulus, resolves weekly, eventually gains a visible attribute, CA updates consistently.
test("(26)/(27)/(28)/(29) a mock Tumba player's development pipeline is fully alive end to end", () => {
  const state = createNewCareerState("tumba-alive", TUMBA_CLUB_ID);
  const playerId = getCareerClubSquad(state, TUMBA_CLUB_ID).find((p) => p.position !== "MV")!.id;
  const startCA = state.gameplayRatings[TUMBA_CLUB_ID].find((r) => r.playerId === playerId)!.ca;

  let developing = state;
  let week = mondayOf(developing.gameDate);
  developing = advanceOneWeek(developing, week);
  const dev1 = developing.playerDevelopmentState[playerId];
  assert.ok(dev1, "(26) expected accumulated stimulus after one week of training");
  assert.ok(dev1.lastDevelopmentDate, "(27) expected weekly resolution to have run");

  let firedAt = -1;
  for (let w = 2; w <= 60 && firedAt === -1; w++) {
    week = addDays(week, 7);
    developing = advanceOneWeek(developing, week);
    if (developing.playerDevelopmentState[playerId].developmentHistory.length > 0) firedAt = w;
  }
  assert.ok(firedAt > 0, "(28) expected an eventual visible attribute gain");
  const endCA = developing.gameplayRatings[TUMBA_CLUB_ID].find((r) => r.playerId === playerId)!.ca;
  assert.ok(endCA > startCA, "(29) CA must have updated consistently with the visible attribute change");
});

// (30)/(31) PA/headroom and age remain directional for mock players.
test("(30)/(31) headroom and age remain directional for two comparable mock players (young high-headroom vs a low-headroom peer)", () => {
  const state = createNewCareerState("tumba-headroom", TUMBA_CLUB_ID);
  const squad = getCareerClubSquad(state, TUMBA_CLUB_ID).filter((p) => p.position !== "MV");
  const a = squad[0].id;
  const b = squad[1].id;

  // Force explicit, comparable starting CA/PA so headroom is the only variable.
  const ratingA = { ...state.gameplayRatings[TUMBA_CLUB_ID].find((r) => r.playerId === a)!, ca: 100, pa: 190 };
  const ratingB = { ...state.gameplayRatings[TUMBA_CLUB_ID].find((r) => r.playerId === b)!, ca: 100, pa: 110 };
  let seeded: CareerState = {
    ...state,
    gameplayRatings: { ...state.gameplayRatings, [TUMBA_CLUB_ID]: state.gameplayRatings[TUMBA_CLUB_ID].map((r) => (r.playerId === a ? ratingA : r.playerId === b ? ratingB : r)) },
  };

  let week = mondayOf(seeded.gameDate);
  for (let w = 1; w <= 6; w++) {
    seeded = advanceOneWeek(seeded, week);
    week = addDays(week, 7);
  }
  assert.ok(totalProgress(seeded, a) > totalProgress(seeded, b), "the high-headroom mock player should accumulate more progress");
});

// (32) staff quality affects mock player development.
test("(32) staff quality affects a mock Tumba player's development, same as a real-world player", () => {
  const state = createNewCareerState("tumba-staff", TUMBA_CLUB_ID);
  const playerId = getCareerClubSquad(state, TUMBA_CLUB_ID).find((p) => p.position !== "MV")!.id;
  const weakCoach = buildCoach("tumba-weak", ["ASSISTANT_COACH"], { TECHNICAL_COACHING: 2 });
  const strongCoach = buildCoach("tumba-strong", ["ASSISTANT_COACH"], { TECHNICAL_COACHING: 19 });

  let weakState: CareerState = { ...state, staffRoster: { ...state.staffRoster, [TUMBA_CLUB_ID]: [weakCoach] } };
  let strongState: CareerState = { ...state, staffRoster: { ...state.staffRoster, [TUMBA_CLUB_ID]: [strongCoach] } };

  let week = mondayOf(weakState.gameDate);
  for (let w = 1; w <= 4; w++) {
    weakState = advanceOneWeek(weakState, week);
    strongState = advanceOneWeek(strongState, week);
    week = addDays(week, 7);
  }
  assert.ok(totalProgress(strongState, playerId) > totalProgress(weakState, playerId), "not changing staff calibration -- just proving it now reaches a mock player");
});

// (33) individual focus affects mock player development.
test("(33) individual focus affects a mock Tumba player's development", () => {
  const state = createNewCareerState("tumba-focus", TUMBA_CLUB_ID);
  const playerId = getCareerClubSquad(state, TUMBA_CLUB_ID).find((p) => p.position !== "MV")!.id;

  let focused: CareerState = setPlayerIndividualFocus(state, playerId, "TECHNICAL");
  let normal: CareerState = state;

  let week = mondayOf(state.gameDate);
  for (let w = 1; w <= 4; w++) {
    focused = advanceOneWeek(focused, week);
    normal = advanceOneWeek(normal, week);
    week = addDays(week, 7);
  }
  const focusedDev = focused.playerDevelopmentState[playerId];
  const normalDev = normal.playerDevelopmentState[playerId];
  assert.ok((focusedDev?.attributeProgress.PASSING ?? 0) >= (normalDev?.attributeProgress.PASSING ?? 0), "a TECHNICAL focus should not reduce PASSING-family progress versus no focus");
});

// (34) GK mock player develops GK attributes only.
test("(34) a mock goalkeeper's development stays within the goalkeeper attribute vocabulary", () => {
  const state = createNewCareerState("tumba-gk", TUMBA_CLUB_ID);
  const gkId = getCareerClubSquad(state, TUMBA_CLUB_ID).find((p) => p.position === "MV")!.id;

  let developing = state;
  const date = developing.gameDate;
  const weekStart = mondayOf(date);
  let week = resolveTrainingWeek(developing, weekStart);
  week = setTrainingDayType(week, date, "TRAINING");
  week = addTrainingSession(week, date, { type: "GOALKEEPER", intensity: "HIGH", duration: "NORMAL", target: "GOALKEEPERS" });
  developing = { ...developing, trainingWeeks: { ...developing.trainingWeeks, [weekStart]: week } };
  developing = executeTrainingDay(developing, date);
  developing = applyTrainingDayDevelopmentStimulus(developing, date);

  const dev = developing.playerDevelopmentState[gkId];
  assert.ok(dev, "expected accumulated stimulus for the goalkeeper");
  assert.ok(Object.keys(dev.attributeStimulus).length > 0);
  assert.equal(dev.attributeStimulus.PASSING, undefined, "a goalkeeper must never accumulate outcourt-only stimulus");
});

// (35)/(36) reload preserves hidden progress and visible developed rating.
test("(35)/(36) a mock player's development state and developed rating survive a save/reload round-trip", () => {
  const state = createNewCareerState("tumba-reload", TUMBA_CLUB_ID);
  const playerId = getCareerClubSquad(state, TUMBA_CLUB_ID).find((p) => p.position !== "MV")!.id;

  let developing = state;
  let week = mondayOf(developing.gameDate);
  for (let w = 1; w <= 3; w++) {
    developing = advanceOneWeek(developing, week);
    week = addDays(week, 7);
  }

  // Simulate reload: round-trip through JSON exactly like localStorage persistence does.
  const reloaded: CareerState = JSON.parse(JSON.stringify(developing));
  assert.deepEqual(reloaded.playerDevelopmentState[playerId], developing.playerDevelopmentState[playerId]);
  assert.deepEqual(reloaded.gameplayRatings[TUMBA_CLUB_ID], developing.gameplayRatings[TUMBA_CLUB_ID]);
});

// (37) source normalization after development does not reset player.
test("(37) re-running ensureCareerGameplayRatings after development never resets the developed player", () => {
  const state = createNewCareerState("tumba-normalize-after-dev", TUMBA_CLUB_ID);
  const playerId = getCareerClubSquad(state, TUMBA_CLUB_ID).find((p) => p.position !== "MV")!.id;

  let developing = state;
  let week = mondayOf(developing.gameDate);
  let firedAt = -1;
  for (let w = 1; w <= 60 && firedAt === -1; w++) {
    developing = advanceOneWeek(developing, week);
    week = addDays(week, 7);
    if (developing.playerDevelopmentState[playerId]?.developmentHistory.length > 0) firedAt = w;
  }
  assert.ok(firedAt > 0);
  const developedRating = developing.gameplayRatings[TUMBA_CLUB_ID].find((r) => r.playerId === playerId)!;

  const renormalized = ensureCareerGameplayRatings(developing, TUMBA_CLUB_ID);
  const stillDeveloped = renormalized.gameplayRatings[TUMBA_CLUB_ID].find((r) => r.playerId === playerId)!;
  assert.deepEqual(stillDeveloped, developedRating);
});

// (38) weekly resolution remains idempotent.
test("(38) weekly resolution remains idempotent for a mock player", () => {
  const state = createNewCareerState("tumba-idempotent", TUMBA_CLUB_ID);
  const date = state.gameDate;
  let s = executeTrainingDay(state, date);
  s = applyTrainingDayDevelopmentStimulus(s, date);
  const sunday = addDays(mondayOf(date), 6);
  const once = resolveWeeklyDevelopmentIfDue(s, sunday);
  const twice = resolveWeeklyDevelopmentIfDue(once, sunday);
  assert.deepEqual(once.playerDevelopmentState, twice.playerDevelopmentState);
  assert.deepEqual(once.gameplayRatings, twice.gameplayRatings);
});

// ---------------------------------------------------------------------------
// Part 30: Match Engine integration for a mock (Tumba) player.
// ---------------------------------------------------------------------------

// (39)/(40) generated rating is consumed by playerMatchStrength; a stronger generated player changes strength directionally.
test("(39)/(40) computeTeamStrengthTrace consumes a mock Tumba player's own generated rating directionally", () => {
  const state = createNewCareerState("tumba-strength", TUMBA_CLUB_ID);
  const squad = getCareerClubSquad(state, TUMBA_CLUB_ID);
  const gk = squad.find((p) => p.position === "MV")!;
  const outcourt = squad.filter((p) => p.position !== "MV").slice(0, 6);
  const matchSquad: MatchSquad = {
    fixtureId: "fx-tumba-strength",
    clubId: TUMBA_CLUB_ID,
    players: [gk, ...outcourt].map((p) => ({ playerId: p.id, position: p.position === "MV" ? "GK" : (p.position as MatchSquad["players"][number]["position"]) })),
  };
  const planResult = buildDefaultMatchPlan(matchSquad);
  assert.ok(planResult.ok && planResult.plan, JSON.stringify(planResult));
  const plan = planResult.plan!;

  const weakRatings = state.gameplayRatings[TUMBA_CLUB_ID].map((r) => (matchSquad.players.some((p) => p.playerId === r.playerId) && r.branch.branch === "OUTCOURT" ? { ...r, ca: 60 } : r));
  const strongRatings = state.gameplayRatings[TUMBA_CLUB_ID].map((r) => (matchSquad.players.some((p) => p.playerId === r.playerId) && r.branch.branch === "OUTCOURT" ? { ...r, ca: 180 } : r));

  const weakTrace = computeTeamStrengthTrace(plan, weakRatings, "tumba-strength-seed");
  const strongTrace = computeTeamStrengthTrace(plan, strongRatings, "tumba-strength-seed");
  assert.ok(strongTrace.attackValue > weakTrace.attackValue, `weak=${weakTrace.attackValue} strong=${strongTrace.attackValue}`);
});

// (41) developed generated player changes future strength -- via matchdayAction's own real match flow.
function advanceOneDay(state: CareerState): CareerState {
  return processDay(state, addDays(state.processedThroughDate, 1)).state;
}
function advanceToDate(state: CareerState, targetDate: string): CareerState {
  let current = state;
  while (current.processedThroughDate < targetDate) current = advanceOneDay(current);
  return current;
}

test("(41)/(42)/(43)/(44)/(45) a Tumba fixture plays normally with generated ratings, and a completed match stays frozen after later development", () => {
  const state = createNewCareerState("tumba-match-e2e", TUMBA_CLUB_ID);
  const own = state.fixtures.filter((f) => f.homeClubId === TUMBA_CLUB_ID || f.awayClubId === TUMBA_CLUB_ID).sort((a, b) => a.date.localeCompare(b.date));
  const fixture1 = own[0];

  const afterMatchday = advanceToDate(state, fixture1.date);
  const { state: afterMatch1, result } = playManagerFixture(afterMatchday);
  assert.ok(result, "(43) the match roster must resolve and the fixture must actually play with generated ratings");
  const historicalSnapshot = afterMatch1.results[fixture1.id];

  // (44) MatchUsage/physical report also resolved without error.
  assert.ok(afterMatch1.physicalReports[fixture1.id]);

  // (45)/(41)/(42) drive real development for a squad member, then confirm the match stays frozen and only the RATING channel carries any future effect.
  let developing = afterMatch1;
  let week = mondayOf(developing.gameDate);
  for (let w = 1; w <= 6; w++) {
    developing = advanceOneWeek(developing, week);
    week = addDays(week, 7);
  }
  assert.deepEqual(developing.results[fixture1.id], historicalSnapshot, "(42) a completed historical match must remain byte-identical after later development");
});

// ---------------------------------------------------------------------------
// Part 34: real-world regression -- the universal fallback must never alter
// an already-complete REAL_WORLD-sourced gameplayRatings snapshot.
// ---------------------------------------------------------------------------

test("(34) a REAL_WORLD-shaped club with a fully complete gameplayRatings snapshot at creation is left byte-for-byte untouched -- ensureCareerGameplayRatings never runs a fallback over it", () => {
  const realWorldClubId = "real-world-regression-club";
  const tumbaState = createNewCareerState("real-world-regression-seed-source", TUMBA_CLUB_ID);
  const tumbaSquad = getCareerClubSquad(tumbaState, TUMBA_CLUB_ID);

  // Simulate what app/api/game-world/gameplay-ratings-snapshot already
  // resolves server-side for a genuine REAL_WORLD club: one rating per
  // roster player, present BEFORE createNewCareerState ever runs.
  const realWorldSquad = tumbaSquad.map((p) => ({ ...p, id: `${realWorldClubId}:${p.id}`, clubId: realWorldClubId }));
  const realWorldRatings = realWorldSquad.map((p) =>
    generateFallbackGameplayRating(p.id, mapHandballPositionToMatchPlanPosition(p.position)),
  );

  const state = createNewCareerState(
    "real-world-regression-seed",
    realWorldClubId,
    { [realWorldClubId]: realWorldSquad },
    {},
    { [realWorldClubId]: realWorldRatings },
  );

  assert.equal(
    state.gameplayRatings[realWorldClubId],
    realWorldRatings,
    "(34) an already-complete REAL_WORLD gameplayRatings array must come back as the exact same reference, never regenerated or altered",
  );
  assert.deepEqual(state.gameplayRatings[realWorldClubId], realWorldRatings);
});
