/**
 * MATCH-EXPERIENCE-2.0 M9: the goalkeeper as a spatial player.
 *
 * Until now the goalkeeper was furniture. He was never issued a single MOVE
 * command anywhere in the engine, so he stood on his canonical spot for the
 * whole match, and "saving" was a probability that read his distance from the
 * goal -- a number that never changed because he never moved.
 *
 * He now does three things, all of them spatial:
 *
 *   POSITION  between the ball and his goal, advanced off his line by an
 *             amount that depends on how close the ball is. Coming out cuts
 *             the angle -- and the geometry says so literally, because his
 *             shadow on the goal mouth grows as he advances.
 *   READ      at the moment of release he commits to a side and a height,
 *             from the SAME geometry the shooter is reading. He is never told
 *             where the ball is actually going; a better keeper simply reads
 *             it right more often.
 *   REACT     he moves toward the point he committed to, after a reaction
 *             delay, and either gets there or does not.
 *
 * Whether the shot is saved is then ordinary geometry: the gap between where
 * the ball crosses the line and where the keeper actually got to, against how
 * far he can reach. No save probability is ever drawn.
 */
import { GOAL_POST_LEFT_X, GOAL_POST_RIGHT_X } from "../../domain/geometry/court";
import { distanceBetween, type MeterPoint } from "../../domain/geometry/coordinates";
import { goalCentre, type AttackingGoalSide } from "../../domain/match/possession";
import type { PossessionRng } from "../../simulation/possessionRng";

const DEFAULT_RATING = 10;

/** The goal is 2m high. The engine is top-down, so height is carried as a number rather than an axis. */
export const GOAL_HEIGHT_METERS = 2;

/** Heights a shot and a keeper can commit to. */
export type ShotHeight = "LOW" | "HIGH" | "LOB";

export const SHOT_HEIGHT_METERS: Readonly<Record<ShotHeight, number>> = Object.freeze({
  LOW: 0.35,
  HIGH: 1.6,
  LOB: 1.9,
});

export const GOALKEEPER_LIMITS = Object.freeze({
  /** How wide the keeper is, for the shadow he casts across the goal mouth. */
  shoulderHalfWidthMeters: 0.5,
  /** Least and most he will stand off his line. */
  minAdvanceMeters: 0.4,
  maxAdvanceMeters: 2.6,
  /** How far he can reach at a neutral rating, beyond wherever he has got to. */
  baseReachMeters: 0.85,
  /** Reach left when he committed to the wrong height. */
  wrongHeightReachFactor: 0.5,
  /** Reach left against a lob when he has come off his line. */
  beatenByLobReachFactor: 0.2,
  /** An advance beyond this leaves the lob genuinely on. */
  lobExposureAdvanceMeters: 1.2,
  /** Reaction delay at a neutral rating, in seconds. */
  baseReactionSeconds: 0.25,
});

/** 1..20 -> the rating the keeper actually plays at. */
function keeperRating(ratings: Readonly<Record<string, { shotStopping?: number }>> | undefined, keeperId: string): number {
  return ratings?.[keeperId]?.shotStopping ?? DEFAULT_RATING;
}

// ---------------------------------------------------------------------------
// Positioning
// ---------------------------------------------------------------------------

/**
 * Where the keeper stands right now: on the line from the ball to the centre
 * of his goal, advanced off the line by more the closer the ball is.
 *
 * That is the whole of angle play. A shot from 10m finds him almost on his
 * line; a breakthrough finds him out at the edge of his area, having made
 * himself much bigger -- and much easier to lob.
 */
export function goalkeeperSetPosition(
  ball: MeterPoint,
  defendedGoal: AttackingGoalSide,
  ratings?: Readonly<Record<string, { shotStopping?: number }>>,
  keeperId?: string,
): MeterPoint {
  const goal = goalCentre(defendedGoal);
  const distance = distanceBetween(ball, goal);
  const rating = keeperId ? keeperRating(ratings, keeperId) : DEFAULT_RATING;
  // He comes further out the closer the ball is. That is what cuts the angle
  // down -- and what leaves the lob on behind him.
  const advance = Math.max(
    GOALKEEPER_LIMITS.minAdvanceMeters,
    Math.min(GOALKEEPER_LIMITS.maxAdvanceMeters, 0.5 + (10 - distance) * 0.22 + (rating - DEFAULT_RATING) * 0.02),
  );
  // Advance is measured PERPENDICULAR to his line, not along the diagonal to
  // the ball: against a wing out by the corner flag the diagonal reading left
  // him standing 0.2m off his line, which is not what a keeper does.
  const depth = Math.abs(ball.y - goal.y);
  const lateral = depth < 0.4 ? 1 : Math.min(1, advance / depth);
  const x = goal.x + (ball.x - goal.x) * lateral;
  const y = goal.y + (defendedGoal === "TOP" ? advance : -advance);
  // He guards his goal; he does not follow the ball out to the wing.
  return {
    x: Math.max(GOAL_POST_LEFT_X - 0.6, Math.min(GOAL_POST_RIGHT_X + 0.6, x)),
    y,
  };
}

