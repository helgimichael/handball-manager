const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{fileName:f,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,f);
const {createMatch,matchReport}=require('../src/v2/core/match.ts');
const {archiveMatch,advanceArchive,seekMatch}=require('../src/v2/core/matchReplay.ts');
const {advanceCoreMutable,assertCore}=require('../src/v2/core/engine.ts');
const {coreHash,coreEventHash,loadCore,saveCore}=require('../src/v2/core/replay.ts');
const {distance,local}=require('../src/v2/core/space.ts');
const rows=[],modes=['STRETCH','COMBINE','CLEAR_LANE','RECYCLE','BALANCE'];
const percentile=(values,f)=>values.length?[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*f)]:null;
const output=path.join(__dirname,'../src/v2/core/backcourt-proof.json');
function write(complete=false){fs.writeFileSync(output,JSON.stringify({checkpointCommit:'b0d7c02f8ccb071eb301d8fe9216405492126e15',complete,description:'Backcourt relationship diagnostics. Actual occupied width is measured independently of support targets.',rows},null,2)+'\n');}
write();
for(const seed of [1,2025])for(const direction of ['TOP','BOTTOM']) {
  const a=archiveMatch(createMatch(seed,direction)),widths=[],samples=[],moments={};
  while(a.state.status==='RUNNING') {
    advanceArchive(a,20);const s=a.state;
    if(!s.ball.live||s.possession.phase!=='ESTABLISHED')continue;
    const team=s.players.filter(p=>p.team===s.possession.team&&p.population==='COURT'),l=team.find(p=>p.role==='LB'),r=team.find(p=>p.role==='RB');
    if(l&&r)widths.push(Math.abs(r.position.x-l.position.x));
    for(const p of team.filter(p=>p.support&&p.support.possessionId===s.possession.id)) {
      const plan=p.support;
      if(!moments[plan.mode])moments[plan.mode]={tick:s.tick,actor:p.id,partner:plan.partnerId,position:p.position,target:plan.target};
      samples.push({mode:plan.mode,depth:local(p.position,s.directions[p.team]).y,targetDistance:distance(p.position,plan.target)});
    }
  }
  const s=a.state;assertCore(s);
  const row={direction,...matchReport(s),tick:s.tick,stateHash:coreHash(s),eventHash:coreEventHash(s),
    actualBackcourtWidth:{samples:widths.length,p10:percentile(widths,.1),median:percentile(widths,.5),p90:percentile(widths,.9),over12m:widths.filter(n=>n>12).length,under9m:widths.filter(n=>n<9).length},
    support:modes.map(mode=>{const rows=samples.filter(x=>x.mode===mode);return {mode,samples:rows.length,medianDepth:percentile(rows.map(x=>x.depth),.5),medianTargetDistance:percentile(rows.map(x=>x.targetDistance),.5)};}),qaMoments:moments};
  rows.push(row);write();assert.ok(row.complete,`${seed}/${direction}: ${s.reason}`);
  if(seed===2025) {
    const tick=moments.COMBINE?.tick??moments.CLEAR_LANE?.tick??moments.STRETCH.tick;
    const historical=seekMatch(a,tick),resumed=JSON.parse(JSON.stringify(loadCore(saveCore(historical))));
    while(resumed.status==='RUNNING')advanceCoreMutable(resumed);
    assert.equal(coreHash(resumed),row.stateHash);assert.equal(coreEventHash(resumed),row.eventHash);
    assert.ok(historical.events.every(e=>e.tick<=historical.tick));
    row.resume={tick,stateHash:coreHash(resumed),eventHash:coreEventHash(resumed)};
  }
  console.log(JSON.stringify(row));write();
}
write(true);
