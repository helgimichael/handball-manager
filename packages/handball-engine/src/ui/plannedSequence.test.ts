import assert from "node:assert/strict";
import test from "node:test";
import { getAttackGap } from "../domain/geometry/attackGaps";
import { evaluateSixZeroDefense } from "../policies/defense/sixZeroDefensePolicy";
import { initialHalfCourt6v6State } from "../scenarios/halfCourt6v6";
import { step } from "../simulation/engine";
import { SIMULATION_DT_SECONDS } from "../simulation/fixedStep";
import {
  EMPTY_PLANNED_EXECUTION,
  advancePlannedExecutionStep,
  canPlanActionForActor,
  clearPlannedActions,
  createPlannedExecution,
  getPlannedActionExecution,
  pausePlannedExecution,
  plannedActionComplete,
  plannedActionReady,
  plannedActionToCommand,
  projectPlannedActions,
  startPlannedExecution,
  undoLastPlannedAction,
  validatePlannedActionForExecution,
  type PlannedAction,
  type PlannedActionLifecycleStatus,
  type PlannedExecutionState
} from "./plannedSequence";

const m9 = "attack-attack-6-3";
const h9 = "attack-attack-6-4";
const h6 = "attack-attack-6-5";

function passM9H9(): PlannedAction {
  return { id: "p1", type: "PASS", actorId: m9, receiverId: h9, label: "M9 PASS -> H9" };
}

function attackH9(): PlannedAction {
  const gap = getAttackGap("H2_H1");
  assert.ok(gap);
  return { id: "a1", type: "ATTACK", actorId: h9, gapId: "H2_H1", target: gap.position, label: "H9 ATTACK -> H2/H1" };
}

function moveM9(): PlannedAction {
  return { id: "m1", type: "MOVE", actorId: m9, target: { x: 10, y: 9.2 }, label: "M9 MOVE PRESS 9M" };
}

function runningExecution(plannedActions: readonly PlannedAction[]): PlannedExecutionState {
  return createPlannedExecution(plannedActions, "RUNNING");
}

function actionStatus(execution: PlannedExecutionState, action: PlannedAction): PlannedActionLifecycleStatus | null {
  return getPlannedActionExecution(execution, action.id)?.status ?? null;
}

function activeActionIds(execution: PlannedExecutionState): string[] {
  return execution.actions.filter((actionExecution) => actionExecution.status === "ACTIVE").map((actionExecution) => actionExecution.actionId);
}

function actionStarted(execution: PlannedExecutionState, action: PlannedAction): boolean {
  return getPlannedActionExecution(execution, action.id)?.started ?? false;
}

function actionDispatched(execution: PlannedExecutionState, action: PlannedAction): boolean {
  return getPlannedActionExecution(execution, action.id)?.dispatched ?? false;
}

function runScheduler(
  state: typeof initialHalfCourt6v6State,
  plannedActions: readonly PlannedAction[],
  execution: PlannedExecutionState,
  dt: number,
  dispatched: PlannedAction[] = []
) {
  return advancePlannedExecutionStep({
    state,
    plannedActions,
    execution,
    dt,
    runCommand: (current, action) => {
      dispatched.push(action);
      return step(current, { actions: [plannedActionToCommand(action)] }, 0);
    },
    advanceWorld: (current, seconds) => step(current, {}, seconds)
  });
}

function runSchedulerWithDefense(
  state: typeof initialHalfCourt6v6State,
  plannedActions: readonly PlannedAction[],
  execution: PlannedExecutionState,
  dt: number,
  dispatched: PlannedAction[] = []
) {
  return advancePlannedExecutionStep({
    state,
    plannedActions,
    execution,
    dt,
    runCommand: (current, action) => {
      dispatched.push(action);
      return step(current, { actions: [plannedActionToCommand(action)], defensivePolicy: evaluateSixZeroDefense }, 0);
    },
    advanceWorld: (current, seconds) => step(current, { defensivePolicy: evaluateSixZeroDefense }, seconds)
  });
}

