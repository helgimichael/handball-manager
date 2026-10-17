/** Hash-based preservation; --check-only avoids changing the committed receipt. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
process.chdir(path.resolve(__dirname,'../../..'));
const dir='docs/match-structure-manpower-v1',base=JSON.parse(fs.readFileSync(dir+'/preservation.json','utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),git=a=>cp.execFileSync('git',a,{encoding:'utf8',maxBuffer:30e6}).replace(/\r\n/g,'\n').trimEnd();
assert.equal(git(['merge-base',base.startingHead,'HEAD']),base.startingHead);
for(const f of [...base.userFiles,...base.protected,...base.priorPhase])assert.equal(sha(f.path),f.sha256,f.path);
const prior=JSON.parse(fs.readFileSync('docs/player-attribute-integration-v1/VERIFICATION.json','utf8'));
for(const[p,h]of Object.entries(prior.sourceIdentities))assert.equal(base.core.find(f=>f.path===p)?.sha256,h,'Retained baseline source '+p);
const allowed={population:'Reject/cancel a keeper exchange that would leave another goalkeeper active.',sanction:'Retain an existing stationary frontal containment through a subsequent takeoff.',referee:'Resolve the strongest unannounced personal discipline per player at the stoppage; retain all physical foul facts.'};
const changes=[];for(const f of base.core){const h=sha(f.path);if(h!==f.sha256){const key=path.basename(f.path,'.ts');assert.ok(allowed[key],'Unexpected original core edit '+f.path);changes.push({path:f.path,before:f.sha256,after:h,reason:allowed[key]});}}
assert.deepEqual(changes.map(f=>path.basename(f.path)).sort(),['population.ts','referee.ts','sanction.ts']);
const core='packages/handball-engine/src/v2/core',sourceFingerprints=Object.fromEntries(fs.readdirSync(core).filter(n=>n.endsWith('.ts')&&!n.endsWith('.test.ts')).sort().map(n=>[core+'/'+n,sha(core+'/'+n)]));
const reachable=new Set();function walk(p){if(reachable.has(p))return;reachable.add(p);const text=fs.readFileSync(p,'utf8');for(const m of text.matchAll(/from\s+['"](\.[^'"]+)['"]/g)){const next=path.resolve(path.dirname(p),m[1]+'.ts');if(fs.existsSync(next))walk(next);}}for(const n of ['engine','match','profile'])walk(path.resolve(core,n+'.ts'));
assert.ok(![...reachable].some(p=>p.endsWith('matchStructureScenarios.ts')||p.endsWith('attributeIntegrationScenarios.ts')),'Developer scenarios are not reachable from production entry points');
assert.equal(git(['-C','../handball-motion-lab','rev-parse','HEAD']),base.motionHead);assert.equal(git(['-C','../handball-motion-lab','status','--short']),base.motionStatus);
assert.equal(git(['stash','list','--format=%H']),base.stashes);for(const b of base.previousBuilds)assert.equal(fs.readFileSync('apps/game/'+b.directory+'/BUILD_ID','utf8').trim(),b.buildId);
const receipt={complete:true,verifiedAt:new Date().toISOString(),startingHead:base.startingHead,head:git(['rev-parse','HEAD']),userFiles:base.userFiles.length,protectedFiles:base.protected.length,priorArtifacts:base.priorPhase.length,retainedBaselineSourceVerified:true,changes,sourceFingerprints,productionImportGraph:[...reachable].map(p=>path.relative('.',p).replaceAll('\\','/')).sort(),developerDiagnosticsReachable:false,physicalAndAttributeIntegrationSourcesUnchanged:true,matchCenterAndLoadingUnchanged:true,saveArchiveSchemaUnchanged:true,motionHead:base.motionHead,motionStatus:base.motionStatus,stashes:base.stashes.split('\n'),previousBuilds:base.previousBuilds,nothingPushed:true};
if(!process.argv.includes('--check-only'))fs.writeFileSync(dir+'/SOURCE-PRESERVATION.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({complete:true,userFiles:receipt.userFiles,protectedFiles:receipt.protectedFiles,priorArtifacts:receipt.priorArtifacts,productionModulesChanged:changes.length,importGraphModules:reachable.size,motionHead:receipt.motionHead,nothingPushed:true}));
