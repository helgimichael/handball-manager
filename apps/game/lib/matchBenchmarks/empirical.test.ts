import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{deriveProfile,validateDataset,digest,resolveTeam,type EmpiricalDataset}from'./empirical';
import{ingestReference,lookup}from'./reference';import{compareDistributions,empiricalPercentile}from'./empiricalComparison';import{distribution}from'./statistics';import{evaluate}from'./evaluate';
const actual=JSON.parse(readFileSync(new URL('../../../../data/empirical-handball/normalized/swe-2-2025-26.json',import.meta.url),'utf8'))as EmpiricalDataset;
const sample=()=>structuredClone({...actual,matches:actual.matches.slice(0,2)});
test('official normalized records validate with required provenance; malformed identities and source hashes reject',()=>{
  assert.equal(validateDataset(actual).matches.length,182);
  const bad=sample();bad.sources=[];assert.throws(()=>validateDataset(bad),/provenance/);
  const hash=sample();hash.sources[0].sha256='invented';assert.throws(()=>validateDataset(hash),/provenance/);
  const season=sample();season.matches[0].season='2026-27';assert.throws(()=>validateDataset(season),/identity/);
});
test('duplicate source match and player-match identities are detected',()=>{
  const bad=sample();bad.matches.push(structuredClone(bad.matches[0]));assert.throws(()=>validateDataset(bad),/Duplicate match/);
  const players=sample();players.matches[0].protocol!.players.push(structuredClone(players.matches[0].protocol!.players[0]));assert.throws(()=>validateDataset(players),/Duplicate player/);
});
test('team mapping preserves diacritics, documents explicit aliases and flags ambiguity',()=>{
  const clubs=[{id:'one',name:'Önnereds HK',competitionId:'test'},{id:'two',name:'Önnereds HK',competitionId:'other'}];
  assert.equal(resolveTeam('Önnereds HK','test',clubs).canonicalClubId,'one');assert.equal(resolveTeam('Onnereds HK','test',clubs).status,'UNRESOLVED');assert.equal(resolveTeam('Önnereds HK','unknown',clubs).status,'AMBIGUOUS');assert.equal(resolveTeam('Sponsor HK','test',clubs,{'SPONSOR HK':'Önnereds HK'}).method,'EXPLICIT_DOCUMENTED_ALIAS');
});
test('goal sums, penalties, negative/impossible statistics and keeper denominators are checked',()=>{
  const goals=sample();goals.matches[0].protocol!.players[0].goals++;assert.throws(()=>validateDataset(goals),/goal sum/);
  const seven=sample();seven.matches[0].protocol!.teamStats.home.sevenMetreGoals=seven.matches[0].protocol!.teamStats.home.sevenMetres+1;assert.throws(()=>validateDataset(seven),/rules/);
  const negative=sample();negative.matches[0].protocol!.players[0].suspensions=-1;assert.throws(()=>validateDataset(negative),/Negative/);
  const keeper=sample();Object.assign(keeper.matches[0].protocol!.players[0],{saves:3,shotsFaced:2,goalsConceded:0,denominatorValid:true});assert.throws(()=>validateDataset(keeper),/fraction/);
  const denominator=sample();Object.assign(denominator.matches[0].protocol!.players[0],{saves:2,shotsFaced:4,goalsConceded:1,denominatorValid:true});assert.throws(()=>validateDataset(denominator),/denominator/);
});
test('distribution, coverage, evidence tier and source provenance survive derivation',()=>{
  const d=deriveProfile(actual),goals=d.profile.metrics.find(m=>m.metric==='goals')!;
  assert.equal(goals.distribution.n,182);assert.equal(goals.distribution.mean,11214/182);assert.equal(goals.evidence!.coverage,1);assert.equal(goals.evidence!.tier,'D');assert.equal(goals.provenance.normalizedHash,d.normalizedHash);assert.equal(goals.provenance.sourceManifestHash,digest(actual.sources));
  const thin=deriveProfile(sample()).profile;assert.equal(thin.evidence!.coverage,2/182);assert.equal(thin.metrics[0].provenance.confidence,'LOW');assert.equal(evaluate({metric:'goals',scope:'MATCH',value:80,n:1},[thin],{competition:'swe-2',season:'2025-26',country:'SE',category:'men-senior'}).status,'INSUFFICIENT_SAMPLE');
  const q=distribution([10,20,30,40]);assert.equal(q.p25,17.5);assert.equal(q.p95,38.5);
});
test('complete and partial seasons stay separate; fallback and missing categories remain explicit',()=>{
  const exact=deriveProfile(actual).profile,identity={competition:'swe-2',season:'2025-26',country:'SE',category:'men-senior'};
  assert.equal(lookup([exact],identity,'goals')!.fallback,'EXACT_COMPETITION_SEASON');assert.equal(lookup([exact],{...identity,season:'2026-27'},'goals'),null);assert.equal(lookup([exact],{...identity,category:'women-senior'},'goals'),null);
  const p=sample();p.seasonStatus='PARTIAL_SEASON';const partial=deriveProfile(p).profile;assert.equal(ingestReference(partial).evidence!.seasonStatus,'PARTIAL_SEASON');
  const proxy=ingestReference({...exact,id:'test proxy',competition:undefined,season:undefined,country:undefined,notes:['TEST ONLY proxy']});assert.equal(lookup([proxy],{...identity,season:'2035-36'},'goals')!.fallback,'GLOBAL');
  assert.throws(()=>ingestReference({...exact,evidence:{...exact.evidence,coverage:.5}}),/coverage/);
});
test('empirical comparison is deterministic and non-mutating, including honest gaps and small samples',()=>{
  const profile=deriveProfile(actual).profile,identity={competition:'swe-2',season:'2025-26',country:'SE',category:'men-senior'},state={score:{HOME:30,AWAY:31},rng:{draws:3},events:[{id:'unchanged'}],frames:[[1,2,3]],statistics:{goals:61}},before=digest(state),refs=digest(profile);
  const values=[...Array(20)].map((_,i)=>40+i),d=distribution(values),a=compareDistributions('goals','MATCH',d,[profile],identity,20,values),b=compareDistributions('goals','MATCH',d,[profile],identity,20,values);assert.deepEqual(a,b);assert.equal(digest(state),before);assert.equal(digest(profile),refs);assert.equal(a.comparison.reference!.fallback,'EXACT_COMPETITION_SEASON');
  assert.equal(compareDistributions('possessions','MATCH',d,[profile],identity,20).status,'NO REFERENCE');assert.equal(compareDistributions('goals','MATCH',distribution([40,41]),[profile],identity,2).status,'UNRESOLVED');
  assert.deepEqual(empiricalPercentile(4,[1,2,3]),{n:3,percentile:1,aboveMaximum:true,ties:0,definition:'empirical CDF count(reference <= actual) / N; above maximum is not proof of impossibility'});
});
