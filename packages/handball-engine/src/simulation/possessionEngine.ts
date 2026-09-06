/**
 * MATCH-EXPERIENCE-2.0 M1: the possession loop.
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
 * SCOPE. M1 is an organized attack. It reuses the existing fixed-step
 * integration, the existing MOVE/PASS commands and the existing 6:0 defensive
 * policy unchanged. It does NOT implement waves, retreat, 7m, suspensions or
 * the match clock -- but it runs in full-court space, so those are later
 * behaviours over the same state rather than a replacement of it.
 */
import { SIMULATION_DT_SECONDS } from "./fixedStep";
import { step } from "./engine";
import { createPossessionRng, type PossessionRng } from "./possessionRng";
import { evaluateSixZeroDefense } from "../policies/defense/sixZeroDefensePolicy";
import { organizedShapeTarget } from "./transition";
import { distanceBetween } from "../domain/geometry/coordinates";
import { goalCentre, type FullCourtMatchState, type PossessionOutcome, type PossessionPhase } from "../domain/match/possession";
import type { MeterPoint } from "../domain/geometry/coordinates";
import type { HandballAction } from "../domain/handball/actions";
import type { Player } from "../domain/handball/player";
import type { HandballState } from "../domain/handball/state";
import type { AttackGapId } from "../domain/geometry/attackGaps";

/**
 * Hard deterministic bound on a single possession. A handball possession is
 * seconds long; this is far above any legitimate one and exists so a logic
 * error can never hang the simulation. Reaching it is a defect, and the
 * possession terminates as a TURNOVER so callers always get a valid outcome.
 */
export const MAX_POSSESSION_STEPS = 2400; // 120 simulated seconds at dt = 0.05

/** Per-player ratings the resolution reads. 1-20, the same scale the game's attributes use. */
export type PossessionPlayerRatings = {
  /** Finishing quality for an attacker. */
  readonly shooting?: number;
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
};

// ---------------------------------------------------------------------------
// Situation reading -- all of it measured from real state
// ---------------------------------------------------------------------------

function ratingOf(ratings: SimulatePossessionInput["ratings"], playerId: string, key: keyof PossessionPlayerRatings): number {
  return ratings?.[playerId]?.[key] ?? DEFAULT_RATING;
}

/**
 * Outfield attackers only. The full-court scenario carries BOTH goalkeepers, so
 * filtering on team alone would make the attacking team's own keeper -- stood
 * in his goal at the far end -- a legal circulation target, and the attack
 * would casually pass the ball 39 metres backwards.
 */
function attackers(state: HandballState): readonly Player[] {
  return state.players.filter((p) => p.team === "ATTACK" && p.kind === "FIELD_PLAYER");
}

function defenders(state: HandballState): readonly Player[] {
  return state.players.filter((p) => p.team === "DEFENSE" && p.kind === "FIELD_PLAYER");
}

function goalkeeper(state: HandballState): Player | undefined {
  return state.players.find((p) => p.team === "DEFENSE" && p.kind === "GOALKEEPER");
}

function findPlayer(state: HandballState, playerId: string | null): Player | undefined {
  return playerId === null ? undefined : state.players.find((p) => p.id === playerId);
}

/** Distance from the nearest defender -- the pressure the carrier is actually under. */
function nearestDefenderDistance(state: HandballState, point: MeterPoint): { distance: number; defenderId: string | null } {
  let best = Number.POSITIVE_INFINITY;
  let id: string | null = null;
  for (const defender of defenders(state)) {
    const d = distanceBetween(defender.position, point);
    if (d < best) {
      best = d;
      id = defender.id;
    }
  }
  return { distance: Number.isFinite(best) ? best : 99, defenderId: id };
}

/**
 * How square the shooter is to the goal, 0 (from the goal line, no angle) to 1
 * (dead centre). Derived from the shooter's own lateral offset relative to how
 * far out they are, so a wing shooting from the corner is genuinely harder.
 */
function shootingAngleQuality(origin: MeterPoint, goal: MeterPoint): number {
  const lateral = Math.abs(origin.x - goal.x);
  const depth = Math.abs(origin.y - goal.y);
  if (depth <= 0.01) return 0;
  return Math.max(0, Math.min(1, depth / (depth + lateral)));
}

// ---------------------------------------------------------------------------
// Resolution -- every term traceable to the state that produced it
// ---------------------------------------------------------------------------

export type ShotResolution = {
  readonly outcome: Extract<PossessionOutcome, "SHOT_GOAL" | "SHOT_SAVED" | "SHOT_MISSED">;
  readonly distance: number;
  readonly angleQuality: number;
  readonly pressure: number;
  readonly onTargetProbability: number;
  readonly saveProbability: number;
};

