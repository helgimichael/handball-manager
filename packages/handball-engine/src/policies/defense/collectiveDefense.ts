/**
 * MATCH-EXPERIENCE-2.0 M7: the collective layer of the 6:0 defence.
 *
 *   PERCEIVE ATTACK -> ASSIGN RESPONSIBILITY -> COLLECTIVE REACTION
 *     -> HELP / HANDOVER / RECOVER -> NEW DEFENSIVE STATE
 *
 * Before M7 the 6:0 was six independent reactions to the ball carrier: the
 * primary stepped, two neighbours leaned, everyone else drifted a few
 * centimetres, and with no drive in progress the whole line walked back to
 * its canonical spots. Nothing marked the pivot, nothing shifted with the
 * ball, nothing held width, and a step-out left the gap beside it open with
 * nobody reading it.
 *
 * This module adds the collective reasoning and nothing else. It is NOT a
 * second defensive engine: it perceives the same HandballState, reuses the
 * existing gap responsibilities, threat observation and responsibility
 * resolver, and hands the 6:0 policy a set of per-defender targets that the
 * policy turns into the same MOVE intents it always produced. Movement is
 * still integrated by the ordinary fixed step -- no defender is ever placed.
 *
 * THE MODEL, compact enough to carry a 5:1 or 3:2:1 later:
 *
 *   line shift    the whole line slides toward the ball, spacing preserved
 *   width hold    a wing defender with an attacker wide beside him stays wide
 *   press         with the ball held but no drive, the defender in front of
 *                 the carrier comes half a metre out of the line
 *   engage        the responsible defender steps out at an actual drive
 *   help          his neighbours close toward the gap he left, on the line
 *   mark pivot    one defender is responsible for the pivot; when that
 *                 defender is the one stepping out, the pivot is handed to
 *                 the neighbour on the pivot's side, or -- if nobody can --
 *                 the pivot is genuinely free, which is what M6 then reads
 *   recover       with the ball in flight or nobody threatening, everyone
 *                 returns to the shifted line by running, not snapping
 *
 * Everything is read from real positions. Responsibility uses the existing
 * hysteresis so handovers happen when an attacker really crosses a zone, not
 * on every centimetre.
 */
import { COURT_BOUNDS_METERS, COURT_LENGTH_METERS, COURT_WIDTH_METERS } from "../../domain/geometry/court";
import {
  addVectors,
  clampPointToBounds,
  distanceBetween,
  normalizeVector,
  scaleVector,
  subtractPoints,
  type MeterPoint,
} from "../../domain/geometry/coordinates";
import type { DefenseRole, Player } from "../../domain/handball/player";
import type { HandballState } from "../../domain/handball/state";
import { SIX_ZERO_ROLE_ADJACENCY, SIX_ZERO_ROLE_ORDER, type SixZeroDefender } from "./responsibility";
import type { DefensiveThreatObservation } from "./types";

export type DefendedGoalSide = "TOP" | "BOTTOM";

/** Per-defender ability the collective layer reads. 1-20. */
export type DefensivePlayerRatings = {
  readonly defending?: number;
};

export type CollectiveDefenseOptions = {
  readonly ratings?: Readonly<Record<string, DefensivePlayerRatings>>;
};

export const COLLECTIVE_DEFENSE_LIMITS = Object.freeze({
  /** How far the line slides toward the ball, per metre the ball is off centre, and its cap. */
  lineShiftPerMeter: 0.12,
  lineShiftMaxMeters: 1.2,
  /** A wing defender holds width when an attacker stands this close to his lane. */
  widthHoldRadiusMeters: 3.5,
  /** How much of the line shift a width-holding wing defender still follows. */
  widthHoldShiftFraction: 0.3,
  /** With the ball held but no drive, the defender in front of it comes this far out. */
  pressMeters: 0.5,
  /** How far off the line a pivot marker may go to sit goal-side of the pivot. */
  pivotMarkReachMeters: 1.0,
  /** How far goal-side of the pivot the marker stands. */
  pivotMarkOffsetMeters: 0.6,
  /** A pivot further from the line than this is not on the line and is not marked. */
  pivotThreatDepthMeters: 3.0,
  /**
   * The current marker keeps the pivot unless another defender is this much
   * closer laterally. Wide, because the pivot works along the line and the
   * marker follows him a metre or so; the pivot is handed over when he has
   * really moved into the next defender's zone, not every time he leans.
   */
  pivotHandoverThresholdMeters: 1.6,
});

