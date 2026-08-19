import type { BoardObjectType } from "../scene/BoardObject.ts";
import type { PlayerActionStyle, PlayerActionType } from "./PlayerActionTypes.ts";

export type PlayerActionDefinition = {
  type: PlayerActionType;
  label: string;
  maxLengthMeters: number;
  style: PlayerActionStyle;
};

const PLAYER_ACTIONS_BY_OBJECT_TYPE: Record<BoardObjectType, readonly PlayerActionType[]> = {
  ATTACKER: ["SCREEN"],
  DEFENDER: [],
  GOALKEEPER: ["GOALKEEPER_LUNGE"],
  BALL: [],
  CONE: [],
};

export const PLAYER_ACTION_REGISTRY: Record<PlayerActionType, PlayerActionDefinition> = {
  SCREEN: {
    type: "SCREEN",
    label: "Screen",
    maxLengthMeters: 5,
    style: {
      stroke: "var(--ds-color-text)",
      strokeWidth: 0.1,
      opacity: 0.92,
      symbolWidth: 0.62,
      symbolDepth: 0.22,
    },
  },
  GOALKEEPER_LUNGE: {
    type: "GOALKEEPER_LUNGE",
    label: "Goalkeeper Lunge",
    maxLengthMeters: 3,
    style: {
      stroke: "var(--ds-color-warning)",
      strokeWidth: 0.1,
      opacity: 0.94,
      symbolWidth: 0.72,
      symbolDepth: 0.34,
    },
  },
};

export function getPlayerActionDefinition(type: PlayerActionType): PlayerActionDefinition {
  return PLAYER_ACTION_REGISTRY[type];
}

export function getAvailablePlayerActions(objectType: BoardObjectType): readonly PlayerActionDefinition[] {
  return PLAYER_ACTIONS_BY_OBJECT_TYPE[objectType].map(getPlayerActionDefinition);
}
