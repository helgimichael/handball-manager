/**
 * MATCH-EXPERIENCE-2.0 M10: fouls, 7 metres and suspensions.
 *
 * The engine already had contact: a defender inside 1.6m of the carrier could,
 * per step, take the ball off him. What it did with that contact was decide by
 * coin flip whether it counted as a turnover or a free throw. Nothing asked
 * WHAT the defender had actually done, so a shirt-pull at the halfway line and
 * a foul that wiped out an open run at goal were the same event.
 *
 * A foul is now classified from the situation it happened in:
 *
 *   CONTACT -> was a clear scoring chance destroyed?  -> 7 METRES (+ 2 minutes)
 *           -> was it a hard, late challenge?         -> FREE THROW + 2 minutes
 *           -> otherwise                              -> FREE THROW
 *
 * Every input is spatial. "Clear scoring chance" is not a flag somebody sets:
 * it is measured by asking whether anybody except the goalkeeper is still
 * between this attacker and the goal he is running at. "Hard" is read from how
 * fast the defender was closing. A defender standing his ground in the 6:0 and
 * conceding a free throw is doing his job; the same contact from a man
 * sprinting in from behind the attacker is not.
 *
 * This module decides nothing about probability -- whether contact happens at
 * all is still the possession/transition engine's per-step model. It only says
 * what the contact WAS.
 */
import { COURT_LENGTH_METERS } from "../domain/geometry/court";
import { distanceBetween, type MeterPoint } from "../domain/geometry/coordinates";
import { goalCentre, type AttackingGoalSide } from "../domain/match/possession";
import type { Player } from "../domain/handball/player";
import type { HandballState } from "../domain/handball/state";

export const FOUL_LIMITS = Object.freeze({
  /**
   * A defender within this of the run to goal, and goal-side of the attacker,
   * still counts as covering the chance.
   *
   * Deliberately wide. A narrow corridor to the goal CENTRE made almost every
   * foul in organized play a 7 metre: a carrier driving into a set 6:0 has five
   * defenders around him, but none of them sits exactly on the line to the
   * middle of the goal, so excluding the man who fouled him left "nobody
   * between him and the goal". A defender three metres to the side and
   * goal-side of the attacker can plainly still stop him legally, which is
   * exactly what rule 14 asks.
   *
   * M13 (Calibration 1.0) MEASURED how wide "wide" had to be. At 3m, 80% of all
   * fouls were still being judged clear chances, and of the ones that were not,
   * eleven in thirteen had found exactly ONE covering defender and none ever
   * found three. That is the tell: a 6:0 line stands about 2.5-3.5m between
   * neighbours, so at 3m the test could only ever see the man directly in
   * front, and removing him -- as the rule requires, since he is the offender --
   * left the goal apparently open every time. 4.5m is the distance at which the
   * fouler's NEIGHBOURS count, which is what a referee is actually judging.
   */
  coverLaneMeters: 4.5,
  /**
   * Beyond this range from goal a chance is not "clear" however open it is.
   *
   * M13: 11m was a shot's range, not a chance's. Measured, a quarter of the
   * awarded 7 metres were for fouls 8-10m out with a set defence behind the
   * ball, which no referee gives. A clear chance is a man going THROUGH, and by
   * the time he is inside 8m with only the keeper left, he is going through.
   */
  clearChanceRangeMeters: 8,
  /** Closing faster than this is a late challenge rather than a held position. */
  hardChallengeSpeed: 2.6,
  /** How long a suspension lasts, in official match seconds. */
  suspensionSeconds: 120,
  /** Distance of the 7m mark from the goal line. */
  sevenMetreMarkMeters: 7,
  /** Everybody else must be this far from the taker at a 7m. */
  sevenMetreClearanceMeters: 3,
  /** ...and outside the free-throw line. */
  freeThrowLineMeters: 9,
});

/**
 * What the contact itself was. This is the SEVERITY axis, and it is judged
 * independently of what the foul cost.
 */
export type FoulKind = "ORDINARY" | "HARD";
/** How play restarts. Decided by what the foul cost, not by how bad it was. */
export type FoulRestart = "FREE_THROW" | "SEVEN_METRE";
/** What happens to the offender. Decided by the foul itself, not by the restart. */
export type FoulPunishment = "NO_PERSONAL_PUNISHMENT" | "TWO_MINUTES";

