import { goalAreaClearance } from '../../domain/geometry/goalArea';
import {GOAL_AREA_RADIUS_METERS,GOAL_POST_LEFT_X,GOAL_POST_RIGHT_X} from '../../domain/geometry/court';
import { CORE_VERSION, CORE_RULES, DT_MS, actionAvailable, courtPlayers, getPlayer, record, type CoreState, type CorePlayer, type Point } from './state';
import { clamp, clearGoalArea, distance, fieldLegal, goal, segmentPoint } from './space';
import { execute, handlingRules, resolveAction, startAction } from './actions';
import { coordinate, selectActions,resolveHandovers } from './structure';
import { advanceBall, resolveEffects, resolveScreens } from './interactions';
import { acquire, awardRestart } from './transitions';
import { restartStep } from './restarts';
import { populationBefore,populationAfter,exchangeActive,courtLimit } from './population';
import { matchBefore,matchAfter } from './match';
import { resolveContacts } from './contact';
import { ZONE_COUNT } from './defence';
import { refereeBefore,refereeAfter } from './referee';
import { passiveAfter } from './passive';
import { conditionAfter } from './condition';
import { coachingBefore } from './coaching';
import { offenceBefore,offenceAfter } from './offence';
import { secondsTo } from './timing';
import {transferDecisionTrace} from './intelligence';
import {regainedContainment} from './threatRelation';

