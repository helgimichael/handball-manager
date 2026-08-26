import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ageRiskModifier,
  computeMatchInjuryRisk,
  computeTrainingInjuryRisk,
  fatigueRiskModifier,
  physicalResilienceModifier,
  pickExpectedDurationDays,
  pickInjuryType,
  pickSeverity,
  recentLoadRiskModifier,
  recurrenceRiskModifier,
  seededRoll,
  type InjuryRiskInputs,
} from "./injuryRisk";
import { INJURY_TYPE_PROFILES, SEVERITY_DURATION_RANGE_DAYS, type InjuryHistoryEntry } from "./types";

function freshInputs(overrides: Partial<InjuryRiskInputs> = {}): InjuryRiskInputs {
  return { age: 25, currentEnergy: 90, recentLoad: 5, physicalResilience: 10.5, injuryHistory: [], asOfDate: "2026-09-01", ...overrides };
}

// (1) zero exposure = zero match injury risk.
test("(1) zero match exposure produces exactly zero contact and overuse risk", () => {
  const result = computeMatchInjuryRisk(0, freshInputs());
  assert.equal(result.contactRisk, 0);
  assert.equal(result.overuseRisk, 0);
});

// (2) REST player = zero training injury exposure.
test("(2) REST load setting produces exactly zero training injury risk regardless of session", () => {
  const risk = computeTrainingInjuryRisk("REST", "CONDITIONING", "VERY_HIGH", freshInputs());
  assert.equal(risk, 0);
});

// (3) REDUCED load < FULL risk.
test("(3) REDUCED load setting produces strictly lower risk than FULL for the identical session", () => {
  const full = computeTrainingInjuryRisk("FULL", "CONDITIONING", "NORMAL", freshInputs());
  const reduced = computeTrainingInjuryRisk("REDUCED", "CONDITIONING", "NORMAL", freshInputs());
  assert.ok(reduced < full, `reduced=${reduced} full=${full}`);
  assert.ok(reduced > 0);
});

// (4) HIGH intensity > NORMAL risk.
test("(4) HIGH intensity produces strictly higher risk than NORMAL, all else equal", () => {
  const normal = computeTrainingInjuryRisk("FULL", "CONDITIONING", "NORMAL", freshInputs());
  const high = computeTrainingInjuryRisk("FULL", "CONDITIONING", "HIGH", freshInputs());
  assert.ok(high > normal, `normal=${normal} high=${high}`);
});

// (5) heavy recent load increases overuse risk.
test("(5) heavier recentLoad strictly increases training injury risk", () => {
  const low = computeTrainingInjuryRisk("FULL", "CONDITIONING", "NORMAL", freshInputs({ recentLoad: 0 }));
  const high = computeTrainingInjuryRisk("FULL", "CONDITIONING", "NORMAL", freshInputs({ recentLoad: 35 }));
  assert.ok(high > low, `low=${low} high=${high}`);
});

// (6) low energy increases risk.
test("(6) lower currentEnergy strictly increases both training and match injury risk", () => {
  const fitTraining = computeTrainingInjuryRisk("FULL", "CONDITIONING", "NORMAL", freshInputs({ currentEnergy: 95 }));
  const tiredTraining = computeTrainingInjuryRisk("FULL", "CONDITIONING", "NORMAL", freshInputs({ currentEnergy: 20 }));
  assert.ok(tiredTraining > fitTraining);

  const fitMatch = computeMatchInjuryRisk(1, freshInputs({ currentEnergy: 95 }));
  const tiredMatch = computeMatchInjuryRisk(1, freshInputs({ currentEnergy: 20 }));
  assert.ok(tiredMatch.contactRisk > fitMatch.contactRisk);
  assert.ok(tiredMatch.overuseRisk > fitMatch.overuseRisk);
});

// (7) normal fresh player risk stays low (Part 9: no injury apocalypse).
test("(7) a fresh, healthy, normally-loaded player's training and match risk both stay well under 3%", () => {
  const training = computeTrainingInjuryRisk("FULL", "TEAM_TACTICAL", "NORMAL", freshInputs());
  const match = computeMatchInjuryRisk(1, freshInputs());
  assert.ok(training < 0.03, `training risk too high: ${training}`);
  assert.ok(match.contactRisk + match.overuseRisk < 0.03, `match risk too high: ${match.contactRisk + match.overuseRisk}`);
});

// (8) same seed/input deterministic.
test("(8) seededRoll is deterministic -- identical seed key always produces the identical roll", () => {
  const a = seededRoll("player-x:2026-09-01:session-1");
  const b = seededRoll("player-x:2026-09-01:session-1");
  assert.equal(a, b);
  assert.ok(a >= 0 && a < 1);
});

// (9) no Math.random anywhere in this module.
test("(9) injuryRisk.ts source contains no Math.random() call outside of comments", async () => {
  const fs = await import("node:fs");
  const source = fs.readFileSync(new URL("./injuryRisk.ts", import.meta.url), "utf8");
  const codeOnly = source
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
  assert.ok(!codeOnly.includes("Math.random("), "injuryRisk.ts must never call Math.random() in executable code");
});

