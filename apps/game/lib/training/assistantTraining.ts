// M6C/M6D: planning only. Execution, workload, recovery and development remain
// owned by the existing training pipeline. No planning bonus or rating write.
import type { CareerState } from '../career/types';
import type { CareerEvent } from '../career/careerEvents';
import { getPlayerSquadStatus } from '../career/squadStatus';
import { getCareerSquad } from '../career/careerWorld';
import { addDays } from '../career/dateUtils';
import { getPlayerAvailability, effectiveTrainingLoadSetting } from '../medical/availability';
import { delegateFor, delegationOf, log, modeOf, propose } from '../delegation/delegation';
import { withEvents } from '../manager/events';
import { recoveryProfileFor } from './individualRecovery';
import { bestFor } from '../staff/organisation';
import { computeStaffTrainingQuality, findHeadCoach, resolveResponsibleCoach } from '../staff/roleSuitability';
import { outcourtFamilyAttributes } from '../development/attributeFamilies';
import type { IndividualDevelopmentFocus } from '../development/types';
import { buildTrainingWeek, mondayOf, resolveTrainingWeek, setPlayerIndividualFocus, setPlayerTrainingLoad } from './trainingSchedule';
import type { TrainingDay, WeeklyTrainingTemplate } from './types';
import type { AssistantTrainingPlan, TrainingPlayerRecommendation } from './assistantTrainingTypes';

const energyOf = (s: CareerState, id: string) => s.playerPhysicalState[id]?.currentEnergy ?? 100;
const editable = (s: CareerState, d: TrainingDay, date = s.gameDate) => !d.executed && d.date >= date && d.date > (s.processedThroughDate ?? '');
const ownFixtures = (s: CareerState) => s.fixtures.filter(f => f.homeClubId === s.playerClubId || f.awayClubId === s.playerClubId);
const fixtureStamp = (s: CareerState, start: string) => JSON.stringify(ownFixtures(s).filter(f => f.date >= addDays(start, -1) && f.date <= addDays(start, 7)).map(f => [f.id, f.date]).sort());

/** Only the current club's actual assistant (or an explicitly assigned member).
 * A departed named delegate falls back to the current assistant, with provenance. */
export function trainingPlanner(state: CareerState) {
  const who = delegateFor(state, 'TRAINING_SCHEDULE');
  const roster = state.staffRoster[state.playerClubId] ?? [];
  const member = roster.find(m => m.id === who?.staffId);
  return member ?? null;
}

function focusFor(state: CareerState, playerId: string, goalkeeper: boolean): IndividualDevelopmentFocus {
  const existing = state.playerTrainingAssignments[playerId]?.individualFocus;
  if (existing && ['TECHNICAL', 'ATTACKING_DECISIONS', 'DEFENCE', 'PHYSICAL', 'MENTAL', 'GOALKEEPER'].includes(existing)) return existing as IndividualDevelopmentFocus;
  if (goalkeeper) return 'GOALKEEPER';
  const rating = state.gameplayRatings[state.playerClubId]?.find(r => r.playerId === playerId);
  if (!rating || rating.branch.branch !== 'OUTCOURT') return 'TECHNICAL';
  const attributes = rating.branch.attributes;
  const groups = [['TECHNICAL', 'TECHNICAL'], ['DEFENCE', 'DEFENSIVE'], ['ATTACKING_DECISIONS', 'PERCEPTION_DECISION'], ['PHYSICAL', 'PHYSICAL']] as const;
  return groups.map(([focus, family]) => {
    const values = outcourtFamilyAttributes(family).map(a => attributes[a as keyof typeof attributes]?.value).filter((v): v is number => typeof v === 'number');
    return { focus, score: values.length ? values.reduce((a,b) => a+b, 0) / values.length : 10.5 };
  }).sort((a,b) => a.score-b.score || a.focus.localeCompare(b.focus))[0].focus;
}

/** Builds the existing fixture-aware week, then adds post-match recovery and
 * targeted development sessions. Quality changes decisions, never coefficients. */