test("current possessor initializes projected possessor", () => {
  assert.deepEqual(projectPlannedActions(initialHalfCourt6v6State, [], m9), { projectedPossessorId: m9, plannedActorId: m9 });
});

test("queued PASS projects possession to receiver", () => {
  assert.deepEqual(projectPlannedActions(initialHalfCourt6v6State, [passM9H9()], m9), { projectedPossessorId: h9, plannedActorId: h9 });
});

test("receiver can queue ATTACK despite not possessing real ball yet", () => {
  const plan = [passM9H9()];

  assert.equal(initialHalfCourt6v6State.ball.possessorId, m9);
  assert.equal(canPlanActionForActor(initialHalfCourt6v6State, plan, h9, "ATTACK"), true);
});

test("receiver can queue another PASS after projected reception", () => {
  const plan = [passM9H9()];

  assert.equal(canPlanActionForActor(initialHalfCourt6v6State, plan, h9, "PASS"), true);
});

test("ATTACK does not change projected possessor", () => {
  const plan = [passM9H9(), attackH9()];

  assert.equal(projectPlannedActions(initialHalfCourt6v6State, plan, m9).projectedPossessorId, h9);
});

test("undo recomputes projected possessor", () => {
  const plan = undoLastPlannedAction([passM9H9(), attackH9()]);

  assert.deepEqual(projectPlannedActions(initialHalfCourt6v6State, plan, m9), { projectedPossessorId: h9, plannedActorId: h9 });
});

test("clear resets projection to real state", () => {
  assert.deepEqual(projectPlannedActions(initialHalfCourt6v6State, clearPlannedActions(), m9), { projectedPossessorId: m9, plannedActorId: m9 });
});

test("planning does not mutate handball state", () => {
  const before = JSON.stringify(initialHalfCourt6v6State);
  projectPlannedActions(initialHalfCourt6v6State, [passM9H9(), attackH9()], m9);

  assert.equal(JSON.stringify(initialHalfCourt6v6State), before);
});

test("same plan gives deterministic projection", () => {
  const plan = [passM9H9(), attackH9()];

  assert.deepEqual(projectPlannedActions(initialHalfCourt6v6State, plan, m9), projectPlannedActions(initialHalfCourt6v6State, plan, m9));
});

test("planned PASS then ATTACK commands execute in deterministic order", () => {
  const pass = passM9H9();
  const attack = attackH9();
  let state = initialHalfCourt6v6State;

  assert.equal(plannedActionReady(state, pass).ready, true);
  state = step(state, { actions: [plannedActionToCommand(pass)] }, 0);
  assert.equal(plannedActionReady(state, attack).ready, false);
  assert.equal(plannedActionComplete(state, pass), false);

  assert.ok(state.ball.flight);
  state = step(state, {}, state.ball.flight.durationSeconds);
  assert.equal(plannedActionComplete(state, pass), true);
  assert.equal(plannedActionReady(state, attack).ready, true);

  state = step(state, { actions: [plannedActionToCommand(attack)] }, 0);
  const receiver = state.players.find((player) => player.id === h9);
  assert.equal(receiver?.intent.type, "ATTACK");
  assert.deepEqual(receiver?.intent.type === "ATTACK" ? receiver.intent.target : null, getAttackGap("H2_H1")?.position);
});

test("planned PASS to PASS chains through projected and real possession", () => {
  const first = passM9H9();
  const second: PlannedAction = { id: "p2", type: "PASS", actorId: h9, receiverId: h6, label: "H9 PASS -> H6" };
  const plan = [first, second];

  assert.equal(projectPlannedActions(initialHalfCourt6v6State, plan, m9).projectedPossessorId, h6);

  let state = step(initialHalfCourt6v6State, { actions: [plannedActionToCommand(first)] }, 0);
  assert.ok(state.ball.flight);
  state = step(state, {}, state.ball.flight.durationSeconds);
  assert.equal(plannedActionReady(state, second).ready, true);
  state = step(state, { actions: [plannedActionToCommand(second)] }, 0);
  assert.equal(state.ball.status, "IN_FLIGHT");
  assert.equal(state.ball.flight?.receiverId, h6);
});

