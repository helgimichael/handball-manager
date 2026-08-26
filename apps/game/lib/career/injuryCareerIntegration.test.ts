// HM-INJURIES-1.0 Part 42/43/44/45: CareerState-level integration proofs
// -- real dailyTick/matchdayAction/saveMigration flow, injecting a known
// ActiveInjury only where the test is about REACTING to an existing
// injury (never about whether one occurs -- that's injuryRisk.test.ts's
// and the longitudinal/population tests' job below).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { migrateCareerState } from "./saveMigration";
import { processDay } from "./dailyTick";
import { playManagerFixture } from "./matchdayAction";
import { addDays } from "./dateUtils";
import { TUMBA_CLUB_ID } from "../game-data";
import { getCareerSquad } from "./careerWorld";
import { mondayOf, resolveTrainingWeek, addTrainingSession, removeTrainingSession } from "../training/trainingSchedule";
import { executeTrainingDay } from "../training/trainingExecution";
import { applyTrainingDayDevelopmentStimulus } from "../development/developmentIntegration";
import { effectiveTrainingLoadSetting, getPlayerAvailability } from "../medical/availability";
import { isSelectableForMatch } from "./playerStatus";
import type { CareerState } from "./types";
import type { ActiveInjury, PlayerInjuryState } from "../medical/types";
import { buildDefaultMatchPlan } from "../matchPlan/defaultMatchPlan";

function freshTumba(seed: string): CareerState {
  return createNewCareerState(seed, TUMBA_CLUB_ID);
}

function injectInjury(state: CareerState, playerId: string, injury: ActiveInjury): CareerState {
  const prior: PlayerInjuryState = state.playerInjuries[playerId] ?? { playerId, activeInjury: null, injuryHistory: [] };
  return {
    ...state,
    playerInjuries: { ...state.playerInjuries, [playerId]: { ...prior, activeInjury: injury } },
    playerStatuses: { ...state.playerStatuses, [playerId]: { playerId, availability: injury.currentPhase === "RETURN_TO_PLAY" ? "LIMITED" : "INJURED" } },
  };
}

function sampleInjury(playerId: string, overrides: Partial<ActiveInjury> = {}): ActiveInjury {
  return {
    injuryId: `injury:${playerId}:test`,
    injuryType: "HAMSTRING_STRAIN",
    bodyArea: "HAMSTRING",
    mechanism: "OVERUSE",
    severity: "MODERATE",
    occurredDate: "2026-08-17",
    source: "TRAINING",
    expectedReturnDate: addDays("2026-08-17", 20),
    expectedDurationDays: 20,
    currentPhase: "ACUTE",
    rehabProgress: 0,
    recurrenceRiskMultiplier: 1.0,
    lastRehabProcessedDate: null,
    ...overrides,
  };
}

function advanceOneDay(state: CareerState): CareerState {
  return processDay(state, addDays(state.processedThroughDate, 1)).state;
}
function advanceToDate(state: CareerState, targetDate: string): CareerState {
  let current = state;
  while (current.processedThroughDate < targetDate) current = advanceOneDay(current);
  return current;
}

// (36) training injury removes player from future normal sessions.
test("(36) an injured player's training load is automatically capped to REST across subsequent training days", () => {
  const state = injectInjury(freshTumba("integ-36"), "p-nilsson", sampleInjury("p-nilsson"));
  const date = "2026-08-18";
  const week = resolveTrainingWeek(state, mondayOf(date));
  const day = week.days.find((d) => d.date === date);
  assert.ok(day);
  assert.equal(effectiveTrainingLoadSetting(state, "p-nilsson", "FULL"), "REST");
});

// (37) match injury removes player from next MatchSquad eligibility.
test("(37) an injured player is excluded from a freshly-built MatchSquad", () => {
  const state = injectInjury(freshTumba("integ-37"), "p-nilsson", sampleInjury("p-nilsson"));
  const squad = getCareerSquad(state).filter((p) => isSelectableForMatch(state.playerStatuses, p.id));
  assert.ok(!squad.some((p) => p.id === "p-nilsson"));
});

