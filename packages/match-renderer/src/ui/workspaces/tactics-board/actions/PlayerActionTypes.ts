import type { AnchorPoint } from "../spatial/AnchorPoint.ts";

export type PlayerActionType = "SCREEN" | "GOALKEEPER_LUNGE";

export type PlayerActionStyle = {
  stroke: string;
  strokeWidth: number;
  opacity: number;
  symbolWidth: number;
  symbolDepth: number;
};

export type PlayerAction = {
  id: string;
  type: PlayerActionType;
  playerId: string;
  playerAnchor: AnchorPoint;
  screenAnchor: AnchorPoint;
  style: PlayerActionStyle;
};

export type ResolvedPlayerAction = Omit<PlayerAction, "playerAnchor" | "screenAnchor"> & {
  playerPosition: {
    x: number;
    y: number;
  };
  screenPosition: {
    x: number;
    y: number;
  };
};