test("execution precondition failure reports blocked readiness", () => {
  const action = attackH9();
  const readiness = plannedActionReady(initialHalfCourt6v6State, action);

  assert.equal(readiness.ready, false);
  assert.ok(readiness.reason?.includes("requires"));
});

test("planned scheduler starts action 0 immediately on RUNNING execution", () => {
  const plan = [passM9H9(), attackH9()];
  const initialExecution = createPlannedExecution(plan);

  assert.equal(actionStatus(initialExecution, plan[0]), "PENDING");
  assert.equal(actionStatus(initialExecution, plan[1]), "PENDING");

  const dispatched: PlannedAction[] = [];
  const result = runScheduler(initialHalfCourt6v6State, plan, runningExecution(plan), 0, dispatched);

  assert.deepEqual(dispatched.map((action) => action.type), ["PASS"]);
  assert.equal(result.state.ball.status, "IN_FLIGHT");
  assert.equal(actionStatus(result.execution, plan[0]), "ACTIVE");
  assert.equal(actionStatus(result.execution, plan[1]), "PENDING");
  assert.equal(getPlannedActionExecution(result.execution, plan[0].id)?.dispatched, true);
});

test("planned lifecycle never revalidates completed PASS after H9 reception", () => {
  const plan = [passM9H9(), attackH9()];
  const dispatched: PlannedAction[] = [];
  const started = runScheduler(initialHalfCourt6v6State, plan, runningExecution(plan), 0, dispatched);

  assert.equal(actionStatus(started.execution, plan[0]), "ACTIVE");
  assert.equal(actionStatus(started.execution, plan[1]), "PENDING");
  assert.ok(started.state.ball.flight);

  const handedOff = runScheduler(started.state, plan, started.execution, started.state.ball.flight.durationSeconds, dispatched);

  assert.equal(handedOff.state.ball.status, "POSSESSED");
  assert.equal(handedOff.state.ball.possessorId, h9);
  assert.equal(actionStatus(handedOff.execution, plan[0]), "COMPLETE");
  assert.equal(actionStatus(handedOff.execution, plan[1]), "ACTIVE");
  assert.equal(handedOff.execution.status, "RUNNING");
  assert.equal(handedOff.execution.blockedReason?.includes("M9 PASS") ?? false, false);
  assert.deepEqual(dispatched.map((action) => action.type), ["PASS", "ATTACK"]);
});

test("planned scheduler waits for reception before dispatching ATTACK", () => {
  const plan = [passM9H9(), attackH9()];
  const dispatched: PlannedAction[] = [];
  const started = runScheduler(initialHalfCourt6v6State, plan, runningExecution(plan), 0, dispatched);

  assert.ok(started.state.ball.flight);
  const beforeReception = runScheduler(started.state, plan, started.execution, started.state.ball.flight.durationSeconds / 2, dispatched);
  assert.deepEqual(dispatched.map((action) => action.type), ["PASS"]);
  assert.equal(beforeReception.state.ball.status, "IN_FLIGHT");

  const afterReception = runScheduler(
    beforeReception.state,
    plan,
    beforeReception.execution,
    beforeReception.state.ball.flight?.durationSeconds ?? 1,
    dispatched
  );

  assert.deepEqual(dispatched.map((action) => action.type), ["PASS", "ATTACK"]);
  assert.equal(afterReception.state.ball.status, "POSSESSED");
  assert.equal(afterReception.state.ball.possessorId, h9);
  assert.equal(actionStatus(afterReception.execution, plan[0]), "COMPLETE");
  assert.equal(actionStatus(afterReception.execution, plan[1]), "ACTIVE");
  assert.deepEqual(activeActionIds(afterReception.execution), ["a1"]);
});

