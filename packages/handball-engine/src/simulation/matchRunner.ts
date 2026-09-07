/**
 * MATCH-EXPERIENCE-2.0 M4: the 2x30 match clock and a complete match.
 *
 * Runs PRE_MATCH -> FIRST_HALF -> HALF_TIME -> SECOND_HALF -> FULL_TIME over
 * the existing continuous engine. No possession engine is created here: this
 * module drives gameFlow's advanceOneSegment and adds only the official clock,
 * the halftime side switch, and match-clock timestamps.
 *
 * TWO CLOCKS, DELIBERATELY NOT CONFLATED.
 *
 *   simulationTime -- the spatial engine's own fixed-step seconds. Real metres
 *     at real speeds; this is what a replay or renderer would play back.
 *   matchClockSeconds -- the official 0..1800 clock within each half, which is
 *     what a score sheet and a UI show.
 *
 * They are not the same, because the micro-simulation resolves an attack faster
 * than a real handball possession takes. M1 circulates two to four passes and
 * shoots, so a possession costs roughly four to eight simulated seconds, while a
 * real possession consumes around thirty seconds of match clock including the
 * dead time the engine does not model (walking back, referee, setting up). Left
 * 1:1 a match would contain many hundreds of possessions and an absurd
 * scoreline, so official time advances by:
 *
 *   matchClockDelta = simulatedSeconds * MATCH_PACING_FACTOR
 *
 * This is an explicit, deterministic pacing constant, NOT calibration. It is
 * the smallest model that produces a plausible cadence, and it is expected to
 * be replaced by richer possession behaviour (longer circulation, real dead
 * time) rather than tuned. Final statistical calibration is out of M4's scope.
 */
import { advanceOneSegment, createGameFlowState, teamOf, type GameFlowSegment, type GameFlowState, type GameFlowTraceEntry, type MatchScore, type MatchTeamId } from "./gameFlow";
import { buildMatchBench } from "../scenarios/matchSquad";
import { createFullCourt6v6State } from "../scenarios/fullCourt6v6";
import { switchPossession } from "./transition";
import type { SimulatePossessionInput } from "./possessionEngine";
import type { AttackTactics } from "./organizedAttack";
import type { PossessionMatchEvent } from "./possessionEngine";
import type { FullCourtMatchState, AttackingGoalSide, PossessionOutcome } from "../domain/match/possession";
import type { Player } from "../domain/handball/player";

export const MATCH_PHASES = ["PRE_MATCH", "FIRST_HALF", "HALF_TIME", "SECOND_HALF", "FULL_TIME"] as const;
export type MatchPhase = (typeof MATCH_PHASES)[number];

/** Official length of one half, in match-clock seconds. */
export const HALF_LENGTH_SECONDS = 30 * 60;
export const FULL_TIME_SECONDS = 2 * HALF_LENGTH_SECONDS;

/**
 * How much official match clock one simulated second costs. See the header:
 * an explicit provisional pacing constant, not a calibrated figure.
 */
export { MATCH_PACING_FACTOR } from "./matchClock";
import { MATCH_PACING_FACTOR } from "./matchClock";

/** Hard bound on segments per half, so a clock or pacing error can never hang a match. */
export const MAX_SEGMENTS_PER_HALF = 400;

export type MatchHalf = 1 | 2;

/**
 * A spatial trace entry stamped with official match time.
 *
 * Presentation metadata only -- the simulation is untouched. A renderer needs
 * to know WHEN on the match clock a recorded spatial state belongs, and the
 * underlying simulationTime is preserved alongside it so replay/debugging still
 * has the engine's own clock. Entries within a segment are spread linearly
 * across that segment's match-clock span, which is the smallest honest mapping
 * given the engine resolves an attack faster than official time elapses.
 */
export type MatchTraceEntry = GameFlowTraceEntry & {
  readonly half: MatchHalf;
  /** Seconds within the half. */
  readonly clockSeconds: number;
  /** Seconds since the opening throw-off. */
  readonly matchSeconds: number;
};

