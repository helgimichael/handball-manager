// HM-ALPHA2-04D: 7v6 as a coaching instruction. The keeper really leaves, a
// seventh court player really enters, the goal is really empty, and the keeper
// really has to come back when the ball is lost.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch } from './match';
import { advanceCoreMutable, assertCore } from './engine';
import { courtPlayers, type CoreState } from './state';
import { coachingBefore, setTactics, sevenVSixMode, sevenVSixWanted, type SevenVSixMode } from './coaching';

function running(mode?:SevenVSixMode):CoreState {
  const s=createMatch(4,'TOP',1800000,0);
  s.match!.coachingPlan=[];
  for(const team of ['HOME','AWAY'] as const){s.coaching[team].rotation=false;s.coaching[team].timeouts=false;}
  if(mode)s.coaching.HOME.sevenVSix=mode;
  for(let i=0;i<1200&&s.match!.phase==='PREMATCH';i++)advanceCoreMutable(s);
  assert.equal(s.match!.phase,'FIRST_HALF');
  return s;
}
const keeperOn=(s:CoreState)=>courtPlayers(s,'HOME').some(p=>p.kind==='GOALKEEPER');
const fieldOn=(s:CoreState)=>courtPlayers(s,'HOME').filter(p=>p.kind==='FIELD_PLAYER').length;

test('7v6 is a validated instruction; an absent one plays 6v6',()=>{
  const s=running();
  assert.equal(sevenVSixMode(s,'HOME'),'OFF');
  assert.equal(sevenVSixWanted(s,'HOME'),false);
  assert.ok(setTactics(s,'HOME',{sevenVSix:'ALWAYS'}));
  assert.equal(sevenVSixWanted(s,'HOME'),true);
  assert.equal(s.events.at(-1)?.details.sevenVSix,'ALWAYS');
  assert.throws(()=>setTactics(s,'HOME',{sevenVSix:'MAYBE' as SevenVSixMode}),/Invalid team tactics/);
});

test('SITUATIONAL wants a seventh player only when trailing late or playing short-handed',()=>{
  const s=running('SITUATIONAL');
  assert.equal(sevenVSixWanted(s,'HOME'),false,'level early on');
  s.score.HOME=20;s.score.AWAY=22;
  assert.equal(sevenVSixWanted(s,'HOME'),false,'trailing early is not yet a reason');
  s.officialClock.timeMs=s.match!.periodLengthMs*2*.9;
  assert.equal(sevenVSixWanted(s,'HOME'),true,'trailing late');
  s.score.HOME=23;
  assert.equal(sevenVSixWanted(s,'HOME'),false,'leading late');
  const suspended=courtPlayers(s,'HOME').find(p=>p.kind==='FIELD_PLAYER')!;
  suspended.population='SUSPENDED';
  assert.equal(sevenVSixWanted(s,'HOME'),true,'a man short');
});

test('ALWAYS really plays seven court players with the keeper off, and the keeper returns whenever the ball is lost',()=>{
  const s=running('ALWAYS');
  let seven=0,cycles=0,wasSeven=false,emptyDefending=0,longestEmpty=0;
  for(let i=0;i<14000&&s.status==='RUNNING';i++) {
    advanceCoreMutable(s);assertCore(s);
    const nowSeven=s.flow.sevenVTeam==='HOME';
    if(nowSeven&&!wasSeven)cycles++;wasSeven=nowSeven;
    if(nowSeven&&fieldOn(s)===7&&!keeperOn(s))seven++;
    assert.ok(courtPlayers(s,'HOME').length<=7,'never more than seven on court');
    const defendingEmpty=s.possession.team==='AWAY'&&s.ball.live&&!keeperOn(s);
    emptyDefending=defendingEmpty?emptyDefending+1:0;longestEmpty=Math.max(longestEmpty,emptyDefending);
  }
  assert.ok(cycles>=2,`the team goes 7v6 again on later possessions (${cycles} cycles)`);
  assert.ok(seven>200,`seven field players are genuinely on court (${seven} ticks)`);
  // The keeper has to physically come back: a real, bounded empty-goal window.
  assert.ok(longestEmpty>0,'losing the ball in 7v6 leaves a real empty goal');
  assert.ok(longestEmpty<400,`the keeper returns after every loss of the ball (longest ${longestEmpty} ticks)`);
});

test('OFF never leaves the goal, and switching off mid-attack brings the keeper straight back',()=>{
  const off=running('OFF');
  for(let i=0;i<6000;i++){advanceCoreMutable(off);assert.ok(keeperOn(off)||off.exchanges.some(e=>e.team==='HOME'&&e.phase!=='COMPLETED'&&e.phase!=='CANCELLED'),'6v6 keeps its keeper');}
  assert.equal(off.flow.sevenVTeam,null);
  const s=running('ALWAYS');
  for(let i=0;i<14000&&!(s.flow.sevenVTeam==='HOME'&&s.possession.team==='HOME');i++)advanceCoreMutable(s);
  assert.equal(s.flow.sevenVTeam,'HOME');
  assert.ok(setTactics(s,'HOME',{sevenVSix:'OFF'}));
  coachingBefore(s);
  for(let i=0;i<600&&!(keeperOn(s)&&s.flow.sevenVTeam===null);i++)advanceCoreMutable(s);
  assert.ok(keeperOn(s),'the keeper is back');
  assert.equal(s.flow.sevenVTeam,null);
  assert.equal(fieldOn(s),6);
});
