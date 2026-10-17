/** Verify production identity and preserved services; never launches/stops them. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
process.chdir(path.resolve(__dirname,'../../..'));
async function main(){
  const dir='docs/match-structure-manpower-v1',baseline=JSON.parse(fs.readFileSync(dir+'/preservation.json','utf8')),distDir='.next-game-match-structure-v1',url='http://127.0.0.1:3023',buildId=fs.readFileSync('apps/game/'+distDir+'/BUILD_ID','utf8').trim(),routes={};
  for(const route of ['/','/new-game']){const r=await fetch(url+route,{signal:AbortSignal.timeout(8000)}),html=await r.text();assert.equal(r.status,200);assert.ok(html.includes(buildId),'Exact new build served');routes[route]={status:r.status,buildIdMatched:true};}
  const previousServices=[];for(const port of [3017,3018,3019,3020,3021,3022]){const r=await fetch('http://127.0.0.1:'+port,{signal:AbortSignal.timeout(5000)});previousServices.push({port,status:r.status});await r.body?.cancel();assert.equal(r.status,200);}
  for(const b of baseline.previousBuilds)assert.equal(fs.readFileSync('apps/game/'+b.directory+'/BUILD_ID','utf8').trim(),b.buildId);
  const buildSources=JSON.parse(fs.readFileSync('.tmp/match-structure-build-sources.json','utf8')),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  for(const[p,h]of Object.entries(buildSources.sourceFingerprints))assert.equal(sha(p),h,p);
  for(const f of [...buildSources.userFiles,...buildSources.protected])assert.equal(sha(f.path),f.sha256,f.path);
  const receipt={complete:true,verifiedAt:new Date().toISOString(),url,distDir,buildId,buildSourceHead:fs.readFileSync('.tmp/match-structure-build-head.txt','utf8').trim(),buildSources,preservedWorkingTreeStatus:baseline.status,buildSourceScope:'Built from the verified audit working tree on the recorded base HEAD, before the single final code-and-evidence commit. Canonical source and preserved user/protected file hashes are checked before and after build and again after committing; unrelated user files are excluded from the task commit.',routes,previousServices,previousBuilds:baseline.previousBuilds,
    startCommand:"Set-Location 'C:\\Users\\helgi\\Documents\\STARKVIS-HELA\\handball-manager\\apps\\game'\n$env:HM_NEXT_DIST_DIR = '.next-game-match-structure-v1'\nnpm.cmd run start -- --hostname 127.0.0.1 --port 3023",
    humanQA:{status:'PENDING_USER',priorAttributeIntegrationApproved:false,automaticVisualQA:'NOT_RUN',instructions:'Play 2-3 normal matches. Follow a suspension through the actual reduced unit, expiry and return; compare attack flow and Frikast/Bollforluster in live/final/archive Statistics. No continuous 2D, DevTools or imported QA saves required.'},nothingPushed:true};
  fs.writeFileSync(dir+'/DELIVERY.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({complete:true,url,buildId,previousServices}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
