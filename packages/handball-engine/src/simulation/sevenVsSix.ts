/**
 * MATCH-EXPERIENCE-2.0 M22: SEVEN AGAINST SIX, AND AN EMPTY GOAL.
 *
 * The goalkeeper walks off and a seventh outfield player walks on.
 *
 * WHAT THIS IS. Real state, and nothing else. A team in 7v6 has seven field
 * players and no goalkeeper on the court, their goal is empty because there is
 * genuinely nobody in it, and every consequence of that follows from the same
 * simulation that runs every other second of the match: the extra man occupies
 * real space and creates real passing options, the defence has one more body to
 * account for than it has defenders, and if the ball is lost the opponent is
 * running at an open net.
 *
 * WHAT IT IS NOT. There is no 7v6 modifier anywhere. Nothing adds a bonus to a
 * shot because the goal is empty, nothing subtracts from the defence because it
 * is outnumbered, and no goalkeeper is hidden off-screen to be produced again
 * when a shot arrives. M9 already resolves a shot at an unguarded goal properly
 * -- it still has to be on target and unblocked -- because it was written to
 * read who is actually in the goal rather than to assume somebody is.
 *
 * THE EXCHANGE IS M11'S. Both directions are ordinary substitutions: the keeper
 * is the outgoing player and the seventh attacker the incoming one, and back
 * again to return. That is deliberate and it is most of the honesty in this
 * milestone. The keeper cannot teleport into his goal, he is not on the court
 * until he is actually on the court, and if the opponent shoots while he is
 * still walking, the goal is still empty. Nothing here re-implements any of
 * that; it only says who swaps with whom.
 */
import { isLeavingCourt, markLeavingCourt, withExchange } from "./substitutionExit";
import { distanceBetween } from "../domain/geometry/coordinates";
import { goalCentre, type AttackingGoalSide } from "../domain/match/possession";
import type { Player, TeamId } from "../domain/handball/player";
import type { HandballState } from "../domain/handball/state";

/** A full court side: seven players, however they are made up. */
export const COURT_SIDE_SIZE = 7;

/** Everyone this team currently has on the court, keeper included. */
export function onCourt(state: HandballState, team: TeamId): readonly Player[] {
  return state.players.filter((p) => p.team === team);
}

/** The outfield players this team has on the court. */
export function fieldPlayersOnCourt(state: HandballState, team: TeamId): readonly Player[] {
  return state.players.filter((p) => p.team === team && p.kind === "FIELD_PLAYER");
}

/** This team's goalkeeper, if one is actually on the court. */
export function goalkeeperOnCourt(state: HandballState, team: TeamId): Player | null {
  return state.players.find((p) => p.team === team && p.kind === "GOALKEEPER") ?? null;
}

/**
 * Is this team playing seven out?
 *
 * Asked of the state and nothing else: seven outfield players and no keeper.
 * There is no flag to consult and no flag to get out of step with the court.
 */
export function isSevenVsSix(state: HandballState, team: TeamId): boolean {
  return goalkeeperOnCourt(state, team) === null && fieldPlayersOnCourt(state, team).length === COURT_SIDE_SIZE;
}

/**
 * Is this team's own goal empty?
 *
 * The question a breaking opponent actually asks, and it is not the same as the
 * question above: a keeper who is mid-substitution has left the court and has
 * not yet come back, so the goal is open even though there are not yet seven
 * outfield players. That window is the whole risk of 7v6 and it must not be
 * papered over by only recognising the tidy end states.
 */
export function ownGoalIsEmpty(state: HandballState, team: TeamId): boolean {
  return goalkeeperOnCourt(state, team) === null;
}

/**
 * Whether this team's court population is legal.
 *
 * Seven at most, ever. A player waiting in an exchange is not on the court and
 * does not count -- that is exactly what M11's exchange means -- so this counts
 * bodies rather than intentions, and it is the invariant a scenario should
 * assert against rather than any statement about who was meant to swap.
 */
export function courtPopulationIsLegal(state: HandballState, team: TeamId): boolean {
  const players = onCourt(state, team);
  return players.length <= COURT_SIDE_SIZE && players.filter((p) => p.kind === "GOALKEEPER").length <= 1;
}

