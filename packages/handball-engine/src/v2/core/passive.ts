import { getPlayer,otherTeam,record,type CoreState } from './state';
import { local } from './space';
import { awardRestart } from './transitions';

export type PassiveState={possessionId:string;idleMs:number;warnedTick:number|null;passes:number;extraPass:boolean;blockedReturn:boolean;eventsSeen:number};
export const initialPassive=():PassiveState=>({possessionId:'',idleMs:0,warnedTick:null,passes:0,extraPass:false,blockedReturn:false,eventsSeen:0});
function reset(s:CoreState,reason:string) {
  const p=s.referee.passive;
  if(p.warnedTick!==null)record(s,'PASSIVE_WARNING_CANCELLED',null,{reason});
  p.idleMs=0;p.warnedTick=null;p.passes=0;p.extraPass=false;p.blockedReturn=false;
}
export function showPassiveWarning(s:CoreState,reason:string) {
  const p=s.referee.passive;if(p.warnedTick!==null||s.status!=='RUNNING'||!s.ball.live||!s.ball.controllerId||!s.officialClock.running)return false;
  p.possessionId=s.possession.id;p.warnedTick=s.tick;p.passes=0;p.extraPass=false;p.eventsSeen=s.events.length;
  record(s,'PASSIVE_WARNING',s.ball.controllerId?getPlayer(s,s.ball.controllerId):null,{reason,maximumPasses:4});
  return true;
}
/** Warning timing is an observation model; the post-warning pass budget follows IHF 7:12. */
export function passiveAfter(s:CoreState) {
  const p=s.referee.passive;
  if(p.possessionId!==s.possession.id){reset(s,'New possession');p.possessionId=s.possession.id;p.eventsSeen=s.events.length;}
  const through=s.events.length;
  for(let i=p.eventsSeen;i<through;i++) {
    const e=s.events[i],actor=e.actorId?s.players.find(a=>a.id===e.actorId):null;
    if(['WARNING','TWO_MINUTE_SUSPENSION','DISQUALIFICATION'].includes(e.type)&&actor?.team===otherTeam(s.possession.team))reset(s,'Defending team personal punishment');
    if(e.type==='SAVE_PARRY'||e.type==='SAVE_CAUGHT'||e.type==='GOAL')reset(s,'Shot reached goalkeeper or goal');
    if(p.warnedTick===null)continue;
    if(e.type==='SHOT_BLOCKED')p.blockedReturn=true;
    if(e.type==='BALL_OUT')p.blockedReturn=false;
    if(e.type==='RESTART_AWARDED'&&e.details.owner===s.possession.team&&['FREE_THROW','THROW_IN','GOALKEEPER_THROW'].includes(String(e.details.kind))&&p.passes>=4)p.extraPass=true;
    // A blocked fourth-pass shot returned to attack has the same extra-pass exception.
    if(e.type==='REBOUND_CONTROLLED'&&p.blockedReturn&&p.passes>=4){p.blockedReturn=false;p.extraPass=true;continue;}
    if(e.type==='PASS_RECEIVED'||e.type==='REBOUND_CONTROLLED'&&p.blockedReturn) {
      p.blockedReturn=false;p.passes++;
      record(s,'PASSIVE_PASS_COUNT',actor,{passes:p.passes,extraPass:p.extraPass});
      if(p.passes>4) {
        if(p.extraPass){p.extraPass=false;continue;}
        record(s,'PASSIVE_PLAY',actor,{passes:p.passes});
        awardRestart(s,'FREE_THROW',otherTeam(s.possession.team),s.ball.position,'Passive play after pass allowance');break;
      }
    }
  }
  p.eventsSeen=s.events.length;
  if(s.status!=='RUNNING'||!s.ball.live||!s.officialClock.running||!s.ball.controllerId)return;
  const a=getPlayer(s,s.ball.controllerId),forward=(s.directions[a.team]==='TOP'?-1:1)*a.velocity.y;
  const threat=a.action?.phase==='EXECUTING'&&['DRIVE','DRIBBLE'].includes(a.action.kind)&&forward>.8&&(s.possession.phase==='TRANSITION'||local(a.position,s.directions[a.team]).y<15);
  p.idleMs=threat?Math.max(0,p.idleMs-100):p.idleMs+50;
  if(p.warnedTick===null&&p.idleMs>=18000&&s.possession.completedPasses>=4&&!threat)
    showPassiveWarning(s,'Repeated circulation without a directed change of pace');
}
