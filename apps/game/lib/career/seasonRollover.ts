import { getLiveStandings } from './standings';
import type { CareerState } from './types';
import { buildNewSeasonCalendar } from '../competition/seasonCalendar';
import { competitionTable, hasLeagueCalendar } from '../competition/tables';
import { ALLSVENSKAN, HANDBOLLSLIGAN } from '../competition/rules';
import { recordSeasonQuietly } from '../manager/managerCareer';
import { clubCompetitionId } from './competitionMembership';
import { latestSavedPlan } from './manualLineup';
import type { SeasonOutcome } from '../competition/types';
import { compactCareerHistory } from './historyCompaction';

/**
 * HM-ALPHA3-M10: the loser of an Allsvenskan relegation play-off goes to the
 * Division 1 group the challenger actually played in this season. Saves made
 * before the fix recorded the challenger's catalogue league instead, which
 * kept the loser in Allsvenskan (15 clubs) and stopped the next season.
 */
function repairedNextMembership(state: CareerState, outcome: SeasonOutcome): Record<string, string> {
  const next = { ...outcome.nextMembership };
  for (const tie of Object.values(state.competitionTies ?? {})) {
    if (tie.seasonId !== state.seasonId || tie.stage !== 'KVAL_ALLSV' || !tie.stakes || !tie.winnerClubId || !tie.loserClubId) continue;
    const division = clubCompetitionId(state, tie.lowClubId);
    if (!division || division === ALLSVENSKAN) continue;
    next[tie.winnerClubId] = ALLSVENSKAN;
    next[tie.loserClubId] = division;
  }
  return next;
}

/** Starts the next calendar while keeping the offseason days in the daily world tick.
 * Contracts, ageing, medical recovery and transfers are not skipped by a date jump.
 *
 * HM-ALPHA3-M03: promotion and relegation decided by the postseason
 * (seasonOutcome.nextMembership) take effect here -- the manager's club may
 * change league -- and both Swedish leagues are built for the new season
 * (Svenska cupen follows on the first processed day). The finished season
 * is archived with its outcome, both final tables and every knockout tie.
 */
export function rolloverSeason(input: CareerState): CareerState {
  if (!input.seasonComplete || input.productionMatch) return input;
  // HM-ALPHA3-M07: a season that ended before the board existed is recorded in the career, quietly (no review, no dismissal).
  // Seasons played with M07 were already reviewed on their last day.
  // HM-ALPHA3-M10: trim the working records that only matter while recent (historyCompaction.ts).
  const state = compactCareerHistory(recordSeasonQuietly(input), input.gameDate);
  const year = Number(state.seasonId.slice(0, 4)) + 1;
  const seasonId = `${year}/${String(year + 1).slice(-2)}`;
  const kickoff = `${year}-09-20`;
  const outcome = state.seasonOutcome?.seasonId === state.seasonId ? state.seasonOutcome : undefined;
  const competitionMembership = { ...state.competitionMembership, ...(outcome ? repairedNextMembership(state, outcome) : {}) };
  const competitionId = competitionMembership[state.playerClubId] ?? state.competitionId;
  const tables = Object.fromEntries([HANDBOLLSLIGAN, ALLSVENSKAN].filter((c) => hasLeagueCalendar(state, c)).map((c) => [c, competitionTable(state, c)]));
  const archived = {
    seasonId: state.seasonId,
    competitionId: state.competitionId,
    table: getLiveStandings(state),
    stats: state.playerSeasonStats,
    ...(outcome ? { outcome } : {}),
    tables,
    ties: Object.values(state.competitionTies ?? {}),
  };
  // HM-ALPHA3-M10: the manager's last selection carries into the new season as the preferred lineup.
  const lastFixture = [...state.fixtures].filter((f) => state.matchPlans[f.id]?.squad.players.length).sort((a, b) => b.date.localeCompare(a.date))[0];
  const preferredLineup = lastFixture ? state.matchPlans[lastFixture.id] : state.preferredLineup;
  const next: CareerState = {
    ...state,
    ...(preferredLineup ? { preferredLineup } : {}),
    seasonId,
    competitionId,
    competitionMembership,
    seasonComplete: false,
    results: {},
    physicalReports: {},
    playerSeasonStats: {},
    clubForm: {},
    matchPlans: {},
    liveMatchPlans: {},
    matchPlanChangeHistory: {},
    activeMatchSession: null,
    productionMatch: null,
    leagueKickoffDate: kickoff,
    seasonStartDate: state.gameDate,
    seasonHistory: [...(state.seasonHistory ?? []), archived],
    careerEvents: state.careerEvents.map(e => ({ ...e, resolved: true })),
    inbox: state.inbox.map(m => ({ ...m, actionRequired: false, resolved: true })),
  };
  return buildNewSeasonCalendar(next, kickoff);
}
