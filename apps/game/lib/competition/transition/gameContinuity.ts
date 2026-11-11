import { computeStandings, simulateMatch, seedFromString, type ClubStrength } from '@handball-manager/game-simulation';
import { CLUBS, getClub } from '../../game-data';
import type { CareerState } from '../../career/types';
import type { SeasonTransitionRequest } from '../../career/seasonTransition';
import { clubCompetitionId } from '../../career/competitionMembership';
import { SWEDISH_2026_RULES as official, SWEDISH_FAMILIES as F, SWEDISH_LEAGUES as L } from './sweden2026';
import data from './sweden2026Data.json';
import { cooperationEligibility } from './cooperationEligibility';
import { snapshotCompetitionTransitionInput } from './careerSnapshot';
import { planCompetitionTransition } from './planner';
import { rankCompletedTable } from './ranking';
import type { CompetitionRules, Dependency, GroupAllocation, Standing, ExternalEntrant } from './types';

type District='n'|'o'|'m'|'v'|'s';
export type PoolSeason={seasonId:string;provenance:'GAME_CONTINUITY';districts:Record<string,{clubIds:string[];rows:Standing[];order:string[];contests:{homeClubId:string;awayClubId:string;homeGoals:number;awayGoals:number;seed:number}[]}>;excluded:{clubId:string;reason:string}[]};
export type SwedishContinuityState={pools:Record<string,PoolSeason>;administrativeDecisions?:Record<string,{seasonId:string;eligible:boolean;evidence:string}>};
export const CONTINUITY_SOURCE={url:'game-continuity:swedish-pyramid-v1',section:'Owner-authorized playable pyramid. Game policy, not a future SHF publication.'};
const districts:District[]=['n','o','m','v','s'];
const districtCompetition=(d:string)=>`se_division2_${d}`;
const issue=(code:string,ref:string,message:string):Dependency=>({code,ref,message,status:'BLOCKED'});
const nextSeason=(season:string)=>{const y=Number(season.slice(0,4))+1;return `${y}/${String(y+1).slice(-2)}`};
const lot=(seed:string,key:string)=>seedFromString(`${seed}:${key}`);

/** Verified references stay intact. Unspecified home priority uses an explicitly GAME_CONTINUITY seeded home draw. */
export function gameContinuityRules(seasonId:string,seed:string):CompetitionRules {
 const shift=Number(seasonId.slice(0,4))-2026;
 return {...official,id:`swedish-${seasonId}-GAME_CONTINUITY-v1`,seasonId,nextSeasonId:nextSeason(seasonId),provenance:'GAME_CONTINUITY',verifiedOn:official.verifiedOn,limitations:[],
  boundaryLeagues:districts.map(d=>({id:districtCompetition(d),familyId:F.division2})),
  stages:official.stages.map(s=>({...s,...(s.homeReference?{equalRankHomeOrder:lot(seed,`${seasonId}:${s.id}:equal-rank-home-draw`)%2?[0,1,1] as const:[1,0,0] as const}:{}),...(!s.homeOrder?{homeOrder:lot(seed,`${seasonId}:${s.id}:home-draw`)%2 ? [0,1,1] as const : [1,0,0] as const,source:{...CONTINUITY_SOURCE,section:`Seeded home-reference draw for ${s.id}; no official reference claimed.`}}:{}),
   gameWindows:s.gameWindows?.map(w=>({...w,startDate:`${Number(w.startDate.slice(0,4))+shift}${w.startDate.slice(4)}`,endDate:`${Number(w.endDate.slice(0,4))+shift}${w.endDate.slice(4)}`,...(shift?{source:{...CONTINUITY_SOURCE,section:'Annual game slots shifted from the supported spring 2027 structure.'}}:{})})),
  })),
 };
}

/** Geographic bands are explicit game travel regions, not official district allocations. Source pool districts remain hard anchors. */
export function continuityGeography(clubId:string):{district:District;band:number;hard?:'N'|'S'}|undefined {
 const source=data.division2Registrations.find(d=>d.registrations.some(t=>t.canonicalClubId===clubId));
 if(source){const d=source.district as District;return {district:d,band:({n:5,o:4,m:3,v:2,s:1})[d],...(d==='n'?{hard:'N' as const}:{})}}
 const club=getClub(clubId);if(!club)return;
 if(clubId==='se_club_bodens_bk_hf')return {district:'n',band:5,hard:'N'};
 const central=new Set(['se_club_rp_if_linkoping','se_club_orebro_sk_hk_herr','se_club_lif_lindesberg','swe2-guif','swe2-vasterasirsta']);
 if(central.has(clubId))return {district:'m',band:3};
 const north=new Set(['se_club_hammarby_if_hf','se_club_skanela_if','swe2-huddinge','swe2-tumba','swe2-tyreso']);
 if(club.competitionId===L.norra||north.has(clubId))return {district:'o',band:4};
 const south=new Set(['se_club_amo_hk','se_club_hf_karlskrona','se_club_hk_malmo','se_club_ifk_kristianstad','se_club_lugi_hf','se_club_ov_helsingborg','se_club_ystads_if_hf','swe2-h43lund','swe2-ystad2','se_club_eslovs_hk','se_club_if_kristianstad','se_club_ik_lagan','se_club_vinslovs_hk','se_club_ahus_handboll']);
 if(south.has(clubId))return {district:'s',band:1};
 if(official.leagues.some(l=>l.id===club.competitionId))return {district:'v',band:2};
}

