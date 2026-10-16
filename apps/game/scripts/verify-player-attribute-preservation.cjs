/** Read-only preservation checks; writes only this phase's compact receipt. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');process.chdir(root);
const dir='docs/player-attribute-integration-v1',baseline=JSON.parse(fs.readFileSync(dir+'/preservation.json','utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const git=args=>cp.execFileSync('git',args,{encoding:'utf8',maxBuffer:30e6}).replace(/\r\n/g,'\n').trimEnd();
for(const f of baseline.userFiles)assert.equal(hash(f.path),f.sha256,f.path);
for(const f of baseline.protected)assert.equal(hash(f.path),f.sha256,f.path);
const allowed={
 'profile.ts':'Normalize specific existing schema attributes once; preserve optional legacy profile fallbacks.',
 'execution.ts':'Specific pass, catch, challenged carry, wing aim and keeper reading execution.',
 'actions.ts':'Actual challenged bounce may release a loose ball; shared defensive footwork factor.',
 'intelligence.ts':'Bounded perception and marginal valuation; added eligibility restricted to option gap <=0.08.',
 'movement.ts':'Live court defending footwork and help/recovery/handover latency; excludes dead ball and exchanges.',
 'timing.ts':'Reach estimate uses the same defensive footwork factor as actual movement.',
 'interactions.ts':'Keeper category uses finite hand travel; successful catches retain risk facts.',
 'structure.ts':'Keeper-specific read quality and timing without bypassing motor reaction.'
};
const changed=[];
for(const f of baseline.core){const current=hash(f.path);if(current!==f.sha256){assert.ok(allowed[path.basename(f.path)],'Unexpected core change: '+f.path);changed.push({path:f.path,before:f.sha256,after:current,scope:allowed[path.basename(f.path)]});}}
assert.equal(changed.length,8,'Exactly eight bounded production core modules');
const physicalNormalizedHash=crypto.createHash('sha256').update(fs.readFileSync('packages/handball-engine/src/v2/core/physicalLoad.ts','utf8').replace(/\r\n/g,'\n')).digest('hex');
assert.equal(physicalNormalizedHash,'e1e334552f35a2f1dbc7d4b88da4ac5bbc501ae86f63ebf884bb6791da619606');
const stashes=git(['stash','list','--format=%H']).split('\n');assert.deepEqual(stashes,baseline.stashes.map(s=>s.split(' ')[0]));
const motionHead=git(['-C','../handball-motion-lab','rev-parse','HEAD']),motionStatus=git(['-C','../handball-motion-lab','status','--short']);assert.equal(motionHead,baseline.motionHead);assert.equal(motionStatus,baseline.motionStatus.trimEnd());
for(const b of baseline.previousBuilds)assert.equal(fs.readFileSync('apps/game/'+b.directory+'/BUILD_ID','utf8').trim(),b.buildId,b.directory);
for(const [name,sha]of Object.entries(baseline.priorEvidence))assert.equal(hash('docs/player-attributes-possession-economy-v1/'+name),sha,name);
const coreDir='packages/handball-engine/src/v2/core',sourceFingerprints=Object.fromEntries(fs.readdirSync(coreDir).filter(n=>n.endsWith('.ts')&&!n.endsWith('.test.ts')).sort().map(n=>[coreDir+'/'+n,hash(coreDir+'/'+n)]));
const receipt={complete:true,verifiedAt:new Date().toISOString(),startingCheckpoint:baseline.startingCheckpoint,currentHead:git(['rev-parse','HEAD']),preservedUserFiles:baseline.userFiles.length,protectedFiles:baseline.protected.length,originalCoreFiles:baseline.core.length,unchangedOriginalCoreFiles:baseline.core.length-changed.length,changed,sourceFingerprints,physicalNormalizedHash,motionHead,motionStatus,stashes,previousBuilds:baseline.previousBuilds,priorEvidence:baseline.priorEvidence,freezes:{physicalLoad:true,condition:true,ledger:true,refereeAndRestarts:true,careerProductionAndSave:true,careerLoading:true,matchCenterPresentation:true,actualDatabaseRatings:true},nothingPushed:true};
if(!process.argv.includes('--check-only'))fs.writeFileSync(dir+'/SOURCE-PRESERVATION.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({complete:true,userFiles:baseline.userFiles.length,protectedFiles:baseline.protected.length,changedCore:changed.length,oldBuildEntries:baseline.previousBuilds.length,motionHead,stashes}));
