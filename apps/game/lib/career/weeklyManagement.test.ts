import test from 'node:test';
import assert from 'node:assert/strict';
import { weeklyManagement } from './weeklyManagement';
import { createNewCareerState } from './newCareer';
import { getCareerSquad } from './careerWorld';
import { setMatchPlan } from './matchPlanActions';
import { buildDefaultMatchPlan } from '../matchPlan/defaultMatchPlan';
import { buildInitialMatchSquad } from '../matchPlan/careerSquadBridge';
import { isSelectableForMatch } from './playerStatus';
import { addDays } from './dateUtils';
import { migrateCareerState } from './saveMigration';
import { buildMatchdayReadyEvent, type CareerEvent } from './careerEvents';
import { continueCareerRhythm } from './continueController';
import { processDay } from './dailyTick';
import { playManagerFixtureLegacy } from './legacy/matchday';
import { mondayOf, resolveTrainingWeek, setTrainingDayType, setPlayerTrainingLoad, updateTrainingSession } from '../training/trainingSchedule';
import { executeTrainingDay } from '../training/trainingExecution';
import { progressBoard, submitBoardRecoveryPlan } from '../board/board';
import { withEvents } from '../manager/events';
import { answerConcern } from '../players/talks';
import { mediaOf } from '../media/people';
import { dynamicsOf } from '../players/dynamicsState';
import type { CareerState } from './types';

const fresh = () => createNewCareerState('m2-weekly-manager', 'swe2-tumba');
const decision = (s:CareerState,id='weekly-decision'):CareerEvent => ({id,date:s.gameDate,type:'PLAYER_DYNAMICS',priority:'ACTION_REQUIRED',requiresAction:true,resolved:false,read:false,subject:'Playing time discussion',summary:'Answer the player before continuing.',relatedEntities:[],destinations:[],createdAtGameDate:s.gameDate});
const reload = (s:CareerState) => migrateCareerState(JSON.parse(JSON.stringify(s)));

test('rolling seven days crosses Sunday and reflects saved training without mutating career or inventing events',()=>{
  let s={...fresh(),gameDate:'2026-08-23'};
  const start=mondayOf('2026-08-24');
  const week=setTrainingDayType(resolveTrainingWeek(s,start),'2026-08-24','REST');
  s={...s,trainingWeeks:{...s.trainingWeeks,[start]:week}};
  const before=JSON.stringify(s),view=weeklyManagement(s);
  assert.equal(view.days.length,7);assert.equal(view.days[6]!.date,'2026-08-29');
  assert.equal(view.days[1]!.training.dayType,'REST');assert.equal(view.days[1]!.weekStart,start);
  weeklyManagement(s);assert.equal(JSON.stringify(s),before);
  assert.equal(JSON.stringify(weeklyManagement(reload(s)).days.map(d=>d.training)),JSON.stringify(view.days.map(d=>d.training)));
});

test('required inbox decision takes priority over ready match navigation; Continue processes zero days',()=>{
  const base=fresh(),f=base.fixtures.find(f=>f.homeClubId===base.playerClubId||f.awayClubId===base.playerClubId)!;
  const s={...base,gameDate:f.date,careerEvents:[...base.careerEvents,buildMatchdayReadyEvent(f.id,f.date),decision(base)]};
  const view=weeklyManagement(s);
  assert.equal(view.action.kind,'DECISION_BLOCKED');assert.match(view.action.targetHref!,/inbox/);
  assert.equal(view.progression,s.careerEvents.at(-1)!.summary);
  assert.equal(view.decisions.filter(d=>d.required).length,1);
  assert.equal(continueCareerRhythm(s).daysProcessed,0);
  const resolved={...s,careerEvents:s.careerEvents.map(e=>e.id==='weekly-decision'?{...e,resolved:true}:e)};
  assert.ok(['PREPARE_MATCH','START_MATCH'].includes(weeklyManagement(resolved).action.kind));
  const unprocessed={...resolved,careerEvents:resolved.careerEvents.filter(e=>e.type!=='MATCHDAY_READY')};
  assert.equal(weeklyManagement(unprocessed).action.kind,'ADVANCE_DAY');
});

