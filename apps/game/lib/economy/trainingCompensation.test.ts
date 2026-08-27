// HM-CONTRACTS-1.0A: pure training-compensation rule-engine tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTrainingCompensationEur, computeTotalAcquisitionCostEur, GENERIC_FOUNDATION_RULE_SET } from "./trainingCompensation";
import type { PlayerClubHistoryEntry, TrainingCompensationRuleSet } from "./types";

const oneClub: PlayerClubHistoryEntry[] = [{ clubId: "swe2-tumba", fromAge: 12, toAge: 18 }];
const twoClubs: PlayerClubHistoryEntry[] = [
  { clubId: "swe2-tumba", fromAge: 12, toAge: 15 },
  { clubId: "swe2-tumba", fromAge: 15, toAge: 18 },
];

test("(1) a young player under the age cutoff with history gets positive compensation", () => {
  const result = computeTrainingCompensationEur(19, oneClub);
  assert.ok(result.totalEur > 0);
  assert.equal(result.perClub.length, 1);
});

test("(2) a player over the rule set's maxCompensationAge gets zero compensation, regardless of history", () => {
  const result = computeTrainingCompensationEur(27, oneClub);
  assert.equal(result.totalEur, 0);
  assert.deepEqual(result.perClub, []);
});

test("(3) empty history yields zero compensation, never a crash", () => {
  const result = computeTrainingCompensationEur(19, []);
  assert.equal(result.totalEur, 0);
});

test("(4) a null age yields zero compensation, never a crash", () => {
  const result = computeTrainingCompensationEur(null, oneClub);
  assert.equal(result.totalEur, 0);
});

test("(5) multiple training clubs are each represented with their own share, summing to the total", () => {
  const result = computeTrainingCompensationEur(19, twoClubs);
  assert.equal(result.perClub.length, 2);
  const sum = result.perClub.reduce((s, c) => s + c.amountEur, 0);
  assert.equal(sum, result.totalEur);
});

test("(6) is pure/deterministic -- identical inputs always produce the identical result", () => {
  const a = computeTrainingCompensationEur(19, oneClub);
  const b = computeTrainingCompensationEur(19, oneClub);
  assert.deepEqual(a, b);
});

test("(7) result carries the rule set's own version, so provenance is distinguishable across rule sets", () => {
  const result = computeTrainingCompensationEur(19, oneClub, GENERIC_FOUNDATION_RULE_SET);
  assert.equal(result.ruleSetVersion, GENERIC_FOUNDATION_RULE_SET.version);
});

test("(8) a different, swappable rule set (never a hardcoded Sweden-only formula) produces a different result", () => {
  const alternateRuleSet: TrainingCompensationRuleSet = {
    version: "TEST_ALTERNATE_v1",
    maxCompensationAge: 21,
    perClubPerYearEur: () => 10_000,
  };
  const underGeneric = computeTrainingCompensationEur(19, oneClub, GENERIC_FOUNDATION_RULE_SET);
  const underAlternate = computeTrainingCompensationEur(19, oneClub, alternateRuleSet);
  assert.notEqual(underGeneric.totalEur, underAlternate.totalEur);
  assert.equal(underAlternate.ruleSetVersion, "TEST_ALTERNATE_v1");

  // The alternate rule set's own tighter age cutoff (21) is honored -- a 22-year-old gets zero under it, but not necessarily under the generic set.
  const olderUnderAlternate = computeTrainingCompensationEur(22, oneClub, alternateRuleSet);
  assert.equal(olderUnderAlternate.totalEur, 0);
});

test("(9) computeTotalAcquisitionCostEur is a plain sum -- a free transfer (fee=0) plus positive compensation yields a positive total", () => {
  const comp = computeTrainingCompensationEur(19, oneClub);
  const total = computeTotalAcquisitionCostEur(0, comp.totalEur);
  assert.equal(total, comp.totalEur);
  assert.ok(total > 0);
});

test("(10) computeTotalAcquisitionCostEur adds a nonzero transfer fee and training compensation without either absorbing the other", () => {
  const total = computeTotalAcquisitionCostEur(50_000, 3_000);
  assert.equal(total, 53_000);
});
