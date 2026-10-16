// Execution uncertainty follows the actual throw/catch problem. These are
// engineering coefficients, not event-rate targets or a turnover lottery.
import { courtPlayers, otherTeam, random, record, type CorePlayer, type CoreState, type Point } from './state';
import { clamp, distance, goal, laneClearance, local, shotContext, shootingAngle, world } from './space';
import { executionCapacity,difficultExecutionCapacity } from './condition';
import {defenderResistance} from './threatRelation';

export function releasePressure(s:CoreState,p:CorePlayer):number {
  return clamp(courtPlayers(s,otherTeam(p.team)).filter(d=>d.kind==='FIELD_PLAYER')
    .reduce((n,d)=>n+Math.max(0,1-distance(p.position,d.position)/2)*(d.action?.kind==='CONTACT'?1.2:.7)*defenderResistance(s,p,d,goal(s.directions[p.team])),0),0,2);
}

/** A deterministic intended window, based on the visible world at commitment. */
export function planShotTarget(s:CoreState,p:CorePlayer,tieSide?:-1|1) {
  const direction=s.directions[p.team],context=shotContext(s,p);
  const keeper=courtPlayers(s,otherTeam(p.team)).find(d=>d.kind==='GOALKEEPER');
  const keeperX=keeper?.position.x??10,wide=Math.abs(p.position.x-10)>6.5;
  const penalty=p.action?.shotKind==='SEVEN_METRE';
  const difficulty=clamp(context.pressure/2,0,1)*.7+clamp((context.distance-7)/5,0,1)*.15+clamp(Math.hypot(p.velocity.x,p.velocity.y)/Math.max(1,p.profile.topSpeed),0,1)*.15;
  const shooting=penalty?p.profile.shotPlacement*.6+p.profile.finishing*.25+p.profile.composure*.15:wide?p.profile.wingFinishing*.7+p.profile.shotPlacement*.3:p.profile.shotPlacement;
  const stress=clamp(1+(p.profile.control?.pressure??.5)*context.pressure*.12-.06*context.pressure,.85,1.12);
  const placement=clamp(shooting*(penalty?executionCapacity(p):difficultExecutionCapacity(p,difficulty,shooting,context.pressure/2)*stress),0,1);
  const spread=((1.25-placement)*(1+context.pressure*(.45-.25*p.profile.composure))+
    Math.max(0,.3-shootingAngle(p.position,direction))*1.8)*(penalty?.55+.45*(1-p.profile.composure):1);
  const leftGap=keeperX-8.5,rightGap=11.5-keeperX;
  const side=Math.abs(rightGap-leftGap)<.6&&tieSide?tieSide:rightGap>=leftGap?1:-1;
  // The posts define the intended window. A fraction of the keeper-to-post gap
  // aimed too many competent central throws back within his standing reach.
  // Precision buys a smaller safety margin, not an automatic goal.
  const safe=.14+spread*(wide?.12:.22);
  const aimX=clamp(10+side*(1.5-safe),8.5+safe,11.5-safe);
  return {aimX,placement,spread,direction,context};
}

/** A visible committed wind-up can justify a physical loading step, never knowledge of future aim. */
export function prepareKeeperAnticipation(s:CoreState,keeper:CorePlayer,thrower:CorePlayer):boolean {
  const action=keeper.action,throwing=thrower.action,k=keeper.profile.keeper;
  if(keeper.population!=='COURT'||thrower.population!=='COURT'||keeper.team===thrower.team||!k||
    action?.kind!=='SAVE'||action.phase!=='EXECUTING'||action.targetId!==null||throwing?.kind!=='SHOOT'||
    !['COMMITTED','EXECUTING'].includes(throwing.phase)||s.ball.controllerId!==thrower.id||s.ball.flight||
    action.anticipationForId===throwing.id)return false;
  const context=shotContext(s,thrower),penalty=throwing.shotKind==='SEVEN_METRE';
  // A blocked backcourt wind-up supplies no readable direction. Short clear
  // encounters require prediction because the ball leaves little reaction time.
  if(!penalty&&(distance(thrower.position,keeper.position)>8||context.blockThreat>.2))return false;
  const expected=Math.abs(thrower.position.x-10)>6.5?Math.sign(thrower.position.x-10)||1:keeper.position.x<=10?1:-1;
  const read=keeperReadQuality(keeper,penalty);
  const side=random(s)<read?expected:random(s)<.5?-1:1;
  const ownGoal=s.directions[otherTeam(keeper.team)],depth=local(keeper.position,ownGoal).y;
  // A penalty loading step is a small visible commitment, not a complete
  // pre-flight dive. Ordinary close-shot anticipation retains its exact step.
  const loadingStep=penalty?.35+.1*k.sevenMetre:.5;
  action.target=world({x:clamp(keeper.position.x+side*loadingStep,.3,19.7),y:depth},ownGoal);
  action.anticipationForId=throwing.id;action.anticipationStartedTick=s.tick;
  record(s,'KEEPER_ANTICIPATED',keeper,{throwActionId:throwing.id,side,read,penalty,basis:'Visible committed wind-up and available goal space'},[thrower.id]);
  return true;
}

