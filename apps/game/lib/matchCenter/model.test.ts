import test from 'node:test';
import assert from 'node:assert/strict';
import { record } from '@handball-manager/handball-engine/src/v2/core/state';
import { createNewCareerState } from '../career/newCareer';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../gameWorld/serverSnapshot';
import { buildMatchdayReadyEvent } from '../career/careerEvents';
import { createProductionSession, startProductionMatch, advanceProductionMatch, commandProductionMatch, resultFromSession, observedFrame, type PlayedMatchArchive, type ProductionMatchSession } from '../career/productionMatch';
import { encodeFrames } from '../career/matchFrames';
import { liveMatchModel, archivedMatchModel, presentationEvents, tacticalExplanation, shotFacts, snapshotsFor, keeperCategories, MATCH_SPEEDS, createLiveMatchReader } from './model';
import { advanceMatchCenter, resumeMatchTimeout, DEFAULT_MATCH_MODE } from './control';
function ready() { const s = createNewCareerState('match-center-v2-proof', 'swe2-tumba', snapshotWorldSquads('swe-2'), undefined, snapshotGameplayRatings('swe-2')), f = s.fixtures.find(f => f.homeClubId === s.playerClubId || f.awayClubId === s.playerClubId)!; return { ...s, gameDate: f.date, careerEvents: [buildMatchdayReadyEvent(f.id, f.date)] }; }
const career = ready();
function fixture(): ProductionMatchSession {
    const s = createProductionSession(career, career.fixtures.find(f => f.date === career.gameDate && (f.homeClubId === career.playerClubId || f.awayClubId === career.playerClubId))!);
    // Small explicit canonical event fixture; real production people remain authoritative.
    s.core.events = [];
    s.core.tick = 100;
    s.core.timeMs = 5000;
    s.core.officialClock.timeMs = 75000;
    s.core.match!.phase = 'FIRST_HALF';
    return s;
}
function facts() {
    const s = fixture(), p = s.core.players.find(p => p.team === 'HOME' && p.role === 'CB')!, keeper = s.core.players.find(p => p.team === 'AWAY' && p.role === 'GK')!, defender = s.core.players.find(p => p.team === 'AWAY' && p.role === 'CB')!;
    record(s.core, 'SHOT_RELEASED', p, { x: 10, y: 9, shotKind: 'BACKCOURT_JUMP', goalkeeperId: keeper.id }, [], null, 'shot-1');
    s.core.score.HOME = 1;
    record(s.core, 'GOAL', p, {}, [], null, 'shot-1');
    s.core.tick = 120;
    s.core.officialClock.timeMs = 90000;
    record(s.core, 'SHOT_RELEASED', p, { x: 4, y: 7, shotKind: 'SEVEN_METRE', goalkeeperId: keeper.id }, [], null, 'shot-2');
    record(s.core, 'SAVE_PARRY', keeper, {}, [p.id], null, 'shot-2');
    record(s.core, 'TWO_MINUTE_SUSPENSION', defender);
    defender.population = 'SUSPENDED';
    defender.suspensionUntilMs = 210000;
    s.frames = [observedFrame(s)];
    return { s, p, keeper, defender };
}
test('01 score is the canonical score, including non-event score fixtures', () => { const { s } = facts(); assert.equal(liveMatchModel(s).result.homeGoals, s.core.score.HOME); assert.equal(liveMatchModel(s).result.awayGoals, s.core.score.AWAY); });
test('02 official clock, period, pause and half state are canonical', () => { const { s } = facts(); s.pausedAtHalf = true; const m = liveMatchModel(s); assert.equal(m.clock, 90000); assert.equal(m.period, s.core.period); assert.equal(m.status, 'HALFTIME'); });
test('03 every goal timeline item links to its canonical event and scorer', () => { const { s, p } = facts(), m = liveMatchModel(s); assert.deepEqual(m.events.filter(e => e.type === 'GOAL').map(e => [e.canonicalEventId, e.playerId]), s.core.events.filter(e => e.type === 'GOAL').map(e => [e.id, p.id])); });
test('04 discipline, manpower and suspension time use actual population', () => { const { s, defender } = facts(), m = liveMatchModel(s); assert.equal(m.manpower!.AWAY, s.core.players.filter(p => p.team === 'AWAY' && p.kind === 'FIELD_PLAYER' && p.population === 'COURT').length); assert.equal(m.players.find(p => p.id === defender.id)!.remainingSuspension, 120000); assert.equal(m.result.awayStats.twoMinuteSuspensions, 1); });
test('05 saves equal canonical credited saves and exclude a touch before goal', () => { const { s, keeper } = facts(); record(s.core, 'SAVE_PARRY', keeper, {}, [], null, 'shot-1'); const m = liveMatchModel(s); assert.equal(m.result.awayStats.saves, 1); assert.equal(m.events.filter(e => e.type.startsWith('SAVE_')).length, 1); });
test('06 player rows use the existing canonical contribution and rating', () => { const { s, p } = facts(), m = liveMatchModel(s), contribution = resultFromSession(s).homePlayerContributions.find(c => c.playerId === p.id)!; const row = m.players.find(r => r.id === p.id)!; assert.equal(row.goals, contribution.goals); assert.equal(row.shots, contribution.shots); assert.equal(row.rating, contribution.rating); });
test('07 goal commentary names the recorded scorer', () => { const { s, p } = facts(); assert.ok(liveMatchModel(s).events.find(e => e.type === 'GOAL')!.headline.includes(s.people.find(x => x.id === p.id)!.name)); });
test('08 save commentary names the recorded keeper', () => { const { s, keeper } = facts(); assert.ok(liveMatchModel(s).events.find(e => e.type === 'SAVE_PARRY')!.headline.includes(s.people.find(x => x.id === keeper.id)!.name)); });
test('09 seven-metre save is key and retains actual shot category', () => { const { s, keeper } = facts(), m = liveMatchModel(s); assert.equal(m.events.find(e => e.type === 'SAVE_PARRY')!.importance, 'KEY'); assert.deepEqual(keeperCategories(keeper.id, m.shots), [{ kind: 'BACKCOURT_JUMP', saves: 0, faced: 1 }, { kind: 'SEVEN_METRE', saves: 1, faced: 1 }]); });
test('10 suspension commentary names the actual sanctioned player', () => { const { s, defender } = facts(); assert.ok(liveMatchModel(s).events.find(e => e.type === 'TWO_MINUTE_SUSPENSION')!.headline.includes(s.people.find(x => x.id === defender.id)!.name)); });
test('11 a tactical explanation requires observed evidence, not a nominal opportunity', () => { const { s, p } = facts(), e = s.core.events.find(e => e.type === 'GOAL')!; assert.equal(tacticalExplanation(e, s.core.events, s.people), null); record(s.core, 'DEFENDER_BEATEN', p, {}, [s.core.players.find(x => x.team === 'AWAY' && x.role === 'CB')!.id]); const last = s.core.events.at(-1)!; assert.match(tacticalExplanation(last, s.core.events, s.people)!, /tar sig förbi/); });
test('12 hypothetical targets, unknown actors and future events cannot fabricate bind commentary', () => { const { s } = facts(), e = s.core.events[1], future = { ...e, id: 'future', tick: e.tick + 1, type: 'PASS_RELEASED', details: { reason: 'HELP_COMMITTED' }, relatedIds: [s.people[1].id] }; assert.equal(tacticalExplanation(e, [...s.core.events, future], s.people), null); assert.equal(tacticalExplanation(e, [{ ...future, tick: e.tick, relatedIds: ['unknown'] }], s.people), null); });
function snapshotFixture() { const { s, p } = facts(); s.core.tick = 60; s.frames = [observedFrame(s)]; s.core.tick = 85; s.frames.push(observedFrame(s)); s.core.tick = 100; s.frames.push(observedFrame(s)); return { s, p }; }
test('13 snapshots use exact recorded rows without interpolation', () => {
    const { s } = snapshotFixture(), moment = s.core.events.find(e => e.type === 'GOAL')!, snaps = snapshotsFor(moment.id, s.core.events, s.frames, s.people);
    for (const snap of snaps) {
        assert.ok(s.frames.some(f => f[0] === snap.tick));
        assert.equal(snap.ball.x, s.frames.find(f => f[0] === snap.tick)![5] / 100);
    }
});
test('14 before, situation and release frames are ordered', () => { const { s } = snapshotFixture(), snaps = snapshotsFor(s.core.events[1].id, s.core.events, s.frames, s.people); assert.deepEqual(snaps.map(s => s.tick), [60, 85, 100]); });
test('15 snapshot identities and positions match the encoded archive', () => {
    const { s } = snapshotFixture(), snaps = snapshotsFor(s.core.events[1].id, s.core.events, s.frames, s.people);
    for (const snap of snaps)
        for (const p of snap.players) {
            const frame = s.frames.find(f => f[0] === snap.tick)!, index = s.people.findIndex(x => x.id === p.person.id), at = frame.findIndex((v, i) => i >= 7 && (i - 7) % 3 === 0 && v === index);
            assert.equal(p.position.x, frame[at + 1] / 100);
            assert.equal(p.position.y, frame[at + 2] / 100);
        }
});
test('16 arrows refer only to recorded involved actors and released shots', () => { const { s, p } = snapshotFixture(), snaps = snapshotsFor(s.core.events[1].id, s.core.events, s.frames, s.people), arrows = snaps.flatMap(s => s.arrows); assert.ok(arrows.length); assert.ok(arrows.every(a => a.fromId === p.id && a.kind === 'SHOT')); });
function archive(s: ProductionMatchSession): PlayedMatchArchive { return { format: 2, fixture: s.fixture, version: s.core.version, seed: s.core.seed, people: s.people, events: s.core.events, result: resultFromSession(s), frameData: encodeFrames(s.frames), load: Object.fromEntries(s.people.map(p => [p.id, { minutes: 0, energy: 100, distance: 0 }])) }; }
test('17 old archives without tactical metadata or frames degrade to events and stats', () => { const { s } = facts(), a = archive(s); delete a.frameData; a.format = 1; const m = archivedMatchModel(a); assert.equal(m.result, a.result); assert.equal(snapshotsFor(a.events[1].id, a.events, [], a.people).length, 0); });
test('18 pause is presentation state and reading does not advance the match', () => { const { s } = facts(), before = JSON.stringify(s); assert.equal(liveMatchModel(s, false).status, 'PAUSED'); assert.equal(JSON.stringify(s), before); });
test('19 supported speed chunks preserve the same canonical 128 ticks', () => {
    const start = startProductionMatch(career);
    let a = start, b = start;
    for (let i = 0; i < 128; i++)
        a = advanceProductionMatch(a, 1);
    for (let i = 0; i < 16; i++)
        b = advanceProductionMatch(b, 8);
    assert.deepEqual(a.productionMatch, b.productionMatch);
    assert.ok(MATCH_SPEEDS.includes(2) && MATCH_SPEEDS.includes(8));
});
test('20 substitution still uses the canonical exchange and role contract', () => { let s = startProductionMatch(career); const core = s.productionMatch!.core, out = core.players.find(p => p.team === 'HOME' && p.kind === 'FIELD_PLAYER' && p.population === 'COURT')!, incoming = core.players.find(p => p.team === 'HOME' && p.kind === out.kind && p.population === 'BENCH')!; s = commandProductionMatch(s, { kind: 'SUBSTITUTION', team: 'HOME', outId: out.id, inId: incoming.id }); s = advanceProductionMatch(s, 200); assert.equal(s.productionMatch!.core.players.find(p => p.id === incoming.id)!.population, 'COURT'); assert.equal(s.productionMatch!.core.players.find(p => p.id === incoming.id)!.role, out.role); });
test('21 timeout is canonical, pauses official time and can be resumed', () => { let s = advanceProductionMatch(startProductionMatch(career), 100); const team = s.productionMatch!.core.possession.team; s = commandProductionMatch(s, { kind: 'TIMEOUT', team }); const time = s.productionMatch!.core.officialClock.timeMs; assert.equal(liveMatchModel(s.productionMatch!).status, 'TIMEOUT'); s = resumeMatchTimeout(s); assert.equal(s.productionMatch!.core.referee.timeout, null); assert.equal(s.productionMatch!.core.officialClock.timeMs, time); });
test('22 tactic changes update canonical coaching and timeline', () => { const s = commandProductionMatch(startProductionMatch(career), { kind: 'TACTICS', team: 'HOME', patch: { attackIdentity: 'WIDTH', defence: '5:1' } }), m = liveMatchModel(s.productionMatch!); assert.equal(s.productionMatch!.core.coaching.HOME.defence, '5:1'); assert.match(m.events.find(e => e.type === 'TACTICS_CHANGED')!.detail, /bredd/); });
test('23 halftime requires the existing second-half command', () => { const s = startProductionMatch(career); s.productionMatch!.pausedAtHalf = true; s.productionMatch!.core.match!.phase = 'HALFTIME'; assert.equal(advanceMatchCenter(s, 8), s); assert.equal(commandProductionMatch(s, { kind: 'SECOND_HALF' }).productionMatch!.pausedAtHalf, false); });
test('24 JSON reload restores score, clock, lineup, energy and stats', () => { const { s } = facts(); assert.deepEqual(liveMatchModel(JSON.parse(JSON.stringify(s))), liveMatchModel(s)); });
test('25 commentary context rebuilds deterministically after save/load', () => { const { s } = facts(); assert.deepEqual(presentationEvents(JSON.parse(JSON.stringify(s.core.events)), s.people), presentationEvents(s.core.events, s.people)); });
test('26 archive and RNG are immutable under repeated presentation reads', () => { const { s } = facts(), a = archive(s), before = JSON.stringify(a), rng = JSON.stringify(s.core.rng); archivedMatchModel(a); liveMatchModel(s); assert.equal(JSON.stringify(a), before); assert.equal(JSON.stringify(s.core.rng), rng); });
test('27 manager Match Center is the default mode', () => assert.equal(DEFAULT_MATCH_MODE, 'MATCH_CENTER'));
test('28 normal presentation works without frames or a continuous renderer', () => { const { s } = facts(); s.frames = []; assert.equal(liveMatchModel(s).result.homeGoals, 1); });
test('29 direct-result primitive keeps its normal tick path', () => { const s = startProductionMatch(career), a = advanceProductionMatch(s, 128, false), b = advanceMatchCenter(s, 128, false); assert.deepEqual(a.productionMatch, b.productionMatch); });
test('30 key-moment selection references original event ids', () => {
    const { s } = facts();
    for (const e of liveMatchModel(s).keyMoments)
        assert.ok(s.core.events.some(c => c.id === e.replayReference));
});
test('31 keeper goal-bound denominator matches canonical contribution', () => { const { s, keeper } = facts(), m = liveMatchModel(s), p = m.players.find(p => p.id === keeper.id)!; assert.equal(p.saves + p.shotsFaced - p.saves, 2); assert.equal(keeperCategories(keeper.id, m.shots).reduce((n, c) => n + c.faced, 0), p.shotsFaced); });
test('32 state and discipline labels are explicit text', () => { const { s } = facts(), m = liveMatchModel(s); assert.equal(m.status, 'PAUSED'); assert.match(m.events.find(e => e.type === 'TWO_MINUTE_SUSPENSION')!.headline, /2 MIN/); });
test('33 missing shot coordinates remain missing and are not invented', () => { const { s } = facts(); delete s.core.events[0].details.x; assert.equal(shotFacts(s.core.events, s.people)[0].origin, null); });
test('34 an in-flight attempt cannot be labeled a miss yet', () => { const { s } = facts(); const shot = s.core.events[0]; assert.equal(shotFacts([shot], s.people, shot.actionId, false)[0].outcome, 'PENDING'); });
test('35 key stops preserve exact core continuation and consume no presentation draws', () => { const s = startProductionMatch(career), a = advanceMatchCenter(s, 128, true), reloaded = JSON.parse(JSON.stringify(a)); assert.deepEqual(advanceMatchCenter(a, 128, true).productionMatch, advanceMatchCenter(reloaded, 128, true).productionMatch); });
test('36 incremental reader equals full canonical projection throughout actual play', () => {
    let state = startProductionMatch(career);
    const read = createLiveMatchReader();
    for (let n = 0; n < 15; n++) {
        state = advanceProductionMatch(state, 100);
        assert.deepEqual(read(state.productionMatch!, true), liveMatchModel(state.productionMatch!, true));
    }
});
test('37 cache rebuilds after a JSON reload or shorter event prefix', () => { const { s } = facts(), read = createLiveMatchReader(); read(s); const reloaded = JSON.parse(JSON.stringify(s)); assert.deepEqual(read(reloaded), liveMatchModel(reloaded)); reloaded.core.events = []; reloaded.core.score.HOME = 0; assert.deepEqual(read(reloaded), liveMatchModel(reloaded)); });
test('38 transient energy and suspension clocks refresh without a new event', () => { const { s, p, defender } = facts(), read = createLiveMatchReader(); read(s); p.condition.energy = .4; s.core.officialClock.timeMs += 1000; const model = read(s); assert.equal(model.players.find(r => r.id === p.id)!.energy, 40); assert.equal(model.players.find(r => r.id === defender.id)!.remainingSuspension, 119000); });
test('39 only a committed-help pass becomes a standalone tactical moment', () => { const { s, p } = facts(), receiver = s.people.find(x => x.team === 'HOME' && x.id !== p.id)!; record(s.core, 'PASS_RELEASED', p, { reason: 'INTELLIGENCE: HELP_COMMITTED; created=true' }, [receiver.id], null, 'created-pass'); const m = liveMatchModel(s); assert.ok(m.keyMoments.some(e => e.type === 'PASS_RELEASED')); s.core.events.at(-1)!.details.reason = 'Ordinary circulation'; assert.ok(!liveMatchModel(s).keyMoments.some(e => e.type === 'PASS_RELEASED')); });
test('40 commentary variation remains deterministic and names only actual actors', () => { const { s, p } = facts(), goal = s.core.events.find(e => e.type === 'GOAL')!, person = s.people.find(x => x.id === p.id)!; const a = presentationEvents(s.core.events, s.people).find(e => e.type === 'GOAL')!.detail; goal.tick++; const b = presentationEvents(s.core.events, s.people).find(e => e.type === 'GOAL')!.detail; assert.notEqual(a, b); assert.ok(a.includes(person.name) && b.includes(person.name)); assert.equal(b, presentationEvents(s.core.events, s.people).find(e => e.type === 'GOAL')!.detail); });
test('41 category denominators retain every credited save observation', () => { const { s, keeper } = facts(); record(s.core, 'SAVE_CAUGHT', keeper, {}, [], null, 'shot-2'); const m = liveMatchModel(s), row = m.players.find(p => p.id === keeper.id)!, categories = keeperCategories(keeper.id, m.shots, m.events); assert.equal(categories.reduce((n, c) => n + c.saves, 0), row.saves); assert.equal(categories.reduce((n, c) => n + c.faced, 0), row.shotsFaced); });
test('42 old archives with no clock evidence show unknown time rather than an invented minute', () => { const { s } = facts(), a = archive(s); a.events = []; delete a.frameData; const model = archivedMatchModel(a); assert.equal(model.clock, null); assert.equal(model.period, null); });
test('43 a resolved unsuccessful attempt is described without fabricating wide or post detail', () => { const { s } = facts(); s.core.events = s.core.events.filter(e => e.actionId !== 'shot-1'); s.core.events = s.core.events.filter(e => !e.type.startsWith('SAVE_')); const model = liveMatchModel(s); assert.match(model.events.find(e => e.type === 'SHOT_RELEASED')!.headline, /Avslut utan mål/); assert.ok(!model.events.find(e => e.type === 'SHOT_RELEASED')!.detail.includes('stolpe')); });