export function buildAssistantTrainingPlan(state: CareerState, date = state.gameDate, requestedTemplate?: WeeklyTrainingTemplate): AssistantTrainingPlan {
  const staff = trainingPlanner(state);
  if (!staff) throw new Error('Ingen ansvarig tränare finns. Utse en assistent eller välj Du själv.');
  const weekStart = mondayOf(date), squad = getCareerSquad(state);
  const fixtures = ownFixtures(state);
  const matches = fixtures.filter(f => f.date >= date && f.date <= addDays(weekStart, 6));
  const average = squad.length ? squad.reduce((n,p) => n+energyOf(state,p.id),0)/squad.length : 100;
  const unavailable = squad.filter(p => getPlayerAvailability(state,p.id) !== 'AVAILABLE').length;
  const expertise = ['PHYSICAL_COACHING', 'MATCH_PREPARATION', 'PLAYER_DEVELOPMENT'] as const;
  const judgement = expertise.reduce((n,a) => n+(staff.profile.attributes[a]?.value ?? 10.5),0)/expertise.length;
  const recoveryThreshold = 70 + (judgement-1)*12/19;
  const carryingLoad = squad.filter(p=>recoveryProfileFor(state,p.id,date).ceiling<95).length;
  const template = requestedTemplate ?? (matches.length >= 2 ? 'MATCH_HEAVY' : average < recoveryThreshold || unavailable > squad.length/3 || carryingLoad > squad.length/3 ? 'RECOVERY' : 'BALANCED');
  const reasons = [`${matches.length} matcher återstår i veckan. Truppenergi ${Math.round(average)} %. ${unavailable} spelare har begränsad tillgänglighet.`,
    template === 'RECOVERY' ? 'Återhämtning prioriteras framför fler utvecklingspass.' : template === 'MATCH_HEAVY' ? 'Matchtät vecka: korta förberedelser och Återhämtning.' : 'Utveckling varvas med matchförberedelse och Återhämtning.',
    'Bedömningen bygger på ansvarig tränares fysik-, förberedelse- och utvecklingskompetens. Befintlig medicinsk begränsning gäller alltid.'];
  if (carryingLoad) reasons.push(`${carryingLoad} spelare har kvarvarande belastning som begränsar återhämtningen.`);
  const assigned = delegationOf(state).settings.TRAINING_SCHEDULE?.staffId;
  if (assigned && assigned !== staff.id) reasons.push('Den tidigare ansvarige har lämnat. Nuvarande assistent tar över planeringen.');
  const positions = new Map<string,number>();
  squad.forEach(p => positions.set(p.position,(positions.get(p.position) ?? 0)+1));
  const players: TrainingPlayerRecommendation[] = squad.map(p => {
    const load = energyOf(state,p.id)<65 ? 'RECOVERY_ONLY' : energyOf(state,p.id)<80 || recoveryProfileFor(state,p.id,date).ceiling<95 ? 'REDUCED' : state.playerTrainingAssignments[p.id]?.loadSetting ?? 'FULL';
    const baseline = state.playerTrainingAssignments[p.id];
    return { playerId:p.id, loadSetting:effectiveTrainingLoadSetting(state,p.id,load), individualFocus:focusFor(state,p.id,p.position==='MV'), baseline,
      selected:false, reason:getPlayerAvailability(state,p.id)!=='AVAILABLE' ? 'Medicinsk status begränsar deltagandet.' : energyOf(state,p.id)<80 ? 'Lägre energi: minska belastningen innan nästa match.' : baseline?.individualFocus && baseline.individualFocus !== 'NORMAL' ? 'Behåll ditt valda utvecklingsfokus.' : `${p.position}: utvecklingsområde bedömt utifrån spelarprofilen${(positions.get(p.position) ?? 0)<2 ? '; tunn position, skydda matchberedskapen' : ''}.` };
  });
  const canTarget = (id:string) => !['KEY_PLAYER','FIRST_CHOICE'].includes(getPlayerSquadStatus(state,id) ?? 'ROTATION');
  const current = resolveTrainingWeek(state,weekStart);
  let week = buildTrainingWeek(weekStart,state.fixtures,state.playerClubId,template);
  const roster = state.staffRoster[state.playerClubId] ?? [];
  let targeted = false;
  week = { ...week, days:week.days.map(day => {
    const old = current.days.find(d => d.date === day.date)!;
    if (!editable(state,old,date)) return old;
    const tomorrow = fixtures.some(f => f.date===addDays(day.date,1));
    if (!tomorrow && day.dayType !== 'MATCH' && fixtures.some(f => f.date===addDays(day.date,-1))) return { ...day, dayType:'RECOVERY', sessions:[] };
    let sessions = [...day.sessions];
    // A competent planner allocates an existing session to the weakest
    // position's development need; no extra session or free stimulus is added.
    if (!targeted && judgement >= 10.5 && day.dayType==='TRAINING' && !tomorrow && template !== 'RECOVERY') {
      const target = squad.filter(p => canTarget(p.id) && getPlayerAvailability(state,p.id)==='AVAILABLE' && energyOf(state,p.id)>=80)
        .sort((a,b) => (positions.get(a.position) ?? 0)-(positions.get(b.position) ?? 0) || a.id.localeCompare(b.id))[0];
      const focus = players.find(p => p.playerId===target?.id)?.individualFocus;
      const type = focus === 'GOALKEEPER' ? 'GOALKEEPER' : focus === 'DEFENCE' ? 'DEFENCE' : focus === 'ATTACKING_DECISIONS' ? 'ATTACK' : focus === 'PHYSICAL' ? 'STRENGTH' : 'TECHNICAL';
      if (target && sessions.length) { targeted = true; sessions[0] = { ...sessions[0], type, target:'SELECTED_PLAYERS', selectedPlayerIds:squad.filter(p => canTarget(p.id) && p.position===target.position && getPlayerAvailability(state,p.id)==='AVAILABLE' && energyOf(state,p.id)>=80).map(p=>p.id) }; }
    }
    sessions = sessions.map(session => ({ ...session, coachId:resolveResponsibleCoach(roster,session.type,null)?.id ?? null }));
    return { ...day, sessions };
  }) };
  // Coach quality is applied by executeTrainingDay, not this planner.
  const qualities = week.days.flatMap(d=>d.sessions).filter(s=>s.type!=='RECOVERY').map(s=>computeStaffTrainingQuality(s.type,resolveResponsibleCoach(roster,s.type,s.coachId),findHeadCoach(roster)));
  if (qualities.length) reasons.push('Passen leds av befintliga ämnestränare; deras vanliga kvalitet påverkar endast genomförd träning.');
  if (!bestFor(state,state.playerClubId,'ASSISTANT_COACH')) reasons.push('Ingen assistent finns; den uttryckligen utsedda tränaren ansvarar för planen.');
  return { clubId:state.playerClubId, week, template, generatedOn:date, staffName:staff.displayName, reasons, fixtures:fixtureStamp(state,weekStart), baselineWeek:state.trainingWeeks[weekStart], players };
}

