import { actionAvailable,courtPlayers,getPlayer,otherTeam,record,uid,type CoreState,type TeamId } from './state';
import { startAction } from './actions';
import { distance } from './space';

export function exchangeActive(s:CoreState,id:string){return s.exchanges.some(e=>e.phase!=='COMPLETED'&&e.phase!=='CANCELLED'&&(e.outId===id||e.inId===id));}
export function courtLimit(s:CoreState,team:TeamId){return 7-s.players.filter(p=>p.team===team&&(p.population==='SUSPENDED'||p.population==='DISQUALIFIED'&&p.suspensionUntilMs!==null&&s.officialClock.timeMs<p.suspensionUntilMs)).length;}
/** A keeper swap removes the old keeper; a field exchange cannot add a second. */
function keeperConflict(s:CoreState,incoming:CoreState['players'][number],outId:string|null){return incoming.kind==='GOALKEEPER'&&s.players.some(p=>p.team===incoming.team&&p.population==='COURT'&&p.kind==='GOALKEEPER'&&p.id!==incoming.id&&p.id!==outId);}
export function requestExchange(s:CoreState,team:TeamId,outId:string|null,inId:string):boolean {
  const incoming=getPlayer(s,inId),outgoing=outId?getPlayer(s,outId):null;
  if(s.status!=='RUNNING'||s.exchanges.some(e=>e.team===team&&e.phase!=='COMPLETED'&&e.phase!=='CANCELLED')||incoming.team!==team||incoming.population!=='BENCH'||incoming.condition.unavailable||incoming.condition.exitRequired||incoming.condition.attacksRemaining>0||keeperConflict(s,incoming,outId)||(outgoing&&(outgoing.team!==team||outgoing.population!=='COURT'))||(!outgoing&&courtPlayers(s,team).length>=courtLimit(s,team)))return false;
  const gate={x:-.35,y:s.directions[team]==='TOP'?24:16};
  // Bench staging is off-court. Admission and court movement are separate transitions.
  incoming.position={...gate};incoming.velocity={x:0,y:0};incoming.action=null;
  delete incoming.handballIntent;delete incoming.carrierRead;delete incoming.reentryReadTicks;delete incoming.motion;
  s.exchanges.push({id:uid(s,'exchange'),team,outId,inId,phase:outgoing?'WAIT_EXIT':'ENTERING',gate,requestedTick:s.tick});
  record(s,'EXCHANGE_REQUESTED',outgoing,{incomingId:inId},[inId]);return true;
}
export function populationBefore(s:CoreState) {
  for(const e of s.exchanges.filter(e=>e.phase!=='COMPLETED'&&e.phase!=='CANCELLED')) {
    const incoming=getPlayer(s,e.inId),outgoing=e.outId?getPlayer(s,e.outId):null;
    if(incoming.condition.unavailable||incoming.condition.attacksRemaining>0||['SUSPENDED','DISQUALIFIED'].includes(incoming.population)||keeperConflict(s,incoming,e.outId)||e.phase==='WAIT_EXIT'&&outgoing?.population!=='COURT') {
      e.phase='CANCELLED';record(s,'EXCHANGE_CANCELLED',outgoing,{exchangeId:e.id,reason:'Eligibility changed before exchange completed'});
    }
  }
  for(const p of s.players)if(p.population==='SUSPENDED'&&p.suspensionUntilMs!==null&&s.officialClock.timeMs>=p.suspensionUntilMs) {
    p.population='BENCH';p.suspensionUntilMs=null;p.condition.attacksRemaining=0;record(s,'SUSPENSION_EXPIRED',p);
  }
  for(const team of ['HOME','AWAY'] as const) {
    const medical=courtPlayers(s,team).find(p=>p.condition.exitRequired);
    if(medical){const replacement=s.players.filter(p=>p.team===team&&p.population==='BENCH'&&p.kind===medical.kind&&!p.condition.unavailable&&!p.condition.exitRequired&&!p.condition.attacksRemaining).sort((a,b)=>Number(b.role===medical.role)-Number(a.role===medical.role)||a.id.localeCompare(b.id))[0];if(replacement)requestExchange(s,team,medical.id,replacement.id);}
    const keeper=s.players.find(p=>p.team===team&&p.kind==='GOALKEEPER'),extra=s.players.find(p=>p.team===team&&p.role==='P2');
    if(keeper?.population==='BENCH'&&!courtPlayers(s,team).some(p=>p.kind==='GOALKEEPER')&&extra?.population==='COURT'&&(s.possession.team!==team||s.restart?.kind==='GOALKEEPER_THROW'&&s.restart.owner===team))requestExchange(s,team,extra.id,keeper.id);
    // Expired suspensions are permission to re-enter, not instant court teleportation.
    if(s.flow.continuous&&courtPlayers(s,team).length<courtLimit(s,team)) {
      const needsKeeper=!courtPlayers(s,team).some(p=>p.kind==='GOALKEEPER')&&s.flow.sevenVTeam!==team;
      const occupied=courtPlayers(s,team).map(p=>p.role);
      const missing=(['LW','LB','CB','RB','RW','P'] as const).find(role=>!occupied.includes(role));
      const eligible=s.players.filter(p=>p.team===team&&p.population==='BENCH'&&p.kind===(needsKeeper?'GOALKEEPER':'FIELD_PLAYER')&&p.suspensionUntilMs===null&&!p.condition.unavailable&&!p.condition.exitRequired&&!p.condition.attacksRemaining)
        .sort((a,b)=>Number(b.role===missing)-Number(a.role===missing)||Number(b.sanctions>0)-Number(a.sanctions>0)||b.condition.energy-a.condition.energy||a.id.localeCompare(b.id))[0];
      if(eligible&&requestExchange(s,team,null,eligible.id)&&!needsKeeper&&missing)eligible.role=missing;
    }
  }
  for(const e of s.exchanges.filter(e=>e.phase!=='COMPLETED'&&e.phase!=='CANCELLED')) {
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
  for(const e of s.exchanges.filter(e=>e.phase!=='COMPLETED'&&e.phase!=='CANCELLED')) {
    if(e.phase==='WAIT_EXIT') {
      const p=getPlayer(s,e.outId!);
      if(p.position.x<=-p.radius&&p.action?.kind==='EXCHANGE') {
        p.population='BENCH';p.condition.exitRequired=false;p.support=null;p.zone=null;p.velocity={x:0,y:0};p.action.phase='COMPLETED';p.action.phaseTick=s.tick;e.phase='ENTERING';
        delete s.defence.marks[p.id];record(s,'PLAYER_LEFT_COURT',p,{exchangeId:e.id},[e.inId]);
      }
    } else {
      const p=getPlayer(s,e.inId);
      if(p.population==='COURT'&&p.position.x>=.6) {
        if(p.action){p.action.phase='COMPLETED';p.action.phaseTick=s.tick;}p.velocity={x:0,y:0};p.zone=null;e.phase='COMPLETED';
        // Assign the vacated tactical role only for like-for-like field exchanges.
        const out=e.outId?getPlayer(s,e.outId):null;
        if(out?.kind==='FIELD_PLAYER'&&p.kind==='FIELD_PLAYER')p.role=out.role;
        if(out?.kind==='GOALKEEPER'&&p.kind==='FIELD_PLAYER'){p.role='P2';s.flow.sevenVTeam=p.team;}
        if(p.kind==='GOALKEEPER'&&s.flow.sevenVTeam===p.team)s.flow.sevenVTeam=null;
        s.defence.marks={};record(s,'EXCHANGE_COMPLETED',p,{exchangeId:e.id,role:p.role},e.outId?[e.outId]:[]);
      }
    }
  }
}
