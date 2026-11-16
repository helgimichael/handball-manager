// SQUAD-ROLE-MINUTES: position budgets -- every playing position has exactly
// 60 minutes (360 outfield + 60 goalkeeper), shared by the players the MATCH
// PLAN assigns to it. Increases past 60 are rejected, decreases always pass,
// saved over-budget plans are shown with a warning and never rewritten, and
// the assistant never treats an over-budget position as a valid plan.
import '../../scripts/register-asset-loader.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createNewCareerState } from '../career/newCareer';
import { migrateCareerState } from '../career/saveMigration';
import { getCareerClubSquad } from '../career/careerWorld';
import { setMatchPlan } from '../career/matchPlanActions';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../gameWorld/serverSnapshot';
import type { CareerState } from '../career/types';
import { buildInitialMatchSquad } from './careerSquadBridge';
import { buildDefaultMatchPlan } from './defaultMatchPlan';
import type { MatchPlan, Position } from './types';
import { assignedPosition, BUDGET_POSITIONS, changePlannedMinutes, engineMinutesPlan, minutesPlannerRows, minutesTotals, plannedMinutesFor, positionBudgets, POSITION_BUDGET_MINUTES } from './minutesPlan';
import { MinutesPlanner } from '../../components/matchday/MinutesPlanner';

function career(): { s: CareerState; plan: MatchPlan; fixtureId: string } {
  let s = createNewCareerState('squad-role-minutes-budgets', 'swe2-tumba', snapshotWorldSquads('swe-2'), undefined, snapshotGameplayRatings('swe-2'));
  const club = Object.keys(s.worldSquads).find(id => id.toLowerCase().includes('tumba'));
  if (club) s = { ...s, playerClubId: club };
  const fixture = s.fixtures.find(f => f.homeClubId === s.playerClubId || f.awayClubId === s.playerClubId)!;
  const plan = buildDefaultMatchPlan(buildInitialMatchSquad(getCareerClubSquad(s, s.playerClubId), fixture.id, s.playerClubId)).plan!;
  return { s: { ...s, gameDate: fixture.date }, plan, fixtureId: fixture.id };
}
const ids = (plan: MatchPlan, position: Position) => plan.squad.players.map(p => p.playerId).filter(id => assignedPosition(plan, id) === position);
const starterAt = (plan: MatchPlan, position: Position) => position === 'GK' ? plan.defenceStartingUnit.goalkeeperId : plan.attackStartingUnit.slots.find(s => s.position === position)!.playerId;
/** Registers a non-starting player at `position` for this match (his natural position may differ). */
function registerAt(plan: MatchPlan, position: Position, avoid: ReadonlySet<string> = new Set()): { plan: MatchPlan; id: string } {
  const starters = new Set([...plan.attackStartingUnit.slots.map(s => s.playerId), plan.defenceStartingUnit.goalkeeperId]);
  const candidates = plan.squad.players.filter(p => !starters.has(p.playerId) && !avoid.has(p.playerId) && (position === 'GK') === (p.position === 'GK'));
  const bench = candidates.find(p => p.position !== position) ?? candidates[0]!;
  return { id: bench.playerId, plan: { ...plan, squad: { ...plan.squad, players: plan.squad.players.map(p => p.playerId === bench.playerId ? { ...p, position } : p) } } };
}
/** A saved allocation for exactly these players at one position (everyone else there at 0), written raw like an old save. */
function saved(plan: MatchPlan, position: Position, figures: Record<string, number>): MatchPlan {
  const zero = Object.fromEntries(ids(plan, position).map(id => [id, 0]));
  return { ...plan, plannedMinutes: { ...(plan.plannedMinutes ?? {}), ...zero, ...figures } };
}
const budget = (s: CareerState, plan: MatchPlan, position: Position) => positionBudgets(s, plan).find(b => b.position === position)!;
function change(s: CareerState, plan: MatchPlan, id: string, minutes: number) { return changePlannedMinutes(s, plan, id, minutes); }

test('a standard match has seven 60-minute position budgets: 360 outfield, 60 goalkeeper', () => {
  const { s, plan } = career();
  assert.deepEqual(BUDGET_POSITIONS, ['V6', 'V9', 'M9', 'H9', 'H6', 'M6', 'GK']);
  const budgets = positionBudgets(s, plan);
  assert.equal(budgets.length, 7);
  assert.ok(budgets.every(b => b.capacity === POSITION_BUDGET_MINUTES));
  const totals = minutesTotals(budgets);
  assert.equal(totals.outfieldCapacity, 360); assert.equal(totals.goalkeeperCapacity, 60);
});

