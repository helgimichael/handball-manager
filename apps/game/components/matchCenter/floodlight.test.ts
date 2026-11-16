import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCoreScenario } from '@handball-manager/handball-engine/src/v2/core/scenarios';
import type { ProductionMatchSession, MatchFrame } from '../../lib/career/productionMatch';
import { liveMatchModel, type MatchCenterModel } from '../../lib/matchCenter/model';
// tsx outside Next uses the classic JSX transform for the existing primitives.
Object.assign(globalThis, { React });
import { MatchCenterSurface } from './MatchCenter';
import { TimeoutOverlay } from './TimeoutOverlay';
import { LiveCoachPanel, AssistantDock } from '../game/LiveCoachPanel';
import { trailFrames } from './PlanCourt';

function makeSession(phase: 'PREMATCH' | 'FIRST_HALF' | 'HALFTIME' | 'FULLTIME' = 'FIRST_HALF') {
    const core = createCoreScenario();
    core.match = { phase, periodLengthMs: 1800000, periodStartMs: 0, resumeTick: 0, halfBreakMs: 0, outcomesAtHorn: 0, coachingPlan: [] };
    return { format: 1, fixture: { id: 'floodlight', date: '2026-10-12', homeClubId: 'swe2-tumba', awayClubId: 'swe2-torslanda', competitionId: 'swe-2', type: 'LEAGUE', round: 1 }, core, people: core.players.map((p, i) => ({ id: p.id, name: `${p.team === 'HOME' ? 'Hemmaspelare' : 'Bortaspelare'} ${i + 1}`, number: i + 1, role: p.role, team: p.team, started: true, startEnergy: 100 })), frames: [], pausedAtHalf: phase === 'HALFTIME', error: null } as unknown as ProductionMatchSession;
}
function surface(session: ProductionMatchSession, model: MatchCenterModel, extra: Record<string, unknown> = {}) {
    return renderToStaticMarkup(React.createElement(MatchCenterSurface, { model, fixture: session.fixture, frames: [], events: [], people: session.people, team: 'HOME', session, onCommand: () => {}, primaryAction: React.createElement('button', { type: 'button' }, 'PRIMÄR'), controls: React.createElement('span', null, 'TRANSPORT'), coach: React.createElement('div', null, 'DOCK'), ...extra }));
}

test('walk-out phase shows both starting sevens before throw-off', () => {
    const s = makeSession('PREMATCH'), html = surface(s, liveMatchModel(s));
    assert.match(html, /data-flow-phase="walkout"/);
    assert.match(html, /Startsjuorna är på plan/);
    assert.match(html, /Hemmaspelare/); assert.match(html, /Bortaspelare/);
    assert.match(html, /PRIMÄR/, 'the primary stays in the transport during walk-out');
});

test('live overview is live-first: key moment, feed and five numbers; review content stays out', () => {
    const s = makeSession(), html = surface(s, liveMatchModel(s));
    assert.match(html, /mc-live-now/); assert.match(html, /Från planen/); assert.match(html, /Matchen i siffror/);
    for (const label of ['Mål/skott', 'Räddningar', 'Bollförluster', '2 min', '7m']) assert.ok(html.includes(`<dt>${label}</dt>`), label);
    assert.doesNotMatch(html, /Matchens profiler|Händelser att återvända till/);
    assert.match(html, /mc-momentum/, 'momentum line under the score bug');
});

test('half-time briefing holds numbers, energy, suggestions and the single start action', () => {
    const s = makeSession('HALFTIME'), model = liveMatchModel(s);
    assert.equal(model.status, 'HALFTIME');
    const html = surface(s, model);
    assert.match(html, /Första halvlek i siffror/); assert.match(html, /Energi/); assert.match(html, /Assistentens förslag/);
    assert.match(html, /Nästa halvlek börjar med ditt beslut/);
    assert.equal((html.match(/PRIMÄR/g) ?? []).length, 1, 'the start button moves into the briefing instead of being duplicated');
    assert.ok(html.indexOf('PRIMÄR') > html.indexOf('mc-halftime'), 'rendered inside the briefing');
});

test('live final whistle carries the one finish action and does not repeat the report story', () => {
    const s = makeSession('FULLTIME'), html = surface(s, liveMatchModel(s));
    assert.match(html, /Slutsignal/);
    assert.equal((html.match(/PRIMÄR/g) ?? []).length, 1);
    assert.doesNotMatch(html, /mc-summary|Matchens profiler|Händelser att återvända till/);
});

