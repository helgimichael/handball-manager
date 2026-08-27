import { test } from "node:test";
import assert from "node:assert/strict";
import { computePlayerMarketValueSek, computePlayerSalarySekPerMonth, type EconomyProfileInputs } from "./marketValue";

function baseInputs(overrides: Partial<EconomyProfileInputs> = {}): EconomyProfileInputs {
  return { ca: 130, pa: 140, age: 26, position: "M9", role: "STARTER", competitionTier: 1, ...overrides };
}

// (1) deterministic.
test("(1) computePlayerMarketValueSek and computePlayerSalarySekPerMonth are pure/deterministic -- identical inputs always produce the identical output", () => {
  const inputs = baseInputs();
  const a = computePlayerMarketValueSek(inputs, "2027-06-30", "2026-08-19");
  const b = computePlayerMarketValueSek(inputs, "2027-06-30", "2026-08-19");
  assert.equal(a, b);
  assert.equal(computePlayerSalarySekPerMonth(inputs), computePlayerSalarySekPerMonth(inputs));
});

// (2) handball-realistic scale, never football numbers.
test("(2) value and salary stay within a realistic Swedish handball scale, never football-scale numbers", () => {
  const elite = baseInputs({ ca: 185, pa: 190, age: 26, role: "KEY_PLAYER", competitionTier: 1 });
  const value = computePlayerMarketValueSek(elite, "2029-06-30", "2026-08-19");
  const salary = computePlayerSalarySekPerMonth(elite);
  assert.ok(value <= 6_000_000, `value too high: ${value}`);
  assert.ok(value >= 15_000, `value too low: ${value}`);
  assert.ok(salary <= 140_000, `salary too high: ${salary}`);
  assert.ok(salary >= 6_000, `salary too low: ${salary}`);
});

// (3) higher CA -> higher value and salary, all else equal.
test("(3) higher CA strictly increases both value and salary, all else equal", () => {
  const weak = baseInputs({ ca: 100 });
  const strong = baseInputs({ ca: 160 });
  assert.ok(computePlayerMarketValueSek(strong, "2027-06-30", "2026-08-19") > computePlayerMarketValueSek(weak, "2027-06-30", "2026-08-19"));
  assert.ok(computePlayerSalarySekPerMonth(strong) > computePlayerSalarySekPerMonth(weak));
});

// (4) young talents with high PA headroom carry a value premium over an identical-CA veteran with no headroom.
test("(4) a young high-potential player is worth strictly more than an older player with the identical CA and zero headroom", () => {
  const youngTalent = baseInputs({ ca: 120, pa: 175, age: 19 });
  const agedNoHeadroom = baseInputs({ ca: 120, pa: 120, age: 33 });
  const youngValue = computePlayerMarketValueSek(youngTalent, "2028-06-30", "2026-08-19");
  const agedValue = computePlayerMarketValueSek(agedNoHeadroom, "2028-06-30", "2026-08-19");
  assert.ok(youngValue > agedValue, `young=${youngValue} aged=${agedValue}`);
});

// (5) age curve is smooth and bounded -- peak years hold full value, no cliffs.
test("(5) age affects value smoothly -- peak years (24-29) are highest, no sudden cliff at any single year", () => {
  const ages = [17, 20, 24, 27, 29, 32, 35, 38, 41];
  const values = ages.map((age) => computePlayerMarketValueSek(baseInputs({ age, pa: 130 }), "2028-06-30", "2026-08-19"));
  for (let i = 0; i < values.length - 1; i++) {
    const ratio = values[i + 1] / values[i];
    assert.ok(ratio > 0.5 && ratio < 1.6, `cliff between age ${ages[i]} and ${ages[i + 1]}: ${values[i]} -> ${values[i + 1]}`);
  }
  const peak = computePlayerMarketValueSek(baseInputs({ age: 27, pa: 130 }), "2028-06-30", "2026-08-19");
  const veryOld = computePlayerMarketValueSek(baseInputs({ age: 41, pa: 130 }), "2028-06-30", "2026-08-19");
  const veryYoung = computePlayerMarketValueSek(baseInputs({ age: 17, pa: 130 }), "2028-06-30", "2026-08-19");
  assert.ok(peak > veryOld);
  assert.ok(peak >= veryYoung);
});

