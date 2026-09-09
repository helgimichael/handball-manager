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
import type { DefensiveSystemId } from "../policies/defense/defensiveSystem";
import { SIMULATION_DT_SECONDS } from "./fixedStep";
import { recoverOnBench } from "./condition";
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
import { SUBSTITUTION_AREA, squadGoalkeeperIds } from "../scenarios/matchSquad";
import { SUBSTITUTION_POLICY, decideSubstitutions, describeSubstitution } from "./substitutionDecision";
import { isLeavingCourt, markLeavingCourt, stepWithSubstitutions, withExchange, withoutExchanges } from "./substitutionExit";
import { createPossessionRng } from "./possessionRng";
import { changeAttackTactics, changeDefenceTactics, describeInstructionDeltas, resolveTeamInstructions, type DefenceTactics, type MatchInstructions } from "./coaching";
import { describeIntervention, type CoachCommand, type CoachController, type CoachView, type InterventionRecord } from "./coach";
import { halfOf } from "./matchClock";
import { resolveTimeoutRules, timeoutAllowed, timeoutsUsed, type TimeoutRecord, type TimeoutRules } from "./timeout";
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

/** MATCH-EXPERIENCE-2.0 M11: one player replaced by another, both real. */
export type SubstitutionRecord = {
  readonly team: MatchTeamId;
  readonly outgoingPlayerId: string;
  readonly incomingPlayerId: string;
  readonly role: Player["role"];
  readonly kind: Player["kind"];
  /** When the change was asked for. */
  readonly requestedAtMatchSeconds: number;
  /** When he actually reached the line and the exchange was made. */
  readonly atMatchSeconds: number;
  /** The spatial instant of the swap, so it can be placed exactly in the trace. */
  readonly atSimulationTime: number;
  readonly reason: string;
};

