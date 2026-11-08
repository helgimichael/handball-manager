import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from '../career/newCareer';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../gameWorld/serverSnapshot';
import { ensureClubFinances } from '../economy/ledger';
import { competitionClubIds } from '../competition/tables';
import { HANDBOLLSLIGAN } from '../competition/rules';
import { boardPressureStage, boardSeasonEnd, buildObjectives, confidenceFactors, ensureBoard, predictedPositionOf, progressBoard, submitBoardRecoveryPlan } from './board';
import { dismissManager, ensureManagerCareer, openOffers } from '../manager/managerCareer';
import { acceptJobOffer } from '../manager/changeClub';
import { withEvents } from '../manager/events';
import { continueCareerRhythm } from '../career/continueController';
import { processDay } from '../career/dailyTick';
import { resolveContextualContinueAction } from '../career/contextualContinueAction';
import { startProductionMatch } from '../career/productionMatch';
import { playManagerFixtureLegacy } from '../career/legacy/matchday';
import { migrateCareerState } from '../career/saveMigration';
import { buildMatchdayReadyEvent, type CareerEvent } from '../career/careerEvents';
import type { CareerState } from '../career/types';

const squads = snapshotWorldSquads(HANDBOLLSLIGAN), ratings = snapshotGameplayRatings(HANDBOLLSLIGAN);
const seed = createNewCareerState('m14-deterministic','se_club_ifk_skovde_hk',squads,undefined,ratings);
const ranked = competitionClubIds(seed,HANDBOLLSLIGAN).sort((a,b)=>predictedPositionOf(seed,a,HANDBOLLSLIGAN)-predictedPositionOf(seed,b,HANDBOLLSLIGAN));
function career(clubId=ranked[0]!) {
  return ensureManagerCareer(ensureClubFinances(createNewCareerState('m14-deterministic',clubId,squads,undefined,ratings),'2026-08-19'));
}
function resultsThrough(s: CareerState,date: string,win: boolean): CareerState {
  const results = {...s.results};
  for (const f of s.fixtures.filter(f=>f.type==='LEAGUE'&&f.date<=date)) {
    if (results[f.id]) continue;
    const ownHome = f.homeClubId===s.playerClubId, ownAway=f.awayClubId===s.playerClubId;
    const homeWins = ownHome ? win : ownAway ? !win : true;
    results[f.id]={homeClubId:f.homeClubId,awayClubId:f.awayClubId,homeGoals:homeWins?35:20,awayGoals:homeWins?20:35} as never;
  }
  return {...s,gameDate:date,results};
}
function review(s: CareerState,date: string,win?: boolean) {
  const events: CareerEvent[]=[];
  s = win === undefined ? {...s,gameDate:date} : resultsThrough(s,date,win);
  return withEvents(progressBoard(s,date,e=>events.push(e),(x,reason)=>dismissManager(x,date,reason,e=>events.push(e))),events);
}
function pending(s: CareerState) {return s.board!.meetings.find(m=>s.careerEvents.some(e=>e.id===`BOARD_UPDATE:${m.id}`&&e.requiresAction&&!e.resolved));}
function warning() {
  let s=career();s={...s,board:{...s.board!,confidence:36,pressureStage:'CONCERN'}};
  return review(s,'2026-11-01',false);
}

test('objectives exist at creation, explain resources, and react to resources/history/financial condition',()=>{
  const strong=career(),weak=career(ranked.at(-1)!);
  assert.ok(strong.board!.objectives.find(o=>o.kind==='LEAGUE')!.target < weak.board!.objectives.find(o=>o.kind==='LEAGUE')!.target);
  assert.ok(strong.inbox.some(m=>m.careerEventId?.startsWith('BOARD_UPDATE:')));
  assert.ok(strong.board!.objectives.some(o=>o.kind==='FINANCE'));
  assert.match(buildObjectives({...strong,clubEconomies:{}},strong.playerClubId).objectives[0]!.why,/budget saknas/);
  const healthy=buildObjectives(strong,strong.playerClubId);
  const crisis={...strong,clubFinances:{...strong.clubFinances,[strong.playerClubId]:{...strong.clubFinances![strong.playerClubId]!,status:'CRISIS' as const}}};
  const adjusted=buildObjectives(crisis,strong.playerClubId);
  assert.ok(adjusted.predicted>=healthy.predicted);
  assert.match(adjusted.objectives[0]!.why,/budget/);
  const table=competitionClubIds(strong,HANDBOLLSLIGAN).filter(id=>id!==strong.playerClubId).concat(strong.playerClubId).map(clubId=>({clubId} as never));
  const previous={...strong,seasonHistory:[{seasonId:'2025/26',competitionId:HANDBOLLSLIGAN,table,stats:{}}]};
  assert.match(buildObjectives(previous,strong.playerClubId).objectives[0]!.why,/2025|s.songen/);
  assert.ok(buildObjectives(previous,strong.playerClubId).predicted>=healthy.predicted);
  const economy=weak.clubEconomies[weak.playerClubId]!;
  const funded={...weak,clubEconomies:{...weak.clubEconomies,[weak.playerClubId]:{...economy,revenue:{...economy.revenue,commercialRevenueEur:economy.revenue.commercialRevenueEur*100}}}};
  assert.ok(buildObjectives(funded,weak.playerClubId).predicted<buildObjectives(weak,weak.playerClubId).predicted,'the same squad with greater resources receives stronger expectations');
  const promoted={...strong,seasonHistory:[{seasonId:'2025/26',competitionId:HANDBOLLSLIGAN,table,stats:{},outcome:{promoted:[strong.playerClubId],relegated:[]} as never}]};
  assert.match(buildObjectives(promoted,strong.playerClubId).objectives[0]!.why,/serieniv/);
});