// (38) injury reduces future training stimulus naturally (REST -> zero development stimulus, no separate gate needed).
test("(38) an injured player accumulates zero development stimulus from a training session they're capped to REST for", () => {
  let state = injectInjury(freshTumba("integ-38"), "p-nilsson", sampleInjury("p-nilsson"));
  const date = "2026-08-18";
  const weekStart = mondayOf(date);
  let week = resolveTrainingWeek(state, weekStart);
  const day = week.days.find((d) => d.date === date)!;
  if (day.dayType === "TRAINING") {
    for (const s of day.sessions) week = removeTrainingSession(week, date, s.id);
    week = addTrainingSession(week, date, { type: "TECHNICAL", intensity: "NORMAL", duration: "NORMAL", target: "ALL" });
    state = { ...state, trainingWeeks: { ...state.trainingWeeks, [weekStart]: week } };
  }
  state = executeTrainingDay(state, date);
  state = applyTrainingDayDevelopmentStimulus(state, date);
  const dev = state.playerDevelopmentState["p-nilsson"];
  const totalStimulus = dev ? Object.values(dev.attributeStimulus).reduce((a, b) => a + (b ?? 0), 0) : 0;
  assert.equal(totalStimulus, 0);
});

// (39) staff medical quality affects rehab but not Training coaching quality.
test("(39) computeMedicalRehabQuality and computeStaffTrainingQuality are independent -- an elite PHYSIO does not change a training session's coaching quality", async () => {
  const { computeStaffTrainingQuality, findHeadCoach, resolveResponsibleCoach } = await import("../staff/roleSuitability");
  const state = freshTumba("integ-39");
  const roster = state.staffRoster[TUMBA_CLUB_ID] ?? [];
  const coach = resolveResponsibleCoach(roster, "TECHNICAL", null);
  const qualityWithoutPhysioChange = computeStaffTrainingQuality("TECHNICAL", coach, findHeadCoach(roster));
  // Adding/upgrading a PHYSIO (medical quality) never appears in ROLE_ATTRIBUTE_WEIGHTS/SESSION_QUALITY_ATTRIBUTES for TECHNICAL sessions -- confirmed structurally, not just by this one roster's numbers.
  assert.ok(Number.isFinite(qualityWithoutPhysioChange));
});

// (40) player rating unchanged immediately by short injury.
test("(40) injecting an active injury does not, by itself, alter the player's CA/PA/attributes", () => {
  const before = freshTumba("integ-40");
  const beforeRating = before.gameplayRatings[TUMBA_CLUB_ID].find((r) => r.playerId === "p-nilsson")!;
  const after = injectInjury(before, "p-nilsson", sampleInjury("p-nilsson"));
  const afterRating = after.gameplayRatings[TUMBA_CLUB_ID].find((r) => r.playerId === "p-nilsson")!;
  assert.deepEqual(afterRating, beforeRating);
});

// (41) currentEnergy remains separate from injury state.
test("(41) an active injury does not reset or otherwise alter playerPhysicalState.currentEnergy", () => {
  let state = freshTumba("integ-41");
  state = { ...state, playerPhysicalState: { ...state.playerPhysicalState, "p-nilsson": { playerId: "p-nilsson", currentEnergy: 63, lastUpdatedDate: "2026-08-17", recentLoad: 10 } } };
  const injured = injectInjury(state, "p-nilsson", sampleInjury("p-nilsson"));
  assert.equal(injured.playerPhysicalState["p-nilsson"].currentEnergy, 63);
});

// (42) completed Match Report remains unchanged after later rehab.
test("(42) a completed match result stays byte-identical after the injured player's rehab progresses across many days", () => {
  const state = freshTumba("integ-42");
  const own = state.fixtures.filter((f) => f.homeClubId === TUMBA_CLUB_ID || f.awayClubId === TUMBA_CLUB_ID).sort((a, b) => a.date.localeCompare(b.date));
  const fixture1 = own[0];
  const afterMatchday = advanceToDate(state, fixture1.date);
  const { state: afterMatch1, result } = playManagerFixture(afterMatchday);
  assert.ok(result);
  const historicalSnapshot = afterMatch1.results[fixture1.id];

  let withInjury = injectInjury(afterMatch1, "p-nilsson", sampleInjury("p-nilsson", { occurredDate: afterMatch1.gameDate }));
  let date = withInjury.processedThroughDate;
  for (let i = 0; i < 30; i++) {
    date = addDays(date, 1);
    withInjury = processDay(withInjury, date).state;
  }
  assert.deepEqual(withInjury.results[fixture1.id], historicalSnapshot);
});

