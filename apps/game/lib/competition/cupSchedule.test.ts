import { addDays } from '../career/dateUtils';
﻿import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from '../career/newCareer';
import type { CareerFixture, CareerState } from '../career/types';
import type { CompetitionTie } from './types';
import { cupDateProfile, scheduleCupFixtures, ensureCupCalendar, validateCupCalendar, CalendarSchedulingError } from './cupSchedule';
import { SVENSKA_CUPEN, HANDBOLLSLIGAN, ALLSVENSKAN } from './rules';
import { progressCompetitions, freeDate } from './season';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../gameWorld/serverSnapshot';
import { rolloverSeason } from '../career/seasonRollover';
import { migrateCareerState } from '../career/saveMigration';
import { continueCareerRhythm } from '../career/continueController';

function base(): CareerState { return { ...createNewCareerState('fixed-cup-test','swe2-tumba'), gameDate:'2026-08-01', processedThroughDate:'2026-07-31', fixtures:[], results:{}, competitionTies:{} }; }
function tie(): CompetitionTie { return { id:'test:r16', seasonId:'2026/27', competitionId:SVENSKA_CUPEN, stage:'CUP_R16', label:'Åttondelsfinal', highClubId:'a',lowClubId:'b', format:{kind:'TWO_LEGS'}, key:'R16-1',fixtureIds:['leg1','leg2'] }; }
function legs(t=tie()): CareerFixture[] { return [0,1].map(k=>({id:t.fixtureIds[k]!,competitionId:SVENSKA_CUPEN,round:k+1,date:k?'2026-09-12':'2026-09-05',homeClubId:k?'a':'b',awayClubId:k?'b':'a',type:'CUP',stage:{tieId:t.id,game:k+1,mustDecide:!!k}})); }
const league=(id:string,date:string):CareerFixture=>({id,date,competitionId:ALLSVENSKAN,round:1,homeClubId:'a',awayClubId:'c',type:'LEAGUE'});

test('2026/27 profile follows published two-leg windows, single later rounds and confirmed 27 February final',()=>{
 const p=cupDateProfile('2026/27');assert.equal(p.provenance,'PUBLISHED_2026_27');
 assert.deepEqual(p.rounds.CUP_R32,[{start:'2026-08-20',end:'2026-08-26'},{start:'2026-08-26',end:'2026-08-30'}]);
 assert.deepEqual(p.rounds.CUP_R16,[{start:'2026-09-05',end:'2026-09-06'},{start:'2026-09-12',end:'2026-09-13'}]);
 assert.equal(p.rounds.CUP_QF![0].start,'2026-09-16');assert.equal(p.rounds.CUP_SF![0].start,'2026-09-20');assert.equal(p.rounds.CUP_F![0].start,'2027-02-27');
 assert.equal(cupDateProfile('2027/28').provenance,'PROVISIONAL_FUTURE');assert.equal(cupDateProfile('2027/28').rounds.CUP_F![0].start,'2028-02-27');
});

test('two legs inherit their round windows with unchanged home/away and decider flags',()=>{
 const s=base(),t=tie(),raw=legs(t);s.competitionTies={[t.id]:t};const next=scheduleCupFixtures(s,raw);
 assert.deepEqual(next.fixtures.map(f=>({id:f.id,date:f.date,home:f.homeClubId,away:f.awayClubId,decide:f.stage!.mustDecide})),[{id:'leg1',date:'2026-09-05',home:'b',away:'a',decide:false},{id:'leg2',date:'2026-09-12',home:'a',away:'b',decide:true}]);
 assert.equal(s.fixtures.length,0);
});

test('cup/league collision moves only an unplayed league fixture within its bounded window and records the original date',()=>{
 const s=base(),t=tie();s.competitionTies={[t.id]:t};s.fixtures=[{...league('league','2026-09-06'),sourceMatchId:'real-id',kickoffTime:'19:00'}];
 const n=scheduleCupFixtures(s,legs(t));const moved=n.fixtures.find(f=>f.id==='league')!;assert.equal(moved.date,'2026-09-07');assert.equal(moved.originalDate,'2026-09-06');assert.equal(moved.sourceMatchId,'real-id');assert.ok(moved.scheduleNote);validateCupCalendar(n);assert.equal(s.fixtures[0].date,'2026-09-06');
});

