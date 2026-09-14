// LOCAL PROBLEM SOLVING: attack an interval, read the response, continue.
//
// The attack could circulate and it could finish, but between those two it had
// almost nothing. Across a whole match the engine produced about five beaten
// defenders and four feints read, and the backcourt scored thirteen per cent of
// the goals, because the carrier never actually went at anybody: the drive
// branch required no defender within two metres, which is the one situation in
// which driving is pointless, and the feint branch lived in a window a metre
// and a half wide.
//
// Real handball in the organised attack is a sequence, and it is the same
// sequence every time:
//
//   attack an INTERVAL between two defenders
//   -> the defender who owns it has to COMMIT
//   -> if he is beaten, go through
//   -> if he holds, the shot over him is on
//   -> if a second defender HELPS, the man he left is free: play him
//   -> if nothing opened, RECYCLE and start again
//
// Every branch of that is a fact about where bodies are, and none of it is a
// probability. What makes it an ecology rather than a script is that the same
// read produces a different branch depending on what the defence actually did,
// and that losing the advantage returns the attack to the start rather than
// ending the possession.
import { clamp, distance, goal, laneClearance, local, shootingAngle, world } from './space';
import { courtPlayers, getPlayer, otherTeam, record, type CorePlayer, type CoreState, type Point, type TeamId } from './state';
import { isPivot, pivotOffer } from './pivot';
import { laneMargin, secondsTo } from './timing';

/** A gap between two adjacent defenders, and what it is worth attacking. */
export type Interval = {
  /** The two men either side of it. Either may be missing at the edges. */
  readonly left: CorePlayer | null;
  readonly right: CorePlayer | null;
  /** The defender who has to close it: the one the carrier is running at. */
  readonly owner: CorePlayer | null;
  /** Where to attack it, in world coordinates. */
  readonly point: Point;
  /** Metres of daylight between the two men. */
  readonly width: number;
  /** How worth attacking it is, 0..1. */
  readonly value: number;
};

/** Below this two defenders are shoulder to shoulder and there is no gap. */
const CLOSED_METERS = 1.5;

/**
 * The interval worth attacking from here.
 *
 * Read off the defenders' actual lateral order, not off a formation: a gap is
 * two men with space between them, wherever they happen to be standing. What
 * makes one worth attacking is width, how central it is, and how far the
 * carrier has to travel to get into it before it closes.
 */
export function bestInterval(s: CoreState, carrier: CorePlayer): Interval | null {
  const direction = s.directions[carrier.team];
  // Lateral position is absolute; only depth depends on the goal. See readDefence.
  const mirror = (x: number) => x;
  const line = courtPlayers(s, otherTeam(carrier.team))
    .filter(d => d.kind === 'FIELD_PLAYER' && local(d.position, direction).y < 11)
    .sort((a, b) => a.position.x - b.position.x);
  if (line.length === 0) return null;
  const q = local(carrier.position, direction);

  const gaps: Interval[] = [];
  const consider = (left: CorePlayer | null, right: CorePlayer | null) => {
    const leftX = left ? mirror(left.position.x) : -1.2;
    const rightX = right ? mirror(right.position.x) : 21.2;
    const width = rightX - leftX;
    if (width < CLOSED_METERS) return;
    const lane = clamp((leftX + rightX) / 2, 1.4, 18.6);
    const depth = Math.max(6.9, Math.min(left ? local(left.position, direction).y : 8, right ? local(right.position, direction).y : 8) - 0.3);
    const point = world({ x: lane, y: depth }, direction);
    // Worth attacking: real daylight, near the goal rather than out wide, and
    // reachable before the two men can close it on him.
    const room = clamp((width - CLOSED_METERS) / 2.6, 0, 1);
    const central = clamp(1 - Math.abs(lane - 10) / 9, 0, 1);
    const travel = distance(carrier.position, point);
    const owner = left && right ? (Math.abs(q.x - leftX) < Math.abs(q.x - rightX) ? left : right) : (left ?? right);
    const closing = owner ? clamp(secondsTo(s, owner, point) / 1.4, 0, 1) : 1;
    const reach = clamp(1 - (travel - 1) / 5, 0, 1);
    gaps.push({ left, right, owner, point, width, value: room * 0.34 + central * 0.22 + reach * 0.24 + closing * 0.20 });
  };
  consider(null, line[0]);
  for (let i = 1; i < line.length; i++) consider(line[i - 1], line[i]);
  consider(line[line.length - 1], null);
  return gaps.sort((a, b) => b.value - a.value)[0] ?? null;
}

