/**
 * MATCH-EXPERIENCE-2.0 M2: the transition loop, and the continuous sequence
 * that joins an organized possession to the transition it causes.
 *
 * The required dependency, end to end and without reconstruction:
 *
 *   SAVE / TURNOVER
 *     -> possession changes (same ball, same positions, flipped direction)
 *     -> players react (roles and facing switch)
 *     -> defensive retreat (real x/y movement toward their own goal)
 *     -> first wave (outlet, then runners accelerating into open space)
 *     -> the attacking team advances through the full court
 *     -> the transition resolves, or settles into an organized attack
 *
 * Spatial advantage is EARNED: whether a break produces a shot depends on
 * whether a runner is actually clear of the retreating defenders at the moment
 * he arrives, measured from their real positions -- never rolled for.
 *
 * BOTH GOALS ARE DEFENDED. The canonical full-court scenario carries two
 * goalkeepers, one in each goal, so a transition shot at the far end is always
 * faced by that end's keeper and a derived event never reports a null
 * goalkeeper. A keeper keeps his kind and role through a change of possession:
 * his TEAM flips with everyone else's, but he never becomes an outfield player
 * and is never given a running order.
 */
import { SIMULATION_DT_SECONDS } from "./fixedStep";
import { step } from "./engine";
import { createPossessionRng, type PossessionRng } from "./possessionRng";
import { distanceBetween } from "../domain/geometry/coordinates";
import {
  MAX_POSSESSION_STEPS,
  deriveMatchEvent,
  resolveShot,
  simulatePossession,
  type PossessionMatchEvent,
  type PossessionResult,
  type PossessionTraceEntry,
  type SimulatePossessionInput,
} from "./possessionEngine";
import {
  defenceHasRecovered,
  firstWaveTarget,
  leadRunner,
  retreatTarget,
  switchPossession,
} from "./transition";
import {
  changesPossession,
  defendedGoalSide,
  goalCentre,
  type FullCourtMatchState,
  type PossessionOutcome,
  type PossessionPhase,
} from "../domain/match/possession";
import type { MeterPoint } from "../domain/geometry/coordinates";
import type { HandballAction } from "../domain/handball/actions";
import type { HandballState } from "../domain/handball/state";
import type { Player } from "../domain/handball/player";

/** Distance from the target goal at which a clear runner will take his fast-break shot. */
const BREAK_SHOT_RANGE_METERS = 10;
/** A runner is "clear" when the nearest defender is at least this far behind him. */
const CLEAR_OF_DEFENCE_METERS = 3;

export type SimulateTransitionInput = {
  readonly seed: number;
  /** The state produced by switchPossession -- already flipped, never re-formed. */
  readonly initialState: FullCourtMatchState;
  readonly ratings?: SimulatePossessionInput["ratings"];
  readonly maxSteps?: number;
};

export type TransitionResult = {
  readonly outcome: PossessionOutcome;
  readonly finalState: FullCourtMatchState;
  readonly trace: readonly PossessionTraceEntry[];
  readonly resolvingPlayerId: string | null;
  readonly goalkeeperId: string | null;
  readonly shotOrigin: MeterPoint | null;
  readonly steps: number;
  readonly guardTripped: boolean;
};

function positionsOf(state: HandballState): PossessionTraceEntry["playerPositions"] {
  return state.players.map((p) => ({ playerId: p.id, position: { ...p.position } }));
}

function findPlayer(state: HandballState, id: string | null): Player | undefined {
  return id === null ? undefined : state.players.find((p) => p.id === id);
}

function goalkeeperOf(state: HandballState, team: "ATTACK" | "DEFENSE"): Player | undefined {
  return state.players.find((p) => p.team === team && p.kind === "GOALKEEPER");
}

/**
 * Per-step probability that a recovering defender at `distance` metres takes
 * the ball off the breaking carrier. Zero beyond CATCH_RANGE_METERS, rising as
 * he closes.
 */
const CATCH_RANGE_METERS = 1.5;
function catchProbability(distance: number): number {
  if (distance >= CATCH_RANGE_METERS) return 0;
  return ((CATCH_RANGE_METERS - distance) / CATCH_RANGE_METERS) * 0.02;
}

/** Nearest defender to a point, and how far away they are. */
function nearestDefender(state: HandballState, point: MeterPoint): { distance: number; id: string | null } {
  let best = Number.POSITIVE_INFINITY;
  let id: string | null = null;
  for (const d of state.players.filter((p) => p.team === "DEFENSE" && p.kind === "FIELD_PLAYER")) {
    const distance = distanceBetween(d.position, point);
    if (distance < best) {
      best = distance;
      id = d.id;
    }
  }
  return { distance: Number.isFinite(best) ? best : 99, id };
}

