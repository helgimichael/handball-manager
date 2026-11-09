import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateMatch, type ClubStrength } from '@handball-manager/game-simulation';
import { createNewCareerState } from '../career/newCareer';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../gameWorld/serverSnapshot';
import { updatePlayerSquadStatus } from '../career/squadStatus';
import { addDays } from '../career/dateUtils';
import { migrateCareerState } from '../career/saveMigration';
import { renewPlayerContract } from '../career/contractRenewal';
import { rolloverSeason } from '../career/seasonRollover';
import { transferPlayerPermanently } from '../transfers/transferExecution';
import { withEvents } from '../manager/events';
import { managerSquadIds, dynamicsOf, personalityOf, ageOf } from './dynamicsState';
import { progressPlayerDynamics } from './playerDynamicsTick';
import { progressPlayerIntentions, playerIntentionOf, intentionMinimumWage } from './intentions';
import { recordPlayingTimeMatch } from './playingTime';
import { answerConcern, openConcerns, decideTransferRequest } from './talks';
import { openRenewalTalks, renewalDemand, submitRenewalOffer, progressRenewalTalks, renewalBlocker } from './renewals';
import type { CareerState, CareerFixture } from '../career/types';
import type { CareerEvent } from '../career/careerEvents';
import type { PlayerIntention } from './types';

const club='swe2-tumba',start='2026-08-09';
function fresh(){let s=createNewCareerState('m31-intentions',club,snapshotWorldSquads('swe-2'),undefined,snapshotGameplayRatings('swe-2'));
  s={...s,playerStatuses:Object.fromEntries(managerSquadIds(s).map(id=>[id,{playerId:id,availability:'AVAILABLE' as const}])),playerSquadStatus:Object.fromEntries(managerSquadIds(s).map(id=>[id,'SQUAD_PLAYER' as const]))};return s;}
const strength=(clubId:string):ClubStrength=>({clubId,overall:60,attack:60,defense:60,goalkeeper:60,depth:60});
const reload=(s:CareerState)=>migrateCareerState(JSON.parse(JSON.stringify(s)));
function review(s:CareerState,date:string){const events:CareerEvent[]=[];return withEvents(progressPlayerIntentions({...s,gameDate:date},date,e=>events.push(e)),events);}
function held(s:CareerState,id:string,kind:PlayerIntention){const d=dynamicsOf(s);return {...s,playerDynamics:{...d,intentions:{...d.intentions,[id]:{kind,clubId:club,active:true,since:s.gameDate,reviewedOn:s.gameDate,adverseReviews:6,recoveryReviews:0,reasons:['Sustained test evidence'],history:[]}}}};}
function week(s:CareerState,n:number,id:string,minutes:number,available=true){
 const date=addDays(start,n*7),f:CareerFixture={id:`m31-week:${n}`,competitionId:s.competitionId,type:'LEAGUE',round:n+1,date,homeClubId:club,awayClubId:'swe2-aranas'};
 const result=simulateMatch({fixtureId:f.id,seed:n,homeClubId:f.homeClubId,awayClubId:f.awayClubId,homeStrength:strength(f.homeClubId),awayStrength:strength(f.awayClubId)});
 s={...s,gameDate:date,fixtures:[...s.fixtures,f],results:{...s.results,[f.id]:result},playerStatuses:{...s.playerStatuses,[id]:{playerId:id,availability:available?'AVAILABLE':'INJURED'}}};
 s=recordPlayingTimeMatch(s,f,new Map(managerSquadIds(s).map(p=>[p,p===id?minutes:30])),'MEASURED');
 const events:CareerEvent[]=[];return withEvents(progressPlayerDynamics({...s,gameDate:addDays(date,1)},addDays(date,1),e=>events.push(e)),events);
}
function star(){let s=fresh();const id=managerSquadIds(s).find(id=>personalityOf(s,id).professionalism<12)!;assert.ok(id);s=updatePlayerSquadStatus(s,id,'KEY_PLAYER');s={...s,playerContracts:{...s.playerContracts,[id]:{...s.playerContracts[id]!,contractEndDate:'2029-05-31'}}};return {s,id};}

test('legacy saves are neutral, intentions persist, one bad observation does not change direction or duplicate events',()=>{
 let s=fresh();const id=managerSquadIds(s)[0]!;
 assert.equal(playerIntentionOf(s,id),undefined);const demand=renewalDemand(s,id);assert.deepEqual(renewalDemand(reload(s),id),demand);
 s=review(s,start);const first=playerIntentionOf(s,id)!;assert.ok(first);assert.equal(first.adverseReviews,0);
 const crisis={...s,clubFinances:{...s.clubFinances,[club]:{...s.clubFinances?.[club]!,status:'CRISIS' as const}}};
 const once=review(crisis,addDays(start,7));assert.equal(playerIntentionOf(once,id)!.kind,first.kind);
 assert.deepEqual(review(once,addDays(start,7)),once);assert.equal(new Set(once.careerEvents.map(e=>e.id)).size,once.careerEvents.length);
 assert.equal(JSON.stringify(reload(once).playerDynamics!.intentions),JSON.stringify(once.playerDynamics!.intentions));
});

