/**
 * MATCH-EXPERIENCE-2.0 M8: the decisions inside a transition.
 *
 *   REGAIN -> READ NUMBERS + SPACE -> ASSIGN RUNNING ROLES -> ADVANCE BALL
 *     -> DEFENSIVE RETREAT -> RE-EVALUATE
 *     -> FINISH / SECOND WAVE / EARLY OFFENSE / ORGANIZED ATTACK
 *
 * M2 gave the transition real full-court movement: everybody ran at the goal,
 * the ball was thrown to whoever happened to be furthest forward, and the
 * break either beat the retreat or did not. What it had no model of was the
 * handball IN that movement -- who runs first wave and who supports, which
 * lane each runner fills, whether the outlet should be short or long, whether
 * the numbers actually favour going, and which retreating defender does what.
 *
 * This module is that model, and only that. It decides nothing about the
 * outcome: it reads the state at the regain and at every re-evaluation, and
 * returns intentions that sequenceEngine turns into the same MOVE/PASS
 * commands the engine has always had. The shot model, the pass-risk model and
 * the fixed-step integrator are reused unchanged, so a long outlet into a
 * covered lane is intercepted by the SAME code that judges an organized pass.
 *
 * WHY LANES. Every M2 movement target pointed at the goal, so a break became
 * a single file down the middle -- the same failure the organized attack had
 * before M6. Runners are therefore assigned distinct lanes across the court,
 * derived from FIELD's own canonical wing positions, and hold them until the
 * ball arrives.
 */
import { COURT_LENGTH_METERS, COURT_WIDTH_METERS } from "../domain/geometry/court";
import { distanceBetween, type MeterPoint } from "../domain/geometry/coordinates";
import { constantSpeedProfileOf, pointControl } from "./spatialControl";
import { goalCentre, type AttackingGoalSide } from "../domain/match/possession";
import { roleLaneX } from "./transition";
import { ownGoalIsEmpty } from "./sevenVsSix";
import type { Player } from "../domain/handball/player";
import type { HandballState } from "../domain/handball/state";
import type { PossessionRng } from "./possessionRng";

const DEFAULT_RATING = 10;

/** Per-player ratings the transition reads. 1-20, the game's attribute scale. */
export type TransitionPlayerRatings = {
  /** Outlet quality and willingness to try the long ball. */
  readonly passing?: number;
  /** Reading the break: how early a defender picks up his retreat job. */
  readonly defending?: number;
  readonly shooting?: number;
};

export const TRANSITION_LIMITS = Object.freeze({
  /** How close to the target goal a first-wave runner aims. */
  firstWaveDepthMeters: 8,
  /** Where the supporting second wave aims. */
  secondWaveDepthMeters: 14,
  /** Where the trailer holds, so somebody is always behind the ball. */
  trailerDepthMeters: 22,
  /** In front of his own goal, where the centre protector sets up. */
  centreProtectDepthMeters: 7,
  /** How far goal-side of a runner his marker tries to get. */
  pickUpOffsetMeters: 1.5,
  /** A pass this long is a long outlet; below the short threshold it is a safe one. */
  shortOutletMeters: 12,
  longOutletMeters: 20,
  /** A defender within this distance of a passing lane is covering it. */
  laneCoverMeters: 2.5,
  /** How close a defender must be to the ball's path to be worth sending at the ball. */
  ballStopperReachMeters: 9,
});

// ---------------------------------------------------------------------------
// Lanes -- derived from FIELD's canonical wing positions, never invented
// ---------------------------------------------------------------------------

/**
 * The five running lanes of a fast break: both wings, both half positions and
 * the centre. The wing lanes come from FIELD's own canonical wing x, pulled
 * just inside the sideline so a sprinting runner is not glued to the line;
 * the centre is the court's centre line and the halves are the midpoints.
 */
export const TRANSITION_LANES: readonly number[] = (() => {
  const centre = COURT_WIDTH_METERS / 2;
  const left = Math.max(1.5, roleLaneX("LEFT_WING") ?? 1.5);
  const right = Math.min(COURT_WIDTH_METERS - 1.5, roleLaneX("RIGHT_WING") ?? COURT_WIDTH_METERS - 1.5);
  return Object.freeze([left, (left + centre) / 2, centre, (centre + right) / 2, right]);
})();

