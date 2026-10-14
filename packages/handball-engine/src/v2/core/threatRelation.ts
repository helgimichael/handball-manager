import type {CorePlayer,CoreState,Point} from './state';
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
/** Existing V2 duel leverage; intelligence must not pre-empt physical containment. */
export const BEATEN_LEVERAGE_METRES=.65;
/** Losing the near shoulder is earlier than a completed, stamped duel loss.
 * This contact read never reallocates defensive ownership or grants advantage. */
export function lostContactShoulder(p:CorePlayer,d:CorePlayer,g:Point):boolean {
 const r=defenderRelation(p,d,g);
 return r.forward < -p.radius && r.lateral < p.radius+d.radius+.55;
}
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

/** Current body resistance. Losing a duel delays feet/hands; it does not erase a body. */
export function defenderResistance(s:CoreState,p:CorePlayer,d:CorePlayer,g:Point):number {
 if(d.screenedUntilTick>s.tick)return .15;
 if(d.wrongFootedUntilTick>s.tick)return .65;
 if(d.beatenUntilTick>s.tick&&defenderRelation(p,d,g).beaten)return .4;
 return 1;
}

/** Recovery is regained goal-side containment, not expiry of an attack advantage timer. */
export function regainedContainment(p:CorePlayer,d:CorePlayer,g:Point):boolean {
 const r=defenderRelation(p,d,g);
 return !r.beaten&&r.forward>=BEATEN_LEVERAGE_METRES&&r.lateral<=p.radius+d.radius+.55&&distance(p.position,d.position)<2.2;
}
