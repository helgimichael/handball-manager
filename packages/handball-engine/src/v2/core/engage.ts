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
import { clamp, distance, goal, laneClearance, local, shootingAngle, shotOpportunity, world } from './space';
import { courtPlayers, otherTeam, record, type CorePlayer, type CoreState, type Point, type TeamId } from './state';
import { PIVOT_FINISH_METERS, isPivot, pivotOffer, pivotShotQuality } from './pivot';
import { isWing } from './wing';
import { laneMargin, secondsTo } from './timing';
import { exchangeActive } from './population';
import { zoneOf } from './defence';

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
  let freed=s.defence.marks[defender.id]??null;
  // PRESSURE/HELP now points at the carrier. That current duty is not the man
  // the helper LEFT: look at the actual off-ball threat in his vacated space,
  // and refuse an opening somebody else has already physically covered.
  if(freed===s.ball.controllerId&&defender.zone!==null) {
    const direction=s.directions[s.possession.team];
    const threats=courtPlayers(s,s.possession.team).filter(a=>a.kind==='FIELD_PLAYER'&&a.id!==s.ball.controllerId&&a.id!==byId&&
      zoneOf(a.position.x)===defender.zone&&!a.airborne&&!a.condition.exitRequired&&!exchangeActive(s,a.id));
    const uncovered=threats.filter(a=>!courtPlayers(s,otherTeam(a.team)).some(d=>d.kind==='FIELD_PLAYER'&&d.id!==defender.id&&
      d.beatenUntilTick<=s.tick&&d.screenedUntilTick<=s.tick&&distance(d.position,a.position)<1.15));
    freed=uncovered.sort((a,b)=>local(a.position,direction).y-local(b.position,direction).y||a.id.localeCompare(b.id))[0]?.id??null;
  }
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

/**
 * HAS THE DRIVE DONE ITS WORK YET?
 *
 * A drive is the physical approach that creates the next decision, not a
 * terminal action and not a timer. Until it has engaged somebody the carrier is
 * still working and must not be pulled off it -- cutting a drive the moment a
 * pass looked available destroyed the duel model outright, because no drive ever
 * survived long enough for anyone to be beaten. Once it HAS engaged somebody the
 * carrier has to be able to play, or he runs the approach into the three-second
 * whistle and throws the ball away, which is what half of every pass in the
 * match used to be.
 *
 * Every condition below is a fact about the court or a rule of handball. None is
 * an elapsed-time gate.
 */
export type DriveEngagement = { readonly engaged: boolean; readonly reason: string;
  /** The defender the engagement is ABOUT, when there is one. */
  readonly defenderId: string | null };

// An arm's length. At two metres the helper is still on his way, so the carrier
// released before anybody had actually engaged him: no contact, no foul, and a
// clean shot from a penetrated position every time. Help has ARRIVED when it is
// on him.
const HELP_ARRIVED_METERS = 1.25;

export function driveEngagement(s: CoreState, carrier: CorePlayer): DriveEngagement {
  const a = carrier.action;
  if (!a || a.kind !== 'DRIVE') return { engaged: false, reason: 'not driving', defenderId: null };
  // It has to have actually carried him. A drive still in PREPARING or
  // COMMITTED has not touched the defence and there is nothing to release from.
  if (a.phase !== 'EXECUTING' && a.phase !== 'RECOVERING') return { engaged: false, reason: 'the drive has not begun', defenderId: null };

  const opponents = courtPlayers(s, otherTeam(carrier.team)).filter(d => d.kind === 'FIELD_PLAYER');
  const man = a.targetId ? opponents.find(d => d.id === a.targetId) ?? null : null;

  // 1. THE MAN HE WENT AT IS OUT OF IT. The advantage exists; play it.
  if (man && (man.beatenUntilTick > s.tick || man.screenedUntilTick > s.tick || man.wrongFootedUntilTick > s.tick))
    return { engaged: true, reason: 'his man is beaten', defenderId: man.id };
  // 2. THE COVER HAS COME ACROSS. A second defender arriving is the whole point
  //    of driving at the first one: somebody has been left. It has to be the
  //    man whose job that is and he has to have actually got there -- asking
  //    only whether ANY other defender was within two metres is true almost at
  //    once in a six-nil, where the line stands three metres apart, so the
  //    drive ended before the duel it existed to create and beaten defenders
  //    fell from eighty a match to nine.
  const helper = s.defence.helperId ? opponents.find(d => d.id === s.defence.helperId) : undefined;
  if (helper && helper.id !== a.targetId && distance(helper.position, carrier.position) < HELP_ARRIVED_METERS)
    return { engaged: true, reason: 'the cover has come across', defenderId: helper.id };
  // RUNNING OUT OF STEPS IS NOT AN OPPORTUNITY, IT IS A CONSTRAINT, and it does
  // not belong here. A drive is already bounded to the steps he has left, so
  // treating exhaustion as engagement released two drives in three before the
  // duel could resolve -- beaten defenders fell from eighty a match to nine, and
  // because his steps were spent by then he could not take off either, so
  // forty-five per cent of the match's shots were flat-footed. When the steps or
  // the seconds run out the drive simply ENDS, which the action machinery
  // already does on its own, and he decides again the next tick like anybody
  // else. Only something that happened to the DEFENCE is a release.
  return { engaged: false, reason: 'still approaching', defenderId: null };
}

