/** Opt-in controlled encounters. Never imported by production selection. */
import assert from 'node:assert/strict';
import {createCoreScenario} from './scenarios';
import {createIntelligenceScenario} from './intelligenceScenarios';
import {buildProfile,type AttributeSheet} from './profile';
import {getPlayer,type CorePlayer,type CoreState} from './state';
import {execute,move,startAction} from './actions';
import {advanceBall,keeperReachForShot,resolveEffects} from './interactions';
import {executePass,planShotTarget,prepareKeeperAnticipation} from './execution';
import {advanceCoreMutable} from './engine';
import {affordancesFor,assessAdvantage,decideHandball,perceiveHandball,situationsFor} from './intelligence';
import {movementReadTicks,readMovementTarget} from './movement';
import {conditionAfter,recoverAtRest} from './condition';
import {secondsTo} from './timing';

export const trialSeed=(i:number)=>72683+i*104729;
function stagedScenario(name:Parameters<typeof createCoreScenario>[0],seed:number){const s=createCoreScenario(name,seed);s.rng={algorithm:'mulberry32',state:seed>>>0,draws:0};return s;}
const isolate=(s:CoreState,ids:string[])=>{for(const p of s.players)if(!ids.includes(p.id))p.population='BENCH';};
const fatigue=(p:CorePlayer,tired:boolean)=>{p.condition.energy=tired?.25:1;p.condition.acuteExertion=tired?.9:0;};
function begin(s:CoreState,p:CorePlayer,kind:Parameters<typeof startAction>[2],target:Parameters<typeof startAction>[4]=null,targetId:string|null=null,shotKind:Parameters<typeof startAction>[6]=null){assert.ok(startAction(s,p,kind,'Controlled integration encounter',target,targetId,shotKind));p.action!.phase='EXECUTING';}