// (6) contract time remaining affects value -- expiring/free agent discounted.
test("(6) shorter contract time remaining strictly lowers value; a free agent is discounted furthest", () => {
  const longContract = computePlayerMarketValueSek(baseInputs(), "2030-06-30", "2026-08-19"); // >365 days -- UNDER_CONTRACT
  const expiringSoon = computePlayerMarketValueSek(baseInputs(), "2027-05-01", "2026-08-19"); // ~255 days -- EXPIRING_SOON (181-365)
  const expiring = computePlayerMarketValueSek(baseInputs(), "2027-01-01", "2026-08-19"); // ~135 days -- EXPIRING (1-180)
  const freeAgent = computePlayerMarketValueSek(baseInputs(), "2026-08-01", "2026-08-19"); // already past -- FREE_AGENT
  assert.ok(longContract > expiringSoon);
  assert.ok(expiringSoon > expiring);
  assert.ok(expiring > freeAgent);
});

// (7) league/club level affects value and salary.
test("(7) a Handbollsligan (tier 1) player is worth more and paid more than an identical Allsvenskan (tier 2) player", () => {
  const tier1 = baseInputs({ competitionTier: 1 });
  const tier2 = baseInputs({ competitionTier: 2 });
  assert.ok(computePlayerMarketValueSek(tier1, "2028-06-30", "2026-08-19") > computePlayerMarketValueSek(tier2, "2028-06-30", "2026-08-19"));
  assert.ok(computePlayerSalarySekPerMonth(tier1) > computePlayerSalarySekPerMonth(tier2));
});

// (8) squad role affects value and salary.
test("(8) a KEY_PLAYER is worth more and paid more than an EMERGENCY player with identical CA", () => {
  const key = baseInputs({ role: "KEY_PLAYER" });
  const emergency = baseInputs({ role: "EMERGENCY" });
  assert.ok(computePlayerMarketValueSek(key, "2028-06-30", "2026-08-19") > computePlayerMarketValueSek(emergency, "2028-06-30", "2026-08-19"));
  assert.ok(computePlayerSalarySekPerMonth(key) > computePlayerSalarySekPerMonth(emergency));
});

// (9) GK works through the exact same formula -- no separate pipeline, just a bounded coefficient.
test("(9) a goalkeeper's value/salary are computed by the SAME formula, differing only by a bounded position coefficient", () => {
  const outcourt = baseInputs({ position: "M9" });
  const gk = baseInputs({ position: "GK" });
  const outcourtValue = computePlayerMarketValueSek(outcourt, "2028-06-30", "2026-08-19");
  const gkValue = computePlayerMarketValueSek(gk, "2028-06-30", "2026-08-19");
  const ratio = gkValue / outcourtValue;
  assert.ok(ratio > 0.7 && ratio < 1.0, `ratio=${ratio}`);
});

// (10) unknown age doesn't crash, resolves to a neutral value.
test("(10) a null age resolves to a neutral, still-bounded value/salary rather than crashing", () => {
  const value = computePlayerMarketValueSek(baseInputs({ age: null }), "2028-06-30", "2026-08-19");
  const salary = computePlayerSalarySekPerMonth(baseInputs({ age: null }));
  assert.ok(Number.isFinite(value) && value > 0);
  assert.ok(Number.isFinite(salary) && salary > 0);
});

// (11) unknown competition tier is neutral, never a penalty/crash.
test("(11) an unknown competition tier resolves neutrally, never a crash or an unfairly low value", () => {
  const known = baseInputs({ competitionTier: 2 });
  const unknown = baseInputs({ competitionTier: undefined });
  const knownValue = computePlayerMarketValueSek(known, "2028-06-30", "2026-08-19");
  const unknownValue = computePlayerMarketValueSek(unknown, "2028-06-30", "2026-08-19");
  assert.ok(unknownValue >= knownValue); // neutral (1.0x) sits above the tier-2 discount (0.85x)
});
