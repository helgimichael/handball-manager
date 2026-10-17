/** Paired manpower opportunities and supported contact ladder. Sequential only. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import type * as States from '@handball-manager/handball-engine/src/v2/core/state';
import type * as Engine from '@handball-manager/handball-engine/src/v2/core/engine';
import type * as Fixtures from '@handball-manager/handball-engine/src/v2/core/matchStructureScenarios';
import type * as Match from '@handball-manager/handball-engine/src/v2/core/match';
import type * as Population from '@handball-manager/handball-engine/src/v2/core/population';
import type * as ContactFixtures from '@handball-manager/handball-engine/src/v2/core/contactScenarios';
import type * as Sanction from '@handball-manager/handball-engine/src/v2/core/sanction';
import type * as Referee from '@handball-manager/handball-engine/src/v2/core/referee';
import {distribution} from '../lib/matchBenchmarks/statistics';

async function main(){
  const variant=process.argv.includes('--before')?'before':'after',root=resolve('../..'),out=join(root,`docs/match-structure-manpower-v1/CONTROLLED-${variant.toUpperCase()}.json`);
  assert.ok(!existsSync(out),'Retain completed controlled evidence');
  const dir=join(root,variant==='before'?'.tmp/match-structure-before/packages/handball-engine/src/v2/core':'packages/handball-engine/src/v2/core');
  const load=async<T>(n:string)=>{const m=await import(pathToFileURL(join(dir,n+'.ts')).href);return(m.default??m)as T;};
  const {manpowerScenario,coordinatedEnvironment,decisionEnvironment}=await load<typeof Fixtures>('matchStructureScenarios');
  const {advanceCoreMutable,assertCore}=await load<typeof Engine>('engine'),{getPlayer,courtPlayers,record}=await load<typeof States>('state');
  const {createMatch}=await load<typeof Match>('match'),{requestExchange}=await load<typeof Population>('population');
  const {createContactScenario}=await load<typeof ContactFixtures>('contactScenarios'),{readContact}=await load<typeof Sanction>('sanction'),{judgeFoul}=await load<typeof Referee>('referee');
  const fingerprints=()=>Object.fromEntries(readdirSync(dir).filter(n=>n.endsWith('.ts')&&!n.endsWith('.test.ts')).map(n=>[n,createHash('sha256').update(readFileSync(join(dir,n))).digest('hex')]));
  const sourceFingerprints=fingerprints(),cells:{state:string;homeMissing:number;awayMissing:number;n:number;metrics:unknown;trials:{profilesHash:string;[key:string]:unknown}[]}[]=[];
  for(const [homeMissing,awayMissing]of [[0,0],[1,0],[0,1],[1,1],[2,0],[0,2]] as const){
    const trials=[];
    for(let i=0;i<32;i++){
      const seed=(40789+i*104729)>>>0,direction=i%2?'TOP':'BOTTOM',s=manpowerScenario(seed,homeMissing,awayMissing,direction);
      const profilesHash=createHash('sha256').update(JSON.stringify(s.players.map(p=>[p.id,p.profile]))).digest('hex');
      record(s,'BALL_CONTROLLED',getPlayer(s,'H03'),{reason:'Controlled fixture start'});
      const initial=coordinatedEnvironment(s)!,samples=[initial];let countViolations=0;
      for(let tick=0;tick<1200&&s.status==='RUNNING'&&s.possession.team==='HOME';tick++){
        advanceCoreMutable(s);
        if(tick%20===0){assertCore(s);const env=decisionEnvironment(s);if(env&&s.possession.team==='HOME')samples.push(env);}
        if(courtPlayers(s,'HOME').length>7-homeMissing||courtPlayers(s,'AWAY').length>7-awayMissing)countViolations++;
      }
      const shots=s.events.filter(e=>e.type==='SHOT_RELEASED'),goals=s.events.filter(e=>e.type==='GOAL');
      const owned=s.events.filter(e=>e.type==='PASS_RELEASED'&&getPlayer(s,e.actorId!).team==='HOME');
      trials.push({seed,direction,profilesHash,initial,samples:samples.map(v=>({attackers:v.attackers,defenders:v.defenders,receivers:v.receiverIds.length,width:v.width,passingOptions:v.passingOptions,advantage:v.advantage,shotQuality:v.shotQuality,localAttackers:v.localAttackers,localDefenders:v.localDefenders,openLane:v.openLane})),
        ticks:s.tick,officialSeconds:s.officialClock.timeMs/1000,ended:s.possession.team!=='HOME',censored:s.possession.team==='HOME',countViolations,
        passes:owned.length,shots:shots.length,goals:goals.length,freeThrows:s.events.filter(e=>e.type==='WHISTLE_RESTART'&&e.details.kind==='FREE_THROW').length,
        shotContexts:shots.map(e=>({actorId:e.actorId,kind:e.details.shotKind,details:e.details})),
        terminal:s.events.findLast(e=>(e.type==='POSSESSION_CHANGED'||e.type==='POSSESSION_AWARDED')&&e.details.ended===true)?.details??null,
        finalHash:createHash('sha256').update(JSON.stringify(s)).digest('hex'),rng:s.rng});
    }
    cells.push({state:`${6-homeMissing}v${6-awayMissing}`,homeMissing,awayMissing,n:trials.length,
      metrics:{passes:distribution(trials.map(t=>t.passes)),shots:distribution(trials.map(t=>t.shots)),goals:distribution(trials.map(t=>t.goals)),duration:distribution(trials.map(t=>t.officialSeconds)),censored:trials.filter(t=>t.censored).length},trials});
    console.log(`${variant} ${6-homeMissing}v${6-awayMissing}: ${trials.length} opportunities`);
  }
  for(let i=0;i<32;i++)assert.ok(cells.every(c=>c.trials[i].profilesHash===cells[0].trials[i].profilesHash),'Same profiles for paired contexts');
  const ladder=[];
  for(const context of ['FRONTAL_LEGAL','ORDINARY_HOLD','PUNISHABLE_REAR','CLEAR_HOLD','AIRBORNE_SERIOUS'] as const)for(const warned of [false,true]){
    const s=createContactScenario(context==='CLEAR_HOLD'?'LATE_HOLD':'FRONTAL_CONTACT'),a=getPlayer(s,'H03'),d=getPlayer(s,'A03');
    let technique:'HOLD'|'BENT_ARMS'='BENT_ARMS',approach:'FRONT'|'SIDE'|'BEHIND'='FRONT';
    a.action=null;d.velocity={x:0,y:0};d.warnings=warned?1:0;
    if(context==='ORDINARY_HOLD')technique='HOLD';
    if(context==='PUNISHABLE_REAR'){technique='HOLD';approach='BEHIND';}
    if(context==='CLEAR_HOLD'){technique='HOLD';approach='SIDE';}
    if(context==='AIRBORNE_SERIOUS'){technique='HOLD';a.airborne={takeoff:{...a.position},untilTick:24};}
    const read=readContact(s,a,d,technique,approach,.8);
    judgeFoul(s,a,d,read.severity,read.reason,read.clearChance,'controlled-contact');
    ladder.push({context,warned,read,restart:s.restart?.kind??null,warnings:d.warnings,sanctions:d.sanctions,population:d.population,events:s.events.filter(e=>['FOUL_ASSESSED','WHISTLE_RESTART','WARNING','TWO_MINUTE_SUSPENSION','DISQUALIFICATION'].includes(e.type))});
  }
  const keeper=createMatch();keeper.match=null;keeper.restart=null;keeper.ball.live=true;keeper.officialClock.running=true;getPlayer(keeper,'H01').position={x:.35,y:24};
  const accepted=requestExchange(keeper,'HOME','H01','H10');let invariantError:string|null=null;
  if(accepted)for(let i=0;i<100&&courtPlayers(keeper,'HOME').filter(p=>p.kind==='GOALKEEPER').length<2;i++)advanceCoreMutable(keeper);
  try{assertCore(keeper);}catch(e){invariantError=(e as Error).message;}
  const keeperAdmission={accepted,tick:keeper.tick,court:courtPlayers(keeper,'HOME').map(p=>({id:p.id,kind:p.kind})),invariantError};
  assert.deepEqual(fingerprints(),sourceFingerprints);
  const receipt={complete:true,variant,sourceFingerprints,method:{seeds:32,states:6,directions:'Both, paired per seed',window:'First HOME attack until true opponent ownership or 1200 ticks (60 simulation seconds); unfinished cases censored, ordinary same-team free throws continue.',suspensionHook:'Only existing population/sanctions/suspensionUntilMs fields establish a post-administration two-minute fixture window. All later control/geometry/decisions/execution use canonical advanceCoreMutable. Actual sanction creation/expiry is tested separately.',profileEquality:true,calibration:false},cells,ladder,keeperAdmission};
  writeFileSync(out,JSON.stringify(receipt,null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
