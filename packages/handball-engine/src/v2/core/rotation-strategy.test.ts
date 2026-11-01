// HM-ALPHA2-04C: the assistant's rotation strategy. Every substitution answers
// a real reading -- a tired player, a fresher or stronger replacement, the
// score and clock -- never a quota, and it changes nobody's performance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch } from './match';
import { advanceCoreMutable } from './engine';
import { courtPlayers, type CorePlayer, type CoreState } from './state';
import { coachingBefore, playingStrength, rotationStrategy, setTactics, type RotationStrategy } from './coaching';
import { requestExchange } from './population';
import { setProfile } from './testProfile';

/** A running first half where only HOME's assistant may rotate and every HOME bench player starts unavailable. */
function running(strategy?:RotationStrategy):CoreState {
  const s=createMatch(4,'TOP',1800000,0);
  for(let i=0;i<1200&&s.match!.phase==='PREMATCH';i++)advanceCoreMutable(s);
  assert.equal(s.match!.phase,'FIRST_HALF');
  s.exchanges=s.exchanges.filter(e=>e.phase==='COMPLETED'||e.phase==='CANCELLED');
  for(const team of ['HOME','AWAY'] as const){s.coaching[team].rotation=team==='HOME';s.coaching[team].timeouts=false;}
  if(strategy)s.coaching.HOME.rotationStrategy=strategy;
  for(const p of s.players)if(p.team==='HOME'){if(p.population==='COURT')p.condition.energy=1;else p.condition.unavailable=true;}
  return s;
}
/** A HOME court field player who is not carrying the ball, with a bench player of the same role made available. */
function pair(s:CoreState):{court:CorePlayer;bench:CorePlayer} {
  const court=courtPlayers(s,'HOME').find(p=>p.kind==='FIELD_PLAYER'&&p.id!==s.ball.controllerId&&!p.airborne&&s.players.some(b=>b.team==='HOME'&&b.population==='BENCH'&&b.role===p.role))!;
  const bench=s.players.find(b=>b.team==='HOME'&&b.population==='BENCH'&&b.role===court.role)!;
  bench.condition.unavailable=false;bench.condition.energy=1;
  return {court,bench};
}
const requested=(s:CoreState)=>s.exchanges.filter(e=>e.team==='HOME'&&e.phase!=='COMPLETED'&&e.phase!=='CANCELLED');

test('rotation strategy is a validated instruction; an absent one plays BALANCED',()=>{
  const s=running();
  assert.equal(rotationStrategy(s,'HOME'),'BALANCED');
  assert.ok(setTactics(s,'HOME',{rotationStrategy:'WIDE'}));
  assert.equal(rotationStrategy(s,'HOME'),'WIDE');
  assert.equal(s.events.at(-1)?.details.rotationStrategy,'WIDE');
  assert.throws(()=>setTactics(s,'HOME',{rotationStrategy:'ALL' as RotationStrategy}),/Invalid team tactics/);
});

test('how tired a player must be before he comes off depends on the strategy',()=>{
  const outcome=(strategy:RotationStrategy,energy:number)=>{const s=running(strategy),{court}=pair(s);court.condition.energy=energy;coachingBefore(s);return requested(s).length;};
  // 0.55: past the BALANCED line, short of the SHORT one.
  assert.deepEqual(['SHORT','BALANCED','WIDE'].map(x=>outcome(x as RotationStrategy,.55)),[0,1,1]);
  // 0.68: only WIDE manages fatigue this early.
  assert.deepEqual(['SHORT','BALANCED','WIDE'].map(x=>outcome(x as RotationStrategy,.68)),[0,0,1]);
  // 0.45: everyone takes a genuinely spent player off.
  assert.deepEqual(['SHORT','BALANCED','WIDE'].map(x=>outcome(x as RotationStrategy,.45)),[1,1,1]);
});

