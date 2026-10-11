// Offline recovery receipt. Run from repository root after validation finishes.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const root = process.cwd();
const out = 'docs/match-motion-quality-v2';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const readLog = file => {
  const bytes=fs.readFileSync(file);
  return bytes[0]===0xff && bytes[1]===0xfe ? bytes.toString('utf16le').replace(/^\uFEFF/,'') : bytes.toString('utf8');
};
const prior = read('docs/match-empirical-calibration/VERIFICATION.json');
const preserved = prior.preserved.map(p => ({file:p.file, sha256:hash(p.file), unchanged:hash(p.file) === p.sha256}));
if (preserved.some(p => !p.unchanged)) throw Error('Preserved user file changed');
const receipts = [
  ['recovered full game', '.tmp/motion-quality-game-release.log', /tests 2306[\s\S]*pass 2306[\s\S]*fail 0/],
  ['recovered V2 protocol', '.tmp/motion-quality-v2-release.log', /tests 9[\s\S]*pass 9[\s\S]*fail 0/],
  ['recovered empirical framework', '.tmp/motion-quality-empirical-release.log', /tests 15[\s\S]*pass 15[\s\S]*fail 0/],
  ['final changed core files and focused motion', '.tmp/motion-quality-recovery-focused.log', /tests 34[\s\S]*pass 34[\s\S]*fail 0/],
  ['workspace regression', '.tmp/motion-quality-recovery-workspace.log', /fail 0/],
  ['workspace typechecks', '.tmp/motion-quality-recovery-types.log', /match-demo@0.0.0 typecheck/],
  ['benchmark typecheck', '.tmp/motion-quality-recovery-bench-types.log', /^\s*$/],
  ['isolated production build', '.tmp/motion-quality-recovery-build.log', /Compiled successfully[\s\S]*\/scenario-lab\/match/],
  ['season and rollover', '.tmp/motion-quality-recovery-season.log', /COMPLETE: full season, saved match archives, rollover and season-two calendar/],
];
const checks = receipts.map(([name,file,pattern]) => {
  const text = readLog(file);
  const passed = pattern.test(text) && !/\b(?:error TS\d+|Build error occurred|Error: spawn|fail [1-9])/.test(text);
  const target = `${out}/verification/${path.basename(file)}`;
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(file,target);
  return {name,passed,evidence:target,sha256:hash(target)};
});
const cohorts = ['hbl-release','allsv-release'].map(key => {
  const summary = read(`${out}/${key}/summary.json`);
  const mismatches = summary.metadata.sourceFingerprints.filter(p => hash(path.join(root,p.path.replace(/^\//,''))) !== p.sha256);
  if(mismatches.length || !summary.metadata.sourceStable) throw Error(`Stale cohort ${key}`);
  return {key,matches:summary.matches,sourceFingerprintsMatch:true,proofs:summary.metadata.proofs,normalMatchOverhead:summary.metadata.normalMatchOverhead};
});
const tactics = read(`${out}/tactics-recovery/controlled-experiments.json`);
if(tactics.rows.length !== 12) throw Error('Incomplete tactic receipt');
const season = read('.tmp/motion-quality-season-recovery/playable-season-result.json');
fs.copyFileSync('.tmp/motion-quality-season-recovery/playable-season-result.json',`${out}/verification/playable-season-result.json`);
fs.copyFileSync('.tmp/motion-quality-core-release.log',`${out}/verification/recovered-core-run.log`);
const localDiagnostics = [];
function inventory(directory) {
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})) {
    const file=path.join(directory,entry.name);
    if(entry.isDirectory()) inventory(file);
    else if(/^(?:(?:match-|motion-|causal-).+\.json|inputs\.json)$/.test(entry.name)) localDiagnostics.push({file:file.replaceAll('\\','/'),bytes:fs.statSync(file).size,sha256:hash(file)});
  }
}
inventory(out);
const git = args => cp.execFileSync('git',args,{encoding:'utf8',env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}}).trim();
const motionHead=git(['-C','../handball-motion-lab','rev-parse','HEAD']);
const motionStatus=git(['-C','../handball-motion-lab','status','--short']);
const stashes=git(['stash','list','--format=%H %s']);
if(motionHead!==prior.motionHead || motionStatus!==prior.motionStatus || stashes!==prior.stashes)throw Error('Historical Motion state changed');
const verification = {
  schemaVersion:'motion-quality-recovery-verification/1',date:new Date().toISOString(),
  originalCheckpoint:'5569b59',recoveredHead:'d36be32d342c502fabc69898442901e2ebd67667',implementationHead:git(['rev-parse','HEAD']),
  recoveredCommits:['1769cb1','2100f48','d36be32'],recoveredIndex:'empty',preserved,checks,cohorts,localDiagnostics,
  coreRegression:{retainedTests:243,retainedPass:241,retainedFailures:['conditional exchange quota','step-out lateral projection'],resolution:'Both changed test files and focused motion rerun in full; unchanged core tests reuse retained passing evidence.'},
  tactics:{conditions:[...new Set(tactics.rows.map(r=>r.name))],recipesPerCondition:2,complete:true},
  season:{complete:season.complete,managerMatches:season.managerMatches,season:season.season,date:season.date,seasonTwoMatch:!!season.seasonTwoMatch},
  browser:{inventory:{apps:[],browsers:[]},attempts:['Browser is not available: iab','Browser is not available: chrome'],status:'HUMAN QA PENDING',url:'http://127.0.0.1:3012',normalCareer:true,httpSmoke:{path:'/new-game',status:200}},
  worktrees:git(['worktree','list']),motionHead,motionStatus,stashes,historicalMotionStateUnchanged:true,nothingPushed:true,
  acceptance:'Technical verification only; empirical suspension/penalty drift and HBL conversion/save-rate drift remain acceptance risks. Human visual approval is pending.',
};
fs.writeFileSync(`${out}/VERIFICATION.json`,JSON.stringify(verification,null,2)+'\n');
console.log(JSON.stringify({checks:checks.map(c=>({name:c.name,passed:c.passed})),preserved:preserved.length,cohorts:cohorts.map(c=>c.key)}));
if(checks.some(c=>!c.passed))process.exitCode=1;
