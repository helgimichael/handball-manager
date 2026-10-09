import { getPlayer,otherTeam,record,type CoreState } from './state';
import { awardRestart } from './transitions';

/**
 * What counts as trying to attack. Each of these is a fact about the defence
 * having been put under a real problem, which is what the referee is watching
 * for and what a forward-facing run is not.
 */
// A screen is preparation and a rebound is the tail of a shot that already
// reset the clock; neither is an attempt on its own.
const THREATS=new Set(['SHOT_RELEASED','DEFENDER_BEATEN','FOUL']);
/** Seconds of no recognisable attempt before the arm goes up. */
const PASSIVE_IDLE_MS=18000;

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
    // A RECOGNISABLE ATTEMPT TO ATTACK (IHF 7:11) is something that happened to
    // the defence, not something the carrier felt. Reading it off the carrier's
    // forward velocity meant four hundred drives a match kept resetting the
    // clock while the attack created nothing, the idle timer never reached
    // eighteen seconds in a whole match, and attacks ran for seventy seconds
    // and twenty-three passes without a shot or a whistle.
    if(THREATS.has(e.type)||e.type==='FEINT_READ'&&e.details.wrongFooted===true)p.idleMs=0;
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
  // A break is never passive: the attack has not had the chance to be.
  if(s.possession.phase==='TRANSITION'){p.idleMs=0;return;}
  p.idleMs+=50;
  if(p.warnedTick===null&&p.idleMs>=PASSIVE_IDLE_MS&&s.possession.completedPasses>=4)
    showPassiveWarning(s,'No recognisable attempt to attack');
}
