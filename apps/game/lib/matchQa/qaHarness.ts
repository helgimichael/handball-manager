// HUMAN QA GATE 1: what the QA page asks the engine for.
//
// This file holds the harness's CONFIGURATION and its reading of the result.
// It deliberately holds no handball: every match here is produced by the real
// `simulateMatch`, every frame by the real match-integration playback, and
// every fact by the real canonical event stream. A preset is a set of engine
// inputs and a rule for where to seek -- nothing more.
//
// If you find yourself wanting to compute a defensive shape, a contact or a
// substitution in this file, the harness has started to become a second
// simulation and the thing on screen has stopped being the thing we ship.

import { createFullCourt6v6State } from "@handball-manager/handball-engine/src/scenarios/fullCourt6v6.ts";
import { simulateMatch, type MatchResult } from "@handball-manager/handball-engine/src/simulation/matchRunner.ts";
import { autonomousCoach, type CoachCommand, type CoachController, type CoachView } from "@handball-manager/handball-engine/src/simulation/coach.ts";
import {
  buildCanonicalMatchEvents,
  type CanonicalMatchEvent,
} from "@handball-manager/handball-engine/src/simulation/canonicalEvents.ts";
import {
  FIVE_ONE_DEFENSE_FORMATION_ID,
  THREE_TWO_ONE_DEFENSE_FORMATION_ID,
} from "@handball-manager/handball-engine/src/policies/defense/defensiveSystem.ts";
import { SIX_ZERO_DEFENSE_FORMATION_ID } from "@handball-manager/handball-engine/src/policies/defense/sixZeroDefensePolicy.ts";
import { conditionOf, readCondition, type ConditionReading } from "@handball-manager/handball-engine/src/simulation/condition.ts";
import { GOAL_GUARDED_WITHIN_METERS } from "@handball-manager/handball-engine/src/simulation/sevenVsSix.ts";
import type { MatchTeamId } from "@handball-manager/handball-engine/src/simulation/gameFlow.ts";

export const DEFENCE_SYSTEMS = [
  { id: SIX_ZERO_DEFENSE_FORMATION_ID, label: "6:0" },
  { id: FIVE_ONE_DEFENSE_FORMATION_ID, label: "5:1" },
  { id: THREE_TWO_ONE_DEFENSE_FORMATION_ID, label: "3:2:1" },
] as const;

export type DefenceSystemId = (typeof DEFENCE_SYSTEMS)[number]["id"];

export type QaSettings = {
  readonly seed: number;
  readonly home: DefenceSystemId;
  readonly away: DefenceSystemId;
  readonly fatigue: boolean;
  /** HOME takes its goalkeeper off whenever it has the ball. */
  readonly sevenOut: boolean;
};

export const DEFAULT_QA_SETTINGS: QaSettings = {
  seed: 12,
  home: SIX_ZERO_DEFENSE_FORMATION_ID,
  away: SIX_ZERO_DEFENSE_FORMATION_ID,
  fatigue: false,
  sevenOut: false,
};

/**
 * A coach who plays seven out whenever his side has the ball.
 *
 * The only policy in this file, and it is a QA instrument rather than a model:
 * M22 built the mechanism and left "when to do it" open, so the harness needs
 * somebody to ask for it. He asks at every boundary and M11 refuses him
 * whenever the exchange would be illegal, which is exactly what a human should
 * be able to watch.
 */
function sevenOutCoach(team: MatchTeamId): CoachController {
  const base = autonomousCoach();
  return (view: CoachView): readonly CoachCommand[] => {
    const hasKeeper = view.onCourt.some((p) => p.kind === "GOALKEEPER");
    const inPossession = view.possessionTeam === team;
    if (inPossession && hasKeeper) return [{ kind: "SEVEN_V_SIX", team, active: true, playerId: null, reason: "QA: seven out" }];
    if (!inPossession && !hasKeeper) return [{ kind: "SEVEN_V_SIX", team, active: false, playerId: null, reason: "QA: keeper back" }];
    return base(view);
  };
}

export type QaMatch = {
  readonly match: MatchResult;
  readonly events: readonly CanonicalMatchEvent[];
};

/** One match, from the real engine, under exactly these settings. */
export function buildQaMatch(settings: QaSettings): QaMatch {
  const start = createFullCourt6v6State({ attackingGoalSide: "TOP" });
  const match = simulateMatch(start, settings.seed, {
    fatigue: settings.fatigue,
    setup: {
      instructions: {
        HOME: { defenceSystem: settings.home },
        AWAY: { defenceSystem: settings.away },
      },
    },
    coaches: {
      HOME: settings.sevenOut ? sevenOutCoach("HOME") : autonomousCoach(),
      AWAY: autonomousCoach(),
    },
  });
  return { match, events: buildCanonicalMatchEvents(match) };
}