export type GameFlowState = {
  readonly match: FullCourtMatchState;
  readonly score: MatchScore;
  /** Fixed for the whole run: which players belong to which side. Includes the bench. */
  readonly rosters: Readonly<Record<MatchTeamId, readonly string[]>>;
  readonly possessionNumber: number;
  /** Official match seconds elapsed. Canonical for suspension expiry. */
  readonly matchSeconds: number;
  /** Players currently off the court serving two minutes. */
  readonly suspensions: readonly Suspension[];
  /**
   * M11: squad members who are not on the court and are free to come on. Real
   * player entities, held here rather than in the spatial state -- which is
   * exactly what makes "on court" and "in the squad" different things.
   */
  readonly bench: Readonly<Record<MatchTeamId, readonly Player[]>>;
  /** Official second each player currently on court came on. Starters are 0. */
  readonly onCourtSince: Readonly<Record<string, number>>;
  /**
   * M11: substitutions that have been asked for and not yet made. The outgoing
   * player is still on the court and the incoming one is still on the bench for
   * every second one of these exists.
   */
  readonly pendingSubstitutions: readonly PendingSubstitution[];
  /** Every goalkeeper in either squad, so a substitute keeper is known to be one. */
  readonly goalkeeperIds: readonly string[];
  /**
   * M12: what each coach has told his team. Live, mutable state -- changing it
   * changes how the SAME players read the SAME situations from the next step
   * on, and rebuilds nothing else.
   */
  readonly instructions: MatchInstructions;
  /** M12: timeouts taken so far, and the allowance they count against. */
  readonly timeouts: readonly TimeoutRecord[];
  readonly timeoutRules: TimeoutRules;
  /** M12: the timeout in progress, while the match is stopped. */
  readonly activeTimeout: TimeoutRecord | null;
  /** M12: how each side is going, in the terms a coach reacts to. */
  readonly momentum: Readonly<Record<MatchTeamId, TeamMomentum>>;
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
  /**
   * M21: how many fixed steps this segment actually took.
   *
   * Segments are not separable from the trace -- a free-throw continuation
   * deliberately shares its possession number with the attack it continues --
   * so the only honest way to ask how long a restart takes is to carry it here.
   */
  readonly steps: number;
  /** M10: fouls the referee gave during this segment. */
  readonly fouls: readonly FoulAward[];
  /** M18: contact episodes between a defender and the carrier in this segment. */
  readonly contacts: number;
  /** M19: how many of those episodes were resolved. */
  readonly resolvedContacts: number;
  /** M20: what those resolutions came to. */
  readonly contactNothing: number;
  readonly contactBallWon: number;
  readonly contactIllegal: number;
  readonly contactBallWonDeclined: number;
  /** M11: substitutions taken at the boundary that opened this segment. */
  readonly substitutions: readonly SubstitutionRecord[];
  /** M12: what the coaches did at the boundary that opened this segment. */
  readonly interventions: readonly InterventionRecord[];
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

/** M12: what the coaches bring to the match before it starts. */
export type GameFlowSetup = {
  /** Standing instructions per side. Omitted dials are neutral, which is exactly M6/M7 behaviour. */
  readonly instructions?: Partial<
    Record<
      MatchTeamId,
      { readonly attack?: Partial<AttackTactics>; readonly defence?: Partial<DefenceTactics>; readonly defenceSystem?: DefensiveSystemId }
    >
  >;
  /** Timeout allowance. A competition rule, so it arrives as a value. */
  readonly timeoutRules?: Partial<TimeoutRules>;
};

export function createGameFlowState(
  match: FullCourtMatchState,
  matchSeconds = 0,
  bench: Record<MatchTeamId, readonly Player[]> = { HOME: [], AWAY: [] },
  setup: GameFlowSetup = {},
): GameFlowState {
  const onCourt = buildRosters(match);
  // The squad is who is available, not who happens to be standing on the court.
  const rosters: Record<MatchTeamId, readonly string[]> = {
    HOME: [...onCourt.HOME, ...bench.HOME.map((p) => p.id)],
    AWAY: [...onCourt.AWAY, ...bench.AWAY.map((p) => p.id)],
  };
  const onCourtSince: Record<string, number> = {};
  for (const player of match.handball.players) onCourtSince[player.id] = matchSeconds;
  return {
    match,
    score: { HOME: 0, AWAY: 0 },
    rosters,
    possessionNumber: 1,
    matchSeconds,
    suspensions: [],
    bench,
    onCourtSince,
    pendingSubstitutions: [],
    goalkeeperIds: squadGoalkeeperIds(match, bench),
    instructions: {
      HOME: resolveTeamInstructions(setup.instructions?.HOME),
      AWAY: resolveTeamInstructions(setup.instructions?.AWAY),
    },
    timeouts: [],
    timeoutRules: resolveTimeoutRules(setup.timeoutRules),
    activeTimeout: null,
    momentum: { HOME: NEUTRAL_MOMENTUM, AWAY: NEUTRAL_MOMENTUM },
  };
}

// ---------------------------------------------------------------------------
// M11: substitutions -- a real swap of the spatial population
// ---------------------------------------------------------------------------

/** Outfield players a side is entitled to have on court, given who is suspended. */
export const STARTING_OUTFIELD_PER_TEAM = 6;

export function activeSuspensionCount(flow: GameFlowState, team: MatchTeamId): number {
  return flow.suspensions.filter((s) => s.team === team).length;
}

/**
 * How many outfield players this side may legally have on court right now.
 *
 * This is the number that makes a suspension real: it drops by one for every
 * man serving two minutes, so a team can never substitute its way back to full
 * strength while somebody is off.
 */
export function outfieldEntitlement(flow: GameFlowState, team: MatchTeamId): number {
  return STARTING_OUTFIELD_PER_TEAM - activeSuspensionCount(flow, team);
}

export type SubstitutionRequest = {
  readonly team: MatchTeamId;
  readonly outgoingPlayerId: string;
  readonly incomingPlayerId: string;
  readonly reason: string;
  /**
   * M22: this change is deliberately swapping a goalkeeper for an outfield
   * player, or back. Only a seven-out instruction sets it. Ordinary rotation
   * leaves it unset and stays like-for-like, so a routine change can never
   * empty a goal by accident.
   */
  readonly changesGoalkeeper?: boolean;
};

export type SubstitutionOutcome =
  | { readonly ok: true; readonly flow: GameFlowState }
  | { readonly ok: false; readonly reason: string };

/**
 * A substitution that has been asked for but not yet made.
 *
 * The lifecycle is REQUESTED -> EXITING -> COMPLETE, and this record is the
 * whole of the middle. While it exists the outgoing player is still a real
 * player on the court -- he counts against his side's entitlement, he occupies
 * space, he can be fouled -- and the incoming player is still on the bench.
 * That is precisely what stops an exchange producing a seventh outfield player:
 * at no instant do both of them exist on the court.
 *
 * The COMPLETE step does not happen here. It happens inside the fixed-step loop
 * (see settleArrivedExchanges), on whichever step the outgoing player actually
 * reaches his substitution area, so play never waits for a possession to end.
 * This layer only reconciles the ledgers afterwards -- bench, clock, record.
 */
export type PendingSubstitution = {
  readonly team: MatchTeamId;
  readonly outgoingPlayerId: string;
  readonly incomingPlayerId: string;
  /** The man going off, kept so he can be put on the bench after the court has already swapped him out. */
  readonly outgoing: Player;
  readonly reason: string;
  readonly requestedAtMatchSeconds: number;
};

/**
 * How long a man is given to get to the line before the change is abandoned,
 * in official seconds.
 *
 * A safety net, not a rule. If some future situation ever pins a player where
 * he cannot walk off -- carrying the ball through a long possession, say -- the
 * request lapses and he rejoins his team's shape, rather than his side playing
 * a man short for the rest of the match waiting for a swap that never lands.
 */
export const SUBSTITUTION_EXIT_LIMIT_SECONDS = 120;

/**
 * Asks for a substitution. Nothing about the population changes yet.
 *
 * This is the REQUESTED step. Every legality check the swap will need is made
 * now, at the point the coach decides -- like for like, the incoming man really
 * on the bench and not serving a suspension, the outgoing man really on the
 * court and really this team's -- and the only two things it changes in the
 * world are that the outgoing player starts heading for the substitution area,
 * and that the exchange is put on the spatial state so the step loop can
 * complete it the instant he gets there.
 */
export function requestSubstitution(flow: GameFlowState, request: SubstitutionRequest): SubstitutionOutcome {
  const { team, outgoingPlayerId, incomingPlayerId } = request;
  const outgoing = flow.match.handball.players.find((p) => p.id === outgoingPlayerId);
  if (!outgoing) return { ok: false, reason: `${outgoingPlayerId} is not on the court` };
  if (teamOf(flow.rosters as Record<MatchTeamId, readonly string[]>, outgoingPlayerId) !== team) {
    return { ok: false, reason: `${outgoingPlayerId} does not play for ${team}` };
  }
  if (isLeavingCourt(outgoing)) return { ok: false, reason: `${outgoingPlayerId} is already leaving the court` };
  // One change at a time per side: two men walking off at once would leave a
  // team two short for as long as they both took to get there.
  if (flow.pendingSubstitutions.some((p) => p.team === team)) {
    return { ok: false, reason: `${team} already has a substitution in progress` };
  }
  const incoming = flow.bench[team].find((p) => p.id === incomingPlayerId);
  if (!incoming) return { ok: false, reason: `${incomingPlayerId} is not on ${team}'s bench` };
  if (flow.suspensions.some((s) => s.playerId === incomingPlayerId)) {
    return { ok: false, reason: `${incomingPlayerId} is serving a suspension` };
  }
  if (flow.match.handball.players.some((p) => p.id === incomingPlayerId)) {
    return { ok: false, reason: `${incomingPlayerId} is already on the court` };
  }
  // Like for like: a goalkeeper is replaced by a goalkeeper, and he walks off
  // through the same area as everybody else.
  //
  // M22: unless the change is a deliberate one. Handball has no like-for-like
  // rule -- any player may come on for any player -- but until 7v6 existed the
  // simplification was harmless and it kept ordinary rotation honest. It still
  // does: only a seven-out instruction may cross the kinds, so a routine
  // rotation cannot empty a goal by picking the wrong pair. What can never
  // happen either way is two goalkeepers at once.
  if (outgoing.kind !== incoming.kind && !request.changesGoalkeeper) {
    return { ok: false, reason: `${incomingPlayerId} cannot replace a ${outgoing.kind.toLowerCase()}` };
  }
  if (incoming.kind === "GOALKEEPER" && outgoing.kind !== "GOALKEEPER") {
    const keeperAlready = flow.match.handball.players.some(
      (p) => p.kind === "GOALKEEPER" && teamOf(flow.rosters as Record<MatchTeamId, readonly string[]>, p.id) === team,
    );
    if (keeperAlready) return { ok: false, reason: `${team} already has a goalkeeper on the court` };
  }

  const handball = withExchange(
    { ...flow.match.handball, players: markLeavingCourt(flow.match.handball.players, outgoingPlayerId, true) },
    { outgoingPlayerId, incoming, completedAtSimulationTime: null },
  );
  return {
    ok: true,
    flow: {
      ...flow,
      match: { ...flow.match, handball },
      pendingSubstitutions: [
        ...flow.pendingSubstitutions,
        { team, outgoingPlayerId, incomingPlayerId, outgoing, reason: request.reason, requestedAtMatchSeconds: flow.matchSeconds },
      ],
    },
  };
}

/**
 * Where a stretch of simulation began, so a swap that happened part-way through
 * it can be dated on the official clock.
 */
export type SubstitutionOrigin = {
  readonly simulationTime: number;
  readonly matchSeconds: number;
};

/**
 * Reconciles the bench and the records against exchanges the COURT has already
 * made, and abandons any request that can no longer happen.
 *
 * This does NOT decide when a substitution completes -- the fixed-step hook
 * does, mid-play, the moment the outgoing player reaches the line. By the time
 * this runs the two players have already swapped places in the spatial state;
 * what is left is bookkeeping: put the man who came off on the bench, start the
 * newcomer's clock at the second he actually came on, and emit the record.
 *
 * Called at every segment boundary and again immediately after each stretch of
 * simulation, so a change is never held over.
 */
export function settlePendingSubstitutions(
  flow: GameFlowState,
  origin?: SubstitutionOrigin,
): { flow: GameFlowState; completed: readonly SubstitutionRecord[] } {
  if (flow.pendingSubstitutions.length === 0) return { flow, completed: [] };
  const from = origin ?? { simulationTime: flow.match.handball.simulationTime, matchSeconds: flow.matchSeconds };
  const officialAt = (simulationTime: number): number =>
    from.matchSeconds + officialSecondsFor(Math.max(0, simulationTime - from.simulationTime));

  let players = [...flow.match.handball.players];
  const exchanges = new Map((flow.match.handball.exchanges ?? []).map((exchange) => [exchange.outgoingPlayerId, exchange]));
  const bench = { HOME: [...flow.bench.HOME], AWAY: [...flow.bench.AWAY] };
  const onCourtSince = { ...flow.onCourtSince };
  const pending: PendingSubstitution[] = [];
  const completed: SubstitutionRecord[] = [];
  const finished: string[] = [];

  for (const request of flow.pendingSubstitutions) {
    const exchange = exchanges.get(request.outgoingPlayerId);
    const swappedAt = exchange?.completedAtSimulationTime ?? null;

    if (swappedAt !== null) {
      // COMPLETE. The court did the swap; here we only follow it.
      finished.push(request.outgoingPlayerId);
      const cameOnAt = officialAt(swappedAt);
      bench[request.team] = [
        ...bench[request.team].filter((p) => p.id !== request.incomingPlayerId),
        { ...request.outgoing, leavingCourt: undefined, position: { ...SUBSTITUTION_AREA }, velocity: { x: 0, y: 0 }, intent: { type: "IDLE" } },
      ];
      delete onCourtSince[request.outgoingPlayerId];
      onCourtSince[request.incomingPlayerId] = cameOnAt;
      completed.push({
        team: request.team,
        outgoingPlayerId: request.outgoingPlayerId,
        incomingPlayerId: request.incomingPlayerId,
        role: request.outgoing.role,
        kind: request.outgoing.kind,
        requestedAtMatchSeconds: request.requestedAtMatchSeconds,
        atMatchSeconds: cameOnAt,
        atSimulationTime: swappedAt,
        reason: request.reason,
      });
      continue;
    }

    const outgoing = players.find((p) => p.id === request.outgoingPlayerId);
    // He is not out there any more -- sent off while walking, or half time came.
    // There is nobody to replace, so the change lapses.
    if (!outgoing) {
      finished.push(request.outgoingPlayerId);
      continue;
    }
    // His replacement can no longer come on, so he stops leaving and plays on.
    if (flow.suspensions.some((s) => s.playerId === request.incomingPlayerId)) {
      players = markLeavingCourt(players, outgoing.id, false);
      finished.push(request.outgoingPlayerId);
      continue;
    }
    if (flow.matchSeconds - request.requestedAtMatchSeconds > SUBSTITUTION_EXIT_LIMIT_SECONDS) {
      players = markLeavingCourt(players, outgoing.id, false);
      finished.push(request.outgoingPlayerId);
      continue;
    }
    pending.push(request);
  }

  const handball = withoutExchanges({ ...flow.match.handball, players }, finished);
  return {
    flow: { ...flow, match: { ...flow.match, handball }, bench, onCourtSince, pendingSubstitutions: pending },
    completed,
  };
}

// ---------------------------------------------------------------------------
// M10: suspensions -- players genuinely off the court
// ---------------------------------------------------------------------------

/** Where a returning player comes back on: his own substitution line, at halfway. */
export const SUBSTITUTION_LINE: MeterPoint = SUBSTITUTION_AREA;

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
  const remaining = flow.suspensions.filter((s) => !due.includes(s));
  let players = [...flow.match.handball.players];
  const bench = { HOME: [...flow.bench.HOME], AWAY: [...flow.bench.AWAY] };
  const onCourtSince = { ...flow.onCourtSince };

  for (const suspension of due) {
    const team = suspension.team;
    const onCourtOutfield = players.filter(
      (p) => p.kind === "FIELD_PLAYER" && teamOf(flow.rosters as Record<MatchTeamId, readonly string[]>, p.id) === team,
    ).length;
    const stillServing = remaining.filter((s) => s.team === team).length;
    const entitlement = STARTING_OUTFIELD_PER_TEAM - stillServing;
    if (onCourtOutfield >= entitlement) {
      // M11: his side is already at full permitted strength -- somebody came on
      // in his place while he was off. He rejoins the BENCH, not the court, so
      // serving a suspension can never end up giving a team an extra man.
      bench[team] = [...bench[team], { ...suspension.player, leavingCourt: undefined, position: { ...SUBSTITUTION_AREA }, velocity: { x: 0, y: 0 }, intent: { type: "IDLE" } }];
      continue;
    }
    const mate = players.find((p) => teamOf(flow.rosters as Record<MatchTeamId, readonly string[]>, p.id) === team);
    players = [
      ...players,
      {
        ...suspension.player,
        leavingCourt: undefined,
        team: mate?.team ?? suspension.player.team,
        position: { ...SUBSTITUTION_AREA },
        velocity: { x: 0, y: 0 },
        intent: { type: "IDLE" },
      },
    ];
    onCourtSince[suspension.playerId] = flow.matchSeconds;
  }
  return {
    flow: { ...flow, match: withPlayers(flow.match, players), suspensions: remaining, bench, onCourtSince },
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
    (p) => teamOf(state.rosters as Record<MatchTeamId, readonly string[]>, p.id) === concedingTeam && p.kind === "FIELD_PLAYER" && !isLeavingCourt(p),
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
    handball = stepWithSubstitutions(handball, actions, SIMULATION_DT_SECONDS);
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
// M12: the coach -- timeouts, instructions and personnel, on the live match
// ---------------------------------------------------------------------------

/**
 * How a side's match is going, in the two numbers a coach actually reacts to.
 *
 * Read from real results only: goals scored and possessions played. Nothing
 * here feeds back into how a shot or a pass is resolved -- it exists so a coach
 * can NOTICE something, which is a different thing from it changing anything.
 */
export type TeamMomentum = {
  /** Opponent goals since this side last scored. */
  readonly concededInARow: number;
  /** This side's completed possessions since it last scored. */
  readonly attacksWithoutGoal: number;
};

const NEUTRAL_MOMENTUM: TeamMomentum = Object.freeze({ concededInARow: 0, attacksWithoutGoal: 0 });

function otherTeam(team: MatchTeamId): MatchTeamId {
  return team === "HOME" ? "AWAY" : "HOME";
}

function updateMomentum(
  current: Readonly<Record<MatchTeamId, TeamMomentum>>,
  attackingTeam: MatchTeamId,
  scoringTeam: MatchTeamId | null,
  possessionEnded: boolean,
): Readonly<Record<MatchTeamId, TeamMomentum>> {
  if (scoringTeam) {
    const conceding = otherTeam(scoringTeam);
    return {
      [scoringTeam]: NEUTRAL_MOMENTUM,
      [conceding]: { ...current[conceding], concededInARow: current[conceding].concededInARow + 1 },
    } as Readonly<Record<MatchTeamId, TeamMomentum>>;
  }
  // A free throw or a settled break continues the SAME possession, so only a
  // possession that really ended counts against the attack.
  if (!possessionEnded) return current;
  return {
    ...current,
    [attackingTeam]: { ...current[attackingTeam], attacksWithoutGoal: current[attackingTeam].attacksWithoutGoal + 1 },
  };
}

/** The situation a coach is deciding in, at one segment boundary. */
export type CoachBoundary = {
  readonly kind: GameFlowSegment["kind"];
  readonly possessionTeam: MatchTeamId;
  /**
   * True when the ball is dead and a timeout could legally be granted. In this
   * engine that is a restart after a goal and a free-throw restart: both are
   * genuine stoppages the flow layer already models.
   */
  readonly deadBall: boolean;
};

export function deadBallBoundary(kind: GameFlowSegment["kind"]): boolean {
  return kind === "CENTRE_RESTART" || kind === "FREE_THROW_CONTINUATION";
}

/** Everything a coach may read, assembled from the real state. Read-only by construction. */
export function buildCoachView(flow: GameFlowState, team: MatchTeamId, boundary: CoachBoundary): CoachView {
  const roster = flow.rosters[team];
  const half = halfOf(flow.matchSeconds);
  const onCourt = flow.match.handball.players
    .filter((p) => roster.includes(p.id))
    .map((p) => ({ id: p.id, kind: p.kind, onCourtSince: flow.onCourtSince[p.id] ?? flow.matchSeconds }));
  return {
    team,
    opponent: otherTeam(team),
    matchSeconds: flow.matchSeconds,
    half,
    score: flow.score,
    deadBall: boundary.deadBall,
    possessionTeam: boundary.possessionTeam,
    timeoutsLeft: Math.max(0, flow.timeoutRules.perMatch - timeoutsUsed(flow.timeouts, team)),
    timeoutsLeftThisHalf: Math.max(0, flow.timeoutRules.perHalf - timeoutsUsed(flow.timeouts, team, half)),
    entitlement: outfieldEntitlement(flow, team),
    opponentEntitlement: outfieldEntitlement(flow, otherTeam(team)),
    concededInARow: flow.momentum[team].concededInARow,
    attacksWithoutGoal: flow.momentum[team].attacksWithoutGoal,
    instructions: flow.instructions[team],
    onCourt,
    bench: flow.bench[team].map((p) => ({ id: p.id, kind: p.kind, onCourtSince: 0 })),
    substitutionInProgress: flow.pendingSubstitutions.some((p) => p.team === team),
  };
}

/**
 * Applies one coach command to the real match.
 *
 * Every branch changes an INPUT and nothing else. A timeout adds a record and
 * moves no clock; an instruction moves bias dials the decision layers read; a
 * substitution goes straight into M11's lifecycle. Not one of them touches the
 * spatial state, the score, the RNG stream, or an outcome.
 */
export function applyCoachCommand(
  flow: GameFlowState,
  command: CoachCommand,
  boundary: CoachBoundary,
): { flow: GameFlowState; records: readonly InterventionRecord[] } {
  const at = flow.matchSeconds;
  const refuse = (detail: string): { flow: GameFlowState; records: readonly InterventionRecord[] } => ({
    flow,
    records: [{ kind: "REFUSED", team: command.team, atMatchSeconds: at, detail, reason: command.reason }],
  });

  switch (command.kind) {
    case "TIMEOUT": {
      const half = halfOf(at);
      const verdict = timeoutAllowed(flow.timeoutRules, flow.timeouts, command.team, {
        deadBall: boundary.deadBall,
        possessionTeam: boundary.possessionTeam,
        matchSeconds: at,
        half,
      });
      if (!verdict.ok) return refuse(`timeout refused: ${verdict.reason}`);
      const record: TimeoutRecord = { team: command.team, half, atMatchSeconds: at, reason: command.reason };
      const used = timeoutsUsed(flow.timeouts, command.team) + 1;
      return {
        // The clock does not move, the court does not move, nothing is
        // simulated. A timeout is dead time, so there is nothing to simulate.
        flow: { ...flow, timeouts: [...flow.timeouts, record], activeTimeout: record },
        records: [
          {
            kind: "TIMEOUT_BEGINS",
            team: command.team,
            atMatchSeconds: at,
            detail: `timeout ${used} of ${flow.timeoutRules.perMatch}, half ${half}`,
            reason: command.reason,
          },
        ],
      };
    }

    case "SET_ATTACK": {
      const before = flow.instructions[command.team].attack;
      const { next, deltas } = changeAttackTactics(before, command.changes);
      if (deltas.length === 0) return { flow, records: [] };
      return {
        flow: { ...flow, instructions: { ...flow.instructions, [command.team]: { ...flow.instructions[command.team], attack: next } } },
        records: [
          { kind: "INSTRUCTION", team: command.team, atMatchSeconds: at, detail: `attack: ${describeInstructionDeltas(deltas)}`, reason: command.reason, scope: "ATTACK", deltas },
        ],
      };
    }

    case "SET_DEFENCE": {
      const before = flow.instructions[command.team].defence;
      const { next, deltas } = changeDefenceTactics(before, command.changes);
      if (deltas.length === 0) return { flow, records: [] };
      return {
        flow: { ...flow, instructions: { ...flow.instructions, [command.team]: { ...flow.instructions[command.team], defence: next } } },
        records: [
          { kind: "INSTRUCTION", team: command.team, atMatchSeconds: at, detail: `defence: ${describeInstructionDeltas(deltas)}`, reason: command.reason, scope: "DEFENCE", deltas },
        ],
      };
    }

    case "SUBSTITUTE": {
      // M11 IS the substitution mechanism. A manager change is the same
      // request an automatic rotation makes, and goes through the same
      // REQUESTED -> EXITING -> COMPLETE lifecycle: the man going off still has
      // to walk to his line before anybody replaces him.
      const outcome = requestSubstitution(flow, {
        team: command.team,
        outgoingPlayerId: command.outgoingPlayerId,
        incomingPlayerId: command.incomingPlayerId,
        reason: `COACH:${command.reason || "personnel"}`,
      });
      if (!outcome.ok) return refuse(`substitution refused: ${outcome.reason}`);
      return {
        flow: outcome.flow,
        records: [
          {
            kind: "SUBSTITUTION_REQUESTED",
            team: command.team,
            atMatchSeconds: at,
            detail: `${command.incomingPlayerId} to come on for ${command.outgoingPlayerId}`,
            reason: command.reason,
            outgoingPlayerId: command.outgoingPlayerId,
            incomingPlayerId: command.incomingPlayerId,
          },
        ],
      };
    }

    case "SEVEN_V_SIX": {
      // M22: an instruction, resolved into the substitution it actually is.
      //
      // Nothing here moves a player or empties a goal. It works out who swaps
      // with whom and hands that to M11, so going seven out is the same
      // request, with the same walk to the line and the same refusals, as any
      // other change. That is why the keeper cannot reappear in his goal the
      // instant a coach wants him: he has to come on.
      const roster = flow.rosters[command.team];
      const onCourtPlayers = flow.match.handball.players.filter((p) => roster.includes(p.id));
      const keeperOnCourt = onCourtPlayers.find((p) => p.kind === "GOALKEEPER") ?? null;

      if (command.active) {
        if (!keeperOnCourt) return refuse("already playing seven out");
        const incoming =
          (command.playerId ? flow.bench[command.team].find((p) => p.id === command.playerId) : undefined) ??
          flow.bench[command.team].find((p) => p.kind === "FIELD_PLAYER");
        if (!incoming) return refuse("no outfield player on the bench to bring on");
        const outcome = requestSubstitution(flow, {
          team: command.team,
          outgoingPlayerId: keeperOnCourt.id,
          incomingPlayerId: incoming.id,
          reason: `COACH:${command.reason || "seven out"}`,
          changesGoalkeeper: true,
        });
        if (!outcome.ok) return refuse(`seven out refused: ${outcome.reason}`);
        return {
          flow: outcome.flow,
          records: [
            {
              kind: "SUBSTITUTION_REQUESTED",
              team: command.team,
              atMatchSeconds: at,
              detail: `${incoming.id} comes on for the goalkeeper ${keeperOnCourt.id}: seven out`,
              reason: command.reason,
              outgoingPlayerId: keeperOnCourt.id,
              incomingPlayerId: incoming.id,
            },
          ],
        };
      }

      if (keeperOnCourt) return refuse("the goalkeeper is already on the court");
      const returningKeeper = flow.bench[command.team].find((p) => p.kind === "GOALKEEPER");
      if (!returningKeeper) return refuse("no goalkeeper on the bench to bring back");
      const outgoing =
        (command.playerId ? onCourtPlayers.find((p) => p.id === command.playerId) : undefined) ??
        [...onCourtPlayers]
          .filter((p) => p.kind === "FIELD_PLAYER")
          .sort((a, b) => a.id.localeCompare(b.id))[0];
      if (!outgoing) return refuse("nobody to come off for the goalkeeper");
      const outcome = requestSubstitution(flow, {
        team: command.team,
        outgoingPlayerId: outgoing.id,
        incomingPlayerId: returningKeeper.id,
        reason: `COACH:${command.reason || "keeper back"}`,
        changesGoalkeeper: true,
      });
      if (!outcome.ok) return refuse(`keeper return refused: ${outcome.reason}`);
      return {
        flow: outcome.flow,
        records: [
          {
            kind: "SUBSTITUTION_REQUESTED",
            team: command.team,
            atMatchSeconds: at,
            detail: `the goalkeeper ${returningKeeper.id} comes back on for ${outgoing.id}`,
            reason: command.reason,
            outgoingPlayerId: outgoing.id,
            incomingPlayerId: returningKeeper.id,
          },
        ],
      };
    }
  }
}

/**
 * Runs both coaches at one segment boundary and applies what they ask for.
 *
 * Deterministic and side-free: HOME is asked first, then AWAY, each sees the
 * state as it stands when asked, and no random number is drawn. That last point
 * matters -- a coach who consumed RNG would shift every later possession in the
 * match simply by having had an opinion.
 */
export function runCoachBoundary(
  flow: GameFlowState,
  coaches: Partial<Record<MatchTeamId, CoachController>> | undefined,
  boundary: CoachBoundary,
): { flow: GameFlowState; records: readonly InterventionRecord[] } {
  if (!coaches) return { flow, records: [] };
  const records: InterventionRecord[] = [];
  let current = flow;
  let timeoutTeam: MatchTeamId | null = null;

  for (const team of ["HOME", "AWAY"] as const) {
    const controller = coaches[team];
    if (!controller) continue;
    for (const command of controller(buildCoachView(current, team, boundary))) {
      if (command.team !== team) continue;
      const applied = applyCoachCommand(current, command, boundary);
      current = applied.flow;
      records.push(...applied.records);
      if (applied.records.some((r) => r.kind === "TIMEOUT_BEGINS")) timeoutTeam = team;
    }
  }

  // The timeout is over as soon as the coaching is: play restarts from the
  // restart that was already due, with the state exactly as the whistle left it.
  if (timeoutTeam) {
    records.push({
      kind: "TIMEOUT_ENDS",
      team: timeoutTeam,
      atMatchSeconds: current.matchSeconds,
      detail: `play restarts: ${boundary.kind}`,
      reason: "",
    });
    current = { ...current, activeTimeout: null };
  }
  return { flow: current, records };
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
/** What a caller supplies for one segment, beyond the state itself. */
export type SegmentOptions = {
  readonly ratings?: SimulatePossessionInput["ratings"];
  /**
   * M12: the coaches, asked once each at this boundary. Omitted, nobody
   * intervenes and the match plays out exactly as it did in M11.
   */
  readonly coaches?: Partial<Record<MatchTeamId, CoachController>>;
};

export function advanceOneSegment(
  flow: GameFlowState,
  seed: number,
  segmentIndex: number,
  isTransition: boolean,
  kind: GameFlowSegment["kind"],
  options: SegmentOptions = {},
): SegmentAdvance {
  const ratings = options.ratings;
  // M10: this segment IS the restart. Anybody sent off at the dead ball that
  // preceded it starts his two minutes now, and anybody whose time is already
  // up comes back on before play resumes.
  flow = startPendingSuspensions(flow, flow.matchSeconds);
  const expiry = expireSuspensions(flow);
  const returnedTrace: GameFlowTraceEntry[] = [];
  flow = expiry.flow;

  // M11: the bench. Handball substitutions are rolling -- they need no
  // stoppage -- so a change is asked for here, at the boundary between
  // segments, and then COMPLETES during live play, on whichever fixed step the
  // man going off reaches his substitution area (see settleArrivedExchanges).
  //
  // This boundary pass is only reconciliation: it follows up any swap the court
  // made during the segment just played and abandons any request that can no
  // longer happen, so that neither side asks for a second change while one is
  // still walking.
  const settled = settlePendingSubstitutions(flow);
  flow = settled.flow;
  const substitutions: SubstitutionRecord[] = [...settled.completed];
  const substitutionRng = createPossessionRng((seed ^ Math.imul(segmentIndex + 1, 0x27d4eb2d)) >>> 0);
  const possessionTeam = attackingTeam(flow);

  // M12: THE COACH. He observes the match as it stands at this boundary and may
  // stop it, change what his team is trying to do, or ask for a man. All three
  // change INPUTS -- an allowance record, a set of bias dials, an M11
  // substitution request -- and none of them touches the court, the score, the
  // official clock or the random stream. Play then continues into the next
  // segment, on the same state, under the new instructions.
  const boundary: CoachBoundary = { kind, possessionTeam, deadBall: deadBallBoundary(kind) };
  const coached = runCoachBoundary(flow, options.coaches, boundary);
  flow = coached.flow;
  const interventions: readonly InterventionRecord[] = coached.records;

  for (const side of ["HOME", "AWAY"] as const) {
    const requests = decideSubstitutions(flow, side, { atRestart: kind === "CENTRE_RESTART", possessionTeam }, substitutionRng);
    for (const request of requests.slice(0, SUBSTITUTION_POLICY.maxPerTeamPerSegment)) {
      const outcome = requestSubstitution(flow, request);
      if (!outcome.ok) continue;
      flow = outcome.flow;
    }
  }

  const team = attackingTeam(flow);
  const goalSide = flow.match.possession.attackingGoalSide;
  const startedAt = flow.match.handball.simulationTime;

  // M12: the two sides play under DIFFERENT instructions. Whoever has the ball
  // attacks under his own coach's attacking intentions; the other side defends
  // under his own coach's defensive ones.
  const tactics = flow.instructions[team].attack;
  const defenceTactics = flow.instructions[otherTeam(team)].defence;

  // M23: the defending side sets up in the system its coach asked for.
  //
  // Stamped here, at the boundary, rather than written into the court by the
  // coach: changing system does not move anybody, it changes what the defence
  // forms up as the next time it forms up. Clearing the home positions is what
  // makes it take effect -- the organized setup seeds a fresh shape when there
  // is none, which is the same path every defence has always taken.
  const defenceSystem = flow.instructions[otherTeam(team)].defenceSystem;
  const match =
    flow.match.handball.defense.formationId === defenceSystem
      ? flow.match
      : {
          ...flow.match,
          handball: {
            ...flow.match.handball,
            defense: { ...flow.match.handball.defense, formationId: defenceSystem, homePositions: [] },
          },
        };

  const result: PossessionResult = isTransition
    ? (simulateTransition({ seed: segmentSeed(seed, segmentIndex), initialState: match, ratings }) as unknown as PossessionResult)
    : simulatePossession({ seed: segmentSeed(seed, segmentIndex), initialState: match, ratings, tactics, defenceTactics });

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
  for (const change of settled.completed) {
    returnedTrace.push(noteEntry(`SUB (${change.team}): ${describeSubstitution(change)}`, flow));
  }
  // M12: every coach intervention is its own dead-ball frame, in the order it
  // happened, so the trace can be read back as an account of what the coach
  // changed and when -- timeout begins, instructions, substitution requested,
  // timeout ends, and then the restart that was already due.
  for (const record of interventions) {
    returnedTrace.push(noteEntry(describeIntervention(record), flow));
  }
  trace.unshift(...returnedTrace);

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
  let scoredBy: MatchTeamId | null = null;
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
    scoredBy = scoringTeam;
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

  // M12: how the match is going, in the two numbers a coach reacts to. Read
  // from real results only -- a goal, or a possession that ended without one --
  // and never fed back into how anything is resolved.
  next = { ...next, momentum: updateMomentum(next.momentum, team, scoredBy, nextKind === "CENTRE_RESTART" || nextIsTransition) };

  // M11: follow up the exchanges the COURT made while this segment was played.
  // The swaps themselves already happened, mid-play, on the step each man
  // reached his line -- this only moves him to the bench, starts his
  // replacement's clock at the second he actually came on, and writes the note
  // into the trace entry for that instant rather than at a boundary.
  const drained = settlePendingSubstitutions(next, { simulationTime: startedAt, matchSeconds: flow.matchSeconds });
  next = drained.flow;

  // M25: the bench gets its breath back.
  //
  // Applied here, once per segment, for the time the segment actually took --
  // the men on the court paid for their own work step by step inside it, and
  // this is the other half of the ledger. Deliberately slower than the work
  // rate, so a rotation buys something real without buying a new player: three
  // minutes off is worth about a fifth of a tank.
  //
  // Only for a squad that HAS condition. A match played without fatigue has no
  // condition values anywhere, and `recoverOnBench` leaves those players
  // untouched, so this costs such a match nothing at all.
  const restedSeconds = result.steps * SIMULATION_DT_SECONDS;
  if (restedSeconds > 0) {
    next = {
      ...next,
      bench: {
        HOME: next.bench.HOME.map((p) => recoverOnBench(p, restedSeconds)),
        AWAY: next.bench.AWAY.map((p) => recoverOnBench(p, restedSeconds)),
      },
    };
  }
  for (const change of drained.completed) {
    substitutions.push(change);
    const note = `SUB (${change.team}): ${describeSubstitution(change)}`;
    const index = trace.findIndex((entry) => entry.simulationTime >= change.atSimulationTime);
    if (index < 0) trace.push(noteEntry(note, next));
    else trace[index] = { ...trace[index], note: trace[index].note ? `${trace[index].note}; ${note}` : note };
  }

  const segment: GameFlowSegment = {
    possessionNumber: flow.possessionNumber,
    team,
    attackingGoalSide: goalSide,
    kind,
    outcome: result.outcome,
    steps: result.steps ?? 0,
    fouls: result.fouls ?? [],
    contacts: result.contacts ?? 0,
    resolvedContacts: result.resolvedContacts ?? 0,
    contactNothing: result.contactNothing ?? 0,
    contactBallWon: result.contactBallWon ?? 0,
    contactIllegal: result.contactIllegal ?? 0,
    contactBallWonDeclined: result.contactBallWonDeclined ?? 0,
    substitutions,
    interventions,
  };

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
  run: { readonly setup?: GameFlowSetup; readonly coaches?: Partial<Record<MatchTeamId, CoachController>> } = {},
): GameFlowResult {
  const maxSteps = limits.maxSteps ?? Number.POSITIVE_INFINITY;
  // M12: `tactics` remains the M6 shorthand -- one attacking bias applied to
  // both sides. A caller who wants the two coaches to differ passes `setup`.
  const setup: GameFlowSetup = run.setup ?? (tactics ? { instructions: { HOME: { attack: tactics }, AWAY: { attack: tactics } } } : {});
  let flow = createGameFlowState(initialState, 0, { HOME: [], AWAY: [] }, setup);
  const trace: GameFlowTraceEntry[] = [];
  const segments: GameFlowSegment[] = [];
  const events: PossessionMatchEvent[] = [];
  let steps = 0;
  let segmentIndex = 0;
  let isTransition = false;
  let kind: GameFlowSegment["kind"] = "ORGANIZED";

  while (flow.possessionNumber <= limits.maxPossessions && steps < maxSteps) {
    const advance = advanceOneSegment(flow, seed, segmentIndex, isTransition, kind, { ratings, coaches: run.coaches });
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