test('archive review keeps the full story overview used by the match report', () => {
    const s = makeSession('FULLTIME'), model = liveMatchModel(s);
    const html = renderToStaticMarkup(React.createElement(MatchCenterSurface, { model, fixture: s.fixture, frames: [], events: [], people: s.people, team: 'HOME', experimental: React.createElement('div', null, 'court') }));
    assert.match(html, /mc-summary/); assert.match(html, /Händelser att återvända till/); assert.match(html, /Matchens profiler/);
    assert.match(html, />Plan<\/button>/);
});

test('timeout huddle shows at most three directive cards and no duplicate substitution or tactics panel', () => {
    const s = makeSession(), model = liveMatchModel(s);
    s.core.referee.timeout = { reason: 'TEAM_TIMEOUT', untilTick: s.core.tick + 1200, wasRunning: true } as typeof s.core.referee.timeout;
    const html = renderToStaticMarkup(React.createElement(TimeoutOverlay, { session: s, model, team: 'HOME', names: { HOME: 'Tumba', AWAY: 'Torslanda' }, callingTeam: 'HOME', onCommand: () => {}, onResumeTimeout: () => {} }));
    assert.equal((html.match(/class="mc-timeout-instruction-btn mc-huddle-card/g) ?? []).length, 3);
    assert.match(html, /Effekt/); assert.match(html, /Risk/); assert.match(html, /Gäller/);
    assert.doesNotMatch(html, /Genomför snabbyte|Taktiska grundinställningar|coach-choice-group/);
    assert.match(html, /Återgå till match/);
});

test('bench dock: timeout first with its reason, players by energy, tactics and the assistant switch', () => {
    const s = makeSession();
    const court = s.core.players.filter(p => p.team === 'HOME' && p.population === 'COURT');
    court.forEach((p, i) => { p.condition.energy = 0.9 - i * 0.05; });
    const tiredest = court.at(-1)!;
    const html = renderToStaticMarkup(React.createElement(LiveCoachPanel, { session: s, team: 'HOME', busy: false, outId: '', inId: '', onOut: () => {}, onIn: () => {}, onSubstitute: () => {}, onCommand: () => {}, recent: [], showEvents: false }));
    assert.ok(html.indexOf('data-section="timeout"') < html.indexOf('data-section="subs"'));
    assert.ok(html.indexOf('data-section="subs"') < html.indexOf('data-section="tactics"'));
    assert.match(html, /aria-label="Timeout"/);
    assert.match(html, /class="coach-timeout mc-dock-timeout"/);
    const name = s.people.find(p => p.id === tiredest.id)!.name;
    const firstOut = html.match(/aria-label="Byt ut ([^"]+)"/)![1];
    assert.equal(firstOut, name, 'the tiredest on-court player is listed first');
    assert.match(html, /role="switch"[^>]*aria-checked/);
    assert.match(html, /Assistentbyten/);
});

test('assistant dock is read-only and shows the current tactics', () => {
    const s = makeSession();
    const html = renderToStaticMarkup(React.createElement(AssistantDock, { session: s, team: 'HOME', control: { by: 'ASSISTANT', name: 'Anna Berg', reason: 'Managern är avstängd.', remaining: 1, caseId: 'x' } }));
    assert.match(html, /Anna Berg leder laget/); assert.match(html, /AB/); assert.match(html, /Försvar/);
    assert.doesNotMatch(html, /<button/);
});

test('plan trails take only recorded frames inside the window', () => {
    const frames = [10, 20, 50, 80, 90, 120].map(t => [t] as unknown as MatchFrame);
    assert.deepEqual(trailFrames(frames, 90, 60).map(f => f[0]), [50, 80, 90]);
    assert.deepEqual(trailFrames(frames, 5, 60), []);
});

test('hideOverview drops the Översikt view and starts on key moments; default unchanged', () => {
    const s = makeSession('FULLTIME'), model = liveMatchModel(s);
    const html = renderToStaticMarkup(React.createElement(MatchCenterSurface, { model, fixture: s.fixture, frames: [], events: [], people: s.people, team: 'HOME', hideOverview: true }));
    assert.equal((html.match(/role="tab"/g) ?? []).length, 3);
    assert.doesNotMatch(html, />Översikt<\/button>/);
    assert.match(html, /aria-selected="true"[^>]*>Nyckelögonblick<\/button>/);
    assert.doesNotMatch(html, /mc-summary/);
});