test('unhappy established player: accumulated court-time evidence changes intentions and creates one existing request',()=>{
 let {s,id}=star();for(let n=0;n<10;n++)s=week(s,n,id,0);
 assert.equal(playerIntentionOf(s,id)!.kind,'WANTS_TO_LEAVE');assert.equal(s.playerDynamics!.requests[id]!.status,'OPEN');
 assert.equal(s.playerContracts[id]!.clubId,club);assert.ok(renewalBlocker(s,id));
 const requestEvents=s.careerEvents.filter(e=>e.id.startsWith(`PLAYER_DYNAMICS:request:${id}:`));assert.equal(requestEvents.length,1);
 assert.ok(playerIntentionOf(s,id)!.reasons.some(r=>r.includes('minuter')));
 assert.throws(()=>openRenewalTalks(s,id,{kind:'MANAGER'}));assert.throws(()=>renewPlayerContract(s,id,3));
});

test('trusted prospect and phase-adjusted defensive specialist stay settled over multiple weeks',()=>{
 for(const specialist of [false,true]){
  let s=fresh();const id=managerSquadIds(s).find(id=>(ageOf(s,id)??99)<=23)!;assert.ok(id);s=updatePlayerSquadStatus(s,id,specialist?'KEY_PLAYER':'TALENT');
  s={...s,playerContracts:{...s.playerContracts,[id]:{...s.playerContracts[id]!,contractEndDate:'2029-05-31'}},playerMatchDefaults:{...s.playerMatchDefaults,[id]:{...s.playerMatchDefaults[id],phaseUsage:specialist?'DEFENCE_ONLY':'BOTH_PHASES'}}};
  for(let n=0;n<10;n++)s=week(s,n,id,specialist?25:20);
  assert.equal(playerIntentionOf(s,id)!.kind,'HAPPY_TO_STAY');assert.ok(!s.playerDynamics!.requests[id]);assert.equal(playerIntentionOf(s,id)!.adverseReviews,0);
 }
});

test('injury and idle weeks cannot add sporting strikes from old minutes',()=>{
 let {s,id}=star();for(let n=0;n<5;n++)s=week(s,n,id,0);
 const before=playerIntentionOf(s,id)!;assert.equal(before.kind,'CONSIDERING_OPTIONS');
 for(let n=5;n<9;n++)s=week(s,n,id,0,false);
 assert.equal(playerIntentionOf(s,id)!.adverseReviews,before.adverseReviews);assert.equal(playerIntentionOf(s,id)!.kind,before.kind);
 let idle={...s,playerStatuses:{...s.playerStatuses,[id]:{playerId:id,availability:'AVAILABLE' as const}}};
 idle=review(idle,addDays(idle.gameDate,7));assert.equal(playerIntentionOf(idle,id)!.adverseReviews,before.adverseReviews);
});

test('late injury does not turn old benching morale and routine staff factors into new intention strikes',()=>{
 let {s,id}=star();for(let n=0;n<10;n++)s=week(s,n,id,0);
 const before=playerIntentionOf(s,id)!,d=dynamicsOf(s);
 s={...s,playerStatuses:{...s.playerStatuses,[id]:{playerId:id,availability:'INJURED'}},playerDynamics:{...d,morale:{...d.morale,[id]:{...d.morale[id]!,moralePct:25,unhappyWeeks:8,factors:[{key:'PLAYING_TIME',label:'Old benching',points:-24},{key:'STAFF',label:'Routine staff influence',points:-1}]}}}};
 s=review(s,addDays(s.gameDate,7));assert.equal(playerIntentionOf(s,id)!.adverseReviews,before.adverseReviews);assert.equal(playerIntentionOf(s,id)!.kind,before.kind);
});

