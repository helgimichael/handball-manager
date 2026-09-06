/**
 * MATCH-EXPERIENCE-2.0 M6: perception -> decision for the ball carrier.
 *
 * THE INVARIANT. A tactical action is an INTENTION, never a script. The
 * carrier reads the situation he is actually in -- his own position, where
 * every defender really stands, which defender is responsible for which gap,
 * how free each teammate is, how open the pivot is -- scores the options that
 * situation offers, and commits to one. The defence then reacts to that
 * intention through the existing 6:0 policy, the state changes, and the NEXT
 * decision is read from the changed state. "Attack the H3/H2 gap" therefore
 * means "start driving at H3/H2"; whether that ends in a shot, a pass to the
 * player the step-out just freed, a pivot feed or a reset is decided later,
 * from what the defence did about it.
 *
 * Nothing here executes anything. The engine applies the chosen option as an
 * ordinary MOVE/PASS/ATTACK command and the shot model resolves shots; this
 * module only reads state and returns a decision with its reasons attached.
 *
 * DETERMINISM. Scores are pure functions of state, ratings and tactics. The
 * seeded RNG adds a small tie-breaking noise so two identical situations do
 * not always resolve identically across seeds -- but the same state and the
 * same seed always produce the same decision trace.
 */
import { distanceBetween, type MeterPoint } from "../domain/geometry/coordinates";
import { SIX_ZERO_GAP_RESPONSIBILITIES } from "../policies/defense/responsibility";
import { ATTACK_GAP_CALIBRATION_IDS } from "../domain/geometry/attackGapCalibration";
import { goalCentre, type AttackingGoalSide } from "../domain/match/possession";
import {
  attackRoleLabel,
  awayFromGoal,
  defendersByRole,
  lineDepth,
  DEFAULT_ATTACK_TACTICS,
  type AttackRoleLabel,
  type AttackTactics,
} from "./organizedAttack";
import type { AttackGapId } from "../domain/geometry/attackGaps";
import type { Player, PlayerRole } from "../domain/handball/player";
import type { HandballState } from "../domain/handball/state";
import type { PossessionRng } from "./possessionRng";

// ---------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------

/** Per-player ratings the attack reads. 1-20, the game's attribute scale. */
export type AttackPlayerRatings = {
  /** Finishing quality. */
  readonly shooting?: number;
  /** Willingness and ability to take on a small gap one-on-one. */
  readonly attacking?: number;
  /** Quality of the passing options he creates -- including the pivot feed. */
  readonly passing?: number;
};

export const DEFAULT_ATTACK_RATING = 10;

// ---------------------------------------------------------------------------
// Perception
// ---------------------------------------------------------------------------

/** One defensive gap, as it actually is right now. */
export type PerceivedGap = {
  readonly gapId: AttackGapId;
  readonly defenderIds: readonly [string, string];
  /** Lateral distance between the two responsible defenders. */
  readonly width: number;
  /** How far one of them has stepped out of line relative to the other. */
  readonly depthSplit: number;
  /** Other defenders sitting within cover range of the gap. */
  readonly cover: number;
  /** 0 (shut) .. 1 (wide open), from width, depth split and cover. */
  readonly openness: number;
  /** Where a carrier drives to when attacking this gap: just in front of the line. */
  readonly attackPoint: MeterPoint;
  readonly goalDistance: number;
  readonly angleQuality: number;
};

/** A gap starts counting as open above this width, and is fully open at this width plus the range. */
const GAP_CLOSED_WIDTH_METERS = 1.2;
const GAP_OPEN_RANGE_METERS = 2.4;
/** A defender inside this radius of the gap point is covering it. */
const GAP_COVER_RADIUS_METERS = 1.6;
/** How far in front of the line a drive aims. */
const ATTACK_POINT_STANDOFF_METERS = 1.2;

/**
 * How square a point is to the goal, 0 (from the goal line, no angle) to 1
 * (dead centre). Depth over depth-plus-lateral, so a wing shooting from the
 * corner is genuinely harder.
 */