export type FoulAward = {
  readonly defenderId: string;
  readonly victimId: string;
  /** The severity of the contact. */
  readonly kind: FoulKind;
  /** Whether a clear scoring chance was illegally destroyed. */
  readonly destroyedClearChance: boolean;
  /** The restart: a 7 metre when a clear chance was destroyed, otherwise a free throw. */
  readonly restart: FoulRestart;
  /** The personal punishment, judged on the foul's own severity. */
  readonly punishment: FoulPunishment;
  /** Convenience for callers: punishment === "TWO_MINUTES". */
  readonly suspend: boolean;
  readonly position: MeterPoint;
  readonly simulationTime: number;
  readonly reason: string;
};

export type ClearChance = {
  readonly clear: boolean;
  /** Defenders (goalkeeper excluded) still between him and the goal. */
  readonly coveringDefenderIds: readonly string[];
  readonly distanceToGoal: number;
  readonly reason: string;
};

/** Distance from a point to the segment a-b. */
function distanceToSegment(point: MeterPoint, a: MeterPoint, b: MeterPoint): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-9) return distanceBetween(point, a);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / len2));
  return distanceBetween(point, { x: a.x + abx * t, y: a.y + aby * t });
}

/** How far up the court a point is, measured toward `goalSide`. */
function advancement(point: MeterPoint, goalSide: AttackingGoalSide): number {
  return goalSide === "TOP" ? COURT_LENGTH_METERS - point.y : point.y;
}

/**
 * Did this attacker have a clear run at goal?
 *
 * Measured, not flagged: he is in range, and no outfield defender is both
 * goal-side of him and close enough to the line he would run to be able to do
 * anything about it. The goalkeeper is excluded on purpose -- a chance is
 * "clear" precisely when the keeper is the only man left.
 */
export function clearScoringChance(state: HandballState, attacker: Player, goalSide: AttackingGoalSide, excludeDefenderId?: string): ClearChance {
  const goal = goalCentre(goalSide);
  const distanceToGoal = distanceBetween(attacker.position, goal);
  const attackerAdvancement = advancement(attacker.position, goalSide);
  const covering: string[] = [];
  for (const defender of state.players) {
    if (defender.team !== "DEFENSE" || defender.kind !== "FIELD_PLAYER") continue;
    if (defender.id === excludeDefenderId) continue;
    if (advancement(defender.position, goalSide) <= attackerAdvancement) continue;
    if (distanceToSegment(defender.position, attacker.position, goal) > FOUL_LIMITS.coverLaneMeters) continue;
    covering.push(defender.id);
  }
  const inRange = distanceToGoal <= FOUL_LIMITS.clearChanceRangeMeters;
  const clear = inRange && covering.length === 0;
  return {
    clear,
    coveringDefenderIds: covering,
    distanceToGoal,
    reason: clear
      ? `nobody but the keeper between him and the goal, ${distanceToGoal.toFixed(1)}m out`
      : covering.length > 0
        ? `${covering.length} defender(s) still covering`
        : `${distanceToGoal.toFixed(1)}m out, too far to be a clear chance`,
  };
}

/**
 * What this contact was, and what it cost -- judged as TWO INDEPENDENT
 * questions, which is how the rulebook asks them.
 *
 *   RESTART      did the foul destroy a clear scoring chance? Then 7 metres.
 *                Otherwise a free throw. This is about what was taken away.
 *   PUNISHMENT   was the foul itself worth two minutes? That is about the
 *                challenge -- how late and how hard -- and nothing else.
 *
 * Conflating them was wrong: a 7 metre does not automatically carry a
 * suspension, and a suspension does not require a clear chance to have been
 * destroyed. All four combinations are therefore reachable:
 *
 *   ordinary contact, chance covered   -> free throw
 *   late challenge, chance covered     -> free throw + two minutes
 *   ordinary contact, chance destroyed -> 7 metres
 *   late challenge, chance destroyed   -> 7 metres + two minutes
 *
 * The offending defender is excluded from the cover count when judging the
 * chance: the question a referee asks is what the attacker had BEFORE this man
 * illegally stopped him, and the offender is by definition standing in the way
 * at the moment he commits the foul.
 */