export function passEncounter(i:number,attributes:AttributeSheet,base:AttributeSheet,context:'simple'|'moving'|'long'|'pressured',tired=false){
 const s=stagedScenario('ESTABLISHED_6V6',trialSeed(i)),p=getPlayer(s,'H03'),r=getPlayer(s,'H04'),d=getPlayer(s,'A03');
 isolate(s,[p.id,r.id,...(context==='pressured'?[d.id]:[])]);p.profile=buildProfile(attributes,'CB');r.profile=buildProfile(base,'RB');
 p.position={x:5,y:20};r.position=context==='simple'?{x:9,y:20}:context==='long'?{x:18,y:6}:{x:17,y:10};r.velocity={x:context==='moving'||context==='pressured'?3:0,y:0};d.position={x:6,y:19.3};d.action=null;s.ball.position={...p.position};fatigue(p,tired);p.handling.heldSinceTick=s.tick;
 return executePass(s,p,r,r.position);
}
export function catchEncounter(i:number,receiver:AttributeSheet,passer:AttributeSheet,base:AttributeSheet,context:'simple'|'awkward'|'pressured'|'moving',tired=false){
 const s=stagedScenario('ESTABLISHED_6V6',trialSeed(i)),p=getPlayer(s,'H03'),r=getPlayer(s,'H04'),d=getPlayer(s,'A03');
 const hard=context!=='simple';isolate(s,[p.id,r.id,...(context==='pressured'||context==='moving'?[d.id]:[])]);p.profile=buildProfile(passer,'CB');r.profile=buildProfile(receiver,'RB');d.profile=buildProfile(base,'CB');
 p.position={x:hard?2:5,y:hard?18:15};r.position={x:10,y:15};r.velocity={x:context==='moving'?3:0,y:0};d.position={x:context==='moving'?11.5:10,y:14.3};d.action=null;fatigue(r,tired);s.ball.position={...p.position};s.ball.controllerId=p.id;s.ball.live=true;
 begin(s,r,'RECEIVE',context==='moving'?{x:13,y:15}:null);begin(s,p,'PASS',null,r.id);resolveEffects(s,[{playerId:p.id,kind:'PASS'}]);assert.ok(s.ball.flight);
 const actionId=s.ball.flight.actionId,release=s.events.find(e=>e.type==='PASS_RELEASED'&&e.actionId===actionId)!;
 // An awkward delivery is a declared incoming-ball context, not receiver skill.
 if(context==='awkward')s.ball.flight.velocity.y+=.55;
 for(let t=0;t<70&&s.ball.flight?.kind==='PASS';t++){s.tick++;s.timeMs=s.tick*50;if(context==='moving')move(s,r,{x:13,y:15});advanceBall(s);}
 const events=s.events.filter(e=>e.actionId===actionId),caught=events.find(e=>e.type==='PASS_RECEIVED'),failed=events.find(e=>e.type==='RECEPTION_FAILED');
 return{caught:!!caught,failed:!!failed,reached:!!(caught||failed),risk:typeof(failed??caught)?.details.risk==='number'?Number((failed??caught)!.details.risk):null,deliveryError:Number(release.details.executionError),passingCapability:Number(release.details.passingCapability)};
}
export function carryEncounter(i:number,attributes:AttributeSheet,base:AttributeSheet,context:'open'|'fast'|'contact'|'breakthrough',tired=false){
 const s=stagedScenario('ESTABLISHED_6V6',trialSeed(i)),p=getPlayer(s,'H03'),d=getPlayer(s,'A03'),h=getPlayer(s,'A04');const challenged=context==='contact'||context==='breakthrough';
 isolate(s,[p.id,...(challenged?[d.id,h.id]:[])]);p.profile=buildProfile(attributes,'CB');p.position={x:10,y:15};p.velocity={x:context==='breakthrough'?2:0,y:context==='open'?-1:-4};d.position={x:10,y:14.3};h.position={x:10.7,y:15.1};
 for(const defender of [d,h])if(challenged){defender.profile=buildProfile(base,'CB');begin(s,defender,'CONTACT',null,p.id);}
 s.ball.position={...p.position};s.ball.controllerId=p.id;s.ball.live=true;fatigue(p,tired);begin(s,p,'DRIBBLE',{x:context==='breakthrough'?12:10,y:10});p.action!.executeTicks=100;p.handling.bounceTick=s.tick-4;s.ball.mode='DRIBBLE';execute(s);
 const bounce=s.events.findLast(e=>e.type==='DRIBBLE_BOUNCE'),mistouch=s.events.find(e=>e.type==='CONTROL_MISTOUCH');
 return{mistouch:!!mistouch,risk:Number(bounce?.details.risk??0),pressure:Number(bounce?.details.pressure??0),difficulty:Number(bounce?.details.difficulty??0),retainedCanonicalPossession:s.possession.team==='HOME',controller:s.ball.controllerId};
}
export function decisionEncounter(i:number,attributes:AttributeSheet,context:'free'|'bind'|'2v1'|'3v2'|'marginalShotPass'|'riskyPassRecycle',base:AttributeSheet){
 const name=context==='free'?'A_FREE_TO_GOAL':context==='bind'?'B_HELP_M6':context==='2v1'?'D_TWO_V_ONE':context==='3v2'?'E_THREE_V_TWO':'H_NO_ADVANTAGE';const{s,p}=createIntelligenceScenario(name,trialSeed(i));s.rng={algorithm:'mulberry32',state:trialSeed(i)>>>0,draws:0};for(const q of s.players)q.profile=buildProfile(q.id===p.id?attributes:base,q.role);const before=JSON.stringify(s);
 if(context==='marginalShotPass'||context==='riskyPassRecycle'){
  // The resolver is canonical; these are explicit controlled visible inputs.
  // No future outcome, hidden RNG or empirical statistic enters a valuation.
  const r=perceiveHandball(s,p);r.self.dribbleUsed=true;r.legalTravel=0;r.space.open=false;
  if(context==='marginalShotPass'){
   r.shot={quality:.32+(i%128)*.0025,distance:9,pressure:.7,blockThreat:.4,emptyGoal:false,containment:0,built:true};
   r.receivers=[{id:'H04',role:'RB',position:{x:14,y:9},velocity:{x:0,y:0},goalDistance:10,spacing:4,readiness:.8,laneSeconds:.15+(i%64)*.01,separation:2,created:false,creatorId:null,advantage:.7,quality:.6,angle:.4}];
  }else{
   r.shot=null;const receiver={id:'H04',role:'RB',position:{x:14,y:9},velocity:{x:0,y:0},goalDistance:10,spacing:4,readiness:.8,laneSeconds:.11+(i%32)*.01,separation:2,created:false,creatorId:null,advantage:.55+(i%128)*.0025,quality:.6,angle:.4};
   r.receivers=[receiver,{...receiver,id:'H02',advantage:.45,quality:.4,laneSeconds:1.2}];
  }
  const a=assessAdvantage(r),options=affordancesFor(r,a,situationsFor(r,a),null),chosen=options[0];assert.equal(JSON.stringify(s),before);
  return{choice:chosen?.motor??'NONE',name:chosen?.name??'NONE',target:chosen?.targetId??null,recognition:chosen?.components.recognition??0,scope:'Canonical affordance resolver with staged visible option facts'};
 }
 const d=decideHandball(s,p);assert.equal(JSON.stringify(s),before);return{choice:d.chosen?.motor??'NONE',name:d.chosen?.name??'NONE',target:d.chosen?.targetId??null,recognition:d.chosen?.components.recognition??0,scope:'Canonical current-state perception and selection'};
}
export function defenceEncounter(i:number,attributes:AttributeSheet,base:AttributeSheet,context:'contain'|'help'|'recover'|'handoff'){
 const s=stagedScenario('ESTABLISHED_6V6',trialSeed(i)),p=getPlayer(s,'H03'),d=getPlayer(s,'A03');isolate(s,[p.id,d.id]);p.position={x:10,y:7};d.profile=buildProfile(attributes,'CB');p.profile=buildProfile(base,'CB');d.position={x:7+(i%8)*.03,y:10};d.velocity={x:0,y:0};s.ball.position={...p.position};s.ball.controllerId=p.id;s.ball.live=true;
 const target={x:9,y:context==='contain'?10:8.5},kind=context==='help'?'HELP':context==='recover'?'RECOVER':context==='handoff'?'REPOSITION':'CONTAIN';d.duty={kind:context==='contain'?'PRESSURE':context==='help'?'HELP':context==='recover'?'RECOVER':'MARK',targetId:p.id,sinceTick:s.tick,reason:'Same geometric responsibility'};begin(s,d,kind,target);const readTicks=movementReadTicks(s,d),predictedSeconds=secondsTo(s,d,target);let adapt=0;
 if(context!=='contain'){d.motion={mode:'SHIFT',relation:'prior owner',target:{x:7,y:10},reviewTick:s.tick+30};readMovementTarget(s,d,target);adapt=d.motion.reviewTick-s.tick;}
 let arrival=100;for(let t=0;t<100;t++){s.tick++;move(s,d,context!=='contain'?readMovementTarget(s,d,target):target);if(Math.hypot(d.position.x-target.x,d.position.y-target.y)<.1){arrival=t+1;break;}}
 return{arrivalTicks:arrival,readTicks,adaptTicks:adapt,predictedSeconds,physicalTopSpeed:d.profile.topSpeed,physicalAcceleration:d.profile.acceleration};
}
export type ShotEncounterContext='clear'|'medium'|'difficult'|'wing'|'penalty';
export function shotEncounter(i:number,attributes:AttributeSheet,keeperAttributes:AttributeSheet,base:AttributeSheet,context:ShotEncounterContext,tired=false){
 const s=stagedScenario('BACKCOURT_SHOT',trialSeed(i)),p=getPlayer(s,'H03'),k=getPlayer(s,'A07'),d=getPlayer(s,'A03');const pressure=context==='medium'||context==='difficult';isolate(s,[p.id,k.id,...(pressure?[d.id]:[])]);p.profile=buildProfile(attributes,'LB');k.profile=buildProfile(keeperAttributes,'GK');d.profile=buildProfile(base,'CB');
 p.position=context==='wing'?{x:2,y:6}:{x:10,y:context==='clear'||context==='penalty'?6.8:context==='medium'?8.8:10.5};p.velocity={x:context==='difficult'?3:0,y:0};k.position={x:10,y:1.4};d.position={x:pressure?8.9:3,y:context==='medium'?8.3:10};d.action=null;fatigue(p,tired);s.ball.position={...p.position};s.ball.controllerId=p.id;s.ball.live=true;s.checkpoint.stopOnOutcome=false;
 begin(s,p,'SHOOT',null,null,context==='penalty'?'SEVEN_METRE':context==='wing'?'WING':context==='difficult'?'BACKCOURT_JUMP':'BREAKTHROUGH');const plan=planShotTarget(s,p,i%2?-1:1);p.action!.target={x:plan.aimX,y:0};begin(s,k,'SAVE',{...k.position});p.action!.phase='COMMITTED';prepareKeeperAnticipation(s,k,p);
 for(let t=0;t<6;t++){s.tick++;s.timeMs=s.tick*50;move(s,k,k.action!.target,true);}p.action!.phase='EXECUTING';resolveEffects(s,[{playerId:p.id,kind:'SHOOT'}]);assert.ok(s.ball.flight);const actionId=s.ball.flight.actionId,reach=keeperReachForShot(s,k,s.ball.flight,{x:k.position.x+.4,y:k.position.y});
 for(let t=0;t<100&&s.status==='RUNNING'&&s.ball.flight?.actionId===actionId;t++)advanceCoreMutable(s);
 const events=s.events.filter(e=>e.actionId===actionId),goal=events.some(e=>e.type==='GOAL'),caught=events.some(e=>e.type==='SAVE_CAUGHT'),parry=events.some(e=>e.type==='SAVE_PARRY');return{goal,caught,parry,parryThenGoal:parry&&goal,resolved:s.ball.flight?.actionId!==actionId,spread:plan.spread,placement:plan.placement,reach,keeperReads:s.events.filter(e=>e.type==='KEEPER_FLIGHT_READ').length};
}
export function physicalEncounter(attributes:AttributeSheet){const s=createCoreScenario('ESTABLISHED_6V6',9187),p=getPlayer(s,'H03');isolate(s,[p.id]);s.officialClock.running=true;p.profile=buildProfile(attributes,'CB');p.velocity={x:4,y:0};for(let i=0;i<2400;i++){p.velocity=i%16<8?{x:4,y:0}:{x:0,y:4};conditionAfter(s);s.tick++;}const energy=p.condition.energy,acute=p.condition.acuteExertion;recoverAtRest(p,10000);return{energy,acute,restEnergy:p.condition.energy,restAcute:p.condition.acuteExertion,physical:p.condition.physicalLoad};}

