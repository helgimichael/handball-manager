import test from 'node:test';
import assert from 'node:assert/strict';
import type { CoreEvent } from '@handball-manager/handball-engine/src/v2/core/state';
import { readOrdinaryFreeThrows } from './freeThrows';

const options = { source: 'ARCHIVE' as const, behaviorRevision: 'career-physical-load-v11', complete: true };
const fact = (id: string, type: string, details: CoreEvent['details'] = {}, tick = 100): CoreEvent => ({ id, tick, timeMs: tick * 50, officialMs: tick * 50, type, possessionId: 'same-attack', actionId: 'contact', actorId: 'defender', relatedIds: ['attacker'], contestId: 'contact', details });
const whistle = (id = 'whistle-1', foulId = 'foul-1', owner: 'HOME' | 'AWAY' = 'HOME', kind = 'FREE_THROW') => fact(id, 'WHISTLE_RESTART', { foulId, owner, kind, reason: 'Defensive contact', assessedTick: 100 });
const protocol = (foulId = 'foul-1') => [fact(`foul-${foulId}`, 'FOUL', { foulId, advantage: false }), fact(`assessment-${foulId}`, 'FOUL_ASSESSED', { foulId, decision: 'WHISTLE_NOW' }), whistle(`whistle-${foulId}`, foulId)];

