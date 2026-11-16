import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrainingWeek } from './trainingSchedule';
import { dayLoad, diffTrainingWeeks, daysEqual, loadBand, revertProposalDay, revertProposalSlot, restoreProposalDay, sessionCategory, trainingDayOutcome, weekLoad } from './weekPlanView';
import type { TrainingDay, TrainingSession, TrainingWeek } from './types';

const s = (date: string, i: number, patch: Partial<TrainingSession> = {}): TrainingSession => ({ id: `${date}:s${i}`, type: 'TECHNICAL', intensity: 'NORMAL', duration: 'NORMAL', target: 'ALL', coachId: null, ...patch });
const day = (date: string, sessions: TrainingSession[], patch: Partial<TrainingDay> = {}): TrainingDay => ({ date, dayType: 'TRAINING', sessions, executed: false, ...patch });
const week = (days: TrainingDay[]): TrainingWeek => ({ weekStart: days[0].date, days });

test('load bar follows the training model: harder, longer sessions cost more; recovery gives back', () => {
  const light = dayLoad(day('2026-08-24', [s('2026-08-24', 0, { intensity: 'LOW', duration: 'SHORT' })]));
  const hard = dayLoad(day('2026-08-24', [s('2026-08-24', 0, { type: 'CONDITIONING', intensity: 'VERY_HIGH', duration: 'LONG' })]));
  assert.ok(hard.cost > light.cost);
  assert.equal(hard.band, 'heavy');
  assert.equal(light.band, 'light');
  assert.ok(hard.percent <= 100 && hard.percent > light.percent);
  const recovery = dayLoad(day('2026-08-24', [s('2026-08-24', 0, { type: 'RECOVERY' })], { dayType: 'RECOVERY' }));
  assert.equal(recovery.cost, 0);
  assert.ok(recovery.gain > 0);
  assert.equal(dayLoad(day('2026-08-24', [], { dayType: 'REST' })).band, 'none');
  assert.equal(loadBand(0), 'none');
  assert.equal(sessionCategory('STRENGTH').tone, 'physical');
  const w = buildTrainingWeek('2026-08-24', [], 'x', 'PHYSICAL');
  assert.ok(weekLoad(w) > weekLoad(buildTrainingWeek('2026-08-24', [], 'x', 'RECOVERY')));
});

test('diff reports added, removed and changed slots, ignores locked days and auto vs explicit coach', () => {
  const live = week([day('2026-08-24', [s('2026-08-24', 0)]), day('2026-08-25', [s('2026-08-25', 0), s('2026-08-25', 1)]), day('2026-08-26', []), day('2026-08-27', [s('2026-08-27', 0)], { executed: true })]);
  const proposed = week([
    day('2026-08-24', [s('2026-08-24', 0, { intensity: 'HIGH', coachId: 'c1' })]),
    day('2026-08-25', [s('2026-08-25', 0)]),
    day('2026-08-26', [s('2026-08-26', 0, { type: 'RECOVERY' })], { dayType: 'RECOVERY' }),
    day('2026-08-27', [s('2026-08-27', 0, { type: 'PHYSICAL' })]),
  ]);
  const diff = diffTrainingWeeks(live, proposed, (d) => d.executed, (x) => x.coachId ?? 'c1');
  assert.deepEqual(diff[0].slots[0].changes, ['Intensitet']);
  assert.equal(diff[1].slots[1].kind, 'removed');
  assert.equal(diff[2].slots[0].kind, 'added');
  assert.equal(diff[2].dayTypeAfter, 'RECOVERY');
  assert.equal(diff[3].locked, true);
  assert.equal(diff[3].changed, false);
  assert.ok(diff.slice(0, 3).every((d) => d.changed));
});

test('per-day and per-slot revert put the live plan back; restore re-applies the draft', () => {
  const live = week([day('2026-08-24', [s('2026-08-24', 0), s('2026-08-24', 1, { type: 'PHYSICAL' })])]);
  const draft = week([day('2026-08-24', [s('2026-08-24', 0, { type: 'DEFENCE' })])]);
  const reverted = revertProposalDay(draft, live, '2026-08-24');
  assert.ok(daysEqual(reverted.days[0], live.days[0]));
  assert.ok(daysEqual(restoreProposalDay(reverted, draft, '2026-08-24').days[0], draft.days[0]));
  const slot1 = revertProposalSlot(draft, live, '2026-08-24', 1);
  assert.equal(slot1.days[0].sessions.length, 2);
  assert.equal(slot1.days[0].sessions[1].type, 'PHYSICAL');
  assert.equal(slot1.days[0].sessions[1].id, '2026-08-24:s1');
  const slot0 = revertProposalSlot(draft, live, '2026-08-24', 0);
  assert.equal(slot0.days[0].sessions[0].type, 'TECHNICAL');
  const added = week([day('2026-08-24', [s('2026-08-24', 0), s('2026-08-24', 1)])]);
  assert.equal(revertProposalSlot(added, week([day('2026-08-24', [s('2026-08-24', 0)])]), '2026-08-24', 1).days[0].sessions.length, 1);
});

test('executed day outcome mirrors the stored results', () => {
  const executed = day('2026-08-24', [s('2026-08-24', 0), s('2026-08-24', 1)], {
    executed: true,
    results: [
      { sessionId: 'a', date: '2026-08-24', participants: ['p1', 'p2'], loadByPlayer: {}, preEnergyByPlayer: { p1: 90, p2: 80 }, postEnergyByPlayer: { p1: 85, p2: 74 }, resolvedCoachId: null, resolvedStaffQuality: 1 },
      { sessionId: 'b', date: '2026-08-24', participants: ['p1'], loadByPlayer: {}, preEnergyByPlayer: { p1: 85 }, postEnergyByPlayer: { p1: 80 }, resolvedCoachId: null, resolvedStaffQuality: 1 },
    ],
  });
  const out = trainingDayOutcome(executed)!;
  assert.equal(out.attendance, 2);
  assert.equal(out.sessions, 2);
  assert.deepEqual(out.rows.map((r) => [r.playerId, r.passes, r.delta]), [['p1', 2, -10], ['p2', 1, -6]]);
  assert.equal(out.averageDelta, -8);
  assert.equal(trainingDayOutcome(day('2026-08-25', [])), null);
});