function collectionPoint(s:CoreState,p:CorePlayer):Point|null {
  let target={x:clamp(s.ball.position.x,p.radius+.01,20-p.radius-.01),y:clamp(s.ball.position.y,p.radius+.01,40-p.radius-.01)};
  if(p.kind==='FIELD_PLAYER'){
    target=clearGoalArea(clearGoalArea(target,'TOP',p.radius+.01),'BOTTOM',p.radius+.01);
    if(!fieldLegal(target,p.radius)||distance(target,s.ball.position)>.65){
      // A vertical-only clearance can put a corner approach over a metre from
      // a ball which is reachable by stepping laterally around the curved D.
      // Project outward from the actual goal-line segment, then retain only a
      // legal body centre within the existing physical hand-contact distance.
      const candidates:Point[]=[];
      for(const side of ['TOP','BOTTOM'] as const){
        const point={x:clamp(s.ball.position.x,p.radius+.01,20-p.radius-.01),y:clamp(s.ball.position.y,p.radius+.01,40-p.radius-.01)};
        const anchor={x:clamp(point.x,GOAL_POST_LEFT_X,GOAL_POST_RIGHT_X),y:goal(side).y};
        const length=distance(point,anchor),radius=GOAL_AREA_RADIUS_METERS+p.radius+.01;
        if(length<radius&&length>1e-9){point.x=anchor.x+(point.x-anchor.x)*radius/length;point.y=anchor.y+(point.y-anchor.y)*radius/length;}
        point.x=clamp(point.x,p.radius+.01,20-p.radius-.01);point.y=clamp(point.y,p.radius+.01,40-p.radius-.01);
        if(fieldLegal(point,p.radius)&&distance(point,s.ball.position)<=.65)candidates.push(point);
      }
      target=candidates.sort((a,b)=>distance(a,s.ball.position)-distance(b,s.ball.position))[0];
      if(!target)return null;
    }
  }
  return target;
}
function collectionTime(s:CoreState,p:CorePlayer,target:Point):number {
  // Bodies affect the path as well as the final distance. This estimate charges
  // their actual lateral detour; the ordinary movement/collision code still
  // has to execute it, and the estimate never grants ball ownership.
  let detour=0;
  for(const body of courtPlayers(s)){
    if(body.id===p.id)continue;
    const hit=segmentPoint(p.position,target,body.position);
    if(hit.t>.05&&hit.t<.95)detour+=Math.max(0,(p.radius+body.radius)-distance(hit.point,body.position))*2;
  }
  return secondsTo(s,p,target)+detour/Math.max(.4,p.profile.topSpeed);
}
function approachLoose(s:CoreState,p:CorePlayer,target:Point,reason:string) {
  const near=distance(p.position,s.ball.position)<=.65;
  const action=p.action;
  if(action&&!actionAvailable(p)){
    if((action.kind==='RUN'||action.kind==='REPOSITION')&&action.target&&distance(p.position,action.target)<.35)
      resolveAction(s,p,'Reached the physical collection approach');
    else if(!near&&(action.kind==='RUN'||action.kind==='REPOSITION')){action.target={...target};return;}
    else if(action.kind==='RECEIVE'&&near)return;
    else {
      // Reaching with the hands is the next physical action. Discard a stale
      // stance or finished approach without erasing the momentum already built.
      action.phase='INTERRUPTED';action.phaseTick=s.tick;
      record(s,'ACTION_INTERRUPTED',p,{reason:'Loose ball requires a physical collection action'});
    }
  }
  if(actionAvailable(p))startAction(s,p,near?'RECEIVE':p.kind==='GOALKEEPER'?'REPOSITION':'RUN',reason,target);
}
function collectLoose(s:CoreState) {
  if(s.ball.mode!=='LOOSE')return;
  const active=courtPlayers(s);
  const eligible=(p:CorePlayer)=>!p.airborne&&!exchangeActive(s,p.id)&&!p.condition.unavailable&&!p.condition.exitRequired;
  const area=(['TOP','BOTTOM'] as const).find(side=>goalAreaClearance(s.ball.position,side)<=0);
  if(area){
    for(const p of active)if(p.duty.kind==='COLLECT')p.duty={kind:'WAIT',targetId:null,sinceTick:s.tick,reason:'Only the defending goalkeeper may recover inside this goal area'};
    const p=active.find(p=>p.kind==='GOALKEEPER'&&s.directions[p.team==='HOME'?'AWAY':'HOME']===area&&eligible(p));
    if(!p)return;
    p.duty={kind:'COLLECT',targetId:null,sinceTick:s.tick,reason:'Recover rebound inside own goal area'};
    if(distance(p.position,s.ball.position)<=.65&&p.action?.kind==='RECEIVE'&&p.action.phase==='EXECUTING'){
      acquire(s,p,s.ball.position,'Goalkeeper rebound control');awardRestart(s,'GOALKEEPER_THROW',p.team,p.position,'Keeper recovered rebound');return;
    }
    const target=collectionPoint(s,p);if(target)approachLoose(s,p,target,'Recover rebound in own goal area');
    return;
  }
  // A rebound is a race for a physical ball, not a permanent pivot assignment.
  // One reachable claimant per team; keep him when the alternative offers no
  // meaningful arrival advantage, so responsibility does not churn each tick.
  for(const team of ['HOME','AWAY'] as const) {
    const candidates=active.filter(p=>p.team===team&&p.kind==='FIELD_PLAYER'&&eligible(p)).flatMap(p=>{
      const target=collectionPoint(s,p);return target?[{p,target,time:collectionTime(s,p,target)}]:[];
    }).sort((a,b)=>a.time-b.time||a.p.id.localeCompare(b.p.id));
    const best=candidates[0],named=candidates.find(c=>c.p.duty.kind==='COLLECT');
    const choice=named&&best&&named.time<=best.time+.2?named:best;
    for(const p of active.filter(p=>p.team===team&&p.duty.kind==='COLLECT'&&p.id!==choice?.p.id))
      p.duty={kind:'WAIT',targetId:null,sinceTick:s.tick,reason:'A more reachable player owns rebound recovery'};
    if(!choice)continue;
    const claimant=choice.p;
    if(claimant.duty.kind!=='COLLECT')claimant.duty={kind:'COLLECT',targetId:null,sinceTick:s.tick,reason:'Reachable team-designated rebound claimant'};
    if(distance(claimant.position,s.ball.position)<=.65&&claimant.action?.phase==='EXECUTING'&&claimant.action.kind==='RECEIVE'){acquire(s,claimant,s.ball.position,'Loose-ball recovery');record(s,'REBOUND_CONTROLLED',claimant);return;}
    approachLoose(s,claimant,choice.target,'Recover physically reachable rebound');
  }
}
export function tickCore(previous:CoreState):CoreState {
  if(previous.status!=='RUNNING')return previous;
  const {events,contests,...body}=previous;
  const s:CoreState={...JSON.parse(JSON.stringify(body)),events:events.slice(),contests:contests.slice()};
  transferDecisionTrace(previous,s);
  return advanceCoreMutable(s);
}
/** For an exclusively-owned batch runner. UI/replay must use immutable tickCore. */
export function advanceCoreMutable(s:CoreState):CoreState {
  if(s.status!=='RUNNING')return s;
  advanceOneTick(s);refereeAfter(s);passiveAfter(s);conditionAfter(s);matchAfter(s);offenceAfter(s);return s;
}
function advanceOneTick(s:CoreState):CoreState {
  if(s.status!=='RUNNING')return s;
  s.tick++;s.timeMs=s.tick*DT_MS;if(s.officialClock.running)s.officialClock.timeMs+=DT_MS;
  if(s.tick>s.checkpoint.maxTicks){s.status='INCOMPLETE';s.reason='Scenario tick budget exhausted';record(s,'INCOMPLETE',null,{reason:s.reason});return s;}
  if(matchBefore(s))return s;
  coachingBefore(s);
  if(refereeBefore(s))return s;
  const carrier=s.ball.controllerId?getPlayer(s,s.ball.controllerId):null;
  const oldPosition=carrier?{...carrier.position}:null;
  populationBefore(s);
  if(s.ball.live) {
    // A real loose-ball encounter may change the team or award a keeper restart.
    // Allocate responsibilities and select only after that transition is known.
    collectLoose(s);if(s.status!=='RUNNING')return s;
    if(s.ball.live){
      const current=s.players.find(p=>p.id===s.ball.controllerId);
      if(current&&current.kind==='FIELD_PLAYER')for(const d of courtPlayers(s,current.team==='HOME'?'AWAY':'HOME')){
        if(d.kind==='FIELD_PLAYER'&&d.beatenUntilTick>s.tick&&d.screenedUntilTick<=s.tick&&d.wrongFootedUntilTick<=s.tick&&regainedContainment(current,d,goal(s.directions[current.team]))){
          d.beatenUntilTick=s.tick;d.beatenBy=null;
          record(s,'DEFENDER_RECOVERED',d,{reason:'Regained goal-side containment of the current ball carrier'},[current.id]);
        }
      }
      offenceBefore(s);coordinate(s);selectActions(s);
    }else restartStep(s);
  }else restartStep(s);
  if(s.status!=='RUNNING')return s;
  const effects=execute(s);
  resolveHandovers(s);
  populationAfter(s);
  if(carrier&&oldPosition&&s.ball.controllerId===carrier.id) {
    // Preserve the physical catch offset while the carrier moves; never snap to a target.
    s.ball.position={x:s.ball.position.x+carrier.position.x-oldPosition.x,y:s.ball.position.y+carrier.position.y-oldPosition.y};
  }
  handlingRules(s);if(s.status!=='RUNNING')return s;
  const wasLive=s.ball.live;
  // A beaten episode closes when the two players come apart, so the same man
  // can be beaten again later in the same attack by a genuinely new action.
  for(const d of courtPlayers(s)) {
    if(!d.beatenBy)continue;
    const by=s.players.find(p=>p.id===d.beatenBy);
    if(!by||by.population!=='COURT'||distance(by.position,d.position)>3||s.ball.controllerId!==by.id)d.beatenBy=null;
  }
  resolveScreens(s);resolveContacts(s);if(wasLive&&!s.ball.live)return s;
  resolveEffects(s,effects);if(s.status!=='RUNNING')return s;
  advanceBall(s);
  return s;
}
export function assertCore(s:CoreState) {
  const check=(c:unknown,m:string)=>{if(!c)throw new Error(`Core invariant: ${m}`);};
  check(s.version===CORE_VERSION,'version');check(Number.isInteger(s.tick)&&s.tick>=0&&s.timeMs===s.tick*DT_MS,'one chronology');
  check(s.ruleProfile&&Object.entries(CORE_RULES).every(([key,value])=>s.ruleProfile[key as keyof typeof CORE_RULES]===value),'supported rule profile');
  check(Number.isInteger(s.rng.state)&&s.rng.state>=0&&s.rng.state<=0xffffffff&&Number.isInteger(s.rng.draws),'persisted RNG');
  check(new Set(s.players.map(p=>p.id)).size===s.players.length,'unique identities');
  for(const team of ['HOME','AWAY'] as const){check(courtPlayers(s,team).length<=courtLimit(s,team),'court population');check(courtPlayers(s,team).filter(p=>p.kind==='GOALKEEPER').length<=1,'one goalkeeper per team');}
  for(const p of s.players) {
    check(p.condition&&Number.isFinite(p.condition.energy)&&p.condition.energy>=.3&&p.condition.energy<=1&&Number.isFinite(p.condition.distanceMetres)&&p.condition.distanceMetres>=0&&Number.isInteger(p.condition.attacksRemaining)&&p.condition.attacksRemaining>=0&&p.condition.attacksRemaining<=3,'player condition');
    check(Number.isFinite(p.position.x)&&Number.isFinite(p.position.y)&&Number.isFinite(p.velocity.x)&&Number.isFinite(p.velocity.y),'finite physical state');
    if(p.population==='COURT'&&p.kind==='FIELD_PLAYER'&&!p.airborne)check(fieldLegal(p.position,p.radius)||(exchangeActive(s,p.id)&&p.position.x>=-.4&&p.position.x<.65&&p.position.y>=15&&p.position.y<=25),'legal grounded position');
    if(p.action)check(p.action.startedTick<=p.action.phaseTick&&p.action.phaseTick<=s.tick,'action chronology');
    if(p.airborne)check(fieldLegal(p.airborne.takeoff,p.radius),'legal takeoff');
  }
  const active=courtPlayers(s);
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++)check(distance(active[i].position,active[j].position)>=active[i].radius+active[j].radius-1e-7,'bodies do not overlap');
  if(s.ball.controllerId) {const p=getPlayer(s,s.ball.controllerId);check(p.population==='COURT','controller on court');check(distance(s.ball.position,p.position)<=.86,'physical control');check(s.ball.flight===null,'exclusive control / flight');}
  if(s.ball.flight){check(s.ball.controllerId===null,'flight has no owner');check(s.ball.flight.releasedTick<=s.tick,'flight chronology');}
  check(Number.isFinite(s.ball.position.x)&&Number.isFinite(s.ball.position.y),'finite ball');
  if(s.restart&&s.restart.phase!=='COMPLETED')check(!s.ball.live,'restart gate');
  // COLLECTIVE DEFENCE: the structural claim is no longer that two defenders
  // never look at the same attacker -- a presser and his helper both look at
  // the carrier, which is what help IS. It is that the six spaces are owned
  // exactly once, which is what makes the line a line.
  const zones=courtPlayers(s,s.defence.team).filter(p=>p.kind==='FIELD_PLAYER'&&p.zone!==null).map(p=>p.zone);
  check(new Set(zones).size===zones.length,'each defensive space is owned exactly once');
  check(zones.every(z=>z!==null&&z>=0&&z<ZONE_COUNT),'defensive spaces exist on the line');
  check(courtPlayers(s).filter(p=>p.duty.kind==='PRESSURE').length<=1,'single primary pressure');
  check(courtPlayers(s).filter(p=>p.duty.kind==='HELP').length<=1,'single assigned helper');
  check(courtPlayers(s).filter(p=>p.duty.kind==='COVER').length<=1,'single assigned cover');
  s.events.forEach((e,i)=>{check(e.tick<=s.tick&&e.timeMs===e.tick*DT_MS,'event chronology');if(i)check(s.events[i-1].tick<=e.tick,'ordered events');});
  if(s.status==='CHECKPOINT')check(s.checkpoint.outcome!==null,'checkpoint has executed outcome');
}
