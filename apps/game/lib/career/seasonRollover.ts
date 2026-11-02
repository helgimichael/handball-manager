import { emptyMatchFitnessLedger, PRESEASON_MATCH_FITNESS } from "../players/matchFitness";
import { getLiveStandings } from './standings';
import type { CareerState } from './types';
import { buildNewSeasonCalendar } from '../competition/seasonCalendar';
import { competitionTable, hasLeagueCalendar } from '../competition/tables';
import { ALLSVENSKAN, DIVISION_1, HANDBOLLSLIGAN } from '../competition/rules';
import { CLUBS } from '../game-data';
import { recordSeasonQuietly } from '../manager/managerCareer';
import { clubCompetitionId } from './competitionMembership';
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

/**
 * HM-ALPHA3-M10: Division 1 groups are drawn again each season. Relegated
 * clubs used to all land in one group, so over a few seasons the groups
 * drifted apart (10 and 14 clubs after four seasons) until one was odd --
 * harmless while Division 1 is not simulated, but a manager relegated into
 * an odd group could not get a fixture list. The groups are evened out,
 * moving the newest arrivals first; the manager's club is never moved.
 */
function balanceDivisionOne(membership: Record<string, string>, arrivals: readonly string[], playerClubId: string): Record<string, string> {
  const next = { ...membership };
  const groupOf = (id: string) => next[id] ?? CLUBS.find((c) => c.id === id)?.competitionId;
  const members = (g: string) => CLUBS.filter((c) => groupOf(c.id) === g).map((c) => c.id);
  for (let guard = 0; guard < 24; guard++) {
    const [small, large] = [...DIVISION_1].sort((a, b) => members(a).length - members(b).length);
    if (members(large!).length - members(small!).length <= 1) break;
    const movable = members(large!).filter((id) => id !== playerClubId);
    const pick = arrivals.find((id) => movable.includes(id)) ?? movable.sort().at(-1);
    if (!pick) break;
    next[pick] = small!;
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
  const moved = outcome ? repairedNextMembership(state, outcome) : {};
  const arrivals = Object.entries(moved).filter(([, to]) => (DIVISION_1 as readonly string[]).includes(to)).map(([id]) => id);
  const competitionMembership = balanceDivisionOne({ ...state.competitionMembership, ...moved }, arrivals, state.playerClubId);
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
    // HM-PLAYTEST-01 3.2: a summer without competitive games. Last season's
    // sharpness does not carry into the new preseason.
    playerMatchFitness: emptyMatchFitnessLedger(PRESEASON_MATCH_FITNESS),
    leagueKickoffDate: kickoff,
    seasonStartDate: state.gameDate,
    seasonHistory: [...(state.seasonHistory ?? []), archived],
    careerEvents: state.careerEvents.map(e => ({ ...e, resolved: true })),
    inbox: state.inbox.map(m => ({ ...m, actionRequired: false, resolved: true })),
  };
  return buildNewSeasonCalendar(next, kickoff);
}
