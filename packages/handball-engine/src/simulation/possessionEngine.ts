/**
 * MATCH-EXPERIENCE-2.0 M1: the possession loop. M6: the organized attack
 * inside it makes state-dependent decisions.
 *
 * THE ARCHITECTURAL POINT. The legacy engine draws a scoreline first and
 * invents a timeline to justify it. This loop inverts that completely:
 *
 *   players + positions + defence + goalkeeper + seeded RNG
 *     -> real intermediate spatial state, advanced by fixed timestep
 *     -> a situation
 *     -> a resolution explained by that situation
 *     -> a match event derived from the resolution
 *
 * Nothing here decides the outcome up front. Every terminal result is produced
 * by `resolveShot`/`checkDisruption` from state that the simulation actually
 * reached -- shot distance and angle are measured from where the shooter is
 * standing, pressure from where the nearest defender is standing, and the save
 * from the goalkeeper's own position and rating.
 *
 * M6 -- ORGANIZED ATTACK INTELLIGENCE. M1 circulated a fixed number of random
 * passes and then drove at goal centre. Now the carrier perceives the
 * situation (attackDecision.ts) and chooses between circulating, attacking an
 * actual gap in the defensive line, feeding the pivot, shooting, or resetting
 * -- and, crucially, RE-DECIDES while a drive is under way from what the
 * defence has done about it. A step-out that closes the gap he is attacking
 * is read from the defender's real position, and the next action (pass to the
 * player that step-out freed, feed the pivot behind it, or reset) is chosen
 * from that changed state. No decision is taken in advance of the state that
 * justifies it.
 */
import { SIMULATION_DT_SECONDS } from "./fixedStep";
import { step } from "./engine";
import { createPossessionRng, type PossessionRng } from "./possessionRng";
import { evaluateSixZeroDefense } from "../policies/defense/sixZeroDefensePolicy";
import { distanceBetween } from "../domain/geometry/coordinates";
import { defendedGoalSide, goalCentre, type AttackingGoalSide, type FullCourtMatchState, type PossessionOutcome, type PossessionPhase } from "../domain/match/possession";
import {
  decideAttackAction,
  describeDecision,
  fieldAttackers,
  nearestDefenderTo,
  type AttackDecision,
  type AttackPlayerRatings,
} from "./attackDecision";
import {
  SHOT_LIMITS,
  decideShot,
  executionSpreadMeters,
  isOnTarget,
  perceiveShot,
  sampleError,
  shotLanding,
  type ShotDecision,
} from "./shotDecision";
import {
  judgeFoul,
  sevenMetreFormationTarget,
  sevenMetreMark,
  sevenMetreReady,
  type FoulAward,
} from "./foulDecision";
import {
  attemptSave,
  goalkeeperSetPosition,
  readShot,
  reactionDelaySeconds,
  type GoalkeeperRead,
  type SaveContest,
} from "../policies/goalkeeper/goalkeeperPolicy";
import {
  describeAttacker,
  ensureSixZeroHomePositions,
  organizedShapeTargetFor,
  resolveAttackTactics,
  type AttackTactics,
} from "./organizedAttack";
import type { MeterPoint } from "../domain/geometry/coordinates";
import type { HandballAction } from "../domain/handball/actions";
import type { Player } from "../domain/handball/player";
import type { HandballState } from "../domain/handball/state";
import { applyExitOrders, settleArrivedExchanges, stepWithSubstitutions } from "./substitutionExit";
import type { AttackGapId } from "../domain/geometry/attackGaps";

/**
 * Hard deterministic bound on a single possession. A handball possession is
 * seconds long; this is far above any legitimate one and exists so a logic
 * error can never hang the simulation. Reaching it is a defect, and the
 * possession terminates as a TURNOVER so callers always get a valid outcome.
 */
export const MAX_POSSESSION_STEPS = 2400; // 120 simulated seconds at dt = 0.05

/** Per-player ratings the resolution and the decision layer read. 1-20, the same scale the game's attributes use. */
export type PossessionPlayerRatings = AttackPlayerRatings & {
  /** Shot-stopping quality for a goalkeeper. */
  readonly shotStopping?: number;
  /** Ball-winning quality for a defender. */
  readonly defending?: number;
};

const DEFAULT_RATING = 10;

export type SimulatePossessionInput = {
  readonly seed: number;
  readonly initialState: FullCourtMatchState;
  /** Optional per-playerId ratings; anything omitted uses a neutral 10. */
  readonly ratings?: Readonly<Record<string, PossessionPlayerRatings>>;
  /** Optional tactical bias for the attacking decisions; neutral when omitted. */
  readonly tactics?: Partial<AttackTactics>;
  readonly maxSteps?: number;
};

