import { createSave, saveCareerState, getSave, getMatchArchiveById } from '../lib/save/saveRepository';
import { storeMatchArchive } from '../lib/save/matchArchiveStorage';
import { withoutReplayPayloads } from '../lib/career/matchArchiveSummary';
import { acceptBoardContract } from '../lib/manager/managerCareer';
import { answerConcern } from '../lib/players/talks';
import { submitBoardRecoveryPlan } from '../lib/board/board';
import { withoutNationalDuty } from '../lib/nationalTeam/duty';
import { getCareerSquad } from '../lib/career/careerWorld';
import { isSelectableForMatch } from '../lib/career/playerStatus';
import { resolveClubMatchPlanForFixture } from '../lib/career/playerMatchStrength';
import { getPlayerFixtureOn } from '../lib/career/calendar';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createNewCareerState } from '../lib/career/newCareer';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../lib/gameWorld/serverSnapshot';
import { SWEDISH_WORLD_COMPETITION_IDS } from '../lib/career/worldCompetitions';
import { continueCareerRhythm } from '../lib/career/continueController';
import { playManagerFixture } from '../lib/career/matchdayAction';
import { attemptSeasonTransition } from '../lib/career/seasonTransition';
import { migrateCareerState } from '../lib/career/saveMigration';
import { renewPlayerContract } from '../lib/career/contractRenewal';
import { intentionMinimumWage } from '../lib/players/intentions';
import { hasCompetitionSquad } from '../lib/competition/transition/gameContinuity';
import { cooperationEligibility } from '../lib/competition/transition/cooperationEligibility';
import { competitionClubIds } from '../lib/competition/tables';
import { SWEDISH_2026_RULES } from '../lib/competition/transition/sweden2026';
import { getClub } from '../lib/game-data';

