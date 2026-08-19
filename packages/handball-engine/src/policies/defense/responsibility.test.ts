import assert from "node:assert/strict";
import test from "node:test";
import type { DefenseRole, Player } from "../../domain/handball/player";
import type { HandballState } from "../../domain/handball/state";
import { initialHalfCourt6v6State } from "../../scenarios/halfCourt6v6";
import { step } from "../../simulation/engine";
import { observeDefensiveThreat } from "./threat";
import {
  RESPONSIBILITY_TRANSFER_THRESHOLD_METERS,
  SIX_ZERO_GAP_RESPONSIBILITIES,
  resolveSixZeroResponsibility,
  type SixZeroDefender
} from "./responsibility";
import { evaluateSixZeroDefense } from "./sixZeroDefensePolicy";

const attackerId = "attack-attack-6-3";

function defenders(state: HandballState): readonly SixZeroDefender[] {
  return state.players.filter((player): player is SixZeroDefender => player.team === "DEFENSE");
}

function rolePlayer(state: HandballState, role: DefenseRole): Player {
  const found = state.players.find((player) => player.role === role);
  assert.ok(found);
  return found;
}

function attackState(gapId: keyof typeof SIX_ZERO_GAP_RESPONSIBILITIES, position: { x: number; y: number }): HandballState {
  const attacking = step(initialHalfCourt6v6State, { actions: [{ type: "ATTACK", playerId: attackerId, gapId }] }, 0);
  return {
    ...attacking,
    players: attacking.players.map((player) => (player.id === attackerId ? { ...player, position: { ...position } } : player)),
    ball: { ...attacking.ball, position: { ...position } }
  };
}

function primaryRole(state: HandballState): DefenseRole | null {
  const result = resolveSixZeroResponsibility(state, defenders(state), observeDefensiveThreat(state));
  return result.primary?.role ?? null;
}

test("structural five-gap adjacency remains canonical", () => {
  assert.deepEqual(SIX_ZERO_GAP_RESPONSIBILITIES.V1_V2, ["L1", "L2"]);
  assert.deepEqual(SIX_ZERO_GAP_RESPONSIBILITIES.V2_V3, ["L2", "L3"]);
  assert.deepEqual(SIX_ZERO_GAP_RESPONSIBILITIES.V3_H3, ["L3", "R3"]);
  assert.deepEqual(SIX_ZERO_GAP_RESPONSIBILITIES.H3_H2, ["R3", "R2"]);
  assert.deepEqual(SIX_ZERO_GAP_RESPONSIBILITIES.H2_H1, ["R2", "R1"]);
});

test("primary is chosen from structurally eligible defenders", () => {
  const state = attackState("H2_H1", { x: 17.8, y: 6.4 });
  const primary = primaryRole(state);

  assert.ok(primary === "R2" || primary === "R1");
});

test("primary uses current threat position instead of attack target only", () => {
  assert.equal(primaryRole(attackState("H2_H1", { x: 11.4, y: 6.8 })), "R3");
});

test("primary resolution is deterministic", () => {
  const state = attackState("V2_V3", { x: 7.4, y: 6.8 });

  assert.deepEqual(resolveSixZeroResponsibility(state, defenders(state), observeDefensiveThreat(state)), resolveSixZeroResponsibility(state, defenders(state), observeDefensiveThreat(state)));
});

test("central V3/H3 resolves either central defender from current side", () => {
  assert.equal(primaryRole(attackState("V3_H3", { x: 8.7, y: 6.9 })), "L3");
  assert.equal(primaryRole(attackState("V3_H3", { x: 11.4, y: 6.9 })), "R3");
});

test("direct support derives from defender adjacency", () => {
  const state = attackState("V3_H3", { x: 11.4, y: 6.9 });
  const result = resolveSixZeroResponsibility(state, defenders(state), observeDefensiveThreat(state));

  assert.equal(result.primary?.role, "R3");
  assert.deepEqual(result.directSupportRoles, ["L3", "R2"]);
});

test("far-side defenders do not become primary without spatial justification", () => {
  assert.notEqual(primaryRole(attackState("H2_H1", { x: 18.2, y: 5.7 })), "L1");
});

test("responsibility can transfer as attacker position changes", () => {
  const start = attackState("H2_H1", { x: 18.0, y: 5.7 });
  const later = {
    ...attackState("H2_H1", { x: 11.3, y: 6.8 }),
    defense: {
      ...start.defense,
      lastReaction: evaluateSixZeroDefense(start)
    }
  };

  assert.equal(primaryRole(start), "R2");
  assert.equal(primaryRole(later), "R3");
});

test("hysteresis prevents trivial primary flipping", () => {
  const previous = attackState("V3_H3", { x: 10.08, y: 6.9 });
  const withPrevious = {
    ...attackState("V3_H3", { x: 10.12, y: 6.9 }),
    defense: {
      ...previous.defense,
      lastReaction: {
        ...evaluateSixZeroDefense(previous),
        primaryDefenderId: rolePlayer(previous, "L3").id
      }
    }
  };

  assert.ok(RESPONSIBILITY_TRANSFER_THRESHOLD_METERS > 0);
  assert.equal(primaryRole(withPrevious), "L3");
});

test("previous primary becomes support or recovery after transfer", () => {
  const start = attackState("H2_H1", { x: 18.0, y: 5.7 });
  const startPrimary = rolePlayer(start, primaryRole(start) ?? "R1");
  const later = {
    ...attackState("H2_H1", { x: 11.3, y: 6.8 }),
    defense: {
      ...start.defense,
      lastReaction: evaluateSixZeroDefense(start)
    }
  };
  const resolved = resolveSixZeroResponsibility(later, defenders(later), observeDefensiveThreat(later));
  const previousPrimaryResponsibility = resolved.responsibilities.find((item) => item.defenderId === startPrimary.id);

  assert.ok(previousPrimaryResponsibility);
  assert.notEqual(previousPrimaryResponsibility.kind, "PRIMARY");
});
