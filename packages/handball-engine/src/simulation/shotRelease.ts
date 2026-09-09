// HUMAN QA FIX 2A: where a shot actually leaves the hand.
//
// A shot in handball is four separate things that this engine had collapsed
// into one: an APPROACH, a legal TAKE-OFF and release, the BALL's flight, and
// the PLAYER's landing. Because it was one thing, the shooter's position at the
// instant somebody decided to shoot was taken as the origin of the ball -- and
// the transition carrier was being ordered to run at the goal centre, so that
// position was routinely two metres from the line, inside the goal area.
//
// The rule being modelled is the real one, and it is narrower than "stay out of
// the D": a player may cross the goal-area line freely, and may land inside it,
// but he may never CARRY the ball in. So the ball has to go before the line
// does. That gives the three functions here:
//
//   takeOffPoint             -- the step that would carry him across IS the take-off
//   mustReleaseAt            -- that, plus the backstop for a man already inside
//   releaseRequiredBefore    -- both, asked of the step actually about to happen
//   releasePointOf           -- the origin any shot is resolved from
//   landAfterRelease         -- the release ends the approach; he lands and recovers
//   goalAreaRecoveryActions  -- a man who has landed inside gets out again
//
// Nothing here decides whether a shot is taken or what becomes of it. M9 still
// owns the outcome; this module only answers where the ball was when it left.

import { insideAnyGoalArea, latestLegalPointOnPath, nearestLegalPoint, goalAreaContaining } from "../domain/geometry/goalArea";
import type { MeterPoint } from "../domain/geometry/coordinates";
import type { Player } from "../domain/handball/player";
import type { HandballState } from "../domain/handball/state";
import type { HandballAction, MoveAction } from "../domain/handball/actions";
import { advancePlayerMovement } from "./movement";
import { step } from "./engine";

/**
 * The point this player's NEXT step would carry him across the goal-area line
 * at, or null if it would not.
 *
 * The prediction is the movement model itself rather than a guess about it:
 * `advancePlayerMovement` is pure, so asking it where he will be in `dt` and
 * asking where he actually goes are the same question. That matters, because a
 * take-off that did not match the step would put the release somewhere the
 * player never was.
 */
/**
 * How far ahead the take-off is committed to, in simulation steps.
 *
 * A player commits to a jump before the line, not on it. Predicting a single
 * step is also not enough in practice: the prediction is made from the intent
 * he has now, and the orders issued during the same iteration can change where
 * that step actually takes him. Looking three steps -- 0.15s, about half a
 * metre at full sprint -- means he lets the ball go a stride early rather than
 * a stride late, which is both the right handball and the difference between
 * "almost never in the area" and "never".
 */
const TAKE_OFF_LOOKAHEAD_STEPS = 3;

export function takeOffPoint(player: Player, dt: number): MeterPoint | null {
  if (insideAnyGoalArea(player.position)) return null;
  const horizon = dt * TAKE_OFF_LOOKAHEAD_STEPS;
  // Where he is about to be. `advancePlayerMovement` does not move a player who
  // has no live order, and a carrier who has just taken a pass has exactly that
  // -- no order and full running speed. Predicting him as stationary is why a
  // man kept crossing the line at a stride a frame; his own momentum is the
  // honest prediction, and it is what the movement model will give him the
  // moment this step's orders reach him.
  const running = player.intent.type === "MOVE" || player.intent.type === "ATTACK" ? !player.intent.completed : false;
  const next = running
    ? advancePlayerMovement(player, horizon).position
    : { x: player.position.x + player.velocity.x * horizon, y: player.position.y + player.velocity.y * horizon };
  const side = goalAreaContaining(next);
  if (side === null) return null;
  return latestLegalPointOnPath(player.position, next, side);
}

/**
 * Where a carrier who is ALREADY standing in the goal area must let it go, or
 * null if he is on legal ground.
 *
 * The backstop, and it earns its place: the take-off above only sees a man
 * about to cross, so however else a carrier ends up inside -- a phase that left
 * him under an old order, a regain, a restart -- nothing was forcing the ball
 * out of his hands again, and he stood in the D holding it. He cannot carry it
 * a moment longer, so the release is now, from the nearest legal ground.
 *
 * It is a backstop rather than the mechanism: if this fires often, something
 * upstream is walking carriers into the area and that is the thing to fix.
 */
export function forcedReleasePoint(player: Player): MeterPoint | null {
  const side = goalAreaContaining(player.position);
  if (side === null) return null;
  return nearestLegalPoint(player.position, side);
}

/** The point a carrier must release from this step, whichever reason applies. */
export function mustReleaseAt(player: Player, dt: number): MeterPoint | null {
  return forcedReleasePoint(player) ?? takeOffPoint(player, dt);
}

/**
 * Where a shot by this player leaves his hand.
 *
 * Almost always his own position: the approach is constrained so that a carrier
 * is not walked into the area, and the take-off releases the ball before the
 * line. This is the funnel every shot passes through all the same, so that a
 * shot origin is legal by construction rather than by the good behaviour of
 * each caller -- including callers M16 has not written yet.
 */