export function interceptionEncounter(i:number,attributes:AttributeSheet,base:AttributeSheet,impossible=false){
 const s=stagedScenario('ESTABLISHED_6V6',trialSeed(i)),p=getPlayer(s,'H03'),r=getPlayer(s,'H04'),d=getPlayer(s,'A03');isolate(s,[p.id,r.id,d.id]);p.profile=buildProfile(base,'CB');r.profile=buildProfile(base,'RB');d.profile=buildProfile(attributes,'CB');p.position={x:4,y:15};r.position={x:16,y:15};d.position={x:10,y:15+(impossible?2:.25+(i%24)*.015)};s.ball.position={...p.position};begin(s,r,'RECEIVE');begin(s,d,'PRESS',null,p.id);begin(s,p,'PASS',null,r.id);resolveEffects(s,[{playerId:p.id,kind:'PASS'}]);
 for(let t=0;t<50&&s.ball.flight?.kind==='PASS';t++){s.tick++;s.timeMs=s.tick*50;advanceBall(s);}return{intercepted:s.events.some(e=>e.type==='INTERCEPTION'),received:s.events.some(e=>e.type==='PASS_RECEIVED'),fumbled:s.events.some(e=>e.type==='RECEPTION_FAILED'),deflected:s.events.some(e=>e.type==='PASS_DEFLECTED'),out:s.events.some(e=>e.type==='BALL_OUT')};
}