test("planned scheduler validates ATTACK against post-reception real possessor", () => {
  const plan = [passM9H9(), attackH9()];
  const dispatched: PlannedAction[] = [];
  const started = runScheduler(initialHalfCourt6v6State, plan, runningExecution(plan), 0, dispatched);

  assert.ok(started.state.ball.flight);
  const receivedAndAttacked = runScheduler(started.state, plan, started.execution, started.state.ball.flight.durationSeconds, dispatched);

  assert.equal(receivedAndAttacked.state.ball.status, "POSSESSED");
  assert.equal(receivedAndAttacked.state.ball.possessorId, h9);
  assert.equal(validatePlannedActionForExecution(receivedAndAttacked.state, attackH9()).ready, true);
  assert.deepEqual(dispatched.map((action) => action.type), ["PASS", "ATTACK"]);
  assert.notEqual(receivedAndAttacked.execution.status, "BLOCKED");
});

test("planned PASS to ATTACK handoff drives defense from H9 threat", () => {
  const plan = [passM9H9(), attackH9()];
  const dispatched: PlannedAction[] = [];
  const started = runSchedulerWithDefense(initialHalfCourt6v6State, plan, runningExecution(plan), 0, dispatched);

  assert.ok(started.state.ball.flight);
  const attacked = runSchedulerWithDefense(started.state, plan, started.execution, started.state.ball.flight.durationSeconds, dispatched);
  const activeThreat = attacked.state.defense.lastReaction?.activeThreat;

  assert.deepEqual(dispatched.map((action) => action.type), ["PASS", "ATTACK"]);
  assert.equal(activeThreat?.type, "ACTIVE_ATTACK_THREAT");
  assert.equal(activeThreat?.type === "ACTIVE_ATTACK_THREAT" ? activeThreat.ballCarrierId : null, h9);
});

test("planned ATTACK cannot complete before its ATTACK intent has been observed", () => {
  const plan = [passM9H9(), attackH9()];
  const dispatched: PlannedAction[] = [];
  const passStarted = runScheduler(initialHalfCourt6v6State, plan, runningExecution(plan), 0, dispatched);

  assert.ok(passStarted.state.ball.flight);
  const attackDispatched = runScheduler(passStarted.state, plan, passStarted.execution, passStarted.state.ball.flight.durationSeconds, dispatched);

  assert.equal(actionStatus(attackDispatched.execution, plan[0]), "COMPLETE");
  assert.equal(actionStatus(attackDispatched.execution, plan[1]), "ACTIVE");
  assert.equal(actionDispatched(attackDispatched.execution, plan[1]), true);
  assert.equal(actionStarted(attackDispatched.execution, plan[1]), false);
  assert.equal(attackDispatched.execution.status, "RUNNING");

  const attackObserved = runScheduler(attackDispatched.state, plan, attackDispatched.execution, SIMULATION_DT_SECONDS, dispatched);
  const attackerAfterStart = attackObserved.state.players.find((player) => player.id === h9);

  assert.equal(actionStatus(attackObserved.execution, plan[1]), "ACTIVE");
  assert.equal(actionStarted(attackObserved.execution, plan[1]), true);
  assert.equal(attackObserved.execution.status, "RUNNING");
  assert.equal(attackerAfterStart?.intent.type, "ATTACK");
  assert.notDeepEqual(attackerAfterStart?.position, getAttackGap("H2_H1")?.position);
});

