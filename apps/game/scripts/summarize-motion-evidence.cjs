const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..'),base=path.join(root,'docs/match-motion-continuity');
const read=file=>JSON.parse(fs.readFileSync(path.join(base,file),'utf8').replace(/^\uFEFF/,''));
const write=(file,value)=>fs.writeFileSync(path.join(base,file),JSON.stringify(value,null,2)+'\n');
const before=read('final/measurements/before/summary.json'),after=read('final/delivery-motion/summary.json');
const aggregate=read('final/delivery-regression/aggregate.json');
const original=Array.from({length:20},(_,i)=>JSON.parse(fs.readFileSync(path.join(root,`docs/match-realism-v21/after/match-${String(i).padStart(3,'0')}.json`),'utf8')));
const mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
const keys=['goals','possessions','shots','careerTurnovers','nonShotLoss','savePctOnTarget','transitionStarts','transitionShots','backcourtShare','wingShare','closeShare','contactWhistles'];
const regression=Object.fromEntries(keys.map(key=>{const old=mean(original.map(r=>r.numerical[key])),next=aggregate.distributions[key].mean;return [key,{before:old,after:next,relativeChange:next/old-1,beforeRange:[Math.min(...original.map(r=>r.numerical[key])),Math.max(...original.map(r=>r.numerical[key]))],afterRange:[aggregate.distributions[key].min,aggregate.distributions[key].max]}];}));
write('final/comparison.json',{sampleSize:20,sourceStable:aggregate.sourceFingerprintsStableDuringBatch,motion:before.map((b,i)=>({index:b.index,before:b.diagnostics.aggregate,after:after[i].diagnostics.aggregate,beforeGroups:b.diagnostics.groups,afterGroups:after[i].diagnostics.groups})),regression,definitions:after[0].diagnostics.definitions});
const experiments=[],cleanup=[];
const temporary=/^(baseline(?:-verified|-final)?|experiment-\d+|regression-(?:experiment-\d+|final|narrow-final|retained-pace|accepted-candidate)|after-(?:final|narrow-final|retained-pace)|browser-final-speeds)$/;
for(const entry of fs.readdirSync(base,{withFileTypes:true}))if(entry.isDirectory()&&temporary.test(entry.name)){
  const directory=path.join(base,entry.name),summary=path.join(directory,'aggregate.json');
  if(fs.existsSync(summary))experiments.push({stage:entry.name,aggregate:JSON.parse(fs.readFileSync(summary,'utf8')),matches:fs.existsSync(path.join(directory,'matches-summary.json'))?JSON.parse(fs.readFileSync(path.join(directory,'matches-summary.json'),'utf8')):[]});
  cleanup.push(entry.name);
}
const previous=fs.existsSync(path.join(base,'experiments-summary.json'))?read('experiments-summary.json').experiments:[];
const trials=[...new Map([...previous,...experiments].map(trial=>[trial.stage,trial])).values()];
write('experiments-summary.json',{note:'Development trials only. Use final/measurements/before and final/delivery-motion for the identical final diagnostic definition. Rejected trial summaries are retained without duplicated inputs and bulky temporary saves.',experiments:trials});
for(const name of ['build.log','build-final.log','build-narrow-final.log','engine-experiment-1.log','production-final-tests.log','typechecks.log','v2-core-tests.log','v2-core-final-tests.log','v2-core-retained-pace-tests.log'])if(fs.existsSync(path.join(base,name)))cleanup.push(name);
for(const name of ['final/before','final/before-verified','final/motion-verified','final/after-verified','final/browser/video-frame-20.png'])if(fs.existsSync(path.join(base,name)))cleanup.push(name);
for(const name of ['match-7.json','match-3.json','match-28.json','summary.json','trajectory-7.json','trajectory-3.json','trajectory-28.json'])if(fs.existsSync(path.join(base,'final/motion',name)))cleanup.push(`final/motion/${name}`);
if(fs.existsSync(path.join(base,'v2-tests.log'))){fs.copyFileSync(path.join(base,'v2-tests.log'),path.join(base,'final/v2-protocol-tests.log'));cleanup.push('v2-tests.log');}
if(fs.existsSync(path.join(base,'missed-pass-probe.json'))){write('final/rejected-pass-probe.json',{stage:'Rejected full-speed offer revision, before braking receiver projection',passes:read('missed-pass-probe.json')});cleanup.push('missed-pass-probe.json');}
write('cleanup-plan.json',cleanup);
// A static scientific trace, drawn directly from measured data.
const oldTrace=read('final/measurements/before/trajectory-7.json');
const candidates=new Map();for(const p of oldTrace)if(p.role!=='GK'&&p.live&&p.speed<1e-8&&Math.hypot(p.vx,p.vy)>.5)candidates.set(p.id,(candidates.get(p.id)||0)+1);
const id=[...candidates].sort((a,b)=>b[1]-a[1])[0][0];
const old=oldTrace.filter(p=>p.id===id);
const person=read('final/motion/match-007-completed.json').careerState.matchArchives['swe-2-f7'].people.find(p=>p.id===id);
write('final/trajectory-selection.json',{id,name:person?.name,role:old[0].role,ticks:[400,800],baselineFrozenDespiteVelocitySamples:candidates.get(id)});
const plotted=require('node:child_process').spawnSync('python',[path.join(__dirname,'plot-motion-trajectory.py')],{cwd:root,env:{...process.env,MPLCONFIGDIR:path.join(root,'apps/game/.tmp/motion-matplotlib')},stdio:'inherit'});
if(plotted.status!==0)throw new Error('Trajectory plotting failed');
console.log({cleanupDirectories:cleanup.length,regression,motion:after.map(r=>({index:r.index,stops:r.diagnostics.aggregate.fullStopsPerPlayerMinute,segment:r.diagnostics.aggregate.continuousMovementSeconds.mean}))});