export type MatchEventRecord = {
  readonly half: MatchHalf;
  /** Seconds within the half, 0..1800. */
  readonly clockSeconds: number;
  /** Seconds since the opening throw-off, 0..3600 -- what a score sheet shows. */
  readonly matchSeconds: number;
  /** The spatial engine's own time, kept separate for replay/debugging. */
  readonly simulationTime: number;
  readonly team: MatchTeamId;
  readonly attackingGoalSide: AttackingGoalSide;
  readonly outcome: PossessionOutcome;
  readonly event: PossessionMatchEvent;
  readonly scoreAfter: MatchScore;
};

export type MatchResult = {
  readonly phase: MatchPhase;
  readonly halftimeScore: MatchScore;
  readonly finalScore: MatchScore;
  readonly winner: MatchTeamId | "DRAW";
  /** Distinct possessions -- a free-throw continuation or a settled break is the SAME possession, not a new one. */
  readonly totalPossessions: number;
  /** Segments of play, which is always >= totalPossessions. */
  readonly totalSegments: number;
  readonly possessionsByHalf: Readonly<Record<MatchHalf, number>>;
  /** Every event, in order, with official match-clock timestamps. */
  readonly events: readonly MatchEventRecord[];
  readonly segments: readonly (GameFlowSegment & { readonly half: MatchHalf; readonly clockSeconds: number })[];
  /** The underlying spatial trace, stamped with match time but keeping simulationTime too. */
  readonly trace: readonly MatchTraceEntry[];
  readonly finalState: GameFlowState;
  readonly simulationSeconds: number;
  readonly steps: number;
  /** True if a safety bound stopped a half rather than the clock running out. */
  readonly guardTripped: boolean;
};

export type SimulateMatchOptions = {
  /** Which side takes the opening throw-off. The other starts the second half. */
  readonly firstHalfStartingTeam?: MatchTeamId;
  readonly ratings?: SimulatePossessionInput["ratings"];
  /** M6: tactical bias for the organized attack, applied to both sides alike until manager tactics exist. */
  readonly tactics?: Partial<AttackTactics>;
  /** M11: the match squad beyond the starters. A deterministic bench is built when omitted. */
  readonly bench?: Record<MatchTeamId, readonly Player[]>;
};

/** Distinct possessions in a run: continuations share a possession number with the segment they continue. */
function countPossessions(segments: readonly (GameFlowSegment & { half: MatchHalf })[]): number {
  return new Set(segments.map((s) => `${s.half}:${s.possessionNumber}`)).size;
}

function winnerOf(score: MatchScore): MatchTeamId | "DRAW" {
  if (score.HOME > score.AWAY) return "HOME";
  if (score.AWAY > score.HOME) return "AWAY";
  return "DRAW";
}

/**
 * Builds the state a half starts from.
 *
 * Halftime is the one point in a match where a spatial reset is real rather
 * than an artefact -- the teams leave the court and change ends. So the second
 * half legitimately begins from a fresh kickoff shape, with the ENDS SWITCHED:
 * whichever goal a side attacked in the first half, it attacks the other one
 * now. Player identity is unaffected, because HOME/AWAY comes from the flow
 * layer's rosters and never from the situational ATTACK/DEFENSE labels.
 */
function buildHalfStartState(attackingGoalSide: AttackingGoalSide): FullCourtMatchState {
  return createFullCourt6v6State({ attackingGoalSide });
}

type HalfRun = {
  readonly flow: GameFlowState;
  readonly events: readonly MatchEventRecord[];
  readonly segments: readonly (GameFlowSegment & { readonly half: MatchHalf; readonly clockSeconds: number })[];
  readonly trace: readonly MatchTraceEntry[];
  readonly steps: number;
  readonly simulationSeconds: number;
  readonly guardTripped: boolean;
};

/**
 * Plays one half until the official clock reaches HALF_LENGTH_SECONDS.
 *
 * A segment is only STARTED while the clock is still short of the end of the
 * half, and its event timestamp is clamped to the half boundary. So at most one
 * attack straddles the whistle, no event is ever recorded beyond it, and the
 * ordering of events at the boundary stays deterministic.
 */
