/** Offline proof using completed canonical season archives; no simulation. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { archiveFrames, type PlayedMatchArchive } from '../lib/career/productionMatch';
import { archivedMatchModel, snapshotsFor, keeperCategories } from '../lib/matchCenter/model';
import { overviewFacts, overviewMoments, performers, sortedPlayers, tacticalStory } from '../lib/matchCenter/workspace';
const output = resolve('../../docs/post-intelligence-reconciliation');
const season = JSON.parse(readFileSync(resolve('../../docs/post-intelligence-reconciliation/verification/season/season-end-state.json'), 'utf8'));
const archives = Object.values(season.matchArchives) as PlayedMatchArchive[];
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const names = { HOME: 'Hemmalaget', AWAY: 'Bortalaget' };
let snapshotsChecked = 0, storiesChecked = 0;
const receipts = [];
for (const archive of archives) {
    const before = hash(archive), model = archivedMatchModel(archive);
    assert.equal(model.result, archive.result);
    const facts = overviewFacts(model, names), previews = overviewMoments(model);
    assert.ok(previews.every(p => archive.events.some(e => e.id === p.canonicalEventId)));
    for (const player of model.players.filter(p => p.role === 'GK')) {
        const rows = keeperCategories(player.id, model.shots, model.events);
        assert.equal(rows.reduce((n, r) => n + r.saves, 0), player.saves);
        assert.equal(rows.reduce((n, r) => n + r.faced, 0), player.shotsFaced);
    }
    const loaded = JSON.parse(JSON.stringify(archive)) as PlayedMatchArchive, loadedModel = archivedMatchModel(loaded);
    assert.deepEqual(overviewFacts(loadedModel, names), facts);
    assert.deepEqual(sortedPlayers(loadedModel.players, 'HOME', 'RATING'), sortedPlayers(model.players, 'HOME', 'RATING'));
    assert.deepEqual(performers(loadedModel), performers(model));
    // Exact physical rows already proved for this cohort; check every selected new story.
    const frames = archiveFrames(archive);
    for (const moment of previews) {
        const snapshots = snapshotsFor(moment.canonicalEventId, archive.events, frames, archive.people);
        const story = tacticalStory(moment, archive.events, archive.people, snapshots);
        assert.ok(Object.keys(story.actors).every(id => archive.people.some(p => p.id === id)));
        assert.equal(story.stages.length, snapshots.length);
        for (const snapshot of snapshots) {
            const frame = frames.find(f => f[0] === snapshot.tick)!;
            assert.ok(frame); assert.equal(snapshot.ball.x, frame[5] / 100); assert.equal(snapshot.ball.y, frame[6] / 100);
            for (const player of snapshot.players) {
                const index = archive.people.indexOf(player.person), at = frame.findIndex((v, i) => i >= 7 && (i - 7) % 3 === 0 && v === index);
                assert.equal(player.position.x, frame[at + 1] / 100); assert.equal(player.position.y, frame[at + 2] / 100);
            }
            snapshotsChecked++;
        }
        storiesChecked++;
    }
    assert.equal(hash(archive), before);
    const start = performance.now();
    for (let i = 0; i < 100; i++) { overviewFacts(model, names); overviewMoments(model); sortedPlayers(model.players, 'HOME', 'RATING'); }
    receipts.push({ fixtureId: archive.fixture.id, archiveHash: before, score: [archive.result.homeGoals, archive.result.awayGoals], facts, derivedWorkspaceMeanMs: (performance.now() - start) / 100 });
}
writeFileSync(resolve(output, 'CANONICAL-TRUTH.json'), JSON.stringify({ source: 'Completed reconciled canonical season, read offline without resimulation', archives: archives.length, snapshotsChecked, storiesChecked, resultIdentity: true, keeperDenominators: true, serializedArchiveSameFacts: true, inputUnchanged: true, receipts }, null, 2));
console.log(JSON.stringify({ complete: true, archives: archives.length, snapshotsChecked, storiesChecked }));
