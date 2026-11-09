import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createNewCareerState } from './newCareer';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../gameWorld/serverSnapshot';
import { migrateCareerState } from './saveMigration';
import { processDay } from './dailyTick';
import { addDays } from './dateUtils';
import type { CareerState } from './types';
import { progressCpuRecruitment, progressCpuEmergencyRecruitment, progressCpuTransferRequests, pushLog } from './cpuRecruitment';
import { progressCpuContractDecisions } from './cpuContractDecisions';
import { rankCandidates } from './cpuCandidateEvaluation';
import { assessPositionNeed } from './cpuSquadNeeds';
import { getCareerPlayer } from './careerWorld';
import { releasePlayerToFreeAgency } from './contractExpiry';
import { transferPlayerPermanently } from '../transfers/transferExecution';
import { getSellingClubAskingPriceEur, progressDailyTransfers, submitTransferOffer } from '../transfers/transferIntegration';
import { assessTransferAffordability, assessRenewalAffordability } from '../transfers/affordability';
import { ensureClubFinances } from '../economy/ledger';
import { getClubPlayerWageCostsEurAnnual, getClubBudgets } from '../economy/clubEconomyIntegration';
import { getPlayerMarketValueEur } from '../economy/contractIntegration';
import { acceptIncomingOffer, confirmIncomingSale, rejectIncomingOffer, requestBidFor, progressIncomingOffers } from '../players/market';
import { emptyDynamics } from '../players/dynamicsState';
import { playerIntentionOf } from '../players/intentions';
import type { CareerEvent } from './careerEvents';

const human = 'swe2-tumba', clubs = ['swe2-guif', 'swe2-varberg', 'swe2-aranas'];
const squads = snapshotWorldSquads('swe-2'), ratings = snapshotGameplayRatings('swe-2');
function fresh(date = '2026-11-02'): CareerState {
  let s = createNewCareerState('m41-world', human, squads, undefined, ratings);
  // A bounded test world with real canonical clubs/players; controlled generous budgets.
  const ids = new Set([human, ...clubs]);
  const worldSquads = Object.fromEntries(Object.entries(s.worldSquads).filter(([id]) => ids.has(id)));
  const playerIds = new Set(Object.values(worldSquads).flat().map(p => p.id));
  s = {...s, gameDate: date, worldSquads,
    gameplayRatings: Object.fromEntries(Object.entries(s.gameplayRatings).filter(([id]) => ids.has(id))),
    playerContracts: Object.fromEntries(Object.entries(s.playerContracts).filter(([id]) => playerIds.has(id))),
    cpuClubEvaluationSchedule: Object.fromEntries(clubs.map(id => [id, date])),
    playerDynamics: emptyDynamics(),
    clubEconomies: Object.fromEntries(Object.entries(s.clubEconomies).filter(([id]) => ids.has(id)).map(([id,c]) => [id,{...c,cashEur:10_000_000,revenue:{...c.revenue,commercialRevenueEur:10_000_000}}])),
  };
  return ensureClubFinances(s,date);
}
const reload = (s: CareerState) => migrateCareerState(JSON.parse(JSON.stringify(s)));
const cash = (s: CareerState) => Object.values(s.clubEconomies).reduce((sum,c)=>sum+c.cashEur,0);
function owned(s: CareerState) {
  const ids = Object.values(s.worldSquads).flat().map(p=>p.id);
  assert.equal(new Set(ids).size, ids.length, 'one physical player in one squad');
  for (const [club, squad] of Object.entries(s.worldSquads)) for (const p of squad) {
    assert.equal(p.clubId, club); assert.equal(s.playerContracts[p.id]?.clubId, club);
  }
}
function freeTarget(s: CareerState) {
  const p = s.worldSquads[clubs[2]]!.find(p=>p.position==='MV')!;
  s={...s,playerContracts:{...s.playerContracts,[p.id]:{...s.playerContracts[p.id]!,contractEndDate:addDays(s.gameDate,-1)}}};
  return {s:releasePlayerToFreeAgency(s,p.id,s.gameDate),id:p.id};
}
function intention(s: CareerState, id: string, clubId: string, kind: 'WANTS_TO_LEAVE'|'CONSIDERING_OPTIONS') {
  return {...s,playerDynamics:{...s.playerDynamics!,intentions:{[id]:{kind,clubId,active:true,since:s.gameDate,reviewedOn:s.gameDate,adverseReviews:6,recoveryReviews:0,reasons:['Sustained unhappiness'],history:[]}}}};
}