const DEFAULT_RATING = 10;

/** 0.7 .. 1.4: how far a defender is willing to step, from his defending rating. */
export function aggressionFor(defenderId: string, options?: CollectiveDefenseOptions): number {
  const defending = options?.ratings?.[defenderId]?.defending ?? DEFAULT_RATING;
  return Math.max(0.7, Math.min(1.4, 1 + 0.04 * (defending - DEFAULT_RATING)));
}

// ---------------------------------------------------------------------------
// Perception
// ---------------------------------------------------------------------------

export type DefensivePerception = {
  readonly goalSide: DefendedGoalSide;
  readonly ball: MeterPoint;
  readonly carrier: Player | null;
  readonly threat: DefensiveThreatObservation;
  /** The attacker working the line, when one is close enough to it to matter. */
  readonly pivot: Player | null;
  readonly attackers: readonly Player[];
  /** The whole line's lateral slide toward the ball. */
  readonly lineShift: number;
  /** Depth of the defensive line (mean home y). */
  readonly lineDepth: number;
};

/**
 * Which goal this defence protects, read from the state: the defending
 * goalkeeper's end, else the home shape's end, else the defenders' own end.
 */
export function defendedGoalSideOf(state: HandballState): DefendedGoalSide {
  const half = COURT_LENGTH_METERS / 2;
  const keeper = state.players.find((p) => p.team === "DEFENSE" && p.kind === "GOALKEEPER");
  if (keeper) return keeper.position.y < half ? "TOP" : "BOTTOM";
  const homes = state.defense.homePositions;
  if (homes.length > 0) return homes.reduce((s, h) => s + h.position.y, 0) / homes.length < half ? "TOP" : "BOTTOM";
  const defenders = state.players.filter((p) => p.team === "DEFENSE");
  if (defenders.length === 0) return "TOP";
  return defenders.reduce((s, d) => s + d.position.y, 0) / defenders.length < half ? "TOP" : "BOTTOM";
}

/** Moves `distance` metres toward the defended goal. */
export function towardGoal(y: number, goalSide: DefendedGoalSide, distance: number): number {
  return goalSide === "TOP" ? y - distance : y + distance;
}

export function perceiveAttack(state: HandballState, threat: DefensiveThreatObservation, defenders: readonly SixZeroDefender[]): DefensivePerception {
  const goalSide = defendedGoalSideOf(state);
  const attackers = state.players.filter((p) => p.team === "ATTACK" && p.kind === "FIELD_PLAYER");
  const carrier = state.ball.possessorId ? (attackers.find((p) => p.id === state.ball.possessorId) ?? null) : null;
  const homes = defenders.map((d) => homeOf(state, d).position);
  const lineDepth = homes.length > 0 ? homes.reduce((s, h) => s + h.y, 0) / homes.length : towardGoal(goalSideLine(goalSide), goalSide, 0);
  // The pivot is whoever works the line: the PIVOT by role if he is near it,
  // otherwise any attacker standing on it.
  const nearLine = (p: Player) => Math.abs(p.position.y - lineDepth) <= COLLECTIVE_DEFENSE_LIMITS.pivotThreatDepthMeters;
  const byRole = attackers.find((p) => p.role === "PIVOT" && nearLine(p));
  const anyOnLine = attackers.filter((p) => p.id !== carrier?.id && nearLine(p)).sort((a, b) => Math.abs(a.position.y - lineDepth) - Math.abs(b.position.y - lineDepth) || a.id.localeCompare(b.id))[0];
  const pivot = byRole ?? anyOnLine ?? null;
  const rawShift = COLLECTIVE_DEFENSE_LIMITS.lineShiftPerMeter * (state.ball.position.x - COURT_WIDTH_METERS / 2);
  const lineShift = Math.max(-COLLECTIVE_DEFENSE_LIMITS.lineShiftMaxMeters, Math.min(COLLECTIVE_DEFENSE_LIMITS.lineShiftMaxMeters, rawShift));
  return { goalSide, ball: { ...state.ball.position }, carrier, threat, pivot, attackers, lineShift, lineDepth };
}

