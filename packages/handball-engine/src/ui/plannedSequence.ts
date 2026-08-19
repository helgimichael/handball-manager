import type { AttackGapId } from "../domain/geometry/attackGaps";
import type { MeterPoint } from "../domain/geometry/coordinates";
import type { HandballAction } from "../domain/handball/actions";
import type { HandballState } from "../domain/handball/state";

export type PlannedAction =
  | {
      id: string;
      type: "PASS";
      actorId: string;
      receiverId: string;
      label: string;
    }
  | {
      id: string;
      type: "ATTACK";
      actorId: string;
      gapId: AttackGapId;
      target: MeterPoint;
      label: string;
    }
  | {
      id: string;
      type: "MOVE";
      actorId: string;
      target: MeterPoint;
      label: string;
    };

export type PlannedProjection = {
  projectedPossessorId: string | null;
  plannedActorId: string | null;
};

export type PlannedActionLifecycleStatus = "PENDING" | "ACTIVE" | "COMPLETE" | "BLOCKED";

export type PlannedActionExecution = {
  actionId: string;
  status: PlannedActionLifecycleStatus;
  dispatched: boolean;
  started: boolean;
};

export type PlannedExecutionStatus = "READY" | "RUNNING" | "PAUSED" | "BLOCKED" | "COMPLETE";

export type PlannedExecutionState = {
  status: PlannedExecutionStatus;
  actions: readonly PlannedActionExecution[];
  blockedReason: string | null;
};

export type PlannedExecutionStepResult = {
  state: HandballState;
  execution: PlannedExecutionState;
  dispatchedAction: PlannedAction | null;
  completedAction: PlannedAction | null;
};

export const EMPTY_PLANNED_EXECUTION: PlannedExecutionState = Object.freeze({
  status: "READY",
  actions: Object.freeze([]),
  blockedReason: null
});

export function projectPlannedActions(
  state: HandballState,
  plannedActions: readonly PlannedAction[],
  selectedPlayerId: string | null
): PlannedProjection {
  const initialPossessor = state.ball.status === "POSSESSED" ? state.ball.possessorId : null;
  let projectedPossessorId = initialPossessor;
  let plannedActorId = selectedPlayerId ?? initialPossessor;

  for (const action of plannedActions) {
    plannedActorId = action.type === "PASS" ? action.receiverId : action.actorId;
    if (action.type === "PASS") {
      projectedPossessorId = action.receiverId;
    }
    if (action.type === "ATTACK") {
      projectedPossessorId = action.actorId;
    }
  }

  return { projectedPossessorId, plannedActorId };
}

export function canPlanActionForActor(state: HandballState, plannedActions: readonly PlannedAction[], actorId: string, type: PlannedAction["type"]): boolean {
  const actor = state.players.find((player) => player.id === actorId && player.team === "ATTACK");
  if (!actor) {
    return false;
  }
  if (type === "MOVE") {
    return true;
  }
  return projectPlannedActions(state, plannedActions, actorId).projectedPossessorId === actorId;
}

export function undoLastPlannedAction(plannedActions: readonly PlannedAction[]): readonly PlannedAction[] {
  return Object.freeze(plannedActions.slice(0, -1));
}

export function clearPlannedActions(): readonly PlannedAction[] {
  return Object.freeze([]);
}

export function plannedActionToCommand(action: PlannedAction): HandballAction {
  if (action.type === "PASS") {
    return { type: "PASS", fromPlayerId: action.actorId, toPlayerId: action.receiverId };
  }
  if (action.type === "ATTACK") {
    return { type: "ATTACK", playerId: action.actorId, gapId: action.gapId, target: { ...action.target } };
  }
  return { type: "MOVE", playerId: action.actorId, target: { ...action.target } };
}

export function validatePlannedActionForExecution(state: HandballState, action: PlannedAction): { ready: boolean; reason: string | null } {
  const actor = state.players.find((player) => player.id === action.actorId);
  if (!actor) {
    return { ready: false, reason: `Missing actor for ${action.label}` };
  }
  if (actor.team !== "ATTACK") {
    return { ready: false, reason: `${action.label} actor is not an attacker` };
  }
  if (action.type === "MOVE") {
    return { ready: true, reason: null };
  }
  if (state.ball.status !== "POSSESSED" || state.ball.possessorId !== action.actorId) {
    const currentPossessor = state.ball.status === "POSSESSED" ? state.ball.possessorId ?? "none" : state.ball.status.toLowerCase();
    return { ready: false, reason: `${action.label} requires ${action.actorId} to possess the ball; current possessor is ${currentPossessor}` };
  }
  return { ready: true, reason: null };
}

export function plannedActionReady(state: HandballState, action: PlannedAction): { ready: boolean; reason: string | null } {
  return validatePlannedActionForExecution(state, action);
}

export function plannedActionComplete(state: HandballState, action: PlannedAction): boolean {
  if (action.type === "PASS") {
    return state.ball.status === "POSSESSED" && state.ball.possessorId === action.receiverId;
  }

  const actor = state.players.find((player) => player.id === action.actorId);
  if (!actor) {
    return false;
  }
  if (action.type === "ATTACK") {
    return actor.intent.type !== "ATTACK";
  }
  return actor.intent.type !== "MOVE";
}

