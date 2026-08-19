import type { MeterPoint } from "../geometry/CourtTransform.ts";
import { anchorPointFromMeterPoint } from "../spatial/AnchorPoint.ts";
import { getPlayerActionDefinition } from "./PlayerActionRegistry.ts";
import type { PlayerAction, PlayerActionStyle, PlayerActionType } from "./PlayerActionTypes.ts";

export type CreatePlayerActionInput = {
  id: string;
  type: PlayerActionType;
  playerId: string;
  playerPosition: MeterPoint;
  screenPosition: MeterPoint;
  style?: Partial<PlayerActionStyle>;
};

function clampScreenPosition(playerPosition: MeterPoint, screenPosition: MeterPoint, maxLength: number): MeterPoint {
  const dx = screenPosition.x - playerPosition.x;
  const dy = screenPosition.y - playerPosition.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= maxLength || distance === 0) {
    return screenPosition;
  }
  const scale = maxLength / distance;
  return {
    x: playerPosition.x + dx * scale,
    y: playerPosition.y + dy * scale,
  };
}

export function createPlayerAction(input: CreatePlayerActionInput): PlayerAction {
  const definition = getPlayerActionDefinition(input.type);
  const screenPosition = clampScreenPosition(input.playerPosition, input.screenPosition, definition.maxLengthMeters);
  const style = Object.freeze({
    ...definition.style,
    ...input.style,
  });

  return Object.freeze({
    id: input.id,
    type: input.type,
    playerId: input.playerId,
    playerAnchor: Object.freeze({
      fallbackPosition: Object.freeze({ x: input.playerPosition.x, y: input.playerPosition.y }),
      constraint: Object.freeze({
        kind: "ANCHORED",
        target: Object.freeze({ kind: "BOARD_OBJECT", objectId: input.playerId }),
        attachment: Object.freeze({ kind: "CAPABILITY", capability: "CENTER" }),
      }),
    }),
    screenAnchor: anchorPointFromMeterPoint(screenPosition),
    style,
  });
}

export function setPlayerActionScreenPosition(action: PlayerAction, screenPosition: MeterPoint): PlayerAction {
  return Object.freeze({
    ...action,
    screenAnchor: anchorPointFromMeterPoint(screenPosition),
  });
}