/**
 * A deliberately simple, explainable first model. It is NOT a calibrated
 * handball shot model and is not tuned here -- M1 proves the architecture, and
 * every input below is read from the simulated situation rather than assumed.
 */
export function resolveShot(
  state: HandballState,
  shooter: Player,
  goal: MeterPoint,
  rng: PossessionRng,
  ratings: SimulatePossessionInput["ratings"],
): ShotResolution {
  const distance = distanceBetween(shooter.position, goal);
  const angleQuality = shootingAngleQuality(shooter.position, goal);
  const { distance: defenderDistance } = nearestDefenderDistance(state, shooter.position);
  // Pressure rises as the nearest defender closes; 0 at 4m+, 1 when on top of him.
  const pressure = Math.max(0, Math.min(1, 1 - defenderDistance / 4));
  const shooting = ratingOf(ratings, shooter.id, "shooting");

  const onTargetProbability = clamp01(
    0.62 + (shooting - DEFAULT_RATING) * 0.018 + (angleQuality - 0.7) * 0.35 - pressure * 0.22 - Math.max(0, distance - 6) * 0.012,
  );
  if (!rng.chance(onTargetProbability)) {
    return { outcome: "SHOT_MISSED", distance, angleQuality, pressure, onTargetProbability, saveProbability: 0 };
  }

  const keeper = goalkeeper(state);
  const shotStopping = keeper ? ratingOf(ratings, keeper.id, "shotStopping") : DEFAULT_RATING;
  // A keeper further off his line covers more angle; distance to the shot's
  // origin is the simplest honest expression of that in M1.
  const keeperAdvance = keeper ? Math.max(0, 6 - distanceBetween(keeper.position, goal)) : 0;
  const saveProbability = clamp01(
    0.30 + (shotStopping - DEFAULT_RATING) * 0.022 + Math.max(0, distance - 6) * 0.014 - (angleQuality - 0.7) * 0.18 - keeperAdvance * 0.02,
  );

  return {
    outcome: rng.chance(saveProbability) ? "SHOT_SAVED" : "SHOT_GOAL",
    distance,
    angleQuality,
    pressure,
    onTargetProbability,
    saveProbability,
  };
}

function clamp01(value: number): number {
  return Math.max(0.02, Math.min(0.98, value));
}

/** Whether the defence disrupts the carrier this step, and how. Read from real proximity. */
function checkDisruption(
  state: HandballState,
  carrier: Player,
  rng: PossessionRng,
  ratings: SimulatePossessionInput["ratings"],
): Extract<PossessionOutcome, "TURNOVER" | "FREE_THROW"> | null {
  const { distance, defenderId } = nearestDefenderDistance(state, carrier.position);
  if (distance > 1.6 || defenderId === null) return null;
  const defending = ratingOf(ratings, defenderId, "defending");
  // Per-step probability, so a carrier held under pressure for longer is
  // genuinely more likely to lose it.
  const disruption = Math.max(0, (1.6 - distance) / 1.6) * (0.004 + (defending - DEFAULT_RATING) * 0.0004);
  if (!rng.chance(disruption)) return null;
  // A defender who arrives late concedes a free throw rather than winning it.
  return rng.chance(0.55) ? "FREE_THROW" : "TURNOVER";
}

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------

/**
 * Which defensive gap this carrier is driving at, chosen from his own lateral
 * position on the court. Symbolic and defence-relative -- the real spatial
 * target is passed alongside it, so this stays correct at either goal.
 */
