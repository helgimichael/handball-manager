import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { advanceCoreMutable, assertCore } from '@handball-manager/handball-engine/src/v2/core/engine';
import { observedFrame, resultFromSession, archiveFrames, finalizeProductionMatch, type ProductionMatchSession } from '../lib/career/productionMatch';
import type { CareerSave } from '../lib/save/saveRepository';
import { MotionDiagnostics } from './lib/motionDiagnostics';
const args=process.argv.slice(2), option=(key:string,fallback:string)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const out=resolve(option('--out','../../docs/match-motion-continuity/baseline'));
if(existsSync(join(out,'summary.json')))throw new Error('Preserve existing evidence: choose a new output directory');
mkdirSync(out,{recursive:true});
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const records=[];
for(const index of option('--indices','7,3,28').split(',').map(Number)){
  const initial=JSON.parse(readFileSync(resolve(`../../docs/match-realism-v21/human-qa/match-${String(index).padStart(3,'0')}-initial.json`),'utf8')) as CareerSave;
  const session=structuredClone(initial.careerState!.productionMatch!) as ProductionMatchSession;
  const diagnostics=new MotionDiagnostics(), start=performance.now();diagnostics.observe(session.core);
  while(session.core.status==='RUNNING'&&session.core.tick<200000){
    const count=session.core.events.length;advanceCoreMutable(session.core);const facts=session.core.events.slice(count);
    for(const event of facts)if(event.type==='SHOT_RELEASED'){const shooter=session.core.players.find(p=>p.id===event.actorId);event.details.goalkeeperId=session.core.players.find(p=>p.team!==shooter?.team&&p.kind==='GOALKEEPER'&&p.population==='COURT')?.id??'';}
    if((!process.env.HM_MOTION_PINNED&&session.core.ball.live)||session.core.tick%5===0||session.core.ball.flight||facts.some(e=>['GOAL','SUBSTITUTE_ADMITTED','EXCHANGE_COMPLETED','PERIOD_ENDED','TWO_MINUTE_SUSPENSION'].includes(e.type))||session.core.status!=='RUNNING')session.frames.push(observedFrame(session));
    diagnostics.observe(session.core);
    if(session.core.tick%1000===0)assertCore(session.core);
  }
  assertCore(session.core);
  if(session.core.match?.phase!=='FULLTIME')throw new Error(`Incomplete match ${index}: ${session.core.reason}`);
  const result=resultFromSession(session), report=diagnostics.report();
  const completed=JSON.parse(readFileSync(resolve(`../../docs/match-realism-v21/human-qa/match-${String(index).padStart(3,'0')}-completed.json`),'utf8')) as CareerSave;
  const oldArchive=Object.values(completed.careerState!.matchArchives!)[0];
  const record={index,seed:session.core.seed,fixture:session.fixture,score:session.core.score,runtimeMs:performance.now()-start,coreHash:hash(session.core),frameHash:hash(session.frames),matchesRetainedV21Frames:hash(session.frames)===hash(archiveFrames(oldArchive)),diagnostics:report};
  writeFileSync(join(out,`match-${index}.json`),JSON.stringify(record,null,2));
  writeFileSync(join(out,`trajectory-${index}.json`),JSON.stringify(diagnostics.trajectory));
  if(args.includes('--export')){
    const career=finalizeProductionMatch({...initial.careerState!,productionMatch:session});
    const save={...initial,saveId:`hm-motion-v1-${index}-completed`,manager:{...initial.manager,name:`Motion QA · Case ${index}`},careerState:career};
    writeFileSync(join(out,`match-${String(index).padStart(3,'0')}-completed.json`),JSON.stringify(save));
  }
  records.push(record);console.log(JSON.stringify({index,score:record.score,runtimeMs:record.runtimeMs,motion:report.aggregate}));
}
writeFileSync(join(out,'summary.json'),JSON.stringify(records,null,2));
