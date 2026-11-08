import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateMatch, type ClubStrength } from '@handball-manager/game-simulation';
import { createNewCareerState } from '../career/newCareer';
import { migrateCareerState } from '../career/saveMigration';
import { getCareerClubSquad } from '../career/careerWorld';
import { updatePlayerSquadStatus } from '../career/squadStatus';
import { addDays } from '../career/dateUtils';
import { careerEventToInboxMessage } from '../career/inboxBridge';
import { markMessageRead, archiveMessage } from '../career/inboxActions';
import { processDay } from '../career/dailyTick';
import { transferPlayerPermanently, loanPlayerOut } from '../transfers/transferExecution';
import { releasePlayerToFreeAgency } from '../career/contractExpiry';
import { continueCareerRhythm } from '../career/continueController';
import type { CareerFixture, CareerState } from '../career/types';
import type { CareerEvent } from '../career/careerEvents';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../gameWorld/serverSnapshot';
import { buildInitialMatchSquad } from '../matchPlan/careerSquadBridge';
import { buildDefaultMatchPlan } from '../matchPlan/defaultMatchPlan';
import { assessPlayingTime, expectedCourtMinutes, recordPlayingTimeMatch } from './playingTime';
import { updateMoraleWeekly, moraleFactors, moraleOf } from './morale';
import { answerConcern, openConcerns, progressTalks } from './talks';
import { managerSquadIds, personalityOf } from './dynamicsState';

const club='swe2-tumba';
const strength=(clubId:string):ClubStrength=>({clubId,overall:60,attack:60,defense:60,goalkeeper:60,depth:60});
function fresh():CareerState {
  const s=createNewCareerState('m13a-time-tests',club,snapshotWorldSquads('swe-2'),undefined,snapshotGameplayRatings('swe-2'));
  return {...s,gameDate:'2026-08-09',playerStatuses:Object.fromEntries(managerSquadIds(s).map(id=>[id,{playerId:id,availability:'AVAILABLE' as const}])),playerSquadStatus:Object.fromEntries(managerSquadIds(s).map(id=>[id,'SQUAD_PLAYER' as const]))};
}
function addMatch(s:CareerState,week:number,overrides:ReadonlyMap<string,number>=new Map(),type:CareerFixture['type']='LEAGUE'):CareerState {
  const f:CareerFixture={id:`playing-time:${week}`,competitionId:s.competitionId,round:week,date:addDays('2026-08-09',week*7),homeClubId:club,awayClubId:'swe2-aranas',type};
  const result=simulateMatch({fixtureId:f.id,seed:week,homeClubId:f.homeClubId,awayClubId:f.awayClubId,homeStrength:strength(f.homeClubId),awayStrength:strength(f.awayClubId)});
  const next={...s,gameDate:f.date,fixtures:[...s.fixtures,f],results:{...s.results,[f.id]:result}};
  return recordPlayingTimeMatch(next,f,new Map(managerSquadIds(s).map(id=>[id,overrides.get(id)??15])),'MEASURED',s);
}
function week(s:CareerState):CareerState {
  const date=addDays(s.gameDate,1),events:CareerEvent[]=[];
  let next=updateMoraleWeekly({...s,gameDate:date},date);
  next=progressTalks(next,date,e=>events.push(e));
  for(const event of events) if(!next.careerEvents.some(e=>e.id===event.id)) next={...next,careerEvents:[...next.careerEvents,event],inbox:[...next.inbox,careerEventToInboxMessage(event,next)]};
  return next;
}
function benched(weeks=6):{state:CareerState;id:string} {
  let state=fresh();const id=managerSquadIds(state)[0]!;state=updatePlayerSquadStatus(state,id,'KEY_PLAYER');
  for(let w=0;w<weeks;w++) state=week(addMatch(state,w,new Map([[id,0]])));
  return {state,id};
}

test('role and developmental expectations are distinct; specialist roles count court time in their phase',()=>{
  assert.ok(expectedCourtMinutes('KEY_PLAYER','BOTH_PHASES',30)>expectedCourtMinutes('FIRST_CHOICE','BOTH_PHASES',30));
  assert.ok(expectedCourtMinutes('FIRST_CHOICE','BOTH_PHASES',30)>expectedCourtMinutes('ROTATION','BOTH_PHASES',30));
  assert.ok(expectedCourtMinutes('TALENT','BOTH_PHASES',17)<expectedCourtMinutes('TALENT','BOTH_PHASES',22));
  assert.equal(expectedCourtMinutes('KEY_PLAYER','DEFENCE_ONLY',30),21);
  assert.equal(expectedCourtMinutes('KEY_PLAYER','ATTACK_ONLY',30),21);
});

