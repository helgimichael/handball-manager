import { courtPlayers,getPlayer,record,uid,type CorePlayer,type CoreState,type Point,type TeamId } from './state';
import { courtLimit } from './population';
import { distance } from './space';
import { awardRestart,interrupt } from './transitions';
import { initialPassive,type PassiveState } from './passive';
import type { Severity } from './sanction';

export type FoulCase={id:string;attackerId:string;defenderId:string;team:TeamId;location:Point;tick:number;contestId:string;severe:boolean;clearChance:boolean;severity:Severity;reason:string;whistled?:boolean};
export type RefereeState={
  advantage:(FoulCase&{expiresTick:number})|null;
  sanctions:FoulCase[];
  timeout:{untilTick:number;wasRunning:boolean;reason:string}|null;
  resumeOnWhistle:boolean;
  passive:PassiveState;
  teamTimeouts:Record<TeamId,number[]>;
};
export const initialReferee=():RefereeState=>({advantage:null,sanctions:[],timeout:null,resumeOnWhistle:false,passive:initialPassive(),teamTimeouts:{HOME:[],AWAY:[]}});

/** Base IHF 2:10 profile: one one-minute team time-out per half. */
export function requestTeamTimeout(s:CoreState,team:TeamId):boolean {
  if(s.status!=='RUNNING'||!s.match||!['FIRST_HALF','SECOND_HALF'].includes(s.match.phase)||s.referee.timeout||s.referee.resumeOnWhistle||s.possession.team!==team||
    s.referee.teamTimeouts[team].includes(s.period)||s.officialClock.timeMs-s.match.periodStartMs>=s.match.periodLengthMs)return false;
  const wasRunning=s.officialClock.running;
  if(s.ball.live)awardRestart(s,'FREE_THROW',team,s.ball.position,'Team time-out',null,false);
  else if(s.restart){for(const p of s.players)interrupt(s,p,'Team time-out');s.restart.phase='PREPARING';s.restart.authorisedTick=null;}
  s.referee.teamTimeouts[team].push(s.period);
  s.referee.timeout={untilTick:s.tick+1200,wasRunning,reason:'TEAM_TIMEOUT'};
  s.officialClock.running=false;record(s,'TEAM_TIMEOUT_STARTED',null,{team,period:s.period,durationMs:60000});return true;
}

/** Administrative duration is a simulation choice; stopping the clock is mandatory. */
function sanctionTimeout(s:CoreState) {
  if(s.referee.timeout)return;
  s.referee.timeout={untilTick:s.tick+40,wasRunning:s.officialClock.running,reason:'PERSONAL_SANCTION'};
  s.officialClock.running=false;record(s,'OFFICIAL_TIMEOUT_STARTED',null,{reason:'PERSONAL_SANCTION'});
}
/**
 * CONTACT AND PUNISHMENT: only an infringement that earns a personal
 * punishment receives one.
 *
 * ORDINARY never escalates, however many of them a team commits, which is the
 * whole correction. A team that defends hard and legally all match is not
 * progressively disqualified for it. Escalation applies to PUNISHABLE and
 * above, and it is per player first: a defender who has already been warned is
 * suspended for his next punishable foul, and a team that has spent its
 * warnings loses the benefit for punishable fouls only.
 */
function punish(s:CoreState,f:FoulCase,group:readonly FoulCase[]=[f]) {
  if(f.severity==='ORDINARY')return;
  const d=getPlayer(s,f.defenderId);
  const grouped:Record<string,string|number|boolean>=group.length>1?{disciplineCases:group.length,disciplineFoulIds:group.map(c=>c.id).join('|')}:{};
  let suspend=f.severity==='SERIOUS'||f.severity==='CLEAR_CHANCE'&&f.severe;
  if(!suspend) {
    const teamWarnings=s.players.filter(p=>p.team===d.team).reduce((n,p)=>n+p.warnings,0);
    suspend=d.warnings>0||d.sanctions>0||teamWarnings>=3;
    if(!suspend){d.warnings++;record(s,'WARNING',d,{reason:f.reason,foulId:f.id,severity:f.severity,...grouped},[f.attackerId],f.contestId);}
  }
  if(suspend) {
    d.sanctions++;d.population=d.sanctions>=3?'DISQUALIFIED':'SUSPENDED';d.suspensionUntilMs=s.officialClock.timeMs+s.ruleProfile.suspensionMs;
    interrupt(s,d,'Personal sanction');d.support=null;d.zone=null;
    record(s,d.sanctions>=3?'DISQUALIFICATION':'TWO_MINUTE_SUSPENSION',d,{foulId:f.id,severity:f.severity,reason:f.reason,...grouped},[f.attackerId],f.contestId);sanctionTimeout(s);
    reduceCourt(s,d.team);
  }
}
/** A deferred (advantage) sanction can land on a player who has since been
 * substituted off. The team is still reduced for the suspension, so a court
 * field player leaves during the sanction timeout: never the ball carrier or a
 * player in the air, preferring the suspended player's role, then the most tired. */
