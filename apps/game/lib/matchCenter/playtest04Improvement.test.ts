import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createMatch } from '@handball-manager/handball-engine/src/v2/core/match';
import { coachingBefore, setTactics } from '@handball-manager/handball-engine/src/v2/core/coaching';
import { matchPlanBefore } from '@handball-manager/handball-engine/src/v2/core/matchPlanDirectives';
import { ledger } from '@handball-manager/handball-engine/src/v2/core/ledger';
import { advanceCoreMutable } from '@handball-manager/handball-engine/src/v2/core/engine';
import { awardRestart } from '@handball-manager/handball-engine/src/v2/core/transitions';
import { requestExchange } from '@handball-manager/handball-engine/src/v2/core/population';
import { getPlayer, record, courtPlayers } from '@handball-manager/handball-engine/src/v2/core/state';
import { MatchCenterSurface } from '../../components/matchCenter/MatchCenter';
import { TimeoutOverlay } from '../../components/matchCenter/TimeoutOverlay';
import { createLiveMatchReader, type MatchCenterModel } from './model';
import type { ProductionMatchSession } from '../career/productionMatch';

test('HM-P04-01: Context-based CPU timeout triggers on 3+ unanswered conceded goals and trailing margin', () => {
  const s = createMatch(101, 'TOP', 1800000, 0);
  s.match!.phase = 'FIRST_HALF';
  s.officialClock.running = true;
  s.officialClock.timeMs = 600000; // 10 minutes in
  s.possession.team = 'AWAY';
  s.ball.controllerId = 'A03';
  s.ball.live = true;

  // HOME scores 3 unanswered goals
  record(s, 'GOAL', getPlayer(s, 'H03'), { team: 'HOME' });
  record(s, 'GOAL', getPlayer(s, 'H04'), { team: 'HOME' });
  record(s, 'GOAL', getPlayer(s, 'H05'), { team: 'HOME' });
  s.score.HOME = 7;
  s.score.AWAY = 4;

  assert.equal(s.referee.teamTimeouts.AWAY.length, 0);
  coachingBefore(s);
  // AWAY should have requested and received a contextual timeout!
  assert.equal(s.referee.teamTimeouts.AWAY.includes(1), true, 'AWAY took timeout on 3-goal conceded run');
});

test('HM-P04-02: Specialist pairs are protected from being drafted as general fatigue replacements', () => {
  const s = createMatch(202, 'TOP', 1800000, 0);
  s.match!.phase = 'FIRST_HALF';
  s.officialClock.running = true;
  s.officialClock.timeMs = 300000;
  s.possession.team = 'HOME';
  s.ball.controllerId = 'H03';
  s.ball.live = true;

  // Set up specialist pair H04 (attack) and H14 (defence)
  s.coaching.HOME.plan = {
    pairs: [{ attackId: 'H04', defenceId: 'H14' }],
    units: {},
  };
  setTactics(s, 'HOME', {
    rotation: true,
  });

  // Exhaust a non-specialist player H05
  const h05 = getPlayer(s, 'H05');
  h05.condition.energy = 0.35;

  // H14 is on bench, fresh
  const h14 = getPlayer(s, 'H14');
  h14.population = 'BENCH';
  h14.condition.energy = 0.95;

  // Run coachingBefore (fatigue rotation)
  coachingBefore(s);

  // An exchange for H05 must NOT draft H14
  const exchangeForH05 = s.exchanges.find(e => e.outId === 'H05');
  if (exchangeForH05) {
    assert.notEqual(exchangeForH05.inId, 'H14', 'Specialist defender H14 must not be drafted for tired H05');
  }
});

test('HM-P04-03: Specialist substitution recovery exchange brings in planned player when counterpart rotated', () => {
  const s = createMatch(303, 'TOP', 1800000, 0);
  s.match!.phase = 'FIRST_HALF';
  s.officialClock.running = true;
  s.possession.team = 'HOME'; // HOME attacking

  // Pair H04 (attack) and H14 (defence)
  s.coaching.HOME.plan = {
    pairs: [{ attackId: 'H04', defenceId: 'H14' }],
    units: {},
  };

  // Suppose H04 is on bench, but H14 is ALSO on bench (e.g. was suspended or rotated)
  const h04 = getPlayer(s, 'H04');
  h04.population = 'BENCH';
  h04.condition.energy = 0.90;
  const h14 = getPlayer(s, 'H14');
  h14.population = 'BENCH';

  // H05 is on court, movable, non-specialist
  const h05 = getPlayer(s, 'H05');
  h05.population = 'COURT';

  matchPlanBefore(s, 'HOME');

  // Recovery exchange should request an exchange to bring H04 onto court
  const exchange = s.exchanges.find(e => e.inId === 'H04');
  assert.ok(exchange, 'Recovery exchange was generated for attack specialist H04');
});

