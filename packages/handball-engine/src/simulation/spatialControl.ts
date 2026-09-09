/**
 * MATCH-EXPERIENCE-2.0 M17: SPATIAL CONTROL 1.0.
 *
 * One shared answer to the question several parts of the engine keep asking in
 * their own dialect:
 *
 *   who gets to this point, or this lane, first -- and by how much?
 *
 * WHY THIS EXISTS. M8 already worked this out for the fast break, and the
 * reason it had to was measured: counting bodies said "no break" on every
 * regain, because immediately after a save every opponent is still up the other
 * end. A race answers what a head count cannot. The same is true a metre from
 * the six: a defender STANDING near a passing lane is not the same as a
 * defender who can REACH it before the ball does, and a gap that is wide in
 * metres is not open if the help defender arrives first. M17 generalises M8's
 * race into a primitive both the attack and the defence can use, in both
 * directions, for either team.
 *
 * WHAT IT DOES NOT DO. It never decides anything. It reports seconds. A margin
 * of +0.19s means "the attacker gets there roughly two tenths before the
 * defender could" -- it does not mean the pass is played, and it certainly does
 * not mean a goal. M6's utility layer still weighs the option against every
 * other option and still chooses. Spatial control changes how well an option is
 * understood, not what is done about it.
 *
 * EVERYTHING IT READS ALREADY EXISTS. Position, velocity, the movement profile
 * (top speed and acceleration) and a reaction allowance. No new attribute, no
 * hidden rating, no probability blob -- the output is seconds, and seconds can
 * be read, printed and argued with.
 */
import { effectiveMovementProfile } from "./condition";
import { distanceBetween } from "../domain/geometry/coordinates";
import type { MeterPoint, MeterVector } from "../domain/geometry/coordinates";
import type { Player } from "../domain/handball/player";

// ---------------------------------------------------------------------------
// Who is trying to get somewhere
// ---------------------------------------------------------------------------

/**
 * Everything the model needs about one player's ability to influence a point.
 *
 * Structural rather than a `Player`, so a caller can ask a hypothetical
 * question -- "what if he were already running that way?" -- without inventing
 * a player to ask it with.
 */
export type ReachProfile = {
  readonly id: string;
  readonly position: MeterPoint;
  /** How he is already moving. A man travelling toward a point is nearer to it than his distance says. */
  readonly velocity: MeterVector;
  readonly maxSpeed: number;
  /** Metres per second squared. Infinite means "already at speed", which is the constant-speed model. */
  readonly acceleration: number;
  /** Seconds before he can act on what he has just seen. */
  readonly reactionSeconds: number;
};

/**
 * How long a defender takes to register a change and start moving.
 *
 * A single, stated allowance rather than a per-player attribute: M17 is a
 * spatial model, not an attribute milestone, and the engine has no reaction
 * rating to read. Roughly a fifth of a second -- the low end of human simple
 * reaction plus the time to change direction.
 */
export const DEFENDER_REACTION_SECONDS = 0.2;

/** How fast a pass travels. The engine's own constant, so a lane and a pass agree. */
export const PASS_SPEED_METERS_PER_SECOND = 12;

/**
 * A player as the model sees him: where he is, how he is moving, how fast he
 * can go, and how long before he can react.
 */
export function reachProfileOf(player: Player, reactionSeconds = 0): ReachProfile {
  return {
    id: player.id,
    position: player.position,
    velocity: player.velocity,
    // M25: what he can produce NOW, not what he could at kick-off. This one
    // substitution is why fatigue reaches M18's reach, M19's contact, M8's
    // races and M7's step-outs without any of them knowing it exists.
    maxSpeed: Math.max(0.1, effectiveMovementProfile(player).maxSpeed),
    acceleration: Math.max(0.1, effectiveMovementProfile(player).acceleration),
    reactionSeconds,
  };
}

/**
 * The same player, read the way M8's break race reads him: at top speed from a
 * standing start, with no reaction allowance and no credit for the direction he
 * is already running in.
 *
 * This is deliberately the SIMPLER model, kept because it is the one the
 * transition was measured and calibrated on. Expressing it through the shared
 * primitive removes the duplicated arithmetic without changing a single number
 * the break produces.
 */
