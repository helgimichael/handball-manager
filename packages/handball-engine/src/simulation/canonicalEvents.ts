/**
 * MATCH-EXPERIENCE-2.0 M15: CANONICAL MATCH EVENTS 1.0.
 *
 * One typed stream of the facts a match produced:
 *
 *   spatial simulation -> CanonicalMatchEvent[] -> consumers
 *
 * WHAT A CANONICAL EVENT IS. A thing that happened, described in data: who did
 * it, to whom, when, where, and how it turned out. It is NOT a sentence. The
 * engine has always written readable notes for development, and those notes
 * remain exactly what they are -- a debugging aid nobody is allowed to parse.
 * Every field below is read from a typed value the simulation already produced.
 *
 * WHAT IT IS NOT. It is not a second simulation, and nothing here decides
 * anything. `buildCanonicalMatchEvents` is a pure projection of a completed
 * `MatchResult`: give it the same match and it gives you the same events, in
 * the same order, every time. If it were deleted the match would be identical.
 *
 * TWO STREAMS, DELIBERATELY. The trace is high-frequency playback state --
 * thousands of frames of positions, for the renderer and for debugging. The
 * canonical events are low-frequency match facts -- a few hundred per match,
 * for results, stats, commentary and analytics. They describe the same match at
 * different resolutions and neither is derived from the other's presentation.
 *
 * CHRONOLOGY. Events are ordered by (half, simulationTime) -- the spatial
 * clock, which is the simulation's own chronology -- and never by the index of
 * a rendered frame. `matchSeconds` is carried alongside as the official
 * score-sheet stamp; for events inside a segment that stamp is the runner's own
 * linear spread across the segment, which is exact at segment boundaries and
 * interpolated within one. `sequence` is the resolved order itself.
 */
import type { MeterPoint } from "../domain/geometry/coordinates";
import type { AttackGapId } from "../domain/geometry/attackGaps";
import type { FoulKind, FoulPunishment, FoulRestart } from "./foulDecision";
import type { InstructionDelta } from "./coaching";
import type { MatchHalf, MatchResult } from "./matchRunner";
import type { MatchScore, MatchTeamId } from "./gameFlow";

// ---------------------------------------------------------------------------
// The shape every event shares
// ---------------------------------------------------------------------------

export type CanonicalEventBase = {
  /** Position in the resolved chronology, from 0. Stable for a given match. */
  readonly sequence: number;
  readonly half: MatchHalf;
  /** The official score-sheet clock, 0..3600. */
  readonly matchSeconds: number;
  /** The spatial engine's own clock. This is what the ordering is built on. */
  readonly simulationTime: number;
  /** The side the event belongs to, when it belongs to one. */
  readonly teamId: MatchTeamId | null;
  /** The score after this event. Only a GOAL ever changes it. */
  readonly score: MatchScore;
};

export type ShotOutcome = "GOAL" | "SAVED" | "MISSED" | "BLOCKED";

/**
 * The full vocabulary. Deliberately small: these are the facts M1-M14 actually
 * produce, and nothing has been invented to round the list out.
 */
