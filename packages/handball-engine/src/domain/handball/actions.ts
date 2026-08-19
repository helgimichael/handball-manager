import type { MeterPoint } from "../geometry/coordinates";
import type { AttackGapId } from "../geometry/attackGaps";

export type MoveAction = {
  type: "MOVE";
  playerId: string;
  target: MeterPoint;
};

export type PassAction = {
  type: "PASS";
  fromPlayerId: string;
  toPlayerId: string;
};

export type AttackAction = {
  type: "ATTACK";
  playerId: string;
  gapId: AttackGapId;
  target?: MeterPoint;
};

export type HandballAction = MoveAction | PassAction | AttackAction;
