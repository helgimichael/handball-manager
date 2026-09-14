// THE LINE PLAYER: a player in the attack, not a spatial object.
//
// Until now the pivot had a fixed anchor a metre or so off centre, drifted with
// the ball by a few tenths, and could not finish at all: `shotKind: 'PIVOT'` was
// declared in the state and produced by no code path anywhere. He screened
// occasionally and was otherwise scenery. In handball he is the player the
// whole organised attack is built around, and the defence's shape is mostly a
// response to him.
//
// Three things make him a player rather than an object.
//
// He WORKS THE LINE. He does not stand on a spot; he moves along the six-metre
// line to the interval that is currently worth occupying, which is the one
// beside the defender the ball is pulling out of position. That movement is
// what forces the defence to choose between covering him and covering the ball.
//
// He OFFERS. A feed is available only when his own defender has been taken out
// of the way -- stepped out, screened, or beaten to the inside -- and there is
// a lane. Offering is a fact about the court, never a probability.
//
// He FINISHES. A pivot catches with his back to the goal a metre or two out,
// and turns, or goes down and through. It is the most efficient shot in
// handball and the most contested, and it is now a real shot context with its
// own geometry rather than a backcourt jump misfiled by depth.
import { goalAreaClearance } from '../../domain/geometry/goalArea';
import { clamp, clearGoalArea, distance, goal, laneClearance, local, shootingAngle, world } from './space';
import { courtPlayers, getPlayer, otherTeam, type CorePlayer, type CoreState, type Point } from './state';
import { ZONE_ANCHORS, readDefence, zoneOf, zonePost } from './defence';
import { laneMargin, secondsTo } from './timing';

export const isPivot = (p: CorePlayer) => p.role === 'P' || p.role === 'P2';

/** How far off the goal-area line a line player actually stands. */
const LINE_STANDOFF = 0.45;
/** Inside this he is in genuine finishing range with his back to goal. */
export const PIVOT_FINISH_METERS = 8.2;

/**
 * Which interval is worth occupying right now.
 *
 * The one beside the defender who is engaged with the ball, on the side away
 * from the ball, because that is the gap his step-out opens and the gap his
 * neighbour has to choose whether to close. A pivot who stands in the middle of
 * a defender rather than in a gap is marking himself.
 */
export function pivotInterval(s: CoreState, p: CorePlayer): number {
  // Lateral position is absolute; only depth depends on the goal. See readDefence.
  const ballLane = s.ball.position.x;
  const engaged = zoneOf(ballLane);
  // Away from the ball by one space: the interval the engaged defender leaves.
  const side = ballLane >= 10 ? -1 : 1;
  const target = clamp(engaged + side, 0, ZONE_ANCHORS.length - 1);
  return (ZONE_ANCHORS[target] + ZONE_ANCHORS[engaged]) / 2;
}

/**
 * Where he stands, in world coordinates.
 *
 * A second line player takes the interval on the other side of the ball, so two
 * pivots occupy two different problems rather than one doubled one.
 */
export function pivotPost(s: CoreState, p: CorePlayer): Point {
  const direction = s.directions[p.team];
  let lane = pivotInterval(s, p);
  if (p.role === 'P2') {
    const first = courtPlayers(s, p.team).find(q => q.role === 'P');
    if (first) lane = clamp(20 - lane, 1.6, 18.4);
  }
  const post = world({ x: clamp(lane, 1.6, 18.4), y: 6 + LINE_STANDOFF }, direction);
  return clearGoalArea(post, direction, p.radius + 0.1);
}

export type PivotOffer = {
  readonly available: boolean;
  readonly reason: string;
  /** Seconds the feed beats the nearest defender by. Negative means it is gone. */
  readonly margin: number;
};

/**
 * Is the line player actually playable from here?
 *
 * Three real conditions and no probability. His own defender has been taken out
 * of the picture, the ball can physically reach him, and he is in a position
 * worth feeding. A pivot who is marked, in a closed lane, or twelve metres from
 * goal is not an option, and saying so out loud is what stops the feed becoming
 * a lottery.
 */
