import {courtPlayers,otherTeam,type CorePlayer,type CoreState,type Point} from './state';
import {clearGoalArea,distance,laneClearance,local,world} from './space';
export type MovementMode='HOLD'|'ADJUST'|'SUPPORT'|'THREATEN'|'RECEIVE'|'DRIVE'|'SHIFT'|'STEP_OUT'|'HELP'|'RECOVER'|'RETREAT'|'SPRINT_TRANSITION';
/** Optional persisted perception memory. Old active saves initialize it from their current action. */
export type MovementRead={mode:MovementMode;relation:string;target:Point;reviewTick:number};
/** A goal-side engagement owns its approach; traffic steering cannot replace it. */
export function engagementMovement(s:CoreState,p:CorePlayer):boolean {
 return p.kind==='FIELD_PLAYER'&&p.team!==s.possession.team&&['PRESSURE','PIVOT'].includes(p.duty.kind);
}
export function movementMode(s:CoreState,p:CorePlayer):MovementMode {
 const a=p.action;
 if(a?.kind==='DRIVE'||a?.kind==='DRIBBLE')return 'DRIVE';
 if(a?.kind==='SCREEN'||a?.kind==='HOLD'||a?.kind==='SHOOT'||!a)return 'HOLD';
 if(a.kind==='RECEIVE')return a.target?'RECEIVE':'HOLD';
 if(p.duty.kind==='RETREAT')return 'RETREAT';
 if(p.team!==s.possession.team){if(p.duty.kind==='PRESSURE')return 'STEP_OUT';if(p.duty.kind==='HELP')return 'HELP';if(p.duty.kind==='RECOVER')return 'RECOVER';return 'SHIFT';}
 if(s.possession.phase==='TRANSITION')return 'SPRINT_TRANSITION';
 if(a.kind==='PASS')return 'SUPPORT';
 return p.duty.kind==='CLEAR_LANE'||p.duty.kind==='COMBINE'?'THREATEN':p.duty.kind==='WING_PIN'?'ADJUST':'SUPPORT';
}
/** Speed follows work and remaining travel. Threats retain their calibrated capacity. */
export function movementPace(s:CoreState,p:CorePlayer,target:Point|null):number {
 if(!p.action||p.kind==='GOALKEEPER'||!s.ball.live||engagementMovement(s,p))return 1;
 const mode=movementMode(s,p),d=target?distance(p.position,target):0;
 if(['DRIVE','STEP_OUT','HELP','RETREAT','SPRINT_TRANSITION','THREATEN'].includes(mode))return 1;
 if(mode==='HOLD')return 1; // Braking remains physical, not a pace clamp.
 if(d>=2)return 1;
 return Math.min(1,.65+d*.175); // Close positional corrections are not full sprints.
}
/** Direct responsibility responds first; remote structure spends its actual reading time. */
export function movementReadTicks(s:CoreState,p:CorePlayer):number {
 const ballDistance=distance(p.position,s.ball.position),mode=movementMode(s,p);
 if(mode==='STEP_OUT'||mode==='DRIVE'||p.id===s.ball.flight?.receiverId)return 1;
 const responsibility=mode==='HELP'?.35:mode==='RECOVER'?.45:Math.min(1,ballDistance/8);
 return Math.max(1,Math.round(p.profile.reaction*20*responsibility*(1.2-.4*p.profile.anticipation)));
}
/** Re-read evolving relational destinations without restarting action or resetting velocity. */
export function readMovementTarget(s:CoreState,p:CorePlayer,target:Point):Point {
 if(engagementMovement(s,p))return {...target};
 const mode=movementMode(s,p),relation=[s.possession.id,p.duty.kind,p.duty.targetId??'',mode].join(':');
 const old=p.motion;
 if(!old){p.motion={mode,relation,target:{...(p.action?.target??target)},reviewTick:s.tick};}
 const read=p.motion!;
 // A new owner or tactical phase invalidates the previous perception once;
 // arrival timing differs by responsibility, never random player-ID offsets.
 if(read.relation!==relation){read.relation=relation;read.mode=mode;read.reviewTick=Math.min(read.reviewTick,s.tick+movementReadTicks(s,p));}
 if(s.tick>=read.reviewTick){read.target={...target};read.reviewTick=s.tick+movementReadTicks(s,p);}
 return {...read.target};
}
/** Receiver opens a small legal window before the named pass, never chasing its future endpoint. */
export function receivingApproach(s:CoreState,p:CorePlayer,passer:CorePlayer|null):Point|null {
 if(!passer||p.role==='P'||p.role==='P2'||p.team!==passer.team)return null;
 const direction=s.directions[p.team],dx=p.position.x-passer.position.x,dy=p.position.y-passer.position.y,length=Math.max(.01,Math.hypot(dx,dy));
 const defenders=courtPlayers(s,otherTeam(p.team)).filter(d=>d.kind==='FIELD_PLAYER');
 const quality=(at:Point)=>Math.min(2,laneClearance(s,passer.position,at,p.team))*.55+
   Math.min(3,...defenders.map(d=>distance(d.position,at)))*.45;
 const current=quality(p.position);
 const options=[-1,1].map(side=>clearGoalArea({x:p.position.x-dy/length*.35*side,y:p.position.y+dx/length*.35*side},direction,p.radius+.12))
   .filter(at=>distance(at,p.position)<=.45).map(at=>({at,gain:quality(at)-current})).sort((a,b)=>b.gain-a.gain);
 // A clear receiver can wait. Only a real lane/separation improvement justifies
 // the adjustment; there is no compulsory goalward step on every pass.
 return options[0]?.gain>.06?options[0].at:null;
}
/** Only an actual body on the projected travel corridor justifies a lateral route. */
export function bodyRoute(s:CoreState,p:CorePlayer,target:Point):Point {
 if(p.kind==='GOALKEEPER'||!s.ball.live||engagementMovement(s,p)||p.action?.kind==='DRIVE'||p.action?.kind==='DRIBBLE'||p.action?.kind==='SCREEN')return target;
 const d=distance(p.position,target);if(d<.3)return target;
 const ux=(target.x-p.position.x)/d,uy=(target.y-p.position.y)/d;
 const body=courtPlayers(s).filter(q=>q.id!==p.id).map(q=>{
  const dx=q.position.x-p.position.x,dy=q.position.y-p.position.y;
  return{q,ahead:dx*ux+dy*uy,side:dx*(-uy)+dy*ux};
 }).filter(q=>q.ahead>0&&q.ahead<Math.min(d,1.5)&&Math.abs(q.side)<p.radius+q.q.radius+.16).sort((a,b)=>a.ahead-b.ahead||a.q.id.localeCompare(b.q.id))[0];
 if(!body)return target;
 const side=body.side===0?(p.position.x<10?-1:1):-Math.sign(body.side);
 const lateral=Math.max(0,p.radius+body.q.radius+.2-Math.abs(body.side));
 return{x:target.x-uy*side*lateral,y:target.y+ux*side*lateral};
}
/** Recovery first regains the inside shoulder, then follows the evolving zonal post. */
export function recoveryRoute(s:CoreState,p:CorePlayer,post:Point):Point {
 if(p.duty.kind!=='RETREAT')return post;
 const direction=s.directions[otherTeam(p.team)],q=local(p.position,direction),home=local(post,direction),ball=local(s.ball.position,direction);
 if(q.y<=home.y+4)return post;
 const central=10+(home.x-10)*.75;
 return world({x:central,y:Math.max(home.y,q.y-Math.max(4,q.y-ball.y+2))},direction);
}