export type CanonicalMatchEvent =
  | (CanonicalEventBase & { readonly type: "HALF_START" })
  | (CanonicalEventBase & { readonly type: "HALF_END" })
  | (CanonicalEventBase & { readonly type: "FULL_TIME"; readonly finalScore: MatchScore })
  /** The ball changed hands. `regainedByPlayerId` is known when the engine resolved a regainer. */
  | (CanonicalEventBase & {
      readonly type: "POSSESSION_CHANGE";
      readonly possessionNumber: number;
      readonly attackingGoalSide: "TOP" | "BOTTOM";
    })
  /** A pass the carrier chose to make, including a feed to the pivot. */
  | (CanonicalEventBase & {
      readonly type: "PASS";
      readonly playerId: string;
      readonly targetPlayerId: string | null;
      /** PIVOT_FEED and RESET are the same act with a different intention; the engine distinguishes them. */
      readonly intent: "CIRCULATION" | "PIVOT_FEED" | "RESET";
      readonly location: MeterPoint;
    })
  /** A carrier taking the defence on: driving at a gap, or continuing a drive. */
  | (CanonicalEventBase & {
      readonly type: "DRIVE";
      readonly playerId: string;
      readonly gapId: AttackGapId | null;
      readonly location: MeterPoint;
      readonly target: MeterPoint | null;
    })
  | (CanonicalEventBase & {
      readonly type: "SHOT";
      readonly playerId: string | null;
      readonly goalkeeperId: string | null;
      readonly outcome: ShotOutcome;
      /** The defender who blocked it, on a BLOCKED shot. */
      readonly blockedByDefenderId: string | null;
      readonly location: MeterPoint | null;
      /** True when this shot was a 7 metre throw. */
      readonly sevenMetre: boolean;
    })
  /** A goal. Emitted alongside its SHOT so a consumer can count either. */
  | (CanonicalEventBase & {
      readonly type: "GOAL";
      readonly playerId: string | null;
      readonly goalkeeperId: string | null;
      readonly location: MeterPoint | null;
      readonly sevenMetre: boolean;
    })
  | (CanonicalEventBase & { readonly type: "TURNOVER"; readonly playerId: string | null })
  | (CanonicalEventBase & {
      readonly type: "FOUL";
      /** The offender. He defends, so his side is `teamId`. */
      readonly playerId: string;
      readonly victimPlayerId: string;
      readonly foulKind: FoulKind;
      readonly restart: FoulRestart;
      readonly punishment: FoulPunishment;
      readonly destroyedClearChance: boolean;
      readonly location: MeterPoint;
    })
  | (CanonicalEventBase & {
      readonly type: "SUSPENSION";
      readonly playerId: string;
      readonly seconds: number;
    })
  | (CanonicalEventBase & {
      readonly type: "SUBSTITUTION_REQUESTED";
      readonly outgoingPlayerId: string;
      readonly incomingPlayerId: string;
    })
  | (CanonicalEventBase & {
      readonly type: "SUBSTITUTION_COMPLETED";
      readonly outgoingPlayerId: string;
      readonly incomingPlayerId: string;
      readonly requestedAtMatchSeconds: number;
    })
  | (CanonicalEventBase & { readonly type: "TIMEOUT_STARTED" })
  | (CanonicalEventBase & { readonly type: "TIMEOUT_ENDED" })
  | (CanonicalEventBase & {
      readonly type: "INSTRUCTION_CHANGED";
      readonly scope: "ATTACK" | "DEFENCE";
      /** Exactly which dials moved, and from what to what. Data, not a sentence. */
      readonly changes: readonly InstructionDelta[];
    });

export type CanonicalEventType = CanonicalMatchEvent["type"];

// ---------------------------------------------------------------------------
// Building the stream
// ---------------------------------------------------------------------------

const SHOT_OUTCOMES = new Set(["SHOT_GOAL", "SHOT_SAVED", "SHOT_MISSED"]);

/** Which of the four shot outcomes this was, using the blocker the resolution recorded. */
function shotOutcomeOf(outcome: string, blockedByDefenderId: string | null): ShotOutcome {
  if (outcome === "SHOT_GOAL") return "GOAL";
  if (outcome === "SHOT_SAVED") return "SAVED";
  return blockedByDefenderId ? "BLOCKED" : "MISSED";
}

function otherTeam(team: MatchTeamId): MatchTeamId {
  return team === "HOME" ? "AWAY" : "HOME";
}

/**
 * A segment and the event record it produced, paired.
 *
 * The runner pushes exactly one of each per simulated segment, in the same
 * loop, so they are positionally aligned. The pairing is checked rather than
 * assumed, so a future change degrades into fewer paired facts rather than
 * mis-attributed ones.
 */
function pairs(match: MatchResult) {
  const count = Math.min(match.segments.length, match.events.length);
  const out: { segment: MatchResult["segments"][number]; record: MatchResult["events"][number] }[] = [];
  for (let i = 0; i < count; i += 1) {
    if (match.segments[i].outcome !== match.events[i].outcome) continue;
    out.push({ segment: match.segments[i], record: match.events[i] });
  }
  return out;
}

/** Distributive, so each member of the union keeps its own fields. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type Draft = DistributiveOmit<CanonicalMatchEvent, "sequence">;

/**
 * Every canonical fact of one completed match, in chronological order.
 *
 * Pure. Reads only typed fields of the result -- outcomes, decisions, foul
 * awards, substitution records, coach interventions -- and never a note.
 */
