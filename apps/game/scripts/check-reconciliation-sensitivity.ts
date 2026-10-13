/** Controlled developer experiments; no experiments or reference imports enter gameplay. */
import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{resolve,join}from'node:path';
import{createNewCareerState}from'../lib/career/newCareer';import{buildMatchdayReadyEvent}from'../lib/career/careerEvents';
import{startProductionMatch,advanceProductionMatch,commandProductionMatch,resultFromSession}from'../lib/career/productionMatch';
import{CalibrationDiagnostics}from'./lib/calibrationDiagnostics';import{extract}from'../lib/matchBenchmarks/extract';
import{digest}from'../lib/matchBenchmarks/empirical';
const root=resolve('../..'),argv=process.argv.slice(2),outputAt=argv.indexOf('--out'),out=outputAt<0?join(root,'docs/post-intelligence-reconciliation/verification/tactics'):resolve(argv[outputAt+1]);mkdirSync(out,{recursive:true});
const inputs=JSON.parse(readFileSync(join(root,'docs/post-intelligence-reconciliation/final/hbl/inputs.json'),'utf8'));
const specs: {name:string;family?:string;level?:number}[]=[{name:'BALANCED'},...['QUICK','WIDTH','COMBINATION','DIRECT','5:1'].map(name=>({name})),...['SHOOTING','KEEPER','CREATION','SPEED','M6','DEFENDING'].flatMap(family=>[.25,.9].map(level=>({name:`${family}:${level}`,family,level})))];
const rows:Record<string,unknown>[]=[];
// Reuse the two already completed identical BALANCED recipes.
for(const index of [0,1]){
 const r=JSON.parse(readFileSync(join(root,'docs/post-intelligence-reconciliation/final/hbl/chunk-000',`match-${String(index).padStart(3,'0')}.json`),'utf8'));
 const team=r.metadata.fixture.homeClubId===r.metadata.recipe.managerClubId?'HOME':'AWAY';
 rows.push({name:'BALANCED',index,reused:true,fixture:r.metadata.fixture.id,saveSeed:r.metadata.recipe.saveSeed,team,score:r.actual.context.score,totals:r.actual.totals,own:r.actual.teams.find((t:{team:string})=>t.team===team),resultHash:r.metadata.resultHash,sessionHash:r.metadata.truthHash});
}

for(const spec of specs.filter(s=>s.name!=='BALANCED'&&(!argv.includes('--tactics-only')||!s.family)))for(const index of [0,1]){
 let career=createNewCareerState(`match-realism-v2-canonical-2026:${index}`,inputs.clubs[index],structuredClone(inputs.worldSquads),undefined,structuredClone(inputs.gameplayRatings));
 const fixture=career.fixtures.find(f=>f.type==='LEAGUE'&&(f.homeClubId===career.playerClubId||f.awayClubId===career.playerClubId))!;
 career={...career,gameDate:fixture.date,careerEvents:[buildMatchdayReadyEvent(fixture.id,fixture.date)]};career=startProductionMatch(career,fixture.id);
 const team=fixture.homeClubId===career.playerClubId?'HOME':'AWAY';
 if(['QUICK','WIDTH','COMBINATION','DIRECT','5:1'].includes(spec.name))career=commandProductionMatch(career,{kind:'TACTICS',team,patch:spec.name==='QUICK'?{tempo:'QUICK'}:spec.name==='5:1'?{defence:'5:1'}:{attackIdentity:spec.name as'WIDTH'|'COMBINATION'|'DIRECT'}});
 const treatment=spec.family?spec:null,players=career.productionMatch!.core.players.filter(p=>p.team===team&&p.population==='COURT');
 const changed:string[]=[];
 if(treatment){const value=treatment.level!;for(const p of players){
  const role=treatment.family==='KEEPER'?'GK':treatment.family==='SPEED'?'LW':treatment.family==='M6'?'P':'CB';if(treatment.family==='DEFENDING'?p.kind!=='FIELD_PLAYER':p.role!==role)continue;
  changed.push(p.id);const profile=p.profile;
  if(treatment.family==='SHOOTING')p.profile={...profile,shotPower:value,shotPlacement:value,finishing:value,composure:value};
  if(treatment.family==='KEEPER')p.profile={...profile,reaction:.32-.18*value,topSpeed:3.2+1.6*value,acceleration:5+4*value,keeper:Object.fromEntries(Object.keys(profile.keeper!).map(k=>[k,value]))as typeof profile.keeper};
  if(treatment.family==='CREATION')p.profile={...profile,passing:value,decision:value,anticipation:value,composure:value};
  if(treatment.family==='SPEED')p.profile={...profile,topSpeed:4.4+3*value,acceleration:3.6+4*value};
  if(treatment.family==='M6')p.profile={...profile,pivotPlay:value,screening:value,strength:value,balance:value,offBall:value};
  if(treatment.family==='DEFENDING')p.profile={...profile,defPositioning:value,defTiming:value,lateral:value,covering:value,blocking:value};
 }}
 const initial=structuredClone(career),observer=new CalibrationDiagnostics();let calls=0;const started=performance.now();
 while(career.productionMatch!.core.status==='RUNNING'&&calls++<40)career=advanceProductionMatch(career,10000,false,observer.observe);
 const session=career.productionMatch!;if(session.core.match?.phase!=='FULLTIME')throw new Error('Incomplete experiment');
 const before=digest(session),diagnostics=observer.report(session.core),actual=extract(session,diagnostics,resultFromSession(session));if(digest(session)!==before)throw new Error('Experiment observer mutated session');
 const playerShots=diagnostics.shots.filter(s=>changed.includes(s.actorId));
 rows.push({name:spec.name,index,fixture:fixture.id,seed:initial.productionMatch!.core.seed,treatment:treatment??null,changed,team,score:session.core.score,totals:actual.totals,own:actual.teams.find(t=>t.team===team),player:{shots:playerShots.length,goals:playerShots.filter(s=>s.goal).length,conversion:playerShots.length?playerShots.filter(s=>s.goal).length/playerShots.length:null},positions:Object.fromEntries(Object.entries(diagnostics.shotGroups).filter(([k])=>k.startsWith('POSITION:')).map(([k,v])=>[k,{attempts:v.attempts,goals:v.goals}])),halves:diagnostics.halves.map(h=>({period:h.period,attempts:h.attempts,conversion:h.conversion,savePct:h.savePctOnTarget,turnovers:h.turnovers})),resultHash:digest(resultFromSession(session)),sessionHash:before,runtimeMs:performance.now()-started});
 console.log(JSON.stringify({name:spec.name,index,score:session.core.score,changed}));
}
writeFileSync(join(out,'controlled-experiments.json'),JSON.stringify({schemaVersion:'reconciliation-sensitivity/1',inputHash:digest(inputs),seeds:[0,1],notes:['Two full canonical recipes per condition; descriptive sensitivity check, not an estimated population effect','Named gameplay capacities only, no CA/PA or empirical targets','Tactic experiments use the same initial squad; capability experiments change only the named family in the recorded players','Strong/weak keeper and shooter causal direction is also tested in 160 matched isolated duels'],rows},null,2)+'\n');
