import './register-asset-loader.cjs';
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { createNewCareerState } from '../lib/career/newCareer';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../lib/gameWorld/serverSnapshot';
import { snapshotAllClubsStaff } from '../lib/gameWorld/staffIdentitySnapshot';
import { continueCareerRhythm } from '../lib/career/continueController';
import { getCareerSquad } from '../lib/career/careerWorld';
import { setDelegation, approveProposal } from '../lib/delegation/delegation';
import { editAssistantTrainingPlan } from '../lib/training/assistantTraining';
import { updateTrainingSession, mondayOf } from '../lib/training/trainingSchedule';
import { playManagerFixture } from '../lib/career/matchdayAction';
import { buildInitialMatchSquad } from '../lib/matchPlan/careerSquadBridge';
import { buildDefaultMatchPlan } from '../lib/matchPlan/defaultMatchPlan';
import { setMatchPlan } from '../lib/career/matchPlanActions';
import { isSelectableForMatch } from '../lib/career/playerStatus';
import { answerConcern } from '../lib/players/talks';
import { submitBoardRecoveryPlan } from '../lib/board/board';
import { delegatePress, openPressConferences } from '../lib/media/press';
import { withEvents } from '../lib/manager/events';
import { createSave, getSave, saveCareerState, getMatchArchiveById, __setSaveBackendForTests } from '../lib/save/saveRepository';
import { createMemoryBackend } from '../lib/save/saveStorage';
import { migrateCareerState } from '../lib/career/saveMigration';
import type { CareerEvent } from '../lib/career/careerEvents';
import { addDays } from '../lib/career/dateUtils';

