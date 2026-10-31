import { createCoreScenario } from './scenarios';
import { getPlayer,type Direction } from './state';
import { world } from './space';

export const WING_SCENARIOS=['LEFT_WING_LINK','RIGHT_WING_LINK','CLOSED_WING_RETURN','OPEN_WING_FINISH'] as const;
export type WingScenario=typeof WING_SCENARIOS[number];
/** Fixtures supply physical initial conditions only. All decisions use the shared core. */
export function createWingScenario(name:WingScenario='LEFT_WING_LINK',seed=2025,direction:Direction='TOP') {
  if(!WING_SCENARIOS.includes(name))throw new Error('Invalid wing scenario');
  const s=createCoreScenario('ESTABLISHED_6V6',seed,direction);s.scenario=name;
  const place=(id:string,x:number,y:number)=>{getPlayer(s,id).position=world({x,y},direction);};
  s.ball.controllerId=name==='RIGHT_WING_LINK'?'H04':name==='LEFT_WING_LINK'?'H02':'H01';
  s.possession.completedPasses=1;
  if(name==='CLOSED_WING_RETURN') {
    place('H01',1.2,3.8);place('A05',2.2,3);place('A04',3,3.8);
    // A gathered receiver with one step already spent must find a legal outlet.
    getPlayer(s,'H01').handling.steps=1;
  }
  if(name==='OPEN_WING_FINISH'){place('H01',2.1,4);place('A05',4,5.5);}
  s.ball.position={...getPlayer(s,s.ball.controllerId).position};
  return s;
}
