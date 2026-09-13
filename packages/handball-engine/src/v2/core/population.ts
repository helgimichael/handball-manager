import { actionAvailable,courtPlayers,getPlayer,otherTeam,record,uid,type CoreState,type TeamId } from './state';
import { startAction } from './actions';
import { distance } from './space';

export function exchangeActive(s:CoreState,id:string){return s.exchanges.some(e=>e.phase!=='COMPLETED'&&(e.outId===id||e.inId===id));}
export function courtLimit(s:CoreState,team:TeamId){return 7-s.players.filter(p=>p.team===team&&(p.population==='SUSPENDED'||p.population==='DISQUALIFIED'&&p.suspensionUntilMs!==null&&s.officialClock.timeMs<p.suspensionUntilMs)).length;}
export function requestExchange(s:CoreState,team:TeamId,outId:string|null,inId:string):boolean {
  const incoming=getPlayer(s,inId),outgoing=outId?getPlayer(s,outId):null;
  if(s.exchanges.some(e=>e.team===team&&e.phase!=='COMPLETED')||incoming.team!==team||incoming.population!=='BENCH'||(outgoing&&(outgoing.team!==team||outgoing.population!=='COURT'))||(!outgoing&&courtPlayers(s,team).length>=courtLimit(s,team)))return false;
  const gate={x:-.35,y:s.directions[team]==='TOP'?24:16};
  // Bench staging is off-court. Admission and court movement are separate transitions.
  incoming.position={...gate};incoming.velocity={x:0,y:0};incoming.action=null;
  s.exchanges.push({id:uid(s,'exchange'),team,outId,inId,phase:outgoing?'WAIT_EXIT':'ENTERING',gate,requestedTick:s.tick});
  record(s,'EXCHANGE_REQUESTED',outgoing,{incomingId:inId},[inId]);return true;
}
export function populationBefore(s:CoreState) {
  for(const p of s.players)if(p.population==='SUSPENDED'&&p.suspensionUntilMs!==null&&s.officialClock.timeMs>=p.suspensionUntilMs) {
    p.population='BENCH';p.suspensionUntilMs=null;record(s,'SUSPENSION_EXPIRED',p);
  }
  for(const team of ['HOME','AWAY'] as const) {
    const keeper=s.players.find(p=>p.team===team&&p.kind==='GOALKEEPER'),extra=s.players.find(p=>p.team===team&&p.role==='P2');
    if(keeper?.population==='BENCH'&&extra?.population==='COURT'&&(s.possession.team!==team||s.restart?.kind==='GOALKEEPER_THROW'&&s.restart.owner===team))requestExchange(s,team,extra.id,keeper.id);
    // Expired suspensions are permission to re-enter, not instant court teleportation.
    if(courtPlayers(s,team).length<courtLimit(s,team)) {
      const eligible=s.players.find(p=>p.team===team&&p.population==='BENCH'&&p.sanctions>0&&p.suspensionUntilMs===null);
      if(eligible)requestExchange(s,team,null,eligible.id);
    }
  }
  for(const e of s.exchanges.filter(e=>e.phase!=='COMPLETED')) {
    if(e.phase==='WAIT_EXIT') {
      const p=getPlayer(s,e.outId!);
      if(actionAvailable(p)&&s.ball.controllerId!==p.id) {
        if(p.airborne)startAction(s,p,'LAND','Complete the airborne action before leaving for substitution');
        else startAction(s,p,'EXCHANGE','Leave completely over own substitution line before replacement',e.gate);
      }
    } else {
      const p=getPlayer(s,e.inId);
      if(p.population==='BENCH'&&courtPlayers(s,e.team).length<courtLimit(s,e.team)) {
        if(courtPlayers(s).some(q=>distance(q.position,p.position)<q.radius+p.radius))continue;
        p.population='COURT';record(s,'SUBSTITUTE_ADMITTED',p,{exchangeId:e.id});
      }
      if(p.population==='COURT'&&actionAvailable(p))startAction(s,p,'EXCHANGE','Enter through own substitution line after outgoing player has left',{x:.65,y:e.gate.y});
    }
  }
}
export function populationAfter(s:CoreState) {
  for(const e of s.exchanges.filter(e=>e.phase!=='COMPLETED')) {
    if(e.phase==='WAIT_EXIT') {
      const p=getPlayer(s,e.outId!);
      if(p.position.x<=-p.radius&&p.action?.kind==='EXCHANGE') {
        p.population='BENCH';p.support=null;p.velocity={x:0,y:0};p.action.phase='COMPLETED';p.action.phaseTick=s.tick;e.phase='ENTERING';
        delete s.defence.marks[p.id];record(s,'PLAYER_LEFT_COURT',p,{exchangeId:e.id},[e.inId]);
      }
    } else {
      const p=getPlayer(s,e.inId);
      if(p.population==='COURT'&&p.position.x>=.6) {
        if(p.action){p.action.phase='COMPLETED';p.action.phaseTick=s.tick;}p.velocity={x:0,y:0};e.phase='COMPLETED';
        // Assign the vacated tactical role only for like-for-like field exchanges.
        const out=e.outId?getPlayer(s,e.outId):null;
        if(out?.kind==='FIELD_PLAYER'&&p.kind==='FIELD_PLAYER')p.role=out.role;
        s.defence.marks={};record(s,'EXCHANGE_COMPLETED',p,{exchangeId:e.id,role:p.role},e.outId?[e.outId]:[]);
      }
    }
  }
}
