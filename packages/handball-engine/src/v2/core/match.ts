import { createContinuous } from './continuous';
import type { SquadCharacter } from './profile';
import { courtPlayers,getPlayer,record,type CoreState,type Direction } from './state';
import { world } from './space';
import { awardRestart,interrupt } from './transitions';
import { requestExchange } from './population';
import { refereeAfter } from './referee';

export function createMatch(seed=2025,direction:Direction='TOP',periodLengthMs=1800000,halfBreakMs=600000,squads?:Record<'HOME'|'AWAY',SquadCharacter>):CoreState {
  if(!Number.isInteger(periodLengthMs)||periodLengthMs<1000||periodLengthMs%50||!Number.isInteger(halfBreakMs)||halfBreakMs<0||halfBreakMs%50)throw new Error('Invalid match timing');
  const s=createContinuous('CONTINUOUS_PLAY',seed,direction,null,squads);s.scenario='FULL_MATCH';s.checkpoint.maxTicks=Math.ceil((periodLengthMs*2+halfBreakMs)/50)+20000;
  // A complete match roster includes cover for every field role and the goalkeeper.
  for(const team of ['HOME','AWAY'] as const) {
    const prefix=team==='HOME'?'H':'A';
    for(const [i,role] of (['GK','LW','LB','RB','RW','P'] as const).entries()) {
      const p=structuredClone(s.players.find(p=>p.team===team&&p.role===role)!);
      p.id=`${prefix}${i+10}`;p.population='BENCH';p.position={x:-.35,y:direction==='TOP'?24:16};s.players.push(p);
    }
    s.coaching[team].rotation=true;s.coaching[team].timeouts=true;
  }
  s.match={phase:'PREMATCH',periodLengthMs,periodStartMs:0,resumeTick:0,halfBreakMs,outcomesAtHorn:0,coachingPlan:[]};s.officialClock.running=false;
  for(const team of ['HOME','AWAY'] as const){const prefix=team==='HOME'?'H':'A';s.match.coachingPlan.push(
    {team,outId:`${prefix}03`,inId:`${prefix}09`,atMs:periodLengthMs*.5,requested:false,sevenV:false},
    {team,outId:`${prefix}09`,inId:`${prefix}03`,atMs:periodLengthMs*1.5,requested:false,sevenV:false});}
  s.match.coachingPlan.push({team:'HOME',outId:'H07',inId:'H08',atMs:periodLengthMs*1.7,requested:false,sevenV:true});
  const xs:Record<string,number>={LW:2,LB:5,CB:10,RB:14,RW:18,P:11,P2:16};
  for(const p of courtPlayers(s))if(p.kind!=='GOALKEEPER')p.position=world({x:xs[p.role],y:p.team==='HOME'?(p.role==='CB'?20:p.role==='P'?27:25):(p.role==='P'?13:15)},direction);
  s.ball.position={...getPlayer(s,'H03').position};s.ball.controllerId='H03';
  awardRestart(s,'CENTRE_THROW_OFF','HOME',{x:10,y:20},'Opening half',null,false);s.restart!.context='OPENING_HALF';
  record(s,'MATCH_READY',null,{periodLengthMs});return s;
}
function finishPeriod(s:CoreState) {
  const m=s.match!;s.officialClock.running=false;
  for(const p of s.players)interrupt(s,p,'Period ended');
  s.ball.live=false;s.ball.mode='DEAD';s.ball.flight=null;
  refereeAfter(s);
  s.referee.timeout=null;s.referee.resumeOnWhistle=false;
  record(s,'PERIOD_ENDED',null,{period:s.period});
  if(s.period===2){m.phase='FULLTIME';s.status='CHECKPOINT';s.reason='FULLTIME';s.checkpoint.outcome='FULLTIME';record(s,'MATCH_FINISHED',null,{home:s.score.HOME,away:s.score.AWAY});return;}
  m.phase='HALFTIME';m.resumeTick=s.tick+m.halfBreakMs/50;record(s,'HALFTIME',null);
}
/** Returns true while the break owns the tick, with official time stopped. */
export function matchBefore(s:CoreState):boolean {
  const m=s.match;if(!m)return false;
  if(m.phase==='FIRST_HALF'||m.phase==='SECOND_HALF')for(const request of m.coachingPlan)if(!request.requested&&s.officialClock.timeMs>=request.atMs&&(!request.sevenV||s.possession.team===request.team&&s.ball.live)) {
    if(requestExchange(s,request.team,request.outId,request.inId)){request.requested=true;if(request.sevenV)s.flow.sevenVTeam=request.team;}
  }
  if(m.phase!=='HALFTIME')return false;
  if(s.tick<m.resumeTick)return true;
  s.period=2;s.directions={HOME:s.directions.HOME==='TOP'?'BOTTOM':'TOP',AWAY:s.directions.AWAY==='TOP'?'BOTTOM':'TOP'};
  for(const p of s.players)if(p.condition.attacksRemaining){p.condition.attacksRemaining=0;p.condition.treatmentPossession=null;record(s,'TREATMENT_ELIGIBILITY_RESTORED',p,{reason:'Second half begins'});}
  m.phase='PREMATCH';m.periodStartMs=s.officialClock.timeMs;
  awardRestart(s,'CENTRE_THROW_OFF','AWAY',{x:10,y:20},'Opening second half',null,false);s.restart!.context='OPENING_HALF';return false;
}
export function matchAfter(s:CoreState) {
  const m=s.match;if(!m||s.status!=='RUNNING')return;
  if(m.phase==='FINAL_THROW') {
    if(s.flow.outcomes>m.outcomesAtHorn||(s.restart?.phase==='COMPLETED'&&!s.ball.flight))finishPeriod(s);
    return;
  }
  if((m.phase==='FIRST_HALF'||m.phase==='SECOND_HALF')&&s.officialClock.timeMs-m.periodStartMs>=m.periodLengthMs) {
    s.officialClock.running=false;
    const r=s.restart;
    const release=s.events.findLast(e=>e.type==='RESTART_COMPLETED');
    const protectedThrow=r&&(r.kind==='FREE_THROW'||r.kind==='SEVEN_METRE')&&(r.phase!=='COMPLETED'||
      (s.ball.flight?.kind==='SHOT'&&s.ball.flight.fromId===r.takerId&&release?.tick===s.ball.flight.releasedTick));
    if(protectedThrow) {
      const kind=r.kind,owner=r.owner,location={...r.location};m.phase='FINAL_THROW';m.outcomesAtHorn=s.flow.outcomes;
      record(s,'PERIOD_HORN',null,{period:s.period,finalThrow:kind});awardRestart(s,kind,owner,location,'Throw retained or retaken after final signal',null,false);
    }else finishPeriod(s);
  }
}
export function matchReport(s:CoreState) {
  return {version:s.version,seed:s.seed,complete:s.match?.phase==='FULLTIME',status:s.status,reason:s.reason,score:{...s.score},officialMs:s.officialClock.timeMs,
    periods:s.events.filter(e=>e.type==='PERIOD_STARTED'||e.type==='PERIOD_ENDED').map(e=>({type:e.type,officialMs:e.officialMs,tick:e.tick})),
    shots:s.events.filter(e=>e.type==='SHOT_RELEASED').length,goals:s.events.filter(e=>e.type==='GOAL').length,passes:s.events.filter(e=>e.type==='PASS_RECEIVED').length,
    fouls:s.events.filter(e=>e.type==='FOUL').length,suspensions:s.events.filter(e=>e.type==='TWO_MINUTE_SUSPENSION').length,exchanges:s.exchanges.filter(e=>e.phase==='COMPLETED').length};
}
