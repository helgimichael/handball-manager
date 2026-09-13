import { CORE_VERSION, CORE_RULES, getPlayer, otherTeam, type CoreState, type CorePlayer, type Direction, type Role } from './state';
import { structurePoint, world } from './space';
import { defendWing } from './wing';

export const CORE_SCENARIOS = ['ESTABLISHED_6V6','TRANSITION_3V2','FREE_THROW','PIVOT_2V2','WING_FINISH','BACKCOURT_SHOT','DEFENSIVE_HELP','PRESSURE_5_1','EMPTY_GOAL'] as const;
export type CoreScenario = typeof CORE_SCENARIOS[number];
export function createCoreScenario(scenario: CoreScenario='ESTABLISHED_6V6',seed=2025,direction: Direction='TOP'): CoreState {
  if(!CORE_SCENARIOS.includes(scenario)||!Number.isInteger(seed)||seed<0||seed>0xffffffff||!['TOP','BOTTOM'].includes(direction))throw new Error('Invalid core scenario options');
  const roles: Role[]=['LW','LB','CB','RB','RW','P','GK'];
  const players: CorePlayer[]=[];
  for(const team of ['HOME','AWAY'] as const) roles.forEach((role,i)=>{
    const position=team==='HOME'?structurePoint(role,direction):world(role==='GK'?{x:10,y:1.5}:{x:[2.2,5.5,8.5,13.8,17.8,11.4][i],y:[5.9,6.6,6.6,6.6,5.9,6.6][i]},direction);
    players.push({id:`${team==='HOME'?'H':'A'}${String(i+1).padStart(2,'0')}`,team,kind:role==='GK'?'GOALKEEPER':'FIELD_PLAYER',role,population:'COURT',position,velocity:{x:0,y:0},radius:.28,
      attributes:{speed:role==='GK'?3.5:5.4,acceleration:5.5,skill:.65,defence:.65,keeping:.65},
      duty:{kind:'WAIT',targetId:null,sinceTick:0,reason:'Scenario setup'},intent:{id:'initial',effect:'WAIT',reason:'Scenario setup',targetId:null},action:null,support:null,
      handling:{heldSinceTick:0,steps:0,stepDistance:0,dribbleUsed:false,bounceTick:0},airborne:null,beatenUntilTick:0,wrongFootedUntilTick:0,screenedUntilTick:0,suspensionUntilMs:null,sanctions:0,warnings:0,nextAction:null,reception:null});
  });
  const state: CoreState={version:CORE_VERSION,ruleProfile:{...CORE_RULES},scenario,seed,rng:{algorithm:'mulberry32',state:seed,draws:0},tick:0,timeMs:0,period:1,officialClock:{timeMs:0,running:true},status:'RUNNING',reason:null,
    directions:{HOME:direction,AWAY:direction==='TOP'?'BOTTOM':'TOP'},score:{HOME:0,AWAY:0},possession:{id:'possession-0',team:'HOME',sinceTick:0,phase:'ESTABLISHED',completedPasses:0,lastPasserId:null},
    defence:{team:'AWAY',system:scenario==='PRESSURE_5_1'?'5:1':'6:0',marks:{},pressureId:null,helperId:null,lastHandoverTick:0,handover:null},players,
    ball:{mode:'CONTROLLED',position:{...players.find(p=>p.id==='H03')!.position},height:1.2,controllerId:'H03',live:true,flight:null,lastTouchId:'H03'},restart:null,contests:[],events:[],nextId:1,exchanges:[],flow:{continuous:false,outcomes:0,lastOutcomeTick:-1,stopAfter:null,sevenVTeam:null},match:null,
    checkpoint:{maxTicks:1200,stopOnOutcome:true,initialPossessionId:'possession-0',outcome:null}};
  const place=(id:string,x:number,y:number)=>{getPlayer(state,id).position=world({x,y},direction);};
  for(const d of players.filter(p=>p.team==='AWAY'&&(p.role==='LW'||p.role==='RW'))) {
    const attacker=players.find(p=>p.team==='HOME'&&p.role===d.role)!;
    d.position=defendWing(state,d,attacker)??d.position;
  }
  if(scenario==='TRANSITION_3V2'||scenario==='EMPTY_GOAL') {
    state.possession.phase='TRANSITION';
    place('H03',10,22);place('H02',5,17);place('H04',15,17);
    place('A02',7,12);place('A04',13,12);
    for(const id of ['A01','A03','A05','A06'])place(id,Number(id.slice(1))*2.5,29);
    for(const id of ['H01','H05','H06'])place(id,Number(id.slice(1))*2.5,33);
    if(scenario==='EMPTY_GOAL')getPlayer(state,'A07').population='BENCH';
  }
  if(scenario==='WING_FINISH'){state.ball.controllerId='H01';state.possession.completedPasses=2;}
  if(scenario==='BACKCOURT_SHOT'){state.possession.completedPasses=2;}
  if(scenario==='PIVOT_2V2'){place('H03',10,8.8);place('A03',9,7.7);place('H06',11.4,6.6);place('A06',12,6.6);}
  if(scenario==='DEFENSIVE_HELP'){place('H03',9.3,8);place('A03',9.4,9.5);getPlayer(state,'A03').beatenUntilTick=40;}
  state.ball.position={...getPlayer(state,state.ball.controllerId!).position};
  if(scenario==='FREE_THROW') {
    for(const p of players.filter(p=>p.team==='HOME'&&p.kind==='FIELD_PLAYER')) {const q=world(p.position,direction);if(q.y<9.6) p.position=world({x:q.x,y:9.6},direction);}
    state.ball.mode='DEAD';state.ball.live=false;state.possession.phase='RESTART';
    state.restart={id:'restart-initial',kind:'FREE_THROW',owner:'HOME',location:{...state.ball.position},awardedTick:0,phase:'PREPARING',takerId:'H03',authorisedTick:null,collectorId:'H03',receiverId:'H04',context:null,plantedFoot:null};
  }
  // Marking allocation belongs to team structure, never nearest-player ball chasing.
  for(const p of players.filter(p=>p.team===otherTeam(state.possession.team)&&p.kind==='FIELD_PLAYER')) {
    state.defence.marks[p.id]=players.find(a=>a.team===state.possession.team&&a.role===p.role)!.id;
  }
  return state;
}
