// HM-PHYSICAL-1.0 Part 24: domain tests for the deterministic Energy/
// Fatigue/Performance model.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeAveragePhaseFatigueModifier,
  computeEnergyTrajectory,
  computeStaminaFactor,
  effectiveAttributeValue,
  ENERGY_MAX,
  ENERGY_MIN,
  ENERGY_START_DEFAULT,
  energyAtMinute,
  fatiguePerformanceModifier,
  PHYSICAL_MODEL_TUNING,
  type WindowActivity,
} from "./physicalModel";

const ALL_FALSE = new Array(PHYSICAL_MODEL_TUNING.windowCount).fill(false) as readonly boolean[];

function activity(overrides: Partial<WindowActivity>): WindowActivity {
  return { attackActive: ALL_FALSE, defenceActive: ALL_FALSE, goalkeeperActive: ALL_FALSE, ...overrides };
}

const NEUTRAL_STAMINA = 10.5;
const HIGH_STAMINA = 20;
const LOW_STAMINA = 1;

// (1) player starts near/full 100 energy.
test("HM-PHYSICAL-1.0 (1): a player with no match usage starts at the default 100 energy", () => {
  const t = computeEnergyTrajectory("p1", false, activity({}), NEUTRAL_STAMINA);
  assert.equal(t.startingEnergy, ENERGY_START_DEFAULT);
  assert.equal(t.checkpoints[0], 100);
});

// (2) on-court player loses energy.
test("HM-PHYSICAL-1.0 (2): a player active every window loses energy over the match", () => {
  const t = computeEnergyTrajectory("p1", false, activity({ attackActive: ALL_FALSE.map(() => true) }), NEUTRAL_STAMINA);
  assert.ok(t.finishingEnergy < t.startingEnergy);
});

// (3) bench player does not receive normal on-court load.
test("HM-PHYSICAL-1.0 (3): a player never active (bench the whole match) never loses energy from load", () => {
  const t = computeEnergyTrajectory("p1", false, activity({}), NEUTRAL_STAMINA);
  // every window is a bench/recovery window -- energy should only ever rise or stay capped at 100, never drop.
  for (let i = 1; i < t.checkpoints.length; i++) {
    assert.ok(t.checkpoints[i] >= t.checkpoints[i - 1] || t.checkpoints[i - 1] === ENERGY_MAX);
  }
});

// (4) bench player can recover slightly.
test("HM-PHYSICAL-1.0 (4): a player who plays then benches recovers some energy while benched", () => {
  const partial: WindowActivity = { attackActive: [true, true, false, false, false, false], defenceActive: ALL_FALSE, goalkeeperActive: ALL_FALSE };
  const t = computeEnergyTrajectory("p1", false, partial, NEUTRAL_STAMINA, 100);
  const energyAfterPlaying = t.checkpoints[2];
  const energyAfterOneRestWindow = t.checkpoints[3];
  assert.ok(energyAfterOneRestWindow > energyAfterPlaying);
});

// (5) halftime gives limited recovery.
test("HM-PHYSICAL-1.0 (5): halftime (window index 2->3, minute 30) gives a recovery bump, not a full reset", () => {
  const fullMatch: WindowActivity = { attackActive: ALL_FALSE.map(() => true), defenceActive: ALL_FALSE, goalkeeperActive: ALL_FALSE };
  const t = computeEnergyTrajectory("p1", false, fullMatch, NEUTRAL_STAMINA, 100);
  const beforeHalftime = t.checkpoints[2] - PHYSICAL_MODEL_TUNING.baseLoadPerWindow.ATTACK; // what window-3 loss alone would have produced without the bump
  const atHalftime = t.checkpoints[3];
  assert.ok(atHalftime > beforeHalftime, "halftime must add a real recovery bump on top of the window's own loss");
  assert.ok(atHalftime < ENERGY_MAX, "halftime must never be a full reset to 100");
});

// (6) high-stamina player retains more energy than low-stamina player under equal load.
test("HM-PHYSICAL-1.0 (6): under identical usage, a high-stamina player finishes with more energy than a low-stamina player", () => {
  const fullMatch: WindowActivity = { attackActive: ALL_FALSE.map(() => true), defenceActive: ALL_FALSE.map(() => true), goalkeeperActive: ALL_FALSE };
  const high = computeEnergyTrajectory("high", false, fullMatch, HIGH_STAMINA);
  const low = computeEnergyTrajectory("low", false, fullMatch, LOW_STAMINA);
  assert.ok(high.finishingEnergy > low.finishingEnergy);
  // "noticeable but not absurd" (Part 8) -- the gap should be real but bounded, not a 0 vs 100 swing.
  const gap = high.finishingEnergy - low.finishingEnergy;
  assert.ok(gap > 1 && gap < 40, `stamina gap was ${gap}, expected a noticeable-but-not-absurd difference`);
});

test("HM-PHYSICAL-1.0: computeStaminaFactor is monotonically decreasing (higher stamina -> lower load factor) and bounded", () => {
  const factors = [1, 5, 10.5, 15, 20].map((s) => computeStaminaFactor(s));
  for (let i = 1; i < factors.length; i++) assert.ok(factors[i] <= factors[i - 1]);
  for (const f of factors) {
    assert.ok(f >= PHYSICAL_MODEL_TUNING.staminaFactorMin && f <= PHYSICAL_MODEL_TUNING.staminaFactorMax);
  }
});