test("planned ATTACK completes only after started movement reaches target", () => {
  const plan = [passM9H9(), attackH9()];
  const dispatched: PlannedAction[] = [];
  let state = initialHalfCourt6v6State;
  let execution = runningExecution(plan);

  for (let i = 0; i < 300 && execution.status === "RUNNING"; i += 1) {
    const result = runScheduler(state, plan, execution, SIMULATION_DT_SECONDS, dispatched);
    state = result.state;
    execution = result.execution;
  }

  const attacker = state.players.find((player) => player.id === h9);
  assert.equal(actionStarted(execution, plan[1]), true);
  assert.equal(actionStatus(execution, plan[1]), "COMPLETE");
  assert.equal(execution.status, "COMPLETE");
  assert.equal(attacker?.intent.type, "IDLE");
  assert.deepEqual(attacker?.position, getAttackGap("H2_H1")?.position);
});

test("planned second PASS validates against post-reception H9 possession", () => {
  const second: PlannedAction = { id: "p2", type: "PASS", actorId: h9, receiverId: h6, label: "H9 PASS -> H6" };
  const plan = [passM9H9(), second];
  const dispatched: PlannedAction[] = [];
  const started = runScheduler(initialHalfCourt6v6State, plan, runningExecution(plan), 0, dispatched);

  assert.ok(started.state.ball.flight);
  const secondPassStarted = runScheduler(started.state, plan, started.execution, started.state.ball.flight.durationSeconds, dispatched);

  assert.deepEqual(dispatched.map((action) => action.type), ["PASS", "PASS"]);
  assert.equal(secondPassStarted.execution.status, "RUNNING");
  assert.equal(actionStatus(secondPassStarted.execution, plan[0]), "COMPLETE");
  assert.equal(actionStatus(secondPassStarted.execution, second), "ACTIVE");
  assert.equal(secondPassStarted.state.ball.status, "IN_FLIGHT");
  assert.equal(secondPassStarted.state.ball.flight?.receiverId, h6);
});

test("planned second PASS observes flight start before completing at H6", () => {
  const second: PlannedAction = { id: "p2", type: "PASS", actorId: h9, receiverId: h6, label: "H9 PASS -> H6" };
  const plan = [passM9H9(), second];
  const dispatched: PlannedAction[] = [];
  const firstStarted = runScheduler(initialHalfCourt6v6State, plan, runningExecution(plan), 0, dispatched);

  assert.ok(firstStarted.state.ball.flight);
  const secondDispatched = runScheduler(firstStarted.state, plan, firstStarted.execution, firstStarted.state.ball.flight.durationSeconds, dispatched);
  assert.equal(actionStatus(secondDispatched.execution, second), "ACTIVE");
  assert.equal(actionDispatched(secondDispatched.execution, second), true);
  assert.equal(actionStarted(secondDispatched.execution, second), false);

  const secondStarted = runScheduler(secondDispatched.state, plan, secondDispatched.execution, SIMULATION_DT_SECONDS, dispatched);
  assert.equal(actionStarted(secondStarted.execution, second), true);
  assert.equal(actionStatus(secondStarted.execution, second), "ACTIVE");

  assert.ok(secondStarted.state.ball.flight);
  const completed = runScheduler(secondStarted.state, plan, secondStarted.execution, secondStarted.state.ball.flight.durationSeconds, dispatched);
  assert.equal(actionStatus(completed.execution, second), "COMPLETE");
  assert.equal(completed.execution.status, "COMPLETE");
  assert.equal(completed.state.ball.possessorId, h6);
});

test("planned MOVE cannot complete before MOVE intent has been observed", () => {
  const plan = [moveM9()];
  const dispatched: PlannedAction[] = [];
  const moveDispatched = runScheduler(initialHalfCourt6v6State, plan, runningExecution(plan), 0, dispatched);

  assert.equal(actionStatus(moveDispatched.execution, plan[0]), "ACTIVE");
  assert.equal(actionDispatched(moveDispatched.execution, plan[0]), true);
  assert.equal(actionStarted(moveDispatched.execution, plan[0]), true);
  assert.equal(moveDispatched.execution.status, "RUNNING");

  const moveObserved = runScheduler(moveDispatched.state, plan, moveDispatched.execution, SIMULATION_DT_SECONDS, dispatched);
  assert.equal(actionStarted(moveObserved.execution, plan[0]), true);
  assert.equal(actionStatus(moveObserved.execution, plan[0]), "ACTIVE");
});

