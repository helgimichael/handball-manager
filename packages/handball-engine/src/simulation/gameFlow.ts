/**
 * MATCH-EXPERIENCE-2.0 M3: continuous game flow.
 *
 * M1 simulated one organized possession; M2 turned a regain into one
 * transition. M3 removes the artificial boundary at the end of BOTH: every
 * terminal outcome now has a continuation rule, so play runs on across many
 * possessions from a single full-court state.
 *
 * WHAT IS AND IS NOT NEW HERE. No new match world is introduced. This module
 * owns exactly three things the spatial state genuinely does not carry --
 * the score, stable team identity, and how one outcome leads to the next --
 * and delegates all actual simulation back to simulatePossession and
 * simulateTransition. Organized attack logic is not duplicated: a free throw
 * and a settled break both continue by calling the SAME possession engine.
 *
 * WHY STABLE TEAM IDENTITY IS NEEDED. Player.team is "ATTACK" | "DEFENSE",
 * which by design flips every time possession changes -- it describes a role in
 * the current situation, not who the team is. A score cannot be kept against a
 * label that swaps every possession, so this module resolves each player once
 * to a HOME/AWAY roster and scores against that. The spatial model is untouched.
 */
import { step } from "./engine";
import { SIMULATION_DT_SECONDS } from "./fixedStep";
import { distanceBetween } from "../domain/geometry/coordinates";
import {
  deriveMatchEvent,
  simulatePossession,
  type PossessionMatchEvent,
  type PossessionResult,
  type PossessionTraceEntry,
  type SimulatePossessionInput,
} from "./possessionEngine";
import { simulateTransition } from "./sequenceEngine";
import { switchPossession } from "./transition";
import {
  goalCentre,
  type AttackingGoalSide,
  type FullCourtMatchState,
  type PossessionOutcome,
} from "../domain/match/possession";
import {
  CANONICAL_COURT_LENGTH_METERS,
  CANONICAL_COURT_WIDTH_METERS,
  oppositeGoalSide,
} from "@handball-manager/match-contract";
import type { MeterPoint } from "../domain/geometry/coordinates";
import type { HandballAction } from "../domain/handball/actions";
import type { HandballState } from "../domain/handball/state";
import type { Player } from "../domain/handball/player";

/** Stable identity, unlike Player.team which flips with possession. */
export type MatchTeamId = "HOME" | "AWAY";

export type MatchScore = Readonly<Record<MatchTeamId, number>>;

export type GameFlowState = {
  readonly match: FullCourtMatchState;
  readonly score: MatchScore;
  /** Fixed for the whole run: which players belong to which side. */
  readonly rosters: Readonly<Record<MatchTeamId, readonly string[]>>;
  readonly possessionNumber: number;
};

export type GameFlowTraceEntry = PossessionTraceEntry & {
  readonly possessionNumber: number;
  /** Which side is in possession at this instant. */
  readonly possessionTeam: MatchTeamId;
  readonly attackingGoalSide: AttackingGoalSide;
  readonly score: MatchScore;
};

export type GameFlowLimits = {
  /** Stop after this many possessions have been played. */
  readonly maxPossessions: number;
  /** Stop once total simulated fixed steps reach this. A hard bound on runtime. */
  readonly maxSteps?: number;
};

export type GameFlowSegment = {
  readonly possessionNumber: number;
  readonly team: MatchTeamId;
  readonly attackingGoalSide: AttackingGoalSide;
  readonly kind: "ORGANIZED" | "TRANSITION" | "FREE_THROW_CONTINUATION" | "CENTRE_RESTART";
  readonly outcome: PossessionOutcome;
};

export type GameFlowResult = {
  readonly finalState: GameFlowState;
  readonly score: MatchScore;
  /** One ordered trace across every possession in the run. */
  readonly trace: readonly GameFlowTraceEntry[];
  readonly segments: readonly GameFlowSegment[];
  readonly events: readonly PossessionMatchEvent[];
  readonly possessionsPlayed: number;
  readonly steps: number;
  /** True when a limit stopped the run rather than it finishing naturally. */
  readonly limitReached: boolean;
};

