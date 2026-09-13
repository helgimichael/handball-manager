// Reproducible batch proof; does not start Next, modify legacy code, or calibrate results.
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
  const row={seed,direction,...matchReport(s),tick:s.tick,stateHash:coreHash(s),eventHash:coreEventHash(s)};
  if(row.complete) {
    const exact=seekMatch(archive,s.tick-1),oneLater=JSON.parse(JSON.stringify(exact));advanceCoreMutable(oneLater);
    assert.equal(coreHash(oneLater),row.stateHash);row.lastTickReconstruction=true;
    if(seed===2025) {
      const atHalf=s.events.find(e=>e.type==='PERIOD_ENDED').tick;
      const saved=saveCore(seekMatch(archive,atHalf)),resumed=JSON.parse(JSON.stringify(loadCore(saved)));
      while(resumed.status==='RUNNING')advanceCoreMutable(resumed);
      assert.equal(coreHash(resumed),row.stateHash);assert.equal(coreEventHash(resumed),row.eventHash);
      row.halftimeSave={tick:atHalf,bytes:Buffer.byteLength(saved),resumedStateHash:coreHash(resumed),resumedEventHash:coreEventHash(resumed)};
    }
  }
  rows.push(row);console.log(JSON.stringify(row));
}
fs.writeFileSync(path.join(__dirname,'../src/v2/core/match-proof.json'),JSON.stringify({description:'Actual batch results; scores are observations, not calibration targets. Browser QA is separate.',rows},null,2)+'\n');
assert.ok(rows.every(r=>r.complete),'At least one full match is incomplete; inspect match-proof.json');
