/**
 * MATCH-EXPERIENCE-2.0 M18: DEFENSIVE REACH & CONTACT.
 *
 * The organized defence's own answer to M17's question:
 *
 *   which defender can reach this attacker, from where, and in time to
 *   influence what he is doing?
 *
 * WHY IT MATTERS. Until now the engine decided a defender was applying pressure
 * because he was inside a fixed radius of the carrier. That is a statement
 * about where he stands, and it is wrong in both directions: a man 1.5m away
 * but recovering the other way influences nothing, and a man 2m away already
 * closing goal-side is very much in the contact. M13 measured the consequence
 * -- 97% of every foul in a match happened in TRANSITION and essentially none
 * in organized play, because organized carriers are rarely inside a radius even
 * while a defender is actively meeting their drive.
 *
 * WHAT IT DOES NOT DO. It does not judge a foul. It produces a CONTEXT -- who
 * converged with whom, from which side, how late -- and hands it to M10, which
 * still decides independently what the restart is and whether the challenge was
 * worth two minutes. Nothing here shortcuts that, and nothing here raises a
 * foul rate: what changes is when two players are understood to have actually
 * met.
 *
 * ONE RACE MODEL. Every time below comes from M17's `timeToReach`. There is no
 * second piece of defensive race arithmetic in the engine.
 */
import { distanceBetween } from "../domain/geometry/coordinates";
import { goalCentre, type AttackingGoalSide } from "../domain/match/possession";
import {
  DEFENDER_REACTION_SECONDS,
  reachProfileOf,
  timeToReach,
  type ReachProfile,
} from "./spatialControl";
import type { MeterPoint } from "../domain/geometry/coordinates";
import type { DefenseRole, Player } from "../domain/handball/player";
import type { HandballState } from "../domain/handball/state";

// ---------------------------------------------------------------------------
// Where the two of them are going to meet
// ---------------------------------------------------------------------------

/** How far in front of the carrier's target a defender tries to stand. */
const GOAL_SIDE_OFFSET_METERS = 0.6;
/** With no stated intention, this is how far ahead a carrier is assumed to be going. */
const PROJECTION_METERS = 2.0;

/**
 * The point this attacker is actually heading for.
 *
 * His own stated intention when he has one -- M6 gives a driving carrier an
 * ATTACK intent whose target is the gap he chose, which is exactly the place
 * the defence has to get to. Failing that, a short projection of where he is
 * already moving; failing even that, straight at the goal. Never invented: it
 * is read from the intent, the velocity, or the geometry, in that order.
 */
export function attackTargetOf(carrier: Player, goalSide: AttackingGoalSide): MeterPoint {
  if (carrier.intent.type === "ATTACK") return carrier.intent.target;
  if (carrier.intent.type === "MOVE" && !carrier.intent.completed) return carrier.intent.target;
  const speed = Math.hypot(carrier.velocity.x, carrier.velocity.y);
  if (speed > 0.5) {
    return { x: carrier.position.x + (carrier.velocity.x / speed) * PROJECTION_METERS, y: carrier.position.y + (carrier.velocity.y / speed) * PROJECTION_METERS };
  }
  const goal = goalCentre(goalSide);
  const toGoal = distanceBetween(carrier.position, goal);
  if (toGoal < 1e-6) return { ...carrier.position };
  return {
    x: carrier.position.x + ((goal.x - carrier.position.x) / toGoal) * PROJECTION_METERS,
    y: carrier.position.y + ((goal.y - carrier.position.y) / toGoal) * PROJECTION_METERS,
  };
}

/** The place a defender would have to stand to meet him: just goal-side of where he is going. */
export function engagementPointFor(target: MeterPoint, goalSide: AttackingGoalSide): MeterPoint {
  return { x: target.x, y: goalSide === "TOP" ? target.y - GOAL_SIDE_OFFSET_METERS : target.y + GOAL_SIDE_OFFSET_METERS };
}

/** True when this defender is between the attacker and the goal he is attacking. */
export function isGoalSideOf(defender: MeterPoint, attacker: MeterPoint, goalSide: AttackingGoalSide): boolean {
  return goalSide === "TOP" ? defender.y < attacker.y : defender.y > attacker.y;
}

// ---------------------------------------------------------------------------
// One defender's reading
// ---------------------------------------------------------------------------