test('star repeatedly benched declines gradually and produces one actionable, explained discussion',()=>{
  const {state,id}=benched();
  const m=state.playerDynamics!.morale[id]!;
  assert.equal(m.playingTimeUnmetWeeks,3);
  assert.ok(m.moralePct<70);
  assert.ok(m.factors.some(f=>f.key==='PLAYING_TIME'&&f.points<0&&f.label.includes('minuter')));
  const concerns=openConcerns(state,id);assert.equal(concerns.length,1);
  assert.deepEqual(concerns[0]!.options.map(o=>o.id),['EARN_IT','LISTEN_OFFERS']);
  const event=state.careerEvents.find(e=>e.id.includes(concerns[0]!.id))!;
  assert.equal(event.priority,'ACTION_REQUIRED');assert.equal(event.resolved,false);
  const message=state.inbox.find(m=>m.careerEventId===event.id)!;
  assert.equal(message.actionRequired,true);assert.equal(message.resolved,false);
  assert.ok(message.body.some(line=>line.includes('minuter')));
  assert.ok(message.destinations!.some(d=>d.route==='PLAYER_PROFILE'&&d.playerId===id));
  assert.equal(archiveMessage(state,message.id),state);
  const read=markMessageRead(state,message.id);
  assert.equal(read.inbox.find(m=>m.id===message.id)!.resolved,false);
  assert.equal(continueCareerRhythm(read).stopReason,'ACTION_REQUIRED_PENDING');
});

test('one match or a packed single week cannot produce playing-time penalties or complaints',()=>{
  let s=fresh();const id=managerSquadIds(s)[0]!;s=updatePlayerSquadStatus(s,id,'KEY_PLAYER');
  s=week(addMatch(s,0,new Map([[id,0]])));
  assert.equal(assessPlayingTime(s,id).status,'WARMUP');assert.equal(openConcerns(s,id).length,0);
  assert.ok(!moraleFactors(s,id).some(f=>f.key==='PLAYING_TIME'));
  const four=benched(4).state;
  const packed={...four,playerDynamics:{...four.playerDynamics!,playingTime:Object.fromEntries(Object.entries(four.playerDynamics!.playingTime!).map(([key,m],i)=>[key,{...m,date:addDays(four.gameDate,-i)}]))}};
  assert.equal(assessPlayingTime(packed,id).status,'WARMUP');
});

test('prospect receiving increased minutes gains a positive factor over several weeks',()=>{
  let s=fresh();const id=managerSquadIds(s)[1]!;s=updatePlayerSquadStatus(s,id,'TALENT');
  for(let w=0;w<6;w++) s=week(addMatch(s,w,new Map([[id,24]])));
  assert.equal(assessPlayingTime(s,id).status,'EXCEEDED');
  assert.ok(moraleFactors(s,id).some(f=>f.key==='PLAYING_TIME'&&f.points>0));
  assert.equal(s.playerDynamics!.morale[id]!.playingTimeUnmetWeeks,0);
  assert.equal(openConcerns(s,id).length,0);
});

test('defensive and offensive specialists are not judged by attacking starts or attacking contributions',()=>{
  for(const phaseUsage of ['DEFENCE_ONLY','ATTACK_ONLY'] as const){
    let s=fresh();const id=managerSquadIds(s)[2]!;
    s=updatePlayerSquadStatus(s,id,'KEY_PLAYER');
    s={...s,playerMatchDefaults:{...s.playerMatchDefaults,[id]:{matchRole:'STARTER',playingTimeIntention:'HIGH',phaseUsage}}};
    for(let w=0;w<6;w++) s=week(addMatch(s,w,new Map([[id,25]])));
    assert.equal(assessPlayingTime(s,id).status,'MET');
    assert.ok(!moraleFactors(s,id).some(f=>f.key==='PLAYING_TIME'&&f.points<0));
    assert.equal(openConcerns(s,id).length,0);
    assert.equal(s.playerSeasonStats[id]?.starts??0,0,'no attacking starts were manufactured');
  }
});

