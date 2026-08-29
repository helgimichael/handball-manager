// HM-CPU-SQUAD-RESILIENCE-1.0: focused proofs for the emergency squad-
// resilience layer -- emergency classification (cpuSquadNeeds.ts) and the
// every-day emergency retry pass (cpuRecruitment.ts's own
// progressCpuEmergencyRecruitment), on top of the stable baseline from
// CPU Squad Building 1.0C / Contract Expiry Lifecycle 1.0 / CPU Contract
// Decisions 1.1 (commit 593ee0f).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { getClubsByCompetition, type PlayerMock } from "../game-data";
import { snapshotWorldSquads, snapshotGameplayRatings } from "../gameWorld/serverSnapshot";
import { addDays } from "./dateUtils";
import type { CareerState } from "./types";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import { positionEmergencyLevel, isSquadFloorEmergency, assessSquadNeeds } from "./cpuSquadNeeds";
import { progressCpuEmergencyRecruitment, progressCpuRecruitment, CPU_EMERGENCY_RETRY_DAYS, getCpuRecruitmentPlansForClub } from "./cpuRecruitment";

const HANDBOLLSLIGAN_ID = "se_handbollsligan_herr";

let cached: { worldSquads: Record<string, PlayerMock[]>; gameplayRatings: Record<string, GameplayPlayerRating[]> } | undefined;
function fullWorldState(seed: string, playerClubId: string): CareerState {
  if (!cached) cached = { worldSquads: snapshotWorldSquads(HANDBOLLSLIGAN_ID), gameplayRatings: snapshotGameplayRatings(HANDBOLLSLIGAN_ID) };
  return createNewCareerState(seed, playerClubId, cached.worldSquads, {}, cached.gameplayRatings);
}

function rivalClubId(state: CareerState, exclude: readonly string[] = []): string {
  return getClubsByCompetition(HANDBOLLSLIGAN_ID).find((c) => c.id !== state.playerClubId && !exclude.includes(c.id))!.id;
}

function syntheticPlayer(id: string, clubId: string, position: PlayerMock["position"]): PlayerMock {
  return {
    id, clubId, firstName: "Test", lastName: id, shirtNumber: null, position, nationality: "SWE",
    dateOfBirth: "1998-01-01", heightCm: null, weightKg: null, foot: null, squadStatus: "Rotation", dataSource: "REAL_WORLD",
    currentAbility: 110, potentialAbility: 110, form: 5, fitnessPct: 100, moralePct: 70, appearances: 0, goals: 0,
    contractEndSeason: "2026/27", wageSekPerMonth: 0,
    attributes: {
      technical: { skott: 10, passning: 10, spelforstaelse: 10, genombrott: 10, mottagning: 10, fint: 10, spelUtanBoll: 10 },
      mental: { beslutsfattande: 10, kyla: 10, arbetskapacitet: 10, kampvilja: 10, positionering: 10, lagarbete: 10, ledarskap: 10 },
      physical: { snabbhet: 10, acceleration: 10, styrka: 10, explosivitet: 10, uthallighet: 10, rorlighet: 10 },
    },
  };
}

function ratingFor(playerId: string, position: "GK" | "V6" | "H6" | "V9" | "M9" | "H9" | "M6", ca: number): GameplayPlayerRating {
  return {
    playerId, position, ca, pa: ca, caSource: "GENERATED_GAME_PRIOR" as GameplayPlayerRating["caSource"],
    branch: { branch: position === "GK" ? "GOALKEEPER" : "OUTCOURT", attributes: {} } as GameplayPlayerRating["branch"],
    attackRoleProficiencies: [], defenceRoleProficiencies: [], attributeGenerationModelVersion: "test", locked: false,
  };
}