export function constantSpeedProfileOf(player: Player): ReachProfile {
  return {
    id: player.id,
    position: player.position,
    velocity: { x: 0, y: 0 },
    maxSpeed: Math.max(0.1, effectiveMovementProfile(player).maxSpeed),
    acceleration: Number.POSITIVE_INFINITY,
    reactionSeconds: 0,
  };
}

// ---------------------------------------------------------------------------
// Time to reach a point
// ---------------------------------------------------------------------------

/**
 * How long this profile needs to reach `point`.
 *
 * Ordinary kinematics on the straight line to the point, and nothing more
 * exotic than that:
 *
 *   1. he cannot act for `reactionSeconds`
 *   2. he starts with whatever speed he already has ALONG that line -- which is
 *      negative when he is moving away, and that is the whole reason two
 *      defenders the same distance out are not equally dangerous
 *   3. he accelerates to his top speed, then runs at it
 *
 * An infinite acceleration collapses this to `distance / maxSpeed`, which is
 * exactly the constant-speed model M8 races on.
 */
export function timeToReach(profile: ReachProfile, point: MeterPoint): number {
  const distance = distanceBetween(profile.position, point);
  if (distance < 1e-9) return profile.reactionSeconds;

  const maxSpeed = Math.max(0.1, profile.maxSpeed);
  if (!Number.isFinite(profile.acceleration) || profile.acceleration <= 0) {
    return profile.reactionSeconds + distance / maxSpeed;
  }

  // The speed he already carries toward the point. Bounded by his own top
  // speed, so a momentary overshoot in the integrator cannot buy him time he
  // could not sustain.
  const ux = (point.x - profile.position.x) / distance;
  const uy = (point.y - profile.position.y) / distance;
  const approach = Math.max(-maxSpeed, Math.min(maxSpeed, profile.velocity.x * ux + profile.velocity.y * uy));

  const a = profile.acceleration;
  const rampSeconds = Math.max(0, (maxSpeed - approach) / a);
  const rampDistance = approach * rampSeconds + 0.5 * a * rampSeconds * rampSeconds;

  if (rampDistance >= distance) {
    // He arrives while still accelerating: solve 0.5*a*t^2 + v0*t = d.
    const travel = (-approach + Math.sqrt(Math.max(0, approach * approach + 2 * a * distance))) / a;
    return profile.reactionSeconds + travel;
  }
  return profile.reactionSeconds + rampSeconds + (distance - rampDistance) / maxSpeed;
}

// ---------------------------------------------------------------------------
// Who controls a point
// ---------------------------------------------------------------------------

/**
 * The race for one point, in seconds.
 *
 * `marginSeconds` is the whole result: positive means the attacker gets there
 * first by that much, negative means the defence does. Everything else is the
 * working, kept so a debug tool can show it rather than assert it.
 */
export type PointControl = {
  readonly point: MeterPoint;
  readonly attackerId: string;
  readonly attackerSeconds: number;
  /** The quickest defender to the point, when there is one. */
  readonly defenderId: string | null;
  readonly defenderSeconds: number;
  /** defenderSeconds - attackerSeconds. Positive: the attacker wins the race. */
  readonly marginSeconds: number;
};

/** Who reaches `point` first: this attacker, or the quickest of these defenders. */
export function pointControl(point: MeterPoint, attacker: ReachProfile, defenders: readonly ReachProfile[]): PointControl {
  const attackerSeconds = timeToReach(attacker, point);
  let defenderId: string | null = null;
  let defenderSeconds = Number.POSITIVE_INFINITY;
  for (const defender of defenders) {
    const seconds = timeToReach(defender, point);
    if (seconds < defenderSeconds) {
      defenderSeconds = seconds;
      defenderId = defender.id;
    }
  }
  return {
    point,
    attackerId: attacker.id,
    attackerSeconds,
    defenderId,
    defenderSeconds,
    marginSeconds: defenderSeconds - attackerSeconds,
  };
}

// ---------------------------------------------------------------------------
// Who controls a lane
// ---------------------------------------------------------------------------

