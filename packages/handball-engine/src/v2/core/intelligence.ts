/** Bounded, present-state handball reasoning inside canonical V2. No RNG or outcomes. */
import {courtPlayers,otherTeam,type CorePlayer,type CoreState,type Point} from './state';
import {clamp,clearGoalArea,distance,goal,local,segmentPoint,shootingAngle,shotOpportunity} from './space';
import {laneMargin,secondsTo} from './timing';
import {exchangeActive} from './population';
import {pivotOffer} from './pivot';
import {zoneOf} from './defence';
import {SHOT_FLOOR} from './engage';
import {defenderRelation} from './threatRelation';
export {defenderRelation} from './threatRelation';

export type Situation='NO_ADVANTAGE'|'PRIMARY_DEFENDER_BEATEN'|'OPEN_GOAL_LANE'|'HELP_ARRIVING'|'TWO_V_ONE'|'THREE_V_TWO'|'FREE_M6'|'FREE_WING'|'DEFENCE_UNBALANCED'|'CLEAR_SHOT_WINDOW'|'TRANSITION_ADVANTAGE'|'NUMERICAL_SUPERIORITY'|'NUMERICAL_INFERIORITY'|'PRESSURED_BALL_CARRIER'|'PASSING_LANE_CREATED'|'ADVANTAGE_LOST';
export type TacticalIntent='EXPLOIT_ADVANTAGE'|'ATTACK_GAP'|'ATTACK_NEXT_DEFENDER'|'BIND_HELP'|'PREPARE_SHOT'|'RECYCLE_ATTACK'|'SUPPORT_BALL'|'DEFENSIVE_CONTAIN'|'DEFENSIVE_HELP'|'DEFENSIVE_RECOVER'|'RETREAT_GOAL_SIDE';
export type HandballIntent={id:string;possessionId:string;kind:TacticalIntent;sinceTick:number;primaryId:string|null;targetId:string|null;target:Point|null;commitment:number;originalAdvantage:number;reason:string;lastMotor:string};
export type ReceiverRead={id:string;role:string;position:Point;velocity:Point;goalDistance:number;spacing:number;readiness:number;laneSeconds:number;separation:number;created:boolean;creatorId:string|null;advantage:number;quality:number;angle:number};
export type Perception={tick:number;playerId:string;possessionId:string;ball:{holderId:string|null;position:Point;velocity:Point;incomingId:string|null};self:{position:Point;velocity:Point;role:string;energy:number;control:boolean;dribbling:boolean;steps:number;heldMs:number;dribbleUsed:boolean;intent:TacticalIntent|null};primary:{id:string;distance:number;forwardMargin:number;goalSide:boolean;beaten:boolean}|null;help:{id:string;distance:number;arrivalSeconds:number;closingSpeed:number;committed:boolean}|null;space:{target:Point;clearance:number;gapWidth:number;open:boolean;closureSeconds:number;goalDistance:number;angle:number;attackers:number;defenders:number;localAttackers:number;localDefenders:number};receivers:ReceiverRead[];shot:{quality:number;distance:number;pressure:number;blockThreat:number;emptyGoal:boolean;built:boolean}|null;capability:{decision:number;anticipation:number;composure:number;handling:number;passing:number;shooting:number;breakthrough:number};preference:{shoot:number;drive:number;feed:number};tactics:{identity:string;tempo:string};momentum:number;legalTravel:number};
export type Advantage={level:'NONE'|'SMALL'|'CLEAR'|'DECISIVE';value:number;beatenMargin:number;lane:number;helpTime:number;momentum:number;numbers:number;shotPotential:number;freeCarrier:boolean};
export type AffordanceName='DRIVE'|'EXPLOIT_GAP'|'ATTACK_NEXT_DEFENDER'|'SHOOT'|'PASS_TO_M6'|'PASS_TO_WING'|'PASS_TO_BACKCOURT'|'SWITCH_SIDE'|'BIND_AND_PASS'|'RECYCLE'|'RESET'|'CONTINUE_SUPPORT'|'PUSH_BALL'|'ATTACK_OPEN_LANE'|'PASS_RUNNER'|'CONTINUE_FAST_BREAK'|'SETTLE_ATTACK';
export type Affordance={name:AffordanceName;motor:'DRIVE'|'DRIBBLE'|'SHOOT'|'PASS';intent:TacticalIntent;target:Point|null;targetId:string|null;value:number;components:{immediate:number;continuation:number;capability:number;tactics:number;risk:number;commitment:number};reason:string};
export type Decision={perception:Perception;situations:Situation[];advantage:Advantage;affordances:Affordance[];chosen:Affordance|null;previous:HandballIntent|null;breakCondition:string|null;reason:string;continueIntent:boolean};
const attackingIntent=(i:HandballIntent|undefined)=>!!i&&['EXPLOIT_ADVANTAGE','ATTACK_GAP','ATTACK_NEXT_DEFENDER','BIND_HELP'].includes(i.kind);
const usable=(s:CoreState,p:CorePlayer)=>p.kind==='FIELD_PLAYER'&&p.population==='COURT'&&!p.condition.unavailable&&!p.condition.exitRequired&&!exchangeActive(s,p.id);
/** Remember who was beaten and whose cover was drawn; reassigned duties do not rewrite history. */
export function observeCarrierRelationships(s:CoreState,p:CorePlayer){
 if(p.carrierRead?.possessionId===s.possession.id)return;
 const opponents=courtPlayers(s,otherTeam(p.team)).filter(d=>usable(s,d));
 const primary=opponents.find(d=>d.id===p.action?.targetId&&p.action.kind==='DRIVE')??opponents.find(d=>s.defence.marks[d.id]===p.id&&d.id!==s.defence.helperId)??opponents.slice().sort((a,b)=>distance(a.position,p.position)-distance(b.position,p.position)||a.id.localeCompare(b.id))[0];
 const receiverCovers:Record<string,string>={};
 for(const mate of courtPlayers(s,p.team).filter(a=>usable(s,a)&&a.id!==p.id)){
  const cover=opponents.find(d=>s.defence.marks[d.id]===mate.id)??opponents.find(d=>d.zone===zoneOf(mate.position.x));
  if(cover)receiverCovers[mate.id]=cover.id;
 }
 p.carrierRead={possessionId:s.possession.id,primaryId:primary?.id??null,receiverCovers};
}

