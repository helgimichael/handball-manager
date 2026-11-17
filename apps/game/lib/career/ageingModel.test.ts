// HM-TRANSFER-REALISM M8D: gradual, position-sensitive ageing, opportunity-aware
// retirement and age-dependent contract lengths.
import test from "node:test";
import assert from "node:assert/strict";
import { ageingDeclineChanges, computeRetirementProbability, expectedFamilyDecline, individualAgeingTraits, opportunityRetirementMultiplier } from "./playerLifecycle";
import { GOALKEEPER_ATTRIBUTES, OUTCOURT_ATTRIBUTES } from "../rating/types";
import { cpuOfferContractYears } from "./cpuCandidateEvaluation";
import { contractYearsCapForAge } from "../transfers/careerDecision/model";

const attrs = (list: readonly string[], value = 15) => Object.fromEntries(list.map((a) => [a, { value }]));
const caLoss = (id: string, age: number, position = "V9", branch: "OUTCOURT" | "GOALKEEPER" = "OUTCOURT", year = "2030") =>
  -ageingDeclineChanges(id, year, age, position, branch, attrs(branch === "GOALKEEPER" ? GOALKEEPER_ATTRIBUTES : OUTCOURT_ATTRIBUTES)).reduce((a, c) => a + c.caDelta, 0);
const meanLoss = (age: number, position = "V9", branch: "OUTCOURT" | "GOALKEEPER" = "OUTCOURT") => {
  let total = 0;
  for (let i = 0; i < 300; i++) total += caLoss(`p${i}`, age, position, branch);
  return total / 300;
};

test("M8D: no decline in a player's prime; gradual from the early thirties; clearly faster after 35", () => {
  assert.equal(meanLoss(25), 0);
  const l31 = meanLoss(31), l33 = meanLoss(33), l35 = meanLoss(35), l37 = meanLoss(37), l39 = meanLoss(39);
  assert.ok(l31 < l33 && l33 < l35 && l35 < l37 && l37 < l39, `monotone: ${[l31, l33, l35, l37, l39].map((x) => x.toFixed(2))}`);
  assert.ok(l31 > 0.1 && l31 < 1.5, `age 31: ${l31.toFixed(2)} CA/season`);
  assert.ok(l33 > 0.8 && l33 < 3.5, `age 33: ${l33.toFixed(2)}`);
  assert.ok(l37 > 3 && l37 < 8, `age 37: ${l37.toFixed(2)}`);
  // The old model capped decline at 3 attribute points (~0.5 CA) per season.
  assert.ok(l37 > 1.5);
});

test("M8D: physical qualities fade first; mental and game reading last", () => {
  const id = "steady";
  assert.ok(expectedFamilyDecline("PHYSICAL", "OUTCOURT", "V9", 32, id) > 0);
  assert.equal(expectedFamilyDecline("MENTAL", "OUTCOURT", "V9", 32, id), 0);
  assert.ok(expectedFamilyDecline("PHYSICAL", "OUTCOURT", "V9", 36, id) > expectedFamilyDecline("PERCEPTION_DECISION", "OUTCOURT", "V9", 36, id) * 3);
});

test("M8D: position matters -- a wing's physical decline is steeper than a centre back's", () => {
  assert.ok(meanLoss(34, "V6") > meanLoss(34, "M9"));
  assert.ok(expectedFamilyDecline("PHYSICAL", "OUTCOURT", "H6", 33, "x") > expectedFamilyDecline("PHYSICAL", "OUTCOURT", "M9", 33, "x"));
});

test("M8D: goalkeepers age later (effective-age discount)", () => {
  assert.ok(meanLoss(34, "MV", "GOALKEEPER") < meanLoss(34, "V9"));
});

test("M8D: players do not all decline at the same age", () => {
  const firstAgeOverOne = new Set<number>();
  for (let i = 0; i < 100; i++) {
    for (let age = 29; age <= 40; age++) {
      if (caLoss(`v${i}`, age) > 1) { firstAgeOverOne.add(age); break; }
    }
  }
  assert.ok(firstAgeOverOne.size >= 4, `distinct onset ages: ${[...firstAgeOverOne].sort()}`);
  const traits = Array.from({ length: 200 }, (_, i) => individualAgeingTraits(`t${i}`));
  assert.ok(traits.every((t) => t.rate >= 0.7 && t.rate <= 1.3 && Math.abs(t.onsetShift) <= 1.5));
});

test("M8D: a CA-170 outcourt player at 30 is a good-but-fading veteran at 38, not CA 159 at 40", () => {
  let ca = 170;
  for (let age = 30; age < 38; age++) ca -= caLoss("veteran-star", age, "V9", "OUTCOURT", String(2020 + age));
  assert.ok(ca > 135 && ca < 160, `CA at 38: ${ca.toFixed(1)}`);
});

test("M8D: deterministic", () => {
  assert.deepEqual(ageingDeclineChanges("d", "2031", 34, "M6", "OUTCOURT", attrs(OUTCOURT_ATTRIBUTES)), ageingDeclineChanges("d", "2031", 34, "M6", "OUTCOURT", attrs(OUTCOURT_ATTRIBUTES)));
});

test("M8D: retirement reflects playing opportunity, gently and only from 30", () => {
  assert.equal(opportunityRetirementMultiplier(27, 40), 1);
  assert.ok(opportunityRetirementMultiplier(33, 30) > 1 && opportunityRetirementMultiplier(33, -20) < 1);
  assert.ok(opportunityRetirementMultiplier(33, 200) <= 1.6 && opportunityRetirementMultiplier(33, -200) >= 0.75);
  const base = { age: 34, isGoalkeeper: false, tier: "ROTATION" as const, contractStatus: "EXPIRING" as const, daysUnattached: 0 };
  assert.ok(computeRetirementProbability({ ...base, abilityGapToSquadCore: 25 }) > computeRetirementProbability({ ...base, abilityGapToSquadCore: -10 }));
  assert.equal(computeRetirementProbability(base), computeRetirementProbability({ ...base, abilityGapToSquadCore: undefined }));
});

test("M8D: contract length follows age -- no three-year deals for 35-year-olds", () => {
  assert.equal(cpuOfferContractYears(24), 3);
  assert.equal(cpuOfferContractYears(31), 2);
  assert.equal(cpuOfferContractYears(35), 1);
  for (let age = 18; age < 42; age++) assert.ok(contractYearsCapForAge(age + 1) <= contractYearsCapForAge(age));
});
