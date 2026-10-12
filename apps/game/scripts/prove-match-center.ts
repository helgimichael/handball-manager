/** Final canonical result-reader, JSON continuation, archive and cost receipt. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { ledger, lossClassOf } from '@handball-manager/handball-engine/src/v2/core/ledger';
import { createNewCareerState } from '../lib/career/newCareer';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../lib/gameWorld/serverSnapshot';
import { buildMatchdayReadyEvent } from '../lib/career/careerEvents';
import { startProductionMatch, advanceProductionMatch, commandProductionMatch, finalizeProductionMatch, resultFromSession, archiveFrames, type ProductionMatchSession } from '../lib/career/productionMatch';
import { liveMatchModel, archivedMatchModel, snapshotsFor, createLiveMatchReader } from '../lib/matchCenter/model';
const out = resolve('../../docs/match-center-v2');
mkdirSync(out, { recursive: true });
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const before = execFileSync('git', ['show', '2be9c94:apps/game/lib/career/productionMatch.ts'], { encoding: 'utf8' });
const fn = before.slice(before.indexOf('export function resultFromSession('), before.indexOf('export function finalizeProductionMatch(')).replace('export function', 'function');
const code = ts.transpileModule(fn, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const legacy = new Function('ledger', 'lossClassOf', code + '\nreturn resultFromSession;')(ledger, lossClassOf) as typeof resultFromSession;
let state = createNewCareerState('match-center-v2-final-proof', 'swe2-tumba', snapshotWorldSquads('swe-2'), undefined, snapshotGameplayRatings('swe-2'));
const fixture = state.fixtures.find(f => f.homeClubId === state.playerClubId || f.awayClubId === state.playerClubId)!;
state = { ...state, gameDate: fixture.date, careerEvents: [buildMatchdayReadyEvent(fixture.id, fixture.date)] };
state = startProductionMatch(state);
const checkpoints: unknown[] = [];
function compare(s: ProductionMatchSession, label: string) { const prior = hash(s.core), start = performance.now(), original = legacy(s), legacyMs = performance.now() - start, next = performance.now(), current = resultFromSession(s), currentMs = performance.now() - next; assert.deepEqual(current, original); assert.equal(hash(s.core), prior); checkpoints.push({ label, tick: s.core.tick, exactLegacyResultEqual: true, canonicalStateUnchanged: true, legacyMs, currentMs }); console.log(JSON.stringify(checkpoints.at(-1))); }
state = advanceProductionMatch(state, 100);
compare(state.productionMatch!, 'opening');
for (let n = 0; n < 40 && !state.productionMatch!.pausedAtHalf; n++)
    state = advanceProductionMatch(state, 10000);
assert.equal(state.productionMatch!.pausedAtHalf, true);
compare(state.productionMatch!, 'halftime');
let restored = JSON.parse(JSON.stringify(state));
for (let n = 0; n < 60 && state.productionMatch!.core.match?.phase !== 'FULLTIME'; n++) {
    if (state.productionMatch!.pausedAtHalf) {
        state = commandProductionMatch(state, { kind: 'SECOND_HALF' });
        restored = commandProductionMatch(restored, { kind: 'SECOND_HALF' });
    }
    state = advanceProductionMatch(state, 10000);
    restored = advanceProductionMatch(restored, 10000);
}
assert.equal(state.productionMatch!.core.match?.phase, 'FULLTIME');
assert.deepEqual(state.productionMatch, restored.productionMatch);
compare(state.productionMatch!, 'fulltime');
const session = state.productionMatch!, costs: number[] = [];
for (let n = 0; n < 5; n++) {
    const start = performance.now();
    liveMatchModel(session);
    costs.push(performance.now() - start);
}
const reader = createLiveMatchReader(), warmCosts: number[] = [];
reader(session);
for (let n = 0; n < 5; n++) {
    const start = performance.now();
    assert.deepEqual(reader(session), liveMatchModel(session));
    warmCosts.push(performance.now() - start);
}
const cacheOnlyCosts: number[] = [];
for (let n = 0; n < 20; n++) {
    const start = performance.now();
    reader(session);
    cacheOnlyCosts.push(performance.now() - start);
}
const final = finalizeProductionMatch(state), restoredFinal = finalizeProductionMatch(restored);
assert.deepEqual(final.matchArchives, restoredFinal.matchArchives);
const archive = final.matchArchives![fixture.id], frames = archiveFrames(archive), prior = hash(archive), model = archivedMatchModel(archive);
assert.deepEqual(frames, session.frames);
assert.deepEqual(model.result, legacy(session));
for (const moment of model.keyMoments.slice(-20))
    for (const snapshot of snapshotsFor(moment.canonicalEventId, archive.events, frames, archive.people))
        assert.ok(frames.some(f => f[0] === snapshot.tick));
assert.equal(hash(archive), prior);
const preservation = JSON.parse(readFileSync(resolve(out, 'preservation.json'), 'utf8').replace(/^\uFEFF/, ''));
const engineUnchanged = preservation.engineFiles.every((f: {
    path: string;
    hash: string;
}) => createHash('sha256').update(readFileSync(resolve('../..', f.path))).digest('hex').toUpperCase() === f.hash);
assert.equal(engineUnchanged, true);
const receipt = { complete: true, checkpoint: '2be9c94', fixtureId: fixture.id, score: [archive.result.homeGoals, archive.result.awayGoals], checkpoints, jsonFullMatchSessionEqual: true, jsonFullArchiveEqual: true, archiveFrameEquality: true, archiveImmutableUnderPresentation: true, archiveHash: prior, framesHash: hash(frames), rng: session.core.rng, engineUnchanged, retainedBehaviorRevision: session.behaviorRevision, presentation: { events: model.events.length, keyMoments: model.keyMoments.length, shots: model.shots.length, frameCount: frames.length, onlySelectedSnapshotsRendered: true, coldCostMs: costs, coldMeanCostMs: costs.reduce((a, b) => a + b, 0) / costs.length, warmPausedCostMs: cacheOnlyCosts, warmPausedMeanMs: cacheOnlyCosts.reduce((a, b) => a + b, 0) / cacheOnlyCosts.length, warmFullProjectionEquality: true, cadenceMs: 200, costNote: 'Cold means rebuild all canonical history; warm measurements are repeated paused reads. New statistical facts still invoke the indexed canonical result reader. These are Node costs, not browser FPS.' }, unsupported: ['assists', 'player-attributed ledger turnovers', 'empirical live comparisons', 'body-facing annotations'], humanQA: 'PENDING' };
writeFileSync(resolve(out, 'CANONICAL-PROOF.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