test('ordinary defensive whistle credits the awarded attacking team once', () => {
    assert.deepEqual(readOrdinaryFreeThrows(protocol(), options).counts, { HOME: 1, AWAY: 0 });
});
test('FOUL and FOUL_ASSESSED are evidence, not additional free throws', () => {
    const read = readOrdinaryFreeThrows(protocol(), options);
    assert.equal(read.eventIds.length, 1);
    assert.equal(read.provenance, 'CANONICAL_WHISTLES');
});
test('two distinct foul whistles inside one possession count separately', () => {
    assert.deepEqual(readOrdinaryFreeThrows([...protocol('a'), ...protocol('b')], options).counts, { HOME: 2, AWAY: 0 });
});
test('home and away awards use explicit owner, never defender team or actor', () => {
    assert.deepEqual(readOrdinaryFreeThrows([whistle(), whistle('whistle-2', 'foul-2', 'AWAY')], options).counts, { HOME: 1, AWAY: 1 });
});
test('7m whistle is excluded from ordinary defensive free throws', () => {
    assert.deepEqual(readOrdinaryFreeThrows([whistle('seven', 'seven', 'AWAY', 'SEVEN_METRE')], options).counts, { HOME: 0, AWAY: 0 });
});
test('timeout, medical, passive and technical restart awards are excluded', () => {
    const rows = ['Team time-out', 'Medical interruption', 'Passive play after pass allowance', 'More than three steps'].map((reason, i) => fact(`restart-${i}`, 'RESTART_AWARDED', { kind: 'FREE_THROW', owner: 'HOME', reason }));
    assert.deepEqual(readOrdinaryFreeThrows(rows, options).counts, { HOME: 0, AWAY: 0 });
});
test('a final-signal retake of the same restart is not another foul whistle', () => {
    const rows = [...protocol(), fact('horn', 'PERIOD_HORN', { finalThrow: 'FREE_THROW' }), fact('retake', 'RESTART_AWARDED', { kind: 'FREE_THROW', owner: 'HOME', reason: 'Throw retained or retaken after final signal' })];
    assert.deepEqual(readOrdinaryFreeThrows(rows, options).counts, { HOME: 1, AWAY: 0 });
});
test('duplicate event identity is deduplicated without changing the count', () => {
    const row = whistle(), read = readOrdinaryFreeThrows([row, structuredClone(row)], options);
    assert.deepEqual(read.counts, { HOME: 1, AWAY: 0 });
    assert.equal(read.duplicateEvents, 1);
});
test('repeated same-foul whistle identity counts one foul and reports duplication', () => {
    const read = readOrdinaryFreeThrows([whistle(), whistle('repeated-event')], options);
    assert.deepEqual(read.counts, { HOME: 1, AWAY: 0 });
    assert.equal(read.duplicateFouls, 1);
});
test('conflicting duplicate event data makes totals unavailable', () => {
    const read = readOrdinaryFreeThrows([whistle(), whistle('whistle-1', 'foul-1', 'AWAY')], options);
    assert.equal(read.counts, null);
    assert.match(read.issues.join(' '), /Conflicting event/);
});
test('conflicting owner or restart kind for one foul cannot be presented as truth', () => {
    assert.equal(readOrdinaryFreeThrows([whistle(), whistle('other', 'foul-1', 'HOME', 'SEVEN_METRE')], options).counts, null);
});
test('unknown legacy archives do not turn absence of evidence into zero', () => {
    assert.equal(readOrdinaryFreeThrows([], { source: 'ARCHIVE', complete: true }).counts, null);
    assert.equal(readOrdinaryFreeThrows([whistle()], { source: 'ARCHIVE', behaviorRevision: 'legacy' }).counts, null);
});
test('mixed resumed archive with updated marker and old foul rows is unavailable', () => {
    const rows = [...protocol(), fact('legacy-foul', 'FOUL', { severity: 'ORDINARY', advantage: false })];
    assert.equal(readOrdinaryFreeThrows(rows, options).counts, null);
});
test('a modern known-revision no-foul archive truthfully reports zero', () => {
    assert.deepEqual(readOrdinaryFreeThrows([], options).counts, { HOME: 0, AWAY: 0 });
});
test('live complete protocol can establish provenance without an archive marker', () => {
    assert.deepEqual(readOrdinaryFreeThrows(protocol(), { source: 'LIVE' }).counts, { HOME: 1, AWAY: 0 });
});
test('realized advantage is not a free throw', () => {
    const rows = [fact('a', 'FOUL_ASSESSED', { foulId: 'a', decision: 'ADVANTAGE_PENDING' }), fact('b', 'ADVANTAGE_REALIZED', { foulId: 'a' })];
    assert.deepEqual(readOrdinaryFreeThrows(rows, options).counts, { HOME: 0, AWAY: 0 });
});
test('pending live advantage is valid; unresolved archived advantage is unavailable', () => {
    const rows = [fact('a', 'FOUL_ASSESSED', { foulId: 'a', decision: 'ADVANTAGE_PENDING' })];
    assert.deepEqual(readOrdinaryFreeThrows(rows, { ...options, source: 'LIVE', complete: false }).counts, { HOME: 0, AWAY: 0 });
    assert.equal(readOrdinaryFreeThrows(rows, options).counts, null);
});
test('immediate whistle assessment missing its actual whistle is unavailable', () => {
    assert.equal(readOrdinaryFreeThrows([fact('a', 'FOUL_ASSESSED', { foulId: 'a', decision: 'WHISTLE_NOW' })], options).counts, null);
});
test('a further foul recalls the original advantage as one free throw', () => {
    const rows = [fact('first', 'FOUL_ASSESSED', { foulId: 'first', decision: 'ADVANTAGE_PENDING' }), fact('second', 'FOUL_ASSESSED', { foulId: 'second', decision: 'RECALL_PENDING_ADVANTAGE' }), fact('recall', 'ADVANTAGE_RECALLED', { foulId: 'first' }), whistle('whistle', 'first')];
    assert.deepEqual(readOrdinaryFreeThrows(rows, options).counts, { HOME: 1, AWAY: 0 });
});
test('malformed whistle ownership or missing foul identity is unavailable', () => {
    assert.equal(readOrdinaryFreeThrows([fact('x', 'WHISTLE_RESTART', { foulId: 'a', kind: 'FREE_THROW', owner: 'UNKNOWN' })], options).counts, null);
    assert.equal(readOrdinaryFreeThrows([fact('x', 'WHISTLE_RESTART', { kind: 'FREE_THROW', owner: 'HOME' })], options).counts, null);
});
test('reading immutable canonical events neither mutates input nor attaches state', () => {
    const rows = protocol(), before = JSON.stringify(rows);
    for (const row of rows) { Object.freeze(row.details); Object.freeze(row.relatedIds); Object.freeze(row); }
    Object.freeze(rows);
    readOrdinaryFreeThrows(rows, options);
    assert.equal(JSON.stringify(rows), before);
});