test('rest validation checks the day before an existing match as well as the day after',()=>{
 const s=base(),t=tie();s.competitionTies={[t.id]:t};s.fixtures=[{...league('friendly','2026-09-04'),type:'FRIENDLY'}];const n=scheduleCupFixtures(s,legs(t));assert.equal(n.fixtures.find(f=>f.id==='leg1')!.date,'2026-09-06');
 assert.equal(freeDate({gameDate:'2026-08-01',fixtures:[league('next','2026-09-06')]},['a'],'2026-09-05'),'2026-09-08');
});

test('an impossible fixed window reports a conflict atomically instead of returning a back-to-back date',()=>{
 const s=base(),t=tie();s.competitionTies={[t.id]:t};s.fixtures=[{...league('before','2026-09-04'),type:'FRIENDLY'},{...league('after','2026-09-07'),type:'FRIENDLY'}];const before=JSON.stringify(s);
 assert.throws(()=>scheduleCupFixtures(s,legs(t)),CalendarSchedulingError);assert.equal(JSON.stringify(s),before);
 const occupied=Array.from({length:65},(_,i)=>league('busy'+i,`2026-${i<30?'09':'10'}-${String((i%30)+1).padStart(2,'0')}`));
 assert.throws(()=>freeDate({gameDate:'2026-08-01',fixtures:occupied},['a'],'2026-09-01'),CalendarSchedulingError);
});

test('league movement cannot escape its seven-day permitted radius',()=>{
 const s=base(),t=tie();s.competitionTies={[t.id]:t};s.fixtures=[league('blocked-league','2026-09-06'),...Array.from({length:30},(_,i)=>({...league('f'+i,addDays('2026-08-25',i)),homeClubId:'c',awayClubId:'d',type:'FRIENDLY' as const}))];
 assert.throws(()=>scheduleCupFixtures(s,legs(t)),CalendarSchedulingError);
});

let world: ReturnType<typeof createNewCareerState> | undefined;
function fresh(){if(!world){const comps=[HANDBOLLSLIGAN,ALLSVENSKAN,'se_division1_norra','se_division1_sodra'];world=createNewCareerState('cup-calendar-hotfix','swe2-tumba',Object.assign({},...comps.map(snapshotWorldSquads)),undefined,Object.assign({},...comps.map(snapshotGameplayRatings)),undefined,'FIRST_MATCH');}return JSON.parse(JSON.stringify(world)) as CareerState;}

test('fresh career starts at its first actual cup match without a second provisional cup and reaches MATCHDAY_READY',()=>{
 const s=fresh();assert.equal(s.gameDate,'2026-08-20');assert.equal(s.fixtures.filter(f=>f.type==='CUP').length,32);assert.ok(s.fixtures.every(f=>!f.id.startsWith('cup-')));
 const n=continueCareerRhythm(s);assert.equal(n.stopReason,'ACTION_REQUIRED');assert.ok(n.state.careerEvents.some(e=>e.type==='MATCHDAY_READY'&&!e.resolved));
});

test('advancing teams receive predefined future slots through all rounds without cup/league congestion',()=>{
 let s=fresh();for(let step=0;step<10;step++){
 const pending=s.fixtures.filter(f=>f.competitionId===SVENSKA_CUPEN&&!s.results[f.id]).sort((a,b)=>a.date.localeCompare(b.date));if(!pending.length)break;const date=pending[0].date;
 const results={...s.results};for(const f of pending.filter(f=>f.date===date)){const t=s.competitionTies![f.stage!.tieId];const highHome=f.homeClubId===t.highClubId;results[f.id]={fixtureId:f.id,homeClubId:f.homeClubId,awayClubId:f.awayClubId,homeGoals:highHome?30:20,awayGoals:highHome?20:30} as CareerState['results'][string];}
 s=progressCompetitions({...s,gameDate:date,processedThroughDate:date,results},date);validateCupCalendar(s);
 }
 const ties=Object.values(s.competitionTies!).filter(t=>t.competitionId===SVENSKA_CUPEN);for(const [stage,count]of [['CUP_R32',16],['CUP_R16',8],['CUP_QF',4],['CUP_SF',2],['CUP_F',1]]as const){const round=ties.filter(t=>t.stage===stage);assert.equal(round.length,count,stage);assert.ok(round.every(t=>t.winnerClubId));assert.ok(round.every(t=>t.fixtureIds.length===(stage==='CUP_R32'||stage==='CUP_R16'?2:1)));}
 assert.equal(s.fixtures.filter(f=>f.competitionId===SVENSKA_CUPEN).length,55);assert.ok(!ties.some(t=>t.stage==='CUP_3RD'));assert.equal(s.fixtures.find(f=>s.competitionTies![f.stage?.tieId??'']?.stage==='CUP_F')!.date,'2027-02-27');
});