test('existing substitution pairs identify defensive specialists even with generic phase defaults',()=>{
  let s=fresh();const players=getCareerClubSquad(s,club).filter(p=>p.position!=='MV'),id=players[0]!.id,attacker=players[1]!.id;
  const plan=buildDefaultMatchPlan(buildInitialMatchSquad(getCareerClubSquad(s,club),'playing-time:0',club)).plan!;
  s={...s,preferredLineup:{...plan,substitutionPairs:[{attackPlayerId:attacker,defencePlayerId:id}],playerUsage:plan.playerUsage.map(u=>({...u,phaseUsage:'BOTH_PHASES'}))}};
  s=updatePlayerSquadStatus(s,id,'KEY_PLAYER');s=addMatch(s,0,new Map([[id,25]]));
  assert.equal(s.playerDynamics!.playingTime!['playing-time:0']!.players[id]!.phase,'DEFENCE_ONLY');
  assert.equal(s.playerDynamics!.playingTime!['playing-time:0']!.players[id]!.expectedMinutes,21);
});

test('injury, suspension, rehabilitation, placement and national duty do not count as benching',()=>{
  for(const availability of ['INJURED','SUSPENDED','RECOVERING','LIMITED','ON_PLACEMENT','NATIONAL_TEAM'] as const){
    let s=fresh();const id=managerSquadIds(s)[0]!;s=updatePlayerSquadStatus(s,id,'KEY_PLAYER');
    s={...s,playerStatuses:{...s.playerStatuses,[id]:{playerId:id,availability}}};
    for(let w=0;w<6;w++) s=week(addMatch(s,w,new Map([[id,0]])));
    assert.equal(assessPlayingTime(s,id).status,'UNAVAILABLE');
    assert.equal(assessPlayingTime(s,id).eligibleMatches,0);
    assert.equal(s.playerDynamics!.morale[id]!.playingTimeUnmetWeeks,0);
    assert.ok(!moraleFactors(s,id).some(f=>f.key==='PLAYING_TIME'&&f.points<0));
    assert.equal(openConcerns(s,id).length,0);
    const recovered={...s,playerStatuses:{...s.playerStatuses,[id]:{playerId:id,availability:'AVAILABLE' as const}}};
    assert.equal(assessPlayingTime(recovered,id).status,'WARMUP','recovery never reclassifies past unavailable matches');
  }
});

test('post-match injury cannot erase the pre-match availability snapshot',()=>{
  const s=fresh(),id=managerSquadIds(s)[0]!,played=addMatch(s,0);
  assert.equal(played.playerDynamics!.playingTime!['playing-time:0']!.players[id]!.available,true);
  const injured={...played,playerStatuses:{...played.playerStatuses,[id]:{playerId:id,availability:'INJURED' as const}}};
  assert.equal(recordPlayingTimeMatch(injured,injured.fixtures.at(-1)!,new Map([[id,0]]),'MEASURED',s),injured,'repeat completion cannot rewrite match-time facts');
});

test('answering resolves the linked inbox action and persists a morale effect without adding a promise',()=>{
  const {state,id}=benched(),c=openConcerns(state,id)[0]!,before=moraleOf(state,id);
  const answered=answerConcern(state,c.id,'EARN_IT');
  assert.equal(openConcerns(answered,id).length,0);
  assert.equal(answered.playerDynamics!.concerns[c.id]!.status,'ANSWERED');
  assert.equal(Object.keys(answered.playerDynamics!.promises).length,0);
  assert.equal(answered.playerDynamics!.morale[id]!.shocks!.at(-1)!.until,addDays(state.gameDate,35));
  assert.equal(moraleOf(answered,id)-before,Math.round((personalityOf(state,id).professionalism>=12?3:-5)/2));
  const event=answered.careerEvents.find(e=>e.id.includes(c.id))!;
  assert.ok(event.resolved&&!event.requiresAction);
  assert.ok(answered.inbox.find(m=>m.careerEventId===event.id)!.resolved);
  const date=addDays(state.gameDate,7);
  assert.notEqual(updateMoraleWeekly({...answered,gameDate:date},date).playerDynamics!.morale[id]!.targetPct,updateMoraleWeekly({...state,gameDate:date},date).playerDynamics!.morale[id]!.targetPct);
  assert.throws(()=>answerConcern(answered,c.id,'EARN_IT'),/avslutat/);
});