test('HM-P04-04: Dead-ball whistle restart does not cancel active in-flight EXCHANGE', () => {
  const s = createMatch(404, 'TOP', 1800000, 0);
  const p = getPlayer(s, 'H02');
  p.action = { id: 'act-exch', possessionId: 'pos-1', kind: 'EXCHANGE', phase: 'EXECUTING', phaseTick: s.tick } as unknown as import('@handball-manager/handball-engine/src/v2/core/state').CoreAction;
  p.duty = { kind: 'WAIT', targetId: null, sinceTick: s.tick, reason: 'Exchanging' };

  // Award a restart (whistle)
  awardRestart(s, 'FREE_THROW', 'AWAY', { x: 10, y: 20 }, 'Foul');

  // Player's action should NOT have been wiped out to null
  assert.equal(p.action?.kind, 'EXCHANGE', 'In-flight EXCHANGE action was preserved across dead-ball restart');
});

test('HM-P04-05: Ledger correctly balances possessions and endings with LIVE_TOUCH', () => {
  const s = createMatch(505, 'TOP', 1800000, 0);
  // Advance through a few possessions
  for (let i = 0; i < 200 && s.status === 'RUNNING'; i++) {
    advanceCoreMutable(s);
  }
  const l = ledger(s);
  const endingsTotal = Object.values(l.endings).reduce((sum, n) => sum + n, 0);
  assert.ok(l.possessions >= 0);
  assert.ok(l.attacks >= 0);
  // All recorded endings sum up to total attacks
  assert.equal(endingsTotal, l.attacks, 'Total recorded endings strictly equals recorded attacks');
});

test('HM-P04-06: MatchCenterSurface renders active 2-minute suspension timers and badges', () => {
  const s = createMatch(606, 'TOP', 1800000, 0);
  s.officialClock.timeMs = 600000;
  // Put H02 into 2-minute suspension
  const h02 = getPlayer(s, 'H02');
  h02.population = 'SUSPENDED';
  h02.suspensionUntilMs = 720000; // 2 minutes left (120,000 ms)

  const people = s.players.map((p, i) => ({
    id: p.id,
    name: `Player ${p.id}`,
    number: i + 1,
    team: p.team,
    role: p.role,
    started: true,
    startEnergy: 100,
  }));

  const session: ProductionMatchSession = {
    format: 1,
    fixture: {
      id: 'fix-1',
      homeClubId: 'swe2-tumba',
      awayClubId: 'swe2-guif',
      date: '2026-11-10',
      competitionId: 'swe-2',
      round: 1,
      type: 'LEAGUE',
    },
    core: s,
    people,
    frames: [],
    pausedAtHalf: false,
    error: null,
  };

  const reader = createLiveMatchReader();
  const model = reader(session, false);

  const html = renderToStaticMarkup(
    React.createElement(MatchCenterSurface, {
      model,
      fixture: session.fixture,
      frames: [],
      people,
      events: s.events,
      team: 'HOME',
      session,
    })
  );

  // Must contain suspension badge with 2 min indicator and countdown
  assert.ok(html.includes('mc-suspension-badge'), 'Renders mc-suspension-badge on scoreboard');
  assert.ok(html.includes('2 min'), 'Includes "2 min" label');
  assert.ok(html.includes('2:00'), 'Includes "2:00" countdown timer for the 2-minute suspension');
});

