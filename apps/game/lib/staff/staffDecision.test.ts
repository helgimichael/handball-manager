// HM-STAFF-CAREER-1.0 Part 4: directional proofs for evaluateStaffDecision, mirroring lib/transfers/playerDecision.test.ts's own coverage shape.
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateStaffDecision } from "./staffDecision";

test("(1) a big wage rise is accepted", () => {
  const result = evaluateStaffDecision({ staffId: "s1", currentWageEurPerMonth: 1000, offeredWageEurPerMonth: 2000, currentClubTier: 2, newClubTier: 2, currentClubPressure: "NONE" });
  assert.equal(result.accept, true);
});

test("(2) a big wage cut with no other upside is rejected", () => {
  const result = evaluateStaffDecision({ staffId: "s2", currentWageEurPerMonth: 2000, offeredWageEurPerMonth: 800, currentClubTier: 2, newClubTier: 2, currentClubPressure: "NONE" });
  assert.equal(result.accept, false);
});

test("(3) a move up from tier 2 to tier 1 with an equal wage is more attractive than staying level", () => {
  const up = evaluateStaffDecision({ staffId: "s3", currentWageEurPerMonth: 1000, offeredWageEurPerMonth: 1000, currentClubTier: 2, newClubTier: 1, currentClubPressure: "NONE" });
  const level = evaluateStaffDecision({ staffId: "s3", currentWageEurPerMonth: 1000, offeredWageEurPerMonth: 1000, currentClubTier: 2, newClubTier: 2, currentClubPressure: "NONE" });
  assert.equal(up.accept, true);
  assert.equal(level.accept, false);
});

test("(4) a candidate at a financially CRITICAL club is more willing to accept a modest wage cut than one at a stable club", () => {
  const critical = evaluateStaffDecision({ staffId: "s4", currentWageEurPerMonth: 1000, offeredWageEurPerMonth: 900, currentClubTier: 2, newClubTier: 2, currentClubPressure: "CRITICAL" });
  const stable = evaluateStaffDecision({ staffId: "s4", currentWageEurPerMonth: 1000, offeredWageEurPerMonth: 900, currentClubTier: 2, newClubTier: 2, currentClubPressure: "NONE" });
  assert.equal(critical.accept, true);
  assert.equal(stable.accept, false);
});

test("(5) is deterministic -- identical inputs always produce the identical decision", () => {
  const inputs = { staffId: "s5", currentWageEurPerMonth: 1200, offeredWageEurPerMonth: 1300, currentClubTier: 1 as const, newClubTier: 2 as const, currentClubPressure: "WATCH" as const };
  assert.deepEqual(evaluateStaffDecision(inputs), evaluateStaffDecision(inputs));
});

test("(6) different candidates facing the identical near-neutral offer can decide differently -- deterministic per-person jitter, not a single global rule", () => {
  const base = { currentWageEurPerMonth: 1000, offeredWageEurPerMonth: 1000, currentClubTier: 2 as const, newClubTier: 2 as const, currentClubPressure: "NONE" as const };
  const outcomes = new Set(Array.from({ length: 20 }, (_, i) => evaluateStaffDecision({ staffId: `candidate-${i}`, ...base }).accept));
  assert.ok(outcomes.size > 1, "expected at least some variety across 20 different candidates facing a neutral offer");
});
