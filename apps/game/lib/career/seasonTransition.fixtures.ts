/** Synthetic integration fixtures only. NOT a Swedish competition profile or real qualification evidence. */
import type { FastMatchResult, TeamMatchStats } from '@handball-manager/game-simulation';
import { createNewCareerState } from './newCareer';
import { migrateCareerState } from './saveMigration';
import { snapshotGameplayRatings, snapshotWorldSquads } from '../gameWorld/serverSnapshot';
import type { CareerFixture, CareerState } from './types';
import type { CompetitionTie } from '../competition/types';
import { KVAL_HBL, KVAL_HBL_RULES } from '../competition/rules';
import { competitionTable } from '../competition/tables';
import { CLUBS } from '../game-data';
import { SWEDISH_2026_RULES, SWEDISH_FAMILIES as F, SWEDISH_LEAGUES as L } from '../competition/transition/sweden2026';
import type { CompetitionRules, QualificationFixture } from '../competition/transition/types';
import { snapshotCompetitionTransitionInput } from '../competition/transition/careerSnapshot';
import { previewSeasonTransition } from '../competition/transition/preview';
import { buildNewSeasonCalendar } from '../competition/seasonCalendar';
import type { SeasonTransitionRequest } from './seasonTransition';

export function syntheticClosedRules(year = 2026): CompetitionRules {
  const ids: string[] = [L.hbl, L.allsvenskan];
  return {
    ...SWEDISH_2026_RULES, id: `synthetic-closed-two-tier-${year}`, seasonId: `${year}/${String(year+1).slice(-2)}`, nextSeasonId: `${year+1}/${String(year+2).slice(-2)}`,
    families: SWEDISH_2026_RULES.families.filter((f) => [F.hbl, F.allsvenskan].includes(f.id as typeof F.hbl)),
    leagues: SWEDISH_2026_RULES.leagues.filter((l) => ids.includes(l.id)),
    entries: SWEDISH_2026_RULES.entries.filter((e) => e.selector.kind === 'RANK' && ids.includes(e.selector.competitionId)).map((e) => e.selector.kind === 'RANK' && e.selector.competitionId === L.allsvenskan && e.selector.rank >= 11 ? { ...e, purpose: 'RETAIN', targetFamilyId: F.allsvenskan, eligibility: false, replacement: 'NONE', source: { url: 'synthetic:test-only', section: 'Closed lower boundary; not Swedish regulations' } } : e),
    stages: SWEDISH_2026_RULES.stages.filter((s) => s.id.startsWith('hbl-')),
    limitations: [],
  };
}

export function completeSyntheticSeason(state: CareerState): CareerState {
  const stats = (goals: number): TeamMatchStats => ({ goals, shots: 40, shootingPct: goals / 40, saves: 10, shotsFaced: 40, turnovers: 5, twoMinuteSuspensions: 0, sevenMetreGoals: 0, sevenMetreAttempts: 0 });
  const results: Record<string, FastMatchResult> = {};
  for (const f of state.fixtures) {
    const homeGoals = f.homeClubId < f.awayClubId ? 30 : 20, awayGoals = 50-homeGoals;
    results[f.id] = { fixtureId: f.id, seed: 1, homeClubId: f.homeClubId, awayClubId: f.awayClubId, homeGoals, awayGoals, homeStats: stats(homeGoals), awayStats: stats(awayGoals), events: [], homePlayerContributions: [], awayPlayerContributions: [] };
  }
  return { ...state, results, seasonComplete: true, gameDate: `${Number(state.seasonId.slice(0,4))+1}-05-01`, productionMatch: null, activeMatchSession: null, ...(state.seasonOutcome ? { seasonOutcome: { ...state.seasonOutcome, phase: 'COMPLETE' } } : {}) };
}

export function syntheticTransitionCareer(): CareerState {
  const manager = CLUBS.filter((c) => c.competitionId === L.allsvenskan).map((c) => c.id).sort()[0]!;
  const squads = { ...snapshotWorldSquads(L.hbl), ...snapshotWorldSquads(L.allsvenskan) };
  const ratings = { ...snapshotGameplayRatings(L.hbl), ...snapshotGameplayRatings(L.allsvenskan) };
  const state = migrateCareerState(createNewCareerState('atomic-transition-synthetic', manager, squads, undefined, ratings));
  return completeSyntheticSeason(buildNewSeasonCalendar(state, '2026-09-20', [L.hbl, L.allsvenskan]));
}