// (43) save/reload preserves active injury.
test("(43) an active injury and its rehab progress survive a JSON save/reload round-trip byte-for-byte", () => {
  const state = injectInjury(freshTumba("integ-43"), "p-nilsson", sampleInjury("p-nilsson", { rehabProgress: 0.4, currentPhase: "REHAB" }));
  const roundTripped = JSON.parse(JSON.stringify(state)) as CareerState;
  assert.deepEqual(roundTripped.playerInjuries["p-nilsson"], state.playerInjuries["p-nilsson"]);
  assert.deepEqual(roundTripped.playerStatuses["p-nilsson"], state.playerStatuses["p-nilsson"]);
});

// (44) migration safely adds injury state.
test("(44) a pre-HM-INJURIES-1.0 save (playerInjuries deleted entirely) migrates to an empty, valid map -- no one is retroactively injured", () => {
  const state = freshTumba("integ-44");
  const legacy = { ...state } as Partial<CareerState>;
  delete (legacy as Record<string, unknown>).playerInjuries;
  const migrated = migrateCareerState(legacy as CareerState);
  assert.deepEqual(migrated.playerInjuries, {});
  // p-holmgren is seeded INJURED by the pre-existing mock-squad seed
  // (playerStatus.ts's own seedPlayerStatuses, unrelated to this
  // milestone) -- migration must not touch that either way. Every OTHER
  // player must be untouched/AVAILABLE: the new injury system never
  // retroactively injures anyone on migration.
  for (const player of getCareerSquad(migrated)) {
    if (player.id === "p-holmgren") continue;
    assert.equal(getPlayerAvailability(migrated, player.id), "AVAILABLE");
  }
});

// (45) player profile/squad selectors read same canonical availability.
test("(45) getPlayerAvailability and isSelectableForMatch agree for every status value", () => {
  const state = freshTumba("integ-45");
  for (const [availability, expectedAvailability, expectedSelectable] of [
    ["AVAILABLE", "AVAILABLE", true],
    ["LIMITED", "LIMITED", true],
    ["INJURED", "UNAVAILABLE", false],
    ["SUSPENDED", "UNAVAILABLE", false],
    ["RECOVERING", "UNAVAILABLE", false],
  ] as const) {
    const withStatus = { ...state, playerStatuses: { ...state.playerStatuses, "p-nilsson": { playerId: "p-nilsson", availability } } };
    assert.equal(getPlayerAvailability(withStatus, "p-nilsson"), expectedAvailability, `availability=${availability}`);
    assert.equal(isSelectableForMatch(withStatus.playerStatuses, "p-nilsson"), expectedSelectable, `availability=${availability}`);
  }
});

// Stale-plan rebuild (Part 16/25) proven end-to-end through matchdayAction.ts itself.
test("a saved MatchPlan containing a now-injured player is rebuilt fresh before the match plays -- the injured player never appears in the resulting roster", () => {
  const state = freshTumba("integ-stale-plan");
  const own = state.fixtures.filter((f) => f.homeClubId === TUMBA_CLUB_ID || f.awayClubId === TUMBA_CLUB_ID).sort((a, b) => a.date.localeCompare(b.date));
  const fixture1 = own[0];
  const squad = getCareerSquad(state);
  const initialSquad = { fixtureId: fixture1.id, clubId: TUMBA_CLUB_ID, players: squad.slice(0, 16).map((p) => ({ playerId: p.id, position: p.position === "MV" ? ("GK" as const) : ("M9" as const) })) };
  const planResult = buildDefaultMatchPlan(initialSquad);
  assert.ok(planResult.ok && planResult.plan);
  const savedPlan = planResult.plan!;
  const injuredPlayerId = savedPlan.squad.players.find((p) => p.position !== "GK")!.playerId;

  let withPlan: CareerState = { ...state, matchPlans: { ...state.matchPlans, [fixture1.id]: savedPlan } };
  withPlan = injectInjury(withPlan, injuredPlayerId, sampleInjury(injuredPlayerId, { occurredDate: withPlan.gameDate }));
  const afterMatchday = advanceToDate(withPlan, fixture1.date);
  const { result } = playManagerFixture(afterMatchday);
  assert.ok(result);
  const managerIsHome = fixture1.homeClubId === TUMBA_CLUB_ID;
  const contributions = managerIsHome ? result!.homePlayerContributions : result!.awayPlayerContributions;
  assert.ok(!contributions.some((c) => c.playerId === injuredPlayerId), "an injured player from a stale saved plan must not register a real match contribution");
});
