import '../../scripts/register-asset-loader.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from '../career/newCareer';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../gameWorld/serverSnapshot';
import { snapshotAllClubsStaff } from '../gameWorld/staffIdentitySnapshot';
import { updatePlayerSquadStatus } from '../career/squadStatus';
import { getCareerSquad } from '../career/careerWorld';
import { approveProposal, delegationOf, rejectProposal, setDelegation, progressDelegation } from '../delegation/delegation';
import { applyAssistantTrainingPlan, buildAssistantTrainingPlan, editAssistantTrainingPlan, progressAssistantTraining, requestAssistantTraining, trainingPlanner } from './assistantTraining';
import { updateTrainingSession } from './trainingSchedule';
import { updateTrainingSessionAction } from '../career/trainingScheduleActions';
import { executeTrainingDay } from './trainingExecution';
import { applyTrainingDayDevelopmentStimulus } from '../development/developmentIntegration';
import { migrateCareerState } from '../career/saveMigration';
import { weeklyManagement } from '../career/weeklyManagement';
import { processDay } from '../career/dailyTick';
import { continueCareerRhythm } from '../career/continueController';
import type { CareerState } from '../career/types';
const club='swe2-tumba',date='2026-08-24';
const initial=createNewCareerState('m6cd-planning',club,snapshotWorldSquads('swe-2'),undefined,snapshotGameplayRatings('swe-2'),snapshotAllClubsStaff('swe-2'));
function career():CareerState{return {...structuredClone(initial),gameDate:date,processedThroughDate:'2026-08-23',trainingWeeks:{}};}
const pending=(s:CareerState)=>Object.values(delegationOf(s).proposals).filter(p=>p.action.kind==='TRAINING_PLAN'&&p.status==='PENDING').at(-1)!;
const planOf=(s:CareerState)=>{const p=pending(s);if(p.action.kind!=='TRAINING_PLAN')throw Error('plan');return p.action.plan;};

