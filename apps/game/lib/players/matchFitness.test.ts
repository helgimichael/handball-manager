import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from '../career/newCareer';
import { getCareerSquad } from '../career/careerWorld';
import { migrateCareerState } from '../career/saveMigration';
import type { CareerState } from '../career/types';
import { applyDailyMatchFitness, applyMatchExposure, matchFitnessAttributeFactor, matchFitnessOf, emptyMatchFitnessLedger, PRESEASON_MATCH_FITNESS, LEGACY_MATCH_FITNESS, TRAINING_MAINTENANCE_CEILING } from './matchFitness';

function preseason() {
  const s = createNewCareerState('mf', 'swe2-tumba');
  return { ...s, playerMatchFitness: emptyMatchFitnessLedger(PRESEASON_MATCH_FITNESS) };
}

test('match fitness is separate from energy: a fully rested player can still lack match fitness', () => {
  const s = preseason();
  const p = getCareerSquad(s)[0];
  assert.equal(matchFitnessOf(s, p.id), PRESEASON_MATCH_FITNESS);
  assert.ok((s.playerPhysicalState[p.id]?.currentEnergy ?? 100) >= 90, 'energy is high at the same time');
});

test('games build match fitness; friendlies count slightly less; a single game cannot make a rusty player sharp', () => {
  const s = preseason();
  const id = getCareerSquad(s)[0].id;
  const competitive = applyMatchExposure(s, '2026-08-01', new Map([[id, 60]]), true);
  const friendly = applyMatchExposure(s, '2026-08-01', new Map([[id, 60]]), false);
  const c = matchFitnessOf(competitive, id), f = matchFitnessOf(friendly, id);
  assert.ok(c > PRESEASON_MATCH_FITNESS && f > PRESEASON_MATCH_FITNESS && c > f);
  assert.ok(c < 80, 'one full game is not a full preseason');
  const bench = applyMatchExposure(s, '2026-08-01', new Map([[id, 0]]), true);
  assert.equal(matchFitnessOf(bench, id), PRESEASON_MATCH_FITNESS, 'no minutes, no gain');
});

test('match fitness fades without games, faster while injured, and training only maintains up to a ceiling', () => {
  let s: CareerState = applyMatchExposure(preseason(), '2026-08-01', new Map([['a', 60], ['b', 60]]), true);
  for (let i = 0; i < 6; i++) s = applyMatchExposure(s, `2026-08-0${i + 2}`, new Map([['a', 60], ['b', 60]]), true);
  const start = matchFitnessOf(s, 'a');
  assert.ok(start > 85);
  for (let d = 10; d < 40; d++) s = applyDailyMatchFitness(s, `2026-08-${String(d).padStart(2, '0')}`.replace('2026-08-3', '2026-09-0').replace('2026-09-09', '2026-09-09'), ['a', 'b'], id => id === 'b');
  const healthy = matchFitnessOf(s, 'a'), injured = matchFitnessOf(s, 'b');
  assert.ok(healthy < start && injured < healthy, `fade ${start} -> healthy ${healthy}, injured ${injured}`);
  assert.ok(healthy >= TRAINING_MAINTENANCE_CEILING, 'training keeps a healthy player at the maintenance level');
  let rusty: CareerState = preseason();
  for (let d = 1; d <= 28; d++) rusty = applyDailyMatchFitness(rusty, `2026-07-${String(d).padStart(2, '0')}`, ['c'], () => false);
  assert.ok(matchFitnessOf(rusty, 'c') <= TRAINING_MAINTENANCE_CEILING, 'training alone never makes a player match-sharp');
});

test('the gameplay effect is modest and absent for a match-sharp player', () => {
  assert.equal(matchFitnessAttributeFactor(80), 1);
  assert.equal(matchFitnessAttributeFactor(100), 1);
  assert.ok(matchFitnessAttributeFactor(55) > 0.97);
  assert.ok(matchFitnessAttributeFactor(0) >= 0.94);
});

test('old saves migrate as mid-season match-fit', () => {
  const legacy = { ...createNewCareerState('mf-old', 'swe2-tumba') } as Record<string, unknown>;
  delete legacy.playerMatchFitness;
  const migrated = migrateCareerState(legacy as never);
  assert.equal(migrated.playerMatchFitness?.defaultValue, LEGACY_MATCH_FITNESS);
});
