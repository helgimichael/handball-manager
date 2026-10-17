/** Full production replay, passive observation, reduced-unit JSON and archive proof. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createNewCareerState} from '../lib/career/newCareer';
import {buildMatchdayReadyEvent} from '../lib/career/careerEvents';
import {startProductionMatch,advanceProductionMatch,resultFromSession,finalizeProductionMatch,archiveFrames,observedFrame} from '../lib/career/productionMatch';
import {archivedMatchModel} from '../lib/matchCenter/model';
import {MatchStructureObserver,manpowerSnapshot,recordedStructure} from './lib/matchStructureDiagnostics';
import {possessionEconomy} from './lib/possessionEconomy';
import type {CoreState,CoreEvent} from '@handball-manager/handball-engine/src/v2/core/state';

const root=resolve('../..'),args=process.argv.slice(2),league=args.includes('--league')?args[args.indexOf('--league')+1]:'hbl';
assert.ok(['hbl','allsv'].includes(league));
const out=join(root,'docs/match-structure-manpower-v1'),targetFile=join(out,`LIVE-${league.toUpperCase()}.json`);assert.ok(!existsSync(targetFile),'Retain complete proof');
const retained=join(root,'docs/player-attribute-integration-v1/final',league),read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const baseline=read(join(retained,'match-000.json')),recipe=read(join(retained,'recipes.json'))[0],inputs=read(join(retained,'inputs.json'));
const oldCore=JSON.parse(gunzipSync(readFileSync(join(retained,'core-000.json.gz'))).toString('utf8'))as CoreState;assert.equal(hash(oldCore),baseline.coreHash);
const expected=read(join(out,'raw/after',league,'match-000.json'));
let target:CoreEvent|null=null;
const paths=[...readdirSync(join(root,'packages/handball-engine/src/v2/core')).filter(n=>n.endsWith('.ts')&&!n.endsWith('.test.ts')).map(n=>'packages/handball-engine/src/v2/core/'+n),'apps/game/lib/career/productionMatch.ts','apps/game/scripts/lib/matchStructureDiagnostics.ts','apps/game/scripts/prove-match-structure-truth.ts'];
const fingerprint=()=>Object.fromEntries(paths.map(p=>[p,createHash('sha256').update(readFileSync(join(root,p))).digest('hex')]));const sources=fingerprint();
let initial=createNewCareerState(recipe.saveSeed,recipe.managerClubId,structuredClone(inputs.worldSquads),undefined,structuredClone(inputs.gameplayRatings));
const fixture=initial.fixtures.find(f=>recipe.fixtureId?f.id===recipe.fixtureId:f.type==='LEAGUE'&&(f.homeClubId===recipe.managerClubId||f.awayClubId===recipe.managerClubId))!;assert.ok(fixture);
initial={...initial,gameDate:fixture.date,careerEvents:[buildMatchdayReadyEvent(fixture.id,fixture.date)]};initial=startProductionMatch(initial,fixture.id);
assert.equal(hash(initial.productionMatch),baseline.initialHash);
type Career=typeof initial;
const checkpointPath=join(out,'raw',`${league}-checkpoint.json.gz`),timings:{kind:string;ms:number;ticks:number}[]=[];
let checkpoint:ReturnType<typeof manpowerSnapshot>|null=null,observations:ReturnType<MatchStructureObserver['report']>|null=null;
function simulate(career:Career,observed:boolean,kind:string){
  const session=career.productionMatch!,observer=observed?new MatchStructureObserver(session.core):null,started=performance.now();let calls=0;
  while(career.productionMatch!.core.status==='RUNNING'&&calls++<40){
    const tick=career.productionMatch!.core.tick,budget=target&&tick<target.tick?Math.min(10000,target.tick-tick):10000;
    career=advanceProductionMatch(career,budget,false,observer?(s,e)=>observer.observe(s,e):undefined,observed&&!checkpoint?(s,events)=>{
      const whistle=events.find(e=>e.type==='WHISTLE_RESTART'&&e.details.kind==='FREE_THROW');
      if(whistle&&s.players.some(p=>(p.population==='SUSPENDED'||p.population==='DISQUALIFIED')&&p.suspensionUntilMs!==null&&p.suspensionUntilMs>s.officialClock.timeMs)){
        target=structuredClone(whistle);return true;
      }return false;
    }:undefined);
    const core=career.productionMatch!.core;
    if(observed&&target&&core.tick===target.tick&&!checkpoint){
      assert.deepEqual(core.events.find(e=>e.id===target!.id),target);assert.equal(core.restart?.kind,'FREE_THROW');assert.notEqual(core.restart?.phase,'COMPLETED');
      checkpoint=manpowerSnapshot(core);assert.notEqual(checkpoint.state,'6v6');
      assert.ok([...checkpoint.sides.HOME.suspended,...checkpoint.sides.AWAY.suspended].some(p=>p.remainingMs>0));
      const saved=JSON.stringify(career);assert.equal(hash(JSON.parse(saved)),hash(career));writeFileSync(checkpointPath,gzipSync(saved));
    }
  }
  const core=career.productionMatch!.core;assert.equal(core.match?.phase,'FULLTIME');
  timings.push({kind,ms:performance.now()-started,ticks:core.tick-session.core.tick});
  if(observer){const before=hash(career.productionMatch);observations=observer.report(core);assert.equal(hash(career.productionMatch),before);assert.equal(observations.violations.length,0);
    const readback=recordedStructure(core);assert.ok(readback.finalPopulationExact);
    for(const [k,v]of Object.entries(observations.byState)){assert.equal(v.officialMs,readback.byState[k]?.officialMs??0,k+' official exposure');assert.equal(v.simulationMs,readback.byState[k]?.simulationMs??0,k+' simulation exposure');}
    assert.equal(Object.values(observations.byState).reduce((n,v)=>n+v.officialMs,0),core.officialClock.timeMs);
    for(const boundary of observations.boundaries){const row=readback.boundaries.findLast(b=>b.tick<=boundary.tick)!;for(const team of ['HOME','AWAY']as const)assert.deepEqual(row.court[team].slice().sort(),boundary.sides[team].courtIds.slice().sort());}
  }
  return career;
}
let current:Career|null=simulate(structuredClone(initial),true,'observed');const checkpointFacts=checkpoint as unknown as ReturnType<typeof manpowerSnapshot>,targetEvent=target as unknown as CoreEvent;assert.ok(checkpointFacts);assert.ok(targetEvent);
const final=current.productionMatch!,sessionHash=hash(final),coreHash=hash(final.core),result=resultFromSession(final),resultHash=hash(result);
assert.equal(coreHash,expected.coreHash,'Exact fixed-source plain cohort core');
assert.equal(sessionHash,expected.sessionHash);assert.equal(resultHash,expected.resultHash);
const economy=possessionEconomy(final.core),beforeCommit=hash(final),completed=finalizeProductionMatch(current),archive=completed.matchArchives![fixture.id],archiveHash=hash(archive);
assert.equal(hash(final),beforeCommit);assert.equal(finalizeProductionMatch(completed),completed);
const model=archivedMatchModel(archive),loaded=archivedMatchModel(JSON.parse(JSON.stringify(archive)));
assert.deepEqual(model,loaded);assert.equal(model.players.reduce((n,p)=>n+p.goals,0),final.core.score.HOME+final.core.score.AWAY);
for(const team of ['HOME','AWAY']as const){assert.equal(model.freeThrows?.counts?.[team],economy.teams[team].freeThrows);assert.equal((team==='HOME'?result.homeStats:result.awayStats).turnovers,economy.teams[team].canonicalUiBallLosses);}
const frame=final.frames.find(f=>f[0]===targetEvent.tick)!;assert.ok(frame,'Actual live frame retained at suspension/restart boundary');
const frameIds=frame.filter((_,i)=>i>=7&&(i-7)%3===0).map(i=>final.people[i].id).sort();
assert.deepEqual(frameIds,[...checkpointFacts.sides.HOME.courtIds,...checkpointFacts.sides.AWAY.courtIds].sort());
const stored=archiveFrames(archive).find(f=>f[0]===targetEvent.tick)!;assert.deepEqual(stored,frame);
const prefixCount=final.core.events.filter(e=>e.tick<=targetEvent.tick).length,suffixHash=hash(final.core.events.slice(prefixCount));
const continued=final.core.events.find(e=>e.tick>targetEvent.tick&&e.type==='RESTART_COMPLETED'&&e.details.kind==='FREE_THROW')!;assert.ok(continued);assert.equal(continued.possessionId,targetEvent.possessionId);
writeFileSync(join(out,'raw',`${league}-live-diagnostics.json`),JSON.stringify(observations));
// Keep later full sessions sequential; do not deliberately retain three copies.
current=null;
let plain:Career|null=simulate(structuredClone(initial),false,'plain');assert.equal(hash(plain.productionMatch),sessionHash);assert.equal(hash(resultFromSession(plain.productionMatch!)),resultHash);assert.equal(hash(finalizeProductionMatch(plain).matchArchives![fixture.id]),archiveHash);plain=null;
const saved=JSON.parse(gunzipSync(readFileSync(checkpointPath)).toString('utf8'))as Career;assert.deepEqual(manpowerSnapshot(saved.productionMatch!.core),checkpoint);
const resumed=simulate(saved,false,'resumed');assert.equal(hash(resumed.productionMatch),sessionHash);assert.equal(hash(resultFromSession(resumed.productionMatch!)),resultHash);assert.equal(hash(finalizeProductionMatch(resumed).matchArchives![fixture.id]),archiveHash);
assert.equal(hash(resumed.productionMatch!.core.events.slice(prefixCount)),suffixHash);assert.deepEqual(fingerprint(),sources);
const diagnostic=observations as unknown as ReturnType<MatchStructureObserver['report']>;
writeFileSync(targetFile,JSON.stringify({complete:true,league,recipe,inputHash:hash(inputs),sourceFingerprints:sources,coreHash,sessionHash,resultHash,archiveHash,beforeCoreHash:baseline.coreHash,unchangedValidTrajectory:coreHash===baseline.coreHash,observerNonMutation:true,reportNonMutation:true,exactJSONResume:true,exactArchive:true,exactlyOnceCommit:true,framePopulationParity:true,eventPopulationReconstructionParity:true,checkpoint,checkpointEvent:targetEvent,continuation:continued,suffixHash,
  byState:diagnostic.byState,time:diagnostic.time,violationCount:diagnostic.violations.length,environmentSamples:diagnostic.environments.length,environmentsByState:Object.fromEntries(Object.keys(diagnostic.byState).map(k=>{const rows=diagnostic.environments.filter(e=>e.state===k);return[k,{n:rows.length,meanReceivers:rows.length?rows.reduce((n,r)=>n+r.receivers,0)/rows.length:null,meanWidth:rows.length?rows.reduce((n,r)=>n+r.width,0)/rows.length:null}];})),foulIntegrity:diagnostic.fouls.integrity,economyIntegrity:economy.integrity,timings,performanceScope:'One observed/plain replay with matching chunk boundaries and checkpoint serialization in the observed run. Descriptive opt-in overhead, not a statistically controlled benchmark; disabled production never imports diagnostics.',nothingPushed:true},null,2)+'\n');
console.log(JSON.stringify({complete:true,league,checkpointState:checkpointFacts.state,checkpointTick:targetEvent.tick,sessionHash,archiveHash,timings}));
