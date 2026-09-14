import { getPlayer,record,uid,type CorePlayer,type CoreState,type Point,type TeamId } from './state';
import { distance } from './space';
import { awardRestart,interrupt } from './transitions';
import { initialPassive,type PassiveState } from './passive';

export type FoulCase={id:string;attackerId:string;defenderId:string;team:TeamId;location:Point;tick:number;contestId:string;severe:boolean;clearChance:boolean};
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
function punish(s:CoreState,f:FoulCase) {
  const d=getPlayer(s,f.defenderId);let suspend=f.severe;
  if(!suspend) {
    const warnings=s.players.filter(p=>p.team===d.team).reduce((n,p)=>n+p.warnings,0);
    suspend=d.warnings>0||d.sanctions>0||warnings>=3;
    if(!suspend){d.warnings++;record(s,'WARNING',d,{reason:'Illegal body-directed stopping contact',foulId:f.id},[f.attackerId],f.contestId);}
  }
  if(suspend) {
    d.sanctions++;d.population=d.sanctions>=3?'DISQUALIFIED':'SUSPENDED';d.suspensionUntilMs=s.officialClock.timeMs+s.ruleProfile.suspensionMs;
    interrupt(s,d,'Personal sanction');d.support=null;
    record(s,d.sanctions>=3?'DISQUALIFICATION':'TWO_MINUTE_SUSPENSION',d,{foulId:f.id},[f.attackerId],f.contestId);sanctionTimeout(s);
  }
}
function whistle(s:CoreState,f:FoulCase,reason:string) {
  punish(s,f);
  awardRestart(s,f.clearChance?'SEVEN_METRE':'FREE_THROW',f.team,f.location,reason,getPlayer(s,f.defenderId));
}
/** A physical foul and the decision to stop play are separate transitions (IHF 13:2, 14:2). */
export function judgeFoul(s:CoreState,a:CorePlayer,d:CorePlayer,severe:boolean,clearChance:boolean,contestId:string) {
  const f:FoulCase={id:uid(s,'foul'),attackerId:a.id,defenderId:d.id,team:a.team,location:{...a.position},tick:s.tick,contestId,severe,clearChance};
  const continuing=s.ball.live&&s.ball.controllerId===a.id&&!severe&&!a.airborne&&clearChance&&
    a.action?.phase==='EXECUTING'&&['DRIVE','DRIBBLE','SHOOT','PASS'].includes(a.action.kind);
  record(s,'FOUL',d,{clearChance,severe,advantage:continuing,foulId:f.id},[a.id],contestId);
  if(s.referee.advantage){recallAdvantage(s,'Further infringement ended the protected opportunity');punish(s,f);return;}
  if(continuing&&s.ball.live) {
    s.referee.advantage={...f,expiresTick:s.tick+40};
    record(s,'ADVANTAGE_PENDING',a,{foulId:f.id,clearChance},[d.id],contestId);return;
  }
  whistle(s,f,'Illegal stopping contact');
}
export function recallAdvantage(s:CoreState,reason:string) {
  const f=s.referee.advantage;if(!f)return;s.referee.advantage=null;
  record(s,'ADVANTAGE_RECALLED',getPlayer(s,f.attackerId),{foulId:f.id,reason},[f.defenderId],f.contestId);
  whistle(s,f,reason);
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
    const cases=s.referee.sanctions.splice(0);for(const f of cases)punish(s,f);
  }
}
export function refereeBefore(s:CoreState):boolean {
  const t=s.referee.timeout;if(!t)return false;
  if(s.tick<t.untilTick){if(s.restart)s.restart.pausedTicks++;if(t.reason==='TEAM_TIMEOUT'&&s.tick===t.untilTick-200)record(s,'TEAM_TIMEOUT_TEN_SECONDS',null);return true;}
  s.referee.timeout=null;
  s.referee.resumeOnWhistle=t.wasRunning&&(!s.match||s.match.phase==='FIRST_HALF'||s.match.phase==='SECOND_HALF');
  record(s,'OFFICIAL_TIMEOUT_ENDED',null,{reason:t.reason});return false;
}