test('role-based defaults fit every position budget (no 65-minute wing, no 90-minute goal)', () => {
  const { s, plan } = career();
  for (const b of positionBudgets(s, plan)) assert.ok(b.planned <= 60, `${b.code} ${b.planned}`);
  const totals = minutesTotals(positionBudgets(s, plan));
  assert.ok(totals.outfield <= 360 && totals.goalkeepers <= 60);
});

test('V6: 35 + 30 = 65 is rejected with the reason; exactly 60 is accepted', () => {
  const { s, plan: base } = career();
  const { plan: withTwo, id: backup } = registerAt(base, 'V6');
  const starter = starterAt(withTwo, 'V6');
  const plan = saved(withTwo, 'V6', { [starter]: 35, [backup]: 0 });
  const rejected = change(s, plan, backup, 30);
  assert.equal(rejected.ok, false);
  if (!rejected.ok) { assert.match(rejected.error, /V6/); assert.match(rejected.error, /65\/60/); assert.match(rejected.error, /5 min för mycket/); assert.match(rejected.error, /Tillgängligt: 25 min/); }
  const accepted = change(s, plan, backup, 25);
  assert.ok(accepted.ok);
  if (accepted.ok) { assert.equal(budget(s, accepted.plan, 'V6').planned, 60); assert.equal(budget(s, accepted.plan, 'V6').status, 'FULL'); assert.equal(budget(s, accepted.plan, 'V6').available, 0); }
});

test('goalkeepers: 60 + 30 = 90 is rejected', () => {
  const { s, plan: base } = career();
  const keepers = ids(base, 'GK');
  const { plan: withTwo, id: backup } = keepers.length >= 2 ? { plan: base, id: keepers.find(id => id !== starterAt(base, 'GK'))! } : registerAt(base, 'GK');
  const plan = saved(withTwo, 'GK', { [starterAt(withTwo, 'GK')]: 60, [backup]: 0 });
  const result = change(s, plan, backup, 30);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /MV har 60 minuter/);
  assert.equal(plannedMinutesFor(s, plan, backup), 0, 'nothing written');
});

test('increasing 55 -> 60 is accepted, 55 -> 65 is rejected; a decrease is always accepted', () => {
  const { s, plan: base } = career();
  const starter = starterAt(base, 'M9');
  const plan = saved(base, 'M9', { [starter]: 55 });
  assert.ok(change(s, plan, starter, 60).ok);
  const over = change(s, plan, starter, 65);
  assert.equal(over.ok, false, 'above the player maximum and the budget');
  const two = registerAt(plan, 'M9', new Set([starter]));
  const shared = saved(two.plan, 'M9', { [starter]: 55, [two.id]: 0 });
  assert.equal(change(s, shared, two.id, 10).ok, false, 'a shared 55 + 10 = 65 is rejected');
  assert.ok(change(s, shared, two.id, 5).ok, '55 + 5 = 60 is accepted');
  const lowered = change(s, shared, starter, 40);
  assert.ok(lowered.ok); if (lowered.ok) assert.equal(budget(s, lowered.plan, 'M9').planned, 40);
});

test('direct numeric input is validated like the steppers: whole minutes 0-60 only', () => {
  const { s, plan } = career();
  const id = starterAt(plan, 'H6');
  for (const bad of [-1, 61, 12.5, Number.NaN]) {
    const r = change(s, plan, id, bad);
    assert.equal(r.ok, false, String(bad));
    if (!r.ok) assert.match(r.error, /hela minuter mellan 0 och 60/);
  }
  assert.ok(change(s, plan, id, 0).ok, 'zero is allowed');
});