// ---------------------------------------------------------------------------
// Going out, and coming back
// ---------------------------------------------------------------------------

/**
 * Send the keeper off for a seventh outfield player.
 *
 * An ordinary M11 exchange: the keeper is told to leave and the extra man is
 * waiting off court until he actually reaches the line. Nothing about the goal
 * is changed here, because nothing needs to be -- the goal is empty exactly
 * when the keeper is no longer standing in it.
 *
 * Returns the state unchanged when there is no keeper to send off, so calling
 * it twice cannot produce eight players.
 */
export function startSevenVsSix(state: HandballState, team: TeamId, seventhAttacker: Player): HandballState {
  const keeper = goalkeeperOnCourt(state, team);
  if (!keeper) return state;
  if (fieldPlayersOnCourt(state, team).length >= COURT_SIDE_SIZE) return state;
  // He is on the court until he reaches the line, so "is there a keeper" is not
  // enough on its own: asking twice while he walks would queue a second man and
  // put eight on. One change at a time, which is M11's rule as well as this one.
  if (isLeavingCourt(keeper)) return state;
  const withOrders: HandballState = { ...state, players: markLeavingCourt(state.players, keeper.id, true) };
  return withExchange(withOrders, {
    outgoingPlayerId: keeper.id,
    incoming: { ...seventhAttacker, team, kind: "FIELD_PLAYER" },
    completedAtSimulationTime: null,
  });
}

/**
 * Bring the keeper back for the seventh man.
 *
 * The same exchange the other way round, and deliberately not a special case:
 * he walks to the line, the seventh attacker walks off, and only when that has
 * happened is there a goalkeeper in the goal again. Whether the opponent gets
 * a shot away first is a race, and it is a race the simulation runs rather than
 * one this function decides.
 */
export function endSevenVsSix(state: HandballState, team: TeamId, keeper: Player, outgoingFieldPlayerId?: string): HandballState {
  if (goalkeeperOnCourt(state, team) !== null) return state;
  const outgoing = outgoingFieldPlayerId
    ? state.players.find((p) => p.id === outgoingFieldPlayerId && p.team === team)
    : lastManBack(state, team);
  if (!outgoing) return state;
  const withOrders: HandballState = { ...state, players: markLeavingCourt(state.players, outgoing.id, true) };
  return withExchange(withOrders, {
    outgoingPlayerId: outgoing.id,
    incoming: { ...keeper, team, kind: "GOALKEEPER" },
    completedAtSimulationTime: null,
  });
}

/**
 * Who comes off to let the keeper back on: whoever is furthest from the ball,
 * because he is the man least involved in what is happening and so the cheapest
 * to lose. Read from the court rather than from an end of it, so it means the
 * same thing at either goal. Deterministic, ties on id.
 */
function lastManBack(state: HandballState, team: TeamId): Player | undefined {
  const field = [...fieldPlayersOnCourt(state, team)];
  if (field.length === 0) return undefined;
  const ball = state.ball.position;
  return field.sort(
    (a, b) => distanceBetween(b.position, ball) - distanceBetween(a.position, ball) || a.id.localeCompare(b.id),
  )[0];
}

// ---------------------------------------------------------------------------
// What an empty goal is worth to the other side
// ---------------------------------------------------------------------------

/**
 * How far this player is from an unattended goal, or null when the goal is not
 * unattended.
 *
 * This is not a decision and it is not a bonus. It is one fact -- the goal is
 * empty and it is this far away -- handed to M8, which already knows how to
 * weigh a shot against the race, the lane and the defenders in front of it. The
 * transition layer combines it with everything it already reads; nothing here
 * says whether to shoot, and an empty goal with a defender across the lane is
 * still a shot M8 can decline.
 */
export function emptyGoalDistance(
  state: HandballState,
  shooter: Player,
  attackedGoalSide: AttackingGoalSide,
  defendingTeam: TeamId,
): number | null {
  if (!ownGoalIsEmpty(state, defendingTeam)) return null;
  return distanceBetween(shooter.position, goalCentre(attackedGoalSide));
}
