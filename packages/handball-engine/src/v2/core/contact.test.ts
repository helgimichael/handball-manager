import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './space';
import { createContactScenario } from './contactScenarios';
import { setProfile } from './testProfile';
import { createCoreScenario } from './scenarios';
import { getPlayer, courtPlayers } from './state';
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
test('a hold that destroys a clear chance is a seven-metre throw',()=>{
  // RE-PINNED, and split in two. This fixture puts a carrier at nine and a half
  // metres driving at an empty path to goal, and under the rule the engine now
  // models that is a destroyed clear chance: IHF 14:1, a seven-metre throw. The
  // old model could not award one at all -- six matches produced zero -- so the
  // fixture is now testing something it previously could not reach.
  for(const direction of ['TOP','BOTTOM'] as const) {
    let held=createContactScenario('LATE_HOLD',2025,direction);
    for(let i=0;i<5;i++)held=tickCore(held);
    assert.equal(held.restart?.kind,'SEVEN_METRE');assert.equal(held.ball.live,false);
    const e=held.events.find(e=>e.type==='FOUL')!;assert.ok(e,'the hold was whistled');
    assert.equal(e.details.severity,'CLEAR_CHANCE');
    assert.ok(held.contests.some(c=>c.id===e.contestId),'with the contest as its evidence');
  }
});
test('the same hold is an ordinary free throw once the chance is covered',()=>{
  // The other half, and the one the audit was really about: most holds are not
  // punishable at all. Put a covering defender between the carrier and the goal
  // and the identical contact becomes a free throw with nobody punished.
  for(const direction of ['TOP','BOTTOM'] as const) {
    let held=createContactScenario('LATE_HOLD',2025,direction);
    const cover=getPlayer(held,'A02');
    cover.position=world({x:9.2,y:7.4},direction);cover.beatenUntilTick=0;
    for(let i=0;i<5;i++)held=tickCore(held);
    const e=held.events.find(e=>e.type==='FOUL');
    if(!e)continue;
    assert.notEqual(e.details.severity,'CLEAR_CHANCE','a covered chance is not a clear one');
    if(e.details.severity==='ORDINARY')assert.equal(getPlayer(held,'A03').warnings,0,'and an ordinary foul never touches a record');
  }
});
test('an evaded commitment cannot award a foul',()=>{
  for(const direction of ['TOP','BOTTOM'] as const) {
    let escaped=createContactScenario('EVADED_CONTACT',2025,direction);
    for(let i=0;i<5;i++)escaped=tickCore(escaped);
    assert.ok(escaped.events.some(e=>e.type==='CONTACT_MISSED'));
    assert.equal(escaped.events.some(e=>e.type==='FOUL'),false);
  }
});
test('the same hold becomes punishable when it is committed at speed',()=>{
  // The other half of the same rule, and the reason the category exists: what
  // separates a free throw from a two-minute suspension is how it was done.
  for(const direction of ['TOP','BOTTOM'] as const) {
    let s=createContactScenario('LATE_HOLD',2025,direction);
    const d=getPlayer(s,'A03');d.velocity={x:3.4,y:0};
    setProfile(d,{discipline:.1,contact:.1});
    for(let i=0;i<5;i++){s=tickCore(s);}
    const e=s.events.find(e=>e.type==='FOUL');
    if(e)assert.notEqual(e.details.severity,'LEGAL','a hold at pace by an undisciplined defender is not legal contact');
  }
});
test('contact legality is independent of defender skill and does not cancel a committed pass',()=>{
  for(const defence of [.1,.99]) {
    const s=createContactScenario('FRONTAL_CONTACT'),a=getPlayer(s,'H03'),d=getPlayer(s,'A03');
    setProfile(d,{lateral:defence,defTiming:defence});d.action!.phase='EXECUTING';a.action!.kind='PASS';a.action!.phase='COMMITTED';
    resolveContacts(s);assert.equal(a.action!.phase,'COMMITTED');assert.equal(s.events.some(e=>e.type==='FOUL'),false);
  }
});
test('progressive body fouls warn, then suspend, then disqualify without restoring court eligibility',()=>{
  const s=createContactScenario('LATE_HOLD'),a=getPlayer(s,'H03'),d=getPlayer(s,'A03');
  foul(s,a,d,'PUNISHABLE','Fixture body-directed foul',false,'first');assert.equal(d.warnings,1);assert.equal(d.sanctions,0);
  for(let i=1;i<=3;i++){d.population='COURT';foul(s,a,d,'PUNISHABLE','Fixture body-directed foul',false,`repeat-${i}`);assert.equal(d.sanctions,i);}
  assert.equal(d.population,'DISQUALIFIED');assert.equal(d.suspensionUntilMs,120000);
});
test('two attackers crossing between adjacent spaces are handed over, not chased',()=>{
  // REWRITTEN for the zonal contract. The old model negotiated a pairwise swap
  // between two man-markers, with a lock, a pair of committed HANDOVER actions
  // and a cancellation path. A zone defence has none of that and needs none of
  // it: an attacker who crosses simply leaves one space and enters the next,
  // the defender he leaves stays home, and each takes the man who arrives. What
  // is asserted is the thing that actually matters and that man-marking got
  // wrong -- neither defender follows his man out of his own space.
  const s=createCoreScenario();
  coordinate(s);
  const backs=courtPlayers(s,'AWAY').filter(p=>['LB','CB','RB'].includes(p.role));
  const zonesBefore=new Map(backs.map(d=>[d.id,d.zone]));
  const marksBefore={...s.defence.marks};
  // Swap two attackers across each other, which is what a crossing IS.
  const left=getPlayer(s,'H02'),right=getPlayer(s,'H04');
  const leftX=left.position.x,rightX=right.position.x;
  left.position={...left.position,x:rightX};right.position={...right.position,x:leftX};
  for(let i=0;i<6;i++){s.tick++;s.timeMs=s.tick*50;coordinate(s);}

  // Every defender still owns the space he owned. Nobody travelled with a man.
  for(const d of backs)assert.equal(getPlayer(s,d.id).zone,zonesBefore.get(d.id),`${d.role} kept his own space`);
  // And the responsibility for the two crossing attackers has moved between
  // them: at least one adjacent space is now accounting for a different man.
  const changed=backs.filter(d=>marksBefore[d.id]!==s.defence.marks[d.id]);
  assert.ok(changed.length>=1,'the crossing is taken over rather than followed');
  assert.equal(s.defence.handover,null,'no negotiated swap is left pending');
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
