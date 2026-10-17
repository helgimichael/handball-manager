/** Opt-in developer observation. No production import, state writes or RNG. */
import type { CoreEvent, CoreState, TeamId } from '@handball-manager/handball-engine/src/v2/core/state';
import { courtPlayers } from '@handball-manager/handball-engine/src/v2/core/state';
import { courtLimit, exchangeActive } from '@handball-manager/handball-engine/src/v2/core/population';
import { decideHandball } from '@handball-manager/handball-engine/src/v2/core/intelligence';
import { possessionEconomy } from './possessionEconomy';
import { distribution, ratio } from '../../lib/matchBenchmarks/statistics';

const teams = ['HOME', 'AWAY'] as const;
const countBy = <T>(rows: readonly T[], key: (r: T) => string) => rows.reduce<Record<string, number>>((n,r) => { const k=key(r); n[k]=(n[k]??0)+1; return n; },{});
const sum = (a: readonly number[]) => a.reduce((n,v)=>n+v,0);

export function manpowerSnapshot(s: Readonly<CoreState>) {
  const sides = Object.fromEntries(teams.map(team => {
    const court=courtPlayers(s as CoreState,team), field=court.filter(p=>p.kind==='FIELD_PLAYER');
    return [team,{
      courtIds:court.map(p=>p.id), fieldIds:field.map(p=>p.id), keeperIds:court.filter(p=>p.kind==='GOALKEEPER').map(p=>p.id),
      availableFieldIds:field.filter(p=>!p.condition.unavailable&&!p.condition.exitRequired&&!exchangeActive(s as CoreState,p.id)).map(p=>p.id),
      limit:courtLimit(s as CoreState,team),
      suspended:s.players.filter(p=>p.team===team&&(p.population==='SUSPENDED'||p.population==='DISQUALIFIED')).map(p=>({id:p.id,population:p.population,untilMs:p.suspensionUntilMs,remainingMs:Math.max(0,(p.suspensionUntilMs??0)-s.officialClock.timeMs)})),
    }];
  })) as Record<TeamId,{courtIds:string[];fieldIds:string[];keeperIds:string[];availableFieldIds:string[];limit:number;suspended:{id:string;population:string;untilMs:number|null;remainingMs:number}[]}>;
  return {tick:s.tick,officialMs:s.officialClock.timeMs,simulationMs:s.timeMs,period:s.period,owner:s.possession.team,possessionId:s.possession.id,
    state:`${sides.HOME.fieldIds.length}v${sides.AWAY.fieldIds.length}`,sides};
}

