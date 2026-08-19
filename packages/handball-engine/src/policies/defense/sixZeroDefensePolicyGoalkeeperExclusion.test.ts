import assert from "node:assert/strict";
import test from "node:test";
import type { HandballState } from "../../domain/handball/state";
import { initialHalfCourt6v6State, initialHalfCourt6v6WithGoalkeeperState } from "../../scenarios/halfCourt6v6";
import { step } from "../../simulation/engine";
import { evaluateSixZeroDefense } from "./sixZeroDefensePolicy";

// HM-0.4A: confirms adding a goalkeeper entity does not change the
// existing (unmodified) 6:0 policy's behavior in any way, and that the
// goalkeeper never enters its role/gap-responsibility selection. New
// file, so sixZeroDefensePolicy.test.ts and every other pre-existing
// policy test stays completely untouched.

const attackerId = "attack-attack-6-3";
const gapId = "V3_H3" as const;

function attackState(base: HandballState): HandballState {
  return step(base, { actions: [{ type: "ATTACK", playerId: attackerId, gapId }] }, 0);
}

test("goalkeeper never receives an L1/L2/L3/R3/R2/R1 assignment (8)", () => {
  const state = attackState(initialHalfCourt6v6WithGoalkeeperState);
  const reaction = evaluateSixZeroDefense(state);
  const goalkeeperId = "defense-defence-6-0-goalkeeper";

  assert.ok(!reaction.responsibilities.some((r) => r.defenderId === goalkeeperId));
  assert.notEqual(reaction.primaryDefenderId, goalkeeperId);
  assert.ok(!reaction.supportDefenderIds.includes(goalkeeperId));
});

test("goalkeeper never enters gap-responsibility selection or receives a reaction/MOVE action (9)", () => {
  const state = attackState(initialHalfCourt6v6WithGoalkeeperState);
  const reaction = evaluateSixZeroDefense(state);
  const goalkeeperId = "defense-defence-6-0-goalkeeper";

  assert.ok(!reaction.reactions.some((r) => r.defenderId === goalkeeperId));
  assert.ok(!reaction.actions.some((a) => a.playerId === goalkeeperId));
  // Exactly the six field defenders react -- the goalkeeper is neither
  // added as a seventh reaction nor silently swapped in for one.
  assert.equal(reaction.reactions.length, 6);
});

test("adding a goalkeeper does not change the reaction produced for the six existing field defenders (10, regression)", () => {
  const withoutGoalkeeper = evaluateSixZeroDefense(attackState(initialHalfCourt6v6State));
  const withGoalkeeper = evaluateSixZeroDefense(attackState(initialHalfCourt6v6WithGoalkeeperState));

  assert.equal(withGoalkeeper.primaryDefenderId, withoutGoalkeeper.primaryDefenderId);
  assert.deepEqual([...withGoalkeeper.supportDefenderIds].sort(), [...withoutGoalkeeper.supportDefenderIds].sort());
  assert.deepEqual(
    withGoalkeeper.reactions.map((r) => ({ defenderId: r.defenderId, reactionType: r.reactionType, target: r.target })),
    withoutGoalkeeper.reactions.map((r) => ({ defenderId: r.defenderId, reactionType: r.reactionType, target: r.target })),
  );
});

test("goalkeeper's own position is completely unaffected by 6:0 reaction application", () => {
  const before = initialHalfCourt6v6WithGoalkeeperState.players.find((p) => p.kind === "GOALKEEPER")!;
  const after = attackState(initialHalfCourt6v6WithGoalkeeperState).players.find((p) => p.kind === "GOALKEEPER")!;
  assert.deepEqual(after.position, before.position);
  assert.deepEqual(after.intent, { type: "IDLE" });
});