/** How far up the court a point is, measured toward `goalSide` (0 at the far end, 40 at the goal). */
export function advancementToward(point: MeterPoint, goalSide: AttackingGoalSide): number {
  return goalSide === "TOP" ? COURT_LENGTH_METERS - point.y : point.y;
}

/** A depth `metres` in front of the goal on `goalSide`. */
export function depthInFrontOf(goalSide: AttackingGoalSide, metres: number): number {
  return goalSide === "TOP" ? metres : COURT_LENGTH_METERS - metres;
}

// ---------------------------------------------------------------------------
// Perception
// ---------------------------------------------------------------------------

export type RunningRole = "FIRST_WAVE" | "SECOND_WAVE" | "TRAILER";
export type RetreatRole = "BALL_STOPPER" | "CENTRE_PROTECTOR" | "PICK_UP_RUNNER" | "RECOVER";

export type RunningAssignment = {
  readonly playerId: string;
  readonly role: RunningRole;
  readonly laneX: number;
};

export type RetreatAssignment = {
  readonly defenderId: string;
  readonly role: RetreatRole;
  /** The runner he has picked up, when that is his job. */
  readonly marksPlayerId: string | null;
};

export type TransitionPerception = {
  readonly attackingGoalSide: AttackingGoalSide;
  readonly defendedGoalSide: AttackingGoalSide;
  readonly goal: MeterPoint;
  readonly carrier: Player | null;
  readonly attackers: readonly Player[];
  readonly defenders: readonly Player[];
  /** Attackers further up the court than the ball. */
  readonly attackersAhead: readonly Player[];
  /** Defenders between the ball and the goal being attacked. */
  readonly defendersGoalSide: readonly Player[];
  /** attackersAhead - defendersGoalSide, for reporting the numbers in words. */
  readonly advantage: number;
  /** How far the ball has advanced toward the goal, in metres. */
  readonly ballAdvancement: number;
  /** Seconds the carrier would win his race to a shooting position by. Null with no carrier. */
  readonly carrierMarginSeconds: number | null;
  /** The runner who wins his race by most, and by how much. */
  readonly bestRunner: Player | null;
  readonly bestRunnerMarginSeconds: number;
  /**
   * M22: the goal being attacked has nobody in it.
   *
   * Read from the court like everything else here -- the defending side has no
   * goalkeeper on it, because he has gone off for a seventh outfield player or
   * has not finished walking back. It is a fact about the situation, not a
   * licence: what the break DOES about it is decided below, against the same
   * race and the same defenders as any other break.
   */
  readonly goalIsEmpty: boolean;
};

function outfield(state: HandballState, team: "ATTACK" | "DEFENSE"): readonly Player[] {
  return state.players.filter((p) => p.team === team && p.kind === "FIELD_PLAYER");
}

/** Where on his route to goal an attacker would be able to shoot. */
function shootingPointFor(from: MeterPoint, goal: MeterPoint): MeterPoint {
  const distance = distanceBetween(from, goal);
  if (distance <= BREAK_SHOT_RANGE_METERS) return { ...from };
  const t = (distance - BREAK_SHOT_RANGE_METERS) / distance;
  return { x: from.x + (goal.x - from.x) * t, y: from.y + (goal.y - from.y) * t };
}

/**
 * A fast break is a RACE, not a head count.
 *
 * Counting bodies is the wrong read here and measurably so: immediately after
 * a save every opponent is still in your attacking half, so a static count
 * says "no break" on every single regain and the team would trot back every
 * time. What actually decides a break is whether a runner can reach a shooting
 * position before any defender can get there to stop him -- which the engine
 * can answer exactly, from real positions and each player's own top speed.
 *
 * Returns the seconds the attacker wins that race by; negative means the
 * defence gets there first.
 */
