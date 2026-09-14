import { courtPlayers,getPlayer,otherTeam,record,type CorePlayer,type CoreState } from './state';
import { distance,goal,local,shootingAngle } from './space';
import { startAction } from './actions';
import { contest } from './interactions';
import { foul,interrupt } from './transitions';
import { readContact } from './sanction';

export function contactApproach(s:CoreState,a:CorePlayer,d:CorePlayer):'FRONT'|'SIDE'|'BEHIND' {
  const g=goal(s.directions[a.team]),length=Math.max(.001,distance(a.position,g)*distance(a.position,d.position));
  const alignment=((d.position.x-a.position.x)*(g.x-a.position.x)+(d.position.y-a.position.y)*(g.y-a.position.y))/length;
  return alignment>.55?'FRONT':alignment<-.25?'BEHIND':'SIDE';
}
/** A defender commits a technique against one assigned carrier, before knowing its outcome. */
export function planContact(s:CoreState,d:CorePlayer,a:CorePlayer):boolean {
  if(distance(a.position,d.position)>1.05||a.airborne||d.screenedUntilTick>s.tick)return false;
  if(d.id!==s.defence.pressureId&&d.id!==s.defence.helperId)return false;
  const approach=contactApproach(s,a,d);
  const penetration=['DRIVE','DRIBBLE'].includes(a.action?.kind??'');
  const beaten=d.beatenUntilTick>s.tick;
  if(beaten&&!penetration)return false;
  // A disciplined defender prefers to contain rather than grab, and only
  // reaches when he has genuinely been beaten to the space.
  const desperate=(approach!=='FRONT'||beaten)&&penetration;
  const technique=desperate&&d.profile.discipline<.55+.4*(beaten?1:0)?'HOLD':'BENT_ARMS';
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
    const id=contest(s,'CONTACT',a,d,read.severity==='LEGAL'?(approach==='FRONT'?'FRONTAL_CONTACT':'MONITORED'):read.severity,separation,read.severity==='LEGAL'?10:0,action.id);
    action.contestIds.push(id);
    record(s,'CONTACT_EXECUTED',d,{technique:action.contact.technique,committedApproach:action.contact.approach,approach,separation,carrierAction:a.action?.kind??'NONE',severity:read.severity,reason:read.reason,clearChance:read.clearChance,...read.detail},[a.id],id,action.id);
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