/** A structured foul/discipline join, using recorded contact and foul IDs. */
export function foulStructure(s:Readonly<CoreState>) {
  const events=s.events,contacts=events.filter(e=>e.type==='CONTACT_EXECUTED'),fouls=events.filter(e=>e.type==='FOUL_ASSESSED');
  const byContact=new Map(contacts.map(e=>[e.contestId,e]));
  const whistles=events.filter(e=>e.type==='WHISTLE_RESTART');
  const penalties=events.filter(e=>e.type==='TWO_MINUTE_SUSPENSION'||e.type==='DISQUALIFICATION');
  const warnings=events.filter(e=>e.type==='WARNING');
  const rows=fouls.map(f=>{
    const id=String(f.details.foulId), contact=byContact.get(f.contestId), whistle=whistles.filter(e=>e.details.foulId===id), sanction=penalties.filter(e=>e.details.foulId===id);
    const seven=whistle.some(e=>e.details.kind==='SEVEN_METRE'),ordinary=whistle.some(e=>e.details.kind==='FREE_THROW');
    const p=s.players.find(p=>p.id===f.actorId);
    return {foulId:id,contactId:f.contestId,tick:f.tick,officialMs:f.officialMs,playerId:f.actorId,team:p?.team??null,finalRole:p?.role??null,
      severity:f.details.severity,reason:f.details.reason,decision:f.details.decision,
      contact:contact?{...contact.details}:null,whistleIds:whistle.map(e=>e.id),sevenMetre:seven,ordinaryFreeThrow:ordinary,
      warningIds:warnings.filter(e=>e.details.foulId===id).map(e=>e.id),penaltyIds:sanction.map(e=>e.id),penaltyTypes:sanction.map(e=>e.type),
      relatedGroupPenaltyIds:penalties.filter(e=>String(e.details.disciplineFoulIds??'').split('|').includes(id)).map(e=>e.id),
      outcome:seven&&sanction.length?'7M_AND_SUSPENSION':seven?'7M_WITHOUT_SUSPENSION':sanction.length?'SUSPENSION_WITHOUT_7M':ordinary?'FREE_THROW_WITHOUT_SUSPENSION':'NO_WHISTLE_FOR_THIS_FOUL',
      advantageRealized:events.some(e=>e.type==='ADVANTAGE_REALIZED'&&e.details.foulId===id),
      advantageRecalled:events.some(e=>e.type==='ADVANTAGE_RECALLED'&&e.details.foulId===id),
    };
  });
  const legal=contacts.filter(e=>e.details.severity==='LEGAL').length;
  const perTeam=Object.fromEntries(teams.map(team=>[team,{penalties:rows.filter(r=>r.team===team).reduce((n,r)=>n+r.penaltyIds.length,0),twoMinutes:penalties.filter(e=>s.players.find(p=>p.id===e.actorId)?.team===team&&e.type==='TWO_MINUTE_SUSPENSION').length,disqualifications:penalties.filter(e=>s.players.find(p=>p.id===e.actorId)?.team===team&&e.type==='DISQUALIFICATION').length}]));
  return {
    definitions:{opportunities:'Committed ACTION_STARTED kind CONTACT; missed/unresolved commitments are separate from physically executed contacts.',contacts:'Unique actual CONTACT_EXECUTED events. No inferred proximity contacts.',ordinaryFouls:'FOUL_ASSESSED severity ORDINARY; may receive advantage instead of a whistle.',discipline:'TWO_MINUTE_SUSPENSION and DISQUALIFICATION both create a team reduction. The third two-minute punishment is recorded as DISQUALIFICATION, reported separately.',role:'Final core role is not event-time historical position.',offensiveFouls:'No authentic canonical offensive-foul producer is currently implemented; zero is not proof of support.'},
    opportunities:events.filter(e=>e.type==='ACTION_STARTED'&&e.details.kind==='CONTACT').length,contacts:contacts.length,missed:events.filter(e=>e.type==='CONTACT_MISSED').length,
    legalContacts:legal,assessedFouls:fouls.length,ordinaryFouls:fouls.filter(e=>e.details.severity==='ORDINARY').length,
    freeThrows:whistles.filter(e=>e.details.kind==='FREE_THROW').length,sevenMetres:whistles.filter(e=>e.details.kind==='SEVEN_METRE').length,
    twoMinutes:penalties.filter(e=>e.type==='TWO_MINUTE_SUSPENSION').length,disqualifications:penalties.filter(e=>e.type==='DISQUALIFICATION').length,
    personalReductions:penalties.length,sevenAndSuspension:rows.filter(r=>r.sevenMetre&&(r.penaltyIds.length||r.relatedGroupPenaltyIds.length)).length,warnings:warnings.length,
    offensiveFouls:events.filter(e=>e.type==='OFFENSIVE_FOUL').length,
    rates:{legalPerContact:ratio(legal,contacts.length),foulPerContact:ratio(fouls.length,contacts.length),freeThrowPerContact:ratio(whistles.filter(e=>e.details.kind==='FREE_THROW').length,contacts.length),sevenPerContact:ratio(whistles.filter(e=>e.details.kind==='SEVEN_METRE').length,contacts.length),twoMinutePerContact:ratio(penalties.filter(e=>e.type==='TWO_MINUTE_SUSPENSION').length,contacts.length),twoMinutePerFoul:ratio(penalties.filter(e=>e.type==='TWO_MINUTE_SUSPENSION').length,fouls.length),sevenPerFoul:ratio(whistles.filter(e=>e.details.kind==='SEVEN_METRE').length,fouls.length),sevenAndSuspensionPerFoul:ratio(rows.filter(r=>r.sevenMetre&&(r.penaltyIds.length||r.relatedGroupPenaltyIds.length)).length,fouls.length)},
    severity:countBy(contacts,e=>String(e.details.severity)),causalCategories:countBy(contacts,e=>String(e.details.contactClass??'UNRECORDED')),penaltyCategories:countBy(rows.filter(r=>r.penaltyIds.length),r=>String(r.contact?.contactClass??'UNLINKED')),
    perTeam,perPlayer:countBy(penalties,e=>String(e.actorId)),perFinalRole:countBy(penalties,e=>s.players.find(p=>p.id===e.actorId)?.role??'UNKNOWN'),rows,
    integrity:{duplicateContactIds:contacts.length-new Set(contacts.map(e=>e.contestId)).size,duplicateFoulIds:fouls.length-new Set(fouls.map(e=>e.details.foulId)).size,multiplePenaltiesForFoul:rows.filter(r=>r.penaltyIds.length>1).map(r=>r.foulId),unlinkedFouls:rows.filter(r=>!r.contact).map(r=>r.foulId),unlinkedPenalties:penalties.filter(e=>!rows.some(r=>r.foulId===e.details.foulId)).map(e=>e.id)},
  };
}

