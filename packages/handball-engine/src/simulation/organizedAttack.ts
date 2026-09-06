/**
 * MATCH-EXPERIENCE-2.0 M6: the organized attacking shape.
 *
 * Six canonical attacking roles, read from FIELD's own 6v6 formation rather
 * than invented here, placed relative to whichever goal is being attacked:
 *
 *   V6  left wing       V9  left back
 *   M6  pivot           M9  centre back
 *   H6  right wing      H9  right back
 *
 * The labels follow the engine's attack-gap ids (V1_V2 .. H2_H1), in which V
 * is the small-x side of the court at either goal. FIELD's zone labels flip
 * per goal side; the gap ids do not, and the decision layer reasons in gaps,
 * so the roles are labelled to match them.
 *
 * SHAPE IS A TARGET, NOT A CAGE. Players leave their spot to attack a gap,
 * cut in from the wing, or feed the pivot; what this module guarantees is
 * that organized play has a useful shape to RECOVER TO -- width and depth
 * both -- instead of the M1-M5 drift toward the centre line. The pivot's spot
 * is the one exception: he does not have a fixed point, he works the actual
 * defensive line, so his target is derived from where the defenders stand.
 *
 * ALSO HERE: the 6:0 home positions. The existing defensive policy only
 * recovers, supports and steps out RELATIVE TO A HOME SHAPE, and after a
 * change of possession that shape is (correctly) discarded. An organized
 * attack against a defence with no home would face defenders who chase
 * indefinitely and never re-form; establishing the canonical 6:0 homes at the
 * start of an organized possession is what makes "defender steps out ->
 * space opens -> defender recovers" a real cycle. The policy itself is
 * untouched.
 */
import { mirrorYForOppositeGoalSide } from "@handball-manager/match-contract";
import { COURT_BOUNDS_METERS, COURT_WIDTH_METERS } from "../domain/geometry/court";
import { clampPointToBounds, distanceBetween, type MeterPoint } from "../domain/geometry/coordinates";
import { SIX_ZERO_GAP_RESPONSIBILITIES } from "../policies/defense/responsibility";
import { SIX_ZERO_DEFENSE_FORMATION_ID } from "../policies/defense/sixZeroDefensePolicy";
import { createHalfCourt6v6StateWithGoalkeeper } from "../scenarios/halfCourt6v6";
import { goalCentre, type AttackingGoalSide } from "../domain/match/possession";
import type { AttackGapId } from "../domain/geometry/attackGaps";
import type { DefenseRole, Player, PlayerRole } from "../domain/handball/player";
import type { HandballState } from "../domain/handball/state";

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

/** Handball shorthand for the six organized attacking roles. */
export type AttackRoleLabel = "V6" | "V9" | "M9" | "H9" | "H6" | "M6";

const ROLE_LABELS: Partial<Record<PlayerRole, AttackRoleLabel>> = {
  LEFT_WING: "V6",
  LEFT_BACK: "V9",
  CENTER_BACK: "M9",
  RIGHT_BACK: "H9",
  RIGHT_WING: "H6",
  PIVOT: "M6",
};

export const ORGANIZED_ATTACK_LABELS: readonly AttackRoleLabel[] = ["V6", "V9", "M9", "H9", "H6", "M6"];

export function attackRoleLabel(role: PlayerRole): AttackRoleLabel | null {
  return ROLE_LABELS[role] ?? null;
}

/** `M9 (attack-attack-6-3)` -- how a player is named in traces and notes. */
export function describeAttacker(player: Player): string {
  const label = attackRoleLabel(player.role);
  return label ? `${label} ${player.id}` : player.id;
}

// ---------------------------------------------------------------------------
// Tactical intention -- the input a future manager layer will drive
// ---------------------------------------------------------------------------

/**
 * Biases on the attacking decision weights. Every value is in [-1, 1] and 0
 * is neutral. This is deliberately the whole tactical interface for M6: a
 * clean input the decision layer already honours, so manager tactics can
 * arrive later without the decision code changing shape.
 */
