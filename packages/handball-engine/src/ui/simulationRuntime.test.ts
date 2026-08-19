import assert from "node:assert/strict";
import test from "node:test";
import { getAttackGap } from "../domain/geometry/attackGaps";
import { evaluateSixZeroDefense } from "../policies/defense/sixZeroDefensePolicy";
import { initialHalfCourt6v6State } from "../scenarios/halfCourt6v6";
import { SIMULATION_DT_SECONDS } from "../simulation/fixedStep";
import { getPlannedActionExecution, type PlannedAction } from "./plannedSequence";
import {
  createSimulationRuntime,
  executeRuntimeCommand,
  pauseRuntimeSequence,
  runSimulationTick,
  setRuntimePlannedActions,
  startRuntimeSequence,
  type SimulationRuntimeState
} from "./simulationRuntime";

const m9 = "attack-attack-6-3";
const h9 = "attack-attack-6-4";
const h6 = "attack-attack-6-5";

function passM9H9(): PlannedAction {
  return { id: "p1", type: "PASS", actorId: m9, receiverId: h9, label: "M9 PASS -> H9" };
}

function passH9H6(): PlannedAction {
  return { id: "p2", type: "PASS", actorId: h9, receiverId: h6, label: "H9 PASS -> H6" };
}

function attackH9(): PlannedAction {
  const gap = getAttackGap("H2_H1");
  assert.ok(gap);
  return { id: "a1", type: "ATTACK", actorId: h9, gapId: "H2_H1", target: gap.position, label: "H9 ATTACK -> H2/H1" };
}

function runtimeWithPlan(plannedActions: readonly PlannedAction[]): SimulationRuntimeState {
  return startRuntimeSequence(setRuntimePlannedActions(createSimulationRuntime(initialHalfCourt6v6State), plannedActions));
}

function actionStatus(runtime: SimulationRuntimeState, action: PlannedAction): string | null {
  return getPlannedActionExecution(runtime.sequence, action.id)?.status ?? null;
}

test("runtime dispatches planned PASS through the shared tick host", () => {
  const pass = passM9H9();
  const result = runSimulationTick(runtimeWithPlan([pass]), 0, evaluateSixZeroDefense);

  assert.equal(result.runtime.world.ball.status, "IN_FLIGHT");
  assert.equal(result.runtime.world.ball.flight?.passerId, m9);
  assert.equal(result.runtime.world.ball.flight?.receiverId, h9);
  assert.equal(actionStatus(result.runtime, pass), "ACTIVE");
  assert.deepEqual(result.events.map((event) => event.label), ["M9 PASS -> H9"]);
});

test("runtime hands planned PASS reception to ATTACK without React refs", () => {
  const pass = passM9H9();
  const attack = attackH9();
  let runtime = runtimeWithPlan([pass, attack]);
  let dispatchedLabels: string[] = [];

  for (let i = 0; i < 300 && runtime.sequence.status === "RUNNING"; i += 1) {
    const result = runSimulationTick(runtime, SIMULATION_DT_SECONDS, evaluateSixZeroDefense);
    runtime = result.runtime;
    dispatchedLabels = dispatchedLabels.concat(result.events.map((event) => event.label));
  }

  const attacker = runtime.world.players.find((player) => player.id === h9);
  const threat = runtime.world.defense.lastReaction?.activeThreat;

  assert.equal(runtime.sequence.status, "COMPLETE");
  assert.equal(actionStatus(runtime, pass), "COMPLETE");
  assert.equal(actionStatus(runtime, attack), "COMPLETE");
  assert.deepEqual(dispatchedLabels, ["M9 PASS -> H9", "H9 ATTACK -> H2/H1"]);
  assert.equal(attacker?.intent.type, "IDLE");
  assert.deepEqual(attacker?.position, getAttackGap("H2_H1")?.position);
  assert.equal(threat?.type, "ACTIVE_ATTACK_THREAT");
  assert.equal(threat?.type === "ACTIVE_ATTACK_THREAT" ? threat.ballCarrierId : null, h9);
});

test("runtime validates planned PASS to PASS against post-reception possessor", () => {
  const firstPass = passM9H9();
  const secondPass = passH9H6();
  let runtime = runtimeWithPlan([firstPass, secondPass]);
  const dispatchedLabels: string[] = [];

  for (let i = 0; i < 120 && dispatchedLabels.length < 2; i += 1) {
    const result = runSimulationTick(runtime, SIMULATION_DT_SECONDS, null);
    runtime = result.runtime;
    dispatchedLabels.push(...result.events.map((event) => event.label));
  }

  assert.deepEqual(dispatchedLabels, ["M9 PASS -> H9", "H9 PASS -> H6"]);
  assert.equal(actionStatus(runtime, firstPass), "COMPLETE");
  assert.equal(actionStatus(runtime, secondPass), "ACTIVE");
  assert.equal(runtime.world.ball.status, "IN_FLIGHT");
  assert.equal(runtime.world.ball.flight?.receiverId, h6);
});

test("paused runtime does not advance planned semantics until restarted", () => {
  const pass = passM9H9();
  const started = runSimulationTick(runtimeWithPlan([pass]), 0, null).runtime;
  const paused = pauseRuntimeSequence(started);
  const pausedTick = runSimulationTick(paused, SIMULATION_DT_SECONDS, null);

  assert.equal(pausedTick.runtime.world.simulationTime, started.world.simulationTime);
  assert.equal(pausedTick.runtime.world.ball.flight?.elapsedSeconds, started.world.ball.flight?.elapsedSeconds);
  assert.equal(pausedTick.runtime.sequence.status, "PAUSED");
  assert.deepEqual(pausedTick.events, []);

  const resumed = runSimulationTick(startRuntimeSequence(pausedTick.runtime), SIMULATION_DT_SECONDS, null);

  assert.equal(resumed.runtime.sequence.status, "RUNNING");
  assert.equal(resumed.runtime.world.ball.flight?.elapsedSeconds, SIMULATION_DT_SECONDS);
  assert.deepEqual(resumed.events, []);
});

test("manual command execution and idle stepping also use runtime host events", () => {
  let runtime = createSimulationRuntime(initialHalfCourt6v6State);
  const manual = executeRuntimeCommand(runtime, { type: "PASS", fromPlayerId: m9, toPlayerId: h9 }, null, 0, "M9 PASS -> H9");
  runtime = manual.runtime;

  assert.equal(runtime.world.ball.status, "IN_FLIGHT");
  assert.deepEqual(manual.events.map((event) => event.label), ["M9 PASS -> H9"]);

  const progressed = runSimulationTick(runtime, SIMULATION_DT_SECONDS, null, { recordIdleStep: true });
  const idleStep = runSimulationTick(createSimulationRuntime(initialHalfCourt6v6State), SIMULATION_DT_SECONDS, null, { recordIdleStep: true });

  assert.equal(progressed.events.length, 0);
  assert.equal(progressed.runtime.world.ball.flight?.elapsedSeconds, SIMULATION_DT_SECONDS);
  assert.deepEqual(idleStep.events.map((event) => event.label), [`STEP +${SIMULATION_DT_SECONDS.toFixed(2)}s`]);
});