async function main(){
const out=process.env.M6CD_QA_DIR??'C:/DEV/QA/reports/handball-m6cd-training';fs.mkdirSync(out,{recursive:true});
const comps=['se_handbollsligan_herr','swe-2','se_division1_norra','se_division1_sodra'];
const squads=Object.assign({},...comps.map(c=>snapshotWorldSquads(c))),ratings=Object.assign({},...comps.map(c=>snapshotGameplayRatings(c))),staff=Object.assign({},...comps.map(c=>snapshotAllClubsStaff(c)));
let s=createNewCareerState('m6cd-normal-career','swe2-tumba',squads,undefined,ratings,staff,'4_WEEKS');
const from=s.gameDate,until=addDays(from,56);s=setDelegation(s,'TRAINING_SCHEDULE','ADVISE');
__setSaveBackendForTests(createMemoryBackend());const save=await createSave({selectedNations:['SWE'],selectedCompetitionIds:['swe-2'],clubId:s.playerClubId,manager:{name:'M6CD local QA',nationality:'SWE',dateOfBirth:'1980-01-01'},gameDate:s.gameDate});
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const hashes:Record<string,string>={},trace:unknown[]=[];const seen=new Set<string>();let games=0,reloads=0,guard=0,edits=0;
const identity=Object.values(s.worldSquads).flat().map(p=>[p.id,p.firstName,p.lastName,p.birthYear]);
fs.mkdirSync(path.join(out,'archives'),{recursive:true});
while(s.gameDate<until&&guard++<500){
 for(const p of Object.values(s.delegation?.proposals??{}))if(p.status==='PENDING'&&p.action.kind==='TRAINING_PLAN'&&p.action.plan.week.weekStart===mondayOf(s.gameDate)){
   const day=p.action.plan.week.days.find(d=>!d.executed&&d.date>s.processedThroughDate&&d.sessions.length&&d.sessions[0].type!=='MATCH_PREPARATION');
   s=editAssistantTrainingPlan(s,p.id,plan=>({...plan,week:day?updateTrainingSession(plan.week,day.date,day.sessions[0].id,{intensity:'LOW'}):plan.week,players:plan.players.map((x,i)=>({...x,selected:i===0,loadSetting:i===0?'REDUCED':x.loadSetting,individualFocus:i===0?'TECHNICAL':x.individualFocus}))}));
   s=approveProposal(s,p.id);assert.equal(s.delegation!.proposals[p.id].status,'APPROVED',s.delegation!.proposals[p.id].outcome);edits++;
 }
 const week=mondayOf(s.gameDate);if(!seen.has(week)){
   seen.add(week);console.log(JSON.stringify({week,date:s.gameDate,games}));trace.push({date:s.gameDate,week,mode:s.delegation?.settings.TRAINING_SCHEDULE?.mode,energy:getCareerSquad(s).map(p=>({id:p.id,energy:s.playerPhysicalState[p.id]?.currentEnergy??100})),plans:Object.values(s.delegation?.proposals??{}).filter(p=>p.action.kind==='TRAINING_PLAN').map(p=>({id:p.id,status:p.status})),development:Object.values(s.playerDevelopmentState).reduce((n,p)=>n+Object.values(p.attributeProgress).reduce((a,v)=>a+(v??0),0),0)});
   if(seen.size===4)s=setDelegation(s,'TRAINING_SCHEDULE','DELEGATE');
 }
 const req=s.careerEvents.find(e=>e.requiresAction&&!e.resolved);
 if(req){
   if(req.type==='PLAYER_DYNAMICS'){const c=Object.values(s.playerDynamics?.concerns??{}).find(c=>c.status==='OPEN');assert.ok(c,req.subject);s=answerConcern(s,c.id,c.options[0].id);continue;}
   if(req.type==='BOARD_UPDATE'){const m=s.board?.meetings.find(m=>['WARNING','FINAL_WARNING'].includes(m.kind)&&!s.board?.recoveryPlans?.some(p=>p.meetingId===m.id));assert.ok(m,req.subject);s=submitBoardRecoveryPlan(s,m.id);continue;}
   assert.equal(req.type,'MATCHDAY_READY',JSON.stringify({date:s.gameDate,event:req}));
   const fixture=s.fixtures.find(f=>f.date===s.gameDate&&!s.results[f.id]&&(f.homeClubId===s.playerClubId||f.awayClubId===s.playerClubId));assert.ok(fixture);
   const available=getCareerSquad(s).filter(p=>isSelectableForMatch(s.playerStatuses,p.id));const lineup=buildDefaultMatchPlan(buildInitialMatchSquad(available,fixture.id,s.playerClubId),s.tactics[s.playerClubId],s.playerMatchDefaults);assert.ok(lineup.ok&&lineup.plan);s=setMatchPlan(s,fixture.id,lineup.plan!);
   const result=playManagerFixture(s);assert.equal(result.result?.engine,'V2');s=result.state;games++;
 }
 for(const press of openPressConferences(s)){const events:CareerEvent[]=[];s=delegatePress(s,press.id,e=>events.push(e));s=withEvents(s,events);}
 await saveCareerState(save.saveId,s);
 for(const id of s.matchArchiveIds??Object.keys(s.matchArchives??{})){const a=await getMatchArchiveById(id,save.saveId);assert.ok(a);const h=hash(a);if(hashes[id])assert.equal(h,hashes[id]);else {hashes[id]=h;fs.writeFileSync(path.join(out,'archives',encodeURIComponent(id)+'.json.gz'),gzipSync(JSON.stringify(a),{level:1}));}}
 const loaded=(await getSave(save.saveId))!.careerState!;assert.equal(hash(loaded.trainingWeeks),hash(s.trainingWeeks));assert.equal(hash(loaded.delegation),hash(s.delegation));assert.equal(hash(loaded.results),hash(s.results));s=migrateCareerState(loaded);reloads++;fs.writeFileSync(path.join(out,'career-progress.json.gz'),gzipSync(JSON.stringify(s),{level:1}));
 const progress=continueCareerRhythm(s);assert.notEqual(progress.stopReason,'CALENDAR_CONFLICT');s=progress.state;
}
assert.ok(s.gameDate>=until,'56 days progressed normally');assert.ok(games>0);assert.ok(seen.size>=8);assert.ok(edits>=3);
const finalPlayers=Object.values(s.worldSquads).flat(),byId=new Map(finalPlayers.map(p=>[p.id,[p.id,p.firstName,p.lastName,p.birthYear]]));
assert.equal(byId.size,finalPlayers.length,'unique persistent player IDs');for(const p of identity)assert.deepEqual(byId.get(p[0] as string),p,'identity retained by ID through normal transfers');
const days=Object.values(s.trainingWeeks).flatMap(w=>w.days).filter(d=>d.executed),sessionResults=days.flatMap(d=>d.results??[]);
assert.ok(sessionResults.length>0);assert.ok(Object.values(s.playerDevelopmentState).some(p=>Object.values(p.attributeProgress).some(v=>(v??0)>0)||p.developmentHistory.length));
const result={status:'PASS',from,to:s.gameDate,weeks:seen.size,managerMatches:games,planApprovalsAndEdits:edits,repositoryReloads:reloads,executedDays:days.length,sessions:sessionResults.length,measuredCoachingQuality:[Math.min(...sessionResults.map(r=>r.resolvedStaffQuality??1)),Math.max(...sessionResults.map(r=>r.resolvedStaffQuality??1))],visibleAttributeChanges:Object.values(s.playerDevelopmentState).reduce((n,p)=>n+p.developmentHistory.length,0),archiveHashes:hashes,canonicalIdentitiesUnchanged:true,trace};
fs.writeFileSync(path.join(out,'career-scenario.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(out,'career-checkpoint.json.gz'),gzipSync(JSON.stringify(s)));console.log(JSON.stringify({...result,trace:undefined,archiveHashes:Object.keys(hashes).length}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