export function syntheticTransitionRequest(state: CareerState): SeasonTransitionRequest {
  const year = Number(state.seasonId.slice(0,4));
  const rules = syntheticClosedRules(year);
  const tables = snapshotCompetitionTransitionInput(state, {}, rules).standings;
  const eligibility = tables.flatMap((t) => t.rows.flatMap((row) => rules.families.map((f) => ({ clubId: row.clubId, targetFamilyId: f.id, seasonId: state.seasonId, status: 'ELIGIBLE' as const, evidence: 'Synthetic test acceptance/licensing only.' }))));
  const pending = previewSeasonTransition(snapshotCompetitionTransitionInput(state, { eligibility }, rules));
  const qualificationFixtures: QualificationFixture[] = pending.proposal.qualification.flatMap((s) => s.unresolvedFixtures.slice(0,3).map((g) => {
    // In this synthetic example each challenger wins all three games, using the verified home order.
    const winner = s.participants[1];
    return { id: `${state.seasonId}:${s.stageId}:${g.game}`, stageId: s.stageId, seasonId: state.seasonId, game: g.game, homeClubId: g.homeClubId!, awayClubId: g.awayClubId!, result: { homeGoals: winner === g.homeClubId ? 30 : 20, awayGoals: winner === g.awayClubId ? 30 : 20, origin: 'CAREER_SIMULATED', evidence: 'Explicit synthetic fixture; not a real-world result.' } };
  }));
  return { fromSeasonId: state.seasonId, rules, evidence: { eligibility, qualificationFixtures }, nextSeason: { rules: syntheticClosedRules(year+1), kickoffDate: `${year+1}-09-20`, evidence: 'Synthetic complete next-season calendar profile only.' } };
}

// HM-M9: KVAL_HBL series in exactly the live engine's format (competition/season.ts tieFixtures).
const kvalStats = (goals: number): TeamMatchStats => ({ goals, shots: 40, shootingPct: goals / 40, saves: 10, shotsFaced: 40, turnovers: 5, twoMinuteSuspensions: 0, sevenMetreGoals: 0, sevenMetreAttempts: 0 });
const kvalResult = (f: CareerFixture, homeGoals: number, awayGoals: number, decider?: FastMatchResult["decider"]): FastMatchResult => ({ fixtureId: f.id, seed: 1, homeClubId: f.homeClubId, awayClubId: f.awayClubId, homeGoals, awayGoals, homeStats: kvalStats(homeGoals), awayStats: kvalStats(awayGoals), events: [], homePlayerContributions: [], awayPlayerContributions: [], ...(decider ? { decider } : {}) });

/**
 * Adds the three KVAL_HBL series as the live engine would have played them:
 * HBL 11-13 (high) v Allsvenskan 4-2 (low), home pattern LOW,HIGH,HIGH,...
 * `challengersWin` decides every series 3-0 for one side. Game 1 of K1 is a
 * level score settled by a shoot-out, to exercise the decider path.
 */
export function withSyntheticLiveKval(state: CareerState, challengersWin: boolean): CareerState {
  const hbl = competitionTable(state, L.hbl).map((r) => r.clubId);
  const allsv = competitionTable(state, L.allsvenskan).map((r) => r.clubId);
  let next = state;
  KVAL_HBL_RULES.pairs.forEach(([h, a], i) => {
    const high = hbl[h - 1]!, low = allsv[a - 1]!;
    const winner = challengersWin ? low : high;
    const tieId = `${state.seasonId}:kval-hbl:K${i + 1}`;
    const fixtures: CareerFixture[] = KVAL_HBL_RULES.series.homePattern.slice(0, 3).map((side, k) => {
      const home = side === "HIGH" ? high : low;
      return { id: `2027-kval-K${i + 1}-g${k + 1}`, competitionId: KVAL_HBL, round: k + 1, date: `2027-04-${10 + k}`, homeClubId: home, awayClubId: home === high ? low : high, type: "QUALIFIER", stage: { tieId, game: k + 1, mustDecide: true } };
    });
    const results = Object.fromEntries(fixtures.map((f, k) => {
      if (i === 0 && k === 0) return [f.id, kvalResult(f, 25, 25, { overtime: { home: 2, away: 2 } as never, shootout: { home: 3, away: 2, kicks: [] } as never, winnerClubId: winner, method: "SHOOTOUT" } as never)];
      return [f.id, f.homeClubId === winner ? kvalResult(f, 28, 24) : kvalResult(f, 24, 28)];
    }));
    const tie: CompetitionTie = { id: tieId, seasonId: state.seasonId, competitionId: KVAL_HBL, stage: "KVAL_HBL", label: `Kval ${i + 1}`, highClubId: high, lowClubId: low, format: { kind: "SERIES", series: KVAL_HBL_RULES.series }, fixtureIds: fixtures.map((f) => f.id), key: `K${i + 1}`, winnerClubId: winner, loserClubId: winner === high ? low : high, stakes: { highCompetitionId: L.hbl, lowCompetitionId: L.allsvenskan } } as CompetitionTie;
    next = { ...next, fixtures: [...next.fixtures, ...fixtures], results: { ...next.results, ...results }, competitionTies: { ...next.competitionTies, [tie.id]: tie } };
  });
  return next;
}

