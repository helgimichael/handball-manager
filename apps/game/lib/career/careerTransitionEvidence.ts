// HM-M9B: live season evidence for the atomic season transition.
//
// The live season engine (competition/season.ts) plays the whole sporting
// season -- both leagues, SM-slutspel, kval, cup -- but the atomic transition
// (seasonTransition.ts) only accepts explicit evidence, which nothing in the
// game supplied, so no career could reach season 2. This module is that
// missing link: it reads the COMPLETED career season and hands the existing
// planner exactly what happened.
//
// Nothing here re-decides a sporting result:
//   * Standings: the planner rebuilds raw totals from the career's own league
//     results (careerSnapshot.ts). Where clubs are level on points, goal
//     difference and goals, the order the live engine itself used (its
//     head-to-head mini-table and seeded lot, competition/tables.ts) is
//     supplied as the ruling, so the planner's ranks are the live table's ranks
//     -- the same ranks the live engine drew the kval pairs from.
//   * Qualification: the KVAL_HBL series the live engine played, game by game,
//     with their actual home/away order and scores (overtime goals included;
//     a shoot-out as the terminal decider).
//   * Licences: owner decision D3, every active club is licensed, through a
//     single hook a future licensing system can replace.
//   * Next season: the manager-mode package for the following year, and a
//     kickoff derived from this season's own calendar (owner decision D2).
//
// Deterministic: the same completed season always yields the same request.
import type { CareerState } from "./types";
import { competitionTable, hasLeagueCalendar } from "../competition/tables";
import { HANDBOLLSLIGAN, ALLSVENSKAN, KVAL_HBL_RULES } from "../competition/rules";
import { snapshotCompetitionTransitionInput } from "../competition/transition/careerSnapshot";
import { managerModeRules, type ManagerModePackageOptions } from "../competition/transition/careerRules";
import type { CompetitionRules, EligibilityDecision, QualificationFixture, RankingDecision } from "../competition/transition/types";
import { attemptSeasonTransition, type SeasonTransitionRequest, type SeasonTransitionResult } from "./seasonTransition";
import { SeasonTransitionBlockedError } from "./seasonRollover";
import { clubCompetitionId } from "./competitionMembership";
import { CLUBS } from "../game-data";

const LIVE_EVIDENCE = "Manager mode: played in this career by the live season engine (competition/season.ts).";

/** The season's start year, e.g. 2026 for "2026/27". */
function startYear(seasonId: string): number {
  return Number(seasonId.slice(0, 4));
}

// ---------------------------------------------------------------------------
// Licences (owner decision D3)
// ---------------------------------------------------------------------------

export type ManagerModeLicenceStatus = EligibilityDecision["status"];

/**
 * The single licence hook. Manager mode has no licensing model, so every active
 * club is licensed for every division it can reach. A future licensing system
 * replaces this function; a missing decision never blocks a transition.
 */
export function managerModeLicence(state: CareerState, clubId: string, targetFamilyId: string): { status: ManagerModeLicenceStatus; evidence: string } {
  void state; void clubId; void targetFamilyId; // the inputs a future licensing system decides on
  return { status: "ELIGIBLE", evidence: "Manager mode (owner decision D3): every active club is licensed." };
}

function licenceDecisions(state: CareerState, rules: CompetitionRules, clubIds: readonly string[]): EligibilityDecision[] {
  return clubIds.flatMap((clubId) => rules.families.map((family) => {
    const licence = managerModeLicence(state, clubId, family.id);
    return { clubId, targetFamilyId: family.id, seasonId: rules.seasonId, status: licence.status, evidence: licence.evidence };
  }));
}

// ---------------------------------------------------------------------------
// Standings: the live engine's own tie order where raw totals are level
// ---------------------------------------------------------------------------

