// Controlled execution fixtures use real attribute names; never edit real players.
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createCoreScenario} from '../src/v2/core/scenarios';
import {advanceCoreMutable,assertCore} from '../src/v2/core/engine';
import {getPlayer} from '../src/v2/core/state';
import {buildProfile,OUTCOURT_KEYS,KEEPER_KEYS,type AttributeSheet} from '../src/v2/core/profile';
import {awardRestart} from '../src/v2/core/transitions';
import {startAction} from '../src/v2/core/actions';
import {keeperPost,shotContext} from '../src/v2/core/space';

const args=process.argv.slice(2),arg=(key:string,fallback:string)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const count=Number(arg('--count','100')),out=resolve(arg('--out','../../.tmp/shot-capability.json'));
if(!Number.isInteger(count)||count<1)throw new Error('count must be positive');
const rows=[];
for(const context of ['SEVEN_METRE','FREE_CLOSE','PRESSURED_BACKCOURT','OPEN_WING'] as const)for(const shooter of [6,14])for(const keeper of [6,14]){
 const outcomes=[];
 for(let seed=1;seed<=count;seed++){
  const s=createCoreScenario('ESTABLISHED_6V6',seed),p=getPlayer(s,context==='OPEN_WING'?'H01':'H03'),k=getPlayer(s,'A07'),d=getPlayer(s,'A03');
  const sheet=Object.fromEntries(OUTCOURT_KEYS.map(key=>[key,10])) as AttributeSheet;
  Object.assign(sheet,{SHOOTING_PLACEMENT:shooter,SHOOTING_POWER:shooter,FINISHING:shooter,WING_FINISHING:shooter});
  p.profile=buildProfile(sheet,p.role);
  k.profile=buildProfile(Object.fromEntries(KEEPER_KEYS.map(key=>[key,keeper])) as AttributeSheet,'GK');
  for(const body of s.players)if(body.id!==p.id&&body.id!==k.id&&!(context==='PRESSURED_BACKCOURT'&&body.id===d.id)){
   body.population='BENCH';body.position={x:-.35,y:24};body.zone=null;body.action=null;
  }
  p.position=context==='OPEN_WING'?{x:2.1,y:3.6}:context==='FREE_CLOSE'?{x:10,y:6.8}:context==='SEVEN_METRE'?{x:10,y:7}:{x:10,y:10};
  s.ball.controllerId=p.id;s.ball.position={...p.position};s.ball.lastTouchId=p.id;s.defence.pressureId=null;s.defence.helperId=null;s.defence.marks={};
  k.position=keeperPost(p.position,'TOP',context==='SEVEN_METRE'?.8:1.4);
  if(context==='SEVEN_METRE'){
   awardRestart(s,'SEVEN_METRE','HOME',p.position,'Controlled seven-metre',p,false);
   s.restart!.takerId=p.id;s.restart!.phase='PREPARING';
  }else{
   if(context==='PRESSURED_BACKCOURT'){
    d.position={x:10,y:8.8};s.defence.pressureId=d.id;s.defence.marks[d.id]=p.id;
    startAction(s,d,'BLOCK','Actual pressure between release and goal',null,p.id);d.action!.phase='EXECUTING';
   }
   startAction(s,p,'JUMP','Controlled opportunity: actual legal takeoff');
  }
  const opportunity=shotContext(s,p);assertCore(s);
  while(s.status==='RUNNING'&&s.tick<1500){advanceCoreMutable(s);assertCore(s);}
  const shot=s.events.find(e=>e.type==='SHOT_RELEASED');
  const goal=!!shot&&s.events.some(e=>e.type==='GOAL'&&e.actionId===shot.actionId);
  const save=!!shot&&s.events.some(e=>e.type.startsWith('SAVE_')&&e.actionId===shot.actionId);
  const block=!!shot&&s.events.some(e=>e.type==='SHOT_BLOCKED'&&e.actionId===shot.actionId);
  outcomes.push({seed,attempt:!!shot,goal,save,block,miss:!!shot&&!goal&&!save&&!block,ticks:s.tick,quality:opportunity.quality,pressure:opportunity.pressure,rng:{...s.rng}});
 }
 const attempts=outcomes.filter(x=>x.attempt).length,goals=outcomes.filter(x=>x.goal).length,saves=outcomes.filter(x=>x.save).length;
 rows.push({context,shooter,keeper,attempts,goals,saves,blocks:outcomes.filter(x=>x.block).length,misses:outcomes.filter(x=>x.miss).length,incomplete:count-attempts,
  conversion:attempts?goals/attempts:0,conventionalSaveShare:goals+saves?saves/(goals+saves):null,
  meanDecisionQuality:outcomes.reduce((n,x)=>n+x.quality,0)/count,outcomes});
}
mkdirSync(dirname(out),{recursive:true});
writeFileSync(out,JSON.stringify({scope:'Controlled legal isolated shot/restart fixtures. Fixed seeds; full attribute sheets with shooter execution and keeper capability differences. Normal decision pressure is not inferred from these fixed-takeoff trials. No real-player data changes.',count,rows},null,2)+'\n');
console.log(JSON.stringify(rows.map(({outcomes,...row})=>{void outcomes;return row;}),null,2));