export type AttackTactics = {
  /** +1 stretches the shape wider, -1 pulls it narrower. */
  readonly width: number;
  /** +1 attacks earlier in the possession, -1 circulates for longer. */
  readonly tempo: number;
  /** -1 prefers the V (small-x) side, +1 the H (large-x) side. */
  readonly side: number;
  /** +1 looks for the pivot more, -1 less. */
  readonly pivotUsage: number;
};

export const DEFAULT_ATTACK_TACTICS: AttackTactics = Object.freeze({ width: 0, tempo: 0, side: 0, pivotUsage: 0 });

function clampBias(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

export function resolveAttackTactics(partial?: Partial<AttackTactics>): AttackTactics {
  return {
    width: clampBias(partial?.width),
    tempo: clampBias(partial?.tempo),
    side: clampBias(partial?.side),
    pivotUsage: clampBias(partial?.pivotUsage),
  };
}

// ---------------------------------------------------------------------------
// Canonical shape, read once from FIELD's formation
// ---------------------------------------------------------------------------

/** The goal FIELD's formation data is authored against. */
const SOURCE_GOAL_SIDE: AttackingGoalSide = "TOP";

const CANONICAL_SHAPE: { attack: Partial<Record<PlayerRole, MeterPoint>>; defence: Partial<Record<DefenseRole, MeterPoint>> } = (() => {
  const attack: Partial<Record<PlayerRole, MeterPoint>> = {};
  const defence: Partial<Record<DefenseRole, MeterPoint>> = {};
  for (const player of createHalfCourt6v6StateWithGoalkeeper().players) {
    if (player.kind === "GOALKEEPER") continue;
    if (player.team === "ATTACK") attack[player.role] = { ...player.position };
    else defence[player.role as DefenseRole] = { ...player.position };
  }
  return { attack, defence };
})();

function atGoalSide(point: MeterPoint, goalSide: AttackingGoalSide): MeterPoint {
  return goalSide === SOURCE_GOAL_SIDE ? { ...point } : { x: point.x, y: mirrorYForOppositeGoalSide(point.y) };
}

/** How much the `width` tactic can stretch or narrow the lateral spread. */
const WIDTH_TACTIC_SCALE = 0.15;

/**
 * Where an outfield attacking role stands in organized shape when attacking
 * `goalSide`: FIELD's canonical point, mirrored for the far goal, with the
 * lateral spread scaled by the width tactic. Null for a role without a spot.
 */
export function organizedRolePosition(role: PlayerRole, goalSide: AttackingGoalSide, tactics: AttackTactics = DEFAULT_ATTACK_TACTICS): MeterPoint | null {
  const canonical = CANONICAL_SHAPE.attack[role];
  if (!canonical) return null;
  const spread = 1 + WIDTH_TACTIC_SCALE * tactics.width;
  const centreX = COURT_WIDTH_METERS / 2;
  const stretched = { x: centreX + (canonical.x - centreX) * spread, y: canonical.y };
  return clampPointToBounds(atGoalSide(stretched, goalSide), { ...COURT_BOUNDS_METERS, minX: 0.4, maxX: COURT_WIDTH_METERS - 0.4 });
}

/** Canonical 6:0 home for a defensive role at the goal it protects. */
export function sixZeroHomePosition(role: DefenseRole, defendedGoalSide: AttackingGoalSide): MeterPoint | null {
  const canonical = CANONICAL_SHAPE.defence[role];
  return canonical ? atGoalSide(canonical, defendedGoalSide) : null;
}

/**
 * Establishes the canonical 6:0 home positions for the defending outfield
 * players when the defence has none -- i.e. at the start of an organized
 * possession that follows a change of possession. A defence that already has
 * a home shape (a free-throw continuation, a fresh kickoff) is left as it is.
 */
export function ensureSixZeroHomePositions(state: HandballState, defendedGoalSide: AttackingGoalSide): HandballState {
  if (state.defense.formationId !== SIX_ZERO_DEFENSE_FORMATION_ID) return state;
  if (state.defense.homePositions.length > 0) return state;
  const homePositions = state.players
    .filter((p) => p.team === "DEFENSE" && p.kind === "FIELD_PLAYER")
    .flatMap((defender) => {
      const home = sixZeroHomePosition(defender.role as DefenseRole, defendedGoalSide);
      return home ? [{ playerId: defender.id, role: defender.role as DefenseRole, position: home }] : [];
    });
  if (homePositions.length === 0) return state;
  return { ...state, defense: { ...state.defense, homePositions } };
}

// ---------------------------------------------------------------------------
// The pivot works the line
// ---------------------------------------------------------------------------

/** The gaps a pivot works: the three between the four inside defenders. */
const PIVOT_GAPS: readonly AttackGapId[] = ["V2_V3", "V3_H3", "H3_H2"];
/** How far in front of the line (away from goal) the pivot holds his spot. */
const PIVOT_LINE_STANDOFF_METERS = 0.35;

export function defendersByRole(state: HandballState): Map<DefenseRole, Player> {
  const map = new Map<DefenseRole, Player>();
  for (const p of state.players) {
    if (p.team === "DEFENSE" && p.kind === "FIELD_PLAYER") map.set(p.role as DefenseRole, p);
  }
  return map;
}

/** The y-coordinate of the defender nearer his own goal -- "the line" between two defenders. */
export function lineDepth(a: MeterPoint, b: MeterPoint, goalSide: AttackingGoalSide): number {
  return goalSide === "TOP" ? Math.min(a.y, b.y) : Math.max(a.y, b.y);
}

/** Moves `distance` metres away from the goal on `goalSide`, i.e. toward the attackers. */
export function awayFromGoal(y: number, goalSide: AttackingGoalSide, distance: number): number {
  return goalSide === "TOP" ? y + distance : y - distance;
}

/**
 * Where the pivot should be RIGHT NOW: on the defensive line, in whichever
 * inside gap gives him the most room, leaning toward the ball. Read from the
 * defenders' actual positions every time it is asked, so when one of them
 * steps out at the carrier the pivot slides in behind him -- which is exactly
 * when he becomes a passing option.
 */
export function pivotTarget(state: HandballState, goalSide: AttackingGoalSide, ballX: number): MeterPoint | null {
  const defenders = defendersByRole(state);
  const all = [...defenders.values()];
  let best: { point: MeterPoint; score: number } | null = null;
  for (const gapId of PIVOT_GAPS) {
    const [roleA, roleB] = SIX_ZERO_GAP_RESPONSIBILITIES[gapId];
    const a = defenders.get(roleA);
    const b = defenders.get(roleB);
    if (!a || !b) continue;
    const midX = (a.position.x + b.position.x) / 2;
    const point = { x: midX, y: awayFromGoal(lineDepth(a.position, b.position, goalSide), goalSide, PIVOT_LINE_STANDOFF_METERS) };
    const freedom = Math.min(...all.map((d) => distanceBetween(d.position, point)));
    // Room first, ball side second.
    const score = freedom - 0.15 * Math.abs(midX - ballX);
    if (!best || score > best.score) best = { point, score };
  }
  if (!best) {
    // No recognisable 6:0 line (a reduced fixture): stand in front of the goal.
    const goal = goalCentre(goalSide);
    return { x: goal.x, y: awayFromGoal(goal.y, goalSide, 6.8) };
  }
  return clampPointToBounds(best.point, COURT_BOUNDS_METERS);
}

/**
 * Where `player` should move to re-establish organized shape while attacking
 * `goalSide`. Null when he is already there (within 0.5m) or has no spot.
 */
export function organizedShapeTargetFor(
  player: Player,
  state: HandballState,
  goalSide: AttackingGoalSide,
  tactics: AttackTactics = DEFAULT_ATTACK_TACTICS,
): MeterPoint | null {
  const target = player.role === "PIVOT" ? pivotTarget(state, goalSide, state.ball.position.x) : organizedRolePosition(player.role, goalSide, tactics);
  if (!target) return null;
  if (distanceBetween(player.position, target) < 0.5) return null;
  return target;
}

/** Mean lateral spread of the outfield attackers -- the width metric the M5 QA measured. */
export function outfieldAttackWidth(state: HandballState): number {
  const xs = state.players.filter((p) => p.team === "ATTACK" && p.kind === "FIELD_PLAYER").map((p) => p.position.x);
  if (xs.length === 0) return 0;
  return Math.max(...xs) - Math.min(...xs);
}
