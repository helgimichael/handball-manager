// Analysis Hub view-model assembly (HM-ANALYSIS-0.1).
//
// The one boundary between analysis domain logic and the UI. Each
// build*ViewModel function is a pure function of CareerState (plus a
// clubId/window where relevant) -- no React, no fetch, no mutation.
// Fields that can genuinely be absent are wrapped in Evidence<T> so a
// screen can never accidentally render a fabricated 0/"" in place of a
// real missing-data state (Spec §19).
import type { PlayerMatchContribution, TeamMatchStats } from "@handball-manager/game-simulation";
import { COMPETITIONS, getClub, type Club } from "../game-data";
import { getCareerSquad } from "../career/careerWorld";
import { getLastPlayedPlayerFixture, getNextPlayerFixture } from "../career/calendar";
import { getLiveStandings } from "../career/standings";
import type { CareerState, ClubFormEntry, PlayerSeasonStats } from "../career/types";
import { averageRating } from "../career/types";
import { HALF_TIME_MINUTE } from "./calibration";
import { computeHalfSplit, type HalfSplit } from "./halfSplit";
import { computeInterpretations } from "./interpretations";
import { getClubMatchHistory, sliceWindow } from "./matchHistory";
import * as metrics from "./metrics";
import { computeAllPatterns } from "./patterns";
import { detectScoringRuns, type ScoringRun } from "./scoringRuns";
import { missing, ok, type AnalysisWindow, type ClubMatchStatRow, type Evidence, type Interpretation, type MissingDataState, type ObservedPattern } from "./types";

function competitionName(competitionId: string): string {
  return COMPETITIONS.find((c) => c.id === competitionId)?.name ?? "Ligan";
}

function leaguePosition(career: CareerState, clubId: string): Evidence<number> {
  const table = getLiveStandings(career);
  const idx = table.findIndex((row) => row.clubId === clubId);
  return idx >= 0 ? ok(idx + 1) : missing("NOT_AVAILABLE_YET");
}

export interface AttackMetrics {
  goalsPerMatch: number | null;
  shotsPerMatch: number | null;
  shootingPct: number | null;
  turnoversPerMatch: number | null;
  sevenMetreConversion: number | null;
  firstHalfGoals: number;
  secondHalfGoals: number;
}

export interface DefenceMetrics {
  goalsConcededPerMatch: number | null;
  opponentShootingPct: number | null;
  savesPerMatch: number | null;
  savePct: number | null;
  twoMinPerMatch: number | null;
}

function attackMetrics(rows: readonly ClubMatchStatRow[]): AttackMetrics {
  return {
    goalsPerMatch: metrics.goalsPerMatch(rows),
    shotsPerMatch: metrics.shotsPerMatch(rows),
    shootingPct: metrics.shootingPct(rows),
    turnoversPerMatch: metrics.turnoversPerMatch(rows),
    sevenMetreConversion: metrics.sevenMetreConversion(rows),
    firstHalfGoals: metrics.firstHalfGoals(rows),
    secondHalfGoals: metrics.secondHalfGoals(rows),
  };
}

function defenceMetrics(rows: readonly ClubMatchStatRow[]): DefenceMetrics {
  return {
    goalsConcededPerMatch: metrics.goalsConcededPerMatch(rows),
    opponentShootingPct: metrics.opponentShootingPct(rows),
    savesPerMatch: metrics.savesPerMatch(rows),
    savePct: metrics.savePct(rows),
    twoMinPerMatch: metrics.twoMinPerMatch(rows),
  };
}

// ---------------------------------------------------------------- Overview

export interface OverviewViewModel {
  ownClub: Club;
  nextOpponent: Evidence<{ club: Club; date: string; isHome: boolean; form: ClubFormEntry[] }>;
  ourForm: Evidence<{ form: ClubFormEntry[]; goalsPerMatch: number | null; goalsConcededPerMatch: number | null }>;
  lastMatch: Evidence<{ fixtureId: string; opponent: Club; goalsFor: number; goalsAgainst: number; date: string }>;
  recentObservations: ObservedPattern[];
}