test('duplicate weekly execution, unresolved concerns and missing new evidence cannot spawn duplicate issues',()=>{
  const {state,id}=benched();
  assert.equal(updateMoraleWeekly(state,state.gameDate),state);
  const events:CareerEvent[]=[];
  const repeated=progressTalks(state,state.gameDate,e=>events.push(e));
  assert.equal(events.length,0);assert.equal(openConcerns(repeated,id).length,1);
  const answered=answerConcern(state,openConcerns(state,id)[0]!.id,'EARN_IT');
  let later=answered;
  for(let w=1;w<=4;w++){const date=addDays(answered.gameDate,w*7);later=updateMoraleWeekly({...later,gameDate:date},date);later=progressTalks(later,date,e=>events.push(e));}
  assert.equal(events.filter(e=>e.primaryEntity?.entityId===id&&e.subject.includes('prata')).length,0);
  assert.equal(openConcerns(later,id).length,0);
});

test('persistent poor selection can recur after an answer, cooldown and fresh matches',()=>{
  const initial=benched();let s=initial.state;const id=initial.id;const first=openConcerns(s,id)[0]!;s=answerConcern(s,first.id,'EARN_IT');
  for(let w=6;w<11;w++)s=week(addMatch(s,w,new Map([[id,0]])));
  const concerns=Object.values(s.playerDynamics!.concerns).filter(c=>c.playerId===id&&c.kind==='PLAYING_TIME');
  assert.equal(concerns.length,2);assert.equal(concerns[0]!.status,'ANSWERED');assert.equal(concerns[1]!.status,'OPEN');
});

test('rolling history ages out, role edits apply prospectively, and new arrivals have no invented history',()=>{
  const initial=benched(4);let s=initial.state;const id=initial.id;
  const oldExpected=s.playerDynamics!.playingTime!['playing-time:0']!.players[id]!.expectedMinutes;
  s=updatePlayerSquadStatus(s,id,'TALENT');s=addMatch(s,4,new Map([[id,15]]));
  assert.equal(s.playerDynamics!.playingTime!['playing-time:0']!.players[id]!.expectedMinutes,oldExpected);
  assert.ok(s.playerDynamics!.playingTime!['playing-time:4']!.players[id]!.expectedMinutes<oldExpected);
  assert.equal(assessPlayingTime({...s,gameDate:addDays(s.gameDate,43)},id).status,'WARMUP');
  const other={...s,playerClubId:'swe2-aranas'};
  assert.equal(assessPlayingTime(other,id).status,'UNAVAILABLE');
});

test('legacy saves, JSON persistence and repeated completion preserve evidence and pending discussion exactly',()=>{
  const legacy=fresh();assert.equal(migrateCareerState(JSON.parse(JSON.stringify(legacy))).playerDynamics?.playingTime,undefined);
  const {state,id}=benched(),loaded=migrateCareerState(JSON.parse(JSON.stringify(state)));
  const oldWithResults=migrateCareerState(JSON.parse(JSON.stringify({...state,playerDynamics:undefined})));
  assert.equal(assessPlayingTime(oldWithResults,id).status,'WARMUP');
  assert.ok(!moraleFactors(oldWithResults,id).some(f=>f.key==='PLAYING_TIME'),'old starts/results never fabricate missed playing-time opportunities');
  assert.deepEqual(loaded.playerDynamics,state.playerDynamics);
  assert.deepEqual(assessPlayingTime(loaded,id),assessPlayingTime(state,id));
  assert.equal(recordPlayingTimeMatch(loaded,loaded.fixtures.at(-1)!,new Map([[id,60]]),'MEASURED'),loaded);
  const answer=answerConcern(loaded,openConcerns(loaded,id)[0]!.id,'EARN_IT');
  assert.deepEqual(migrateCareerState(JSON.parse(JSON.stringify(answer))).playerDynamics,answer.playerDynamics);
});

test('friendlies and mismatched result identities never create expectation opportunities',()=>{
  const s=fresh(),friendly=addMatch(s,0,new Map(),'FRIENDLY');
  assert.equal(friendly.playerDynamics?.playingTime,undefined);
  const played=addMatch(s,0),f=played.fixtures.at(-1)!;
  const corrupt={...played,playerDynamics:undefined,results:{...played.results,[f.id]:{...played.results[f.id]!,fixtureId:'other'}}};
  assert.equal(recordPlayingTimeMatch(corrupt,f,new Map(),'MEASURED'),corrupt);
});

