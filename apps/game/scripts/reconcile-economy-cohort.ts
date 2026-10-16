/** Re-read retained canonical cores after a reporting-only correction. No simulation. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import type { CoreState } from '@handball-manager/handball-engine/src/v2/core/state';
import { ledger } from '@handball-manager/handball-engine/src/v2/core/ledger';
import { possessionEconomy } from './lib/possessionEconomy';
import { readOrdinaryFreeThrows } from '../lib/matchCenter/freeThrows';

const args = process.argv.slice(2), league = args[args.indexOf('--league') + 1];
assert.ok(['hbl', 'allsv'].includes(league), '--league hbl|allsv');
const root = resolve('../..'), source = join(root, 'docs/player-attributes-possession-economy-v1/final', league), out = join(source, 'reconciled');
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const hash = (x: unknown) => createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex');
const coreDir = join(root, 'packages/handball-engine/src/v2/core');
const paths = [...readdirSync(coreDir).filter(p => p.endsWith('.ts') && !p.endsWith('.test.ts')).map(p => join(coreDir, p)), resolve('scripts/lib/possessionEconomy.ts'), resolve('lib/matchCenter/freeThrows.ts'), resolve('scripts/reconcile-economy-cohort.ts')];
const fingerprint = () => Object.fromEntries(paths.map(p => [p.slice(root.length + 1).replaceAll('\\', '/'), hash(readFileSync(p, 'utf8'))]));
const sources = fingerprint(), original = read(join(source, 'summary.json'));
assert.equal(original.complete, true); assert.equal(original.n, 40);
mkdirSync(out, { recursive: true });
const matches = [];
for (let index = 0; index < 40; index++) {
  const name = `match-${String(index).padStart(3, '0')}.json`, rawPath = join(source, name), raw = read(rawPath);
  const coreText = gunzipSync(readFileSync(join(source, `core-${String(index).padStart(3, '0')}.json.gz`))).toString('utf8');
  assert.equal(hash(coreText), raw.coreHash, 'Retained canonical core hash');
  const core = JSON.parse(coreText) as CoreState, before = hash(core), started = performance.now();
  const economy = possessionEconomy(core, raw.technical), currentLedger = ledger(core);
  const freeThrows = readOrdinaryFreeThrows(core.events, { source: 'LIVE', behaviorRevision: 'career-physical-load-v11', complete: true });
  assert.equal(hash(core), before, 'Pure reporting only');
  for (const team of ['HOME', 'AWAY'] as const) {
    assert.equal(economy.teams[team].broadBallLosses, economy.teams[team].canonicalUiBallLosses, 'Independent loss count agrees with result reader');
    // The original presentation receipt retains the real revision/provenance.
    assert.equal(raw.freeThrowPresentation.counts[team], economy.teams[team].freeThrows);
    assert.equal(freeThrows.counts?.[team], economy.teams[team].freeThrows);
  }
  const { resultHash, ...retained } = raw;
  const report = { ...retained, ...economy, complete: true, canonicalLedger: { records: currentLedger.records, endings: currentLedger.endings, nonShotLoss: currentLedger.nonShotLoss }, reanalysis: { sourceReportSha256: hash(readFileSync(rawPath, 'utf8')), coreSha256: before, sourceFingerprints: sources, originalResultHash: resultHash, currentResultHash: null, reason: 'Reporting-only correction using identical retained core and technical snapshots; full wrapper not retained. Canonical session hash and prior-exact proof remain unchanged.', sourceFreeThrowRead: freeThrows.provenance, elapsedMs: performance.now() - started } };
  writeFileSync(join(out, name), JSON.stringify(report, null, 2));
  matches.push({ index, sessionHash: report.sessionHash, teams: report.teams, integrity: report.integrity });
  console.log(JSON.stringify({ league, index, losses: Object.values(report.teams as Record<string, { broadBallLosses: number }>).map(t => t.broadBallLosses), integrity: report.integrity }));
}
assert.deepEqual(fingerprint(), sources);
writeFileSync(join(out, 'summary.json'), JSON.stringify({ complete: true, n: 40, league, sources, originalManifest: original.manifest, design: 'No re-simulation; retained full canonical cores and observer snapshots re-read after pure classification correction.', matches }, null, 2));
console.log(`${league}: RECONCILED 40`);