export function judgeFoul(
  state: HandballState,
  carrier: Player,
  defender: Player,
  goalSide: AttackingGoalSide,
  simulationTime: number,
): FoulAward {
  const chance = clearScoringChance(state, carrier, goalSide, defender.id);
  const closingSpeed = Math.hypot(defender.velocity.x, defender.velocity.y);

  // Severity: how the challenge was made.
  const hard = closingSpeed >= FOUL_LIMITS.hardChallengeSpeed;
  const kind: FoulKind = hard ? "HARD" : "ORDINARY";
  const punishment: FoulPunishment = hard ? "TWO_MINUTES" : "NO_PERSONAL_PUNISHMENT";
  // Restart: what the challenge cost.
  const restart: FoulRestart = chance.clear ? "SEVEN_METRE" : "FREE_THROW";

  const challenge = hard ? `arrives late at ${closingSpeed.toFixed(1)}m/s` : `holds him up`;
  const cost = chance.clear ? `destroying a clear chance (${chance.reason})` : chance.reason;
  return {
    defenderId: defender.id,
    victimId: carrier.id,
    kind,
    destroyedClearChance: chance.clear,
    restart,
    punishment,
    suspend: punishment === "TWO_MINUTES",
    position: { ...carrier.position },
    simulationTime,
    reason: `${defender.id} ${challenge}, ${cost}`,
  };
}

// ---------------------------------------------------------------------------
// The 7m restart
// ---------------------------------------------------------------------------

/** The 7m mark in front of the goal being attacked. */
export function sevenMetreMark(goalSide: AttackingGoalSide): MeterPoint {
  const goal = goalCentre(goalSide);
  return { x: goal.x, y: goalSide === "TOP" ? FOUL_LIMITS.sevenMetreMarkMeters : COURT_LENGTH_METERS - FOUL_LIMITS.sevenMetreMarkMeters };
}

/**
 * Where everybody stands for a 7m: the taker on the mark, the keeper on his
 * line, and every other player outside the free-throw line and clear of the
 * taker. They walk there during the dead ball -- nobody is placed.
 */
export function sevenMetreFormationTarget(player: Player, takerId: string, goalSide: AttackingGoalSide): MeterPoint {
  const goal = goalCentre(goalSide);
  const mark = sevenMetreMark(goalSide);
  if (player.id === takerId) return mark;
  if (player.kind === "GOALKEEPER") {
    // The defending keeper takes his line; the far keeper stays in his own goal.
    const ownGoal = player.team === "DEFENSE" ? goal : goalCentre(goalSide === "TOP" ? "BOTTOM" : "TOP");
    return { x: ownGoal.x, y: ownGoal.y + (ownGoal.y === 0 ? 0.6 : -0.6) };
  }
  // Fan out along the free-throw line, on the side of the court they are
  // already on, and never inside the clearance around the taker.
  const side = player.position.x <= goal.x ? -1 : 1;
  const lateral = Math.max(FOUL_LIMITS.sevenMetreClearanceMeters, Math.abs(player.position.x - goal.x));
  const depth = FOUL_LIMITS.freeThrowLineMeters + (player.team === "DEFENSE" ? 1.5 : 0);
  return {
    x: Math.max(1, Math.min(19, goal.x + side * lateral)),
    y: goalSide === "TOP" ? depth : COURT_LENGTH_METERS - depth,
  };
}

/** True once the taker is on the mark and everybody else has cleared out. */
export function sevenMetreReady(state: HandballState, takerId: string, goalSide: AttackingGoalSide): boolean {
  const mark = sevenMetreMark(goalSide);
  const taker = state.players.find((p) => p.id === takerId);
  if (!taker || distanceBetween(taker.position, mark) > 0.6) return false;
  return state.players.every((p) => {
    if (p.id === takerId || p.kind === "GOALKEEPER") return true;
    return distanceBetween(p.position, mark) >= FOUL_LIMITS.sevenMetreClearanceMeters - 0.3;
  });
}
