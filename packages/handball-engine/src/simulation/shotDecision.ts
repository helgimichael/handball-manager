/**
 * MATCH-EXPERIENCE-2.0 M9: choosing a shot.
 *
 * The old model asked one question -- "does this go in?" -- and answered it
 * with two probabilities built from distance, angle and pressure. The shot had
 * no target, so there was nothing for a goalkeeper to be beaten by, and the
 * keeper's own position entered only as a number that never changed because he
 * never moved.
 *
 * A shot is now an intention aimed at a POINT: somewhere across the three
 * metres of goal mouth, at a height, chosen by looking at what the keeper has
 * left open. The shooter reads the same geometry the keeper reads
 * (goalWindowFrom), scores the options actually available to him, and commits.
 * Whether it goes in is then settled by where the ball crosses the line
 * against where the keeper got to -- not here.
 *
 * The vocabulary is deliberately six intentions. It is enough to tell a wing's
 * near-post shot from a back's bounce shot from a lob over an advanced keeper,
 * and small enough to stay inspectable.
 */
import { GOAL_POST_LEFT_X, GOAL_POST_RIGHT_X } from "../domain/geometry/court";
import { distanceBetween, type MeterPoint } from "../domain/geometry/coordinates";
import { goalCentre, type AttackingGoalSide } from "../domain/match/possession";
import {
  GOALKEEPER_LIMITS,
  SHOT_HEIGHT_METERS,
  goalWindowFrom,
  goalkeeperAdvance,
  type GoalWindow,
  type ShotHeight,
} from "../policies/goalkeeper/goalkeeperPolicy";
import type { Player } from "../domain/handball/player";
import type { HandballState } from "../domain/handball/state";
import type { PossessionRng } from "./possessionRng";

const DEFAULT_RATING = 10;

/** Per-player ratings the shot reads. 1-20. */
export type ShotPlayerRatings = {
  readonly shooting?: number;
  /** Willingness to try the difficult shot rather than the safe one. */
  readonly attacking?: number;
};

/** The six shot intentions M9 supports. */
export const SHOT_INTENTIONS = ["NEAR_LOW", "NEAR_HIGH", "FAR_LOW", "FAR_HIGH", "CENTRE_POWER", "LOB"] as const;
export type ShotIntention = (typeof SHOT_INTENTIONS)[number];

export const SHOT_LIMITS = Object.freeze({
  /** Ball speed at a neutral rating, in m/s. A lob is floated instead. */
  baseSpeedMetersPerSecond: 20,
  lobSpeedMetersPerSecond: 12,
  /** A defender this close to the shot line, and this close to the shooter, can get a hand to it. */
  blockLaneMeters: 0.55,
  blockRangeMeters: 2.6,
  /** Wider than this from the goal centre and the ball is past the post. */
  postMarginMeters: 0.05,
  /** How far inside the post a shooter aims when the window is wide open. */
  postInsetMeters: 0.28,
});

export type ShotPerception = {
  readonly shooter: Player;
  readonly goal: MeterPoint;
  readonly distance: number;
  /** 0 (from the goal line, no angle) to 1 (dead centre). */
  readonly angleQuality: number;
  /** 0 (free) to 1 (a defender on top of him). */
  readonly pressure: number;
  readonly nearestDefenderId: string | null;
  readonly keeper: Player | null;
  readonly keeperAdvance: number;
  readonly window: GoalWindow;
  /** How fast he is travelling -- a shot on the run is a different shot. */
  readonly speed: number;
};

/** How square the shooter is to the goal, 0..1. */
export function shootingAngleQuality(origin: MeterPoint, goal: MeterPoint): number {
  const lateral = Math.abs(origin.x - goal.x);
  const depth = Math.abs(origin.y - goal.y);
  if (depth <= 0.01) return 0;
  return Math.max(0, Math.min(1, depth / (depth + lateral)));
}

