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
const QUALIFICATION_MODEL = 'division2-qualification-v1';
const POSITIONS: HandballPosition[] = ['MV','MV','V6','V6','V9','V9','M9','M9','M9','M6','M6','M6','H9','H9','H6','H6'];

type GeneratedKind = NonNullable<PlayerMock['generatedOrigin']>['kind'];

function usedIds(input: CareerState): Set<string> {
 return new Set([...Object.values(input.worldSquads).flat().map(p=>p.id), ...Object.keys(input.playerContracts), ...Object.values(input.gameplayRatings).flat().map(p=>p.playerId), ...Object.keys(input.playerStatuses), ...Object.keys(input.playerClubHistory)]);
}

/** Fills a pool club's squad up to the sixteen-player template with deterministic fictional players.
 * Existing identities, contracts and ratings are kept; new ids never collide with any id already in the career. */
function addGeneratedSquad(input: CareerState, state: CareerState, clubId: string, used: Set<string>, spec: { model: string; seasonKey: string; kind: GeneratedKind; seasonId: string; registeredFrom: string }): CareerState {
 const existing=input.worldSquads[clubId]??[];
 const squad=[...existing], ratings=[...(state.gameplayRatings[clubId]??[])];
 const contracts={...state.playerContracts}, statuses={...state.playerStatuses}, roles={...state.playerSquadStatus};
 const remaining=[...POSITIONS];
 for(const p of existing){const i=remaining.indexOf(p.position);if(i>=0)remaining.splice(i,1);}
 for(const [index,position] of remaining.entries()) {
  const base=`generated-${spec.model}-${encodeURIComponent(input.saveSeed)}-${clubId}-${spec.seasonKey.replace('/','-')}-${index}`;
  let id=base, collision=0;while(used.has(id))id=`${base}-${++collision}`;used.add(id);
  const roll=(key:string,n:number)=>seedFromString(`${id}:${key}`)%n;
  const name=generateYouthName(id), age=19+roll('age',14), year=Number(spec.registeredFrom.slice(0,4));
  const rating=generateFallbackGameplayRating(id,mapHandballPositionToMatchPlanPosition(position),'DIVISION_1');
  const endYear=year+2+roll('contract',3), contractEndSeason=`${endYear-1}/${String(endYear).slice(-2)}`;
  const contract=generateInitialContract(id,clubId,contractEndSeason,endYear,{ca:rating.ca,pa:rating.pa,age,position:rating.position,role:'ROTATION',competitionTier:undefined});
  const player:PlayerMock={id,clubId,...name,shirtNumber:null,position,nationality:'SWE',dateOfBirth:`${year-age}-01-01`,heightCm:null,weightKg:null,foot:null,squadStatus:'Rotation',dataSource:'MOCK',generatedOrigin:{kind:spec.kind,seasonId:spec.seasonId,modelVersion:spec.model},currentAbility:rating.ca,potentialAbility:rating.pa,form:5,fitnessPct:100,moralePct:70,appearances:0,goals:0,contractEndSeason,wageSekPerMonth:0,attributes:legacyAttributesFromCA(rating.ca)};
  squad.push(player);ratings.push(rating);contracts[id]=contract;statuses[id]={playerId:id,availability:'AVAILABLE'};roles[id]='ROTATION';
 }
 const next={...state,worldSquads:{...state.worldSquads,[clubId]:squad},gameplayRatings:{...state.gameplayRatings,[clubId]:ratings},playerContracts:contracts,playerStatuses:statuses,playerSquadStatus:roles};
 return ensureCareerPlayerClubHistory(next,clubId);
}

/** Candidate-only: never changes existing identities, contracts, ratings or the input state.
 * Pool clubs acquire a squad only after the validated plan awards a simulated Division 1 place. */
export function generatePromotionSquads(input: CareerState, membership: Record<string,string>, rules: CompetitionRules, kickoff: string): CareerState {
 if (rules.provenance !== 'GAME_CONTINUITY') return input;
 let state = input;
 const used = usedIds(input);
 for (const clubId of Object.keys(membership).sort()) {
  const league=rules.leagues.find(l=>l.id===membership[clubId]);
  if (!isDivision2PoolClub(input,clubId) || !league || rules.families.find(f=>f.id===league.familyId)?.tier!==3 || hasCompetitionSquad(input,clubId)) continue;
  if (!hasValidCompetitionRegistrations(input,clubId,kickoff)) throw new Error(`Conflicting promotion registration/contract: ${clubId}`);
  state=addGeneratedSquad(input,state,clubId,used,{model:MODEL,seasonKey:rules.nextSeasonId,kind:'DIVISION2_PROMOTION',seasonId:rules.nextSeasonId,registeredFrom:kickoff});
  if(!hasCompetitionSquad({...state,gameDate:kickoff},clubId))throw new Error(`Unplayable promotion squad: ${clubId}`);
 }
 return state;
}

/**
 * Division 2 playable qualification (Alpha hotfix): a Division 2 pool club has no roster -- its seasons are
 * simulated in aggregate, and AI-vs-AI qualifiers use the calendar simulator, where a club without a roster is a
 * neutral side. Only when the manager's own club is drawn against a pool club in an unplayed qualifier does that
 * club need real players for a native match. It then gets a persistent fictional squad from the same generator the
 * M1.2 promotion uses (deterministic ids, provenance, contracts, ratings, registrations, club history) and from then
 * on lives the ordinary roster-backed lifecycle of `careerWorldCatalogClubs`.
 * Idempotent: a club that already has a valid squad is never touched, so retries and reloads add nobody.
 */
export function ensureQualificationOpponentSquads(input: CareerState, date: string = input.gameDate): CareerState {
 if (input.managerCareer?.seekingJob) return input;
 const me=input.playerClubId;
 const opponents=new Map<string,string>();
 for (const f of input.fixtures ?? []) {
  if (f.type!=='QUALIFIER' || input.results?.[f.id] || f.date<date) continue;
  if (f.homeClubId!==me && f.awayClubId!==me) continue;
  const opponent=f.homeClubId===me?f.awayClubId:f.homeClubId;
  if (!opponents.has(opponent) || f.date<opponents.get(opponent)!) opponents.set(opponent,f.date);
 }
 let state=input;
 let used: Set<string>|null=null;
 for (const [clubId,firstDate] of [...opponents].sort(([a],[b])=>a.localeCompare(b))) {
  if (!isDivision2PoolClub(input,clubId) || hasCompetitionSquad(input,clubId)) continue;
  // A conflicting registration is never overwritten; the match preview then explains why the game cannot start.
  if (!hasValidCompetitionRegistrations(input,clubId,firstDate)) continue;
  used??=usedIds(input);
  state=addGeneratedSquad(input,state,clubId,used,{model:QUALIFICATION_MODEL,seasonKey:input.seasonId,kind:'DIVISION2_QUALIFICATION',seasonId:input.seasonId,registeredFrom:firstDate});
 }
 return state;
}
