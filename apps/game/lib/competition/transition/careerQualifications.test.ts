import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateMatch, seedFromString, type ClubStrength } from '@handball-manager/game-simulation';
import { CLUBS } from '../../game-data';
import { createNewCareerState } from '../../career/newCareer';
import { migrateCareerState } from '../../career/saveMigration';
import { attemptSeasonTransition } from '../../career/seasonTransition';
import type { CareerFixture, CareerState } from '../../career/types';
import { syntheticTransitionCareer, syntheticTransitionRequest } from '../../career/seasonTransition.fixtures';
import { ensureSeasonCalendar, buildNewSeasonCalendar } from '../seasonCalendar';
import { applyKnockoutDecider, progressCompetitions } from '../season';
import { snapshotCompetitionTransitionInput } from './careerSnapshot';
import { careerQualificationEvidence } from './careerQualificationEvidence';
import { progressCareerQualifications } from './careerQualifications';
import { SWEDISH_2026_RULES as rules, SWEDISH_LEAGUES as L } from './sweden2026';
import { validatePlannerInput } from './validation';

const manager = 'se_club_bodens_bk_hf';
// Test strength affects simulated scores only. It never supplies administrative evidence or selects entrants.
const strength = (clubId: string): ClubStrength => ({clubId,overall:60,attack:60,defense:60,goalkeeper:60,depth:60});
function simulate(state: CareerState, f: CareerFixture): CareerState {
  const score = simulateMatch({ fixtureId:f.id,seed:seedFromString(`m12e:${f.id}`),homeClubId:f.homeClubId,awayClubId:f.awayClubId,homeStrength:strength(f.homeClubId),awayStrength:strength(f.awayClubId) });
  return { ...state,results:{ ...state.results,[f.id]:applyKnockoutDecider(state,f,score,strength) } };
}
let cached: CareerState;
function completeLeagues(): CareerState {
  if (cached) return structuredClone(cached);
  let s = buildNewSeasonCalendar(createNewCareerState('m12e-four-leagues',manager),'2026-08-01');
  for (const f of s.fixtures) s = simulate(s,f);
  cached = { ...s,gameDate:'2027-03-19',seasonComplete:false };
  return structuredClone(cached);
}
function reviewedTestRequest(s: CareerState) {
  // Explicit test attestation only; this is NOT an imported official 2027 licence/cooperation register.
  return { fromSeasonId:s.seasonId,rules,evidence:{ eligibility:CLUBS.filter(c => rules.leagues.some(l => l.id === c.competitionId)).flatMap(c => rules.families.map(f => ({clubId:c.id,targetFamilyId:f.id,seasonId:s.seasonId,status:'ELIGIBLE' as const,evidence:'Test-only reviewed acceptance/licence/cooperation fixture; not a real official decision.'}))) } };
}

test('four Swedish league calendars cover 52 canonical clubs and exactly 628 distinct games', () => {
  const s = ensureSeasonCalendar(createNewCareerState('m12e-start',manager));
  const ids:string[]=[];
  for (const l of rules.leagues) {
    const f=s.fixtures.filter(f => f.type==='LEAGUE' && f.competitionId===l.id);
    assert.equal(f.length,l.size*(l.size-1));
    const clubs=[...new Set(f.flatMap(f=>[f.homeClubId,f.awayClubId]))];
    assert.equal(clubs.length,l.size); ids.push(...clubs);
  }
  assert.equal(new Set(ids).size,52);
  assert.equal(s.fixtures.filter(f=>f.type==='LEAGUE').length,628);
  assert.equal(new Set(s.fixtures.map(f=>f.id)).size,s.fixtures.length);
  assert.deepEqual(ensureSeasonCalendar(s),s);
  assert.ok(CLUBS.filter(c=>[L.norra,L.sodra].includes(c.competitionId as typeof L.norra)).every(c=>c.playable));
});

test('an older career with played games never gains fabricated other-league history', () => {
  const old=createNewCareerState('m12e-old',manager);
  const s=simulate(old,old.fixtures[0]!);
  const next=ensureSeasonCalendar(s);
  assert.equal(new Set(next.fixtures.filter(f=>f.type==='LEAGUE').map(f=>f.competitionId)).size,1);
  assert.deepEqual(next.results,s.results);
});

