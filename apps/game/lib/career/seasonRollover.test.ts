import test from 'node:test';
import assert from 'node:assert/strict';
import { attemptSeasonTransition, rolloverSeason, SeasonTransitionBlockedError } from './seasonRollover';
import { syntheticTransitionCareer, syntheticTransitionRequest, completeSyntheticSeason } from './seasonTransition.fixtures';
import { migrateCareerState } from './saveMigration';
import { competitionClubIds } from '../competition/tables';
import { SWEDISH_2026_RULES, SWEDISH_LEAGUES as L } from '../competition/transition/sweden2026';
import type { CareerState } from './types';

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.freeze(value); for (const item of Object.values(value)) freeze(item); }
  return value;
}
const applies = (state: CareerState) => {
  const result = attemptSeasonTransition(state, syntheticTransitionRequest(state));
  assert.equal(result.status, 'APPLIED', JSON.stringify(result.blockers));
  return result;
};

test('atomic success: direct and qualification movements, manager and AI, sizes and fixtures', () => {
  const done = freeze(syntheticTransitionCareer()), before = JSON.stringify(done);
  const result = applies(done), next = result.state, plan = result.preview!.proposal;
  assert.equal(result.preview!.canGenerateNextSeason, true);
  assert.equal(next.seasonId, '2027/28');
  assert.equal(next.seasonComplete, false);
  assert.equal(next.competitionId, L.hbl, 'manager follows directly promoted club');
  assert.equal(next.playerClubId, done.playerClubId);
  assert.equal(plan.directPromotions.length, 1);
  assert.equal(plan.directRelegations.length, 1);
  assert.equal(plan.qualificationMovements.filter(c => c.kind === 'PROMOTION').length, 3);
  assert.equal(plan.qualificationMovements.filter(c => c.kind === 'RELEGATION').length, 3);
  for (const claim of [...plan.directPromotions,...plan.directRelegations,...plan.qualificationMovements,...plan.remaining]) assert.equal(next.competitionMembership![claim.clubId], claim.toCompetitionId);
  const ids = [L.hbl,L.allsvenskan].flatMap(id => { const members=competitionClubIds(next,id); assert.equal(members.length,14); return members; });
  assert.equal(new Set(ids).size,28);
  assert.equal(next.fixtures.filter(f => f.type === 'LEAGUE').length,364);
  assert.equal(new Set(next.fixtures.map(f => f.id)).size,next.fixtures.length);
  assert.ok(next.fixtures.every(f => !done.fixtures.some(old => old.id === f.id) && !f.id.includes('/')));
  assert.equal(JSON.stringify(done), before, 'even a deeply frozen source remains untouched');
});

test('success preserves registrations, contracts, ratings, archives, history and daily continuity', () => {
  const done = syntheticTransitionCareer(), next = applies(done).state;
  assert.ok(Object.keys(done.worldSquads).length >= 28, 'real canonical registrations populate this fixture');
  assert.ok(Object.keys(done.playerContracts).length > 0);
  for (const key of ['worldSquads','playerContracts','gameplayRatings','staffRoster','clubEconomies','workloadLedger','playerPhysicalState','matchArchives','saveSeed','gameDate','processedThroughDate'] as const) assert.deepEqual(next[key],done[key],key);
  const archive = next.seasonHistory!.at(-1)!;
  assert.equal(archive.seasonId,done.seasonId);
  assert.deepEqual(archive.stats,done.playerSeasonStats);
  assert.deepEqual(Object.keys(archive.tables!).sort(),[L.hbl,L.allsvenskan].sort());
  assert.ok(archive.transition!.preview.canGenerateNextSeason);
  assert.equal(archive.transition!.evidence.qualificationFixtures!.length,9);
  assert.deepEqual(next.results,{});
  assert.deepEqual(next.playerSeasonStats,{});
  assert.equal(next.seasonStartDate,done.gameDate);
});

test('human relegation follows the same validated claims as AI clubs', () => {
  const original=syntheticTransitionCareer();
  const preview=applies(original).preview!;
  const relegated=preview.proposal.directRelegations[0]!.clubId;
  const done={...original,playerClubId:relegated,competitionId:L.hbl};
  const next=applies(done).state;
  assert.equal(next.playerClubId,relegated); assert.equal(next.competitionId,L.allsvenskan);
});

