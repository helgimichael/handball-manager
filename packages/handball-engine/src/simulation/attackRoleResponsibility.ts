// HUMAN QA CORRECTION: a man on his way to his role is not an option yet.
//
// A human watched a centre throw-off and saw M6 take a pass twenty metres from
// goal, several passes after the restart, standing between two backs like a
// third one. Fix 2B was not the answer to this and did not claim to be: by then
// the attack had legitimately reached READY, and what was wrong was not the
// timing of the attack but the RESPONSIBILITY of one player in it.
//
// A six-metre player who has just thrown off, or just run back from his own
// half, has one job: get to his line. Until he has done it he is not a passing
// station, however convenient he happens to be. He is not forbidden -- if he is
// genuinely the only man available the ball still goes to him, because a rule
// that strands the carrier is worse than the thing it fixes -- but he is not
// ranked as an ordinary option while the job is unfinished.
//
// Deliberately a property of the PLAYER and his role rather than of the
// possession. There is no restart flag here and no window: the question is only
// "is this six-metre player at his six-metre role", which in a settled attack is
// always yes and therefore changes nothing, and during any reformation is no.

import { distanceBetween } from "../domain/geometry/coordinates";
import { goalCentre, type AttackingGoalSide } from "../domain/match/possession";
import type { Player, PlayerRole } from "../domain/handball/player";

/**
 * The roles whose working position is on or near the six-metre line: the two
 * wings, the pivot, and the second line player a 7v6 attack puts on.
 *
 * These are the men a restart displaces furthest from their job. A back who is
 * still coming up is doing exactly what a back does -- he works from out there
 * -- so the rule has nothing to say about him.
 */
export const SIX_METRE_ROLES: readonly PlayerRole[] = Object.freeze([
  "PIVOT",
  "LEFT_WING",
  "RIGHT_WING",
  "EXTRA_ATTACKER",
]);

/**
 * How close to the goal a six-metre player must be to count as having reached
 * his role.
 *
 * Eleven metres. The canonical wing stands about 9.4m from the goal centre and
 * the pivot about 6.7m, so this is a genuine "he is down there doing his job"
 * rather than "he is on his exact spot" -- a pivot working along the line and a
 * wing pushed off his corner are both still in role. A man at the halfway line
 * is twenty metres out and nowhere near it.
 */
export const SIX_METRE_ROLE_DEPTH_METERS = 11;

export type AttackRoleResponsibility = "IN_ROLE" | "RETURNING_TO_ROLE";

/** What this attacker's role currently requires of him. */
export function attackRoleResponsibilityOf(player: Player, goalSide: AttackingGoalSide): AttackRoleResponsibility {
  if (player.kind !== "FIELD_PLAYER" || !SIX_METRE_ROLES.includes(player.role)) return "IN_ROLE";
  return distanceBetween(player.position, goalCentre(goalSide)) <= SIX_METRE_ROLE_DEPTH_METERS
    ? "IN_ROLE"
    : "RETURNING_TO_ROLE";
}

/** Is this man available as an ordinary receiving option? */
export function isOrdinaryReceivingOption(player: Player, goalSide: AttackingGoalSide): boolean {
  return attackRoleResponsibilityOf(player, goalSide) === "IN_ROLE";
}
