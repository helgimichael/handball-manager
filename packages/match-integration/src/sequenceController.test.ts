import { test } from "node:test";
import assert from "node:assert/strict";
import { initialHalfCourt6v6State } from "@handball-manager/handball-engine/src/scenarios/halfCourt6v6.ts";
import {
  createSimulationRuntime,
  executeRuntimeCommand,
  runSimulationTick,
  type SimulationRuntimeState,
} from "@handball-manager/handball-engine/src/ui/simulationRuntime.ts";
import { evaluateSixZeroDefense } from "@handball-manager/handball-engine/src/policies/defense/sixZeroDefensePolicy.ts";
import { SIMULATION_DT_SECONDS } from "@handball-manager/handball-engine/src/simulation/fixedStep.ts";
import type { HandballState } from "@handball-manager/handball-engine/src/domain/handball/state.ts";
import { createMatchSequence, advanceMatchSequence, type MatchSequenceState } from "./sequenceController";
import { toMatchRenderSnapshot } from "./simAdapter";
import { snapshotToBoardObjects } from "./fieldAdapter";

// Exactly the HM-0.3 demo sequence: CENTER_BACK (has the ball in the
// canonical scenario) passes to PIVOT, who attacks the central V3_H3
// gap -- the gap whose SIX_ZERO_GAP_RESPONSIBILITIES are L3/R3, the two
// defenders whose home positions straddle the pivot's own position, per
// the HM-0.3 report's Section 2 trace.
const PASSER_ID = "attack-attack-6-3"; // CENTER_BACK
const RECEIVER_ID = "attack-attack-6-6"; // PIVOT
const GAP_ID = "V3_H3";

/**
 * Drives the exact loop match-demo's "RUN SEQUENCE" uses: each tick,
 * ask the sequence controller for the next command (if any), dispatch
 * it through the real runtime (dt=0, same as the existing manual PASS
 * button), then advance the real fixed-step tick. Returns every
 * intermediate runtime/sequence pair so tests can inspect the whole
 * trajectory, not just the end state.
 */
function runSequence(maxTicks: number): Array<{ runtime: SimulationRuntimeState; sequence: MatchSequenceState }> {
  let runtime = createSimulationRuntime(initialHalfCourt6v6State);
  let sequence = createMatchSequence({ passerId: PASSER_ID, receiverId: RECEIVER_ID, attackGapId: GAP_ID });
  const trace: Array<{ runtime: SimulationRuntimeState; sequence: MatchSequenceState }> = [
    { runtime, sequence },
  ];

  for (let i = 0; i < maxTicks; i += 1) {
    const decision = advanceMatchSequence(sequence, runtime.world);
    sequence = decision.sequence;
    if (decision.command) {
      runtime = executeRuntimeCommand(runtime, decision.command, evaluateSixZeroDefense, 0, decision.command.type).runtime;
    }
    runtime = runSimulationTick(runtime, SIMULATION_DT_SECONDS, evaluateSixZeroDefense).runtime;
    trace.push({ runtime, sequence });
  }

  return trace;
}

test("sequence begins from the expected canonical state (1, 2)", () => {
  const trace = runSequence(0);
  const initial = trace[0].runtime.world;
  assert.equal(initial, initialHalfCourt6v6State);
  assert.equal(initial.ball.status, "POSSESSED");
  assert.equal(initial.ball.possessorId, PASSER_ID);
});

test("PASS command uses the existing SIM PASS action and puts the ball IN_FLIGHT (3, 4)", () => {
  const trace = runSequence(1);
  const afterFirstTick = trace[1];
  assert.equal(afterFirstTick.sequence.phase, "PASS_ISSUED");
  assert.equal(afterFirstTick.runtime.world.ball.status, "IN_FLIGHT");
  assert.equal(afterFirstTick.runtime.world.ball.possessorId, null);
  assert.equal(afterFirstTick.runtime.world.ball.flight?.passerId, PASSER_ID);
  assert.equal(afterFirstTick.runtime.world.ball.flight?.receiverId, RECEIVER_ID);
});

test("intended receiver gains possession after the pass flight completes (5)", () => {
  const trace = runSequence(30);
  const receptionTick = trace.find((entry) => entry.sequence.phase === "AWAITING_ATTACK" || entry.sequence.phase === "ATTACK_ISSUED");
  assert.ok(receptionTick, "expected the sequence to reach AWAITING_ATTACK/ATTACK_ISSUED within 30 ticks");
  assert.equal(receptionTick!.runtime.world.ball.status, "POSSESSED");
  assert.equal(receptionTick!.runtime.world.ball.possessorId, RECEIVER_ID);
});

test("ATTACK uses a valid existing gap and the attacker's intent reflects it (6, 7)", () => {
  const trace = runSequence(30);
  const attackIssuedTick = trace.find((entry) => entry.sequence.phase === "ATTACK_ISSUED");
  assert.ok(attackIssuedTick, "expected the sequence to issue ATTACK within 30 ticks");
  const attacker = attackIssuedTick!.runtime.world.players.find((p) => p.id === RECEIVER_ID);
  assert.ok(attacker);
  assert.equal(attacker!.intent.type, "ATTACK");
  if (attacker!.intent.type === "ATTACK") {
    assert.equal(attacker!.intent.gapId, GAP_ID);
  }
});

