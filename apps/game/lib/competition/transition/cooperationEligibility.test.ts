import { createHash } from 'node:crypto';
﻿import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateMatch, seedFromString } from '@handball-manager/game-simulation';
import { CLUBS } from '../../game-data';
import { createNewCareerState } from '../../career/newCareer';
import type { CareerState } from '../../career/types';
import { migrateCareerState } from '../../career/saveMigration';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../../gameWorld/serverSnapshot';
import { SWEDISH_WORLD_COMPETITION_IDS } from '../../career/worldCompetitions';
import { terminatePartnership, PERMANENT_B_TEAM_PAIRS } from '../../career/clubPartnerships';
import { prepareGameContinuity } from './gameContinuity';
import { cooperationEligibility, enforceCareerCooperationEligibility } from './cooperationEligibility';
import { SWEDISH_2026_RULES as official, SWEDISH_LEAGUES as L, SWEDISH_FAMILIES as F } from './sweden2026';
import { snapshotCompetitionTransitionInput } from './careerSnapshot';
import { planCompetitionTransition } from './planner';
import { progressCareerQualifications } from './careerQualifications';
import { buildNewSeasonCalendar } from '../seasonCalendar';
import { applyKnockoutDecider, progressCompetitions } from '../season';
import { checkSeasonComplete } from '../../career/calendar';
import { addDays } from '../../career/dateUtils';
import { computeSquadDerivedClubStrength } from '../../career/squadDerivedClubStrength';
import { getCareerClubSquad } from '../../career/careerWorld';
import { attemptSeasonTransition, type SeasonTransitionRequest } from '../../career/seasonTransition';
import { competitionClubIds } from '../tables';
import type { CompetitionRules, EntryRule } from './types';

const hp = 'se_club_hp_alingsas';
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function career() {
 const squads=Object.assign({},...SWEDISH_WORLD_COMPETITION_IDS.map(snapshotWorldSquads));
 const ratings=Object.assign({},...SWEDISH_WORLD_COMPETITION_IDS.map(snapshotGameplayRatings));
 assert.ok((squads[hp]?.length??0)>=7,'run from apps/game: real production HP squad is required');
 return createNewCareerState('playable-pyramid-v1',hp,squads,undefined,ratings);
}
const agreement=(s:CareerState)=>Object.values(s.clubPartnerships).find(p=>p.clubBId===hp)!;

test('all five existing production ACTIVE affiliations enforce SHF without optional metadata; names alone do not',()=>{
 const s=career();
 for(const pair of PERMANENT_B_TEAM_PAIRS){
  const p=Object.values(s.clubPartnerships).find(p=>p.clubAId===pair.clubAId&&p.clubBId===pair.clubBId)!;
  assert.equal(p.status,'ACTIVE');assert.equal(p.competitionRestriction,undefined);
  for(const tier of [1,2])assert.equal(cooperationEligibility(s,pair.clubBId,tier,'2027-03-18').eligible,false,pair.clubBId);
  assert.equal(cooperationEligibility(s,pair.clubBId,3,'2027-03-18').eligible,true);
 }
 assert.equal(cooperationEligibility({...s,clubPartnerships:{}},hp,2,'2027-03-18').eligible,true,'no name-based permanent restriction');
 const p=agreement(s);
 assert.equal(cooperationEligibility({...s,clubPartnerships:{[p.id]:{...p,status:'EXPIRED',endDate:'2026-06-30'}}},hp,2,'2027-03-18').eligible,true,'do not reactivate an expired prior-season agreement');
});

test('SHF December 31 deadline: valid termination restores opportunity; January termination cannot release spring promotion',()=>{
 const s=career(),p=agreement(s),terminable={...s,clubPartnerships:{[p.id]:{...p,permanent:false}}};
 const early=terminatePartnership(terminable,p.id,'2026-12-31');
 assert.equal(agreement(early).status,'TERMINATED');
 assert.equal(cooperationEligibility(early,hp,2,'2026-12-31').eligible,true,'July-December termination takes effect immediately');
 assert.equal(cooperationEligibility(early,hp,2,'2027-03-18').eligible,true);
 const late=terminatePartnership(terminable,p.id,'2027-01-01');
 assert.equal(agreement(late).status,'TERMINATED');
 assert.equal(cooperationEligibility(late,hp,2,'2027-03-18').eligible,false);
 assert.equal(cooperationEligibility({...late,seasonId:'2027/28'},hp,2,'2028-03-18').eligible,true,'inactive agreement is not carried into another season');
 assert.equal(cooperationEligibility(migrateCareerState(JSON.parse(JSON.stringify(early))),hp,2,'2027-03-18').eligible,true);
});

