/** Action-specific identity contracts; no league means or success quotas. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoreScenario} from './scenarios';
import {createIntelligenceScenario} from './intelligenceScenarios';
import {buildProfile,OUTCOURT_KEYS,KEEPER_KEYS,type AttributeSheet} from './profile';
import {getPlayer,record,type CoreState} from './state';
import {execute,move,startAction} from './actions';
import {carryControl,executePass,keeperReadQuality,planShotTarget,receptionRisk} from './execution';
import {keeperReachForShot} from './interactions';
import {affordancesFor,assessAdvantage,decideHandball,intelligenceRelevant,perceiveHandball,situationsFor} from './intelligence';
import {movementReadTicks,readMovementTarget} from './movement';
import {acquire} from './transitions';
import {ledger,lossClassOf} from './ledger';
import {advanceCoreMutable} from './engine';

const base:AttributeSheet=Object.fromEntries([...OUTCOURT_KEYS,...KEEPER_KEYS].map(k=>[k,13]));
function scene(change:AttributeSheet={},seed=7123){const s=createCoreScenario('ESTABLISHED_6V6',seed),p=getPlayer(s,'H03'),d=getPlayer(s,'A03');p.profile=buildProfile({...base,...change},'CB');for(const q of s.players)if(![p.id,d.id].includes(q.id))q.population='BENCH';p.position={x:10,y:15};d.position={x:10,y:14.3};p.velocity={x:0,y:-4};s.ball.position={...p.position};s.ball.controllerId=p.id;s.ball.live=true;return{s,p,d};}
function pass(change:AttributeSheet={},hard=true){const {s,p,d}=scene(change),r=getPlayer(s,'H04');r.population='COURT';r.position=hard?{x:17,y:10}:{x:14,y:15};r.velocity={x:hard?3:0,y:0};if(!hard)d.population='BENCH';return executePass(s,p,r,r.position);}
function touch(change:AttributeSheet={},seed=7123,pressured=true){const x=scene(change,seed),{s,p,d}=x;if(!pressured)d.population='BENCH';else{startAction(s,d,'CONTACT','Reachable pressure',null,p.id);d.action!.phase='EXECUTING';const h=getPlayer(s,'A04');h.population='COURT';h.position={x:10.7,y:15.1};startAction(s,h,'CONTACT','Second close body',null,p.id);h.action!.phase='EXECUTING';}startAction(s,p,'DRIBBLE','Challenged touch',{x:10,y:10});p.action!.phase='EXECUTING';p.action!.executeTicks=100;p.handling.bounceTick=s.tick-4;s.ball.mode='DRIBBLE';const before=carryControl(s,p);execute(s);return{...x,before};}

test('pass execution uses PASSING independently of DECISION_MAKING and shooting',()=>{
 assert.deepEqual(pass({DECISION_MAKING:11}),pass({DECISION_MAKING:16}));
 assert.deepEqual(pass({SHOOTING_PLACEMENT:11}),pass({SHOOTING_PLACEMENT:16}));
 assert.ok(pass({PASSING:16}).spread<pass({PASSING:11}).spread);
 assert.ok(pass({PASSING:11},false).spread<pass({PASSING:11}).spread);
});
test('handling and concentration protect a reachable difficult catch; passer skill is separate',()=>{
 const risk=(change:AttributeSheet)=>{const{s,p}=scene(change);p.condition.energy=.25;p.condition.acuteExertion=.9;return receptionRisk(s,p,{x:10.5,y:15},18);};
 assert.ok(risk({BALL_HANDLING:16})<risk({BALL_HANDLING:11}));
 assert.ok(risk({CONCENTRATION:16})<risk({CONCENTRATION:11}));
 assert.equal(risk({PASSING:11}),risk({PASSING:16}));
});
test('a simple centred catch and open dribble do not acquire random failure from low technique',()=>{
 const{s,p,d}=scene({BALL_HANDLING:10,CONCENTRATION:10,PRESSURE_HANDLING:10});d.population='BENCH';p.velocity={x:0,y:0};assert.equal(receptionRisk(s,p,p.position,9),0);
 for(let i=0;i<32;i++){const x=touch({BALL_HANDLING:10},i,false);assert.equal(x.before.risk,0);assert.ok(!x.s.events.some(e=>e.type==='CONTROL_MISTOUCH'));}
});
test('pressured dribble control separates technical profile and still permits either outcome',()=>{
 let low=0,high=0;for(let i=1;i<=384;i++){const a=touch({BALL_HANDLING:11,PRESSURE_HANDLING:11},72683+i*104729),b=touch({BALL_HANDLING:16,PRESSURE_HANDLING:16},72683+i*104729);assert.ok(b.before.risk<a.before.risk);low+=Number(a.s.ball.controllerId===null);high+=Number(b.s.ball.controllerId===null);}
 assert.ok(low>high);assert.ok(high>0);assert.ok(low<384);
});
test('a mistouch retains possession until actual opponent control; own recovery is not a broad loss',()=>{
 let found:ReturnType<typeof touch>|null=null;for(let i=1;i<200&&!found;i++){const x=touch({BALL_HANDLING:11},i);if(x.s.ball.controllerId===null)found=x;}assert.ok(found);
 const {s,p,d}=found;const id=s.possession.id;record(s,'BALL_CONTROLLED',p);
 assert.equal(ledger(s).records.filter(r=>lossClassOf(r.ending)).length,0);
 const own=structuredClone(s);getPlayer(own,p.id).position={...own.ball.position};acquire(own,getPlayer(own,p.id),own.ball.position,'Loose-ball recovery');assert.equal(own.possession.id,id);assert.equal(ledger(own).records.filter(r=>lossClassOf(r.ending)).length,0);
 d.position={...s.ball.position};acquire(s,d,s.ball.position,'Loose-ball recovery');assert.equal(ledger(s).records.filter(r=>r.possessionId===id&&lossClassOf(r.ending)).length,1);
});
test('marginal canonical option ranking differs by cognition without changing actual visible bodies',()=>{
 let differences=0;for(let i=0;i<128;i++){
  const rank=(rating:number)=>{const{s,p}=createIntelligenceScenario('H_NO_ADVANTAGE',i);p.profile=buildProfile({...base,DECISION_MAKING:rating,AWARENESS:rating,ADVANTAGE_RECOGNITION:rating,PLAYMAKING:rating,TWO_V_TWO_READING:rating},'CB');const r=perceiveHandball(s,p);r.self.dribbleUsed=true;r.legalTravel=0;r.space.open=false;r.shot={quality:.35+i*.002,distance:9,pressure:.7,blockThreat:.4,emptyGoal:false,containment:0,built:true};r.receivers=[{id:'H04',role:'RB',position:{x:14,y:9},velocity:{x:0,y:0},goalDistance:10,spacing:4,readiness:.8,laneSeconds:.15+i*.005,separation:2,created:false,creatorId:null,advantage:.7,quality:.6,angle:.4}];const a=assessAdvantage(r);return affordancesFor(r,a,situationsFor(r,a),null)[0]?.motor;};differences+=Number(rank(11)!==rank(16));
 }assert.ok(differences>0,'At least one actual marginal shoot/pass ranking must change');
});
test('new player-level stationary selection is limited to genuinely marginal shot/pass values',()=>{
 const{s,p}=createIntelligenceScenario('H_NO_ADVANTAGE');p.velocity={x:0,y:0};p.profile=buildProfile(base,'CB');const d=decideHandball(s,p),shot=d.affordances.find(c=>c.motor==='SHOOT')!,pass=d.affordances.find(c=>c.motor==='PASS')!;assert.ok(shot&&pass);d.affordances=[{...shot,value:1},{...pass,value:.2}];d.chosen=d.affordances[0];assert.equal(intelligenceRelevant(d,p),false);d.affordances[1].value=.98;assert.equal(intelligenceRelevant(d,p),true);
});
test('low decision attributes preserve the obvious free carrier, bind/pass and numerical truths',()=>{
 for(const name of ['A_FREE_TO_GOAL','B_HELP_M6','D_TWO_V_ONE','E_THREE_V_TWO','H_NO_ADVANTAGE']as const){const choices=[11,16].map(value=>{const{s,p}=createIntelligenceScenario(name);p.profile=buildProfile({...base,DECISION_MAKING:value,AWARENESS:value,ADVANTAGE_RECOGNITION:value,PLAYMAKING:value,TWO_V_TWO_READING:value},'CB');return decideHandball(s,p);});
  if(name==='A_FREE_TO_GOAL')for(const choice of choices)assert.ok(['DRIVE','DRIBBLE'].includes(choice.chosen?.motor??''));
  if(name==='B_HELP_M6')for(const choice of choices)assert.equal(choice.chosen?.name,'BIND_AND_PASS');
  if(name==='D_TWO_V_ONE'||name==='E_THREE_V_TWO')for(const choice of choices)assert.ok(choice.situations.includes(name==='D_TWO_V_ONE'?'TWO_V_ONE':'THREE_V_TWO'));
 }
});
test('awareness changes recognition of marginal receiver advantage, not actual receiver geometry',()=>{
 const read=(value:number)=>{const{s,p,mate}=createIntelligenceScenario('H_NO_ADVANTAGE');p.profile=buildProfile({...base,AWARENESS:value},'CB');mate.position={x:13,y:10};return perceiveHandball(s,p);};const a=read(11),b=read(16);assert.deepEqual(a.receivers.map(r=>r.position),b.receivers.map(r=>r.position));assert.ok(b.receivers[0].observedAdvantage!>=a.receivers[0].observedAdvantage!);
});
test('defensive lateral technique changes actual containment approach without changing physical ceilings',()=>{
 const run=(rating:number)=>{const{s,d}=scene();d.profile=buildProfile({...base,LATERAL_DEFENCE:rating},'CB');d.position={x:7,y:10};d.velocity={x:0,y:0};startAction(s,d,'CONTAIN','Contain the same inside shoulder',{x:9,y:10});d.action!.phase='EXECUTING';for(let i=0;i<6;i++)move(s,d,{x:9,y:10});return d;};const a=run(11),b=run(16);assert.ok(b.position.x>a.position.x);assert.equal(a.profile.topSpeed,b.profile.topSpeed);assert.equal(a.profile.acceleration,b.profile.acceleration);
});
test('covering and positioning change helper and recovery reading, not attacking pass execution',()=>{
 const read=(rating:number,kind:'HELP'|'RECOVER')=>{const{s,d}=scene();d.profile=buildProfile({...base,COVERING:rating,DEFENSIVE_POSITIONING:rating},'CB');d.duty={kind,targetId:null,sinceTick:s.tick,reason:'Same responsibility'};startAction(s,d,kind,'Same defensive reading task',{x:8,y:10});d.action!.phase='EXECUTING';return movementReadTicks(s,d);};assert.ok(read(16,'HELP')<=read(11,'HELP'));assert.ok(read(16,'RECOVER')<read(11,'RECOVER'));assert.deepEqual(pass({COVERING:11,DEFENSIVE_POSITIONING:11}),pass({COVERING:16,DEFENSIVE_POSITIONING:16}));
});
test('handover quality shortens a changed responsibility read without reallocating its owner',()=>{
 const read=(value:number)=>{const{s,d}=scene();d.profile=buildProfile({...base,SWITCHING_HANDOVER:value},'CB');d.duty={kind:'MARK',targetId:'H04',sinceTick:s.tick,reason:'New threat in owned space'};d.motion={mode:'SHIFT',relation:'old',target:{x:7,y:10},reviewTick:s.tick+30};readMovementTarget(s,d,{x:9,y:10});return{review:d.motion.reviewTick,owner:d.duty.targetId};};assert.ok(read(16).review<read(11).review);assert.equal(read(16).owner,read(11).owner);
});
test('keeper category expertise changes finite hand travel while distant impossible reach remains impossible',()=>{
 const probe=(value:number)=>{const{s,p,d}=scene();const k=getPlayer(s,'A07');k.profile=buildProfile({...base,CLOSE_RANGE_SAVES:value},'GK');k.position={x:10,y:1.4};return keeperReachForShot(s,k,{kind:'SHOT',origin:{x:10,y:7},velocity:{x:1,y:-22},fromId:p.id,receiverId:null,actionId:'shot',possessionId:s.possession.id,releasedTick:s.tick,height:1.5,goalHeight:1.1,goalSide:'TOP',touchedIds:[p.id],purpose:'PLAY'}, {x:10.4,y:1.4});};assert.ok(probe(16)>probe(11));assert.ok(probe(16)<1);
});
test('keeper mental attributes use their branch, and never change court-player throws',()=>{
 const k=(value:number)=>{const p=getPlayer(createCoreScenario('BACKCOURT_SHOT'),'A07');p.profile=buildProfile({...base,GK_COMPOSURE:value,GK_CONCENTRATION:value,GK_PRESSURE_HANDLING:value,PATIENCE:value},'GK');return keeperReadQuality(p,true);};assert.ok(k(16)>k(11));assert.deepEqual(pass({GK_COMPOSURE:11,GK_CONCENTRATION:11}),pass({GK_COMPOSURE:16,GK_CONCENTRATION:16}));
});
test('shooting quality narrows a difficult wing execution without aiming systematically at the near post',()=>{
 const shot=(value:number)=>{const{s,p,d}=scene({WING_FINISHING:value});d.population='BENCH';p.position={x:2,y:6};const k=getPlayer(s,'A07');k.population='COURT';k.position={x:9.4,y:1.4};return planShotTarget(s,p);};const a=shot(11),b=shot(16);assert.ok(b.spread<a.spread);assert.ok(a.aimX>10&&b.aimX>10);
});
test('stamina does not directly improve fresh simple technical execution; physical profile remains separate',()=>{
 assert.deepEqual(pass({ENDURANCE:11,REPEAT_SPRINT_ABILITY:11},false),pass({ENDURANCE:16,REPEAT_SPRINT_ABILITY:16},false));const a=scene({PASSING:11}),b=scene({PASSING:16});assert.deepEqual(a.p.profile.physical,b.p.profile.physical);
});
test('decision reads and new immutable profiles survive exact JSON continuation with no rating feedback',()=>{
 const{s,p}=createIntelligenceScenario('B_HELP_M6');p.profile=buildProfile({...base,AWARENESS:16,ADVANTAGE_RECOGNITION:15},'CB');const before=JSON.stringify(s),a=decideHandball(s,p);assert.equal(JSON.stringify(s),before);const copy=JSON.parse(before)as CoreState;assert.deepEqual(decideHandball(copy,getPlayer(copy,p.id)),a);
 const augmented=copy.players.find(q=>q.id===p.id)! as typeof p&{CA?:number;PA?:number;overall?:number;rating?:number;matchRating?:number;genericStrength?:number};Object.assign(augmented,{CA:200,PA:200,overall:200,rating:10,matchRating:10,genericStrength:200});assert.deepEqual(decideHandball(copy,augmented),a);
 const plain=JSON.parse(before)as CoreState,plainPlayer=getPlayer(plain,p.id),receiver=getPlayer(copy,'H04'),plainReceiver=getPlayer(plain,'H04');
 assert.deepEqual(executePass(copy,augmented,receiver,receiver.position),executePass(plain,plainPlayer,plainReceiver,plainReceiver.position));
 assert.deepEqual(planShotTarget(copy,augmented),planShotTarget(plain,plainPlayer));
 for(let i=0;i<30;i++){advanceCoreMutable(copy);advanceCoreMutable(plain);}
 for(const key of ['CA','PA','overall','rating','matchRating','genericStrength']as const)delete augmented[key];
 assert.deepEqual(copy,plain,'Action output, canonical ticks, events and RNG ignore generic rating metadata');
});

test('dead-ball preparation retains physical movement independently of defensive technique',()=>{
 const prepare=(value:number)=>{const{s,d}=scene();s.ball.live=false;d.profile=buildProfile({...base,LATERAL_DEFENCE:value},'CB');d.position={x:7,y:10};d.velocity={x:0,y:0};startAction(s,d,'REPOSITION','Approved restart placement',{x:9,y:10});for(let i=0;i<8;i++)move(s,d,{x:9,y:10});return{position:d.position,velocity:d.velocity};};assert.deepEqual(prepare(11),prepare(16));
});
test('substitution exchange movement never receives a defensive technical multiplier',()=>{
 const exchange=(value:number)=>{const{s,d}=scene();d.profile=buildProfile({...base,LATERAL_DEFENCE:value},'CB');d.position={x:7,y:10};d.velocity={x:0,y:0};startAction(s,d,'CONTAIN','Previously defending',{x:9,y:10});d.action!.kind='EXCHANGE';d.duty.kind='RECOVER';for(let i=0;i<8;i++)move(s,d,{x:9,y:10});return{position:d.position,velocity:d.velocity};};assert.deepEqual(exchange(11),exchange(16));
});
test('passing cannot improve defence, defence cannot improve a shot, and keeper keys cannot improve court passing',()=>{
 const defend=(value:number)=>{const{s,d}=scene();d.profile=buildProfile({...base,PASSING:value},'CB');d.position={x:7,y:10};d.velocity={x:0,y:0};startAction(s,d,'CONTAIN','Same technical defensive task',{x:9,y:10});d.action!.phase='EXECUTING';for(let i=0;i<8;i++)move(s,d,{x:9,y:10});return{position:d.position,velocity:d.velocity};};assert.deepEqual(defend(11),defend(16));
 const shot=(value:number)=>{const{s,p}=scene({LATERAL_DEFENCE:value,DEFENSIVE_POSITIONING:value,COVERING:value});return planShotTarget(s,p);};assert.deepEqual(shot(11),shot(16));
 assert.deepEqual(pass(Object.fromEntries(KEEPER_KEYS.map(k=>[k,11]))),pass(Object.fromEntries(KEEPER_KEYS.map(k=>[k,16]))));
});
test('an actual challenged loose ball resumes exactly from JSON through canonical ticks',()=>{
 let found:ReturnType<typeof touch>|null=null;for(let i=1;i<200&&!found;i++){const x=touch({BALL_HANDLING:11},72683+i*104729);if(x.s.ball.controllerId===null)found=x;}assert.ok(found);const s=found.s;s.checkpoint.stopOnOutcome=false;s.flow.stopAfter=null;const resumed=JSON.parse(JSON.stringify(s))as CoreState;
 for(let i=0;i<30;i++){advanceCoreMutable(s);advanceCoreMutable(resumed);}assert.deepEqual(resumed,s);
});