test('underdog exceeding expectations gains confidence; a single temporary loss does not trigger pressure',()=>{
  let weak=career(ranked.at(-1)!);weak={...weak,board:{...weak.board!,confidence:55}};
  const next=review(weak,'2026-11-01',true);
  assert.ok(next.board!.confidence>55);assert.equal(boardPressureStage(next.board!),'STABLE');
  const strong=career();const first=strong.fixtures.find(f=>f.type==='LEAGUE'&&(f.homeClubId===strong.playerClubId||f.awayClubId===strong.playerClubId))!;
  const short=review(resultsThrough(strong,first.date,false),'2026-09-01');
  assert.equal(short.board!.warnings,0);assert.equal(boardPressureStage(short.board!),'STABLE');
  assert.equal(short.board!.confidence,strong.board!.confidence,'one early loss is not enough evidence for a confidence penalty');
  assert.equal(review(career(),'2026-09-01').board!.confidence,65,'quiet months do not erode confidence');
});

test('financial deterioration creates independent pressure; financial recovery restores confidence',()=>{
  let s=career();s={...s,clubFinances:{...s.clubFinances,[s.playerClubId]:{...s.clubFinances![s.playerClubId]!,status:'CRISIS'}}};
  for(const date of ['2026-09-01','2026-10-01','2026-11-01']) s=review(s,date);
  const recoveredWithoutPlan=review({...s,clubFinances:{...s.clubFinances,[s.playerClubId]:{...s.clubFinances![s.playerClubId]!,status:'HEALTHY'}}},'2026-12-01');
  assert.ok(recoveredWithoutPlan.board!.confidence>s.board!.confidence,'financial recovery also restores trust before any warning or plan');
  assert.notEqual(boardPressureStage(recoveredWithoutPlan.board!),'WARNING','improving confidence cannot escalate pressure');
  s=review(s,'2026-12-01');
  assert.ok(s.board!.confidence<45);assert.ok(s.board!.financialReviews!>=4);
  assert.ok(s.board!.factors.some(f=>f.label.includes('kris')));
  assert.ok(s.careerEvents.some(e=>e.type==='BOARD_UPDATE'&&e.summary.includes('Ekonomin')));
  if(pending(s)) s=submitBoardRecoveryPlan(s,pending(s)!.id);
  const low=s.board!.confidence;
  s={...s,clubFinances:{...s.clubFinances,[s.playerClubId]:{...s.clubFinances![s.playerClubId]!,status:'HEALTHY'}}};
  s=review(s,'2027-01-01');assert.ok(s.board!.confidence>low);assert.equal(s.board!.financialReviews,0);
});

test('manager recovery response resolves one inbox action, persists, and rewards measured improvement',()=>{
  let s=warning();const meeting=pending(s)!;assert.ok(meeting);
  assert.equal(resolveContextualContinueAction(s).targetHref,'/career/board');
  assert.equal(continueCareerRhythm(s).daysProcessed,0);
  const unchanged=s.board!.confidence;s=submitBoardRecoveryPlan(s,meeting.id);
  assert.equal(s.board!.confidence,unchanged,'a response alone grants no confidence');
  assert.equal(s.inbox.find(m=>m.careerEventId===`BOARD_UPDATE:${meeting.id}`)!.actionRequired,false);
  assert.throws(()=>submitBoardRecoveryPlan(s,meeting.id));
  s=migrateCareerState(JSON.parse(JSON.stringify(s)));
  const next=review(s,'2026-12-01',true);
  assert.equal(next.board!.recoveryPlans!.at(-1)!.status,'MET');
  assert.ok(next.board!.factors.some(f=>f.label.startsWith('Handlingsplanen')&&f.points===6));
  assert.deepEqual(review(next,'2026-12-01'),next);
  assert.deepEqual(review(next,'2026-11-01'),{...next,gameDate:'2026-11-01'});
});