test('departing starter triggers genuine recruitment; constrained club cannot sign',()=>{
  let s=fresh(); const club=clubs[0], starter=s.worldSquads[club]!.find(p=>p.position==='MV')!;
  s=transferPlayerPermanently(s,starter.id,club,clubs[2],s.playerContracts[starter.id]!.wageEurPerMonth,'2029-05-31');
  const before=assessPositionNeed(s,club,'MV',s.worldSquads[club]!);
  assert.ok(before.usableCount<=2);
  const after=progressCpuRecruitment(s,s.gameDate);
  assert.ok(after.cpuRecruitmentPlans[club+':MV']); owned(after);
  const base=s.clubEconomies[club]!;
  const poor={...s,clubFinances:{...s.clubFinances,[club]:{...s.clubFinances![club]!,bridgeEurAnnual:0}},clubEconomies:{...s.clubEconomies,[club]:{...base,cashEur:0,ownerFundingEur:0,revenue:{commercialRevenueEur:0,mediaRevenueEur:0,matchdayRevenueEur:0,sportingRevenueEur:0,otherRevenueEur:0}}}};
  assert.ok(rankCandidates(poor,club,'MV',poor.gameDate).every(c=>!c.affordable));
  const no=progressCpuRecruitment(poor,poor.gameDate);
  assert.ok(Object.values(no.transferOffers).every(o=>o.toClubId!==club));
});

test('CPU renewals honor willingness, ownership, pending agreements and club wage limits',()=>{
  let s=fresh(); const club=clubs[0], p=s.worldSquads[club]![0]!;
  s={...s,worldSquads:{...s.worldSquads,[club]:[p]},playerContracts:{...s.playerContracts,[p.id]:{...s.playerContracts[p.id]!,contractEndDate:'2027-05-31'}}};
  const renewed=progressCpuContractDecisions(s,s.gameDate,[human,club]).state;
  assert.ok(renewed.playerContracts[p.id]!.contractEndDate>s.playerContracts[p.id]!.contractEndDate);
  assert.equal(progressCpuContractDecisions(renewed,s.gameDate,[club]).state,renewed);
  assert.deepEqual(renewed.worldSquads[human],s.worldSquads[human]);
  const pending = submitTransferOffer(s,{dealType:'PERMANENT',playerId:p.id,toClubId:clubs[1],transferFeeEur:getSellingClubAskingPriceEur(s,p.id)!,newWageEurPerMonth:s.playerContracts[p.id]!.wageEurPerMonth*2,contractYears:2});
  assert.equal(pending.offer.status,'AGREED_AWAITING_WINDOW');
  assert.deepEqual(progressCpuContractDecisions(pending.state,s.gameDate,[club]).state.playerContracts,s.playerContracts,'a pending departure cannot be renewed');
  const budget=getClubBudgets(pending.state,clubs[1])!;
  const fee=budget.transferBudgetEur-pending.offer.transferFeeEur/2;
  assert.equal(assessTransferAffordability(s,clubs[1],fee,0,100).affordable,true);
  assert.equal(assessTransferAffordability(pending.state,clubs[1],fee,0,100).affordable,false,'pending fee is reserved');
  const unhappy=intention(s,p.id,club,'WANTS_TO_LEAVE');
  assert.ok(playerIntentionOf(unhappy,p.id));
  assert.deepEqual(progressCpuContractDecisions(unhappy,s.gameDate,[club]).state.playerContracts,s.playerContracts);
  const uncertain=intention(s,p.id,club,'CONSIDERING_OPTIONS');
  const premium=progressCpuContractDecisions(uncertain,s.gameDate,[club]).state.playerContracts[p.id]!;
  assert.equal(premium.wageEurPerMonth,Math.ceil(s.playerContracts[p.id]!.wageEurPerMonth*1.12/10)*10);
  const c=s.clubEconomies[club]!;
  const poor={...s,clubFinances:{...s.clubFinances,[club]:{...s.clubFinances![club]!,bridgeEurAnnual:0}},clubEconomies:{...s.clubEconomies,[club]:{...c,revenue:{commercialRevenueEur:0,mediaRevenueEur:0,matchdayRevenueEur:0,sportingRevenueEur:0,otherRevenueEur:0},ownerFundingEur:0}}};
  assert.equal(assessRenewalAffordability(poor,club,p.id,s.playerContracts[p.id]!.wageEurPerMonth).affordable,false);
  assert.deepEqual(progressCpuContractDecisions(poor,s.gameDate,[club]).state.playerContracts,s.playerContracts);
});