export function pivotOffer(s: CoreState, carrier: CorePlayer, pivot: CorePlayer): PivotOffer {
  const direction = s.directions[carrier.team];
  const q = local(pivot.position, direction);
  if (q.y > PIVOT_FINISH_METERS + 2) return { available: false, reason: 'too far from the line to be fed', margin: -1 };
  const owner = courtPlayers(s, otherTeam(carrier.team)).find(d => s.defence.marks[d.id] === pivot.id);
  // A line player who screens the man marking HIM has not got free of him: he
  // is standing against him, and in handball he has to roll off the screen
  // before he is playable. Counting his own screen as his own opening made him
  // permanently available and gave him two goals in five.
  const screened = owner !== undefined && owner.screenedBy !== pivot.id &&
    (owner.screenedUntilTick > s.tick || owner.beatenUntilTick > s.tick);
  // SEALED, not merely in front. A 6:0 defender stands at 6.75 m and a line
  // player at 6.45 m, so "goal-side by forty-five centimetres" is the standing
  // arrangement of every set defence and was true on almost every frame: it
  // was the single commonest reason the feed was granted. A seal is a body's
  // worth of separation AND the defender close enough to actually be sealed --
  // a man three metres away is not sealed, he is somewhere else, which is what
  // the displaced branch below is for.
  const sealed = owner !== undefined && local(owner.position, direction).y > q.y + 0.9 &&
    distance(owner.position, pivot.position) < 2.2;
  // "Stepped out" has to mean genuinely displaced from his own space, not
  // merely standing where a 6:0 defender normally stands. Reading it as a depth
  // threshold made the feed available on almost every frame and the line player
  // scored a third of the goals in the match.
  const post = owner ? zonePost(s, owner.zone ?? 3, readDefence(s, courtPlayers(s, otherTeam(carrier.team)).filter(d => d.kind === 'FIELD_PLAYER'), carrier, direction), direction, owner.radius) : null;
  // Pulled off the line, but still his man. Measured against the shifted line,
  // a defender sits more than 1.3 m from his nominal post seventy-one per cent
  // of the time -- the line slides as a unit and that is not a man being drawn
  // out -- so the open end of the test was granting the feed almost always.
  // Past five metres he is not marking the line player at all, and that is the
  // unattended case below rather than a displacement.
  const gap = owner !== undefined && post !== null ? distance(owner.position, post) : 0;
  const displaced = owner !== undefined && gap > 2.2 && gap < 5;
  // AND NOBODY HAS COVERED. A line defender drawn out of the way opens nothing
  // if his neighbour has stepped across, which is exactly what a zone defence
  // does. Asking only about the pivot's own man credited the attack with an
  // opening the defence had already closed.
  const covered = courtPlayers(s, otherTeam(carrier.team))
    .some(d => d.kind === 'FIELD_PLAYER' && d.id !== owner?.id && d.screenedUntilTick <= s.tick &&
      d.beatenUntilTick <= s.tick && distance(d.position, pivot.position) < 1.5);
  const free = !covered && (owner === undefined || screened || sealed || displaced);
  const lane = laneMargin(s, carrier.position, pivot.position, carrier.team, 10.5 + 3 * carrier.profile.passing);
  if (!free) return { available: false, reason: covered ? 'a neighbour has stepped across and covered him' : 'the line defender still owns him', margin: lane.seconds };
  // A feed goes THROUGH the defensive line, which is where the defenders are
  // standing. A tenth of a second of daylight is not a lane, and feeding into
  // one made the pivot pass the single largest source of turnovers in the match
  // as well as the largest source of goals. Real daylight, or no feed.
  if (lane.seconds < 0.3) return { available: false, reason: 'the feeding lane is closed', margin: lane.seconds };
  return {
    available: true,
    margin: lane.seconds,
    reason: screened ? 'his defender is screened out' : sealed ? 'he has sealed his man behind him' : displaced ? 'his defender has been pulled off the line' : 'he is unattended on the line',
  };
}

