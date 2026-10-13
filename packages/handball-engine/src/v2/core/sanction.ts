// CONTACT AND PUNISHMENT: most fouls in handball are just a free throw.
//
// The audit measured twelve to eighteen two-minute suspensions per match, three
// to five times what handball produces, and it found the cause in one line: the
// engine had no category for an ordinary foul. Every judged infringement
// entered progressive punishment, so once a team had spent its three warnings
// every subsequent whistle removed a player for two minutes. The match was
// permanently short-handed and permanently stopping, which is most of what
// "wild and crazy" meant.
//
// The rules already draw the distinction the engine was missing. IHF 8:2 is
// ordinary illegal contact and is punished by a free throw. 8:3 adds a personal
// punishment when the infringement is directed at the body rather than the
// ball, or is committed with particular intensity, or from a position the
// defender had no business being in. 8:5 and 8:6 escalate to disqualification.
// 14:1 awards a seven-metre throw when an infringement destroys a clear chance
// to score anywhere on court.
//
// So severity is READ FROM THE CONTACT. Where the defender was, how fast he
// arrived, which technique he committed to, whether he played the ball or the
// man, and what the attacker was about to do. A defender who is goal-side, set,
// and uses his bent arms is defending. The same defender arriving late across
// the attacker's back at speed is not, and that difference is the whole model.
import { courtPlayers, type CoreState } from './state';
import { clearGoalArea, distance, goal, local, shootingAngle } from './space';
import type { CorePlayer } from './state';
import { secondsTo } from './timing';
import { goalAreaClearance } from '../../domain/geometry/goalArea';

/**
 * What the referee has to decide, in the order the rules decide it.
 *
 * LEGAL is by far the most common and produces nothing at all. ORDINARY is the
 * next most common and produces a free throw with no personal punishment, which
 * is the category the engine did not have. Only the last three touch a player's
 * record.
 */
export type Severity = 'LEGAL' | 'ORDINARY' | 'PUNISHABLE' | 'CLEAR_CHANCE' | 'SERIOUS';

export type ContactRead = {
  readonly severity: Severity;
  readonly reason: string;
  /** Set when the contact destroyed a genuine chance to score. */
  readonly clearChance: boolean;
  /** Evidence, for the trace and for a human reading a match report. */
  readonly detail: Record<string, string | number | boolean>;
};

/**
 * Did this contact destroy a clear chance to score?
 *
 * The audit found zero seven-metre throws in six matches because the old test
 * required a conjunction that effectively never occurred. This asks the
 * question the rule actually asks, in three parts, and it is reachable.
 *
 * First, was there a chance: the attacker has the ball under control, is
 * heading at the goal, and has an angle worth shooting from. Second, was it
 * clear: no defender other than the offender can get between him and the goal
 * in time, which is a timing question and not a distance one. Third, was it
 * destroyed: the contact actually stopped him.
 */
