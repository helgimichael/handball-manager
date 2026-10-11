import { evaluate } from './evaluate';
import { distribution, ratio } from './statistics';
import { SCHEMA_VERSION,type Identity,type ReferenceProfile } from './reference';
import type { extract } from './extract';
export type Extracted=ReturnType<typeof extract>;
export function matchReport(actual:Extracted,profiles:readonly ReferenceProfile[],identity:Identity) {
  const comparisons=actual.observations.map(o=>evaluate(o,profiles,identity));
  const keepers=actual.keepers.map(keeper=>{
    const conditional=keeper.shots.filter(s=>s.saved||s.goal).map(shot=>{
      const features={...keeper.features,'shot.pressure':shot.pressure,'shot.quality':shot.quality,'shot.distance':shot.distance,'shot.energy':shot.energy};
      if(shot.capabilities&&typeof shot.capabilities==='object')for(const[k,v]of Object.entries(shot.capabilities))if(typeof v==='number')Object.assign(features,{[`shooter.${k}`]:v});
      if(shot.keeper&&typeof shot.keeper==='object'&&'profile'in shot.keeper&&shot.keeper.profile&&typeof shot.keeper.profile==='object')for(const[k,v]of Object.entries(shot.keeper.profile))if(typeof v==='number')Object.assign(features,{[`keeper.${k}`]:v});
      return evaluate({metric:'savePct',scope:`CATEGORY:${shot.category}`,value:shot.saved?1:0,n:1,features},profiles,identity);
    });
    const covered=conditional.filter(c=>c.expectation!==null&&!c.expectation.missingFeatures.length&&c.status!=='INVALID_EXPECTATION'),coverage=ratio(covered.length,conditional.length);
    return {...keeper,contextExpectation:{status:covered.length===conditional.length&&covered.length?'AVAILABLE':'NO_REFERENCE_OR_PARTIAL_COVERAGE',coverage,shotsFaced:conditional.length,expectedSaves:covered.reduce((n,c)=>n+c.expectation!.value,0),expectedSavePct:covered.length===conditional.length&&covered.length?covered.reduce((n,c)=>n+c.expectation!.value,0)/covered.length:null,
      references:[...new Set(covered.map(c=>`${c.reference!.profileId}@${c.reference!.profileVersion}:${c.reference!.fallback}`))],definition:'Sum conditional reference expectations over attributed on-target shots; incomplete coverage cannot yield a total contextual save rate.'}};
  });
  return {schemaVersion:SCHEMA_VERSION,identity,actual:{...actual,keepers},comparisons,flags:comparisons.filter(c=>['WATCH','OUTLIER','EXTREME'].includes(c.status))};
}
export function aggregate(matches:readonly ReturnType<typeof matchReport>[]) {
  const totals=Object.keys(matches[0]?.actual.totals??{});
  const distributions=Object.fromEntries(totals.map(k=>[k,distribution(matches.map(m=>m.actual.totals[k as keyof Extracted['totals']]))]));
  const groups=[...new Set(matches.flatMap(m=>Object.keys(m.actual.shotGroups)))];
  const shotGroups=Object.fromEntries(groups.map(key=>{
    const rows=matches.map(m=>m.actual.shotGroups[key]).filter(Boolean),attempts=rows.reduce((n,r)=>n+r.attempts,0),goals=rows.reduce((n,r)=>n+r.goals,0),saves=rows.reduce((n,r)=>n+r.saves,0);
    return [key,{matches:rows.length,attempts,goals,saves,shotsFaced:goals+saves,conversion:ratio(goals,attempts),savePct:ratio(saves,goals+saves),matchSavePct:distribution(rows.map(r=>r.savePct))}];
  }));
  const keepers=matches.flatMap((m,index)=>m.actual.keepers.map(k=>({match:index,...k}))).filter(k=>k.id!=='UNATTRIBUTED');
  const highSaves=[...keepers].sort((a,b)=>b.saves-a.saves).slice(0,5),highRate=[...keepers].filter(k=>k.shotsFaced>=10).sort((a,b)=>(b.savePct??0)-(a.savePct??0)).slice(0,5);
  return {matches:matches.length,distributions,shotGroups,teamDistributions:{goals:distribution(matches.flatMap(m=>m.actual.teams.map(t=>t.goals))),possessions:distribution(matches.flatMap(m=>m.actual.teams.map(t=>t.possessions))),shots:distribution(matches.flatMap(m=>m.actual.teams.map(t=>t.attempts))),scorerConcentration:distribution(matches.flatMap(m=>m.actual.teams.map(t=>t.scorerConcentration))),shotConcentration:distribution(matches.flatMap(m=>m.actual.teams.map(t=>t.shotConcentration)))},keeperDistributions:{saves:distribution(keepers.map(k=>k.saves)),shotsFaced:distribution(keepers.map(k=>k.shotsFaced)),savePct:distribution(keepers.map(k=>k.savePct))},goalkeeperInvestigation:{highSaves,highRate},flags:matches.flatMap((m,index)=>m.flags.map(f=>({match:index,...f}))),referenceCoverage:{comparisons:matches.reduce((n,m)=>n+m.comparisons.length,0),noReference:matches.reduce((n,m)=>n+m.comparisons.filter(c=>c.status==='NO_REFERENCE').length,0)}};
}
export function markdown(summary:ReturnType<typeof aggregate>,metadata:Record<string,unknown>) {
  const f=(v:number|null|undefined)=>v==null?'unknown':v.toFixed(3);
  const lines=['# Current engine benchmark', '',`N = ${summary.matches} completed matches. Engine outputs are measured samples, not real-world references.`, '', '```json',JSON.stringify(metadata,null,2),'```','','## Match distributions','','| Metric | N matches | Mean | SD | p05 | Median | p95 | Min | Max |','|---|---:|---:|---:|---:|---:|---:|---:|---:|'];
  for(const[k,d]of Object.entries(summary.distributions))lines.push(`| ${k} | ${d.n} | ${f(d.mean)} | ${f(d.sd)} | ${f(d.p05)} | ${f(d.median)} | ${f(d.p95)} | ${f(d.min)} | ${f(d.max)} |`);
  lines.push('','## Shot context','','Context rows overlap; CATEGORY rows partition shots. Save rate = saves / (saves + goals). Conversion = goals / attempts.','','| Context | N matches | Attempts | On target | Saves | Save rate | Conversion |','|---|---:|---:|---:|---:|---:|---:|');
  for(const[k,g]of Object.entries(summary.shotGroups))lines.push(`| ${k} | ${g.matches} | ${g.attempts} | ${g.shotsFaced} | ${g.saves} | ${f(g.savePct)} | ${f(g.conversion)} |`);
  lines.push('','## Goalkeeper investigation','','Rankings below describe this engine sample. They are not empirical outlier verdicts. Conditional expectations require category references and complete coverage.');
  for(const k of summary.goalkeeperInvestigation.highSaves){lines.push('',`### Match ${k.match}: ${k.id}`,`Saves ${k.saves}; shots faced ${k.shotsFaced}; save rate ${f(k.savePct)}; attempts ${k.attempts}. Wilson interval ${f(k.saveInterval?.low)}–${f(k.saveInterval?.high)}.`,`Mean pressure ${f(k.pressure.mean)}; decision quality ${f(k.quality.mean)}; distance ${f(k.distance.mean)}m.`, `Context expectation: ${k.contextExpectation.status}; coverage ${f(k.contextExpectation.coverage)}.`, `Capabilities: ${JSON.stringify(k.features)}`,'','| Context | Attempts | On target | Saves | Save rate |','|---|---:|---:|---:|---:|');for(const[c,g]of Object.entries(k.byContext))lines.push(`| ${c} | ${g.attempts} | ${g.shotsFaced} | ${g.saves} | ${f(g.savePct)} |`);}
  lines.push('','## Outliers and coverage','',`${summary.flags.length} evidence-backed flags. ${summary.referenceCoverage.noReference}/${summary.referenceCoverage.comparisons} comparisons have NO_REFERENCE. Missing reference is not NORMAL.`, '', '| Match | Scope | Metric | Actual | Expected | Deviation | N | Status |','|---|---|---|---:|---:|---:|---:|---|');
  for(const f of summary.flags)lines.push(`| ${f.match} | ${f.scope} | ${f.metric} | ${f.value} | ${f.expectation?.value} | ${f.deviation} | ${f.n} | ${f.status} |`);
  lines.push('','## How to read this report','','Use N and denominators before comparing rates. Means and percentiles describe this batch. Consult per-match JSON for observed reference, contextual components, uncertainty, provenance and fallback. A keeper with 30 saves requires both on-target volume and category/pressure/quality review. NO_REFERENCE means no justified real-world verdict is possible. Engineering sanity checks are separate in summary.json.');
  return lines.join('\n')+'\n';
}