export type Continuation =
  | { readonly kind: 'SHOOT'; readonly quality: number; readonly reason: string }
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
  const mates = courtPlayers(s, carrier.team).filter(a => a.id !== carrier.id && a.kind==='FIELD_PLAYER' && !a.airborne &&
    !a.condition.unavailable&&!a.condition.exitRequired&&!exchangeActive(s,a.id));
  const passSpeed = 10.5 + 3 * carrier.profile.passing;
  const tendency = carrier.profile.tendency;
  const tactics=s.coaching[carrier.team];
  const broken = liveBreak(s, carrier.team);

  // Every option he has, scored the same way: how good it is RIGHT NOW, read
  // off the court, times how much this player is the sort who tries it.
  //
  // This used to be a fixed priority list with the drive above the shot, and
  // that single ordering decided the whole composition of the attack: a left
  // back received a hundred and thirty-six passes a match, drove seventy-nine
  // times and shot four, because an interval worth attacking is nearly always
  // available and therefore always won. Ranking rather than ordering is what
  // lets a shooting back and a breakthrough back solve the same picture
  // differently, which is the entire point of having tendencies at all.
  const options: { c: NonNullable<Continuation>; appeal: number }[] = [];
  const offer = (c: NonNullable<Continuation>, value: number, weight: number) => {
    let preference=1;
    if(tactics.attackIdentity==='DIRECT')preference=c.kind==='SHOOT'?1.10:c.kind==='ATTACK_INTERVAL'?1.16:c.kind==='RECYCLE'?.94:1;
    if(tactics.attackIdentity==='COMBINATION')preference=c.kind==='PLAY_FREED'?1.18:c.kind==='FEINT'?1.08:1;
    if(tactics.attackIdentity==='WIDTH'&&'receiverId' in c) {
      const receiver=mates.find(a=>a.id===c.receiverId);
      const reversal=receiver&&(receiver.position.x-10)*(carrier.position.x-10)<0;
      preference=receiver&&isWing(receiver)&&c.kind==='PLAY_FREED'?1.22:reversal?1.10:1;
    }
    // Tempo changes willingness to spend an existing advantage, not leg speed.
    if(tactics.tempo==='QUICK')preference*=c.kind==='RECYCLE'?.94:1.06;
    if (value > 0) options.push({ c, appeal: clamp(value, 0, 1) * weight*preference });
  };

  // SHOOT. His own judgement of the chance, never a depth threshold.
  //
  // A LINE PLAYER IS NOT A BACK WHO HAPPENS TO BE CLOSE. His shot is taken with
  // his back to goal and a man behind him, it is judged by pivotShotQuality,
  // and outside finishing range he does not have one at all -- he plays. Letting
  // him reach the general shot put fourteen backcourt jumps a match on the line
  // player, which is not a shot that exists in handball.
  {
    const context=shotOpportunity(s,carrier);
    const range = context?.distance??distance(carrier.position, goal(direction));
    const line = isPivot(carrier);
    const value = line ? pivotShotQuality(s, carrier) : context?.quality??0;
    const angle = shootingAngle(carrier.position, direction);
    const lane = laneClearance(s, carrier.position, goal(direction), carrier.team);
    const inRange = !line || range <= PIVOT_FINISH_METERS;
    // A shot needs somewhere to go, and a shot FROM RANGE needs somebody to have
    // built it: two completed passes is the difference between an attack and a
    // ball thrown at the goal from ten metres. Close in it is not the same
    // question -- a wing who receives in the corner with an angle has a shot
    // whether or not a counter says the attack was worked -- and applying the
    // gate to him meant he could not shoot at all in an open wing finish.
    // CLOSE IN IS MEASURED FROM THE END LINE, not from the middle of the goal. A
    // wing standing at the near post is four metres from the line and nearly
    // nine from the goal's centre, so a range test called his shot a long one
    // and refused it for want of build-up: a genuinely open wing could not
    // finish at all. Depth is the honest reading of "close in" and it covers the
    // line player and the wing alike.
    const built = s.possession.completedPasses >= 2 || s.possession.phase === 'TRANSITION' ||
      range <= 7.5 || q.y <= 5;
    if (context&&inRange && built && angle > 0.11 && (lane > 0.25||context.blockThreat<.65)) {
      offer({ kind: 'SHOOT', quality: value, reason: `Take the chance: quality ${value.toFixed(2)}` },
        (value - SHOT_FLOOR) / 0.42, tendency.shoot);
    }
  }

  // PLAY THE MAN THE DEFENCE LEFT. Read from the break, so the advantage
  // survives the pass that exploits it instead of dying on the first reaction.
  if (broken) {
    const freed = mates.find(a => a.id === broken.freedId && a.id !== carrier.id);
    if (freed) {
      const lane = laneMargin(s, carrier.position, freed.position, carrier.team, passSpeed);
      if (lane.seconds > 0.14) {
        offer({ kind: 'PLAY_FREED', receiverId: freed.id,
          reason: `Play the man the defence left (${broken.cause}, ${broken.reactions} reaction${broken.reactions > 1 ? 's' : ''})` },
          0.62 + 0.12 * broken.reactions, 1);
      }
    }
  }

  // Width is rewarded when the outside defender actually abandons it. The
  // ball-side back releases the wing; a cross-court hope is not the same pass.
  for(const wing of mates.filter(isWing)) {
    const marker=courtPlayers(s,otherTeam(carrier.team)).find(d=>s.defence.marks[d.id]===wing.id);
    const collapsed=marker&&(marker.duty.kind==='HELP'||marker.duty.kind==='PRESSURE')&&marker.duty.targetId!==wing.id;
    const separated=!marker||marker.beatenUntilTick>s.tick||marker.screenedUntilTick>s.tick||distance(marker.position,wing.position)>3.6;
    if((collapsed||separated)&&distance(carrier.position,wing.position)<10&&shotOpportunity(s,wing)) {
      const lane=laneMargin(s,carrier.position,wing.position,carrier.team,passSpeed);
      if(lane.seconds>.16)offer({kind:'PLAY_FREED',receiverId:wing.id,reason:collapsed?'Release the wing whose defender helped inside':'Use the genuinely separated outside receiver'},.68,tendency.feed);
    }
  }

  // FEED THE LINE PLAYER, when he is genuinely playable.
  if (!isPivot(carrier)) {
    const line = mates.filter(isPivot).map(a => ({ a, o: pivotOffer(s, carrier, a) }))
      .filter(x => x.o.available).sort((x, y) => y.o.margin - x.o.margin)[0];
    if (line) {
      // A feed that pivotOffer has passed is already rare -- it is available on
      // about one read in ten -- and it is one of the best balls in handball.
      // Scoring it from the margin ABOVE the threshold made it worth 0.17 at the
      // median, well under what keeping the ball is worth, so the line player
      // was almost never played even when he was genuinely free.
      offer({ kind: 'PLAY_FREED', receiverId: line.a.id, reason: `Feed the line player: ${line.o.reason}` },
        0.45 + Math.min(line.o.margin, 1) * 0.35, tendency.feed);
    }
  }

  // GO AT THE INTERVAL.
  //
  // Attacking a gap between two backcourt defenders is a BACKCOURT player's
  // move. The line player was choosing it on three ticks in five: he stands on
  // the six-metre line with his back to goal, and a gap eight metres behind him
  // is not his to attack -- he attacks the line by getting free on it. A wing
  // may cut inside, but into the interval beside him, not one across the court.
  const reachable = isPivot(carrier) ? false
    : isWing(carrier) ? 6.5 : 99;
  const gap = pressed || reachable === false ? null : bestInterval(s, carrier);
  // AN INTERVAL IS ATTACKED FROM OUTSIDE THE LINE. A player already inside it is
  // not going to drive through it -- he is past it, and his answers are the shot
  // and the pass. An open wing four metres from the end line was choosing to
  // attack a gap five metres wide that he had no room to enter, and so never
  // took a finish he plainly had.
  const OUTSIDE_THE_LINE = 7;
  if (gap && q.y > OUTSIDE_THE_LINE && q.y < 13.5 && carrier.handling.steps === 0 &&
      distance(carrier.position, gap.point) <= (reachable as number)) {
    const owner = gap.owner;
    const open = owner !== null && committed(s, owner, direction);
    // A gap his man has already left is worth attacking on much less than one
    // somebody still has to be made to leave.
    if (gap.value > (open ? 0.40 : 0.50)) {
      offer({ kind: 'ATTACK_INTERVAL', point: gap.point, defenderId: owner?.id ?? null,
        reason: open ? `Go through the interval his man has left (${gap.width.toFixed(1)} m)`
          : `Attack the open interval and make somebody close it (${gap.width.toFixed(1)} m)` },
        open ? gap.value + 0.16 : gap.value, tendency.drive);
    }
  }

  // MAKE HIM COMMIT. A feint is a movement of the body, not a run: it costs no
  // steps, and gating it on having taken none made it fire twice in a match.
  const marker = courtPlayers(s, otherTeam(carrier.team))
    .filter(d => d.kind === 'FIELD_PLAYER' && distance(d.position, carrier.position) < 2.4 && !committed(s, d, direction))
    .sort((a, b) => distance(a.position, carrier.position) - distance(b.position, carrier.position))[0];
  // Nor does a line player feint. Barring him from the interval alone simply
  // moved him into this instead -- he chose it on nearly half of all ticks,
  // burned his steps on the six-metre line and trebled the technical turnovers.
  // His one-against-one is winning the position, not beating a man off it.
  // A feint includes preparation, recovery, its following approach and a
  // release. Starting one when only the feint fits manufactures a violation.
  const remainingTicks=s.ruleProfile.maxHoldMs/50-(s.tick-carrier.handling.heldSinceTick);
  if (!pressed && remainingTicks>=33 && marker && q.y < 13 && !carrier.handling.dribbleUsed && !isPivot(carrier)) {
    offer({ kind: 'FEINT', defenderId: marker.id, reason: 'Make the defender in front of me commit to a side' },
      carrier.profile.breakthrough, tendency.drive);
  }

  // KEEP THE BALL. The floor, and not a failure: an attack that recycles has
  // not lost anything, and ending the possession instead is what put forty per
  // cent of attacks in the match with no shot at all.
  const outlet = mates
    .filter(a => !isPivot(a))
    .map(a => ({ a, lane: laneMargin(s, carrier.position, a.position, carrier.team, passSpeed) }))
    // ONE DEFINITION OF A PASS HE CAN COMPLETE. This asked for a fifth of a
    // second of margin within fourteen metres, while the three-second branch
    // twenty lines below accepted far less -- so a carrier with a usable outlet
    // was told he had none, did nothing, and threw the same pass in a panic a
    // second later. Four hundred and seventy of the match's nine hundred passes
    // arrived that way. Deciding to move the ball and being forced to are not
    // supposed to be different passes.
    .filter(x => x.lane.seconds > 0.1 && distance(carrier.position, x.a.position) <= 16)
    .sort((x, y) => (rebuildValue(s, y.a, direction)-(y.a.id===s.possession.lastPasserId?.12:0))
      -(rebuildValue(s, x.a, direction)-(x.a.id===s.possession.lastPasserId?.12:0)))[0];
  if (outlet) {
    offer({ kind: 'RECYCLE', receiverId: outlet.a.id, reason: 'Nothing is open; keep the ball and rebuild' },
      RECYCLE_APPEAL, 1);
  }

  return options.sort((a, b) => b.appeal - a.appeal)[0]?.c ?? null;
}