export function shootingAngleQuality(origin: MeterPoint, goal: MeterPoint): number {
  const lateral = Math.abs(origin.x - goal.x);
  const depth = Math.abs(origin.y - goal.y);
  if (depth <= 0.01) return 0;
  return Math.max(0, Math.min(1, depth / (depth + lateral)));
}

export function fieldDefenders(state: HandballState): readonly Player[] {
  return state.players.filter((p) => p.team === "DEFENSE" && p.kind === "FIELD_PLAYER");
}

export function fieldAttackers(state: HandballState): readonly Player[] {
  return state.players.filter((p) => p.team === "ATTACK" && p.kind === "FIELD_PLAYER");
}

/** Nearest outfield defender to a point, and how far away he is. */
export function nearestDefenderTo(state: HandballState, point: MeterPoint): { distance: number; defenderId: string | null } {
  let best = Number.POSITIVE_INFINITY;
  let id: string | null = null;
  for (const defender of fieldDefenders(state)) {
    const d = distanceBetween(defender.position, point);
    if (d < best) {
      best = d;
      id = defender.id;
    }
  }
  return { distance: Number.isFinite(best) ? best : 99, defenderId: id };
}

/** Pressure on a point: 0 with no defender inside 4m, 1 with one on top of it. */
export function pressureAt(state: HandballState, point: MeterPoint): number {
  return Math.max(0, Math.min(1, 1 - nearestDefenderTo(state, point).distance / 4));
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Distance from `p` to the segment a-b. */
function distanceToSegment(p: MeterPoint, a: MeterPoint, b: MeterPoint): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-9) return distanceBetween(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2));
  return distanceBetween(p, { x: a.x + abx * t, y: a.y + aby * t });
}

/**
 * Every gap in the defensive line, measured from where the responsible
 * defenders ACTUALLY stand. A gap whose defenders are not both on court is
 * not perceived at all.
 */
export function perceiveGaps(state: HandballState, goalSide: AttackingGoalSide): readonly PerceivedGap[] {
  const goal = goalCentre(goalSide);
  const byRole = defendersByRole(state);
  const all = fieldDefenders(state);
  const gaps: PerceivedGap[] = [];
  for (const gapId of ATTACK_GAP_CALIBRATION_IDS) {
    const [roleA, roleB] = SIX_ZERO_GAP_RESPONSIBILITIES[gapId];
    const a = byRole.get(roleA);
    const b = byRole.get(roleB);
    if (!a || !b) continue;
    // The gap is the actual space between the two defenders -- a wing
    // defender standing 3.5m deeper than his neighbour leaves a diagonal
    // channel that a lateral-only measure would call narrow.
    const width = distanceBetween(a.position, b.position);
    // A step-out is a defender leaving his HOME, not a formation that happens
    // to be staggered: the split is measured between the two defenders'
    // displacements from their 6:0 homes (or their positions, when the
    // defence has no homes yet, which counts as no split).
    const homeOf = (p: Player) => state.defense.homePositions.find((h) => h.playerId === p.id)?.position ?? p.position;
    const depthSplit = Math.abs(a.position.y - homeOf(a).y - (b.position.y - homeOf(b).y));
    const line = lineDepth(a.position, b.position, goalSide);
    const midX = (a.position.x + b.position.x) / 2;
    const gapPoint = { x: midX, y: line };
    const cover = all.filter((d) => d.id !== a.id && d.id !== b.id && distanceBetween(d.position, gapPoint) <= GAP_COVER_RADIUS_METERS).length;
    const openness = clamp01(
      clamp01((width - GAP_CLOSED_WIDTH_METERS) / GAP_OPEN_RANGE_METERS) + 0.25 * Math.min(1, depthSplit / 1.2) - 0.35 * cover,
    );
    const attackPoint = { x: midX, y: awayFromGoal(line, goalSide, ATTACK_POINT_STANDOFF_METERS) };
    gaps.push({
      gapId,
      defenderIds: [a.id, b.id],
      width,
      depthSplit,
      cover,
      openness,
      attackPoint,
      goalDistance: distanceBetween(attackPoint, goal),
      angleQuality: shootingAngleQuality(attackPoint, goal),
    });
  }
  return gaps;
}

