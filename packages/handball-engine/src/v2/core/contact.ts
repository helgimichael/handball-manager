import { courtPlayers,getPlayer,otherTeam,record,type CorePlayer,type CoreState } from './state';
import { distance,goal,local,shootingAngle } from './space';
import { startAction } from './actions';
import { contest } from './interactions';
import { foul,interrupt } from './transitions';

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
  const technique=(approach!=='FRONT'||beaten)&&penetration?'HOLD':'BENT_ARMS';
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
    const illegal=action.contact.technique==='HOLD';
    const clear=local(a.position,s.directions[a.team]).y<8.5&&shootingAngle(a.position,s.directions[a.team])>.25&&
      !courtPlayers(s,d.team).some(q=>q.id!==d.id&&q.kind==='FIELD_PLAYER'&&local(q.position,s.directions[a.team]).y<local(a.position,s.directions[a.team]).y&&distance(q.position,a.position)<3);
    const id=contest(s,'CONTACT',a,d,illegal?'HELD':approach==='FRONT'?'FRONTAL_CONTACT':'MONITORED',separation,illegal?0:10,action.id);
    action.contestIds.push(id);
    record(s,'CONTACT_EXECUTED',d,{technique:action.contact.technique,committedApproach:action.contact.approach,approach,separation,carrierAction:a.action?.kind??'NONE',clearChance:clear},[a.id],id,action.id);
    if(illegal) {foul(s,a,d,!!a.airborne,clear,id);return;}
    // Legal monitoring does not cancel a committed pass or shot. Frontal trunk
    // containment stops penetration, while control and its handling clock persist.
    if(approach==='FRONT'&&['DRIVE','DRIBBLE'].includes(a.action?.kind??'')) {
      const dribbling=s.ball.mode==='DRIBBLE';interrupt(s,a,'Frontal legal contact stopped penetration');
      if(dribbling){s.ball.mode='CONTROLLED';s.ball.height=1.2;a.handling.steps=0;a.handling.stepDistance=0;a.handling.heldSinceTick=s.tick;record(s,'DRIBBLE_GATHERED',a,{reason:'Gathered under frontal contact'});}
    }
    record(s,'LEGAL_CONTACT',d,{approach,separation},[a.id],id,action.id);
  }
}
