import { COURT_BOUNDS_METERS } from "../domain/geometry/court";
import { distanceBetween, isPointWithinBounds } from "../domain/geometry/coordinates";
import { getAttackGap, isValidAttackGapTarget } from "../domain/geometry/attackGaps";
import type { AttackAction, HandballAction, MoveAction, PassAction } from "../domain/handball/actions";
import type { Ball, BallFlight } from "../domain/handball/ball";
import type { Player } from "../domain/handball/player";
import { cloneHandballState, type HandballState } from "../domain/handball/state";
import type { DefensivePolicy } from "../policies/defense/types";
import { advancePlayerMovement } from "./movement";

export type SimulationInput = {
  actions?: readonly HandballAction[];
  defensivePolicy?: DefensivePolicy | null;
};

export class SimulationInputError extends Error {}

// SIM-3 v0.1: passes use a constant straight-line speed; no arc, spin, bounce, or catch failure is modeled.
export const DEFAULT_PASS_SPEED_METERS_PER_SECOND = 12;

function assertValidDeltaTime(dt: number): void {
  if (!Number.isFinite(dt) || dt < 0) {
    throw new SimulationInputError("dt must be a finite non-negative number of seconds.");
  }
}

function assertSupportedCommand(action: HandballAction): asserts action is MoveAction | PassAction | AttackAction {
  if (action.type !== "MOVE" && action.type !== "PASS" && action.type !== "ATTACK") {
    throw new SimulationInputError("Unsupported action execution is not implemented in SIM-4.");
  }
}

function applyMoveCommand(state: HandballState, command: MoveAction): HandballState {
  if (!isPointWithinBounds(command.target, COURT_BOUNDS_METERS)) {
    throw new SimulationInputError(`MOVE target for ${command.playerId} is outside court bounds.`);
  }

  let foundPlayer = false;
  const players = state.players.map((player) => {
    if (player.id !== command.playerId) {
      return player;
    }
    foundPlayer = true;
    return {
      ...player,
      intent: {
        type: "MOVE" as const,
        target: { ...command.target },
        completed: false
      }
    };
  });

  if (!foundPlayer) {
    throw new SimulationInputError(`MOVE command references unknown player: ${command.playerId}.`);
  }

  return { ...state, players };
}

function findPlayerById(players: readonly Player[], playerId: string): Player | null {
  return players.find((player) => player.id === playerId) ?? null;
}

function createBallFlight(passer: Player, receiver: Player): BallFlight {
  const from = { ...passer.position };
  // SIM-3 v0.1 locks the pass target to the receiver's position at pass initiation.
  const to = { ...receiver.position };
  const distance = distanceBetween(from, to);

  return {
    passerId: passer.id,
    receiverId: receiver.id,
    from,
    to,
    elapsedSeconds: 0,
    durationSeconds: distance / DEFAULT_PASS_SPEED_METERS_PER_SECOND,
    speedMetersPerSecond: DEFAULT_PASS_SPEED_METERS_PER_SECOND
  };
}

function applyPassCommand(state: HandballState, command: PassAction): HandballState {
  const passer = findPlayerById(state.players, command.fromPlayerId);
  const receiver = findPlayerById(state.players, command.toPlayerId);

  if (!passer) {
    throw new SimulationInputError(`PASS command references unknown passer: ${command.fromPlayerId}.`);
  }
  if (!receiver) {
    throw new SimulationInputError(`PASS command references unknown receiver: ${command.toPlayerId}.`);
  }
  if (passer.id === receiver.id) {
    throw new SimulationInputError("PASS command requires distinct passer and receiver players.");
  }
  if (state.ball.status !== "POSSESSED") {
    throw new SimulationInputError("PASS command requires a possessed ball before pass begins.");
  }
  if (state.ball.possessorId !== passer.id) {
    throw new SimulationInputError(`PASS command requires passer ${passer.id} to possess the ball.`);
  }
  if (passer.team !== "ATTACK" || receiver.team !== "ATTACK") {
    throw new SimulationInputError("SIM-3 PASS only supports passes between ATTACK teammates.");
  }

  const flight = createBallFlight(passer, receiver);

  return {
    ...state,
    ball: {
      position: { ...flight.from },
      possessorId: null,
      status: "IN_FLIGHT",
      flight
    }
  };
}