async function main() {
const dir=process.env.HM_SEASON_QA_DIR;
assert.ok(dir,'Set HM_SEASON_QA_DIR to a C:/DEV/QA/reports directory');mkdirSync(dir,{recursive:true});
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)??'null').digest('hex');
const checkpoint=join(dir,'division2-stock-career-checkpoint.json');
const pending=join(dir,'division2-stock-career-pending.json');
let s:import('../lib/career/types').CareerState;
if(process.argv.includes('--resume')){
 assert.ok(existsSync(checkpoint),'Existing checkpoint required; never restart a continuation');
 const source=process.argv.includes('--recover-pending')&&existsSync(pending)?pending:checkpoint;
 s=migrateCareerState(JSON.parse(readFileSync(source,'utf8')));
}else{
 const squads=Object.assign({},...SWEDISH_WORLD_COMPETITION_IDS.map(snapshotWorldSquads));
 const ratings=Object.assign({},...SWEDISH_WORLD_COMPETITION_IDS.map(snapshotGameplayRatings));
 s=createNewCareerState('m12-promotion-stock-v1','swe2-tumba',squads,undefined,ratings,{},'FIRST_MATCH');
 assert.ok(!Object.values(s.worldSquads).flat().some(p=>p.generatedOrigin));
}
const priorReport=process.argv.includes('--resume')&&existsSync(join(dir,'division2-stock-career.json'))?JSON.parse(readFileSync(join(dir,'division2-stock-career.json'),'utf8')):undefined;
const summaries:unknown[]=priorReport?.summaries??[],historyHashes:string[]=(s.seasonHistory??[]).map(hash);
const archiveDir=join(dir,'match-archives');mkdirSync(archiveDir,{recursive:true});
const archiveManifest=join(dir,'production-match-hashes.json');
const archiveHashes:Record<string,string>=existsSync(archiveManifest)?JSON.parse(readFileSync(archiveManifest,'utf8')):{};
const archivePath=(id:string)=>join(archiveDir,`${encodeURIComponent(id)}.json`);
const save=await createSave({selectedNations:['SWE'],selectedCompetitionIds:SWEDISH_WORLD_COMPETITION_IDS,clubId:s.playerClubId,manager:{name:'Stock validation manager',nationality:'SWE',dateOfBirth:'1985-01-01'},gameDate:s.gameDate},async()=>withoutReplayPayloads(s));
// Node uses the repository's shipped non-browser backend. Disk records make the
// same separated career/archive representation resumable without touching browser saves.
for(const id of s.matchArchiveIds??[]){assert.ok(existsSync(archivePath(id)),`Missing persisted archive ${id}`);const a=JSON.parse(readFileSync(archivePath(id),'utf8'));assert.equal(hash(a),archiveHashes[id]);await storeMatchArchive(save.saveId,a);}
const identityPath=join(dir,'generated-player-identities.json');
const identities:Record<string,unknown>=existsSync(identityPath)?JSON.parse(readFileSync(identityPath,'utf8')):{};
function verifyGeneratedIdentities(){
 const players=Object.values(s.worldSquads).flat(),byId=new Map(players.map(p=>[p.id,p]));
 assert.equal(byId.size,players.length,'unique persistent player registration');
 for(const [id,identity] of Object.entries(identities)){
  const p=byId.get(id);assert.ok(p,`Persistent generated identity disappeared: ${id}`);
  assert.deepEqual({id:p.id,firstName:p.firstName,lastName:p.lastName,dateOfBirth:p.dateOfBirth,generatedOrigin:p.generatedOrigin},identity);
 }
 for(const p of players.filter(p=>p.generatedOrigin))identities[p.id]={id:p.id,firstName:p.firstName,lastName:p.lastName,dateOfBirth:p.dateOfBirth,generatedOrigin:p.generatedOrigin};
 writeFileSync(identityPath,JSON.stringify(identities,null,2));
}
async function persist() {
 verifyGeneratedIdentities();
 writeFileSync(pending,JSON.stringify(s));
 for(const [id,a] of Object.entries(s.matchArchives??{})){
  const value=hash(a);if(archiveHashes[id])assert.equal(value,archiveHashes[id],'immutable production archive');
  if(!existsSync(archivePath(id)))writeFileSync(archivePath(id),JSON.stringify(a));
  assert.equal(hash(JSON.parse(readFileSync(archivePath(id),'utf8'))),value);archiveHashes[id]=value;
 }
 writeFileSync(archiveManifest,JSON.stringify(archiveHashes,null,2));
 await saveCareerState(save.saveId,s);
 const stored=await getSave(save.saveId);assert.ok(stored?.careerState);
 const expected=withoutReplayPayloads(s),loaded=migrateCareerState(JSON.parse(JSON.stringify(stored.careerState)));
 assert.deepEqual(loaded.worldSquads,expected.worldSquads);assert.deepEqual(loaded.playerContracts,expected.playerContracts);assert.deepEqual(loaded.gameplayRatings,expected.gameplayRatings);
 for(const key of ['playerInjuries','playerDevelopmentState','playerLifecycleYears','worldDevelopmentPeriods','loans','transferOffers','playerStatuses','clubPartnerships'] as const)assert.equal(hash(loaded[key]),hash(expected[key]),`reload preserves ${key}`);
 assert.deepEqual(loaded.matchArchiveIds,expected.matchArchiveIds);assert.deepEqual(loaded.matchArchiveSummaries,expected.matchArchiveSummaries);
 for(const [id,history] of Object.entries(expected.playerClubHistory))assert.equal(hash(loaded.playerClubHistory[id]),hash(history),`reload preserves existing club history ${id}`);
 s=loaded;writeFileSync(checkpoint,JSON.stringify(s));writeFileSync(archiveManifest,JSON.stringify(archiveHashes,null,2));
}
await persist();
let matches=(s.matchArchiveIds??[]).length,lastMonth='';
try {
 for(let season=summaries.length;season<3;season++) {
  const from=s.seasonId;
  if(s.board?.contractOffer&&s.board.contractOffer.expiresOn>=s.gameDate)s=acceptBoardContract(s);
  for(let guard=0;guard<2000&&!s.seasonComplete;guard++) {
   if(s.board?.contractOffer&&s.board.contractOffer.expiresOn>=s.gameDate)s=acceptBoardContract(s);
   // Ordinary manager retention decisions; CPU clubs use their unmodified daily lifecycle.
   for(const p of s.worldSquads[s.playerClubId]??[]) {
    const c=s.playerContracts[p.id];
    if(c&&c.contractEndDate<=`${Number(s.gameDate.slice(0,4))+1}-05-31`&&c.contractEndDate>=s.gameDate) {
     try{s=renewPlayerContract(s,p.id,3,Math.max(c.wageEurPerMonth,intentionMinimumWage(s,p.id)));}catch{/* Normal refusal or budget constraint; no save edits. */}
    }
   }
   const press=continueCareerRhythm(s);s=press.state;await persist();
   if(s.gameDate.slice(0,7)!==lastMonth){lastMonth=s.gameDate.slice(0,7);console.log(JSON.stringify({date:s.gameDate,season:s.seasonId,matches,stop:press.stopReason}));}
   if(press.stopReason==='ACTION_REQUIRED'||press.stopReason==='ACTION_REQUIRED_PENDING') {
    let handled=false;
    for(const c of Object.values(s.playerDynamics?.concerns??{}).filter(c=>c.status==='OPEN')){const option=c.options.find(o=>['EARN_IT','PATIENCE','LATER'].includes(o.id))??c.options[0];if(option){s=answerConcern(s,c.id,option.id);handled=true;}}
    for(const m of s.board?.meetings??[]){if(s.careerEvents.some(e=>e.id===`BOARD_UPDATE:${m.id}`&&e.requiresAction&&!e.resolved)&&['WARNING','FINAL_WARNING'].includes(m.kind)){s=submitBoardRecoveryPlan(s,m.id);handled=true;}}
    const fixture=getPlayerFixtureOn(s,s.gameDate);
    if(!fixture&&handled){await persist();continue;}
    if(fixture){const available=withoutNationalDuty(s,getCareerSquad(s).filter(p=>isSelectableForMatch(s.playerStatuses,p.id)));const plan=resolveClubMatchPlanForFixture(s.playerClubId,fixture.id,available,undefined);assert.ok(plan,'manager can select a valid available seven');s={...s,matchPlans:{...s.matchPlans,[fixture.id]:plan}};}
    const action=playManagerFixture(s);assert.ok(action.result,JSON.stringify({date:s.gameDate,pending:s.careerEvents.filter(e=>e.requiresAction&&!e.resolved),seekingJob:s.managerCareer?.seekingJob}));s=action.state;matches++;console.log('MATCH '+JSON.stringify({date:s.gameDate,score:[action.result.homeGoals,action.result.awayGoals]}));await persist();
   }
   assert.notEqual(press.stopReason,'CALENDAR_CONFLICT');
   assert.ok(s.gameDate<=`${Number(from.slice(0,4))+1}-07-01`,'season exceeded deadline');
  }
  assert.ok(s.seasonComplete,JSON.stringify({season:s.seasonId,date:s.gameDate,outcome:s.seasonOutcome}));
  const before=hash(s),oldResults=hash(s.results),oldFixtures=hash(s.fixtures),oldArchives=hash([s.matchArchiveIds,s.matchArchiveSummaries]),oldPlayers=Object.values(s.worldSquads).flat(),oldContracts=s.playerContracts;
  const transition=attemptSeasonTransition(s);
  assert.equal(transition.status,'APPLIED',JSON.stringify(transition.blockers));
  assert.equal(hash(s),before,'atomic input unchanged');
  const next=transition.state;assert.equal(hash([next.matchArchiveIds,next.matchArchiveSummaries]),oldArchives);
  const promotions=transition.preview!.proposal.directPromotions.concat(transition.preview!.proposal.qualificationMovements).filter(c=>c.kind==='PROMOTION'&&c.fromFamilyId==='se-men-tier-4-boundary');
  assert.ok(promotions.length>0);
  const generated=Object.values(next.worldSquads).flat().filter(p=>p.generatedOrigin?.seasonId===next.seasonId);
  for(const c of promotions){assert.ok(hasCompetitionSquad(next,c.clubId));assert.ok(cooperationEligibility(s,c.clubId,3,s.gameDate).eligible);}
  for(const p of generated)assert.ok(next.playerContracts[p.id]!.contractEndDate>=next.leagueKickoffDate!,'new generated contracts cover kickoff');
  for(const c of SWEDISH_2026_RULES.leagues){assert.equal(competitionClubIds(next,c.id).length,c.size);for(const id of competitionClubIds(next,c.id))assert.ok(cooperationEligibility(s,id,SWEDISH_2026_RULES.families.find(f=>f.id===c.familyId)!.tier,s.gameDate).eligible);}
  for(const p of oldPlayers)assert.deepEqual(next.worldSquads[p.clubId]!.find(x=>x.id===p.id),p);
  for(const [id,c] of Object.entries(oldContracts))assert.deepEqual(next.playerContracts[id],c);
  const ids=Object.values(next.worldSquads).flat().map(p=>p.id);assert.equal(new Set(ids).size,ids.length);
  const archive=next.seasonHistory!.at(-1)!;assert.equal(hash(archive.results),oldResults);assert.equal(hash(archive.fixtures),oldFixtures);
  historyHashes.push(hash(archive));
  const loaded=migrateCareerState(JSON.parse(JSON.stringify(next)));
  assert.deepEqual(loaded.seasonHistory!.map(hash),historyHashes);
  assert.equal(hash([loaded.matchArchiveIds,loaded.matchArchiveSummaries]),oldArchives);assert.deepEqual(loaded.worldSquads,next.worldSquads);assert.deepEqual(loaded.playerContracts,next.playerContracts);
  assert.equal(attemptSeasonTransition(loaded,JSON.parse(transition.receipt!.requestKey)).status,'ALREADY_APPLIED');
  const summary={from,to:next.seasonId,date:s.gameDate,promoted:promotions.map(c=>({id:c.clubId,name:getClub(c.clubId)?.name,to:c.toCompetitionId,generated:generated.filter(p=>p.clubId===c.clubId).length})),generated:generated.length,results:Object.keys(s.results).length,managerMatches:matches,leagueSizes:Object.fromEntries(SWEDISH_2026_RULES.leagues.map(l=>[l.id,competitionClubIds(next,l.id).length]))};
  summaries.push(summary);s=loaded;await persist();console.log('ROLLOVER '+JSON.stringify(summary));
  writeFileSync(join(dir,'division2-stock-career.json'),JSON.stringify({status:season===2?'PASS':'RUNNING',summaries,productionArchives:matches,storage:'Existing saveRepository with separate immutable archives'},null,2));
 }
 for(const [id,value] of Object.entries(archiveHashes)){const archive=await getMatchArchiveById(id,save.saveId);assert.ok(archive);assert.equal(hash(archive),value);assert.equal(hash(JSON.parse(readFileSync(archivePath(id),'utf8'))),value);}
 const nextStart=continueCareerRhythm(s);assert.ok(nextStart.daysProcessed>0,'next season processes normal days');assert.notEqual(nextStart.stopReason,'CALENDAR_CONFLICT');s=nextStart.state;await persist();
 const activeClubIds=SWEDISH_2026_RULES.leagues.flatMap(l=>competitionClubIds(s,l.id));assert.equal(new Set(activeClubIds).size,52);
 const unplayable=activeClubIds.filter(id=>!hasCompetitionSquad(s,id));assert.deepEqual(unplayable,[],'all active clubs have registered playable squads');
 const baselinePath=join(dir,'historical-match-hashes.json');
 if(existsSync(baselinePath)){for(const [id,value] of Object.entries(JSON.parse(readFileSync(baselinePath,'utf8'))))assert.equal(archiveHashes[id],value,'original historical production archive unchanged');}
 const finalReport=JSON.parse(readFileSync(join(dir,'division2-stock-career.json'),'utf8'));
 writeFileSync(join(dir,'division2-stock-career.json'),JSON.stringify({...finalReport,status:'PASS',nextSeasonStart:{season:s.seasonId,date:s.gameDate,daysProcessed:nextStart.daysProcessed,stopReason:nextStart.stopReason},productionArchives:Object.keys(archiveHashes).length,generatedIdentityCount:Object.keys(identities).length,allActiveClubsPlayable:true,historicalArchivesVerified:true},null,2));
 console.log('HISTORICAL_ARCHIVES_PASS '+Object.keys(archiveHashes).length);
}catch(error){writeFileSync(pending,JSON.stringify(s));writeFileSync(join(dir,'division2-stock-career.json'),JSON.stringify({status:'PARTIAL',summaries,date:s.gameDate,season:s.seasonId,error:String(error)},null,2));throw error;}

}
void main();
