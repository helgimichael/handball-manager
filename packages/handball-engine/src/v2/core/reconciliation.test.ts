import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoreScenario } from './scenarios';
import { advanceCoreMutable } from './engine';
import { getPlayer } from './state';
import { goal, shotContext, world } from './space';
import { defenderRelation, defenderResistance, regainedContainment } from './threatRelation';
import { releasePressure } from './execution';
import { assessAdvantage, commitHandball, decideHandball } from './intelligence';
import { createIntelligenceScenario } from './intelligenceScenarios';
import { coordinate, selectActions } from './structure';
import { startAction } from './actions';
import { planContact } from './contact';
import { coreHash, loadCore, saveCore } from './replay';
import {readDefence,zonePost} from './defence';
import {keeperReachForShot,keeperTorsoReachForShot} from './interactions';
import type {CoreFlight} from './state';
import {clearChanceDestroyed} from './sanction';
function scene(direction: 'TOP' | 'BOTTOM' = 'TOP') {
    const s = createCoreScenario('ESTABLISHED_6V6', 123, direction), p = getPlayer(s, 'H03'), d = getPlayer(s, 'A03'), h = getPlayer(s, 'A04'), mate = getPlayer(s, 'H04');
    for (const b of s.players) if (![p, d, h, mate, getPlayer(s, 'A07')].includes(b)) { b.population = 'BENCH'; b.zone = null; }
    s.tick = 20; s.timeMs = 1000; s.ball.live = true; s.possession.phase = 'ESTABLISHED'; s.possession.completedPasses = 2;
    p.position = world({ x: 10, y: 10.5 }, direction); p.velocity = world({ x: 0, y: 0 }, 'TOP'); p.action = null; p.handling.heldSinceTick = s.tick;
    d.position = world({ x: 10, y: 9.5 }, direction); d.velocity = { x: 0, y: 0 }; d.action = null; d.zone = 2;
    h.position = world({ x: 17, y: 8 }, direction); h.action = null; h.zone = 4;
    mate.position = world({ x: 15, y: 12 }, direction); mate.action = null;
    s.ball.position = { ...p.position }; s.ball.controllerId = p.id; s.ball.mode = 'CONTROLLED';
    s.defence.marks = { [d.id]: p.id }; s.defence.pressureId = d.id; s.defence.helperId = h.id;
    return { s, p, d, h, mate };
}
test('a regained goal-side body supplies pressure even before its old duel timer expires', () => {
    for (const dir of ['TOP', 'BOTTOM'] as const) {
        const { s, p, d } = scene(dir), before = shotContext(s, p);
        d.beatenUntilTick = s.tick + 32; d.beatenBy = p.id;
        assert.ok(regainedContainment(p, d, goal(dir)));
        assert.equal(defenderResistance(s, p, d, goal(dir)), 1);
        assert.equal(shotContext(s, p).pressure, before.pressure);
        assert.equal(shotContext(s, p).quality, before.quality);
    }
});
test('recovery restores canonical availability from physical containment rather than an arbitrary advantage timeout', () => {
    const { s, p, d } = scene(); d.beatenUntilTick = s.tick + 100; d.beatenBy = p.id;
    advanceCoreMutable(s);
    assert.ok(s.events.some(e => e.type === 'DEFENDER_RECOVERED' && e.actorId === d.id && e.relatedIds[0] === p.id));
    assert.ok(d.beatenUntilTick <= s.tick); assert.equal(d.beatenBy, null);
});
test('a defender still behind the shoulder does not recover simply because a decision tick occurred', () => {
    const { s, p, d } = scene(); d.position = { x: 10, y: 11.4 }; d.beatenUntilTick = s.tick + 32; d.beatenBy = p.id;
    assert.ok(defenderRelation(p, d, goal('TOP')).beaten); assert.equal(regainedContainment(p, d, goal('TOP')), false);
    advanceCoreMutable(s); assert.ok(d.beatenUntilTick > s.tick); assert.ok(!s.events.some(e => e.type === 'DEFENDER_RECOVERED'));
});
test('lateral distance cannot masquerade as recovered containment', () => {
    const { p, d } = scene(); d.position.x = 12;
    assert.equal(regainedContainment(p, d, goal('TOP')), false);
});
test('a genuinely beaten nearby body supplies partial release pressure rather than disappearing', () => {
    const { s, p, d, h } = scene(); h.population = 'BENCH'; d.position = { x: 10, y: 11.3 }; d.beatenUntilTick = s.tick + 32;
    const delayed = releasePressure(s, p); assert.ok(delayed > 0);
    assert.equal(defenderResistance(s, p, d, goal('TOP')), .4);
    d.beatenUntilTick = s.tick; assert.ok(releasePressure(s, p) > delayed);
});
test('screen and wrong-foot movement debt remain distinct rather than being cleared as beaten recovery', () => {
    const { s, p, d } = scene(); d.beatenUntilTick = s.tick + 32; d.screenedUntilTick = s.tick + 20;
    assert.equal(defenderResistance(s, p, d, goal('TOP')), .15);
    advanceCoreMutable(s); assert.ok(d.beatenUntilTick > s.tick);
    d.screenedUntilTick = s.tick; d.wrongFootedUntilTick = s.tick + 10;
    assert.equal(defenderResistance(s, p, d, goal('TOP')), .65);
});
test('a healthy helper reduces a shot advantage despite the first defender remaining beaten', () => {
    const { s, p, d, h } = scene(); d.position = { x: 10, y: 12 }; d.beatenUntilTick = s.tick + 32;
    h.position = { x: 15, y: 7 }; const open = shotContext(s, p);
    h.position = { x: 10.4, y: 9.6 }; const helped = shotContext(s, p);
    assert.ok(helped.quality < open.quality); assert.ok(helped.pressure > open.pressure); assert.ok(helped.blockThreat > open.blockThreat);
    assert.equal(s.ball.controllerId, p.id); assert.equal(s.score.HOME, 0);
});
test('help containment removes the old primary bonus without denying the fact that the first man was passed', () => {
    const { s, p, d, h, mate } = scene(); mate.population = 'BENCH'; d.position = { x: 10, y: 12 }; p.velocity = { x: 0, y: -2 };
    h.position = { x: 10.4, y: 9.6 }; h.velocity = { x: -.2, y: .5 };
    const dec = decideHandball(s, p); assert.ok(dec.perception.primary?.beaten); assert.ok(dec.perception.help?.committed); assert.equal(dec.perception.space.open, false);
    assert.equal(dec.advantage.beatenMargin, 0); assert.equal(dec.advantage.freeCarrier, false); assert.ok(dec.situations.includes('NO_ADVANTAGE'));
    assert.ok(!dec.situations.includes('CLEAR_SHOT_WINDOW'));
});
test('once geometry repairs the threat, the old high commitment cannot create free-carrier status', () => {
    const { s, p, d, h } = scene(); d.position = { x: 10, y: 12 }; h.position = { x: 15, y: 7 }; p.velocity = { x: 0, y: -2 };
    const open = decideHandball(s, p); commitHandball(s, p, open); const initial = assessAdvantage(open.perception);
    h.position = { x: 10.4, y: 9.6 }; h.velocity = { x: -.2, y: .5 };
    const repaired = decideHandball(s, p); assert.ok(initial.freeCarrier); assert.equal(repaired.advantage.freeCarrier, false); assert.ok(repaired.advantage.value < initial.value); assert.ok(repaired.breakCondition);
});
test('free uncontested carrier acceptance remains forty of forty without sideways disposal', () => {
    for (const dir of ['TOP', 'BOTTOM'] as const) for (let seed = 1; seed <= 20; seed++) {
        const { s, p } = createIntelligenceScenario('A_FREE_TO_GOAL', seed, dir);
        for (let i = 0; i < 150 && s.status === 'RUNNING'; i++) advanceCoreMutable(s);
        const actions = s.events.filter(e => e.type === 'ACTION_STARTED' && e.actorId === p.id).map(e => e.details.kind);
        assert.equal(actions[0], 'DRIVE'); assert.ok(!actions.includes('PASS')); assert.ok(actions.includes('SHOOT'));
    }
});
test('an actually created helper-bound receiver still receives the intelligent pass', () => {
    const { s, p } = createIntelligenceScenario('B_HELP_M6'); coordinate(s); selectActions(s);
    assert.equal(p.action?.kind, 'PASS'); assert.match(p.action!.reason, /created=true/);
});
test('recovered physical state and continuation reproduce through canonical save/load', () => {
    const { s, p, d } = scene(); d.beatenUntilTick = s.tick + 32; d.beatenBy = p.id;
    startAction(s, p, 'HOLD', 'Read repaired containment');
    let a = s, b = loadCore(saveCore(s));
    // Mutable advance requires exclusively owned state rather than the frozen replay snapshot.
    b = structuredClone(b);
    for (let i = 0; i < 80 && a.status === 'RUNNING'; i++) { advanceCoreMutable(a); advanceCoreMutable(b); }
    assert.equal(coreHash(a), coreHash(b));
});
test('scoreboard and hypothetical benchmark targets do not enter recovered shot geometry', () => {
    const { s, p } = scene(), before = shotContext(s, p);
    s.score.HOME = 999; s.score.AWAY = 900;
    Object.assign(s, { benchmarkTargets: { goals: 61, keeperSave: .2857, scorerLimit: 12 } });
    assert.deepEqual(shotContext(s, p), before);
});
test('an executing assigned pressure approach can transition to contact once it physically reaches the carrier', () => {
    const { s, p, d } = scene(); d.position = { x: 10, y: 9.6 };
    startAction(s, p, 'DRIVE', 'Actual penetration', { x: 10, y: 8 }); p.action!.phase = 'EXECUTING';
    startAction(s, d, 'PRESS', 'Assigned moving containment', { x: 10, y: 9.8 }, p.id); d.action!.phase = 'EXECUTING';
    assert.ok(planContact(s, d, p)); assert.equal(d.action?.kind, 'CONTACT'); assert.equal(d.action?.phase, 'PREPARING');
});
test('being assigned pressure does not permit a remote or still preparing contact', () => {
    const { s, p, d } = scene(); d.position = { x: 10, y: 8 };
    startAction(s, d, 'PRESS', 'Still approaching', { x: 10, y: 9.8 }, p.id); d.action!.phase = 'EXECUTING';
    assert.equal(planContact(s, d, p), false); assert.equal(d.action?.kind, 'PRESS');
    d.position.y = 9.6; d.action!.phase = 'PREPARING'; assert.equal(planContact(s, d, p), false);
});
test('a contained close finish favors the available pass rather than spending a stale first-defender advantage',()=>{
    const {s,p,d,h}=scene();d.position={x:10,y:9};p.position={x:10,y:7.2};p.velocity={x:0,y:-1};s.ball.position={...p.position};
    h.position={x:10.35,y:6.5};h.velocity={x:0,y:0};
    const read=decideHandball(s,p);assert.ok(read.perception.shot!.containment>.5);assert.equal(read.perception.space.open,false);
    assert.ok(read.affordances.find(a=>a.motor==='SHOOT')!.components.risk>0);assert.equal(read.chosen?.motor,'PASS');
    p.handling.heldSinceTick=s.tick-45;
    assert.ok(decideHandball(s,p).affordances.some(a=>a.motor==='SHOOT'),'a constrained legal release is still possible');
});
test('a nearby pivot marker denying the turn from behind is not interpreted as an unguarded line chance',()=>{
    const {s,p,d,h}=scene();p.role='P';p.position={x:10,y:6.5};d.position={x:10.4,y:6.85};d.duty={kind:'PIVOT',targetId:p.id,sinceTick:s.tick,reason:'Deny the actual turn'};h.population='BENCH';
    const guarded=shotContext(s,p);d.position={x:16,y:8};const released=shotContext(s,p);
    assert.ok(guarded.quality<released.quality);assert.ok(guarded.pressure>released.pressure);
});
test('a poor-discipline side approach which still contains the shoulder does not manufacture a deliberate hold',()=>{
    const {s,p,d}=scene();d.position={x:10.8,y:10.3};d.profile={...d.profile,discipline:.1};
    startAction(s,p,'DRIVE','Actual penetration',{x:10,y:8});p.action!.phase='EXECUTING';
    assert.ok(!defenderRelation(p,d,goal('TOP')).beaten);assert.ok(planContact(s,d,p));assert.equal(d.action!.contact!.technique,'BENT_ARMS');
});
test('a genuinely passed close defender can still choose an illegal hold based on discipline',()=>{
    const {s,p,d}=scene();d.position={x:10,y:11.3};d.profile={...d.profile,discipline:.1};
    startAction(s,p,'DRIVE','Actual penetration',{x:10,y:8});p.action!.phase='EXECUTING';
    assert.ok(defenderRelation(p,d,goal('TOP')).beaten);assert.ok(planContact(s,d,p));assert.equal(d.action!.contact!.technique,'HOLD');
});
test('the connected line contracts after observed containment loss without requiring a stamped duel timer',()=>{
    for(const system of ['6:0','5:1'] as const){
        const {s,p,d,h}=scene();s.defence.system=system;p.velocity={x:0,y:-1};
        const normal=readDefence(s,[d,h],p,'TOP');d.position={x:10,y:12};d.beatenUntilTick=0;
        const lost=readDefence(s,[d,h],p,'TOP');assert.ok(lost.compact<normal.compact);
        assert.ok(Math.abs(zonePost(s,1,lost,'TOP').x-10)<Math.abs(zonePost(s,1,normal,'TOP').x-10));
        coordinate(s);assert.notEqual(s.defence.pressureId,d.id);
    }
});
test('pausing a non-pivot carrier does not give the passed defender ownership back before recovering goal-side',()=>{
    const {s,p,d}=scene();d.position={x:10,y:12};p.velocity={x:0,y:0};coordinate(s);
    assert.notEqual(s.defence.pressureId,d.id);assert.equal(d.duty.kind,'RECOVER');
});
test('contact against the old carrier releases its motor boundary when the ball has actually moved to a teammate',()=>{
    const {s,p,d,mate}=scene();startAction(s,d,'CONTACT','Old carrier contact',null,p.id);d.action!.contact={technique:'BENT_ARMS',approach:'FRONT'};d.action!.phase='RECOVERING';
    const old=d.action!,before={...d.position};s.ball.controllerId=mate.id;s.ball.position={...mate.position};coordinate(s);selectActions(s);
    assert.equal(old.phase,'COMPLETED');assert.notEqual(d.action?.kind,'CONTACT');assert.deepEqual(d.position,before,'changing responsibility does not teleport the defender');
});
test('finite keeper reaction does not erase a torso which physically intersects the released trajectory',()=>{
    const {s,p}=scene(),k=getPlayer(s,'A07');k.position={x:10,y:1.4};
    const f:CoreFlight={kind:'SHOT',origin:{x:10,y:6.8},velocity:{x:0,y:-30},fromId:p.id,receiverId:null,actionId:'torso',possessionId:s.possession.id,releasedTick:s.tick,height:1.1,goalHeight:1.1,goalSide:'TOP',touchedIds:[p.id],purpose:'PLAY'};
    assert.equal(keeperTorsoReachForShot(k,f,k.position),k.radius);assert.ok(keeperReachForShot(s,k,f,k.position)>=k.radius);
    f.height=.2;f.goalHeight=.2;assert.equal(keeperTorsoReachForShot(k,f,k.position),0,'low balls do not receive invented torso coverage');
    f.height=2.2;f.goalHeight=2.2;assert.equal(keeperTorsoReachForShot(k,f,k.position),0,'high balls still require actual hands');
});
test('a physically reachable original beaten defender may attempt a late hold after pressure ownership has handed over',()=>{
    const {s,p,d,h}=scene();d.position={x:10,y:11.3};d.beatenBy=p.id;d.beatenUntilTick=s.tick+32;d.profile={...d.profile,discipline:.1};d.duty={kind:'RECOVER',targetId:null,sinceTick:s.tick,reason:'Original passed defender recovering'};
    s.defence.pressureId=h.id;s.defence.helperId=null;
    startAction(s,p,'DRIVE','Actual penetration',{x:10,y:8});p.action!.phase='EXECUTING';
    assert.ok(planContact(s,d,p));assert.equal(d.action!.contact!.technique,'HOLD');assert.equal(s.defence.pressureId,h.id,'a contact attempt does not reallocate pressure');
});
test('an arrived legal helper can prevent the close release without standing on the attacker future centre',()=>{
    const {s,p,d,h}=scene();p.position={x:10,y:7.4};d.position={x:10,y:8.2};h.position={x:10.8,y:6.8};s.ball.position={...p.position};
    startAction(s,p,'DRIVE','Reachable near-line approach',{x:10,y:6.5});p.action!.phase='EXECUTING';
    assert.equal(clearChanceDestroyed(s,p,d).clear,false);
    h.position={x:16,y:10};assert.equal(clearChanceDestroyed(s,p,d).clear,true,'a remote body cannot claim legal prevention');
});
test('taking carrier pressure responsibility does not erase the same physical back-to-goal pivot marker',()=>{
    const {s,p,d,h}=scene();p.role='P';p.position={x:10,y:6.5};d.position={x:10.4,y:6.85};h.population='BENCH';
    d.duty={kind:'PIVOT',targetId:p.id,sinceTick:s.tick,reason:'Actual turn denial'};const marked=shotContext(s,p);
    d.duty={...d.duty,kind:'PRESSURE'};assert.deepEqual(shotContext(s,p),marked);
});
test('a contested close finish remains an option for a sufficiently strong finisher instead of a categorical ban',()=>{
    const {s,p,d,h}=scene();d.position={x:10,y:9};p.position={x:10,y:7.2};p.velocity={x:0,y:-1};s.ball.position={...p.position};h.position={x:10.35,y:6.5};h.velocity={x:0,y:0};
    p.profile={...p.profile,shotPower:.95,shotPlacement:.95,finishing:.95,tendency:{...p.profile.tendency,shoot:1.3,feed:.5}};
    const read=decideHandball(s,p);assert.ok(read.affordances.some(a=>a.motor==='SHOOT'));assert.equal(read.chosen?.motor,'SHOOT');
});