// ---------------------------------------------------------------------------
// Team identity and score
// ---------------------------------------------------------------------------

/** HOME is whoever starts in possession; AWAY is the other side. Fixed for the run. */
export function buildRosters(state: FullCourtMatchState): Record<MatchTeamId, readonly string[]> {
  return {
    HOME: state.handball.players.filter((p) => p.team === "ATTACK").map((p) => p.id),
    AWAY: state.handball.players.filter((p) => p.team === "DEFENSE").map((p) => p.id),
  };
}

export function teamOf(rosters: Record<MatchTeamId, readonly string[]>, playerId: string): MatchTeamId | null {
  if (rosters.HOME.includes(playerId)) return "HOME";
  if (rosters.AWAY.includes(playerId)) return "AWAY";
  return null;
}

/** Which side is currently attacking, resolved through the stable rosters. */
function attackingTeam(state: GameFlowState): MatchTeamId {
  const anyAttacker = state.match.handball.players.find((p) => p.team === "ATTACK");
  return anyAttacker ? (teamOf(state.rosters as Record<MatchTeamId, readonly string[]>, anyAttacker.id) ?? "HOME") : "HOME";
}

export function createGameFlowState(match: FullCourtMatchState): GameFlowState {
  return { match, score: { HOME: 0, AWAY: 0 }, rosters: buildRosters(match), possessionNumber: 1 };
}

// ---------------------------------------------------------------------------
// Centre restart after a goal
// ---------------------------------------------------------------------------

const COURT_CENTRE: MeterPoint = { x: CANONICAL_COURT_WIDTH_METERS / 2, y: CANONICAL_COURT_LENGTH_METERS / 2 };
/** How close the thrower must get to the centre before play restarts. */
const CENTRE_ARRIVAL_METERS = 1.0;
/** Bound on the restart settle, so a restart can never run away. */
const MAX_RESTART_STEPS = 400;

function nearestTo(players: readonly Player[], point: MeterPoint): Player | undefined {
  return [...players].sort(
    (a, b) => distanceBetween(a.position, point) - distanceBetween(b.position, point) || a.id.localeCompare(b.id),
  )[0];
}

/** Where a player waits during a restart: in his own half, in his own lane. */
function restartTarget(player: Player, ownGoalSide: AttackingGoalSide): MeterPoint {
  const own = goalCentre(ownGoalSide);
  const laneX = Math.max(2, Math.min(CANONICAL_COURT_WIDTH_METERS - 2, player.position.x));
  const depth = ownGoalSide === "TOP" ? 12 : CANONICAL_COURT_LENGTH_METERS - 12;
  return { x: laneX, y: player.kind === "GOALKEEPER" ? own.y + (ownGoalSide === "TOP" ? 0.5 : -0.5) : depth };
}

/**
 * A goal has been scored. The conceding team restarts from the centre.
 *
 * Players are NOT teleported into a formation: everyone is given a restart
 * target in their own half and the simulation runs until the thrower actually
 * reaches the centre circle (or the settle bound is hit). The score, the
 * direction flip and the possession change are applied immediately; the
 * spatial recovery is simulated.
 */
