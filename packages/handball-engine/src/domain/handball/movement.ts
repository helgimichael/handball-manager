import type { MeterPoint, MeterVector } from "../geometry/coordinates";
import type { AttackGapId } from "../geometry/attackGaps";

export type MovementProfile = {
  maxSpeed: number;
  acceleration: number;
  deceleration: number;
};

export const DEFAULT_MOVEMENT_PROFILE: MovementProfile = Object.freeze({
  maxSpeed: 4.2,
  acceleration: 3.0,
  deceleration: 4.0
});

export type MovementIntent = {
  type: "MOVE";
  target: MeterPoint;
  completed: boolean;
};

export type IdleIntent = {
  type: "IDLE";
};

export type AttackIntent = {
  type: "ATTACK";
  gapId: AttackGapId;
  target: MeterPoint;
  completed: boolean;
};

export type PlayerIntent = IdleIntent | MovementIntent | AttackIntent;

export function isZeroVelocity(velocity: MeterVector): boolean {
  return velocity.x === 0 && velocity.y === 0;
}