/** Copies a whitelist of visible bodies and existing capability estimates. Never reads action targets, RNG, contests or shot results. */
export function perceiveHandball(s:CoreState,p:CorePlayer):Perception {
 const dir=s.directions[p.team],g=goal(dir),q=local(p.position,dir),len=Math.max(.001,distance(p.position,g));
 const ux=(g.x-p.position.x)/len,uy=(g.y-p.position.y)/len;
 const defenders=courtPlayers(s,otherTeam(p.team)).filter(d=>usable(s,d)),mates=courtPlayers(s,p.team).filter(a=>usable(s,a));
 const remembered=p.carrierRead?.possessionId===s.possession.id?p.carrierRead.primaryId:p.handballIntent?.possessionId===s.possession.id?p.handballIntent.primaryId:p.action?.kind==='DRIVE'?p.action.targetId:null;
 const marked=defenders.find(d=>d.id===remembered)??defenders.find(d=>s.defence.marks[d.id]===p.id&&d.id!==s.defence.helperId);
 const primary=marked??defenders.slice().sort((a,b)=>distance(a.position,p.position)-distance(b.position,p.position)||a.id.localeCompare(b.id))[0];
 const relation=primary?defenderRelation(p,primary,g):null;
 const target=clearGoalArea({x:p.position.x+ux*Math.min(4,len),y:p.position.y+uy*Math.min(4,len)},dir,p.radius+.16);
 const occupancy=defenders.map(d=>{const path=segmentPoint(p.position,target,d.position);const r=defenderRelation(p,d,g);return{d,r,clearance:distance(path.point,d.position)-p.radius-d.radius,t:path.t};});
 const ahead=occupancy.filter(o=>o.r.forward>-.2&&o.r.forward<Math.max(4,distance(p.position,target))+1&&!(o.d===primary&&o.r.beaten));
 const clearance=Math.min(4,...ahead.map(o=>o.clearance));
 const helpers=occupancy.filter(o=>o.d!==primary&&o.r.forward>-.5&&o.r.forward<7).map(o=>{
  const d=o.d,dist=distance(d.position,p.position),toward=dist>.001?((p.position.x-d.position.x)*d.velocity.x+(p.position.y-d.position.y)*d.velocity.y)/dist:0;
  const intercept={x:p.position.x+ux*Math.min(1.5,distance(p.position,target)),y:p.position.y+uy*Math.min(1.5,distance(p.position,target))};
  return{id:d.id,distance:dist,arrivalSeconds:secondsTo(s,d,intercept),closingSpeed:toward,committed:dist<1.65&&o.r.forward>-.35&&o.r.lateral<1.6&&toward>-.3};
 }).sort((a,b)=>Number(b.committed)-Number(a.committed)||a.arrivalSeconds-b.arrivalSeconds||a.id.localeCompare(b.id));
 const help=helpers[0]??null;
 const receivers=mates.filter(a=>a.id!==p.id&&!a.airborne).map(a=>{
  const observed=p.carrierRead?.possessionId===s.possession.id?p.carrierRead.receiverCovers[a.id]:null;
  const numericalCover=defenders.length<=2&&mates.length>defenders.length&&primary&&distance(primary.position,p.position)<2.2&&defenderRelation(p,primary,g).forward>0?primary:undefined;
  const marker=defenders.find(d=>d.id===observed)??defenders.find(d=>s.defence.marks[d.id]===a.id)??defenders.find(d=>d.zone===zoneOf(a.position.x))??numericalCover;
  const separation=Math.min(8,...defenders.map(d=>distance(d.position,a.position)));
  // Creation needs observed displacement/commitment of the receiver's own cover, not width alone.
  const engaged=marker&&distance(marker.position,p.position)<2.5&&distance(marker.position,a.position)>2&&
   ((marker.velocity.x*(p.position.x-marker.position.x)+marker.velocity.y*(p.position.y-marker.position.y))>0||help?.id===marker.id&&help.committed);
  const displaced=marker&&(observed||s.defence.marks[marker.id]===a.id||marker.zone===zoneOf(a.position.x))&&distance(marker.position,a.position)>2.5&&Math.abs(marker.position.x-a.position.x)>2&&distance(marker.position,p.position)<3;
  const created=!!(engaged||displaced)&&separation>1.4;
  const lane=laneMargin(s,p.position,a.position,p.team,10.5+3*p.profile.passing).seconds;
  const shot=shotOpportunity(s,a),angle=shootingAngle(a.position,dir),pivot=a.role==='P'||a.role==='P2';
  const offer=pivot?pivotOffer(s,p,a):null;
  const readiness=clamp(.5+a.profile.handling*.25+a.profile.offBall*.25-(a.reception&&a.reception.readyTick>s.tick?.15:0),0,1);
  const advantage=clamp((shot?.quality??0)*.5+clamp((separation-1)/3,0,1)*.25+(created?.25:0),0,1);
  return{id:a.id,role:a.role,position:{...a.position},velocity:{...a.velocity},goalDistance:distance(a.position,g),spacing:distance(p.position,a.position),readiness,laneSeconds:offer&&!offer.available?Math.min(lane,0):lane,separation,created,creatorId:created?marker!.id:null,advantage,quality:shot?.quality??0,angle};
 });
 const shot=shotOpportunity(s,p),open=clearance>.25&&distance(p.position,target)>.4;
 return{tick:s.tick,playerId:p.id,possessionId:s.possession.id,ball:{holderId:s.ball.controllerId,position:{...s.ball.position},velocity:s.ball.flight?{...s.ball.flight.velocity}:{...p.velocity},incomingId:s.ball.flight?.receiverId??null},self:{position:{...p.position},velocity:{...p.velocity},role:p.role,energy:p.condition.energy,control:s.ball.controllerId===p.id,dribbling:s.ball.mode==='DRIBBLE'&&s.ball.controllerId===p.id,steps:p.handling.steps,heldMs:s.ball.mode==='DRIBBLE'&&s.ball.controllerId===p.id?0:(s.tick-p.handling.heldSinceTick)*50,dribbleUsed:p.handling.dribbleUsed,intent:p.handballIntent?.kind??null},primary:primary&&relation?{id:primary.id,distance:distance(primary.position,p.position),forwardMargin:-relation.forward,goalSide:relation.forward>0,beaten:relation.beaten}:null,help,space:{target,clearance,gapWidth:clamp(clearance*2+p.radius*2,0,8),open,closureSeconds:help?.arrivalSeconds??10,goalDistance:len,angle:shootingAngle(p.position,dir),attackers:mates.length,defenders:defenders.length,localAttackers:mates.filter(a=>distance(a.position,p.position)<9&&local(a.position,dir).y<=q.y+2).length,localDefenders:defenders.filter(d=>distance(d.position,p.position)<9&&local(d.position,dir).y<=q.y+1).length},receivers,shot:shot?{quality:shot.quality,distance:shot.distance,pressure:shot.pressure,blockThreat:shot.blockThreat,emptyGoal:shot.emptyGoal,built:s.possession.completedPasses>=2||s.possession.phase==='TRANSITION'||shot.distance<=7.5||q.y<=5}:null,capability:{decision:p.profile.decision,anticipation:p.profile.anticipation,composure:p.profile.composure,handling:p.profile.handling,passing:p.profile.passing,shooting:(p.profile.shotPlacement+p.profile.finishing)/2,breakthrough:p.profile.breakthrough},preference:{shoot:p.profile.tendency.shoot,drive:p.profile.tendency.drive,feed:p.profile.tendency.feed},tactics:{identity:s.coaching[p.team].attackIdentity,tempo:s.coaching[p.team].tempo},momentum:Math.max(0,p.velocity.x*ux+p.velocity.y*uy),legalTravel:s.ball.mode==='DRIBBLE'&&s.ball.controllerId===p.id?4:Math.max(0,(s.ruleProfile.maxSteps-p.handling.steps)*.8-p.handling.stepDistance-.15)};
}
export function assessAdvantage(r:Perception):Advantage {
 const beatenMargin=r.primary?.beaten?clamp(.45+r.primary.forwardMargin/2,0,1):0,lane=clamp(r.space.clearance/1.8,0,1),helpTime=clamp((r.space.closureSeconds-.3)/1.5,0,1),momentum=clamp(r.momentum/4,0,1),numbers=clamp((r.space.localAttackers-r.space.localDefenders)/2,0,1),shotPotential=r.shot?.quality??0;
 const freeCarrier=r.space.open&&(r.primary?.beaten||!r.primary||r.primary.distance>4)&&(!r.help||r.help.arrivalSeconds>.65&&!r.help.committed)&&r.space.angle>.12&&(r.legalTravel>.25||!r.self.dribbleUsed)&&r.self.heldMs<2200;
 const value=clamp(beatenMargin*.25+lane*.25+helpTime*.15+momentum*.1+numbers*.1+shotPotential*.15,0,1);
 return{level:value>.75?'DECISIVE':value>.5?'CLEAR':value>.25?'SMALL':'NONE',value,beatenMargin,lane,helpTime,momentum,numbers,shotPotential,freeCarrier};
}
export function situationsFor(r:Perception,a:Advantage,previous?:HandballIntent):Situation[] {
 const list:Situation[]=[];
 if(r.primary?.beaten)list.push('PRIMARY_DEFENDER_BEATEN');if(r.space.open)list.push('OPEN_GOAL_LANE');
 if(r.help&&(r.help.committed||r.help.arrivalSeconds<1.3&&r.help.closingSpeed>.15))list.push('HELP_ARRIVING');
 if(r.space.localAttackers===2&&r.space.localDefenders===1)list.push('TWO_V_ONE');if(r.space.localAttackers>=3&&r.space.localDefenders===2)list.push('THREE_V_TWO');
 if(r.space.attackers>r.space.defenders)list.push('NUMERICAL_SUPERIORITY');if(r.space.attackers<r.space.defenders)list.push('NUMERICAL_INFERIORITY');
 if(r.receivers.some(x=>x.created&&x.laneSeconds>.1&&(x.role==='P'||x.role==='P2')))list.push('FREE_M6');
 if(r.receivers.some(x=>x.created&&x.laneSeconds>.1&&(x.role==='LW'||x.role==='RW')))list.push('FREE_WING');
 if(r.receivers.some(x=>x.created&&x.laneSeconds>.1))list.push('PASSING_LANE_CREATED','DEFENCE_UNBALANCED');
 if(r.shot&&r.shot.distance<=8.3&&r.shot.pressure<.65&&r.space.angle>.16)list.push('CLEAR_SHOT_WINDOW');
 if(r.primary&&r.primary.distance<1.5&&!r.primary.beaten)list.push('PRESSURED_BALL_CARRIER');
 if(!a.freeCarrier&&!r.primary?.beaten&&!r.receivers.some(x=>x.created))list.push('NO_ADVANTAGE');
 if(previous&&previous.originalAdvantage>a.value+.25)list.push('ADVANTAGE_LOST');return list;
}
export function affordancesFor(r:Perception,a:Advantage,situations:Situation[],previous:HandballIntent|null,transition=false):Affordance[] {
 const out:Affordance[]=[];
 const add=(name:AffordanceName,motor:Affordance['motor'],intent:TacticalIntent,target:Point|null,targetId:string|null,immediate:number,continuation:number,capability:number,risk:number,reason:string)=>{
  const tactics=(r.tactics.identity==='DIRECT'&&motor==='DRIVE'?.07:r.tactics.identity==='COMBINATION'&&name==='BIND_AND_PASS'?.07:r.tactics.identity==='WIDTH'&&name==='PASS_TO_WING'?.07:0)+(r.tactics.tempo==='QUICK'&&transition?.04:0);
  const commitment=previous?.kind===intent?.12*previous.commitment:0;
  const components={immediate,continuation,capability,tactics,risk,commitment};out.push({name,motor,intent,target,targetId,components,value:immediate+continuation+capability+tactics+commitment-risk,reason});
 };
 const canCarry=r.legalTravel>.25||!r.self.dribbleUsed;
 const overload=(situations.includes('TWO_V_ONE')||situations.includes('THREE_V_TWO'))&&r.receivers.some(x=>x.goalDistance<r.space.goalDistance+.5&&x.quality>.3);
 if(canCarry&&r.self.heldMs<2200&&r.space.goalDistance>7.1&&(r.space.open||overload&&!r.help?.committed)){
  const binding=!!r.help&&r.help.arrivalSeconds<1.5&&!r.help.committed;
  const intent:TacticalIntent=binding&&r.primary?.beaten?'ATTACK_NEXT_DEFENDER':a.freeCarrier?'EXPLOIT_ADVANTAGE':overload?'BIND_HELP':'ATTACK_GAP';
  add(transition?'ATTACK_OPEN_LANE':binding||overload?'ATTACK_NEXT_DEFENDER':a.freeCarrier?'DRIVE':'EXPLOIT_GAP',r.legalTravel<.6&&!r.self.dribbleUsed?'DRIBBLE':'DRIVE',intent,r.space.target,binding?r.help!.id:r.primary?.id??null,((a.freeCarrier?.8:overload?.8:.35)+a.lane*.16)*r.preference.drive,a.helpTime*.1+a.momentum*.08,r.capability.breakthrough*.06,(r.help?.committed?.4:0)+(1-r.self.energy)*.06,overload?'Attack the outnumbered defender before giving away the threat':'Retain the goalward threat until the next defensive relationship changes');
 }
 if(r.shot&&(r.shot.built||r.shot.emptyGoal||!canCarry||r.self.heldMs>2100))
  add('SHOOT','SHOOT','PREPARE_SHOT',null,null,r.shot.emptyGoal?1.4:(clamp((r.shot.quality-SHOT_FLOOR)/.44,0,1)+(situations.includes('CLEAR_SHOT_WINDOW')?.15:0))*r.preference.shoot,0,r.capability.shooting*.08,r.shot.blockThreat*.15,'Release from the current legal shot window using the established V2 opportunity and player preference');
 for(const x of r.receivers.filter(x=>x.laneSeconds>.1&&x.readiness>.45)){
  const pivot=x.role==='P'||x.role==='P2',wing=x.role==='LW'||x.role==='RW';
  const superior=x.quality>(r.shot?.quality??0)+.22&&x.advantage>.7;
  const bound=x.created&&(r.help?.committed||x.creatorId===r.primary?.id&&r.primary.goalSide&&!r.primary.beaten&&r.primary.distance<1.65);
  const name:AffordanceName=bound?'BIND_AND_PASS':pivot?'PASS_TO_M6':wing?'PASS_TO_WING':transition&&x.position.y!==r.self.position.y?'PASS_RUNNER':(x.position.x-10)*(r.self.position.x-10)<0?'SWITCH_SIDE':'RECYCLE';
  add(name,'PASS',bound?'BIND_HELP':'RECYCLE_ATTACK',null,x.id,(x.advantage*.45+(bound?.55:0)+(superior?.2:0))*r.preference.feed,Math.min(.15,x.laneSeconds*.1),r.capability.passing*.06,(a.freeCarrier&&!bound&&!superior?.65:0)+(!x.created&&(pivot||wing)?.2:0)+(1-r.capability.decision)*.05,'created='+x.created+'; coverCommitted='+bound+'; receiverAdvantage='+x.advantage.toFixed(3));
 }
 return out.sort((x,y)=>y.value-x.value||x.name.localeCompare(y.name)||(x.targetId??'').localeCompare(y.targetId??''));
}
/** Pure selection: tactical hysteresis only while its evidence remains valid. */
export function decideHandball(s:CoreState,p:CorePlayer):Decision {
 const r=perceiveHandball(s,p),a=assessAdvantage(r),previous=p.handballIntent?.possessionId===s.possession.id?structuredClone(p.handballIntent):null;
 const situations=situationsFor(r,a,previous??undefined);if(s.possession.phase==='TRANSITION'&&a.freeCarrier)situations.push('TRANSITION_ADVANTAGE');
 let breakCondition:string|null=null;
 if(previous&&attackingIntent(previous)){
  if(!r.self.control)breakCondition='BALL_CONTROL_CHANGED';else if(r.self.heldMs>=2200||r.legalTravel<.2&&r.self.dribbleUsed)breakCondition='LEGAL_RELEASE_REQUIRED';
  else if(r.help?.committed)breakCondition='HELP_COMMITTED';
  else if(!r.space.open)breakCondition='LANE_CLOSED';else if(previous.primaryId&&r.primary&&!r.primary.beaten&&previous.originalAdvantage>.5&&r.primary.distance<1.5)breakCondition='DEFENDER_RECOVERED';
 }
 const affordances=affordancesFor(r,a,situations,previous,s.possession.phase==='TRANSITION');let chosen=affordances[0]??null;
 if(previous&&attackingIntent(previous)&&!breakCondition&&chosen?.motor==='SHOOT')breakCondition='SHOT_WINDOW_REACHED';
 const existing=previous?affordances.find(x=>x.intent===previous.kind&&x.targetId===previous.targetId):undefined;
 let continueIntent=!!existing&&!breakCondition;
 if(existing&&!breakCondition&&chosen&&chosen!==existing){const threshold=.12+.1*previous!.commitment;if(chosen.value<existing.value+threshold)chosen=existing;else{breakCondition='CLEARLY_SUPERIOR_OPTION';continueIntent=false;}}
 const reason=breakCondition??(continueIntent?'TACTICAL_REASON_REMAINS':'SITUATION_SELECTED');
 return{perception:r,situations,advantage:a,affordances,chosen,previous,breakCondition,reason,continueIntent};
}
export function commitHandball(s:CoreState,p:CorePlayer,d:Decision) {
 const c=d.chosen;if(!c)return;
 const old=p.handballIntent;
 const retain=old?.possessionId===s.possession.id&&old.kind===c.intent&&old.targetId===c.targetId&&!d.breakCondition;
 p.handballIntent={id:retain?old!.id:`${s.possession.id}:${p.id}:${s.tick}:${c.intent}`,possessionId:s.possession.id,kind:c.intent,sinceTick:retain?old!.sinceTick:s.tick,primaryId:retain?old!.primaryId:d.perception.primary?.id??null,targetId:c.targetId,target:c.target&&{...c.target},commitment:retain?old!.commitment:clamp(.4+d.advantage.value*.3+p.profile.composure*.15+d.advantage.momentum*.15,0,1),originalAdvantage:retain?old!.originalAdvantage:d.advantage.value,reason:d.reason,lastMotor:c.motor};
}
export function intelligenceRelevant(d:Decision,p:CorePlayer):boolean {
 const r=d.perception,sustained=!!d.previous&&['EXPLOIT_ADVANTAGE','ATTACK_NEXT_DEFENDER','BIND_HELP'].includes(d.previous.kind);
 // An unmarked stationary catch is not evidence that its receiver just beat
 // someone. Preserve V2's secure/read phase unless an actual moving threat or
 // a physically created receiver already gives the player a local answer.
 const usefulOverload=d.affordances.some(c=>c.intent==='BIND_HELP'&&['DRIVE','DRIBBLE'].includes(c.motor));
 const movingAdvantage=r.momentum>.5&&(d.advantage.freeCarrier||!!r.primary?.beaten||usefulOverload);
 const beyondPrimary=!!r.primary?.beaten&&r.primary.forwardMargin>.4;
 const createdRelease=d.affordances.some(c=>c.name==='BIND_AND_PASS')||r.receivers.some(x=>x.created&&x.advantage>.85&&x.quality>(r.shot?.quality??0)+.22);
 return p.kind==='FIELD_PLAYER'&&!['P','P2'].includes(p.role)&&(sustained||movingAdvantage||beyondPrimary||createdRelease);
}
export type DecisionTrace={id:string;tick:number;timeMs:number;playerId:string;possessionId:string;actionId:string|null;decision:Decision;actualMotor:string;actualTargetId:string|null};
export type DefensiveSituation='PRIMARY_THREAT'|'TEAMMATE_BEATEN'|'HELP_REQUIRED'|'HELP_ALREADY_PROVIDED'|'HANDOFF_AVAILABLE'|'RECOVERY_REQUIRED'|'CLEAR_CHANCE_DANGER'|'M6_RELEASED'|'WING_RELEASED'|'NUMERICAL_DISADVANTAGE'|'TRANSITION_DANGER';
export type DefensiveRead={situations:DefensiveSituation[];carrierId:string|null;primaryId:string|null;helperId:string|null;ownThreatId:string|null;system:'6:0'|'5:1';unit:{ballSide:number;engaged:number|null;shift:number;compact:number};reason:string};
export function perceiveDefence(s:CoreState,p:CorePlayer):DefensiveRead {
 const carrier=s.players.find(a=>a.id===s.ball.controllerId),opponents=courtPlayers(s,otherTeam(p.team)).filter(a=>a.kind==='FIELD_PLAYER'),team=courtPlayers(s,p.team).filter(d=>d.kind==='FIELD_PLAYER');
 const situations:DefensiveSituation[]=[];
 if(p.id===s.defence.pressureId)situations.push('PRIMARY_THREAT');
 if(carrier&&team.some(d=>distance(d.position,carrier.position)<4&&defenderRelation(carrier,d,goal(s.directions[carrier.team])).beaten))situations.push('TEAMMATE_BEATEN');
 if(p.duty.kind==='HELP')situations.push('HELP_REQUIRED');
 if(carrier&&s.defence.helperId&&team.some(d=>d.id===s.defence.helperId&&distance(d.position,carrier.position)<1.65))situations.push('HELP_ALREADY_PROVIDED');
 if(p.duty.kind==='RECOVER')situations.push('RECOVERY_REQUIRED');
 if(p.duty.targetId&&team.some(d=>d.id!==p.id&&d.duty.targetId===p.duty.targetId&&d.id===s.defence.pressureId))situations.push('HANDOFF_AVAILABLE');
 if(carrier&&local(carrier.position,s.directions[carrier.team]).y<8.3)situations.push('CLEAR_CHANCE_DANGER');
 const released=(role:string[])=>opponents.some(a=>a.id!==carrier?.id&&role.includes(a.role)&&!team.some(d=>distance(d.position,a.position)<1.6));
 if(released(['P','P2']))situations.push('M6_RELEASED');if(released(['LW','RW']))situations.push('WING_RELEASED');
 if(opponents.length>team.length)situations.push('NUMERICAL_DISADVANTAGE');if(s.possession.phase==='TRANSITION')situations.push('TRANSITION_DANGER');
 return{situations,carrierId:carrier?.id??null,primaryId:s.defence.pressureId,helperId:s.defence.helperId,ownThreatId:p.duty.targetId,system:s.defence.system,unit:{ballSide:Math.sign(s.ball.position.x-10),...s.defence.read},reason:p.duty.reason};
}
export type DefensiveTrace={id:string;tick:number;timeMs:number;playerId:string;possessionId:string;intent:TacticalIntent;read:DefensiveRead};
export type IntelligenceDiagnostics={capacity:number;traces:DecisionTrace[];defensiveTraces:DefensiveTrace[];decisions:number;intentChanges:number;intentTicks:number;closedIntents:number;oscillations:number;beatenPossessions:Set<string>;continued:Set<string>;helped:Set<string>;shots:Set<string>;passes:Set<string>;recycled:Set<string>;passesIncrease:number;passesReduce:number;bindPasses:number;last:Map<string,{intent:string;tick:number;observedTick:number;motor:string;priorMotor:string;possessionId:string}>};
const diagnostics=new WeakMap<CoreState,IntelligenceDiagnostics>();
export function enableDecisionTrace(s:CoreState,capacity=256) {
 if(!Number.isSafeInteger(capacity)||capacity<0||capacity>4096)throw Error('Invalid decision trace capacity');
 const d:IntelligenceDiagnostics={capacity,traces:[],defensiveTraces:[],decisions:0,intentChanges:0,intentTicks:0,closedIntents:0,oscillations:0,beatenPossessions:new Set(),continued:new Set(),helped:new Set(),shots:new Set(),passes:new Set(),recycled:new Set(),passesIncrease:0,passesReduce:0,bindPasses:0,last:new Map()};diagnostics.set(s,d);return d;
}
export function transferDecisionTrace(from:CoreState,to:CoreState){const d=diagnostics.get(from);if(d)diagnostics.set(to,d);}
export function traceDecision(s:CoreState,p:CorePlayer,d:Decision) {
 const diag=diagnostics.get(s);if(!diag)return;
 const motor=p.action?.kind??'NONE',key=d.perception.possessionId,old=diag.last.get(p.id),intent=p.handballIntent?.id??p.intent.id;
 diag.decisions++;if(old&&old.intent!==intent&&old.possessionId===key){diag.intentChanges++;if(!['PASS','SHOOT','JUMP'].includes(old.motor)){diag.intentTicks+=s.tick-old.tick;diag.closedIntents++;}}
 // Only rapid reversals qualify. A later return pass is a new receiving episode,
 // not evidence of a motor decision oscillating on adjacent readings.
 if(old&&s.tick-old.observedTick<=10&&old.possessionId===key&&old.priorMotor===motor&&old.motor!==motor&&['DRIVE','PASS'].includes(motor)&&['DRIVE','PASS'].includes(old.motor))diag.oscillations++;
 diag.last.set(p.id,{intent,tick:old?.intent===intent?old.tick:s.tick,observedTick:s.tick,motor,priorMotor:old?.motor??'',possessionId:key});
 if(d.perception.primary?.beaten){diag.beatenPossessions.add(key);if(['DRIVE','DRIBBLE'].includes(motor))diag.continued.add(key);if(d.perception.help?.committed)diag.helped.add(key);if(['SHOOT','JUMP'].includes(motor))diag.shots.add(key);if(motor==='PASS'){if(d.chosen?.name==='BIND_AND_PASS')diag.passes.add(key);else if(d.advantage.freeCarrier)diag.recycled.add(key);}}
 if(motor==='PASS'){const receiver=d.perception.receivers.find(x=>x.id===p.action?.targetId);if(receiver){if(receiver.advantage>d.advantage.value)diag.passesIncrease++;else diag.passesReduce++;if(receiver.created&&d.perception.help?.committed)diag.bindPasses++;}}
 if(diag.capacity){diag.traces.push({id:`${key}:${p.id}:${s.tick}`,tick:s.tick,timeMs:s.timeMs,playerId:p.id,possessionId:key,actionId:p.action?.id??null,decision:structuredClone(d),actualMotor:motor,actualTargetId:p.action?.targetId??null});if(diag.traces.length>diag.capacity)diag.traces.shift();}
}
export function whyDidPlayerAct(s:CoreState,playerId:string,possessionId:string,motor?:string){return diagnostics.get(s)?.traces.filter(t=>t.playerId===playerId&&t.possessionId===possessionId&&(!motor||t.actualMotor===motor))??[];}
export function traceDefensiveIntent(s:CoreState,p:CorePlayer){const diag=diagnostics.get(s);if(!diag?.capacity||!p.handballIntent)return;diag.defensiveTraces.push({id:`${s.possession.id}:${p.id}:${s.tick}:defence`,tick:s.tick,timeMs:s.timeMs,playerId:p.id,possessionId:s.possession.id,intent:p.handballIntent.kind,read:perceiveDefence(s,p)});if(diag.defensiveTraces.length>diag.capacity)diag.defensiveTraces.shift();}
export function whyDidDefenderHelp(s:CoreState,playerId:string,possessionId:string){return diagnostics.get(s)?.defensiveTraces.filter(t=>t.playerId===playerId&&t.possessionId===possessionId)??[];}
export function intelligenceMetrics(d:IntelligenceDiagnostics){const n=d.beatenPossessions.size;return{decisions:d.decisions,intentChanges:d.intentChanges,averageIntentSeconds:d.closedIntents?d.intentTicks*.05/d.closedIntents:null,drivePassOscillations:d.oscillations,beatenPossessions:n,continuedOwnThreat:n?d.continued.size/n:null,helpArrived:n?d.helped.size/n:null,shotAfterBeaten:n?d.shots.size/n:null,advantageousPassAfterBeaten:n?d.passes.size/n:null,recycledDespiteAdvantage:n?d.recycled.size/n:null,bindAndPass:d.bindPasses,passesIncreaseAdvantage:d.passesIncrease,passesReduceAdvantage:d.passesReduce};}