function reduceCourt(s:CoreState,team:TeamId) {
  while(courtPlayers(s,team).length>courtLimit(s,team)) {
    const suspended=s.players.filter(p=>p.team===team&&p.population!=='COURT'&&p.population!=='BENCH').map(p=>p.role);
    const out=courtPlayers(s,team).filter(p=>p.kind==='FIELD_PLAYER'&&s.ball.controllerId!==p.id&&!p.airborne)
      .sort((a,b)=>Number(suspended.includes(b.role))-Number(suspended.includes(a.role))||a.condition.energy-b.condition.energy||a.id.localeCompare(b.id))[0];
    if(!out)return;
    interrupt(s,out,'Team reduced for a personal sanction');
    for(const e of s.exchanges)if(e.phase==='WAIT_EXIT'&&e.outId===out.id){e.phase='CANCELLED';record(s,'EXCHANGE_CANCELLED',out,{exchangeId:e.id,reason:'Outgoing player removed for a personal sanction'});}
    out.population='BENCH';out.support=null;out.zone=null;out.velocity={x:0,y:0};out.position={x:-.35,y:s.directions[team]==='TOP'?24:16};
    delete s.defence.marks[out.id];record(s,'PLAYER_LEFT_COURT',out,{reason:'Team reduced for a personal sanction'});
  }
}
/** Resolve unannounced personal discipline once per player at this stoppage.
 * Otherwise the first deferred case manufactures a new warning/suspension
 * against which the second case is immediately escalated before play resumes.
 * Physical infringements remain separate facts; no post-sanction misconduct
 * producer (and thus no additional four-minute exception) exists in this core.
 */
