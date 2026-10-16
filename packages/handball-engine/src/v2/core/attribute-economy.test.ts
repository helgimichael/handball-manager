/** Specific attribute-path contracts. No empirical goal/error/win-rate targets. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoreScenario} from './scenarios';
import {getPlayer,record,type CoreState} from './state';
import {buildProfile,OUTCOURT_KEYS,KEEPER_KEYS,type AttributeSheet} from './profile';
import {executePass,planShotTarget,receptionRisk} from './execution';
import {startAction} from './actions';
import {resolveEffects,advanceBall,keeperReachForShot} from './interactions';
import {conditionAfter} from './condition';
import {decideHandball} from './intelligence';
import {secondsTo} from './timing';
import {resolveContacts} from './contact';
import {physicalImpulse} from './physicalLoad';
import {ledger,lossClassOf} from './ledger';

const base:AttributeSheet=Object.fromEntries([...OUTCOURT_KEYS,...KEEPER_KEYS].map(k=>[k,13]));
function scene(change:AttributeSheet={}){
 const s=createCoreScenario('BACKCOURT_SHOT',9187),p=getPlayer(s,'H03');
 p.profile=buildProfile({...base,...change},'CB');return{s,p};
}
function isolate(s:CoreState,ids:string[]){for(const p of s.players)if(!ids.includes(p.id))p.population='BENCH';}

test('PASSING specifically changes canonical delivery scatter and pace without changing shooting or running',()=>{
 const a=scene({PASSING:11}),b=scene({PASSING:16});
 const pass=(x:ReturnType<typeof scene>)=>{const r=getPlayer(x.s,'H04');isolate(x.s,['H03','H04']);x.p.position={x:5,y:20};r.position={x:17,y:10};x.s.ball.position={...x.p.position};return executePass(x.s,x.p,r,r.position);};
 const low=pass(a),high=pass(b);assert.ok(high.spread<low.spread);assert.ok(high.speed>low.speed);
 assert.equal(a.p.profile.shotPlacement,b.p.profile.shotPlacement);assert.equal(a.p.profile.topSpeed,b.p.profile.topSpeed);assert.equal(a.p.profile.acceleration,b.p.profile.acceleration);
 assert.equal(a.s.rng.draws,b.s.rng.draws);assert.equal(a.s.rng.state,b.s.rng.state);
});

test('unrelated shooting ratings cannot improve the same seeded difficult pass',()=>{
 const pass=(shooting:number)=>{
  const{s,p}=scene({SHOOTING_POWER:shooting,SHOOTING_PLACEMENT:shooting,FINISHING:shooting}),r=getPlayer(s,'H04'),d=getPlayer(s,'A03');
  isolate(s,['H03','H04','A03']);p.position={x:5,y:20};r.position={x:17,y:10};r.velocity={x:3,y:0};d.position={x:6,y:19.3};d.action=null;
  s.ball.position={...p.position};p.condition.energy=.25;p.condition.acuteExertion=.9;
  const execution=executePass(s,p,r,r.position);assert.ok(execution.difficulty>0);
  return{execution,rng:s.rng};
 };
 assert.deepEqual(pass(16),pass(11));
});

test('BALL_HANDLING protects the same difficult catch without changing pass skill or shot placement',()=>{
 const a=scene({BALL_HANDLING:11}),b=scene({BALL_HANDLING:16});
 for(const {s,p} of [a,b]){isolate(s,['H03','A03']);p.position={x:10,y:15};p.velocity={x:3,y:0};getPlayer(s,'A03').position={x:10,y:14.3};p.condition.energy=.25;p.condition.acuteExertion=.9;}
 assert.ok(receptionRisk(b.s,b.p,{x:10.4,y:15},17)<receptionRisk(a.s,a.p,{x:10.4,y:15},17));
 assert.equal(a.p.profile.passing,b.p.profile.passing);assert.equal(a.p.profile.shotPlacement,b.p.profile.shotPlacement);
});

test('a simple centred unpressured catch is not made risky merely by a lower handling rating',()=>{
 const{s,p}=scene({BALL_HANDLING:11});isolate(s,['H03']);p.position={x:10,y:15};p.condition.energy=.25;p.condition.acuteExertion=.9;
 assert.equal(receptionRisk(s,p,p.position,9),0);
});

test('SHOOTING_POWER changes an actual release pace while placement and its intended window stay fixed',()=>{
 const release=(value:number)=>{
  const{s,p}=scene({SHOOTING_POWER:value});isolate(s,['H03','A07']);p.position={x:10,y:8.8};s.ball.position={...p.position};
  assert.ok(startAction(s,p,'SHOOT','Actual attribute release',null,null,'STANDING'));p.action!.phase='EXECUTING';
  const plan=planShotTarget(s,p,1);resolveEffects(s,[{playerId:p.id,kind:'SHOOT'}]);assert.equal(s.ball.flight?.kind,'SHOT');
  return{pace:Math.hypot(s.ball.flight!.velocity.x,s.ball.flight!.velocity.y),plan,draws:s.rng.draws};
 };
 const low=release(11),high=release(16);assert.ok(high.pace>low.pace);
 assert.equal(high.plan.placement,low.plan.placement);assert.equal(high.plan.spread,low.plan.spread);assert.equal(high.plan.aimX,low.plan.aimX);assert.equal(high.draws,low.draws);
});

test('shooting technique changes spatial execution in a fatigued difficult window without assigning a goal',()=>{
 const a=scene({SHOOTING_PLACEMENT:11,FINISHING:11}),b=scene({SHOOTING_PLACEMENT:16,FINISHING:16});
 for(const{s,p}of[a,b]){isolate(s,['H03','A03','A07']);p.position={x:10,y:10.5};p.velocity={x:3,y:0};getPlayer(s,'A03').position={x:8.9,y:10};p.condition.energy=.25;p.condition.acuteExertion=.9;}
 const low=planShotTarget(a.s,a.p),high=planShotTarget(b.s,b.p);assert.ok(high.placement>low.placement);assert.ok(high.spread<low.spread);
 assert.deepEqual(a.s.score,b.s.score);assert.equal(a.s.events.length,0);assert.deepEqual(a.s.rng,b.s.rng);
});

test('keeper reaction and save-height ratings remain in the keeper branch',()=>{
 const low=buildProfile({...base,REACTION:11,LOW_SAVES:11},'GK'),high=buildProfile({...base,REACTION:16,LOW_SAVES:16},'GK');
 assert.ok(high.reaction<low.reaction);assert.ok(high.keeper!.low>low.keeper!.low);assert.equal(high.keeper!.high,low.keeper!.high);
 assert.equal(high.passing,low.passing);assert.equal(high.shotPlacement,low.shotPlacement);assert.equal(high.physical,undefined);
 const fieldLow=buildProfile({...base,REACTION:11,LOW_SAVES:11},'CB'),fieldHigh=buildProfile({...base,REACTION:16,LOW_SAVES:16},'CB');
 assert.deepEqual(fieldLow,fieldHigh);
});

test('keeper save reach uses reaction-limited actual flight rather than an unconditional save roll',()=>{
 const{s,p}=scene(),k=getPlayer(s,'A07');isolate(s,['H03','A07']);p.position={x:10,y:10.5};s.ball.position={...p.position};
 assert.ok(startAction(s,p,'SHOOT','Reach probe',null,null,'BACKCOURT_JUMP'));p.action!.phase='EXECUTING';resolveEffects(s,[{playerId:p.id,kind:'SHOOT'}]);
 const f=s.ball.flight!;assert.equal(f.kind,'SHOT');k.position={x:10,y:1.4};const point={x:10.4,y:1.4};
 k.profile=buildProfile({...base,REACTION:11},'GK');const low=keeperReachForShot(s,k,f,point);
 k.profile=buildProfile({...base,REACTION:16},'GK');const high=keeperReachForShot(s,k,f,point);
 assert.ok(high>=low);assert.equal(s.score.HOME,0);assert.equal(s.events.filter(e=>e.type==='SAVE_CAUGHT'||e.type==='SAVE_PARRY').length,0);
});

test('defensive footwork changes the real paired feint margin without changing its random draw',()=>{
 const duel=(value:number)=>{
  const s=createCoreScenario('PIVOT_2V2',5417),p=getPlayer(s,'H03'),d=getPlayer(s,'A03');
  p.profile=buildProfile(base,'CB');d.profile=buildProfile({...base,LATERAL_DEFENCE:value,DEFENSIVE_TIMING:value},'CB');
  resolveEffects(s,[{playerId:p.id,kind:'FEINT'}]);const c=s.contests.find(x=>x.kind==='DUEL');assert.ok(c);return{margin:c.margin,rng:s.rng};
 };
 const low=duel(11),high=duel(16);assert.ok(high.margin<low.margin);assert.deepEqual(high.rng,low.rng);
});

test('BALL_WINNING widens real interception reach only for a prepared defender',()=>{
 const encounter=(value:number,ready:boolean)=>{
  const s=createCoreScenario(),p=getPlayer(s,'H03'),r=getPlayer(s,'H04'),d=getPlayer(s,'A03');isolate(s,['H03','H04','A03']);
  p.position={x:4,y:15};r.position={x:16,y:15};d.position={x:10,y:15.43};d.profile=buildProfile({...base,BALL_WINNING:value},'CB');
  s.ball.position={...p.position};assert.ok(startAction(s,r,'RECEIVE','Ready receiver'));r.action!.phase='EXECUTING';
  if(ready){assert.ok(startAction(s,d,'PRESS','Ready interception',null,p.id));d.action!.phase='EXECUTING';}
  s.ball.controllerId=null;s.ball.mode='PASS_FLIGHT';s.ball.flight={kind:'PASS',origin:{...p.position},velocity:{x:12,y:0},fromId:p.id,receiverId:r.id,actionId:'attribute-interception',possessionId:s.possession.id,releasedTick:0,height:1.2,goalSide:'TOP',touchedIds:[p.id],purpose:'PLAY'};
  for(let tick=1;tick<25&&s.ball.flight?.kind==='PASS';tick++){s.tick=tick;s.timeMs=tick*50;advanceBall(s);}
  return s.events.some(e=>e.type==='INTERCEPTION');
 };
 assert.equal(encounter(11,true),false);assert.equal(encounter(16,true),true);assert.equal(encounter(16,false),false);
});

test('a reached legal frontal contact is not converted into a rating-based success lottery',()=>{
 const contact=(value:number)=>{
  const{s,p}=scene(),d=getPlayer(s,'A03');isolate(s,['H03','A03']);p.position={x:10,y:10};d.position={x:10,y:9.3};s.ball.position={...p.position};
  d.profile=buildProfile({...base,CONTACT_ABILITY:value},'CB');assert.ok(startAction(s,p,'DRIVE','Same penetration',{x:10,y:8},d.id));
  assert.ok(startAction(s,d,'CONTACT','Same reached body contact',null,p.id));d.action!.phase='EXECUTING';d.action!.contact={technique:'BENT_ARMS',approach:'FRONT'};resolveContacts(s);
  return{legal:s.events.some(e=>e.type==='LEGAL_CONTACT'),interrupted:p.action!.phase==='INTERRUPTED',rng:s.rng};
 };
 const low=contact(11),high=contact(16);assert.equal(low.legal,true);assert.equal(low.interrupted,true);assert.deepEqual(high,low);
});

test('decision making changes option evaluation through a pure current-state read',()=>{
 const read=(value:number)=>{const{s,p}=scene({DECISION_MAKING:value,GAME_READING:value});const before=JSON.stringify(s),decision=decideHandball(s,p);assert.equal(JSON.stringify(s),before);return decision;};
 const low=read(11),high=read(16);assert.ok(high.perception.capability.decision>low.perception.capability.decision);
 assert.deepEqual(low.perception.space,high.perception.space);assert.ok(high.affordances.some(a=>a.motor==='PASS'));
 const passLow=low.affordances.find(a=>a.motor==='PASS')!,passHigh=high.affordances.find(a=>a.name===passLow.name&&a.targetId===passLow.targetId)!;
 assert.ok(passHigh.components.risk<passLow.components.risk);assert.ok(passHigh.components.capability>passLow.components.capability);
});

test('equal physical attributes preserve identical workload and recovery timing despite different technique',()=>{
 const a=scene({PASSING:11,BALL_HANDLING:11,SHOOTING_PLACEMENT:11,FINISHING:11}),b=scene({PASSING:16,BALL_HANDLING:16,SHOOTING_PLACEMENT:16,FINISHING:16});
 for(const{s,p}of[a,b]){isolate(s,['H03']);p.position={x:10,y:20};for(let tick=0;tick<800;tick++){p.velocity={x:tick%40<20?4:-4,y:0};conditionAfter(s);}}
 assert.deepEqual(a.p.condition,b.p.condition);assert.equal(secondsTo(a.s,a.p,{x:14,y:20}),secondsTo(b.s,b.p,{x:14,y:20}));
});

test('physical work changes condition without directly creating a possession loss, event or random draw',()=>{
 const{s,p}=scene();isolate(s,['H03']);p.position={x:10,y:20};record(s,'BALL_CONTROLLED',p,{reason:'Existing played attack'});
 const before={events:structuredClone(s.events),rng:structuredClone(s.rng),possession:structuredClone(s.possession),energy:p.condition.energy,
  losses:ledger(s).records.filter(r=>lossClassOf(r.ending)).length};
 for(let tick=0;tick<1000;tick++){
  s.tick++;s.timeMs=s.tick*50;s.officialClock.timeMs+=50;p.velocity={x:tick%40<20?4:-4,y:0};
  if(tick%100===0){physicalImpulse(p,'contact',.8);physicalImpulse(p,'jump');}
  conditionAfter(s);
 }
 assert.ok(p.condition.energy<before.energy);assert.ok(p.condition.physicalLoad!.locomotor>0);
 assert.ok(p.condition.physicalLoad!.contact>0);assert.ok(p.condition.physicalLoad!.jump>0);
 assert.deepEqual(s.possession,before.possession);assert.deepEqual(s.events,before.events);assert.deepEqual(s.rng,before.rng);
 assert.equal(ledger(s).records.filter(r=>lossClassOf(r.ending)).length,before.losses);
});
