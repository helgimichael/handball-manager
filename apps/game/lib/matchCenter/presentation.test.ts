import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCoreScenario } from '@handball-manager/handball-engine/src/v2/core/scenarios';
import { liveMatchModel } from './model';
import type { ProductionMatchSession } from '../career/productionMatch';
// tsx outside Next uses the classic JSX transform for the existing primitives.
Object.assign(globalThis, { React });
import { MatchCenterSurface } from '../../components/matchCenter/MatchCenter';
const core = createCoreScenario();
core.match = { phase: 'FIRST_HALF', periodLengthMs: 1800000, periodStartMs: 0, resumeTick: 0, halfBreakMs: 0, outcomesAtHorn: 0, coachingPlan: [] };
const session = { format: 1, fixture: { id: 'semantic-proof', date: '2026-10-12', homeClubId: 'swe2-tumba', awayClubId: 'swe2-torslanda', competitionId: 'swe-2', type: 'LEAGUE', round: 1 }, core, people: core.players.map((p, i) => ({ id: p.id, name: `${p.team === 'HOME' ? 'Hemmaspelare' : 'Bortaspelare'} ${i + 1}`, number: i + 1, role: p.role, team: p.team, started: true, startEnergy: 100 })), frames: [], pausedAtHalf: false, error: null } as ProductionMatchSession;
function render() { return renderToStaticMarkup(React.createElement(MatchCenterSurface, { model: liveMatchModel(session), fixture: session.fixture, frames: [], events: [], people: session.people, team: 'HOME', experimental: React.createElement('div', { 'data-experimental-renderer': 'mounted' }, 'Kontinuerlig 2D') })); }
test('native controls and labeled select elements are keyboard reachable', () => { const html = render(); assert.match(html, /<button type="button"/); assert.match(html, /aria-label="Nyckelögonblick"/); assert.match(html, /<label>Lag<select/); assert.match(html, /Till matchbeslut/); });
test('normal rendered surface excludes continuous 2D until explicitly opened', () => { const html = render(); assert.match(html, /data-match-mode="MATCH_CENTER"/); assert.match(html, /<summary>Experimental 2D<\/summary>/); assert.doesNotMatch(html, /data-experimental-renderer/); assert.match(html, /Från planen/); assert.match(html, /Målvakterna/); });
test('pause and home-away distinctions are communicated in text', () => { const html = render(); assert.match(html, /PAUSAD/); assert.match(html, /HEMMA/); assert.match(html, /BORTA/); assert.match(html, /Utespelare på plan/); });
test('old positional gaps preserve the normal report and provide a readable empty state', () => { assert.match(render(), /Välj en viktig händelse/); assert.match(render(), /Matchstatistik/); assert.match(render(), /Registrerad avslutsposition/); });
