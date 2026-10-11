import { createCoreScenario } from './scenarios';
import { getPlayer,type Direction } from './state';
import { world } from './space';
import { ZONE_ANCHORS } from './defence';
import { startAction } from './actions';
import { planContact } from './contact';

export const CONTACT_SCENARIOS=['FRONTAL_CONTACT','LATE_HOLD','EVADED_CONTACT','SHOULDER_BREAKTHROUGH'] as const;
export type ContactScenario=typeof CONTACT_SCENARIOS[number];
/** Initial physical situations and commitments only; the executor determines every outcome. */
export function createContactScenario(kind:ContactScenario,seed=2025,direction:Direction='TOP') {
  const s=createCoreScenario('ESTABLISHED_6V6',seed,direction);s.scenario=kind;
  const a=getPlayer(s,'H03'),d=getPlayer(s,'A03');
  // COLLECTIVE DEFENCE: the fixture has to stage a situation the line would
  // actually produce. A03 is the centre back and owns the central space, so the
  // carrier is placed in THAT space; otherwise the zonal allocation correctly
  // sends this defender back to his own post and the contact never happens.
  const lane=ZONE_ANCHORS[2];
  a.position=world({x:lane,y:9.5},direction);d.position=world(kind==='FRONTAL_CONTACT'?{x:lane,y:8.7}:{x:lane+.8,y:9.5},direction);
  d.zone=direction==='TOP'?2:ZONE_ANCHORS.length-1-2;
  s.ball.position={...a.position};s.defence.pressureId=d.id;
  if(kind==='SHOULDER_BREAKTHROUGH') {
    d.position=world({x:lane-.8,y:9.2},direction);
    startAction(s,d,'CONTAIN','Committed to the inside lane before attacker crosses outside',d.position,a.id);
    startAction(s,a,'DRIVE','Carry through the outside shoulder of the committed defender',world({x:lane,y:7.8},direction),d.id);
    a.velocity={x:0,y:direction==='TOP'?-3:3};return s;
  }
  startAction(s,a,kind==='EVADED_CONTACT'?'DRIBBLE':'DRIVE','Attack the available space against an already close defender',world({x:kind==='EVADED_CONTACT'?lane-3:lane,y:8},direction));
  if(kind==='EVADED_CONTACT') {
    a.action!.phase='EXECUTING';a.action!.phaseTick=0;a.velocity={x:-3,y:0};
    a.handling.dribbleUsed=true;s.ball.mode='DRIBBLE';
  }
  // A disciplined defender contains rather than grabs, which is correct and
  // makes a fixture named LATE_HOLD produce legal contact. The defender who is
  // supposed to hold is given the indiscipline to do it.
  if(kind==='LATE_HOLD')d.profile={...d.profile,discipline:.1,contact:.2};
  if(kind==='LATE_HOLD'){
    // A genuine near-line chance, rather than any forward drive from 9.5m.
    a.position=world({x:lane,y:7.4},direction);d.position=world({x:lane+.8,y:7.4},direction);s.ball.position={...a.position};
    a.action!.target=world({x:lane,y:6.9},direction);
    a.action!.phase='EXECUTING';
    for(const other of s.players.filter(p=>p.team===d.team&&p.kind==='FIELD_PLAYER'&&p.id!==d.id))other.position=world({x:18,y:12+Number(other.id.slice(1))*1.2},direction);
  }
  // The hold is the subject of the LATE_HOLD fixture, so the commitment is live
  // rather than still preparing: four ticks of preparation were enough for the
  // zonal line to reposition the defender and the contact then missed.
  planContact(s,d,a);
  if(kind==='LATE_HOLD'&&d.action){d.action.phase='EXECUTING';d.action.phaseTick=0;}
  if(kind==='LATE_HOLD')a.action!.phase='COMMITTED';
  return s;
}
