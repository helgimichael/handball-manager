// Stabilization (native V2 resume, P0): "Unresolved ball flight budget" after timeout -> save -> reload -> resume.
// Root cause: a team time-out granted while a NON-live ball was in the air (throw-off pass, dead-ball return). During
// any official time-out the engine skips execution, so the flight is not advanced while tick - releasedTick keeps
// counting; 1,200 time-out ticks always exceed the 160-tick flight budget. Save/reload was not involved: the reloaded
// continuation is identical to the uninterrupted one. The manager's command now refuses such a time-out.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from './newCareer';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../gameWorld/serverSnapshot';
import { buildMatchdayReadyEvent } from './careerEvents';
import { startProductionMatch, advanceProductionMatch, commandProductionMatch } from './productionMatch';
import type { CareerState } from './types';

function ready(): CareerState {
  let state = createNewCareerState('timeout-during-flight', 'swe2-tumba', snapshotWorldSquads('swe-2'), undefined, snapshotGameplayRatings('swe-2'));
  const club = Object.keys(state.worldSquads).find(id => id.toLowerCase().includes('tumba'));
  if (club) state = { ...state, playerClubId: club };
  const fixture = state.fixtures.find(f => f.homeClubId === state.playerClubId || f.awayClubId === state.playerClubId)!;
  return { ...state, gameDate: fixture.date, careerEvents: [buildMatchdayReadyEvent(fixture.id, fixture.date)] };
}
const core = (s: CareerState) => s.productionMatch!.core;

test('a time-out is refused while a non-live ball is in the air, and granted once the ball is in play', () => {
  let s = startProductionMatch(ready());
  let refused = 0, granted: CareerState | null = null;
  for (let i = 0; i < 6000 && (refused < 2 || !granted); i++) {
    s = advanceProductionMatch(s, 1);
    const c = core(s);
    assert.equal(c.status, 'RUNNING');
    if (c.referee.timeout) continue;
    const team = c.possession.team;
    if (c.ball.flight && !c.ball.live) {
      const before = JSON.stringify(c);
      assert.throws(() => commandProductionMatch(s, { kind: 'TIMEOUT', team }), /Beslutet/);
      assert.equal(JSON.stringify(core(s)), before, 'a refused request changes nothing');
      refused++;
    } else if (!granted && refused >= 1 && c.ball.live && c.ball.controllerId && c.tick > 400) {
      try { granted = commandProductionMatch(s, { kind: 'TIMEOUT', team }); } catch { /* not this tick */ }
    }
  }
  assert.ok(refused >= 2, 'reached the open-flight situations (throw-off pass / dead-ball return)');
  assert.ok(granted, 'a time-out with the ball in play is granted');
  // Time-out -> save (JSON) -> reload -> resume: identical to the uninterrupted continuation, and still running.
  const reloaded = JSON.parse(JSON.stringify(granted)) as CareerState;
  const a = advanceProductionMatch(granted!, 1600), b = advanceProductionMatch(reloaded, 1600);
  assert.equal(core(a).status, 'RUNNING', core(a).reason ?? '');
  assert.equal(JSON.stringify(core(a)), JSON.stringify(core(b)));
});
