// SPATIAL TIMING: can this player get there, and can he get there first.
//
// The audit found every tactical feasibility question in V2 answered with raw
// Euclidean distance. Distance is the wrong quantity. A defender two metres
// away running the other way is further from the ball than a defender four
// metres away already moving toward it, and treating them the same is what
// produced sixty to eighty interceptions a match, defenders converging on one
// attacker, and help that arrived from the wrong side of the court.
//
// So feasibility is measured in SECONDS. A player's arrival time accounts for
// where he is, how fast he is already moving toward the point, how quickly he
// accelerates, his own top speed, what his legs have left, whatever contest
// consequence is still impairing him, and his reaction time, which is itself an
// attribute: a good reader is moving while a poor one is still deciding.
//
// ONE BOUNDARY MATTERS MORE THAN THE MODEL. Time to reach answers CAN he get
// there. It never answers WHO SHOULD go. Responsibility is allocated by team
// structure first, and only then does timing say whether the man who owns the
// job can actually do it. Letting arrival time choose the owner is precisely
// how a defence collapses into six players chasing one ball, which is the
// failure the paused 3:2:1 work died of. Nothing in this module reads a duty
// and nothing that allocates a duty may call it before allocating.
import { movementCapacity } from './condition';
import type { CoreFlight, CorePlayer, CoreState, Point } from './state';
import { distance } from './space';

/** Everything arrival time depends on, read off a player once. */
export type Reach = {
  readonly position: Point;
  readonly velocity: Point;
  readonly topSpeed: number;
  readonly acceleration: number;
  readonly reaction: number;
};

/**
 * A player's current ability to cover ground.
 *
 * Impairment is the same set of contest consequences the movement integrator
 * already honours, so a beaten defender is slow HERE too. Without that, timing
 * would cheerfully promise that a man who has just been gone past can still
 * cover the space behind him.
 */
export function reachOf(s: CoreState, p: CorePlayer): Reach {
  const impaired = s.tick < p.beatenUntilTick ? 0.4 : s.tick < p.screenedUntilTick ? 0.15 : s.tick < p.wrongFootedUntilTick ? 0.65 : 1;
  const capacity = movementCapacity(p) * impaired;
  return {
    position: p.position,
    velocity: p.velocity,
    topSpeed: Math.max(0.4, p.profile.topSpeed * capacity),
    acceleration: Math.max(0.4, p.profile.acceleration * capacity),
    // A player already committed to an action has spent his reaction; one who
    // is not is still reading. Impairment costs reading time as well as pace.
    reaction: p.profile.reaction / Math.max(0.2, impaired),
  };
}

/**
 * Seconds for this player to put his body on `point`.
 *
 * Closed form rather than integration: accelerate from the speed he already
 * carries toward the point, cap at his top speed, cruise the remainder. The
 * component of his velocity that points AWAY is not credited and not charged
 * either, because turning is modelled by the reaction term rather than by a
 * separate pivot cost. That is a deliberate simplification and it is stated
 * here so nobody later reads it as an oversight.
 */
export function timeToReach(reach: Reach, point: Point): number {
  const d = distance(reach.position, point);
  if (d < 1e-6) return reach.reaction;
  const ux = (point.x - reach.position.x) / d, uy = (point.y - reach.position.y) / d;
  const carried = Math.max(0, Math.min(reach.topSpeed, reach.velocity.x * ux + reach.velocity.y * uy));
  // Distance covered while reaching top speed from the speed he already has.
  const runUp = (reach.topSpeed * reach.topSpeed - carried * carried) / (2 * reach.acceleration);
  if (runUp >= d) return reach.reaction + (Math.sqrt(carried * carried + 2 * reach.acceleration * d) - carried) / reach.acceleration;
  return reach.reaction + (reach.topSpeed - carried) / reach.acceleration + (d - runUp) / reach.topSpeed;
}

/** Convenience for the common case. */
export const secondsTo = (s: CoreState, p: CorePlayer, point: Point) => timeToReach(reachOf(s, p), point);

/**
 * Can he be on that point within the time available, with a margin.
 *
 * Positive margin means he arrives with time to spare. The caller decides how
 * much spare is enough, because pressing a carrier and intercepting a pass want
 * very different confidence.
 */
export const arrivalMargin = (s: CoreState, p: CorePlayer, point: Point, available: number) => available - secondsTo(s, p, point);

/** Where a ball in flight will be after `seconds`, ignoring nothing it models. */
export const flightAt = (flight: CoreFlight, origin: Point, seconds: number): Point =>
  ({ x: origin.x + flight.velocity.x * seconds, y: origin.y + flight.velocity.y * seconds });

/**
 * The best interception a player can make on a ball already in flight.
 *
 * Walks the remaining flight in small steps and returns the first moment he
 * could have his hands on it. Returns null when he cannot, which is the common
 * and correct answer: most passes in handball are simply not interceptable, and
 * the old distance test said otherwise several dozen times a match.
 *
 * `grasp` is how far from his centre a player can actually take the ball. It is
 * small on purpose. A hand is not a net.
 */
export function interceptSeconds(s: CoreState, p: CorePlayer, from: Point, flight: CoreFlight, horizon: number, grasp: number): number | null {
  const reach = reachOf(s, p);
  const speed = Math.hypot(flight.velocity.x, flight.velocity.y);
  if (speed < 1e-6) return null;
  const step = 0.05;
  for (let t = step; t <= horizon; t += step) {
    const where = flightAt(flight, from, t);
    if (timeToReach(reach, where) <= t + 1e-9 && distance(where, p.position) <= grasp + reach.topSpeed * t) return t;
  }
  return null;
}

/**
 * Is this passing lane genuinely contested, and by whom?
 *
 * The honest question is not "is a defender near the line" but "can a defender
 * put a hand on the ball before it arrives". A defender standing on the line
 * with his weight the wrong way is not a threat; one arriving at pace from two
 * metres off it is. Returns the tightest margin in seconds, positive when the
 * pass beats every defender.
 */
export function laneMargin(s: CoreState, from: Point, to: Point, team: CorePlayer['team'], passSpeed: number, grasp = 0.55): { seconds: number; defenderId: string | null } {
  const d = distance(from, to);
  if (d < 1e-6) return { seconds: 10, defenderId: null };
  const travel = d / passSpeed;
  const ux = (to.x - from.x) / d, uy = (to.y - from.y) / d;
  // Clearance is the ball's margin, so positive means the pass wins. The worst
  // point on the lane decides it, because one reachable point is enough.
  let clearance = 10, who: string | null = null;
  for (const p of s.players) {
    if (p.population !== 'COURT' || p.team === team || p.kind === 'GOALKEEPER') continue;
    const reach = reachOf(s, p);
    for (let step = 1; step <= 12; step++) {
      const t = travel * step / 12;
      const point = { x: from.x + ux * passSpeed * t, y: from.y + uy * passSpeed * t };
      // Seconds the ball beats him to this point by, less the reach of a hand.
      const margin = t - timeToReach(reach, point) - grasp / Math.max(1, reach.topSpeed);
      if (-margin < clearance) { clearance = -margin; who = p.id; }
    }
  }
  return { seconds: clearance, defenderId: who };
}
