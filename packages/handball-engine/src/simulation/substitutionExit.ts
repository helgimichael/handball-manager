/**
 * MATCH-EXPERIENCE-2.0 M11 (correction): a player leaving the court.
 *
 * A substitution is not an instant. Somebody has to walk off, and in handball
 * he has to walk off THROUGH THE SUBSTITUTION AREA -- his own line, beside the
 * halfway line. Only once he is across it may his replacement come on. That
 * single rule is what makes the lifecycle
 *
 *     REQUESTED -> EXITING -> COMPLETE
 *
 * necessary rather than decorative: during EXITING the man going off is still a
 * real player on the court, so his side cannot also have the man coming on, and
 * an exchange can therefore never produce a seventh outfield player.
 *
 * WHY THE OVERRIDE LIVES HERE, AT THE STEP. M6 puts attackers into shape, M7
 * puts defenders on the line, M8 sends runners down lanes, M9 tracks the keeper
 * to the ball -- four independent layers, each of which would happily re-target
 * a man who is trying to leave, and none of which should have to know that
 * substitutions exist. Rather than teach all four about the bench, the exit
 * order is applied last, at the single point where intentions become movement:
 * whatever anybody asked a leaving player to do is dropped, and he heads for the
 * line instead. That makes it impossible for a new tactical layer to
 * accidentally strand him on the court forever.
 *
 * The one exception is a leaving player who has the ball. He is not allowed to
 * simply walk off with it; he plays it away first, and resumes his exit as soon
 * as it is gone.
 */
import { distanceBetween } from "../domain/geometry/coordinates";
import { step } from "./engine";
import type { HandballAction } from "../domain/handball/actions";
import type { Player } from "../domain/handball/player";
import type { CourtExchange, HandballState } from "../domain/handball/state";
import { SUBSTITUTION_AREA } from "../scenarios/matchSquad";

/**
 * How close to the substitution area counts as having crossed it.
 *
 * Generous on purpose: the point of the requirement is that he physically
 * travelled to his own line, not that he hit a coordinate exactly. A fixed step
 * of 4.2 m/s covers about 0.21 m, so this is roughly five steps' worth of
 * tolerance and cannot be reached from anywhere but the line itself.
 */
export const SUBSTITUTION_ARRIVAL_METERS = 1;

/** True while this player is on his way off for a substitution. */
export function isLeavingCourt(player: Player): boolean {
  return player.leavingCourt === true;
}

/** True once he has actually reached his own substitution area and may be taken off. */
export function hasReachedSubstitutionArea(player: Player): boolean {
  return distanceBetween(player.position, SUBSTITUTION_AREA) <= SUBSTITUTION_ARRIVAL_METERS;
}

/** Marks or clears the leaving flag on one player, leaving the rest of the state alone. */
export function markLeavingCourt(players: readonly Player[], playerId: string, leaving: boolean): Player[] {
  return players.map((p) => {
    if (p.id !== playerId) return p;
    return { ...p, leavingCourt: leaving ? true : undefined };
  });
}

/**
 * Replaces every order given to a leaving player with the only order he is
 * actually following: get to the substitution area.
 *
 * Applied immediately before each fixed step, so it wins over every tactical
 * layer regardless of which one issued the command.
 */
export function applyExitOrders(state: HandballState, actions: readonly HandballAction[]): HandballAction[] {
  const leaving = state.players.filter((p) => isLeavingCourt(p) && state.ball.possessorId !== p.id);
  if (leaving.length === 0) return [...actions];
  const ids = new Set(leaving.map((p) => p.id));
  const kept = actions.filter((action) => {
    if (action.type === "PASS") return !ids.has(action.fromPlayerId) && !ids.has(action.toPlayerId);
    return !ids.has(action.playerId);
  });
  return [
    ...kept,
    ...leaving.map((player): HandballAction => ({ type: "MOVE", playerId: player.id, target: { ...SUBSTITUTION_AREA } })),
  ];
}

/**
 * Completes every exchange whose outgoing player has just reached his
 * substitution area. THIS is where a rolling substitution actually happens.
 *
 * It runs after each fixed step, inside whatever loop is driving play, so the
 * swap lands on the first step he is at the line rather than at the end of the
 * possession. Play does not stop for it: the man coming on is simply there from
 * the next step, standing at the substitution area with the role of the man he
 * replaced, and every layer that reads the state finds him.
 *
 * The removal and the insertion are one expression, so the side is never even
 * momentarily seven -- there is no instant between the two.
 */
export function settleArrivedExchanges(state: HandballState): HandballState {
  const exchanges = state.exchanges;
  if (!exchanges || exchanges.length === 0) return state;

  let players = state.players;
  let swapped = false;
  const next = exchanges.map((exchange) => {
    if (exchange.completedAtSimulationTime !== null) return exchange;
    const outgoing = players.find((p) => p.id === exchange.outgoingPlayerId);
    // He is not on the court any more (sent off while walking). The flow layer
    // owns that case; there is nothing to swap here.
    if (!outgoing) return exchange;
    // He does not walk off with the ball, so he cannot be exchanged holding it.
    if (state.ball.possessorId === outgoing.id) return exchange;
    if (!hasReachedSubstitutionArea(outgoing)) return exchange;

    const replacement: Player = {
      ...exchange.incoming,
      // He inherits the side and the role of the man he replaces -- so the shape
      // M6 and M7 are holding survives the change -- but never his position.
      team: outgoing.team,
      role: outgoing.role,
      position: { ...SUBSTITUTION_AREA },
      velocity: { x: 0, y: 0 },
      intent: { type: "IDLE" },
      leavingCourt: undefined,
    };
    players = players.filter((p) => p.id !== outgoing.id).concat(replacement);
    swapped = true;
    return { ...exchange, completedAtSimulationTime: state.simulationTime };
  });

  return swapped ? { ...state, players, exchanges: next } : state;
}

/**
 * One fixed step of play, with substitutions handled around it.
 *
 * The single hook the possession engine, the transition engine and the restart
 * all use, so none of them carries any substitution logic of its own: orders
 * for anybody leaving are overridden on the way in, and an exchange completes
 * on the way out the moment he arrives.
 */
export function stepWithSubstitutions(state: HandballState, actions: readonly HandballAction[], dt: number): HandballState {
  return settleArrivedExchanges(step(state, { actions: applyExitOrders(state, actions) }, dt));
}

/** Exchanges that completed at or after `sinceSimulationTime`, oldest first. */
export function completedExchanges(state: HandballState): readonly CourtExchange[] {
  return (state.exchanges ?? []).filter((exchange) => exchange.completedAtSimulationTime !== null);
}

/** The same state with the given exchanges removed from the ledger. */
export function withoutExchanges(state: HandballState, outgoingPlayerIds: readonly string[]): HandballState {
  const remaining = (state.exchanges ?? []).filter((exchange) => !outgoingPlayerIds.includes(exchange.outgoingPlayerId));
  if (remaining.length === (state.exchanges ?? []).length) return state;
  return { ...state, exchanges: remaining };
}

/** The same state with one exchange added to the ledger. */
export function withExchange(state: HandballState, exchange: CourtExchange): HandballState {
  return { ...state, exchanges: [...(state.exchanges ?? []), exchange] };
}