export function breakMarginSeconds(perception: TransitionPerception, attacker: Player): number {
  const point = shootingPointFor(attacker.position, perception.goal);
  // M17: the same race, now expressed through the shared spatial-control
  // primitive rather than repeating the arithmetic here.
  //
  // DELIBERATELY THE CONSTANT-SPEED PROFILE. M17 gives the model a richer
  // reading -- reaction time, and credit for the direction a player is already
  // running -- and the organized attack uses it. The break does not, because
  // the break was measured and calibrated on this simpler question and M17 is
  // not a calibration milestone. `constantSpeedProfileOf` reproduces
  // distance / maxSpeed exactly, so every number this function returns is
  // unchanged; what has gone is the second copy of the formula.
  const control = pointControl(
    point,
    constantSpeedProfileOf(attacker),
    perception.defenders.map(constantSpeedProfileOf),
  );
  return Number.isFinite(control.defenderSeconds) ? control.marginSeconds : 99 - control.attackerSeconds;
}

export function perceiveTransition(state: HandballState, attackingGoalSide: AttackingGoalSide): TransitionPerception {
  const goal = goalCentre(attackingGoalSide);
  const attackers = outfield(state, "ATTACK");
  const defenders = outfield(state, "DEFENSE");
  const carrier = state.ball.possessorId ? (state.players.find((p) => p.id === state.ball.possessorId) ?? null) : null;
  const ballAdvancement = advancementToward(state.ball.position, attackingGoalSide);
  // "Ahead" and "goal-side" are both measured against the ball, which is what
  // a player on the court can actually see.
  const attackersAhead = attackers.filter((p) => advancementToward(p.position, attackingGoalSide) > ballAdvancement + 0.5);
  const defendersGoalSide = defenders.filter((p) => advancementToward(p.position, attackingGoalSide) > ballAdvancement);
  const base: TransitionPerception = {
    attackingGoalSide,
    defendedGoalSide: attackingGoalSide,
    goal,
    carrier,
    attackers,
    defenders,
    attackersAhead,
    defendersGoalSide,
    advantage: attackersAhead.length - defendersGoalSide.length,
    ballAdvancement,
    // The defending side's own goal IS the goal being attacked.
    goalIsEmpty: ownGoalIsEmpty(state, "DEFENSE", attackingGoalSide),
    carrierMarginSeconds: null,
    bestRunner: null,
    bestRunnerMarginSeconds: Number.NEGATIVE_INFINITY,
  };

  let bestRunner: Player | null = null;
  let bestMargin = Number.NEGATIVE_INFINITY;
  for (const attacker of attackers) {
    if (attacker.id === carrier?.id) continue;
    const margin = breakMarginSeconds(base, attacker);
    if (margin > bestMargin || (margin === bestMargin && bestRunner && attacker.id < bestRunner.id)) {
      bestMargin = margin;
      bestRunner = attacker;
    }
  }
  return {
    ...base,
    carrierMarginSeconds: carrier && carrier.kind === "FIELD_PLAYER" ? breakMarginSeconds(base, carrier) : null,
    bestRunner,
    bestRunnerMarginSeconds: bestRunner ? bestMargin : Number.NEGATIVE_INFINITY,
  };
}

// ---------------------------------------------------------------------------
// Running roles -- who goes, who supports, which lane
// ---------------------------------------------------------------------------

/**
 * Assigns running roles from where players ACTUALLY are at the regain: the two
 * furthest up the court go first wave, the next two support as second wave,
 * the rest trail. Each then takes the free lane nearest his current position,
 * so a runner already wide stays wide and the break fans out instead of
 * converging on the centre.
 *
 * Deterministic: ties break on player id. The carrier is included -- once he
 * passes he becomes a runner like anybody else.
 */
export function assignRunningRoles(perception: TransitionPerception): RunningAssignment[] {
  const ordered = [...perception.attackers].sort(
    (a, b) =>
      advancementToward(b.position, perception.attackingGoalSide) - advancementToward(a.position, perception.attackingGoalSide) ||
      a.id.localeCompare(b.id),
  );
  const taken = new Set<number>();
  return ordered.map((player, index) => {
    const role: RunningRole = index < 2 ? "FIRST_WAVE" : index < 4 ? "SECOND_WAVE" : "TRAILER";
    // Nearest free lane to where he is standing.
    let bestLane = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    TRANSITION_LANES.forEach((laneX, laneIndex) => {
      if (taken.has(laneIndex)) return;
      const distance = Math.abs(player.position.x - laneX);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestLane = laneIndex;
      }
    });
    if (bestLane < 0) {
      // Six runners, five lanes: the last man keeps his own width rather than
      // doubling up on somebody else's lane.
      return { playerId: player.id, role, laneX: Math.max(1.5, Math.min(COURT_WIDTH_METERS - 1.5, player.position.x)) };
    }
    taken.add(bestLane);
    return { playerId: player.id, role, laneX: TRANSITION_LANES[bestLane] };
  });
}