export function clearChanceDestroyed(s: CoreState, a: CorePlayer, d: CorePlayer): { clear: boolean; detail: Record<string, string | number | boolean> } {
  const direction = s.directions[a.team];
  const q = local(a.position, direction);
  const angle = shootingAngle(a.position, direction);
  const controlled = s.ball.controllerId === a.id;
  const goingAtGoal = a.action !== null && ['DRIVE', 'DRIBBLE', 'JUMP', 'SHOOT'].includes(a.action.kind) && !['COMPLETED', 'FAILED', 'INTERRUPTED'].includes(a.action.phase);
  let approachTarget=a.action?.target&&['DRIVE','DRIBBLE'].includes(a.action.kind)&&a.action.phase==='EXECUTING'&&local(a.action.target,direction).y<q.y-.3?a.action.target:null;
  // A controlled dribbler can gather into three legal steps. Evaluate the
  // immediately reachable takeoff window rather than pretending a hold only
  // destroys the stationary bounce point. Cover must still arrive in time.
  if(s.ball.mode==='DRIBBLE'&&a.action?.kind==='DRIBBLE'&&a.action.phase==='EXECUTING'&&
    (!a.action.target||local(a.action.target,direction).y<=q.y+.1)){
    const g=goal(direction),length=distance(a.position,g),travel=Math.min(s.ruleProfile.maxSteps*.8,Math.max(0,length-6.5));
    approachTarget=clearGoalArea({x:a.position.x+(g.x-a.position.x)*travel/length,y:a.position.y+(g.y-a.position.y)*travel/length},direction,a.radius+.1);
  }
  // A shot from here, at his pace, is about this far off.
  const releaseSeconds = approachTarget?distance(a.position,approachTarget)/Math.max(1,a.profile.topSpeed)+.25:q.y < 8 ? 0.45 : 0.75;
  const point = approachTarget??{ x: a.position.x, y: a.position.y };
  const others = courtPlayers(s, d.team).filter(o => o.id !== d.id && o.kind === 'FIELD_PLAYER' && o.beatenUntilTick <= s.tick);
  const covering = others.filter(o => {
    // Between him and the goal, and able to be there before he could shoot.
    const g = goal(direction);
    const oq = local(o.position, direction);
    // Legal prevention requires reachable hands/body in front of the current
    // carrier, not occupying the carrier's exact future body centre. Asking
    // for overlap discarded an already arrived helper at the area line.
    const range=distance(o.position,point),travel=Math.max(0,range-.95),fraction=range>.001?travel/range:0;
    const reachable={x:o.position.x+(point.x-o.position.x)*fraction,y:o.position.y+(point.y-o.position.y)*fraction};
    return oq.y < q.y + 0.1 && o.screenedUntilTick<=s.tick && o.wrongFootedUntilTick<=s.tick && secondsTo(s, o, reachable) <= releaseSeconds + 0.1 && distance(o.position, g) < distance(a.position, g) + 1.5;
  });
  const keeper=courtPlayers(s,d.team).some(p=>p.kind==='GOALKEEPER');
  // IHF clarification 6: a controlled finish at the area line, an unopposed
  // counterattack, or a direct empty-goal throw. Forward intent at 12m alone
  // is not a clear chance. The 2m band accounts for a reachable takeoff/release approach.
  const nearLine=goalAreaClearance(point,direction)<=2&&angle>.14;
  const forwardSpeed=a.velocity.y*(direction==='TOP'?-1:1);
  const counterattack=s.possession.phase==='TRANSITION'&&forwardSpeed>.7&&others.every(o=>local(o.position,direction).y>=q.y-.3);
  const immediateFinish=nearLine||counterattack||!keeper&&a.action?.kind==='SHOOT';
  const clear = controlled && immediateFinish && covering.length === 0;
  return { clear, detail: { angle: Number(angle.toFixed(3)), depth: Number(q.y.toFixed(2)), covering: covering.length, controlled, goingAtGoal,immediateFinish } };
}

/**
 * How illegal was it?
 *
 * `lateness` is seconds by which the defender failed to be in position before
 * the contact, which is the single best predictor of whether a referee whistles
 * a personal punishment. `approach` is where he made contact from: from the
 * front with a set body is defending, from behind is not.
 */
