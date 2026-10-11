import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoreScenario} from './scenarios';
import {getPlayer,type CoreFlight} from './state';
import {execute,startAction} from './actions';
import {keeperReachForShot,resolveEffects} from './interactions';
import {shotContext} from './space';
import {buildProfile} from './profile';
import {planShotTarget,prepareKeeperAnticipation} from './execution';
import {awardRestart} from './transitions';
import {advanceCoreMutable} from './engine';

test('prepared penalty hands cannot receive a full-dive radius before the ball gives them time',()=>{
 const s=createCoreScenario(),p=getPlayer(s,'H03'),k=getPlayer(s,'A07');
 startAction(s,p,'SHOOT','Actual seven-metre preparation',null,null,'SEVEN_METRE');
 const f:CoreFlight={kind:'SHOT',origin:{x:10,y:7},velocity:{x:0,y:-24},fromId:p.id,receiverId:null,actionId:p.action!.id,possessionId:s.possession.id,releasedTick:0,height:1.5,goalSide:'TOP',touchedIds:[],purpose:'PLAY'};
 const early=keeperReachForShot(s,k,f,{x:10,y:6.76}),later=keeperReachForShot(s,k,f,{x:10,y:1.4});
 assert.ok(early<.25&&later>early,'a real flight buys hand travel; preparation is not spatial coverage');
 assert.ok(later<.75,'torso movement is already integrated and is not awarded a second full dive');
});

test('opportunity geometry is separate from shooter execution capability and energy',()=>{
 const s=createCoreScenario('BACKCOURT_SHOT'),p=getPlayer(s,'H03');
 p.profile=buildProfile({SHOOTING_POWER:6,SHOOTING_PLACEMENT:6,FINISHING:6},'CB');
 const weak=shotContext(s,p);
 p.profile=buildProfile({SHOOTING_POWER:14,SHOOTING_PLACEMENT:14,FINISHING:14},'CB');
 const strong=shotContext(s,p);
 assert.equal(strong.opportunityQuality,weak.opportunityQuality);
 assert.ok(strong.quality>weak.quality,'the personal decision estimate can value the same window differently');
 p.condition.energy=.5;const tired=shotContext(s,p);
 assert.equal(tired.opportunityQuality,strong.opportunityQuality,'a tired arm does not change where the defenders/goal are');
});

test('a clear close window outranks a goal-side pressured backcourt window for the same capability',()=>{
 const s=createCoreScenario(),p=getPlayer(s,'H03');
 for(const d of s.players.filter(q=>q.team==='AWAY'&&q.kind==='FIELD_PLAYER'))d.population='BENCH';
 p.position={x:10,y:6.8};s.defence.pressureId=null;s.defence.marks={};
 const close=shotContext(s,p),d=getPlayer(s,'A03');d.population='COURT';d.position={x:10,y:8.8};
 p.position={x:10,y:10};s.defence.pressureId=d.id;s.defence.marks[d.id]=p.id;
 const contested=shotContext(s,p);
 assert.ok(close.opportunityQuality>contested.opportunityQuality+.2);
 assert.ok(contested.pressure>close.pressure&&contested.blockThreat>close.blockThreat);
});

test('the committed throwing window cannot instantly switch posts from the latest keeper pose',()=>{
 const s=createCoreScenario(),p=getPlayer(s,'H03'),k=getPlayer(s,'A07');
 k.position={x:10,y:1.4};startAction(s,p,'SHOOT','A real committed throw',null,null,'STANDING');
 s.tick=2;s.timeMs=100;execute(s);
 assert.equal(p.action!.phase,'COMMITTED');const intended=p.action!.target!.x;assert.ok(Math.abs(intended-10)>1);
 k.position={x:intended>10?12:8,y:1.4};assert.ok((planShotTarget(s,p).aimX-10)*(intended-10)<0,'the visible opening changed after commitment');
 p.action!.phase='EXECUTING';resolveEffects(s,[{playerId:p.id,kind:'SHOOT'}]);
 assert.equal(s.events.findLast(e=>e.type==='SHOT_RELEASED')!.details.intendedAimX,intended);
});

function penaltyCue(){
 const s=createCoreScenario('ESTABLISHED_6V6',812),p=getPlayer(s,'H03'),k=getPlayer(s,'A07');
 for(const body of s.players)if(body.id!==p.id&&body.id!==k.id){body.population='BENCH';body.position={x:-.35,y:24};body.zone=null;}
 p.position={x:10,y:7};k.position={x:10,y:.8};s.ball.position={...p.position};
 awardRestart(s,'SEVEN_METRE','HOME',p.position,'Visible penalty cue',p,false);
 Object.assign(s.restart!,{takerId:p.id,phase:'AUTHORISED',authorisedTick:0,plantedFoot:{...p.position}});
 startAction(s,p,'SHOOT','Visible committed throwing posture',null,null,'SEVEN_METRE');p.action!.phase='COMMITTED';
 startAction(s,k,'SAVE','Prepared actual stance',{...k.position});k.action!.phase='EXECUTING';
 return {s,p,k};
}

test('keeper loading reads the visible cue once, never the unthrown target',()=>{
 const {s,p,k}=penaltyCue(),other=structuredClone(s),otherThrower=getPlayer(other,p.id),otherKeeper=getPlayer(other,k.id);
 p.action!.target={x:8.6,y:0};otherThrower.action!.target={x:11.4,y:0};
 const actionId=k.action!.id,phase=k.action!.phase;
 assert.equal(prepareKeeperAnticipation(s,k,p),true);assert.equal(prepareKeeperAnticipation(other,otherKeeper,otherThrower),true);
 assert.deepEqual(k.action!.target,otherKeeper.action!.target);assert.deepEqual(s.rng,other.rng);
 assert.equal(k.action!.id,actionId);assert.equal(k.action!.phase,phase);
 assert.equal(k.position.x,10,'a plan is not a teleport');
 const draws=s.rng.draws;assert.equal(prepareKeeperAnticipation(s,k,p),false);assert.equal(s.rng.draws,draws,'one actual cue is not rerolled each tick');
});

test('anticipatory loading and a committed aim survive an exact seeded save/reload',()=>{
 const {s,p,k}=penaltyCue();p.action!.target={x:11.1,y:0};prepareKeeperAnticipation(s,k,p);
 const restored=structuredClone(s);
 for(let i=0;i<150&&s.status==='RUNNING';i++){advanceCoreMutable(s);advanceCoreMutable(restored);}
 assert.deepEqual(restored,s);
});
