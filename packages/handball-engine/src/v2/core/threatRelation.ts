import type {CorePlayer,Point} from './state';
import {distance} from './space';
/** Goalward leverage is relational; a defender can recover into this corridor. */
export function defenderRelation(p:CorePlayer,d:CorePlayer,g:Point) {
 const len=Math.max(.001,distance(p.position,g)),ux=(g.x-p.position.x)/len,uy=(g.y-p.position.y)/len;
 const dx=d.position.x-p.position.x,dy=d.position.y-p.position.y,forward=dx*ux+dy*uy,lateral=Math.abs(dx*(-uy)+dy*ux);
 const recovering=d.velocity.x*ux+d.velocity.y*uy;
 const beaten=forward<-.25||forward<1.25&&lateral>p.radius+d.radius+.55&&recovering<Math.hypot(p.velocity.x,p.velocity.y)+.5;
 return {forward,lateral,beaten};
}
