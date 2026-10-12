import type {CorePlayer,Point} from './state';
import {distance} from './space';
/** Existing V2 duel leverage; intelligence must not pre-empt physical containment. */
export const BEATEN_LEVERAGE_METRES=.65;
/** Goalward leverage is relational; a defender can recover into this corridor. */
export function defenderRelation(p:CorePlayer,d:CorePlayer,g:Point) {
 const len=Math.max(.001,distance(p.position,g)),ux=(g.x-p.position.x)/len,uy=(g.y-p.position.y)/len;
 const dx=d.position.x-p.position.x,dy=d.position.y-p.position.y,forward=dx*ux+dy*uy,lateral=Math.abs(dx*(-uy)+dy*ux);
 const recovering=d.velocity.x*ux+d.velocity.y*uy;
 const momentum=p.velocity.x*ux+p.velocity.y*uy;
 const contact=d.action?.kind==='CONTACT'&&d.action.phase==='EXECUTING'&&d.action.targetId===p.id&&distance(p.position,d.position)<=.95;
 const beaten=!contact&&(forward<-BEATEN_LEVERAGE_METRES||momentum>.8&&forward<=0&&lateral>p.radius+d.radius+.55&&recovering<Math.hypot(p.velocity.x,p.velocity.y)+.5);
 return {forward,lateral,beaten};
}
