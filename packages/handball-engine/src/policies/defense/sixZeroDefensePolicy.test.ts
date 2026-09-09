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
  // M7: the whole line slides toward the ball (result.lineShift), so the
  // limits are measured from each defender's SHIFTED home -- the line he is
  // actually holding -- rather than the canonical spot. The limits themselves
  // are unchanged.
  const next = step(initialHalfCourt6v6State, { actions: [{ type: "ATTACK", playerId: attackerId, gapId: "V3_H3" }], defensivePolicy: evaluateSixZeroDefense }, 0);
  const reaction = next.defense.lastReaction;
  assert.ok(reaction);
  assert.notEqual(reaction.lineShift, 0, "the line has slid toward the ball");
  const shiftedHomeDistance = (playerId: string) => {
    const defender = player(next, playerId);
    const lineHome = reaction.lineHomes.find((h) => h.defenderId === playerId);
    assert.ok(lineHome);
    return distanceBetween(lineHome.position, defender.intent.type === "MOVE" ? defender.intent.target : defender.position);
  };

  for (const supportId of reaction.supportDefenderIds) {
    assert.ok(shiftedHomeDistance(supportId) <= SIX_ZERO_DEFENSE_LIMITS.supportMaxDisplacementMeters + 1e-9);
  }

  for (const shifted of reaction.reactions.filter((candidate) => candidate.reactionType === "SHIFT")) {
    assert.ok(shiftedHomeDistance(shifted.defenderId) <= SIX_ZERO_DEFENSE_LIMITS.farSideShiftMaxDisplacementMeters + 1e-9);
  }
});

test("defenders recover toward the line when no attack is active", () => {
  // M7: with the ball held but nobody driving, the line is not six players
  // walking home -- one presses the ball, one marks the pivot, the rest
  // recover to the shifted line. What must NOT happen is a step-out.
  let state = step(initialHalfCourt6v6State, { actions: [{ type: "ATTACK", playerId: attackerId, gapId: "V3_H3" }], defensivePolicy: evaluateSixZeroDefense }, 0.2);
  const attackingPlayer = player(state, attackerId);
  state = {
    ...state,
    players: state.players.map((candidate) => (candidate.id === attackerId ? { ...attackingPlayer, intent: { type: "IDLE" as const } } : candidate))
  };
  const recovering = step(state, { defensivePolicy: evaluateSixZeroDefense }, 0);

  const reaction = recovering.defense.lastReaction;
  assert.equal(reaction?.activeThreat?.type, "POSSESSION_THREAT");
  assert.equal(reaction?.primaryDefenderId, null);
  assert.ok(reaction?.reactions.every((r) => r.reactionType === "RECOVER" || r.reactionType === "PRESS" || r.reactionType === "MARK_PIVOT"));
  assert.ok(reaction?.reactions.some((r) => r.reactionType === "RECOVER"), "the line recovers");
  assert.ok(reaction?.responsibilities.every((responsibility) => responsibility.kind === "RECOVER" || responsibility.kind === "PIVOT"));
});

test("policy result is deterministic", () => {
  const state = attackState("V2_V3");

  assert.deepEqual(evaluateSixZeroDefense(state), evaluateSixZeroDefense(state));
});

test("a formation the engine does not implement receives no reactions", () => {
  // Re-pinned for M23. This used "defence-5-1" as its example of a formation
  // the engine does not know, and M23 makes it one the engine does know. The
  // assertion is unchanged and still worth having -- a defence the collective
  // layer cannot run must produce nothing rather than a 6:0 by accident -- so
  // it now names a formation that genuinely is not implemented.
  const state = createHalfCourt6v6State({ defenseFormationId: "defence-3-2-1" });
  const result = evaluateSixZeroDefense(state);

  assert.equal(result.implemented, false);
  assert.equal(result.primaryDefenderId, null);
  assert.deepEqual(result.reactions, []);
  assert.deepEqual(previewSixZeroDefense(state), []);
});

test("the 5:1 IS implemented, and produces a man in front", () => {
  const state = createHalfCourt6v6State({ defenseFormationId: "defence-5-1" });
  const result = evaluateSixZeroDefense(state);
  assert.equal(result.implemented, true, "M23 runs the 5:1 through the same collective layer");
  assert.equal(result.reactions.length, 6);
  assert.ok(
    result.reactions.some((r) => r.reactionType === "FRONT"),
    "and exactly the 5:1 produces a FRONT reaction",
  );
});

test("6:0 home positions preserve canonical formation id", () => {
  assert.equal(initialHalfCourt6v6State.defense.formationId, SIX_ZERO_DEFENSE_FORMATION_ID);
  assert.equal(initialHalfCourt6v6State.defense.homePositions.length, 6);
  assert.equal(initialHalfCourt6v6State.defense.homePositions[0].role, "L1");
  assert.equal(initialHalfCourt6v6State.defense.homePositions[5].role, "R1");
});
