/** Developer fixtures only. Never imported by the career action selector. */
import {createCoreScenario} from './scenarios';
import {world} from './space';
export const INTELLIGENCE_SCENARIOS=['A_FREE_TO_GOAL','B_HELP_M6','C_HELP_STAYS','D_TWO_V_ONE','E_THREE_V_TWO','F_WING_CREATED','G_FALSE_FREE','H_NO_ADVANTAGE','I_DEFENSIVE_HELP','J_RECOVERY'] as const;
export function createIntelligenceScenario(name:typeof INTELLIGENCE_SCENARIOS[number],seed=42,direction:'TOP'|'BOTTOM'='TOP'){
 const s=createCoreScenario('ESTABLISHED_6V6',seed,direction),p=s.players.find(a=>a.team==='HOME'&&a.role==='CB')!,d=s.players.find(a=>a.team==='AWAY'&&a.role==='CB')!,mate=s.players.find(a=>a.team==='HOME'&&a.role==='RB')!,h=s.players.find(a=>a.team==='AWAY'&&a.role==='RB')!,third=s.players.find(a=>a.team==='HOME'&&a.role==='LB')!;
 for(const a of s.players){a.population='BENCH';a.zone=null;a.action=null;}
 for(const a of [p,d,mate])a.population='COURT';
 const put=(a:typeof p,x:number,y:number)=>a.position=world({x,y},direction);
 const keeper=s.players.find(a=>a.team==='AWAY'&&a.kind==='GOALKEEPER')!;keeper.population='COURT';put(keeper,10,1.4);
 put(p,10,10.5);put(d,10,12);put(mate,15,12);p.velocity={x:0,y:direction==='TOP'?-2:2};d.velocity={x:0,y:0};d.zone=2;
 s.tick=20;s.timeMs=1000;s.ball.live=true;s.ball.mode='CONTROLLED';s.ball.controllerId=p.id;s.ball.position={...p.position};s.possession.phase='ESTABLISHED';s.possession.completedPasses=2;
 p.handling={heldSinceTick:5,steps:0,stepDistance:0,dribbleUsed:false,bounceTick:0};s.defence.marks={[d.id]:p.id};s.defence.pressureId=d.id;s.defence.helperId=null;
 if(['B_HELP_M6','C_HELP_STAYS','F_WING_CREATED','I_DEFENSIVE_HELP','J_RECOVERY'].includes(name)){
  h.population='COURT';h.zone=3;put(h,9,9.7);h.velocity={x:1,y:direction==='TOP'?.8:-.8};s.defence.helperId=h.id;mate.role='P';put(mate,13,7.4);s.defence.marks[h.id]=mate.id;
 }
 if(name==='C_HELP_STAYS'){put(h,16,9);h.velocity={x:0,y:0};}
 if(name==='D_TWO_V_ONE'){put(d,10,8);put(mate,15,9);}
 if(name==='E_THREE_V_TWO'){put(d,10,11.2);third.population='COURT';put(third,6,10);h.population='COURT';h.zone=1;put(h,5,8);}
 if(name==='F_WING_CREATED'){mate.role='RW';put(mate,16,6);}
 if(name==='G_FALSE_FREE')put(mate,18,12);
 if(name==='H_NO_ADVANTAGE'){put(d,10,9);h.population='COURT';h.zone=4;put(h,15,10);}
 return{s,p,d,mate,h};
}
