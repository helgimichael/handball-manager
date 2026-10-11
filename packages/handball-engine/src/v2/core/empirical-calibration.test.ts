import test from'node:test';import assert from'node:assert/strict';
import{createCoreScenario}from'./scenarios';import{getPlayer,type CoreFlight}from'./state';
import{planShotTarget,prepareKeeperAnticipation}from'./execution';import{keeperReachForShot,resolveEffects,goalBoundShot,advanceBall}from'./interactions';
import{startAction,move}from'./actions';import{advanceCoreMutable}from'./engine';import{setProfile}from'./testProfile';
import{clearChanceDestroyed,readContact}from'./sanction';import{judgeFoul}from'./referee';
import{readFileSync,readdirSync}from'node:fs';import{join}from'node:path';

test('central placement uses the goal window; equally open sides are real alternatives',()=>{
 const s=createCoreScenario('BACKCOURT_SHOT'),p=getPlayer(s,'H03'),k=getPlayer(s,'A07');k.position.x=10;
 const left=planShotTarget(s,p,-1),right=planShotTarget(s,p,1);
 assert.ok(left.aimX<9&&right.aimX>11);assert.equal(left.spread,right.spread);
 k.position.x=11;assert.ok(planShotTarget(s,p,1).aimX<10,'a substantially closed side is not preferred');
});
test('vertical extension consumes finite lateral keeper reach and depends on save capability',()=>{
 const s=createCoreScenario(),p=getPlayer(s,'H03'),k=getPlayer(s,'A07');
 const f:CoreFlight={kind:'SHOT',origin:{x:10,y:10},velocity:{x:0,y:-24},fromId:p.id,receiverId:null,actionId:'physical-test',possessionId:s.possession.id,releasedTick:0,height:1.05,goalHeight:1.05,goalSide:'TOP',touchedIds:[p.id],purpose:'PLAY'};
 const centre=keeperReachForShot(s,k,f,{x:10,y:1.4});f.height=1.9;f.goalHeight=1.9;
 const high=keeperReachForShot(s,k,f,{x:10,y:1.4});assert.ok(high<centre&&high>0&&centre<.75);
 setProfile(k,{keeper:{...k.profile.keeper!,high:1}});const skilled=keeperReachForShot(s,k,f,{x:10,y:1.4});
 setProfile(k,{keeper:{...k.profile.keeper!,high:0}});assert.ok(skilled>keeperReachForShot(s,k,f,{x:10,y:1.4}));
 f.height=3;f.goalHeight=3;assert.equal(keeperReachForShot(s,k,f,{x:10,y:1.4}),0);
});

