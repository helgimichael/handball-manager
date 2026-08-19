import assert from "node:assert/strict";
import test from "node:test";
import { distanceBetween } from "../../domain/geometry/coordinates";
import type { Player } from "../../domain/handball/player";
import type { HandballState } from "../../domain/handball/state";
import { createHalfCourt6v6State, initialHalfCourt6v6State } from "../../scenarios/halfCourt6v6";
import { step } from "../../simulation/engine";
import {
  SIX_ZERO_DEFENSE_FORMATION_ID,
  SIX_ZERO_DEFENSE_LIMITS,
  SIX_ZERO_GAP_RESPONSIBILITIES,
  createSixZeroDefensePolicy,
  evaluateSixZeroDefense,
  previewSixZeroDefense
} from "./sixZeroDefensePolicy";

const attackerId = "attack-attack-6-3";

function attackState(gapId: "V1_V2" | "V2_V3" | "V3_H3" | "H3_H2" | "H2_H1" = "V3_H3"): HandballState {
  return step(initialHalfCourt6v6State, { actions: [{ type: "ATTACK", playerId: attackerId, gapId }] }, 0);
}

function player(state: HandballState, playerId: string): Player {
  const found = state.players.find((candidate) => candidate.id === playerId);
  assert.ok(found);
  return found;
}

function homeDistance(state: HandballState, playerId: string): number {
  const defender = player(state, playerId);
  const home = state.defense.homePositions.find((position) => position.playerId === playerId);
  assert.ok(home);
  return distanceBetween(home.position, defender.intent.type === "MOVE" ? defender.intent.target : defender.position);
}

test("6:0 policy exposes explicit gap responsibility mapping", () => {
  assert.deepEqual(SIX_ZERO_GAP_RESPONSIBILITIES.V1_V2, ["L1", "L2"]);
  assert.deepEqual(SIX_ZERO_GAP_RESPONSIBILITIES.V2_V3, ["L2", "L3"]);
  assert.deepEqual(SIX_ZERO_GAP_RESPONSIBILITIES.V3_H3, ["L3", "R3"]);
  assert.deepEqual(SIX_ZERO_GAP_RESPONSIBILITIES.H3_H2, ["R3", "R2"]);
  assert.deepEqual(SIX_ZERO_GAP_RESPONSIBILITIES.H2_H1, ["R2", "R1"]);
});

test("active attack creates an explainable primary and support reaction", () => {
  const result = evaluateSixZeroDefense(attackState("V3_H3"));

  assert.equal(result.policy, "six-zero-defense");
  assert.equal(result.implemented, true);
  assert.equal(result.activeThreat?.type, "ACTIVE_ATTACK_THREAT");
  assert.equal(result.activeThreat?.type === "ACTIVE_ATTACK_THREAT" ? result.activeThreat.activeAttackGapId : null, "V3_H3");
  assert.ok(result.primaryDefenderId);
  assert.ok(result.supportDefenderIds.length > 0);
  assert.ok(result.responsibilities.some((responsibility) => responsibility.kind === "PRIMARY"));
  assert.ok(result.reactions.some((reaction) => reaction.reactionType === "ENGAGE"));
  assert.ok(result.reactions.some((reaction) => reaction.reactionType === "SUPPORT"));
  assert.ok(result.reactions.some((reaction) => reaction.reactionType === "SHIFT"));
});

test("engine applies policy reactions through existing MOVE intents", () => {
  const policy = createSixZeroDefensePolicy();
  const next = step(initialHalfCourt6v6State, { actions: [{ type: "ATTACK", playerId: attackerId, gapId: "V3_H3" }], defensivePolicy: policy.react }, 0);

  assert.equal(next.defense.lastReaction?.activeThreat?.type, "ACTIVE_ATTACK_THREAT");
  assert.ok(next.defense.lastReaction.primaryDefenderId);
  const primary = player(next, next.defense.lastReaction.primaryDefenderId);
  assert.equal(primary.intent.type, "MOVE");
});

