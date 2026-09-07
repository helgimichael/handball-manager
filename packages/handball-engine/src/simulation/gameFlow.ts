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
import type { AttackTactics } from "./organizedAttack";
import { switchPossession } from "./transition";
import { FOUL_LIMITS, type FoulAward } from "./foulDecision";
import { officialSecondsFor } from "./matchClock";
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

/**
 * MATCH-EXPERIENCE-2.0 M10: a player serving two minutes.
 *
 * The suspended man is REMOVED from the spatial state, and the entity itself is
 * kept here so he can be put back exactly as he was. Nothing about the
 * disadvantage is faked with a modifier: his team plays with five outfield
 * players because there are five outfield players on the court.
 */
export type Suspension = {
  readonly playerId: string;
  readonly team: MatchTeamId;
  /** The player as he left the court, so he can return rather than be rebuilt. */
  readonly player: Player;
  /** When the referee gave it. The two minutes do NOT run from here. */
  readonly awardedAtMatchSeconds: number;
  /**
   * When play restarted and his two minutes actually began. Null while the ball
   * is still dead: a suspension is served in playing time, so the dead ball
   * between the decision and the restart is not part of it.
   */
  readonly startedAtMatchSeconds: number | null;
  /** Official match second at which he may come back on. Null until started. */
  readonly returnsAtMatchSeconds: number | null;
  readonly reason: string;
};

