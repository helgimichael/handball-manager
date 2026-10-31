import test from 'node:test';
import assert from 'node:assert/strict';
import {local,world,structurePoint,goal,distance} from './space';
import {createCoreScenario,CORE_SCENARIOS} from './scenarios';
import {createBackcourtScenario,BACKCOURT_SCENARIOS} from './backcourtScenarios';
import {createWingScenario,WING_SCENARIOS} from './wingScenarios';
import {planBackcourtSupport} from './backcourt';
import {wingRelationship,wingTakeoffWindow} from './wing';
import {pivotPost,pivotInterval,screenPost} from './pivot';
import {readDefence,zonePost,dutyTarget,type ZoneDuty} from './defence';
import {coordinate} from './structure';
import {entryCandidates,offenceBefore} from './offence';
import {planShotTarget} from './execution';
import {advanceCoreMutable,assertCore} from './engine';
import {getPlayer,courtPlayers,type Point,CORE_VERSION} from './state';
import {createMatch} from './match';
import {createContactScenario} from './contactScenarios';
import {createContinuous} from './continuous';
import {saveCore,loadCore,coreHash} from './replay';
const rotate=(p:Point)=>({x:20-p.x,y:40-p.y});
const near=(a:number,b:number,label='')=>assert.ok(Math.abs(a-b)<1e-7,`${label}: ${a} != ${b}`);
function point(a:Point|null,b:Point|null,label=''){if(!a||!b){assert.equal(a,b,label);return;}const r=rotate(a);near(r.x,b.x,label+' x');near(r.y,b.y,label+' y');}
function physical(a:ReturnType<typeof createCoreScenario>,b:typeof a,label:string){
 assert.equal(a.possession.team,b.possession.team,label+' possession');assert.equal(a.ball.mode,b.ball.mode,label+' ball mode');
 for(const p of courtPlayers(a)){const q=getPlayer(b,p.id);point(p.position,q.position,label+' '+p.id);near(-p.velocity.x,q.velocity.x,label+' vx '+p.id);near(-p.velocity.y,q.velocity.y,label+' vy '+p.id);assert.equal(p.action?.kind,q.action?.kind,label+' action '+p.id);assert.equal(p.duty.kind,q.duty.kind,label+' duty '+p.id);}
 point(a.ball.position,b.ball.position,label+' ball');
}
test('orientation: local/world round trips, TOP identity and proper BOTTOM rotation',()=>{
 for(const p of [{x:0,y:0},{x:20,y:40},{x:3.7,y:9.2},{x:10,y:20}]){
  assert.deepEqual(world(p,'TOP'),p);assert.deepEqual(local(p,'TOP'),p);assert.deepEqual(world(p,'BOTTOM'),rotate(p));
  for(const d of ['TOP','BOTTOM'] as const){const q=local(world(p,d),d);near(q.x,p.x);near(q.y,p.y);}
 }
});
test('orientation: role anchors and off-centre ball shifts rotate together',()=>{
 for(const role of ['LW','LB','CB','RB','RW','P','P2','GK'] as const)for(const ballX of [3,10,17])point(structurePoint(role,'TOP',ballX),structurePoint(role,'BOTTOM',20-ballX),role);
 assert.deepEqual(structurePoint('LW','TOP'),{x:.68,y:1.43});assert.deepEqual(structurePoint('LB','TOP'),{x:5.1,y:9.6});
});
test('orientation: all native starting scenarios preserve roles, players and ball in both directions',()=>{
 for(const name of CORE_SCENARIOS){const a=createCoreScenario(name,42,'TOP'),b=createCoreScenario(name,42,'BOTTOM');physical(a,b,name);}
});
test('orientation: backcourt support lanes, cooperation and pivot targets are attack-relative',()=>{
 for(const name of BACKCOURT_SCENARIOS){const a=createBackcourtScenario(name,42,'TOP'),b=createBackcourtScenario(name,42,'BOTTOM');coordinate(a);coordinate(b);
  for(const id of ['H02','H03','H04']){const p=planBackcourtSupport(a,getPlayer(a,id)),q=planBackcourtSupport(b,getPlayer(b,id));assert.equal(p.mode,q.mode);assert.equal(p.partnerId,q.partnerId);point(p.target,q.target,name+' '+id);}
  near(pivotInterval(a,getPlayer(a,'H06')),pivotInterval(b,getPlayer(b,'H06')));point(pivotPost(a,getPlayer(a,'H06')),pivotPost(b,getPlayer(b,'H06')));
  point(screenPost(a,getPlayer(a,'H06'),getPlayer(a,'A02')),screenPost(b,getPlayer(b,'H06'),getPlayer(b,'A02')));
 }
});
test('orientation: wings retain their same-side back, corner and takeoff window',()=>{
 for(const name of WING_SCENARIOS){const a=createWingScenario(name,42,'TOP'),b=createWingScenario(name,42,'BOTTOM');
  for(const id of ['H01','H05']){const p=getPlayer(a,id),q=getPlayer(b,id),x=wingRelationship(a,p),y=wingRelationship(b,q);assert.equal(x.mode,y.mode);assert.equal(x.back?.id,y.back?.id);point(x.target,y.target,name+' '+id);point(wingTakeoffWindow(a,p),wingTakeoffWindow(b,q));}
 }
});
test('orientation: defensive zone order, ball shift, pressure/help and posts rotate for 6:0 and 5:1',()=>{
 for(const system of ['6:0','5:1'] as const){const a=createCoreScenario('ESTABLISHED_6V6',42,'TOP'),b=createCoreScenario('ESTABLISHED_6V6',42,'BOTTOM');
  for(const s of [a,b]){s.coaching.AWAY.defence=system;s.ball.controllerId='H02';s.ball.position={...getPlayer(s,'H02').position};coordinate(s);}
  const da=courtPlayers(a,'AWAY').filter(p=>p.kind==='FIELD_PLAYER'),db=da.map(p=>getPlayer(b,p.id));
  const ra=readDefence(a,da,getPlayer(a,'H02'),'TOP'),rb=readDefence(b,db,getPlayer(b,'H02'),'BOTTOM');assert.deepEqual(ra,rb);assert.deepEqual(a.defence.marks,b.defence.marks);assert.equal(a.defence.pressureId,b.defence.pressureId);
  for(let i=0;i<6;i++)point(zonePost(a,i,ra,'TOP'),zonePost(b,i,rb,'BOTTOM'));
  for(let i=0;i<da.length;i++){assert.equal(da[i].zone,db[i].zone);point(dutyTarget(a,da[i],da[i].duty as ZoneDuty,ra,'TOP'),dutyTarget(b,db[i],db[i].duty as ZoneDuty,rb,'BOTTOM'));}
 }
});
test('orientation: tactical entry selection and its targets use the same local side',()=>{
 const a=createCoreScenario('ESTABLISHED_6V6',42,'TOP'),b=createCoreScenario('ESTABLISHED_6V6',42,'BOTTOM');
 assert.deepEqual(entryCandidates(a).map(c=>[c.family,c.side,c.partner.id,c.score]),entryCandidates(b).map(c=>[c.family,c.side,c.partner.id,c.score]));
 offenceBefore(a);offenceBefore(b);assert.equal(a.offence.entry?.family,b.offence.entry?.family);if(a.offence.entry&&b.offence.entry)for(const [id,p]of Object.entries(a.offence.entry.targets))point(p,b.offence.entry.targets[id]);
});
test('orientation: intended shot side rotates with the goal and goalkeeper',()=>{
 const a=createCoreScenario('BACKCOURT_SHOT',42,'TOP'),b=createCoreScenario('BACKCOURT_SHOT',42,'BOTTOM');for(const side of [-1,1] as const){const p=planShotTarget(a,getPlayer(a,'H03'),side),q=planShotTarget(b,getPlayer(b,'H03'),side);near(p.aimX+q.aimX,20);near(p.spread,q.spread);}
 for(const s of [a,b])for(const k of courtPlayers(s).filter(p=>p.kind==='GOALKEEPER')){const own=goal(s.directions[k.team]==='TOP'?'BOTTOM':'TOP');assert.ok(distance(k.position,own)<2);}
});
test('orientation: mirrored live motion, decisions and ball paths agree without teleportation',()=>{
 for(const name of ['ESTABLISHED_6V6','TRANSITION_3V2','PRESSURE_5_1','WING_FINISH','BACKCOURT_SHOT'] as const){const a=createCoreScenario(name,42,'TOP'),b=createCoreScenario(name,42,'BOTTOM');
  for(let i=0;i<60&&a.status==='RUNNING'&&b.status==='RUNNING';i++){
   const old=new Map(courtPlayers(a).map(p=>[p.id,{...p.position}]));advanceCoreMutable(a);advanceCoreMutable(b);physical(a,b,name+' tick '+(i+1));
   for(const p of courtPlayers(a))assert.ok(distance(old.get(p.id)!,p.position)<.8,name+' no teleport '+p.id);
  }
 }
});
test('orientation: a real period change reverses directions and moves bodies physically to the new restart',()=>{
 for(const dir of ['TOP','BOTTOM'] as const){const s=createMatch(42,dir,1000,0);let seen=false;
  for(let i=0;i<2500&&s.period===1;i++){const old=new Map(courtPlayers(s).map(p=>[p.id,{...p.position}]));advanceCoreMutable(s);if(Number(s.period)===2){seen=true;assert.equal(s.directions.HOME,dir==='TOP'?'BOTTOM':'TOP');assert.equal(s.restart?.owner,'AWAY');for(const p of courtPlayers(s)){const q=old.get(p.id);if(q)assert.ok(distance(p.position,q)<.8,'period change must not teleport '+p.id);}}}
  assert.ok(seen,'real second period reached');assertCore(s);
 }
});
test('orientation: legal free-throw restarts in both directions',()=>{
 for(const dir of ['TOP','BOTTOM'] as const){const s=createCoreScenario('FREE_THROW',42,dir);for(let i=0;i<600&&!s.events.some(e=>e.type==='RESTART_COMPLETED')&&s.status==='RUNNING';i++)advanceCoreMutable(s);assert.ok(s.events.some(e=>e.type==='RESTART_COMPLETED'));assertCore(s);}
});
test('orientation: seven-versus-six uses legal native substitutions and keeps goal/role identity',()=>{
 for(const dir of ['TOP','BOTTOM'] as const){const s=createContinuous('SEVEN_V_SIX',42,dir,null);for(let i=0;i<400&&s.exchanges.some(e=>e.phase!=='COMPLETED');i++)advanceCoreMutable(s);assert.ok(s.exchanges.some(e=>e.phase==='COMPLETED'));assert.equal(getPlayer(s,'H07').population,'BENCH');assert.equal(getPlayer(s,'H08').role,'P2');assertCore(s);}
});
test('orientation: new saves restore exactly; old geometry versions are rejected',()=>{
 const a=createCoreScenario('ESTABLISHED_6V6',42,'BOTTOM');for(let i=0;i<15;i++)advanceCoreMutable(a);const json=saveCore(a),b=loadCore(json);assert.equal(coreHash(a),coreHash(b));const old=JSON.parse(json);old.version='2.9.0-possession-ecology.2';assert.throws(()=>loadCore(JSON.stringify(old)),/Unsupported core save/);assert.equal(a.version,CORE_VERSION);
});

test('orientation: contact fixture velocities rotate with committed targets',()=>{
 for(const name of ['FRONTAL_CONTACT','LATE_HOLD','EVADED_CONTACT','SHOULDER_BREAKTHROUGH'] as const){const a=createContactScenario(name,2025,'TOP'),b=createContactScenario(name,2025,'BOTTOM');physical(a,b,name);for(let i=0;i<5;i++){advanceCoreMutable(a);advanceCoreMutable(b);physical(a,b,name+' tick '+i);}}
});
test('orientation: live play across both teams preserves mirrored decisions and physical ball paths',()=>{
 const a=createContinuous('CONTINUOUS_PLAY',2025,'TOP',null),b=createContinuous('CONTINUOUS_PLAY',2025,'BOTTOM',null),teams=new Set<string>();for(let i=0;i<1200;i++){advanceCoreMutable(a);advanceCoreMutable(b);teams.add(a.possession.team);physical(a,b,'continuous tick '+i);}assert.deepEqual([...teams].sort(),['AWAY','HOME']);
});