/** Where a runner is heading: his lane, at the depth his wave holds. */
export function runningTarget(assignment: RunningAssignment, goalSide: AttackingGoalSide): MeterPoint {
  const depth =
    assignment.role === "FIRST_WAVE"
      ? TRANSITION_LIMITS.firstWaveDepthMeters
      : assignment.role === "SECOND_WAVE"
        ? TRANSITION_LIMITS.secondWaveDepthMeters
        : TRANSITION_LIMITS.trailerDepthMeters;
  return { x: assignment.laneX, y: depthInFrontOf(goalSide, depth) };
}

// ---------------------------------------------------------------------------
// Defensive retreat priorities
// ---------------------------------------------------------------------------

/** Distance from `point` to the segment a-b. */
function distanceToSegment(point: MeterPoint, a: MeterPoint, b: MeterPoint): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-9) return distanceBetween(point, a);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / len2));
  return distanceBetween(point, { x: a.x + abx * t, y: a.y + aby * t });
}

/**
 * Gives every retreating defender a job, from real positions:
 *
 *   CENTRE_PROTECTOR  the defender nearest his own goal holds the middle in
 *                     front of it and does NOT chase the ball
 *   BALL_STOPPER      the defender best placed to get in front of the ball --
 *                     near its path to goal and not hopelessly behind it
 *   PICK_UP_RUNNER    each remaining defender takes the most dangerous
 *                     unclaimed runner he can actually get goal-side of
 *   RECOVER           anybody left simply runs back into the line
 *
 * `previous` keeps the two special jobs sticky, so they do not swap hands on
 * every step while everybody is still running.
 */
export function assignRetreatRoles(
  perception: TransitionPerception,
  previous?: readonly RetreatAssignment[],
  ratings?: Readonly<Record<string, TransitionPlayerRatings>>,
): RetreatAssignment[] {
  const goal = perception.goal;
  const ball = perception.carrier?.position ?? goal;
  const byGoalDistance = [...perception.defenders].sort(
    (a, b) => distanceBetween(a.position, goal) - distanceBetween(b.position, goal) || a.id.localeCompare(b.id),
  );
  if (byGoalDistance.length === 0) return [];

  const previousRole = (id: string) => previous?.find((p) => p.defenderId === id)?.role ?? null;
  const stickyBonus = (id: string, role: RetreatRole) => (previousRole(id) === role ? 1.5 : 0);

  // The centre protector is the man home first -- the deepest defender.
  const protector =
    byGoalDistance.find((d) => previousRole(d.id) === "CENTRE_PROTECTOR") ?? byGoalDistance[0];

  // The ball stopper is whoever can most cheaply get between ball and goal:
  // close to that line, and reading it early (defending rating helps).
  let stopper: Player | null = null;
  let stopperScore = Number.POSITIVE_INFINITY;
  for (const defender of perception.defenders) {
    if (defender.id === protector.id) continue;
    const toLine = distanceToSegment(defender.position, ball, goal);
    if (toLine > TRANSITION_LIMITS.ballStopperReachMeters) continue;
    const reading = ((ratings?.[defender.id]?.defending ?? DEFAULT_RATING) - DEFAULT_RATING) * 0.08;
    const score = toLine + distanceBetween(defender.position, ball) * 0.25 - reading - stickyBonus(defender.id, "BALL_STOPPER");
    if (score < stopperScore) {
      stopperScore = score;
      stopper = defender;
    }
  }

  // Everyone else picks up the most dangerous runner still unclaimed: furthest
  // up the court first, and only if this defender is the best-placed claimant.
  const dangerous = [...perception.attackers]
    .filter((a) => a.id !== perception.carrier?.id)
    .sort(
      (a, b) =>
        advancementToward(b.position, perception.attackingGoalSide) - advancementToward(a.position, perception.attackingGoalSide) ||
        a.id.localeCompare(b.id),
    );
  const claimed = new Set<string>();
  const remaining = perception.defenders.filter((d) => d.id !== protector.id && d.id !== stopper?.id);

  const assignments: RetreatAssignment[] = [
    { defenderId: protector.id, role: "CENTRE_PROTECTOR", marksPlayerId: null },
  ];
  if (stopper) assignments.push({ defenderId: stopper.id, role: "BALL_STOPPER", marksPlayerId: null });

  for (const runner of dangerous) {
    const claimant = remaining
      .filter((d) => !assignments.some((a) => a.defenderId === d.id))
      .sort((a, b) => distanceBetween(a.position, runner.position) - distanceBetween(b.position, runner.position) || a.id.localeCompare(b.id))[0];
    if (!claimant) break;
    claimed.add(runner.id);
    assignments.push({ defenderId: claimant.id, role: "PICK_UP_RUNNER", marksPlayerId: runner.id });
  }
  for (const defender of remaining) {
    if (assignments.some((a) => a.defenderId === defender.id)) continue;
    assignments.push({ defenderId: defender.id, role: "RECOVER", marksPlayerId: null });
  }
  return assignments;
}