export function buildOverviewViewModel(career: CareerState): OverviewViewModel {
  const ownClub = getClub(career.playerClubId)!;
  const ownRows = getClubMatchHistory(career, career.playerClubId);

  const nextFixture = getNextPlayerFixture(career);
  const nextOpponent: OverviewViewModel["nextOpponent"] = nextFixture
    ? (() => {
        const isHome = nextFixture.homeClubId === career.playerClubId;
        const opponentId = isHome ? nextFixture.awayClubId : nextFixture.homeClubId;
        const opponentClub = getClub(opponentId);
        if (!opponentClub) return missing("NOT_AVAILABLE_YET");
        const opponentRows = getClubMatchHistory(career, opponentId);
        return ok({ club: opponentClub, date: nextFixture.date, isHome, form: metrics.form(sliceWindow(opponentRows, "LAST_5")) });
      })()
    : missing("NOT_AVAILABLE_YET");

  const ourForm: OverviewViewModel["ourForm"] =
    ownRows.length === 0
      ? missing("NO_MATCHES_YET")
      : ok({
          form: metrics.form(sliceWindow(ownRows, "LAST_5")),
          goalsPerMatch: metrics.goalsPerMatch(sliceWindow(ownRows, "LAST_5")),
          goalsConcededPerMatch: metrics.goalsConcededPerMatch(sliceWindow(ownRows, "LAST_5")),
        });

  const lastPlayed = getLastPlayedPlayerFixture(career);
  const lastMatch: OverviewViewModel["lastMatch"] = lastPlayed
    ? (() => {
        const isHome = lastPlayed.fixture.homeClubId === career.playerClubId;
        const opponentId = isHome ? lastPlayed.fixture.awayClubId : lastPlayed.fixture.homeClubId;
        const opponentClub = getClub(opponentId);
        if (!opponentClub) return missing("NOT_AVAILABLE_YET");
        return ok({
          fixtureId: lastPlayed.fixture.id,
          opponent: opponentClub,
          goalsFor: isHome ? lastPlayed.result.homeGoals : lastPlayed.result.awayGoals,
          goalsAgainst: isHome ? lastPlayed.result.awayGoals : lastPlayed.result.homeGoals,
          date: lastPlayed.fixture.date,
        });
      })()
    : missing("NO_MATCHES_YET");

  return { ownClub, nextOpponent, ourForm, lastMatch, recentObservations: computeAllPatterns(ownRows, career.playerClubId) };
}

// ---------------------------------------------------------------- Opponent

export interface OpponentViewModel {
  status: "OK" | MissingDataState;
  club?: Club;
  competitionName?: string;
  leaguePosition?: Evidence<number>;
  nextFixture?: Evidence<{ date: string; isHome: boolean }>;
  form?: ClubFormEntry[];
  recentMatches?: ClubMatchStatRow[];
  attack?: AttackMetrics;
  defence?: DefenceMetrics;
  /** Always NOT_AVAILABLE_YET in v0.1 -- FastMatchResult only populates player contributions for the human club's own roster (Spec §13/§19). */
  players: Evidence<never>;
  patterns: ObservedPattern[];
  interpretations: Interpretation[];
}