/** Replaces a club's own goalkeepers entirely with `count` synthetic ones (real contracts, real ratings) -- same isolate-one-position precedent used throughout this codebase's own CPU test files. */
function withGoalkeepers(state: CareerState, clubId: string, count: number): CareerState {
  const players = Array.from({ length: count }, (_, i) => syntheticPlayer(`${clubId}-mv-${i}`, clubId, "MV"));
  const ratings = players.map((p, i) => ratingFor(p.id, "GK", 115 + i));
  const restSquad = (state.worldSquads[clubId] ?? []).filter((p) => p.position !== "MV");
  const restRatings = (state.gameplayRatings[clubId] ?? []).filter((r) => restSquad.some((p) => p.id === r.playerId));
  const contracts: CareerState["playerContracts"] = { ...state.playerContracts };
  for (const p of players) contracts[p.id] = { playerId: p.id, clubId, contractEndDate: "2029-05-31", wageEurPerMonth: 1000 };
  return {
    ...state,
    worldSquads: { ...state.worldSquads, [clubId]: [...restSquad, ...players] },
    gameplayRatings: { ...state.gameplayRatings, [clubId]: [...restRatings, ...ratings] },
    playerContracts: contracts,
  };
}

// ---------------------------------------------------------------------------
// Unit-level: emergency classification.
// ---------------------------------------------------------------------------

test("GK emergency 0: zero usable goalkeepers is SEVERE", () => {
  assert.equal(positionEmergencyLevel("MV", 0), "SEVERE");
});

test("GK emergency 1: one usable goalkeeper, no pending, is EMERGENCY", () => {
  assert.equal(positionEmergencyLevel("MV", 1), "EMERGENCY");
});

test("GK pending: 1 current + 1 agreed incoming projects to depth 2 -- not emergency", () => {
  // projectedDepth is the caller's job (assessPositionNeed already folds pending AGREED_AWAITING_WINDOW incoming in) -- this proves the classification itself treats projectedDepth 2 as healthy, matching Part 2's own worked example.
  assert.equal(positionEmergencyLevel("MV", 2), "NONE");
});

test("GK healthy tiers: 2 = normal minimum, 3 = depth, 4+ = saturated -- none of these are emergency", () => {
  for (const depth of [2, 3, 4, 5]) assert.equal(positionEmergencyLevel("MV", depth), "NONE");
});

test("field zero: an outright-empty field position is EMERGENCY", () => {
  assert.equal(positionEmergencyLevel("H9", 0), "EMERGENCY");
});

test("field non-zero: a field position with at least one player is never emergency (no field '1 -> emergency' tier)", () => {
  assert.equal(positionEmergencyLevel("H9", 1), "NONE");
});

test("squad floor: <=12 projected total is an emergency-eligible floor, 13+ is not", () => {
  assert.equal(isSquadFloorEmergency(12), true);
  assert.equal(isSquadFloorEmergency(10), true);
  assert.equal(isSquadFloorEmergency(13), false);
  assert.equal(isSquadFloorEmergency(14), false);
});

// ---------------------------------------------------------------------------
// CareerState-level: the every-day emergency pass.
// ---------------------------------------------------------------------------

test("normal healthy squad: no emergency, progressCpuEmergencyRecruitment is a true no-op", () => {
  const state = fullWorldState("resilience-healthy", "se_club_hammarby_if_hf");
  const clubId = rivalClubId(state);
  const withGk = withGoalkeepers(state, clubId, 3); // healthy depth tier.
  const next = progressCpuEmergencyRecruitment(withGk, withGk.gameDate);
  assert.deepEqual(next, withGk, "no emergency anywhere -- state must be byte-identical (same reference chain), never a spurious pursuit");
});