function centreRestart(
  state: GameFlowState,
  concedingTeam: MatchTeamId,
  traceSink: (entry: Omit<GameFlowTraceEntry, "possessionNumber" | "possessionTeam" | "score">) => void,
): { state: GameFlowState; steps: number } {
  const previousGoalSide = state.match.possession.attackingGoalSide;
  const newGoalSide = oppositeGoalSide(previousGoalSide);

  // Reuse the M2 possession switch for the role/direction flip, then walk the
  // ball to the centre rather than dropping it there.
  const concedingPlayers = state.match.handball.players.filter(
    (p) => teamOf(state.rosters as Record<MatchTeamId, readonly string[]>, p.id) === concedingTeam && p.kind === "FIELD_PLAYER",
  );
  const thrower = nearestTo(concedingPlayers, COURT_CENTRE);
  if (!thrower) return { state, steps: 0 };

  const switched = switchPossession(state.match, "TURNOVER", thrower.id);
  let handball = switched.state.handball;
  let steps = 0;

  while (steps < MAX_RESTART_STEPS) {
    const carrier = handball.players.find((p) => p.id === thrower.id);
    if (carrier && distanceBetween(carrier.position, COURT_CENTRE) <= CENTRE_ARRIVAL_METERS) break;
    const actions: HandballAction[] = [];
    for (const player of handball.players) {
      if (player.id === thrower.id) {
        actions.push({ type: "MOVE", playerId: player.id, target: COURT_CENTRE });
      } else if (player.kind !== "GOALKEEPER") {
        const ownSide = player.team === "ATTACK" ? previousGoalSide : newGoalSide;
        actions.push({ type: "MOVE", playerId: player.id, target: restartTarget(player, ownSide) });
      }
    }
    handball = step(handball, { actions }, SIMULATION_DT_SECONDS);
    // The ball travels with the thrower.
    const moved = handball.players.find((p) => p.id === thrower.id)!;
    handball = { ...handball, ball: { ...handball.ball, position: { ...moved.position } } };
    steps += 1;
  }

  const restarted: GameFlowState = {
    ...state,
    match: {
      handball,
      possession: {
        attackingTeam: "ATTACK",
        attackingGoalSide: newGoalSide,
        phase: "ORGANIZED_SETUP",
        outcome: null,
      },
    },
  };

  traceSink({
    simulationTime: Number(handball.simulationTime.toFixed(4)),
    phase: "ORGANIZED_SETUP",
    ballPossessorId: handball.ball.possessorId,
    ballStatus: handball.ball.status,
    ballPosition: { ...handball.ball.position },
    playerPositions: handball.players.map((p) => ({ playerId: p.id, position: { ...p.position } })),
    primaryDefenderId: null,
    note: `centre restart: ${concedingTeam} throws off toward the ${newGoalSide} goal`,
    attackingGoalSide: newGoalSide,
  });

  return { state: restarted, steps };
}

// ---------------------------------------------------------------------------
// The continuous runner
// ---------------------------------------------------------------------------