// ---------------------------------------------------------------------------
// Presets: settings, plus where in the match the interesting thing happens
// ---------------------------------------------------------------------------

/**
 * Where a preset wants the clock, found in the CANONICAL EVENTS of the match it
 * just produced. Nothing is staged: the harness plays a real match and then
 * seeks to the first moment the thing being tested actually occurred, so a
 * human sees the genuine article rather than a tableau.
 */
export type QaSeek = (events: readonly CanonicalMatchEvent[], match: MatchResult) => number | null;

export type QaPreset = {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly settings: QaSettings;
  readonly seek?: QaSeek;
};

/** A little before the event, so the tester sees it develop rather than land. */
const LEAD_IN_SECONDS = 12;

function firstWhere(events: readonly CanonicalMatchEvent[], match: (e: CanonicalMatchEvent) => boolean): number | null {
  const found = events.find(match);
  return found ? Math.max(0, found.matchSeconds - LEAD_IN_SECONDS) : null;
}

const base = DEFAULT_QA_SETTINGS;

export const QA_PRESETS: readonly QaPreset[] = [
  {
    id: "normal",
    label: "NORMAL 6v6",
    hint: "Ordinary organized match, both sides 6:0.",
    settings: base,
  },
  {
    id: "five-one",
    label: "5:1",
    hint: "AWAY defends 5:1 — look for one man in front of a line of five.",
    settings: { ...base, away: FIVE_ONE_DEFENSE_FORMATION_ID },
  },
  {
    id: "three-two-one",
    label: "3:2:1",
    hint: "AWAY defends 3:2:1 — look for three layers and handovers between them.",
    settings: { ...base, away: THREE_TWO_ONE_DEFENSE_FORMATION_ID },
  },
  {
    id: "seven-out",
    label: "7v6",
    hint: "HOME takes its keeper off whenever it has the ball.",
    settings: { ...base, sevenOut: true },
  },
  {
    id: "empty-goal",
    label: "7v6 TURNOVER / EMPTY GOAL",
    hint: "Seeks the first shot AWAY takes while HOME's goal is genuinely empty.",
    settings: { ...base, sevenOut: true },
    seek: (events, match) => {
      // Read from the trace: the instants HOME had nobody in goal. A shot by
      // AWAY inside one of those windows is the moment worth watching.
      const homeIds = new Set(match.finalState.rosters.HOME);
      const keeperIds = new Set(match.finalState.goalkeeperIds);
      const emptyFrames = new Set<number>();
      for (const entry of match.trace) {
        const onCourt = entry.playerPositions.filter((p) => homeIds.has(p.playerId));
        if (onCourt.length > 0 && onCourt.every((p) => !keeperIds.has(p.playerId))) {
          emptyFrames.add(Math.round(entry.matchSeconds));
        }
      }
      return firstWhere(events, (e) => e.type === "SHOT" && e.teamId === "AWAY" && emptyFrames.has(Math.round(e.matchSeconds)));
    },
  },
  {
    id: "transition",
    label: "TRANSITION",
    hint: "Seeks the first change of possession — the break that follows is a real one.",
    settings: base,
    seek: (events) => firstWhere(events, (e) => e.type === "POSSESSION_CHANGE"),
  },
  {
    id: "contact",
    label: "ORGANIZED CONTACT",
    hint: "Seeks the first foul given in organized play: M18 contact → M19 episode → M10 restart.",
    settings: base,
    seek: (events) => firstWhere(events, (e) => e.type === "FOUL"),
  },
];

// ---------------------------------------------------------------------------
// Reading the state on screen
// ---------------------------------------------------------------------------

export type QaTeamReading = {
  readonly team: MatchTeamId;
  readonly onCourt: number;
  readonly fieldPlayers: number;
  readonly goalkeeperOnCourt: boolean;
  /** QA GATE 1 FIX: a keeper actually near enough to his goal to be defending it. */
  readonly goalGuarded: boolean;
  readonly defenceSystem: string;
};

/**
 * Who each side actually has on the court at this instant, read from the
 * playback frame rather than from what anybody intended.
 */
