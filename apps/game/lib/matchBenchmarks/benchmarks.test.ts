import test from 'node:test';
import assert from 'node:assert/strict';
import {SCHEMA_VERSION,METRICS,ingestReference,lookup,type ReferenceProfile} from './reference';
import {distribution,wilson} from './statistics';
import {evaluate} from './evaluate';
import {summarizeShots,extract} from './extract';
import {matchReport,aggregate} from './report';
import {CalibrationDiagnostics} from '../../scripts/lib/calibrationDiagnostics';
import {createNewCareerState} from '../career/newCareer';
import {startProductionMatch,advanceProductionMatch,resultFromSession} from '../career/productionMatch';
import {buildMatchdayReadyEvent} from '../career/careerEvents';
import {snapshotWorldSquads,snapshotGameplayRatings} from '../gameWorld/serverSnapshot';

const provenance={name:'TEST ONLY synthetic evidence',location:'test fixture (not a populated league)',collectionMethod:'synthetic',extractionVersion:'test/1',timestamp:'2026-10-11T00:00:00Z',confidence:'HIGH' as const,matches:100,events:1000,notes:['Tests only']};
const identity={competition:'test-league',season:'2026-27',country:'SE',level:'senior',category:'men-senior'};
function profile(patch:Partial<ReferenceProfile>={}):ReferenceProfile {return ingestReference({schemaVersion:SCHEMA_VERSION,id:'test',version:'1',kind:'REAL_WORLD_REFERENCE',sport:'handball',country:'SE',competition:'test-league',season:'2026-27',category:'men-senior',notes:[],metrics:[{metric:'savePct',scope:'KEEPER',unit:'ratio',definition:METRICS.savePct.denominator,distribution:{n:100,mean:.3,sd:.05,p05:.2,p95:.4},provenance,transformations:[]}],...patch});}
test('schema and provenance are required; malformed data cannot become evidence',()=>{
  const p=profile();assert.equal(p.schemaVersion,SCHEMA_VERSION);
  for(const change of [{schemaVersion:'wrong'},{sport:'football'},{season:123},{dateRange:{start:'bad',end:'2026-01-01'}}])assert.throws(()=>ingestReference({...p,...change}));
  for(const change of [{provenance:null},{unit:'seconds'},{metric:'invented'},{definition:'saves / attempts'},{distribution:{n:0}},{distribution:{n:100,sd:-1}},{distribution:{n:100,p05:.8,p95:.2}},{distribution:{n:100,mean:1.5}},{transformations:null}])assert.throws(()=>ingestReference({...p,metrics:[{...p.metrics[0],...change}]}));
  assert.throws(()=>ingestReference({...p,metrics:[{...p.metrics[0],provenance:{...provenance,matches:0}}]}));
});
test('exact season, competition, country-level, global and no-reference fallbacks',()=>{
  const exact=profile(),multi=profile({id:'multi',season:undefined}),country=profile({id:'country',competition:undefined,season:undefined,level:'senior'}),global=profile({id:'global',competition:undefined,season:undefined,country:undefined});
  assert.equal(lookup([global,country,multi,exact],identity,'savePct','KEEPER')?.fallback,'EXACT_COMPETITION_SEASON');
  assert.equal(lookup([global,country,multi],identity,'savePct','KEEPER')?.fallback,'COMPETITION_MULTI_SEASON');
  assert.equal(lookup([global,country],identity,'savePct','KEEPER')?.fallback,'COUNTRY_LEVEL');
  assert.equal(lookup([global],identity,'savePct','KEEPER')?.fallback,'GLOBAL');
  assert.equal(lookup([],identity,'savePct','KEEPER'),null);
  assert.equal(lookup([exact],{...identity,season:'2035-36'},'savePct','KEEPER'),null);
  assert.equal(lookup([global],{...identity,category:'women-senior'},'savePct','KEEPER'),null);
  assert.equal(lookup([profile({kind:'ENGINEERING_SANITY_RANGE'})],identity,'savePct','KEEPER'),null);
  assert.throws(()=>lookup([exact,profile({id:'duplicate'})],identity,'savePct','KEEPER'),/Ambiguous/);
});
test('distribution uses sample SD and linearly interpolated percentiles',()=>{
  const d=distribution([1,2,3,4,5,null,NaN]);assert.equal(d.n,5);assert.equal(d.mean,3);assert.equal(d.median,3);assert.equal(d.p05,1.2);assert.equal(d.p95,4.8);assert.equal(d.p25,2);assert.equal(d.p75,4);assert.equal(d.sd,Math.sqrt(2.5));assert.equal(distribution([]).mean,null);assert.equal(distribution([2]).sd,null);
});
test('small sample, zero scale and absent references never produce confident z-scores',()=>{
  const o={metric:'savePct',scope:'KEEPER',value:.8,n:3};assert.equal(evaluate(o,[profile()],identity).status,'INSUFFICIENT_SAMPLE');assert.equal(evaluate(o,[],identity).status,'NO_REFERENCE');assert.equal(evaluate({...o,value:null},[],identity).status,'UNSUPPORTED');
  const p=profile();p.metrics[0].distribution={n:2,mean:.3,sd:.05};assert.equal(evaluate({...o,n:50},[p],identity).status,'INSUFFICIENT_SAMPLE');p.metrics[0].distribution={n:100,mean:.3,sd:0};assert.equal(evaluate({...o,n:50},[p],identity).status,'INSUFFICIENT_REFERENCE');
});
test('expectation separates empirical baseline, team, player and match context',()=>{
  const p=profile();p.metrics[0].adjustments=[{layer:'TEAM',feature:'team.defence',centre:.5,coefficient:.1,provenance},{layer:'PLAYER',feature:'keeper.reaction',centre:.5,coefficient:.2,provenance},{layer:'MATCH_CONTEXT',feature:'shot.pressure',centre:0,coefficient:.1,provenance}];
  const o={metric:'savePct',scope:'KEEPER',value:.4,n:40,features:{'team.defence':.6,'keeper.reaction':.7,'shot.pressure':.3}},r=evaluate(o,[p],identity);
  assert.ok(Math.abs(r.expectation!.value-.38)<1e-10);assert.equal(r.expectation!.components.length,3);assert.equal(r.reference!.row.distribution.mean,.3);assert.equal(r.status,'NORMAL');
  assert.equal(evaluate({...o,features:{}},[p],identity).status,'INSUFFICIENT_SAMPLE');
  assert.throws(()=>ingestReference({...p,metrics:[{...p.metrics[0],adjustments:[{...p.metrics[0].adjustments![0],feature:'player.CA'}]}]}));
});
test('outliers use evidence scale; percentile-only data can classify without z',()=>{
  for(const [value,status]of [[.3,'NORMAL'],[.41,'WATCH'],[.46,'OUTLIER'],[.51,'EXTREME']]as const)assert.equal(evaluate({metric:'savePct',scope:'KEEPER',value,n:50},[profile()],identity).status,status);
  const p=profile();delete p.metrics[0].distribution.sd;const r=evaluate({metric:'savePct',scope:'KEEPER',value:.6,n:50},[p],identity);assert.equal(r.status,'OUTLIER');assert.equal(r.z,null);
});
test('Wilson uncertainty handles zero shots and small samples',()=>{assert.equal(wilson(0,0),null);assert.ok(wilson(1,3)!.high-wilson(1,3)!.low>.5);assert.ok(wilson(30,50)!.low<.6);});
test('canonical observation, shot/keeper/position extraction, deterministic report and batch aggregation',()=>{
  let career=createNewCareerState('benchmark-test-v1','swe2-tumba',snapshotWorldSquads('swe-2'),undefined,snapshotGameplayRatings('swe-2'));
  const fixture=career.fixtures.find(f=>f.homeClubId===career.playerClubId||f.awayClubId===career.playerClubId)!;
  career={...career,gameDate:fixture.date,careerEvents:[buildMatchdayReadyEvent(fixture.id,fixture.date)]};career=startProductionMatch(career,fixture.id);
  const initial=structuredClone(career),observer=new CalibrationDiagnostics();const observed=advanceProductionMatch(career,5000,false,observer.observe),plain=advanceProductionMatch(initial,5000,false);
  assert.deepEqual(observed.productionMatch,plain.productionMatch,'exact session including events/RNG/frames/statistics');
  const session=observed.productionMatch!,before=JSON.stringify(session),d=observer.report(session.core),actual=extract(session,d,resultFromSession(session));
  assert.equal(JSON.stringify(session),before);assert.ok(d.shots.length>0);assert.equal(Object.entries(actual.shotGroups).filter(([k])=>k.startsWith('CATEGORY:')).reduce((n,[,g])=>n+g.attempts,0),d.shots.length);
  assert.equal(actual.keepers.reduce((n,k)=>n+k.saves,0),actual.totals.saves);assert.equal(actual.keepers.reduce((n,k)=>n+k.shotsFaced,0),actual.totals.shotsFaced);assert.ok(actual.players.every(p=>['MV','V6','V9','M9','M6','H9','H6'].includes(p.position)));
  assert.equal(actual.teams.reduce((n,t)=>n+t.attempts,0),d.shots.length);assert.ok(actual.teams[0].features['context.home']===1);
  const a=matchReport(actual,[],identity),b=matchReport(structuredClone(actual),[],identity);assert.deepEqual(a,b);assert.equal(JSON.stringify(session),before);assert.equal(a.schemaVersion,SCHEMA_VERSION);assert.ok(a.actual.keepers.every(k=>k.contextExpectation.expectedSavePct===null));
  const sum=aggregate([a,b]);assert.equal(sum.matches,2);assert.equal(sum.distributions.shots.n,2);assert.equal(sum.distributions.shots.mean,d.shots.length);assert.equal(summarizeShots([]).savePct,null);
  const refs=profile({metrics:[{...profile().metrics[0],scope:`CATEGORY:${d.shots[0].kind}`}]}),partial=matchReport(actual,[refs],identity);assert.ok(partial.actual.keepers.every(k=>k.contextExpectation.coverage!==null));
});
