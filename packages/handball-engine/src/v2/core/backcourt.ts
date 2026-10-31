import { courtPlayers,otherTeam,type CorePlayer,type CoreState,type Point } from './state';
import { clamp,clearGoalArea,distance,local,world } from './space';

export type BackcourtSupport={
  possessionId:string;mode:'STRETCH'|'COMBINE'|'CLEAR_LANE'|'RECYCLE'|'BALANCE';
  partnerId:string|null;target:Point;reason:string;reviewAfterTick:number;
};
export const isBack=(p:CorePlayer)=>['LB','CB','RB'].includes(p.role);
const active=(p:CorePlayer,kind:string)=>p.action?.kind===kind&&['COMMITTED','EXECUTING'].includes(p.action.phase);

/** Observable relationships produce a support plan, never a future player state. */
export function planBackcourtSupport(s:CoreState,p:CorePlayer):BackcourtSupport {
  const direction=s.directions[p.team],team=courtPlayers(s,p.team),defenders=courtPlayers(s,otherTeam(p.team));
  const carrier=team.find(q=>q.id===s.ball.controllerId)??team.find(q=>q.id===s.ball.flight?.fromId);
  const centre=team.find(q=>q.role==='CB'),left=p.role==='LB',sign=left?-1:1;
  const c=carrier?local(carrier.position,direction):local(s.ball.position,direction);
  let mode:BackcourtSupport['mode']='BALANCE',partnerId=carrier?.id??null,target:Point,reason:string;
  if(p.role==='CB') {
    const backs=team.filter(a=>a.role==='LB'||a.role==='RB'),mean=backs.length?backs.reduce((n,a)=>n+local(a.position,direction).x,0)/backs.length:10;
    target={x:clamp(mean,7.5,12.5),y:clamp(Math.max(c.y+1.4,...backs.map(a=>local(a.position,direction).y+.6)),9.8,11.6)};
    reason='Balance the two backcourt lanes and retain a trailing central outlet';
  } else {
    const wing=team.find(a=>a.role===(left?'LW':'RW'));
    const mark=defenders.find(d=>s.defence.marks[d.id]===p.id);
    const centralMark=centre?defenders.find(d=>s.defence.marks[d.id]===centre.id):undefined;
    const pivot=team.filter(a=>a.role==='P'||a.role==='P2').sort((a,b)=>distance(a.position,p.position)-distance(b.position,p.position))[0];
    const centreX=centre?local(centre.position,direction).x:10;
    const wingX=wing?local(wing.position,direction).x:(left?.7:19.3);
    // Keep a separate lateral lane from both the wing and the central connector.
    const outer=left?clamp(wingX+2.2,2.8,4.2):clamp(wingX-2.2,15.8,17.2);
    const inner=left?clamp(centreX-2.5,6,7.5):clamp(centreX+2.5,12.5,14);
    const inLane=(x:number)=>clamp(x,Math.min(outer,inner),Math.max(outer,inner));
    const sameSide=left?c.x<=10.8:c.x>=9.2;
    const penetrating=!!carrier&&(active(carrier,'DRIVE')||active(carrier,'DRIBBLE'));
    if(wing&&carrier?.id===wing.id) {
      mode='RECYCLE';partnerId=wing!.id;target={x:inLane(wingX-sign*3.2),y:clamp(c.y+5.5,8.6,10.6)};
      reason='Stay behind the wing as its adjacent return-pass connection';
    } else if(penetrating&&sameSide) {
      mode='CLEAR_LANE';partnerId=carrier!.id;
      const path=carrier!.action!.target?local(carrier!.action!.target!,direction):c;
      target={x:inLane(path.x+sign*3.2),y:clamp(c.y+2.5,9,11)};
      reason='Clear the committed penetration lane while offering a trailing lateral pass';
    } else if(sameSide&&pivot&&active(pivot,'SCREEN')&&mark&&centralMark&&
      distance(pivot.position,mark.position)<3.6&&Math.abs(mark.position.x-centralMark.position.x)>3.6) {
      mode='COMBINE';partnerId=pivot.id;
      const interval=(local(mark.position,direction).x+local(centralMark.position,direction).x)/2;
      target={x:inLane((interval+local(pivot.position,direction).x)/2),y:clamp(local(pivot.position,direction).y+3.1,9,10.8)};
      reason='Contract into the open inner interval beside the committed pivot screen';
    } else {
      mode='STRETCH';partnerId=centre?.id??wing?.id??null;
      const innerInterval=Math.abs((mark?local(mark.position,direction).x:(left?5.5:14.5))-centreX);
      // Width is shared with the wing. A half-back parked almost in the wing's
      // corner is an outlet but cannot threaten the adjacent central interval.
      const spread=clamp(6-innerInterval*.3,3,5);
      target={x:inLane(centreX+sign*spread),y:clamp((mark?local(mark.position,direction).y:7.2)+2.8,9,11)};
      reason=sameSide?'Stretch outside the half defender to open the adjacent interval':'Hold a wide weak-side outlet against the shifting defence';
    }
    // A committed crossing elsewhere may put the centre temporarily on this flank;
    // the support lane remains outside it rather than pursuing a symmetric shape.
  }
  return {possessionId:s.possession.id,mode,partnerId,target:clearGoalArea(world(target,direction),direction,p.radius+.5),reason,reviewAfterTick:s.tick+24};
}