test('match week surfaces incomplete lineup and canonical injured-player availability',()=>{
  const base=fresh(),f=base.fixtures.find(f=>f.homeClubId===base.playerClubId||f.awayClubId===base.playerClubId)!;
  const id=getCareerSquad(base)[0]!.id;
  const s:CareerState={...base,gameDate:f.date,lineupSelection:'MANUAL',playerStatuses:{...base.playerStatuses,[id]:{playerId:id,availability:'INJURED',returnDate:addDays(f.date,7)}}};
  const view=weeklyManagement(s),match=view.days[0]!.fixtures[0]!;
  assert.ok(match.lineupIssues.length>0);assert.equal(match.ready,false);
  assert.equal(view.available,getCareerSquad(s).filter(p=>p.id!==id&&s.playerStatuses[p.id]?.availability!=='INJURED'&&s.playerStatuses[p.id]?.availability!=='SUSPENDED').length);
  assert.equal(view.days[0]!.training.sessions.length,0);
  assert.equal(weeklyManagement({...s,careerEvents:[buildMatchdayReadyEvent(f.id,f.date)]}).action.kind,'PREPARE_MATCH');
});

test('weekly readiness follows an injury and the manager selecting a valid replacement',()=>{
  let s:CareerState={...fresh(),lineupSelection:'MANUAL'};
  const f=s.fixtures.find(f=>f.homeClubId===s.playerClubId||f.awayClubId===s.playerClubId)!;
  const select=(state:CareerState)=>{
    const players=getCareerSquad(state).filter(p=>isSelectableForMatch(state.playerStatuses,p.id));
    const built=buildDefaultMatchPlan(buildInitialMatchSquad(players,f.id,state.playerClubId));
    assert.ok(built.ok&&built.plan);
    return setMatchPlan(state,f.id,built.plan);
  };
  s=select({...s,gameDate:f.date,careerEvents:[...s.careerEvents,buildMatchdayReadyEvent(f.id,f.date)]});
  assert.equal(weeklyManagement(s).action.kind,'START_MATCH');
  assert.deepEqual(weeklyManagement(s).days[0]!.fixtures[0]!.lineupIssues,[]);
  const id=s.matchPlans[f.id]!.attackStartingUnit.slots.find(slot=>slot.position!=='GK')!.playerId;
  s={...s,playerStatuses:{...s.playerStatuses,[id]:{playerId:id,availability:'INJURED'}}};
  assert.equal(weeklyManagement(s).action.kind,'PREPARE_MATCH');
  assert.ok(weeklyManagement(s).days[0]!.fixtures[0]!.lineupIssues.length>0);
  s=reload(select(s));
  assert.equal(weeklyManagement(s).action.kind,'START_MATCH');
  assert.ok(s.matchPlans[f.id]!.attackStartingUnit.slots.every(slot=>slot.playerId!==id));
  assert.deepEqual(weeklyManagement(s).days[0]!.fixtures[0]!.lineupIssues,[]);
});

test('one concern appears once, existing response persists, resolves the decision and changes morale state',()=>{
  let s=fresh();const playerId=getCareerSquad(s)[0]!.id,id='weekly-concern';
  const event={...decision(s,`PLAYER_DYNAMICS:concern:${id}`)};
  s={...s,playerDynamics:{...dynamicsOf(s),concerns:{[id]:{id,playerId,kind:'PLAYING_TIME',raisedOn:s.gameDate,status:'OPEN',message:'My role needs more court time.',options:[{id:'EARN_IT',label:'Earn selection',consequence:'Existing morale response.'}]}}},careerEvents:[...s.careerEvents,event]};
  assert.equal(weeklyManagement(s).discussions,1);assert.equal(weeklyManagement(s).decisions.filter(d=>d.required).length,1);
  assert.match(weeklyManagement(s).decisions.find(d=>d.required)!.href,new RegExp(encodeURIComponent(playerId)));
  const answered=answerConcern(s,id,'EARN_IT'),loaded=reload(answered);
  assert.equal(weeklyManagement(loaded).discussions,0);assert.ok(!weeklyManagement(loaded).decisions.some(d=>d.required));
  assert.equal(loaded.playerDynamics!.concerns[id]!.status,'ANSWERED');
  assert.notDeepEqual(loaded.playerDynamics!.morale,s.playerDynamics!.morale);
  assert.deepEqual(loaded.playerDynamics,answered.playerDynamics);
});