test('official calendars retain date ranges, reserve dates are excluded, unknown home priority stays blocked', () => {
  const hbl=rules.stages.find(s=>s.id==='hbl-11')!;
  assert.deepEqual(hbl.gameWindows!.map(w=>[w.startDate,w.endDate]),[['2027-03-29','2027-03-29'],['2027-04-03','2027-04-04'],['2027-04-06','2027-04-06'],['2027-04-09','2027-04-09'],['2027-04-14','2027-04-14']]);
  assert.equal(hbl.terminalDecider!.kind,'SEVEN_METRES_AFTER_TWO_OVERTIMES');
  assert.equal(rules.stages.find(s=>s.id==='d1-n-semi-10')!.homeOrder,null);
  const input=snapshotCompetitionTransitionInput(completeLeagues());
  assert.deepEqual(validatePlannerInput(input),[]);
  const stale={...rules,seasonId:'2027/28',nextSeasonId:'2028/29'};
  assert.ok(validatePlannerInput({...input,seasonId:stale.seasonId,rules:stale,standings:[]}).some(b=>b.code==='INVALID_QUALIFICATION_CALENDAR'));
});

test('unknown eligibility never creates a qualification tie or a strength-picked Division 1 winner', () => {
  const s=completeLeagues(), before=JSON.stringify(s);
  const progress=progressCareerQualifications(s,'2027-03-19',{fromSeasonId:s.seasonId,rules});
  assert.equal(progress.state,s);
  assert.equal(progress.proposal.directPromotions.length,0);
  assert.ok(progress.blockers.some(b=>b.code==='UNKNOWN_ELIGIBILITY'));
  assert.equal(JSON.stringify(s),before);
});

test('supported upper qualification games simulate through saved career results, feeds, clinches and load', () => {
  let s=completeLeagues();
  // Explicit hypothetical pre-deadline terminations isolate the official home-priority/series regression.
  // A caller's blanket ELIGIBLE attestation must never disable an ACTIVE production cooperation.
  s={...s,clubPartnerships:Object.fromEntries(Object.entries(s.clubPartnerships).map(([id,p])=>[id,{...p,permanent:false,status:'TERMINATED' as const,endDate:'2026-12-31'}])),seasonTransitionRequest:reviewedTestRequest(s)};
  const first=progressCareerQualifications(s,'2027-03-19');
  s=first.state;
  assert.equal(Object.values(s.competitionTies!).filter(t=>t.transition).length,5,JSON.stringify(first.blockers));
  const snapshot=snapshotCompetitionTransitionInput(s,s.seasonTransitionRequest!.evidence);
  assert.equal(snapshot.qualificationFixtures!.length,5);
  assert.deepEqual(progressCareerQualifications(s,'2027-03-19').state,s,'repeated daily execution is idempotent');
  for (let iteration=0;iteration<50;iteration++) {
    const game=s.fixtures.filter(f=>f.type==='QUALIFIER'&&!s.results[f.id]).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))[0];
    if (!game) break;
    s=simulate(s,game);
    s=migrateCareerState(JSON.parse(JSON.stringify({...s,gameDate:game.date})));
    s=progressCareerQualifications(s,game.date).state;
  }
  const final=progressCareerQualifications(s,'2027-04-21');
  for(const q of final.proposal.qualification.filter(q=>q.stageId.startsWith('hbl-')||q.stageId.startsWith('ha-'))) {
    assert.equal(q.status,'CONFIRMED',JSON.stringify(final.blockers));
    assert.equal(q.resolutionMethod,'FIXTURES');
    const tie=Object.values(s.competitionTies!).find(t=>t.transition?.stageId===q.stageId)!;
    assert.equal(tie.winnerClubId,q.winnerClubId);
    assert.ok(tie.fixtureIds.every(id=>s.results[id]));
    assert.ok(tie.fixtureIds.length<= (q.format==='BEST_OF_5'?5:3));
  }
  for(const [semi,finalId] of [['ha-semi-n','ha-final-11'],['ha-semi-s','ha-final-12']]) {
    assert.equal(final.proposal.qualification.find(q=>q.stageId===finalId)!.participants[1],final.proposal.qualification.find(q=>q.stageId===semi)!.winnerClubId);
  }
  assert.equal(new Set(s.fixtures.map(f=>f.id)).size,s.fixtures.length);
  assert.equal(careerQualificationEvidence(s,rules).blockers.length,0);
  assert.equal(s.competitionMembership,undefined,'even resolved qualifiers cannot partially apply membership');
});