/** Read population transitions already recorded by canonical execution.
 * Reverse reading identifies the initial unit; forward reading must reproduce
 * every final population flag. It does not choose/admit/suspend any player.
 */
export function recordedStructure(s:Readonly<CoreState>) {
  const people=new Map(s.players.map(p=>[p.id,p])),pop=new Map(s.players.map(p=>[p.id,p.population]));
  for(const e of [...s.events].reverse())if(e.actorId){
    if(e.type==='SUBSTITUTE_ADMITTED')pop.set(e.actorId,'BENCH');
    if(['PLAYER_LEFT_COURT','TWO_MINUTE_SUSPENSION','DISQUALIFICATION'].includes(e.type))pop.set(e.actorId,'COURT');
    if(e.type==='SUSPENSION_EXPIRED')pop.set(e.actorId,'SUSPENDED');
  }
  const initialPopulation=Object.fromEntries(pop),sides=()=>Object.fromEntries(teams.map(t=>[t,[...pop].filter(([id,v])=>v==='COURT'&&people.get(id)?.team===t).map(([id])=>id)])) as Record<TeamId,string[]>;
  const state=()=>{const p=sides();return `${p.HOME.filter(id=>people.get(id)?.kind==='FIELD_PLAYER').length}v${p.AWAY.filter(id=>people.get(id)?.kind==='FIELD_PLAYER').length}`;};
  const byState:Record<string,Exposure&{startsByTeam:Record<TeamId,number>}>={},time:Record<string,{officialMs:number;simulationMs:number}>={};
  const row=(k:string)=>byState[k]??={...empty(),startsByTeam:{HOME:0,AWAY:0}};
  let key=state(),official=0,simulation=0,phase='RESTART_CENTRE_THROW_OFF',stopped:string|null='OPENING_HALF';
  const eventStates=new Map<string,string>(),shots=new Map<string,{state:string;field:boolean}>(),intervals:{startTick:number;endTick:number;officialMs:number;state:string;phase:string;possessionId:string}[]=[];
  const restartWindows:{kind:string;awardedTick:number;completedTick:number|null;officialSeconds:number;simulationSeconds:number;superseded:boolean}[]=[];
  let restart:{kind:string;tick:number;officialMs:number;simulationMs:number}|null=null,lastTick=0,lastPossession=s.events[0]?.possessionId??s.possession.id;
  const boundaries:{tick:number;officialMs:number;state:string;court:Record<TeamId,string[]>}[]=[{tick:0,officialMs:0,state:key,court:sides()}];
  for(const e of s.events){
    const dt=Math.max(0,e.officialMs-official),sim=Math.max(0,e.timeMs-simulation);row(key).officialMs+=dt;row(key).simulationMs+=sim;
    const timeKey=stopped?'STOPPED_'+stopped:phase;
    const phaseRow=time[timeKey]??={officialMs:0,simulationMs:0};phaseRow.officialMs+=dt;phaseRow.simulationMs+=sim;
    if(dt)intervals.push({startTick:lastTick,endTick:e.tick,officialMs:dt,state:key,phase,possessionId:lastPossession});
    official=e.officialMs;simulation=e.timeMs;lastTick=e.tick;lastPossession=e.possessionId;
    if(e.actorId){
      if(e.type==='SUBSTITUTE_ADMITTED')pop.set(e.actorId,'COURT');
      if(e.type==='PLAYER_LEFT_COURT'||e.type==='SUSPENSION_EXPIRED')pop.set(e.actorId,'BENCH');
      if(e.type==='TWO_MINUTE_SUSPENSION')pop.set(e.actorId,'SUSPENDED');
      if(e.type==='DISQUALIFICATION')pop.set(e.actorId,'DISQUALIFIED');
    }
    const next=state();if(next!==key||['SUBSTITUTE_ADMITTED','PLAYER_LEFT_COURT'].includes(e.type)){key=next;boundaries.push({tick:e.tick,officialMs:e.officialMs,state:key,court:sides()});}
    eventStates.set(e.id,key);const counts=row(key);
    if(e.type==='PASS_RELEASED')counts.passes++;
    if(e.type==='SHOT_RELEASED'){counts.shots++;const field=e.details.shotKind!=='SEVEN_METRE'&&people.get(e.actorId!)?.kind==='FIELD_PLAYER';if(field)counts.fieldAttempts++;if(e.details.shotKind==='SEVEN_METRE')counts.sevenMetres++;if(e.actionId)shots.set(e.actionId,{state:key,field});}
    if(e.type==='GOAL'){counts.goals++;const release=e.actionId?shots.get(e.actionId):null;if(release?.field)row(release.state).fieldGoals++;}
    if(e.type==='WHISTLE_RESTART'&&e.details.kind==='FREE_THROW')counts.freeThrows++;
    if(e.type==='TWO_MINUTE_SUSPENSION'||e.type==='DISQUALIFICATION')counts.penalties++;
    if(e.type==='RESTART_AWARDED'){
      if(restart)restartWindows.push({kind:restart.kind,awardedTick:restart.tick,completedTick:null,officialSeconds:(e.officialMs-restart.officialMs)/1000,simulationSeconds:(e.timeMs-restart.simulationMs)/1000,superseded:true});
      restart={kind:String(e.details.kind),tick:e.tick,officialMs:e.officialMs,simulationMs:e.timeMs};phase='RESTART_'+e.details.kind;
    }
    if(e.type==='POSSESSION_CHANGED')phase='LIVE_TRANSITION';
    if(e.type==='ATTACK_SETTLED')phase='LIVE_ESTABLISHED';
    if(e.type==='RESTART_COMPLETED'){
      if(restart)restartWindows.push({kind:restart.kind,awardedTick:restart.tick,completedTick:e.tick,officialSeconds:(e.officialMs-restart.officialMs)/1000,simulationSeconds:(e.timeMs-restart.simulationMs)/1000,superseded:false});
      restart=null;phase=e.details.kind==='CENTRE_THROW_OFF'||e.details.kind==='GOALKEEPER_THROW'?'LIVE_TRANSITION':'LIVE_ESTABLISHED';
    }
    if(e.type==='OFFICIAL_TIMEOUT_STARTED')stopped='PERSONAL_SANCTION';
    if(e.type==='TEAM_TIMEOUT_STARTED')stopped='TEAM_TIMEOUT';
    if(e.type==='HALFTIME')stopped='HALFTIME';
    if(e.type==='OFFICIAL_TIMEOUT_ENDED')stopped='AWAITING_WHISTLE';
    if(e.type==='OFFICIAL_CLOCK_RESTARTED'||e.type==='PERIOD_STARTED')stopped=null;
  }
  const economy=possessionEconomy(s),aliases=economy.integrity.continuationAliases;
  const episodes=economy.records.map(r=>{
    const events=s.events.filter(e=>e.tick>=r.firstTick&&e.tick<=r.lastTick&&(aliases[e.possessionId]??e.possessionId)===r.canonicalId);
    const start=eventStates.get(events[0]?.id as string)??boundaries[0].state,end=eventStates.get(events.at(-1)?.id as string)??start;
    row(start).possessionsStarted++;row(start).startsByTeam[r.team]++;if(r.loss)row(end).losses++;
    const held=intervals.filter(i=>i.startTick>=r.firstTick&&i.endTick<=r.lastTick&&(aliases[i.possessionId]??i.possessionId)===r.canonicalId);
    const transitioned=held.some(i=>i.phase==='LIVE_TRANSITION'),settled=held.some(i=>i.phase==='LIVE_ESTABLISHED');
    return{key:r.key,team:r.team,durationSeconds:r.durationSeconds,transitioned,settled,transitionSeconds:sum(held.filter(i=>i.phase==='LIVE_TRANSITION').map(i=>i.officialMs))/1000,settledSeconds:sum(held.filter(i=>i.phase==='LIVE_ESTABLISHED').map(i=>i.officialMs))/1000,restartSeconds:sum(held.filter(i=>i.phase.startsWith('RESTART_')).map(i=>i.officialMs))/1000,ending:r.ending,loss:r.loss,passes:r.passesReleased,shots:r.shots,freeThrows:r.freeThrows,retainedRebounds:r.retainedRebounds,states:[...new Set(held.map(i=>i.state))]};
  });
  const finalPopulationExact=s.players.every(p=>pop.get(p.id)===p.population);
  const restarts=Object.fromEntries([...new Set(restartWindows.map(r=>r.kind))].map(k=>{const all=restartWindows.filter(r=>r.kind===k),finished=all.filter(r=>!r.superseded);return[k,{count:all.length,completed:finished.length,superseded:all.filter(r=>r.superseded).length,officialSeconds:distribution(finished.map(r=>r.officialSeconds)),simulationSeconds:distribution(finished.map(r=>r.simulationSeconds)),zeroDuration:finished.filter(r=>r.simulationSeconds===0).length}];}));
  return {definitions:{population:'Reconstructed solely from actual SUB.../LEFT/SUSPENSION/EXPIRED/DISQUALIFICATION events, reversed from final flags and then checked forward. Live snapshots independently verify this reading in selected complete production sessions.',events:'Event-order manpower; field conversion is joined to manpower at shot release.',timing:'Official/simulation time between recorded events; interval phase inferred only from explicit canonical phase/restart events. Initial opening award was cleared by the production adapter and has no paired award window.',episodes:'Canonical possessionEconomy records, with phase exposure attached. Transition and settled exposure are not mutually exclusive extra possessions.',restarts:'Award-to-release windows, excluding superseded awards from completed-duration summaries; initial opening award is not in production event history.'},initialPopulation,finalPopulationExact,byState:Object.fromEntries(Object.entries(byState).map(([k,v])=>[k,{...v,fieldConversion:ratio(v.fieldGoals,v.fieldAttempts),attackDuration:distribution(episodes.filter(e=>e.states.includes(k)).map(e=>e.durationSeconds))}])),time,episodes,restarts,restartWindows,boundaries,
    totals:{officialMs:sum(Object.values(time).map(v=>v.officialMs)),simulationMs:sum(Object.values(time).map(v=>v.simulationMs)),possessions:economy.records.length,possessionsByTeam:Object.fromEntries(teams.map(t=>[t,economy.teams[t].possessions])),possessionsPerOfficialMinute:ratio(economy.records.length,s.officialClock.timeMs/60000),duration:distribution(economy.records.map(r=>r.durationSeconds)),transitionBearingDuration:distribution(episodes.filter(e=>e.transitioned).map(e=>e.durationSeconds)),settledBearingDuration:distribution(episodes.filter(e=>e.settled).map(e=>e.durationSeconds)),retainedRebounds:sum(economy.records.map(r=>r.retainedRebounds)),sevenMetreEpisodes:economy.records.filter(r=>r.hasSevenMetre).length,freeThrowEpisodes:economy.records.filter(r=>r.freeThrows>0).length,passesPerPossession:ratio(sum(economy.records.map(r=>r.passesReleased)),economy.records.length),freeThrowsPerPossession:ratio(sum(economy.records.map(r=>r.freeThrows)),economy.records.length),shotsPerPossession:ratio(sum(economy.records.map(r=>r.shots)),economy.records.length),lossesPerPossession:ratio(economy.records.filter(r=>r.loss).length,economy.records.length),endings:countBy(economy.records,r=>r.ending)},integrity:economy.integrity};
}