test('legacy save repair preserves played groups, results and two-leg assignments',()=>{
 const s=base(),t=tie();const group={...t,id:'legacy-group',stage:'CUP_GROUP' as const,key:'GA',group:'A',clubIds:['x','y','z','w'],fixtureIds:['played']};const played:CareerFixture={...legs()[0],id:'played',date:'2026-08-27',homeClubId:'x',awayClubId:'y',stage:{tieId:group.id,game:1,mustDecide:false}};
 s.fixtures=[played,legs()[0],{...legs()[1],date:'2026-09-06'}];s.results.played={fixtureId:'played',homeClubId:'x',awayClubId:'y',homeGoals:22,awayGoals:21} as CareerState['results'][string];s.competitionTies={[group.id]:group,[t.id]:t};
 const n=ensureCupCalendar(s);assert.deepEqual(n.fixtures.find(f=>f.id==='played'),played);assert.deepEqual(n.results,s.results);assert.equal(n.fixtures.find(f=>f.id==='leg1')!.date,'2026-10-21');assert.equal(n.fixtures.find(f=>f.id==='leg2')!.date,'2026-10-28');assert.equal(n.competitionTies![t.id].format.kind,'TWO_LEGS');
 const loaded=migrateCareerState(JSON.parse(JSON.stringify(n)));assert.deepEqual(loaded.fixtures,n.fixtures);assert.deepEqual(loaded.results,n.results);
});

test('rollover builds and validates the next season profile atomically and is idempotent',()=>{
 const s={...fresh(),seasonComplete:true};const n=rolloverSeason(s);assert.equal(n.seasonId,'2027/28');assert.ok(n.fixtures.some(f=>f.id.startsWith('2027-cup-R32-')));validateCupCalendar(n);assert.equal(rolloverSeason(n),n);const loaded=migrateCareerState(JSON.parse(JSON.stringify(n)));assert.deepEqual(loaded.fixtures,n.fixtures);
});


test('late generation cannot schedule the second cup leg on the next day',()=>{
 const s=base();s.gameDate='2026-08-26';s.processedThroughDate='2026-08-25';const t={...tie(),stage:'CUP_R32' as const};s.competitionTies={[t.id]:t};const raw=legs(t);const n=scheduleCupFixtures(s,raw);assert.deepEqual(n.fixtures.map(f=>f.date),['2026-08-26','2026-08-28']);
});

test('Continue reports an unresolved calendar atomically and deduplicates the inbox warning',()=>{
 const s=fresh();s.gameDate='2027-02-20';s.processedThroughDate=s.gameDate;const before=JSON.stringify({contracts:s.playerContracts,economies:s.clubEconomies,results:s.results,fixtures:s.fixtures});
 const first=continueCareerRhythm(s);assert.equal(first.stopReason,'CALENDAR_CONFLICT');assert.equal(first.daysProcessed,0);assert.equal(first.state.gameDate,s.gameDate);assert.ok(first.events.some(e=>e.subject==='Kalendern kan inte fortsätta'));
 assert.equal(JSON.stringify({contracts:first.state.playerContracts,economies:first.state.clubEconomies,results:first.state.results,fixtures:first.state.fixtures}),before);
 const again=continueCareerRhythm(first.state);assert.equal(again.stopReason,'CALENDAR_CONFLICT');assert.equal(again.state.inbox.length,first.state.inbox.length);
});

test('friendly booking cannot bypass cup rest rules or charge the club on refusal',async()=>{
 const { bookFriendly }=await import('../career/preseason');const { planFriendly }=await import('../career/preseasonPlanning');const s=fresh();
 const next={...s,gameDate:'2026-08-19',processedThroughDate:'2026-08-18'};const cash=JSON.stringify(next.clubEconomies);
 const direct=bookFriendly(next,'2026-08-19','swe2-guif');assert.equal(direct.ok,false);assert.equal(direct.state,next);
 const planned=planFriendly(next,{date:'2026-08-19',opponentClubId:'swe2-guif',venue:'HOME'});assert.equal(planned.ok,false);assert.equal(planned.state,next);assert.equal(JSON.stringify(next.clubEconomies),cash);
});