function proposalForWeek(state: CareerState, start: string) {
  return Object.values(delegationOf(state).proposals).find(p => p.action.kind==='TRAINING_PLAN' && p.action.plan.clubId===state.playerClubId && p.action.plan.week.weekStart===start && p.status==='PENDING');
}

/** Explicit request also works in manager mode; it never applies a plan. */
export function requestAssistantTraining(state: CareerState): CareerState {
  if (proposalForWeek(state,mondayOf(state.gameDate))) return state;
  const plan = buildAssistantTrainingPlan(state);
  if (!plan.week.days.some(d=>editable(state,d))) throw new Error('Veckan är redan genomförd.');
  const events: CareerEvent[] = [];
  const next = propose(state,state.gameDate,e=>events.push(e),{ area:'TRAINING_SCHEDULE', staffId:trainingPlanner(state)!.id,
    title:`Träningsplan ${plan.week.weekStart}`, reason:plan.reasons.join(' '), consequence:'Granska veckans pass i Träning. Individuella ändringar gäller bara markerade spelare och kräver ditt godkännande.', action:{kind:'TRAINING_PLAN',plan} });
  return withEvents(next,events);
}

/** Runs BEFORE training. A manager/legacy stored week is never replaced
 * automatically; individual load/focus always awaits explicit approval. */
