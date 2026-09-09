import { applyExertion, effectiveMovementProfile } from "./condition";
import {
  addVectors,
  distanceBetween,
  normalizeVector,
  scaleVector,
  subtractPoints,
  vectorLength,
  ZERO_VECTOR,
  type MeterPoint,
  type MeterVector
} from "../domain/geometry/coordinates";
import type { Player } from "../domain/handball/player";

export const MOVEMENT_EPSILON_METERS = 1e-6;

export type ReachabilityResult = {
  reachable: boolean;
  estimatedTime: number;
  distance: number;
};

function speed(velocity: MeterVector): number {
  return vectorLength(velocity);
}

export function canReach(player: Player, target: MeterPoint, timeAvailable: number): ReachabilityResult {
  if (timeAvailable < 0) {
    throw new Error("timeAvailable must be non-negative.");
  }

  const distance = distanceBetween(player.position, target);
  const profile = player.movementProfile;
  const initialSpeed = Math.min(speed(player.velocity), profile.maxSpeed);
  const timeToMaxSpeed = Math.max(0, (profile.maxSpeed - initialSpeed) / profile.acceleration);
  const distanceWhileAccelerating = initialSpeed * timeToMaxSpeed + 0.5 * profile.acceleration * timeToMaxSpeed ** 2;
  const estimatedTime =
    distance <= MOVEMENT_EPSILON_METERS
      ? 0
      : distance <= distanceWhileAccelerating
      ? (-initialSpeed + Math.sqrt(initialSpeed ** 2 + 2 * profile.acceleration * distance)) / profile.acceleration
      : timeToMaxSpeed + (distance - distanceWhileAccelerating) / profile.maxSpeed;

  return Object.freeze({
    reachable: estimatedTime <= timeAvailable + MOVEMENT_EPSILON_METERS,
    estimatedTime,
    distance
  });
}

export function advancePlayerMovement(player: Player, dt: number): Player {
  if ((player.intent.type !== "MOVE" && player.intent.type !== "ATTACK") || player.intent.completed || dt === 0) {
    // M25: standing on a court is not free, but it is nearly free.
    return applyExertion({ ...player, velocity: { ...player.velocity } }, 0, 0, dt);
  }

  // M25: what he can produce right now. A tired player accelerates less and
  // tops out lower, and because this is the same profile the reach model reads,
  // what he can be seen to do and what he actually does stay the same thing.
  const capability = effectiveMovementProfile(player);
  const speedBefore = speed(player.velocity);

  const targetVector = subtractPoints(player.intent.target, player.position);
  const distance = vectorLength(targetVector);
  if (distance <= MOVEMENT_EPSILON_METERS) {
    return applyExertion(
      { ...player, position: { ...player.intent.target }, velocity: ZERO_VECTOR, intent: { type: "IDLE" } },
      0,
      speedBefore,
      dt,
    );
  }

  const direction = normalizeVector(targetVector);
  const currentSpeed = Math.min(speedBefore, capability.maxSpeed);
  const acceleratedSpeed = Math.min(capability.maxSpeed, currentSpeed + capability.acceleration * dt);
  const maxTravel = acceleratedSpeed * dt;

  if (maxTravel >= distance - MOVEMENT_EPSILON_METERS) {
    return applyExertion(
      {
        ...player,
        position: { ...player.intent.target },
        facing: direction,
        velocity: ZERO_VECTOR,
        intent: { type: "IDLE" },
      },
      distance,
      speedBefore,
      dt,
    );
  }

  const velocity = scaleVector(direction, acceleratedSpeed);
  const position = addVectors(player.position, scaleVector(direction, maxTravel));

  return applyExertion(
    { ...player, position, facing: direction, velocity, intent: { ...player.intent, completed: false } },
    maxTravel,
    acceleratedSpeed - speedBefore,
    dt,
  );
}