test('HM-P04-07: TimeoutOverlay renders interactive tactical choices and resume action', () => {
  const s = createMatch(707, 'TOP', 1800000, 0);
  s.referee.timeout = { reason: 'TEAM_TIMEOUT', untilTick: s.tick + 1200, wasRunning: true };

  const people = s.players.map((p, i) => ({
    id: p.id,
    name: `Player ${p.id}`,
    number: i + 1,
    team: p.team,
    role: p.role,
    started: true,
    startEnergy: 100,
  }));

  const session: ProductionMatchSession = {
    format: 1,
    fixture: {
      id: 'fix-1',
      homeClubId: 'swe2-tumba',
      awayClubId: 'swe2-guif',
      date: '2026-11-10',
      competitionId: 'swe-2',
      round: 1,
      type: 'LEAGUE',
    },
    core: s,
    people,
    frames: [],
    pausedAtHalf: false,
    error: null,
  };

  const reader = createLiveMatchReader();
  const model = reader(session, false);
  model.status = 'TIMEOUT';

  let resumed = false;
  let tacticalPatch: unknown = null;

  const html = renderToStaticMarkup(
    React.createElement(TimeoutOverlay, {
      session,
      model,
      team: 'HOME',
      names: { HOME: 'Tumba', AWAY: 'Guif' },
      callingTeam: 'HOME',
      onCommand: (cmd) => { if (cmd.kind === 'TACTICS') tacticalPatch = cmd.patch; },
      onResumeTimeout: () => { resumed = true; },
    })
  );

  assert.ok(html.includes('mc-timeout-overlay'), 'Contains mc-timeout-overlay');
  assert.ok(html.includes('Din timeout'), 'Acknowledges manager own timeout');
  assert.ok(html.includes('Återgå till match'), 'Includes resume action button');
  assert.ok(html.includes('Försvar'), 'Includes tactical choices for defence');
  assert.ok(html.includes('Tempo'), 'Includes tactical choices for tempo');
  assert.ok(html.includes('Kontextuellt lagdirektiv'), 'Includes contextual team instructions section');
  assert.ok(html.includes('Hög press') && html.includes('snabb omställning'), 'Offers contextual instruction options');
});

test('HM-P04-08: Quick substitution and contextual team instruction in timeout persist through save/reload', () => {
  const s = createMatch(808, 'TOP', 1800000, 0);
  s.match!.phase = 'FIRST_HALF';
  s.officialClock.running = true;
  s.officialClock.timeMs = 700000;
  s.possession.team = 'HOME';
  s.ball.controllerId = 'H03';
  s.ball.live = true;

  // Trigger timeout for HOME
  s.referee.teamTimeouts.HOME.push(s.period);
  s.referee.timeout = { untilTick: s.tick + 1200, wasRunning: true, reason: 'TEAM_TIMEOUT' };
  s.officialClock.running = false;

  // 1. Quick substitution from registered bench during timeout
  const outPlayer = s.players.find(p => p.team === 'HOME' && p.population === 'COURT' && p.kind === 'FIELD_PLAYER')!;
  const inPlayer = s.players.find(p => p.team === 'HOME' && p.population === 'BENCH' && p.kind === 'FIELD_PLAYER')!;
  assert.ok(outPlayer && inPlayer);

  const subSuccess = requestExchange(s, 'HOME', outPlayer.id, inPlayer.id);
  assert.ok(subSuccess, 'Quick substitution succeeded during timeout');
  assert.equal(outPlayer.population, 'BENCH', 'Outgoing player moved immediately to bench');
  assert.equal(inPlayer.population, 'COURT', 'Incoming player moved immediately to court');
  assert.ok(s.exchanges.some(e => e.inId === inPlayer.id && e.phase === 'COMPLETED'), 'Exchange completed record exists');

  // 2. Select contextual team instruction (HIGH_PRESS_TRANSITION)
  const tacticsSuccess = setTactics(s, 'HOME', {
    defence: '5:1',
    aggression: 'HIGH',
    tempo: 'QUICK',
    instruction: 'HIGH_PRESS_TRANSITION',
  });
  assert.ok(tacticsSuccess, 'Applied contextual instruction and tactical settings');
  assert.equal(s.coaching.HOME.defence, '5:1');
  assert.equal(s.coaching.HOME.aggression, 'HIGH');
  assert.equal(s.coaching.HOME.tempo, 'QUICK');
  assert.equal(s.coaching.HOME.instruction, 'HIGH_PRESS_TRANSITION');

  // 3. Persist through save/reload
  const serialized = JSON.stringify(s);
  const reloaded = JSON.parse(serialized);

  assert.equal(reloaded.coaching.HOME.defence, '5:1', 'Defence setting persisted');
  assert.equal(reloaded.coaching.HOME.aggression, 'HIGH', 'Aggression setting persisted');
  assert.equal(reloaded.coaching.HOME.tempo, 'QUICK', 'Tempo setting persisted');
  assert.equal(reloaded.coaching.HOME.instruction, 'HIGH_PRESS_TRANSITION', 'Instruction persisted');
  assert.equal(reloaded.players.find((p: any) => p.id === inPlayer.id).population, 'COURT', 'Incoming player still on court after reload');
  assert.equal(reloaded.players.find((p: any) => p.id === outPlayer.id).population, 'BENCH', 'Outgoing player still on bench after reload');

  // 4. Resume paused match
  // Simulate timeout ending (ticks reaching untilTick)
  reloaded.tick = reloaded.referee.timeout.untilTick;
  advanceCoreMutable(reloaded);
  assert.equal(reloaded.referee.timeout, null, 'Timeout cleared upon resume');
  assert.equal(reloaded.coaching.HOME.instruction, 'HIGH_PRESS_TRANSITION', 'Instruction remains active after resume');
});