function phaseOf(s:Readonly<CoreState>) {
  if(s.referee.timeout)return 'STOPPED_'+s.referee.timeout.reason;
  if(s.match?.phase==='HALFTIME')return 'STOPPED_HALFTIME';
  if(!s.officialClock.running)return 'STOPPED_'+(s.match?.phase??'CLOCK');
  if(!s.ball.live)return 'RESTART_'+(s.restart?.kind??'DEAD_BALL');
  return 'LIVE_'+s.possession.phase;
}
type Exposure={officialMs:number;simulationMs:number;passes:number;shots:number;goals:number;fieldAttempts:number;fieldGoals:number;sevenMetres:number;freeThrows:number;penalties:number;possessionsStarted:number;losses:number};
const empty=():Exposure=>({officialMs:0,simulationMs:0,passes:0,shots:0,goals:0,fieldAttempts:0,fieldGoals:0,sevenMetres:0,freeThrows:0,penalties:0,possessionsStarted:0,losses:0});

export class MatchStructureObserver {
  readonly boundaries:ReturnType<typeof manpowerSnapshot>[]=[];
  readonly environments:{tick:number;officialMs:number;state:string;attackingTeam:TeamId;attackers:number;defenders:number;receivers:number;passingOptions:number;width:number;localAttackers:number;localDefenders:number;assignments:number;advantage:string;shotQuality:number|null}[]=[];
  readonly violations:{tick:number;reason:string}[]=[];
  private previous:ReturnType<typeof manpowerSnapshot>;
  private phase:string;
  private ownerKey:string;
  private signature:string;
  private byState:Record<string,Exposure>={};
  private time:Record<string,{officialMs:number;simulationMs:number}>={};
  private attackTime=new Map<string,{transitionMs:number;settledMs:number;restartMs:number;states:Record<string,number>}>();
  private lastPhase:string;
  private terminalStates=new Map<string,string>();
  private shots=new Map<string,{state:string;field:boolean}>();
  private seen=new Set<string>();
  private sampledTick=-1;
  constructor(s:Readonly<CoreState>){this.previous=manpowerSnapshot(s);this.phase=phaseOf(s);this.lastPhase=s.possession.phase;this.ownerKey=`${s.period}:${s.possession.id}`;this.signature=this.identity(this.previous);this.boundaries.push(this.previous);}
  private identity(v:ReturnType<typeof manpowerSnapshot>){return JSON.stringify(teams.map(t=>({court:v.sides[t].courtIds,limit:v.sides[t].limit,suspended:v.sides[t].suspended.map(p=>[p.id,p.population,p.untilMs])})));}
  observe=(s:Readonly<CoreState>,events:readonly CoreEvent[])=>{
    const now=manpowerSnapshot(s),prior=this.previous,dt=Math.max(0,now.officialMs-prior.officialMs),sim=Math.max(0,now.simulationMs-prior.simulationMs);
    const before=this.byState[prior.state]??=empty();before.officialMs+=dt;before.simulationMs+=sim;
    const clock=this.time[this.phase]??={officialMs:0,simulationMs:0};clock.officialMs+=dt;clock.simulationMs+=sim;
    const attack=this.attackTime.get(this.ownerKey)??{transitionMs:0,settledMs:0,restartMs:0,states:{}};
    if(this.lastPhase==='TRANSITION')attack.transitionMs+=dt;else if(this.lastPhase==='ESTABLISHED')attack.settledMs+=dt;else attack.restartMs+=dt;
    attack.states[prior.state]=(attack.states[prior.state]??0)+dt;this.attackTime.set(this.ownerKey,attack);
    if(this.identity(now)!==this.signature){this.boundaries.push(now);this.signature=this.identity(now);}
    for(const team of teams){const side=now.sides[team];if(side.courtIds.length>side.limit)this.violations.push({tick:s.tick,reason:team+' exceeds legal court limit'});if(side.keeperIds.length>1)this.violations.push({tick:s.tick,reason:team+' has multiple goalkeepers'});if(side.suspended.some(p=>side.courtIds.includes(p.id)))this.violations.push({tick:s.tick,reason:'Suspended player on court'});}
    const row=this.byState[now.state]??=empty();
    for(const e of events){if(this.seen.has(e.id))continue;this.seen.add(e.id);
      if(e.type==='PASS_RELEASED')row.passes++;
      if(e.type==='SHOT_RELEASED'){row.shots++;const p=s.players.find(p=>p.id===e.actorId),field=e.details.shotKind!=='SEVEN_METRE'&&p?.kind==='FIELD_PLAYER';if(field)row.fieldAttempts++;if(e.details.shotKind==='SEVEN_METRE')row.sevenMetres++;if(e.actionId)this.shots.set(e.actionId,{state:now.state,field});}
      if(e.type==='GOAL'){row.goals++;const shot=e.actionId?this.shots.get(e.actionId):null;if(shot?.field)(this.byState[shot.state]??=empty()).fieldGoals++;}
      if(e.type==='WHISTLE_RESTART'&&e.details.kind==='FREE_THROW')row.freeThrows++;
      if(e.type==='TWO_MINUTE_SUSPENSION'||e.type==='DISQUALIFICATION')row.penalties++;
      if((e.type==='POSSESSION_AWARDED'||e.type==='POSSESSION_CHANGED')&&e.details.ended===true)this.terminalStates.set(`${s.period}:${e.possessionId}`,now.state);
    }
    if(s.tick%20===0&&this.sampledTick!==s.tick&&s.ball.live&&s.ball.controllerId){const p=s.players.find(p=>p.id===s.ball.controllerId);if(p?.kind==='FIELD_PLAYER'&&p.population==='COURT'){
      this.sampledTick=s.tick;
      const d=decideHandball(s as CoreState,p),r=d.perception,own=courtPlayers(s as CoreState,p.team).filter(p=>p.kind==='FIELD_PLAYER');
      this.environments.push({tick:s.tick,officialMs:s.officialClock.timeMs,state:now.state,attackingTeam:p.team,attackers:r.space.attackers,defenders:r.space.defenders,receivers:r.receivers.length,passingOptions:d.affordances.filter(a=>a.motor==='PASS').length,width:Math.max(...own.map(p=>p.position.x))-Math.min(...own.map(p=>p.position.x)),localAttackers:r.space.localAttackers,localDefenders:r.space.localDefenders,assignments:Object.keys(s.defence.marks).filter(id=>s.players.some(p=>p.id===id&&p.population==='COURT')).length,advantage:d.advantage.level,shotQuality:r.shot?.quality??null});
    }}
    this.previous=now;this.phase=phaseOf(s);this.lastPhase=s.possession.phase;this.ownerKey=`${s.period}:${s.possession.id}`;
  };
  report(s:Readonly<CoreState>){
    const economy=possessionEconomy(s),alias=economy.integrity.continuationAliases,byState=structuredClone(this.byState);
    const exposures=economy.records.map(r=>{
      const times=[...this.attackTime.entries()].filter(([key])=>{const [period,...ids]=key.split(':');const id=ids.join(':');return +period===r.period&&(alias[id]??id)===r.canonicalId;}).map(([,v])=>v);
      const states:Record<string,number>={};for(const t of times)for(const[k,v]of Object.entries(t.states))states[k]=(states[k]??0)+v;
      const start=this.boundaries.findLast(b=>b.tick<=r.firstTick)?.state??this.boundaries[0].state;
      (byState[start]??=empty()).possessionsStarted++;
      const terminal=this.terminalStates.get(`${r.period}:${r.canonicalId}`)??start;if(r.loss)(byState[terminal]??=empty()).losses++;
      return{key:r.key,team:r.team,ending:r.ending,durationSeconds:r.durationSeconds,transitionSeconds:sum(times.map(t=>t.transitionMs))/1000,settledSeconds:sum(times.map(t=>t.settledMs))/1000,restartSeconds:sum(times.map(t=>t.restartMs))/1000,states,hasTransition:times.some(t=>t.transitionMs>0),passes:r.passesReleased,shots:r.shots,freeThrows:r.freeThrows,retainedRebounds:r.retainedRebounds};
    });
    return{complete:s.match?.phase==='FULLTIME'||s.status==='CHECKPOINT',definitions:{manpower:'HOME field players v AWAY field players; goalkeeper IDs and total legal body limits are separate. COURT includes physically entering/exiting exchange bodies; available field IDs exclude pending exchanges and medical ineligibility.',duration:'Intervals use the preceding actual canonical boundary. Official elapsed time and simulation elapsed time are separate.',events:'Events attributed to post-tick manpower; field conversion uses shot-release manpower for both attempts and resulting goals. A sanction event sees the reduced post-tick unit.',possessions:'Reuses possessionEconomy played episodes/aliases. Starts are exclusive; an episode may be exposed to several manpower states. No new possession is created by this observer.',environments:'Read-only canonical decideHandball at one-second tick samples while a field player controls a live ball. These are observations, not new decisions committed to the match.'},byState:Object.fromEntries(Object.entries(byState).map(([k,r])=>[k,{...r,fieldConversion:ratio(r.fieldGoals,r.fieldAttempts),possessionsExposed:exposures.filter(e=>Object.hasOwn(e.states,k)).length,attackDuration:distribution(exposures.filter(e=>Object.hasOwn(e.states,k)).map(e=>e.durationSeconds))}])),time:this.time,boundaries:this.boundaries,environments:this.environments,violations:this.violations,exposures,economy:{teams:economy.teams,integrity:economy.integrity},fouls:foulStructure(s)};
  }
}
