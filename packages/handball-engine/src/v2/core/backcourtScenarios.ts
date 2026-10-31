import { createCoreScenario } from './scenarios';
import { getPlayer,type Direction } from './state';
import { startAction } from './actions';
import { world } from './space';

export const BACKCOURT_SCENARIOS=['COMPACT_DEFENCE_WIDTH','PIVOT_INTERVAL_SUPPORT','PENETRATION_SPACING','WING_BACKCOURT_RETURN'] as const;
export type BackcourtScenario=typeof BACKCOURT_SCENARIOS[number];
export function createBackcourtScenario(name:BackcourtScenario='COMPACT_DEFENCE_WIDTH',seed=2025,direction:Direction='TOP') {
  if(!BACKCOURT_SCENARIOS.includes(name))throw new Error('Invalid backcourt scenario');
  const s=createCoreScenario('ESTABLISHED_6V6',seed,direction);s.scenario=name;
  const place=(id:string,x:number,y:number)=>{getPlayer(s,id).position=world({x,y},direction);};
  if(name==='COMPACT_DEFENCE_WIDTH'){place('A04',7,7.2);place('A03',10,7.2);place('A02',13,7.2);}
  if(name==='PIVOT_INTERVAL_SUPPORT') {
    place('A04',4,7.2);place('A03',9,7.2);place('H06',6.4,7);
    startAction(s,getPlayer(s,'H06'),'SCREEN','Committed pivot screen opens the inside connection',null,'A04');
    getPlayer(s,'H06').action!.phase='EXECUTING';
  }
  if(name==='PENETRATION_SPACING') {
    place('H03',9,9.5);place('A03',10.4,7.8);
    startAction(s,getPlayer(s,'H03'),'DRIVE','Committed central penetration',world({x:7.8,y:8},direction),'A03');
    getPlayer(s,'H03').action!.phase='EXECUTING';
  }
  if(name==='WING_BACKCOURT_RETURN') {
    place('H01',1.2,3.8);place('A05',2.2,3);place('A04',3,3.8);
    s.ball.controllerId='H01';getPlayer(s,'H01').handling.steps=1;
  }
  s.ball.position={...getPlayer(s,s.ball.controllerId!).position};
  return s;
}
