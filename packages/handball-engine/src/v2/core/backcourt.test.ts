import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackcourtScenario,BACKCOURT_SCENARIOS } from './backcourtScenarios';
import { planBackcourtSupport } from './backcourt';
import { coordinate,selectActions } from './structure';
import { getPlayer } from './state';
import { distance,fieldLegal,local } from './space';
import { tickCore,assertCore } from './engine';
import { awardRestart,acquire } from './transitions';
import { coreHash,coreEventHash,loadCore,saveCore,replayCore,playCore,seekCore } from './replay';

test('compact defence produces width while a real pivot interval permits asymmetric contraction',()=>{
  for(const direction of ['TOP','BOTTOM'] as const) {
    const wide=createBackcourtScenario('COMPACT_DEFENCE_WIDTH',2025,direction),combo=createBackcourtScenario('PIVOT_INTERVAL_SUPPORT',2025,direction);
    const wl=planBackcourtSupport(wide,getPlayer(wide,'H02')),wr=planBackcourtSupport(wide,getPlayer(wide,'H04'));
    const cl=planBackcourtSupport(combo,getPlayer(combo,'H02')),cr=planBackcourtSupport(combo,getPlayer(combo,'H04'));
    assert.equal(wl.mode,'STRETCH');assert.equal(wr.mode,'STRETCH');assert.ok(wr.target.x-wl.target.x>12);
    assert.equal(cl.mode,'COMBINE');assert.equal(cl.partnerId,'H06');assert.ok(cl.target.x>wl.target.x+2);
    assert.equal(cr.mode,'STRETCH','The other side need not contract with the combination');
    for(const r of [wl,wr,cl,cr])assert.ok(fieldLegal(r.target));
    getPlayer(combo,'H06').action=null;
    assert.equal(planBackcourtSupport(combo,getPlayer(combo,'H02')).mode,'STRETCH','An absent screen cannot supply a combination');
  }
});

test('penetration clears a lateral outlet and wing possession keeps its adjacent back connected',()=>{
  for(const direction of ['TOP','BOTTOM'] as const) {
    const s=createBackcourtScenario('PENETRATION_SPACING',2025,direction),p=getPlayer(s,'H02');
    const r=planBackcourtSupport(s,p),carrier=getPlayer(s,'H03');
    assert.equal(r.mode,'CLEAR_LANE');assert.equal(r.partnerId,carrier.id);
    assert.ok(Math.abs(r.target.x-carrier.action!.target!.x)>=3);
    assert.ok(local(r.target,direction).y>local(carrier.position,direction).y);
    const wing=createBackcourtScenario('WING_BACKCOURT_RETURN',2025,direction);
    const back=planBackcourtSupport(wing,getPlayer(wing,'H02'));
    assert.equal(back.mode,'RECYCLE');assert.equal(back.partnerId,'H01');
    assert.ok(distance(back.target,getPlayer(wing,'H01').position)<9);
    assert.equal(planBackcourtSupport(wing,getPlayer(wing,'H04')).mode,'STRETCH');
  }
});

test('support survives a changed read during commitment and updates only at an available decision',()=>{
  const s=createBackcourtScenario();coordinate(s);selectActions(s);
  const p=getPlayer(s,'H02'),plan=structuredClone(p.support),action=structuredClone(p.action);
  getPlayer(s,'A02').position.x=3;s.tick=100;
  coordinate(s);selectActions(s);
  assert.deepEqual(p.support,plan);assert.deepEqual(p.action,action,'No replacement or retargeting of a committed run');
  p.action!.phase='COMPLETED';coordinate(s);selectActions(s);
  assert.notDeepEqual(p.support?.target,plan?.target);assert.notEqual(p.action!.id,action!.id);
});

test('backcourt scenarios physically evolve, complete in both directions and retain exact replay',()=>{
  for(const name of BACKCOURT_SCENARIOS)for(const direction of ['TOP','BOTTOM'] as const) {
    let s=createBackcourtScenario(name,2025,direction);const frames=[s];
    while(s.status==='RUNNING') {
      const before=s;s=tickCore(s);assertCore(s);frames.push(s);
      for(const p of s.players)assert.ok(distance(p.position,getPlayer(before,p.id).position)<=p.attributes.speed*.05+1e-8);
    }
    assert.equal(s.status,'CHECKPOINT',`${name}/${direction}: ${s.reason}`);
    if(name==='COMPACT_DEFENCE_WIDTH')assert.ok(frames.some(f=>getPlayer(f,'H04').position.x-getPlayer(f,'H02').position.x>11),'Width must be occupied, not merely planned');
    if(name==='PIVOT_INTERVAL_SUPPORT')assert.ok(frames.some(f=>getPlayer(f,'H02').position.x>6&&getPlayer(f,'H04').position.x>15),'The pivot-side contraction must coexist physically with opposite-side width');
    const mid=frames[Math.floor(frames.length/2)];let resumed=loadCore(saveCore(mid));
    while(resumed.status==='RUNNING')resumed=tickCore(resumed);
    assert.equal(coreHash(resumed),coreHash(s));assert.equal(coreEventHash(resumed),coreEventHash(s));
    for(const speed of [.25,4]) {
      let r=replayCore(frames[0]);while(r.frames[r.cursor].status==='RUNNING')r=playCore(r,50,speed);
      assert.equal(coreHash(r.frames[r.cursor]),coreHash(s));assert.equal(coreEventHash(r.frames[r.cursor]),coreEventHash(s));
      r=seekCore(r,mid.tick);assert.equal(coreHash(r.frames[r.cursor]),coreHash(mid));
    }
  }
});

test('missing partners and loose balls do not create fictitious wing or pivot relationships',()=>{
  const s=createBackcourtScenario();getPlayer(s,'H01').population='BENCH';getPlayer(s,'H06').population='BENCH';
  s.ball.controllerId=null;s.ball.flight=null;s.ball.mode='LOOSE';
  const p=planBackcourtSupport(s,getPlayer(s,'H02'));assert.equal(p.mode,'STRETCH');assert.ok(fieldLegal(p.target));
});

test('support plans end on reception, possession change and restart award without altering past frames',()=>{
  const s=createBackcourtScenario();coordinate(s);const before=structuredClone(s);
  const back=getPlayer(s,'H02');assert.ok(back.support);
  acquire(s,back,back.position,'Fixture physical reception');assert.equal(back.support,null);
  coordinate(s);assert.ok(getPlayer(s,'H04').support);
  awardRestart(s,'FREE_THROW','HOME',back.position,'Fixture whistle');assert.ok(s.players.every(p=>p.support===null));
  assert.ok(getPlayer(before,'H02').support);
  const turnover=createBackcourtScenario();coordinate(turnover);const defender=getPlayer(turnover,'A02');
  acquire(turnover,defender,defender.position,'Fixture physical turnover');assert.ok(turnover.players.every(p=>p.support===null));
});
