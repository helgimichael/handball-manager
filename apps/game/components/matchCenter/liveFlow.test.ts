import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoreScenario } from '@handball-manager/handball-engine/src/v2/core/scenarios';
import type { ProductionMatchSession } from '../../lib/career/productionMatch';
import { liveMatchModel, type MatchPresentationEvent, type PlayerRow } from '../../lib/matchCenter/model';
import { matchPhase, momentumSeries, momentumPath, miniStats, energyTone, byEnergy, energyBoard, halftimeSuggestions, huddleDirectives, timelineMarkers, filterShotKind, speedForKey, simulationProgress, initials, ownMargin } from './liveFlow';

const core = createCoreScenario();
const session = { format: 1, fixture: { id: 'live-flow' }, core, people: core.players.map((p, i) => ({ id: p.id, name: `Spelare ${i}`, number: i + 1, role: p.role, team: p.team, started: true, startEnergy: 100 })), frames: [], pausedAtHalf: false } as unknown as ProductionMatchSession;
const model = liveMatchModel(session);
const goal = (id: string, minute: number, score: [number, number], team: 'HOME' | 'AWAY' = 'HOME'): MatchPresentationEvent => ({ canonicalEventId: id, type: 'GOAL', team, tick: minute * 1200, timestamp: minute * 60000, actionId: id, playerId: null, period: minute <= 30 ? 1 : 2, importance: 'KEY', headline: `Mål ${id}`, detail: '', score, tacticalContext: null, replayReference: id });

test('phases follow the match status: walk-out, live, huddle, half-time, final whistle', () => {
    assert.equal(matchPhase('PREMATCH'), 'WALKOUT');
    assert.equal(matchPhase('LIVE'), 'LIVE');
    assert.equal(matchPhase('PAUSED'), 'LIVE');
    assert.equal(matchPhase('TIMEOUT'), 'HUDDLE');
    assert.equal(matchPhase('HALFTIME'), 'HALFTIME');
    assert.equal(matchPhase('FULLTIME'), 'FINAL');
});

test('momentum is the registered goal difference from the own side, as a step path', () => {
    const events = [goal('a', 3, [1, 0]), goal('b', 9, [1, 1], 'AWAY'), goal('c', 12, [1, 2], 'AWAY')];
    assert.deepEqual(momentumSeries(events, 'HOME').map(p => p.diff), [0, 1, 0, -1]);
    assert.deepEqual(momentumSeries(events, 'AWAY').map(p => p.diff), [0, -1, 0, 1]);
    const path = momentumPath(momentumSeries(events, 'HOME'), 0.5, 600, 40);
    assert.match(path, /^M0 20 H30 V/);
    assert.match(path, /H300$/, 'extends to the current clock');
    assert.deepEqual(momentumSeries([], 'HOME'), [{ at: 0, diff: 0 }]);
});

test('mini stats give five own-vs-opponent numbers with lower-is-better for turnovers and suspensions', () => {
    const result = structuredClone(model.result);
    Object.assign(result.homeStats, { goals: 10, shots: 20, saves: 5, shotsFaced: 15, turnovers: 4, twoMinuteSuspensions: 1, sevenMetreGoals: 2, sevenMetreAttempts: 3 });
    Object.assign(result.awayStats, { goals: 8, shots: 20, saves: 10, shotsFaced: 20, turnovers: 6, twoMinuteSuspensions: 3, sevenMetreGoals: 1, sevenMetreAttempts: 1 });
    const stats = miniStats(result, 'HOME');
    assert.deepEqual(stats.map(s => s.label), ['Mål/skott', 'Räddningar', 'Bollförluster', '2 min', '7m']);
    assert.equal(stats[0].own, '10/20 · 50 %');
    assert.equal(stats[0].better, true);
    assert.equal(stats[1].better, false, '33 % vs 50 % saves');
    assert.equal(stats[2].better, true, 'fewer turnovers is better');
    assert.equal(stats[3].better, true, 'fewer suspensions is better');
    assert.equal(miniStats(result, 'AWAY')[0].own, '8/20 · 40 %');
    assert.equal(ownMargin(result, 'AWAY'), result.awayGoals - result.homeGoals);
});

test('energy tones and ordering put the tiredest first and unknown last without mutating', () => {
    assert.equal(energyTone(55), 'low'); assert.equal(energyTone(70), 'tired'); assert.equal(energyTone(90), 'ok'); assert.equal(energyTone(null), 'unknown');
    const items = [{ id: 'a', e: 80 }, { id: 'b', e: null }, { id: 'c', e: 50 }, { id: 'd', e: 80 }];
    const before = JSON.stringify(items);
    assert.deepEqual(byEnergy(items, i => i.e).map(i => i.id), ['c', 'a', 'd', 'b']);
    assert.deepEqual(byEnergy(items, i => i.e, 'desc').map(i => i.id), ['a', 'd', 'c', 'b']);
    assert.equal(JSON.stringify(items), before);
});