// (7) goalkeeper load differs from outcourt load.
test("HM-PHYSICAL-1.0 (7): a goalkeeper active every window loses noticeably less energy than an outfield two-way player under the equivalent full-match usage", () => {
  const fullMatch: WindowActivity = { attackActive: ALL_FALSE.map(() => true), defenceActive: ALL_FALSE.map(() => true), goalkeeperActive: ALL_FALSE.map(() => true) };
  const gk = computeEnergyTrajectory("gk", true, fullMatch, NEUTRAL_STAMINA);
  const outfield = computeEnergyTrajectory("out", false, fullMatch, NEUTRAL_STAMINA);
  assert.ok(gk.finishingEnergy > outfield.finishingEnergy);
});

// (8) attack-only player receives only attack exposure.
test("HM-PHYSICAL-1.0 (8): an attack-only player's defenceWindowsActive is 0", () => {
  const t = computeEnergyTrajectory("p1", false, activity({ attackActive: ALL_FALSE.map(() => true) }), NEUTRAL_STAMINA);
  assert.equal(t.attackWindowsActive, PHYSICAL_MODEL_TUNING.windowCount);
  assert.equal(t.defenceWindowsActive, 0);
});

// (9) defence-only player receives only defence exposure.
test("HM-PHYSICAL-1.0 (9): a defence-only player's attackWindowsActive is 0", () => {
  const t = computeEnergyTrajectory("p1", false, activity({ defenceActive: ALL_FALSE.map(() => true) }), NEUTRAL_STAMINA);
  assert.equal(t.defenceWindowsActive, PHYSICAL_MODEL_TUNING.windowCount);
  assert.equal(t.attackWindowsActive, 0);
});

// (10) two-way player receives both.
test("HM-PHYSICAL-1.0 (10): a two-way player active in both phases every window loses MORE energy than a one-way player with the same window count", () => {
  const twoWay: WindowActivity = { attackActive: ALL_FALSE.map(() => true), defenceActive: ALL_FALSE.map(() => true), goalkeeperActive: ALL_FALSE };
  const oneWay: WindowActivity = { attackActive: ALL_FALSE.map(() => true), defenceActive: ALL_FALSE, goalkeeperActive: ALL_FALSE };
  const twoWayTraj = computeEnergyTrajectory("p1", false, twoWay, NEUTRAL_STAMINA);
  const oneWayTraj = computeEnergyTrajectory("p2", false, oneWay, NEUTRAL_STAMINA);
  assert.ok(twoWayTraj.finishingEnergy < oneWayTraj.finishingEnergy);
});

// (11) substitute begins with own energy.
test("HM-PHYSICAL-1.0 (11): a substitute's own trajectory starts from whatever startingEnergy is explicitly passed, not forced to 100", () => {
  const t = computeEnergyTrajectory("sub", false, activity({ attackActive: [false, false, false, true, true, true] }), NEUTRAL_STAMINA, 95);
  assert.equal(t.startingEnergy, 95);
});

// (12) substituted player retains previous energy / (13) returning player does not reset to 100.
test("HM-PHYSICAL-1.0 (12/13): the same player's OWN checkpoints never FORCE a reset mid-trajectory -- going from active to bench to active again continues from wherever energy actually was, never unconditionally back to 100", () => {
  // A single rest window, deliberately NOT spanning the halftime boundary (windows 3-4, i.e. minutes 30-50), so only bench recovery -- not also the halftime bonus -- applies.
  const onOffOn: WindowActivity = { attackActive: [true, true, true, false, true, true], defenceActive: ALL_FALSE, goalkeeperActive: ALL_FALSE };
  const t = computeEnergyTrajectory("p1", false, onOffOn, NEUTRAL_STAMINA, 100);
  assert.notEqual(t.checkpoints[4], 100, "re-entering the match must not silently reset energy to full");
  assert.ok(t.checkpoints[4] > t.checkpoints[3], "the one resting window (index 3) must have recovered at least some energy before re-entering at window 4");
  assert.ok(t.checkpoints[4] < t.checkpoints[0], "the returning player must still be below their original starting energy -- rest recovers, it does not exceed the starting point");
});

// (14) energy never exceeds 100.
test("HM-PHYSICAL-1.0 (14): energy never exceeds ENERGY_MAX even with heavy bench recovery", () => {
  const t = computeEnergyTrajectory("p1", false, activity({}), NEUTRAL_STAMINA, 100);
  for (const c of t.checkpoints) assert.ok(c <= ENERGY_MAX);
});

// (15) energy never falls below 0.
test("HM-PHYSICAL-1.0 (15): energy never falls below ENERGY_MIN even under maximum sustained load with low stamina", () => {
  const fullMatch: WindowActivity = { attackActive: ALL_FALSE.map(() => true), defenceActive: ALL_FALSE.map(() => true), goalkeeperActive: ALL_FALSE };
  const t = computeEnergyTrajectory("p1", false, fullMatch, LOW_STAMINA, 5);
  for (const c of t.checkpoints) assert.ok(c >= ENERGY_MIN);
});

