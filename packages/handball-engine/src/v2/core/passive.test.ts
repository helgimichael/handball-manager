import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoreScenario } from './scenarios';
import { getPlayer,record } from './state';
import { passiveAfter,showPassiveWarning } from './passive';
import { awardRestart,foul } from './transitions';
import { saveCore,loadCore,coreHash } from './replay';

function warned(){const s=createCoreScenario();s.checkpoint.stopOnOutcome=false;showPassiveWarning(s,'Observed unproductive circulation');return s;}
function pass(s:ReturnType<typeof warned>){record(s,'PASS_RECEIVED',getPlayer(s,'H04'),{passerId:'H03'});passiveAfter(s);}
test('passive warning counts completed passes and whistles at the fifth reception',()=>{
  const s=warned();for(let i=0;i<4;i++){pass(s);assert.equal(s.restart,null);}
  const saved=structuredClone(loadCore(saveCore(s)));pass(s);pass(saved);
  assert.equal(s.restart?.owner,'AWAY');assert.equal(s.restart?.kind,'FREE_THROW');assert.equal(coreHash(s),coreHash(saved));
});
test('a restart after the fourth pass grants one additional pass, not a fresh allowance',()=>{
  const s=warned();for(let i=0;i<4;i++)pass(s);
  awardRestart(s,'THROW_IN','HOME',{x:0,y:12},'Deflected out');passiveAfter(s);
  pass(s);assert.equal(s.restart?.owner,'HOME');assert.equal(s.referee.passive.passes,5);
  pass(s);assert.equal(s.restart?.owner,'AWAY');
});
test('defensive personal punishment cancels the warning and starts a new build-up allowance',()=>{
  const s=warned();pass(s);foul(s,getPlayer(s,'H03'),getPlayer(s,'A03'),false,false,'contact');passiveAfter(s);
  assert.equal(s.referee.passive.warnedTick,null);assert.equal(s.referee.passive.passes,0);
  assert.ok(s.events.some(e=>e.type==='PASSIVE_WARNING_CANCELLED'));
});
test('warning judgment distinguishes directed advancing play from stagnant circulation',()=>{
  const s=createCoreScenario();passiveAfter(s);s.referee.passive.idleMs=17950;s.possession.completedPasses=4;
  const p=getPlayer(s,'H03');p.velocity={x:0,y:-2};
  p.action={id:'drive',possessionId:s.possession.id,kind:'DRIVE',phase:'EXECUTING',startedTick:0,phaseTick:0,executeTicks:20,recoveryTicks:2,target:{x:10,y:9},targetId:null,reason:'Directed threat',resolved:false,contestIds:[],shotKind:null,purpose:'PLAY',contact:null,driveStart:null};
  passiveAfter(s);assert.equal(s.referee.passive.warnedTick,null);
  p.velocity={x:0,y:0};p.action=null;s.referee.passive.idleMs=17950;passiveAfter(s);
  assert.notEqual(s.referee.passive.warnedTick,null);
});