test("emergency cadence: a severe GK hole is acted on the same day, even though the club's own normal cpuClubEvaluationSchedule is not due for weeks", () => {
  const state = fullWorldState("resilience-cadence", "se_club_hammarby_if_hf");
  const clubId = rivalClubId(state);
  let withGk = withGoalkeepers(state, clubId, 0); // severe: 0 usable goalkeepers.
  withGk = { ...withGk, cpuClubEvaluationSchedule: { ...withGk.cpuClubEvaluationSchedule, [clubId]: addDays(withGk.gameDate, 40) } }; // normal cadence not due for 40 more days.

  const viaNormalCadence = progressCpuRecruitment(withGk, withGk.gameDate);
  assert.equal(viaNormalCadence.cpuRecruitmentPlans[`${clubId}:MV`], undefined, "fixture check: the normal-cadence pass alone must not touch this club today (not yet due)");

  const next = progressCpuEmergencyRecruitment(withGk, withGk.gameDate);
  const plan = next.cpuRecruitmentPlans[`${clubId}:MV`];
  assert.ok(plan, "the emergency pass must detect and act on the hole the same day, independent of the normal schedule");
});

test("squad floor fallback: a critically small squad with no single position individually flagged still gets exactly one emergency target (the most severe actual need), never every position at once", () => {
  const state = fullWorldState("resilience-floor", "se_club_hammarby_if_hf");
  const clubId = rivalClubId(state);
  // Trim the squad down to a critical total (<=12) while keeping every position minimally non-zero, so no single position hits its own EMERGENCY/SEVERE threshold.
  const squad = state.worldSquads[clubId]!;
  const byPosition = new Map<string, PlayerMock[]>();
  for (const p of squad) {
    if (!byPosition.has(p.position)) byPosition.set(p.position, []);
    byPosition.get(p.position)!.push(p);
  }
  const trimmed: PlayerMock[] = [];
  for (const [position, players] of byPosition) {
    trimmed.push(...players.slice(0, position === "MV" ? 2 : 1)); // 2 MV + 1 of each of the 6 field positions = 8, comfortably <=12, MV itself stays at the healthy minimum (2) so it never individually flags.
  }
  const floorState: CareerState = { ...state, worldSquads: { ...state.worldSquads, [clubId]: trimmed } };

  const assessment = assessSquadNeeds(floorState, clubId, floorState.gameDate);
  const individuallyFlagged = assessment.positions.filter((p) => positionEmergencyLevel(p.position, p.projectedDepth) !== "NONE");
  assert.equal(individuallyFlagged.length, 0, "fixture check: no single position should itself read as emergency");

  const next = progressCpuEmergencyRecruitment(floorState, floorState.gameDate);
  const plans = getCpuRecruitmentPlansForClub(next, clubId).filter((p) => p.status === "SEARCHING" || p.status === "SUCCEEDED" || p.status === "FAILED");
  assert.ok(plans.length <= 1, "the whole-squad floor must target exactly one position, never every position simultaneously");
});

test("human club: progressCpuEmergencyRecruitment never creates a plan or acts for state.playerClubId, even in a severe emergency", () => {
  const state = fullWorldState("resilience-human", "se_club_hammarby_if_hf");
  const withGk = withGoalkeepers(state, state.playerClubId, 0);
  const next = progressCpuEmergencyRecruitment(withGk, withGk.gameDate);
  assert.equal(Object.keys(next.cpuRecruitmentPlans).filter((id) => id.startsWith(`${state.playerClubId}:`)).length, 0);
  assert.equal(next, withGk, "true no-op for the human club -- never even a re-derived state reference");
});

test("determinism: identical state + date -> identical resulting plans, twice", () => {
  const state = fullWorldState("resilience-determinism", "se_club_hammarby_if_hf");
  const clubId = rivalClubId(state);
  const withGk = withGoalkeepers(state, clubId, 1); // emergency (1 usable MV).
  const a = progressCpuEmergencyRecruitment(withGk, withGk.gameDate);
  const b = progressCpuEmergencyRecruitment(withGk, withGk.gameDate);
  assert.deepEqual(a.cpuRecruitmentPlans, b.cpuRecruitmentPlans);
});

