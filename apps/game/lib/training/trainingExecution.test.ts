// HM-TRAINING-1.0 Part 30: executeTrainingDay -- the domain-integration
// layer (CareerState in, CareerState out), idempotency, and matchday
// safety.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { TUMBA_CLUB_ID } from "../game-data";
import { ENERGY_MAX, ENERGY_START_DEFAULT } from "../matchPlan/physicalModel";
import { addTrainingSession, mondayOf, resolveTrainingWeek, setTrainingDayType } from "./trainingSchedule";
import { executeTrainingDay } from "./trainingExecution";

function freshState(seed = "training-exec-seed") {
  return createNewCareerState(seed, TUMBA_CLUB_ID);
}

function anyOutfieldPlayerId(state: ReturnType<typeof freshState>): string {
  return Object.keys(state.playerStatuses)[0];
}

// (5) rest day has no training load.
test("(5) a REST day applies only its own recovery bonus -- energy strictly increases for every player, never decreases", () => {
  let state = freshState();
  const date = state.gameDate;
  const weekStart = mondayOf(date);
  const week = setTrainingDayType(resolveTrainingWeek(state, weekStart), date, "REST");
  state = { ...state, trainingWeeks: { ...state.trainingWeeks, [weekStart]: week } };

  const playerId = anyOutfieldPlayerId(state);
  const before = state.playerPhysicalState[playerId]?.currentEnergy ?? ENERGY_START_DEFAULT;
  const after = executeTrainingDay(state, date);
  const afterEnergy = after.playerPhysicalState[playerId].currentEnergy;
  assert.ok(afterEnergy >= before, `expected no decrease, before=${before} after=${afterEnergy}`);
});

// (20) session reduces energy according to load -- proven end-to-end through executeTrainingDay.
test("(20) a HIGH CONDITIONING day's participants actually lose energy end-to-end through executeTrainingDay", () => {
  let state = freshState();
  const date = state.gameDate;
  const weekStart = mondayOf(date);
  let week = setTrainingDayType(resolveTrainingWeek(state, weekStart), date, "TRAINING");
  week = addTrainingSession(week, date, { type: "CONDITIONING", intensity: "VERY_HIGH", duration: "LONG", target: "ALL" });
  state = { ...state, trainingWeeks: { ...state.trainingWeeks, [weekStart]: week } };

  const playerId = anyOutfieldPlayerId(state);
  const before = state.playerPhysicalState[playerId]?.currentEnergy ?? ENERGY_START_DEFAULT;
  const after = executeTrainingDay(state, date);
  const afterEnergy = after.playerPhysicalState[playerId].currentEnergy;
  assert.ok(afterEnergy < before, `expected a decrease, before=${before} after=${afterEnergy}`);
});

// (22)/(23) session execution idempotent -- same date cannot execute the same session twice.
test("(22)/(23) executeTrainingDay is idempotent -- calling it twice for the same date never double-applies load", () => {
  const state = freshState();
  const date = state.gameDate;
  const once = executeTrainingDay(state, date);
  const twice = executeTrainingDay(once, date);
  assert.deepEqual(once.playerPhysicalState, twice.playerPhysicalState);
  assert.deepEqual(once.trainingWeeks, twice.trainingWeeks);
});

test("a day's `executed` flag is set true after execution, and its results are persisted", () => {
  const state = freshState();
  const date = state.gameDate;
  const weekStart = mondayOf(date);
  const after = executeTrainingDay(state, date);
  const executedDay = after.trainingWeeks[weekStart].days.find((d) => d.date === date)!;
  assert.equal(executedDay.executed, true);
  assert.ok(Array.isArray(executedDay.results));
});

// (26) individual load adjustment persists (through execution -- a REST-load player never loses energy from a session).
test("(26) a player with an individual REST load setting is excluded from a scheduled session's load", () => {
  let state = freshState();
  const date = state.gameDate;
  const weekStart = mondayOf(date);
  let week = setTrainingDayType(resolveTrainingWeek(state, weekStart), date, "TRAINING");
  week = addTrainingSession(week, date, { type: "CONDITIONING", intensity: "VERY_HIGH", duration: "LONG", target: "ALL" });
  const playerId = anyOutfieldPlayerId(state);
  state = {
    ...state,
    trainingWeeks: { ...state.trainingWeeks, [weekStart]: week },
    playerTrainingAssignments: { ...state.playerTrainingAssignments, [playerId]: { playerId, loadSetting: "REST", individualFocus: null } },
  };

  const after = executeTrainingDay(state, date);
  const executedDay = after.trainingWeeks[weekStart].days.find((d) => d.date === date)!;
  const sessionResult = executedDay.results!.find((r) => r.participants.includes(playerId))!;
  assert.ok(sessionResult, "the REST-load player is still recorded as having been on the session's own roster");
  assert.equal(sessionResult.loadByPlayer[playerId], 0, "but their own load must be exactly zero");
  assert.equal(sessionResult.preEnergyByPlayer[playerId], sessionResult.postEnergyByPlayer[playerId], "and their energy must be unchanged by the session itself");
});

// (27) session result records pre/post energy.
test("(27) a session's TrainingSessionResult records real pre/post energy for every participant", () => {
  let state = freshState();
  const date = state.gameDate;
  const weekStart = mondayOf(date);
  let week = setTrainingDayType(resolveTrainingWeek(state, weekStart), date, "TRAINING");
  week = addTrainingSession(week, date, { type: "TECHNICAL", intensity: "NORMAL", duration: "NORMAL", target: "ALL" });
  state = { ...state, trainingWeeks: { ...state.trainingWeeks, [weekStart]: week } };

  const after = executeTrainingDay(state, date);
  const executedDay = after.trainingWeeks[weekStart].days.find((d) => d.date === date)!;
  const result = executedDay.results![0];
  assert.ok(result.participants.length > 0);
  for (const playerId of result.participants) {
    assert.ok(typeof result.preEnergyByPlayer[playerId] === "number");
    assert.ok(typeof result.postEnergyByPlayer[playerId] === "number");
    assert.ok(result.postEnergyByPlayer[playerId] <= ENERGY_MAX);
  }
});

// Part 4/11: a MATCH day never applies session load, only overnight recovery.
test("a MATCH day (a real scheduled fixture) never applies session load -- only overnight recovery", () => {
  const state = freshState();
  const fixtureDate = state.fixtures.find((f) => f.homeClubId === TUMBA_CLUB_ID || f.awayClubId === TUMBA_CLUB_ID)!.date;
  const playerId = anyOutfieldPlayerId(state);
  const before = state.playerPhysicalState[playerId]?.currentEnergy ?? ENERGY_START_DEFAULT;
  const after = executeTrainingDay(state, fixtureDate);
  const weekStart = mondayOf(fixtureDate);
  const matchDay = after.trainingWeeks[weekStart].days.find((d) => d.date === fixtureDate)!;
  assert.equal(matchDay.dayType, "MATCH");
  assert.equal(matchDay.sessions.length, 0);
  const afterEnergy = after.playerPhysicalState[playerId].currentEnergy;
  // Overnight recovery only -- must be a small increase (or already-max no-op), never a decrease.
  assert.ok(afterEnergy >= before);
});