function createPendingActionExecution(action: PlannedAction): PlannedActionExecution {
  return Object.freeze({ actionId: action.id, status: "PENDING", dispatched: false, started: false });
}

export function createPlannedExecution(plannedActions: readonly PlannedAction[], status: PlannedExecutionStatus = "READY"): PlannedExecutionState {
  return Object.freeze({
    status: plannedActions.length === 0 ? "READY" : status,
    actions: Object.freeze(plannedActions.map(createPendingActionExecution)),
    blockedReason: null
  });
}

export function getPlannedActionExecution(execution: PlannedExecutionState, actionId: string): PlannedActionExecution | null {
  return execution.actions.find((actionExecution) => actionExecution.actionId === actionId) ?? null;
}

export function getActivePlannedAction(
  plannedActions: readonly PlannedAction[],
  execution: PlannedExecutionState
): { action: PlannedAction; execution: PlannedActionExecution; index: number } | null {
  const activeExecution = execution.actions.find((actionExecution) => actionExecution.status === "ACTIVE");
  if (!activeExecution) {
    return null;
  }
  const index = plannedActions.findIndex((action) => action.id === activeExecution.actionId);
  const action = index >= 0 ? plannedActions[index] : null;
  return action ? { action, execution: activeExecution, index } : null;
}

export function plannedExecutionCursor(plannedActions: readonly PlannedAction[], execution: PlannedExecutionState): number {
  const active = getActivePlannedAction(plannedActions, execution);
  if (active) {
    return active.index;
  }
  const nextPending = plannedActions.findIndex((action) => getPlannedActionExecution(execution, action.id)?.status === "PENDING");
  return nextPending >= 0 ? nextPending : Math.max(0, plannedActions.length - 1);
}

function normalizeExecution(plannedActions: readonly PlannedAction[], execution: PlannedExecutionState): PlannedExecutionState {
  const existing = new Map(execution.actions.map((actionExecution) => [actionExecution.actionId, actionExecution]));
  const actions = plannedActions.map((action) => existing.get(action.id) ?? createPendingActionExecution(action));
  const firstActiveIndex = actions.findIndex((actionExecution) => actionExecution.status === "ACTIVE");
  const normalizedActions = actions.map((actionExecution, index) =>
    actionExecution.status === "ACTIVE" && index !== firstActiveIndex
      ? { ...actionExecution, status: "PENDING" as const, dispatched: false, started: false }
      : actionExecution
  );
  const anyBlocked = normalizedActions.some((actionExecution) => actionExecution.status === "BLOCKED");
  const allComplete = plannedActions.length > 0 && normalizedActions.every((actionExecution) => actionExecution.status === "COMPLETE");

  return {
    status: anyBlocked ? "BLOCKED" : allComplete ? "COMPLETE" : execution.status === "COMPLETE" ? "READY" : execution.status,
    actions: Object.freeze(normalizedActions),
    blockedReason: anyBlocked ? execution.blockedReason : null
  };
}

function updateActionExecution(
  execution: PlannedExecutionState,
  actionId: string,
  patch: Partial<PlannedActionExecution>
): PlannedExecutionState {
  return {
    ...execution,
    actions: Object.freeze(
      execution.actions.map((actionExecution) => (actionExecution.actionId === actionId ? { ...actionExecution, ...patch } : actionExecution))
    )
  };
}

function activateNextPending(plannedActions: readonly PlannedAction[], execution: PlannedExecutionState): PlannedExecutionState {
  if (execution.actions.some((actionExecution) => actionExecution.status === "ACTIVE")) {
    return execution;
  }

  const nextPending = plannedActions.find((action) => getPlannedActionExecution(execution, action.id)?.status === "PENDING");
  if (!nextPending) {
    return { ...execution, status: plannedActions.length === 0 ? "READY" : "COMPLETE", blockedReason: null };
  }

  return updateActionExecution({ ...execution, status: "RUNNING", blockedReason: null }, nextPending.id, {
    status: "ACTIVE",
    dispatched: false,
    started: false
  });
}

function blockActiveAction(execution: PlannedExecutionState, actionId: string, reason: string): PlannedExecutionState {
  return updateActionExecution({ ...execution, status: "BLOCKED", blockedReason: reason }, actionId, {
    status: "BLOCKED",
    dispatched: false,
    started: false
  });
}

function dispatchActiveAction(
  current: HandballState,
  plannedActions: readonly PlannedAction[],
  execution: PlannedExecutionState,
  runCommand: (current: HandballState, action: PlannedAction) => HandballState
): { state: HandballState; execution: PlannedExecutionState; dispatchedAction: PlannedAction | null } {
  const active = getActivePlannedAction(plannedActions, execution);
  if (!active || active.execution.dispatched) {
    return { state: current, execution, dispatchedAction: null };
  }

  const readiness = validatePlannedActionForExecution(current, active.action);
  if (!readiness.ready) {
    return {
      state: current,
      execution: blockActiveAction(execution, active.action.id, readiness.reason ?? "Planned action is not executable"),
      dispatchedAction: null
    };
  }

  try {
    return {
      state: runCommand(current, active.action),
      execution: updateActionExecution(execution, active.action.id, { dispatched: true }),
      dispatchedAction: active.action
    };
  } catch (error) {
    return {
      state: current,
      execution: blockActiveAction(execution, active.action.id, error instanceof Error ? error.message : "Planned action failed during execution"),
      dispatchedAction: null
    };
  }
}