function goalSideLine(goalSide: DefendedGoalSide): number {
  return goalSide === "TOP" ? 6.5 : COURT_LENGTH_METERS - 6.5;
}

export function homeOf(state: HandballState, defender: SixZeroDefender): { playerId: string; role: DefenseRole; position: MeterPoint } {
  return (
    state.defense.homePositions.find((home) => home.playerId === defender.id) ?? {
      playerId: defender.id,
      role: defender.role,
      position: defender.position,
    }
  );
}

// ---------------------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------------------

export type DefensiveAssignment = {
  /** Steps out at the active drive. */
  readonly primaryId: string | null;
  /** Close toward the gap the primary left. */
  readonly helperIds: readonly string[];
  /** Responsible for the pivot. Null when responsibility has genuinely broken down. */
  readonly pivotMarkerId: string | null;
  /** Comes out of the line to the held ball when nobody is driving. */
  readonly presserId: string | null;
  /** Wing defenders holding width against a wide attacker. */
  readonly widthHolderIds: readonly string[];
};

/**
 * Which defender is naturally responsible for the pivot: the one whose
 * (shifted) home is laterally nearest him. The stepping primary is never a
 * candidate -- he has left the line -- which is exactly how a step-out hands
 * the pivot to the neighbour or leaves him free.
 */
function naturalPivotMarker(
  perception: DefensivePerception,
  defenders: readonly SixZeroDefender[],
  shiftedHomes: ReadonlyMap<string, MeterPoint>,
  excludeId: string | null,
  previousMarkerId: string | null,
): string | null {
  const pivot = perception.pivot;
  if (!pivot) return null;
  const candidates = defenders
    .filter((d) => d.id !== excludeId)
    .map((d) => ({ id: d.id, lateral: Math.abs((shiftedHomes.get(d.id) ?? d.position).x - pivot.position.x), role: d.role }))
    .sort((a, b) => a.lateral - b.lateral || SIX_ZERO_ROLE_ORDER.indexOf(a.role) - SIX_ZERO_ROLE_ORDER.indexOf(b.role));
  const best = candidates[0];
  if (!best) return null;
  // Handover hysteresis: keep the current marker unless somebody is clearly closer.
  const previous = candidates.find((c) => c.id === previousMarkerId);
  if (previous && previous.lateral <= best.lateral + COLLECTIVE_DEFENSE_LIMITS.pivotHandoverThresholdMeters) return previous.id;
  return best.id;
}

/** The wing defender whose lane an attacker is standing beside, on his own side of the court. */
function holdsWidth(defender: SixZeroDefender, home: MeterPoint, perception: DefensivePerception): boolean {
  if (defender.role !== "L1" && defender.role !== "R1") return false;
  const centre = COURT_WIDTH_METERS / 2;
  return perception.attackers.some((a) => {
    const sameSide = defender.role === "L1" ? a.position.x < centre : a.position.x > centre;
    return sameSide && Math.abs(a.position.x - home.x) <= COLLECTIVE_DEFENSE_LIMITS.widthHoldRadiusMeters && a.id !== perception.carrier?.id;
  });
}

