import type { HandballAction } from "../domain/handball/actions";
import type { HandballState } from "../domain/handball/state";
import type { DefensivePolicy } from "../policies/defense/types";
import { step, type SimulationInput } from "../simulation/engine";
import {
  EMPTY_PLANNED_EXECUTION,
  advancePlannedExecutionStep,
  pausePlannedExecution,
  plannedActionToCommand,
  startPlannedExecution,
  type PlannedAction,
  type PlannedExecutionState
} from "./plannedSequence";

export type SimulationRuntimeEvent = {
  type: "MANUAL_ACTION" | "PLANNED_ACTION" | "STEP";
  label: string;
};

export type SimulationRuntimeState = {
  world: HandballState;
  plannedActions: readonly PlannedAction[];
  sequence: PlannedExecutionState;
};

export type SimulationRuntimeResult = {
  runtime: SimulationRuntimeState;
  events: readonly SimulationRuntimeEvent[];
};

function inputWithDefense(defensivePolicy: DefensivePolicy | null, actions: readonly HandballAction[] = []): SimulationInput {
  return {
    actions,
    defensivePolicy
  };
}

export function createSimulationRuntime(world: HandballState): SimulationRuntimeState {
  return {
    world,
    plannedActions: Object.freeze([]),
    sequence: EMPTY_PLANNED_EXECUTION
  };
}

export function replaceRuntimeWorld(runtime: SimulationRuntimeState, world: HandballState): SimulationRuntimeState {
  return {
    ...runtime,
    world,
    plannedActions: Object.freeze([]),
    sequence: EMPTY_PLANNED_EXECUTION
  };
}

export function setRuntimePlannedActions(runtime: SimulationRuntimeState, plannedActions: readonly PlannedAction[]): SimulationRuntimeState {
  return {
    ...runtime,
    plannedActions: Object.freeze([...plannedActions]),
    sequence: EMPTY_PLANNED_EXECUTION
  };
}

export function queueRuntimePlannedAction(runtime: SimulationRuntimeState, action: PlannedAction): SimulationRuntimeState {
  return setRuntimePlannedActions(runtime, [...runtime.plannedActions, action]);
}

export function startRuntimeSequence(runtime: SimulationRuntimeState): SimulationRuntimeState {
  return {
    ...runtime,
    sequence: startPlannedExecution(runtime.plannedActions, runtime.sequence)
  };
}

export function pauseRuntimeSequence(runtime: SimulationRuntimeState): SimulationRuntimeState {
  return {
    ...runtime,
    sequence: pausePlannedExecution(runtime.sequence)
  };
}

export function executeRuntimeCommand(
  runtime: SimulationRuntimeState,
  command: HandballAction,
  defensivePolicy: DefensivePolicy | null,
  dt: number,
  label: string
): SimulationRuntimeResult {
  return {
    runtime: {
      ...runtime,
      world: step(runtime.world, inputWithDefense(defensivePolicy, [command]), dt)
    },
    events: [{ type: "MANUAL_ACTION", label }]
  };
}

export function runSimulationTick(
  runtime: SimulationRuntimeState,
  dt: number,
  defensivePolicy: DefensivePolicy | null,
  options: { recordIdleStep?: boolean } = {}
): SimulationRuntimeResult {
  if (runtime.plannedActions.length > 0) {
    if (runtime.sequence.status !== "RUNNING") {
      return { runtime, events: [] };
    }

    const planned = advancePlannedExecutionStep({
      state: runtime.world,
      plannedActions: runtime.plannedActions,
      execution: runtime.sequence,
      dt,
      runCommand: (current, action) => step(current, inputWithDefense(defensivePolicy, [plannedActionToCommand(action)]), 0),
      advanceWorld: (current, seconds) => step(current, inputWithDefense(defensivePolicy), seconds)
    });

    return {
      runtime: {
        ...runtime,
        world: planned.state,
        sequence: planned.execution
      },
      events: planned.dispatchedAction ? [{ type: "PLANNED_ACTION", label: planned.dispatchedAction.label }] : []
    };
  }

  const world = step(runtime.world, inputWithDefense(defensivePolicy), dt);
  const hasActiveProgression = runtime.world.ball.status === "IN_FLIGHT" || runtime.world.players.some((player) => player.intent.type === "ATTACK");
  const shouldRecordStep = options.recordIdleStep === true && !hasActiveProgression;

  return {
    runtime: {
      ...runtime,
      world
    },
    events: shouldRecordStep ? [{ type: "STEP", label: `STEP +${dt.toFixed(2)}s` }] : []
  };
}
