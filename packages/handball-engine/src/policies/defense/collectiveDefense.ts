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
import {
  LINE_SHIFT_MAX_METERS,
  LINE_SHIFT_PER_METER,
  frontDefenderRoleOf,
  intermediateRolesOf,
  systemHoldsWidth,
  THREE_TWO_ONE_DEFENSE_FORMATION_ID,
} from "./defensiveSystem";
import { assignThreeTwoOneDuties, pressPointFor, type DefensiveDuty, type DutyAssignment } from "./threeTwoOneDuties";
import type { DefensiveThreatObservation } from "./types";
import type { DefenceTactics } from "../../simulation/coaching";
import { DEFENDER_REACTION_SECONDS, reachProfileOf, timeToReach } from "../../simulation/spatialControl";

export type DefendedGoalSide = "TOP" | "BOTTOM";

/** Per-defender ability the collective layer reads. 1-20. */
export type DefensivePlayerRatings = {
  readonly defending?: number;
};

export type CollectiveDefenseOptions = {
  readonly ratings?: Readonly<Record<string, DefensivePlayerRatings>>;
  /**
   * M12: the coach standing instructions for this defence. Every value is a
   * bias in [-1, 1] and 0 is neutral, so an omitted set is exactly the M7
   * behaviour. They are consumed here as DISTANCES AND TARGETS -- how far a man
   * steps, where the line stands, how hard the neighbours collapse, how readily
   * the pivot is picked up -- and never as an outcome.
   */
  readonly tactics?: DefenceTactics;
};

/** M12: how far each defensive instruction is allowed to move the 6:0. */
export const DEFENCE_TACTIC_SCALE = Object.freeze({
  /** Step-out reach, on top of the defender own willingness. */
  aggression: 0.35,
  /** Lateral squeeze of every home toward the middle of the court. */
  compactness: 0.18,
  /** How much further a helper collapses behind the man who stepped out. */
  help: 0.5,
  /** Pivot marking reach, and how far off the line a pivot still counts as one. */
  pivotProtection: 0.5,
  pivotDepth: 0.4,
});