function liveRankingDecisions(state: CareerState, rules: CompetitionRules): Record<string, RankingDecision[]> {
  const tables = snapshotCompetitionTransitionInput(state, {}, rules).standings;
  const out: Record<string, RankingDecision[]> = {};
  for (const table of tables) {
    const liveOrder = competitionTable(state, table.competitionId).map((r) => r.clubId);
    const key = (r: (typeof table.rows)[number]) => `${r.points}:${r.goalDifference}:${r.goalsFor}`;
    const groups = new Map<string, string[]>();
    for (const row of table.rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row.clubId]);
    const decisions: RankingDecision[] = [];
    for (const ids of groups.values()) {
      if (ids.length < 2) continue;
      const ordered = [...ids].sort((a, b) => liveOrder.indexOf(a) - liveOrder.indexOf(b));
      decisions.push({ kind: "ORGANIZER_RULING", orderedClubIds: ordered, evidence: "Manager mode: the live table's head-to-head mini-table and seeded lot (competition/tables.ts) -- the order the live engine drew its postseason from." });
    }
    if (decisions.length) out[table.competitionId] = decisions;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Qualification: the KVAL_HBL series the live engine played
// ---------------------------------------------------------------------------

function liveQualificationFixtures(state: CareerState, rules: CompetitionRules): QualificationFixture[] {
  const out: QualificationFixture[] = [];
  const ties = Object.values(state.competitionTies ?? {}).filter((t) => t.seasonId === state.seasonId && t.stage === "KVAL_HBL");
  for (const tie of ties) {
    const index = Number(tie.key.replace(/^K/, "")) - 1;
    const pair = KVAL_HBL_RULES.pairs[index];
    if (!pair) continue;
    const stageId = `hbl-${pair[0]}`;
    if (!rules.stages.some((s) => s.id === stageId)) continue;
    for (const fixtureId of tie.fixtureIds) {
      const fixture = state.fixtures.find((f) => f.id === fixtureId);
      if (!fixture?.stage) continue;
      const result = state.results[fixtureId];
      const level = result ? result.homeGoals === result.awayGoals : false;
      out.push({
        id: fixtureId,
        stageId,
        seasonId: rules.seasonId,
        game: fixture.stage.game,
        homeClubId: fixture.homeClubId,
        awayClubId: fixture.awayClubId,
        ...(result ? {
          result: {
            homeGoals: result.homeGoals,
            awayGoals: result.awayGoals,
            origin: "CAREER_SIMULATED" as const,
            evidence: `${LIVE_EVIDENCE} Fixture ${fixtureId}.`,
            // Overtime goals are already in the score; only a level score needs the observed shoot-out winner.
            ...(level && result.decider ? { decider: { winnerClubId: result.decider.winnerClubId, evidence: `Live ${result.decider.method.toLowerCase()} decider.` } } : {}),
          },
        } : {}),
      });
    }
  }
  return out.sort((a, b) => a.stageId.localeCompare(b.stageId) || a.game - b.game);
}

// ---------------------------------------------------------------------------
// Next season kickoff (owner decision D2)
// ---------------------------------------------------------------------------

function addDaysIso(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The next league kickoff, derived from THIS season's own calendar: the same
 * week of the year and the same weekday as the earliest league round of the
 * manager-mode leagues, one year later (the competition runs on an annual
 * cycle). No fixed calendar date; never before the current game date.
 */
export function deriveNextKickoffDate(state: CareerState, leagueIds: readonly string[]): string {
  const leagueDates = state.fixtures.filter((f) => f.type === "LEAGUE" && leagueIds.includes(f.competitionId)).map((f) => f.date).sort();
  const base = leagueDates[0] ?? state.leagueKickoffDate ?? state.seasonStartDate ?? state.gameDate;
  const nextYear = startYear(state.seasonId) + 1;
  const sameDay = `${nextYear}${base.slice(4)}`;
  const weekday = new Date(`${base}T00:00:00Z`).getUTCDay();
  const shift = ((weekday - new Date(`${sameDay}T00:00:00Z`).getUTCDay() + 7 + 3) % 7) - 3; // nearest same weekday, -3..+3 days
  let kickoff = addDaysIso(sameDay, shift);
  while (kickoff <= state.gameDate) kickoff = addDaysIso(kickoff, 7);
  return kickoff;
}

// ---------------------------------------------------------------------------
// The request
// ---------------------------------------------------------------------------

/** Complete double round-robin calendar with every result for `competitionId`? */
function playedCompletely(state: CareerState, competitionId: string): boolean {
  const fixtures = state.fixtures.filter((f) => f.type === "LEAGUE" && f.competitionId === competitionId);
  return fixtures.length > 0 && fixtures.every((f) => state.results[f.id]);
}

/** Which manager-mode package fits what this season actually played (M9F for legacy careers). */
export function managerModePackageOptions(state: CareerState): ManagerModePackageOptions {
  const interchangeLeagues = [HANDBOLLSLIGAN, ALLSVENSKAN].filter((id) => hasLeagueCalendar(state, id));
  const frozen = interchangeLeagues.length < 2 || !interchangeLeagues.every((id) => playedCompletely(state, id));
  const ownLeague = clubCompetitionId(state, state.playerClubId) ?? state.competitionId;
  const closedLeagues = ownLeague !== HANDBOLLSLIGAN && ownLeague !== ALLSVENSKAN && hasLeagueCalendar(state, ownLeague)
    ? [{ id: ownLeague, size: CLUBS.filter((c) => (clubCompetitionId(state, c.id) ?? c.competitionId) === ownLeague).length }]
    : [];
  return { frozen, interchangeLeagues, closedLeagues };
}

/** The full transition request for a completed career season, built only from that season. */
export function buildCareerTransitionRequest(state: CareerState): SeasonTransitionRequest {
  const options = managerModePackageOptions(state);
  const year = startYear(state.seasonId);
  const rules = managerModeRules(year, options);
  const tables = snapshotCompetitionTransitionInput(state, {}, rules).standings;
  const clubIds = tables.flatMap((t) => t.rows.map((r) => r.clubId));
  const qualificationFixtures = liveQualificationFixtures(state, rules);
  const rankingDecisions = liveRankingDecisions(state, rules);
  const kickoffDate = deriveNextKickoffDate(state, rules.leagues.map((l) => l.id));
  return {
    fromSeasonId: state.seasonId,
    rules,
    evidence: {
      eligibility: licenceDecisions(state, rules, clubIds),
      ...(qualificationFixtures.length ? { qualificationFixtures } : {}),
      ...(Object.keys(rankingDecisions).length ? { rankingDecisions } : {}),
    },
    nextSeason: {
      rules: managerModeRules(year + 1, options),
      kickoffDate,
      evidence: `Manager mode (owner decision D2): kickoff derived from this season's own league calendar -- the same week and weekday one year later (${kickoffDate}).`,
    },
  };
}

/**
 * The manager-mode season transition: the existing atomic transaction, fed by
 * the completed season itself. BLOCKED returns the untouched career and the
 * exact dependencies (a recoverable result, never a partial write).
 */
export function transitionCareerSeason(state: CareerState): SeasonTransitionResult {
  if (!state.seasonComplete) return attemptSeasonTransition(state);
  let request: SeasonTransitionRequest;
  try {
    request = buildCareerTransitionRequest(state);
  } catch (error) {
    // Never a partial write: an evidence failure is a recoverable, explicit block on the untouched career.
    return { status: "BLOCKED", state, blockers: [{ code: "CAREER_EVIDENCE_FAILED", ref: state.seasonId, status: "BLOCKED", message: error instanceof Error ? error.message : "Transition evidence could not be built from this season." }] };
  }
  return attemptSeasonTransition(state, request);
}

/** Script API: the manager-mode rollover, throwing the structured blockers when the season cannot advance. */
export function rolloverCareerSeason(state: CareerState): CareerState {
  if (!state.seasonComplete || state.productionMatch || state.activeMatchSession) return state;
  const result = transitionCareerSeason(state);
  if (result.status === "BLOCKED") throw new SeasonTransitionBlockedError(result);
  return result.state;
}