test('board response uses existing recovery plan and survives reload without duplicate unresolved meetings',()=>{
  let s=fresh();s={...s,gameDate:'2026-11-01',board:{...s.board!,confidence:36,pressureStage:'CONCERN'},media:{...mediaOf(s),boardMood:-6}};
  const results={...s.results};
  for(const f of s.fixtures.filter(f=>f.type==='LEAGUE'&&f.date<=s.gameDate)){const homeWins=f.homeClubId!==s.playerClubId;results[f.id]={homeClubId:f.homeClubId,awayClubId:f.awayClubId,homeGoals:homeWins?35:20,awayGoals:homeWins?20:35} as never;}
  s={...s,results};
  const events:CareerEvent[]=[];
  s=withEvents(progressBoard(s,s.gameDate,e=>events.push(e),x=>x),events);
  const meeting=s.board!.meetings.find(m=>m.kind==='WARNING')!;assert.ok(meeting);
  assert.equal(weeklyManagement(s).action.targetHref,'/career/board');
  s=submitBoardRecoveryPlan(s,meeting.id);
  const view=weeklyManagement(reload(s));assert.equal(view.recoveryPlan!.status,'ACTIVE');assert.equal(view.reviewDate,'2026-12-01');
  assert.ok(!view.decisions.some(d=>d.id===`BOARD_UPDATE:${meeting.id}`));
  assert.equal(JSON.stringify(view.board),JSON.stringify(s.board));
});

test('near deadlines use current contracts; completed season exposes no fabricated weekly plan',()=>{
  let s=fresh();const id=getCareerSquad(s)[0]!.id;
  s={...s,playerContracts:{...s.playerContracts,[id]:{...s.playerContracts[id]!,contractEndDate:addDays(s.gameDate,3)}}};
  assert.ok(weeklyManagement(s).decisions.some(d=>d.id===`contract:${id}`));
  const gone={...s,playerContracts:{...s.playerContracts,[id]:{...s.playerContracts[id]!,clubId:'different-club'}}};
  assert.ok(!weeklyManagement(gone).decisions.some(d=>d.id===`contract:${id}`));
  assert.equal(weeklyManagement({...s,seasonComplete:true}).days.length,0);
});

test('four-week career smoke: persisted priorities, daily execution, matchday hard stops, feedback and reload',()=>{
  // Uses the historical adapter only for quick match resolution. Native kickoff/restoration
  // remains covered by contextualContinueAction/productionMatch regressions.
  let s=fresh();const first=s.gameDate,end=addDays(first,27),playerId=getCareerSquad(s)[0]!.id;
  const trace:unknown[]=[];let matches=0,days=0;
  while(s.processedThroughDate<end){
    const date=addDays(s.processedThroughDate,1),dayIndex=Math.round((Date.parse(date)-Date.parse(first))/86400000);
    if(dayIndex%7===0){
      const start=mondayOf(date);let week=resolveTrainingWeek(s,start);
      const day=week.days.find(d=>d.date>=date&&d.sessions.length>0);
      if(day)week=updateTrainingSession(week,day.date,day.sessions[0]!.id,{type:dayIndex<14?'TEAM_TACTICAL':'RECOVERY',intensity:'LOW'});
      s=setPlayerTrainingLoad({...s,trainingWeeks:{...s.trainingWeeks,[start]:week}},playerId,dayIndex<14?'REDUCED':'RECOVERY_ONLY');
      trace.push({week:dayIndex/7+1,date,priority:dayIndex<14?'TEAM_TACTICAL':'RECOVERY',confidence:weeklyManagement(s).board.confidence});
    }
    assert.equal(continueCareerRhythm({...s,careerEvents:[...s.careerEvents,decision(s,'smoke-block')]}).daysProcessed,0);
    const tick=processDay(s,date);s=tick.state;days++;
    assert.equal(s.processedThroughDate,date);
    assert.deepEqual(executeTrainingDay(s,date).trainingWeeks,s.trainingWeeks,'reading/continuing must not repeat completed training');
    const pending=s.careerEvents.filter(e=>e.requiresAction&&!e.resolved);
    assert.ok(pending.every(e=>e.type==='MATCHDAY_READY'),'unexpected required decision must be explicitly handled, never bypassed');
    if(pending.length){
      assert.equal(continueCareerRhythm(s).daysProcessed,0);
      const played=playManagerFixtureLegacy(s);assert.ok(played.result);s=played.state;matches++;
    }
    const loaded=reload(s);assert.equal(JSON.stringify(weeklyManagement(loaded).days),JSON.stringify(weeklyManagement(s).days));s=loaded;
    assert.equal(new Set(s.careerEvents.map(e=>e.id)).size,s.careerEvents.length);
  }
  assert.equal(days,28);assert.equal(trace.length,4);assert.ok(matches>=3);
  assert.equal(s.playerTrainingAssignments[playerId]!.loadSetting,'RECOVERY_ONLY');
  assert.ok(s.careerEvents.some(e=>e.type==='TRAINING_REPORT'));
  assert.ok(weeklyManagement(s).feedback.length>0);
  console.log(JSON.stringify({scenario:'M2 four-week career',from:first,through:s.gameDate,days,matches,weeks:trace}));
});