test('expiring veteran can open talks; a persistent manager action removes the ignored-contract cause',()=>{
 let s=fresh();const id=managerSquadIds(s)[0]!;s={...s,worldSquads:{...s.worldSquads,[club]:s.worldSquads[club]!.map(p=>p.id===id?{...p,dateOfBirth:'1990-01-01',birthYear:1990}:p)}};assert.ok(ageOf(s,id)!>=31);s={...s,gameDate:start,playerContracts:{...s.playerContracts,[id]:{...s.playerContracts[id]!,contractEndDate:addDays(start,80)}}};
 s=review(s,start);assert.equal(playerIntentionOf(s,id)!.kind,'OPEN_TO_RENEWAL');s=review(s,addDays(start,7));assert.equal(playerIntentionOf(s,id)!.kind,'CONSIDERING_OPTIONS');
 s=openRenewalTalks(s,id,{kind:'MANAGER'});const talk=Object.values(s.renewalTalks!).find(t=>t.playerId===id)!;assert.equal(talk.status,'OPEN');
 s=review(s,addDays(start,14));s=review(s,addDays(start,21));assert.equal(playerIntentionOf(s,id)!.kind,'OPEN_TO_RENEWAL');assert.ok(s.renewalTalks![talk.id]);
});

test('persistent financial crisis and an ambitious player facing a sporting setback create explained gradual intentions',()=>{
 for(const cause of ['FINANCE','AMBITION']){
  let s=fresh();const id=managerSquadIds(s).find(id=>personalityOf(s,id).ambition>=15&&(ageOf(s,id)??99)<=29)!;assert.ok(id);
  s=review(s,start);const d=dynamicsOf(s);
  if(cause==='FINANCE')s={...s,clubFinances:{...s.clubFinances,[club]:{...s.clubFinances?.[club]!,status:'CRISIS'}}};
  else s={...s,playerDynamics:{...d,morale:{...d.morale,[id]:{moralePct:65,targetPct:65,updatedOn:start,unhappyWeeks:0,factors:[{key:'CLUB_STATUS',label:'Verified relegation last season',points:-7}]}}}};
  for(let n=1;n<=6;n++)s=review(s,addDays(start,n*7));
  assert.equal(playerIntentionOf(s,id)!.kind,'WANTS_TO_LEAVE');assert.ok(playerIntentionOf(s,id)!.reasons.some(r=>r.includes(cause==='FINANCE'?'kris':'relegation')));
  assert.equal(s.playerContracts[id]!.clubId,club);
 }
});

test('considering options raises demands; all agreement paths honor refusal, wage floor and affordability',()=>{
 const base=fresh(),id=managerSquadIds(base)[0]!,s=held(base,id,'CONSIDERING_OPTIONS');
 assert.ok(renewalDemand(s,id).demandEurPerMonth>renewalDemand(base,id).demandEurPerMonth);
 assert.throws(()=>renewPlayerContract(s,id,2,s.playerContracts[id]!.wageEurPerMonth));
 assert.ok(renewPlayerContract(s,id,2,intentionMinimumWage(s,id)).playerContracts[id]!.wageAgreed);
 const talking=openRenewalTalks(base,id,{kind:'MANAGER'}),talk=Object.values(talking.renewalTalks!).find(t=>t.playerId===id)!;
 const offered=submitRenewalOffer(talking,talk.id,{wageEurPerMonth:talk.demandEurPerMonth,years:2});
 const leaving=held(offered,id,'WANTS_TO_LEAVE');assert.throws(()=>submitRenewalOffer(leaving,talk.id,{wageEurPerMonth:99999,years:2}));
 const answered=progressRenewalTalks({...leaving,gameDate:addDays(base.gameDate,1)},addDays(base.gameDate,1),()=>{});
 assert.equal(answered.renewalTalks![talk.id]!.status,'REFUSED');assert.deepEqual(answered.playerContracts,leaving.playerContracts);assert.deepEqual(answered.clubEconomies,leaving.clubEconomies);
 assert.throws(()=>renewPlayerContract(s,id,2,1000000000));
});

test('positive discussion response persists and contributes to explained recovery after increased minutes',()=>{
 let s=fresh();const id=managerSquadIds(s).find(id=>personalityOf(s,id).professionalism>=12)!;assert.ok(id);s=updatePlayerSquadStatus(s,id,'KEY_PLAYER');
 s={...s,playerContracts:{...s.playerContracts,[id]:{...s.playerContracts[id]!,contractEndDate:'2029-05-31'}}};
 for(let n=0;n<6;n++)s=week(s,n,id,0);
 const concern=openConcerns(s,id).find(c=>c.kind==='PLAYING_TIME')!;assert.ok(concern);s=answerConcern(s,concern.id,'EARN_IT');
 assert.equal(s.playerDynamics!.concerns[concern.id]!.responseEffect,'POSITIVE');
 for(let n=6;n<15;n++)s=week(s,n,id,60);
 assert.ok(['HAPPY_TO_STAY','OPEN_TO_RENEWAL'].includes(playerIntentionOf(s,id)!.kind));assert.ok(playerIntentionOf(s,id)!.reasons.some(r=>r.includes('uppskattade')));
 assert.equal(reload(s).playerDynamics!.concerns[concern.id]!.responseEffect,'POSITIVE');
});

