import { CORE_VERSION, CORE_RULES, getPlayer, otherTeam, type CoreState, type CorePlayer, type Direction, type Role } from './state';
import { structurePoint, world } from './space';
import { startAction } from './actions';
import { defendWing } from './wing';
import { initialReferee } from './referee';
import { initialCondition } from './condition';
import { initialCoaching } from './coaching';
import { initialOffence } from './offence';
import { CHARACTERS, profileFor, type SquadCharacter } from './squads';
import { nextRandom } from '../primitives';

export const CORE_SCENARIOS = ['ESTABLISHED_6V6','TRANSITION_3V2','FREE_THROW','PIVOT_2V2','WING_FINISH','BACKCOURT_SHOT','DEFENSIVE_HELP','PRESSURE_5_1','EMPTY_GOAL'] as const;
export type CoreScenario = typeof CORE_SCENARIOS[number];
export function createCoreScenario(scenario: CoreScenario='ESTABLISHED_6V6',seed=2025,direction: Direction='TOP',squads?:Record<'HOME'|'AWAY',SquadCharacter>): CoreState {
  if(!CORE_SCENARIOS.includes(scenario)||!Number.isInteger(seed)||seed<0||seed>0xffffffff||!['TOP','BOTTOM'].includes(direction))throw new Error('Invalid core scenario options');
  const roles: Role[]=['LW','LB','CB','RB','RW','P','GK'];
  // PLAYER IDENTITY: squads are generated from seeded Handball Manager sheets,
  // so two teams differ before a single tick runs. A caller who wants a
  // controlled fixture asks for the neutral character on both sides.
  const characters=squads??{HOME:CHARACTERS.NEUTRAL,AWAY:CHARACTERS.NEUTRAL};
  const squadRng={algorithm:'mulberry32' as const,state:seed,draws:0};
  const draw=()=>nextRandom(squadRng);
  const players: CorePlayer[]=[];
  for(const team of ['HOME','AWAY'] as const) roles.forEach((role,i)=>{
    const position=team==='HOME'?structurePoint(role,direction):world(role==='GK'?{x:10,y:1.5}:{x:[2.2,5.5,8.5,13.8,17.8,11.4][i],y:[5.9,6.6,6.6,6.6,5.9,6.6][i]},direction);
    players.push({id:`${team==='HOME'?'H':'A'}${String(i+1).padStart(2,'0')}`,team,kind:role==='GK'?'GOALKEEPER':'FIELD_PLAYER',role,population:'COURT',position,velocity:{x:0,y:0},radius:.28,
      condition:initialCondition(),profile:profileFor(role,characters[team],draw),zone:null,
      duty:{kind:'WAIT',targetId:null,sinceTick:0,reason:'Scenario setup'},intent:{id:'initial',effect:'WAIT',reason:'Scenario setup',targetId:null},action:null,support:null,
      handling:{heldSinceTick:0,steps:0,stepDistance:0,dribbleUsed:false,bounceTick:0},airborne:null,beatenUntilTick:0,wrongFootedUntilTick:0,screenedUntilTick:0,suspensionUntilMs:null,sanctions:0,warnings:0,nextAction:null,reception:null});
  });
  const state: CoreState={version:CORE_VERSION,ruleProfile:{...CORE_RULES},scenario,seed,rng:{algorithm:'mulberry32',state:seed,draws:0},tick:0,timeMs:0,period:1,officialClock:{timeMs:0,running:true},status:'RUNNING',reason:null,
    directions:{HOME:direction,AWAY:direction==='TOP'?'BOTTOM':'TOP'},score:{HOME:0,AWAY:0},possession:{id:'possession-0',team:'HOME',sinceTick:0,phase:'ESTABLISHED',completedPasses:0,lastPasserId:null},
    defence:{team:'AWAY',system:scenario==='PRESSURE_5_1'?'5:1':'6:0',marks:{},pressureId:null,helperId:null,lastHandoverTick:0,handover:null,read:{engaged:null,shift:0,compact:1}},players,
    ball:{mode:'CONTROLLED',position:{...players.find(p=>p.id==='H03')!.position},height:1.2,controllerId:'H03',live:true,flight:null,lastTouchId:'H03'},restart:null,contests:[],events:[],nextId:1,exchanges:[],flow:{continuous:false,outcomes:0,lastOutcomeTick:-1,stopAfter:null,sevenVTeam:null},match:null,
    referee:initialReferee(),coaching:initialCoaching(),offence:initialOffence(),checkpoint:{maxTicks:1200,stopOnOutcome:true,initialPossessionId:'possession-0',outcome:null}};
  state.coaching.AWAY.defence=state.defence.system;
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
  // COLLECTIVE DEFENCE: a hand-placed fixture must stage a situation the zonal
  // line would actually produce, or the allocation correctly sends the defender
  // back to his own space and the duel never happens. A03 is the centre back
  // and owns the space at 8.9, so the carrier is put in it and the defender is
  // given that zone outright.
  if(scenario==='PIVOT_2V2'){
    place('H03',8.9,8.8);place('A03',8.9,7.6);place('H06',11.4,6.6);place('A06',12,6.6);
    getPlayer(state,'A03').zone=direction==='TOP'?2:3;
    state.defence.pressureId='A03';
    // The duel is the subject of this fixture, so it is staged rather than
    // hoped for: the carrier commits to a feint against the man in front of
    // him and the executor decides the outcome from the two profiles.
    startAction(state,getPlayer(state,'A03'),'PRESS','Engage the carrier in the central space',getPlayer(state,'A03').position,'H03');
    startAction(state,getPlayer(state,'H03'),'FEINT','Commit to a feint against the pressing defender',null,'A03');
    // Both commitments are already live and the feint resolves immediately, so
    // the duel happens while the two men are where the fixture put them rather
    // than after the line has had time to reorganise around them.
    getPlayer(state,'A03').action!.phase='EXECUTING';
    getPlayer(state,'H03').action!.phase='EXECUTING';getPlayer(state,'H03').action!.executeTicks=1;
  }
  if(scenario==='DEFENSIVE_HELP'){
    place('H03',8.9,8);place('A03',8.9,9.5);getPlayer(state,'A03').beatenUntilTick=40;
    getPlayer(state,'A03').zone=direction==='TOP'?2:3;
  }
  state.ball.position={...getPlayer(state,state.ball.controllerId!).position};
  if(scenario==='FREE_THROW') {
    for(const p of players.filter(p=>p.team==='HOME'&&p.kind==='FIELD_PLAYER')) {const q=world(p.position,direction);if(q.y<9.6) p.position=world({x:q.x,y:9.6},direction);}
    state.ball.mode='DEAD';state.ball.live=false;state.possession.phase='RESTART';
    state.restart={id:'restart-initial',kind:'FREE_THROW',owner:'HOME',location:{...state.ball.position},awardedTick:0,pausedTicks:0,phase:'PREPARING',takerId:'H03',authorisedTick:null,collectorId:'H03',receiverId:'H04',context:null,plantedFoot:null};
  }
  // Marking allocation belongs to team structure, never nearest-player ball chasing.
  for(const p of players.filter(p=>p.team===otherTeam(state.possession.team)&&p.kind==='FIELD_PLAYER')) {
    state.defence.marks[p.id]=players.find(a=>a.team===state.possession.team&&a.role===p.role)!.id;
  }
  return state;
}