export function progressAssistantTraining(state: CareerState, date: string, emit: (e:CareerEvent)=>void): CareerState {
  if (modeOf(state,'TRAINING_SCHEDULE')==='MANAGER' || state.managerCareer?.seekingJob || !trainingPlanner(state)) return state;
  const weekStart=mondayOf(date);
  if (Object.values(delegationOf(state).proposals).some(p=>p.action.kind==='TRAINING_PLAN' && p.action.plan.clubId===state.playerClubId && p.action.plan.week.weekStart===weekStart)) return state;
  const plan=buildAssistantTrainingPlan(state,date);
  let next=state;
  const hasManagerDays=state.trainingWeeks[weekStart]?.days.some(d=>editable(state,d,date));
  if (modeOf(state,'TRAINING_SCHEDULE')==='DELEGATE' && !hasManagerDays) {
    const week={ ...plan.week, planning:{source:'ASSISTANT' as const,staffId:trainingPlanner(state)!.id} };
    next={...state,trainingWeeks:{...state.trainingWeeks,[weekStart]:week}};
    plan.teamApplied=true;plan.baselineWeek=week;
    next=log(next,{date,area:'TRAINING_SCHEDULE',staffId:trainingPlanner(state)!.id,action:`Veckoplan ${weekStart}`,reason:plan.reasons.join(' '),result:'DONE'});
  }
  return propose(next,date,emit,{area:'TRAINING_SCHEDULE',staffId:trainingPlanner(state)!.id,title:`Träningsplan ${weekStart}`,
    reason:plan.reasons.join(' '),consequence:plan.teamApplied ? 'Veckoschemat är lagt. Individuella fokus och belastningar ändras bara efter ditt godkännande.' : 'Ditt nuvarande schema behålls tills du godkänner förslaget i Träning.',action:{kind:'TRAINING_PLAN',plan}});
}

/** The same approval path is used from training and the responsibility page. */
export function applyAssistantTrainingPlan(state: CareerState, plan: AssistantTrainingPlan): CareerState {
  const start=plan.week.weekStart;
  if (plan.clubId!==state.playerClubId || start!==mondayOf(state.gameDate) || fixtureStamp(state,start)!==plan.fixtures) throw new Error('Klubb, vecka eller matchschema har ändrats. Be om ett nytt förslag.');
  const current=resolveTrainingWeek(state,start),baseline=plan.baselineWeek ?? buildTrainingWeek(start,state.fixtures,state.playerClubId);
  if (!current.days.some(d=>editable(state,d))) throw new Error('Veckan är redan genomförd.');
  const fresh=buildTrainingWeek(start,state.fixtures,state.playerClubId);
  for (const day of current.days.filter(d=>editable(state,d))) {
    if (JSON.stringify(day)!==JSON.stringify(baseline.days.find(d=>d.date===day.date))) throw new Error('Du har ändrat schemat efter förslaget. Behåll din plan eller be om ett nytt förslag.');
    const draft=plan.week.days.find(d=>d.date===day.date);
    const required=fresh.days.find(d=>d.date===day.date)!;
    if (!draft || draft.executed || draft.results || draft.sessions.length>2 || (required.dayType==='MATCH' && (draft.dayType!=='MATCH'||draft.sessions.length)) || (required.sessions.some(s=>s.type==='MATCH_PREPARATION') && (draft.sessions.length!==1 || draft.sessions[0].type!=='MATCH_PREPARATION' || draft.sessions[0].intensity!=='LOW'))) throw new Error('Planen måste respektera matchdag och låg matchförberedelse.');
  }
  let next:CareerState={...state,trainingWeeks:{...state.trainingWeeks,[start]:{...current,planning:{source:'MANAGER'},days:current.days.map(d=>editable(state,d)?plan.week.days.find(x=>x.date===d.date)!:d)}}};
  const ids=new Set(getCareerSquad(state).map(p=>p.id));
  for(const p of plan.players.filter(p=>p.selected)) {
    if(!ids.has(p.playerId)||JSON.stringify(state.playerTrainingAssignments[p.playerId])!==JSON.stringify(p.baseline)) throw new Error('Spelare eller individuell instruktion har ändrats. Be om ett nytt förslag.');
    next=setPlayerTrainingLoad(next,p.playerId,effectiveTrainingLoadSetting(state,p.playerId,p.loadSetting));
    next=setPlayerIndividualFocus(next,p.playerId,p.individualFocus);
  }
  return next;
}

/** Draft edits persist in the proposal; they do not change the live schedule. */
export function editAssistantTrainingPlan(state:CareerState,id:string,edit:(plan:AssistantTrainingPlan)=>AssistantTrainingPlan):CareerState {
  const p=delegationOf(state).proposals[id];
  if(!p||p.status!=='PENDING'||p.action.kind!=='TRAINING_PLAN') return state;
  const plan=edit(structuredClone(p.action.plan));
  return {...state,delegation:{...delegationOf(state),proposals:{...delegationOf(state).proposals,[id]:{...p,action:{kind:'TRAINING_PLAN',plan}}}}};
}