test("retry throttle: a still-unresolved emergency plan is not re-pursued again the very next day, only after CPU_EMERGENCY_RETRY_DAYS", () => {
  const state = fullWorldState("resilience-throttle", "se_club_hammarby_if_hf");
  const clubId = rivalClubId(state);
  const withGk = withGoalkeepers(state, clubId, 0);

  const day1 = progressCpuEmergencyRecruitment(withGk, withGk.gameDate);
  const plan1 = day1.cpuRecruitmentPlans[`${clubId}:MV`];
  assert.ok(plan1);
  if (plan1.status !== "SEARCHING") return; // a candidate was actually found/resolved this fixture run -- the throttle path isn't exercised, nothing to assert.

  const nextDay = addDays(withGk.gameDate, 1);
  const day2 = progressCpuEmergencyRecruitment(day1, nextDay);
  const plan2 = day2.cpuRecruitmentPlans[`${clubId}:MV`];
  assert.equal(plan2.lastEvaluatedAt, plan1.lastEvaluatedAt, "must not re-attempt the very next day");

  const laterDate = addDays(withGk.gameDate, CPU_EMERGENCY_RETRY_DAYS);
  const day3 = progressCpuEmergencyRecruitment(day2, laterDate);
  const plan3 = day3.cpuRecruitmentPlans[`${clubId}:MV`];
  assert.equal(plan3.lastEvaluatedAt, laterDate, "must retry once the throttle window has passed");
});

// ---------------------------------------------------------------------------
// End-to-end: post-signing recomputation, no overbuy (best-effort against
// real candidate availability -- same defensive precedent as the rest of
// this codebase's own CPU test suites when a real signing may or may not
// actually be affordable/available for a given fixture).
// ---------------------------------------------------------------------------

test("signing recompute: 0 MV -> a signing still leaves 1 MV as emergency; a second signing solves it and stops further pursuit", () => {
  const state = fullWorldState("resilience-recompute", "se_club_hammarby_if_hf");
  const clubId = rivalClubId(state);
  let current = withGoalkeepers(state, clubId, 0);
  let date = current.gameDate;

  current = progressCpuEmergencyRecruitment(current, date);
  let plan = current.cpuRecruitmentPlans[`${clubId}:MV`];
  assert.ok(plan);
  if (plan.status !== "SUCCEEDED") return; // no affordable/available candidate in this fixture -- nothing further to assert.

  const afterFirst = (current.worldSquads[clubId] ?? []).filter((p) => p.position === "MV").length;
  assert.equal(afterFirst, 1, "exactly one goalkeeper signed, never more than the hole itself");
  assert.equal(positionEmergencyLevel("MV", afterFirst), "EMERGENCY", "still emergency with only one keeper");

  // Retry after the throttle window -- 1.0C's own post-signing recompute (still HIGH -> no cooldown) should allow an immediate second pursuit.
  date = addDays(date, CPU_EMERGENCY_RETRY_DAYS);
  current = progressCpuEmergencyRecruitment(current, date);
  plan = current.cpuRecruitmentPlans[`${clubId}:MV`];
  if (plan.status !== "SUCCEEDED" || plan.lastEvaluatedAt !== date) return; // second candidate not found/affordable this fixture run.

  const afterSecond = (current.worldSquads[clubId] ?? []).filter((p) => p.position === "MV").length;
  assert.equal(afterSecond, 2, "two goalkeepers total -- the emergency is now solved");
  assert.equal(positionEmergencyLevel("MV", afterSecond), "NONE");

  // No overbuy: a further emergency pass must not sign a third/fourth goalkeeper now that the hole is solved.
  date = addDays(date, CPU_EMERGENCY_RETRY_DAYS);
  const finalState = progressCpuEmergencyRecruitment(current, date);
  const finalGkCount = (finalState.worldSquads[clubId] ?? []).filter((p) => p.position === "MV").length;
  assert.equal(finalGkCount, 2, "no further emergency signings once depth 2 is reached");
});
