const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {createMatch,matchReport}=require('../src/v2/core/match.ts');
const {advanceCoreMutable,assertCore}=require('../src/v2/core/engine.ts');
function analyse(s){
  const possessions=new Map(),counts={},subphases={},entries={},responses={};
  for(const e of s.events){
    counts[e.type]=(counts[e.type]??0)+1;
    const p=possessions.get(e.possessionId)??{actions:[],passes:[],shot:null};possessions.set(e.possessionId,p);
    if(e.type==='ACTION_STARTED'&&['PASS','FEINT','DRIVE','DRIBBLE','JUMP','SHOOT'].includes(e.details.kind))p.actions.push(e.details.kind);
    if(e.type==='PASS_RECEIVED')p.passes.push(`${e.details.passerId}>${e.actorId}`);
    if(e.type==='SHOT_RELEASED')p.shot={x:e.details.x,y:e.details.y,kind:e.details.shotKind};
    if(e.type==='OFFENSIVE_SUBPHASE')subphases[e.details.phase]=(subphases[e.details.phase]??0)+1;
    if(e.type==='ATTACK_ENTRY_SELECTED')entries[e.details.family]=(entries[e.details.family]??0)+1;
    if(e.type==='ATTACK_RESPONSE')responses[e.details.response]=(responses[e.details.response]??0)+1;
  }
  const attacks=[...possessions.values()].filter(p=>p.shot),paths={};
  for(const p of attacks){const key=p.actions.slice(0,5).join('>');paths[key]=(paths[key]??0)+1;}
  const ordered=Object.entries(paths).sort((a,b)=>b[1]-a[1]);
  return {...matchReport(s),attacksWithShot:attacks.length,distinctOpeningPaths:ordered.length,dominantOpeningShare:ordered[0]?.[1]/attacks.length,
    openingEntropy:ordered.reduce((h,[,n])=>h-n/attacks.length*Math.log2(n/attacks.length),0),topPaths:ordered.slice(0,8),
    entries,subphases,responses,entryDecisions:counts.ATTACK_ENTRY_ACTION??0,physicalEntryMovements:counts.ATTACK_ENTRY_MOVEMENT??0,establishedRelationships:counts.ATTACK_RELATIONSHIP_ESTABLISHED??0,endedEntries:counts.ATTACK_ENTRY_ENDED??0,
    physicalByFamily:s.events.filter(e=>e.type==='ATTACK_RELATIONSHIP_ESTABLISHED').reduce((r,e)=>(r[e.details.family]=(r[e.details.family]??0)+1,r),{}),
    shotKinds:attacks.reduce((r,p)=>(r[p.shot.kind]=(r[p.shot.kind]??0)+1,r),{}),
    qaMoments:s.events.filter(e=>['ATTACK_ENTRY_SELECTED','ATTACK_RESPONSE','ATTACK_ENTRY_ACTION','ATTACK_ENTRY_ENDED'].includes(e.type)).filter((e,i)=>i<40).map(e=>({tick:e.tick,type:e.type,...e.details}))};
}
module.exports={analyse};
if(require.main===module){
  const rows=[];for(const seed of [1,2025])for(const direction of ['TOP','BOTTOM']){
    const s=createMatch(seed,direction);while(s.status==='RUNNING'){advanceCoreMutable(s);if(s.tick%1000===0)assertCore(s);}assertCore(s);
    const row={seed,direction,...analyse(s)};rows.push(row);console.log(JSON.stringify({seed,direction,complete:row.complete,paths:row.distinctOpeningPaths,dominant:row.dominantOpeningShare,entries:row.entries,reason:s.reason}));
  }
  const name=process.argv.includes('--baseline')?'variation-baseline.json':'variation-audit.json';
  fs.writeFileSync(path.join(__dirname,'../src/v2/core',name),JSON.stringify({complete:rows.every(r=>r.complete),rows},null,2)+'\n');
  assert.ok(rows.every(r=>r.complete));
}