/** The opponent is always the manager's ACTUAL next scheduled opponent -- never hardcoded (Spec §13). Returns status "NO_MATCHES_YET"-equivalent when the season has no fixture left to analyze. */
export function buildOpponentViewModel(career: CareerState): OpponentViewModel {
  const nextFixture = getNextPlayerFixture(career);
  if (!nextFixture) {
    return { status: "NOT_AVAILABLE_YET", players: missing("NOT_AVAILABLE_YET"), patterns: [], interpretations: [] };
  }
  const isHome = nextFixture.homeClubId === career.playerClubId;
  const opponentId = isHome ? nextFixture.awayClubId : nextFixture.homeClubId;
  const club = getClub(opponentId);
  if (!club) {
    return { status: "NOT_AVAILABLE_YET", players: missing("NOT_AVAILABLE_YET"), patterns: [], interpretations: [] };
  }

  const rows = getClubMatchHistory(career, opponentId);
  const recentRows = sliceWindow(rows, "LAST_5");
  const patterns = computeAllPatterns(rows, opponentId);

  return {
    status: "OK",
    club,
    competitionName: competitionName(club.competitionId),
    leaguePosition: leaguePosition(career, opponentId),
    nextFixture: ok({ date: nextFixture.date, isHome: !isHome }), // from the opponent's own home/away perspective
    form: metrics.form(recentRows),
    recentMatches: recentRows,
    attack: rows.length > 0 ? attackMetrics(recentRows) : undefined,
    defence: rows.length > 0 ? defenceMetrics(recentRows) : undefined,
    players: missing("NOT_AVAILABLE_YET"),
    patterns,
    interpretations: computeInterpretations(patterns, opponentId),
  };
}

// ---------------------------------------------------------------- Our Team

export interface PlayerProductionRow {
  playerId: string;
  name: string;
  position: string;
  appearances: number;
  goals: number;
  goalsPerMatch: number | null;
  averageRating: number;
}

export interface GoalkeeperRow {
  playerId: string;
  name: string;
  appearances: number;
  saves: number;
  shotsFaced: number;
  savePct: number | null;
  savesPerMatch: number | null;
}

export interface OurTeamViewModel {
  club: Club;
  window: AnalysisWindow;
  status: "OK" | MissingDataState;
  form?: ClubFormEntry[];
  goalDifference?: number;
  attack?: AttackMetrics;
  defence?: DefenceMetrics;
  players: PlayerProductionRow[];
  goalkeepers: GoalkeeperRow[];
  patterns: ObservedPattern[];
  interpretations: Interpretation[];
}

/** `window` is either LAST_5 or SEASON (Spec §8/UI: "LAST 5 | SEASON" toggle) -- any other window collapses to SEASON. */
export function buildOurTeamViewModel(career: CareerState, window: AnalysisWindow = "LAST_5"): OurTeamViewModel {
  const club = getClub(career.playerClubId)!;
  const rows = getClubMatchHistory(career, career.playerClubId);
  const effectiveWindow: AnalysisWindow = window === "LAST_5" ? "LAST_5" : "SEASON";
  const windowRows = sliceWindow(rows, effectiveWindow);
  const patterns = computeAllPatterns(rows, career.playerClubId);

  const squad = getCareerSquad(career);
  const players: PlayerProductionRow[] = [];
  const goalkeepers: GoalkeeperRow[] = [];
  for (const player of squad) {
    const stats: PlayerSeasonStats | undefined = career.playerSeasonStats[player.id];
    if (!stats || stats.appearances === 0) continue;
    if (player.position === "MV") {
      goalkeepers.push({
        playerId: player.id,
        name: `${player.firstName} ${player.lastName}`,
        appearances: stats.appearances,
        saves: stats.saves,
        shotsFaced: stats.shotsFaced,
        savePct: stats.shotsFaced > 0 ? stats.saves / stats.shotsFaced : null,
        savesPerMatch: stats.appearances > 0 ? stats.saves / stats.appearances : null,
      });
    } else {
      players.push({
        playerId: player.id,
        name: `${player.firstName} ${player.lastName}`,
        position: player.position,
        appearances: stats.appearances,
        goals: stats.goals,
        goalsPerMatch: stats.appearances > 0 ? stats.goals / stats.appearances : null,
        averageRating: averageRating(stats),
      });
    }
  }

  if (rows.length === 0) {
    return { club, window: effectiveWindow, status: "NO_MATCHES_YET", players: [], goalkeepers: [], patterns: [], interpretations: [] };
  }

  return {
    club,
    window: effectiveWindow,
    status: "OK",
    form: metrics.form(windowRows),
    goalDifference: metrics.goalDifference(windowRows),
    attack: attackMetrics(windowRows),
    defence: defenceMetrics(windowRows),
    players: players.sort((a, b) => b.goals - a.goals),
    goalkeepers,
    patterns,
    interpretations: computeInterpretations(patterns, career.playerClubId),
  };
}