function playHalf(
  flow: GameFlowState,
  half: MatchHalf,
  seed: number,
  ratings: SimulatePossessionInput["ratings"] | undefined,
  tactics: Partial<AttackTactics> | undefined,
): HalfRun {
  const events: MatchEventRecord[] = [];
  const segments: (GameFlowSegment & { half: MatchHalf; clockSeconds: number })[] = [];
  const trace: MatchTraceEntry[] = [];
  let current = flow;
  let clock = 0;
  let steps = 0;
  let simulationSeconds = 0;
  let segmentIndex = 0;
  let isTransition = false;
  let kind: GameFlowSegment["kind"] = "ORGANIZED";
  let guardTripped = false;

  while (clock < HALF_LENGTH_SECONDS) {
    if (segmentIndex >= MAX_SEGMENTS_PER_HALF) {
      guardTripped = true;
      break;
    }
    // Distinct per half as well as per segment, so the two halves never replay
    // the same random sequence.
    const advance = advanceOneSegment(current, seed ^ (half * 0x85ebca6b), segmentIndex, isTransition, kind, ratings, tactics);
    segmentIndex += 1;
    steps += advance.steps;
    simulationSeconds += advance.simulatedSeconds;

    const clockAfter = Math.min(HALF_LENGTH_SECONDS, clock + advance.simulatedSeconds * MATCH_PACING_FACTOR);
    // Spread this segment's spatial entries across the match-clock span it
    // consumed, so a renderer can place every recorded state on the official
    // clock without the engine having to know anything about presentation.
    const span = clockAfter - clock;
    const count = advance.trace.length;
    advance.trace.forEach((entry, i) => {
      const at = count <= 1 ? clockAfter : clock + (span * i) / (count - 1);
      trace.push({ ...entry, half, clockSeconds: at, matchSeconds: (half - 1) * HALF_LENGTH_SECONDS + at });
    });
    segments.push({ ...advance.segment, half, clockSeconds: clockAfter });
    events.push({
      half,
      clockSeconds: clockAfter,
      matchSeconds: (half - 1) * HALF_LENGTH_SECONDS + clockAfter,
      simulationTime: advance.flow.match.handball.simulationTime,
      team: advance.segment.team,
      attackingGoalSide: advance.segment.attackingGoalSide,
      outcome: advance.segment.outcome,
      event: advance.event,
      scoreAfter: advance.flow.score,
    });

    clock = clockAfter;
    // The runner's clock is the authoritative one -- it is the clamped, official
    // 0..1800 of this half -- so the flow's ledger is synced to it. Two minutes
    // are then always two minutes of the clock a score sheet would show.
    current = { ...advance.flow, matchSeconds: (half - 1) * HALF_LENGTH_SECONDS + clockAfter };
    isTransition = advance.nextIsTransition;
    kind = advance.nextKind;
  }

  return { flow: current, events, segments, trace, steps, simulationSeconds, guardTripped };
}

/**
 * Simulates one complete 2x30 handball match.
 *
 * Deterministic: the same starting state, seed, starting team and ratings
 * always produce the same halftime score, final score, event sequence, event
 * timestamps and final spatial state. Nothing reads a wall clock, so
 * presentation speed can never affect the result, and no scoreline is
 * precomputed -- every goal comes from a simulated SHOT_GOAL.
 */
