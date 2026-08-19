import type { HandballState } from "../../domain/handball/state";
import { getDefenseZoneAtPosition } from "../../domain/geometry/zones";
import type { DefensiveThreatObservation } from "./types";

function clonePoint(point: { x: number; y: number }) {
  return Object.freeze({ x: point.x, y: point.y });
}

export function observeDefensiveThreat(state: HandballState): DefensiveThreatObservation {
  if (state.ball.status !== "POSSESSED" || state.ball.possessorId === null) {
    return Object.freeze({
      type: "NO_DIRECT_BALL_THREAT",
      ballPosition: clonePoint(state.ball.position)
    });
  }

  const ballCarrier = state.players.find((player) => player.id === state.ball.possessorId && player.team === "ATTACK");
  if (!ballCarrier) {
    return Object.freeze({
      type: "NO_DIRECT_BALL_THREAT",
      ballPosition: clonePoint(state.ball.position)
    });
  }

  const carrierPosition = clonePoint(ballCarrier.position);
  const currentZone = getDefenseZoneAtPosition(ballCarrier.position);

  if (ballCarrier.intent.type === "ATTACK" && !ballCarrier.intent.completed) {
    return Object.freeze({
      type: "ACTIVE_ATTACK_THREAT",
      ballCarrierId: ballCarrier.id,
      attackerId: ballCarrier.id,
      ballPosition: clonePoint(state.ball.position),
      carrierPosition,
      activeAttackGapId: ballCarrier.intent.gapId,
      attackTarget: clonePoint(ballCarrier.intent.target),
      currentZone,
      threatPosition: carrierPosition
    });
  }

  return Object.freeze({
    type: "POSSESSION_THREAT",
    ballCarrierId: ballCarrier.id,
    ballPosition: clonePoint(state.ball.position),
    carrierPosition,
    currentZone,
    threatPosition: carrierPosition
  });
}
