/** Reuse completed full matches; never simulates or rewrites prior evidence. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import type {CoreState} from '@handball-manager/handball-engine/src/v2/core/state';
import {foulStructure,recordedStructure} from './lib/matchStructureDiagnostics';
import {distribution,ratio} from '../lib/matchBenchmarks/statistics';
import {AttackCycleDiagnostics} from './lib/attackCycleDiagnostics';

const root=resolve('../..'),args=process.argv.slice(2),league=args.includes('--league')?args[args.indexOf('--league')+1]:'hbl';
assert.ok(['hbl','allsv'].includes(league));
const dir=join(root,'docs/match-structure-manpower-v1'),out=join(dir,`RETAINED-${league.toUpperCase()}.json`);
assert.ok(!existsSync(out),'Preserve complete audit receipts');
const sourceDir=join(root,'docs/player-attribute-integration-v1/final',league),read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const original=read(join(root,'docs/player-attribute-integration-v1/LEAGUE-REGRESSION.json'));
type Structure=ReturnType<typeof recordedStructure>;
const matches: {index:number;fixture:unknown;score:CoreState['score'];coreHash:string;fouls:ReturnType<typeof foulStructure>;totals:Structure['totals'];byState:Structure['byState'];time:Structure['time'];restarts:Structure['restarts'];threatCycles:unknown;integrity:Structure['integrity']&{populationExact:boolean}}[]=[];
for(let index=0;index<40;index++){
  const id=String(index).padStart(3,'0'),raw=gunzipSync(readFileSync(join(sourceDir,`core-${id}.json.gz`))).toString('utf8'),core=JSON.parse(raw)as CoreState;
  const retained=read(join(sourceDir,`match-${id}.json`)),coreHash=createHash('sha256').update(JSON.stringify(core)).digest('hex');
  assert.equal(coreHash,retained.coreHash);assert.equal(core.match?.phase,'FULLTIME');
  const f=foulStructure(core),p=recordedStructure(core);
  assert.ok(p.finalPopulationExact,'Population event reading reproduces final flags');
  assert.equal(p.totals.officialMs,core.officialClock.timeMs);assert.equal(p.totals.simulationMs,core.timeMs);
  assert.equal(p.totals.possessions,Object.values(retained.teams as Record<string,{possessions:number}>).reduce((n,t)=>n+t.possessions,0));
  assert.equal(p.integrity.duplicateEventIds,0);assert.equal(p.integrity.groupsWithMultipleTransfers.length,0);assert.equal(p.integrity.unresolvedPossessions.length,0);
  assert.equal(f.integrity.duplicateContactIds,0);assert.equal(f.integrity.duplicateFoulIds,0);assert.equal(f.integrity.multiplePenaltiesForFoul.length,0);assert.equal(f.integrity.unlinkedPenalties.length,0);
  // Existing threat-cycle reader is retained as a declared proxy. With a final
  // core, actor intent is not historical: only event-reason recycle cases are
  // reliable. Do not claim its fallback intent classifications as exact.
  const cycles=new AttackCycleDiagnostics();cycles.observe(core,core.events);const cycleReport=cycles.report(core);
  const match={index,fixture:retained.fixture,score:core.score,coreHash,fouls:f,structure:p,threatCycles:{...cycleReport.cycles,method:'Existing event-separated motor-threat/stop/recycle proxy. Offline actor-intent fallback is not event-time history; not a canonical possession definition.'}};
  writeFileSync(join(dir,'raw',`${league}-${id}.json`),JSON.stringify(match));
  matches.push({index,fixture:retained.fixture,score:core.score,coreHash,fouls:f,totals:p.totals,byState:p.byState,time:p.time,restarts:p.restarts,threatCycles:match.threatCycles,integrity:{populationExact:p.finalPopulationExact,...p.integrity}});
  console.log(`${league} retained ${index+1}/40: ${p.totals.possessions} played possessions; ${f.twoMinutes}+${f.disqualifications} reductions`);
}
const sum=(a:number[])=>a.reduce((n,v)=>n+v,0),foulKeys=['opportunities','contacts','missed','legalContacts','assessedFouls','ordinaryFouls','freeThrows','sevenMetres','twoMinutes','disqualifications','personalReductions','sevenAndSuspension','warnings','offensiveFouls']as const;
const pooled=Object.fromEntries(foulKeys.map(k=>[k,sum(matches.map(m=>m.fouls[k]))])) as Record<typeof foulKeys[number],number>;
const playerTeams=matches.flatMap(m=>(['HOME','AWAY']as const).map(team=>({index:m.index,team,...m.fouls.perTeam[team],causes:m.fouls.rows.filter(r=>r.team===team&&r.penaltyIds.length)})));
const tails=Object.fromEntries([8,10,12].map(n=>[String(n),{twoMinuteTeamMatches:playerTeams.filter(t=>t.twoMinutes>=n).length,allReductionTeamMatches:playerTeams.filter(t=>t.penalties>=n).length}]));
const possessions=sum(matches.map(m=>m.totals.possessions)),episodes=matches.flatMap(m=>read(join(dir,'raw',`${league}-${String(m.index).padStart(3,'0')}.json`)).structure.episodes) as ReturnType<typeof recordedStructure>['episodes'];
const byState:Record<string,Record<string,number>>={},clock:Record<string,{officialMs:number;simulationMs:number}>={};
for(const m of matches){for(const[k,v]of Object.entries(m.byState)){const r=byState[k]??={};for(const [metric,value]of Object.entries(v))if(typeof value==='number'&&metric!=='fieldConversion')r[metric]=(r[metric]??0)+value;}for(const[k,v]of Object.entries(m.time)){const r=clock[k]??={officialMs:0,simulationMs:0};r.officialMs+=v.officialMs;r.simulationMs+=v.simulationMs;}}
const perTeamPossessions=Object.fromEntries((['HOME','AWAY']as const).map(t=>[t,distribution(matches.map(m=>m.totals.possessionsByTeam[t]))]));
const result={complete:true,league,n:40,teamMatches:80,sourceCheckpoint:'ed8574d',sourceScope:'Previously completed actual production cores, exact hashes checked. No new simulations and no claim that the unavailable Human QA seed was reproduced.',pooled,perMatch:Object.fromEntries(foulKeys.map(k=>[k,distribution(matches.map(m=>m.fouls[k]))])),rates:{legalPerContact:ratio(pooled.legalContacts,pooled.contacts),foulPerContact:ratio(pooled.assessedFouls,pooled.contacts),freeThrowPerContact:ratio(pooled.freeThrows,pooled.contacts),sevenPerContact:ratio(pooled.sevenMetres,pooled.contacts),twoMinutePerContact:ratio(pooled.twoMinutes,pooled.contacts),twoMinutePerFoul:ratio(pooled.twoMinutes,pooled.assessedFouls),sevenPerFoul:ratio(pooled.sevenMetres,pooled.assessedFouls),sevenAndSuspensionPerFoul:ratio(pooled.sevenAndSuspension,pooled.assessedFouls)},tails,extremeTeamMatches:playerTeams.filter(t=>t.penalties>=8).sort((a,b)=>b.penalties-a.penalties),maximumTeamMatch:playerTeams.reduce((a,b)=>a.penalties>b.penalties?a:b),
  possession:{matches:distribution(matches.map(m=>m.totals.possessions)),perTeam:perTeamPossessions,perMinute:ratio(possessions,sum(matches.map(m=>m.totals.officialMs))/60000),duration:distribution(episodes.map(e=>e.durationSeconds)),transitionBearing:{n:episodes.filter(e=>e.transitioned).length,duration:distribution(episodes.filter(e=>e.transitioned).map(e=>e.durationSeconds))},settledBearing:{n:episodes.filter(e=>e.settled).length,duration:distribution(episodes.filter(e=>e.settled).map(e=>e.durationSeconds))},passesPerPossession:ratio(sum(episodes.map(e=>e.passes)),possessions),freeThrowsPerPossession:ratio(sum(episodes.map(e=>e.freeThrows)),possessions),shotsPerPossession:ratio(sum(episodes.map(e=>e.shots)),possessions),lossesPerPossession:ratio(episodes.filter(e=>e.loss).length,possessions),retainedRebounds:sum(episodes.map(e=>e.retainedRebounds))},byState,clock,
  comparisonToPreAttributeIntegration:{before:original.leagues[league].before.perMatch,after:original.leagues[league].after.perMatch,scope:'Existing matched league regression; attribute integration did not increase average suspension counts. This comparison does not isolate a causal parameter.'},matches};
writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({complete:true,league,contacts:pooled.contacts,penalties:pooled.personalReductions,tails,max:result.maximumTeamMatch.penalties,possessionsPerMatch:result.possession.matches.mean}));
