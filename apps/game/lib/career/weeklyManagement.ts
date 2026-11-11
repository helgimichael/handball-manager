import type { CareerState } from './types';
import { resolveDestinationHref } from './destinations';
import { addDays } from './dateUtils';
import { getCareerSquad } from './careerWorld';
import { isSelectableForMatch } from './playerStatus';
import { squadEnergy } from './management';
import { isManualLineupCareer, manualLineupIssues } from './manualLineup';
import { resolveContextualContinueAction } from './contextualContinueAction';
import { mondayOf, resolveTrainingWeek } from '../training/trainingSchedule';
import { boardOf, ensureBoard } from '../board/board';
import { getClubEconomySnapshot } from '../economy/clubEconomyIntegration';

export interface WeeklyDecision {
  id: string;
  title: string;
  detail: string;
  href: string;
  required: boolean;
  due?: string;
}

/** Read-only integration of existing career state. No weekly state, events or time advancement. */
export function weeklyManagement(state: CareerState) {
  const through = addDays(state.gameDate,6);
  const squad = [...new Map(getCareerSquad(state).map(p=>[p.id,p])).values()];
  const ownIds = new Set(squad.map(p=>p.id));
  const available = squad.filter(p=>isSelectableForMatch(state.playerStatuses,p.id));
  const ownFixtures = state.fixtures.filter(f=>f.homeClubId===state.playerClubId||f.awayClubId===state.playerClubId);
  const action = resolveContextualContinueAction(state,state.activeMatchSession);
  const pending = state.careerEvents.filter(e=>e.requiresAction&&!e.resolved&&e.type!=='MATCHDAY_READY');
  const discussions = Object.values(state.playerDynamics?.concerns??{}).filter(c=>c.status==='OPEN'&&ownIds.has(c.playerId));
  const discussionEvents = new Set(discussions.map(c=>`PLAYER_DYNAMICS:concern:${c.id}`));
  const decisions: WeeklyDecision[] = pending.filter(e=>!discussionEvents.has(e.id)).map(e=>({
    id:e.id,title:e.subject,detail:e.summary,required:true,
    href:e.type==='BOARD_UPDATE'?'/career/board':`/career/inbox?message=${encodeURIComponent(state.inbox.find(m=>m.careerEventId===e.id)?.id??`msg:${e.id}`)}`,
  }));
  for(const c of discussions) {
    const player=squad.find(p=>p.id===c.playerId)!;
    decisions.push({id:`concern:${c.id}`,title:`${player.firstName} ${player.lastName} vill prata`,detail:c.message,
      required:pending.some(e=>e.id===`PLAYER_DYNAMICS:concern:${c.id}`),href:`/career/squad/${encodeURIComponent(c.playerId)}`});
  }
  for (const p of Object.values(state.delegation?.proposals ?? {})) {
    if (p.status === 'PENDING' && p.action.kind === 'TRAINING_PLAN' && p.action.plan.clubId === state.playerClubId && p.action.plan.week.weekStart === mondayOf(state.gameDate)) {
      decisions.push({id:p.id,title:p.title,detail:p.consequence,href:'/career/training',required:false,due:addDays(p.action.plan.week.weekStart,6)});
    }
  }
  const due=(id:string,title:string,date:string,href:string)=>{
    if(date>=state.gameDate&&date<=through)decisions.push({id,title,detail:`Svar eller beslut senast ${date}`,due:date,href,required:false});
  };
  for(const p of squad){const c=state.playerContracts[p.id];if(c?.clubId===state.playerClubId)due(`contract:${p.id}`,`Avtal: ${p.firstName} ${p.lastName}`,c.contractEndDate,'/career/contracts');}
  for(const o of Object.values(state.incomingOffers??{}))if(['OPEN','COUNTERED','AWAITING_FINAL_APPROVAL'].includes(o.status))due(`offer:${o.id}`,'Ta ställning till spelarbud',o.respondBy,resolveDestinationHref({route:'TRANSFER_OFFER',offerId:o.id})!);
  for(const o of Object.values(state.managerCareer?.offers??{}))if(o.status==='OPEN')due(`job:${o.id}`,'Svara på jobberbjudande',o.expiresOn,'/career/manager?tab=jobs');
  // Backfill only the projection for old saves; rendering never changes the career.
  const board = boardOf(state) ?? ensureBoard(state,state.gameDate).board!;
  if(board.contractOffer)due('board-contract','Styrelsens kontraktsförslag',board.contractOffer.expiresOn,'/career/board');
  const recoveryPlan=board.recoveryPlans?.find(p=>p.status==='ACTIVE');
  // Plans need 28 days of evidence and are evaluated at the next monthly review.
  let reviewDate: string|undefined;
  if(recoveryPlan){const eligible=addDays(recoveryPlan.agreedOn,28);const first=eligible.slice(0,7)+'-01';const d=new Date(first+'T00:00:00Z');if(first<eligible)d.setUTCMonth(d.getUTCMonth()+1);reviewDate=d.toISOString().slice(0,10);}
  // Resolve each Monday independently so Sunday never hides the coming week.
  const days=Array.from({length:7},(_,i)=>{
    const date=addDays(state.gameDate,i),weekStart=mondayOf(date);
    const training=resolveTrainingWeek(state,weekStart).days.find(d=>d.date===date)!;
    const fixtures=ownFixtures.filter(f=>f.date===date).map(f=>({fixture:f,played:!!state.results[f.id],
      ready:state.careerEvents.some(e=>e.id===`MATCHDAY_READY:${f.id}`&&!e.resolved)&&date===state.gameDate,
      lineupIssues:state.results[f.id]?[]:isManualLineupCareer(state)?manualLineupIssues(state.matchPlans[f.id],available):[],
    }));
    return {date,weekStart,training,fixtures};
  });
  const feedback=state.careerEvents.filter(e=>e.date>=addDays(state.gameDate,-6)&&e.date<=state.gameDate&&
    ['TRAINING_REPORT','PLAYER_DYNAMICS','BOARD_UPDATE','MATCH_COMPLETED'].includes(e.type)&&!(e.requiresAction&&!e.resolved))
    .slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);
  let progression=action.blockReason??action.tooltip??action.ariaLabel;
  if(action.kind==='ADVANCE_DAY')progression='Fortsätt överst bearbetar varje dag och stannar vid viktiga händelser. Inga dagar hoppas över.';
  if(action.kind==='DECISION_BLOCKED'&&state.managerCareer?.seekingJob)progression='Välj en ny klubb på jobbmarknaden innan kalendern kan fortsätta.';
  return {from:state.gameDate,through,days:state.seasonComplete||state.managerCareer?.seekingJob?[]:days,action,progression,
    available:available.length,total:squad.length,tired:squad.filter(p=>squadEnergy(state,p)<75).length,
    discussions:discussions.length,decisions:decisions.sort((a,b)=>Number(b.required)-Number(a.required)||(a.due??'').localeCompare(b.due??'')),
    board,recoveryPlan,reviewDate,economy:getClubEconomySnapshot(state,state.playerClubId),feedback};
}