export function assignResponsibilities(
  perception: DefensivePerception,
  defenders: readonly SixZeroDefender[],
  primaryId: string | null,
  shiftedHomes: ReadonlyMap<string, MeterPoint>,
  previousMarkerId: string | null,
  state: HandballState,
): DefensiveAssignment {
  const byId = new Map(defenders.map((d) => [d.id, d]));
  const primary = primaryId ? byId.get(primaryId) ?? null : null;

  const pivotMarkerId = naturalPivotMarker(perception, defenders, shiftedHomes, primary?.id ?? null, previousMarkerId);

  // Help comes from the primary's neighbours -- except the one who is busy
  // with the pivot. That is the "two threats" rule: a step-out never pulls
  // the pivot's marker off him.
  const helperIds = primary
    ? SIX_ZERO_ROLE_ADJACENCY[primary.role]
        .map((role) => defenders.find((d) => d.role === role))
        .filter((d): d is SixZeroDefender => d !== undefined && d.id !== pivotMarkerId)
        .map((d) => d.id)
    : [];

  // With the ball held but nobody driving, the defender in front of the ball
  // presses half a metre -- unless he is marking the pivot.
  let presserId: string | null = null;
  if (!primary && perception.carrier && perception.threat.type === "POSSESSION_THREAT") {
    const carrierX = perception.carrier.position.x;
    const nearest = [...defenders]
      .filter((d) => d.id !== pivotMarkerId)
      .sort((a, b) => Math.abs((shiftedHomes.get(a.id) ?? a.position).x - carrierX) - Math.abs((shiftedHomes.get(b.id) ?? b.position).x - carrierX) || a.id.localeCompare(b.id))[0];
    presserId = nearest?.id ?? null;
  }

  const widthHolderIds = defenders.filter((d) => holdsWidth(d, homeOf(state, d).position, perception)).map((d) => d.id);

  return { primaryId: primary?.id ?? null, helperIds, pivotMarkerId, presserId, widthHolderIds };
}

// ---------------------------------------------------------------------------
// Targets -- where each defender goes, all bounded, all from real positions
// ---------------------------------------------------------------------------

export type CollectiveReactionType = "ENGAGE" | "SUPPORT" | "SHIFT" | "RECOVER" | "PRESS" | "MARK_PIVOT";

export type CollectiveReaction = {
  readonly defenderId: string;
  readonly role: DefenseRole;
  readonly reactionType: CollectiveReactionType;
  readonly target: MeterPoint;
};

export type CollectiveReactionLimits = {
  readonly primaryMaxDisplacementMeters: number;
  readonly supportMaxDisplacementMeters: number;
  readonly farSideShiftMaxDisplacementMeters: number;
  readonly goalSideOffsetMeters: number;
};

/** Every defender's home slid toward the ball; a width-holding wing only partly. */
export function shiftedHomes(state: HandballState, defenders: readonly SixZeroDefender[], perception: DefensivePerception): Map<string, MeterPoint> {
  const map = new Map<string, MeterPoint>();
  for (const defender of defenders) {
    const home = homeOf(state, defender).position;
    const fraction = holdsWidth(defender, home, perception) ? COLLECTIVE_DEFENSE_LIMITS.widthHoldShiftFraction : 1;
    map.set(defender.id, clampPointToBounds({ x: home.x + perception.lineShift * fraction, y: home.y }, COURT_BOUNDS_METERS));
  }
  return map;
}

function limitedFrom(base: MeterPoint, target: MeterPoint, maxDisplacement: number): MeterPoint {
  const distance = distanceBetween(base, target);
  if (distance <= maxDisplacement) return clampPointToBounds(target, COURT_BOUNDS_METERS);
  return clampPointToBounds(addVectors(base, scaleVector(normalizeVector(subtractPoints(target, base)), maxDisplacement)), COURT_BOUNDS_METERS);
}

