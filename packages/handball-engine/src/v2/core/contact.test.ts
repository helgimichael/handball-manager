import test from 'node:test';
import assert from 'node:assert/strict';
import { createContactScenario } from './contactScenarios';
import { createCoreScenario } from './scenarios';
import { getPlayer } from './state';
import { tickCore,assertCore,advanceCoreMutable } from './engine';
import { coreHash,coreEventHash,saveCore,loadCore,playCore,replayCore } from './replay';
import { resolveContacts } from './contact';
import { coordinate,resolveHandovers } from './structure';
import { execute,startAction } from './actions';
import { foul,interrupt } from './transitions';

test('contact technique is committed before outcome; front containment preserves physical control',()=>{
  for(const direction of ['TOP','BOTTOM'] as const) {
    let s=createContactScenario('FRONTAL_CONTACT',2025,direction);
    assert.equal(getPlayer(s,'A03').action?.contact?.technique,'BENT_ARMS');
    assert.equal(s.events.some(e=>e.type==='CONTACT_EXECUTED'),false);
    for(let i=0;i<4;i++){s=tickCore(s);assertCore(s);}
    assert.ok(s.events.some(e=>e.type==='LEGAL_CONTACT'));assert.equal(s.events.some(e=>e.type==='FOUL'),false);
    assert.equal(s.ball.controllerId,'H03');assert.equal(getPlayer(s,'H03').action?.phase,'INTERRUPTED');
  }
});
test('actual holding produces a causal foul and warning; evaded commitment cannot award a foul',()=>{
  for(const direction of ['TOP','BOTTOM'] as const) {
    let held=createContactScenario('LATE_HOLD',2025,direction),escaped=createContactScenario('EVADED_CONTACT',2025,direction);
    for(let i=0;i<5;i++){held=tickCore(held);escaped=tickCore(escaped);}
    assert.equal(held.restart?.kind,'FREE_THROW');assert.equal(held.ball.live,false);assert.equal(getPlayer(held,'A03').warnings,1);
    const e=held.events.find(e=>e.type==='FOUL')!;assert.ok(held.contests.some(c=>c.id===e.contestId&&c.outcome==='HELD'));
    assert.ok(escaped.events.some(e=>e.type==='CONTACT_MISSED'));assert.equal(escaped.events.some(e=>e.type==='FOUL'),false);
  }
});
test('contact legality is independent of defender skill and does not cancel a committed pass',()=>{
  for(const defence of [.1,.99]) {
    const s=createContactScenario('FRONTAL_CONTACT'),a=getPlayer(s,'H03'),d=getPlayer(s,'A03');
    d.attributes.defence=defence;d.action!.phase='EXECUTING';a.action!.kind='PASS';a.action!.phase='COMMITTED';
    resolveContacts(s);assert.equal(a.action!.phase,'COMMITTED');assert.equal(s.events.some(e=>e.type==='FOUL'),false);
  }
});
test('progressive body fouls warn, then suspend, then disqualify without restoring court eligibility',()=>{
  const s=createContactScenario('LATE_HOLD'),a=getPlayer(s,'H03'),d=getPlayer(s,'A03');
  foul(s,a,d,false,false,'first');assert.equal(d.warnings,1);assert.equal(d.sanctions,0);
  for(let i=1;i<=3;i++){d.population='COURT';foul(s,a,d,false,false,`repeat-${i}`);assert.equal(d.sanctions,i);}
  assert.equal(d.population,'DISQUALIFIED');assert.equal(d.suspensionUntilMs,120000);
});
test('paired handover changes marks only when both committed actions complete; interruption cancels it',()=>{
  for(const cancel of [false,true]) {
    const s=createCoreScenario();s.tick=31;s.timeMs=1550;
    getPlayer(s,'H02').position={x:12,y:11};getPlayer(s,'H04').position={x:8,y:11};
    coordinate(s);assert.ok(s.defence.handover);const h=s.defence.handover!,before={...s.defence.marks};
    assert.deepEqual(s.defence.marks,before);assert.equal(s.events.some(e=>e.type==='HANDOVER_COMPLETED'),false);
    if(cancel)interrupt(s,getPlayer(s,h.defenderIds[0]),'Physical interruption');
    for(let i=0;i<11;i++){s.tick++;s.timeMs=s.tick*50;execute(s);resolveHandovers(s);}
    assert.equal(s.events.some(e=>e.type==='HANDOVER_COMPLETED'),!cancel);
    assert.equal(s.defence.marks[h.defenderIds[0]],cancel?h.attackerIds[0]:h.attackerIds[1]);
  }
});
test('contact commitment survives exact save/resume, observation and playback rate',()=>{
  let initial=createContactScenario('LATE_HOLD');initial=tickCore(tickCore(initial));
  const direct=JSON.parse(JSON.stringify(initial)),resumed=JSON.parse(JSON.stringify(loadCore(saveCore(initial))));
  while(direct.status==='RUNNING')advanceCoreMutable(direct);
  while(resumed.status==='RUNNING'){JSON.stringify(resumed.events);advanceCoreMutable(resumed);}
  assert.equal(coreHash(resumed),coreHash(direct));assert.equal(coreEventHash(resumed),coreEventHash(direct));
  for(const speed of [.25,1,4]){let r=replayCore(initial);while(r.frames[r.cursor].status==='RUNNING')r=playCore(r,43,speed);assert.equal(coreHash(r.frames[r.cursor]),coreHash(direct));}
});
test('a feint can wrong-foot a defender but only a physical crossing can label them beaten',()=>{
  let feint=createCoreScenario('PIVOT_2V2');
  while(feint.status==='RUNNING'&&!feint.events.some(e=>e.type==='FEINT_READ'))feint=tickCore(feint);
  assert.ok(feint.events.some(e=>e.type==='FEINT_READ'&&e.details.wrongFooted));
  assert.equal(feint.events.some(e=>e.type==='DEFENDER_BEATEN'),false);
  for(const direction of ['TOP','BOTTOM'] as const) {
    let s=createContactScenario('SHOULDER_BREAKTHROUGH',2025,direction);const before=coreHash(s);
    assert.equal(s.events.some(e=>e.type==='DEFENDER_BEATEN'),false);
    while(s.status==='RUNNING'&&!s.events.some(e=>e.type==='DEFENDER_BEATEN'))s=tickCore(s);
    const e=s.events.find(e=>e.type==='DEFENDER_BEATEN');assert.ok(e);
    const a=getPlayer(s,e.actorId!),d=getPlayer(s,e.relatedIds[0]);
    assert.ok(direction==='TOP'?a.position.y+.15<d.position.y:a.position.y-.15>d.position.y);
    assert.notEqual(coreHash(s),before);assert.equal(d.beatenUntilTick,s.tick+32);
  }
});
test('a named moving receiver preserves the run used by the pass lead until physical reception',()=>{
  let s=createCoreScenario();const a=getPlayer(s,'H03'),receiver=getPlayer(s,'H04');
  for(const p of s.players)if(p.id!==a.id&&p.id!==receiver.id)p.population='BENCH';
  a.position={x:10,y:20};receiver.position={x:6,y:20};receiver.velocity={x:0,y:-3};s.ball.position={...a.position};
  startAction(s,receiver,'RUN','Committed receiving lane',{x:6,y:13});receiver.action!.phase='EXECUTING';receiver.action!.executeTicks=1;
  const runId=receiver.action!.id;startAction(s,a,'PASS','Lead a committed running receiver',null,receiver.id);
  while(s.tick<50&&!s.events.some(e=>e.type==='PASS_RECEIVED')) {
    s=tickCore(s);const r=getPlayer(s,receiver.id);
    if(s.ball.controllerId!==r.id){assert.equal(r.action?.id,runId);assert.equal(r.action?.phase,'EXECUTING');}
  }
  assert.ok(s.events.some(e=>e.type==='PASS_RECEIVED'));assert.equal(s.ball.controllerId,receiver.id);
  assert.ok(getPlayer(s,receiver.id).position.y<19);assertCore(s);
});