test('energy board splits own court and bench players, lowest first', () => {
    const rows = model.players.map((p, i) => ({ ...p, energy: 100 - i })) as PlayerRow[];
    const board = energyBoard(rows, 'HOME');
    assert.ok(board.court.every(p => p.team === 'HOME' && p.population === 'COURT'));
    assert.ok(board.bench.every(p => p.team === 'HOME' && p.population === 'BENCH'));
    for (let i = 1; i < board.court.length; i++) assert.ok((board.court[i - 1].energy ?? 0) <= (board.court[i].energy ?? 0));
});

test('half-time suggestions only come from recommended directives and low-energy court players', () => {
    const rows = model.players.map(p => ({ ...p, energy: p.team === 'HOME' && p.population === 'COURT' && p.role === 'CB' ? 41 : 95 })) as PlayerRow[];
    const directives = [{ id: 'A', title: 'Alpha', intendedEffect: 'x', isRecommended: true }, { id: 'B', title: 'Beta', intendedEffect: 'y', isRecommended: false }];
    const out = halftimeSuggestions(directives, rows, 'HOME');
    assert.deepEqual(out.map(s => s.id.split(':')[0]), ['directive', ...out.slice(1).map(() => 'rest')]);
    assert.ok(out.some(s => s.detail.startsWith('41 %')));
    assert.equal(halftimeSuggestions(directives, rows, 'HOME', 'A').some(s => s.id === 'directive:A'), false, 'an already active directive is not suggested again');
    assert.deepEqual(halftimeSuggestions([], model.players.map(p => ({ ...p, energy: 90 })), 'HOME'), []);
});

test('huddle shows at most three directives: recommended, then active, then in order', () => {
    const all = ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, isRecommended: id === 'd' }));
    assert.deepEqual(huddleDirectives(all, 'e').map(d => d.id), ['d', 'e', 'a']);
    assert.deepEqual(huddleDirectives(all).map(d => d.id), ['d', 'a', 'b']);
    assert.equal(huddleDirectives(all, null, 2).length, 2);
});

test('timeline places moments on the 0-60 track with a category and filter state', () => {
    const markers = timelineMarkers([goal('g', 30, [1, 0]), { ...goal('s', 45, [1, 0]), type: 'SAVE_PARRY' }], [], 'GOAL');
    assert.equal(markers[0].at, 0.5); assert.equal(markers[0].category, 'GOAL'); assert.equal(markers[0].active, true);
    assert.equal(markers[1].category, 'SAVE'); assert.equal(markers[1].active, false);
});

test('shot kind filter uses registered kind or transition phase', () => {
    const base = model.shots[0] ?? { eventId: 'x', actionId: null, playerId: 'p', team: 'HOME', tick: 0, timestamp: 0, kind: 'WING', phase: 'SET', origin: null, outcome: 'GOAL', keeperId: null };
    const shots = [{ ...base, kind: 'BREAKTHROUGH', phase: 'SET' }, { ...base, kind: 'WING', phase: 'TRANSITION' }, { ...base, kind: 'SEVEN_METRE', phase: 'SET' }] as typeof model.shots;
    assert.equal(filterShotKind(shots, 'ALL').length, 3);
    assert.equal(filterShotKind(shots, 'TRANSITION').length, 1);
    assert.equal(filterShotKind(shots, 'SEVEN_METRE')[0].kind, 'SEVEN_METRE');
});

test('speed shortcuts map 1-7 to the named speeds and ignore anything else', () => {
    assert.equal(speedForKey('1'), 1); assert.equal(speedForKey('6'), 64); assert.equal(speedForKey('7'), 86);
    assert.equal(speedForKey('8'), null); assert.equal(speedForKey('0'), null); assert.equal(speedForKey('a'), null); assert.equal(speedForKey('10'), null);
});

test('quick-finish progress follows the official clock and marks goals', () => {
    const p = simulationProgress(1800000, [goal('a', 15, [1, 0]), goal('b', 45, [1, 1], 'AWAY'), goal('n', 50, [1, 1])].map(g => ({ id: g.canonicalEventId, timestamp: g.timestamp, team: g.canonicalEventId === 'n' ? null : g.team })));
    assert.equal(p.at, 0.5); assert.deepEqual(p.goals.map(g => [g.at, g.team]), [[0.25, 'HOME'], [0.75, 'AWAY']]);
    assert.equal(simulationProgress(null, []).at, 0);
    assert.equal(initials('Anna Berg Svensson'), 'AB'); assert.equal(initials(''), '?');
});