export function readTeams(
  match: MatchResult,
  players: readonly { readonly id: string; readonly x: number; readonly y: number }[],
  settings: QaSettings,
  /** The goal each side is defending in the frame being read. */
  ownGoalSide: Readonly<Record<MatchTeamId, "TOP" | "BOTTOM">>,
): readonly QaTeamReading[] {
  const keeperIds = new Set(match.finalState.goalkeeperIds);
  return (["HOME", "AWAY"] as const).map((team) => {
    const roster = new Set(match.finalState.rosters[team]);
    const onCourt = players.filter((p) => roster.has(p.id));
    const keepers = onCourt.filter((p) => keeperIds.has(p.id));
    // QA GATE 1 FIX: guarded is about WHERE he is, not whether he is on. A
    // keeper who has just completed his exchange is on the halfway line and the
    // goal behind him is open; showing it as guarded is the one thing this
    // panel must never do.
    const goal = { x: 10, y: ownGoalSide[team] === "TOP" ? 0 : 40 };
    const guarding = keepers.some((k) => Math.hypot(k.x - goal.x, k.y - goal.y) <= GOAL_GUARDED_WITHIN_METERS);
    return {
      team,
      onCourt: onCourt.length,
      fieldPlayers: onCourt.length - keepers.length,
      goalkeeperOnCourt: keepers.length > 0,
      goalGuarded: guarding,
      defenceSystem: team === "HOME" ? settings.home : settings.away,
    };
  });
}

/**
 * The possession phase the engine was in at this instant.
 *
 * Read from the match's own trace, which carries `phase` per entry. The
 * playback frame does not, and adding it there would be changing a shipped
 * package to serve a debug panel -- so the harness reads the engine output it
 * already has.
 */
export function phaseAt(match: MatchResult, matchSeconds: number): string {
  let phase = "—";
  for (const entry of match.trace) {
    if (entry.matchSeconds > matchSeconds) break;
    phase = entry.phase;
  }
  return phase;
}

export type QaConditionRow = ConditionReading & { readonly team: MatchTeamId | null; readonly onCourt: boolean };

/**
 * Every player's condition at full time, plus what it did to his movement.
 *
 * Deliberately the engine's own `readCondition` rather than a number formatted
 * here: the panel shows what the engine says, in the engine's units.
 */
export function readConditions(match: MatchResult, onCourtIds: readonly string[]): readonly QaConditionRow[] {
  const onCourt = new Set(onCourtIds);
  const squad = [
    ...match.finalState.match.handball.players,
    ...match.finalState.bench.HOME,
    ...match.finalState.bench.AWAY,
  ];
  const teamOf = (id: string): MatchTeamId | null =>
    match.finalState.rosters.HOME.includes(id) ? "HOME" : match.finalState.rosters.AWAY.includes(id) ? "AWAY" : null;
  return squad
    .filter((p) => p.condition !== undefined)
    .map((p) => ({ ...readCondition(p), team: teamOf(p.id), onCourt: onCourt.has(p.id) }))
    .sort((a, b) => a.condition - b.condition || a.playerId.localeCompare(b.playerId));
}

export { conditionOf };

// ---------------------------------------------------------------------------
// QA instrumentation: who is who on the court
// ---------------------------------------------------------------------------

export type QaDefenderRow = {
  readonly playerId: string;
  /** The last four characters, which is what a human can match to a marker. */
  readonly shortId: string;
  readonly role: string;
  readonly x: number;
  readonly y: number;
};

/**
 * The defending side's outfield players at this instant, with the ROLE the
 * engine knows them by.
 *
 * Purely an identification aid, and it exists because of a specific QA failure:
 * the decision trace said "R2 has the ball" and a human could not tell which
 * blue marker R2 was, so there was no way to agree on whether the defence was
 * doing what the trace claimed. Roles are reassigned by lane at every change of
 * possession, so a player is not the same role all match and no static legend
 * would do.
 *
 * Reads the state it is given. It computes no positions, no duties and no
 * reactions -- the harness must never become a second simulation.
 */
export function readDefenders(
  match: MatchResult,
  players: readonly { readonly id: string; readonly x: number; readonly y: number }[],
  defendingTeam: MatchTeamId | null,
): readonly QaDefenderRow[] {
  if (!defendingTeam) return [];
  const roster = new Set(match.finalState.rosters[defendingTeam]);
  const keepers = new Set(match.finalState.goalkeeperIds);
  const roleOf = new Map<string, string>();
  for (const player of [
    ...match.finalState.match.handball.players,
    ...match.finalState.bench.HOME,
    ...match.finalState.bench.AWAY,
  ]) {
    roleOf.set(player.id, player.role);
  }
  return players
    .filter((p) => roster.has(p.id) && !keepers.has(p.id))
    .map((p) => ({ playerId: p.id, shortId: p.id.slice(-4), role: roleOf.get(p.id) ?? "?", x: p.x, y: p.y }))
    .sort((a, b) => a.x - b.x || a.playerId.localeCompare(b.playerId));
}

/**
 * The engine's own defensive note for this instant.
 *
 * The same string the decision trace shows, pulled out on its own so it can sit
 * beside the defender table and be read against it.
 */
export function defenceSummaryAt(match: MatchResult, matchSeconds: number): string {
  let summary = "—";
  for (const entry of match.trace) {
    if (entry.matchSeconds > matchSeconds) break;
    if (entry.note.startsWith("defence: ")) summary = entry.note.slice(9);
  }
  return summary;
}
