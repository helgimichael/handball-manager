// HM-PLAYTEST-01 2.4: the 7-metre order is read by the engine at the award.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch } from '@handball-manager/handball-engine/src/v2/core/match';
import { awardRestart } from '@handball-manager/handball-engine/src/v2/core/transitions';
import { restartStep } from '@handball-manager/handball-engine/src/v2/core/restarts';
import { courtPlayers } from '@handball-manager/handball-engine/src/v2/core/state';

function takerFor(order: string[] | undefined) {
  const s = createMatch(77, 'TOP', 1800000, 0);
  s.match!.phase = 'FIRST_HALF';
  if (order) s.coaching.HOME.plan = { penaltyTakers: order };
  awardRestart(s, 'SEVEN_METRE', 'HOME', { x: 10, y: 33 }, 'test');
  for (let i = 0; i < 5 && !s.restart?.takerId; i++) restartStep(s);
  return { taker: s.restart?.takerId, court: courtPlayers(s, 'HOME') };
}

test('without a plan the engine keeps its default 7-metre taker', () => {
  const { taker, court } = takerFor(undefined);
  assert.equal(court.find(p => p.id === taker)?.role, 'CB');
});

test('the primary taker takes it; the backup when the primary is not on court', () => {
  const base = takerFor(undefined).court.filter(p => p.kind === 'FIELD_PLAYER');
  const wing = base.find(p => p.role === 'LW')!.id, pivot = base.find(p => p.role === 'P')!.id;
  assert.equal(takerFor([wing, pivot]).taker, wing);
  assert.equal(takerFor(['benched-or-suspended', pivot]).taker, pivot);
});