test('repeated negative manager responses are recorded and affect explained intentions',()=>{
 let {s,id}=star();for(let n=0;n<14;n++){
  s=week(s,n,id,0);if(s.playerDynamics!.requests[id]?.status==='OPEN')s=decideTransferRequest(s,id,'REFUSE');for(const c of openConcerns(s,id))if(c.options.some(o=>o.id==='EARN_IT'))s=answerConcern(s,c.id,'EARN_IT');
 }
 const negative=Object.values(s.playerDynamics!.concerns).filter(c=>c.playerId===id&&c.responseEffect==='NEGATIVE');assert.ok(negative.length>=2);
 assert.ok(playerIntentionOf(s,id)!.reasons.some(r=>r.includes('samtal')));assert.deepEqual(reload(s).playerDynamics!.concerns,s.playerDynamics!.concerns);
});

test('multi-month manager scenario: benching, conversation response, request, sustained recovery and continuity',t=>{
 let {s,id}=star();const trace:{week:number;date:string;kind:PlayerIntention;morale:number;request?:string}[]=[];
 for(let n=0;n<24;n++){
  s=week(s,n,id,n<10?0:60);
  for(const c of openConcerns(s,id))if(c.options.some(o=>o.id==='EARN_IT'))s=answerConcern(s,c.id,'EARN_IT');
  s=reload(s);const held=playerIntentionOf(s,id)!;trace.push({week:n+1,date:s.gameDate,kind:held.kind,morale:s.playerDynamics!.morale[id]!.moralePct,request:s.playerDynamics!.requests[id]?.status});
 }
 assert.equal(playerIntentionOf(s,id)!.kind,'HAPPY_TO_STAY');assert.equal(s.playerDynamics!.requests[id]!.status,'WITHDRAWN');assert.equal(s.playerContracts[id]!.clubId,club);
 assert.ok(trace.some(x=>x.kind==='WANTS_TO_LEAVE'));assert.ok(trace.some(x=>x.kind==='CONSIDERING_OPTIONS'));assert.equal(new Set(s.careerEvents.map(e=>e.id)).size,s.careerEvents.length);
 const before=s.playerDynamics!.intentions;
 const rolled=rolloverSeason({...s,seasonComplete:true,...(s.seasonOutcome?{seasonOutcome:{...s.seasonOutcome,phase:'COMPLETE'}}:{})});
 assert.notEqual(rolled.seasonId,s.seasonId);assert.deepEqual(rolled.playerDynamics!.intentions,before);assert.deepEqual(rolloverSeason(rolled),rolled);
 assert.deepEqual(reload(rolled).playerDynamics!.intentions,before);
 t.diagnostic(JSON.stringify({scenario:'M3.1 multi-month',playerId:id,trace}));
});

test('an existing signed outside contract remains authoritative without extra transfer execution or invented strikes',()=>{
 let s=fresh();const id=managerSquadIds(s)[0]!;s=review(s,start);
 s={...s,preContracts:{[id]:{playerId:id,toClubId:'swe2-aranas',foreign:false,agreedOn:start,effectiveOn:'2027-05-31',wageEurPerMonth:1000}}};
 const contracts=s.playerContracts,economies=s.clubEconomies,agreement=s.preContracts;
 s=review(s,addDays(start,7));assert.equal(playerIntentionOf(s,id)!.kind,'WANTS_TO_LEAVE');assert.equal(playerIntentionOf(s,id)!.adverseReviews,0);
 assert.ok(renewalBlocker(s,id));assert.throws(()=>renewPlayerContract(s,id,2));assert.deepEqual(s.preContracts,agreement);assert.deepEqual(s.playerContracts,contracts);assert.deepEqual(s.clubEconomies,economies);
});

test('request decisions retain market safeguards; departures archive club-specific intention without deleting history',()=>{
 let {s,id}=star();for(let n=0;n<10;n++)s=week(s,n,id,0);
 const accepted=decideTransferRequest(s,id,'ACCEPT');assert.equal(accepted.playerDynamics!.requests[id]!.status,'ACCEPTED');assert.ok(accepted.playerDynamics!.listings[id]);assert.equal(accepted.playerContracts[id]!.clubId,club);
 const refused=decideTransferRequest(s,id,'REFUSE');assert.equal(refused.playerDynamics!.requests[id]!.status,'REFUSED');
 const sold=transferPlayerPermanently(s,id,club,'swe2-aranas',s.playerContracts[id]!.wageEurPerMonth,'2029-05-31');
 assert.equal(playerIntentionOf(sold,id),undefined);assert.equal(sold.playerDynamics!.intentions![id]!.active,false);assert.deepEqual(sold.playerDynamics!.intentions![id]!.history,s.playerDynamics!.intentions![id]!.history);
});