export const COLLECTIVE_DEFENSE_LIMITS = Object.freeze({
  /** M23: how far the man in front of a 5:1 may travel from his home. */
  frontMaxDisplacementMeters: 3.2,
  /** M24: how far a half-space defender may travel from his layer. */
  intermediateMaxDisplacementMeters: 2.6,
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

/** A full side has six outfield players; a seventh means the keeper has come off. */
const FULL_SIDE_OUTFIELD_COUNT = 6;

const DEFAULT_RATING = 10;

/**
 * M18: how far behind the carrier a stepping defender may be and still be worth
 * committing. Beyond this he is chasing a man he cannot reach, and the hole he
 * leaves costs more than the pressure he never applies.
 *
 * Deliberately generous. A 6:0 defender stepping out is not racing the carrier
 * to a spot -- he is showing himself, and arriving a little late still bends the
 * attack. Only a race lost by more than a second and a half, which at full
 * speed is the width of the gap he is guarding, means the step-out has become
 * pure cost. A tighter reading here is not a better model, it is a weaker
 * defence: at half a second this gate alone moved the bench from 103 possessions
 * and 47 goals to 114 and 54, which is a calibration change wearing a decision
 * change's clothes. At this value the bench sits on M13's numbers and only the
 * hopeless step-out is declined.
 */
const STEP_OUT_LOST_RACE_SECONDS = 1.5;

/**
 * M23: how far in front of the carrier the man in a 5:1 tries to stand.
 *
 * Close enough to be in his passing and driving space, not so close that he is
 * marking him. A metre and a quarter is an arm and a step.
 */
const FRONT_STANDOFF_METERS = 1.25;
/** How badly he may be losing the race to that spot and still push up to it. */
const FRONT_COMMIT_SECONDS = 0.6;
/** How much of his range he uses when he is not winning that race: he holds instead. */
const FRONT_HOLD_FRACTION = 0.45;

/**
 * M24: how far in front of a back the half-space defender tries to get.
 *
 * A little further off than the point man: he is closing a lane and a driving
 * angle rather than standing on the ball.
 */
const INTERMEDIATE_STANDOFF_METERS = 1.6;
/** How badly he may be losing the race to that spot and still come forward. */
const INTERMEDIATE_COMMIT_SECONDS = 0.45;
/** How far past the middle of the court a half-space defender still counts a man as his. */
const HALF_SPACE_OVERLAP_METERS = 2.0;

/**
 * QA FIX 2C: how much sooner an intermediate has to be able to reach the
 * carrier before the point man gives him up.
 *
 * The lateral half of the handover. M24 built the depth half -- a defender who
 * is behind the man declines him -- and left the sideways case to the
 * displacement cap, which produces a point man stretched to the end of his
 * leash, still leaning at a back he cannot reach, while the half-space defender
 * beside him already has the man. That is not a handover; it is two men on one
 * attacker and a hole where the point should be. A quarter of a second is a
 * real margin at these distances and keeps him from giving up a man he is only
 * fractionally slower to.
 */
const FRONT_HANDOVER_MARGIN_SECONDS = 0.25;

/** 0.7 .. 1.4: how far a defender is willing to step, from his defending rating. */
export function aggressionFor(defenderId: string, options?: CollectiveDefenseOptions): number {
  const defending = options?.ratings?.[defenderId]?.defending ?? DEFAULT_RATING;
  const ability = Math.max(0.7, Math.min(1.4, 1 + 0.04 * (defending - DEFAULT_RATING)));
  // M12: the coach ASKS for more or less; the player supplies what he can. A
  // timid defender told to press still steps less than a brave one told to sit.
  const instructed = ability * (1 + DEFENCE_TACTIC_SCALE.aggression * (options?.tactics?.aggression ?? 0));
  return Math.max(0.4, Math.min(2, instructed));
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
  /**
   * M22: every attacker working the line this instant, the marked one included.
   * More than one of these is the seventh man's whole purpose.
   */
  readonly linePlayers: readonly Player[];
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

export function perceiveAttack(
  state: HandballState,
  threat: DefensiveThreatObservation,
  defenders: readonly SixZeroDefender[],
  options?: CollectiveDefenseOptions,
): DefensivePerception {
  const goalSide = defendedGoalSideOf(state);
  const attackers = state.players.filter((p) => p.team === "ATTACK" && p.kind === "FIELD_PLAYER");
  const carrier = state.ball.possessorId ? (attackers.find((p) => p.id === state.ball.possessorId) ?? null) : null;
  const homes = defenders.map((d) => homeOf(state, d).position);
  const lineDepth = homes.length > 0 ? homes.reduce((s, h) => s + h.y, 0) / homes.length : towardGoal(goalSideLine(goalSide), goalSide, 0);
  // The pivot is whoever works the line: the PIVOT by role if he is near it,
  // otherwise any attacker standing on it.
  // M12: a defence told to protect the pivot notices him a little further off
  // the line, so he is picked up before he has settled on it.
  const pivotDepth =
    COLLECTIVE_DEFENSE_LIMITS.pivotThreatDepthMeters * (1 + DEFENCE_TACTIC_SCALE.pivotDepth * (options?.tactics?.pivotProtection ?? 0));
  const nearLine = (p: Player) => Math.abs(p.position.y - lineDepth) <= pivotDepth;
  const byRole = attackers.find((p) => p.role === "PIVOT" && nearLine(p));
  const anyOnLine = attackers.filter((p) => p.id !== carrier?.id && nearLine(p)).sort((a, b) => Math.abs(a.position.y - lineDepth) - Math.abs(b.position.y - lineDepth) || a.id.localeCompare(b.id))[0];
  const pivot = byRole ?? anyOnLine ?? null;
  // M22: everybody working the line, not just the one man the defence marks.
  // A 7v6 attack puts a second player there, and a defence that can only see
  // one of them is not being outnumbered -- it is being lied to.
  const linePlayers = attackers.filter((p) => p.id !== carrier?.id && nearLine(p)).sort((a, b) => a.id.localeCompare(b.id));
  const rawShift = LINE_SHIFT_PER_METER * (state.ball.position.x - COURT_WIDTH_METERS / 2);
  const lineShift = Math.max(-LINE_SHIFT_MAX_METERS, Math.min(LINE_SHIFT_MAX_METERS, rawShift));
  return { goalSide, ball: { ...state.ball.position }, carrier, threat, pivot, linePlayers, attackers, lineShift, lineDepth };
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
  /** M22: the defender picking up a SECOND line player, when one can be spared. */
  readonly secondPivotMarkerId: string | null;
  /** M23: the man playing in front, in a system that has one. */
  readonly frontDefenderId: string | null;
  /** M24: the half-space defenders of a three-layer system. */
  readonly intermediateIds: readonly string[];
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

  // M23: in a 5:1 one man is in front, and he is not part of the line behind
  // him. He is therefore never the pivot's marker and never a width holder --
  // both of those are jobs on the line, and giving them to him would be running
  // a six-man line with somebody standing in an odd place.
  const frontRole = frontDefenderRoleOf(state.defense.formationId);
  const frontDefenderId = frontRole ? (defenders.find((d) => d.role === frontRole)?.id ?? null) : null;

  // M24: the middle layer. Like the front man they are not part of the line, so
  // the line's jobs -- the pivot, width, help inside the line -- are not theirs.
  const intermediateRoles = intermediateRolesOf(state.defense.formationId);
  const intermediateIds = defenders.filter((d) => intermediateRoles.includes(d.role)).map((d) => d.id);
  const advanced = new Set<string>([frontDefenderId ?? "", ...intermediateIds]);

  const pivotMarkerId = naturalPivotMarker(
    perception,
    defenders.filter((d) => !advanced.has(d.id)),
    shiftedHomes,
    primary?.id ?? null,
    previousMarkerId,
  );

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

  const widthHolderIds = defenders
    .filter((d) => !advanced.has(d.id) && holdsWidth(d, homeOf(state, d).position, perception))
    .map((d) => d.id);

  // M22: a second man on the line gets a marker only if one is genuinely spare.
  //
  // This is where being outnumbered has to be allowed to hurt. Six defenders
  // cannot cover seven attackers, and the honest way to say so is to let the
  // second line player go unmarked whenever every defender already has a job --
  // not to invent a rule that the defence copes. He is picked up when somebody
  // is free, and left when nobody is, which is exactly what a 6:0 facing seven
  // actually looks like.
  // Only against a seventh attacker.
  //
  // The obvious gate here -- "more attackers than defenders" -- is wrong, and
  // the bench caught it: a side serving a two-minute suspension is also
  // outnumbered, so that reading quietly changed how every short-handed defence
  // in every match marks the line, and moved the scoring baseline by more than
  // two goals a match. Being a man down is a different problem, it is already
  // modelled, and it is not M22's to rewrite. What is M22's is a seventh
  // attacker, so that is exactly what this asks about.
  const outnumbered = perception.attackers.length > FULL_SIDE_OUTFIELD_COUNT;
  const busy = new Set<string>([primary?.id ?? "", pivotMarkerId ?? "", presserId ?? "", ...advanced, ...helperIds]);
  const secondLinePlayer = outnumbered ? perception.linePlayers.find((p) => p.id !== perception.pivot?.id) ?? null : null;
  const secondPivotMarkerId = secondLinePlayer
    ? ([...defenders]
        .filter((d) => !busy.has(d.id))
        .sort(
          (a, b) =>
            Math.abs((shiftedHomes.get(a.id) ?? a.position).x - secondLinePlayer.position.x) -
              Math.abs((shiftedHomes.get(b.id) ?? b.position).x - secondLinePlayer.position.x) || a.id.localeCompare(b.id),
        )[0]?.id ?? null)
    : null;

  return {
    primaryId: primary?.id ?? null,
    helperIds,
    pivotMarkerId,
    secondPivotMarkerId,
    presserId,
    widthHolderIds,
    frontDefenderId,
    intermediateIds,
  };
}

// ---------------------------------------------------------------------------
// Targets -- where each defender goes, all bounded, all from real positions
// ---------------------------------------------------------------------------

/** M23: FRONT is the man playing in front of a 5:1. No other system produces one. */
/** M24: STEP_OUT is a half-space defender committing forward from the middle layer. */
export type CollectiveReactionType = "ENGAGE" | "SUPPORT" | "SHIFT" | "RECOVER" | "PRESS" | "MARK_PIVOT" | "FRONT" | "STEP_OUT";

export type CollectiveReaction = {
  readonly defenderId: string;
  readonly role: DefenseRole;
  readonly reactionType: CollectiveReactionType;
  readonly target: MeterPoint;
  /**
   * HUMAN QA CORRECTION: the JOB this target came from, in a system that
   * assigns jobs. Additive: the reaction type is unchanged and every existing
   * consumer keeps working, and this says the thing the type cannot -- two men
   * can both be SHIFTing while one holds the inside lane and the other watches
   * the next pass.
   */
  readonly duty?: DefensiveDuty;
};

export type CollectiveReactionLimits = {
  readonly primaryMaxDisplacementMeters: number;
  readonly supportMaxDisplacementMeters: number;
  readonly farSideShiftMaxDisplacementMeters: number;
  readonly goalSideOffsetMeters: number;
};

/** Every defender's home slid toward the ball; a width-holding wing only partly. */
export function shiftedHomes(
  state: HandballState,
  defenders: readonly SixZeroDefender[],
  perception: DefensivePerception,
  options?: CollectiveDefenseOptions,
): Map<string, MeterPoint> {
  const map = new Map<string, MeterPoint>();
  // M12: compactness squeezes every home toward the middle of the court (or
  // spreads it out toward the wings). It changes WHERE THE LINE STANDS, which
  // is what makes a narrow defence concede the wing and a wide one concede the
  // middle -- the attack then decides what to do about it.
  const squeeze = 1 - DEFENCE_TACTIC_SCALE.compactness * (options?.tactics?.compactness ?? 0);
  const centreX = COURT_WIDTH_METERS / 2;
  // A defence leans toward the ball. How far it MOVES is decided by the jobs
  // its men are doing, not here: this is the post each man recovers to and
  // measures his displacement from.
  for (const defender of defenders) {
    const canonical = homeOf(state, defender).position;
    const home = { x: centreX + (canonical.x - centreX) * squeeze, y: canonical.y };
    const fraction =
      systemHoldsWidth(state.defense.formationId) && holdsWidth(defender, home, perception)
        ? COLLECTIVE_DEFENSE_LIMITS.widthHoldShiftFraction
        : 1;
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

  // HUMAN QA CORRECTION: a 3:2:1 is run from its duties, not from its geometry.
  //
  // Every target below this line comes from the job the man has been given, and
  // the shape a human sees is what six different jobs add up to. The flat
  // systems are untouched: they have one layer, the questions a three-layer
  // system asks have no answers in them, and they take the branches beneath as
  // they always did.
  if (state.defense.formationId === THREE_TWO_ONE_DEFENSE_FORMATION_ID) {
    return threeTwoOneReactions(state, defenders, perception, assignment, homes, limits, options);
  }

  return defenders.map((defender) => {
    const base = homes.get(defender.id) ?? defender.position;
    const aggression = aggressionFor(defender.id, options);
    const make = (reactionType: CollectiveReactionType, target: MeterPoint): CollectiveReaction => ({
      defenderId: defender.id,
      role: defender.role,
      reactionType,
      target: clampPointToBounds(target, COURT_BOUNDS_METERS),
    });

    // M23: THE MAN IN FRONT.
    //
    // He is doing a different job from anybody on the line, and it is a job of
    // position rather than pursuit: stand between the ball and the middle of the
    // attack, close enough to make the backcourt uncomfortable, and hand a man
    // on rather than chase him. What makes it a real defensive behaviour and not
    // a player standing at a fixed spot is that his depth is decided by the same
    // race M18 asks everywhere else -- he pushes up on a carrier he can reach
    // and drops toward his line against one he cannot.
    //
    // Three things he deliberately does NOT do. He does not follow a man across
    // the court, which would be man-marking rather than a 5:1. He does not hold
    // width or mark the pivot, because those are the line's jobs and he is not
    // in the line. And once he has been beaten -- the carrier is goal-side of
    // him -- he stops pressing and recovers, because pressure from behind a man
    // is not pressure, a lesson M18 already learned for the line.
    if (defender.id === assignment.frontDefenderId) {
      const front = perception.carrier ?? null;
      if (!front) return make("FRONT", base);

      // Beaten: he is no longer between the ball and the goal he defends.
      const goalSide = perception.goalSide;
      const beaten =
        goalSide === "TOP" ? front.position.y < defender.position.y : front.position.y > defender.position.y;
      if (beaten) return make("RECOVER", base);

      // How far up he is willing to be: as far as he can actually get to the
      // man before the man gets past him, bounded so he never leaves the five
      // behind him defending alone.
      const raw = { x: front.position.x, y: towardGoal(front.position.y, goalSide, FRONT_STANDOFF_METERS) };
      const reachable = timeToReach(reachProfileOf(defender, DEFENDER_REACTION_SECONDS), raw);
      const arrival = timeToReach(reachProfileOf(front), raw);

      // QA FIX 2C: THE LATERAL HANDOVER. The ball has circulated out of his
      // zone and a half-space defender is plainly closer to it than he is, so
      // the man is that defender's now and the point man goes back to the
      // point. Decided by the same reach race everything else here uses -- no
      // zone boundary is drawn, because the thing that actually matters is who
      // can get there.
      const handedOver = defenders.some((other) => {
        if (!assignment.intermediateIds.includes(other.id)) return false;
        return timeToReach(reachProfileOf(other, DEFENDER_REACTION_SECONDS), raw) + FRONT_HANDOVER_MARGIN_SECONDS < reachable;
      });
      if (handedOver) return make("RECOVER", base);
      const committed = reachable - arrival <= FRONT_COMMIT_SECONDS;
      const reach = COLLECTIVE_DEFENSE_LIMITS.frontMaxDisplacementMeters * aggression * (committed ? 1 : FRONT_HOLD_FRACTION);
      return make("FRONT", limitedFrom(base, raw, reach));
    }

    // M24: THE MIDDLE LAYER, AND THE HANDOVER.
    //
    // A half-space defender is neither the point nor the line, and what makes
    // him a layer rather than a spare man is WHEN he comes forward and when he
    // gives the man up. He steps out at a threat in his own half of the court
    // that he can still get in front of; he does not follow one across the
    // court, and he does not chase one who is already past him.
    //
    // That last clause is the handover, and it is deliberately not a protocol
    // between defenders. Each layer simply declines a threat it is behind, and
    // the layer behind it picks the man up because that is whose space he is
    // now in: front hands to the intermediates, intermediates hand to the base.
    // Nothing negotiates -- responsibility moves because the geometry moved,
    // which is the only way it can move without somebody chasing.
    if (assignment.intermediateIds.includes(defender.id)) {
      const threat = perception.carrier;
      const goalSide = perception.goalSide;
      if (!threat) return make("SHIFT", base);

      // Past him already: the base has him now.
      const beaten =
        goalSide === "TOP" ? threat.position.y < defender.position.y : threat.position.y > defender.position.y;
      if (beaten) return make("RECOVER", base);

      // Not his half of the court: his neighbour's man, and going after him
      // would leave the half-space he is there to hold.
      const centre = COURT_WIDTH_METERS / 2;
      const home = homes.get(defender.id) ?? defender.position;
      const ownSide = home.x <= centre ? threat.position.x <= centre + HALF_SPACE_OVERLAP_METERS : threat.position.x >= centre - HALF_SPACE_OVERLAP_METERS;
      if (!ownSide) return make("SHIFT", limitedFrom(base, { x: centre, y: base.y }, limits.farSideShiftMaxDisplacementMeters));

      // His man, and he can still get in front of him: come and take him.
      const raw = { x: threat.position.x, y: towardGoal(threat.position.y, goalSide, INTERMEDIATE_STANDOFF_METERS) };
      const reachable = timeToReach(reachProfileOf(defender, DEFENDER_REACTION_SECONDS), raw);
      const arrival = timeToReach(reachProfileOf(threat), raw);
      if (reachable - arrival > INTERMEDIATE_COMMIT_SECONDS) {
        // He would arrive after the man had gone; stepping out would only open
        // the space behind him for nothing. He holds his layer instead.
        return make("SHIFT", base);
      }
      return make("STEP_OUT", limitedFrom(base, raw, COLLECTIVE_DEFENSE_LIMITS.intermediateMaxDisplacementMeters * aggression));
    }

    if (defender.id === assignment.primaryId) {
      // Step out at the drive: to the carrier, goal-side of him, bounded by
      // how far this defender is willing to leave the line.
      const raw = { x: threatPosition.x, y: towardGoal(threatPosition.y, perception.goalSide, limits.goalSideOffsetMeters) };
      // M18: he only commits if he can actually get there in time. A defender
      // who is going to lose that race gains nothing by chasing it -- he
      // abandons the line for a man he will not reach -- so instead he holds
      // his shifted position and stays part of the shape. This is spatial
      // control telling M7 whether the role it assigned can be executed; the
      // ASSIGNMENT itself is untouched, and so is every bound on how far he may
      // travel when he does commit.
      const carrier = perception.carrier;
      if (carrier) {
        const reachable = timeToReach(reachProfileOf(defender, DEFENDER_REACTION_SECONDS), raw);
        const arrival = timeToReach(reachProfileOf(carrier), raw);
        if (reachable - arrival > STEP_OUT_LOST_RACE_SECONDS) return make("RECOVER", base);
      }
      return make("ENGAGE", limitedFrom(base, raw, limits.primaryMaxDisplacementMeters * aggression));
    }

    if (defender.id === assignment.pivotMarkerId && perception.pivot) {
      // Sit goal-side of the pivot, without abandoning the line.
      const raw = { x: perception.pivot.position.x, y: towardGoal(perception.pivot.position.y, perception.goalSide, COLLECTIVE_DEFENSE_LIMITS.pivotMarkOffsetMeters) };
      const reach =
        COLLECTIVE_DEFENSE_LIMITS.pivotMarkReachMeters * aggression * (1 + DEFENCE_TACTIC_SCALE.pivotProtection * (options?.tactics?.pivotProtection ?? 0));
      return make("MARK_PIVOT", limitedFrom(base, raw, reach));
    }

    // M22: the same job, done to a second man on the line. He only ever reaches
    // this branch when no other role wanted him, so marking the extra attacker
    // costs the defence nothing it needed elsewhere.
    if (defender.id === assignment.secondPivotMarkerId) {
      const second = perception.linePlayers.find((p) => p.id !== perception.pivot?.id);
      if (second) {
        const raw = { x: second.position.x, y: towardGoal(second.position.y, perception.goalSide, COLLECTIVE_DEFENSE_LIMITS.pivotMarkOffsetMeters) };
        const reach =
          COLLECTIVE_DEFENSE_LIMITS.pivotMarkReachMeters * aggression * (1 + DEFENCE_TACTIC_SCALE.pivotProtection * (options?.tactics?.pivotProtection ?? 0));
        return make("MARK_PIVOT", limitedFrom(base, raw, reach));
      }
    }

    if (assignment.helperIds.includes(defender.id) && primaryHome) {
      // Close toward the gap the primary left, staying on the line.
      const raw = { x: primaryHome.x, y: base.y };
      const collapse = limits.supportMaxDisplacementMeters * (1 + DEFENCE_TACTIC_SCALE.help * (options?.tactics?.helpEmphasis ?? 0));
      return make("SUPPORT", limitedFrom(base, raw, collapse));
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

// ---------------------------------------------------------------------------
// HUMAN QA CORRECTION: the 3:2:1, run from its duties
// ---------------------------------------------------------------------------

/**
 * How far the man covering behind steps off his line toward the press.
 *
 * A quarter of the way. Enough that he is visibly behind the presser rather
 * than flat with his line, and not so far that the 3:2:1 becomes a 3:3 with a
 * hole where the line was.
 */
const COVER_STEP_FRACTION = 0.25;

/**
 * The most a base defender narrows toward the middle when the ball is on the
 * other side. Half the way in: he supports the centre, he does not vacate his
 * own side of the goal.
 */
const MAX_COMPACT_FRACTION = 0.5;

/** How far a man may travel from his post to do each job. */
const DUTY_REACH_METERS: Readonly<Record<DefensiveDuty, number>> = Object.freeze({
  PRESS_BALL: 3.6,
  COVER_BEHIND: 2.4,
  INSIDE_LANE: 2.2,
  NEXT_THREAT: 2.2,
  PIVOT: 1.6,
  COMPACT_INSIDE: 2.0,
  RECOVER: 0,
});

/** The reaction label that best describes each job, for traces and the HUD. */
const DUTY_REACTION: Readonly<Record<DefensiveDuty, CollectiveReactionType>> = Object.freeze({
  PRESS_BALL: "ENGAGE",
  COVER_BEHIND: "SUPPORT",
  INSIDE_LANE: "SHIFT",
  NEXT_THREAT: "SHIFT",
  PIVOT: "MARK_PIVOT",
  COMPACT_INSIDE: "SHIFT",
  RECOVER: "RECOVER",
});

/**
 * Where a point at depth `y` sits on the line from `from` to `to`.
 *
 * The one piece of geometry the duties need, and it is a consequence rather
 * than a rule: a man covering a lane stands ON that lane, at his own depth. It
 * is what makes "cover behind the press" and "hold the inside lane" different
 * places without either of them being a number somebody chose.
 */
function laneAtDepth(from: MeterPoint, to: MeterPoint, y: number): number {
  const span = to.y - from.y;
  if (Math.abs(span) < 1e-6) return (from.x + to.x) / 2;
  const t = Math.max(0, Math.min(1, (y - from.y) / span));
  return from.x + (to.x - from.x) * t;
}

function threeTwoOneReactions(
  state: HandballState,
  defenders: readonly SixZeroDefender[],
  perception: DefensivePerception,
  assignment: DefensiveAssignment,
  homes: ReadonlyMap<string, MeterPoint>,
  limits: CollectiveReactionLimits,
  options?: CollectiveDefenseOptions,
): CollectiveReaction[] {
  const goal = { x: COURT_WIDTH_METERS / 2, y: perception.goalSide === "TOP" ? 0 : COURT_LENGTH_METERS };
  const duties: DutyAssignment = assignThreeTwoOneDuties(
    state.defense.formationId,
    defenders,
    {
      goalSide: perception.goalSide,
      goal,
      carrier: perception.carrier,
      pivot: perception.pivot,
      attackers: perception.attackers,
      linePlayers: perception.linePlayers,
    },
    state.defense.lastReaction?.primaryDefenderId ?? null,
  );
  const carrier = perception.carrier;
  const press = carrier ? pressPointFor(carrier, goal) : null;
  const threat = duties.nextThreatTargetId
    ? perception.attackers.find((a) => a.id === duties.nextThreatTargetId) ?? null
    : null;
  const centreX = COURT_WIDTH_METERS / 2;

  return defenders.map((defender) => {
    const post = homes.get(defender.id) ?? defender.position;
    const duty = duties.duties.get(defender.id) ?? "RECOVER";
    const aggression = aggressionFor(defender.id, options);
    const reach = DUTY_REACH_METERS[duty] * aggression;
    const make = (target: MeterPoint): CollectiveReaction => ({
      defenderId: defender.id,
      role: defender.role,
      reactionType: DUTY_REACTION[duty],
      target: clampPointToBounds(limitedFrom(post, target, Math.max(reach, 0.01)), COURT_BOUNDS_METERS),
      duty,
    });

    switch (duty) {
      case "PRESS_BALL":
        return press ? make(press) : make(post);
      case "COVER_BEHIND": {
        // On the carrier's road to goal, so that if the press is beaten the
        // carrier runs into him rather than into space -- and a step off his
        // line toward it, because covering behind a man means being behind
        // him, not level with the goal.
        if (!press) return make(post);
        const depth = post.y + (press.y - post.y) * COVER_STEP_FRACTION;
        return make({ x: laneAtDepth(press, goal, depth), y: depth });
      }
      case "INSIDE_LANE": {
        // Half way between that road and the middle of the court. He is not a
        // second presser and not a spare man: he is the inside path.
        if (!press) return make(post);
        const onLane = laneAtDepth(press, goal, post.y);
        return make({ x: (onLane + centreX) / 2, y: post.y });
      }
      case "NEXT_THREAT": {
        // On the pass, at his own depth -- so the next handover has already
        // started before the ball is played.
        if (!carrier || !threat) return make(post);
        return make({ x: laneAtDepth(carrier.position, threat.position, post.y), y: post.y });
      }
      case "PIVOT": {
        // Whichever line player is his: the nearest one he has been given.
        const mine = [...perception.linePlayers, ...(perception.pivot ? [perception.pivot] : [])].sort(
          (a, b) => Math.abs(a.position.x - post.x) - Math.abs(b.position.x - post.x) || a.id.localeCompare(b.id),
        )[0];
        if (!mine) return make(post);
        return make({ x: mine.position.x, y: towardGoal(mine.position.y, perception.goalSide, COLLECTIVE_DEFENSE_LIMITS.pivotMarkOffsetMeters) });
      }
      case "COMPACT_INSIDE": {
        // Narrowing is a job, not a posture. It exists because the ball is
        // somewhere else and the next threat is inside him; with the ball in
        // the middle there is no weak side and he stands on his post. Scaled by
        // how far away the ball actually is, so the base is at its widest
        // against a central attack and at its narrowest against a wing.
        const away = Math.min(1, Math.abs(perception.ball.x - centreX) / centreX);
        return make({ x: post.x + (centreX - post.x) * MAX_COMPACT_FRACTION * away, y: post.y });
      }
      case "RECOVER":
      default:
        return make(post);
    }
  });
}

/** The duties a 3:2:1 has assigned this instant, for traces and the dev HUD. */
export function describeThreeTwoOneDuties(
  state: HandballState,
  defenders: readonly SixZeroDefender[],
  perception: DefensivePerception,
): string {
  const goal = { x: COURT_WIDTH_METERS / 2, y: perception.goalSide === "TOP" ? 0 : COURT_LENGTH_METERS };
  return assignThreeTwoOneDuties(
    state.defense.formationId,
    defenders,
    {
      goalSide: perception.goalSide,
      goal,
      carrier: perception.carrier,
      pivot: perception.pivot,
      attackers: perception.attackers,
      linePlayers: perception.linePlayers,
    },
    state.defense.lastReaction?.primaryDefenderId ?? null,
  ).summary;
}