test('missed qualification windows require organizer decisions, never arbitrary rescheduling', () => {
  const s=completeLeagues(),request=reviewedTestRequest(s);
  const p=progressCareerQualifications(s,'2027-04-30',request);
  assert.equal(p.state,s);
  assert.ok(p.blockers.some(b=>b.code==='QUALIFICATION_WINDOW_UNAVAILABLE'));
  const persisted=progressCompetitions({...s,gameDate:'2027-04-30',seasonTransitionRequest:request},'2027-04-30');
  assert.ok(persisted.seasonOutcome!.qualificationBlockers!.some(b=>b.code==='QUALIFICATION_WINDOW_UNAVAILABLE'));
  const loaded=migrateCareerState(JSON.parse(JSON.stringify(persisted)));
  const blocked=attemptSeasonTransition({...loaded,seasonComplete:true});
  assert.equal(blocked.status,'BLOCKED');
  assert.ok(blocked.blockers.some(b=>b.code==='QUALIFICATION_WINDOW_UNAVAILABLE'));
});

test('corrupt saved qualifier identity blocks both scheduling and atomic rollover', () => {
  const s=completeLeagues(), p=progressCareerQualifications(s,'2027-03-19',reviewedTestRequest(s));
  const f=p.state.fixtures.find(f=>f.type==='QUALIFIER')!;
  const corrupt={...p.state,fixtures:p.state.fixtures.map(x=>x.id===f.id?{...x,date:'2027-02-01'}:x),seasonComplete:true};
  assert.ok(careerQualificationEvidence(corrupt,rules).blockers.some(b=>b.code==='INVALID_CAREER_QUALIFICATION'));
  assert.equal(progressCareerQualifications(corrupt,'2027-03-19',reviewedTestRequest(s)).state,corrupt);
  const blocked=attemptSeasonTransition(corrupt);
  assert.equal(blocked.status,'BLOCKED');assert.equal(blocked.state,corrupt);
});

test('official Division 1 upward route remains an atomic BLOCKED proposal without district data and next profile', (t) => {
  const base=completeLeagues(),s={...base,seasonComplete:true,gameDate:'2027-05-30'};
  const request=reviewedTestRequest(s),before=JSON.stringify(s);
  const blocked=attemptSeasonTransition(s,request);
  assert.equal(blocked.status,'BLOCKED');assert.equal(blocked.state,s);
  for(const code of ['MISSING_EXTERNAL_ENTRANT','NEXT_SEASON_RULES_UNVERIFIED','NEXT_SEASON_PROFILE_REQUIRED','BOUNDARY_DESTINATION_REQUIRED']) assert.ok(blocked.blockers.some(b=>b.code===code),code);
  assert.equal(blocked.preview!.proposal.directPromotions.filter(c=>c.fromCompetitionId===L.norra||c.fromCompetitionId===L.sodra).length,2);
  t.diagnostic(JSON.stringify({proposedPromotions:blocked.preview!.proposal.directPromotions.map(c=>({clubId:c.clubId,name:CLUBS.find(x=>x.id===c.clubId)!.name,from:c.fromCompetitionId,to:c.toCompetitionId})),proposedRelegations:blocked.preview!.proposal.directRelegations.map(c=>({clubId:c.clubId,name:CLUBS.find(x=>x.id===c.clubId)!.name,from:c.fromCompetitionId,toFamily:c.toFamilyId})),applied:false}));
  assert.equal(JSON.stringify(s),before);
  const loaded=migrateCareerState(JSON.parse(before));
  const again=attemptSeasonTransition(loaded,request);
  assert.equal(again.status,'BLOCKED');assert.equal(again.state,loaded);
  assert.deepEqual(loaded.worldSquads,s.worldSquads);assert.deepEqual(loaded.playerContracts,s.playerContracts);
});

