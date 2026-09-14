const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{fileName:f,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {createMatch,matchReport}=require('../src/v2/core/match.ts');
const {archiveMatch,advanceArchive,seekMatch}=require('../src/v2/core/matchReplay.ts');
const {advanceCoreMutable,assertCore}=require('../src/v2/core/engine.ts');
const {coreHash,coreEventHash,loadCore,saveCore}=require('../src/v2/core/replay.ts');
const {setTactics}=require('../src/v2/core/coaching.ts');
const {requestTreatment}=require('../src/v2/core/condition.ts');
const {requestTeamTimeout}=require('../src/v2/core/referee.ts');
const rows=[],output=path.join(__dirname,'../src/v2/core/ecosystem-proof.json');
const moments=['PASSIVE_WARNING','PASSIVE_PLAY','ADVANTAGE_PENDING','ADVANTAGE_REALIZED','ADVANTAGE_RECALLED','TEAM_TIMEOUT_STARTED','OFFICIAL_CLOCK_RESTARTED','TWO_MINUTE_SUSPENSION','DISQUALIFICATION','TREATMENT_STARTED','TREATMENT_ELIGIBILITY_RESTORED','EXCHANGE_COMPLETED'];
function persist(complete){fs.writeFileSync(output,JSON.stringify({complete,description:'Executed V2 full-match evidence; scores are observations, not calibration targets.',rows},null,2)+'\n');}
persist(false);
for(const seed of [1,2025])for(const direction of ['TOP','BOTTOM']) {
  const initial=createMatch(seed,direction),archive=archiveMatch(initial);
  while(archive.state.status==='RUNNING'){advanceArchive(archive,1000);assertCore(archive.state);}
  const s=archive.state,count=type=>s.events.filter(e=>e.type===type).length;
  const row={direction,...matchReport(s),tick:s.tick,stateHash:coreHash(s),eventHash:coreEventHash(s),counts:Object.fromEntries(moments.map(t=>[t,count(t)])),
    energy:s.players.map(p=>({id:p.id,energy:p.condition.energy,distance:p.condition.distanceMetres,courtMs:p.condition.courtMs})),
    qaMoments:moments.flatMap(type=>s.events.filter(e=>e.type===type).slice(0,3).map(e=>({type,tick:e.tick,officialMs:e.officialMs,actor:e.actorId})))};
  rows.push(row);persist(false);assert.equal(row.complete,true,`${seed}/${direction}: ${s.reason}`);assert.equal(row.officialMs,3600000);
  const finalPrevious=structuredClone(seekMatch(archive,s.tick-1));advanceCoreMutable(finalPrevious);assert.equal(coreHash(finalPrevious),row.stateHash);
  const interesting=s.events.find(e=>e.type==='TEAM_TIMEOUT_STARTED')??s.events.find(e=>e.type==='PASSIVE_WARNING')??s.events.find(e=>e.type==='TWO_MINUTE_SUSPENSION')??s.events.find(e=>e.type==='HALFTIME');
  const historical=seekMatch(archive,interesting.tick),saved=saveCore(historical),resumed=structuredClone(loadCore(saved));
  while(resumed.status==='RUNNING')advanceCoreMutable(resumed);
  assert.equal(coreHash(resumed),row.stateHash);assert.equal(coreEventHash(resumed),row.eventHash);
  row.resume={tick:historical.tick,event:interesting.type,bytes:Buffer.byteLength(saved),exact:true};
  // Commanded adverse paths run through the identical executor and exact-save boundary.
  if(seed===2025) {
    const branch=structuredClone(seekMatch(archive,s.events.find(e=>e.type==='PASS_RECEIVED').tick));
    const team=branch.possession.team;setTactics(branch,team,{defence:'5:1',tempo:'QUICK'});
    assert.ok(requestTeamTimeout(branch,team));
    while(branch.referee.timeout)advanceCoreMutable(branch);
    while(!branch.ball.live&&branch.status==='RUNNING')advanceCoreMutable(branch);
    const injured=branch.players.find(p=>p.team===branch.possession.team&&p.population==='COURT'&&p.id!==branch.ball.controllerId&&p.kind==='FIELD_PLAYER');
    assert.ok(requestTreatment(branch,injured,'QA physical injury input'));
    const treatmentResume=structuredClone(loadCore(saveCore(branch)));
    while(branch.status==='RUNNING'){advanceCoreMutable(branch);if(branch.tick%1000===0)assertCore(branch);}
    while(treatmentResume.status==='RUNNING')advanceCoreMutable(treatmentResume);
    assert.equal(coreHash(branch),coreHash(treatmentResume));assert.equal(branch.match.phase,'FULLTIME',branch.reason??'');assertCore(branch);
    assert.ok(branch.events.some(e=>e.type==='PLAYER_LEFT_COURT'&&e.actorId===injured.id));
    assert.ok(branch.events.some(e=>e.type==='TREATMENT_ELIGIBILITY_RESTORED'&&e.actorId===injured.id));
    row.commandBranch={...matchReport(branch),stateHash:coreHash(branch),eventHash:coreEventHash(branch),injured:injured.id,exactResume:true};
  }
  persist(false);console.log(JSON.stringify({seed,direction,complete:row.complete,score:row.score,counts:row.counts,resume:row.resume,commandBranch:row.commandBranch?.complete}));
}
persist(true);