function gapForCarrier(carrier: Player): AttackGapId {
  const x = carrier.position.x;
  if (x < 4) return "V1_V2";
  if (x < 8) return "V2_V3";
  if (x < 12) return "V3_H3";
  if (x < 16) return "H3_H2";
  return "H2_H1";
}

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
  const goal = goalCentre(input.initialState.possession.attackingGoalSide);
  const ratings = input.ratings;

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

  // How many passes this possession circulates before looking for its action.
  const passesBeforeAction = rng.nextInt(2, 4);
  let passesMade = 0;
  let steps = 0;
  let guardTripped = false;
  let lastPrimaryDefenderId: string | null = null;

  function record(note: string): void {
    trace.push({
      simulationTime: Number(handball.simulationTime.toFixed(4)),
      phase,
      ballPossessorId: handball.ball.possessorId,
      ballStatus: handball.ball.status,
      ballPosition: { ...handball.ball.position },
      playerPositions: positionsOf(handball),
      primaryDefenderId: lastPrimaryDefenderId,
      note,
    });
  }

  record("possession begins: organized 6v6 in full-court space");

  while (!completed && steps < maxSteps) {
    const actions: HandballAction[] = [];
    const carrier = findPlayer(handball, handball.ball.possessorId);

    if (phase === "ORGANIZED_SETUP") {
      // Re-establish organized WIDTH before circulating. Every other movement
      // target in the engine pulls players toward the goal or the ball, so
      // without this the six roles drift onto the centre line over a match and
      // the attack degenerates into a single file. Only the lateral lane is
      // restored, from FIELD's own canonical formation; depth is left alone.
      let restored = 0;
      for (const player of handball.players) {
        if (player.kind === "GOALKEEPER") continue;
        const target = organizedShapeTarget(player);
        if (!target) continue;
        actions.push({ type: "MOVE", playerId: player.id, target });
        restored += 1;
      }
      phase = "CIRCULATION";
      record(restored > 0 ? `attack is set; ${restored} players recover organized width` : "attack is set; beginning ball circulation");
    } else if (phase === "CIRCULATION" && carrier && handball.ball.status === "POSSESSED") {
      const disruption = checkDisruption(handball, carrier, rng, ratings);
      if (disruption) {
        outcome = disruption;
        resolvingPlayerId = carrier.id;
        phase = disruption === "FREE_THROW" ? "DEAD_BALL" : "RESOLUTION";
        record(`defensive pressure on ${carrier.id} forces ${disruption}`);
      } else if (passesMade >= passesBeforeAction) {
        phase = "ATTACK_ACTION";
        // Drive at the goal. This is an ATTACK command, not a MOVE, because
        // ATTACK is what observeDefensiveThreat promotes to an
        // ACTIVE_ATTACK_THREAT -- i.e. it is what makes the 6:0 policy
        // actually pick a primary defender and react. The gap id names WHICH
        // gap is being attacked (a symbolic, defence-relative choice), while
        // `target` carries the real full-court point, so the same command
        // works at either goal even though ATTACK_GAPS' own default positions
        // are authored against the TOP goal.
        const driveTarget: MeterPoint = {
          x: carrier.position.x + (goal.x - carrier.position.x) * 0.35,
          y: carrier.position.y + (goal.y - carrier.position.y) * 0.45,
        };
        actions.push({ type: "ATTACK", playerId: carrier.id, gapId: gapForCarrier(carrier), target: driveTarget });
        record(`${carrier.id} attacks the ${gapForCarrier(carrier)} gap toward the ${input.initialState.possession.attackingGoalSide} goal`);
      } else {
        // Circulate to a teammate -- a real pass through real ball flight.
        const options = attackers(handball).filter((p) => p.id !== carrier.id);
        if (options.length > 0) {
          const receiver = options[rng.nextInt(0, options.length - 1)];
          actions.push({ type: "PASS", fromPlayerId: carrier.id, toPlayerId: receiver.id });
          passesMade += 1;
          record(`${carrier.id} passes to ${receiver.id}`);
        }
      }
    } else if (phase === "ATTACK_ACTION" && carrier && handball.ball.status === "POSSESSED") {
      const distance = distanceBetween(carrier.position, goal);
      const settled = (carrier.intent.type !== "MOVE" && carrier.intent.type !== "ATTACK") || carrier.intent.completed;
      if (settled || distance <= 9) {
        const shot = resolveShot(handball, carrier, goal, rng, ratings);
        outcome = shot.outcome;
        resolvingPlayerId = carrier.id;
        shotOrigin = { ...carrier.position };
        phase = "RESOLUTION";
        record(
          `${carrier.id} shoots from ${distance.toFixed(2)}m (angle ${shot.angleQuality.toFixed(2)}, pressure ${shot.pressure.toFixed(2)}) -> ${shot.outcome}`,
        );
      }
    } else if (phase === "RESOLUTION" || phase === "DEAD_BALL") {
      phase = "COMPLETE";
      completed = true;
      record(`possession complete: ${outcome}`);
      break;
    }

    if (completed) break;

    // Defence reacts to the situation the attack has actually created, then a
    // single fixed timestep advances every player and the ball.
    const reaction = evaluateSixZeroDefense(handball);
    if (reaction.primaryDefenderId !== lastPrimaryDefenderId) {
      lastPrimaryDefenderId = reaction.primaryDefenderId;
      record(`defensive responsibility -> ${reaction.primaryDefenderId ?? "none"}`);
    }
    actions.push(...reaction.actions);

    handball = step(handball, { actions }, SIMULATION_DT_SECONDS);
    steps += 1;
  }

  if (!completed) {
    guardTripped = true;
    outcome = "TURNOVER";
    resolvingPlayerId = handball.ball.possessorId;
    phase = "COMPLETE";
    record(`max-step guard (${maxSteps}) reached; terminating deterministically as TURNOVER`);
  }

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