export function releasePointOf(shooter: Player): MeterPoint {
  const side = goalAreaContaining(shooter.position);
  if (side === null) return { ...shooter.position };
  return nearestLegalPoint(shooter.position, side);
}

/**
 * QA FIX 2A: THE LANDING.
 *
 * A shooter who takes off over the line lands inside the goal area, which is
 * legal and is the whole reason the release is separated from the player. What
 * is not legal is staying there. Before this, nothing ever told him to leave:
 * he was ordered at the goal centre, he arrived, and he stood in the middle of
 * the D for the rest of the possession -- which is why a field player was
 * carrying the ball inside the area for around 260 frames a match, most of them
 * simply men who had finished a break and never come out.
 *
 * So every field player standing in an area is sent to the nearest point
 * outside it. He is not teleported and he is not stopped: his momentum still
 * carries him in, he decelerates, and he walks out, which is what a landing
 * looks like. A player already on his way out is left alone -- re-issuing an
 * order every step is what cost a fifth of all possessions once before.
 */
export function goalAreaRecoveryActions(state: HandballState): readonly MoveAction[] {
  const orders: MoveAction[] = [];
  for (const player of state.players) {
    if (player.kind !== "FIELD_PLAYER") continue;
    const side = goalAreaContaining(player.position);
    if (side === null) continue;
    // He may not carry it out; the ball has to go first, and that is M9's
    // business. Ordering him about while he holds it would only move the
    // violation, so he is left for the release model to deal with.
    if (state.ball.possessorId === player.id) continue;
    // A man with a ball on its way to him comes out for it, whatever else he
    // was doing: the pass cannot complete while he is in there, so leaving him
    // to his order would leave the ball hanging.
    const waitingForAPass = state.ball.status === "IN_FLIGHT" && state.ball.flight?.receiverId === player.id;
    // Otherwise, only a man who has STOPPED in there. A player still under an
    // order is going somewhere, and overriding him is not a recovery -- it is a
    // second policy fighting the first. Sending everybody standing on the line
    // out of it was measured and cost 17% of all possessions and 19% of all
    // goals, because a defender whose home sits on the six-metre line then
    // oscillated across it instead of defending.
    const stillGoingSomewhere = (player.intent.type === "MOVE" || player.intent.type === "ATTACK") && !player.intent.completed;
    if (stillGoingSomewhere && !waitingForAPass) continue;
    orders.push({ type: "MOVE", playerId: player.id, target: nearestLegalPoint(player.position, side) });
  }
  return orders;
}

/**
 * QA FIX 2A: what the shooter does once the ball has gone.
 *
 * His approach order was "run at the goal", and until the ball left his hand
 * that was the right order. It is not the right order afterwards, and nothing
 * ever replaced it: he carried on to the goal centre, arrived, and stood there
 * for the rest of the match. That is the single largest source of a field
 * player found in the goal area -- he does not even have to touch the ball
 * again for it to matter, because the next regain can hand it to him where he
 * stands.
 *
 * So the release ends the approach. He has already followed through -- the ball
 * flight is real simulated time and his momentum carried him in during it --
 * and this is the landing: from wherever that left him, he recovers to the
 * nearest legal ground. Issued as an ordinary command at zero elapsed time, so
 * it is his intent that changes and not his position.
 */
export function landAfterRelease(state: HandballState, shooterId: string): HandballState {
  const shooter = state.players.find((p) => p.id === shooterId);
  if (!shooter || shooter.kind !== "FIELD_PLAYER") return state;
  const side = goalAreaContaining(shooter.position);
  const target = side === null ? { ...shooter.position } : nearestLegalPoint(shooter.position, side);
  return step(state, { actions: [{ type: "MOVE", playerId: shooterId, target }] }, 0);
}

/**
 * QA FIX 2A: the release, decided against the orders about to be executed.
 *
 * The take-off has to be judged from the step the engine is ACTUALLY about to
 * take, not from the intent the carrier happened to be carrying when the
 * iteration began. Those are different things: the same iteration issues him a
 * fresh order -- run at the goal, follow your lane -- and a man already at full
 * speed then covers a fifth of a metre under the new one. Predicting from the
 * stale intent said "he is not crossing", and he crossed, and for that one
 * frame an outfield player held the ball inside the goal area.
 *
 * So the commands are applied at zero elapsed time, which changes intents and
 * nothing else, and the question is asked of that state. Returns null unless an
 * outfield carrier is about to be carried in, or is in already.
 */
export function releaseRequiredBefore(
  state: HandballState,
  actions: readonly HandballAction[],
  carrierId: string | null,
  dt: number,
): MeterPoint | null {
  if (carrierId === null || state.ball.status !== "POSSESSED" || state.ball.possessorId !== carrierId) return null;
  const commanded = step(state, { actions }, 0);
  if (commanded.ball.possessorId !== carrierId) return null;
  const carrier = commanded.players.find((p) => p.id === carrierId);
  if (!carrier || carrier.kind !== "FIELD_PLAYER") return null;
  return mustReleaseAt(carrier, dt);
}
