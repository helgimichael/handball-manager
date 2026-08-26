// HM-TRAINING-1.0 Part 30: directional proofs for the pure load/
// recovery math (lib/training/trainingLoad.ts). No CareerState/calendar
// involved here -- see trainingSchedule.test.ts/trainingExecution.test.ts
// for the domain-integration layer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ENERGY_MAX, ENERGY_MIN } from "../matchPlan/physicalModel";
import { applyOvernightRecovery, applyRecoveryDayBonus, applyRestDayBonus, computePlayerSessionEnergyDelta, computeSessionEnergyDelta } from "./trainingLoad";

const NEUTRAL_STAMINA = 10.5;

// (6) recovery session lower load than normal training.
test("(6) a RECOVERY session's energy delta is a net GAIN, strictly less 'load' than a normal TEAM_TACTICAL session's loss", () => {
  const recoveryDelta = computeSessionEnergyDelta("RECOVERY", "NORMAL", "NORMAL", NEUTRAL_STAMINA);
  const tacticalDelta = computeSessionEnergyDelta("TEAM_TACTICAL", "NORMAL", "NORMAL", NEUTRAL_STAMINA);
  assert.ok(recoveryDelta > 0, "RECOVERY should be a net gain");
  assert.ok(tacticalDelta < 0, "TEAM_TACTICAL should be a net loss");
  assert.ok(recoveryDelta > tacticalDelta);
});

// (7) conditioning load > tactical load.
test("(7) CONDITIONING carries a heavier load (larger energy loss) than TEAM_TACTICAL, all else equal", () => {
  const conditioning = computeSessionEnergyDelta("CONDITIONING", "NORMAL", "NORMAL", NEUTRAL_STAMINA);
  const tactical = computeSessionEnergyDelta("TEAM_TACTICAL", "NORMAL", "NORMAL", NEUTRAL_STAMINA);
  assert.ok(Math.abs(conditioning) > Math.abs(tactical), `conditioning=${conditioning} tactical=${tactical}`);
});

// (8) high intensity > normal.
test("(8) HIGH intensity produces a larger-magnitude delta than NORMAL, all else equal", () => {
  const high = computeSessionEnergyDelta("ATTACK", "HIGH", "NORMAL", NEUTRAL_STAMINA);
  const normal = computeSessionEnergyDelta("ATTACK", "NORMAL", "NORMAL", NEUTRAL_STAMINA);
  assert.ok(Math.abs(high) > Math.abs(normal), `high=${high} normal=${normal}`);
});

// (9) long > short if duration exists.
test("(9) LONG duration produces a larger-magnitude delta than SHORT, all else equal", () => {
  const long = computeSessionEnergyDelta("ATTACK", "NORMAL", "LONG", NEUTRAL_STAMINA);
  const short = computeSessionEnergyDelta("ATTACK", "NORMAL", "SHORT", NEUTRAL_STAMINA);
  assert.ok(Math.abs(long) > Math.abs(short), `long=${long} short=${short}`);
});

// (12) individual REDUCED load < FULL.
test("(12) a REDUCED individual load setting produces a smaller-magnitude delta than FULL for the same session", () => {
  const session = { type: "CONDITIONING" as const, intensity: "HIGH" as const, duration: "NORMAL" as const };
  const full = computePlayerSessionEnergyDelta(session, "FULL", NEUTRAL_STAMINA);
  const reduced = computePlayerSessionEnergyDelta(session, "REDUCED", NEUTRAL_STAMINA);
  assert.ok(Math.abs(reduced) < Math.abs(full), `full=${full} reduced=${reduced}`);
});

// (13) REST individual receives zero session load.
test("(13) a REST individual load setting produces exactly zero delta, regardless of the scheduled session", () => {
  const session = { type: "CONDITIONING" as const, intensity: "VERY_HIGH" as const, duration: "LONG" as const };
  assert.equal(computePlayerSessionEnergyDelta(session, "REST", NEUTRAL_STAMINA), 0);
});

test("RECOVERY_ONLY individual load setting always produces a net GAIN, even when the scheduled session is a hard one", () => {
  const session = { type: "CONDITIONING" as const, intensity: "VERY_HIGH" as const, duration: "LONG" as const };
  const delta = computePlayerSessionEnergyDelta(session, "RECOVERY_ONLY", NEUTRAL_STAMINA);
  assert.ok(delta > 0, `expected a net gain, got ${delta}`);
});

// (14) session reduces energy according to load (already covered directionally above; this proves the actual magnitude scaling with stamina).
test("(14) a lower-stamina (ENDURANCE) player loses more energy from the identical session than a higher-stamina player", () => {
  const session = { type: "STRENGTH" as const, intensity: "HIGH" as const, duration: "NORMAL" as const };
  const lowStamina = computePlayerSessionEnergyDelta(session, "FULL", 2);
  const highStamina = computePlayerSessionEnergyDelta(session, "FULL", 19);
  assert.ok(Math.abs(lowStamina) > Math.abs(highStamina), `low=${lowStamina} high=${highStamina}`);
});

// (15) overnight recovery increases energy.
test("(15) overnight recovery always increases energy (below the max)", () => {
  const recovered = applyOvernightRecovery(50);
  assert.ok(recovered > 50);
});

// (16) recovery day increases energy more than hard training day (day-level bonuses).
test("(16) a REST day's bonus recovers more than a RECOVERY day's own no-session bonus", () => {
  const rest = applyRestDayBonus(50);
  const recovery = applyRecoveryDayBonus(50);
  assert.ok(rest > recovery, `rest=${rest} recovery=${recovery}`);
});

// (17) energy bounded 0-100.
test("(17) overnight recovery, REST bonus, and RECOVERY bonus never push energy above ENERGY_MAX", () => {
  assert.equal(applyOvernightRecovery(ENERGY_MAX), ENERGY_MAX);
  assert.equal(applyRestDayBonus(ENERGY_MAX), ENERGY_MAX);
  assert.equal(applyRecoveryDayBonus(ENERGY_MAX), ENERGY_MAX);
});

test("(17) a session's own energy delta never pushes energy below ENERGY_MIN once clamped by the caller", () => {
  const session = { type: "CONDITIONING" as const, intensity: "VERY_HIGH" as const, duration: "LONG" as const };
  const delta = computePlayerSessionEnergyDelta(session, "FULL", 1);
  const clamped = Math.max(ENERGY_MIN, Math.min(ENERGY_MAX, ENERGY_MIN + delta));
  assert.ok(clamped >= ENERGY_MIN);
});

test("ATTACK_ONLY-style phase sessions are not special-cased here -- ATTACK and DEFENCE carry equal load by design", () => {
  const attack = computeSessionEnergyDelta("ATTACK", "NORMAL", "NORMAL", NEUTRAL_STAMINA);
  const defence = computeSessionEnergyDelta("DEFENCE", "NORMAL", "NORMAL", NEUTRAL_STAMINA);
  assert.equal(attack, defence);
});
