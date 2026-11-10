import test from 'node:test';
import assert from 'node:assert/strict';
import { CLUBS, COMPETITIONS, getClub } from '../../game-data';
import { SWEDISH_COMPETITION_DATA as data } from './swedenDataCompletion';
import { canonicalCompetitionClubs } from './careerSnapshot';
import { progressCareerQualifications } from './careerQualifications';
import { SWEDISH_2026_RULES as rules, SWEDISH_FAMILIES as F, SWEDISH_LEAGUES as L } from './sweden2026';
import { createNewCareerState } from '../../career/newCareer';
import { getCareerClubSquad } from '../../career/careerWorld';
import { careerWorldClubIds } from '../../career/worldCompetitions';
import { syntheticTransitionCareer, syntheticTransitionRequest } from '../../career/seasonTransition.fixtures';
import { attemptSeasonTransition } from '../../career/seasonTransition';

const mappings=data.division2Registrations.flatMap(d=>d.registrations.filter(t=>t.canonicalClubId));
test('53 source playing-team identities resolve once in the canonical catalog without merging senior, reserve or similarly named clubs',()=>{
 assert.equal(mappings.length,53);assert.equal(new Set(CLUBS.map(c=>c.id)).size,CLUBS.length);assert.equal(new Set(mappings.map(t=>t.canonicalClubId)).size,53);
 for(const t of mappings){const c=getClub(t.canonicalClubId!)!;assert.ok(c);assert.equal(c.name,t.name);assert.equal(c.sourceRegistration!.teamId,t.sourceTeamId);assert.equal(c.sourceRegistration!.url,t.sourceUrl);assert.equal(c.dataSource,'IDENTITY_ONLY');assert.equal(c.playable,false);assert.ok(COMPETITIONS.some(x=>x.id===c.competitionId));}
 assert.notEqual(mappings.find(t=>t.name==='Tumba HK')!.canonicalClubId,'swe2-tumba');assert.notEqual(mappings.find(t=>t.name==='HF Karlskrona U')!.canonicalClubId,'se_club_hf_karlskrona');
 const boden=data.division2Registrations[0].registrations.find(t=>t.sourceTeamId==='1577093')!;assert.equal(boden.canonicalClubId,null);assert.equal(boden.canonicalMappingStatus,'AMBIGUOUS_SENIOR_RESERVE');
});
test('identity import adds no squad, contracts, budgets or active AI population',()=>{
 const s=createNewCareerState('identity-only-final','swe2-tumba');for(const t of mappings){const id=t.canonicalClubId!;assert.deepEqual(getCareerClubSquad(s,id),[]);assert.equal(s.worldSquads[id],undefined);assert.equal(s.clubEconomies[id],undefined);assert.ok(!careerWorldClubIds(s).includes(id));assert.ok(!s.fixtures.some(f=>f.homeClubId===id||f.awayClubId===id));}
 assert.equal(CLUBS.filter(c=>rules.leagues.some(l=>l.id===c.competitionId)).length,52);assert.equal(canonicalCompetitionClubs().filter(c=>mappings.some(t=>t.canonicalClubId===c.id)).length,53);
});
test('an identity-only district qualifier is explicitly blocked instead of using a fabricated squad or placeholder result',()=>{
 const n=data.division2Registrations.find(d=>d.district==='n')!.registrations.find(t=>t.canonicalClubId)!.canonicalClubId!;
 const m=data.division2Registrations.find(d=>d.district==='m')!.registrations.find(t=>t.canonicalClubId)!.canonicalClubId!;
 const s=createNewCareerState('district-squad-block','swe2-tumba');const input=JSON.stringify(s);
 const evidence={externalEntrants:[{slotId:'division2-n-2',clubId:n,evidence:'Unit fixture rank, not an official final table.'},{slotId:'division2-m-2',clubId:m,evidence:'Unit fixture rank, not an official final table.'}],eligibility:[n,m].map(clubId=>({clubId,targetFamilyId:F.division1,seasonId:s.seasonId,status:'ELIGIBLE' as const,evidence:'Explicit unit-only eligibility, not an official decision.'}))};
 const p=progressCareerQualifications(s,'2027-03-19',{fromSeasonId:s.seasonId,evidence});assert.ok(p.blockers.some(b=>b.code==='QUALIFICATION_SQUAD_COVERAGE_REQUIRED'&&b.ref==='d1-n-pre'));assert.ok(!p.state.fixtures.some(f=>[n,m].includes(f.homeClubId)||[n,m].includes(f.awayClubId)));assert.equal(JSON.stringify(s),input);assert.deepEqual(p.state.results,s.results);
});
test('atomic rollover cannot promote a rosterless identity-only club even under a complete synthetic control policy',()=>{
 const s=syntheticTransitionCareer(),fresh=mappings[0].canonicalClubId!,old=CLUBS.filter(c=>c.competitionId===L.allsvenskan).at(-1)!.id;
 const swap=(id:string)=>id===old?fresh:id;const input={...s,competitionMembership:{...s.competitionMembership,[old]:'se_division2_n',[fresh]:L.allsvenskan},fixtures:s.fixtures.map(f=>({...f,homeClubId:swap(f.homeClubId),awayClubId:swap(f.awayClubId)})),results:Object.fromEntries(Object.entries(s.results).map(([id,r])=>[id,{...r,homeClubId:swap(r.homeClubId),awayClubId:swap(r.awayClubId)}]))};
 const before=JSON.stringify(input),r=attemptSeasonTransition(input,syntheticTransitionRequest(input));assert.equal(r.status,'BLOCKED');assert.ok(r.blockers.some(b=>b.code==='TARGET_SQUAD_COVERAGE_REQUIRED'&&b.ref===fresh),JSON.stringify(r.blockers));assert.equal(r.state,input);assert.equal(JSON.stringify(input),before);
});