/** Where a retreating defender runs, given his job. */
export function retreatTargetFor(
  assignment: RetreatAssignment,
  defender: Player,
  perception: TransitionPerception,
  state: HandballState,
): MeterPoint {
  const goal = perception.goal;
  const goalSide = perception.defendedGoalSide;
  switch (assignment.role) {
    case "CENTRE_PROTECTOR":
      // The middle, in front of his own goal. He never leaves it for the ball.
      return { x: goal.x, y: depthInFrontOf(goalSide, TRANSITION_LIMITS.centreProtectDepthMeters) };
    case "BALL_STOPPER": {
      // Between the ball and the goal, a step goal-side of the carrier.
      const ball = perception.carrier?.position ?? state.ball.position;
      const toGoal = distanceBetween(ball, goal);
      const t = toGoal < 1e-6 ? 0 : Math.min(1, TRANSITION_LIMITS.pickUpOffsetMeters / toGoal);
      return { x: ball.x + (goal.x - ball.x) * t, y: ball.y + (goal.y - ball.y) * t };
    }
    case "PICK_UP_RUNNER": {
      const runner = state.players.find((p) => p.id === assignment.marksPlayerId);
      if (!runner) return { x: defender.position.x, y: depthInFrontOf(goalSide, TRANSITION_LIMITS.centreProtectDepthMeters) };
      // Goal-side of his runner, in the runner's lane.
      const toGoal = distanceBetween(runner.position, goal);
      const t = toGoal < 1e-6 ? 0 : Math.min(1, TRANSITION_LIMITS.pickUpOffsetMeters / toGoal);
      return { x: runner.position.x + (goal.x - runner.position.x) * t, y: runner.position.y + (goal.y - runner.position.y) * t };
    }
    default:
      // Straight back into the line, in his own lane.
      return {
        x: Math.max(2, Math.min(COURT_WIDTH_METERS - 2, defender.position.x)),
        y: depthInFrontOf(goalSide, TRANSITION_LIMITS.centreProtectDepthMeters),
      };
  }
}

// ---------------------------------------------------------------------------
// The outlet
// ---------------------------------------------------------------------------

export type OutletKind = "SHORT" | "MEDIUM" | "LONG" | "CARRY";

export type OutletOption = {
  readonly kind: OutletKind;
  readonly targetPlayerId: string | null;
  readonly score: number;
  readonly distance: number;
  /** Nearest defender to the passing lane -- how covered the ball would be. */
  readonly laneClearance: number;
  /** Metres of the court this pass gains toward the goal. */
  readonly progress: number;
  readonly detail: string;
};

export type OutletDecision = {
  readonly chosen: OutletOption;
  readonly options: readonly OutletOption[];
};

/** Nearest defender to the segment carrier -> receiver. */
function laneClearanceFor(perception: TransitionPerception, from: MeterPoint, to: MeterPoint): number {
  let best = Number.POSITIVE_INFINITY;
  for (const defender of perception.defenders) {
    if (distanceBetween(defender.position, from) < 0.8) continue;
    best = Math.min(best, distanceToSegment(defender.position, from, to));
  }
  return Number.isFinite(best) ? best : 99;
}