/** How far off his line he is standing. */
export function goalkeeperAdvance(keeper: MeterPoint, defendedGoal: AttackingGoalSide): number {
  return Math.abs(keeper.y - goalCentre(defendedGoal).y);
}

// ---------------------------------------------------------------------------
// The shadow he casts on the goal mouth
// ---------------------------------------------------------------------------

export type GoalWindow = {
  /** Where the keeper's body appears to be, projected onto the goal line from the shooter's eye. */
  readonly shadowCentreX: number;
  readonly shadowHalfWidth: number;
  /** The open gap on each side, in metres of goal mouth. */
  readonly nearWindow: { readonly fromX: number; readonly toX: number; readonly width: number };
  readonly farWindow: { readonly fromX: number; readonly toX: number; readonly width: number };
  /** Which post is nearer the shooter. */
  readonly nearPostX: number;
  readonly farPostX: number;
};

/**
 * What the goal looks like from where the shooter is standing.
 *
 * The keeper's shadow is a similar-triangles projection: the further he comes
 * off his line toward the shooter, the wider the band of goal he covers. Both
 * the shooter and the keeper read this same geometry -- that is what makes
 * the contest a contest rather than two independent dice.
 */
export function goalWindowFrom(shooter: MeterPoint, keeper: MeterPoint, defendedGoal: AttackingGoalSide): GoalWindow {
  const goalY = goalCentre(defendedGoal).y;
  // Which parts of the goal mouth can this shooter actually hit? Walk across
  // the three metres and ask, for each point, whether the keeper's body sits
  // on the line to it.
  //
  // This is deliberately an occlusion test rather than a projection. A
  // projection along y divides by the shooter's distance to the goal line, and
  // FIELD's canonical wings stand at y = 0.55 -- level with the goal -- where
  // that divisor collapses and the model reported the whole goal open from the
  // worst angle on the court. An occlusion test degrades correctly at every
  // geometry, including from the byline.
  const samples = 61;
  const stepX = (GOAL_POST_RIGHT_X - GOAL_POST_LEFT_X) / (samples - 1);
  let blockedFrom = Number.POSITIVE_INFINITY;
  let blockedTo = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < samples; i += 1) {
    const x = GOAL_POST_LEFT_X + i * stepX;
    if (distanceToSegment(keeper, shooter, { x, y: goalY }) <= GOALKEEPER_LIMITS.shoulderHalfWidthMeters) {
      blockedFrom = Math.min(blockedFrom, x);
      blockedTo = Math.max(blockedTo, x);
    }
  }
  const covers = blockedTo >= blockedFrom;
  const shadowCentreX = covers ? (blockedFrom + blockedTo) / 2 : Math.max(GOAL_POST_LEFT_X, Math.min(GOAL_POST_RIGHT_X, keeper.x));
  const shadowHalfWidth = covers ? (blockedTo - blockedFrom) / 2 : 0;
  const shadowLeft = covers ? blockedFrom : shadowCentreX;
  const shadowRight = covers ? blockedTo : shadowCentreX;

  const nearPostX = shooter.x <= 10 ? GOAL_POST_LEFT_X : GOAL_POST_RIGHT_X;
  const farPostX = shooter.x <= 10 ? GOAL_POST_RIGHT_X : GOAL_POST_LEFT_X;

  const leftGap = { fromX: GOAL_POST_LEFT_X, toX: Math.max(GOAL_POST_LEFT_X, shadowLeft), width: Math.max(0, shadowLeft - GOAL_POST_LEFT_X) };
  const rightGap = { fromX: Math.min(GOAL_POST_RIGHT_X, shadowRight), toX: GOAL_POST_RIGHT_X, width: Math.max(0, GOAL_POST_RIGHT_X - shadowRight) };

  return {
    shadowCentreX,
    shadowHalfWidth,
    nearWindow: shooter.x <= 10 ? leftGap : rightGap,
    farWindow: shooter.x <= 10 ? rightGap : leftGap,
    nearPostX,
    farPostX,
  };
}

/** Distance from a point to the segment a-b. */
function distanceToSegment(point: MeterPoint, a: MeterPoint, b: MeterPoint): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-9) return distanceBetween(point, a);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / len2));
  return distanceBetween(point, { x: a.x + abx * t, y: a.y + aby * t });
}

// ---------------------------------------------------------------------------
// The read
// ---------------------------------------------------------------------------

export type GoalkeeperRead = {
  /** Where along the goal line he has committed to going. */
  readonly commitX: number;
  readonly commitHeight: Exclude<ShotHeight, "LOB">;
  /** True when he went with the bigger window rather than being wrong-footed. */
  readonly readTheBigWindow: boolean;
  readonly detail: string;
};

