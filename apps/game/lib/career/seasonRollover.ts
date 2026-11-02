import { getLiveStandings } from './standings';
import type { CareerState } from './types';
import { buildNewSeasonCalendar } from '../competition/seasonCalendar';
import { competitionTable, hasLeagueCalendar } from '../competition/tables';
import { ALLSVENSKAN, HANDBOLLSLIGAN } from '../competition/rules';

/** Starts the next calendar while keeping the offseason days in the daily world tick.
 * Contracts, ageing, medical recovery and transfers are not skipped by a date jump.
 *
 * HM-ALPHA3-M03: promotion and relegation decided by the postseason
 * (seasonOutcome.nextMembership) take effect here -- the manager's club may
 * change league -- and both Swedish leagues are built for the new season
 * (Svenska cupen follows on the first processed day). The finished season
 * is archived with its outcome, both final tables and every knockout tie.
 */
export function rolloverSeason(state: CareerState): CareerState {
  if (!state.seasonComplete || state.productionMatch) return state;
  const year = Number(state.seasonId.slice(0, 4)) + 1;
  const seasonId = `${year}/${String(year + 1).slice(-2)}`;
  const kickoff = `${year}-09-20`;
  const outcome = state.seasonOutcome?.seasonId === state.seasonId ? state.seasonOutcome : undefined;
  const competitionMembership = { ...state.competitionMembership, ...(outcome?.nextMembership ?? {}) };
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
  const next: CareerState = {
    ...state,
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