/** A defender this close to the carrier's drive line, ahead of him, has closed the gap (arm's reach plus a step). */
const BLOCK_LATERAL_METERS = 1.6;
const BLOCK_LOOKAHEAD_METERS = 3.0;

/**
 * The defender standing in the carrier's way toward `target`, if any: within
 * BLOCK_LATERAL of the drive line and ahead of the carrier within lookahead.
 */
export function blockerPlayerOnPath(state: HandballState, carrier: Player, target: MeterPoint): { player: Player; along: number } | null {
  const dx = target.x - carrier.position.x;
  const dy = target.y - carrier.position.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  const ux = dx / len;
  const uy = dy / len;
  let best: { player: Player; along: number } | null = null;
  for (const d of fieldDefenders(state)) {
    const rx = d.position.x - carrier.position.x;
    const ry = d.position.y - carrier.position.y;
    const along = rx * ux + ry * uy;
    if (along < 0 || along > Math.min(len, BLOCK_LOOKAHEAD_METERS)) continue;
    const lateral = Math.abs(rx * uy - ry * ux);
    if (lateral > BLOCK_LATERAL_METERS) continue;
    if (!best || along < best.along) best = { player: d, along };
  }
  return best;
}

export function blockerOnPath(state: HandballState, carrier: Player, target: MeterPoint): string | null {
  return blockerPlayerOnPath(state, carrier, target)?.player.id ?? null;
}

/** How far to the side of a stepping defender a carrier goes when he takes him on. */
const TAKE_ON_SIDESTEP_METERS = 1.4;
/** How far past the defender the take-on aims. */
const TAKE_ON_DEPTH_METERS = 0.8;

/**
 * Where a carrier drives when he decides to beat the defender who has stepped
 * into his path: beside him, on the side of the gap he was attacking, and a
 * step past him. A spatial intention like any other -- the defence still
 * reacts, and whether the carrier actually gets clear is settled by the next
 * re-evaluation from real positions.
 */
export function takeOnTarget(blocker: Player, gapPoint: MeterPoint, goalSide: AttackingGoalSide): MeterPoint {
  const side = gapPoint.x >= blocker.position.x ? 1 : -1;
  return {
    x: Math.max(0.5, Math.min(19.5, blocker.position.x + side * TAKE_ON_SIDESTEP_METERS)),
    y: Math.max(0.5, Math.min(39.5, goalSide === "TOP" ? blocker.position.y - TAKE_ON_DEPTH_METERS : blocker.position.y + TAKE_ON_DEPTH_METERS)),
  };
}

