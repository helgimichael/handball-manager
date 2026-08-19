import type { BoardObjectType } from "../scene/BoardObject.ts";
import type { PlayerStateStyle, PlayerStateType } from "./PlayerStateTypes.ts";

export type PlayerStateDefinition = {
  type: PlayerStateType;
  label: string;
  style: PlayerStateStyle;
};

const PLAYER_STATES_BY_OBJECT_TYPE: Record<BoardObjectType, readonly PlayerStateType[]> = {
  ATTACKER: [],
  DEFENDER: ["DEFENSIVE_STANCE"],
  GOALKEEPER: [],
  BALL: [],
  CONE: [],
};

export const PLAYER_STATE_REGISTRY: Record<PlayerStateType, PlayerStateDefinition> = {
  DEFENSIVE_STANCE: {
    type: "DEFENSIVE_STANCE",
    label: "Defensive Stance",
    style: {
      stroke: "var(--ds-color-info)",
      strokeWidth: 0.08,
      opacity: 0.96,
      armLength: 0.42,
      armGap: 0.18,
    },
  },
};

export function getPlayerStateDefinition(type: PlayerStateType): PlayerStateDefinition {
  return PLAYER_STATE_REGISTRY[type];
}

export function getAvailablePlayerStates(objectType: BoardObjectType): readonly PlayerStateDefinition[] {
  return PLAYER_STATES_BY_OBJECT_TYPE[objectType].map(getPlayerStateDefinition);
}