test('fixture generation validation failure exposes no candidate state or archived season', () => {
  const done=syntheticTransitionCareer(), request=syntheticTransitionRequest(done);
  const next=attemptSeasonTransition(done,request).state;
  // A harmless old friendly ID conflicts only after the new calendar has been built.
  const collision={...next.fixtures[0]!,type:'FRIENDLY' as const};
  const original=freeze({...done,fixtures:[...done.fixtures,collision]});
  const before=JSON.stringify(original), result=attemptSeasonTransition(original,request);
  assert.equal(result.preview!.canGenerateNextSeason,true);
  assert.equal(result.status,'BLOCKED'); assert.equal(result.state,original);
  assert.ok(result.blockers.some(b=>b.code==='INVALID_GENERATED_FIXTURE'));
  assert.equal(JSON.stringify(original),before);
});

test('ratings and legacy selections cannot affect a validated membership plan', () => {
  const done=syntheticTransitionCareer(), request=syntheticTransitionRequest(done);
  const expected=attemptSeasonTransition(done,request);
  const changed={...done,gameplayRatings:{},seasonOutcome:{...done.seasonOutcome!,nextMembership:{[done.playerClubId]:L.allsvenskan}}};
  const actual=attemptSeasonTransition(changed,request);
  assert.equal(actual.status,'APPLIED');
  assert.deepEqual(actual.state.competitionMembership,expected.state.competitionMembership);
});

test('relevant tied ranks require explicit ranking evidence and can then be retried', () => {
  const original=syntheticTransitionCareer(), request=syntheticTransitionRequest(original);
  const done={...original,results:Object.fromEntries(Object.entries(original.results).map(([id,r])=>[id,{...r,homeGoals:25,awayGoals:25}]))};
  const pending=attemptSeasonTransition(done,request);
  assert.equal(pending.status,'BLOCKED'); assert.equal(pending.state,done);
  const rankingDecisions=Object.fromEntries([L.hbl,L.allsvenskan].map(id=>[id,[{kind:'ORGANIZER_RULING' as const,orderedClubIds:competitionClubIds(done,id).sort(),evidence:'Explicit synthetic multiway ranking decision, not an automatic club-ID tiebreak.'}]]));
  const resolved=attemptSeasonTransition(done,{...request,evidence:{...request.evidence,rankingDecisions}});
  assert.equal(resolved.status,'APPLIED',JSON.stringify(resolved.blockers));
});

test('unknown qualification blocks without partial mutations and can be retried with supplied results', () => {
  const done=freeze(syntheticTransitionCareer()), request=syntheticTransitionRequest(done);
  const missing={...request,evidence:{...request.evidence,qualificationFixtures:[]}};
  const first=attemptSeasonTransition(done,missing);
  assert.equal(first.status,'BLOCKED'); assert.equal(first.state,done);
  assert.ok(first.blockers.some(b=>b.code==='QUALIFICATION_RESULT_UNKNOWN'));
  assert.equal(first.preview!.proposal.directPromotions.length,1,'confirmed partial claims never commit');
  assert.equal(attemptSeasonTransition(done,request).status,'APPLIED');
  assert.deepEqual(attemptSeasonTransition(done,missing),first);
});

test('official incomplete pyramid blocks and legacy outcome cannot authorize membership changes', () => {
  const done=syntheticTransitionCareer();
  done.seasonOutcome!.nextMembership={[done.playerClubId]:L.hbl};
  const result=attemptSeasonTransition(done,{fromSeasonId:done.seasonId,rules:SWEDISH_2026_RULES});
  assert.equal(result.status,'BLOCKED'); assert.equal(result.state,done);
  for(const code of ['MISSING_STANDINGS','MISSING_EXTERNAL_ENTRANT','NEXT_SEASON_RULES_UNVERIFIED','NEXT_SEASON_PROFILE_REQUIRED']) assert.ok(result.blockers.some(b=>b.code===code),code);
  assert.throws(()=>rolloverSeason(done),SeasonTransitionBlockedError,'scripts cannot interpret blocking as success');
});