/** Small seeded noise so two identical outlets across seeds need not agree. */
const OUTLET_NOISE = 0.08;

/**
 * The regainer's outlet. A goalkeeper who has just saved, or the outfield
 * player who won the ball, weighs every real option: how much court each pass
 * gains, how covered its lane is, how far it has to travel, and -- for an
 * outfield regainer -- simply carrying it himself.
 *
 * NOT biased toward the long ball. A long outlet only wins when there really
 * is a runner up the court with a clear lane; with the break covered the short
 * safe option scores higher, which is what stops every save becoming a hopeful
 * 30-metre throw.
 */
export function decideOutlet(
  perception: TransitionPerception,
  carrier: Player,
  rng: PossessionRng,
  ratings?: Readonly<Record<string, TransitionPlayerRatings>>,
): OutletDecision {
  const passing = ratings?.[carrier.id]?.passing ?? DEFAULT_RATING;
  const carrierAdvancement = advancementToward(carrier.position, perception.attackingGoalSide);
  const noise = () => (rng.nextFloat() - 0.5) * 2 * OUTLET_NOISE;
  const options: OutletOption[] = [];

  for (const mate of perception.attackers) {
    if (mate.id === carrier.id) continue;
    const distance = distanceBetween(carrier.position, mate.position);
    const progress = advancementToward(mate.position, perception.attackingGoalSide) - carrierAdvancement;
    const laneClearance = laneClearanceFor(perception, carrier.position, mate.position);
    const kind: OutletKind =
      distance <= TRANSITION_LIMITS.shortOutletMeters ? "SHORT" : distance >= TRANSITION_LIMITS.longOutletMeters ? "LONG" : "MEDIUM";
    // Gaining court is the point of an outlet, and what it is really worth is
    // whether the man receiving it is winning his race to the goal. A covered
    // lane and a long flight are what argue against it; a better passer
    // discounts that risk.
    const margin = breakMarginSeconds(perception, mate);
    const covered = Math.max(0, TRANSITION_LIMITS.laneCoverMeters - laneClearance) / TRANSITION_LIMITS.laneCoverMeters;
    const riskTolerance = 1 - 0.03 * (passing - DEFAULT_RATING);
    const score =
      0.2 +
      0.02 * progress +
      0.18 * Math.max(-2, Math.min(3, margin)) +
      0.25 * Math.min(1, laneClearance / TRANSITION_LIMITS.laneCoverMeters) -
      0.9 * covered * riskTolerance -
      0.012 * distance * riskTolerance +
      noise();
    options.push({
      kind,
      targetPlayerId: mate.id,
      score,
      distance,
      laneClearance,
      progress,
      detail: `${kind.toLowerCase()} to ${mate.id} (+${progress.toFixed(1)}m, race ${margin >= 0 ? "+" : ""}${margin.toFixed(1)}s, lane ${laneClearance.toFixed(1)}m, ${distance.toFixed(1)}m)`,
    });
  }

  // Carrying it is only an option for an outfield regainer -- a goalkeeper
  // does not dribble the length of the court.
  if (carrier.kind === "FIELD_PLAYER") {
    const clearanceAhead = perception.defendersGoalSide.length === 0 ? 99 : Math.min(...perception.defendersGoalSide.map((d) => distanceBetween(d.position, carrier.position)));
    const margin = perception.carrierMarginSeconds ?? 0;
    options.push({
      kind: "CARRY",
      targetPlayerId: null,
      score: 0.12 + 0.03 * Math.min(6, clearanceAhead) + 0.18 * Math.max(-2, Math.min(3, margin)) + noise(),
      distance: 0,
      laneClearance: clearanceAhead,
      progress: 0,
      detail: `carry it himself (race ${margin >= 0 ? "+" : ""}${margin.toFixed(1)}s, nearest defender ahead ${clearanceAhead === 99 ? "none" : `${clearanceAhead.toFixed(1)}m`})`,
    });
  }

  options.sort((a, b) => b.score - a.score || (a.targetPlayerId ?? "").localeCompare(b.targetPlayerId ?? ""));
  const chosen = options[0] ?? {
    kind: "CARRY" as const,
    targetPlayerId: null,
    score: 0,
    distance: 0,
    laneClearance: 99,
    progress: 0,
    detail: "no outlet at all",
  };
  return { chosen, options };
}

