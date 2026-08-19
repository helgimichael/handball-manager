import type { Ball } from "./ball";
import type { DefenseRole, Player } from "./player";
import type { MeterPoint } from "../geometry/coordinates";
import type { DefensivePolicyResult, DefensiveThreat } from "../../policies/defense/types";

export type DefensiveHomePosition = {
  playerId: string;
  role: DefenseRole;
  position: MeterPoint;
};

export type DefenseState = {
  formationId: string;
  homePositions: readonly DefensiveHomePosition[];
  lastReaction: DefensivePolicyResult | null;
};

export type HandballState = {
  simulationTime: number;
  players: readonly Player[];
  ball: Ball;
  defense: DefenseState;
};

function cloneDefensiveThreat(threat: DefensiveThreat): DefensiveThreat {
  if (threat.type === "ACTIVE_ATTACK_THREAT") {
    return {
      ...threat,
      ballPosition: { ...threat.ballPosition },
      carrierPosition: { ...threat.carrierPosition },
      attackTarget: { ...threat.attackTarget },
      currentZone: threat.currentZone,
      threatPosition: { ...threat.threatPosition }
    };
  }
  if (threat.type === "POSSESSION_THREAT") {
    return {
      ...threat,
      ballPosition: { ...threat.ballPosition },
      carrierPosition: { ...threat.carrierPosition },
      currentZone: threat.currentZone,
      threatPosition: { ...threat.threatPosition }
    };
  }
  return {
    ...threat,
    ballPosition: { ...threat.ballPosition }
  };
}

export function cloneHandballState(state: HandballState): HandballState {
  return {
    simulationTime: state.simulationTime,
    players: state.players.map((player) => ({
      ...player,
      position: { ...player.position },
      facing: { ...player.facing },
      velocity: { ...player.velocity },
      movementProfile: { ...player.movementProfile },
      intent:
        player.intent.type === "MOVE"
          ? { type: "MOVE", target: { ...player.intent.target }, completed: player.intent.completed }
          : player.intent.type === "ATTACK"
          ? { type: "ATTACK", gapId: player.intent.gapId, target: { ...player.intent.target }, completed: player.intent.completed }
          : { type: "IDLE" }
    })),
    ball: {
      position: { ...state.ball.position },
      possessorId: state.ball.possessorId,
      status: state.ball.status,
      flight: state.ball.flight
        ? {
            ...state.ball.flight,
            from: { ...state.ball.flight.from },
            to: { ...state.ball.flight.to }
          }
        : null
    },
    defense: {
      formationId: state.defense.formationId,
      homePositions: state.defense.homePositions.map((home) => ({
        playerId: home.playerId,
        role: home.role,
        position: { ...home.position }
      })),
      lastReaction: state.defense.lastReaction
        ? {
            ...state.defense.lastReaction,
            activeThreat: state.defense.lastReaction.activeThreat ? cloneDefensiveThreat(state.defense.lastReaction.activeThreat) : null,
            supportDefenderIds: [...state.defense.lastReaction.supportDefenderIds],
            responsibilities: state.defense.lastReaction.responsibilities.map((responsibility) => ({ ...responsibility })),
            reactions: state.defense.lastReaction.reactions.map((reaction) => ({
              ...reaction,
              target: { ...reaction.target }
            })),
            actions: state.defense.lastReaction.actions.map((action) => ({
              ...action,
              target: { ...action.target }
            }))
          }
        : null
    }
  };
}