function rosterCounts(state:CareerState){const counts=new Map<string,number>();for(const squad of Object.values(state.worldSquads))for(const p of squad)counts.set(p.id,(counts.get(p.id)??0)+1);return counts}
/** Empty pool squads are valid registrations; playable simulated squads have a separate coverage check. */
export function hasValidCompetitionRegistrations(state:CareerState,id:string,date=state.gameDate,counts=rosterCounts(state)):boolean {
 return (state.worldSquads[id]??[]).every(p=>{
  const contract=state.playerContracts[p.id];
  return counts.get(p.id)===1&&p.clubId===id&&!!contract&&contract.contractEndDate>=date&&
   (contract.clubId===id||Object.values(state.loans).some(l=>l.active&&l.playerId===p.id&&l.borrowingClubId===id&&l.parentClubId===contract.clubId));
 });
}
export function hasCompetitionSquad(state:CareerState,id:string,counts=rosterCounts(state)):boolean {
 const squad=state.worldSquads[id];
 return !!squad&&squad.length>=7&&squad.some(p=>p.position==='MV')&&hasValidCompetitionRegistrations(state,id,state.gameDate,counts);
}
export function isDivision2PoolClub(state:CareerState,id:string):boolean { return districts.some(d=>districtCompetition(d)===clubCompetitionId(state,id)); }

function eligibility(state:CareerState,clubId:string,tier:number,date:string,counts:Map<string,number>){
 const admin=state.swedishContinuity?.administrativeDecisions?.[clubId];
 if(admin?.seasonId===state.seasonId&&!admin.eligible&&admin.evidence.trim())return {eligible:false,reason:admin.evidence};
 if(isDivision2PoolClub(state,clubId)&&!hasValidCompetitionRegistrations(state,clubId,state.gameDate,counts))return {eligible:false,reason:'Conflicting pool registration or expired contract.'};
 if(!isDivision2PoolClub(state,clubId)&&!hasCompetitionSquad(state,clubId,counts))return {eligible:false,reason:'Missing or conflicting registered squad (seven players including a goalkeeper required).'};
 const c=cooperationEligibility(state,clubId,tier,date);return {eligible:c.eligible,reason:c.reasons.join(' | ')||'GAME_CONTINUITY entry accepted in the simulated world; no official future licence claimed.'};
}

/** Aggregate seeded pool performance only: no daily district fixtures, fabricated players, finances or individual match statistics. */
function simulatePool(state:CareerState,date:string,counts:Map<string,number>):PoolSeason {
 const result:PoolSeason={seasonId:state.seasonId,provenance:'GAME_CONTINUITY',districts:{},excluded:[]};
 for(const district of districts){
  const candidates=CLUBS.filter(c=>clubCompetitionId(state,c.id)===districtCompetition(district));
  const clubIds=candidates.filter(c=>{const e=eligibility(state,c.id,3,date,counts);if(!e.eligible)result.excluded.push({clubId:c.id,reason:e.reason});return e.eligible}).map(c=>c.id).sort();
  const strength=(clubId:string):ClubStrength=>({clubId,overall:50,attack:50,defense:50,goalkeeper:50,depth:50});
  const contests=clubIds.flatMap(h=>clubIds.filter(a=>h!==a).map(a=>{
   const seed=lot(state.saveSeed,`${state.seasonId}:division2:${h}:${a}`);
   const score=simulateMatch({fixtureId:`POOL:${state.seasonId}:${h}:${a}`,seed,homeClubId:h,awayClubId:a,homeStrength:strength(h),awayStrength:strength(a)});
   return {homeClubId:h,awayClubId:a,homeGoals:score.homeGoals,awayGoals:score.awayGoals,seed};
  }));
  const rows=computeStandings(clubIds,contests,official.points);
  const poolRules={...official,leagues:[{id:districtCompetition(district),familyId:F.division2,size:clubIds.length,legs:2}]};
  const groups=rankCompletedTable({competitionId:districtCompetition(district),seasonId:state.seasonId,completed:true,rows,mutualResults:contests},poolRules);
  // A rare unresolved sporting tie remains explicit; never award the place by club ID/database order.
  result.districts[district]={clubIds,rows,order:groups.every(g=>g.clubIds.length===1)?groups.flatMap(g=>g.clubIds):[] ,contests};
 }
 return result;
}