/**
 * How good a pivot finish is from where he is standing.
 *
 * Deliberately its own function rather than the general shot quality, because
 * the pivot shot is a different shot: it is taken from close range with the
 * goalkeeper on top of him and a defender on his back, so the angle matters far
 * more than the distance and his own line play matters more than either.
 */
export function pivotShotQuality(s: CoreState, p: CorePlayer): number {
  const direction = s.directions[p.team];
  const range = distance(p.position, goal(direction));
  const angle = shootingAngle(p.position, direction);
  const close = clamp((PIVOT_FINISH_METERS - range) / 3, 0, 1);
  const sight = clamp((angle - 0.18) / 0.5, 0, 1);
  const pressure = courtPlayers(s, otherTeam(p.team)).filter(d => d.kind !== 'GOALKEEPER' && distance(d.position, p.position) < 1.3).length;
  const craft = p.profile.pivotPlay * 0.45 + p.profile.finishing * 0.3 + p.profile.strength * 0.25;
  return close * 0.34 + sight * 0.24 + craft * 0.30 - pressure * 0.12;
}

/**
 * Which pivot finish this is.
 *
 * A turn when he has room to bring the ball round, a fall shot when he has been
 * pushed out and has to go through the line and land in the area. The engine
 * already resolves an airborne release legally, so the fall shot is a jump he
 * does not land from on his feet.
 */
export function pivotFinish(s: CoreState, p: CorePlayer): 'TURN' | 'FALL' {
  const direction = s.directions[p.team];
  const owner = courtPlayers(s, otherTeam(p.team)).find(d => s.defence.marks[d.id] === p.id);
  const contact = owner !== undefined && distance(owner.position, p.position) < 1.1;
  const deep = local(p.position, direction).y > 7.2;
  return contact || deep ? 'FALL' : 'TURN';
}

/**
 * Should the line player screen rather than offer?
 *
 * A screen is worth more than an offer when the ball is being worked toward the
 * interval he is standing in, because the defender he can take out is the one
 * about to be asked to stop it. This is the back-plus-pivot two-against-two in
 * one sentence, and it is the relationship the attack was missing.
 */
export function pivotShouldScreen(s: CoreState, pivot: CorePlayer): CorePlayer | null {
  const carrier = s.ball.controllerId ? getPlayer(s, s.ball.controllerId) : null;
  if (!carrier || carrier.team !== pivot.team || isPivot(carrier)) return null;
  const direction = s.directions[pivot.team];
  if (local(carrier.position, direction).y > 13) return null;
  const defenders = courtPlayers(s, otherTeam(pivot.team)).filter(d => d.kind === 'FIELD_PLAYER' && d.screenedUntilTick <= s.tick);
  // The man who is about to have to stop the carrier, and who the pivot can
  // physically get to before the ball does.
  const candidate = defenders
    .filter(d => d.id === s.defence.pressureId || d.id === s.defence.helperId)
    .filter(d => distance(d.position, pivot.position) < 4.5 && secondsTo(s, pivot, d.position) < 1.6)
    .sort((a, b) => distance(a.position, carrier.position) - distance(b.position, carrier.position))[0];
  return candidate ?? null;
}

/** Where he stands to screen that defender: on the goal side of him, in the lane. */
export function screenPost(s: CoreState, pivot: CorePlayer, defender: CorePlayer): Point {
  const direction = s.directions[pivot.team];
  const q = local(defender.position, direction);
  const post = world({ x: clamp(q.x, 1.6, 18.4), y: Math.max(6 + LINE_STANDOFF, q.y - 0.75) }, direction);
  return goalAreaClearance(post, direction) > pivot.radius ? post : clearGoalArea(post, direction, pivot.radius + 0.1);
}

/** Is the lane from here to the goal worth a pivot turning into? */
export const pivotLaneOpen = (s: CoreState, p: CorePlayer) =>
  laneClearance(s, p.position, goal(s.directions[p.team]), p.team) > 0.35;
