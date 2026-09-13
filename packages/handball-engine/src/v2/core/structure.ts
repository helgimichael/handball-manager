import { actionAvailable, courtPlayers, getPlayer, otherTeam, record, type CorePlayer, type CoreState, type Duty } from './state';
import { clamp, distance, goalSide, laneClearance, local, numericalAdvantage, shootingAngle, structurePoint, world } from './space';
import { driveTarget, startAction } from './actions';
import { exchangeActive } from './population';
import { goalAreaClearance } from '../../domain/geometry/goalArea';
import { planContact } from './contact';
import { isWing,wingRelationship,wingTakeoffWindow,defendWing } from './wing';

function assign(s:CoreState,p:CorePlayer,kind:Duty,targetId:string|null,reason:string) {
  if(s.ball.mode==='LOOSE'&&p.duty.kind==='COLLECT')return;
  if(p.duty.kind!==kind||p.duty.targetId!==targetId) {
    p.duty={kind,targetId,sinceTick:s.tick,reason};record(s,'RESPONSIBILITY_ASSIGNED',p,{kind,reason},targetId?[targetId]:[]);
  }
}
/** One coordinator allocates pressure/help/cover; reachability never creates a second primary. */
export function coordinate(s: CoreState) {
  const attacking=s.possession.team,defending=otherTeam(attacking),carrier=s.ball.controllerId?getPlayer(s,s.ball.controllerId):null;
  const attackers=courtPlayers(s,attacking).filter(p=>p.kind==='FIELD_PLAYER'),defenders=courtPlayers(s,defending).filter(p=>p.kind==='FIELD_PLAYER');
  const direction=s.directions[attacking];
  if(Object.keys(s.defence.marks).length===0) {
    const available=[...attackers];
    for(const d of defenders) {const index=available.findIndex(a=>a.role===d.role);const a=available.splice(index<0?0:index,1)[0];if(a)s.defence.marks[d.id]=a.id;}
  }
  // Pairwise backcourt crossing handover, with a durable lock and mutual exchange.
  if(!s.defence.handover&&s.tick-s.defence.lastHandoverTick>30) {
    const backs=defenders.filter(d=>['LB','CB','RB'].includes(d.role));
    outer:for(let i=0;i<backs.length;i++)for(let j=i+1;j<backs.length;j++) {
      const d1=backs[i],d2=backs[j],a1=s.players.find(p=>p.id===s.defence.marks[d1.id]),a2=s.players.find(p=>p.id===s.defence.marks[d2.id]);
      if(a1&&a2&&!d1.airborne&&!d2.airborne&&(a1.position.x-a2.position.x)*(d1.position.x-d2.position.x)<-.3&&distance(a1.position,a2.position)<5&&actionAvailable(d1)&&actionAvailable(d2)) {
        s.defence.lastHandoverTick=s.tick;
        startAction(s,d1,'HANDOVER','Exchange crossing responsibility with adjacent defender',null,a2.id);
        startAction(s,d2,'HANDOVER','Accept paired crossing handover',null,a1.id);
        s.defence.handover={defenderIds:[d1.id,d2.id],attackerIds:[a1.id,a2.id],actionIds:[d1.action!.id,d2.action!.id]};
        record(s,'HANDOVER_STARTED',d1,{},[d2.id,a1.id,a2.id]);break outer;
      }
    }
  }
  const primary=carrier?.team===attacking?(defenders.find(d=>s.defence.marks[d.id]===carrier.id)??(carrier.role==='P2'?defenders.find(d=>d.role==='P'):undefined)):null;
  const needHelp=!!carrier&&!!primary&&(primary.beatenUntilTick>s.tick||!goalSide(s,primary,carrier))&&local(carrier.position,direction).y<16;
  let helper=needHelp?s.players.find(p=>p.id===s.defence.helperId&&p.population==='COURT'&&p.beatenUntilTick<=s.tick):undefined;
  if(needHelp&&!helper) helper=defenders.filter(d=>d.id!==primary?.id&&d.role!=='P'&&d.beatenUntilTick<=s.tick&&goalSide(s,d,carrier!)).sort((a,b)=>Math.abs(a.position.x-carrier!.position.x)-Math.abs(b.position.x-carrier!.position.x)||a.id.localeCompare(b.id))[0];
  s.defence.pressureId=primary?.id??null;s.defence.helperId=needHelp?helper?.id??null:null;
  const lineRoles=['LW','LB','CB','RB','RW'];
  const cover=needHelp&&helper?defenders.filter(d=>d.id!==helper.id&&d.id!==primary?.id&&d.role!=='P'&&d.beatenUntilTick<=s.tick)
    .sort((a,b)=>Math.abs(lineRoles.indexOf(a.role)-lineRoles.indexOf(helper!.role))-Math.abs(lineRoles.indexOf(b.role)-lineRoles.indexOf(helper!.role))||a.id.localeCompare(b.id))[0]:undefined;
  for(const d of defenders) {
    const mark=s.defence.marks[d.id]??null;
    if(d.beatenUntilTick>s.tick)assign(s,d,'RECOVER',mark,'Beaten contest debt remains until recovery expires');
    else if(d.id===s.defence.helperId)assign(s,d,'HELP',carrier!.id,'Primary beaten or behind; one adjacent helper covers penetration');
    else if(d.id===cover?.id)assign(s,d,'COVER',s.defence.marks[helper!.id]??null,'Adjacent cover accepts the threat released by the helper');
    else if(d.id===primary?.id)assign(s,d,'PRESSURE',carrier!.id,'Primary matchup owns ball pressure');
    else if(s.possession.phase==='TRANSITION'&&local(d.position,direction).y>18)assign(s,d,'RETREAT',mark,'Recover goal-side before forming the defensive line');
    else assign(s,d,'MARK',mark,d.role==='P'?'Protect pivot and inside space':'Keep assigned attacker and protect inside lane');
  }
  for(const a of attackers) {
    if(a.id===carrier?.id)assign(s,a,'CARRIER',null,'Create advantage while respecting handling budget');
    else if(s.possession.phase==='TRANSITION')assign(s,a,['LB','RB','LW','RW'].includes(a.role)?'FIRST_WAVE':'SECOND_WAVE',null,'Offer width or trailing continuation in transition');
    else if(isWing(a)){const relation=wingRelationship(s,a);assign(s,a,relation.mode==='PIN_CORNER'?'WING_PIN':'WING_OFFER',relation.back?.id??null,relation.reason);}
    else assign(s,a,a.role==='P'||a.role==='P2'?'PIVOT':'CONNECT',null,'Maintain role relationships and move with the ball-side structure');
  }
  for(const p of courtPlayers(s).filter(p=>p.kind==='GOALKEEPER'))assign(s,p,'GOALKEEPER',null,'Protect own goal; commit only after reading a released shot');
  if(s.possession.phase==='TRANSITION'&&carrier&&local(carrier.position,direction).y<15&&defenders.filter(d=>local(d.position,direction).y<11).length>=5) {
    s.possession.phase='ESTABLISHED';record(s,'ATTACK_SETTLED',carrier,{reason:'Defence recovered its line'});
  }
}
export function resolveHandovers(s:CoreState) {
  const h=s.defence.handover;if(!h)return;
  const [d1,d2]=h.defenderIds.map(id=>getPlayer(s,id));
  const invalid=[d1,d2].some((d,i)=>d.population!=='COURT'||d.team!==s.defence.team||d.action?.id!==h.actionIds[i]||['INTERRUPTED','FAILED'].includes(d.action.phase))||
    s.defence.marks[d1.id]!==h.attackerIds[0]||s.defence.marks[d2.id]!==h.attackerIds[1];
  if(invalid){record(s,'HANDOVER_CANCELLED',d1,{},[d2.id]);s.defence.handover=null;return;}
  if(d1.action?.phase!=='COMPLETED'||d2.action?.phase!=='COMPLETED')return;
  s.defence.marks[d1.id]=h.attackerIds[1];s.defence.marks[d2.id]=h.attackerIds[0];s.defence.handover=null;
  record(s,'HANDOVER_COMPLETED',d1,{},[d2.id,...h.attackerIds]);
}
function chooseCarrier(s:CoreState,p:CorePlayer) {
  const direction=s.directions[p.team],q=local(p.position,direction);
  const pressure=courtPlayers(s,otherTeam(p.team)).filter(d=>d.kind!=='GOALKEEPER'&&distance(d.position,p.position)<2).length;
  const keeper=courtPlayers(s,otherTeam(p.team)).find(d=>d.kind==='GOALKEEPER'&&goalAreaClearance(d.position,s.directions[p.team])<0);
  if(isWing(p)&&q.y<8&&!p.airborne&&!p.nextAction) {
    const relation=wingRelationship(s,p),angle=shootingAngle(p.position,direction);
    if(angle>.14&&pressure<=1&&s.tick-p.handling.heldSinceTick<38){startAction(s,p,'JUMP','Use the actual outside shooting window');return;}
    const window=wingTakeoffWindow(s,p);
    if(window&&angle<=.14&&p.handling.steps===0&&s.tick-p.handling.heldSinceTick<24) {startAction(s,p,'DRIVE','Improve the wing angle through a legal grounded approach',window,s.defence.pressureId);return;}
    if(relation.back&&laneClearance(s,p.position,relation.back.position,p.team)>.45){startAction(s,p,'PASS','Wing window closed; reconnect with the adjacent back',null,relation.back.id);return;}
  }
  if(s.tick-p.handling.heldSinceTick>36&&q.y<14&&!p.airborne){p.nextAction=null;startAction(s,p,'SHOOT','Handling budget requires a standing release before three seconds',null,null,'STANDING');return;}
  if(p.nextAction==='SHOOT') {p.nextAction=null;startAction(s,p,'SHOOT','Release from actual takeoff position',null,null,q.y<8?(q.x<4||q.x>16?'WING':'BREAKTHROUGH'):'BACKCOURT_JUMP');return;}
  if(p.nextAction==='DRIVE') {p.nextAction=null;startAction(s,p,'DRIVE','Exploit committed feint and test inside lane',driveTarget(s,p),s.defence.pressureId);return;}
  if(s.tick-p.handling.heldSinceTick<10){startAction(s,p,'HOLD','Secure control and read coordinated defence');return;}
  const angle=shootingAngle(p.position,direction),advantage=numericalAdvantage(s,p);
  const hasOpportunity=q.y<13.5&&angle>.13&&(pressure<2||advantage>0||q.y<8)&&
    (s.possession.completedPasses>=2||s.possession.phase==='TRANSITION'||p.role==='P'||(q.y<9&&s.defence.helperId!==null));
  if(!keeper&&q.y<28){startAction(s,p,'SHOOT','Goalkeeper absent; executable empty-goal opportunity',null,null,'EMPTY_GOAL');return;}
  if(pressure===0&&q.y>=9&&q.y<14&&p.handling.steps===0&&s.tick-p.handling.heldSinceTick<26&&s.possession.completedPasses>0) {
    startAction(s,p,'DRIVE','Attack the available shoulder to engage cover before continuation',driveTarget(s,p),s.defence.pressureId);return;
  }
  if(pressure===1&&q.y>=8&&q.y<13.5&&p.handling.steps===0&&s.tick-p.handling.heldSinceTick<30&&!p.handling.dribbleUsed) {
    startAction(s,p,'FEINT','Engage the pressure defender before committing to a shoulder',null,s.defence.pressureId);return;
  }
  if(hasOpportunity) {
    startAction(s,p,'JUMP',`Shot opportunity: angle ${shootingAngle(p.position,direction).toFixed(2)}, pressure ${pressure}, local advantage ${numericalAdvantage(s,p)}`);return;
  }
  if(s.possession.phase==='TRANSITION'&&!p.handling.dribbleUsed&&q.y>14&&laneClearance(s,p.position,world({x:q.x,y:q.y-4},direction),p.team)>.7) {
    if(startAction(s,p,'DRIBBLE','Advance through open transition lane with legal continuous bounce',world({x:q.x,y:Math.max(9,q.y-9)},direction)))p.action!.executeTicks=40;
    return;
  }
  if(pressure===1&&!p.handling.dribbleUsed&&q.y<10&&p.handling.steps===0&&s.tick-p.handling.heldSinceTick<30) {
    startAction(s,p,'FEINT','Engage the primary defender before attacking a shoulder',null,s.defence.pressureId);return;
  }
  const receivers=courtPlayers(s,p.team).filter(a=>a.id!==p.id&&a.kind!=='GOALKEEPER'&&!a.airborne&&!exchangeActive(s,a.id));
  const ranked=receivers.map(a=>{
    const clearance=laneClearance(s,p.position,a.position,p.team),depth=local(a.position,direction).y;
    return {a,clearance,score:Math.min(clearance,3)*1.5+(q.y-depth)*.22-(a.id===s.possession.lastPasserId?2:0)-(distance(p.position,a.position)>17?3:0)};
  }).filter(x=>x.clearance>.45).sort((a,b)=>b.score-a.score||a.a.id.localeCompare(b.a.id));
  if(ranked.length&&s.tick-p.handling.heldSinceTick<48){const choice=ranked[0];startAction(s,p,'PASS',`Continue to ${choice.a.role}: passing-lane clearance ${choice.clearance.toFixed(2)} m`,null,choice.a.id);return;}
  if(q.y<14)startAction(s,p,'JUMP','No safe continuation; shoot before the handling limit');
  else if(!p.handling.dribbleUsed)startAction(s,p,'DRIBBLE','Retain control while finding an outlet',world({x:clamp(q.x+2,2,18),y:q.y-2},direction));
  else if(ranked.length)startAction(s,p,'PASS','Release before handling violation',null,ranked[0].a.id);
  else startAction(s,p,'HOLD','No legal available outlet; referee handling limit remains authoritative');
}
export function selectActions(s:CoreState) {
  const direction=s.directions[s.possession.team];
  const prospective=s.players.find(p=>p.action?.kind==='PASS'&&!['COMPLETED','FAILED','INTERRUPTED'].includes(p.action.phase));
  const receiverId=s.ball.flight?.receiverId??prospective?.action?.targetId;
  for(const p of courtPlayers(s)) {
    if(!actionAvailable(p))continue;
    if(exchangeActive(s,p.id)&&s.ball.controllerId!==p.id)continue;
    if(p.airborne&&s.ball.controllerId!==p.id){startAction(s,p,'LAND','Complete airborne action before new movement');continue;}
    if(s.ball.controllerId===p.id){chooseCarrier(s,p);continue;}
    if(p.kind==='GOALKEEPER') {
      const ownGoal=s.directions[otherTeam(p.team)],ball=local(s.ball.position,ownGoal);
      // Position from shooter/ball geometry, never read a future target before release.
      if(s.ball.flight?.kind==='SHOT'&&getPlayer(s,s.ball.flight.fromId).team!==p.team) {
        const f=s.ball.flight,t=(world({x:10,y:1.5},ownGoal).y-s.ball.position.y)/f.velocity.y;
        startAction(s,p,'SAVE','Read released trajectory, commit and react',world({x:clamp(s.ball.position.x+f.velocity.x*Math.max(0,t),8.5,11.5),y:1.5},ownGoal));
      } else if(startAction(s,p,'REPOSITION','Position between ball and defended goal',world({x:clamp(10+(ball.x-10)*.17,8.4,11.6),y:1.5},ownGoal)))p.action!.executeTicks=4;
      continue;
    }
    if(p.id===receiverId){startAction(s,p,'RECEIVE','Prepare hands for named pass; ownership requires contact',null,prospective?.id??s.ball.flight?.fromId??null);continue;}
    if(s.ball.mode==='LOOSE') {if(p.duty.kind==='COLLECT')startAction(s,p,'RECEIVE','Contest the loose ball',s.ball.position);continue;}
    if(p.team!==s.possession.team) {
      const marked=p.duty.targetId?getPlayer(s,p.duty.targetId):null;
      const q=marked?local(marked.position,direction):{x:p.position.x,y:10};
      const y=p.duty.kind==='PRESSURE'||p.duty.kind==='HELP'?Math.max(6.6,q.y-.7):Math.max(6.6,Math.min(s.defence.system==='5:1'&&p.role==='CB'?10:7.2,q.y-1.2));
      const target=marked&&isWing(marked)&&['MARK','PRESSURE','COVER'].includes(p.duty.kind)?defendWing(s,p,marked)??world({x:clamp(q.x,1.5,18.5),y},direction):world({x:clamp(q.x,1.5,18.5),y},direction);
      const kind=p.duty.kind==='HELP'?'HELP':p.duty.kind==='RECOVER'||p.duty.kind==='RETREAT'?'RECOVER':p.duty.kind==='PRESSURE'?'PRESS':'CONTAIN';
      const carrier=s.ball.controllerId?getPlayer(s,s.ball.controllerId):null;
      if(carrier&&carrier.team!==p.team&&planContact(s,p,carrier))continue;
      if(carrier?.team!==p.team&&carrier?.airborne&&distance(p.position,carrier.position)<2)startAction(s,p,'BLOCK','Contest visible shooting action',null,carrier.id);
      else startAction(s,p,kind,p.duty.reason,target,p.duty.targetId);
    } else {
      let target=isWing(p)&&s.possession.phase==='ESTABLISHED'?wingRelationship(s,p).target:structurePoint(p.role,direction,s.ball.position.x);
      if(s.possession.phase==='TRANSITION') {const q=local(p.position,direction);target=world({x:p.role==='LB'?5:p.role==='RB'?15:target.x,y:Math.max(local(target,direction).y,q.y-7)},direction);}
      if(p.role==='P'&&distance(p.position,target)<1.2)startAction(s,p,'SCREEN','Establish stationary pivot screen to constrain inside cover',null,s.defence.pressureId);
      else if(distance(p.position,target)>.55)startAction(s,p,'RUN',p.duty.reason,target);
      else startAction(s,p,'RECEIVE','Offer an available passing connection from assigned role');
    }
  }
}