export function buildCanonicalMatchEvents(match: MatchResult): CanonicalMatchEvent[] {
  const drafts: Draft[] = [];
  const halves = [...new Set(match.segments.map((s) => s.half))].sort() as MatchHalf[];
  // When each half and each possession BEGAN, on the spatial clock. Read from
  // the trace's own timestamps -- the earliest recorded instant of each -- so
  // an opening whistle sorts before the first pass rather than after it.
  const halfStartTime = new Map<MatchHalf, number>();
  const halfEndTime = new Map<MatchHalf, number>();
  const possessionStartTime = new Map<string, number>();
  for (const entry of match.trace) {
    const half = entry.half;
    const earliest = halfStartTime.get(half);
    if (earliest === undefined || entry.simulationTime < earliest) halfStartTime.set(half, entry.simulationTime);
    const latest = halfEndTime.get(half);
    if (latest === undefined || entry.simulationTime > latest) halfEndTime.set(half, entry.simulationTime);
    const key = `${half}:${entry.possessionNumber}`;
    const started = possessionStartTime.get(key);
    if (started === undefined || entry.simulationTime < started) possessionStartTime.set(key, entry.simulationTime);
  }

  // --- the shape of the match -------------------------------------------
  for (const half of halves) {
    const inHalf = match.segments.filter((s) => s.half === half);
    const started = halfStartTime.get(half);
    const ended = halfEndTime.get(half);
    if (started === undefined || ended === undefined || inHalf.length === 0) continue;
    drafts.push({
      type: "HALF_START",
      half,
      matchSeconds: (half - 1) * 1800,
      // Strictly before the first recorded instant, so the whistle brackets it.
      simulationTime: started - 1e-6,
      teamId: null,
      score: half === 1 ? { HOME: 0, AWAY: 0 } : match.halftimeScore,
    });
    drafts.push({
      type: "HALF_END",
      half,
      matchSeconds: half * 1800,
      simulationTime: ended + 1e-6,
      teamId: null,
      score: half === 1 ? match.halftimeScore : match.finalScore,
    });
  }

  // --- what happened in each segment -------------------------------------
  let previousTeam: MatchTeamId | null = null;
  let previousPossession = -1;
  for (const { segment, record } of pairs(match)) {
    const base = {
      half: segment.half,
      matchSeconds: record.matchSeconds,
      simulationTime: record.simulationTime,
      teamId: segment.team,
      score: record.scoreAfter,
    };
    const defendingTeam = otherTeam(segment.team);

    // The coaching that happened at the boundary which OPENED this segment,
    // and the substitutions that completed during it. Both carry their own
    // times, which is why they are placed by those rather than by the segment.
    for (const intervention of segment.interventions) {
      const interventionBase = { ...base, teamId: intervention.team, matchSeconds: intervention.atMatchSeconds };
      if (intervention.kind === "TIMEOUT_BEGINS") drafts.push({ ...interventionBase, type: "TIMEOUT_STARTED" });
      else if (intervention.kind === "TIMEOUT_ENDS") drafts.push({ ...interventionBase, type: "TIMEOUT_ENDED" });
      else if (intervention.kind === "INSTRUCTION" && intervention.scope && intervention.deltas) {
        drafts.push({ ...interventionBase, type: "INSTRUCTION_CHANGED", scope: intervention.scope, changes: intervention.deltas });
      } else if (intervention.kind === "SUBSTITUTION_REQUESTED" && intervention.outgoingPlayerId && intervention.incomingPlayerId) {
        drafts.push({
          ...interventionBase,
          type: "SUBSTITUTION_REQUESTED",
          outgoingPlayerId: intervention.outgoingPlayerId,
          incomingPlayerId: intervention.incomingPlayerId,
        });
      }
    }
    for (const change of segment.substitutions) {
      drafts.push({
        ...base,
        type: "SUBSTITUTION_COMPLETED",
        teamId: change.team,
        matchSeconds: change.atMatchSeconds,
        simulationTime: change.atSimulationTime,
        outgoingPlayerId: change.outgoingPlayerId,
        incomingPlayerId: change.incomingPlayerId,
        requestedAtMatchSeconds: change.requestedAtMatchSeconds,
      });
    }

    if (segment.possessionNumber !== previousPossession || segment.team !== previousTeam) {
      drafts.push({
        ...base,
        type: "POSSESSION_CHANGE",
        possessionNumber: segment.possessionNumber,
        attackingGoalSide: segment.attackingGoalSide,
        // A possession change happens when the possession STARTS, not when the
        // segment that opened it finished -- so it is stamped with the earliest
        // instant the trace recorded for that possession.
        simulationTime: (possessionStartTime.get(`${segment.half}:${segment.possessionNumber}`) ?? record.simulationTime) - 1e-6,
        // The score at the start of a possession is the score before it.
        score: previousTeam === null ? { HOME: 0, AWAY: 0 } : base.score,
      });
      previousPossession = segment.possessionNumber;
      previousTeam = segment.team;
    }

    // The referee. A foul belongs to the offender, who is defending.
    for (const foul of segment.fouls) {
      drafts.push({
        ...base,
        type: "FOUL",
        teamId: defendingTeam,
        simulationTime: foul.simulationTime,
        playerId: foul.defenderId,
        victimPlayerId: foul.victimId,
        foulKind: foul.kind,
        restart: foul.restart,
        punishment: foul.punishment,
        destroyedClearChance: foul.destroyedClearChance,
        location: foul.position,
      });
      if (foul.suspend) {
        drafts.push({ ...base, type: "SUSPENSION", teamId: defendingTeam, simulationTime: foul.simulationTime, playerId: foul.defenderId, seconds: 120 });
      }
    }

    // How the possession ended.
    const sevenMetre = segment.fouls.some((f) => f.restart === "SEVEN_METRE") && SHOT_OUTCOMES.has(segment.outcome);
    if (SHOT_OUTCOMES.has(segment.outcome)) {
      const outcome = shotOutcomeOf(segment.outcome, record.event.blockedByDefenderId);
      drafts.push({
        ...base,
        type: "SHOT",
        playerId: record.event.playerId,
        goalkeeperId: record.event.goalkeeperId,
        outcome,
        blockedByDefenderId: record.event.blockedByDefenderId,
        location: record.event.shotOrigin,
        sevenMetre,
      });
      if (outcome === "GOAL") {
        drafts.push({
          ...base,
          type: "GOAL",
          playerId: record.event.playerId,
          goalkeeperId: record.event.goalkeeperId,
          location: record.event.shotOrigin,
          sevenMetre,
          // A goal is the same instant as its shot, and must sort after it.
          simulationTime: record.simulationTime + 1e-6,
        });
      }
    } else if (segment.outcome === "TURNOVER") {
      drafts.push({ ...base, type: "TURNOVER", playerId: record.event.playerId });
    }
  }

  // --- what happened during the play itself ------------------------------
  // The carrier's own decisions are typed objects on the trace, so a pass and a
  // drive are read straight off them. Only decisions the engine ACTED ON are
  // recorded here; the options it weighed and rejected stay internal.
  for (const entry of match.trace) {
    const decision = entry.decision;
    if (!decision) continue;
    const carrier = entry.ballPossessorId;
    if (!carrier) continue;
    const chosen = decision.chosen;
    const base = {
      half: entry.half,
      matchSeconds: entry.matchSeconds,
      simulationTime: entry.simulationTime,
      teamId: entry.possessionTeam,
      score: entry.score,
    };
    if (chosen.kind === "PASS" || chosen.kind === "PLAY_PIVOT" || chosen.kind === "RESET") {
      drafts.push({
        ...base,
        type: "PASS",
        playerId: carrier,
        targetPlayerId: chosen.targetPlayerId ?? null,
        intent: chosen.kind === "PLAY_PIVOT" ? "PIVOT_FEED" : chosen.kind === "RESET" ? "RESET" : "CIRCULATION",
        location: entry.ballPosition,
      });
    } else if (chosen.kind === "ATTACK_GAP" || chosen.kind === "CONTINUE") {
      drafts.push({
        ...base,
        type: "DRIVE",
        playerId: carrier,
        gapId: chosen.gapId ?? null,
        location: entry.ballPosition,
        target: chosen.target ?? null,
      });
    }
  }

  drafts.push({
    type: "FULL_TIME",
    half: 2,
    matchSeconds: 3600,
    simulationTime: Number.POSITIVE_INFINITY,
    teamId: null,
    score: match.finalScore,
    finalScore: match.finalScore,
  });

  // Chronological, on the simulation's own clock. Ties keep insertion order,
  // which is the order the simulation produced them in.
  return drafts
    .map((draft, index) => ({ draft, index }))
    .sort((a, b) => a.draft.half - b.draft.half || a.draft.simulationTime - b.draft.simulationTime || a.index - b.index)
    .map(({ draft }, sequence) => ({ ...draft, sequence }) as CanonicalMatchEvent);
}

// ---------------------------------------------------------------------------
// Small readers, so consumers do not each re-derive the same filters
// ---------------------------------------------------------------------------

export function eventsOfType<T extends CanonicalEventType>(
  events: readonly CanonicalMatchEvent[],
  type: T,
): Extract<CanonicalMatchEvent, { type: T }>[] {
  return events.filter((e): e is Extract<CanonicalMatchEvent, { type: T }> => e.type === type);
}

/** Goals scored by each side, counted from the events themselves. */
export function goalsFromEvents(events: readonly CanonicalMatchEvent[]): Record<MatchTeamId, number> {
  const goals = eventsOfType(events, "GOAL");
  return {
    HOME: goals.filter((g) => g.teamId === "HOME").length,
    AWAY: goals.filter((g) => g.teamId === "AWAY").length,
  };
}