function punishBatch(s:CoreState,cases:readonly FoulCase[]) {
  const groups=new Map<string,FoulCase[]>();
  for(const f of cases){const group=groups.get(f.defenderId)??[];if(!group.some(c=>c.id===f.id))group.push(f);groups.set(f.defenderId,group);}
  const rank=(f:FoulCase)=>f.severity==='SERIOUS'||f.severity==='CLEAR_CHANCE'&&f.severe?2:f.severity==='ORDINARY'?0:1;
  for(const group of groups.values()){
    const chosen=group.reduce((a,b)=>rank(b)>rank(a)||rank(b)===rank(a)&&b.tick<a.tick?b:a);
    punish(s,chosen,group);
  }
}
function whistle(s:CoreState,f:FoulCase,reason:string,additional:readonly FoulCase[]=[]) {
  if(f.whistled)return;
  f.whistled=true;
  const kind=f.clearChance?'SEVEN_METRE':'FREE_THROW';
  // Assessment is not a stoppage. This is the actual single transition which
  // stops the protected attack and awards its restart, linked to its evidence.
  record(s,'WHISTLE_RESTART',getPlayer(s,f.defenderId),{foulId:f.id,kind,owner:f.team,reason,assessedTick:f.tick},[f.attackerId],f.contestId);
  punishBatch(s,[...s.referee.sanctions.splice(0),f,...additional]);
  awardRestart(s,kind,f.team,f.location,reason,getPlayer(s,f.defenderId));
}
/** A physical foul and the decision to stop play are separate transitions (IHF 13:2, 14:2). */
export function judgeFoul(s:CoreState,a:CorePlayer,d:CorePlayer,severity:Severity,reason:string,clearChance:boolean,contestId:string) {
  if(severity==='LEGAL')return;
  const f:FoulCase={id:uid(s,'foul'),attackerId:a.id,defenderId:d.id,team:a.team,location:{...a.position},tick:s.tick,contestId,
    severe:severity==='SERIOUS',clearChance,severity,reason};
  const continuing=s.ball.live&&s.ball.controllerId===a.id&&severity!=='SERIOUS'&&!a.airborne&&
    a.action?.phase==='EXECUTING'&&['DRIVE','DRIBBLE','SHOOT','PASS'].includes(a.action.kind)&&(clearChance||severity!=='ORDINARY'||a.action.kind==='SHOOT'||a.action.kind==='PASS'||d.beatenUntilTick>s.tick||a.handling.steps===0&&!a.handling.dribbleUsed);
  const pending=continuing&&!s.referee.advantage;
  const decision=pending?'ADVANTAGE_PENDING':s.referee.advantage?'RECALL_PENDING_ADVANTAGE':'WHISTLE_NOW';
  // Retain FOUL for old readers, with its exact assessment meaning. A second
  // infringement which recalls an existing advantage has not itself received
  // a new pending advantage, even when the carrier was still moving.
  record(s,'FOUL',d,{clearChance,severity,reason,advantage:pending,foulId:f.id},[a.id],contestId);
  record(s,'FOUL_ASSESSED',d,{foulId:f.id,clearChance,severity,reason,decision,physicalContactId:contestId},[a.id],contestId);
  if(s.referee.advantage){recallAdvantage(s,'Further infringement ended the protected opportunity',[f]);return;}
  if(continuing&&s.ball.live) {
    s.referee.advantage={...f,expiresTick:s.tick+40};
    record(s,'ADVANTAGE_PENDING',a,{foulId:f.id,clearChance},[d.id],contestId);return;
  }
  whistle(s,f,reason);
}
export function recallAdvantage(s:CoreState,reason:string,additional:readonly FoulCase[]=[]) {
  const f=s.referee.advantage;if(!f)return;s.referee.advantage=null;
  record(s,'ADVANTAGE_RECALLED',getPlayer(s,f.attackerId),{foulId:f.id,reason},[f.defenderId],f.contestId);
  whistle(s,f,reason,additional);
}
function realiseAdvantage(s:CoreState,evidence:string) {
  const f=s.referee.advantage;if(!f)return;s.referee.advantage=null;s.referee.sanctions.push(f);
  record(s,'ADVANTAGE_REALIZED',getPlayer(s,f.attackerId),{foulId:f.id,evidence},[f.defenderId],f.contestId);
}
/** Called after physical resolution, so a missed shot is not retroactively a lost opportunity. */
export function refereeAfter(s:CoreState) {
  const f=s.referee.advantage;
  if(f) {
    const a=getPlayer(s,f.attackerId),flight=s.ball.flight;
    const shot=flight?.kind==='SHOT'&&flight.fromId===a.id;
    const passed=flight?.kind==='PASS'&&flight.fromId===a.id;
    const progressed=s.ball.controllerId===a.id&&distance(a.position,f.location)>1.5;
    const retained=s.tick>=f.expiresTick&&s.ball.controllerId===a.id&&s.ball.live;
    if(shot||passed||progressed||retained)realiseAdvantage(s,shot?'CONTROLLED_SHOT_RELEASE':passed?'CONTROLLED_PASS_RELEASE':retained?'RETAINED_BALL_AND_BODY_CONTROL':'CONTROLLED_CONTINUATION');
    else if(!s.ball.live||s.possession.team!==f.team||s.ball.controllerId!==a.id||
      (s.match&&s.officialClock.timeMs-s.match.periodStartMs>=s.match.periodLengthMs))recallAdvantage(s,'Original opportunity was not recovered under control');
  }
  if(!s.ball.live&&s.referee.sanctions.length) {
    punishBatch(s,s.referee.sanctions.splice(0));
  }
}
export function refereeBefore(s:CoreState):boolean {
  const t=s.referee.timeout;if(!t)return false;
  if(s.tick<t.untilTick){if(s.restart)s.restart.pausedTicks++;if(t.reason==='TEAM_TIMEOUT'&&s.tick===t.untilTick-200)record(s,'TEAM_TIMEOUT_TEN_SECONDS',null);return true;}
  s.referee.timeout=null;
  s.referee.resumeOnWhistle=t.wasRunning&&(!s.match||s.match.phase==='FIRST_HALF'||s.match.phase==='SECOND_HALF');
  record(s,'OFFICIAL_TIMEOUT_ENDED',null,{reason:t.reason});return false;
}
