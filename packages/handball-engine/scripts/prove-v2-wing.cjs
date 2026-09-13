const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{fileName:f,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,f);
const {createMatch,matchReport}=require('../src/v2/core/match.ts');
const {archiveMatch,advanceArchive,seekMatch}=require('../src/v2/core/matchReplay.ts');
const {advanceCoreMutable,assertCore}=require('../src/v2/core/engine.ts');
const {coreHash,coreEventHash,loadCore,saveCore}=require('../src/v2/core/replay.ts');
const {isWing,wingRelationship}=require('../src/v2/core/wing.ts');
const {local,distance}=require('../src/v2/core/space.ts');
const rows=[];
const median=values=>values.length?[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)]:null;
for(const seed of [1,2025])for(const direction of ['TOP','BOTTOM']) {
  const archive=archiveMatch(createMatch(seed,direction)),samples=[];
  while(archive.state.status==='RUNNING') {
    advanceArchive(archive,20);
    const s=archive.state;
    if(s.ball.live&&s.possession.phase==='ESTABLISHED')for(const p of s.players.filter(p=>p.population==='COURT'&&p.team===s.possession.team&&isWing(p)&&p.id!==s.ball.controllerId)) {
      if(s.tick-p.duty.sinceTick<40)continue; // Allow two seconds after allocation before observing occupancy.
      const q=local(p.position,s.directions[p.team]),r=wingRelationship(s,p);
      samples.push({mode:r.mode,inset:Math.min(q.x,20-q.x),depth:q.y,targetDistance:distance(p.position,r.target)});
    }
  }
  const s=archive.state;assertCore(s);assert.ok(matchReport(s).complete,`${seed}/${direction}: ${s.reason}`);
  const wings=s.players.filter(isWing).map(p=>p.id),count=type=>s.events.filter(e=>e.type===type).length;
  const moments=s.events.filter(e=>wings.includes(e.actorId)&&((e.type==='ACTION_STARTED'&&/wing|outside/i.test(e.details.reason??''))||e.type==='SHOT_RELEASED'||e.type==='PASS_RECEIVED'));
  const row={direction,...matchReport(s),tick:s.tick,stateHash:coreHash(s),eventHash:coreEventHash(s),fouls:count('FOUL'),
    wingShots:s.events.filter(e=>e.type==='SHOT_RELEASED'&&wings.includes(e.actorId)).length,
    wingReturns:s.events.filter(e=>e.type==='ACTION_STARTED'&&e.details.reason==='Wing window closed; reconnect with the adjacent back').length,
    occupancy:['PIN_CORNER','OFFER_OUTSIDE'].map(mode=>{const a=samples.filter(x=>x.mode===mode);return {mode,samples:a.length,medianInset:median(a.map(x=>x.inset)),medianDepth:median(a.map(x=>x.depth)),medianTargetDistance:median(a.map(x=>x.targetDistance)),fartherThan4m:a.filter(x=>x.targetDistance>4).length};}),
    qaMoments:moments.slice(0,24).map(e=>({tick:e.tick,type:e.type,actor:e.actorId,details:e.details}))};
  if(seed===2025) {
    const moment=moments.find(e=>e.type==='SHOT_RELEASED')??moments[0];assert.ok(moment);
    const historical=seekMatch(archive,moment.tick-1),saved=saveCore(historical),resumed=JSON.parse(JSON.stringify(loadCore(saved)));
    while(resumed.status==='RUNNING')advanceCoreMutable(resumed);
    assert.equal(coreHash(resumed),row.stateHash);assert.equal(coreEventHash(resumed),row.eventHash);
    assert.ok(historical.events.every(e=>e.tick<=historical.tick));
    row.resume={tick:historical.tick,stateHash:coreHash(resumed),eventHash:coreEventHash(resumed)};
  }
  rows.push(row);console.log(JSON.stringify(row));
}
fs.writeFileSync(path.join(__dirname,'../src/v2/core/wing-proof.json'),JSON.stringify({checkpointCommit:'e07388028dd9f8eac77051479828111a700389c2',description:'Uncommitted wing relationship pass. Occupancy samples and outcomes are diagnostics, not realism calibration.',rows},null,2)+'\n');
