/** Short same-geometry shot duels: conditional causal diagnostics, not league calibration. */
import {writeFileSync,mkdirSync} from 'node:fs';import {resolve} from 'node:path';
import {createCoreScenario} from '@handball-manager/handball-engine/src/v2/core/scenarios';
import {getPlayer} from '@handball-manager/handball-engine/src/v2/core/state';
import {buildProfile,OUTCOURT_KEYS} from '@handball-manager/handball-engine/src/v2/core/profile';
import {planShotTarget,prepareKeeperAnticipation,receptionRisk} from '@handball-manager/handball-engine/src/v2/core/execution';
import {resolveEffects,advanceBall} from '@handball-manager/handball-engine/src/v2/core/interactions';
import {startAction,move} from '@handball-manager/handball-engine/src/v2/core/actions';
import {advanceCoreMutable} from '@handball-manager/handball-engine/src/v2/core/engine';
const physical=['ACCELERATION','TOP_SPEED','LATERAL_QUICKNESS','AGILITY','EXPLOSIVENESS','STRENGTH','CONTACT_BALANCE','JUMP_ABILITY','ENDURANCE','REPEAT_SPRINT_ABILITY','MOBILITY'];
function duel(seed:number,difficult:boolean,tired:boolean,physique:number,technique:number){
 const s=createCoreScenario('BACKCOURT_SHOT',seed),p=getPlayer(s,'H03'),k=getPlayer(s,'A07'),d=getPlayer(s,'A03');
 for(const body of s.players)if(body!==p&&body!==k&&(!difficult||body!==d)){body.population='BENCH';body.zone=null;}
 p.profile=buildProfile({...Object.fromEntries(OUTCOURT_KEYS.map(key=>[key,technique])),...Object.fromEntries(physical.map(key=>[key,physique]))},'LB');
 p.position={x:10,y:difficult?10.5:6.8};p.velocity={x:difficult?3:0,y:0};k.position={x:10,y:1.4};if(difficult){d.position={x:8.9,y:10};d.velocity={x:0,y:0};d.action=null;}
 p.condition.energy=tired?.25:1;p.condition.acuteExertion=tired?.9:0;
 s.ball.position={...p.position};s.ball.controllerId=p.id;s.ball.live=true;s.checkpoint.stopOnOutcome=false;
 startAction(s,p,'SHOOT','Same-context physical execution trial',null,null,difficult?'BACKCOURT_JUMP':'BREAKTHROUGH');p.action!.phase='EXECUTING';
 const plan=planShotTarget(s,p,seed%2?-1:1);p.action!.target={x:plan.aimX,y:0};startAction(s,k,'SAVE','Visible prepared throwing stance',{...k.position});k.action!.phase='EXECUTING';p.action!.phase='COMMITTED';prepareKeeperAnticipation(s,k,p);
 for(let i=0;i<6;i++){s.tick++;s.timeMs=s.tick*50;move(s,k,k.action!.target,true);}p.action!.phase='EXECUTING';resolveEffects(s,[{playerId:p.id,kind:'SHOOT'}]);const actionId=s.ball.flight!.actionId;
 for(let i=0;i<60&&s.status==='RUNNING'&&s.ball.flight&&!s.events.some(e=>e.type==='GOAL'&&e.actionId===actionId);i++)advanceCoreMutable(s);
 const events=s.events.filter(e=>e.actionId===actionId),goal=events.some(e=>e.type==='GOAL'),save=events.some(e=>e.type==='SAVE_CAUGHT'||e.type==='SAVE_PARRY'),block=events.some(e=>e.type==='SHOT_BLOCKED');
 return{seed,goal,save,block,placement:plan.placement,spread:plan.spread,pressure:plan.context.pressure};
}
const cells=[{name:'clearFresh',hard:false,tired:false,physical:13,technical:17},{name:'clearTired',hard:false,tired:true,physical:13,technical:17},{name:'difficultFresh',hard:true,tired:false,physical:13,technical:13},{name:'difficultTired',hard:true,tired:true,physical:13,technical:13},{name:'difficultTiredPhysical',hard:true,tired:true,physical:16,technical:13},{name:'difficultTiredElite',hard:true,tired:true,physical:16,technical:17},{name:'difficultTiredWeaker',hard:true,tired:true,physical:11,technical:11}];
const result=cells.map(c=>{const trials=Array.from({length:160},(_,i)=>duel(i+1,c.hard,c.tired,c.physical,c.technical));const mean=(key:'placement'|'spread'|'pressure')=>trials.reduce((n,p)=>n+p[key],0)/trials.length;return{...c,n:trials.length,goals:trials.filter(r=>r.goal).length,conversion:trials.filter(r=>r.goal).length/trials.length,saves:trials.filter(r=>r.save).length,blocks:trials.filter(r=>r.block).length,meanPlacement:mean('placement'),meanSpread:mean('spread'),meanPressure:mean('pressure')};});
function catchTrial(seed:number,hard:boolean,tired:boolean,physique:number,technique:number){
 const s=createCoreScenario('ESTABLISHED_6V6',72683+seed*104729),passer=getPlayer(s,'H03'),p=getPlayer(s,'H04'),d=getPlayer(s,'A03');
 for(const body of s.players)if(body!==p&&body!==passer&&(!hard||body!==d)){body.population='BENCH';body.zone=null;}
 passer.position={x:5,y:hard?15.5:15};p.position={x:10,y:15};p.velocity={x:hard?3:0,y:0};if(hard){d.position={x:10,y:14.3};d.action=null;}
 p.profile=buildProfile({...Object.fromEntries(OUTCOURT_KEYS.map(k=>[k,technique])),...Object.fromEntries(physical.map(k=>[k,physique]))},'RB');p.condition.energy=tired?.25:1;p.condition.acuteExertion=tired?.9:0;
 s.ball.live=true;s.ball.controllerId=passer.id;startAction(s,p,'RECEIVE','Controlled catch encounter');p.action!.phase='EXECUTING';s.ball.controllerId=null;s.ball.position={...passer.position};s.ball.mode='PASS_FLIGHT';
 const pace=hard?17:9,riskAtCentre=receptionRisk(s,p,p.position,pace);
 s.ball.flight={kind:'PASS',origin:{...passer.position},velocity:{x:pace,y:0},fromId:passer.id,receiverId:p.id,actionId:'controlled-catch',possessionId:s.possession.id,releasedTick:0,height:1.2,goalSide:'TOP',touchedIds:[passer.id],purpose:'PLAY'};
 for(let n=0;n<25&&s.ball.flight?.kind==='PASS';n++){s.tick++;s.timeMs=s.tick*50;advanceBall(s);}
 const failed=s.events.some(e=>e.type==='RECEPTION_FAILED'),received=s.events.some(e=>e.type==='PASS_RECEIVED');
 if(!failed&&!received)throw Error('Controlled pass did not reach its actual catch');
 if(s.events.some(e=>['SHOT_BLOCKED','SAVE_CAUGHT','OFFENSIVE_FOUL'].includes(e.type)))throw Error('Catch error was misclassified');
 return{failed,received,riskAtCentre};
}
const catchCells=[{name:'simpleFresh',hard:false,tired:false,physical:13,technical:13},{name:'simpleTired',hard:false,tired:true,physical:13,technical:13},{name:'difficultFresh',hard:true,tired:false,physical:13,technical:13},{name:'difficultTired',hard:true,tired:true,physical:13,technical:13},{name:'difficultTiredElite',hard:true,tired:true,physical:16,technical:17},{name:'difficultTiredWeaker',hard:true,tired:true,physical:11,technical:11}].map(c=>{const rows=Array.from({length:320},(_,i)=>catchTrial(i+1,c.hard,c.tired,c.physical,c.technical));return{...c,n:320,failedReceptions:rows.filter(r=>r.failed).length,failureRate:rows.filter(r=>r.failed).length/320,riskAtCentre:rows[0].riskAtCentre};});
const out=resolve('../../docs/physical-load-fatigue-v11');mkdirSync(out,{recursive:true});writeFileSync(out+'/EXECUTION-TRIALS.json',JSON.stringify({complete:true,pairedSeeds:true,design:'Same shooter/keeper or catch geometry and seeds per cell. Existing canonical release, ball flight, keeper and catch resolution. Only supported physical/technical attributes and initial physical state differ. Short same-context trials, not empirical validation.',cells:result,catchCells},null,2));console.log(JSON.stringify({complete:true,cells:result,catchCells}));