test('an unmet plan loses future trust; an active plan cannot create an unanswerable second meeting',()=>{
  let s=warning();s=submitBoardRecoveryPlan({...s,gameDate:'2026-11-25'},pending(s)!.id);
  s=review(s,'2026-12-01',false);
  assert.equal(s.board!.recoveryPlans!.at(-1)!.status,'ACTIVE');
  assert.equal(pending(s),undefined);
  s=review(s,'2027-01-01',false);
  assert.equal(s.board!.recoveryPlans!.at(-1)!.status,'FAILED');
  assert.ok(s.board!.factors.some(f=>f.label.startsWith('Handlingsplanen')&&f.points===-6));
});

test('direct repeated reviews cannot skip an unanswered warning or duplicate unresolved events',()=>{
  let s=warning();const id=pending(s)!.id;
  for(const d of ['2026-12-01','2027-01-01','2027-02-01'])s=review(s,d,false);
  assert.equal(boardPressureStage(s.board!),'WARNING');assert.equal(pending(s)!.id,id);
  assert.equal(s.board!.meetings.filter(m=>m.kind==='WARNING').length,1);
  assert.equal(s.managerCareer!.seekingJob,undefined);
});

test('critical confidence can recover and season rollover preserves earned pressure and history',()=>{
  let s=career();s={...s,board:{...s.board!,confidence:20,pressureStage:'CRITICAL',warnings:2}};
  s=review(s,'2026-11-01',true);assert.ok(s.board!.confidence>20);
  assert.notEqual(boardPressureStage(s.board!),'DISMISSAL');
  const rolled=ensureBoard({...s,seasonId:'2027/28'},'2027-07-01');
  assert.equal(rolled.board!.confidence,s.board!.confidence);assert.equal(rolled.board!.warnings,s.board!.warnings);
  assert.equal(rolled.board!.history.length,s.board!.history.length+1);
  const history=rolled.board!.history;
  assert.deepEqual(migrateCareerState(JSON.parse(JSON.stringify(rolled))).board!.history,history);
});

test('season-end underperformance cannot dismiss a manager who was never warned',()=>{
  let s=resultsThrough(career(),'2027-05-01',false);
  s={...s,board:{...s.board!,confidence:10,warnings:0,pressureStage:'STABLE',objectives:s.board!.objectives.filter(o=>o.kind==='LEAGUE')}};
  const next=boardSeasonEnd(s,'2027-05-01',()=>{},()=>{throw new Error('unwarned dismissal');});
  assert.equal(boardPressureStage(next.board!),'CONCERN');assert.equal(next.board!.seasonReviewDone,true);
});

test('multi-month strong-club underperformance progresses through all stages, dismisses once and supports a new job',t=>{
  let s=career();const trace:{date:string;confidence:number;stage:string}[]=[];
  for(const date of ['2026-09-01','2026-10-01','2026-11-01','2026-12-01','2027-01-01','2027-02-01','2027-03-01','2027-04-01']) {
    s=review(s,date,false);trace.push({date,confidence:s.board!.confidence,stage:boardPressureStage(s.board!)});
    if(s.managerCareer!.seekingJob)break;
    if(pending(s))s=submitBoardRecoveryPlan(s,pending(s)!.id);
    s=migrateCareerState(JSON.parse(JSON.stringify(s)));
  }
  t.diagnostic(JSON.stringify(trace));
  for(const stage of ['STABLE','CONCERN','WARNING','CRITICAL','DISMISSAL'])assert.ok(trace.some(p=>p.stage===stage),stage);
  assert.equal(s.managerCareer!.seekingJob?.reason,'DISMISSED');
  assert.equal(s.managerCareer!.stints.at(-1)!.leftReason,'DISMISSED');
  assert.equal(s.managerCareer!.contract.endDate,s.gameDate);
  assert.equal(dismissManager(s,s.gameDate,'replay',()=>{}),s);
  assert.equal(resolveContextualContinueAction(s).targetHref,'/career/manager?tab=jobs');
  const own=s.fixtures.find(f=>f.homeClubId===s.playerClubId||f.awayClubId===s.playerClubId)!;
  const ready={...s,gameDate:own.date,careerEvents:[...s.careerEvents,buildMatchdayReadyEvent(own.id,own.date)]};
  assert.equal(startProductionMatch(ready,own.id),ready);
  assert.equal(playManagerFixtureLegacy(ready).result,null);
  const before={fixtures:s.fixtures,results:s.results,contracts:s.playerContracts};
  const next=acceptJobOffer(s,openOffers(s)[0]!.id);
  assert.equal(next.managerCareer!.seekingJob,undefined);assert.equal(next.managerCareer!.stints.length,2);
  assert.deepEqual(next.fixtures,before.fixtures);assert.deepEqual(next.results,before.results);
  assert.equal(Object.keys(next.playerContracts).length,Object.keys(before.contracts).length);
});

test('daily tick emits expectations/reviews once and continues the existing manager career',()=>{
  const initial=career();
  const once=processDay(initial,'2026-09-01').state;
  const twice=processDay(once,'2026-09-01').state;
  assert.equal(twice.board!.history.length,once.board!.history.length);
  assert.equal(twice.careerEvents.length,once.careerEvents.length);
  assert.equal(twice.managerCareer!.stints.length,1);
});