/**
 * Computes every defender's target for this instant from the perception and
 * the assignment. Pure and deterministic.
 */
export function collectiveReactions(
  state: HandballState,
  defenders: readonly SixZeroDefender[],
  perception: DefensivePerception,
  assignment: DefensiveAssignment,
  homes: ReadonlyMap<string, MeterPoint>,
  limits: CollectiveReactionLimits,
  options?: CollectiveDefenseOptions,
): CollectiveReaction[] {
  const threatPosition = perception.threat.type === "NO_DIRECT_BALL_THREAT" ? perception.ball : perception.threat.threatPosition;
  const primaryHome = assignment.primaryId ? homes.get(assignment.primaryId) : undefined;

  return defenders.map((defender) => {
    const base = homes.get(defender.id) ?? defender.position;
    const aggression = aggressionFor(defender.id, options);
    const make = (reactionType: CollectiveReactionType, target: MeterPoint): CollectiveReaction => ({
      defenderId: defender.id,
      role: defender.role,
      reactionType,
      target: clampPointToBounds(target, COURT_BOUNDS_METERS),
    });

    if (defender.id === assignment.primaryId) {
      // Step out at the drive: to the carrier, goal-side of him, bounded by
      // how far this defender is willing to leave the line.
      const raw = { x: threatPosition.x, y: towardGoal(threatPosition.y, perception.goalSide, limits.goalSideOffsetMeters) };
      return make("ENGAGE", limitedFrom(base, raw, limits.primaryMaxDisplacementMeters * aggression));
    }

    if (defender.id === assignment.pivotMarkerId && perception.pivot) {
      // Sit goal-side of the pivot, without abandoning the line.
      const raw = { x: perception.pivot.position.x, y: towardGoal(perception.pivot.position.y, perception.goalSide, COLLECTIVE_DEFENSE_LIMITS.pivotMarkOffsetMeters) };
      return make("MARK_PIVOT", limitedFrom(base, raw, COLLECTIVE_DEFENSE_LIMITS.pivotMarkReachMeters * aggression));
    }

    if (assignment.helperIds.includes(defender.id) && primaryHome) {
      // Close toward the gap the primary left, staying on the line.
      const raw = { x: primaryHome.x, y: base.y };
      return make("SUPPORT", limitedFrom(base, raw, limits.supportMaxDisplacementMeters));
    }

    if (defender.id === assignment.presserId && perception.carrier) {
      const raw = perception.carrier.position;
      return make("PRESS", limitedFrom(base, raw, COLLECTIVE_DEFENSE_LIMITS.pressMeters * aggression));
    }

    if (assignment.primaryId) {
      // Far side of an active drive: lean toward it a little, on the shifted line.
      return make("SHIFT", limitedFrom(base, threatPosition, limits.farSideShiftMaxDisplacementMeters));
    }

    // Nobody driving: return to the shifted line by running there.
    return make("RECOVER", base);
  });
}

/** `L3 steps out at the drive; L2 helps; R3 marks the pivot; R1 holds width` -- for traces and the dev HUD. */
export function describeAssignment(assignment: DefensiveAssignment, defenders: readonly SixZeroDefender[]): string {
  const role = (id: string | null) => defenders.find((d) => d.id === id)?.role ?? id ?? "?";
  const parts: string[] = [];
  if (assignment.primaryId) parts.push(`${role(assignment.primaryId)} steps out`);
  if (assignment.presserId) parts.push(`${role(assignment.presserId)} presses the ball`);
  if (assignment.helperIds.length > 0) parts.push(`${assignment.helperIds.map(role).join("+")} help`);
  parts.push(assignment.pivotMarkerId ? `${role(assignment.pivotMarkerId)} marks the pivot` : "pivot unmarked");
  if (assignment.widthHolderIds.length > 0) parts.push(`${assignment.widthHolderIds.map(role).join("+")} hold width`);
  return parts.join("; ");
}