/**
 * Runs one transition from a completed possession switch to a terminal outcome.
 * Pure and deterministic for a given seed and starting state.
 */
export function simulateTransition(input: SimulateTransitionInput): TransitionResult {
  const rng = createPossessionRng(input.seed);
  const maxSteps = input.maxSteps ?? MAX_POSSESSION_STEPS;
  const attackingGoal = input.initialState.possession.attackingGoalSide;
  // The defending team defends the goal the attackers are ATTACKING -- not the
  // opposite one. Getting this backwards made the retreat run toward the goal
  // the team had just been defending, so it never left the ball carrier and
  // every break died within a couple of seconds.
  const defendedGoal = defendedGoalSide(attackingGoal);
  const goal = goalCentre(attackingGoal);

  let handball = input.initialState.handball;
  let phase: PossessionPhase = "POSSESSION_CHANGE";
  let completed = false;
  let outcome: PossessionOutcome | null = null;
  let resolvingPlayerId: string | null = null;
  let shotOrigin: MeterPoint | null = null;
  let steps = 0;
  let guardTripped = false;
  let outletMade = false;
  const trace: PossessionTraceEntry[] = [];

  function record(note: string): void {
    trace.push({
      simulationTime: Number(handball.simulationTime.toFixed(4)),
      phase,
      ballPossessorId: handball.ball.possessorId,
      ballStatus: handball.ball.status,
      ballPosition: { ...handball.ball.position },
      playerPositions: positionsOf(handball),
      primaryDefenderId: null,
      note,
    });
  }

  record(`possession changes: ${handball.ball.possessorId} regains, attack now toward the ${attackingGoal} goal`);

  while (!completed && steps < maxSteps) {
    const actions: HandballAction[] = [];
    const carrier = findPlayer(handball, handball.ball.possessorId);

    if (phase === "POSSESSION_CHANGE") {
      // Both teams react at once: the losing side turns and runs for its own
      // goal, the winning side breaks forward. Neither teleports.
      for (const player of handball.players) {
        if (player.kind === "GOALKEEPER") continue;
        if (player.team === "DEFENSE") {
          actions.push({ type: "MOVE", playerId: player.id, target: retreatTarget(player, defendedGoal) });
        } else if (player.id !== carrier?.id) {
          actions.push({ type: "MOVE", playerId: player.id, target: firstWaveTarget(player, attackingGoal) });
        }
      }
      phase = "DEFENSIVE_RETREAT";
      record(`defenders turn and retreat toward the ${defendedGoal} goal; attackers break forward`);
    } else if (phase === "DEFENSIVE_RETREAT") {
      phase = "FIRST_WAVE";
      record("first wave under way");
    } else if (phase === "FIRST_WAVE" && carrier && handball.ball.status === "POSSESSED") {
      const runner = leadRunner(handball, attackingGoal, carrier.id);
      const carrierToGoal = distanceBetween(carrier.position, goal);

      if (!outletMade && runner && distanceBetween(runner.position, goal) < carrierToGoal - 2) {
        // The outlet: a real forward pass to whoever is furthest up the court.
        actions.push({ type: "PASS", fromPlayerId: carrier.id, toPlayerId: runner.id });
        outletMade = true;
        record(`outlet pass from ${carrier.id} to ${runner.id}`);
      } else {
        const { distance: pressure, id: pressuringId } = nearestDefender(handball, carrier.position);
        if (carrierToGoal > BREAK_SHOT_RANGE_METERS && defenceHasRecovered(handball, defendedGoal)) {
          // Checked BEFORE the shot: once the retreat is physically complete
          // the situation is no longer a fast break, however close the carrier
          // happens to be. Testing the shot first meant a set defence could
          // still be beaten by a "break", and ORGANIZED_ATTACK_REACHED was
          // unreachable in 4000 seeds.
          phase = "EARLY_OFFENSE";
          record("defence has recovered goal-side; the break becomes early offense");
        } else if (carrierToGoal <= BREAK_SHOT_RANGE_METERS && pressure >= CLEAR_OF_DEFENCE_METERS) {
          // Genuinely clear, in range: the break has EARNED a shot.
          const shot = resolveShot(handball, carrier, goal, rng, input.ratings);
          outcome = shot.outcome;
          resolvingPlayerId = carrier.id;
          shotOrigin = { ...carrier.position };
          phase = "RESOLUTION";
          record(
            `${carrier.id} breaks clear (nearest defender ${pressure.toFixed(2)}m) and shoots from ${carrierToGoal.toFixed(2)}m -> ${shot.outcome}`,
          );
        } else if (pressuringId && rng.chance(catchProbability(pressure))) {
          // Caught by the retreat. This is a PER-STEP probability that grows as
          // the recovering defender closes, exactly like the organized-attack
          // disruption model -- not a deterministic "within 1.4m ends it",
          // which made every break die the instant a trailing defender was
          // alongside and meant no first wave ever reached the goal.
          const lost = rng.chance(0.5) ? "TURNOVER" : "FREE_THROW";
          outcome = lost;
          resolvingPlayerId = carrier.id;
          phase = lost === "FREE_THROW" ? "DEAD_BALL" : "RESOLUTION";
          record(`${pressuringId} catches ${carrier.id} in transition (${pressure.toFixed(2)}m) -> ${lost}`);
        } else {
          // Keep running at the goal.
          actions.push({ type: "MOVE", playerId: carrier.id, target: firstWaveTarget(carrier, attackingGoal) });
        }
      }
    } else if (phase === "EARLY_OFFENSE") {
      // The fast break did not resolve. Rather than fake a shot, the team
      // simply arrives and settles -- a real handball outcome.
      phase = "ORGANIZED_SETUP";
      record("attack settles into an organized shape at the opposite end");
    } else if (phase === "ORGANIZED_SETUP") {
      outcome = "ORGANIZED_ATTACK_REACHED";
      resolvingPlayerId = handball.ball.possessorId;
      phase = "COMPLETE";
      completed = true;
      record("transition complete: ORGANIZED_ATTACK_REACHED");
      break;
    } else if (phase === "RESOLUTION" || phase === "DEAD_BALL") {
      phase = "COMPLETE";
      completed = true;
      record(`transition complete: ${outcome}`);
      break;
    }

    if (completed) break;
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

  return {
    outcome: outcome ?? "TURNOVER",
    finalState: {
      handball,
      possession: { ...input.initialState.possession, phase: "COMPLETE", outcome: outcome ?? "TURNOVER" },
    },
    trace,
    resolvingPlayerId,
    goalkeeperId: shotOrigin ? (goalkeeperOf(handball, "DEFENSE")?.id ?? null) : null,
    shotOrigin,
    steps,
    guardTripped,
  };
}

// ---------------------------------------------------------------------------
// The continuous sequence
// ---------------------------------------------------------------------------

export type SequenceResult = {
  /** The organized possession that started it. */
  readonly possession: PossessionResult;
  /** The transition it caused, when the possession changed hands. */
  readonly transition: TransitionResult | null;
  /** ONE continuous trace across both, with no reconstruction between them. */
  readonly trace: readonly PossessionTraceEntry[];
  readonly events: readonly PossessionMatchEvent[];
  readonly finalState: FullCourtMatchState;
};

/**
 * Simulates an organized possession and, when it ends in a save or a turnover,
 * continues STRAIGHT ON into the transition it caused -- same ball, same
 * player positions, opposite direction.
 */
export function simulateSequence(input: SimulatePossessionInput): SequenceResult {
  const possession = simulatePossession(input);
  const events: PossessionMatchEvent[] = [deriveMatchEvent(possession)];

  if (!changesPossession(possession.outcome)) {
    return { possession, transition: null, trace: possession.trace, events, finalState: possession.finalState };
  }

  // Who won the ball: the goalkeeper after a save, otherwise whoever was
  // nearest to it when it was lost. Both are read from the state the
  // possession actually ended in.
  const ended = possession.finalState.handball;
  const keeper = goalkeeperOf(ended, "DEFENSE");
  const nearest = nearestDefender(ended, ended.ball.position);
  const regainingPlayerId =
    possession.outcome === "SHOT_SAVED" ? (keeper?.id ?? nearest.id) : (nearest.id ?? keeper?.id ?? null);
  if (!regainingPlayerId) {
    return { possession, transition: null, trace: possession.trace, events, finalState: possession.finalState };
  }

  const switched = switchPossession(possession.finalState, possession.outcome, regainingPlayerId);
  const transition = simulateTransition({
    // A distinct but derived seed, so the transition is deterministic and
    // never replays the possession's own random sequence.
    seed: (input.seed ^ 0x9e3779b9) >>> 0,
    initialState: switched.state,
    ratings: input.ratings,
    maxSteps: input.maxSteps,
  });
  events.push(deriveMatchEvent(transition as unknown as PossessionResult));

  return {
    possession,
    transition,
    trace: [...possession.trace, ...transition.trace],
    events,
    finalState: transition.finalState,
  };
}
