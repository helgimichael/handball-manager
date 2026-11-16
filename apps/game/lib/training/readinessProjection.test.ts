import '../../scripts/register-asset-loader.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from '../career/newCareer';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../gameWorld/serverSnapshot';
import { snapshotAllClubsStaff } from '../gameWorld/staffIdentitySnapshot';
import { getCareerSquad } from '../career/careerWorld';
import type { CareerState } from '../career/types';
import { buildTrainingWeek, resolveTrainingWeek } from './trainingSchedule';
import { executeTrainingDay } from './trainingExecution';
import { projectWeekReadiness, projectionTarget } from './readinessProjection';

const club = 'swe2-tumba', date = '2026-08-24';
const initial = createNewCareerState('trn-projection', club, snapshotWorldSquads('swe-2'), undefined, snapshotGameplayRatings('swe-2'), snapshotAllClubsStaff('swe-2'));
function career(): CareerState { return { ...structuredClone(initial), gameDate: date, processedThroughDate: '2026-08-23', trainingWeeks: {} }; }
const tired = (s: CareerState, energy: number): CareerState => ({ ...s, playerPhysicalState: Object.fromEntries(getCareerSquad(s).map(p => [p.id, { playerId: p.id, currentEnergy: energy, lastUpdatedDate: date, recentLoad: 0 }])) });

test('projection is read-only and targets the first unplayed own fixture of the week, else the week end', () => {
  const s = career(), before = JSON.stringify(s);
  const week = resolveTrainingWeek(s, date);
  const p = projectWeekReadiness(s, week);
  assert.equal(JSON.stringify(s), before);
  const own = s.fixtures.filter(f => (f.homeClubId === club || f.awayClubId === club) && f.date >= date && f.date <= '2026-08-30').sort((a, b) => a.date.localeCompare(b.date))[0];
  assert.equal(p.target?.kind, own ? 'MATCH' : 'WEEK_END');
  assert.equal(p.target?.date, own?.date ?? '2026-08-30');
  assert.equal(Object.keys(p.byPlayer).length, getCareerSquad(s).length);
  assert.equal(projectionTarget({ ...s, processedThroughDate: '2026-08-30' }, week), null);
});

test('a harder week projects lower readiness than a recovery week, and REST overrides protect players', () => {
  const s = tired(career(), 70);
  const fixtures: typeof s.fixtures = [];
  const hard = projectWeekReadiness({ ...s, fixtures }, buildTrainingWeek(date, fixtures, club, 'PHYSICAL'));
  const easy = projectWeekReadiness({ ...s, fixtures }, buildTrainingWeek(date, fixtures, club, 'RECOVERY'));
  assert.ok(hard.averageProjected! < easy.averageProjected!);
  const id = getCareerSquad(s)[0].id;
  const rested = projectWeekReadiness({ ...s, fixtures }, buildTrainingWeek(date, fixtures, club, 'PHYSICAL'), { loadOverrides: { [id]: 'REST' } });
  assert.ok(rested.byPlayer[id].projected >= hard.byPlayer[id].projected);
});

test('first projected day matches the real execution step for that day', () => {
  const s = tired({ ...career(), fixtures: [] }, 72);
  const week = buildTrainingWeek(date, [], club, 'BALANCED');
  const stored = { ...s, trainingWeeks: { [date]: week } };
  const oneDay = { ...week, days: week.days.map(d => d.date === date ? d : { ...d, executed: true }) };
  const projected = projectWeekReadiness(stored, oneDay);
  const executed = executeTrainingDay(stored, date);
  for (const p of getCareerSquad(s)) assert.ok(Math.abs(projected.byPlayer[p.id].projected - executed.playerPhysicalState[p.id].currentEnergy) <= 0.5, p.id);
});