// ---------------------------------------------------------------- Last Match

export interface LastMatchViewModel {
  status: "OK" | "NO_MATCHES_YET";
  fixtureId?: string;
  date?: string;
  competitionName?: string;
  homeClub?: Club;
  awayClub?: Club;
  homeGoals?: number;
  awayGoals?: number;
  isPlayerHome?: boolean;
  teamComparison?: { us: TeamMatchStats; opponent: TeamMatchStats };
  halfSplit?: { firstHalf: HalfSplit; secondHalf: HalfSplit };
  scoringRuns?: ScoringRun[];
  ownPlayerProduction: Evidence<readonly PlayerMatchContribution[]>;
  opponentPlayerProduction: Evidence<readonly PlayerMatchContribution[]>;
  timeline?: FastMatchResultEvents;
  patterns: ObservedPattern[];
  interpretations: Interpretation[];
}

type FastMatchResultEvents = CareerState["results"][string]["events"];

/** The manager's actual latest completed match -- never a hypothetical or hardcoded one (Spec §15). */
export function buildLastMatchViewModel(career: CareerState): LastMatchViewModel {
  const played = getLastPlayedPlayerFixture(career);
  if (!played) {
    return { status: "NO_MATCHES_YET", ownPlayerProduction: missing("NO_MATCHES_YET"), opponentPlayerProduction: missing("NO_MATCHES_YET"), patterns: [], interpretations: [] };
  }
  const { fixture, result } = played;
  const isPlayerHome = fixture.homeClubId === career.playerClubId;
  const homeClub = getClub(fixture.homeClubId);
  const awayClub = getClub(fixture.awayClubId);
  const us = isPlayerHome ? result.homeStats : result.awayStats;
  const opponent = isPlayerHome ? result.awayStats : result.homeStats;
  const ownContributions = isPlayerHome ? result.homePlayerContributions : result.awayPlayerContributions;
  const opponentContributions = isPlayerHome ? result.awayPlayerContributions : result.homePlayerContributions;

  const rows = getClubMatchHistory(career, career.playerClubId);
  const patterns = computeAllPatterns(rows, career.playerClubId);

  return {
    status: "OK",
    fixtureId: fixture.id,
    date: fixture.date,
    competitionName: competitionName(fixture.competitionId),
    homeClub,
    awayClub,
    homeGoals: result.homeGoals,
    awayGoals: result.awayGoals,
    isPlayerHome,
    teamComparison: { us, opponent },
    halfSplit: computeHalfSplit(result),
    scoringRuns: detectScoringRuns(result.events),
    ownPlayerProduction: ownContributions.length > 0 ? ok(ownContributions) : missing("NOT_AVAILABLE_YET"),
    // HM-MATCH-0.2: the manager's own fixture now provides a roster for
    // BOTH clubs (matchdayAction.ts/tacticalMidMatchChange.ts), so this is
    // no longer structurally always empty -- it only falls back to
    // NOT_AVAILABLE_YET for fixtures simulated before that milestone, or
    // ones with no opponent squad snapshot at all.
    opponentPlayerProduction: opponentContributions.length > 0 ? ok(opponentContributions) : missing("NOT_AVAILABLE_YET"),
    timeline: result.events,
    patterns,
    interpretations: computeInterpretations(patterns, career.playerClubId),
  };
}

export { HALF_TIME_MINUTE };