test('no substitution without a reason: a fresh team on a level bench is left alone',()=>{
  for(const strategy of ['SHORT','BALANCED','WIDE'] as const){
    const s=running(strategy),{court,bench}=pair(s);
    setProfile(bench,{...court.profile});
    for(let i=0;i<50;i++)coachingBefore(s);
    assert.equal(requested(s).length,0,strategy);
  }
});

test('SHORT brings on the stronger replacement, WIDE the fresher one',()=>{
  const choose=(strategy:RotationStrategy)=>{
    const s=running(strategy),{court,bench}=pair(s);
    const other=s.players.find(b=>b.team==='HOME'&&b.population==='BENCH'&&b.kind==='FIELD_PLAYER'&&b.id!==bench.id&&b.role!==court.role)!;
    // Neither shares the role, so only freshness and strength separate them.
    bench.condition.unavailable=true;other.condition.unavailable=false;
    const extra=s.players.find(b=>b.team==='HOME'&&b.population==='BENCH'&&b.kind==='FIELD_PLAYER'&&b.id!==bench.id&&b.id!==other.id&&b.role!==court.role)!;
    extra.condition.unavailable=false;
    other.condition.energy=1;setProfile(other,{passing:.2,decision:.2,finishing:.2,defPositioning:.2});
    extra.condition.energy=.85;setProfile(extra,{passing:.95,decision:.95,finishing:.95,defPositioning:.95});
    assert.ok(playingStrength(extra)>playingStrength(other));
    court.condition.energy=.4;coachingBefore(s);
    return {fresher:other.id,stronger:extra.id,chosen:requested(s)[0]?.inId};
  };
  const short=choose('SHORT'),wide=choose('WIDE');
  assert.equal(short.chosen,short.stronger);
  assert.equal(wide.chosen,wide.fresher);
});

test('SHORT restores a clearly stronger, recovered player in the same role; the others do not',()=>{
  for(const strategy of ['SHORT','BALANCED','WIDE'] as const){
    const s=running(strategy),{court,bench}=pair(s);
    setProfile(court,{passing:.3,decision:.3,finishing:.3,defPositioning:.3,defTiming:.3});
    setProfile(bench,{passing:.9,decision:.9,finishing:.9,defPositioning:.9,defTiming:.9});
    bench.condition.energy=.9;court.condition.energy=.9;
    coachingBefore(s);
    assert.equal(requested(s).length,strategy==='SHORT'?1:0,strategy);
    if(strategy==='SHORT')assert.deepEqual([requested(s)[0].outId,requested(s)[0].inId],[court.id,bench.id]);
  }
});

test('the match situation moves the line: a close finish keeps SHORT on, a safe lead spreads WIDE',()=>{
  const late=(strategy:RotationStrategy,energy:number,margin:number)=>{
    const s=running(strategy),{court}=pair(s);
    s.officialClock.timeMs=s.match!.periodLengthMs*2*.9;s.score.HOME=20+margin;s.score.AWAY=20;
    court.condition.energy=energy;coachingBefore(s);return requested(s).length;
  };
  assert.equal(late('SHORT',.46,1),0,'a close finish keeps a tiring key player on');
  assert.equal(late('SHORT',.46,8),1,'once the game is decided SHORT rotates normally');
  assert.equal(late('WIDE',.76,7),1,'a safe lead spreads the minutes earlier');
  assert.equal(late('WIDE',.76,1),0,'a close game does not');
});

test('manual control stays: the assistant can be off, and a manual substitution is never blocked by a strategy',()=>{
  const s=running('SHORT'),{court,bench}=pair(s);
  s.coaching.HOME.rotation=false;court.condition.energy=.3;coachingBefore(s);
  assert.equal(requested(s).length,0,'assistant off: manual only');
  s.coaching.HOME.rotation=true;court.condition.energy=1;
  assert.ok(requestExchange(s,'HOME',court.id,bench.id),'a manual change for a fresh player is accepted');
  coachingBefore(s);
  assert.equal(requested(s).length,1,'the assistant does not add or replace a manual request');
});