test('deterministic, attributed proposal never changes live training, ratings or identities',()=>{
 const s=career(),before=JSON.stringify(s),p=buildAssistantTrainingPlan(s);assert.deepEqual(p,buildAssistantTrainingPlan(s));assert.equal(JSON.stringify(s),before);assert.equal(p.week.days.length,7);assert.ok(p.players.length);assert.ok(p.players.every(x=>!x.selected));
 for(const day of p.week.days){if(s.fixtures.some(f=>f.date===day.date&&(f.homeClubId===club||f.awayClubId===club))){assert.equal(day.dayType,'MATCH');assert.equal(day.sessions.length,0);}}
 const proposed=requestAssistantTraining(s);assert.equal(proposed.trainingWeeks,s.trainingWeeks);assert.equal(proposed.playerTrainingAssignments,s.playerTrainingAssignments);assert.equal(proposed.gameplayRatings,s.gameplayRatings);assert.ok(pending(proposed).staffId);assert.ok(proposed.inbox.some(m=>m.subject.includes('Träningsplan')));assert.equal(requestAssistantTraining(proposed),proposed);assert.ok(weeklyManagement(proposed).decisions.some(d=>d.id===pending(proposed).id&&!d.required));
});
test('manager, advice and delegate modes differ; taking control preserves the live week',()=>{
 const s=career();assert.equal(progressAssistantTraining(s,date,()=>{}),s);const advised=progressAssistantTraining(setDelegation(s,'TRAINING_SCHEDULE','ADVISE'),date,()=>{});assert.equal(advised.trainingWeeks,s.trainingWeeks);
 const d=progressAssistantTraining(setDelegation(s,'TRAINING_SCHEDULE','DELEGATE'),date,()=>{});assert.equal(d.trainingWeeks[date].planning?.source,'ASSISTANT');assert.equal(d.playerTrainingAssignments,s.playerTrainingAssignments);assert.equal(progressAssistantTraining(d,date,()=>{}),d);
 const back=setDelegation(d,'TRAINING_SCHEDULE','MANAGER');assert.equal(back.trainingWeeks,d.trainingWeeks);assert.ok(!Object.values(back.delegation!.proposals).some(p=>p.status==='PENDING'));
});
test('edited drafts persist separately; approval applies only selected individuals',()=>{
 let s=requestAssistantTraining(career());const p=pending(s),player=planOf(s).players[0],day=planOf(s).week.days.find(d=>d.dayType==='TRAINING'&&d.sessions[0]?.type!=='MATCH_PREPARATION')!;assert.ok(day);
 s=editAssistantTrainingPlan(s,p.id,plan=>({...plan,week:updateTrainingSession(plan.week,day.date,day.sessions[0].id,{intensity:'LOW'}),players:plan.players.map(x=>x.playerId===player.playerId?{...x,selected:true,loadSetting:'REDUCED',individualFocus:'DEFENCE'}:x)}));assert.deepEqual(s.trainingWeeks,{});s=JSON.parse(JSON.stringify(s));
 const a=approveProposal(s,p.id);assert.equal(a.delegation!.proposals[p.id].status,'APPROVED');assert.equal(a.trainingWeeks[date].days.find(d=>d.date===day.date)!.sessions[0].intensity,'LOW');assert.equal(a.playerTrainingAssignments[player.playerId].loadSetting,'REDUCED');assert.equal(a.playerTrainingAssignments[player.playerId].individualFocus,'DEFENCE');for(const other of planOf(s).players.filter(x=>x.playerId!==player.playerId))assert.deepEqual(a.playerTrainingAssignments[other.playerId],s.playerTrainingAssignments[other.playerId]);assert.throws(()=>approveProposal(a,p.id));assert.deepEqual(a.gameplayRatings,s.gameplayRatings);
});
test('rejection allows explicit refresh but prevents automatic retry that week',()=>{
 let s=requestAssistantTraining(setDelegation(career(),'TRAINING_SCHEDULE','ADVISE'));s=rejectProposal(s,pending(s).id);assert.equal(progressAssistantTraining(s,date,()=>{}),s);assert.notEqual(pending(requestAssistantTraining(s)).id,Object.keys(s.delegation!.proposals)[0]);
});
test('manual or legacy stored weeks cannot be silently replaced and stale approval is atomic',()=>{
 let s=requestAssistantTraining(career());const p=pending(s),day=planOf(s).week.days.find(d=>d.sessions.length)!;s=updateTrainingSessionAction(s,date,day.date,day.sessions[0].id,{duration:'LONG'});const before=JSON.stringify(s.trainingWeeks);const failed=approveProposal(s,p.id);assert.equal(failed.delegation!.proposals[p.id].status,'FAILED');assert.equal(JSON.stringify(failed.trainingWeeks),before);
 const d=progressAssistantTraining(setDelegation({...career(),trainingWeeks:s.trainingWeeks},'TRAINING_SCHEDULE','DELEGATE'),date,()=>{});assert.equal(JSON.stringify(d.trainingWeeks),before);
});
test('delayed approval preserves completed sessions, results and archives',()=>{
 let s=requestAssistantTraining(career());const id=pending(s).id;s=executeTrainingDay(s,date);s={...s,gameDate:'2026-08-25',processedThroughDate:date};const monday=JSON.stringify(s.trainingWeeks[date].days[0]),history=JSON.stringify(s.seasonHistory),archives=JSON.stringify(s.matchArchives),results=JSON.stringify(s.results);s=approveProposal(s,id);assert.equal(s.delegation!.proposals[id].status,'APPROVED');assert.equal(JSON.stringify(s.trainingWeeks[date].days[0]),monday);assert.equal(JSON.stringify(s.seasonHistory),history);assert.equal(JSON.stringify(s.matchArchives),archives);assert.equal(JSON.stringify(s.results),results);
});
test('changed calendar, individual instruction or employer reject the whole plan',()=>{
 const s=requestAssistantTraining(career()),draft=planOf(s);assert.throws(()=>applyAssistantTrainingPlan({...s,playerClubId:'swe2-huddinge'},draft));const own=s.fixtures.find(f=>f.homeClubId===club||f.awayClubId===club)!;assert.throws(()=>applyAssistantTrainingPlan({...s,fixtures:s.fixtures.map(f=>f.id===own.id?{...f,date}:f)},draft));const p=draft.players[0],selected={...draft,players:draft.players.map(x=>({...x,selected:x.playerId===p.playerId}))};assert.throws(()=>applyAssistantTrainingPlan({...s,playerTrainingAssignments:{...s.playerTrainingAssignments,[p.playerId]:{playerId:p.playerId,loadSetting:'REST'}}},selected));assert.deepEqual(s.trainingWeeks,{});
});
test('medical status, fatigue and existing individual focus affect advice, not standing instructions',()=>{
 const s=career(),[a,b]=getCareerSquad(s);s.playerPhysicalState[a.id]={playerId:a.id,currentEnergy:50,lastUpdatedDate:date,recentLoad:20};s.playerStatuses[b.id]={playerId:b.id,availability:'INJURED',returnDate:'2026-09-01'};s.playerTrainingAssignments[a.id]={playerId:a.id,loadSetting:'FULL',individualFocus:'DEFENCE'};const p=buildAssistantTrainingPlan(s);assert.equal(p.players.find(x=>x.playerId===a.id)!.loadSetting,'RECOVERY_ONLY');assert.equal(p.players.find(x=>x.playerId===a.id)!.individualFocus,'DEFENCE');assert.equal(p.players.find(x=>x.playerId===b.id)!.loadSetting,'REST');assert.equal(s.playerTrainingAssignments[a.id].loadSetting,'FULL');
});
test('staff assessment changes load decisions and existing execution produces the recovery/development tradeoff',()=>{
 const s=career(),planner=trainingPlanner(s)!;assert.ok(planner);for(const p of getCareerSquad(s))s.playerPhysicalState[p.id]={playerId:p.id,currentEnergy:77,lastUpdatedDate:date,recentLoad:0};
 const variant=(q:number):CareerState=>{const v=structuredClone(s);for(const a of Object.values(v.staffRoster[club].find(m=>m.id===planner.id)!.profile.attributes))a.value=q;return v;};
 const weak=variant(1),strong=variant(20),a=buildAssistantTrainingPlan(weak),b=buildAssistantTrainingPlan(strong);assert.equal(a.template,'BALANCED');assert.equal(b.template,'RECOVERY');const doneA=executeTrainingDay({...weak,trainingWeeks:{[date]:a.week}},date),doneB=executeTrainingDay({...strong,trainingWeeks:{[date]:b.week}},date);const id=getCareerSquad(s)[0].id;assert.ok(doneB.playerPhysicalState[id].currentEnergy>doneA.playerPhysicalState[id].currentEnergy);const dev=applyTrainingDayDevelopmentStimulus(doneA,date);assert.ok(Object.values(dev.playerDevelopmentState[id].attributeStimulus).some(x=>x>0));
});
test('departed proposer cannot approve; no staff gives a safe manual fallback',()=>{
 let s=requestAssistantTraining(career());const p=pending(s),old=trainingPlanner(s)!;s={...s,staffRoster:{...s.staffRoster,[club]:s.staffRoster[club].filter(m=>m.id!==old.id)}};assert.throws(()=>approveProposal(s,p.id));s=progressDelegation(s,date,()=>{});assert.equal(s.delegation!.proposals[p.id].status,'WITHDRAWN');if(trainingPlanner(s))assert.notEqual(pending(requestAssistantTraining(s)).staffId,old.id);
 const empty={...career(),staffRoster:{[club]:[]}};assert.equal(trainingPlanner(empty),null);assert.throws(()=>requestAssistantTraining(empty));
});
test('old saves remain manager-controlled; migration preserves proposals, provenance and replay guards',()=>{
 const old=career();delete old.delegation;const m=migrateCareerState(JSON.parse(JSON.stringify(old)));assert.equal(delegationOf(m).settings.TRAINING_SCHEDULE,undefined);assert.equal(progressAssistantTraining(m,date,()=>{}),m);const s=progressAssistantTraining(setDelegation(m,'TRAINING_SCHEDULE','DELEGATE'),date,()=>{}),loaded=migrateCareerState(JSON.parse(JSON.stringify(s)));assert.equal(JSON.stringify(loaded.delegation),JSON.stringify(s.delegation));assert.equal(JSON.stringify(loaded.trainingWeeks),JSON.stringify(s.trainingWeeks));assert.equal(progressAssistantTraining(loaded,date,()=>{}),loaded);
});
test('daily loop plans before Monday execution; required decisions still stop Continue',()=>{
 const next=processDay(setDelegation(career(),'TRAINING_SCHEDULE','DELEGATE'),date).state;assert.equal(next.trainingWeeks[date].planning?.source,'ASSISTANT');assert.equal(next.trainingWeeks[date].days[0].executed,true);assert.ok(next.inbox.some(m=>m.subject.includes('Träningsplan')));const required={...next,careerEvents:[...next.careerEvents,{...next.careerEvents[0],id:'required-test',priority:'ACTION_REQUIRED' as const,requiresAction:true,resolved:false}]};const stopped=continueCareerRhythm(required);assert.equal(stopped.stopReason,'ACTION_REQUIRED_PENDING');assert.equal(stopped.state,required);
});


