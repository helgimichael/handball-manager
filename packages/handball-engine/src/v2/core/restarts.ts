import { goalAreaClearance } from '../../domain/geometry/goalArea';
import { actionAvailable,courtPlayers,getPlayer,otherTeam,record,type CorePlayer,type CoreState,type Point } from './state';
import { clamp,distance,fieldLegal,local,structurePoint,world,clearGoalArea,laneClearance } from './space';
import { startAction } from './actions';
import { acquire,awardRestart } from './transitions';
import { exchangeActive,requestExchange } from './population';
import { restartReady } from './rules';
import { isPivot } from './pivot';
import { laneMargin } from './timing';

const priority=['CB','LB','RB','P','LW','RW','P2'];
function chooseTaker(s:CoreState) {
  const r=s.restart!;
  const players=courtPlayers(s,r.owner).filter(p=>!exchangeActive(s,p.id));
  const holder=players.find(p=>p.id===s.ball.controllerId&&p.kind==='FIELD_PLAYER');
  if(holder&&(r.kind==='FREE_THROW'||r.kind==='THROW_IN'))return holder;
  return r.kind==='GOALKEEPER_THROW'?players.find(p=>p.kind==='GOALKEEPER'):players.filter(p=>p.kind==='FIELD_PLAYER').sort((a,b)=>priority.indexOf(a.role)-priority.indexOf(b.role)||a.id.localeCompare(b.id))[0];
}
export function restartTarget(s:CoreState,p:CorePlayer):Point {
  const r=s.restart!,direction=s.directions[r.owner],own=p.team===r.owner;
  if(p.id===r.takerId) {
    if(r.kind==='GOALKEEPER_THROW'&&goalAreaClearance(p.position,s.directions[otherTeam(p.team)])<-p.radius)return {...p.position};
    return {x:clamp(r.location.x,.35,19.65),y:clamp(r.location.y,.35,39.65)};
  }
  if(p.kind==='GOALKEEPER')return world({x:10,y:1.5},s.directions[otherTeam(p.team)]);
  let target=structurePoint(p.role,own?direction:s.directions[p.team]);
  if(r.kind==='CENTRE_THROW_OFF') {
    const x:Record<CorePlayer['role'],number>={LW:2,LB:5,CB:9,RB:14,RW:18,P:11,P2:16,GK:10};
    target=world({x:x[p.role],y:own?25+(p.role==='P'?2:0):15-(p.role==='P'?2:0)},direction);
  } else if(r.kind==='GOALKEEPER_THROW') {
    // A held save leaves the whole court where it really is. The named outlet
    // checks at its actual position; others run their first wave or retreat.
    if(p.id===r.receiverId)return {...p.position};
    const q=local(p.position,direction),depth=own?local(structurePoint(p.role,direction),direction).y:7.5;
    const advance=s.coaching[r.owner].tempo==='QUICK'?8:6;
    target=clearGoalArea(world({x:clamp(q.x,.7,19.3),y:Math.max(depth,q.y-advance)},direction),direction,p.radius+.1);
  } else {
    const q=local(target,direction);
    if(own)target=r.kind==='FREE_THROW'?clearGoalArea(target,direction,s.ruleProfile.restartDistance+p.radius+.3):world({x:q.x,y:Math.max(9.7,q.y)},direction);
    else {const x:Record<CorePlayer['role'],number>={LW:2.5,LB:5.5,CB:8,RB:14.5,RW:17.5,P:11,P2:16,GK:10};target=world({x:x[p.role],y:r.kind==='SEVEN_METRE'?10.8:7.5},direction);}
    const takerCentre={x:clamp(r.location.x,.35,19.65),y:clamp(r.location.y,.35,39.65)};
    if(distance(target,takerCentre)<3.6){const q2=local(target,direction);target=world({x:q2.x,y:Math.max(6.6,local(r.location,direction).y+(own?3.8:-3.8))},direction);
      if(!own&&distance(target,takerCentre)<3.6)target=world({x:clamp(r.location.x+(r.location.x<10?3.8:-3.8),.5,19.5),y:Math.max(6.6,local(r.location,direction).y+3.8)},direction);
    }
  }
  return fieldLegal(target,p.radius)?target:{...p.position};
}
function moveToward(s:CoreState,p:CorePlayer,target:Point,reason:string) {
  if(!actionAvailable(p))return;
  if(distance(p.position,target)>.1)startAction(s,p,'REPOSITION',reason,target);
}
export function restartStep(s:CoreState) {
  const r=s.restart;if(!r||r.phase==='COMPLETED'||r.phase==='RELEASED')return;
  // A restart nobody can organise is a refereeing problem, not a dead match.
  //
  // Eighty seconds of preparation means two bodies have blocked each other out
  // of their legal positions and neither can move; a referee whistles the throw
  // anyway, or gives it to the other team for delaying. Failing the simulation
  // instead ended a whole match on it, which is the only way a complete 2x30
  // still failed to finish.
  if(s.tick-r.awardedTick-r.pausedTicks>1600) {
    record(s,'RESTART_UNRESOLVED',null,{kind:r.kind,owner:r.owner,ticks:s.tick-r.awardedTick});
    awardRestart(s,'FREE_THROW',otherTeam(r.owner),r.location,'Restart could not be organised',null,false);
    return;
  }
  if(r.phase==='AUTHORISED'&&r.authorisedTick!==null&&(s.tick-r.authorisedTick)*50>s.ruleProfile.maxHoldMs){s.status='FAILED';s.reason='Restart execution exceeded three seconds';record(s,'RESTART_FAILED',null,{reason:s.reason});return;}
  if(!r.takerId) {
    const taker=chooseTaker(s);
    if(!taker) {
      if(r.kind==='GOALKEEPER_THROW') {const g=s.players.find(p=>p.team===r.owner&&p.kind==='GOALKEEPER'&&p.population==='BENCH');const out=courtPlayers(s,r.owner).find(p=>p.role==='P2');if(g)requestExchange(s,r.owner,out?.id??null,g.id);}
      return;
    }
    r.takerId=taker.id;r.phase='PREPARING';record(s,'RESTART_PREPARATION',taker,{kind:r.kind});
  }
  const taker=getPlayer(s,r.takerId);
  if(taker.population!=='COURT'){r.takerId=null;r.collectorId=null;r.receiverId=null;return;}
  if(r.receiverId&&(r.receiverId===taker.id||getPlayer(s,r.receiverId).population!=='COURT'||exchangeActive(s,r.receiverId)))r.receiverId=null;
  if(!r.receiverId){
    // NOT THE LINE PLAYER. He stands inside the opposing defence with his back
    // to the ball; a restart is put into a player who can turn and organise
    // with it. He was receiving thirty-four restarts a match here, which was by
    // some distance the commonest reason the ball reached him at all.
    const candidates=courtPlayers(s,r.owner).filter(p=>p.kind==='FIELD_PLAYER'&&p.id!==taker.id&&!exchangeActive(s,p.id)&&
      !p.airborne&&!p.condition.unavailable&&!p.condition.exitRequired&&(r.kind==='GOALKEEPER_THROW'||!isPivot(p)));
    if(r.kind==='CENTRE_THROW_OFF'||r.kind==='GOALKEEPER_THROW') {
      const memory=s.offence.memory[r.owner],identity=s.coaching[r.owner].attackIdentity;
      const score=(p:CorePlayer)=>{
        if(r.kind==='GOALKEEPER_THROW') {
          const lane=laneMargin(s,taker.position,p.position,r.owner,10.5+3*taker.profile.passing).seconds;
          if(!fieldLegal(p.position,p.radius)||lane<=.05)return -Infinity;
          const gain=clamp((local(taker.position,s.directions[r.owner]).y-local(p.position,s.directions[r.owner]).y)/15,0,1);
          const wing=p.role==='LW'||p.role==='RW';
          return Math.min(lane,1)*.6+gain*.55+p.profile.handling*p.condition.energy*.4+(wing&&identity==='WIDTH'?.35:0)+
            (identity==='DIRECT'?gain*.2:0);
        }
        const target=restartTarget(s,p),length=distance(r.location,target),wing=p.role==='LW'||p.role==='RW';
        return Math.min(laneClearance(s,r.location,target,r.owner),3)*.45+p.profile.handling*p.condition.energy+(wing&&identity==='WIDTH'?.7:0)+
          (identity==='DIRECT'?Math.min(length,16)*.06:0)-Math.max(0,length-16)*.3-memory.outlets.filter(id=>id===p.id).length*.45;
      };
      candidates.sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id));
      r.receiverId=candidates[0]&&Number.isFinite(score(candidates[0]))?candidates[0].id:null;
      if(r.receiverId){memory.outlets.push(r.receiverId);if(memory.outlets.length>6)memory.outlets.shift();record(s,'ATTACK_OUTLET_SELECTED',taker,{receiverId:r.receiverId,kind:r.kind,identity});}
    }else{
      // A set restart is rebuilt from the backcourt, not from wherever the
      // alphabet happened to land.
      const rank=(p:CorePlayer)=>['CB','LB','RB','LW','RW'].indexOf(p.role);
      r.receiverId=candidates.sort((a,b)=>rank(a)-rank(b)||a.id.localeCompare(b.id))[0]?.id??null;
    }
  }
  if(!r.collectorId) {
    const inside=goalAreaClearance(s.ball.position,'TOP')<=0||goalAreaClearance(s.ball.position,'BOTTOM')<=0;
    const holder=s.ball.controllerId?getPlayer(s,s.ball.controllerId):null;
    const collector=holder?.team===r.owner?holder:inside?courtPlayers(s,r.owner).find(p=>p.kind==='GOALKEEPER'):taker;
    if(!collector)return;r.collectorId=collector.id;
  }
  const collector=getPlayer(s,r.collectorId);
  for(const p of courtPlayers(s)) {
    if(exchangeActive(s,p.id))continue;
    if(p.airborne&&actionAvailable(p)){startAction(s,p,'LAND','Land before restart preparation');continue;}
    if(p.id===collector.id&&s.ball.controllerId!==taker.id)continue;
    if(s.ball.flight&&(p.id===r.takerId||p.id===r.receiverId))continue;
    // THE GOALKEEPER SETS FOR A SEVEN-METRE. He walks to his line and takes his
    // stance there, waiting, which is the one moment in handball when the keeper
    // is ready before the ball moves. Being merely repositioned left him unable
    // to contest the throw at all: a save started from scratch needs four ticks
    // to become executing and the flight from seven metres lasts about six.
    if(r.kind==='SEVEN_METRE'&&p.kind==='GOALKEEPER'&&p.team!==r.owner) {
      const ownGoal=s.directions[otherTeam(p.team)];
      const stance=world({x:10,y:.8},ownGoal);
      if(distance(p.position,stance)>.35){moveToward(s,p,stance,'Take the line for the seven-metre throw');continue;}
      if(actionAvailable(p))startAction(s,p,'SAVE','Set on the line and read the thrower',stance);
      continue;
    }
    const target=restartTarget(s,p);
    if(p.id===taker.id)p.duty={kind:'RESTART_TAKER',targetId:null,sinceTick:r.awardedTick,reason:`Execute ${r.kind} from its lawful position`};
    moveToward(s,p,target,'Reach legal restart position through physical movement');
  }
  if(!s.ball.controllerId&&!s.ball.flight) {
    const target={x:clamp(s.ball.position.x,.35,19.65),y:clamp(s.ball.position.y,.35,39.65)};
    if(distance(collector.position,s.ball.position)<=.65&&collector.action?.kind==='RECEIVE'&&collector.action.phase==='EXECUTING')acquire(s,collector,s.ball.position,'Dead-ball retrieval');
    else if(actionAvailable(collector)) {
      if(distance(collector.position,s.ball.position)>.65)moveToward(s,collector,target,'Retrieve stopped ball before restarting');
      else startAction(s,collector,'RECEIVE','Physically gather the stopped ball');
    }
    return;
  }
  if(s.ball.controllerId===collector.id&&collector.id!==taker.id) {
    if(distance(collector.position,restartTarget(s,taker))<1) {
      moveToward(s,collector,restartTarget(s,collector),'Clear the taker location while retaining the dead ball');return;
    }
    if(distance(taker.position,restartTarget(s,taker))>.15)return;
    if(actionAvailable(taker))startAction(s,taker,'RECEIVE','Receive physical dead-ball return');
    if(actionAvailable(collector)&&taker.action?.kind==='RECEIVE'&&taker.action.phase==='EXECUTING')startAction(s,collector,'PASS','Return the dead ball to the designated restart taker',null,taker.id,null,'DEAD_BALL_RETURN');
    return;
  }
  if(s.ball.controllerId!==taker.id)return;
  moveToward(s,taker,restartTarget(s,taker),'Carry dead ball to lawful restart location');
  const receiver=r.receiverId?getPlayer(s,r.receiverId):null;
  if(receiver&&distance(receiver.position,restartTarget(s,receiver))<.1&&actionAvailable(receiver))startAction(s,receiver,'RECEIVE','Prepare receiving option before restart execution');
  if(r.phase==='PREPARING'&&distance(taker.position,restartTarget(s,taker))<.1&&actionAvailable(taker)) {
    r.plantedFoot={...r.location};
    if(restartReady(s)&&(r.kind==='SEVEN_METRE'||s.match?.phase==='FINAL_THROW'||receiver?.action?.kind==='RECEIVE'&&receiver.action.phase==='EXECUTING')) {r.phase='AUTHORISED';r.authorisedTick=s.tick;taker.handling.heldSinceTick=s.tick;
      const timedRestart=s.referee.resumeOnWhistle;
      if(timedRestart){s.referee.resumeOnWhistle=false;s.officialClock.running=true;record(s,'OFFICIAL_CLOCK_RESTARTED',taker,{reason:'Restart whistle after time-out'});}
      if(s.match&&r.context==='OPENING_HALF'){s.officialClock.running=true;s.match.phase=s.period===1?'FIRST_HALF':'SECOND_HALF';s.match.periodStartMs=s.officialClock.timeMs;record(s,'PERIOD_STARTED',null,{period:s.period});}
      record(s,r.kind==='GOALKEEPER_THROW'&&!timedRestart?'RESTART_READY':'RESTART_AUTHORISED',taker,{kind:r.kind,whistle:r.kind!=='GOALKEEPER_THROW'||timedRestart});}
  }
  if(r.phase==='AUTHORISED'&&s.tick-r.authorisedTick!>=(r.kind==='GOALKEEPER_THROW'?0:6)&&actionAvailable(taker)) {
    if(r.kind==='SEVEN_METRE'||s.match?.phase==='FINAL_THROW')startAction(s,taker,'SHOOT','Execute authorised direct throw from planted foot',null,null,r.kind==='SEVEN_METRE'?'SEVEN_METRE':'STANDING');
    else if(r.receiverId){const receiver=getPlayer(s,r.receiverId);if(actionAvailable(receiver))startAction(s,receiver,'RECEIVE','Prepare reception of legal restart');
      if(receiver.action?.kind==='RECEIVE'&&receiver.action.phase==='EXECUTING')startAction(s,taker,'PASS','Execute lawful restart',null,receiver.id);}
  }
}
export function completeRestart(s:CoreState,evidence:string) {
  const r=s.restart;if(!r||r.phase==='COMPLETED')return;
  r.phase='COMPLETED';s.ball.live=true;
  s.possession.phase=r.kind==='CENTRE_THROW_OFF'||r.kind==='GOALKEEPER_THROW'?'TRANSITION':'ESTABLISHED';
  for(const p of courtPlayers(s))p.handling.heldSinceTick=s.tick;
  record(s,'RESTART_COMPLETED',r.takerId?getPlayer(s,r.takerId):null,{kind:r.kind,evidence});
}
