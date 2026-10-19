import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TUMBA_SQUAD } from '../../game-data';
import { buildInitialMatchSquad } from '../../matchPlan/careerSquadBridge';
import { buildDefaultMatchPlan } from '../../matchPlan/defaultMatchPlan';
import { linkDefenceStarters, STARTING_SEVEN_POSITION_ERROR } from '../../matchPlan/startingUnits';
import { resolveCareerLineup, selectBestAvailableLineup, validateCareerLineup } from './careerLineup';

function selection() {
  const extra = Array.from({ length: 5 }, (_, i) => ({ ...TUMBA_SQUAD[0], id: `outside-${i}` }));
  const squad = [...TUMBA_SQUAD, ...extra];
  const built = buildDefaultMatchPlan(buildInitialMatchSquad(squad, 'alpha-fixture', 'swe2-tumba'));
  assert.ok(built.ok && built.plan);
  return { squad, plan: built.plan };
}

test('a selected 16-player squad stays exactly 16 with no unselected player on the bench', () => {
  const { squad, plan } = selection();
  assert.ok(squad.length > 16);
  assert.equal(plan.squad.players.length, 16);
  const lineup = resolveCareerLineup(plan.clubId, squad, plan);
  assert.ok(lineup);
  assert.equal(lineup.source, 'MATCH_PLAN');
  assert.equal(lineup.squadIds.length, 16);
  assert.equal(lineup.bench.length, 9);
  assert.deepEqual([...lineup.squadIds].sort(), plan.squad.players.map(p => p.playerId).sort());
});

test('invalid custom two-pivot selection is rejected instead of falling back to the full roster', () => {
  const { squad, plan } = selection();
  plan.attackStartingUnit = { ...plan.attackStartingUnit, slots: plan.attackStartingUnit.slots.map(slot => slot.position === 'M9' ? { ...slot, position: 'M6' as const } : slot) };
  assert.ok(validateCareerLineup(plan, squad).errors.includes(STARTING_SEVEN_POSITION_ERROR));
  assert.equal(resolveCareerLineup(plan.clubId, squad, plan), null);
});

test('custom squads above 16, duplicate starters and unavailable selections cannot fall back', () => {
  const { squad, plan } = selection();
  const outside = squad.find(p => !plan.squad.players.some(s => s.playerId === p.id))!;
  const oversized = { ...plan, squad: { ...plan.squad, players: [...plan.squad.players, { playerId: outside.id, position: outside.position === 'MV' ? 'GK' as const : outside.position }] } };
  assert.equal(resolveCareerLineup(plan.clubId, squad, oversized), null);
  const slots = plan.attackStartingUnit.slots.map(slot => slot.position === 'H6' ? { ...slot, playerId: plan.attackStartingUnit.slots.find(p => p.position === 'V6')!.playerId } : slot);
  assert.equal(resolveCareerLineup(plan.clubId, squad, { ...plan, attackStartingUnit: { ...plan.attackStartingUnit, slots } }), null);
  assert.equal(resolveCareerLineup(plan.clubId, squad.filter(p => p.id !== plan.squad.players[0].playerId), plan), null);
});

test('automatic selection without a custom plan also caps its starters and bench at 16', () => {
  const { squad } = selection();
  const lineup = selectBestAvailableLineup('swe2-tumba', squad);
  assert.ok(lineup);
  assert.equal(lineup.squadIds.length, 16);
  assert.equal(new Set(lineup.squadIds).size, 16);
  assert.equal(lineup.bench.length, 9);
});

test('the shared starting seven uses its attack goalkeeper, not a hidden independent defensive selection', () => {
  const { squad, plan } = selection();
  const keeper = plan.attackStartingUnit.slots.find(s => s.position === 'GK')!.playerId;
  plan.defenceStartingUnit = { ...plan.defenceStartingUnit, goalkeeperId: 'legacy-hidden-keeper' };
  assert.equal(resolveCareerLineup(plan.clubId, squad, plan)?.goalkeeperId, keeper);
});

test('alpha defensive selection is a read-only projection of attack starters without mutating the saved plan', () => {
  const { plan } = selection();
  const original = structuredClone(plan);
  const replacement = plan.squad.players.find(p => p.position !== 'GK' && !plan.attackStartingUnit.slots.some(s => s.playerId === p.playerId))!;
  plan.defenceStartingUnit = { ...plan.defenceStartingUnit, courtSlots: plan.defenceStartingUnit.courtSlots.map((slot, i) => i === 0 ? { ...slot, playerId: replacement.playerId } : slot) };
  const saved = structuredClone(plan);
  const linked = linkDefenceStarters(plan);
  assert.deepEqual(linked.defenceStartingUnit.courtSlots.map(s => s.playerId), original.attackStartingUnit.slots.filter(s => s.position !== 'GK').map(s => s.playerId));
  assert.deepEqual(plan, saved);
  assert.ok(!linked.defenceStartingUnit.courtSlots.some(s => s.playerId === replacement.playerId));
});