export type DefensiveReach = {
  readonly defenderId: string;
  readonly role: DefenseRole | string;
  /** Where he would have to be to meet the attacker. */
  readonly engagementPoint: MeterPoint;
  /** Seconds for the attacker to arrive there. */
  readonly attackerSeconds: number;
  /** Seconds for this defender to arrive there, including his reaction. */
  readonly defenderSeconds: number;
  /** attackerSeconds - defenderSeconds. Positive: the defender is there first. */
  readonly marginSeconds: number;
  /** Is he currently between the attacker and the goal? */
  readonly goalSide: boolean;
  /** How far he currently is from the attacker. */
  readonly separationMeters: number;
  /**
   * The component of his velocity pointing at the attacker: how fast he is
   * actually arriving, not how fast he could run. Zero when he is stationary or
   * moving away.
   */
  readonly closingSpeed: number;
  /**
   * Can he meaningfully influence this action? He has to be goal-side of it and
   * get to the meeting point in time. A man behind the play cannot engage from
   * in front however fast he runs.
   */
  readonly canEngage: boolean;
};

/**
 * M18: how fast a defender must be closing on the carrier to count as being in
 * the play at all when he is not goal-side of it. Read from his velocity toward
 * the carrier, not from his top speed -- the point is that he is arriving.
 */
export const CLOSING_SPEED_METERS_PER_SECOND = 0.6;

/** A defender who misses the meeting point by more than this is not in the action. */
export const ENGAGEMENT_MARGIN_SECONDS = -0.35;

function reachFor(
  defender: Player,
  carrierProfile: ReachProfile,
  carrierPosition: MeterPoint,
  engagementPoint: MeterPoint,
  goalSide: AttackingGoalSide,
): DefensiveReach {
  const attackerSeconds = timeToReach(carrierProfile, engagementPoint);
  const defenderSeconds = timeToReach(reachProfileOf(defender, DEFENDER_REACTION_SECONDS), engagementPoint);
  const goalSideNow = isGoalSideOf(defender.position, carrierPosition, goalSide);
  const dx = carrierPosition.x - defender.position.x;
  const dy = carrierPosition.y - defender.position.y;
  const gap = Math.hypot(dx, dy);
  const marginSeconds = attackerSeconds - defenderSeconds;
  return {
    defenderId: defender.id,
    role: defender.role,
    engagementPoint,
    attackerSeconds,
    defenderSeconds,
    marginSeconds,
    goalSide: goalSideNow,
    separationMeters: distanceBetween(defender.position, carrierPosition),
    closingSpeed: gap < 1e-6 ? 0 : Math.max(0, (defender.velocity.x * dx + defender.velocity.y * dy) / gap),
    canEngage: goalSideNow && marginSeconds > ENGAGEMENT_MARGIN_SECONDS,
  };
}

/**
 * Every outfield defender's ability to influence what this carrier is doing,
 * quickest first.
 *
 * Deterministic and pure. Ties break on id so the same situation always reports
 * the same order.
 */
export function defensiveReaches(state: HandballState, carrier: Player, goalSide: AttackingGoalSide): DefensiveReach[] {
  const target = attackTargetOf(carrier, goalSide);
  const engagementPoint = engagementPointFor(target, goalSide);
  const carrierProfile = reachProfileOf(carrier);
  return state.players
    .filter((p) => p.team === "DEFENSE" && p.kind === "FIELD_PLAYER")
    .map((d) => reachFor(d, carrierProfile, carrier.position, engagementPoint, goalSide))
    .sort((a, b) => a.defenderSeconds - b.defenderSeconds || a.defenderId.localeCompare(b.defenderId));
}

// ---------------------------------------------------------------------------
// The contact context
// ---------------------------------------------------------------------------

/**
 * What kind of defensive situation this is -- geometry and timing only.
 *
 *   CLEANLY_CONTAINED  he is goal-side and set before the attacker arrives.
 *                      The attack has run into a defender who is already there.
 *   LEGAL_CONTACT      they converge. Both arrive at about the same moment,
 *                      goal-side, close enough to touch. This is where contact
 *                      genuinely happens in handball.
 *   BEATEN             the attacker has won the race, or the defender is not
 *                      goal-side at all. Whatever happens next, it is not
 *                      front-on pressure.
 *
 * NONE OF THESE IS A FOUL. They say what the two players' bodies did; M10 says
 * what the referee makes of it.
 */
export type ContactPosture = "CLEANLY_CONTAINED" | "LEGAL_CONTACT" | "BEATEN";