export type PossessionTraceEntry = {
  readonly simulationTime: number;
  readonly phase: PossessionPhase;
  readonly ballPossessorId: string | null;
  readonly ballStatus: HandballState["ball"]["status"];
  readonly ballPosition: MeterPoint;
  /** Every player's canonical full-court position at this instant. */
  readonly playerPositions: readonly { readonly playerId: string; readonly position: MeterPoint }[];
  /** The defender the 6:0 policy currently holds primarily responsible, when it has resolved one. */
  readonly primaryDefenderId: string | null;
  /** What happened at this instant, in plain language, for development and tests. */
  readonly note: string;
  /** M6: the carrier's decision, when this entry records one. */
  readonly decision?: AttackDecision;
};

export type PossessionResult = {
  readonly outcome: PossessionOutcome;
  readonly finalState: FullCourtMatchState;
  readonly trace: readonly PossessionTraceEntry[];
  /** The player who ended the possession (shooter, or the one who lost the ball). */
  readonly resolvingPlayerId: string | null;
  /** The goalkeeper involved, when the possession ended in a shot. */
  readonly goalkeeperId: string | null;
  /** Where the shot was taken from, when the possession ended in a shot. */
  readonly shotOrigin: MeterPoint | null;
  readonly steps: number;
  /** True when the max-step guard fired instead of a natural resolution. */
  readonly guardTripped: boolean;
  /** M10: every foul the referee gave during this possession. */
  readonly fouls: readonly FoulAward[];
  /** M10: true when the possession was decided by a 7 metre throw. */
  readonly sevenMetreTaken: boolean;
};

// ---------------------------------------------------------------------------
// Situation reading -- all of it measured from real state
// ---------------------------------------------------------------------------

function ratingOf(ratings: SimulatePossessionInput["ratings"], playerId: string, key: keyof PossessionPlayerRatings): number {
  return ratings?.[playerId]?.[key] ?? DEFAULT_RATING;
}

function goalkeeper(state: HandballState): Player | undefined {
  return state.players.find((p) => p.team === "DEFENSE" && p.kind === "GOALKEEPER");
}

function findPlayer(state: HandballState, playerId: string | null): Player | undefined {
  return playerId === null ? undefined : state.players.find((p) => p.id === playerId);
}

// ---------------------------------------------------------------------------
// Resolution -- every term traceable to the state that produced it
// ---------------------------------------------------------------------------

export type ShotResolution = {
  readonly outcome: Extract<PossessionOutcome, "SHOT_GOAL" | "SHOT_SAVED" | "SHOT_MISSED">;
  readonly distance: number;
  readonly angleQuality: number;
  readonly pressure: number;
  /** What the shooter chose, and every option he weighed. */
  readonly decision: ShotDecision;
  /** Where the ball actually crossed the goal line, and how high. */
  readonly landing: { readonly x: number; readonly height: number };
  /** What the keeper committed to at release. Null when there is no keeper. */
  readonly keeperRead: GoalkeeperRead | null;
  /** Where the keeper actually got to by the time the ball arrived. */
  readonly keeperAtArrival: MeterPoint | null;
  /** The geometric contest, when the ball reached the goal on target. */
  readonly contest: SaveContest | null;
  /** The defender who got a hand to it on the way, when one did. */
  readonly blockedByDefenderId: string | null;
  readonly flightSeconds: number;
  /** A one-line account of the shot, for the trace and the dev HUD. */
  readonly detail: string;
};