function plannedActionStarted(state: HandballState, action: PlannedAction): boolean {
  if (action.type === "PASS") {
    return (
      state.ball.status === "IN_FLIGHT" &&
      state.ball.flight?.passerId === action.actorId &&
      state.ball.flight.receiverId === action.receiverId
    );
  }

  const actor = state.players.find((player) => player.id === action.actorId);
  if (!actor) {
    return false;
  }
  if (action.type === "ATTACK") {
    return actor.intent.type === "ATTACK" && actor.intent.gapId === action.gapId;
  }
  return actor.intent.type === "MOVE";
}

function observeActiveActionStart(
  current: HandballState,
  plannedActions: readonly PlannedAction[],
  execution: PlannedExecutionState
): { execution: PlannedExecutionState; startedAction: PlannedAction | null } {
  const active = getActivePlannedAction(plannedActions, execution);
  if (!active || !active.execution.dispatched || active.execution.started || !plannedActionStarted(current, active.action)) {
    return { execution, startedAction: null };
  }

  return {
    execution: updateActionExecution(execution, active.action.id, { started: true }),
    startedAction: active.action
  };
}

function completeActiveAction(
  current: HandballState,
  plannedActions: readonly PlannedAction[],
  execution: PlannedExecutionState
): { execution: PlannedExecutionState; completedAction: PlannedAction | null } {
  const active = getActivePlannedAction(plannedActions, execution);
  if (!active || !active.execution.dispatched || !active.execution.started || !plannedActionComplete(current, active.action)) {
    return { execution, completedAction: null };
  }

  return {
    execution: updateActionExecution(execution, active.action.id, {
      status: "COMPLETE",
      dispatched: true
    }),
    completedAction: active.action
  };
}

export function startPlannedExecution(plannedActions: readonly PlannedAction[], execution: PlannedExecutionState = EMPTY_PLANNED_EXECUTION): PlannedExecutionState {
  const normalized = normalizeExecution(plannedActions, execution);
  if (normalized.status === "BLOCKED" || normalized.status === "COMPLETE") {
    return normalized;
  }
  return activateNextPending(plannedActions, { ...normalized, status: "RUNNING", blockedReason: null });
}

export function pausePlannedExecution(execution: PlannedExecutionState): PlannedExecutionState {
  return execution.status === "RUNNING" ? { ...execution, status: "PAUSED" } : execution;
}

export function advancePlannedExecutionStep(options: {
  state: HandballState;
  plannedActions: readonly PlannedAction[];
  execution: PlannedExecutionState;
  dt: number;
  runCommand: (current: HandballState, action: PlannedAction) => HandballState;
  advanceWorld: (current: HandballState, dt: number) => HandballState;
}): PlannedExecutionStepResult {
  let next = options.state;
  let execution = normalizeExecution(options.plannedActions, options.execution);
  let completedAction: PlannedAction | null = null;
  let dispatchedAction: PlannedAction | null = null;

  if (execution.status !== "RUNNING") {
    return { state: next, execution, dispatchedAction, completedAction };
  }

  execution = activateNextPending(options.plannedActions, execution);

  const dispatchedBeforeAdvance = dispatchActiveAction(next, options.plannedActions, execution, options.runCommand);
  next = dispatchedBeforeAdvance.state;
  execution = dispatchedBeforeAdvance.execution;
  dispatchedAction = dispatchedBeforeAdvance.dispatchedAction;

  const startBeforeAdvance = observeActiveActionStart(next, options.plannedActions, execution);
  execution = startBeforeAdvance.execution;

  if (execution.status === "RUNNING") {
    next = options.advanceWorld(next, options.dt);
  }

  if (execution.status !== "RUNNING") {
    return { state: next, execution, dispatchedAction, completedAction };
  }

  const startAfterAdvance = observeActiveActionStart(next, options.plannedActions, execution);
  execution = startAfterAdvance.execution;

  const completion =
    startBeforeAdvance.startedAction || startAfterAdvance.startedAction
      ? { execution, completedAction: null }
      : completeActiveAction(next, options.plannedActions, execution);
  execution = completion.execution;
  completedAction = completion.completedAction;

  if (execution.status !== "RUNNING") {
    return { state: next, execution, dispatchedAction, completedAction };
  }

  execution = activateNextPending(options.plannedActions, execution);

  const dispatchedAfterCompletion = dispatchActiveAction(next, options.plannedActions, execution, options.runCommand);
  next = dispatchedAfterCompletion.state;
  execution = dispatchedAfterCompletion.execution;
  dispatchedAction = dispatchedAction ?? dispatchedAfterCompletion.dispatchedAction;

  return { state: next, execution, dispatchedAction, completedAction };
}
