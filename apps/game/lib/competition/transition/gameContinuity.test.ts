import test from 'node:test';
import assert from 'node:assert/strict';
import { gameContinuityRules, prepareGameContinuity, hasCompetitionSquad } from './gameContinuity';
import { cooperationEligibility } from './cooperationEligibility';
import { createNewCareerState } from '../../career/newCareer';
import { continuityTestCareer } from './gameContinuity.fixtures';
import { SWEDISH_2026_RULES as official } from './sweden2026';
import { attemptSeasonTransition } from '../../career/seasonTransition';
import { validatePlannerInput } from './validation';
import { canonicalCompetitionClubs } from './careerSnapshot';

test('future game profiles preserve supported structures and label their unverified home draw/date continuity',()=>{
 for(const year of [2026,2027,2028]){const r=gameContinuityRules(`${year}/${String(year+1).slice(-2)}`,'fixed');assert.equal(r.provenance,'GAME_CONTINUITY');assert.deepEqual(r.leagues,official.leagues);assert.deepEqual(validatePlannerInput({seasonId:r.seasonId,rules:r,clubs:canonicalCompetitionClubs(),standings:[]}),[]);assert.equal(r.stages.find(s=>s.id==='hbl-11')!.gameWindows![0].startDate,`${year+1}-03-29`);assert.ok(r.stages.find(s=>s.id==='d1-n-semi-10')!.source.url.startsWith('game-continuity:'));}assert.equal(official.stages.find(s=>s.id==='d1-n-semi-10')!.homeOrder,null);
});
test('missing stock pool squads report an atomic blocker, never fictional entrants or a future-publication dependency',()=>{
 const s={...createNewCareerState('stock-pool','swe2-tumba'),gameDate:'2027-05-01',seasonComplete:true};const before=JSON.stringify(s),r=attemptSeasonTransition(s);assert.equal(r.status,'BLOCKED');assert.equal(r.state,s);assert.ok(r.blockers.some(b=>b.code==='DIVISION2_POOL_INSUFFICIENT'));assert.ok(!r.blockers.some(b=>b.code.includes('NEXT_SEASON_PROFILE')));assert.equal(JSON.stringify(s),before);
});
test('pool performance is seeded, independent of ratings/reputation and idempotent across save/load',()=>{
 const s=continuityTestCareer();const a=prepareGameContinuity(s,'2027-03-19');assert.equal(a.blockers.length,0,JSON.stringify(a.blockers));assert.equal(a.request.evidence!.externalEntrants!.length,12);assert.deepEqual(prepareGameContinuity({...s,gameplayRatings:{}},'2027-03-19').request.evidence!.externalEntrants,a.request.evidence!.externalEntrants);assert.deepEqual(prepareGameContinuity(JSON.parse(JSON.stringify(a.state)),'2027-03-20').state.swedishContinuity,a.state.swedishContinuity);assert.notDeepEqual(prepareGameContinuity({...s,saveSeed:'another-world'},'2027-03-19').request.evidence!.externalEntrants,a.request.evidence!.externalEntrants);
});
test('dated cooperation expires while an ACTIVE affiliation cannot omit mandatory SHF restrictions',()=>{
 const s=createNewCareerState('dated-cooperation-only','swe2-tumba'),clubBId='swe2-tumba',clubAId='se_club_alingsas_hk';
 const p={id:'game-agreement',type:'AFFILIATED_B_TEAM' as const,clubAId,clubBId,status:'ACTIVE' as const,startDate:'2026-07-01',endDate:'2027-06-30',permanent:false,monthlyCostEur:0,lastBilledDate:null,competitionRestriction:{origin:'CAREER_AGREEMENT' as const,evidence:'Explicit test career agreement, not a researched real-world relationship.',effectiveFrom:'2026-07-01',effectiveUntil:'2027-06-30',highestEligibleTier:2}};
 const active={...s,clubPartnerships:{...s.clubPartnerships,[p.id]:p}};assert.equal(cooperationEligibility(active,clubBId,1,'2027-03-18').eligible,false);assert.equal(cooperationEligibility(active,clubBId,2,'2027-03-18').eligible,false);assert.equal(cooperationEligibility(active,clubBId,1,'2027-07-01').eligible,true);assert.equal(cooperationEligibility({...active,clubPartnerships:{[p.id]:{...p,competitionRestriction:undefined}}},clubBId,1,'2027-03-18').eligible,false);assert.equal(cooperationEligibility(JSON.parse(JSON.stringify(active)),clubBId,1,'2027-03-18').eligible,false);
});


test('canonical squad checks reject duplicate ownership and expired contracts while accepting registered loans',()=>{
 const s=continuityTestCareer(),clubs=Object.keys(s.worldSquads).filter(id=>s.worldSquads[id]!.length>=7),home=clubs[0]!,away=clubs[1]!,p=s.worldSquads[home]![0]!;
 assert.equal(hasCompetitionSquad(s,home),true);
 assert.equal(hasCompetitionSquad({...s,worldSquads:{...s.worldSquads,[away]:[...s.worldSquads[away]!,{...p,clubId:away}]}},home),false);
 assert.equal(hasCompetitionSquad({...s,playerContracts:{...s.playerContracts,[p.id]:{...s.playerContracts[p.id]!,contractEndDate:'2025-06-30'}}},home),false);
 const borrowed={...s,worldSquads:{...s.worldSquads,[home]:s.worldSquads[home]!.filter(x=>x.id!==p.id),[away]:[...s.worldSquads[away]!,{...p,clubId:away}]},loans:{...s.loans,qa:{id:'qa',playerId:p.id,parentClubId:home,borrowingClubId:away,startDate:'2026-07-01',endDate:'2027-06-30',wageShareBorrowingPct:50,originalWageEurPerMonth:s.playerContracts[p.id]!.wageEurPerMonth,active:true}}};
 assert.equal(hasCompetitionSquad(borrowed,away),true);
});