/**
 * Has this defender committed himself?
 *
 * Committing is not an intention, it is a body out of position: beaten, screened
 * out, wrong-footed, or simply pulled far enough off his own line that the space
 * behind him is real. The distinction matters because the attack is allowed to
 * exploit a commitment and is not allowed to exploit a guess.
 */
export function committed(s: CoreState, d: CorePlayer, direction: CoreState['directions'][keyof CoreState['directions']]): boolean {
  if (d.beatenUntilTick > s.tick || d.screenedUntilTick > s.tick || d.wrongFootedUntilTick > s.tick) return true;
  return local(d.position, direction).y > 9.4;
}

/** How long the defence stays short after one reaction, before it re-forms. */
const BREAK_TICKS=34;
/** A chain cannot run for ever; past this the defence has genuinely recovered. */
const BREAK_MAX_TICKS=110;

/**
 * Record that a defender has been taken out of the defence.
 *
 * Opening one is cheap; EXTENDING one is the point. Each further reaction while
 * a break is already live pushes the window out and counts one more link, which
 * is how an advantage propagates through a second and a third defender instead
 * of being spent on the first pass.
 */
export function breakDefence(s:CoreState,defender:CorePlayer,cause:string,byId:string|null=null) {
  // No freed man, no advantage. A break that names nobody cannot be played and
  // only makes the attack braver for no reason, which is exactly what turned
  // four hundred flickering help duties into twenty-four interceptions a match.
  const freed=s.defence.marks[defender.id]??null;
  if(!freed)return;
  // A man cannot be freed by his own screen. When the line player screens the
  // defender who marks him, that relationship is already read -- with a lane
  // check -- by pivotOffer; counting it here as well fed him twice and took his
  // share of the goals back up to two in five.
  if(freed===byId)return;
  const live=s.defence.broken;
  if(live&&live.possessionId===s.possession.id&&live.untilTick>s.tick) {
    if(live.defenderId===defender.id){live.untilTick=Math.max(live.untilTick,s.tick+BREAK_TICKS);return;}
    live.defenderId=defender.id;live.freedId=freed;live.cause=cause;live.reactions+=1;
    live.untilTick=Math.min(live.sinceTick+BREAK_MAX_TICKS,s.tick+BREAK_TICKS);
    record(s,'ADVANTAGE_CONTINUED',defender,{cause,reactions:live.reactions},freed?[freed]:[]);
    return;
  }
  s.defence.broken={possessionId:s.possession.id,defenderId:defender.id,freedId:freed,sinceTick:s.tick,untilTick:s.tick+BREAK_TICKS,reactions:1,cause};
  record(s,'ADVANTAGE_OPENED',defender,{cause},freed?[freed]:[]);
}

/** The break, if one is still live for the team now in possession. */
export function liveBreak(s:CoreState,team:TeamId) {
  const b=s.defence.broken;
  if(!b||b.possessionId!==s.possession.id||b.untilTick<=s.tick||s.possession.team!==team)return null;
  return b;
}

export type Continuation =
  | { readonly kind: 'ATTACK_INTERVAL'; readonly point: Point; readonly defenderId: string | null; readonly reason: string }
  | { readonly kind: 'FEINT'; readonly defenderId: string | null; readonly reason: string }
  | { readonly kind: 'PLAY_FREED'; readonly receiverId: string; readonly reason: string }
  | { readonly kind: 'RECYCLE'; readonly receiverId: string; readonly reason: string }
  | null;

/**
 * What to do with the situation in front of him.
 *
 * Read in the order handball reads it. A man who has been freed by the defence
 * collapsing is played first, because that is the advantage the attack just
 * bought and it does not last. Then the interval, if one is genuinely open and
 * he can get into it. Then the feint, which is how you MAKE a defender commit
 * when he will not do it on his own. Recycling is last and is not a failure: an
 * attack that keeps the ball and starts again has not lost anything.
 */