export type ShotEvent = {
  readonly resolution: ShotResolution;
  /** The world after the ball has travelled and the keeper has reacted. */
  readonly state: HandballState;
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

/** Hard bound on a shot's flight, so a pathological speed cannot stall the loop. */
const MAX_SHOT_FLIGHT_STEPS = 40;

/**
 * MATCH-EXPERIENCE-2.0 M9: a shot is a decision and a contest, not a roll.
 *
 *   SHOOTER PERCEIVES -> SELECTS SHOT -> KEEPER READS AND COMMITS
 *     -> BALL TRAVELS -> KEEPER REACTS -> GOAL / SAVE / MISS / BLOCK
 *
 * The old model drew two probabilities -- on target, then saved -- from
 * distance, angle and pressure. Nothing was ever aimed anywhere, so there was
 * no goal mouth to beat and no keeper to beat it past; his position entered as
 * a term that never changed, because he never moved.
 *
 * Now the shooter aims at a POINT chosen from the goal the keeper has actually
 * left open, the keeper commits to a side and a height from that same
 * geometry, the ball is flown across the court by the ordinary fixed step
 * while the keeper dives, and the result is read off where the ball crossed
 * against where he got to.
 *
 * THE RNG NEVER DECIDES THE OUTCOME. It perturbs the inputs -- which option
 * the shooter picks between close-scored ones, how far his execution strays
 * from where he aimed, which way the keeper reads it -- and then the contest
 * is pure geometry. There is no save probability anywhere in this file.
 */
export function resolveShot(
  state: HandballState,
  shooter: Player,
  goalSide: AttackingGoalSide,
  rng: PossessionRng,
  ratings: SimulatePossessionInput["ratings"],
  onFlightStep?: (state: HandballState, note: string) => void,
): ShotEvent {
  const goal = goalCentre(goalSide);
  const perception = perceiveShot(state, shooter, goalSide);
  const decision = decideShot(perception, rng, ratings);
  const keeper = goalkeeper(state);

  // The keeper commits as the ball leaves the hand, from the geometry in front
  // of him. He is never shown the target.
  const keeperRead = keeper ? readShot(perception.window, perception.distance, keeper.id, rng, ratings) : null;

  // Execution: where it actually goes, given how hard the shot was to place.
  const shooting = ratingOf(ratings, shooter.id, "shooting");
  const spread = executionSpreadMeters(perception, decision.intention, shooting);
  const landing = shotLanding(decision, sampleError(rng, spread), sampleError(rng, spread * 0.7));

  // A defender close to the line, close to the shooter, can get a hand to it.
  const goalLinePoint: MeterPoint = { x: landing.x, y: goal.y };
  let blockedByDefenderId: string | null = null;
  let blockPoint: MeterPoint | null = null;
  for (const defender of state.players) {
    if (defender.team !== "DEFENSE" || defender.kind !== "FIELD_PLAYER") continue;
    const toShooter = distanceBetween(defender.position, shooter.position);
    if (toShooter > SHOT_LIMITS.blockRangeMeters) continue;
    if (distanceToSegment(defender.position, shooter.position, goalLinePoint) > SHOT_LIMITS.blockLaneMeters) continue;
    // A low shot goes under an arm; a lob goes over everybody.
    if (decision.height === "LOB") continue;
    if (blockedByDefenderId === null || toShooter < distanceBetween(state.players.find((p) => p.id === blockedByDefenderId)!.position, shooter.position)) {
      blockedByDefenderId = defender.id;
      blockPoint = { ...defender.position };
    }
  }

  const target = blockPoint ?? goalLinePoint;
  const flightDistance = distanceBetween(shooter.position, target);
  const flightSeconds = flightDistance / Math.max(1, decision.speedMetersPerSecond);
  const reactionSeconds = keeper ? reactionDelaySeconds(keeper.id, ratings) : 0;

  // BALL TRAVELS. The ordinary fixed step advances the world while it does, so
  // the keeper's dive, the defenders' recovery and everybody else's momentum
  // are all real simulated movement rather than a cut to the result.
  let flying: HandballState = {
    ...state,
    ball: { position: { ...shooter.position }, possessorId: null, status: "LOOSE", flight: null },
  };
  const flightSteps = Math.min(MAX_SHOT_FLIGHT_STEPS, Math.max(1, Math.ceil(flightSeconds / SIMULATION_DT_SECONDS)));
  for (let i = 1; i <= flightSteps; i += 1) {
    const actions: HandballAction[] = [];
    const elapsed = i * SIMULATION_DT_SECONDS;
    if (keeper && keeperRead && elapsed >= reactionSeconds) {
      // He goes where he committed, not where the ball is.
      actions.push({ type: "MOVE", playerId: keeper.id, target: { x: keeperRead.commitX, y: goal.y + (goalSide === "TOP" ? 0.35 : -0.35) } });
    }
    // Orders are still overridden for anybody leaving, but no exchange is
    // completed mid-flight: the keeper is committed to a dive and the shooter
    // is mid-shot, so a swap here would resolve the contest against a player
    // who had just been taken off. A flight lasts under a second; he waits.
    flying = step(flying, { actions: applyExitOrders(flying, actions) }, SIMULATION_DT_SECONDS);
    const t = i / flightSteps;
    flying = {
      ...flying,
      ball: {
        ...flying.ball,
        position: { x: shooter.position.x + (target.x - shooter.position.x) * t, y: shooter.position.y + (target.y - shooter.position.y) * t },
      },
    };
    onFlightStep?.(flying, i === flightSteps ? "the ball reaches the goal line" : "the shot is on its way");
  }

  const keeperAtArrival = keeper ? (flying.players.find((p) => p.id === keeper.id)?.position ?? keeper.position) : null;

  // KEEPER REACTS -> the result, read off the geometry.
  let outcome: ShotResolution["outcome"];
  let contest: SaveContest | null = null;
  let detail: string;
  if (blockedByDefenderId) {
    outcome = "SHOT_MISSED";
    detail = `${decision.intention} blocked by ${blockedByDefenderId} on the way`;
  } else if (!isOnTarget(landing)) {
    outcome = "SHOT_MISSED";
    detail = `${decision.intention} misses: crossed at x=${landing.x.toFixed(2)}, ${landing.height.toFixed(2)}m high`;
  } else if (keeper && keeperRead && keeperAtArrival) {
    contest = attemptSave(
      landing.x,
      landing.height,
      decision.height,
      keeperAtArrival,
      Math.abs(keeperAtArrival.y - goal.y),
      keeperRead,
      keeper.id,
      ratings,
    );
    outcome = contest.saved ? "SHOT_SAVED" : "SHOT_GOAL";
    detail = `${decision.intention} at x=${landing.x.toFixed(2)} (${decision.detail}); keeper ${keeperRead.detail}; ${contest.detail} -> ${contest.saved ? "saved" : "goal"}`;
  } else {
    outcome = "SHOT_GOAL";
    detail = `${decision.intention} into an unguarded goal`;
  }

  return {
    resolution: {
      outcome,
      distance: perception.distance,
      angleQuality: perception.angleQuality,
      pressure: perception.pressure,
      decision,
      landing,
      keeperRead,
      keeperAtArrival,
      contest,
      blockedByDefenderId,
      flightSeconds,
      detail,
    },
    state: flying,
  };
}

export type Disruption = { readonly kind: "TURNOVER" } | { readonly kind: "FOUL"; readonly award: FoulAward };

/**
 * Whether the defence disrupts the carrier this step, and what it was. Read
 * from real proximity.
 *
 * M10: the per-step contact model is unchanged; what changed is that contact
 * which is NOT a clean ball-win is now judged rather than coin-flipped. A
 * defender who holds his ground concedes a free throw; one who wipes out an
 * open run at goal concedes a 7 metre and two minutes.
 */
export function checkDisruption(
  state: HandballState,
  carrier: Player,
  goalSide: AttackingGoalSide,
  rng: PossessionRng,
  ratings: SimulatePossessionInput["ratings"],
): Disruption | null {
  const { distance, defenderId } = nearestDefenderTo(state, carrier.position);
  if (distance > 1.6 || defenderId === null) return null;
  const defending = ratingOf(ratings, defenderId, "defending");
  // Per-step probability, so a carrier held under pressure for longer is
  // genuinely more likely to lose it.
  const disruption = Math.max(0, (1.6 - distance) / 1.6) * (0.004 + (defending - DEFAULT_RATING) * 0.0004);
  if (!rng.chance(disruption)) return null;
  // Either he took the ball cleanly, or he fouled -- and if he fouled, the
  // situation says what kind of foul it was.
  if (!rng.chance(0.55)) return { kind: "TURNOVER" };
  const defender = state.players.find((p) => p.id === defenderId)!;
  return { kind: "FOUL", award: judgeFoul(state, carrier, defender, goalSide, state.simulationTime) };
}

/** Bound on the walk into a 7m formation, so a dead ball can never stall the loop. */
const MAX_SEVEN_METRE_SETUP_STEPS = 200;

/**
 * A 7 metre throw: the dead ball, the walk into position, and the shot.
 *
 * It is NOT a separate penalty model. Everybody walks into a legal 7m
 * formation through the ordinary fixed step -- taker on the mark, keeper on
 * his line, everyone else outside the free-throw line and three metres clear
 * -- and then the SAME M9 contest resolves it: the taker reads the goal the
 * keeper has left him, the keeper reads it back, the ball flies, and the
 * result is the gap against the reach.
 */
export function takeSevenMetre(
  state: HandballState,
  takerId: string,
  goalSide: AttackingGoalSide,
  rng: PossessionRng,
  ratings: SimulatePossessionInput["ratings"],
  onStep: (state: HandballState, note: string) => void,
): ShotEvent {
  let handball = state;
  for (let i = 0; i < MAX_SEVEN_METRE_SETUP_STEPS; i += 1) {
    if (sevenMetreReady(handball, takerId, goalSide)) break;
    const actions: HandballAction[] = handball.players.map((player) => ({
      type: "MOVE" as const,
      playerId: player.id,
      target: sevenMetreFormationTarget(player, takerId, goalSide),
    }));
    handball = stepWithSubstitutions(handball, actions, SIMULATION_DT_SECONDS);
    // The taker carries the ball to the mark.
    const taker = handball.players.find((p) => p.id === takerId);
    if (taker) handball = { ...handball, ball: { position: { ...taker.position }, possessorId: takerId, status: "POSSESSED", flight: null } };
  }
  const taker = handball.players.find((p) => p.id === takerId);
  if (!taker) {
    // Nobody to take it: give the ball back rather than inventing a shooter.
    return { resolution: { outcome: "SHOT_MISSED" } as ShotResolution, state: handball };
  }
  onStep(handball, `7m: ${takerId} on the mark, everybody clear`);
  return resolveShot(handball, taker, goalSide, rng, ratings, onStep);
}

/** A defender inside this distance of the passing lane can get a hand to the ball. */
const INTERCEPT_RANGE_METERS = 1.2;

export type PassResolution = { readonly kind: "COMPLETE" } | { readonly kind: "INTERCEPTED"; readonly defenderId: string } | { readonly kind: "TECHNICAL_ERROR" };

/**
 * Whether a pass the carrier has decided on actually reaches its receiver.
 *
 * M6 NEEDS THIS. Before M6 the carrier drove into the defence and stood in
 * contact, which is where the per-step disruption model won the ball. A
 * carrier who reads a closed gap and passes off never stands in contact, so
 * without a pass model an organized attack could not lose the ball at all --
 * TURNOVER would vanish from the possession's outcome space and every
 * transition in a match would follow a save. Two ways a pass fails, both read
 * from the state at the moment of the pass: a defender close enough to the
 * lane intercepts it (his ball-winning rating counts), or the passer, under
 * the pressure he is actually under, makes a technical error (his passing
 * rating counts). Nothing here is scripted or chosen ahead of the state.
 */
export function resolvePass(
  state: HandballState,
  passer: Player,
  receiver: Player,
  rng: PossessionRng,
  ratings: SimulatePossessionInput["ratings"],
): PassResolution {
  const from = passer.position;
  const to = receiver.position;
  const length = distanceBetween(from, to);
  for (const defender of state.players) {
    if (defender.team !== "DEFENSE" || defender.kind !== "FIELD_PLAYER") continue;
    // A defender on top of either end is pressure, not a lane.
    if (distanceBetween(defender.position, from) < 0.8 || distanceBetween(defender.position, to) < 0.8 || length < 1.6) continue;
    const lane = distanceToLane(defender.position, from, to);
    if (lane >= INTERCEPT_RANGE_METERS) continue;
    const defending = ratingOf(ratings, defender.id, "defending");
    const interception = 0.25 * (1 - lane / INTERCEPT_RANGE_METERS) * (1 + 0.03 * (defending - DEFAULT_RATING));
    if (rng.chance(Math.max(0, interception))) return { kind: "INTERCEPTED", defenderId: defender.id };
  }
  const pressure = Math.max(0, Math.min(1, 1 - nearestDefenderTo(state, from).distance / 4));
  const passing = ratingOf(ratings, passer.id, "passing");
  const error = 0.008 + 0.01 * pressure - 0.001 * (passing - DEFAULT_RATING);
  return rng.chance(Math.max(0, error)) ? { kind: "TECHNICAL_ERROR" } : { kind: "COMPLETE" };
}

function distanceToLane(p: MeterPoint, a: MeterPoint, b: MeterPoint): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-9) return distanceBetween(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2));
  return distanceBetween(p, { x: a.x + abx * t, y: a.y + aby * t });
}

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------