export function perceiveShot(state: HandballState, shooter: Player, goalSide: AttackingGoalSide): ShotPerception {
  const goal = goalCentre(goalSide);
  const keeper = state.players.find((p) => p.team === "DEFENSE" && p.kind === "GOALKEEPER") ?? null;
  let nearest = Number.POSITIVE_INFINITY;
  let nearestDefenderId: string | null = null;
  for (const defender of state.players) {
    if (defender.team !== "DEFENSE" || defender.kind !== "FIELD_PLAYER") continue;
    const d = distanceBetween(defender.position, shooter.position);
    if (d < nearest) {
      nearest = d;
      nearestDefenderId = defender.id;
    }
  }
  const keeperPosition = keeper?.position ?? { x: goal.x, y: goal.y };
  return {
    shooter,
    goal,
    distance: distanceBetween(shooter.position, goal),
    angleQuality: shootingAngleQuality(shooter.position, goal),
    pressure: Math.max(0, Math.min(1, 1 - (Number.isFinite(nearest) ? nearest : 99) / 4)),
    nearestDefenderId,
    keeper,
    keeperAdvance: keeper ? goalkeeperAdvance(keeper.position, goalSide) : 0,
    window: goalWindowFrom(shooter.position, keeperPosition, goalSide),
    speed: Math.hypot(shooter.velocity.x, shooter.velocity.y),
  };
}

export type ShotOption = {
  readonly intention: ShotIntention;
  readonly score: number;
  /** Where on the goal line he is aiming, and how high. */
  readonly targetX: number;
  readonly height: ShotHeight;
  /** The open goal he is aiming into, in metres. */
  readonly windowMeters: number;
  readonly detail: string;
};

export type ShotDecision = {
  readonly intention: ShotIntention;
  readonly targetX: number;
  readonly height: ShotHeight;
  readonly speedMetersPerSecond: number;
  readonly options: readonly ShotOption[];
  readonly detail: string;
};

/** Small seeded noise, so two identical geometries need not always agree. */
const DECISION_NOISE = 0.07;

/**
 * Picks the shot. Every option is scored on the goal actually available to it:
 * how much open mouth there is on that side, how hard the placement is from
 * this distance and angle, whether the keeper has left the lob on, and how
 * much the shooter is being harried.
 */