test('HM-P04-09: Suspension display features correct team attribution, expiration, and 6v5 vs 7v6 distinction', () => {
  const s = createMatch(909, 'TOP', 1800000, 0);
  s.match!.phase = 'FIRST_HALF';
  s.officialClock.running = true;
  s.officialClock.timeMs = 120000;

  // HOME has a player suspended
  const homeSusp = getPlayer(s, 'H04');
  homeSusp.population = 'SUSPENDED';
  homeSusp.suspensionUntilMs = 240000; // 2 minutes later
  homeSusp.sanctions = 1;

  const people = s.players.map((p, i) => ({
    id: p.id,
    name: `Player ${p.id}`,
    number: i + 1,
    team: p.team,
    role: p.role,
    started: true,
    startEnergy: 100,
  }));

  const session: ProductionMatchSession = {
    format: 1,
    fixture: {
      id: 'fix-1',
      homeClubId: 'swe2-tumba',
      awayClubId: 'swe2-guif',
      date: '2026-11-10',
      competitionId: 'swe-2',
      round: 1,
      type: 'LEAGUE',
    },
    core: s,
    people,
    frames: [],
    pausedAtHalf: false,
    error: null,
  };

  const reader = createLiveMatchReader();
  const model6v5 = reader(session, false);

  const html6v5 = renderToStaticMarkup(
    React.createElement(MatchCenterSurface, {
      model: model6v5,
      fixture: session.fixture,
      frames: [],
      people,
      events: s.events,
      team: 'HOME',
      session,
    })
  );

  // 1. Team attribution & player details
  assert.ok(html6v5.includes('Utvisningar och kort för IFK Tumba'), 'Attributed to HOME club IFK Tumba');
  assert.ok(html6v5.includes('#4'), 'Includes suspended player number #4');
  assert.ok(html6v5.includes('2:00'), 'Includes countdown timer 2:00');
  assert.ok(html6v5.includes('5v6 undertag') || html6v5.includes('6v5'), 'Accurately distinguishes numerical penalty state');

  // 2. 7v6 distinction without suspension
  const s7v6 = createMatch(910, 'TOP', 1800000, 0);
  s7v6.match!.phase = 'FIRST_HALF';
  s7v6.officialClock.running = true;
  s7v6.officialClock.timeMs = 300000;
  // Replace keeper with 7th field player
  const keeper = s7v6.players.find(p => p.team === 'HOME' && p.kind === 'GOALKEEPER')!;
  keeper.population = 'BENCH';
  const extra = s7v6.players.find(p => p.team === 'HOME' && p.kind === 'FIELD_PLAYER' && p.population === 'BENCH')!;
  extra.population = 'COURT';
  extra.role = 'P2';

  const session7v6: ProductionMatchSession = {
    ...session,
    core: s7v6,
  };
  const model7v6 = reader(session7v6, false);
  const html7v6 = renderToStaticMarkup(
    React.createElement(MatchCenterSurface, {
      model: model7v6,
      fixture: session7v6.fixture,
      frames: [],
      people,
      events: s7v6.events,
      team: 'HOME',
      session: session7v6,
    })
  );

  assert.ok(html7v6.includes('7 mot 6 (tom kasse)'), 'Correctly distinguishes 7v6 empty goal from suspension');
  assert.ok(html7v6.includes('mc-7v6-pill'), 'Renders 7v6 pill in compact powerplay');

  // 3. Countdown expiration
  s.officialClock.timeMs = 240001; // Past 2 minutes
  // Advance one tick for populationBefore to expire suspension
  advanceCoreMutable(s);
  assert.equal(homeSusp.suspensionUntilMs, null, 'Suspension timer cleared');
  assert.notEqual(homeSusp.population, 'SUSPENDED', 'Player no longer has SUSPENDED population');

  const modelExpired = reader(session, false);
  const htmlExpired = renderToStaticMarkup(
    React.createElement(MatchCenterSurface, {
      model: modelExpired,
      fixture: session.fixture,
      frames: [],
      people,
      events: s.events,
      team: 'HOME',
      session,
    })
  );

  assert.ok(!htmlExpired.includes('2 min #4'), 'Expired suspension badge cleared from scoreboard');
});

