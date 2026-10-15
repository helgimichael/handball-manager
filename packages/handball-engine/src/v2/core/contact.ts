import { actionAvailable,courtPlayers,getPlayer,otherTeam,record,type CorePlayer,type CoreState } from './state';
import { distance,goal,local,shootingAngle } from './space';
import { resolveAction,startAction } from './actions';
import { contest } from './interactions';
import { foul,interrupt } from './transitions';
import { readContact } from './sanction';
import {defenderRelation,lostContactShoulder} from './threatRelation';
import {physicalImpulse} from './physicalLoad';

export function contactApproach(s:CoreState,a:CorePlayer,d:CorePlayer):'FRONT'|'SIDE'|'BEHIND' {
  const g=goal(s.directions[a.team]),length=Math.max(.001,distance(a.position,g)*distance(a.position,d.position));
  const alignment=((d.position.x-a.position.x)*(g.x-a.position.x)+(d.position.y-a.position.y)*(g.y-a.position.y))/length;
  return alignment>.55?'FRONT':alignment<-.25?'BEHIND':'SIDE';
}
/** A defender commits a technique against one assigned carrier, before knowing its outcome. */
export function planContact(s:CoreState,d:CorePlayer,a:CorePlayer):boolean {
  if(distance(a.position,d.position)>1.05||a.airborne||d.screenedUntilTick>s.tick)return false;
  const recoveringOriginal=d.duty.kind==='RECOVER'&&d.beatenBy===a.id&&d.beatenUntilTick>s.tick&&distance(a.position,d.position)<=.95;
  if(d.id!==s.defence.pressureId&&d.id!==s.defence.helperId&&!recoveringOriginal)return false;
  const approach=contactApproach(s,a,d);
  const penetration=['DRIVE','DRIBBLE'].includes(a.action?.kind??'')&&a.action?.phase==='EXECUTING';
  const beaten=d.beatenUntilTick>s.tick;
  if(beaten&&!penetration)return false;
  // A defender already behind a settled passer/shooter cannot establish
  // bent-arm containment. Recover instead of repeatedly committing a phantom
  // contact against the back of a stationary ball carrier.
  if(approach==='BEHIND'&&!penetration)return false;
  // A disciplined defender prefers to contain rather than grab, and only
  // reaches when he has genuinely been beaten to the space.
  // Meeting from the side is still ordinary containment. A hold is a late
  // recovery technique after the carrier has genuinely passed the shoulder,
  // not the default answer whenever a moving helper is slightly oblique.
  const desperate=lostContactShoulder(a,d,goal(s.directions[a.team]))&&penetration;
  // A partial shoulder loss still permits disciplined recovery. The full
  // stamped duel loss is a separate desperation context; merely being on
  // the rear quarter must not give every defender its .95 hold threshold.
  const forward=defenderRelation(a,d,goal(s.directions[a.team])).forward;
  const shoulderLoss=Math.min(1,Math.max(0,(-forward-a.radius)/(a.radius+d.radius)));
  // Losing just the edge of the shoulder is not full desperation. The reach
  // grows with actual lost position; the original stamped-beaten case keeps
  // its established .95 threshold. This avoids a discontinuous jump that
  // made ordinary low-discipline lateral defenders grab at the first overlap.
  const holdThreshold=beaten?.95:.4+.55*shoulderLoss;
  const technique=desperate&&d.profile.discipline<holdThreshold?'HOLD':'BENT_ARMS';
  // Responsibility has handed over, but the passed man's actual arm may still
  // reach the carrier. This is one original recovery episode, not an extra
  // pressure owner. A disciplined recovery does not create rear contact.
  if(recoveringOriginal&&technique!=='HOLD')return false;
  if(!actionAvailable(d)){
    const action=d.action;
    if(!action||action.phase!=='EXECUTING'||!(recoveringOriginal&&action.kind==='RECOVER'||['PRESS','HELP','CONTAIN'].includes(action.kind)&&action.targetId===a.id))return false;
    resolveAction(s,d,'Approach physically reached the carrier; prepare the actual contact');
  }
  if(!startAction(s,d,'CONTACT',technique==='HOLD'?'Late to penetration; commit holding attempt':'Establish bent-arm contact while retaining goal-side position',null,a.id))return false;
  d.action!.contact={technique,approach};return true;
}
/** Resolved for every live action path, independently of the carrier's choice of FEINT. */
export function resolveContacts(s:CoreState) {
  if(!s.ball.live||!s.ball.controllerId)return;
  const a=getPlayer(s,s.ball.controllerId);
  if(a.kind==='GOALKEEPER')return;
  for(const d of courtPlayers(s,otherTeam(a.team))) {
    const action=d.action;
    if(action?.kind!=='CONTACT'||action.phase!=='EXECUTING'||action.resolved||action.targetId!==a.id||!action.contact)continue;
    action.resolved=true;
    const separation=distance(a.position,d.position),approach=contactApproach(s,a,d);
    if(separation>.95||(d.beatenUntilTick>s.tick&&action.contact.technique!=='HOLD')||d.screenedUntilTick>s.tick) {
      record(s,'CONTACT_MISSED',d,{separation,technique:action.contact.technique},[a.id]);continue;
    }
    // CONTACT AND PUNISHMENT: the referee reads the contact that actually
    // happened -- technique, angle, closing speed, and what the attacker was
    // about to do -- instead of treating every hold as the same offence.
    const read=readContact(s,a,d,action.contact.technique,approach,separation);
    physicalImpulse(a,'contact',.8);physicalImpulse(d,'contact',.8);
    const id=contest(s,'CONTACT',a,d,read.severity==='LEGAL'?(approach==='FRONT'?'FRONTAL_CONTACT':'MONITORED'):read.severity,separation,read.severity==='LEGAL'?10:0,action.id);
    action.contestIds.push(id);
    record(s,'CONTACT_EXECUTED',d,{physicalContactId:id,technique:action.contact.technique,committedApproach:action.contact.approach,approach,separation,carrierAction:a.action?.kind??'NONE',severity:read.severity,reason:read.reason,clearChance:read.clearChance,...read.detail},[a.id],id,action.id);
    if(read.severity!=='LEGAL') {foul(s,a,d,read.severity,read.reason,read.clearChance,id);return;}
    // Legal contact does not cancel a committed pass or shot. Frontal trunk
    // containment stops penetration, while control and its handling clock persist.
    if(approach==='FRONT'&&['DRIVE','DRIBBLE'].includes(a.action?.kind??'')) {
      const dribbling=s.ball.mode==='DRIBBLE';interrupt(s,a,'Frontal legal contact stopped penetration');
      if(dribbling){s.ball.mode='CONTROLLED';s.ball.height=1.2;a.handling.steps=0;a.handling.stepDistance=0;a.handling.heldSinceTick=s.tick;record(s,'DRIBBLE_GATHERED',a,{reason:'Gathered under frontal contact'});}
    }
    record(s,'LEGAL_CONTACT',d,{approach,separation},[a.id],id,action.id);
  }
}
