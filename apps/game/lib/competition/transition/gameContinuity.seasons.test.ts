import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateMatch, seedFromString } from '@handball-manager/game-simulation';
import { prepareGameContinuity } from './gameContinuity';
import { planCompetitionTransition } from './planner';
import { snapshotCompetitionTransitionInput } from './careerSnapshot';
import { continuityTestCareer } from './gameContinuity.fixtures';
import { applyKnockoutDecider, progressCompetitions } from '../season';
import { checkSeasonComplete } from '../../career/calendar';
import { computeSquadDerivedClubStrength } from '../../career/squadDerivedClubStrength';
import { getCareerClubSquad } from '../../career/careerWorld';
import { attemptSeasonTransition } from '../../career/seasonTransition';
import { migrateCareerState } from '../../career/saveMigration';
import { addDays } from '../../career/dateUtils';
import { competitionClubIds } from '../tables';
import { SWEDISH_2026_RULES as official } from './sweden2026';
import { createHash } from 'node:crypto';

/** Focused competition-domain continuation: existing Fast Match + calendar/qualification pipeline.
 * QA-only pool squads; no result, money, membership or player-ability manipulation.
 * This does not replace whole-career manager/contract/lifecycle testing. */
test('three complete seeded seasons retain history and resolve four-tier movements through atomic rollover', t=>{
 let s=continuityTestCareer();
 const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
 const historyHashes:string[]=[];
 for(let season=0;season<3;season++){
  const from=s.seasonId, deadline=`${Number(from.slice(0,4))+1}-06-25`;
  for(let day=0;day<440&&!s.seasonComplete;day++){
   const date=s.gameDate;
   const strength=(id:string)=>computeSquadDerivedClubStrength(id,getCareerClubSquad(s,id),s.gameplayRatings[id]??[]);
   for(const f of s.fixtures.filter(f=>f.date===date&&!s.results[f.id])){
    const score=simulateMatch({fixtureId:f.id,seed:seedFromString(`${s.saveSeed}:${f.id}`),homeClubId:f.homeClubId,awayClubId:f.awayClubId,homeStrength:strength(f.homeClubId),awayStrength:strength(f.awayClubId)});
    s={...s,results:{...s.results,[f.id]:applyKnockoutDecider(s,f,score,strength)}};
   }
   s=checkSeasonComplete(progressCompetitions(s,date));
   if(s.gameDate>deadline)break;
   if(!s.seasonComplete)s={...s,gameDate:addDays(date,1)};
  }
  assert.equal(s.seasonComplete,true,JSON.stringify({from,date:s.gameDate,phase:s.seasonOutcome?.phase,blockers:s.seasonOutcome?.qualificationBlockers,unplayed:s.fixtures.filter(f=>f.type!=='FRIENDLY'&&!s.results[f.id]).map(f=>[f.id,f.date])}));
  if(season===0){
   const prepared=prepareGameContinuity(s), request=prepared.request;
   const snapshot=snapshotCompetitionTransitionInput(prepared.state,request.evidence,request.rules);
   const proposal=planCompetitionTransition({...snapshot,qualificationFixtures:[]});
   const champion=proposal.directPromotions.find(c=>c.fromCompetitionId==='se_division1_norra')!.clubId;
   const agreement={id:'qa-dated-cooperation',clubAId:'se_club_alingsas_hk',clubBId:champion,type:'AFFILIATED_B_TEAM' as const,status:'ACTIVE' as const,startDate:'2026-07-01',endDate:'2027-06-30',permanent:false,monthlyCostEur:0,lastBilledDate:null,competitionRestriction:{origin:'CAREER_AGREEMENT' as const,evidence:'QA created agreement; no real active cooperation is asserted.',effectiveFrom:'2026-07-01',effectiveUntil:'2027-06-30',highestEligibleTier:3}};
   const restricted={...s,clubPartnerships:{...s.clubPartnerships,[agreement.id]:agreement}};
   const preview=(state:typeof s)=>{const r=prepareGameContinuity(state).request;return planCompetitionTransition({...snapshotCompetitionTransitionInput(state,r.evidence,r.rules),qualificationFixtures:[]})};
   const blocked=preview(restricted);
   assert.ok(!blocked.directPromotions.some(c=>c.clubId===champion));
   assert.ok(blocked.directPromotions.some(c=>c.fromCompetitionId==='se_division1_norra'&&c.clubId!==champion),'verified upper-half successor takes the upward entry');
   const expired=preview({...restricted,clubPartnerships:{[agreement.id]:{...agreement,endDate:'2027-03-01'}}});
   assert.ok(expired.directPromotions.some(c=>c.clubId===champion),'validly ended agreement restores eligibility');
  }
  const oldResults=hash(s.results),oldFixtures=hash(s.fixtures),manager=s.playerClubId;
  const transition=attemptSeasonTransition(s);
  assert.equal(transition.status,'APPLIED',JSON.stringify({from,date:s.gameDate,blockers:transition.blockers}));
  const next=transition.state;
  assert.deepEqual(next.worldSquads,s.worldSquads);assert.deepEqual(next.playerContracts,s.playerContracts);
  assert.equal(attemptSeasonTransition(next).state,next,'second default rollover cannot duplicate a transition');
  const claims=[...transition.preview!.proposal.directPromotions,...transition.preview!.proposal.directRelegations,...transition.preview!.proposal.qualificationMovements];
  assert.ok(claims.some(c=>c.kind==='PROMOTION'));assert.ok(claims.some(c=>c.kind==='RELEGATION'));
  assert.ok(claims.some(c=>c.fromFamilyId==='se-men-tier-4-boundary'&&c.kind==='PROMOTION'));
  const ids=official.leagues.flatMap(l=>{const members=competitionClubIds(next,l.id);assert.equal(members.length,l.size);return members});
  assert.equal(ids.length,52);assert.equal(new Set(ids).size,52);
  assert.equal(next.playerClubId,manager);assert.equal(next.competitionId,next.competitionMembership![manager]);
  for(const f of next.fixtures.filter(f=>f.type==='LEAGUE')){assert.ok(competitionClubIds(next,f.competitionId).includes(f.homeClubId));assert.ok(competitionClubIds(next,f.competitionId).includes(f.awayClubId));}
  const archived=next.seasonHistory!.at(-1)!;assert.equal(hash(archived.results),oldResults);assert.equal(hash(archived.fixtures),oldFixtures);
  historyHashes.push(hash(archived));
  s=migrateCareerState(JSON.parse(JSON.stringify(next)));
  assert.deepEqual(s.seasonHistory!.map(hash),historyHashes);
  assert.equal(attemptSeasonTransition(s,JSON.parse(transition.receipt!.requestKey)).status,'ALREADY_APPLIED');
  t.diagnostic(JSON.stringify({from,to:s.seasonId,date:next.gameDate,results:Object.keys(archived.results!).length,fixtures:archived.fixtures!.length,managerClub:manager,managerCompetition:s.competitionId,movements:claims,poolDistricts:Object.fromEntries(Object.entries(s.swedishContinuity!.pools[from]!.districts).map(([id,d])=>[id,d.clubIds.length]))}));
 }
});
