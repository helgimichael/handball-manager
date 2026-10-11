import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoreScenario} from './scenarios';
import {movementMode,movementPace,movementReadTicks,readMovementTarget,receivingApproach,bodyRoute,recoveryRoute} from './movement';
import {startAction,execute,move} from './actions';
import {steerVelocity} from './locomotion';
import {movementCapacity} from './condition';
import {advanceCoreMutable} from './engine';
import {coordinate,selectActions} from './structure';
function fixture(){const s=createCoreScenario('ESTABLISHED_6V6',42),p=s.players.find(p=>p.team==='HOME'&&p.role==='LB')!;p.position={x:5,y:15};p.velocity={x:0,y:0};p.action=null;s.ball.live=true;return{s,p};}
test('movement work separates close adjustment, support, penetration, help and transition',()=>{
 const{s,p}=fixture();startAction(s,p,'RUN','Assigned support',{x:6,y:15});p.duty.kind='WING_PIN';assert.equal(movementMode(s,p),'ADJUST');const adjust=movementPace(s,p,p.action!.target);
 p.duty.kind='COMBINE';assert.equal(movementMode(s,p),'THREATEN');assert.ok(movementPace(s,p,p.action!.target)>adjust);
 p.action!.kind='DRIVE';assert.equal(movementMode(s,p),'DRIVE');p.action!.kind='RUN';s.possession.phase='TRANSITION';assert.equal(movementMode(s,p),'SPRINT_TRANSITION');
 p.team='AWAY';p.duty.kind='HELP';assert.equal(movementMode(s,p),'HELP');p.duty.kind='RETREAT';assert.equal(movementMode(s,p),'RETREAT');
});
test('a reduced preferred pace brakes physically rather than clipping current speed',()=>{
 let velocity={x:5,y:0};for(let i=0;i<12;i++){const before=velocity;velocity=steerVelocity({x:0,y:0},velocity,{x:20,y:0},2,5);assert.ok(Math.hypot(velocity.x-before.x,velocity.y-before.y)<=.5+1e-9);}assert.ok(Math.hypot(velocity.x,velocity.y)<=2.01);
});
test('soft arrival spends bounded braking distance instead of slamming onto a nearby coordinate',()=>{
 const{s,p}=fixture();s.players=[p];p.velocity={x:2,y:0};const target={x:p.position.x+.02,y:p.position.y},old={...p.velocity};move(s,p,target);
 assert.ok(p.position.x>target.x,'a tactical relation permits physical braking overshoot');assert.ok(Math.hypot(p.velocity.x-old.x,p.velocity.y-old.y)<=2*p.profile.acceleration*movementCapacity(p)*.05+1e-8);
 for(let i=0;i<80;i++)move(s,p,target);assert.ok(Math.hypot(p.position.x-target.x,p.position.y-target.y)<.1);
});
test('compatible direction changes retain pace and bounded vector acceleration',()=>{
 const{s,p}=fixture();s.players=[p];p.velocity={x:2,y:0};for(let i=0;i<20;i++){const old={...p.velocity};move(s,p,{x:9,y:18});assert.ok(Math.hypot(p.velocity.x-old.x,p.velocity.y-old.y)<=2*p.profile.acceleration*movementCapacity(p)*.05+1e-8);assert.ok(Math.hypot(p.velocity.x,p.velocity.y)>.4);}
});
test('body avoidance is a relational route only when a real body occupies the corridor',()=>{
 const{s,p}=fixture(),body=s.players.find(q=>q.id!==p.id)!;body.position={x:6,y:15};s.players=[p,body];const target={x:9,y:15};const route=bodyRoute(s,p,target);assert.notEqual(route.y,target.y);assert.deepEqual(bodyRoute(s,p,target),route);
 body.position.y=18;assert.deepEqual(bodyRoute(s,p,target),target);body.position.y=15;startAction(s,p,'RUN','Test',target);p.action!.kind='DRIVE';assert.deepEqual(bodyRoute(s,p,target),target,'committed penetration remains a contest, not a cosmetic detour');
});
test('the named receiver opens a bounded legal window; a planted pivot remains available',()=>{
 const{s,p}=fixture(),passer=s.players.find(q=>q.team===p.team&&q.role==='CB')!;const target=receivingApproach(s,p,passer);assert.ok(target);assert.ok(Math.hypot(target!.x-p.position.x,target!.y-p.position.y)<.5);
 p.role='P';assert.equal(receivingApproach(s,p,passer),null);
});
test('passing preparation overlaps carried locomotion without spending an illegal fourth step',()=>{
 const{s,p}=fixture(),receiver=s.players.find(q=>q.team===p.team&&q.role==='RB')!;s.players=[p,receiver];receiver.position={x:14,y:16};p.velocity={x:1.5,y:0};s.ball.controllerId=p.id;s.ball.mode='CONTROLLED';p.handling.steps=0;p.handling.stepDistance=0;
 assert.ok(startAction(s,p,'PASS','Move while preparing the release',null,receiver.id));assert.ok(p.action!.target);const x=p.position.x;execute(s);assert.ok(p.position.x>x);assert.ok(p.handling.steps<=3);
});
test('near pressure reads before remote line support using capacities rather than random offsets',()=>{
 const{s,p}=fixture();startAction(s,p,'CONTAIN','Line',{x:6,y:15});p.duty.kind='MARK';p.team='AWAY';s.ball.position={x:15,y:9};const far=movementReadTicks(s,p);p.duty.kind='PRESSURE';assert.ok(movementReadTicks(s,p)<far);
});
test('relational review carries action identity and perception memory survives JSON persistence',()=>{
 const{s,p}=fixture();startAction(s,p,'RUN','Support',{x:6,y:15});const id=p.action!.id;readMovementTarget(s,p,{x:6,y:15});const wait=p.motion!.reviewTick;s.tick++;const held=readMovementTarget(s,p,{x:8,y:15});if(s.tick<wait)assert.deepEqual(held,{x:6,y:15});s.tick=wait;assert.deepEqual(readMovementTarget(s,p,{x:8,y:15}),{x:8,y:15});assert.equal(p.action!.id,id);assert.deepEqual(JSON.parse(JSON.stringify(p.motion)),p.motion);
});
test('defensive retreat regains inside space before widening into its own post',()=>{
 const{s,p}=fixture();p.team='AWAY';p.duty.kind='RETREAT';p.position={x:2,y:24};s.ball.position={x:12,y:18};const post={x:4,y:7},route=recoveryRoute(s,p,post);assert.ok(route.x>post.x);assert.ok(route.y<24&&route.y>=7);p.position={...post};assert.deepEqual(recoveryRoute(s,p,post),post);
});
test('M6 planting and keeper committed reach retain their existing movement authority',()=>{
 const{s,p}=fixture();p.role='P';startAction(s,p,'SCREEN','Plant a real screen');assert.equal(movementMode(s,p),'HOLD');assert.equal(movementPace(s,p,null),1);p.kind='GOALKEEPER';assert.equal(movementPace(s,p,{x:5.2,y:15}),1);
});
test('canonical movement and pending relational reads resume to identical state and RNG',()=>{
 const{s}=fixture();coordinate(s);selectActions(s);for(let i=0;i<80;i++)advanceCoreMutable(s);const copy=JSON.parse(JSON.stringify(s));for(let i=0;i<500;i++){advanceCoreMutable(s);advanceCoreMutable(copy);}assert.deepEqual(copy,s);
});
test('fatigue and movement capacities still affect real travel, never source attributes',()=>{
 const a=fixture(),b=fixture();a.s.players=[a.p];b.s.players=[b.p];const profile=a.p.profile;a.p.profile={...profile,acceleration:7,topSpeed:7};b.p.profile={...profile,acceleration:4,topSpeed:4};b.p.condition.energy=.3;
 for(let i=0;i<20;i++){move(a.s,a.p,{x:15,y:18});move(b.s,b.p,{x:15,y:18});}assert.ok(a.p.position.x>b.p.position.x);assert.equal(b.p.profile.topSpeed,4);
});
test('an obsolete unclaimed offering position becomes useful support without a lifecycle reset',()=>{
 const{s,p}=fixture();coordinate(s);p.position={x:5,y:18};p.action=null;startAction(s,p,'RECEIVE','Old available post');p.action!.phase='EXECUTING';const id=p.action!.id,phaseTick=p.action!.phaseTick;
 selectActions(s);assert.equal(p.action!.kind,'RUN');assert.ok(p.action!.target);assert.equal(p.action!.id,id);assert.equal(p.action!.phaseTick,phaseTick);
});