test('conflicting qualification results block the complete transaction', () => {
  const done=freeze(syntheticTransitionCareer()), request=syntheticTransitionRequest(done);
  const f=request.evidence!.qualificationFixtures![0]!;
  const conflict={stageId:f.stageId,seasonId:done.seasonId,participants:[f.homeClubId,f.awayClubId] as const,winnerClubId:f.awayClubId,origin:'CAREER_SIMULATED' as const,evidence:'Synthetic conflicting record'};
  const result=attemptSeasonTransition(done,{...request,evidence:{...request.evidence,qualificationResults:[conflict]}});
  assert.equal(result.status,'BLOCKED'); assert.equal(result.state,done); assert.ok(result.blockers.length);
});

test('malformed/unknown memberships, duplicate calendar and invalid profiles never commit', () => {
  const done=syntheticTransitionCareer(), request=syntheticTransitionRequest(done);
  const variants: [CareerState,typeof request][]=[
    [{...done,competitionMembership:{...done.competitionMembership,unknown:L.hbl}},request],
    [{...done,fixtures:[...done.fixtures,done.fixtures[0]!] },request],
    [{...done,results:{...done.results,[done.fixtures[0]!.id]:{...done.results[done.fixtures[0]!.id]!,fixtureId:'wrong-fixture'}}},request],
    [{...done,competitionMembership:{...done.competitionMembership,[done.playerClubId]:L.hbl}},request],
    [done,{...request,nextSeason:undefined}],
    [done,{...request,nextSeason:{...request.nextSeason!,kickoffDate:'2027-02-30'}}],
    [done,{...request,nextSeason:{...request.nextSeason!,rules:{...request.nextSeason!.rules,leagues:request.nextSeason!.rules.leagues.slice(0,1)}}}],
    [done,{...request,nextSeason:{...request.nextSeason!,rules:{...request.nextSeason!.rules,families:request.nextSeason!.rules.families.map(f=>({...f,tier:f.tier+1}))}}}],
    [done,{...request,fromSeasonId:'2025/26'}],
  ];
  for (const [state,r] of variants) { const result=attemptSeasonTransition(freeze(state),r); assert.equal(result.status,'BLOCKED',JSON.stringify(result)); assert.equal(result.state,state); }
});

test('deterministic execution and committed retry survive JSON save and migration', () => {
  const done=syntheticTransitionCareer(), request=syntheticTransitionRequest(done);
  const first=attemptSeasonTransition(done,request), second=attemptSeasonTransition(done,structuredClone(request));
  assert.equal(first.status,'APPLIED'); assert.deepEqual(second,first);
  const loaded=migrateCareerState(JSON.parse(JSON.stringify(first.state)));
  const retry=attemptSeasonTransition(loaded,request);
  assert.equal(retry.status,'ALREADY_APPLIED'); assert.equal(retry.state,loaded);
  assert.equal(retry.state.seasonHistory!.length,1);
  assert.deepEqual(loaded.playerContracts,first.state.playerContracts);
  const conflict=attemptSeasonTransition(loaded,{...request,nextSeason:{...request.nextSeason!,evidence:'Changed evidence'}});
  assert.equal(conflict.status,'BLOCKED'); assert.equal(conflict.state,loaded);
});

test('older saves without receipts remain compatible and incomplete or active seasons cannot advance', () => {
  const done=syntheticTransitionCareer(), loaded=migrateCareerState(JSON.parse(JSON.stringify(done)));
  assert.equal(loaded.lastSeasonTransition,undefined);
  assert.equal(applies(loaded).status,'APPLIED');
  const open={...done,seasonComplete:false};
  assert.equal(rolloverSeason(open),open);
  assert.equal(attemptSeasonTransition(open).state,open);
  const live={...done,productionMatch:{} as NonNullable<CareerState['productionMatch']>};
  assert.equal(attemptSeasonTransition(live).status,'BLOCKED'); assert.equal(rolloverSeason(live),live);
});

test('one focused two-season synthetic simulation has stable memberships, history and unique fixture IDs', () => {
  const first=syntheticTransitionCareer(), next=applies(first).state;
  const second=completeSyntheticSeason(next), third=applies(second).state;
  assert.equal(third.seasonId,'2028/29'); assert.equal(third.seasonHistory!.length,2);
  assert.deepEqual(third.seasonHistory![0],next.seasonHistory![0]);
  const fixtures=[...first.fixtures,...second.fixtures,...third.fixtures];
  assert.equal(new Set(fixtures.map(f=>f.id)).size,fixtures.length);
  for(const league of [L.hbl,L.allsvenskan]) assert.equal(competitionClubIds(third,league).length,14);
});