/**
 * The race for a passing lane.
 *
 * A lane is not a point, so the question is asked along it: for each place the
 * ball will pass through, can any defender be there by the time it is? The
 * answer is the WORST such place -- the moment the pass is most exposed.
 *
 * `marginSeconds` is positive when the ball beats the defender to every point
 * on the lane, which is what makes a pass playable even though a defender
 * stands geometrically near it.
 */
export type LaneControl = {
  readonly from: MeterPoint;
  readonly to: MeterPoint;
  /** Seconds for the pass itself to arrive. */
  readonly ballSeconds: number;
  /** The defender who comes closest to intercepting, when there is one. */
  readonly defenderId: string | null;
  /** Where on the lane he would meet it. */
  readonly interceptPoint: MeterPoint | null;
  /** When the ball reaches that place. */
  readonly ballAtInterceptSeconds: number;
  /** When he could be there. */
  readonly defenderSeconds: number;
  /** defenderSeconds - ballAtInterceptSeconds. Positive: the ball is through first. */
  readonly marginSeconds: number;
};

/** How many places along a lane are checked. Eleven is a sample every ~1.5m on a long pass. */
const LANE_SAMPLES = 11;

/**
 * How contested this pass is.
 *
 * The endpoints are excluded on purpose: a defender standing on the receiver is
 * pressure on the receiver and a defender standing on the passer is pressure on
 * the passer. Neither is a blocked lane, and treating them as one was the old
 * geometric test's main mistake.
 */
export function laneControl(
  from: MeterPoint,
  to: MeterPoint,
  defenders: readonly ReachProfile[],
  options: { readonly passSpeed?: number; readonly endpointExclusionMeters?: number } = {},
): LaneControl {
  const length = distanceBetween(from, to);
  const passSpeed = Math.max(0.1, options.passSpeed ?? PASS_SPEED_METERS_PER_SECOND);
  const exclusion = options.endpointExclusionMeters ?? 0.8;
  const ballSeconds = length / passSpeed;

  let worstMargin = Number.POSITIVE_INFINITY;
  let defenderId: string | null = null;
  let interceptPoint: MeterPoint | null = null;
  let ballAtInterceptSeconds = ballSeconds;
  let defenderSeconds = Number.POSITIVE_INFINITY;

  for (let i = 0; i <= LANE_SAMPLES; i += 1) {
    const t = i / LANE_SAMPLES;
    const along = t * length;
    if (along < exclusion || length - along < exclusion) continue;
    const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    const ballAt = along / passSpeed;
    for (const defender of defenders) {
      const seconds = timeToReach(defender, point);
      const margin = seconds - ballAt;
      if (margin < worstMargin) {
        worstMargin = margin;
        defenderId = defender.id;
        interceptPoint = point;
        ballAtInterceptSeconds = ballAt;
        defenderSeconds = seconds;
      }
    }
  }

  if (defenderId === null) {
    // Nothing to contest it, either because there are no defenders or because
    // the pass is too short to have a middle.
    return { from, to, ballSeconds, defenderId: null, interceptPoint: null, ballAtInterceptSeconds: ballSeconds, defenderSeconds: Number.POSITIVE_INFINITY, marginSeconds: Number.POSITIVE_INFINITY };
  }
  return { from, to, ballSeconds, defenderId, interceptPoint, ballAtInterceptSeconds, defenderSeconds, marginSeconds: worstMargin };
}

// ---------------------------------------------------------------------------
// Reading a margin
// ---------------------------------------------------------------------------

/**
 * How much of an advantage a margin is, as a 0..1 quality.
 *
 * Only ever used to WEIGH an option, never to allow or forbid one: a decision
 * layer multiplies by it, and the thing being weighed still has to beat every
 * other option on its own merits. `half` is the margin at which an advantage
 * counts as half won -- stated by the caller, because a passing lane and a
 * running gap are contested on different timescales.
 */
export function controlQuality(marginSeconds: number, half: number): number {
  if (!Number.isFinite(marginSeconds)) return marginSeconds > 0 ? 1 : 0;
  const scaled = marginSeconds / Math.max(1e-6, half);
  return 1 / (1 + Math.exp(-scaled));
}
