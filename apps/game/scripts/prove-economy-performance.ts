/** Sequential descriptive timing; diagnostics never enter the canonical tick path. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { createMatch } from '@handball-manager/handball-engine/src/v2/core/match';
import { advanceCoreMutable } from '@handball-manager/handball-engine/src/v2/core/engine';
import { ledger } from '@handball-manager/handball-engine/src/v2/core/ledger';
import type { CoreState } from '@handball-manager/handball-engine/src/v2/core/state';

const root = resolve('../..'), output = resolve('../../docs/player-attributes-possession-economy-v1/PERFORMANCE.json');
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const median = (n: number[]) => [...n].sort((a, b) => a - b)[Math.floor(n.length / 2)];
const ticks: number[] = [], finalHashes: string[] = [];
for (let i = 0; i < 4; i++) {
  const core = createMatch(8123, 'TOP', 1800000, 0), start = performance.now();
  for (let tick = 0; tick < 3000; tick++) advanceCoreMutable(core);
  ticks.push(performance.now() - start); finalHashes.push(hash(core));
}
assert.equal(new Set(finalHashes).size, 1, 'Repeated unobserved ticks are exact');
const baselineSource = execFileSync('git', ['show', '2017385:packages/handball-engine/src/v2/core/ledger.ts'], { cwd: root, encoding: 'utf8' });
const historicalModule = { exports: {} as { ledger: typeof ledger } };
runInNewContext(ts.transpileModule(baselineSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { module: historicalModule, exports: historicalModule.exports });
const readers = [];
for (const league of ['hbl', 'allsv']) {
  const core = JSON.parse(gunzipSync(readFileSync(resolve(root, `docs/player-attributes-possession-economy-v1/final/${league}/core-000.json.gz`))).toString('utf8')) as CoreState;
  const before = hash(core), previous: number[] = [], current: number[] = [];
  for (let repeat = 0; repeat < 4; repeat++) {
    const order = repeat % 2 ? ['current', 'previous'] : ['previous', 'current'];
    for (const kind of order) {
      const start = performance.now(); (kind === 'previous' ? historicalModule.exports.ledger : ledger)(core);
      (kind === 'previous' ? previous : current).push(performance.now() - start);
    }
  }
  assert.equal(hash(core), before, 'Both trusted readers preserve canonical state');
  readers.push({ league, events: core.events.length, previousMs: previous.slice(1), currentMs: current.slice(1), previousMedianMs: median(previous.slice(1)), currentMedianMs: median(current.slice(1)), coreSha256: before });
}
const prior = JSON.parse(readFileSync(resolve(root, 'docs/physical-load-fatigue-v11/PERFORMANCE.json'), 'utf8'));
const sourceHash = (text: string) => createHash('sha256').update(text).digest('hex');
const result = { complete: true, measuredAt: new Date().toISOString(), sourceFingerprints: { historicalLedger: sourceHash(baselineSource), currentLedger: sourceHash(readFileSync(resolve(root, 'packages/handball-engine/src/v2/core/ledger.ts'), 'utf8')) }, resourceSafety: 'One foreground process; no concurrent heavy job.', unobserved: { ticks: 3000, seed: 8123, warmupExcluded: true, repeats: 3, milliseconds: ticks.slice(1), medianMs: median(ticks.slice(1)), priorPhysicalMedianMs: prior.afterMedianMs, currentOverPrior: median(ticks.slice(1)) / prior.afterMedianMs, exactRepeatedFinalHash: finalHashes[0], interpretation: 'Descriptive wall clock across separate runs. All canonical tick modules are byte-preserved; the changed ledger is a post-match/result reader. Machine load and runtime warmup prevent attributing a timing difference to gameplay.' }, readers, readerScope: 'Same retained canonical core, alternating historical2017385 and corrected pure ledger; three measured repeats after warmup. No frame/event reconstruction added to per-tick execution. Rare aliased turnover timestamp fallback occurs only inside the result reader.', limitations: 'These short timings are not a device-wide responsiveness benchmark. Diagnostics OFF/ON full-match timings include three developer observers and checkpoint capture; see canonical proof receipts.' };
writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ complete: true, unobservedMedianMs: result.unobserved.medianMs, readerMedians: readers.map(r => ({ league: r.league, previous: r.previousMedianMs, current: r.currentMedianMs })) }));