test('a congested week preserves both fixtures, adjacent preparation and post-match recovery',()=>{
 const s=career(),f=s.fixtures.find(f=>f.homeClubId===club||f.awayClubId===club)!;
 s.fixtures=[{...f,id:'two-matches-a',date:'2026-08-26'},{...f,id:'two-matches-b',date:'2026-08-29'}];
 const plan=buildAssistantTrainingPlan(s);assert.equal(plan.template,'MATCH_HEAVY');
 for(const date of ['2026-08-26','2026-08-29'])assert.equal(plan.week.days.find(d=>d.date===date)!.dayType,'MATCH');
 for(const date of ['2026-08-25','2026-08-28'])assert.equal(plan.week.days.find(d=>d.date===date)!.sessions[0].type,'MATCH_PREPARATION');
 assert.equal(plan.week.days.find(d=>d.date==='2026-08-27')!.dayType,'RECOVERY');
});


test('key and first-choice players receive no automatic individual targeting or instruction changes',()=>{
 let s=career();const players=getCareerSquad(s);
 for(const p of players)s=updatePlayerSquadStatus(s,p.id,p===players[0]?'KEY_PLAYER':'FIRST_CHOICE');
 const plan=buildAssistantTrainingPlan(s);assert.ok(plan.week.days.flatMap(d=>d.sessions).every(session=>session.target!=='SELECTED_PLAYERS'));
 const next=progressAssistantTraining(setDelegation(s,'TRAINING_SCHEDULE','DELEGATE'),date,()=>{});assert.equal(next.playerTrainingAssignments,s.playerTrainingAssignments);
});