// (16) high energy has minimal performance penalty.
test("HM-PHYSICAL-1.0 (16): high energy (100-80) has a minimal performance penalty", () => {
  assert.ok(fatiguePerformanceModifier(100) === 1);
  assert.ok(fatiguePerformanceModifier(90) > 0.98);
});

// (17) medium fatigue creates moderate penalty.
test("HM-PHYSICAL-1.0 (17): medium energy (60-40) creates a moderate, clearly-more-than-high-energy penalty", () => {
  const mid = fatiguePerformanceModifier(50);
  assert.ok(mid < 0.95 && mid > 0.75);
});

// (18) severe fatigue creates larger penalty.
test("HM-PHYSICAL-1.0 (18): severe fatigue (near 0) creates the largest penalty, but stays bounded above the floor", () => {
  const severe = fatiguePerformanceModifier(5);
  const mid = fatiguePerformanceModifier(50);
  assert.ok(severe < mid);
  assert.ok(severe >= 0.65, "the floor must never go below the documented 0.65 (Part 15's quality-preservation requirement)");
});

test("HM-PHYSICAL-1.0: fatiguePerformanceModifier is non-linear -- the penalty per energy point grows as energy falls (Part 13)", () => {
  const slopeHigh = fatiguePerformanceModifier(100) - fatiguePerformanceModifier(80);
  const slopeLow = fatiguePerformanceModifier(20) - fatiguePerformanceModifier(0);
  assert.ok(slopeLow > slopeHigh, "the 20->0 drop must cost more performance than the 100->80 drop");
});

test("HM-PHYSICAL-1.0 Part 15/27: a world-class player at reduced energy still outperforms a weak reserve at full energy", () => {
  const worldClassBase = 90;
  const weakReserveBase = 40;
  const worldClassAtLowEnergy = effectiveAttributeValue(worldClassBase, 20);
  const weakReserveAtFullEnergy = effectiveAttributeValue(weakReserveBase, 100);
  assert.ok(worldClassAtLowEnergy > weakReserveAtFullEnergy, `world-class at low energy (${worldClassAtLowEnergy}) must exceed weak reserve at full energy (${weakReserveAtFullEnergy})`);
});

// (19) fatigue does not mutate permanent player attributes.
test("HM-PHYSICAL-1.0 (19): effectiveAttributeValue never mutates its input -- pure function, returns a new number only", () => {
  const base = 15;
  const result = effectiveAttributeValue(base, 30);
  assert.equal(base, 15, "the caller's own base attribute value must be completely unaffected");
  assert.notEqual(result, base);
});

// (20) same inputs produce deterministic output.
test("HM-PHYSICAL-1.0 (20): identical inputs always produce identical trajectories -- no randomness anywhere in the model", () => {
  const act: WindowActivity = { attackActive: [true, false, true, true, false, true], defenceActive: [false, true, false, false, true, false], goalkeeperActive: ALL_FALSE };
  const a = computeEnergyTrajectory("p1", false, act, 13.7, 88);
  const b = computeEnergyTrajectory("p1", false, act, 13.7, 88);
  assert.deepEqual(a, b);
});

test("HM-PHYSICAL-1.0: energyAtMinute interpolates between checkpoints and matches them exactly at window boundaries", () => {
  const act: WindowActivity = { attackActive: ALL_FALSE.map(() => true), defenceActive: ALL_FALSE, goalkeeperActive: ALL_FALSE };
  const t = computeEnergyTrajectory("p1", false, act, NEUTRAL_STAMINA);
  assert.equal(energyAtMinute(t, 0), t.checkpoints[0]);
  assert.equal(energyAtMinute(t, 10), t.checkpoints[1]);
  assert.equal(energyAtMinute(t, 60), t.checkpoints[6]);
  const mid = energyAtMinute(t, 5);
  assert.ok(mid <= t.checkpoints[0] && mid >= t.checkpoints[1]);
});

test("HM-PHYSICAL-1.0: computeAveragePhaseFatigueModifier returns 1 (no penalty) for a player with zero exposure in that phase", () => {
  const t = computeEnergyTrajectory("p1", false, activity({ defenceActive: ALL_FALSE.map(() => true) }), NEUTRAL_STAMINA);
  const modifier = computeAveragePhaseFatigueModifier(t, ALL_FALSE); // zero attack exposure
  assert.equal(modifier, 1);
});

test("HM-PHYSICAL-1.0: computeAveragePhaseFatigueModifier reflects real fatigue for a heavily-used player", () => {
  const heavyUse: WindowActivity = { attackActive: ALL_FALSE.map(() => true), defenceActive: ALL_FALSE.map(() => true), goalkeeperActive: ALL_FALSE };
  const t = computeEnergyTrajectory("p1", false, heavyUse, LOW_STAMINA);
  const modifier = computeAveragePhaseFatigueModifier(t, heavyUse.attackActive);
  assert.ok(modifier < 1 && modifier >= 0.65);
});