export type PassExecution = { target:Point; speed:number; difficulty:number; spread:number; pressure:number; error:number; capability:number };
export function executePass(s:CoreState,p:CorePlayer,receiver:CorePlayer,intended:Point,protectedReturn=false):PassExecution {
  const origin=s.ball.position,range=distance(origin,intended);
  const capacity=executionCapacity(p);
  const speed=(10.5+3*p.profile.passing)*(.9+.1*capacity);
  const pressure=releasePressure(s,p);
  const movement=clamp(Math.hypot(receiver.velocity.x,receiver.velocity.y)/Math.max(1,receiver.profile.topSpeed),0,1);
  const separation=Math.min(6,...courtPlayers(s,otherTeam(p.team)).filter(d=>d.kind==='FIELD_PLAYER').map(d=>distance(d.position,intended)));
  const contested=clamp((1.4-separation)/1.4,0,1);
  const lane=laneClearance(s,origin,intended,p.team);
  const urgency=clamp((s.tick-p.handling.heldSinceTick)*50/s.ruleProfile.maxHoldMs-.6,0,.4);
  const difficulty=clamp(clamp((range-6)/18,0,1)*.35+pressure*.2+movement*.15+contested*.2+clamp((.8-lane)/.8,0,1)*.25+urgency*.25,0,1);
  const stress=clamp(1+((p.profile.control?.pressure??.5)-.5)*pressure*.2,.85,1.15);
  const capability=clamp(p.profile.passing*difficultExecutionCapacity(p,difficulty,p.profile.passing,pressure/2)*stress,0,1);
  const spread=protectedReturn?0:.025+(1-capability)*(.18+1.65*difficulty);
  if(!spread||range<.1)return {target:{...intended},speed,difficulty,spread,pressure,error:0,capability};
  const ux=(intended.x-origin.x)/range,uy=(intended.y-origin.y)/range;
  const cross=(random(s)*2-1)*spread,along=(random(s)*2-1)*spread*.35;
  // Do not clamp the executed throw back into a successful lane. A bad throw
  // can be recovered, intercepted or go out through the ordinary ball physics.
  return {target:{x:intended.x-uy*cross+ux*along,y:intended.y+ux*cross+uy*along},speed,difficulty,spread,pressure,error:Math.hypot(cross,along),capability};
}

export function receptionRisk(s:CoreState,p:CorePlayer,point:Point,pace:number):number {
  const pressure=releasePressure(s,p)/2;
  const alignment=clamp(distance(p.position,point)/.65,0,1);
  const moving=clamp(Math.hypot(p.velocity.x,p.velocity.y)/Math.max(1,p.profile.topSpeed),0,1);
  const difficulty=pressure*.45+clamp((pace-9)/9,0,1)*.16+alignment*.25+moving*.1;
  // Catch preparation protects a difficult impact; calmness matters under pressure.
  // Delivery alignment/pace remain independent challenge inputs, not receiver errors.
  const technique=clamp(p.profile.handling*.8+(p.profile.control?.concentration??p.profile.handling)*.2+
    pressure*((p.profile.control?.pressure??p.profile.composure)-.5)*.15,0,1);
  const control=technique*difficultExecutionCapacity(p,difficulty,technique,pressure);
  // Keep uncertainty in genuinely challenged impacts at every realistic tier.
  // Mastery reduces the control deficit; it does not erase the challenge.
  return clamp(Math.max(0,difficulty-.18)*(1-control)**2*1.1,0,.4);
}

/** Only a challenged floor touch can escape control. An open carry has zero risk. */
export function carryControl(s:CoreState,p:CorePlayer) {
  const pressure=clamp(releasePressure(s,p),0,1);
  const speed=clamp(Math.hypot(p.velocity.x,p.velocity.y)/Math.max(1,p.profile.topSpeed),0,1);
  const difficulty=pressure*(.65+.35*speed);
  const technique=clamp(p.profile.handling*.8+p.profile.balance*.2+pressure*((p.profile.control?.pressure??p.profile.composure)-.5)*.15,0,1);
  const capacity=technique*difficultExecutionCapacity(p,difficulty,technique,pressure);
  const risk=clamp(Math.max(0,difficulty-(.25+.35*technique))*(1-capacity)*.45,0,.2);
  return{risk,difficulty,pressure,capacity};
}

/** Read accuracy concerns observed information, separate from motor hand reach. */
export function keeperReadQuality(p:CorePlayer,penalty:boolean):number {
  const k=p.profile.keeper;if(!k)return .5;
  const base=penalty?k.reading*.35+k.reaction*.20+k.positioning*.15+k.sevenMetre*.30:k.reading*.45+k.reaction*.35+k.positioning*.20;
  return clamp(base+((k.patience??.5)-.5)*.15+((k.concentration??.5)-.5)*.2+
    (penalty?((k.pressure??.5)-.5)*.1+(p.profile.composure-.5)*.1:0),0,1);
}

/** The shooter chooses a reachable corner; execution can still miss it. */
export function shotHeight(s:CoreState,p:CorePlayer,placement:number,pressure:number):number {
  const keeper=courtPlayers(s,otherTeam(p.team)).find(d=>d.kind==='GOALKEEPER')?.profile.keeper;
  const read=p.profile.decision*p.profile.composure;
  const lowPreference=clamp(.5+((keeper?.high??.5)-(keeper?.low??.5))*read*.6,.2,.8);
  const low=random(s)<lowPreference;
  const intended=low?.3+.45*(1-placement):1.7-.45*(1-placement);
  // This scoped trajectory has no vertical bounce integrator. Low executions
  // stay above the floor; inaccurate high executions can cross the crossbar.
  return Math.max(.12,intended+(random(s)-.5)*(1.1-placement)*(1+pressure*.3));
}