test('CPU accepts its own persistent request once; manager request still requires approval',()=>{
  let s=fresh(); const id=s.worldSquads[clubs[0]]![0]!.id, me=s.worldSquads[human]![0]!.id;
  s={...s,playerDynamics:{...s.playerDynamics!,requests:{[id]:{playerId:id,clubId:clubs[0],status:'OPEN',submittedOn:s.gameDate,reason:'Wants another club'},[me]:{playerId:me,status:'OPEN',submittedOn:s.gameDate,reason:'Manager decision'}}}};
  const after=progressCpuTransferRequests(s,s.gameDate);
  assert.equal(after.playerDynamics!.requests[id]!.status,'ACCEPTED');
  assert.equal(after.playerDynamics!.requests[me]!.status,'OPEN');
  assert.equal(after.playerContracts[id]!.clubId,clubs[0]);
  assert.equal(progressCpuTransferRequests(after,s.gameDate),after);
  assert.deepEqual(reload(after).playerDynamics!.listings,after.playerDynamics!.listings);
  assert.equal(progressIncomingOffers(after,s.gameDate,()=>{}).playerDynamics!.requests[id]!.status,'ACCEPTED');
  const moved=transferPlayerPermanently(after,id,clubs[0],clubs[1],1000,'2029-05-31');
  const closed=progressIncomingOffers(moved,s.gameDate,()=>{});
  assert.equal(closed.playerDynamics!.requests[id]!.status,'WITHDRAWN');
  assert.equal(closed.playerDynamics!.listings[id],undefined); owned(closed);
});

test('rival clubs share one target: closed-window agreement reserves budget and completes once',()=>{
  const target=freeTarget(fresh()); let s=target.s; const id=target.id;
  const bid={dealType:'PERMANENT' as const,playerId:id,toClubId:clubs[0],transferFeeEur:0,newWageEurPerMonth:1000,contractYears:2};
  const first=submitTransferOffer(s,bid); s=first.state;
  assert.equal(first.offer.status,'AGREED_AWAITING_WINDOW');
  assert.equal(s.playerContracts[id]!.clubId,'');
  assert.equal(cash(s),cash(target.s),'no payments before window');
  const rival=submitTransferOffer(s,{...bid,toClubId:clubs[1]});
  assert.equal(rival.offer.status,'BLOCKED_PENDING_TRANSFER');
  assert.equal(submitTransferOffer(s,{...bid,toClubId:human}).offer.status,'BLOCKED_PENDING_TRANSFER');
  assert.ok(!rankCandidates(s,clubs[1],'MV',s.gameDate).some(c=>c.playerId===id));
  const budget=getClubBudgets(s,clubs[0])!;
  const wage=(budget.wageBudgetEur-getClubPlayerWageCostsEurAnnual(s,clubs[0]))/12-500;
  assert.equal(assessTransferAffordability({...s,transferOffers:{}},clubs[0],0,0,wage).affordable,true);
  const tooMuch=assessTransferAffordability(s,clubs[0],0,0,wage);
  assert.equal(tooMuch.affordable,false);
  const done=progressDailyTransfers({...reload(s),gameDate:'2027-01-01'},'2027-01-01');
  assert.equal(done.transferOffers[first.offer.id]!.status,'COMPLETED');
  assert.equal(done.playerContracts[id]!.clubId,clubs[0]);
  assert.equal(progressDailyTransfers(done,'2027-01-01'),done); owned(done);
  const broke={...s,clubEconomies:{...s.clubEconomies,[clubs[0]]:{...s.clubEconomies[clubs[0]]!,cashEur:-100_000_000}}};
  const blocked=progressDailyTransfers({...broke,gameDate:'2027-01-01'},'2027-01-01');
  assert.equal(blocked.transferOffers[first.offer.id]!.status,'BLOCKED_UNAFFORDABLE');
  assert.deepEqual(blocked.playerContracts,s.playerContracts);
});

