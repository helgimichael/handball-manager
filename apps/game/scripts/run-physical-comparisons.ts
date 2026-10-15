/** Controlled manager commands through the canonical career API; sequential pairs. */
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {createNewCareerState} from '../lib/career/newCareer';import {buildMatchdayReadyEvent} from '../lib/career/careerEvents';
import {startProductionMatch,advanceProductionMatch,commandProductionMatch,resultFromSession} from '../lib/career/productionMatch';
import {PhysicalLoadDiagnostics as RotationFatigueDiagnostics} from './lib/physicalLoadDiagnostics';
import {ledger,lossClassOf} from '@handball-manager/handball-engine/src/v2/core/ledger';
import type {CoreState,TeamId} from '@handball-manager/handball-engine/src/v2/core/state';
const argv=process.argv.slice(2),arg=(k:string,d:string)=>argv.includes(k)?argv[argv.indexOf(k)+1]:d,count=Number(arg('--count','30')),out=resolve(arg('--out','../../docs/physical-load-fatigue-v11/development/pilot'));
const mode=arg('--mode','rotation'),variant=arg('--variant','combined');if(!['rotation','style','roles'].includes(mode))throw Error('mode rotation/style/roles');
if(!Number.isInteger(count)||count<1||count>40)throw Error('count 1..40');mkdirSync(out,{recursive:true});
const root=resolve('../..'),read=(p:string)=>JSON.parse(readFileSync(p,'utf8')),hash=(v:unknown)=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const baseline=join(root,'docs/reconciliation-v11/final/allsv'),inputs=read(join(baseline,'inputs.json')),recipes=read(join(baseline,'recipes.json')).slice(0,count);
const core=join(root,'packages/handball-engine/src/v2/core'),paths=[...readdirSync(core).filter(f=>f.endsWith('.ts')&&!f.endsWith('.test.ts')).map(f=>join(core,f)),resolve('lib/career/productionMatch.ts'),resolve('scripts/lib/rotationFatigueDiagnostics.ts'),resolve('scripts/lib/physicalLoadDiagnostics.ts'),resolve('scripts/run-physical-comparisons.ts')];
const fingerprints=()=>Object.fromEntries(paths.map(p=>[p.slice(root.length+1).replaceAll('\\','/'),hash(readFileSync(p,'utf8'))]));
const sources=fingerprints(),manifest={mode,variant,sources,inputHash:hash(inputs),recipes,design:'same career/seed/opponent; automatic rotation/timeouts off; rotation pairs use six ordinary rolling-sub commands; style pairs change actual manager tactics only; roles uses uniform physical profiles with existing technical identity'};
if(existsSync(join(out,'manifest.json')))assert.deepEqual(read(join(out,'manifest.json')),manifest,'source/input drift; choose a new output');
writeFileSync(join(out,'manifest.json'),JSON.stringify(manifest,null,2));
type Career=ReturnType<typeof createNewCareerState>;
function setup(recipe:{saveSeed:string;managerClubId:string;fixtureId:string}){
 let career=createNewCareerState(recipe.saveSeed,recipe.managerClubId,structuredClone(inputs.worldSquads),undefined,structuredClone(inputs.gameplayRatings));const fixture=career.fixtures.find(f=>f.id===recipe.fixtureId)!;assert.ok(fixture);
 career={...career,gameDate:fixture.date,careerEvents:[buildMatchdayReadyEvent(fixture.id,fixture.date)]};career=startProductionMatch(career,fixture.id);
 for(const team of ['HOME','AWAY']as const)career=commandProductionMatch(career,{kind:'TACTICS',team,patch:{rotation:false}});
 // Existing AI timeout policy is disabled equally in the experimental setup.
 career.productionMatch!.core.coaching.HOME.timeouts=false;career.productionMatch!.core.coaching.AWAY.timeouts=false;
 if(mode==='roles')for(const p of career.productionMatch!.core.players)if(p.kind==='FIELD_PLAYER'){const v=12/19;p.profile={...p.profile,topSpeed:4.4+3*v,acceleration:3.6+4*v,strength:v,balance:v,endurance:v,physical:{acceleration:v,lateralQuickness:v,agility:v,explosiveness:v,jumping:v,repeatSprint:v,mobility:v}};}
 return {career,team:(fixture.homeClubId===career.playerClubId?'HOME':'AWAY')as TeamId};
}
function plans(){const roles=['LB','CB','RB'];return [...roles.map((role,i)=>({role,slot:i,returning:false,atMs:(34+i*4)*60000})),...roles.map((role,i)=>({role,slot:i,returning:true,atMs:(51+i*3)*60000}))];}
function simulate(initial:Career,team:TeamId,rotation:boolean,observe=true){let career=structuredClone(initial);if(mode==='style'){const patch=rotation?(variant==='tempo'?{tempo:'QUICK' as const}:variant==='defence'?{defence:'5:1' as const}:['DIRECT','WIDTH','COMBINATION'].includes(variant)?{attackIdentity:variant as 'DIRECT'|'WIDTH'|'COMBINATION'}:{tempo:'QUICK' as const,defence:'5:1' as const,attackIdentity:'DIRECT' as const}):{tempo:'BALANCED' as const,defence:'6:0' as const,attackIdentity:'BALANCED' as const};career=commandProductionMatch(career,{kind:'TACTICS',team,patch});}const tacticsAtStart=structuredClone(career.productionMatch!.core.coaching);const plan=mode==='rotation'&&rotation?plans():[],diag=new RotationFatigueDiagnostics(),commands:unknown[]=[],rests=new Map<number,{outId:string;inId:string}>();let next=0,issued=0,calls=0,mid:{career:Career;next:number}|null=null;
 const can=(s:Readonly<CoreState>)=>next<plan.length&&s.officialClock.timeMs>=plan[next].atMs&&!s.exchanges.some(e=>e.team===team&&!['COMPLETED','CANCELLED'].includes(e.phase));
 while(career.productionMatch!.core.status==='RUNNING'&&calls++<100){if(can(career.productionMatch!.core)){const q=plan[next],s=career.productionMatch!.core,rest=rests.get(q.slot);
   const out=q.returning?s.players.find(p=>p.id===rest?.inId&&p.population==='COURT'):s.players.find(p=>p.team===team&&p.role===q.role&&p.population==='COURT'&&p.kind==='FIELD_PLAYER');
   const eligible=s.players.filter(p=>p.team===team&&p.kind==='FIELD_PLAYER'&&p.population==='BENCH'&&!p.condition.unavailable&&!p.condition.exitRequired&&!p.condition.attacksRemaining);
   const incoming=q.returning?eligible.find(p=>p.id===rest?.outId):eligible.find(p=>p.role===q.role)??eligible[0];
   if(out&&incoming){career=commandProductionMatch(career,{kind:'SUBSTITUTION',team,outId:out.id,inId:incoming.id});if(!q.returning)rests.set(q.slot,{outId:out.id,inId:incoming.id});commands.push({tick:s.tick,officialMs:s.officialClock.timeMs,...q,outId:out.id,inId:incoming.id});issued++;}
   else commands.push({tick:s.tick,officialMs:s.officialClock.timeMs,...q,skipped:'Player unavailable or already changed by ordinary sanction replacement'});
   next++;}
  career=advanceProductionMatch(career,10000,false,observe?(s,e)=>diag.observe(s,e):undefined,can);
  if(!mid&&career.productionMatch!.core.officialClock.timeMs>=1800000)mid={career:JSON.parse(JSON.stringify(career)),next};
 }
 assert.equal(career.productionMatch!.core.match?.phase,'FULLTIME');const session=career.productionMatch!,before=hash(session),result=resultFromSession(session),diagnostics=diag.report(session.core);assert.equal(hash(session),before,'observer report non-mutation');
 const halves=[0,1].map(i=>{const events=session.core.events.filter(e=>e.officialMs>=i*1800000&&e.officialMs<(i+1)*1800000&&session.core.players.some(p=>p.id===e.actorId&&p.team===team));const shots=events.filter(e=>e.type==='SHOT_RELEASED');return {goals:events.filter(e=>e.type==='GOAL').length,fieldAttempts:shots.filter(e=>e.details.shotKind!=='SEVEN_METRE').length,sevenAttempts:shots.filter(e=>e.details.shotKind==='SEVEN_METRE').length,totalAttempts:shots.length,suspensions:events.filter(e=>e.type==='TWO_MINUTE_SUSPENSION').length};});
 const losses=ledger(session.core).records.filter(r=>r.team===team&&lossClassOf(r.ending)).map(r=>({ending:r.ending,firstTick:r.firstTick,lastTick:r.lastTick,evidence:r.evidence}));
 return{career,mid,report:{complete:true,team,rotation:mode==='rotation'&&rotation,initialTactics:tacticsAtStart,initialHash:hash(initial.productionMatch),sessionHash:before,resultHash:hash(result),score:session.core.score,managerGoals:session.core.score[team],opponentGoals:session.core.score[team==='HOME'?'AWAY':'HOME'],halves,commands,planned:plan.length,issued,losses,diagnostics}};
}
const summaries=[];for(let index=0;index<count;index++){const file=join(out,`pair-${String(index).padStart(3,'0')}.json`);if(existsSync(file)){summaries.push(read(file));console.log('reusing pair '+index);continue;}const{career,team}=setup(recipes[index]);const started=performance.now();let a=simulate(career,team,false);const noRotation=a.report;a=null as unknown as typeof a;let b=simulate(career,team,true);const rotation=b.report;b=null as unknown as typeof b;assert.equal(noRotation.initialHash,rotation.initialHash);const pair={index,recipe:recipes[index],control:noRotation,intervention:rotation,runtimeMs:performance.now()-started};writeFileSync(file,JSON.stringify(pair,null,2));summaries.push(pair);assert.deepEqual(fingerprints(),sources);console.log(JSON.stringify({index,complete:true,noRotation:noRotation.score,rotation:rotation.score,commands:rotation.issued,runtimeMs:pair.runtimeMs}));}
writeFileSync(join(out,'summary.json'),JSON.stringify({complete:true,n:count,manifest,pairs:summaries.map(p=>({index:p.index,noRotation:p.control.managerGoals-p.control.opponentGoals,rotation:p.intervention.managerGoals-p.intervention.opponentGoals,runtimeMs:p.runtimeMs}))},null,2));console.log('COMPLETE '+count+' sequential rotation pairs');