test("planned second action still blocks when invalid against post-reception state", () => {
  const invalidSecond: PlannedAction = { ...attackH9(), actorId: m9, label: "M9 ATTACK -> H2/H1" };
  const plan = [passM9H9(), invalidSecond];
  const dispatched: PlannedAction[] = [];
  const started = runScheduler(initialHalfCourt6v6State, plan, runningExecution(plan), 0, dispatched);

  assert.ok(started.state.ball.flight);
  const blocked = runScheduler(started.state, plan, started.execution, started.state.ball.flight.durationSeconds, dispatched);

  assert.equal(blocked.state.ball.status, "POSSESSED");
  assert.equal(blocked.state.ball.possessorId, h9);
  assert.equal(blocked.execution.status, "BLOCKED");
  assert.equal(actionStatus(blocked.execution, plan[0]), "COMPLETE");
  assert.equal(actionStatus(blocked.execution, invalidSecond), "BLOCKED");
  assert.equal(blocked.execution.blockedReason?.includes("current possessor is"), true);
  assert.deepEqual(dispatched.map((action) => action.type), ["PASS"]);
});

test("planned scheduler completes PASS then ATTACK sequence", () => {
  const plan = [passM9H9(), attackH9()];
  const dispatched: PlannedAction[] = [];
  let state = initialHalfCourt6v6State;
  let execution = runningExecution(plan);

  for (let i = 0; i < 300 && execution.status === "RUNNING"; i += 1) {
    const result = runScheduler(state, plan, execution, SIMULATION_DT_SECONDS, dispatched);
    state = result.state;
    execution = result.execution;
  }

  assert.equal(execution.status, "COMPLETE");
  assert.equal(actionStatus(execution, plan[0]), "COMPLETE");
  assert.equal(actionStatus(execution, plan[1]), "COMPLETE");
  assert.deepEqual(dispatched.map((action) => action.type), ["PASS", "ATTACK"]);
  const attacker = state.players.find((player) => player.id === h9);
  assert.equal(attacker?.intent.type, "IDLE");
  assert.deepEqual(attacker?.position, getAttackGap("H2_H1")?.position);
});

test("completed planned action cannot become blocked later", () => {
  const invalidSecond: PlannedAction = { ...attackH9(), actorId: m9, label: "M9 ATTACK -> H2/H1" };
  const plan = [passM9H9(), invalidSecond];
  const dispatched: PlannedAction[] = [];
  const started = runScheduler(initialHalfCourt6v6State, plan, runningExecution(plan), 0, dispatched);

  assert.ok(started.state.ball.flight);
  const blocked = runScheduler(started.state, plan, started.execution, started.state.ball.flight.durationSeconds, dispatched);

  assert.equal(actionStatus(blocked.execution, plan[0]), "COMPLETE");
  assert.equal(actionStatus(blocked.execution, invalidSecond), "BLOCKED");
  assert.equal(blocked.execution.blockedReason?.includes("M9 ATTACK"), true);
  assert.equal(blocked.execution.blockedReason?.includes("M9 PASS") ?? false, false);
});

test("planned lifecycle keeps only one ACTIVE action at a time", () => {
  const plan = [passM9H9(), attackH9()];
  const dispatched: PlannedAction[] = [];
  let state = initialHalfCourt6v6State;
  let execution = runningExecution(plan);

  for (let i = 0; i < 80 && execution.status === "RUNNING"; i += 1) {
    const result = runScheduler(state, plan, execution, SIMULATION_DT_SECONDS, dispatched);
    state = result.state;
    execution = result.execution;
    assert.ok(activeActionIds(execution).length <= 1);
  }
});