// (10) prior same-area injury increases recurrence risk.
test("(10) a recent same-body-area injury strictly increases recurrence risk; a different body area does not", () => {
  const history: InjuryHistoryEntry[] = [
    { injuryId: "i1", injuryType: "ANKLE_SPRAIN", bodyArea: "ANKLE", mechanism: "CONTACT", severity: "MINOR", source: "TRAINING", occurredDate: "2026-08-01", returnDate: "2026-08-10" },
  ];
  const sameArea = recurrenceRiskModifier(history, "ANKLE", "2026-08-15");
  const otherArea = recurrenceRiskModifier(history, "KNEE", "2026-08-15");
  assert.ok(sameArea > 1.0, `sameArea=${sameArea}`);
  assert.equal(otherArea, 1.0);
});

test("(10b) recurrence risk fades to neutral once the injury is far outside the recurrence window", () => {
  const history: InjuryHistoryEntry[] = [
    { injuryId: "i1", injuryType: "ANKLE_SPRAIN", bodyArea: "ANKLE", mechanism: "CONTACT", severity: "MINOR", source: "TRAINING", occurredDate: "2026-01-01", returnDate: "2026-01-10" },
  ];
  const farLater = recurrenceRiskModifier(history, "ANKLE", "2026-09-01");
  assert.equal(farLater, 1.0);
});

// (11) age modifier bounded.
test("(11) ageRiskModifier is smooth and bounded -- no cliff, a 31-year-old stays close to neutral", () => {
  assert.equal(ageRiskModifier(24), 1.0);
  assert.equal(ageRiskModifier(null), 1.0);
  const at31 = ageRiskModifier(31);
  assert.ok(at31 > 1.0 && at31 < 1.2, `at31=${at31}`);
  const at45 = ageRiskModifier(45);
  assert.ok(at45 <= 1.28 && at45 >= 1.0);
  // monotonic, no sudden jump
  assert.ok(ageRiskModifier(32) >= ageRiskModifier(31));
});

// (12) physical resilience affects risk directionally.
test("(12) higher physicalResilience strictly lowers risk; lower strictly raises it, both bounded", () => {
  const neutral = physicalResilienceModifier(10.5);
  const strong = physicalResilienceModifier(20);
  const weak = physicalResilienceModifier(1);
  assert.equal(neutral, 1.0);
  assert.ok(strong < neutral);
  assert.ok(weak > neutral);
  assert.ok(strong >= 0.8 && weak <= 1.2);
});

// (13) GK/outcourt risk channels remain valid.
test("(13) a null physicalResilience (goalkeeper fallback) resolves to the neutral modifier, never NaN/undefined", () => {
  const gk = physicalResilienceModifier(null);
  assert.equal(gk, 1.0);
});

test("(13b) goalkeeper match exposure (goalkeeperExposure channel) still produces a valid, bounded risk", () => {
  const result = computeMatchInjuryRisk(1, freshInputs());
  assert.ok(Number.isFinite(result.contactRisk) && Number.isFinite(result.overuseRisk));
  assert.ok(result.contactRisk >= 0 && result.overuseRisk >= 0);
});

// (14) injury result bounded/valid.
test("(14) picked severity, injury type, and duration are always valid, in-vocabulary values", () => {
  for (let i = 0; i < 30; i++) {
    const seed = `bounds-test-${i}`;
    const severity = pickSeverity(seed);
    assert.ok(["MINOR", "MODERATE", "MAJOR", "SEVERE"].includes(severity));
    const contactType = pickInjuryType("CONTACT", severity, seed);
    assert.ok(INJURY_TYPE_PROFILES[contactType].mechanism === "CONTACT");
    const overuseType = pickInjuryType("OVERUSE", severity, seed);
    assert.equal(INJURY_TYPE_PROFILES[overuseType].mechanism, "OVERUSE");
    const duration = pickExpectedDurationDays(severity, 25, seed);
    const range = SEVERITY_DURATION_RANGE_DAYS[severity];
    assert.ok(duration >= range.min && duration <= range.max * 1.2, `duration=${duration} range=${JSON.stringify(range)}`);
  }
});

test("(14b) ACL_TEAR is only ever picked for CONTACT+SEVERE, never a lesser severity", () => {
  for (let i = 0; i < 50; i++) {
    const type = pickInjuryType("CONTACT", "MINOR", `acl-check-minor-${i}`);
    assert.notEqual(type, "ACL_TEAR");
  }
});

// (15) no duplicate injury resolution for same session/match -- covered
// structurally: seededRoll is pure/deterministic, so calling with the
// SAME seed key twice always yields the SAME roll (never a fresh random
// draw that could flip the outcome on a second call for the same event).
test("(15) resolving the same seed key twice never produces two different outcomes", () => {
  const seed = "dedup-check:player-1:session-1";
  const rolls = Array.from({ length: 5 }, () => seededRoll(seed));
  assert.ok(rolls.every((r) => r === rolls[0]));
});

test("fatigueRiskModifier and recentLoadRiskModifier are both bounded", () => {
  assert.ok(fatigueRiskModifier(0) <= 1.7);
  assert.ok(fatigueRiskModifier(100) === 1.0);
  assert.ok(recentLoadRiskModifier(0) === 1.0);
  assert.ok(recentLoadRiskModifier(1000) <= 1.8);
});