function applyAttackCommand(state: HandballState, command: AttackAction): HandballState {
  const player = findPlayerById(state.players, command.playerId);
  const gap = getAttackGap(command.gapId);

  if (!player) {
    throw new SimulationInputError(`ATTACK command references unknown player: ${command.playerId}.`);
  }
  if (player.team !== "ATTACK") {
    throw new SimulationInputError("ATTACK command requires an ATTACK team player.");
  }
  if (state.ball.status !== "POSSESSED") {
    throw new SimulationInputError("ATTACK command requires a possessed ball.");
  }
  if (state.ball.possessorId !== player.id) {
    throw new SimulationInputError(`ATTACK command requires player ${player.id} to possess the ball.`);
  }
  if (!gap) {
    throw new SimulationInputError(`ATTACK command references unknown defensive gap: ${command.gapId}.`);
  }
  if (!isValidAttackGapTarget(gap)) {
    throw new SimulationInputError(`ATTACK gap ${gap.id} target is outside court bounds.`);
  }
  const target = command.target ?? gap.position;
  if (!isPointWithinBounds(target, COURT_BOUNDS_METERS)) {
    throw new SimulationInputError(`ATTACK target for ${command.playerId} is outside court bounds.`);
  }

  const players = state.players.map((candidate) =>
    candidate.id === player.id
      ? {
          ...candidate,
          intent: {
            type: "ATTACK" as const,
            gapId: gap.id,
            target: { ...target },
            completed: false
          }
        }
      : candidate
  );

  return { ...state, players };
}

function applyCommand(state: HandballState, action: MoveAction | PassAction | AttackAction): HandballState {
  switch (action.type) {
    case "MOVE":
      return applyMoveCommand(state, action);
    case "PASS":
      return applyPassCommand(state, action);
    case "ATTACK":
      return applyAttackCommand(state, action);
  }
}

function interpolateFlightPosition(flight: BallFlight, elapsedSeconds: number): Ball["position"] {
  if (flight.durationSeconds === 0) {
    return { ...flight.to };
  }

  const progress = Math.min(1, Math.max(0, elapsedSeconds / flight.durationSeconds));
  return {
    x: flight.from.x + (flight.to.x - flight.from.x) * progress,
    y: flight.from.y + (flight.to.y - flight.from.y) * progress
  };
}

function advanceBall(ball: Ball, players: readonly Player[], dt: number): Ball {
  if (ball.status !== "IN_FLIGHT" || ball.flight === null) {
    return {
      ...ball,
      position: { ...ball.position },
      flight: ball.flight
        ? {
            ...ball.flight,
            from: { ...ball.flight.from },
            to: { ...ball.flight.to }
          }
        : null
    };
  }

  if (dt === 0) {
    return {
      ...ball,
      position: { ...ball.position },
      flight: {
        ...ball.flight,
        from: { ...ball.flight.from },
        to: { ...ball.flight.to }
      }
    };
  }

  const elapsedSeconds = ball.flight.elapsedSeconds + dt;
  if (elapsedSeconds >= ball.flight.durationSeconds) {
    const receiver = findPlayerById(players, ball.flight.receiverId);
    const receivedPosition = receiver?.position ?? ball.flight.to;
    return {
      position: { ...receivedPosition },
      possessorId: ball.flight.receiverId,
      status: "POSSESSED",
      flight: null
    };
  }

  const flight = { ...ball.flight, elapsedSeconds, from: { ...ball.flight.from }, to: { ...ball.flight.to } };
  return {
    position: interpolateFlightPosition(flight, elapsedSeconds),
    possessorId: null,
    status: "IN_FLIGHT",
    flight
  };
}

export function step(state: HandballState, input: SimulationInput = {}, dt: number): HandballState {
  assertValidDeltaTime(dt);

  const offensiveCommandedState = (input.actions ?? []).reduce((current, action) => {
    assertSupportedCommand(action);
    return applyCommand(current, action);
  }, cloneHandballState(state));

  const reaction = input.defensivePolicy?.(offensiveCommandedState) ?? null;
  const commandedState = reaction
    ? {
        ...reaction.actions.reduce((current, action) => applyMoveCommand(current, action), offensiveCommandedState),
        defense: {
          ...offensiveCommandedState.defense,
          lastReaction: reaction
        }
      }
    : offensiveCommandedState;

  const players = commandedState.players.map((player) => advancePlayerMovement(player, dt));
  const possessor =
    commandedState.ball.possessorId === null ? null : players.find((player) => player.id === commandedState.ball.possessorId);

  const ball =
    commandedState.ball.status === "POSSESSED" && possessor
      ? { ...commandedState.ball, position: { ...possessor.position }, flight: null }
      : advanceBall(commandedState.ball, players, dt);

  return {
    ...commandedState,
    simulationTime: commandedState.simulationTime + dt,
    players,
    ball
  };
}