test("planned scheduler dispatches each queued command exactly once", () => {
  const plan = [passM9H9(), attackH9()];
  const dispatched: PlannedAction[] = [];
  let state = initialHalfCourt6v6State;
  let execution = runningExecution(plan);

  for (let i = 0; i < 80 && dispatched.length < 2; i += 1) {
    const result = runScheduler(state, plan, execution, SIMULATION_DT_SECONDS, dispatched);
    state = result.state;
    execution = result.execution;
  }

  assert.equal(dispatched.filter((action) => action.type === "PASS").length, 1);
  assert.equal(dispatched.filter((action) => action.type === "ATTACK").length, 1);
});

test("planned scheduler resumes mid-PASS without redispatching PASS", () => {
  const plan = [passM9H9(), attackH9()];
  const dispatched: PlannedAction[] = [];
  const started = runScheduler(initialHalfCourt6v6State, plan, runningExecution(plan), 0, dispatched);
  const pausedState = started.state;
  const pausedExecution = pausePlannedExecution(started.execution);

  const resumed = runScheduler(pausedState, plan, startPlannedExecution(plan, pausedExecution), SIMULATION_DT_SECONDS, dispatched);

  assert.equal(actionStatus(pausedExecution, plan[0]), "ACTIVE");
  assert.equal(actionStatus(resumed.execution, plan[0]), "ACTIVE");
  assert.equal(dispatched.filter((action) => action.type === "PASS").length, 1);
});

test("planned scheduler resumes mid-ATTACK without redispatching ATTACK", () => {
  const plan = [passM9H9(), attackH9()];
  const dispatched: PlannedAction[] = [];
  const started = runScheduler(initialHalfCourt6v6State, plan, runningExecution(plan), 0, dispatched);

  assert.ok(started.state.ball.flight);
  const attackStarted = runScheduler(started.state, plan, started.execution, started.state.ball.flight.durationSeconds, dispatched);
  const pausedExecution = pausePlannedExecution(attackStarted.execution);
  const resumed = runScheduler(attackStarted.state, plan, startPlannedExecution(plan, pausedExecution), SIMULATION_DT_SECONDS, dispatched);

  assert.equal(actionStatus(pausedExecution, plan[1]), "ACTIVE");
  assert.equal(actionStatus(resumed.execution, plan[1]), "ACTIVE");
  assert.equal(dispatched.filter((action) => action.type === "ATTACK").length, 1);
});

test("planned scheduler can progress a sequence by fixed STEP calls", () => {
  const plan = [passM9H9(), attackH9()];
  let state = initialHalfCourt6v6State;
  let execution = runningExecution(plan);

  for (let i = 0; i < 300 && execution.status === "RUNNING"; i += 1) {
    const result = runScheduler(state, plan, execution, SIMULATION_DT_SECONDS);
    state = result.state;
    execution = result.execution;
  }

  assert.equal(execution.status, "COMPLETE");
});

test("empty plan leaves planned scheduler idle while ordinary world stepping remains available", () => {
  const result = runScheduler(initialHalfCourt6v6State, [], EMPTY_PLANNED_EXECUTION, SIMULATION_DT_SECONDS);
  const manual = step(initialHalfCourt6v6State, {}, SIMULATION_DT_SECONDS);

  assert.equal(result.state.simulationTime, initialHalfCourt6v6State.simulationTime);
  assert.equal(manual.simulationTime, initialHalfCourt6v6State.simulationTime + SIMULATION_DT_SECONDS);
});

test("invalid planned action blocks without dispatching later actions", () => {
  const invalidFirst = attackH9();
  const later = passM9H9();
  const plan = [invalidFirst, later];
  const dispatched: PlannedAction[] = [];
  const result = runScheduler(initialHalfCourt6v6State, plan, runningExecution(plan), SIMULATION_DT_SECONDS, dispatched);

  assert.equal(result.execution.status, "BLOCKED");
  assert.equal(actionStatus(result.execution, invalidFirst), "BLOCKED");
  assert.equal(actionStatus(result.execution, later), "PENDING");
  assert.equal(dispatched.length, 0);
});
