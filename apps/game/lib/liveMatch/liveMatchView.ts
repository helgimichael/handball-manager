// Live match view (HM-MATCH-0.1).
//
// A pure selector: given an already-generated FastMatchResult and the
// current LiveMatchClock, derives everything the screen needs by
// filtering `result.events` to `minute <= clockMinute` and re-tallying
// from scratch every time. No incremental/mutable accumulator exists, so
// there is nothing that can drift from the source-of-truth timeline --
// at FULL_TIME the derived view is guaranteed to equal FastMatchResult's
// own final stats (see matchEngine.test.ts's HM-MATCH-0.1 invariants,
// which prove the timeline is exactly reconstructable in the first
// place).
import type { FastMatchResult, MatchEvent, TeamMatchStats } from "@handball-manager/game-simulation";
import type { LiveMatchClock } from "./clock";

export interface LiveTeamStats {
  goals: number;
  shots: number;
  shootingPct: number;
  saves: number;
  shotsFaced: number;
  turnovers: number;
  twoMinuteSuspensions: number;
  sevenMetreGoals: number;
  sevenMetreAttempts: number;
}

export interface LiveMatchView {
  phase: LiveMatchClock["phase"];
  clockMinute: number;
  /** Ascending by minute, exactly the events with `minute <= clockMinute`. */
  revealedEvents: MatchEvent[];
  homeScore: number;
  awayScore: number;
  homeStats: LiveTeamStats;
  awayStats: LiveTeamStats;
  /** Only goals are safely live-reconstructable per player (Spec S12/S19 -- see module doc). */
  homePlayerGoals: Record<string, number>;
  awayPlayerGoals: Record<string, number>;
  /**
   * The side of the most recently revealed event -- NOT a modeled
   * continuous possession percentage (Spec S10: the underlying engine
   * does not track possession ownership between events). `null` before
   * any event has been revealed.
   */
  currentAttack: "home" | "away" | null;
}

function tallyTeamStats(events: readonly MatchEvent[], side: "home" | "away", otherSideShots: number): LiveTeamStats {
  const sideEvents = events.filter((e) => e.side === side);
  const count = (type: MatchEvent["type"]) => sideEvents.filter((e) => e.type === type).length;
  const goals = count("GOAL");
  const misses = count("MISS");
  const saves = count("SAVE");
  const shots = goals + misses + saves;
  const sevenMEvents = sideEvents.filter((e) => e.type === "SEVEN_M");
  const sevenMetreGoals = sevenMEvents.filter((e) => e.sevenMetreOutcome === "GOAL").length;

  return {
    goals,
    shots,
    shootingPct: shots > 0 ? Math.round((goals / shots) * 1000) / 10 : 0,
    saves,
    shotsFaced: otherSideShots,
    turnovers: count("TURNOVER"),
    twoMinuteSuspensions: count("TWO_MIN"),
    sevenMetreGoals,
    sevenMetreAttempts: sevenMEvents.length,
  };
}

function tallyPlayerGoals(events: readonly MatchEvent[], side: "home" | "away"): Record<string, number> {
  const goals: Record<string, number> = {};
  for (const event of events) {
    if (event.type === "GOAL" && event.side === side && event.playerId) {
      goals[event.playerId] = (goals[event.playerId] ?? 0) + 1;
    }
  }
  return goals;
}

export function computeLiveMatchView(result: FastMatchResult, clock: LiveMatchClock): LiveMatchView {
  const revealedEvents = result.events.filter((e) => e.minute <= clock.clockMinute);

  // Two passes: each side's `shots` is needed as the other side's `shotsFaced`.
  const homeShotsOnly = revealedEvents.filter((e) => e.side === "home" && (e.type === "GOAL" || e.type === "MISS" || e.type === "SAVE")).length;
  const awayShotsOnly = revealedEvents.filter((e) => e.side === "away" && (e.type === "GOAL" || e.type === "MISS" || e.type === "SAVE")).length;

  const homeStats = tallyTeamStats(revealedEvents, "home", awayShotsOnly);
  const awayStats = tallyTeamStats(revealedEvents, "away", homeShotsOnly);

  const lastGoal = [...revealedEvents].reverse().find((e) => e.type === "GOAL");
  const lastEvent = revealedEvents[revealedEvents.length - 1];

  return {
    phase: clock.phase,
    clockMinute: clock.clockMinute,
    revealedEvents,
    homeScore: lastGoal?.homeScoreAfter ?? 0,
    awayScore: lastGoal?.awayScoreAfter ?? 0,
    homeStats,
    awayStats,
    homePlayerGoals: tallyPlayerGoals(revealedEvents, "home"),
    awayPlayerGoals: tallyPlayerGoals(revealedEvents, "away"),
    currentAttack: lastEvent?.side ?? null,
  };
}

/** True once `view` is provably identical to the match's own final stats -- the HM-MATCH-0.1 hard gate. */
export function liveStatsMatchFinal(view: LiveMatchView, result: FastMatchResult): boolean {
  const equalTeam = (live: LiveTeamStats, final: TeamMatchStats) =>
    live.goals === final.goals &&
    live.shots === final.shots &&
    live.saves === final.saves &&
    live.shotsFaced === final.shotsFaced &&
    live.turnovers === final.turnovers &&
    live.twoMinuteSuspensions === final.twoMinuteSuspensions &&
    live.sevenMetreGoals === final.sevenMetreGoals &&
    live.sevenMetreAttempts === final.sevenMetreAttempts;

  return (
    view.homeScore === result.homeGoals &&
    view.awayScore === result.awayGoals &&
    equalTeam(view.homeStats, result.homeStats) &&
    equalTeam(view.awayStats, result.awayStats)
  );
}
