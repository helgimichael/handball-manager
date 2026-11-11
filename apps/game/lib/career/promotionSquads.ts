import type { CareerState } from './types';
import type { HandballPosition, PlayerMock } from '../game-data';
import type { CompetitionRules } from '../competition/transition/types';
import { hasCompetitionSquad, hasValidCompetitionRegistrations, isDivision2PoolClub } from '../competition/transition/gameContinuity';
import { generateFallbackGameplayRating } from '../rating/generation/careerFallbackRating';
import { mapHandballPositionToMatchPlanPosition } from '../matchPlan/careerSquadBridge';
import { generateYouthName } from './youthNames';
import { legacyAttributesFromCA } from './youthIntake';
import { generateInitialContract } from '../economy/contractGeneration';
import { ensureCareerPlayerClubHistory } from '../economy/clubHistoryIntegration';
import { seedFromString } from '@handball-manager/game-simulation';

const MODEL = 'division2-promotion-v1';
const POSITIONS: HandballPosition[] = ['MV','MV','V6','V6','V9','V9','M9','M9','M9','M6','M6','M6','H9','H9','H6','H6'];

/** Candidate-only: never changes existing identities, contracts, ratings or the input state.
 * Pool clubs acquire a squad only after the validated plan awards a simulated Division 1 place. */
export function generatePromotionSquads(input: CareerState, membership: Record<string,string>, rules: CompetitionRules, kickoff: string): CareerState {
 if (rules.provenance !== 'GAME_CONTINUITY') return input;
 let state = input;
 const used = new Set([...Object.values(input.worldSquads).flat().map(p=>p.id), ...Object.keys(input.playerContracts), ...Object.values(input.gameplayRatings).flat().map(p=>p.playerId), ...Object.keys(input.playerStatuses), ...Object.keys(input.playerClubHistory)]);
 for (const clubId of Object.keys(membership).sort()) {
  const league=rules.leagues.find(l=>l.id===membership[clubId]);
  if (!isDivision2PoolClub(input,clubId) || !league || rules.families.find(f=>f.id===league.familyId)?.tier!==3 || hasCompetitionSquad(input,clubId)) continue;
  const existing=input.worldSquads[clubId]??[];
  if (!hasValidCompetitionRegistrations(input,clubId,kickoff)) throw new Error(`Conflicting promotion registration/contract: ${clubId}`);
  const squad=[...existing], ratings=[...(state.gameplayRatings[clubId]??[])];
  const contracts={...state.playerContracts}, statuses={...state.playerStatuses}, roles={...state.playerSquadStatus};
  const remaining=[...POSITIONS];
  for(const p of existing){const i=remaining.indexOf(p.position);if(i>=0)remaining.splice(i,1);}
  for(const [index,position] of remaining.entries()) {
   const base=`generated-${MODEL}-${encodeURIComponent(input.saveSeed)}-${clubId}-${rules.nextSeasonId.replace('/','-')}-${index}`;
   let id=base, collision=0;while(used.has(id))id=`${base}-${++collision}`;used.add(id);
   const roll=(key:string,n:number)=>seedFromString(`${id}:${key}`)%n;
   const name=generateYouthName(id), age=19+roll('age',14), year=Number(kickoff.slice(0,4));
   const rating=generateFallbackGameplayRating(id,mapHandballPositionToMatchPlanPosition(position),'DIVISION_1');
   const endYear=year+2+roll('contract',3), contractEndSeason=`${endYear-1}/${String(endYear).slice(-2)}`;
   const contract=generateInitialContract(id,clubId,contractEndSeason,endYear,{ca:rating.ca,pa:rating.pa,age,position:rating.position,role:'ROTATION',competitionTier:undefined});
   const player:PlayerMock={id,clubId,...name,shirtNumber:null,position,nationality:'SWE',dateOfBirth:`${year-age}-01-01`,heightCm:null,weightKg:null,foot:null,squadStatus:'Rotation',dataSource:'MOCK',generatedOrigin:{kind:'DIVISION2_PROMOTION',seasonId:rules.nextSeasonId,modelVersion:MODEL},currentAbility:rating.ca,potentialAbility:rating.pa,form:5,fitnessPct:100,moralePct:70,appearances:0,goals:0,contractEndSeason,wageSekPerMonth:0,attributes:legacyAttributesFromCA(rating.ca)};
   squad.push(player);ratings.push(rating);contracts[id]=contract;statuses[id]={playerId:id,availability:'AVAILABLE'};roles[id]='ROTATION';
  }
  state={...state,worldSquads:{...state.worldSquads,[clubId]:squad},gameplayRatings:{...state.gameplayRatings,[clubId]:ratings},playerContracts:contracts,playerStatuses:statuses,playerSquadStatus:roles};
  state=ensureCareerPlayerClubHistory(state,clubId);
  if(!hasCompetitionSquad({...state,gameDate:kickoff},clubId))throw new Error(`Unplayable promotion squad: ${clubId}`);
 }
 return state;
}