/** Derives a distinct, deterministic seed per segment so no two segments replay the same sequence. */
function segmentSeed(baseSeed: number, index: number): number {
  return (baseSeed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
}

function findGoalkeeper(state: HandballState, team: "ATTACK" | "DEFENSE"): Player | undefined {
  return state.players.find((p) => p.team === team && p.kind === "GOALKEEPER");
}

function nearestDefenderId(state: HandballState, point: MeterPoint): string | null {
  const defenders = state.players.filter((p) => p.team === "DEFENSE" && p.kind === "FIELD_PLAYER");
  return nearestTo(defenders, point)?.id ?? null;
}

/**
 * Runs continuous play from `initialState` until a limit stops it.
 *
 * Deterministic: the same state, seed and limits always produce an identical
 * trace and score. Presentation speed cannot affect it -- nothing here reads a
 * wall clock, and every segment advances by the same fixed timestep.
 */
export function simulateGameSequence(
  initialState: FullCourtMatchState,
  seed: number,
  limits: GameFlowLimits,
  ratings?: SimulatePossessionInput["ratings"],
): GameFlowResult {
  const maxSteps = limits.maxSteps ?? Number.POSITIVE_INFINITY;
  let flow = createGameFlowState(initialState);
  const trace: GameFlowTraceEntry[] = [];
  const segments: GameFlowSegment[] = [];
  const events: PossessionMatchEvent[] = [];
  let steps = 0;
  let segmentIndex = 0;
  let limitReached = false;
  /** The next segment is a transition when the previous outcome handed the ball over mid-play. */
  let nextIsTransition = false;
  let nextKind: GameFlowSegment["kind"] = "ORGANIZED";

  function push(entries: readonly PossessionTraceEntry[], team: MatchTeamId, goalSide: AttackingGoalSide): void {
    for (const entry of entries) {
      trace.push({
        ...entry,
        possessionNumber: flow.possessionNumber,
        possessionTeam: team,
        attackingGoalSide: goalSide,
        score: flow.score,
      });
    }
  }

  while (flow.possessionNumber <= limits.maxPossessions && steps < maxSteps) {
    const team = attackingTeam(flow);
    const goalSide = flow.match.possession.attackingGoalSide;
    const kind = nextKind;

    const result: PossessionResult = nextIsTransition
      ? (simulateTransition({
          seed: segmentSeed(seed, segmentIndex),
          initialState: flow.match,
          ratings,
        }) as unknown as PossessionResult)
      : simulatePossession({ seed: segmentSeed(seed, segmentIndex), initialState: flow.match, ratings });
    segmentIndex += 1;
    steps += result.steps;

    push(result.trace, team, goalSide);
    events.push(deriveMatchEvent(result));
    segments.push({ possessionNumber: flow.possessionNumber, team, attackingGoalSide: goalSide, kind, outcome: result.outcome });

    flow = { ...flow, match: result.finalState };

    // --- continuation rules -------------------------------------------------
    const ended = result.finalState.handball;
    if (result.outcome === "SHOT_GOAL") {
      // A goal may ONLY be added from an actual simulated shot.
      const scorer = result.resolvingPlayerId;
      const scoringTeam = scorer ? teamOf(flow.rosters as Record<MatchTeamId, readonly string[]>, scorer) : team;
      const conceding: MatchTeamId = (scoringTeam ?? team) === "HOME" ? "AWAY" : "HOME";
      flow = {
        ...flow,
        score: { ...flow.score, [(scoringTeam ?? team)]: flow.score[scoringTeam ?? team] + 1 },
      };
      const restart = centreRestart(flow, conceding, (entry) =>
        trace.push({ ...entry, possessionNumber: flow.possessionNumber + 1, possessionTeam: conceding, score: flow.score }),
      );
      steps += restart.steps;
      flow = { ...restart.state, possessionNumber: flow.possessionNumber + 1 };
      nextIsTransition = false;
      nextKind = "CENTRE_RESTART";
    } else if (result.outcome === "SHOT_SAVED" || result.outcome === "SHOT_MISSED") {
      // Both give the ball to the defending goalkeeper: a save is caught, and a
      // miss goes out over the end line for a goalkeeper throw. That is the
      // smallest correct restart the engine already supports -- M3 adds no
      // rebound model.
      const keeper = findGoalkeeper(ended, "DEFENSE");
      const regain = keeper?.id ?? nearestDefenderId(ended, ended.ball.position);
      if (!regain) { limitReached = true; break; }
      flow = { ...flow, match: switchPossession(flow.match, "SHOT_SAVED", regain).state, possessionNumber: flow.possessionNumber + 1 };
      nextIsTransition = true;
      nextKind = "TRANSITION";
    } else if (result.outcome === "TURNOVER") {
      const regain = nearestDefenderId(ended, ended.ball.position) ?? findGoalkeeper(ended, "DEFENSE")?.id ?? null;
      if (!regain) { limitReached = true; break; }
      flow = { ...flow, match: switchPossession(flow.match, "TURNOVER", regain).state, possessionNumber: flow.possessionNumber + 1 };
      nextIsTransition = true;
      nextKind = "TRANSITION";
    } else if (result.outcome === "FREE_THROW") {
      // M1 treated a free throw as terminal. It is not: the SAME attacking team
      // restarts from where the action actually stopped and the possession
      // continues. The possession number does not advance, because this is not
      // a new possession.
      flow = {
        ...flow,
        match: { handball: ended, possession: { ...result.finalState.possession, phase: "ORGANIZED_SETUP", outcome: null } },
      };
      nextIsTransition = false;
      nextKind = "FREE_THROW_CONTINUATION";
    } else {
      // ORGANIZED_ATTACK_REACHED: the break did not resolve, so the same team
      // simply plays on through the organized possession engine.
      flow = {
        ...flow,
        match: { handball: ended, possession: { ...result.finalState.possession, phase: "ORGANIZED_SETUP", outcome: null } },
      };
      nextIsTransition = false;
      nextKind = "ORGANIZED";
    }
  }

  if (flow.possessionNumber > limits.maxPossessions || steps >= maxSteps) limitReached = true;

  return {
    finalState: flow,
    score: flow.score,
    trace,
    segments,
    events,
    possessionsPlayed: Math.min(flow.possessionNumber, limits.maxPossessions),
    steps,
    limitReached,
  };
}