test("existing 6:0 policy is evaluated and produces a defensive reaction once ATTACK is active (8, 9)", () => {
  const trace = runSequence(30);
  const attackTicks = trace.filter((entry) => entry.sequence.phase === "ATTACK_ISSUED");
  assert.ok(attackTicks.length > 0);
  const reaction = attackTicks[0].runtime.world.defense.lastReaction;
  assert.ok(reaction, "expected defense.lastReaction to be populated");
  assert.equal(reaction!.policy, "six-zero-defense");
  assert.equal(reaction!.implemented, true);
  assert.equal(reaction!.activeThreat?.type, "ACTIVE_ATTACK_THREAT");
  assert.ok(reaction!.reactions.length > 0, "expected at least one defender reaction");
});

test("at least one reacting defender actually moves via SIM's own movement, not a scripted coordinate (10)", () => {
  const trace = runSequence(30);
  const initialDefenders = new Map(
    trace[0].runtime.world.players.filter((p) => p.team === "DEFENSE").map((p) => [p.id, p.position]),
  );
  const lastTick = trace[trace.length - 1];
  const moved = lastTick.runtime.world.players.filter((p) => {
    if (p.team !== "DEFENSE") {
      return false;
    }
    const initial = initialDefenders.get(p.id)!;
    return Math.abs(p.position.x - initial.x) > 1e-6 || Math.abs(p.position.y - initial.y) > 1e-6;
  });
  assert.ok(moved.length > 0, "expected at least one defender to have moved from its home position");
});

test("MatchRenderSnapshot reflects both attacker and defender movement, and fieldAdapter passes it through without inventing movement (11, 12, 13)", () => {
  const trace = runSequence(30);
  const initialSnapshot = toMatchRenderSnapshot(trace[0].runtime.world);
  const lastTick = trace[trace.length - 1];
  const finalSnapshot = toMatchRenderSnapshot(lastTick.runtime.world);

  const initialAttacker = initialSnapshot.players.find((p) => p.id === RECEIVER_ID)!;
  const finalAttacker = finalSnapshot.players.find((p) => p.id === RECEIVER_ID)!;
  assert.ok(
    Math.abs(finalAttacker.x - initialAttacker.x) > 1e-6 || Math.abs(finalAttacker.y - initialAttacker.y) > 1e-6,
    "expected the attacker's snapshot position to have moved",
  );

  const movedDefenderId = lastTick.runtime.world.players.find((p) => {
    if (p.team !== "DEFENSE") return false;
    const initial = trace[0].runtime.world.players.find((q) => q.id === p.id)!;
    return Math.abs(p.position.x - initial.position.x) > 1e-6 || Math.abs(p.position.y - initial.position.y) > 1e-6;
  })!.id;

  const objects = snapshotToBoardObjects(finalSnapshot);
  const boardDefender = objects.find((o) => o.id === movedDefenderId)!;
  const snapshotDefender = finalSnapshot.players.find((p) => p.id === movedDefenderId)!;
  // The renderer adapter must carry the SAME position the adapter
  // already computed from SIM -- it must not recompute or nudge it.
  assert.equal(boardDefender.position.x, snapshotDefender.x);
  assert.equal(boardDefender.position.y, snapshotDefender.y);
});

test("no goalkeeper is created anywhere in the sequence (15)", () => {
  const trace = runSequence(30);
  for (const entry of trace) {
    for (const player of entry.runtime.world.players) {
      // SIM's own PlayerRole union has no goalkeeper case -- this
      // assertion documents that invariant explicitly for the sequence,
      // not just the static roster.
      assert.notEqual(player.role, "GOALKEEPER");
    }
    const snapshot = toMatchRenderSnapshot(entry.runtime.world);
    assert.ok(snapshot.players.every((p) => p.kind !== "GOALKEEPER"));
    assert.ok(snapshotToBoardObjects(snapshot).every((o) => o.type !== "GOALKEEPER"));
  }
});

test("re-creating a fresh runtime and sequence reproduces the exact canonical starting state (14, RESET equivalent)", () => {
  const first = runSequence(0)[0];
  const second = runSequence(0)[0];
  assert.deepEqual(
    JSON.parse(JSON.stringify(first.runtime.world)),
    JSON.parse(JSON.stringify(second.runtime.world)),
  );
  assert.equal(second.sequence.phase, "AWAITING_PASS");
});

test("orchestration never directly mutates player coordinates -- advanceMatchSequence never writes to state (16)", () => {
  const state: HandballState = initialHalfCourt6v6State;
  const before = JSON.parse(JSON.stringify(state));
  const sequence = createMatchSequence({ passerId: PASSER_ID, receiverId: RECEIVER_ID, attackGapId: GAP_ID });
  advanceMatchSequence(sequence, state);
  const after = JSON.parse(JSON.stringify(state));
  assert.deepEqual(after, before);
});