export function decideShot(
  perception: ShotPerception,
  rng: PossessionRng,
  ratings?: Readonly<Record<string, ShotPlayerRatings>>,
): ShotDecision {
  const shooting = ratings?.[perception.shooter.id]?.shooting ?? DEFAULT_RATING;
  const attacking = ratings?.[perception.shooter.id]?.attacking ?? DEFAULT_RATING;
  const noise = () => (rng.nextFloat() - 0.5) * 2 * DECISION_NOISE;
  const window = perception.window;
  const options: ShotOption[] = [];

  /** Aim inside the window, a little off the post rather than at it. */
  const aimAt = (gap: { fromX: number; toX: number; width: number }, postX: number): number => {
    if (gap.width <= 0.1) return postX === GOAL_POST_LEFT_X ? GOAL_POST_LEFT_X + SHOT_LIMITS.postInsetMeters : GOAL_POST_RIGHT_X - SHOT_LIMITS.postInsetMeters;
    const centre = (gap.fromX + gap.toX) / 2;
    // With a big window he can afford the corner; with a small one he takes its middle.
    const towardPost = postX === GOAL_POST_LEFT_X ? GOAL_POST_LEFT_X + SHOT_LIMITS.postInsetMeters : GOAL_POST_RIGHT_X - SHOT_LIMITS.postInsetMeters;
    return gap.width > 1.0 ? towardPost : centre;
  };

  // Placement gets harder with distance, with a tight angle and under pressure;
  // a better shooter loses less to all three.
  const execution = 0.5 + 0.03 * (shooting - DEFAULT_RATING) - perception.distance * 0.02 - (1 - perception.angleQuality) * 0.35 - perception.pressure * 0.3;

  const sides: { key: "NEAR" | "FAR"; gap: typeof window.nearWindow; postX: number }[] = [
    { key: "NEAR", gap: window.nearWindow, postX: window.nearPostX },
    { key: "FAR", gap: window.farWindow, postX: window.farPostX },
  ];
  for (const side of sides) {
    const targetX = aimAt(side.gap, side.postX);
    for (const height of ["LOW", "HIGH"] as const) {
      // Long shots are bounced low; close range is finished high over the
      // keeper's legs. Both remain available -- this is a lean, not a rule.
      const heightFit = height === "LOW" ? (perception.distance > 7.5 ? 0.12 : -0.05) : perception.distance > 7.5 ? -0.05 : 0.12;
      const score = 0.15 + 0.35 * Math.min(1.5, side.gap.width) + heightFit + 0.25 * execution + noise();
      options.push({
        intention: `${side.key}_${height}` as ShotIntention,
        score,
        targetX,
        height,
        windowMeters: side.gap.width,
        detail: `${side.key === "NEAR" ? "near" : "far"} post ${height.toLowerCase()}, ${side.gap.width.toFixed(2)}m of open goal`,
      });
    }
  }

  // Straight through him: no placement required, so it survives pressure and
  // a bad angle better than a corner does, but he is standing there.
  options.push({
    intention: "CENTRE_POWER",
    score: 0.15 + 0.2 * (1 - Math.min(1, window.shadowHalfWidth)) + 0.02 * (shooting - DEFAULT_RATING) + 0.2 * perception.pressure + noise(),
    targetX: window.shadowCentreX + (window.shadowCentreX <= perception.goal.x ? 0.35 : -0.35),
    height: "HIGH",
    windowMeters: Math.max(0, 1.5 - window.shadowHalfWidth),
    detail: `power past him, his shadow is ${(window.shadowHalfWidth * 2).toFixed(2)}m wide`,
  });

  // The lob only exists because he has come out. It needs nerve and touch.
  const lobExposure = Math.max(0, perception.keeperAdvance - GOALKEEPER_LIMITS.lobExposureAdvanceMeters);
  options.push({
    intention: "LOB",
    score:
      -0.05 +
      1.1 * lobExposure +
      0.03 * (attacking - DEFAULT_RATING) +
      0.02 * (shooting - DEFAULT_RATING) -
      0.35 * perception.pressure -
      0.03 * perception.distance +
      noise(),
    targetX: perception.goal.x + (perception.shooter.position.x <= perception.goal.x ? 0.5 : -0.5),
    height: "LOB",
    windowMeters: lobExposure,
    detail: lobExposure > 0 ? `he is ${perception.keeperAdvance.toFixed(1)}m off his line` : `he is on his line, no lob on`,
  });

  options.sort((a, b) => b.score - a.score || a.intention.localeCompare(b.intention));
  const chosen = options[0];
  const speed =
    chosen.height === "LOB"
      ? SHOT_LIMITS.lobSpeedMetersPerSecond
      : SHOT_LIMITS.baseSpeedMetersPerSecond + 0.4 * (shooting - DEFAULT_RATING) + (chosen.intention === "CENTRE_POWER" ? 1.5 : 0);
  return {
    intention: chosen.intention,
    targetX: chosen.targetX,
    height: chosen.height,
    speedMetersPerSecond: Math.max(9, speed),
    options,
    detail: chosen.detail,
  };
}

/**
 * How far the shot actually lands from where it was aimed. Distance, a tight
 * angle, pressure and being off balance all widen it; ability narrows it.
 *
 * This is where the RNG belongs: it perturbs the INPUT to the contest, and
 * never the contest itself.
 */
export function executionSpreadMeters(perception: ShotPerception, intention: ShotIntention, shooting: number): number {
  const base = 0.16 + perception.distance * 0.022 + perception.pressure * 0.34 + (1 - perception.angleQuality) * 0.3;
  const difficulty = intention === "LOB" ? 0.18 : intention === "CENTRE_POWER" ? -0.04 : 0.06;
  const onTheRun = Math.min(0.12, perception.speed * 0.03);
  return Math.max(0.05, base + difficulty + onTheRun - 0.016 * (shooting - DEFAULT_RATING));
}

/** A symmetric, bounded error: the sum of two uniforms, which clusters near the target. */
export function sampleError(rng: PossessionRng, spread: number): number {
  return (rng.nextFloat() + rng.nextFloat() - 1) * spread;
}

/** Where the ball ends up, in goal-mouth coordinates and height. */
export function shotLanding(decision: ShotDecision, lateralError: number, heightError: number): { x: number; height: number } {
  return {
    x: decision.targetX + lateralError,
    height: Math.max(0.05, SHOT_HEIGHT_METERS[decision.height] + heightError),
  };
}

/** True when the ball crossed between the posts and under the bar. */
export function isOnTarget(landing: { x: number; height: number }): boolean {
  return (
    landing.x >= GOAL_POST_LEFT_X - SHOT_LIMITS.postMarginMeters &&
    landing.x <= GOAL_POST_RIGHT_X + SHOT_LIMITS.postMarginMeters &&
    landing.height <= 2
  );
}