test('an existing over-budget saved plan is shown with a warning and preserved exactly; decreases still work', () => {
  const { s, plan: base, fixtureId } = career();
  const two = registerAt(base, 'V6');
  const invalid = saved(two.plan, 'V6', { [starterAt(two.plan, 'V6')]: 35, [two.id]: 30 });
  const loaded = migrateCareerState(JSON.parse(JSON.stringify(setMatchPlan(s, fixtureId, invalid))));
  const plan = loaded.matchPlans[fixtureId]!;
  assert.deepEqual(plan.plannedMinutes, invalid.plannedMinutes, 'save/load leaves the figures untouched');
  const v6 = budget(loaded, plan, 'V6');
  assert.equal(v6.status, 'OVER'); assert.equal(v6.planned, 65); assert.equal(v6.excess, 5);
  assert.equal(plannedMinutesFor(loaded, plan, two.id), 30, 'no silent clamp on read');
  assert.equal(change(loaded, plan, two.id, 35).ok, false, 'no further increase');
  const fixed = change(loaded, plan, two.id, 25);
  assert.ok(fixed.ok); if (fixed.ok) assert.equal(budget(loaded, fixed.plan, 'V6').status, 'FULL');
  const html = renderToStaticMarkup(createElement(MinutesPlanner, { rows: minutesPlannerRows(loaded, plan), budgets: positionBudgets(loaded, plan), totals: minutesTotals(positionBudgets(loaded, plan)), readOnly: false, onEdit: () => null, onReset: () => {}, onResetAll: () => {} }));
  assert.match(html, /role="alert"/);
  assert.match(html, /överskrider positionsbudgeten: V6 65\/60 min \(\+5\)/);
  assert.match(html, /5 min för mycket/);
  assert.match(html, /data-status="OVER"/);
  assert.doesNotMatch(html, /riktmärke|förväntning/i, 'no hidden expectations in the planner');
});

test('all seven positions are validated independently', () => {
  const { s, plan: base } = career();
  let plan = base;
  for (const position of BUDGET_POSITIONS) plan = saved(plan, position, { [starterAt(plan, position)]: 50 });
  const two = registerAt(plan, 'V6');
  plan = saved(two.plan, 'V6', { [starterAt(two.plan, 'V6')]: 50, [two.id]: 20 });
  const budgets = positionBudgets(s, plan);
  assert.equal(budgets.find(b => b.position === 'V6')!.status, 'OVER');
  for (const b of budgets.filter(b => b.position !== 'V6')) {
    assert.equal(b.status, 'NEAR', b.code); assert.equal(b.available, 10, b.code);
    const id = starterAt(plan, b.position);
    assert.ok(change(s, plan, id, 60).ok, `${b.code} can still reach exactly 60 while V6 is over`);
    assert.equal(change(s, plan, id, 61).ok, false);
  }
});

test('players share the budget of their match-plan position, not their natural position', () => {
  const { s, plan: base } = career();
  const moved = registerAt(base, 'M6');
  const natural = base.squad.players.find(p => p.playerId === moved.id)!.position;
  assert.notEqual(natural, 'M6');
  assert.equal(assignedPosition(moved.plan, moved.id), 'M6');
  assert.ok(budget(s, moved.plan, 'M6').playerIds.includes(moved.id));
  assert.ok(!budget(s, moved.plan, natural).playerIds.includes(moved.id));
  const row = minutesPlannerRows(s, moved.plan).find(r => r.playerId === moved.id)!;
  assert.equal(row.position, 'M6');
  assert.equal(starterAt(base, 'GK') && assignedPosition(base, starterAt(base, 'GK')), 'GK');
});

test('the assistant gets only validated budgets: an over-budget position is left out, valid ones carry their position', () => {
  const { s, plan: base } = career();
  const two = registerAt(base, 'V6');
  const v6 = [starterAt(two.plan, 'V6'), two.id];
  const invalid = saved(two.plan, 'V6', { [v6[0]!]: 35, [v6[1]!]: 30 });
  const input = engineMinutesPlan(s, invalid)!;
  for (const id of v6) assert.equal(input[id], undefined, 'never treated as a valid 60-minute budget');
  const m9 = starterAt(invalid, 'M9');
  assert.equal(input[m9]!.position, 'M9');
  const valid = changePlannedMinutes(s, invalid, v6[1]!, 25);
  assert.ok(valid.ok);
  if (valid.ok) { const fixed = engineMinutesPlan(s, valid.plan)!; assert.equal(fixed[v6[0]!]!.planned + fixed[v6[1]!]!.planned, 60); assert.equal(fixed[v6[1]!]!.position, 'V6'); }
  for (const b of positionBudgets(s, base)) {
    const sum = b.playerIds.reduce((n, id) => n + (engineMinutesPlan(s, base)![id]?.planned ?? 0), 0);
    assert.ok(sum <= 60, `${b.code}: the assistant's plan for the position never exceeds 60`);
  }
});