/** Closed two-league boundary is ONLY a targeted atomic integration fixture, not a new Swedish policy.
 * Real 14/12 memberships, existing production squads and match simulation. No Division 2 squad creation.
 */
function rules(year=2026):CompetitionRules {
 const source={url:'qa:cooperation-targeted-rollover',section:'Closed Allsvenskan/Division 1 Sodra test boundary; not an official complete pyramid.'};
 const leagues=official.leagues.filter(l=>[L.allsvenskan,L.sodra].includes(l.id as typeof L.sodra));
 const entries:EntryRule[]=leagues.flatMap(l=>Array.from({length:l.size},(_,i)=>{
  const rank=i+1,up=l.id===L.sodra&&rank===1,down=l.id===L.allsvenskan&&rank===l.size;
  return {id:`${l.id}:rank:${rank}`,selector:{kind:'RANK' as const,competitionId:l.id,rank},purpose:up||down?'DIRECT' as const:'RETAIN' as const,targetFamilyId:up?F.allsvenskan:down?F.division1:l.familyId,eligibility:up,replacement:up?'UPPER_HALF' as const:'NONE' as const,source};
 }));
 return {...official,id:`qa-cooperation-rollover-${year}`,provenance:'GAME_CONTINUITY',seasonId:`${year}/${String(year+1).slice(-2)}`,nextSeasonId:`${year+1}/${String(year+2).slice(-2)}`,families:official.families.filter(f=>[F.allsvenskan,F.division1].includes(f.id as typeof F.division1)),leagues,entries,stages:[],limitations:[]};
}
function request(s:CareerState):SeasonTransitionRequest {
 const r=rules();
 return {fromSeasonId:s.seasonId,rules:r,evidence:{eligibility:CLUBS.filter(c=>r.leagues.some(l=>l.id===c.competitionId)).flatMap(c=>r.families.map(f=>({clubId:c.id,targetFamilyId:f.id,seasonId:s.seasonId,status:'ELIGIBLE' as const,evidence:'QA caller attestation must NOT override actual career cooperation.'})))},nextSeason:{rules:rules(2027),kickoffDate:'2027-09-01',evidence:'Targeted closed-boundary QA calendar.'}};
}
let completed:CareerState;
function finishTargetedSeason(){
 if(completed)return structuredClone(completed);
 let s=career();s={...s,seasonTransitionRequest:request(s)};
 s=buildNewSeasonCalendar(s,'2026-09-01',[L.allsvenskan,L.sodra]);
 for(let day=0;day<440&&!s.seasonComplete;day++){
  const date=s.gameDate;
  const strength=(id:string)=>computeSquadDerivedClubStrength(id,getCareerClubSquad(s,id),s.gameplayRatings[id]??[]);
  for(const f of s.fixtures.filter(f=>f.date===date&&!s.results[f.id])){
   const score=simulateMatch({fixtureId:f.id,seed:seedFromString(`${s.saveSeed}:${f.id}`),homeClubId:f.homeClubId,awayClubId:f.awayClubId,homeStrength:strength(f.homeClubId),awayStrength:strength(f.awayClubId)});
   s={...s,results:{...s.results,[f.id]:applyKnockoutDecider(s,f,score,strength)}};
  }
  s=checkSeasonComplete(progressCompetitions(s,date));
  if(!s.seasonComplete)s={...s,gameDate:addDays(date,1)};
 }
 assert.equal(s.seasonComplete,true);completed=s;return structuredClone(s);
}