export function readContact(
  s: CoreState,
  a: CorePlayer,
  d: CorePlayer,
  technique: 'BENT_ARMS' | 'HOLD',
  approach: 'FRONT' | 'SIDE' | 'BEHIND',
  separation: number,
): ContactRead {
  const speed = Math.hypot(d.velocity.x, d.velocity.y);
  const gap=Math.max(.001,distance(a.position,d.position));
  const nx=(a.position.x-d.position.x)/gap,ny=(a.position.y-d.position.y)/gap;
  const radialClosingSpeed=Math.max(0,d.velocity.x*nx+d.velocity.y*ny);
  const lateralSpeed=Math.abs(d.velocity.x*ny-d.velocity.y*nx);
  const relativeClosingSpeed=Math.max(0,(d.velocity.x-a.velocity.x)*nx+(d.velocity.y-a.velocity.y)*ny);
  // Balance controls an approaching body. Preserve the existing bounded
  // speed range, but a better balanced defender can absorb MORE momentum.
  // Sliding across the line or giving ground is not charging the attacker.
  const controlledClosingLimit=3.4-1.6*(1-Math.max(0,Math.min(1,d.profile.balance)));
  const chance = clearChanceDestroyed(s, a, d);
  const airborne = a.airborne !== null;
  const contactClass=airborne?'AIRBORNE_CONTACT':technique==='HOLD'?'HOLDING':approach==='BEHIND'?'CONTACT_FROM_BEHIND':
    approach==='FRONT'?(radialClosingSpeed>controlledClosingLimit?'FRONTAL_CHARGE':'FRONTAL_CONTAINMENT'):'LATERAL_CONTACT';
  const detail = { technique, approach,contactClass,separation:Number(separation.toFixed(2)),closingSpeed:Number(speed.toFixed(2)),
    radialClosingSpeed:Number(radialClosingSpeed.toFixed(3)),lateralSpeed:Number(lateralSpeed.toFixed(3)),
    relativeClosingSpeed:Number(relativeClosingSpeed.toFixed(3)),controlledClosingLimit:Number(controlledClosingLimit.toFixed(3)),...chance.detail };

  // Contact on a man in the air is the one case handball never tolerates.
  if (airborne && (technique === 'HOLD' || relativeClosingSpeed > 2.2 || approach === 'BEHIND' && radialClosingSpeed > 1.4)) {
    return { severity: 'SERIOUS', reason: 'Contact on an airborne attacker', clearChance: chance.clear, detail };
  }
  if(airborne)return {severity:'PUNISHABLE',reason:'Body-directed contact during an airborne release',clearChance:chance.clear,detail};
  if (technique === 'BENT_ARMS' && approach === 'FRONT') {
    // The textbook defensive action. Only punishable when he arrives at a speed
    // that turns containment into a charge.
    if (radialClosingSpeed > controlledClosingLimit) return { severity: 'ORDINARY', reason: 'Frontal contact made with too much momentum', clearChance: false, detail };
    return { severity: 'LEGAL', reason: 'Frontal bent-arm containment from a set position', clearChance: false, detail };
  }
  if (approach === 'BEHIND') {
    // Coming through the back is directed at the body by definition.
    return {
      severity: technique==='HOLD'?(chance.clear?'CLEAR_CHANCE':'PUNISHABLE'):radialClosingSpeed > 2.4 ? 'PUNISHABLE' : 'ORDINARY',
      reason: 'Contact from behind the attacker', clearChance: chance.clear, detail,
    };
  }
  if (technique === 'HOLD') {
    // Holding is illegal, but an ordinary hold at walking pace on a man who was
    // going nowhere is a free throw and nothing else. That single sentence is
    // what the old model could not express.
    const disciplined = d.profile.discipline * 0.5 + d.profile.contact * 0.5;
    const restraining=d.beatenUntilTick>s.tick||approach!=='FRONT'&&['DRIVE','DRIBBLE','JUMP','SHOOT'].includes(a.action?.kind??'');
    const severe = restraining || radialClosingSpeed > 2.8 - 1.2 * disciplined;
    return {
      severity: chance.clear ? 'CLEAR_CHANCE' : severe ? 'PUNISHABLE' : 'ORDINARY',
      reason: chance.clear ? 'Holding that destroyed a clear chance to score' : severe ? 'Holding committed with intensity' : 'Ordinary holding contact', clearChance: chance.clear, detail,
    };
  }
  // Side contact with bent arms: legal unless he is late enough that the
  // attacker was already past him.
  const late = separation < 0.55 && speed > 2.6;
  return late
    ? { severity: chance.clear ? 'CLEAR_CHANCE' : 'ORDINARY', reason: 'Late lateral contact', clearChance: chance.clear, detail }
    : { severity: 'LEGAL', reason: 'Lateral body contact within the permitted use of the torso', clearChance: false, detail };
}