// ---------------------------------------------------------------------------
// Re-evaluation while the break runs
// ---------------------------------------------------------------------------

export type BreakActionKind = "SHOOT" | "PASS" | "CONTINUE" | "SLOW_DOWN";

export type BreakDecision = {
  readonly kind: BreakActionKind;
  readonly targetPlayerId: string | null;
  readonly detail: string;
  readonly advantage: number;
};

/** Distance from the target goal at which a clear runner will take his fast-break shot. */
export const BREAK_SHOT_RANGE_METERS = 10;
/** A runner is "clear" when the nearest defender is at least this far away. */
export const CLEAR_OF_DEFENCE_METERS = 3;

/**
 * What the carrier does next, re-read from the state every time it is asked.
 *
 * The order is the handball one: finish if the advantage is real and he is in
 * range; otherwise give it to somebody in a better position; otherwise keep
 * running; and when the numbers have gone, slow it down rather than
 * manufacture a shot.
 */
export function decideBreakAction(
  perception: TransitionPerception,
  carrier: Player,
  defenceRecovered: boolean,
  ratings?: Readonly<Record<string, TransitionPlayerRatings>>,
): BreakDecision {
  const goal = perception.goal;
  const toGoal = distanceBetween(carrier.position, goal);
  const nearest = perception.defenders.reduce(
    (best, d) => Math.min(best, distanceBetween(d.position, carrier.position)),
    Number.POSITIVE_INFINITY,
  );
  const pressure = Number.isFinite(nearest) ? nearest : 99;

  // M22: an empty goal changes what "in range" means, and only that.
  //
  // The reason a break has a shooting range at all is the keeper: get close
  // enough to beat him. With nobody in the goal that constraint is simply not
  // there, and the one that remains is the one already written here -- being
  // clear of the defence. So the distance gate is replaced by a court fact the
  // engine already keeps, being in the attacking half, rather than by a second
  // invented number. Nothing is added to the shot: M9 still has to put it on
  // target from wherever he lets it go, and its execution spread still grows
  // with distance, so a hopeful effort from the halfway line misses honestly.
  const inShootingRange = perception.goalIsEmpty
    ? perception.ballAdvancement > COURT_LENGTH_METERS / 2
    : toGoal <= BREAK_SHOT_RANGE_METERS;
  if (inShootingRange && pressure >= CLEAR_OF_DEFENCE_METERS) {
    return {
      kind: "SHOOT",
      targetPlayerId: null,
      detail: perception.goalIsEmpty
        ? `the goal is empty: clear at ${toGoal.toFixed(1)}m, nearest defender ${pressure.toFixed(1)}m`
        : `clear at ${toGoal.toFixed(1)}m, nearest defender ${pressure.toFixed(1)}m`,
      advantage: perception.advantage,
    };
  }

  // Somebody genuinely better placed: winning his race by more than the
  // carrier is winning his, and reachable through an open lane.
  const carrierMargin = perception.carrierMarginSeconds ?? breakMarginSeconds(perception, carrier);
  let bestMate: { player: Player; margin: number; clearance: number } | null = null;
  for (const mate of perception.attackers) {
    if (mate.id === carrier.id) continue;
    const margin = breakMarginSeconds(perception, mate);
    if (margin < carrierMargin + 0.6) continue;
    const clearance = laneClearanceFor(perception, carrier.position, mate.position);
    if (clearance < 1.2) continue;
    if (!bestMate || margin > bestMate.margin) bestMate = { player: mate, margin, clearance };
  }
  if (bestMate) {
    return {
      kind: "PASS",
      targetPlayerId: bestMate.player.id,
      detail: `${bestMate.player.id} wins his race by ${bestMate.margin.toFixed(1)}s against the carrier's ${carrierMargin.toFixed(1)}s, lane ${bestMate.clearance.toFixed(1)}m`,
      advantage: perception.advantage,
    };
  }

  // The advantage is gone: the retreat is home, or nobody -- carrier or
  // runner -- can now reach a shooting position before the defence does.
  const pastHalfway = perception.ballAdvancement > COURT_LENGTH_METERS / 2;
  const noRaceLeft = carrierMargin < 0 && perception.bestRunnerMarginSeconds < 0;
  if (defenceRecovered || (noRaceLeft && pastHalfway)) {
    return {
      kind: "SLOW_DOWN",
      targetPlayerId: null,
      detail: defenceRecovered
        ? "the defence is set goal-side; the break is over"
        : `nobody wins the race any more (carrier ${carrierMargin.toFixed(1)}s, best runner ${perception.bestRunnerMarginSeconds.toFixed(1)}s)`,
      advantage: perception.advantage,
    };
  }

  const shooting = ratings?.[carrier.id]?.shooting ?? DEFAULT_RATING;
  return {
    kind: "CONTINUE",
    targetPlayerId: null,
    detail: `still running (${toGoal.toFixed(1)}m out, pressure ${pressure.toFixed(1)}m, race ${carrierMargin >= 0 ? "+" : ""}${carrierMargin.toFixed(1)}s, shooting ${shooting})`,
    advantage: perception.advantage,
  };
}