test("primary engagement remains goal-side and within displacement limits", () => {
  const next = step(initialHalfCourt6v6State, { actions: [{ type: "ATTACK", playerId: attackerId, gapId: "V3_H3" }], defensivePolicy: evaluateSixZeroDefense }, 0);
  const reaction = next.defense.lastReaction;
  assert.ok(reaction?.activeThreat?.type === "ACTIVE_ATTACK_THREAT" && reaction.primaryDefenderId);
  const primaryReaction = reaction.reactions.find((candidate) => candidate.defenderId === reaction.primaryDefenderId);

  assert.ok(primaryReaction);
  assert.ok(primaryReaction.target.y < reaction.activeThreat.threatPosition.y);
  assert.ok(homeDistance(next, reaction.primaryDefenderId) <= SIX_ZERO_DEFENSE_LIMITS.primaryMaxDisplacementMeters + 1e-9);
});

test("support and far-side shifts stay below their policy limits", () => {
  const next = step(initialHalfCourt6v6State, { actions: [{ type: "ATTACK", playerId: attackerId, gapId: "V3_H3" }], defensivePolicy: evaluateSixZeroDefense }, 0);
  const reaction = next.defense.lastReaction;
  assert.ok(reaction);

  for (const supportId of reaction.supportDefenderIds) {
    assert.ok(homeDistance(next, supportId) <= SIX_ZERO_DEFENSE_LIMITS.supportMaxDisplacementMeters + 1e-9);
  }

  for (const shifted of reaction.reactions.filter((candidate) => candidate.reactionType === "SHIFT")) {
    assert.ok(homeDistance(next, shifted.defenderId) <= SIX_ZERO_DEFENSE_LIMITS.farSideShiftMaxDisplacementMeters + 1e-9);
  }
});

test("defenders recover to canonical home when no attack is active", () => {
  let state = step(initialHalfCourt6v6State, { actions: [{ type: "ATTACK", playerId: attackerId, gapId: "V3_H3" }], defensivePolicy: evaluateSixZeroDefense }, 0.2);
  const attackingPlayer = player(state, attackerId);
  state = {
    ...state,
    players: state.players.map((candidate) => (candidate.id === attackerId ? { ...attackingPlayer, intent: { type: "IDLE" as const } } : candidate))
  };
  const recovering = step(state, { defensivePolicy: evaluateSixZeroDefense }, 0);

  assert.equal(recovering.defense.lastReaction?.activeThreat?.type, "POSSESSION_THREAT");
  assert.ok(recovering.defense.lastReaction?.reactions.every((reaction) => reaction.reactionType === "RECOVER"));
  assert.ok(recovering.defense.lastReaction?.responsibilities.every((responsibility) => responsibility.kind === "RECOVER"));
});

test("policy result is deterministic", () => {
  const state = attackState("V2_V3");

  assert.deepEqual(evaluateSixZeroDefense(state), evaluateSixZeroDefense(state));
});

test("non-6:0 formations do not receive 6:0 reactions", () => {
  const state = createHalfCourt6v6State({ defenseFormationId: "defence-5-1" });
  const result = evaluateSixZeroDefense(state);

  assert.equal(result.implemented, false);
  assert.equal(result.primaryDefenderId, null);
  assert.deepEqual(result.reactions, []);
  assert.deepEqual(previewSixZeroDefense(state), []);
});

test("6:0 home positions preserve canonical formation id", () => {
  assert.equal(initialHalfCourt6v6State.defense.formationId, SIX_ZERO_DEFENSE_FORMATION_ID);
  assert.equal(initialHalfCourt6v6State.defense.homePositions.length, 6);
  assert.equal(initialHalfCourt6v6State.defense.homePositions[0].role, "L1");
  assert.equal(initialHalfCourt6v6State.defense.homePositions[5].role, "R1");
});
