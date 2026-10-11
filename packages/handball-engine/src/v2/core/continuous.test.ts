import test from 'node:test';
import assert from 'node:assert/strict';
import { createContinuous } from './continuous';
import { createMatch,matchReport,matchAfter } from './match';
import { advanceCoreMutable,assertCore,tickCore } from './engine';
import { coreHash,coreEventHash,saveCore,loadCore } from './replay';
import { archiveMatch,advanceArchive,seekMatch } from './matchReplay';
import { awardRestart,foul } from './transitions';
import { courtPlayers,getPlayer,type CoreState } from './state';
import { legalAction } from './actions';
import { advanceBall } from './interactions';
import { populationBefore,courtLimit } from './population';

function finish(s:CoreState) {while(s.status==='RUNNING'){advanceCoreMutable(s);if(s.tick%200===0)assertCore(s);}assertCore(s);return s;}
test('continuous play and 7v6 resolve six physical outcomes across seeds and directions',()=>{
  for(const mode of ['CONTINUOUS_PLAY','SEVEN_V_SIX'] as const)for(const direction of ['TOP','BOTTOM'] as const)for(const seed of [1,7,2025]) {
    const s=finish(createContinuous(mode,seed,direction));assert.equal(s.status,'CHECKPOINT',`${mode}/${direction}/${seed}: ${s.reason}`);assert.equal(s.flow.outcomes,6);
    for(const e of s.exchanges.filter(e=>e.phase==='COMPLETED')) {
      const left=s.events.find(x=>x.type==='PLAYER_LEFT_COURT'&&x.details.exchangeId===e.id)!;
      const admitted=s.events.find(x=>x.type==='SUBSTITUTE_ADMITTED'&&x.details.exchangeId===e.id)!;
      assert.ok(left.tick<admitted.tick,'Physical exit precedes replacement admission');
    }
  }
});
test('restart preparation cannot grant ordinary play; all restart types execute through the common model',()=>{
  for(const kind of ['FREE_THROW','THROW_IN','SEVEN_METRE','GOALKEEPER_THROW','CENTRE_THROW_OFF'] as const)for(const direction of ['TOP','BOTTOM'] as const) {
    const s=createContinuous('CONTINUOUS_PLAY',2025,direction,null);awardRestart(s,kind,'HOME',{x:10,y:20},'Regression fixture',null,false);
    while(s.status==='RUNNING'&&!s.events.some(e=>e.type==='RESTART_COMPLETED')) {
      if(!s.ball.live)assert.equal(legalAction(s,getPlayer(s,'H02'),'DRIVE'),false);
      advanceCoreMutable(s);
    }
    assert.equal(s.status,'RUNNING',`${kind}/${direction}: ${s.reason}`);assert.equal(s.restart?.phase,'COMPLETED');
    assert.ok(s.events.some(e=>e.type==='PASS_RELEASED'||e.type==='SHOT_RELEASED'));
  }
});
test('dead-ball return and live pass are distinct; save/resume survives physical restart delivery',()=>{
  const initial=createContinuous('CONTINUOUS_PLAY',2025,'TOP',null);
  awardRestart(initial,'CENTRE_THROW_OFF','HOME',{x:10,y:20},'Fixture',null,false);
  initial.ball.controllerId='H07';initial.ball.position={...getPlayer(initial,'H07').position};
  while(initial.status==='RUNNING'&&!initial.ball.flight)advanceCoreMutable(initial);
  assert.equal(initial.ball.flight?.purpose,'DEAD_BALL_RETURN');assert.equal(initial.ball.live,false);
  const resumed=JSON.parse(JSON.stringify(loadCore(saveCore(initial)))) as CoreState;
  for(const s of [initial,resumed])while(s.status==='RUNNING'&&s.restart?.phase!=='COMPLETED')advanceCoreMutable(s);
  assert.equal(coreHash(initial),coreHash(resumed));assert.equal(coreEventHash(initial),coreEventHash(resumed));
  assert.ok(initial.events.some(e=>e.type==='BALL_RETURN_RECEIVED'));assert.equal(initial.restart?.context,'POST_GOAL');
});
test('suspension expiry uses official time and only permits physical re-entry',()=>{
  const s=createContinuous(),attacker=getPlayer(s,'H03'),defender=getPlayer(s,'A03');
  foul(s,attacker,defender,'SERIOUS','Fixture dangerous contact',false,'test-contest');assert.equal(courtLimit(s,'AWAY'),6);
  s.timeMs+=200000;populationBefore(s);assert.equal(defender.population,'SUSPENDED');
  s.officialClock.timeMs=120000;populationBefore(s);
  assert.equal(courtLimit(s,'AWAY'),7);assert.ok(s.exchanges.some(e=>e.inId===defender.id&&e.outId===null));
  assert.ok(defender.position.x<0);assert.ok(courtPlayers(s,'AWAY').length<=7);
});
// IHF 11:1. Who touched it last decides the restart, and the goalkeeper is
// expressly NOT a court player for this purpose:
//   defending court player -> throw-in from the CORNER to the attacking team
//   goalkeeper             -> goalkeeper throw to the defending team
//   attacker               -> goalkeeper throw to the defending team
// Spelled out because a review of this engine read the Restart union, concluded
// there was no corner throw, and claimed the attack was owed one after a
// goalkeeper parry. There is one, below, and a parry is not it.
test('end-line last touch distinguishes defender corner, goalkeeper touch and attacking miss',()=>{
  for(const [lastId,kind,owner] of [['A02','THROW_IN','HOME'],['A07','GOALKEEPER_THROW','AWAY'],['H03','GOALKEEPER_THROW','AWAY']] as const) {
    const s=createContinuous();s.tick=1;s.timeMs=50;s.ball.controllerId=null;s.ball.position={x:15,y:.05};s.ball.lastTouchId=lastId;
    s.ball.flight={kind:'DEFLECTION',origin:{x:15,y:1},velocity:{x:0,y:-4},fromId:'H03',receiverId:null,actionId:'fixture',possessionId:s.possession.id,releasedTick:0,height:1,goalSide:'TOP',touchedIds:s.players.map(p=>p.id),purpose:'PLAY'};
    advanceBall(s);assert.equal(s.restart?.kind,kind);assert.equal(s.restart?.owner,owner);
    if(kind==='THROW_IN')assert.deepEqual(s.restart?.location,{x:20,y:0});
  }
});
test('full 2 x 30 minute matches include changed ends, official halftime and real exchanges',()=>{
  for(const direction of ['TOP','BOTTOM'] as const) {
    const s=finish(createMatch(2025,direction));const report=matchReport(s);
    assert.equal(report.complete,true,s.reason??'');assert.equal(report.officialMs,3600000);assert.equal(s.period,2);
    assert.equal(s.directions.HOME,direction==='TOP'?'BOTTOM':'TOP');
    // The fixture schedules five exchanges. A further goalkeeper return is
    // conditional on play/eligibility, not a sixth mandatory event quota.
    assert.ok(report.exchanges>=4,'both teams make their planned field exchanges');
    assert.ok(s.exchanges.every(e=>e.phase==='COMPLETED'||e.phase==='CANCELLED'),'accepted exchanges finish or report an eligibility cancellation');
    for(const e of s.exchanges.filter(e=>e.phase==='COMPLETED')){
      const admitted=s.events.find(ev=>ev.type==='SUBSTITUTE_ADMITTED'&&ev.details.exchangeId===e.id),completed=s.events.find(ev=>ev.type==='EXCHANGE_COMPLETED'&&ev.details.exchangeId===e.id);
      assert.ok(admitted&&completed&&admitted.tick<=completed.tick,'entry precedes completed physical substitution');
      if(e.outId){const left=s.events.find(ev=>ev.type==='PLAYER_LEFT_COURT'&&ev.details.exchangeId===e.id);assert.ok(left&&left.tick<=admitted!.tick,'outgoing body leaves before replacement admission');}
    }
    assert.deepEqual(report.periods.map(p=>p.officialMs),[0,1800000,1800000,3600000]);
    assert.ok(report.periods[2].tick-report.periods[1].tick>=12000);
  }
});
test('sparse historical replay matches immutable execution and does not leak final roles or events',()=>{
  const initial=createMatch(7,'BOTTOM',60000,1000),archive=archiveMatch(initial,50);
  const expected=new Map<number,string>();let s=initial;
  for(let i=0;i<160;i++){s=tickCore(s);if([1,49,50,51,159,160].includes(s.tick))expected.set(s.tick,coreHash(s));}
  while(archive.state.status==='RUNNING')advanceArchive(archive,200);
  for(const [tick,hash] of expected)assert.equal(coreHash(seekMatch(archive,tick)),hash);
  const first=seekMatch(archive,1);assert.equal(getPlayer(first,'H09').population,'BENCH');assert.ok(first.events.every(e=>e.tick<=1));
  const middle=seekMatch(archive,1201),resumed=finish(JSON.parse(JSON.stringify(loadCore(saveCore(middle)))));
  assert.equal(coreHash(resumed),coreHash(archive.state));assert.equal(coreEventHash(resumed),coreEventHash(archive.state));
});
test('final signal retains an awarded free throw, but not an unrelated later pass',()=>{
  const s=createMatch();s.match!.phase='FIRST_HALF';s.officialClock.timeMs=1800000;
  awardRestart(s,'FREE_THROW','HOME',{x:10,y:10},'At horn',null,false);matchAfter(s);
  assert.equal(s.match!.phase,'FINAL_THROW');assert.equal(s.officialClock.running,false);
  while(s.status==='RUNNING'&&s.match!.phase==='FINAL_THROW')advanceCoreMutable(s);
  assert.equal(s.match!.phase,'HALFTIME');assert.ok(s.events.some(e=>e.type==='SHOT_RELEASED'));
  const unrelated=createMatch();unrelated.match!.phase='FIRST_HALF';unrelated.officialClock.timeMs=1800000;
  unrelated.restart!.kind='FREE_THROW';unrelated.restart!.phase='COMPLETED';
  unrelated.ball.flight={kind:'PASS',origin:{x:10,y:20},velocity:{x:1,y:0},fromId:'H02',receiverId:'H04',actionId:'later-pass',possessionId:unrelated.possession.id,releasedTick:0,height:1,goalSide:'TOP',touchedIds:[],purpose:'PLAY'};
  matchAfter(unrelated);assert.equal(unrelated.match!.phase,'HALFTIME');
});