/** How long a receiver holds the ball before deciding, in fixed steps (0.2-0.6s). */
const HOLD_MIN_STEPS = 4;
const HOLD_MAX_STEPS = 12;
/** The pivot decides faster: he is on the line with a defender on his back. */
const PIVOT_HOLD_MAX_STEPS = 5;
/** While driving at a gap the carrier re-reads the defence this often (0.3s). */
const DRIVE_REEVALUATE_STEPS = 6;
/** How often organized shape is re-asserted for players off their spot. */
const SHAPE_REFRESH_STEPS = 10;
/** Within this distance of the goal a drive has "arrived" whatever its intent says. */
const ARRIVAL_GOAL_DISTANCE_METERS = 8;

function positionsOf(state: HandballState): PossessionTraceEntry["playerPositions"] {
  return state.players.map((p) => ({ playerId: p.id, position: { ...p.position } }));
}

/**
 * Runs one organized possession to a terminal outcome and returns the trace
 * that produced it. Pure: identical inputs always give an identical result.
 */
export function simulatePossession(input: SimulatePossessionInput): PossessionResult {
  const rng = createPossessionRng(input.seed);
  const maxSteps = input.maxSteps ?? MAX_POSSESSION_STEPS;
  const goalSide = input.initialState.possession.attackingGoalSide;
  const goal = goalCentre(goalSide);
  const ratings = input.ratings;
  const tactics = resolveAttackTactics(input.tactics);

  let handball = input.initialState.handball;
  let phase: PossessionPhase = "ORGANIZED_SETUP";
  // Tracked separately from `phase` so the loop's terminal check does not
  // depend on control-flow narrowing of an assignment made inside the branch
  // chain below.
  let completed = false;
  let outcome: PossessionOutcome | null = null;
  let resolvingPlayerId: string | null = null;
  let shotOrigin: MeterPoint | null = null;
  const trace: PossessionTraceEntry[] = [];

  let passesMade = 0;
  let resets = 0;
  let lastPasserId: string | null = null;
  let trackedCarrierId: string | null = handball.ball.possessorId;
  let nextDecisionStep = 0;
  let nextReevaluateStep = 0;
  let drivingGapId: AttackGapId | null = null;
  let reshapeOnReception = false;
  let steps = 0;
  let guardTripped = false;
  let lastPrimaryDefenderId: string | null = null;
  let lastDefenceSummary: string | null = null;
  const fouls: FoulAward[] = [];
  let sevenMetreTaken = false;

  function record(note: string, decision?: AttackDecision): void {
    trace.push({
      simulationTime: Number(handball.simulationTime.toFixed(4)),
      phase,
      ballPossessorId: handball.ball.possessorId,
      ballStatus: handball.ball.status,
      ballPosition: { ...handball.ball.position },
      playerPositions: positionsOf(handball),
      primaryDefenderId: lastPrimaryDefenderId,
      note,
      ...(decision ? { decision } : {}),
    });
  }

  // Read through a function so control-flow narrowing (which cannot see the
  // assignments made inside applyDecision) does not exclude phases the closure
  // legitimately sets.
  function phaseIs(candidate: PossessionPhase): boolean {
    return phase === candidate;
  }

  function holdFor(player: Player): number {
    return rng.nextInt(HOLD_MIN_STEPS, player.role === "PIVOT" ? PIVOT_HOLD_MAX_STEPS : HOLD_MAX_STEPS);
  }

  /** MOVE commands that bring every off-spot attacker back into organized shape. */
  function shapeActions(state: HandballState, exceptId: string | null, force: boolean): HandballAction[] {
    const actions: HandballAction[] = [];
    for (const player of fieldAttackers(state)) {
      if (player.id === exceptId) continue;
      const target = organizedShapeTargetFor(player, state, goalSide, tactics);
      if (!target) continue;
      // Do not re-issue an order a player is already carrying out.
      if (!force && player.intent.type === "MOVE" && !player.intent.completed && distanceBetween(player.intent.target, target) < 0.3) continue;
      actions.push({ type: "MOVE", playerId: player.id, target });
    }
    return actions;
  }

  /** Applies the carrier's decision as ordinary engine commands. */
  function applyDecision(decision: AttackDecision, carrier: Player, actions: HandballAction[]): void {
    const chosen = decision.chosen;
    switch (chosen.kind) {
      case "PASS":
      case "PLAY_PIVOT":
      case "RESET": {
        const receiver = findPlayer(handball, chosen.targetPlayerId ?? null);
        const resolution = receiver ? resolvePass(handball, carrier, receiver, rng, ratings) : ({ kind: "COMPLETE" } as const);
        if (resolution.kind !== "COMPLETE") {
          outcome = "TURNOVER";
          resolvingPlayerId = carrier.id;
          phase = "RESOLUTION";
          record(
            resolution.kind === "INTERCEPTED"
              ? `${resolution.defenderId} intercepts the pass from ${describeAttacker(carrier)} -> TURNOVER`
              : `${describeAttacker(carrier)} loses the ball on a technical error -> TURNOVER`,
          );
          break;
        }
        actions.push({ type: "PASS", fromPlayerId: carrier.id, toPlayerId: chosen.targetPlayerId! });
        lastPasserId = carrier.id;
        drivingGapId = null;
        if (chosen.kind === "RESET") {
          // The attack starts again: patience is restored (a little less each
          // time), so the next carrier circulates before the next action.
          resets += 1;
          passesMade = 0;
          reshapeOnReception = true;
        } else {
          passesMade += 1;
        }
        phase = "CIRCULATION";
        break;
      }
      case "ATTACK_GAP": {
        actions.push({ type: "ATTACK", playerId: carrier.id, gapId: chosen.gapId!, target: chosen.target });
        drivingGapId = chosen.gapId!;
        nextReevaluateStep = steps + DRIVE_REEVALUATE_STEPS;
        phase = "ATTACK_ACTION";
        break;
      }
      case "CONTINUE": {
        // A take-on re-aims the drive beside the defender who stepped out; an
        // open drive simply carries on toward the same point.
        if (chosen.target && (carrier.intent.type !== "ATTACK" || distanceBetween(carrier.intent.target, chosen.target) > 0.3)) {
          actions.push({ type: "ATTACK", playerId: carrier.id, gapId: chosen.gapId!, target: chosen.target });
        }
        nextReevaluateStep = steps + DRIVE_REEVALUATE_STEPS;
        break;
      }
      case "SHOOT": {
        shotOrigin = { ...carrier.position };
        record(`${describeAttacker(carrier)} shoots from ${distanceBetween(carrier.position, goal).toFixed(2)}m`);
        const event = resolveShot(handball, carrier, goalSide, rng, ratings, (flying, note) => {
          handball = flying;
          record(note);
        });
        handball = event.state;
        const shot = event.resolution;
        outcome = shot.outcome;
        resolvingPlayerId = carrier.id;
        phase = "RESOLUTION";
        record(`${describeAttacker(carrier)}: ${shot.detail}`);
        break;
      }
    }
  }

  record("possession begins: organized 6v6 in full-court space");

  while (!completed && steps < maxSteps) {
    const actions: HandballAction[] = [];
    const carrier = findPlayer(handball, handball.ball.possessorId);

    if (phase === "ORGANIZED_SETUP") {
      // The defence needs a home shape to step out of and recover to; after a
      // change of possession it has none, so the canonical 6:0 is established
      // here. Attackers re-establish organized width AND depth from FIELD's
      // canonical roles; the pivot takes his spot on the actual line.
      handball = ensureSixZeroHomePositions(handball, defendedGoalSide(goalSide));
      actions.push(...shapeActions(handball, null, true));
      if (carrier) nextDecisionStep = steps + holdFor(carrier);
      phase = "CIRCULATION";
      record(`attack is set; ${actions.length} players take up organized shape`);
    } else if ((phaseIs("CIRCULATION") || phaseIs("ATTACK_ACTION")) && carrier && handball.ball.status === "POSSESSED") {
      if (carrier.id !== trackedCarrierId) {
        // Reception. The new carrier holds for a moment before deciding; after
        // a reset the whole attack re-forms around him.
        trackedCarrierId = carrier.id;
        nextDecisionStep = steps + holdFor(carrier);
        drivingGapId = null;
        phase = "CIRCULATION";
        if (reshapeOnReception) {
          reshapeOnReception = false;
          actions.push(...shapeActions(handball, carrier.id, true));
          record(`${describeAttacker(carrier)} receives; the attack re-forms`);
        } else {
          record(`${describeAttacker(carrier)} receives`);
        }
      }

      const disruption = checkDisruption(handball, carrier, goalSide, rng, ratings);
      if (disruption?.kind === "TURNOVER") {
        outcome = "TURNOVER";
        resolvingPlayerId = carrier.id;
        phase = "RESOLUTION";
        record(`${disruption.kind === "TURNOVER" ? "defensive pressure" : ""} on ${describeAttacker(carrier)} forces TURNOVER`);
      } else if (disruption?.kind === "FOUL") {
        const award = disruption.award;
        fouls.push(award);
        record(`FOUL: ${award.reason} -> ${award.restart === "SEVEN_METRE" ? "7 metres" : "free throw"}${award.suspend ? " and two minutes" : ""}`);
        if (award.restart === "SEVEN_METRE") {
          // Dead ball, then the throw itself -- resolved by the M9 contest.
          sevenMetreTaken = true;
          const event = takeSevenMetre(handball, carrier.id, goalSide, rng, ratings, (flying, note) => {
            handball = flying;
            record(note);
          });
          handball = event.state;
          outcome = event.resolution.outcome;
          resolvingPlayerId = carrier.id;
          shotOrigin = { ...sevenMetreMark(goalSide) };
          phase = "RESOLUTION";
          record(`7m: ${event.resolution.detail ?? outcome}`);
        } else {
          outcome = "FREE_THROW";
          resolvingPlayerId = carrier.id;
          phase = "DEAD_BALL";
        }
      } else if (phaseIs("CIRCULATION") && steps >= nextDecisionStep) {
        const decision = decideAttackAction({
          state: handball,
          goalSide,
          carrier,
          trigger: "SETTLED",
          drivingGapId: null,
          passesMade,
          resets,
          possessionSeconds: handball.simulationTime - input.initialState.handball.simulationTime,
          lastPasserId,
          ratings,
          tactics,
          rng,
        });
        record(describeDecision(decision, handball), decision);
        applyDecision(decision, carrier, actions);
      } else if (phaseIs("ATTACK_ACTION")) {
        const distance = distanceBetween(carrier.position, goal);
        const arrived =
          carrier.intent.type !== "ATTACK" || carrier.intent.completed || distance <= ARRIVAL_GOAL_DISTANCE_METERS;
        if (arrived || steps >= nextReevaluateStep) {
          // The drive is re-read from the defence's ACTUAL reaction: the
          // defender who stepped out is found on the carrier's path, not
          // assumed, and the next action follows from that.
          const decision = decideAttackAction({
            state: handball,
            goalSide,
            carrier,
            trigger: arrived ? "ARRIVED" : "DRIVE_REEVALUATION",
            drivingGapId,
            passesMade,
            resets,
            possessionSeconds: handball.simulationTime - input.initialState.handball.simulationTime,
            lastPasserId,
            ratings,
            tactics,
            rng,
          });
          // A quiet "still open, keep going" is not worth a trace entry; every
          // change of plan -- and every take-on -- is.
          if (decision.chosen.kind !== "CONTINUE" || decision.blockedBy) {
            const prefix = decision.blockedBy
              ? `${decision.blockedBy} steps out and closes ${drivingGapId} for ${describeAttacker(carrier)} -> `
              : arrived
                ? `${describeAttacker(carrier)} completes his drive (pressure ${decision.pressure.toFixed(2)}) -> `
                : "";
            record(`${prefix}${describeDecision(decision, handball)}`, decision);
          }
          applyDecision(decision, carrier, actions);
        }
      }

      // Everyone else keeps or recovers organized shape; the pivot follows the
      // line as it moves.
      if (!completed && steps % SHAPE_REFRESH_STEPS === 0) {
        actions.push(...shapeActions(handball, carrier.id, false));
      }
    } else if (phase === "RESOLUTION" || phase === "DEAD_BALL") {
      phase = "COMPLETE";
      completed = true;
      record(`possession complete: ${outcome}`);
      break;
    }

    if (completed) break;
    // A resolution recorded this step completes on the next iteration without
    // advancing the world further.
    if (phase === "RESOLUTION" || phase === "DEAD_BALL") continue;

    // M9: the goalkeeper plays too, and he tracks the ball EVERY step. Giving
    // him a new target only twice a second left him chronically behind the
    // ball's lateral movement, and since the open goal is barely a metre wide
    // that lag was enough to skew which side of him was open on every shot in
    // the match.
    const trackingKeeper = goalkeeper(handball);
    if (trackingKeeper) {
      actions.push({
        type: "MOVE",
        playerId: trackingKeeper.id,
        target: goalkeeperSetPosition(handball.ball.position, goalSide, ratings, trackingKeeper.id),
      });
    }

    // Defence reacts to the situation the attack has actually created, then a
    // single fixed timestep advances every player and the ball. M7: the
    // reaction is kept on the state so responsibility and pivot marking carry
    // hysteresis from one step to the next (handover only when an attacker
    // really crosses a zone), and the collective assignment is traced
    // whenever it changes.
    const reaction = evaluateSixZeroDefense(handball, { ratings });
    if (reaction.primaryDefenderId !== lastPrimaryDefenderId) {
      lastPrimaryDefenderId = reaction.primaryDefenderId;
      record(`defensive responsibility -> ${reaction.primaryDefenderId ?? "none"}`);
    }
    if (reaction.summary !== lastDefenceSummary) {
      lastDefenceSummary = reaction.summary;
      record(`defence: ${reaction.summary}`);
    }
    actions.push(...reaction.actions);
    handball = { ...handball, defense: { ...handball.defense, lastReaction: reaction } };

    handball = stepWithSubstitutions(handball, actions, SIMULATION_DT_SECONDS);
    steps += 1;
  }

  if (!completed) {
    guardTripped = true;
    outcome = "TURNOVER";
    resolvingPlayerId = handball.ball.possessorId;
    phase = "COMPLETE";
    record(`max-step guard (${maxSteps}) reached; terminating deterministically as TURNOVER`);
  }

  // M11: a possession can end on the very step a man reaches his substitution
  // area -- through a shot, a turnover or a dead ball -- and those last phases
  // record no further step. Settling once more here means the exchange still
  // lands the instant he arrives instead of waiting for the next segment.
  handball = settleArrivedExchanges(handball);

  const keeper = goalkeeper(handball);
  return {
    outcome: outcome ?? "TURNOVER",
    finalState: {
      handball,
      possession: { ...input.initialState.possession, phase: "COMPLETE", outcome: outcome ?? "TURNOVER" },
    },
    trace,
    resolvingPlayerId,
    goalkeeperId: shotOrigin ? (keeper?.id ?? null) : null,
    shotOrigin,
    steps,
    guardTripped,
    fouls,
    sevenMetreTaken,
  };
}

// ---------------------------------------------------------------------------
// Match event derivation -- AFTER the simulation, never before it
// ---------------------------------------------------------------------------

export type PossessionMatchEvent = {
  readonly type: PossessionOutcome;
  readonly attackingTeam: "ATTACK" | "DEFENSE";
  readonly attackingGoalSide: "TOP" | "BOTTOM";
  readonly playerId: string | null;
  readonly goalkeeperId: string | null;
  readonly shotOrigin: MeterPoint | null;
  readonly simulationTime: number;
};

/** Derives the match-level event from a completed possession. The simulation is the cause; this is the effect. */
export function deriveMatchEvent(result: PossessionResult): PossessionMatchEvent {
  return {
    type: result.outcome,
    attackingTeam: result.finalState.possession.attackingTeam,
    attackingGoalSide: result.finalState.possession.attackingGoalSide,
    playerId: result.resolvingPlayerId,
    goalkeeperId: result.goalkeeperId,
    shotOrigin: result.shotOrigin,
    simulationTime: result.finalState.handball.simulationTime,
  };
}
