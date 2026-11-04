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
});

