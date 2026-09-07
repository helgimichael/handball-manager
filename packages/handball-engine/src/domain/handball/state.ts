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

/**
 * MATCH-EXPERIENCE-2.0 M11: an exchange that is under way on the court.
 *
 * A rolling substitution completes DURING live play, on whichever fixed step
 * the outgoing player actually reaches his substitution area. That instant is
 * only visible inside the step loop, so the exchange has to travel with the
 * spatial state rather than being held by the flow layer and applied at the
 * next segment boundary -- otherwise a man who got to the line early would
 * stand there, out of his team's shape, until the possession happened to end.
 *
 * The entity coming on is carried here so the swap needs nothing but the state
 * itself: no engine ever has to know what a bench is.
 */
export type CourtExchange = {
  readonly outgoingPlayerId: string;
  /** The man waiting to come on. He is NOT in `players` until the swap happens. */
  readonly incoming: Player;
  /** Null while the outgoing player is still walking; the simulation time of the swap once it has happened. */
  readonly completedAtSimulationTime: number | null;
};

export type HandballState = {
  simulationTime: number;
  players: readonly Player[];
  ball: Ball;
  defense: DefenseState;
  /** M11: substitutions in progress. Absent in every state that has no bench behind it. */
  exchanges?: readonly CourtExchange[];
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
    // Carried explicitly: this clone builds its result field by field, so an
    // exchange in progress would otherwise be dropped on the very next step.
    ...(state.exchanges ? { exchanges: state.exchanges.map((exchange) => ({ ...exchange })) } : {}),
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
