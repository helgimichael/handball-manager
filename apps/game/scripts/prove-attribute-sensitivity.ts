/** Read-only, paired short encounters. No calibration, runtime hooks or outcome targets. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createCoreScenario} from '@handball-manager/handball-engine/src/v2/core/scenarios';
import {getPlayer,type CorePlayer,type CoreState,type Role} from '@handball-manager/handball-engine/src/v2/core/state';
import {buildProfile,OUTCOURT_KEYS,KEEPER_KEYS,type AttributeSheet} from '@handball-manager/handball-engine/src/v2/core/profile';
import {startAction,move} from '@handball-manager/handball-engine/src/v2/core/actions';
import {resolveEffects,advanceBall,keeperReachForShot} from '@handball-manager/handball-engine/src/v2/core/interactions';
import {advanceCoreMutable} from '@handball-manager/handball-engine/src/v2/core/engine';
import {executePass,planShotTarget,prepareKeeperAnticipation,receptionRisk} from '@handball-manager/handball-engine/src/v2/core/execution';
import {conditionAfter,accelerationCapacity,recoverAtRest} from '@handball-manager/handball-engine/src/v2/core/condition';
import {secondsTo} from '@handball-manager/handball-engine/src/v2/core/timing';
import {decideHandball} from '@handball-manager/handball-engine/src/v2/core/intelligence';
import {movementReadTicks} from '@handball-manager/handball-engine/src/v2/core/movement';
import {resolveContacts} from '@handball-manager/handball-engine/src/v2/core/contact';
import {dutyTarget,type ZoneDuty} from '@handball-manager/handball-engine/src/v2/core/defence';

type Key=keyof AttributeSheet;
type Rating={playerId:string;position:string;branch:{branch:string;attributes:Record<string,{value:number;origin:string}>}};
type Input={gameplayRatings:Record<string,Rating[]>;worldSquads:Record<string,{id:string;firstName:string;lastName:string}[]>};
type Tier='low'|'mid'|'high';
const tiers:Tier[]=['low','mid','high'];
const physicalKeys:Key[]=['ACCELERATION','TOP_SPEED','LATERAL_QUICKNESS','AGILITY','EXPLOSIVENESS','STRENGTH','CONTACT_BALANCE','JUMP_ABILITY','ENDURANCE','REPEAT_SPRINT_ABILITY','MOBILITY'];
const args=process.argv.slice(2),nArg=args.indexOf('--trials'),n=nArg<0?64:Number(args[nArg+1]);
if(!Number.isSafeInteger(n)||n<16||n>256)throw Error('--trials must be 16..256');
const inputPath=resolve('../../docs/physical-load-fatigue-v11/final/allsv/inputs.json');
const inputText=readFileSync(inputPath,'utf8'),input=JSON.parse(inputText) as Input;
const rows=Object.values(input.gameplayRatings).flat();
const digest=(value:unknown)=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const quantile=(values:number[],q:number)=>values.slice().sort((a,b)=>a-b)[Math.floor((values.length-1)*q)];
const ranges=Object.fromEntries([...OUTCOURT_KEYS,...KEEPER_KEYS].map(key=>{
 const values=rows.map(r=>r.branch.attributes[key]?.value).filter((v):v is number=>Number.isFinite(v));
 assert.ok(values.length,`No real source values for ${key}`);
 return[key,{n:values.length,min:Math.min(...values),low:quantile(values,.1),mid:quantile(values,.5),high:quantile(values,.9),max:Math.max(...values)}];
})) as Record<Key,{n:number;min:number;low:number;mid:number;high:number;max:number}>;
const baseline:AttributeSheet=Object.fromEntries([...OUTCOURT_KEYS,...KEEPER_KEYS].map(k=>[k,ranges[k].mid]));
const sheet=(keys:readonly Key[],tier:Tier):AttributeSheet=>({...baseline,...Object.fromEntries(keys.map(k=>[k,ranges[k][tier]]))});
const mean=(values:number[])=>values.reduce((a,b)=>a+b,0)/values.length;
const seed=(i:number)=>72683+i*104729;
function isolate(s:CoreState,ids:string[]){for(const p of s.players)if(!ids.includes(p.id)){p.population='BENCH';p.zone=null;}}
function fatigue(p:CorePlayer,tired:boolean){p.condition.energy=tired?.25:1;p.condition.acuteExertion=tired?.9:0;}
function begin(s:CoreState,p:CorePlayer,kind:Parameters<typeof startAction>[2],target:Parameters<typeof startAction>[4]=null,targetId:string|null=null,shotKind:Parameters<typeof startAction>[6]=null){
 assert.ok(startAction(s,p,kind,'Controlled attribute sensitivity encounter',target,targetId,shotKind),`Illegal staged ${kind}`);
 p.action!.phase='EXECUTING';
}
type ShotContext='clear'|'medium'|'difficult'|'wing'|'penalty';
function shotTrial(i:number,attributes:AttributeSheet,context:ShotContext,tired=false,keeperSheet:AttributeSheet=baseline){
 const s=createCoreScenario('BACKCOURT_SHOT',seed(i)),p=getPlayer(s,'H03'),k=getPlayer(s,'A07'),d=getPlayer(s,'A03');
 const pressure=context==='medium'||context==='difficult';isolate(s,['H03','A07',...(pressure?['A03']:[])]);
 p.profile=buildProfile(attributes,'LB');k.profile=buildProfile(keeperSheet,'GK');d.profile=buildProfile(baseline,'CB');
 p.position=context==='wing'?{x:2,y:6}:{x:10,y:context==='clear'||context==='penalty'?6.8:context==='medium'?8.8:10.5};
 p.velocity={x:context==='difficult'?3:0,y:0};k.position={x:10,y:1.4};d.position={x:pressure?8.9:3,y:context==='medium'?8.3:10};
 d.action=null;fatigue(p,tired);s.ball.position={...p.position};s.ball.controllerId=p.id;s.ball.live=true;s.checkpoint.stopOnOutcome=false;
 begin(s,p,'SHOOT',null,null,context==='penalty'?'SEVEN_METRE':context==='wing'?'WING':context==='difficult'?'BACKCOURT_JUMP':'BREAKTHROUGH');
 const plan=planShotTarget(s,p,i%2?-1:1);p.action!.target={x:plan.aimX,y:0};
 begin(s,k,'SAVE',{...k.position});p.action!.phase='COMMITTED';prepareKeeperAnticipation(s,k,p);
 for(let step=0;step<6;step++){s.tick++;s.timeMs=s.tick*50;move(s,k,k.action!.target,true);}
 p.action!.phase='EXECUTING';resolveEffects(s,[{playerId:p.id,kind:'SHOOT'}]);
 assert.equal(s.ball.flight?.kind,'SHOT','The real legal release must occur');
 const actionId=s.ball.flight!.actionId,flight=structuredClone(s.ball.flight!),release=s.events.find(e=>e.type==='SHOT_RELEASED'&&e.actionId===actionId)!;
 const reach=keeperReachForShot(s,k,flight,{x:k.position.x+.4,y:k.position.y});
 // A parry/field block is not necessarily the end of the released trajectory.
 // Advance the full canonical tick so released-shot perception and keeper
 // commitment/re-aiming run, as well as body movement, flight and deflections.
 for(let step=0;step<80&&s.status==='RUNNING'&&s.ball.flight?.actionId===actionId;step++){
  advanceCoreMutable(s);
 }
 const events=s.events.filter(e=>e.actionId===actionId),goal=events.some(e=>e.type==='GOAL'),caught=events.some(e=>e.type==='SAVE_CAUGHT'),parry=events.some(e=>e.type==='SAVE_PARRY');
 const block=events.some(e=>e.type==='SHOT_BLOCKED'),offTargetTouch=events.some(e=>e.type==='KEEPER_COLLECTED_OFF_TARGET'||e.type==='OFF_TARGET_KEEPER_TOUCH'),out=events.some(e=>e.type==='BALL_OUT');
 const unresolved=s.ball.flight?.actionId===actionId;
 const outcome=unresolved?'UNRESOLVED':goal?'GOAL':caught?'SAVE_CAUGHT':parry?'SAVE_PARRY':block?'BLOCKED':offTargetTouch?'OFF_TARGET_KEEPER_TOUCH':out?'OUT':'UNRESOLVED';
 return{outcome,goal:outcome==='GOAL',caught:outcome==='SAVE_CAUGHT',parry:outcome==='SAVE_PARRY',block:outcome==='BLOCKED',offTargetTouch:outcome==='OFF_TARGET_KEEPER_TOUCH',out:outcome==='OUT',parryEvent:parry,parryThenGoal:parry&&goal,keeperFlightReads:s.events.filter(e=>e.type==='KEEPER_FLIGHT_READ'&&e.actorId===k.id).length,placement:plan.placement,spread:plan.spread,pressure:plan.context.pressure,pace:Number(release.details.releasePace),aimError:Number(release.details.aimErrorMetres),reach,rngDraws:s.rng.draws};
}
function shotCell(name:string,keys:Key[],tier:Tier,context:ShotContext,tired=false,keeper=false,custom?:AttributeSheet){
 const altered=custom??sheet(keys,tier),trials=Array.from({length:n},(_,i)=>shotTrial(i,keeper?baseline:altered,context,tired,keeper?altered:baseline));
 const count=(key:'goal'|'caught'|'parry'|'block'|'out'|'offTargetTouch')=>trials.filter(t=>t[key]).length;
 const unresolved=trials.filter(t=>t.outcome==='UNRESOLVED').length,resolved=n-unresolved;
 return{name,keys,tier,raw:Object.fromEntries(keys.map(k=>[k,altered[k]])),context,tired,n,acceptedOutcomes:resolved,unresolved,goals:count('goal'),conversion:resolved?count('goal')/resolved:null,caught:count('caught'),parried:count('parry'),blocks:count('block'),out:count('out'),offTargetKeeperTouches:count('offTargetTouch'),parryEvents:trials.filter(t=>t.parryEvent).length,parryThenGoals:trials.filter(t=>t.parryThenGoal).length,keeperFlightReadTrials:trials.filter(t=>t.keeperFlightReads>0).length,placement:mean(trials.map(t=>t.placement)),spread:mean(trials.map(t=>t.spread)),pace:mean(trials.map(t=>t.pace)),aimError:mean(trials.map(t=>t.aimError)),keeperReachAtReleaseProbe:mean(trials.map(t=>t.reach)),pressure:trials[0].pressure,trialDigest:digest(trials)};
}
const shotCells:ReturnType<typeof shotCell>[]=[];
for(const context of ['clear','medium','difficult'] as const)for(const tired of [false,true])for(const tier of tiers)
 shotCells.push(shotCell('shootingTechnique',['SHOOTING_PLACEMENT','FINISHING'],tier,context,tired));
for(const tier of tiers){shotCells.push(shotCell('shootingPower',['SHOOTING_POWER'],tier,'medium'));shotCells.push(shotCell('wingTechnique',['WING_FINISHING'],tier,'wing'));}
// A coherent technical group, with all eleven physical keys held exactly at the same median.
const technicalKeys=OUTCOURT_KEYS.filter(k=>!physicalKeys.includes(k));
for(const tier of tiers)for(const key of physicalKeys)assert.equal(sheet(technicalKeys,tier)[key],baseline[key],'Technical profiles must preserve every physical rating');
const technicalCells=tiers.flatMap(tier=>['clear','difficult'].flatMap(c=>[false,true].map(tired=>shotCell('equalPhysicalTechnicalProfile',technicalKeys.slice(),tier,c as ShotContext,tired))));
const keeperCells=[];
for(const [name,keys,context] of [
 ['keeperReaction',['REACTION'],'clear'],['keeperExplosiveness',['GK_EXPLOSIVENESS'],'medium'],
 ['keeperPositioning',['GK_POSITIONING','SET_POSITION'],'clear'],['keeperReading',['SHOOTER_READING','SHOT_ANTICIPATION'],'clear'],
 ['keeperHeight',['LOW_SAVES','HIGH_SAVES'],'medium'],['keeperClose',['CLOSE_RANGE_SAVES'],'clear'],
 ['keeperLong',['LONG_RANGE_SAVES'],'difficult'],['keeperWing',['WING_SAVES'],'wing'],['keeperPenalty',['SEVEN_M_SAVES'],'penalty'],
] as [string,Key[],ShotContext][])for(const tier of tiers)keeperCells.push(shotCell(name,keys,tier,context,false,true));

function passSignal(keys:Key[],tier:Tier,hard:boolean,tired:boolean,i:number){
 const s=createCoreScenario('ESTABLISHED_6V6',seed(i)),p=getPlayer(s,'H03'),r=getPlayer(s,'H04'),d=getPlayer(s,'A03');
 isolate(s,['H03','H04',...(hard?['A03']:[])]);p.profile=buildProfile(sheet(keys,tier),'CB');r.profile=buildProfile(baseline,'RB');
 p.position={x:5,y:20};r.position=hard?{x:17,y:10}:{x:9,y:20};r.velocity={x:hard?3:0,y:0};d.position={x:6,y:19.3};d.action=null;
 s.ball.position={...p.position};fatigue(p,tired);p.handling.heldSinceTick=s.tick;
 return executePass(s,p,r,r.position);
}
const passingCells=tiers.flatMap(tier=>[false,true].flatMap(hard=>[false,true].map(tired=>{
 const trials=Array.from({length:n},(_,i)=>passSignal(['PASSING'],tier,hard,tired,i));
 return{tier,keys:['PASSING'],raw:ranges.PASSING[tier],hard,tired,n,acceptedExecutions:trials.length,outcomeRates:null,spread:trials[0].spread,difficulty:trials[0].difficulty,pace:trials[0].speed,meanError:mean(trials.map(t=>t.error)),meanCapability:mean(trials.map(t=>t.capability)),trialDigest:digest(trials)};
})));
function catchTrial(i:number,attributes:AttributeSheet,hard:boolean,tired:boolean,passerAttributes:AttributeSheet=baseline,fatiguePasser=false){
 const s=createCoreScenario('ESTABLISHED_6V6',seed(i)),p=getPlayer(s,'H03'),r=getPlayer(s,'H04'),d=getPlayer(s,'A03');
 isolate(s,['H03','H04',...(hard?['A03']:[])]);p.profile=buildProfile(passerAttributes,'CB');r.profile=buildProfile(attributes,'RB');
 p.position={x:5,y:15};r.position={x:10,y:15};r.velocity={x:hard?3:0,y:0};d.position={x:10,y:14.3};d.action=null;fatigue(r,tired);
 fatigue(p,fatiguePasser&&tired);s.ball.position={...p.position};begin(s,r,'RECEIVE');begin(s,p,'PASS',null,r.id);resolveEffects(s,[{playerId:p.id,kind:'PASS'}]);
 const actionId=s.ball.flight!.actionId,pace=Math.hypot(s.ball.flight!.velocity.x,s.ball.flight!.velocity.y),risk=receptionRisk(s,r,r.position,pace);
 const release=s.events.find(e=>e.type==='PASS_RELEASED'&&e.actionId===actionId)!;
 for(let step=0;step<40&&s.ball.flight?.kind==='PASS';step++){s.tick++;s.timeMs=s.tick*50;advanceBall(s);}
 const events=s.events.filter(e=>e.actionId===actionId),received=events.some(e=>e.type==='PASS_RECEIVED'),failed=events.some(e=>e.type==='RECEPTION_FAILED');
 assert.ok(received||failed,'Actual pass must reach its staged catch');return{received,failed,risk,pace,executionError:Number(release.details.executionError),passingCapability:Number(release.details.passingCapability)};
}
const receptionCells=tiers.flatMap(tier=>[false,true].flatMap(hard=>[false,true].map(tired=>{
 const trials=Array.from({length:n*2},(_,i)=>catchTrial(i,sheet(['BALL_HANDLING'],tier),hard,tired));
 return{tier,keys:['BALL_HANDLING'],raw:ranges.BALL_HANDLING[tier],hard,tired,n:trials.length,acceptedOutcomes:trials.length,unresolved:0,received:trials.filter(t=>t.received).length,failed:trials.filter(t=>t.failed).length,failureRate:trials.filter(t=>t.failed).length/trials.length,centreRisk:trials[0].risk,trialDigest:digest(trials)};
})));
const technicalPassingCells=tiers.flatMap(tier=>[false,true].flatMap(hard=>[false,true].map(tired=>{
 const trials=Array.from({length:n},(_,i)=>passSignal(technicalKeys,tier,hard,tired,i));
 return{tier,keys:technicalKeys,physicalRatings:Object.fromEntries(physicalKeys.map(k=>[k,baseline[k]])),hard,tired,n,acceptedExecutions:trials.length,outcomeRates:null,spread:trials[0].spread,difficulty:trials[0].difficulty,pace:trials[0].speed,meanError:mean(trials.map(t=>t.error)),meanCapability:mean(trials.map(t=>t.capability)),trialDigest:digest(trials)};
})));
const technicalReceptionCells=tiers.flatMap(tier=>[false,true].flatMap(hard=>[false,true].map(tired=>{
 const attributes=sheet(technicalKeys,tier),trials=Array.from({length:n*2},(_,i)=>catchTrial(i,attributes,hard,tired,attributes,true));
 return{tier,keys:technicalKeys,actorsVaried:['passer','receiver'],physicalRatings:Object.fromEntries(physicalKeys.map(k=>[k,baseline[k]])),hard,tired,n:trials.length,acceptedOutcomes:trials.length,unresolved:0,received:trials.filter(t=>t.received).length,failed:trials.filter(t=>t.failed).length,failureRate:trials.filter(t=>t.failed).length/trials.length,centreRisk:trials[0].risk,pace:trials[0].pace,meanExecutionError:mean(trials.map(t=>t.executionError)),meanPassingCapability:mean(trials.map(t=>t.passingCapability)),trialDigest:digest(trials)};
})));
function feint(i:number,keys:Key[],tier:Tier,attacker=false){
 const s=createCoreScenario('PIVOT_2V2',seed(i)),p=getPlayer(s,'H03'),d=getPlayer(s,'A03');isolate(s,['H03','A03']);
 p.profile=buildProfile(attacker?sheet(keys,tier):baseline,'CB');d.profile=buildProfile(attacker?baseline:sheet(keys,tier),'CB');
 resolveEffects(s,[{playerId:p.id,kind:'FEINT'}]);const result=s.contests.find(c=>c.kind==='DUEL');assert.ok(result);
 return{wrongFooted:result.outcome==='WRONG_FOOTED',margin:result.margin,draws:s.rng.draws};
}
const duelCells=([['breakthrough',['BREAKTHROUGH'],true],['defensiveFootwork',['LATERAL_DEFENCE','DEFENSIVE_TIMING'],false]] as [string,Key[],boolean][]).flatMap(([name,keys,attacker])=>tiers.map(tier=>{
 const trials=Array.from({length:n*2},(_,i)=>feint(i,keys,tier,attacker));return{name,keys,tier,n:trials.length,acceptedOutcomes:trials.length,unresolved:0,wrongFooted:trials.filter(t=>t.wrongFooted).length,composed:trials.filter(t=>!t.wrongFooted).length,wrongFootedRate:trials.filter(t=>t.wrongFooted).length/trials.length,meanMargin:mean(trials.map(t=>t.margin)),trialDigest:digest(trials)};
}));
function interception(i:number,tier:Tier,offset:number){
 const s=createCoreScenario('ESTABLISHED_6V6',seed(i)),p=getPlayer(s,'H03'),r=getPlayer(s,'H04'),d=getPlayer(s,'A03');isolate(s,['H03','H04','A03']);
 p.profile=buildProfile(baseline,'CB');r.profile=buildProfile(baseline,'RB');d.profile=buildProfile(sheet(['BALL_WINNING'],tier),'CB');
 p.position={x:4,y:15};r.position={x:16,y:15};d.position={x:10,y:15+offset};s.ball.position={...p.position};
 begin(s,r,'RECEIVE');begin(s,d,'PRESS',null,p.id);begin(s,p,'PASS',null,r.id);resolveEffects(s,[{playerId:p.id,kind:'PASS'}]);
 for(let step=0;step<50&&s.ball.flight?.kind==='PASS';step++){s.tick++;s.timeMs=s.tick*50;advanceBall(s);}
 return{intercepted:s.events.some(e=>e.type==='INTERCEPTION'),received:s.events.some(e=>e.type==='PASS_RECEIVED'),failed:s.events.some(e=>e.type==='RECEPTION_FAILED'),out:s.events.some(e=>e.type==='BALL_OUT'),grasp:.22+.33*d.profile.ballWinning};
}
const interceptionCells=tiers.map(tier=>{
 const trials=Array.from({length:24},(_,o)=>Array.from({length:16},(_,i)=>interception(i,tier,.25+o*.015))).flat();
 const accepted=trials.filter(t=>t.intercepted||t.received||t.failed||t.out).length;
 return{tier,key:'BALL_WINNING',raw:ranges.BALL_WINNING[tier],n:trials.length,acceptedOutcomes:accepted,unresolved:trials.length-accepted,design:'24 identical absolute lane offsets (0.25..0.595 m), 16 paired throw seeds each; ready PRESS defender; no receiver/future-state knowledge',interceptions:trials.filter(t=>t.intercepted).length,passReceived:trials.filter(t=>t.received).length,failedReceptions:trials.filter(t=>t.failed).length,out:trials.filter(t=>t.out).length,handReach:trials[0].grasp,trialDigest:digest(trials)};
});
const physicalCells=physicalKeys.flatMap(key=>tiers.map(tier=>{
 const s=createCoreScenario(),p=getPlayer(s,'A03');isolate(s,['A03']);p.profile=buildProfile(sheet([key],tier),'CB');p.position={x:10,y:20};p.velocity={x:-3,y:0};fatigue(p,true);
 const target={x:14,y:20},arrival=secondsTo(s,p,target),capacity=accelerationCapacity(p,1);
 p.duty.kind='RECOVER';begin(s,p,'RECOVER',target);
 for(let tick=0;tick<20;tick++){s.tick++;s.timeMs=s.tick*50;move(s,p,target);}
 const recoveryDistanceAfterOneSecond=4-Math.hypot(target.x-p.position.x,target.y-p.position.y);
 p.position={x:10,y:20};p.condition.energy=.8;p.condition.acuteExertion=0;
 for(let tick=0;tick<2400;tick++){p.velocity={x:tick%40<20?4:-4,y:0};conditionAfter(s);}
 const afterWork=structuredClone(p.condition);recoverAtRest(p,10000);
 return{key,tier,raw:ranges[key][tier],n:1,workTicks:2400,arrivalSecondsAtSameFatigue:arrival,turningAccelerationCapacityAtSameFatigue:capacity,recoveryDistanceAfterOneSecond,energyAfter120Seconds:afterWork.energy,acuteAfter120Seconds:afterWork.acuteExertion,acuteAfter10SecondsRest:p.condition.acuteExertion,load:afterWork.physicalLoad};
}));
const decisionCells=tiers.map(tier=>{
 const s=createCoreScenario('DEFENSIVE_HELP',5417),p=getPlayer(s,'H03');p.profile=buildProfile(sheet(['DECISION_MAKING','GAME_READING','ANTICIPATION'],tier),'CB');
 const before=digest(s),read=decideHandball(s,p);assert.equal(digest(s),before,'Pure decision diagnostic must not mutate state');
 const helper=getPlayer(s,'A03');helper.profile=buildProfile(sheet(['GAME_READING','ANTICIPATION'],tier),'CB');helper.duty.kind='RECOVER';helper.action=null;begin(s,helper,'RECOVER',{x:14,y:15});
 return{tier,keys:['DECISION_MAKING','GAME_READING','ANTICIPATION'],n:1,chosen:read.chosen?.name??null,affordances:read.affordances.map(a=>({name:a.name,targetId:a.targetId,value:a.value,capability:a.components.capability,risk:a.components.risk})),perceivedDecision:read.perception.capability.decision,reaction:p.profile.reaction,recoveryReadTicks:movementReadTicks(s,helper),geometryHash:digest({self:read.perception.self.position,primary:read.perception.primary,space:read.perception.space}),nonMutating:true};
});
const containmentCells=tiers.map(tier=>{
 const s=createCoreScenario(),p=getPlayer(s,'H03'),d=getPlayer(s,'A03');isolate(s,['H03','A03']);p.profile=buildProfile(baseline,'CB');d.profile=buildProfile(sheet(['DEFENSIVE_POSITIONING','DEFENSIVE_TIMING','COVERING'],tier),'CB');
 p.position={x:10,y:10};d.position={x:10,y:9.3};s.ball.position={...p.position};s.defence.pressureId=d.id;d.zone=2;
 begin(s,p,'DRIVE',{x:10,y:8},d.id);begin(s,d,'CONTACT',null,p.id);d.action!.contact={technique:'BENT_ARMS',approach:'FRONT'};resolveContacts(s);
 const read={engaged:2,ballX:10,shift:0,compact:1};
 const pressureTarget=dutyTarget(s,d,{kind:'PRESSURE',targetId:p.id,reason:'same assigned owner'} as ZoneDuty,read,'TOP');
 const helpTarget=dutyTarget(s,d,{kind:'HELP',targetId:p.id,reason:'same assigned owner'} as ZoneDuty,read,'TOP');
 return{tier,keys:['DEFENSIVE_POSITIONING','DEFENSIVE_TIMING','COVERING'],n:1,acceptedOutcomes:1,legalContact:s.events.some(e=>e.type==='LEGAL_CONTACT'),carrierInterrupted:p.action?.phase==='INTERRUPTED',pressureTarget,helpTarget,note:'Reached frontal containment remains a spatial/legal contract; these attributes shape approach and help geometry, not a contact-success roll.'};
});
const roleMap:Record<string,Role>={V6:'LW',H6:'RW',V9:'LB',H9:'RB',M9:'CB',M6:'P',GK:'GK'};
const people=new Map(Object.values(input.worldSquads).flat().map(p=>[p.id,p]));
const rosterCells=Object.keys(roleMap).map(position=>{
 const candidates=rows.filter(r=>r.position===position).sort((a,b)=>a.playerId.localeCompare(b.playerId));
 const selected=candidates[Math.floor(candidates.length/2)];assert.ok(selected);const raw=Object.fromEntries(Object.entries(selected.branch.attributes).map(([k,v])=>[k,v.value])) as AttributeSheet;
 const profile=buildProfile(raw,roleMap[position]);assert.ok(profile.source.complete);const person=people.get(selected.playerId);
 return{playerId:selected.playerId,name:person?`${person.firstName} ${person.lastName}`:selected.playerId,position,engineRole:roleMap[position],selection:'ID-sorted median per real roster position; not ability-ranked',origins:Object.fromEntries(Object.entries(selected.branch.attributes).map(([k,v])=>[k,v.origin])),raw,profile,...(position==='GK'?{shotCells:['clear','difficult'].map(c=>shotCell('realRosterKeeper',[], 'mid',c as ShotContext,false,true,raw))}:{shotCells:['clear','difficult'].map(c=>shotCell('realRosterOutcourt',[],'mid',c as ShotContext,false,false,raw))})};
});
const specificity=OUTCOURT_KEYS.map(key=>{
 const low=buildProfile(sheet([key],'low'),'CB'),high=buildProfile(sheet([key],'high'),'CB');
 return{key,rawLow:ranges[key].low,rawHigh:ranges[key].high,changedCapacities:Object.keys(low).filter(k=>k!=='source'&&JSON.stringify(low[k as keyof typeof low])!==JSON.stringify(high[k as keyof typeof high]))};
});
assert.deepEqual(shotTrial(3,baseline,'difficult',true),shotTrial(3,baseline,'difficult',true),'Same seed/context must reproduce complete short outcome');
assert.deepEqual(catchTrial(3,baseline,true,true),catchTrial(3,baseline,true,true));
const sourceFiles=['profile.ts','execution.ts','interactions.ts','actions.ts','condition.ts','physicalLoad.ts','timing.ts','intelligence.ts','contact.ts','movement.ts','defence.ts','structure.ts','engine.ts'];
const sourceFingerprints=Object.fromEntries(sourceFiles.map(f=>[f,digest(readFileSync(resolve('../../packages/handball-engine/src/v2/core',f),'utf8'))]));
const report={
 complete:true,createdAt:new Date().toISOString(),trialsPerShotCell:n,
 input:{path:'docs/physical-load-fatigue-v11/final/allsv/inputs.json',sha256:digest(inputText),players:rows.length,attributeValues:'Retained production gameplay rating branches, including generated-prior provenance. No use of CA/PA.'},
 design:{
  tiers:'Observed per-key nearest-rank p10/p50/p90; exact values reported. One key or named tightly related group varied; unrelated attributes fixed at their per-key median.',
  pairedSeeds:'72683 + i * 104729 in every repeated cell',
  fixed:'Same scenario, identities, initial target geometry, keeper baseline, ball physics and physical condition unless explicitly varied.',
  outcomes:'Canonical action commitment/release, full advanceCoreMutable ticks for released shots and their deflections, advanceBall for staged catch/interception encounters; no forced outcomes or acceptance conversion targets.',
  executionBoundary:'Shot cells run canonical released-shot perception, keeper flight reading, commitment, body movement, flight, contact and resolution until that shot ends. Other active bodies can respond through canonical AI. Passing signal cells report executePass scatter. Catch/interception cells isolate release and ball/catch resolution with stationary staged bodies, rather than making claims about collective moving-receiver AI.',
  keeperDiagnostics:'keeperFlightReadTrials counts actual KEEPER_FLIGHT_READ events. keeperReachAtReleaseProbe is a deterministic preflight reach probe, not the full actual save envelope over time.',
  supersededDevelopment:'The earlier development-only direct-move/advanceBall shot harness omitted canonical released-shot keeper re-aiming. Its flat keeper outcomes cannot establish weak keeper attributes and are superseded by these canonical-tick cells.',
  physicalControl:'All eleven physical attributes identical across weak/average/strong technical shot, passing and reception cells. Technical reception cells vary both passer and receiver technique, holding both physical profiles and physical states equal. Real roster examples preserve all of their own attributes and are descriptive, not isolated causal comparisons.',
  sampling:'Finite paired seed samples; goals, saves, fumbles and selected option may be non-monotonic despite a specific capacity effect. No claim of automatic match wins.',
 },
 ranges,sourceFingerprints,specificity,shotCells,technicalCells,technicalPassingCells,technicalReceptionCells,keeperCells,passingCells,receptionCells,duelCells,interceptionCells,physicalCells,decisionCells,containmentCells,rosterCells,
 unsupported:{
  dribbleControl:'No dedicated dribble-mistouch/lost-dribble execution uncertainty currently exists. BALL_HANDLING influences catch control and perception/choice; rule handling remains legal-state based. No new turnover lottery added.',
  underusedSchema:'Only keys in OUTCOURT_KEYS / KEEPER_KEYS enter these execution profiles. The schema audit separately identifies source ratings absent from this bridge.',
  contactSkill:'No canonical contact-success skill roll: actual body reach, technique, angle and legality decide reached containment. Defensive skill effects are approach geometry, footwork, timing and recovery.',
  keeperPositioning:'Positioning and set-position affect keeper anticipation/read. Short cells start with the same deliberately set body position; some group effects may therefore be weak or absent.',
 },
 determinism:{sameShotSeedContext:true,sameReceptionSeedContext:true},productionSourceModified:false,
};
const out=resolve('../../docs/player-attributes-possession-economy-v1');mkdirSync(out,{recursive:true});writeFileSync(join(out,'ATTRIBUTE-SENSITIVITY.json'),JSON.stringify(report,null,2)+'\n');
const table=(cells:typeof shotCells)=>['| Case | Tier | Context | Tired | Goals / resolved | Unresolved / trials | Spread | Pace |','|---|---|---|---|---:|---:|---:|---:|',...cells.map(c=>`| ${c.name} | ${c.tier} | ${c.context} | ${c.tired} | ${c.goals}/${c.acceptedOutcomes} | ${c.unresolved}/${c.n} | ${c.spread.toFixed(4)} | ${c.pace.toFixed(3)} |`)].join('\n');
const technicalControlTable=[
 '| Tier | Difficult | Tired | Passing spread | Mean pass error | Catches / n | Failed catches | Centre catch risk |',
 '|---|---|---|---:|---:|---:|---:|---:|',
 ...technicalReceptionCells.map(c=>{
  const pass=technicalPassingCells.find(p=>p.tier===c.tier&&p.hard===c.hard&&p.tired===c.tired)!;
  return`| ${c.tier} | ${c.hard} | ${c.tired} | ${pass.spread.toFixed(4)} | ${pass.meanError.toFixed(4)} | ${c.received}/${c.n} | ${c.failed} | ${c.centreRisk.toFixed(4)} |`;
 }),
].join('\n');
writeFileSync(join(out,'ATTRIBUTE-SENSITIVITY.md'),`# Controlled attribute sensitivity

This developer evidence uses retained Allsvenskan production rating inputs, observed per-key p10/p50/p90 values and identical seeds. The JSON contains exact raw values, input/source hashes and every comparison. Rating provenance includes generated priors; real roster identity does not make those values measured athlete data.

Only the named attribute/group changes. The equal-physical technical profiles keep all eleven physical ratings fixed. Geometry, fatigue, technique and keeper changes are explicitly separated. Finite outcome rates are observations, with no forced monotonic target. No production source is changed.

Released shots advance through full canonical ticks, including released-shot perception, keeper flight reading, commitment, movement and deflections. The earlier development harness used only direct keeper movement and ball advancement after release; its flat keeper cells omitted canonical re-aiming and cannot establish attribute weakness. Those cells are superseded here. Final shot outcomes are mutually exclusive, and unresolved trajectories are excluded from conversion denominators. The JSON distinguishes parry events from parry outcomes and subsequent goals.

## Shooting

${table(shotCells)}

## Equal physical capacity, different technical profiles

${table(technicalCells)}

The same coherent low/median/high technical profiles also execute passing and catch/control encounters. All eleven physical ratings stay identical. Passing-signal cells vary the passer's technical group. Catch cells vary that group for both passer and receiver, holding their physical profiles and states equal. Actual release pace/scatter, catch risk, received/fumbled outcomes and sample counts are retained separately in JSON. Higher passing technique can also change delivery pace, so the catch outcome is a coupled execution observation.

${technicalControlTable}

## Goalkeepers

${table(keeperCells)}

Each cell records how many trials emitted an actual KEEPER_FLIGHT_READ. The preflight reach probe is a separate deterministic signal; it does not stand in for the actual save response.

## Passing and control

Individual PASSING cells record canonical executePass scatter/error. BALL_HANDLING and coherent technical-profile catch cells resolve actual released flights with fixed staged catch bodies. Failed catches remain RECEPTION_FAILED; interceptions remain INTERCEPTION. No shot block or offensive foul is relabelled as a technical error. Simple unpressured catch cells can have zero risk in every tier because difficulty remains below the existing control threshold. These catch cells isolate execution rather than collective moving-receiver AI.

## Defence and decisions

Feints resolve the real duel against paired defenders. BALL_WINNING is tested across the same absolute lane offsets and throw seeds with a ready PRESS defender. Reached frontal containment is a legal/spatial contract; the same legal contact can hold at every attribute tier. Defensive positioning/covering change the approach/helper destination. Decision cells expose option capability/risk and reading time; a changed rating need not change the best option. Pure decision reads are checked for non-mutation.

## Physical capacity and real roster examples

Each existing physical key is varied individually under the same 120-second velocity history, the same fatigued recovery task and ten-second rest. Real roster examples select the ID-sorted median of each position, preserve their own complete attribute profile, and run the same clear/difficult encounters. These descriptive examples do not isolate one attribute.

## Limits

There is no dedicated dribble-mistouch or lost-dribble uncertainty category to test. BALL_HANDLING supports reception control and perception, while rule handling remains state based. Contact ability is not a contact-success dice roll. Keeper-positioning comparisons start in the same set body position, so they chiefly expose the existing reading/anticipation link. Source ratings absent from the bridge are reported separately by the attribute-path audit. These short cases establish specific implementation effects, not empirical league calibration or guaranteed scoring, error or win rates.

Run from apps/game: \`node --import tsx scripts/prove-attribute-sensitivity.ts --trials 64\`.
`);
console.log(JSON.stringify({complete:true,inputPlayers:rows.length,shotCells:shotCells.length,technicalCells:technicalCells.length,technicalPassingCells:technicalPassingCells.length,technicalReceptionCells:technicalReceptionCells.length,keeperCells:keeperCells.length,receptionCells:receptionCells.length,output:'docs/player-attributes-possession-economy-v1/ATTRIBUTE-SENSITIVITY.json'}));
