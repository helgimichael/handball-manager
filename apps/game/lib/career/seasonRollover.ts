import { generateDoubleRoundRobin } from '@handball-manager/game-simulation';
import { getLiveStandings } from './standings';
import type { CareerState } from './types';

/** Starts the next calendar while keeping the offseason days in the daily world tick.
 * Contracts, ageing, medical recovery and transfers are not skipped by a date jump.
 * League membership stays unchanged in this first playable league format.
 */
export function rolloverSeason(state: CareerState): CareerState {
  if (!state.seasonComplete || state.productionMatch) return state;
  const year = Number(state.seasonId.slice(0, 4)) + 1;
  const seasonId = `${year}/${String(year + 1).slice(-2)}`;
  const clubIds = [...new Set(state.fixtures.filter(f => f.type === 'LEAGUE').flatMap(f => [f.homeClubId, f.awayClubId]))];
  const kickoff = `${year}-09-20`;
  const fixtures = generateDoubleRoundRobin({ competitionId: state.competitionId, clubIds, seasonStartDate: kickoff, daysBetweenRounds: 7 }).map(f => ({ ...f, id: `${year}-${f.id}`, type: 'LEAGUE' as const }));
  return { ...state, seasonId, seasonComplete: false, fixtures, results: {}, physicalReports: {}, playerSeasonStats: {}, clubForm: {}, matchPlans: {}, liveMatchPlans: {}, matchPlanChangeHistory: {}, activeMatchSession: null, productionMatch: null, leagueKickoffDate: kickoff, seasonStartDate: state.gameDate, seasonHistory: [...(state.seasonHistory ?? []), { seasonId: state.seasonId, competitionId: state.competitionId, table: getLiveStandings(state), stats: state.playerSeasonStats }], careerEvents: state.careerEvents.map(e => ({ ...e, resolved: true })), inbox: state.inbox.map(m => ({ ...m, actionRequired: false, resolved: true })) };
}
