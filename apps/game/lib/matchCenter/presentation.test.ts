import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCoreScenario } from '@handball-manager/handball-engine/src/v2/core/scenarios';
import { liveMatchModel, archivedMatchModel, createLiveMatchReader } from './model';
import { resultFromSession, type ProductionMatchSession, type PlayedMatchArchive } from '../career/productionMatch';
import { record, getPlayer, type CoreEvent } from '@handball-manager/handball-engine/src/v2/core/state';
import { startAction } from '@handball-manager/handball-engine/src/v2/core/actions';
import { judgeFoul, refereeAfter } from '@handball-manager/handball-engine/src/v2/core/referee';
import { acquire, awardRestart } from '@handball-manager/handball-engine/src/v2/core/transitions';
import { completeRestart } from '@handball-manager/handball-engine/src/v2/core/restarts';
// tsx outside Next uses the classic JSX transform for the existing primitives.
Object.assign(globalThis, { React });
import { KeyMoment, MatchCenterSurface } from '../../components/matchCenter/MatchCenter';
import { StatisticsView, PlayersView } from '../../components/matchCenter/WorkspaceViews';
const core = createCoreScenario();
core.match = { phase: 'FIRST_HALF', periodLengthMs: 1800000, periodStartMs: 0, resumeTick: 0, halfBreakMs: 0, outcomesAtHorn: 0, coachingPlan: [] };
const session = { format: 1, fixture: { id: 'semantic-proof', date: '2026-10-12', homeClubId: 'swe2-tumba', awayClubId: 'swe2-torslanda', competitionId: 'swe-2', type: 'LEAGUE', round: 1 }, core, people: core.players.map((p, i) => ({ id: p.id, name: `${p.team === 'HOME' ? 'Hemmaspelare' : 'Bortaspelare'} ${i + 1}`, number: i + 1, role: p.role, team: p.team, started: true, startEnergy: 100 })), frames: [], pausedAtHalf: false, error: null } as ProductionMatchSession;
function render() { return renderToStaticMarkup(React.createElement(MatchCenterSurface, { model: liveMatchModel(session), fixture: session.fixture, frames: [], events: [], people: session.people, team: 'HOME', experimental: React.createElement('div', { 'data-experimental-renderer': 'mounted' }, 'Kontinuerlig 2D') })); }
test('match navigation uses keyboard reachable tabs with one selected overview', () => { const html = render(); assert.match(html, /role="tablist" aria-label="Matchvy"/); assert.equal((html.match(/role="tab"/g) ?? []).length, 4); assert.equal((html.match(/aria-selected="true"/g) ?? []).length, 1); assert.match(html, /data-view="OVERVIEW"/); assert.match(html, /Till matchbeslut/); });
test('normal overview excludes continuous 2D and hidden expensive analysis', () => { const html = render(); assert.match(html, /data-match-mode="MATCH_CENTER"/); assert.match(html, /<summary>Experimental 2D<\/summary>/); assert.doesNotMatch(html, /data-experimental-renderer|mc-shot-map|mc-tactical|mc-performance table/); assert.match(html, /Från planen/); assert.match(html, /Matchen i siffror/); });
test('pause and home-away distinctions are communicated in text', () => { const html = render(); assert.match(html, /PAUSAD/); assert.match(html, /HEMMA/); assert.match(html, /BORTA/); assert.match(html, /Utespelare på plan/); });
test('old positional gaps provide a readable tactical empty state', () => { const html = renderToStaticMarkup(React.createElement(KeyMoment, { moment: null, events: [], frames: [], people: [] })); assert.match(html, /Välj en viktig händelse/); });
test('player workspace exposes canonical rows and sorting without substitution as its default action', () => { const html = renderToStaticMarkup(React.createElement(PlayersView, { model: liveMatchModel(session), team: 'HOME', events: [], onMoment: () => {} })); assert.match(html, /Matchprestationer/); assert.match(html, /Sortera/); assert.match(html, /Spelarens matchdetaljer/); assert.match(html, /Hemmaspelare/); assert.doesNotMatch(html, /Byt ut/); });
test('statistics mounts match totals first and offers separately selected analysis', () => { const html = renderToStaticMarkup(React.createElement(StatisticsView, { model: liveMatchModel(session), team: 'HOME' })); assert.match(html, /Matchstatistik/); assert.match(html, /Statistikområden/); assert.doesNotMatch(html, /mc-shot-map/); });

