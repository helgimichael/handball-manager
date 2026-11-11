import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateMatch, seedFromString } from '@handball-manager/game-simulation';
import { createNewCareerState } from './newCareer';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../gameWorld/serverSnapshot';
import { SWEDISH_WORLD_COMPETITION_IDS } from './worldCompetitions';
import { applyKnockoutDecider, progressCompetitions } from '../competition/season';
import { checkSeasonComplete } from './calendar';
import { computeSquadDerivedClubStrength } from './squadDerivedClubStrength';
import { getCareerClubSquad } from './careerWorld';
import { attemptSeasonTransition } from './seasonTransition';
import { addDays } from './dateUtils';
import { hasCompetitionSquad } from '../competition/transition/gameContinuity';

// Stock identities and fixtures; focused transaction test using existing aggregate match simulation.
// Whole daily lifecycle and production manager matches are covered separately by division2-stock-career.ts.
test('stock promotion generates only committed entrants and rolls all candidate players back on fixture collision',()=>{
 let s=createNewCareerState('promotion-atomic-stock','swe2-tumba',Object.assign({},...SWEDISH_WORLD_COMPETITION_IDS.map(snapshotWorldSquads)),undefined,Object.assign({},...SWEDISH_WORLD_COMPETITION_IDS.map(snapshotGameplayRatings)),{},'FIRST_MATCH');
 for(let day=0;day<440&&!s.seasonComplete;day++){
  const date=s.gameDate,strength=(id:string)=>computeSquadDerivedClubStrength(id,getCareerClubSquad(s,id),s.gameplayRatings[id]??[]);
  for(const f of s.fixtures.filter(f=>f.date===date&&!s.results[f.id])){
   const score=simulateMatch({fixtureId:f.id,seed:seedFromString(`${s.saveSeed}:${f.id}`),homeClubId:f.homeClubId,awayClubId:f.awayClubId,homeStrength:strength(f.homeClubId),awayStrength:strength(f.awayClubId)});
   s={...s,results:{...s.results,[f.id]:applyKnockoutDecider(s,f,score,strength)}};
  }
  s=checkSeasonComplete(progressCompetitions(s,date));if(!s.seasonComplete)s={...s,gameDate:addDays(date,1)};
 }
 assert.ok(s.seasonComplete);
 const firstPoolQualifier=s.fixtures.find(f=>f.stage?.tieId.endsWith(':d1-n-pre'))!;
 const lastAllsvenskan=s.fixtures.filter(f=>f.type==='LEAGUE'&&f.competitionId==='swe-2').map(f=>f.date).sort().at(-1)!;
 assert.ok(firstPoolQualifier.date<lastAllsvenskan,'ready Division 2 entries play before the final published Allsvenskan round');
 const before=JSON.stringify(s),applied=attemptSeasonTransition(s);assert.equal(applied.status,'APPLIED',JSON.stringify(applied.blockers));assert.equal(JSON.stringify(s),before);
 const generated=Object.values(applied.state.worldSquads).flat().filter(p=>p.generatedOrigin);assert.ok(generated.length>0);
 const entrants=new Set([...applied.preview!.proposal.directPromotions,...applied.preview!.proposal.qualificationMovements].filter(c=>c.kind==='PROMOTION'&&c.fromFamilyId==='se-men-tier-4-boundary').map(c=>c.clubId));
 assert.deepEqual(new Set(generated.map(p=>p.clubId)),entrants);for(const id of entrants)assert.ok(hasCompetitionSquad(applied.state,id));
 assert.deepEqual(attemptSeasonTransition(s).state,applied.state);
 const collision={...applied.state.fixtures[0]!,type:'FRIENDLY' as const};
 const broken={...s,fixtures:[...s.fixtures,collision]},brokenBefore=JSON.stringify(broken),rejected=attemptSeasonTransition(broken);
 assert.equal(rejected.status,'BLOCKED');assert.equal(rejected.state,broken);assert.ok(rejected.blockers.some(b=>b.code==='INVALID_GENERATED_FIXTURE'));assert.equal(JSON.stringify(broken),brokenBefore);
});
