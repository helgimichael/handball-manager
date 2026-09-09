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
import { CANONICAL_GOAL_WIDTH_METERS } from "@handball-manager/match-contract";
import { GOALKEEPER_LIMITS } from "../policies/goalkeeper/goalkeeperPolicy";
import { distanceBetween, type MeterPoint } from "../domain/geometry/coordinates";
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
 * How near his goal a keeper has to be for that goal to be guarded.
 *
 * Derived from M9's own limits rather than invented: `goalkeeperSetPosition`
 * never places a keeper more than `maxAdvanceMeters` off his line, and clamps
 * him to within 0.6m of a post across it, so the furthest he is ever legitimately
 * standing from the middle of his goal is the diagonal of those two. His reach
 * is added on top, because a man that far out is still defending the goal.
 *
 * Anything beyond it is a goalkeeper who is somewhere else.
 */
export const GOAL_GUARDED_WITHIN_METERS =
  Math.hypot(CANONICAL_GOAL_WIDTH_METERS / 2 + 0.6, GOALKEEPER_LIMITS.maxAdvanceMeters) + GOALKEEPER_LIMITS.baseReachMeters;

/**
 * Is this team's own goal empty?
 *
 * The question a breaking opponent actually asks, and it is NOT "has a
 * goalkeeper been substituted on". Being on the court is not guarding a goal:
 * a keeper who has just completed his exchange is standing at the substitution
 * area on the halfway line, twenty metres away, and until he has run back the
 * goal behind him is as open as it was while he was on the bench. Reading his
 * presence alone reported the goal guarded from the instant of the swap, which
 * is the one moment in 7v6 where the truth matters most.
 *
 * So it asks where he is. The keeper has to be on the court AND near enough to
 * his goal to be defending it; the walk back is genuinely an empty goal, which
 * is exactly the risk the team accepted when it took him off.
 */
export function ownGoalIsEmpty(state: HandballState, team: TeamId, ownGoalSide: AttackingGoalSide): boolean {
  const keeper = goalkeeperOnCourt(state, team);
  if (!keeper) return true;
  return distanceBetween(keeper.position, goalCentre(ownGoalSide)) > GOAL_GUARDED_WITHIN_METERS;
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
  if (!ownGoalIsEmpty(state, defendingTeam, attackedGoalSide)) return null;
  return distanceBetween(shooter.position, goalCentre(attackedGoalSide));
}

// ---------------------------------------------------------------------------
// Keepers go back to their goal
// ---------------------------------------------------------------------------

/** Where a goalkeeper stands when he is simply guarding his goal. */
export function goalkeeperHomePosition(ownGoalSide: AttackingGoalSide): MeterPoint {
  const goal = goalCentre(ownGoalSide);
  return { x: goal.x, y: ownGoalSide === "TOP" ? goal.y + 0.5 : goal.y - 0.5 };
}

/**
 * QA GATE 1B: orders for any goalkeeper who is not in his goal.
 *
 * A keeper arrives from an exchange at the substitution area on the halfway
 * line, and until now only one code path ever told him to go home -- so a
 * keeper substituted during a transition or a restart simply stayed there.
 * Measured over one match, every one of the four keepers spent time twenty-two
 * metres from the nearest goal, and the QA panel correctly but alarmingly
 * reported both goals empty at once.
 *
 * This is the rule that was missing, stated once and used by every engine that
 * steps the court: a keeper who is not guarding his goal is going back to it.
 * He walks -- it returns an order, not a position -- so the goal stays honestly
 * empty until he arrives.
 */
/**
 * How far from his goal a keeper has to be before he is ordered back.
 *
 * Deliberately much larger than the guard distance. M9 moves the keeper around
 * his goal to cut angles and to commit to a shot, and an order issued every
 * step at the guard distance fought that -- measured, it cost twelve goals a
 * match. This only catches a keeper who is somewhere he could not possibly be
 * doing his job: stranded at the substitution area, twenty metres away.
 */
const KEEPER_RECOVERY_TRIGGER_METERS = 9;

export function keeperRecoveryActions(
  state: HandballState,
  ownGoalSideOf: (keeper: Player) => AttackingGoalSide,
): { readonly type: "MOVE"; readonly playerId: string; readonly target: MeterPoint }[] {
  const orders: { readonly type: "MOVE"; readonly playerId: string; readonly target: MeterPoint }[] = [];
  for (const keeper of state.players) {
    if (keeper.kind !== "GOALKEEPER" || keeper.leavingCourt) continue;
    const home = goalkeeperHomePosition(ownGoalSideOf(keeper));
    if (distanceBetween(keeper.position, home) <= KEEPER_RECOVERY_TRIGGER_METERS) continue;
    // Already on his way there; leave the order he is carrying out alone.
    if (keeper.intent.type === "MOVE" && !keeper.intent.completed && distanceBetween(keeper.intent.target, home) < 0.5) continue;
    orders.push({ type: "MOVE", playerId: keeper.id, target: home });
  }
  return orders;
}
