import { test } from "node:test";
import assert from "node:assert/strict";
import { generateContractEndDate, generateInitialContract } from "./contractGeneration";
import type { EconomyProfileInputs } from "./marketValue";

test("(gen 1) generateContractEndDate is deterministic -- identical inputs always produce the identical date", () => {
  const a = generateContractEndDate("p-1", "2027/28", 2027);
  const b = generateContractEndDate("p-1", "2027/28", 2027);
  assert.equal(a, b);
});

test("(gen 2) generateContractEndDate anchors near the season's own end year", () => {
  const date = generateContractEndDate("p-1", "2027/28", 2027); // "2027/28" -> end year 2028, anchor 2028-06-30 +/- 120 days
  assert.ok(date >= "2028-03-01" && date <= "2028-10-31", `date=${date}`);
});

test("(gen 3) two players sharing the exact same fallback season hint get DIFFERENT end dates -- never a mass-expiry collision", () => {
  const dates = ["p-a", "p-b", "p-c", "p-d", "p-e"].map((id) => generateContractEndDate(id, "2026/27", 2027));
  const unique = new Set(dates);
  assert.ok(unique.size > 1, `all identical: ${JSON.stringify(dates)}`);
});

test("(gen 4) generateInitialContract produces a well-formed PlayerContract with a positive wage", () => {
  const inputs: EconomyProfileInputs = { ca: 130, pa: 140, age: 25, position: "M9", role: "STARTER", competitionTier: 2 };
  const contract = generateInitialContract("p-1", "club-x", "2028/29", 2027, inputs);
  assert.equal(contract.playerId, "p-1");
  assert.equal(contract.clubId, "club-x");
  assert.ok(contract.contractEndDate.length === 10);
  assert.ok(contract.wageEurPerMonth > 0);
});

test("(gen 5) generateInitialContract is deterministic", () => {
  const inputs: EconomyProfileInputs = { ca: 130, pa: 140, age: 25, position: "M9", role: "STARTER", competitionTier: 2 };
  const a = generateInitialContract("p-1", "club-x", "2028/29", 2027, inputs);
  const b = generateInitialContract("p-1", "club-x", "2028/29", 2027, inputs);
  assert.deepEqual(a, b);
});
