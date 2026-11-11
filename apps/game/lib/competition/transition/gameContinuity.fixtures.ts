import { TUMBA_SQUAD, type PlayerMock } from '../../game-data';
import { createNewCareerState } from '../../career/newCareer';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../../gameWorld/serverSnapshot';
import { SWEDISH_WORLD_COMPETITION_IDS } from '../../career/worldCompetitions';
import { SWEDISH_COMPETITION_DATA as data } from './swedenDataCompletion';
import { buildNewSeasonCalendar } from '../seasonCalendar';
import type { CareerState } from '../../career/types';

/** Complete QA fixture only. Pool players have new QA identities; no production database/ratings are edited. */
export function continuityTestCareer(seed='playable-pyramid-v1'):CareerState {
 const squads=Object.assign({},...SWEDISH_WORLD_COMPETITION_IDS.map(id=>snapshotWorldSquads(id)));
 const ratings=Object.assign({},...SWEDISH_WORLD_COMPETITION_IDS.map(id=>snapshotGameplayRatings(id)));
 for(const d of data.division2Registrations)for(const t of d.registrations)if(t.canonicalClubId){
  const clubId=t.canonicalClubId;
  squads[clubId]=TUMBA_SQUAD.map((p,i):PlayerMock=>({...structuredClone(p),id:`qa-pool-${t.sourceTeamId}-${i}`,clubId,firstName:'QA',lastName:`Pool ${t.sourceTeamId} ${i}`,squadStatus:'Rotation',dateOfBirth:'2001-01-01'}));
 }
 const s=createNewCareerState(seed,'swe2-tumba',squads,undefined,ratings);
 // Fixed valid QA contracts isolate competition continuation from daily renewal/lifecycle QA.
 // Initial test data only: no production contract or transaction is changed.
 for(const c of Object.values(s.playerContracts))c.contractEndDate='2032-06-30';
 // Existing fixture generator; early test kickoff leaves all verified spring qualification slots available.
 return buildNewSeasonCalendar(s,'2026-09-01');
}