export function simulateMatch(initialState: FullCourtMatchState, seed: number, options: SimulateMatchOptions = {}): MatchResult {
  const startingTeam = options.firstHalfStartingTeam ?? "HOME";
  const ratings = options.ratings;
  const tactics = options.tactics;

  // HOME is whoever holds the ball in `initialState`; if AWAY is meant to start,
  // the same scenario is used from the other end so the intended side kicks off.
  const firstHalfGoalSide = initialState.possession.attackingGoalSide;
  const firstHalfState = startingTeam === "HOME" ? initialState : buildHalfStartState(firstHalfGoalSide);

  // M11: a match squad, not just the seven who start. The bench is built
  // deterministically around the starters so a dev or test match has somebody
  // to rotate, without careers or the legacy engine being involved.
  const bench = options.bench ?? buildMatchBench(firstHalfState);
  const first = playHalf(createGameFlowState(firstHalfState, 0, bench), 1, seed, ratings, tactics);
  const halftimeScore = first.flow.score;

  // Ends switch AND the throw-off changes hands. createFullCourt6v6State always
  // hands the ball to the same player group, so building the second half with
  // the starting side's new end and then applying the ordinary possession
  // switch gives both at once: the other team kicks off, attacking the goal the
  // starters attacked in the first half.
  const startersSecondHalfGoal: AttackingGoalSide = firstHalfGoalSide === "TOP" ? "BOTTOM" : "TOP";
  const secondHalfBase = buildHalfStartState(startersSecondHalfGoal);
  const openingThrower = secondHalfBase.handball.players.find((p) => p.team === "DEFENSE" && p.kind === "FIELD_PLAYER");
  const secondHalfState = openingThrower
    ? switchPossession(secondHalfBase, "TURNOVER", openingThrower.id).state
    : secondHalfBase;
  // Score, identity AND discipline persist across the interval; only the court
  // does not. A player sent off at 29:00 is still serving his two minutes after
  // the break, so the fresh half state has to give him back up again.
  //
  // M11: the second half starts from the canonical line-up, so anybody who was
  // substituted on in the first half goes back to the bench and the starters
  // come back out. The SQUAD is unchanged; only who is on the court is reset.
  let secondHalfFlow: GameFlowState = {
    ...createGameFlowState(secondHalfState, HALF_LENGTH_SECONDS, bench),
    score: halftimeScore,
    rosters: first.flow.rosters,
    possessionNumber: first.flow.possessionNumber,
    suspensions: first.flow.suspensions,
  };
  // A side is short by however many men it has serving, whoever they are. The
  // suspended player is taken out of the fresh line-up when he is one of the
  // starters; when he is a substitute who was sent off after coming on, a
  // starter stands down in his place and joins the bench. Either way the team
  // is genuinely a man light, which is the point of the punishment.
  for (const suspension of first.flow.suspensions) {
    const players = secondHalfFlow.match.handball.players;
    const onCourt = players.find((p) => p.id === suspension.playerId);
    const standDown =
      onCourt ??
      [...players]
        .filter((p) => p.kind === "FIELD_PLAYER" && teamOf(secondHalfFlow.rosters as Record<MatchTeamId, readonly string[]>, p.id) === suspension.team)
        .sort((a, b) => a.id.localeCompare(b.id))[0];
    if (!standDown) continue;
    secondHalfFlow = {
      ...secondHalfFlow,
      match: {
        ...secondHalfFlow.match,
        handball: { ...secondHalfFlow.match.handball, players: players.filter((p) => p.id !== standDown.id) },
      },
      bench: onCourt
        ? secondHalfFlow.bench
        : { ...secondHalfFlow.bench, [suspension.team]: [...secondHalfFlow.bench[suspension.team], standDown] },
    };
  }

  const second = playHalf(secondHalfFlow, 2, seed, ratings, tactics);

  const events = [...first.events, ...second.events];
  const finalScore = second.flow.score;

  return {
    phase: "FULL_TIME",
    halftimeScore,
    finalScore,
    winner: winnerOf(finalScore),
    totalPossessions: countPossessions([...first.segments, ...second.segments]),
    totalSegments: first.segments.length + second.segments.length,
    possessionsByHalf: { 1: countPossessions(first.segments), 2: countPossessions(second.segments) },
    events,
    segments: [...first.segments, ...second.segments],
    trace: [...first.trace, ...second.trace],
    finalState: second.flow,
    simulationSeconds: first.simulationSeconds + second.simulationSeconds,
    steps: first.steps + second.steps,
    guardTripped: first.guardTripped || second.guardTripped,
  };
}
