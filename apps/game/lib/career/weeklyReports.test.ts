import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from './newCareer';
import { buildStaffReport, buildTrainingReport } from './weeklyReports';
import { emptyMatchFitnessLedger, PRESEASON_MATCH_FITNESS } from '../players/matchFitness';

test('staff report names specific players from real state and keeps its four sections', () => {
  const s = { ...createNewCareerState('reports-2026', 'swe2-tumba'), playerMatchFitness: emptyMatchFitnessLedger(PRESEASON_MATCH_FITNESS) };
  const r = buildStaffReport(s, s.gameDate);
  for (const h of ['Nyckelobservationer:', 'Risker:', 'Möjligheter:', 'Rekommendationer:']) assert.ok(r.lines.includes(h), h);
  assert.ok(r.lines.some(l => l.startsWith('Lägst matchträning:') && /\(55 %\)/.test(l)), 'names the players short of match fitness');
  assert.ok(r.lines.some(l => /kapten/.test(l)), 'recommends appointing a captain when none is set');
});

test('training report says so when a full week of data is missing, never invents content', () => {
  const s = createNewCareerState('reports-2026', 'swe2-tumba');
  const r = buildTrainingReport(s, s.gameDate);
  assert.ok(r.lines.some(l => /inte än/.test(l)));
});