function duel(seed:number,shooter:number,keeper:number,depth=9){
 const s=createCoreScenario('BACKCOURT_SHOT',seed),p=getPlayer(s,'H03'),k=getPlayer(s,'A07');
 for(const body of s.players)if(body!==p&&body!==k){body.population='BENCH';body.zone=null;}
 p.position={x:10,y:depth};k.position={x:10,y:1.4};s.ball.position={...p.position};s.ball.controllerId=p.id;s.ball.live=true;
 s.checkpoint.stopOnOutcome=false;
 setProfile(p,{shotPlacement:shooter,finishing:shooter,shotPower:shooter,composure:shooter});
 setProfile(k,{reaction:.32-.18*keeper,acceleration:5+4*keeper,topSpeed:3.2+1.6*keeper,keeper:{positioning:keeper,setPosition:keeper,reaction:keeper,explosiveness:keeper,low:keeper,high:keeper,close:keeper,long:keeper,wing:keeper,sevenMetre:keeper,reading:keeper,outlet:keeper}});
 startAction(s,p,'SHOOT','Controlled same-context duel',null,null,'BACKCOURT_JUMP');p.action!.phase='EXECUTING';
 p.action!.target={x:planShotTarget(s,p,seed%2?-1:1).aimX,y:0};startAction(s,k,'SAVE','Visible prepared throwing stance',{...k.position});k.action!.phase='EXECUTING';
 p.action!.phase='COMMITTED';prepareKeeperAnticipation(s,k,p);
 for(let i=0;i<6;i++){s.tick++;s.timeMs=s.tick*50;move(s,k,k.action!.target,true);}
 p.action!.phase='EXECUTING';resolveEffects(s,[{playerId:p.id,kind:'SHOOT'}]);
 const shotId=s.ball.flight!.actionId;
 for(let i=0;i<60&&s.status==='RUNNING'&&s.ball.flight&&!s.events.some(e=>e.type==='GOAL'&&e.actionId===shotId);i++)advanceCoreMutable(s);
 const goal=s.events.some(e=>e.type==='GOAL'&&e.actionId===shotId);
 return{goal,save:!goal&&s.events.some(e=>(e.type==='SAVE_CAUGHT'||e.type==='SAVE_PARRY')&&e.actionId===shotId),state:s};
}
test('same-context shooter and keeper capabilities remain effective across seeded duels',(t)=>{
 let good=0,poor=0,strongSaves=0,weakSaves=0,close=0,far=0;
 for(let seed=1;seed<=160;seed++){
  good+=Number(duel(seed,.9,.5).goal);poor+=Number(duel(seed,.25,.5).goal);
  strongSaves+=Number(duel(seed,.65,.9).save);weakSaves+=Number(duel(seed,.65,.1).save);
  close+=Number(duel(seed,.65,.5,6.8).goal);far+=Number(duel(seed,.65,.5,11).goal);
 }
 assert.ok(good>poor,`shooter ${good}/${poor}`);assert.ok(strongSaves>weakSaves,`keeper ${strongSaves}/${weakSaves}`);assert.ok(close>far,`range ${close}/${far}`);
 t.diagnostic(JSON.stringify({n:160,strongShooterGoals:good,weakShooterGoals:poor,strongKeeperSaves:strongSaves,weakKeeperSaves:weakSaves,closeGoals:close,farGoals:far}));
});
test('a deflected shot which physically crosses the goal mouth is still a goal with the original action identity',()=>{
 const s=createCoreScenario(),p=getPlayer(s,'H03');for(const body of s.players)if(body!==p)body.population='BENCH';
 s.ball.live=true;s.ball.controllerId=null;s.ball.position={x:10,y:.05};s.ball.height=1.1;
 s.ball.flight={kind:'DEFLECTION',sourceKind:'SHOT',origin:{x:10,y:8},velocity:{x:0,y:-3},fromId:p.id,receiverId:null,actionId:'touched-shot',possessionId:s.possession.id,releasedTick:0,height:1.1,goalHeight:1.1,goalSide:'TOP',touchedIds:[p.id,'A07'],purpose:'PLAY'};
 s.tick=1;advanceBall(s);assert.equal(s.score.HOME,1);assert.equal(s.events.find(e=>e.type==='GOAL')?.actionId,'touched-shot');
});
test('wide and above-bar trajectories cannot be attributed as conventional goalkeeper saves',()=>{
 const s=createCoreScenario(),p=getPlayer(s,'H03'),f:CoreFlight={kind:'SHOT',origin:{x:10,y:10},velocity:{x:0,y:-24},fromId:p.id,receiverId:null,actionId:'flight',possessionId:s.possession.id,releasedTick:0,height:1.5,goalHeight:1.1,goalSide:'TOP',touchedIds:[p.id],purpose:'PLAY'};
 assert.equal(goalBoundShot(f),true);f.goalHeight=2.2;assert.equal(goalBoundShot(f),false);f.goalHeight=1.1;f.velocity.x=5;assert.equal(goalBoundShot(f),false);
});
test('a physical shot continuation remains exactly deterministic through JSON save/reload',()=>{
 const first=duel(37,.65,.5).state,restored=JSON.parse(JSON.stringify(first));
 for(let i=0;i<10&&first.status==='RUNNING';i++){advanceCoreMutable(first);advanceCoreMutable(restored);}
 assert.deepEqual(first,restored);
});
test('forward intent alone is not a clear chance; area-line, counterattack and empty-goal evidence differ',()=>{
 const s=createCoreScenario(),a=getPlayer(s,'H03'),d=getPlayer(s,'A03');
 for(const p of s.players)if(p.team==='AWAY'&&p!==d&&p.kind==='FIELD_PLAYER')p.population='BENCH';
 a.position={x:10,y:11};d.position={x:10,y:11.8};s.ball.position={...a.position};startAction(s,a,'DRIVE','Controlled forward approach',{x:10,y:8});a.action!.phase='EXECUTING';
 assert.equal(clearChanceDestroyed(s,a,d).clear,false);
 a.position={x:10,y:7.4};assert.equal(clearChanceDestroyed(s,a,d).clear,true);
 a.position={x:10,y:14};s.possession.phase='TRANSITION';a.velocity={x:0,y:-3};assert.equal(clearChanceDestroyed(s,a,d).clear,true);
 a.velocity={x:0,y:0};s.possession.phase='ESTABLISHED';getPlayer(s,'A07').population='BENCH';assert.equal(clearChanceDestroyed(s,a,d).clear,false,'empty goal still requires an actual direct throw');
 a.action!.kind='SHOOT';assert.equal(clearChanceDestroyed(s,a,d).clear,true);
});
test('restart and discipline are independent; light contact can destroy a chance without a personal sanction',()=>{
 const s=createCoreScenario(),a=getPlayer(s,'H03'),d=getPlayer(s,'A03');
 for(const p of s.players)if(p.team==='AWAY'&&p!==d&&p.kind==='FIELD_PLAYER')p.population='BENCH';
 a.position={x:10,y:7.4};d.position={x:10,y:8.1};startAction(s,a,'DRIVE','An actual close controlled chance',{x:10,y:6.9});a.action!.phase='COMMITTED';
 const read=readContact(s,a,d,'BENT_ARMS','BEHIND',.7);assert.equal(read.clearChance,true);assert.equal(read.severity,'ORDINARY');
 judgeFoul(s,a,d,read.severity,read.reason,read.clearChance,'physical-contact');assert.equal(s.restart?.kind,'SEVEN_METRE');assert.equal(d.warnings,0);assert.equal(d.sanctions,0);
});
test('gameplay import graph contains no benchmark targets, empirical data or uncontrolled random draws',()=>{
 const dir=__dirname;for(const name of readdirSync(dir).filter(n=>n.endsWith('.ts')&&!n.endsWith('.test.ts'))){
  const source=readFileSync(join(dir,name),'utf8');assert.doesNotMatch(source,/Math\.random\s*\(|from\s*['"][^'"]*(?:matchBenchmarks|empirical-handball|empiricalComparison)|require\([^)]*(?:matchBenchmarks|empirical-handball)/,name);
 }
});
test('injected benchmark targets cannot affect canonical trajectories, events, outcomes or RNG',()=>{
 const a=createCoreScenario('BACKCOURT_SHOT',51),b=structuredClone(a)as typeof a&{benchmarkTargets?:unknown};
 b.benchmarkTargets={goals:999,savePct:0,M9Share:0,suspensions:999,scorerConcentration:0,percentiles:[0,1]};
 for(let i=0;i<35&&a.status==='RUNNING';i++){advanceCoreMutable(a);advanceCoreMutable(b);}
 delete b.benchmarkTargets;assert.deepEqual(b,a);
});
