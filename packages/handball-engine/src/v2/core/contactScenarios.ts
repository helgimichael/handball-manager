import { createCoreScenario } from './scenarios';
import { getPlayer,type Direction } from './state';
import { world } from './space';
import { startAction } from './actions';
import { planContact } from './contact';

export const CONTACT_SCENARIOS=['FRONTAL_CONTACT','LATE_HOLD','EVADED_CONTACT','SHOULDER_BREAKTHROUGH'] as const;
export type ContactScenario=typeof CONTACT_SCENARIOS[number];
/** Initial physical situations and commitments only; the executor determines every outcome. */
export function createContactScenario(kind:ContactScenario,seed=2025,direction:Direction='TOP') {
  const s=createCoreScenario('ESTABLISHED_6V6',seed,direction);s.scenario=kind;
  const a=getPlayer(s,'H03'),d=getPlayer(s,'A03');
  a.position=world({x:10,y:9.5},direction);d.position=world(kind==='FRONTAL_CONTACT'?{x:10,y:8.7}:{x:10.8,y:9.5},direction);
  s.ball.position={...a.position};s.defence.pressureId=d.id;
  if(kind==='SHOULDER_BREAKTHROUGH') {
    d.position=world({x:9.2,y:9.2},direction);
    startAction(s,d,'CONTAIN','Committed to the inside lane before attacker crosses outside',d.position,a.id);
    startAction(s,a,'DRIVE','Carry through the outside shoulder of the committed defender',world({x:10,y:7.8},direction),d.id);
    a.velocity={x:0,y:direction==='TOP'?-3:3};return s;
  }
  startAction(s,a,kind==='EVADED_CONTACT'?'DRIBBLE':'DRIVE','Attack the available space against an already close defender',world({x:kind==='EVADED_CONTACT'?7:10,y:8},direction));
  if(kind==='EVADED_CONTACT') {
    a.action!.phase='EXECUTING';a.action!.phaseTick=0;a.velocity={x:-3,y:0};
    a.handling.dribbleUsed=true;s.ball.mode='DRIBBLE';
  }
  planContact(s,d,a);return s;
}