/** Below this a shot is not a shot, whoever is taking it. */
const SHOT_FLOOR = 0.26;
/**
 * What keeping the ball is worth. Every other option has to beat it.
 *
 * This is the attack's own estimate that an organised side which keeps the ball
 * will work something better than a half-chance. At 0.34 a shot of quality 0.38
 * beat resetting, which no organised attack would accept: once the carrier
 * could release out of a drive and every read reached a decision, that produced
 * a hundred and forty shots and eighty-three goals a match. A shot has to be
 * clearly better than starting again, not merely possible.
 */
const RECYCLE_APPEAL = 0.56;

/**
 * Who the ball goes to when nothing is open.
 *
 * Recycling used to pick whoever had the cleanest lane, which is always a wing:
 * he stands wide with nobody near him. So every attack that did not resolve
 * immediately ended by giving the ball to a wing, and the two wings took sixty
 * shots a match while the two backs took seventeen. An attack that is
 * rebuilding goes back through the middle, because the middle is where an
 * attack can be built from.
 */
export function rebuildValue(s: CoreState, a: CorePlayer, direction: CoreState['directions'][keyof CoreState['directions']]): number {
  const p = local(a.position, direction);
  const central = clamp(1 - Math.abs(p.x - 10) / 9, 0, 1);
  const depth = clamp((p.y - 7) / 5, 0, 1);
  return central * 0.62 + depth * 0.38;
}

/** Is the shot over a committed defender actually on? */
export function shotOverCommitted(s: CoreState, carrier: CorePlayer): boolean {
  const direction = s.directions[carrier.team];
  const owner = courtPlayers(s, otherTeam(carrier.team))
    .find(d => d.id === s.defence.pressureId || s.defence.marks[d.id] === carrier.id);
  if (!owner || !committed(s, owner, direction)) return false;
  return laneClearance(s, carrier.position, goal(direction), carrier.team) > 0.5 && shootingAngle(carrier.position, direction) > 0.16;
}