test('AI targets manager squad through inbox approval, never an automatic sale; repeats and reload are safe',()=>{
  let s=fresh(); const club=clubs[0];
  // Other keepers unavailable on placement, so the genuine vacancy has only human candidates.
  s={...s,playerStatuses:{...s.playerStatuses,...Object.fromEntries(clubs.flatMap(c=>s.worldSquads[c]!.filter(p=>p.position==='MV').map(p=>[p.id,{playerId:p.id,availability:'ON_PLACEMENT' as const}])))},cpuClubEvaluationSchedule:Object.fromEntries(clubs.map(c=>[c,c===club?s.gameDate:'2030-01-01']))};
  const events:CareerEvent[]=[];
  const after=progressCpuRecruitment(s,s.gameDate,e=>events.push(e));
  const incoming=Object.values(after.incomingOffers??{}).find(o=>o.fromClubId===club)!;
  assert.ok(incoming,'needs-based bid to manager exists'); assert.equal(incoming.status,'OPEN');
  assert.equal(after.playerContracts[incoming.playerId]!.clubId,human);
  assert.equal(events.filter(e=>e.type==='TRANSFER_OFFER').length,1);
  assert.deepEqual(after.playerContracts[incoming.playerId],s.playerContracts[incoming.playerId]);
  const repeat=progressCpuRecruitment(after,s.gameDate,()=>{});
  assert.deepEqual(repeat.incomingOffers,after.incomingOffers);
  assert.deepEqual(reload(after).incomingOffers,after.incomingOffers);
  const rejected=rejectIncomingOffer(after,incoming.id);
  assert.equal(requestBidFor(rejected,incoming.playerId,s.gameDate,()=>{},club),rejected,'same-date history cannot be overwritten by a repeated bid');
  const d=after.playerDynamics!;
  const requested={...after,playerDynamics:{...d,requests:{...d.requests,[incoming.playerId]:{playerId:incoming.playerId,clubId:human,status:'ACCEPTED' as const,submittedOn:s.gameDate,reason:'Wants move'}}}};
  const agreed=confirmIncomingSale(acceptIncomingOffer(requested,incoming.id),incoming.id);
  assert.equal(agreed.incomingOffers![incoming.id]!.status,'AWAITING_WINDOW');
  const position=getCareerPlayer(agreed,incoming.playerId)!.position;
  assert.ok(assessPositionNeed(agreed,club,position,agreed.worldSquads[club]!).pendingIncoming>=1);
  const duplicate={...agreed,incomingOffers:{...agreed.incomingOffers,legacy:{...agreed.incomingOffers![incoming.id]!,id:'legacy'}}};
  assert.equal(assessPositionNeed(duplicate,club,position,duplicate.worldSquads[club]!).pendingIncoming,1,'legacy duplicates project one canonical player');
  assert.ok(duplicate.incomingOffers.legacy,'history remains intact');
  assert.equal(agreed.playerContracts[incoming.playerId]!.clubId,human);
  const noFunds={...agreed,gameDate:'2027-01-01',clubEconomies:{...agreed.clubEconomies,[club]:{...agreed.clubEconomies[club]!,cashEur:-100_000_000}}};
  const notices:CareerEvent[]=[];
  const withdrawn=progressIncomingOffers(noFunds,'2027-01-01',e=>notices.push(e));
  assert.equal(withdrawn.incomingOffers![incoming.id]!.status,'WITHDRAWN');
  assert.match(withdrawn.incomingOffers![incoming.id]!.rounds.at(-1)!.note,/finansiera/);
  assert.ok(notices.some(e=>e.type==='TRANSFER_OFFER'));
  assert.deepEqual(withdrawn.playerContracts,noFunds.playerContracts);assert.equal(cash(withdrawn),cash(noFunds));
  const loadedAgreed=reload(agreed);
  const done=progressIncomingOffers({...loadedAgreed,gameDate:'2027-01-01'},'2027-01-01',()=>{});
  assert.equal(done.incomingOffers![incoming.id]!.status,'COMPLETED');
  assert.equal(done.playerContracts[incoming.playerId]!.clubId,club);
  assert.ok(Math.abs(cash(done)-cash(loadedAgreed))<0.000001,'buyer payment equals seller receipt');
  assert.equal(progressIncomingOffers(done,'2027-01-01',()=>{}),done);
  const reconciled=progressCpuRecruitment(done,'2027-01-01');
  assert.equal(reconciled.cpuRecruitmentPlans[club+':'+position]!.status,'SUCCEEDED'); owned(reconciled);
});