test('Frikast appears once in statistics from canonical model counts', () => {
    const model = liveMatchModel(session);
    model.freeThrows = { counts: { HOME: 3, AWAY: 5 }, provenance: 'CANONICAL_WHISTLES', issues: [], eventIds: [], duplicateEvents: 0, duplicateFouls: 0 };
    const html = renderToStaticMarkup(React.createElement(StatisticsView, { model, team: 'HOME' }));
    assert.equal((html.match(/scope="row">Frikast<\/th>/g) ?? []).length, 1);
    assert.match(html, /<td>3<\/td><th scope="row">Frikast<\/th><td>5<\/td>/);
    assert.match(html, /bredare mått än registrerade tekniska fel/);
});
test('unavailable legacy free throws have no statistics row', () => {
    const model = liveMatchModel(session);
    model.freeThrows = { counts: null, provenance: 'UNAVAILABLE', issues: ['Legacy'], eventIds: [], duplicateEvents: 0, duplicateFouls: 0 };
    const html = renderToStaticMarkup(React.createElement(StatisticsView, { model, team: 'HOME' }));
    assert.doesNotMatch(html, /scope="row">Frikast<\/th>/);
});
test('Frikast does not add an Overview metric', () => {
    assert.doesNotMatch(render(), /scope="row">Frikast<\/th>/);
});
test('live, incremental and archived models preserve the same canonical Frikast count', () => {
    const own = structuredClone(session);
    own.behaviorRevision = 'career-physical-load-v11';
    const base = { tick: 100, timeMs: 5000, officialMs: 5000, possessionId: 'same-attack', actionId: null, actorId: own.core.players.find(p => p.team === 'AWAY')!.id, relatedIds: [], contestId: null };
    own.core.events = [
        { ...base, id: 'foul-event', type: 'FOUL', details: { foulId: 'foul-1', advantage: false } },
        { ...base, id: 'assessment-event', type: 'FOUL_ASSESSED', details: { foulId: 'foul-1', decision: 'WHISTLE_NOW' } },
        { ...base, id: 'whistle-event', type: 'WHISTLE_RESTART', details: { foulId: 'foul-1', owner: 'HOME', kind: 'FREE_THROW' } },
    ] satisfies CoreEvent[];
    const before = JSON.stringify(own), live = liveMatchModel(own), cached = createLiveMatchReader();
    const archive: PlayedMatchArchive = { format: 2, behaviorRevision: own.behaviorRevision, fixture: own.fixture, version: own.core.version, seed: own.core.seed, people: own.people, events: own.core.events, result: live.result, load: {} };
    assert.deepEqual(live.freeThrows?.counts, { HOME: 1, AWAY: 0 });
    assert.deepEqual(cached(own).freeThrows, live.freeThrows);
    assert.deepEqual(cached(own).freeThrows, live.freeThrows);
    assert.deepEqual(archivedMatchModel(archive).freeThrows, live.freeThrows);
    assert.equal(JSON.stringify(own), before);
});
test('later loss after a same-tick recalled advantage uses the final attack clock without mutating state', () => {
    const own = structuredClone(session), c = own.core, attacker = getPlayer(c, 'H03'), defender = getPlayer(c, 'A03');
    c.events = []; c.checkpoint.stopOnOutcome = false; c.tick = 1000; c.timeMs = 50000; c.officialClock.timeMs = 50000;
    record(c, 'BALL_CONTROLLED', attacker, { reason: 'Pass received' });
    startAction(c, attacker, 'DRIVE', 'Pending advantage before a recalled restart'); attacker.action!.phase = 'EXECUTING';
    judgeFoul(c, attacker, defender, 'ORDINARY', 'Contact from behind the attacker', false, 'timestamp-contact');
    c.tick++; c.timeMs = c.tick * 50; c.officialClock.timeMs = c.timeMs;
    awardRestart(c, 'FREE_THROW', 'AWAY', attacker.position, 'Held longer than three seconds', attacker, false);
    refereeAfter(c);
    const restored = c.possession.id;
    acquire(c, attacker, attacker.position, 'Dead-ball retrieval'); completeRestart(c, 'BALL_RELEASE');
    c.tick = 2600; c.timeMs = 130000; c.officialClock.timeMs = 130000;
    awardRestart(c, 'FREE_THROW', 'AWAY', attacker.position, 'More than three steps', attacker, false);
    assert.notEqual(restored, 'possession-0');
    const before = JSON.stringify(own), result = resultFromSession(own), losses = result.events.filter(e => e.type === 'TURNOVER');
    assert.equal(result.homeStats.turnovers, 1); assert.equal(result.awayStats.turnovers, 0);
    assert.equal(losses.length, 1); assert.equal(losses[0].minute, 3);
    assert.equal(Math.ceil(c.events.findLast(e => e.possessionId === 'possession-0')!.officialMs / 60000), 1, 'the old ID would report the wrong minute');
    assert.equal(JSON.stringify(own), before);
});