export type ContactContext = {
  readonly posture: ContactPosture;
  readonly defenderId: string;
  readonly reach: DefensiveReach;
  /** The next-quickest defender who could help, when one can get there at all. */
  readonly helpDefenderId: string | null;
  /** How late the help is relative to the attacker. Positive: it arrives in time. */
  readonly helpMarginSeconds: number;
  /** True when a second defender can genuinely close the space as well. */
  readonly helpArrives: boolean;
  /** Close enough that the two players are physically in contact. */
  readonly inContact: boolean;
  /** How fast the defender is closing on the carrier, in metres per second. */
  readonly closingSpeed: number;
};

/** Arm's length. The distance at which two players are actually touching. */
export const CONTACT_RANGE_METERS = 1.6;
/** Inside this margin the two arrive together, which is a convergence rather than containment. */
const CONVERGENCE_SECONDS = 0.25;

/**
 * The defensive situation this carrier is in, if any.
 *
 * Null when nobody can influence him at all -- an attacker in free space is not
 * in a contact situation, and saying so is the point.
 */
export function organizedContactContext(state: HandballState, carrier: Player, goalSide: AttackingGoalSide): ContactContext | null {
  const reaches = defensiveReaches(state, carrier, goalSide);
  if (reaches.length === 0) return null;

  // Who the man in the action is depends on whether there is already physical
  // contact, and those are two different questions.
  //
  // If somebody is inside arm's length AND doing something about it, HE is in
  // the duel, whatever the race says -- including the defender who has just
  // been stepped past and is recovering from behind. Asking instead "can the
  // responsible defender reach the ball first, and is HE close?" loses exactly
  // that man: the race hands responsibility to a covering colleague four metres
  // away, and the defender physically leaning on the carrier stops counting.
  //
  // "Doing something about it" is the other half, and it cuts the other way. A
  // beaten defender standing still a metre behind the play is the nearest man
  // and is in nobody's duel; if he were allowed to be the principal simply for
  // being nearest, he would shadow a colleague who is genuinely engaged and in
  // contact, and the situation would read as no contact at all.
  //
  // Only when nobody is both within touching distance and in the play does
  // responsibility fall back to the race: the quickest defender who can still
  // get goal-side, or, if none can, the nearest, who is the one being beaten.
  const byDistance = [...reaches].sort((a, b) => a.separationMeters - b.separationMeters || a.defenderId.localeCompare(b.defenderId));
  const engaged = reaches.find((r) => r.canEngage) ?? null;
  const inTheDuel = byDistance.filter(
    (r) => r.separationMeters <= CONTACT_RANGE_METERS && (r.canEngage || r.closingSpeed >= CLOSING_SPEED_METERS_PER_SECOND),
  );
  const principal = inTheDuel.find((r) => r.canEngage) ?? inTheDuel[0] ?? engaged ?? byDistance[0];

  const help = reaches.find((r) => r.defenderId !== principal.defenderId && r.canEngage) ?? null;
  const helpMarginSeconds = help ? help.marginSeconds : Number.NEGATIVE_INFINITY;

  const separation = principal.separationMeters;

  const posture: ContactPosture = !principal.canEngage
    ? "BEATEN"
    : principal.marginSeconds > CONVERGENCE_SECONDS
      ? "CLEANLY_CONTAINED"
      : "LEGAL_CONTACT";

  return {
    posture,
    defenderId: principal.defenderId,
    reach: principal,
    helpDefenderId: help?.defenderId ?? null,
    helpMarginSeconds,
    helpArrives: help !== null && help.marginSeconds > ENGAGEMENT_MARGIN_SECONDS,
    inContact: separation <= CONTACT_RANGE_METERS,
    closingSpeed: principal.closingSpeed,
  };
}

/**
 * The contact situation the carrier is actually in, or null if he is in none.
 *
 * A defender closing on a carrier already inside arm's length is in contact
 * with him, whether he is still in front of the man or has just been stepped
 * past -- being beaten and recovering from behind is the most foul-prone
 * position in handball, not an absence of contact. A defender trailing without
 * closing is out of the play, and nobody within reach at all is an attacker in
 * space. Neither is contact, and saying so is the point of M18: presence inside
 * a radius is not pressure.
 *
 * This says who met whom and how. It never says what the referee gives.
 */
export function contactSituation(state: HandballState, carrier: Player, goalSide: AttackingGoalSide): ContactContext | null {
  const contact = organizedContactContext(state, carrier, goalSide);
  if (!contact || !contact.inContact) return null;
  if (contact.posture === "BEATEN" && contact.closingSpeed < CLOSING_SPEED_METERS_PER_SECOND) return null;
  return contact;
}