/**
 * The keeper's commitment, made at release from the geometry in front of him.
 *
 * He expects the shooter to take the bigger window -- the same judgement the
 * shooter is making -- and goes there. A better keeper is fooled less often.
 * He is never shown the shot's actual target: when the shooter takes the
 * smaller window and the keeper does not go with him, the keeper is simply
 * wrong, and the goal that follows is the geometry of that mistake.
 */
export function readShot(
  window: GoalWindow,
  shooterDistance: number,
  keeperId: string,
  rng: PossessionRng,
  ratings?: Readonly<Record<string, { shotStopping?: number }>>,
): GoalkeeperRead {
  const rating = keeperRating(ratings, keeperId);
  const bigger = window.farWindow.width >= window.nearWindow.width ? window.farWindow : window.nearWindow;
  const smaller = bigger === window.farWindow ? window.nearWindow : window.farWindow;
  // How obvious the choice is: a lopsided goal mouth is easy to read.
  const total = bigger.width + smaller.width;
  const obviousness = total < 0.2 ? 0 : (bigger.width - smaller.width) / total;
  const readsIt = rng.chance(Math.max(0.15, Math.min(0.92, 0.45 + 0.02 * (rating - DEFAULT_RATING) + 0.3 * obviousness)));
  const chosen = readsIt ? bigger : smaller;
  const commitX = chosen.width < 0.05 ? window.shadowCentreX : (chosen.fromX + chosen.toX) / 2;
  // Long shots are dug out low (they are bounced); close ones go high.
  const expectLow = shooterDistance > 7.5;
  const heightRight = rng.chance(Math.max(0.2, Math.min(0.9, 0.5 + 0.02 * (rating - DEFAULT_RATING))));
  const commitHeight: Exclude<ShotHeight, "LOB"> = (expectLow ? heightRight : !heightRight) ? "LOW" : "HIGH";
  return {
    commitX,
    commitHeight,
    readTheBigWindow: readsIt,
    detail: `commits ${commitHeight.toLowerCase()} to x=${commitX.toFixed(2)} (${readsIt ? "reads the bigger window" : "goes the wrong way"})`,
  };
}

/** How long, in seconds, before he can start moving. */
export function reactionDelaySeconds(keeperId: string, ratings?: Readonly<Record<string, { shotStopping?: number }>>): number {
  const rating = keeperRating(ratings, keeperId);
  return Math.max(0.06, GOALKEEPER_LIMITS.baseReactionSeconds - 0.008 * (rating - DEFAULT_RATING));
}

// ---------------------------------------------------------------------------
// The save contest -- geometry, not probability
// ---------------------------------------------------------------------------

export type SaveContest = {
  readonly saved: boolean;
  /** Metres between where the ball crossed and where the keeper actually was. */
  readonly gapMeters: number;
  /** How far he could reach, after his read and the ball's height are taken into account. */
  readonly reachMeters: number;
  readonly detail: string;
};

/**
 * Did he get to it? The gap between the ball's crossing point and where the
 * keeper actually arrived, against how far he can reach from there.
 *
 * Nothing is rolled here. Every uncertainty -- the shooter's execution, the
 * keeper's read, his reaction -- has already been resolved into positions by
 * the time this is asked.
 */
export function attemptSave(
  crossingX: number,
  height: number,
  shotHeight: ShotHeight,
  keeperAtArrival: MeterPoint,
  keeperAdvanceMeters: number,
  read: GoalkeeperRead,
  keeperId: string,
  ratings?: Readonly<Record<string, { shotStopping?: number }>>,
): SaveContest {
  const rating = keeperRating(ratings, keeperId);
  let reach = GOALKEEPER_LIMITS.baseReachMeters + 0.03 * (rating - DEFAULT_RATING);
  const reasons: string[] = [];

  const committedBand = read.commitHeight === "LOW" ? height <= 1.0 : height >= 0.8;
  // A lob beats him over the top, not to one side. Once he has committed
  // himself off his line there is no lateral position that saves it -- being
  // directly underneath the ball is exactly where he does not want to be --
  // so this is the one case the lateral gap cannot express.
  const lobbedOverHim = shotHeight === "LOB" && keeperAdvanceMeters > GOALKEEPER_LIMITS.lobExposureAdvanceMeters;
  if (lobbedOverHim) {
    reach *= GOALKEEPER_LIMITS.beatenByLobReachFactor;
    reasons.push(`lobbed while ${keeperAdvanceMeters.toFixed(1)}m off his line`);
  } else if (!committedBand) {
    reach *= GOALKEEPER_LIMITS.wrongHeightReachFactor;
    reasons.push(`went ${read.commitHeight.toLowerCase()} to a ${shotHeight.toLowerCase()} shot`);
  }

  const gap = Math.abs(crossingX - keeperAtArrival.x);
  const saved = !lobbedOverHim && gap <= reach;
  return {
    saved,
    gapMeters: gap,
    reachMeters: reach,
    detail: `${gap.toFixed(2)}m from him, reach ${reach.toFixed(2)}m${reasons.length > 0 ? ` (${reasons.join("; ")})` : ""}`,
  };
}
