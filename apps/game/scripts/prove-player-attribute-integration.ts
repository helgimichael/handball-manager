/** Sequential paired developer encounters against the preserved starting source. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync,existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import type {AttributeSheet} from '@handball-manager/handball-engine/src/v2/core/profile';
import type * as Encounters from '@handball-manager/handball-engine/src/v2/core/attributeIntegrationScenarios';

async function main(){
 const args=process.argv.slice(2),arg=(k:string,d:string)=>args.includes(k)?args[args.indexOf(k)+1]:d;
 const variant=arg('--variant','after'),domain=arg('--domain','decision'),n=Number(arg('--trials','384'));
 assert.ok(['before','after'].includes(variant));assert.ok(Number.isInteger(n)&&n>=300&&n<=768);
 const root=resolve('../..'),dir=join(root,'docs/player-attribute-integration-v1'),source=join(root,'packages/handball-engine/src/v2/core'),baseline=join(root,'.tmp/player-attributes-before/packages/handball-engine/src/v2/core');
 const hash=(x:unknown)=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
 const fileHash=(p:string)=>hash(readFileSync(p,'utf8'));
 const dev='attributeIntegrationScenarios.ts';if(variant==='before')copyFileSync(join(source,dev),join(baseline,dev));
 const core=variant==='before'?baseline:source;
 const paths=readdirSync(core).filter(f=>f.endsWith('.ts')&&!f.endsWith('.test.ts'));
 const fingerprint=()=>Object.fromEntries(paths.map(f=>[f,fileHash(join(core,f))]));const sources=fingerprint();
 const module=await import(pathToFileURL(join(core,dev)).href),e=(module.default??module)as typeof Encounters;
 const inputPath=join(root,'docs/player-attributes-possession-economy-v1/final/allsv/inputs.json'),input=JSON.parse(readFileSync(inputPath,'utf8'));
 const ratings=Object.values(input.gameplayRatings).flat()as {playerId:string;position:string;branch:{attributes:Record<string,{value:number;origin:string}>}}[];
 const inventory=JSON.parse(readFileSync(join(root,'docs/player-attributes-possession-economy-v1/ATTRIBUTE-COVERAGE.json'),'utf8')).attributes as {attribute:string;branch:string}[];
 const quantile=(a:number[],q:number)=>a.slice().sort((x,y)=>x-y)[Math.floor((a.length-1)*q)];
 const ranges=Object.fromEntries(inventory.map(({attribute:key,branch})=>{const a=ratings.filter(r=>(r.position==='GK')===(branch==='GOALKEEPER')).map(r=>r.branch.attributes[key]?.value).filter(Number.isFinite);assert.ok(a.length,key);return[key,{n:a.length,min:Math.min(...a),p10:quantile(a,.1),q1:quantile(a,.25),median:quantile(a,.5),q3:quantile(a,.75),p90:quantile(a,.9),max:Math.max(...a)}];}));
 const base=Object.fromEntries(inventory.map(r=>[r.attribute,ranges[r.attribute].median]))as AttributeSheet;
 const tiers=['low','mid','high']as const,alter=(keys:string[],tier:typeof tiers[number])=>({...base,...Object.fromEntries(keys.map(k=>[k,ranges[k][tier==='low'?'p10':tier==='mid'?'median':'p90']]))})as AttributeSheet;
 const average=(a:number[])=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
 const summarize=(trials:Record<string,unknown>[])=>{
  const keys=[...new Set(trials.flatMap(t=>Object.keys(t)))],metrics:Record<string,unknown>={};
  for(const key of keys){const values=trials.map(t=>t[key]);if(values.every(v=>typeof v==='boolean'))metrics[key]={count:values.filter(Boolean).length,n:values.length,rate:values.filter(Boolean).length/values.length};else if(values.some(v=>typeof v==='number')){const a=values.filter((v):v is number=>typeof v==='number'&&Number.isFinite(v));metrics[key]={n:a.length,mean:average(a),min:Math.min(...a),max:Math.max(...a)};}else if(values.every(v=>typeof v==='string'||v===null))metrics[key]=Object.fromEntries([...new Set(values)].map(v=>[String(v),values.filter(x=>x===v).length]));}
  return{n:trials.length,metrics,trialDigest:hash(trials)};
 };
 const cells:unknown[]=[],start=performance.now();
 const cell=(label:string,keys:string[],tier:typeof tiers[number],context:string,tired:boolean,trials:Record<string,unknown>[])=>{cells.push({label,keys,tier,context,tired,raw:Object.fromEntries(keys.map(k=>[k,alter(keys,tier)[k as keyof AttributeSheet]])),...summarize(trials)});};
 if(domain==='decision')for(const context of ['free','bind','2v1','3v2','marginalShotPass','riskyPassRecycle']as const)for(const tier of tiers){const keys=['DECISION_MAKING','AWARENESS','PLAYMAKING','ADVANTAGE_RECOGNITION','TWO_V_TWO_READING'];cell('decision',keys,tier,context,false,Array.from({length:n},(_,i)=>e.decisionEncounter(i,alter(keys,tier),context,base)));}
 else if(domain==='handling'){
  for(const context of ['simple','moving','long','pressured']as const)for(const tired of [false,true])for(const tier of tiers){const keys=['PASSING','PRESSURE_HANDLING'];cell('pass',keys,tier,context,tired,Array.from({length:n},(_,i)=>e.passEncounter(i,alter(keys,tier),base,context,tired)));}
  for(const context of ['simple','awkward','pressured','moving']as const)for(const tired of [false,true])for(const tier of tiers){const keys=['BALL_HANDLING','CONCENTRATION','PRESSURE_HANDLING'];cell('receive',keys,tier,context,tired,Array.from({length:n},(_,i)=>e.catchEncounter(i,alter(keys,tier),base,base,context,tired)));}
  for(const tier of tiers){const keys=['PASSING'];cell('deliveryOwnership',keys,tier,'sameReceiver',false,Array.from({length:n},(_,i)=>e.catchEncounter(i,base,alter(keys,tier),base,'awkward')));}
  for(const context of ['open','fast','contact','breakthrough']as const)for(const tired of [false,true])for(const tier of tiers){const keys=['BALL_HANDLING','PRESSURE_HANDLING'];cell('carry',keys,tier,context,tired,Array.from({length:n},(_,i)=>e.carryEncounter(i,alter(keys,tier),base,context,tired)));}
 }
 else if(domain==='shooting')for(const context of ['clear','medium','difficult','wing','penalty']as const)for(const tired of [false,true])for(const tier of tiers){const keys=['SHOOTING_PLACEMENT','FINISHING','WING_FINISHING'];cell('shoot',keys,tier,context,tired,Array.from({length:128},(_,i)=>e.shotEncounter(i,alter(keys,tier),base,base,context,tired)));}
 else if(domain==='defence'){
  for(const context of ['contain','help','recover','handoff']as const)for(const tier of tiers){const keys=['LATERAL_DEFENCE','DEFENSIVE_TIMING','DEFENSIVE_POSITIONING','COVERING','SWITCHING_HANDOVER'];cell('defend',keys,tier,context,false,Array.from({length:n},(_,i)=>e.defenceEncounter(i,alter(keys,tier),base,context)));}
  for(const impossible of [false,true])for(const tier of tiers){const keys=['BALL_WINNING'];cell('intercept',keys,tier,impossible?'impossible':'plausible',false,Array.from({length:n},(_,i)=>e.interceptionEncounter(i,alter(keys,tier),base,impossible)));}
 }
 else if(domain==='keeper')for(const context of ['clear','medium','difficult','wing','penalty']as const)for(const tier of tiers){const keys=inventory.filter(r=>r.branch==='GOALKEEPER'&&r.attribute!=='OUTLET_PASSING'&&r.attribute!=='RESTART_SPEED'&&r.attribute!=='TRANSITION_DECISION'&&r.attribute!=='GK_CONSISTENCY').map(r=>r.attribute);cell('keeper',keys,tier,context,false,Array.from({length:128},(_,i)=>e.shotEncounter(i,base,alter(keys,tier),base,context)));}
 else if(domain==='realPlayers'){
  const people=new Map<string,{firstName:string;lastName:string}>((Object.values(input.worldSquads).flat()as {id:string;firstName:string;lastName:string}[]).map(p=>[p.id,p]));
  const selected=new Set<string>();const profiles=[];
  for(const[label,keys,position,reverse]of [['creator',['PASSING','DECISION_MAKING','PLAYMAKING'],null,false],['shooter',['SHOOTING_PLACEMENT','SHOOTING_POWER','FINISHING'],null,false],['defender',['LATERAL_DEFENCE','DEFENSIVE_POSITIONING','COVERING'],null,false],['physical',['ENDURANCE','REPEAT_SPRINT_ABILITY','STRENGTH'],null,false],['weakerTechnical',['PASSING','BALL_HANDLING','FINISHING'],null,true],['balanced',['PASSING','BALL_HANDLING','DEFENSIVE_POSITIONING'],null,false],['keeper',['REACTION','SHOOTER_READING','GK_POSITIONING'],'GK',false]]as [string,string[],string|null,boolean][]){
   const score=(r:typeof ratings[number])=>keys.reduce((s,k)=>s+(r.branch.attributes[k]?.value??10),0)/keys.length;
   const candidates=ratings.filter(r=>(position==='GK'?r.position==='GK':r.position!=='GK')&&!selected.has(r.playerId)).sort((a,b)=>(reverse?1:-1)*(score(a)-score(b))||a.playerId.localeCompare(b.playerId));const player=label==='balanced'?candidates[Math.floor(candidates.length/2)]:candidates[0];selected.add(player.playerId);const raw=Object.fromEntries(Object.entries(player.branch.attributes).map(([k,v])=>[k,v.value]))as AttributeSheet,person=people.get(player.playerId);
   const shot=Array.from({length:128},(_,i)=>e.shotEncounter(i,position==='GK'?base:raw,position==='GK'?raw:base,base,'medium'));
   profiles.push({label,playerId:player.playerId,name:person?person.firstName+' '+person.lastName:player.playerId,position:player.position,selectionKeys:keys,selectionScore:score(player),raw,provenance:player.branch.attributes,shoot:summarize(shot),...(position==='GK'?{}:{pass:summarize(Array.from({length:n},(_,i)=>e.passEncounter(i,raw,base,'pressured'))),receive:summarize(Array.from({length:n},(_,i)=>e.catchEncounter(i,raw,base,base,'pressured',true))),carry:summarize(Array.from({length:n},(_,i)=>e.carryEncounter(i,raw,base,'contact',true))),defend:summarize(Array.from({length:n},(_,i)=>e.defenceEncounter(i,raw,base,'recover'))),decision:summarize(Array.from({length:n},(_,i)=>e.decisionEncounter(i,raw,'marginalShotPass',base))),physical:e.physicalEncounter(raw)})});
  }cells.push({label:'Actual roster branches',profiles});
 }else throw Error('Unknown --domain');
 assert.deepEqual(fingerprint(),sources,'Source changed during controlled evidence');
 const output=join(dir,'controlled',variant);mkdirSync(output,{recursive:true});const result={complete:true,variant,domain,input:{path:inputPath.slice(root.length+1),sha256:fileHash(inputPath),players:ratings.length,provenance:'Actual retained roster identities and gameplay rating branches; generated-prior/derived origins retained, not measured athlete ability.'},ranges,cells,sources,harnessSha256:fileHash(join(core,dev)),runtimeMs:performance.now()-start,seedPolicy:'Paired trial seeds and identical declared visible contexts. Source-specific scenario initialization is normalized to the same action RNG before resolution.',scope:'No empirical targets, rating rewrites, CA/PA, quotas or production observers. Staged decision inputs are labelled; shots run full canonical keeper reading and ticks. Catch bodies move only in moving contexts.'};
 const file=join(output,domain+'.json');assert.ok(!existsSync(file),'Preserve completed receipts; choose a new output directory after source changes');writeFileSync(file,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({complete:true,variant,domain,cells:cells.length,runtimeMs:Math.round(result.runtimeMs),file}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