/**
 * Whether the outlet is worth playing yet.
 *
 * A goalkeeper does not throw the instant he catches: he looks up while his
 * runners accelerate, and plays as soon as somebody is genuinely on -- or,
 * when nobody comes on, plays the safe ball rather than holding for ever.
 */
export const OUTLET_WORTH_PLAYING_SCORE = 0.62;
/** How long the regainer may hold while the break develops, in fixed steps (3.5s). */
export const MAX_OUTLET_HOLD_STEPS = 70;

/**
 * The second wave: when the first wave has not produced a shot but the
 * defence is not yet set, a supporting runner arriving behind the ball can
 * still be played in. Returns him only when he has a genuine edge.
 */
export function findSecondWaveRunner(
  perception: TransitionPerception,
  carrier: Player,
  running: readonly RunningAssignment[],
): Player | null {
  const supporters = perception.attackers.filter(
    (p) => p.id !== carrier.id && running.find((r) => r.playerId === p.id)?.role === "SECOND_WAVE",
  );
  let best: { player: Player; score: number } | null = null;
  for (const mate of supporters) {
    const clearance = laneClearanceFor(perception, carrier.position, mate.position);
    if (clearance < 1.5) continue;
    const marker = perception.defenders.reduce((acc, d) => Math.min(acc, distanceBetween(d.position, mate.position)), Number.POSITIVE_INFINITY);
    if (marker < 2.5) continue;
    const score = marker + clearance - distanceBetween(mate.position, perception.goal) * 0.2;
    if (!best || score > best.score) best = { player: mate, score };
  }
  return best?.player ?? null;
}

/** `2 runners ahead vs 1 back -> +1` -- for traces and the dev HUD. */
export function describeNumbers(perception: TransitionPerception): string {
  const sign = perception.advantage > 0 ? "+" : "";
  return `${perception.attackersAhead.length} ahead vs ${perception.defendersGoalSide.length} back -> ${sign}${perception.advantage}`;
}

/** `first wave A,B; second wave C,D; trailing E` -- readable role summary. */
export function describeRunning(running: readonly RunningAssignment[]): string {
  const of = (role: RunningRole) =>
    running.filter((r) => r.role === role).map((r) => `${r.playerId}@${r.laneX.toFixed(1)}`).join(",");
  return `first wave ${of("FIRST_WAVE")}; second ${of("SECOND_WAVE")}; trailing ${of("TRAILER")}`;
}

/** `X stops the ball; Y protects the middle; Z picks up W` -- readable retreat summary. */
export function describeRetreat(retreat: readonly RetreatAssignment[]): string {
  return retreat
    .map((r) =>
      r.role === "PICK_UP_RUNNER"
        ? `${r.defenderId} picks up ${r.marksPlayerId}`
        : r.role === "BALL_STOPPER"
          ? `${r.defenderId} stops the ball`
          : r.role === "CENTRE_PROTECTOR"
            ? `${r.defenderId} protects the middle`
            : `${r.defenderId} recovers`,
    )
    .join("; ");
}
