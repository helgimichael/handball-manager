import { goalAreaClearance } from '../../domain/geometry/goalArea';
import { CORE_VERSION, CORE_RULES, DT_MS, actionAvailable, courtPlayers, getPlayer, record, type CoreState } from './state';
import { distance, fieldLegal } from './space';
import { execute, handlingRules, startAction } from './actions';
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
function collectLoose(s:CoreState) {
  if(s.ball.mode!=='LOOSE')return;
  for(const p of courtPlayers(s).filter(p=>p.kind==='GOALKEEPER')) {
    const ownSide=s.directions[p.team==='HOME'?'AWAY':'HOME'];
    if(goalAreaClearance(s.ball.position,ownSide)>0)continue;
    if(distance(p.position,s.ball.position)<=.65&&p.action?.kind==='RECEIVE'&&p.action.phase==='EXECUTING'){
      acquire(s,p,s.ball.position,'Goalkeeper rebound control');awardRestart(s,'GOALKEEPER_THROW',p.team,p.position,'Keeper recovered rebound');return;
    }
    if(actionAvailable(p))startAction(s,p,distance(p.position,s.ball.position)>.65?'REPOSITION':'RECEIVE','Recover rebound in own goal area',s.ball.position);
  }
  // One claimant per team, selected by existing role responsibility before reachability.
  for(const team of ['HOME','AWAY'] as const) {
    const candidates=courtPlayers(s,team).filter(p=>p.kind==='FIELD_PLAYER');
    const named=candidates.find(p=>p.duty.kind==='COLLECT');
    const priority=['P','P2','CB','LB','RB','LW','RW'];
    const claimant=named??candidates.filter(p=>distance(p.position,s.ball.position)<8).sort((a,b)=>priority.indexOf(a.role)-priority.indexOf(b.role)||a.id.localeCompare(b.id))[0];
    if(!claimant)continue;
    claimant.duty={kind:'COLLECT',targetId:null,sinceTick:s.tick,reason:'Team-designated rebound claimant'};
    if(distance(claimant.position,s.ball.position)<=.65&&claimant.action?.phase==='EXECUTING'&&claimant.action.kind==='RECEIVE'){acquire(s,claimant,s.ball.position,'Loose-ball recovery');record(s,'REBOUND_CONTROLLED',claimant);return;}
    if(actionAvailable(claimant))startAction(s,claimant,distance(claimant.position,s.ball.position)>.65?'RUN':'RECEIVE','Recover physically reachable rebound',s.ball.position);
  }
}
export function tickCore(previous:CoreState):CoreState {
  if(previous.status!=='RUNNING')return previous;
  const {events,contests,...body}=previous;
  const s:CoreState={...JSON.parse(JSON.stringify(body)),events:events.slice(),contests:contests.slice()};
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
    if(s.ball.live){offenceBefore(s);coordinate(s);selectActions(s);}else restartStep(s);
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
