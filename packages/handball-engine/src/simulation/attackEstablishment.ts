// HUMAN QA FIX 2B: an attack that has not formed yet is not an attack yet.
//
// A human watched a centre throw-off end in a shot after two and a quarter
// seconds, with the line player and both wings still running up from the
// halfway line. The engine was not wrong about any single decision: M6 was
// asked "what is the best thing to do here?" and answered honestly. It was
// asked too early. The same thing happens in a deliberate 7v6 -- the seventh
// man exchanges legally, starts running, and his team shoots before he has
// arrived, which is the one thing a seven-out attack exists not to do.
//
// So an attack that has just been rebuilt is ESTABLISHING until the structure
// it needs actually exists on the court, and only then READY. Two things this
// deliberately is not:
//
//   NOT a generic settle. QA Fix Pass 1 tried "every possession settles first"
//   and it cost 114.8 possessions and 51.7 goals a match, because it re-issued
//   shape orders to the carrier every single step. Establishment here is
//   event-specific (a restart, an exchange), short-lived, and issues its orders
//   through the ordinary shape machinery rather than steering anybody.
//
//   NOT a set play. Nothing here says "throw off, then pass to the left back".
//   While establishing, M6 still chooses; it is simply not allowed to pick the
//   committed finish yet, and it regains full authority the moment the attack
//   is READY.
//
// Readiness is deliberately SEMANTIC. "Everybody within half a metre of a
// canonical spot" would be a formation drill, and the spots move -- the pivot's
// target follows the defence. What is asked instead is the handball question:
// are the backs into their working zone, is there a man on the line, is there
// width to attack with, and (for a seven-out attack) has the extra man actually
// joined the second line?

import { distanceBetween, type MeterPoint } from "../domain/geometry/coordinates";
import { goalCentre, type AttackingGoalSide } from "../domain/match/possession";
import { isLeavingCourt } from "./substitutionExit";
import type { HandballState } from "../domain/handball/state";
import type { Player } from "../domain/handball/player";

/** What rebuilt the attack, and therefore what it has to rebuild into. */
export type EstablishmentTrigger = "CENTRE_RESTART" | "SEVENTH_ATTACKER";

/**
 * How close to the attacking goal an outfield player has to be before he counts
 * as working in the attack rather than travelling towards it.
 *
 * Fifteen metres, which is the free-throw line plus a few strides. The
 * canonical shape puts the backs between eight and twelve metres out and the
 * wings around nine, so this is comfortably outside the shape itself: it asks
 * whether he has arrived in the attacking third, not whether he has found his
 * spot in it. A restart starts everybody twenty to twenty-nine metres out.
 */
const WORKING_ZONE_METERS = 15;

/**
 * Line depth. Nine metres is the free-throw line and the canonical pivot stands
 * at about six and a half, so a line player inside this is genuinely on the
 * line rather than still arriving at it.
 */
const LINE_DEPTH_METERS = 9;

/**
 * Second-line depth for the seventh attacker. Looser than the line itself,
 * because M6B works a gap behind the first pivot rather than beside him -- what
 * is being asked is whether he has joined the attacking structure, not whether
 * he has taken a specific spot in it.
 */
const SECOND_LINE_DEPTH_METERS = 11;

/**
 * The lateral spread an attack needs before it is an attack at all.
 *
 * Twelve metres of a twenty-metre court. This is rarely the binding condition
 * -- a side breaking out of its own half is already strung across the width --
 * and it is kept because it is a real requirement that a future formation could
 * violate, not because it is doing the work here. The work is done by depth.
 */
const ESTABLISHED_WIDTH_METERS = 12;

/**
 * How long an attack may spend establishing before it plays whatever it has.
 *
 * Not a timer the model runs on -- readiness is the structure, and this is the
 * bound that keeps "in finite time" a fact rather than a hope. Twelve seconds
 * is longer than any healthy rebuild measured here; reaching it means somebody
 * is stuck, and a stuck attack still has to play.
 */
export const MAX_ESTABLISHING_SECONDS = 12;

export type EstablishmentReading = {
  readonly ready: boolean;
  /** What is still missing, in the words the trace should use. */
  readonly missing: readonly string[];
};

function attackingOutfielders(state: HandballState): readonly Player[] {
  return state.players.filter((p) => p.team === "ATTACK" && p.kind === "FIELD_PLAYER" && !isLeavingCourt(p));
}

function spread(players: readonly Player[]): number {
  if (players.length === 0) return 0;
  const xs = players.map((p) => p.position.x);
  return Math.max(...xs) - Math.min(...xs);
}

/**
 * Is the attacking structure this trigger requires actually present?
 *
 * Reads the court as it is. Nobody is asked to be anywhere in particular; the
 * question is whether the shape exists, however it got there.
 */
export function readEstablishment(
  state: HandballState,
  goalSide: AttackingGoalSide,
  trigger: EstablishmentTrigger,
): EstablishmentReading {
  const goal: MeterPoint = goalCentre(goalSide);
  const outfield = attackingOutfielders(state);
  const missing: string[] = [];
  if (outfield.length === 0) return { ready: true, missing };

  const distanceTo = (player: Player) => distanceBetween(player.position, goal);

  // 1. Everybody who is going to attack has arrived in the attack.
  const travelling = outfield.filter((p) => distanceTo(p) > WORKING_ZONE_METERS);
  if (travelling.length > 0) {
    missing.push(`${travelling.length} still travelling (${travelling.map((p) => p.role).join(", ")})`);
  }

  // 2. Somebody is on the line. Without a line player there is no gap to open
  //    and no pivot to play, which is most of what an organized attack is.
  const onTheLine = outfield.filter((p) => p.role === "PIVOT" && distanceTo(p) <= LINE_DEPTH_METERS);
  if (onTheLine.length === 0) missing.push("no line player at line depth");

  // 3. There is width to attack with.
  const width = spread(outfield);
  if (width < ESTABLISHED_WIDTH_METERS) missing.push(`only ${width.toFixed(1)}m wide`);

  // 4. And for a seven-out attack, the man it was built around is in it.
  if (trigger === "SEVENTH_ATTACKER") {
    const extra = outfield.filter((p) => p.role === "EXTRA_ATTACKER");
    if (extra.length === 0) missing.push("the seventh attacker is not on court");
    else if (!extra.some((p) => distanceTo(p) <= SECOND_LINE_DEPTH_METERS)) {
      missing.push(`the seventh attacker is ${Math.min(...extra.map(distanceTo)).toFixed(1)}m out`);
    }
  }

  return { ready: missing.length === 0, missing };
}

/** A one-line description of what the attack is still waiting for. */
export function describeEstablishment(reading: EstablishmentReading): string {
  return reading.ready ? "the attack is set" : reading.missing.join("; ");
}

/**
 * Decisions an establishing attack may not take yet.
 *
 * The narrowest possible restriction: a committed FINISH. Circulation, passing,
 * playing the pivot and resetting are all still available, so the attack works
 * the ball while it forms -- which is what a real one does -- rather than
 * standing still, and M6 is still the thing choosing between them.
 */
export function isCommittedFinish(kind: string): boolean {
  return kind === "SHOOT" || kind === "ATTACK_GAP";
}