test('multi-week manager scenario: star benched, prospect plays, discussion answered, star minutes recover',t=>{
  let s=fresh();const [star,prospect]=managerSquadIds(s);assert.ok(star&&prospect);
  s=updatePlayerSquadStatus(updatePlayerSquadStatus(s,star,'KEY_PLAYER'),prospect,'TALENT');
  const log:{week:number;starMinutes:number;morale:number;discussionRaised:boolean;answered:boolean;concerns:number}[]=[];
  for(let w=0;w<12;w++){
    s=week(addMatch(s,w,new Map([[star,w<6?0:55],[prospect,24]])));
    const discussionRaised=openConcerns(s,star).length>0;
    if(w===5)s=answerConcern(s,openConcerns(s,star)[0]!.id,'EARN_IT');
    log.push({week:w+1,starMinutes:w<6?0:55,morale:moraleOf(s,star),discussionRaised,answered:w===5,concerns:openConcerns(s,star).length});
    s=migrateCareerState(JSON.parse(JSON.stringify(s)));
  }
  assert.equal(assessPlayingTime(s,star).status,'EXCEEDED');
  assert.equal(s.playerDynamics!.morale[star]!.playingTimeUnmetWeeks,0);
  assert.equal(openConcerns(s,star).length,0);
  assert.ok(moraleOf(s,star)>log[5]!.morale);
  assert.equal(assessPlayingTime(s,prospect).status,'EXCEEDED');
  t.diagnostic(JSON.stringify(log));
});


test('the real daily tick emits the rolling concern once and its inbox action is resolved by the existing response',()=>{
  const base=benched(5),id=base.id;
  let s=addMatch(base.state,5,new Map([[id,0]]));
  const date=addDays(s.gameDate,1);
  s={...s,processedThroughDate:s.gameDate};
  const first=processDay(s,date);
  const concern=openConcerns(first.state,id)[0]!;assert.ok(concern);
  assert.ok(first.events.some(e=>e.type==='PLAYER_DYNAMICS'&&e.requiresAction&&e.primaryEntity?.entityId===id));
  assert.equal(first.state.gameDate,date);
  const again=processDay(first.state,date);
  assert.equal(again.events.length,0);
  const answered=answerConcern(first.state,concern.id,'EARN_IT');
  assert.ok(!answered.careerEvents.some(e=>e.id.includes(concern.id)&&e.requiresAction&&!e.resolved));
});

test('sales, loans and releases cannot leave an unanswerable playing-time action blocking the career',()=>{
  const {state:s,id}=benched(),c=openConcerns(s,id)[0]!;
  const changes=[
    transferPlayerPermanently(s,id,club,'swe2-aranas',s.playerContracts[id]!.wageEurPerMonth,'2028-05-31'),
    loanPlayerOut(s,id,club,'swe2-aranas'),
    releasePlayerToFreeAgency(s,id,s.gameDate),
  ];
  for(const next of changes){
    assert.equal(next.playerDynamics!.concerns[c.id]!.status,'LAPSED');
    assert.equal(next.playerDynamics!.concerns[c.id]!.outcome,'Spelaren representerar inte längre klubben; speltidssamtalet avslutas.');
    const event=next.careerEvents.find(e=>e.id.includes(c.id))!;
    assert.ok(event.resolved&&!event.requiresAction);
    assert.ok(next.inbox.find(m=>m.careerEventId===event.id)!.resolved);
    assert.deepEqual(next.playerDynamics!.playingTime,s.playerDynamics!.playingTime,'past facts are retained until normal rolling retention');
  }
});

test('recorded history is bounded and expired completion replay cannot restore an old match',()=>{
  let s=fresh();for(let w=0;w<12;w++)s=addMatch(s,w);
  assert.equal(Object.keys(s.playerDynamics!.playingTime!).length,6);
  const old=s.fixtures.find(f=>f.id==='playing-time:0')!;
  assert.equal(recordPlayingTimeMatch(s,old,new Map(),'MEASURED'),s);
});


test('listening to offers resolves the concern through the existing transfer list without executing a transfer',()=>{
  const {state,id}=benched(),c=openConcerns(state,id)[0]!;
  const answered=answerConcern(state,c.id,'LISTEN_OFFERS');
  assert.equal(answered.playerDynamics!.listings[id]!.reason,'TRANSFER_REQUEST');
  assert.equal(answered.playerDynamics!.concerns[c.id]!.status,'ANSWERED');
  assert.deepEqual(answered.worldSquads,state.worldSquads);
  assert.deepEqual(answered.playerContracts,state.playerContracts);
  assert.equal(Object.keys(answered.playerDynamics!.promises).length,0);
  assert.ok(answered.playerDynamics!.morale[id]!.shocks!.some(s=>s.points>0));
  const loaded=migrateCareerState(JSON.parse(JSON.stringify(answered)));
  assert.deepEqual(loaded.playerDynamics!.listings,answered.playerDynamics!.listings);
});
