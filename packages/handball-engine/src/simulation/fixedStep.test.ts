import assert from "node:assert/strict";
import test from "node:test";
import { MAX_ACCUMULATED_SECONDS, SIMULATION_DT_SECONDS, planFixedSteps } from "./fixedStep";

test("fixed step planner keeps sub-step elapsed time in the accumulator", () => {
  const plan = planFixedSteps(SIMULATION_DT_SECONDS / 2, 0);

  assert.equal(plan.steps, 0);
  assert.equal(plan.consumedSeconds, 0);
  assert.equal(plan.accumulatorSeconds, SIMULATION_DT_SECONDS / 2);
});

test("fixed step planner produces deterministic whole steps", () => {
  const plan = planFixedSteps(0.12, 0.03, 0.05);

  assert.equal(plan.steps, 3);
  assert.ok(Math.abs(plan.consumedSeconds - 0.15) < 1e-12);
  assert.ok(Math.abs(plan.accumulatorSeconds) < 1e-12);
});

test("fixed step planner caps excessive catch-up after suspension", () => {
  const plan = planFixedSteps(10, 0, SIMULATION_DT_SECONDS, MAX_ACCUMULATED_SECONDS);

  assert.equal(plan.consumedSeconds, MAX_ACCUMULATED_SECONDS);
  assert.equal(plan.steps, MAX_ACCUMULATED_SECONDS / SIMULATION_DT_SECONDS);
  assert.equal(plan.accumulatorSeconds, 0);
});

test("fixed step planner rejects invalid timing inputs", () => {
  assert.throws(() => planFixedSteps(-0.1, 0));
  assert.throws(() => planFixedSteps(0, -0.1));
  assert.throws(() => planFixedSteps(0, 0, 0));
});
