const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{fileName:f,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,f);
const {createMatch,matchReport}=require('../src/v2/core/match.ts');
const {archiveMatch,advanceArchive,seekMatch}=require('../src/v2/core/matchReplay.ts');
const {advanceCoreMutable,assertCore}=require('../src/v2/core/engine.ts');
const {coreHash,coreEventHash,loadCore,saveCore}=require('../src/v2/core/replay.ts');
const rows=[];
for(const seed of [1,2025])for(const direction of ['TOP','BOTTOM']) {
  const archive=archiveMatch(createMatch(seed,direction));
  while(archive.state.status==='RUNNING')advanceArchive(archive,1000);
  const s=archive.state;assertCore(s);
  const count=type=>s.events.filter(e=>e.type===type).length;
  const row={direction,...matchReport(s),tick:s.tick,stateHash:coreHash(s),eventHash:coreEventHash(s),
    actions:s.events.filter(e=>e.type==='ACTION_STARTED').reduce((n,e)=>(n[e.details.kind]=(n[e.details.kind]??0)+1,n),{}),
    contests:s.contests.reduce((n,c)=>(n[`${c.kind}/${c.outcome}`]=(n[`${c.kind}/${c.outcome}`]??0)+1,n),{}),
    warnings:count('WARNING'),reentries:count('SUSPENSION_EXPIRED'),
    qaMoments:s.events.filter(e=>['FOUL','TWO_MINUTE_SUSPENSION','SUSPENSION_EXPIRED','DEFENDER_BEATEN','HANDOVER_COMPLETED'].includes(e.type)).slice(0,24).map(e=>({tick:e.tick,officialMs:e.officialMs,type:e.type,actor:e.actorId}))};
  if(row.complete&&seed===2025) {
    const foul=s.events.find(e=>e.type==='FOUL');assert.ok(foul,'A physical holding sequence must remain available for QA');
    const historical=seekMatch(archive,foul.tick-1),saved=saveCore(historical),resumed=JSON.parse(JSON.stringify(loadCore(saved)));
    while(resumed.status==='RUNNING')advanceCoreMutable(resumed);
    assert.equal(coreHash(resumed),row.stateHash);assert.equal(coreEventHash(resumed),row.eventHash);
    row.contactSave={tick:historical.tick,bytes:Buffer.byteLength(saved),resumedStateHash:coreHash(resumed),resumedEventHash:coreEventHash(resumed)};
    assert.ok(historical.events.every(e=>e.tick<=historical.tick));
  }
  rows.push(row);console.log(JSON.stringify(row));
}
fs.writeFileSync(path.join(__dirname,'../src/v2/core/contact-proof.json'),JSON.stringify({checkpointCommit:'a0291a600631ac39cad7f5b16017fc696f524f09',description:'Uncommitted realism batch. Observed actions and causal contacts, not score calibration.',rows},null,2)+'\n');
assert.ok(rows.every(r=>r.complete),'Incomplete match: inspect contact-proof.json');