export function readContinuation(s: CoreState, carrier: CorePlayer): Continuation {
  const direction = s.directions[carrier.team];
  const q = local(carrier.position, direction);
  if (q.y > 15 || carrier.airborne) return null;
  // Out of time or out of steps: the ball has to move. Attacking an interval or
  // feinting needs steps he no longer has, and a player who keeps trying anyway
  // is whistled. Twenty-nine handling violations a match came from exactly that.
  const held = (s.tick - carrier.handling.heldSinceTick) * 50;
  const pressed = held > s.ruleProfile.maxHoldMs * 0.55 || carrier.handling.steps >= s.ruleProfile.maxSteps - 1;
  const mates = courtPlayers(s, carrier.team).filter(a => a.id !== carrier.id && !a.airborne);
  const passSpeed = 10.5 + 3 * carrier.profile.passing;

  // 1. The defence is a man short. Play the man it left.
  //
  // Read from the BREAK rather than from whoever happens to hold the HELP duty
  // on this tick, so the advantage survives the pass that exploits it: the man
  // played on has his own defender to draw, and each reaction he forces extends
  // the same break instead of starting a new read from nothing.
  const broken = liveBreak(s, carrier.team);
  if (broken) {
    const freed = mates.find(a => a.id === broken.freedId && a.id !== carrier.id);
    if (freed) {
      const lane = laneMargin(s, carrier.position, freed.position, carrier.team, passSpeed);
      if (lane.seconds > 0.14) {
        return { kind: 'PLAY_FREED', receiverId: freed.id, reason: `Play the man the defence left (${broken.cause}, ${broken.reactions} reaction${broken.reactions > 1 ? 's' : ''})` };
      }
    }
  }

  // 2. The line player, if his defender has actually been taken out of it.
  if (!isPivot(carrier)) {
    const line = mates.filter(isPivot).map(a => ({ a, offer: pivotOffer(s, carrier, a) })).filter(x => x.offer.available)
      .sort((x, y) => y.offer.margin - x.offer.margin)[0];
    if (line && line.offer.margin > 0.42) {
      return { kind: 'PLAY_FREED', receiverId: line.a.id, reason: `Feed the line player: ${line.offer.reason}` };
    }
  }

  // 3. An interval worth going into.
  // Deliberately NOT lowered while the defence is short. Making the attack
  // braver on an advantage forced passes into a line that was still there and
  // trebled the interceptions; what an advantage buys is that the freed man
  // stays playable through the pass, which is the branch above, not licence.
  const gap = pressed ? null : bestInterval(s, carrier);
  if (gap && gap.value > 0.46 && q.y < 13.5 && carrier.handling.steps === 0) {
    const owner = gap.owner;
    if (owner && committed(s, owner, direction)) {
      return { kind: 'ATTACK_INTERVAL', point: gap.point, defenderId: owner.id, reason: `Go through the interval his man has left (${gap.width.toFixed(1)} m)` };
    }
    if (gap.value > 0.58) {
      return { kind: 'ATTACK_INTERVAL', point: gap.point, defenderId: owner?.id ?? null, reason: `Attack the open interval and make somebody close it (${gap.width.toFixed(1)} m)` };
    }
  }

  // 4. Make him commit. A feint is how an attack creates a problem out of
  //    nothing, and it is the action the old selector almost never reached.
  const marker = courtPlayers(s, otherTeam(carrier.team))
    .filter(d => d.kind === 'FIELD_PLAYER' && distance(d.position, carrier.position) < 2.4 && !committed(s, d, direction))
    .sort((a, b) => distance(a.position, carrier.position) - distance(b.position, carrier.position))[0];
  // A feint is a movement of the body, not a run: it costs no steps, and gating
  // it on having taken none made it fire twice in a whole match.
  if (!pressed && marker && q.y < 13 && !carrier.handling.dribbleUsed &&
    carrier.profile.breakthrough * carrier.profile.tendency.drive > 0.38) {
    return { kind: 'FEINT', defenderId: marker.id, reason: 'Make the defender in front of me commit to a side' };
  }

  // 5. Nothing is open. Keep the ball and start again; an attack that recycles
  //    has not lost anything, and ending the possession instead is what put
  //    forty per cent of attacks in the match with no shot at all.
  const outlet = mates
    .filter(a => !isPivot(a))
    .map(a => ({ a, lane: laneMargin(s, carrier.position, a.position, carrier.team, passSpeed) }))
    .filter(x => x.lane.seconds > 0.2 && distance(carrier.position, x.a.position) <= 14)
    .sort((x, y) => y.lane.seconds - x.lane.seconds)[0];
  if (outlet) return { kind: 'RECYCLE', receiverId: outlet.a.id, reason: 'Nothing is open; keep the ball and rebuild' };
  return null;
}

/** Is the shot over a committed defender actually on? */
export function shotOverCommitted(s: CoreState, carrier: CorePlayer): boolean {
  const direction = s.directions[carrier.team];
  const owner = courtPlayers(s, otherTeam(carrier.team))
    .find(d => d.id === s.defence.pressureId || s.defence.marks[d.id] === carrier.id);
  if (!owner || !committed(s, owner, direction)) return false;
  return laneClearance(s, carrier.position, goal(direction), carrier.team) > 0.5 && shootingAngle(carrier.position, direction) > 0.16;
}