export type GameFlowState = {
  readonly match: FullCourtMatchState;
  readonly score: MatchScore;
  /** Fixed for the whole run: which players belong to which side. */
  readonly rosters: Readonly<Record<MatchTeamId, readonly string[]>>;
  readonly possessionNumber: number;
  /** Official match seconds elapsed. Canonical for suspension expiry. */
  readonly matchSeconds: number;
  /** Players currently off the court serving two minutes. */
  readonly suspensions: readonly Suspension[];
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
  /** M10: fouls the referee gave during this segment. */
  readonly fouls: readonly FoulAward[];
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

export function createGameFlowState(match: FullCourtMatchState, matchSeconds = 0): GameFlowState {
  return { match, score: { HOME: 0, AWAY: 0 }, rosters: buildRosters(match), possessionNumber: 1, matchSeconds, suspensions: [] };
}

// ---------------------------------------------------------------------------
// M10: suspensions -- players genuinely off the court
// ---------------------------------------------------------------------------

/** Where a returning player comes back on: his own substitution line, at halfway. */
export const SUBSTITUTION_LINE: MeterPoint = { x: 0.6, y: CANONICAL_COURT_LENGTH_METERS / 2 };

function withPlayers(state: FullCourtMatchState, players: readonly Player[]): FullCourtMatchState {
  return { ...state, handball: { ...state.handball, players } };
}

/**
 * Sends a player off. He is taken out of the spatial state entirely, and kept
 * on the ledger so he can be restored unchanged.
 */
export function applySuspension(flow: GameFlowState, playerId: string, reason: string): GameFlowState {
  const player = flow.match.handball.players.find((p) => p.id === playerId);
  const team = teamOf(flow.rosters as Record<MatchTeamId, readonly string[]>, playerId);
  if (!player || !team || player.kind === "GOALKEEPER") return flow;
  return {
    ...flow,
    match: withPlayers(flow.match, flow.match.handball.players.filter((p) => p.id !== playerId)),
    suspensions: [
      ...flow.suspensions,
      {
        playerId,
        team,
        player,
        awardedAtMatchSeconds: flow.matchSeconds,
        // Not running yet: it starts when play restarts.
        startedAtMatchSeconds: null,
        returnsAtMatchSeconds: null,
        reason,
      },
    ],
  };
}

/**
 * Play restarts. Every suspension awarded at the preceding dead ball starts
 * running now.
 *
 * The two minutes are served in PLAYING time. Starting them at the moment the
 * referee raised his arm would have the dead ball -- the walk into a 7 metre
 * formation, players trooping back for a free throw -- counting against the
 * offender's punishment, which is not what the rule says.
 */
export function startPendingSuspensions(flow: GameFlowState, atMatchSeconds: number): GameFlowState {
  if (!flow.suspensions.some((s) => s.startedAtMatchSeconds === null)) return flow;
  return {
    ...flow,
    suspensions: flow.suspensions.map((s) =>
      s.startedAtMatchSeconds === null
        ? { ...s, startedAtMatchSeconds: atMatchSeconds, returnsAtMatchSeconds: atMatchSeconds + FOUL_LIMITS.suspensionSeconds }
        : s,
    ),
  };
}

/**
 * Puts back everybody whose two minutes are up, at the substitution line. He
 * re-enters as himself -- the same entity, with his side's current ATTACK or
 * DEFENSE label taken from a team-mate who is still on.
 */
export function expireSuspensions(flow: GameFlowState): { flow: GameFlowState; returned: readonly Suspension[] } {
  // Only a suspension that has actually started can expire.
  const due = flow.suspensions.filter((s) => s.returnsAtMatchSeconds !== null && flow.matchSeconds >= s.returnsAtMatchSeconds);
  if (due.length === 0) return { flow, returned: [] };
  const players = [...flow.match.handball.players];
  for (const suspension of due) {
    const mate = players.find((p) => teamOf(flow.rosters as Record<MatchTeamId, readonly string[]>, p.id) === suspension.team);
    players.push({
      ...suspension.player,
      team: mate?.team ?? suspension.player.team,
      position: { ...SUBSTITUTION_LINE },
      velocity: { x: 0, y: 0 },
      intent: { type: "IDLE" },
    });
  }
  return {
    flow: { ...flow, match: withPlayers(flow.match, players), suspensions: flow.suspensions.filter((s) => !due.includes(s)) },
    returned: due,
  };
}

/** How many outfield players each side currently has on the court. */
export function outfieldCount(flow: GameFlowState, team: MatchTeamId): number {
  return flow.match.handball.players.filter(
    (p) => p.kind === "FIELD_PLAYER" && teamOf(flow.rosters as Record<MatchTeamId, readonly string[]>, p.id) === team,
  ).length;
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
    // The throw-off is taken when the ball is at the centre AND both teams are
    // in their own halves -- which is the actual rule, and was never enforced.
    // Waiting only for the thrower handed the next possession a defence still
    // sprinting home from the goal it had just scored at; measured over thirty
    // possessions, 42% of restart frames faced a "defensive line" spread more
    // than nine metres down the court. M8's extra fast-break goals made that
    // visible rather than causing it.
    const thrownOff =
      carrier !== undefined &&
      distanceBetween(carrier.position, COURT_CENTRE) <= CENTRE_ARRIVAL_METERS &&
      handball.players.every((p) => {
        if (p.kind === "GOALKEEPER") return true;
        const ownSide = p.team === "ATTACK" ? previousGoalSide : newGoalSide;
        return ownSide === "TOP"
          ? p.position.y <= CANONICAL_COURT_LENGTH_METERS / 2 + 0.5
          : p.position.y >= CANONICAL_COURT_LENGTH_METERS / 2 - 0.5;
      });
    if (thrownOff) break;
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
/** One segment of play, plus everything the caller needs to continue from it. */
export type SegmentAdvance = {
  readonly flow: GameFlowState;
  readonly segment: GameFlowSegment;
  readonly trace: readonly GameFlowTraceEntry[];
  readonly event: PossessionMatchEvent;
  readonly steps: number;
  /** Simulated seconds this segment consumed, including any restart settle. */
  readonly simulatedSeconds: number;
  readonly nextIsTransition: boolean;
  readonly nextKind: GameFlowSegment["kind"];
};

/**
 * Runs ONE segment -- an organized possession, a transition, a free-throw
 * continuation or a restart -- and applies its continuation rule.
 *
 * Exported so higher layers (the match runner, and any future clock model) can
 * drive play a segment at a time without duplicating either the possession
 * engine or these continuation rules. simulateGameSequence below is just a loop
 * over this function.
 */
export function advanceOneSegment(
  flow: GameFlowState,
  seed: number,
  segmentIndex: number,
  isTransition: boolean,
  kind: GameFlowSegment["kind"],
  ratings?: SimulatePossessionInput["ratings"],
  tactics?: Partial<AttackTactics>,
): SegmentAdvance {
  // M10: this segment IS the restart. Anybody sent off at the dead ball that
  // preceded it starts his two minutes now, and anybody whose time is already
  // up comes back on before play resumes.
  flow = startPendingSuspensions(flow, flow.matchSeconds);
  const expiry = expireSuspensions(flow);
  const returnedTrace: GameFlowTraceEntry[] = [];
  flow = expiry.flow;

  const team = attackingTeam(flow);
  const goalSide = flow.match.possession.attackingGoalSide;
  const startedAt = flow.match.handball.simulationTime;

  const result: PossessionResult = isTransition
    ? (simulateTransition({ seed: segmentSeed(seed, segmentIndex), initialState: flow.match, ratings }) as unknown as PossessionResult)
    : simulatePossession({ seed: segmentSeed(seed, segmentIndex), initialState: flow.match, ratings, tactics });

  const trace: GameFlowTraceEntry[] = result.trace.map((entry) => ({
    ...entry,
    possessionNumber: flow.possessionNumber,
    possessionTeam: team,
    attackingGoalSide: goalSide,
    score: flow.score,
  }));

  const noteEntry = (note: string, state: GameFlowState): GameFlowTraceEntry => ({
    simulationTime: Number(state.match.handball.simulationTime.toFixed(4)),
    phase: "DEAD_BALL",
    ballPossessorId: state.match.handball.ball.possessorId,
    ballStatus: state.match.handball.ball.status,
    ballPosition: { ...state.match.handball.ball.position },
    playerPositions: state.match.handball.players.map((p) => ({ playerId: p.id, position: { ...p.position } })),
    primaryDefenderId: null,
    note,
    possessionNumber: state.possessionNumber,
    possessionTeam: team,
    attackingGoalSide: goalSide,
    score: state.score,
  });
  for (const back of expiry.returned) {
    returnedTrace.push(noteEntry(`${back.playerId} returns from two minutes; ${back.team} back to full strength`, flow));
  }
  trace.unshift(...returnedTrace);

  const segment: GameFlowSegment = {
    possessionNumber: flow.possessionNumber,
    team,
    attackingGoalSide: goalSide,
    kind,
    outcome: result.outcome,
    fouls: result.fouls ?? [],
  };
  const event = deriveMatchEvent(result);
  // The official clock moves with the simulated seconds this segment consumed,
  // and it moves BEFORE the referee's decisions are applied: the foul happened
  // during this segment, so his two minutes start from the dead ball that ended
  // it, not from the moment the segment began.
  const simulatedSeconds = Math.max(0, result.finalState.handball.simulationTime - startedAt);
  let next: GameFlowState = {
    ...flow,
    match: result.finalState,
    matchSeconds: flow.matchSeconds + officialSecondsFor(simulatedSeconds),
  };

  // M10: the referee's decisions are applied at the dead ball they created.
  for (const foul of result.fouls ?? []) {
    if (!foul.suspend) continue;
    const before = next.match.handball.players.length;
    next = applySuspension(next, foul.defenderId, foul.reason);
    if (next.match.handball.players.length < before) {
      const offenderTeam = teamOf(next.rosters as Record<MatchTeamId, readonly string[]>, foul.defenderId);
      trace.push(
        noteEntry(
          `${foul.defenderId} is suspended for two minutes (${foul.reason}); ${offenderTeam} play short until two minutes of playing time from the restart`,
          next,
        ),
      );
    }
  }
  let steps = result.steps;
  let nextIsTransition = false;
  let nextKind: GameFlowSegment["kind"] = "ORGANIZED";
  // The state play continues FROM is the one after the referee's decisions --
  // not the one the segment ended in. Reading the pre-suspension state here
  // put the sent-off player straight back on the court, and he was then added
  // a second time when his two minutes expired.
  const ended = next.match.handball;

  if (result.outcome === "SHOT_GOAL") {
    // A goal may ONLY be added from an actual simulated shot.
    const scorer = result.resolvingPlayerId;
    const scoringTeam = (scorer ? teamOf(flow.rosters as Record<MatchTeamId, readonly string[]>, scorer) : null) ?? team;
    const conceding: MatchTeamId = scoringTeam === "HOME" ? "AWAY" : "HOME";
    next = { ...next, score: { ...next.score, [scoringTeam]: next.score[scoringTeam] + 1 } };
    const restart = centreRestart(next, conceding, (entry) =>
      trace.push({ ...entry, possessionNumber: next.possessionNumber + 1, possessionTeam: conceding, score: next.score }),
    );
    steps += restart.steps;
    next = { ...restart.state, possessionNumber: next.possessionNumber + 1 };
    nextKind = "CENTRE_RESTART";
  } else if (result.outcome === "SHOT_SAVED" || result.outcome === "SHOT_MISSED") {
    // Both give the ball to the defending goalkeeper: a save is caught, a miss
    // goes out over the end line for a goalkeeper throw. The smallest correct
    // restart the engine already supports -- no rebound model is added.
    const keeper = findGoalkeeper(ended, "DEFENSE");
    const regain = keeper?.id ?? nearestDefenderId(ended, ended.ball.position);
    if (regain) {
      next = { ...next, match: switchPossession(next.match, "SHOT_SAVED", regain).state, possessionNumber: next.possessionNumber + 1 };
      nextIsTransition = true;
      nextKind = "TRANSITION";
    }
  } else if (result.outcome === "TURNOVER") {
    const regain = nearestDefenderId(ended, ended.ball.position) ?? findGoalkeeper(ended, "DEFENSE")?.id ?? null;
    if (regain) {
      next = { ...next, match: switchPossession(next.match, "TURNOVER", regain).state, possessionNumber: next.possessionNumber + 1 };
      nextIsTransition = true;
      nextKind = "TRANSITION";
    }
  } else if (result.outcome === "FREE_THROW") {
    // M1 treated a free throw as terminal. It is not: the SAME attacking team
    // restarts from where the action stopped, so the possession number does not
    // advance -- this is not a new possession.
    next = { ...next, match: { handball: ended, possession: { ...result.finalState.possession, phase: "ORGANIZED_SETUP", outcome: null } } };
    nextKind = "FREE_THROW_CONTINUATION";
  } else {
    // ORGANIZED_ATTACK_REACHED: the break did not resolve, so the same team
    // plays on through the organized possession engine.
    next = { ...next, match: { handball: ended, possession: { ...result.finalState.possession, phase: "ORGANIZED_SETUP", outcome: null } } };
    nextKind = "ORGANIZED";
  }

  return {
    flow: next,
    segment,
    trace,
    event,
    steps,
    simulatedSeconds,
    nextIsTransition,
    nextKind,
  };
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
  tactics?: Partial<AttackTactics>,
): GameFlowResult {
  const maxSteps = limits.maxSteps ?? Number.POSITIVE_INFINITY;
  let flow = createGameFlowState(initialState);
  const trace: GameFlowTraceEntry[] = [];
  const segments: GameFlowSegment[] = [];
  const events: PossessionMatchEvent[] = [];
  let steps = 0;
  let segmentIndex = 0;
  let isTransition = false;
  let kind: GameFlowSegment["kind"] = "ORGANIZED";

  while (flow.possessionNumber <= limits.maxPossessions && steps < maxSteps) {
    const advance = advanceOneSegment(flow, seed, segmentIndex, isTransition, kind, ratings, tactics);
    segmentIndex += 1;
    steps += advance.steps;
    trace.push(...advance.trace);
    segments.push(advance.segment);
    events.push(advance.event);
    flow = advance.flow;
    isTransition = advance.nextIsTransition;
    kind = advance.nextKind;
  }

  return {
    finalState: flow,
    score: flow.score,
    trace,
    segments,
    events,
    possessionsPlayed: Math.min(flow.possessionNumber, limits.maxPossessions),
    steps,
    limitReached: flow.possessionNumber > limits.maxPossessions || steps >= maxSteps,
  };
}