test('qualification and promotion share production checks even when QA attests every club eligible',()=>{
 const s=finishTargetedSeason(),r=request(s),raw=snapshotCompetitionTransitionInput(s,r.evidence,r.rules);
 assert.equal(planCompetitionTransition(raw).directPromotions.find(c=>c.fromCompetitionId===L.sodra)!.clubId,hp,'reproduces the old caller-evidence bypass');
 const normal=prepareGameContinuity({...s,seasonTransitionRequest:undefined},'2027-03-18');
 assert.equal(normal.request.evidence!.eligibility!.find(e=>e.clubId===hp&&e.targetFamilyId===F.allsvenskan)!.status,'INELIGIBLE','normal default career path');
 assert.equal(Object.keys(normal.state.worldSquads).length,Object.keys(s.worldSquads).length,'no pool squad creation');
 const guarded=planCompetitionTransition(enforceCareerCooperationEligibility(s,raw));
 const promoted=guarded.directPromotions.find(c=>c.fromCompetitionId===L.sodra)!;
 assert.notEqual(promoted.clubId,hp);
 assert.equal(cooperationEligibility(s,promoted.clubId,2,'2027-03-18').eligible,true);
 const officialProgress=progressCareerQualifications(s,'2027-03-18',{...r,rules:official});
 assert.ok(!officialProgress.proposal.directPromotions.some(c=>c.clubId===hp));
 assert.ok(officialProgress.proposal.qualification.every(q=>!q.participants.includes(hp)));
 const p=agreement(s),laterAgreement={...s,clubPartnerships:{...s.clubPartnerships,[p.id]:{...p,startDate:'2027-03-20'}}};
 const beforeStart=progressCareerQualifications(laterAgreement,'2027-03-18',r);
 assert.ok(beforeStart.proposal.directPromotions.some(c=>c.clubId===hp));
 const afterStart=progressCareerQualifications(laterAgreement,'2027-03-21',r);
 assert.ok(!afterStart.proposal.directPromotions.some(c=>c.clubId===hp),'qualification uses the actual processing date, not frozen March 18 evidence');
 const loaded=migrateCareerState(JSON.parse(JSON.stringify(s)));
 assert.deepEqual(enforceCareerCooperationEligibility(loaded,raw).eligibility,enforceCareerCooperationEligibility(s,raw).eligibility);
});

test('one targeted rollover replaces HP with the next eligible finisher; sizes, history and load survive',t=>{
 const s=finishTargetedSeason(),before=JSON.stringify(s),r=request(s),result=attemptSeasonTransition(s,r);
 assert.equal(result.status,'APPLIED',JSON.stringify(result.blockers));
 const promoted=result.preview!.proposal.directPromotions.find(c=>c.fromCompetitionId===L.sodra)!;
 assert.notEqual(promoted.clubId,hp);
 const ranking=result.preview!.proposal.rankings.find(x=>x.competitionId===L.sodra)!.groups.flatMap(g=>g.clubIds);
 const nextEligible=ranking.find(id=>cooperationEligibility(s,id,2,'2027-03-18').eligible);
 assert.equal(promoted.clubId,nextEligible);
 assert.equal(result.state.competitionMembership![hp],L.sodra);assert.equal(result.state.playerClubId,hp);assert.equal(result.state.competitionId,L.sodra);
 for(const l of official.leagues)assert.equal(competitionClubIds(result.state,l.id).length,l.size);
 assert.equal(new Set(official.leagues.flatMap(l=>competitionClubIds(result.state,l.id))).size,52);
 assert.equal(hash(result.state.seasonHistory!.at(-1)!.results),hash(s.results),'archived results');assert.equal(hash(result.state.seasonHistory!.at(-1)!.fixtures),hash(s.fixtures),'archived fixtures');
 assert.equal(JSON.stringify(s),before);
 const loaded=migrateCareerState(JSON.parse(JSON.stringify(result.state)));
 assert.equal(hash(loaded.seasonHistory),hash(result.state.seasonHistory),'season history after load');assert.equal(hash(loaded.clubPartnerships),hash(result.state.clubPartnerships),'cooperation after load');
 assert.equal(attemptSeasonTransition(loaded,r).status,'ALREADY_APPLIED');
 assert.ok(Object.keys(s.worldSquads).every(id=>!id.startsWith('se_div2_team_')),'no Division 2 squads generated');
 t.diagnostic(JSON.stringify({season:s.seasonId,date:s.gameDate,blockedClub:hp,nextEligible:promoted.clubId,rank:ranking.indexOf(promoted.clubId)+1,results:Object.keys(s.results).length,activeClubCount:52}));
});

test('atomic final gate rejects a custom profile that disables planner eligibility checks',()=>{
 const s=finishTargetedSeason(),r=request(s);
 const lax={...r,rules:{...r.rules!,entries:r.rules!.entries.map(e=>e.purpose==='DIRECT'&&e.targetFamilyId===F.allsvenskan?{...e,eligibility:false,replacement:'NONE' as const}:e)}};
 const result=attemptSeasonTransition(s,lax);
 assert.equal(result.status,'BLOCKED');assert.equal(result.state,s);assert.ok(result.blockers.some(b=>b.code==='COOPERATION_TARGET_INELIGIBLE'));
});