export function prepareGameContinuity(state:CareerState,date=state.gameDate):{state:CareerState;request:SeasonTransitionRequest;blockers:Dependency[]} {
 const rules=gameContinuityRules(state.seasonId,state.saveSeed),counts=rosterCounts(state),blockers:Dependency[]=[];
 const evaluationDate=`${Number(state.seasonId.slice(0,4))+1}-03-18`;
 let pool=state.swedishContinuity?.pools?.[state.seasonId];
 if(!pool&&date>=evaluationDate)pool=simulatePool(state,evaluationDate,counts);
 const next=pool&&!state.swedishContinuity?.pools?.[state.seasonId]?{...state,swedishContinuity:{...state.swedishContinuity,pools:{...state.swedishContinuity?.pools,[state.seasonId]:pool}}}:state;
 const eligibilityRows=CLUBS.filter(c=>official.leagues.some(l=>l.id===clubCompetitionId(state,c.id))||districts.some(d=>districtCompetition(d)===clubCompetitionId(state,c.id))).flatMap(c=>rules.families.map(f=>{
  const e=eligibility(state,c.id,f.tier,evaluationDate,counts);return {clubId:c.id,targetFamilyId:f.id,seasonId:state.seasonId,status:e.eligible?'ELIGIBLE' as const:'INELIGIBLE' as const,evidence:e.reason};
 }));
 const externalEntrants:ExternalEntrant[]=[];
 if(pool)for(const district of districts){
  const division=pool.districts[district],required=['v','s'].includes(district)?3:2;
  // Only eligible sporting rankings supply the existing ports.
  const order=division.order.filter(id=>eligibility(state,id,3,evaluationDate,counts).eligible);
  if(order.length<required){blockers.push(issue('DIVISION2_POOL_INSUFFICIENT',district,`Division 2 ${district}: needs ${required} eligible ranked clubs; has ${order.length}. No fictional club identities.`));continue;}
  for(let rank=1;rank<=required;rank++)externalEntrants.push({slotId:`division2-${district}-${rank}`,clubId:order[rank-1]!,evidence:`GAME_CONTINUITY seeded pool performance ${state.seasonId}; ${division.contests.length} aggregate contests. Not an official league result.`});
 }
 const evidence={eligibility:eligibilityRows,externalEntrants};
 const proposal=planCompetitionTransition(snapshotCompetitionTransitionInput(next,evidence,rules));
 const claims=[...proposal.directPromotions,...proposal.directRelegations,...proposal.qualificationMovements,...proposal.remaining];
 const groupAllocations:GroupAllocation[]=[];
 const d1=claims.filter(c=>c.toFamilyId===F.division1).map(c=>c.clubId);
 if(d1.length===24){
  const items=d1.map(id=>({id,geo:continuityGeography(id)}));
  if(items.some(x=>!x.geo))blockers.push(issue('GEOGRAPHY_REQUIRED',F.division1,'A club has no supported game geographic anchor.'));
  else {
   const hardN=items.filter(x=>x.geo!.hard==='N'),hardS=items.filter(x=>x.geo!.hard==='S');
   if(hardN.length>12||hardS.length>12)blockers.push(issue('GEOGRAPHIC_CAPACITY_CONFLICT',F.division1,'Hard regional constraints cannot fit 12/12 groups.'));
   else {const flexible=items.filter(x=>!x.geo!.hard).sort((a,b)=>b.geo!.band-a.geo!.band||lot(state.saveSeed,`${rules.nextSeasonId}:geo:${a.id}`)-lot(state.saveSeed,`${rules.nextSeasonId}:geo:${b.id}`));const north=new Set([...hardN,...flexible.slice(0,12-hardN.length)].map(x=>x.id));
    for(const id of d1)groupAllocations.push({clubId:id,competitionId:north.has(id)?L.norra:L.sodra,evidence:'GAME_CONTINUITY geographic bands, hard regional anchors and 12/12 capacity; equal-band seeded draw. Not an organizer allocation.'});
   }
  }
 }
 for(const c of claims.filter(c=>c.toFamilyId===F.division2)){const geo=continuityGeography(c.clubId);if(!geo)blockers.push(issue('POOL_GEOGRAPHY_REQUIRED',c.clubId,'Relegated club has no supported pool region.'));else groupAllocations.push({clubId:c.clubId,competitionId:districtCompetition(geo.district),evidence:'GAME_CONTINUITY pool home-region allocation; not an official district ruling.'});}
 const nextRules=gameContinuityRules(rules.nextSeasonId,state.saveSeed);
 return {state:next,blockers,request:{fromSeasonId:state.seasonId,rules,evidence:{...evidence,groupAllocations},nextSeason:{rules:nextRules,kickoffDate:`${nextRules.seasonId.slice(0,4)}-09-01`,evidence:'GAME_CONTINUITY annual league kickoff, September 1. Supported deterministic calendar with national breaks and fixed Cup slots; not a published future SHF calendar.'}}};
}
