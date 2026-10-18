import { createMatch } from '@handball-manager/handball-engine/src/v2/core/match';
import { advanceCoreMutable } from '@handball-manager/handball-engine/src/v2/core/engine';
import { ledger, lossClassOf } from '@handball-manager/handball-engine/src/v2/core/ledger';
import { possessionEconomy } from './lib/possessionEconomy';
import { readOrdinaryFreeThrows } from '../lib/matchCenter/freeThrows';
import type { CoreState, CoreEvent } from '@handball-manager/handball-engine/src/v2/core/state';

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  const weight = idx - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function stats(values: number[]) {
  if (values.length === 0) return { n: 0, mean: 0, median: 0, p25: 0, p75: 0, p90: 0, min: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;
  const median = percentile(sorted, 0.5);
  const p25 = percentile(sorted, 0.25);
  const p75 = percentile(sorted, 0.75);
  const p90 = percentile(sorted, 0.90);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  return { n: sorted.length, mean: Number(mean.toFixed(2)), median: Number(median.toFixed(2)), p25: Number(p25.toFixed(2)), p75: Number(p75.toFixed(2)), p90: Number(p90.toFixed(2)), min: Number(min.toFixed(2)), max: Number(max.toFixed(2)) };
}

async function run() {
  const seeds = [101, 202, 303, 404, 505];
  console.log(`Simulating ${seeds.length} matches with current engine...`);

  type MatchData = {
    seed: number;
    homeGoals: number;
    awayGoals: number;
    totalGoals: number;
    totalShots: number;
    broadBallLosses: number;
    ordinaryFreeThrows: number;
    transitionShots: number;
    transitionGoals: number;
    sevenMetres: number;
    twoMinSuspensions: number;
    possessionsCount: number;
    possessions: Array<{
      id: string;
      team: string;
      duration: number;
      isSettled: boolean;
      isTransition: boolean;
      hasShot: boolean;
      isTurnover: boolean;
      freeThrows: number;
      has7m: boolean;
      ending: string;
      eventsSummary: string;
    }>;
  };

  const matches: MatchData[] = [];

  for (const seed of seeds) {
    const s = createMatch(seed, 'TOP');
    while (s.status === 'RUNNING') {
      advanceCoreMutable(s);
    }

    const econ = possessionEconomy(s);
    const book = ledger(s);
    const ftRead = readOrdinaryFreeThrows(s.events, { source: 'LIVE', behaviorRevision: 'career-physical-load-v11', complete: true });

    const totalGoals = s.score.HOME + s.score.AWAY;
    const allShots = s.events.filter(e => e.type === 'SHOT_RELEASED');
    const goalActions = new Set(s.events.filter(e => e.type === 'GOAL').map(e => e.actionId));

    const transShots = allShots.filter(e => e.details.phase === 'TRANSITION' || e.details.reason?.includes('TRANSITION') || e.details.subphase === 'UPPSPEL');
    const transGoals = transShots.filter(e => goalActions.has(e.actionId)).length;

    const sevenMetres = allShots.filter(e => e.details.shotKind === 'SEVEN_METRE').length;
    const twoMin = s.events.filter(e => e.type === 'TWO_MINUTE_SUSPENSION').length;

    const totalBroadLosses = econ.teams.HOME.broadBallLosses + econ.teams.AWAY.broadBallLosses;
    const totalFT = (ftRead.counts?.HOME ?? 0) + (ftRead.counts?.AWAY ?? 0);

    const matchPossessions: MatchData['possessions'] = [];

    for (const rec of econ.records) {
      // Find events belonging to this possession
      const gEvents = s.events.filter(e => e.possessionId === rec.canonicalId || (e.details && e.details.previous === rec.canonicalId));
      const hasSettledEvent = gEvents.some(e => e.type === 'ATTACK_SETTLED');
      const startedInRestart = gEvents[0]?.type === 'RESTART_AWARDED' && ['FREE_THROW', 'SEVEN_METRE'].includes(gEvents[0].details.kind as string);

      // If it settled or started from an established dead ball restart, it's a settled attack
      // If it stayed in transition until shot/turnover, it's a fast-break possession
      const isSettled = hasSettledEvent || startedInRestart || !gEvents.some(e => e.details?.phase === 'TRANSITION' || e.details?.reason?.includes('TRANSITION'));
      const isTransition = !isSettled;

      const eventsSummary = gEvents.map(e => e.type).slice(0, 10).join(' -> ');

      matchPossessions.push({
        id: rec.key,
        team: rec.team,
        duration: rec.durationSeconds,
        isSettled,
        isTransition,
        hasShot: rec.hasShot,
        isTurnover: rec.loss !== null,
        freeThrows: rec.freeThrows,
        has7m: rec.hasSevenMetre,
        ending: rec.reconstructedTerminal,
        eventsSummary
      });
    }

    matches.push({
      seed,
      homeGoals: s.score.HOME,
      awayGoals: s.score.AWAY,
      totalGoals,
      totalShots: allShots.length,
      broadBallLosses: totalBroadLosses,
      ordinaryFreeThrows: totalFT,
      transitionShots: transShots.length,
      transitionGoals: transGoals,
      sevenMetres,
      twoMinSuspensions: twoMin,
      possessionsCount: econ.records.length,
      possessions: matchPossessions
    });
  }

  // Aggregate stats
  const allPossessions = matches.flatMap(m => m.possessions);
  const settledAttacks = allPossessions.filter(p => p.isSettled);
  const transitionPoss = allPossessions.filter(p => p.isTransition);
  const settledShot = settledAttacks.filter(p => p.hasShot);
  const settledTurnover = settledAttacks.filter(p => p.isTurnover);
  const settledWithFT = settledAttacks.filter(p => p.freeThrows >= 1);
  const possWith7m = allPossessions.filter(p => p.has7m);

  console.log('\n==================================================');
  console.log('MATCH OVERVIEW (5 MATCHES)');
  console.log('==================================================');
  console.log(`Avg Total Goals: ${(matches.reduce((a, b) => a + b.totalGoals, 0) / 5).toFixed(1)}`);
  console.log(`Avg Possessions: ${(matches.reduce((a, b) => a + b.possessionsCount, 0) / 5).toFixed(1)}`);
  console.log(`Avg Shots: ${(matches.reduce((a, b) => a + b.totalShots, 0) / 5).toFixed(1)}`);
  console.log(`Avg Broad Ball Losses: ${(matches.reduce((a, b) => a + b.broadBallLosses, 0) / 5).toFixed(1)}`);
  console.log(`Avg Ordinary Free Throws: ${(matches.reduce((a, b) => a + b.ordinaryFreeThrows, 0) / 5).toFixed(1)}`);
  console.log(`Avg Transition Shots: ${(matches.reduce((a, b) => a + b.transitionShots, 0) / 5).toFixed(1)}`);
  console.log(`Avg Transition Goals: ${(matches.reduce((a, b) => a + b.transitionGoals, 0) / 5).toFixed(1)}`);
  console.log(`Avg 7m: ${(matches.reduce((a, b) => a + b.sevenMetres, 0) / 5).toFixed(1)}`);
  console.log(`Avg 2min: ${(matches.reduce((a, b) => a + b.twoMinSuspensions, 0) / 5).toFixed(1)}`);

  console.log('\n==================================================');
  console.log('ATTACK DURATION DISTRIBUTIONS (SECONDS)');
  console.log('==================================================');
  const categories = [
    { name: 'All possessions', data: allPossessions.map(p => p.duration) },
    { name: 'Settled attacks', data: settledAttacks.map(p => p.duration) },
    { name: 'Transition / fast-break', data: transitionPoss.map(p => p.duration) },
    { name: 'Settled attacks ending in shot', data: settledShot.map(p => p.duration) },
    { name: 'Settled attacks ending in turnover', data: settledTurnover.map(p => p.duration) },
    { name: 'Settled attacks with >= 1 free throw', data: settledWithFT.map(p => p.duration) },
    { name: 'Possessions ending in 7m', data: possWith7m.map(p => p.duration) },
  ];

  for (const cat of categories) {
    const s = stats(cat.data);
    console.log(`${cat.name.padEnd(40)}: N=${String(s.n).padStart(3)} | Mean=${s.mean.toFixed(1).padStart(5)}s | Median=${s.median.toFixed(1).padStart(5)}s | [P25: ${s.p25.toFixed(1)}s, P75: ${s.p75.toFixed(1)}s, P90: ${s.p90.toFixed(1)}s, Min: ${s.min.toFixed(1)}s, Max: ${s.max.toFixed(1)}s]`);
  }

  // Show a few example settled possessions
  console.log('\n==================================================');
  console.log('SAMPLE SETTLED POSSESSION SEQUENCES');
  console.log('==================================================');
  for (const p of settledAttacks.slice(0, 8)) {
    console.log(`[${p.id}] ${p.duration.toFixed(1)}s | FTs: ${p.freeThrows} | Shot: ${p.hasShot} | Ending: ${p.ending}`);
  }
}

run().catch(console.error);
