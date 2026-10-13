import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCoreScenario } from '@handball-manager/handball-engine/src/v2/core/scenarios';
import { liveMatchModel } from './model';
import type { ProductionMatchSession } from '../career/productionMatch';
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
