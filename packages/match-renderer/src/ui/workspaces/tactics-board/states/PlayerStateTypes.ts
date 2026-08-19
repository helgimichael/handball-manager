export type PlayerStateType = "DEFENSIVE_STANCE";

export type PlayerStateStyle = {
  stroke: string;
  strokeWidth: number;
  opacity: number;
  armLength: number;
  armGap: number;
};

export type PlayerState = {
  id: string;
  type: PlayerStateType;
  playerId: string;
  style: PlayerStateStyle;
};