/** True when a defender sits on the passing lane between two attackers. */
const LANE_BLOCK_RADIUS_METERS = 0.9;
export function passingLaneBlocked(state: HandballState, from: MeterPoint, to: MeterPoint): boolean {
  const length = distanceBetween(from, to);
  for (const d of fieldDefenders(state)) {
    // A defender standing on the receiver is "pressure on the receiver", not a
    // blocked lane; only the middle of the lane counts.
    if (distanceBetween(d.position, to) < 0.8 || distanceBetween(d.position, from) < 0.8) continue;
    if (length > 1.6 && distanceToSegment(d.position, from, to) <= LANE_BLOCK_RADIUS_METERS) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Options and decision
// ---------------------------------------------------------------------------

export type AttackOptionKind = "PASS" | "ATTACK_GAP" | "SHOOT" | "PLAY_PIVOT" | "RESET" | "CONTINUE";

export type AttackOption = {
  readonly kind: AttackOptionKind;
  readonly score: number;
  readonly gapId?: AttackGapId;
  readonly targetPlayerId?: string;
  readonly target?: MeterPoint;
  /** Why it scored what it scored, in plain language. */
  readonly detail: string;
};

export type DecisionTrigger = "SETTLED" | "DRIVE_REEVALUATION" | "ARRIVED";

export type AttackDecision = {
  readonly trigger: DecisionTrigger;
  readonly carrierId: string;
  readonly carrierLabel: AttackRoleLabel | null;
  readonly chosen: AttackOption;
  /** Every option considered, best first. */
  readonly options: readonly AttackOption[];
  /** Patience left before the carrier is willing to go for goal; 0 = now. */
  readonly patience: number;
  /** Pressure on the carrier at the moment of decision. */
  readonly pressure: number;
  /** The defender who has closed the current drive, when re-evaluating a drive. */
  readonly blockedBy: string | null;
};

export type DecisionContext = {
  readonly state: HandballState;
  readonly goalSide: AttackingGoalSide;
  readonly carrier: Player;
  readonly trigger: DecisionTrigger;
  /** The gap currently being driven at, when re-evaluating. */
  readonly drivingGapId: AttackGapId | null;
  /** Passes since the attack last (re)started -- a reset starts the count again. */
  readonly passesMade: number;
  readonly resets: number;
  /** Simulated seconds this possession has already lasted. */
  readonly possessionSeconds: number;
  readonly lastPasserId: string | null;
  readonly ratings?: Readonly<Record<string, AttackPlayerRatings>>;
  readonly tactics?: AttackTactics;
  readonly rng: PossessionRng;
};

/**
 * Which passes are handball-structured. 1 = the natural relationship (backs
 * to each other, wing to his back), 0.45 = a plausible longer connection.
 * Anything else is a last resort, not forbidden.
 */
const PASS_RELATIONS: Partial<Record<PlayerRole, Partial<Record<PlayerRole, number>>>> = {
  LEFT_WING: { LEFT_BACK: 1, CENTER_BACK: 0.45 },
  LEFT_BACK: { LEFT_WING: 1, CENTER_BACK: 1, RIGHT_BACK: 0.45 },
  CENTER_BACK: { LEFT_BACK: 1, RIGHT_BACK: 1, LEFT_WING: 0.3, RIGHT_WING: 0.3 },
  RIGHT_BACK: { RIGHT_WING: 1, CENTER_BACK: 1, LEFT_BACK: 0.45 },
  RIGHT_WING: { RIGHT_BACK: 1, CENTER_BACK: 0.45 },
  PIVOT: { CENTER_BACK: 1, LEFT_BACK: 0.7, RIGHT_BACK: 0.7 },
};

const BACK_ROLES: readonly PlayerRole[] = ["LEFT_BACK", "CENTER_BACK", "RIGHT_BACK"];
const WING_ROLES: readonly PlayerRole[] = ["LEFT_WING", "RIGHT_WING"];

/**
 * Beyond this lateral offset a gap is somebody else's to attack. Generous,
 * because FIELD's canonical backs stand wide (x ~1 and ~19) and a back's
 * drive at an inside gap is a diagonal run, not a straight one.
 */
const MAX_GAP_LATERAL_METERS = 7.5;
/** While a drive is live and open, circulation needs a reason to interrupt it. */
const DRIVE_PASS_PENALTY = 0.15;
/** A live, open drive is not abandoned on noise. */
const DRIVE_PERSISTENCE_BONUS = 0.3;
/** A drive has to be a drive: not from on top of the line, not from the halfway line. */
const MIN_GAP_APPROACH_METERS = 0.8;
const MAX_GAP_APPROACH_METERS = 9;
/** Backs shoot from inside this; wings and the pivot are always inside it. */
const MAX_SHOOTING_DISTANCE_METERS = 11;
/** Scores below this are not worth acting on -- reset instead. */
const RESET_SCORE = 0.22;
/** Small seeded noise so identical situations can diverge across seeds. */
const DECISION_NOISE = 0.1;
/** A possession this old has exhausted the referee's patience as well as the carrier's. */
const URGENCY_FULL_SECONDS = 35;

/**
 * How urgently the attack has to produce something: rises with every reset
 * and with time in possession, the way the passive-play forewarning does.
 * Circulation and resets lose appeal under urgency; going for goal gains it.
 */
export function urgencyFor(resets: number, possessionSeconds: number): number {
  return Math.min(1, 0.25 * resets + possessionSeconds / URGENCY_FULL_SECONDS);
}

function ratingOf(ratings: DecisionContext["ratings"], playerId: string, key: keyof AttackPlayerRatings): number {
  return ratings?.[playerId]?.[key] ?? DEFAULT_ATTACK_RATING;
}

/**
 * How much the carrier still prefers to keep the ball moving rather than go
 * for goal. Starts from the tempo tactic and falls with every pass and every
 * reset, so a possession matures into an action instead of circulating for
 * ever -- but nothing forces the action at any particular pass.
 */
export function patienceFor(passesMade: number, resets: number, tactics: AttackTactics): number {
  const base = 0.5 - 0.2 * tactics.tempo;
  return Math.max(0, base - passesMade * 0.12 - resets * 0.15);
}

function sideBias(x: number, tactics: AttackTactics): number {
  return 0.12 * tactics.side * ((x - 10) / 10);
}

/**
 * Reads the carrier's situation and decides what he does next.
 */
export function decideAttackAction(ctx: DecisionContext): AttackDecision {
  const { state, goalSide, carrier, trigger, rng } = ctx;
  const tactics = ctx.tactics ?? DEFAULT_ATTACK_TACTICS;
  const goal = goalCentre(goalSide);
  const label = attackRoleLabel(carrier.role);
  const isPivot = carrier.role === "PIVOT";
  // Once he has arrived at the line the carrier is committed: no more waiting.
  const patience = trigger === "ARRIVED" ? 0 : patienceFor(ctx.passesMade, ctx.resets, tactics);
  const urgency = urgencyFor(ctx.resets, ctx.possessionSeconds);
  const pressure = pressureAt(state, carrier.position);
  const goalDistance = distanceBetween(carrier.position, goal);
  const attacking = ratingOf(ctx.ratings, carrier.id, "attacking");
  const passing = ratingOf(ctx.ratings, carrier.id, "passing");
  const shooting = ratingOf(ctx.ratings, carrier.id, "shooting");
  const noise = () => (rng.nextFloat() - 0.5) * 2 * DECISION_NOISE;

  const options: AttackOption[] = [];
  const gaps = perceiveGaps(state, goalSide);
  let blockedBy: string | null = null;

  // --- attack a gap / continue the current drive ---------------------------
  if (!isPivot) {
    for (const gap of gaps) {
      const lateral = Math.abs(carrier.position.x - gap.attackPoint.x);
      const approach = distanceBetween(carrier.position, gap.attackPoint);
      const isCurrent = ctx.drivingGapId === gap.gapId && trigger === "DRIVE_REEVALUATION";
      if (!isCurrent && (lateral > MAX_GAP_LATERAL_METERS || approach < MIN_GAP_APPROACH_METERS || approach > MAX_GAP_APPROACH_METERS)) continue;
      if (trigger === "ARRIVED") continue; // at the line: shoot, feed or reset, not another drive
      // A live drive is judged against the point the carrier is ACTUALLY
      // running at; a prospective one against the gap as it stands now.
      const pathTarget = isCurrent && carrier.intent.type === "ATTACK" ? carrier.intent.target : gap.attackPoint;
      const blocked = blockerPlayerOnPath(state, carrier, pathTarget);
      if (isCurrent) blockedBy = blocked?.player.id ?? null;
      // Nearer gaps are preferred, but not so steeply that the same gap is
      // attacked every time from the same spot.
      const relevance = 1 - 0.6 * Math.min(1, (lateral / MAX_GAP_LATERAL_METERS) ** 2);
      // A small gap needs a player willing to take it on; a big one does not.
      const smallGapPenalty = gap.openness < 0.5 ? (0.5 - gap.openness) * (1 - 0.05 * (attacking - DEFAULT_ATTACK_RATING)) : 0;
      if (isCurrent) {
        if (!blocked) {
          const score = gap.openness * relevance + DRIVE_PERSISTENCE_BONUS - smallGapPenalty + noise();
          options.push({ kind: "CONTINUE", score, gapId: gap.gapId, target: pathTarget, detail: `continue: ${gap.gapId} still open (${gap.openness.toFixed(2)})` });
        } else {
          // The defender has stepped into the path. Taking him on is an option
          // whose appeal depends on the carrier's ability, how much of the gap
          // is still there beside him, and how close he already is.
          const closeness = 1 - Math.min(1, blocked.along / BLOCK_LOOKAHEAD_METERS);
          const score = 0.4 + 0.035 * (attacking - DEFAULT_ATTACK_RATING) + 0.25 * gap.openness - 0.2 * closeness + 0.15 * urgency + noise();
          options.push({
            kind: "CONTINUE",
            score,
            gapId: gap.gapId,
            target: takeOnTarget(blocked.player, gap.attackPoint, goalSide),
            detail: `takes on ${blocked.player.id} (${blocked.along.toFixed(1)}m ahead)`,
          });
        }
        continue;
      }
      // Switching to a different gap mid-drive is a change of direction, not a
      // free re-roll; it has to be clearly better than the alternatives.
      const redirectPenalty = trigger === "DRIVE_REEVALUATION" ? 0.25 : 0;
      const score = blocked
        ? 0
        : gap.openness * relevance * (1 + 0.03 * (attacking - DEFAULT_ATTACK_RATING)) -
          smallGapPenalty -
          0.02 * approach -
          redirectPenalty -
          patience +
          sideBias(gap.attackPoint.x, tactics) +
          noise();
      const detail = blocked
        ? `${gap.gapId} closed by ${blocked.player.id}`
        : `${gap.gapId} openness ${gap.openness.toFixed(2)} (${gap.width.toFixed(1)}m wide, split ${gap.depthSplit.toFixed(1)}m), ${approach.toFixed(1)}m away`;
      options.push({ kind: "ATTACK_GAP", score, gapId: gap.gapId, target: gap.attackPoint, detail });
    }
  }

  // --- shoot -----------------------------------------------------------------
  // Range is range for everyone: a pivot who has not yet reached the line is
  // not a pivot shot, and a wing in his corner is inside range anyway.
  if (goalDistance <= MAX_SHOOTING_DISTANCE_METERS) {
    const angle = shootingAngleQuality(carrier.position, goal);
    const score =
      0.1 +
      0.35 * angle +
      0.45 * (1 - pressure) -
      Math.max(0, goalDistance - 8) * 0.08 +
      0.02 * (shooting - DEFAULT_ATTACK_RATING) -
      patience * 0.6 +
      0.15 * urgency +
      noise();
    options.push({
      kind: "SHOOT",
      score,
      target: { ...goal },
      detail: `shoot from ${goalDistance.toFixed(1)}m, angle ${angle.toFixed(2)}, pressure ${pressure.toFixed(2)}`,
    });
  }

  // --- pass / play pivot -----------------------------------------------------
  const teammates = fieldAttackers(state).filter((p) => p.id !== carrier.id);
  let bestReset: { player: Player; score: number } | null = null;
  for (const mate of teammates) {
    const dist = distanceBetween(carrier.position, mate.position);
    const laneBlocked = passingLaneBlocked(state, carrier.position, mate.position);
    const freedomMeters = nearestDefenderTo(state, mate.position).distance;
    const freedom = clamp01(freedomMeters / 3);
    if (mate.role === "PIVOT" && !isPivot) {
      // The pivot is a real option only when he actually has room and the
      // ball can reach him: he is "available", or he is not.
      const available = freedomMeters >= 1.0 && !laneBlocked && dist <= 10;
      const score = available
        ? (0.3 + 0.35 * clamp01((freedomMeters - 1) / 1.5) + 0.35 * pressure + 0.02 * (passing - DEFAULT_ATTACK_RATING)) *
            (1 + 0.5 * tactics.pivotUsage) +
          noise()
        : 0;
      options.push({
        kind: "PLAY_PIVOT",
        score,
        targetPlayerId: mate.id,
        detail: available
          ? `pivot free ${freedomMeters.toFixed(1)}m, ${dist.toFixed(1)}m away`
          : `pivot not available (free ${freedomMeters.toFixed(1)}m${laneBlocked ? ", lane blocked" : ""}${dist > 10 ? ", too far" : ""})`,
      });
      continue;
    }
    const relation = PASS_RELATIONS[carrier.role]?.[mate.role] ?? 0.1;
    const distancePenalty = Math.max(0, dist - 12) * 0.06 + (dist < 2 ? 0.3 : 0);
    const backPassPenalty = mate.id === ctx.lastPasserId ? 0.2 : 0;
    const widthBias = WING_ROLES.includes(mate.role) ? 0.12 * tactics.width : 0;
    // Circulation is attractive while the carrier is patient and loses its
    // appeal as the possession matures. Once he has committed to an action, a
    // pass needs a reason: from the line it is a bail-out, and during an open
    // drive it must beat the drive itself.
    // The pivot is the finisher: with the ball on the line he plays out only
    // when he is genuinely marked.
    const commitmentPenalty =
      (trigger === "ARRIVED" ? 0.15 : trigger === "DRIVE_REEVALUATION" && !blockedBy ? DRIVE_PASS_PENALTY : 0) + (isPivot ? 0.15 : 0);
    const score =
      0.15 +
      0.25 * relation +
      0.2 * freedom +
      0.5 * patience -
      (laneBlocked ? 0.8 : 0) -
      distancePenalty -
      backPassPenalty -
      commitmentPenalty -
      0.3 * urgency +
      widthBias +
      sideBias(mate.position.x, tactics) +
      noise();
    // A pass back out to a back behind the play, made after the carrier had
    // committed to an action, IS the reset: the attack starts again from it.
    const isReset = trigger !== "SETTLED" && BACK_ROLES.includes(mate.role) && distanceBetween(mate.position, goal) > goalDistance + 2;
    const mateLabel = attackRoleLabel(mate.role) ?? mate.role;
    options.push({
      kind: isReset ? "RESET" : "PASS",
      score,
      targetPlayerId: mate.id,
      detail: isReset
        ? `pass back out to ${mateLabel} (free ${freedomMeters.toFixed(1)}m) and re-form`
        : `${mateLabel} relation ${relation}, free ${freedomMeters.toFixed(1)}m${laneBlocked ? ", lane blocked" : ""}`,
    });
    // The reset outlet: the freest back, the centre back for preference.
    if (BACK_ROLES.includes(mate.role) && !laneBlocked) {
      const resetScore = freedom + (mate.role === "CENTER_BACK" ? 0.1 : 0);
      if (!bestReset || resetScore > bestReset.score) bestReset = { player: mate, score: resetScore };
    }
  }

  // --- abort / reset ---------------------------------------------------------
  const resetTo = bestReset?.player ?? teammates.find((p) => p.role !== "PIVOT") ?? teammates[0];
  if (resetTo) {
    options.push({
      kind: "RESET",
      score: RESET_SCORE - 0.3 * urgency + noise(),
      targetPlayerId: resetTo.id,
      detail: `pass back out to ${attackRoleLabel(resetTo.role) ?? resetTo.role} and re-form`,
    });
  }

  options.sort((a, b) => b.score - a.score || a.kind.localeCompare(b.kind));
  const chosen = options[0];
  if (!chosen) {
    // No teammate, no gap, nothing: the only honest action is to go for goal.
    const fallback: AttackOption = { kind: "SHOOT", score: 0, target: { ...goal }, detail: "no options at all" };
    return { trigger, carrierId: carrier.id, carrierLabel: label, chosen: fallback, options: [fallback], patience, pressure, blockedBy };
  }
  return { trigger, carrierId: carrier.id, carrierLabel: label, chosen, options, patience, pressure, blockedBy };
}

/** A short, readable line for a decision -- what a trace note or a HUD shows. */
export function describeDecision(decision: AttackDecision, state: HandballState): string {
  const who = decision.carrierLabel ?? decision.carrierId;
  const c = decision.chosen;
  const nameOf = (id?: string) => {
    const p = id ? state.players.find((x) => x.id === id) : undefined;
    return p ? (attackRoleLabel(p.role) ?? p.id) : (id ?? "?");
  };
  switch (c.kind) {
    case "PASS":
      return `${who} passes to ${nameOf(c.targetPlayerId)} (${c.detail})`;
    case "PLAY_PIVOT":
      return `${who} plays the pivot ${nameOf(c.targetPlayerId)} (${c.detail})`;
    case "ATTACK_GAP":
      return `${who} attacks the ${c.gapId} gap (${c.detail})`;
    case "CONTINUE":
      return `${who} keeps driving at ${c.gapId}`;
    case "SHOOT":
      return `${who} decides to shoot (${c.detail})`;
    case "RESET":
      return `${who} resets: ${c.detail}`;
  }
}