test('committed retry is checked before the next default transition validates its new season', () => {
  const s=syntheticTransitionCareer(),request=syntheticTransitionRequest(s),first=attemptSeasonTransition(s,request);
  assert.equal(first.status,'APPLIED');
  const loaded=migrateCareerState(JSON.parse(JSON.stringify(first.state)));
  assert.equal(attemptSeasonTransition(loaded,request).status,'ALREADY_APPLIED');
  const defaultFuture=attemptSeasonTransition({...loaded,seasonComplete:true});
  assert.equal(defaultFuture.status,'BLOCKED');
  assert.ok(defaultFuture.blockers.some(b=>b.code==='MISSING_STANDINGS'));
  assert.ok(!defaultFuture.blockers.some(b=>b.code==='OFFICIAL_SEASON_PROFILE_UNAVAILABLE'));
});
import { snapshotWorldSquads, snapshotGameplayRatings } from '../../gameWorld/serverSnapshot';
import { buildMatchdayReadyEvent } from '../../career/careerEvents';
import { startProductionMatch, finishProductionMatch } from '../../career/productionMatch';
import { simulateAiFixturesForDate } from '../../career/calendar';

test('Division 1 manager plays an existing V2 match with canonical squad identities', () => {
  const squads=snapshotWorldSquads(L.norra),ratings=snapshotGameplayRatings(L.norra);
  assert.ok(squads[manager]!.length>=7);
  const state=createNewCareerState('m12e-division1-manager',manager,squads,undefined,ratings);
  const f=state.fixtures.find(f=>f.homeClubId===manager||f.awayClubId===manager)!;
  const ready={...state,gameDate:f.date,careerEvents:[buildMatchdayReadyEvent(f.id,f.date)]};
  const started=startProductionMatch(ready);
  assert.ok(started.productionMatch);
  const loaded=JSON.parse(JSON.stringify(started));
  const done=finishProductionMatch(loaded);
  assert.equal(done.results[f.id]!.engine,'V2');
  assert.equal(done.playerClubId,manager);
  assert.equal(done.competitionId,L.norra);
  const canonical=new Set(Object.values(squads).flat().map(p=>p.id));
  const archive=Object.values(done.matchArchives!)[0]!;
  assert.ok(archive.people.every(p=>canonical.has(p.id)),'no replacement identity is manufactured');
});

test('AI qualification uses the existing calendar simulator and cannot replay payment or match bookkeeping', () => {
  let s=completeLeagues();s={...s,seasonTransitionRequest:reviewedTestRequest(s)};
  s=progressCareerQualifications(s,'2027-03-19').state;
  const game=s.fixtures.find(f=>f.type==='QUALIFIER'&&f.homeClubId!==manager&&f.awayClubId!==manager)!;
  const played=simulateAiFixturesForDate(s,game.date);
  assert.ok(played.state.results[game.id]);
  const repeated=simulateAiFixturesForDate(played.state,game.date);
  assert.equal(repeated.results.length,0);
  assert.deepEqual(repeated.state,played.state);
  assert.ok(snapshotCompetitionTransitionInput(played.state,s.seasonTransitionRequest!.evidence).qualificationFixtures!.find(f=>f.id===game.id)!.result);
});

test('legacy qualifiers are preserved and reviewed instead of duplicated under new planner IDs', () => {
  const s=completeLeagues(),request=reviewedTestRequest(s);
  const candidate=progressCareerQualifications(s,'2027-03-19',request).state.fixtures.find(f=>f.type==='QUALIFIER')!;
  const legacy={...candidate,id:'legacy-qualifier',stage:undefined};
  const old={...s,fixtures:[...s.fixtures,legacy]};
  const before=JSON.stringify(old),next=progressCareerQualifications(old,'2027-03-19',request);
  assert.ok(next.blockers.some(b=>b.code==='LEGACY_QUALIFICATION_REVIEW_REQUIRED'));
  assert.equal(next.state.fixtures.filter(f=>f.type==='QUALIFIER'&&f.homeClubId===candidate.homeClubId&&f.awayClubId===candidate.awayClubId).length,1);
  assert.deepEqual(next.state.fixtures.find(f=>f.id===legacy.id),legacy);
  assert.equal(JSON.stringify(old),before);
});

test('persisted presentation blockers cannot veto new reviewed transition evidence', () => {
  const s=syntheticTransitionCareer(),request=syntheticTransitionRequest(s);
  s.seasonOutcome!.qualificationBlockers=[{code:'QUALIFICATION_WINDOW_UNAVAILABLE',ref:'old-view',status:'BLOCKED',message:'Stale presentation cache.'}];
  assert.equal(attemptSeasonTransition(s,request).status,'APPLIED');
});