test('daily tick retains AI offer inbox events and decision log IDs do not duplicate',()=>{
  let s=fresh(); const club=clubs[0];
  s={...s,fixtures:[],cpuClubEvaluationSchedule:Object.fromEntries(clubs.map(c=>[c,'2030-01-01'])),playerStatuses:{...s.playerStatuses,...Object.fromEntries(clubs.flatMap(c=>s.worldSquads[c]!.filter(p=>p.position==='MV').map(p=>[p.id,{playerId:p.id,availability:'ON_PLACEMENT' as const}])))}};
  const after=processDay(s,s.gameDate).state;
  const offers=Object.values(after.incomingOffers??{});
  assert.ok(offers.length>0);
  for (const offer of offers) assert.ok(after.careerEvents.some(e=>e.type==='TRANSFER_OFFER'&&e.destinations?.some(d=>d.route==='TRANSFER_OFFER'&&d.offerId===offer.id)));
  const log=after.cpuDecisionLog;
  assert.deepEqual(pushLog(log,log),log);
});

test('an agreed CPU pursuit records funding failure without moving or paying the player',()=>{
  let s=progressCpuRecruitment(fresh('2026-10-05'),'2026-10-05');
  const plan=Object.values(s.cpuRecruitmentPlans).find(p=>p.status==='SUCCEEDED'&&p.offerId&&s.transferOffers[p.offerId]?.status==='AGREED_AWAITING_WINDOW')!;
  assert.ok(plan);const offer=s.transferOffers[plan.offerId!]!;
  s={...s,gameDate:'2027-01-01',transferOffers:{[offer.id]:offer},clubEconomies:{...s.clubEconomies,[plan.clubId]:{...s.clubEconomies[plan.clubId]!,cashEur:-100_000_000}}};
  const done=progressDailyTransfers(s,s.gameDate);
  assert.equal(done.transferOffers[offer.id]!.status,'BLOCKED_UNAFFORDABLE');
  assert.equal(done.playerContracts[offer.playerId]!.clubId,offer.fromClubId);
  assert.equal(done.clubEconomies[plan.clubId]!.cashEur,s.clubEconomies[plan.clubId]!.cashEur);
  const reconciled=progressCpuRecruitment(done,done.gameDate);
  assert.equal(reconciled.cpuRecruitmentPlans[plan.id]!.status,'FAILED');owned(reconciled);
});

test('deterministic multi-month world activity across three clubs survives a mid-run save',()=>{
  const start=fresh('2026-10-05'); const beforeContracts=start.playerContracts;
  function run(save:boolean) {
    let s=start; const checkpoints:unknown[]=[];
    for(let day=0;day<100;day++) {
      const date=addDays(start.gameDate,day);s={...s,gameDate:date};
      s=progressIncomingOffers(s,date,()=>{});s=progressDailyTransfers(s,date);
      s=progressCpuTransferRequests(s,date);s=progressCpuRecruitment(s,date);s=progressCpuEmergencyRecruitment(s,date);
      s=progressCpuContractDecisions(s,date,clubs).state;
      if(save&&day===49)s=reload(s);
      owned(s);
      if(day%28===0||day===99)checkpoints.push({date,offers:Object.keys(s.transferOffers).length,completed:Object.values(s.transferOffers).filter(o=>o.status==='COMPLETED').length,pending:Object.values(s.transferOffers).filter(o=>o.status==='AGREED_AWAITING_WINDOW').length,renewed:Object.values(s.playerContracts).filter(c=>beforeContracts[c.playerId]&&c.contractEndDate>beforeContracts[c.playerId]!.contractEndDate).length});
    }
    return {s,checkpoints};
  }
  const a=run(false),b=run(true);
  assert.deepEqual(b.s.transferOffers,a.s.transferOffers);assert.deepEqual(b.s.playerContracts,a.s.playerContracts);assert.deepEqual(b.s.cpuRecruitmentPlans,a.s.cpuRecruitmentPlans);
  const changed=clubs.filter(club=>Object.values(a.s.playerContracts).some(c=>c.clubId===club&&beforeContracts[c.playerId]&&c.contractEndDate>beforeContracts[c.playerId]!.contractEndDate));
  assert.equal(changed.length,3);
  assert.ok(Object.values(a.s.transferOffers).some(o=>o.status==='COMPLETED'));
  const report={seed:start.saveSeed,clubs,from:start.gameDate,to:a.s.gameDate,checkpoints:a.checkpoints,renewingClubs:changed,completed:Object.values(a.s.transferOffers).filter(o=>o.status==='COMPLETED').map(o=>({playerId:o.playerId,from:o.fromClubId,to:o.toClubId,agreement:o.offeredDate,effective:o.resolvedDate,fee:o.transferFeeEur})),deterministic:true,saveLoad:true};
  console.log('M41_WORLD_SCENARIO '+JSON.stringify(report));
  if(process.env.HM_M41_REPORT)writeFileSync(process.env.HM_M41_REPORT,JSON.stringify(report,null,2));
});
