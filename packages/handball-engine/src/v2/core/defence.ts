// COLLECTIVE DEFENCE: a 6:0 that is a line, not six private duels.
//
// The audit's largest tactical finding was that V2 defended man-to-man with
// role pairing and called it 6:0. Every defender's target came from his own
// marked attacker's position, `defence.system` was consulted in exactly one
// place, and the difference between 6:0 and 5:1 was one depth constant. Six
// independent pairings were masquerading as a system.
//
// A real 6:0 is a CONNECTED LINE. Its members own adjacent spaces in front of
// their own goal, they move as one body toward the ball, they stay compact
// enough that no interval opens between neighbours, and a man is defended
// because he has come into somebody's space rather than because he was assigned
// at kick-off. Everything a defender does follows from three facts: which space
// is his, where the ball is, and whether his neighbour has had to leave the
// line.
//
// TWO RULES SHAPE THE WHOLE MODULE.
//
// Responsibility is allocated before feasibility. Zones are owned by role and
// are stable for the possession; the ball then decides which zone is engaged.
// Arrival time is asked only afterwards, and only about the man who already
// owns the job. Choosing the owner by shortest distance is exactly how six
// defenders end up converging on one attacker, which is the failure the paused
// legacy work died of, and nothing here may do it.
//
// The existing single-pressure, single-help, single-cover invariant is kept. It
// was the one genuinely good thing about the old model. It now lives inside a
// line instead of standing in for one.
import { goalAreaClearance } from '../../domain/geometry/goalArea';
import { clamp, clearGoalArea, distance, local, world } from './space';
import { courtPlayers, getPlayer, otherTeam, type CorePlayer, type CoreState, type Direction, type Point, type Role } from './state';
import { secondsTo } from './timing';

/**
 * The six spaces of a 6:0, outside-left to outside-right.
 *
 * Named for what they defend rather than for who stands there, because the man
 * changes and the space does not. Anchors are lateral positions on a 20 m
 * court, measured with the attack coming from above.
 */
export const ZONE_ANCHORS = [2.6, 6.1, 8.9, 11.1, 13.9, 17.4] as const;
export const ZONE_COUNT = ZONE_ANCHORS.length;
/** The line stands this far off the goal-area line when nothing is pulling it. */
export const LINE_DEPTH_METERS = 6.75;
/** Defending the outside zones from the corner needs a little more depth. */
const OUTSIDE_DEPTH_BONUS = 0.5;

/** Which zone a defensive role owns by default, left to right. */
const ZONE_BY_ROLE: Record<string, number> = { LW: 0, LB: 1, CB: 2, P: 3, RB: 4, RW: 5, P2: 3 };

/**
 * Ball-side shift, the single most visible property of a working zone defence.
 *
 * The whole line slides toward the ball, and it slides as a body: the defender
 * nearest the ball moves most, the far side moves least but still moves, and
 * the gaps between neighbours never open. A line that shifted uniformly would
 * leave the far post exposed; one where only the nearest man moved would tear
 * apart. The gradient is what makes it a line.
 */
const SHIFT_NEAR = 0.78, SHIFT_FAR = 0.30;

/**
 * Compactness: how tightly neighbours sit. Rises when the ball is central and
 * when somebody has been beaten, because a broken line has to close ranks
 * before it can do anything else.
 */
const BASE_SPREAD = 1, BEATEN_SPREAD = 0.82;

export type DefenceRead = {
  /** Zone index of the defender who owns ball pressure, or null. */
  readonly engaged: number | null;
  /** Lateral position of the ball on the attacking half, in court metres. */
  readonly ballX: number;
  /** How far the line has slid, signed, in metres. */
  readonly shift: number;
  readonly compact: number;
};

/** Where zone `index` sits right now, given the ball and the line's state. */
export function zonePost(s: CoreState, index: number, read: DefenceRead, direction: Direction, defenderRadius = 0.28): Point {
  const anchor = ZONE_ANCHORS[index];
  // Gradient by distance from the engaged zone, so the body moves together.
  const centre = read.engaged ?? (read.ballX - 10) / 20 * (ZONE_COUNT - 1) + (ZONE_COUNT - 1) / 2;
  const proximity = 1 - Math.min(1, Math.abs(index - centre) / (ZONE_COUNT - 1));
  const weight = SHIFT_FAR + (SHIFT_NEAR - SHIFT_FAR) * proximity;
  const compacted = 10 + (anchor - 10) * read.compact;
  const x = clamp(compacted + read.shift * weight, 1.2, 20 - 1.2);
  const outside = index === 0 || index === ZONE_COUNT - 1;
  const depth = LINE_DEPTH_METERS + (outside ? OUTSIDE_DEPTH_BONUS : 0);
  return clearGoalArea(world({ x, y: depth }, direction), direction, defenderRadius + 0.12);
}

/** Which zone a point falls in. Boundaries are the midpoints between anchors. */
export function zoneOf(x: number): number {
  let best = 0;
  for (let i = 1; i < ZONE_COUNT; i++) if (Math.abs(x - ZONE_ANCHORS[i]) < Math.abs(x - ZONE_ANCHORS[best])) best = i;
  return best;
}

/**
 * Assign the six spaces once per possession, by role.
 *
 * Deliberately not by proximity. A defence that re-sorted its zones whenever
 * somebody drifted would have no line at all, and a left back who found himself
 * momentarily on the right would drag the whole structure with him.
 */
export function assignZones(s: CoreState, defenders: readonly CorePlayer[], direction: Direction): void {
  const taken = new Set<number>();
  const ordered = [...defenders].sort((a, b) => (ZONE_BY_ROLE[a.role] ?? 3) - (ZONE_BY_ROLE[b.role] ?? 3) || a.id.localeCompare(b.id));
  for (const d of ordered) {
    let want = ZONE_BY_ROLE[d.role] ?? 3;
    // Fewer than six men is a suspension, not a reshuffle: the remaining
    // defenders keep their own spaces and the line simply narrows around the
    // hole, which is what a short-handed team actually does.
    while (taken.has(want) && want < ZONE_COUNT - 1) want++;
    while (taken.has(want) && want > 0) want--;
    taken.add(want);
    d.zone = want;
  }
  // Mirrored ends swap left and right, so the lateral order has to follow.
  if (direction === 'BOTTOM') for (const d of ordered) d.zone = ZONE_COUNT - 1 - (d.zone ?? 0);
}

/**
 * Read the collective state of the defence once per tick.
 *
 * One read shared by every defender is what makes them a line: six independent
 * reads of the same court would drift apart and produce the converging
 * behaviour this module exists to remove.
 */
export function readDefence(s: CoreState, defenders: readonly CorePlayer[], carrier: CorePlayer | null, direction: Direction): DefenceRead {
  const ballX = carrier ? carrier.position.x : s.ball.position.x;
  const mirrored = direction === 'BOTTOM' ? 20 - ballX : ballX;
  const engagedZone = carrier ? zoneOf(mirrored) : null;
  const beaten = defenders.some(d => d.beatenUntilTick > s.tick);
  // The line follows the ball but never abandons the far post. Two thirds of
  // the ball's offset from centre is the working compromise: enough that the
  // ball-side interval is genuinely closed, little enough that a reversal has
  // somewhere to arrive.
  const shift = clamp((mirrored - 10) * 0.62, -3.6, 3.6);
  return { engaged: engagedZone, ballX: mirrored, shift, compact: beaten ? BEATEN_SPREAD : BASE_SPREAD };
}

export type ZoneDuty =
  | { kind: 'PRESSURE'; targetId: string; reason: string }
  | { kind: 'HELP'; targetId: string; reason: string }
  | { kind: 'COVER'; targetId: string | null; reason: string }
  | { kind: 'PIVOT'; targetId: string; reason: string }
  | { kind: 'MARK'; targetId: string | null; reason: string }
  | { kind: 'RECOVER'; targetId: string | null; reason: string }
  | { kind: 'RETREAT'; targetId: string | null; reason: string };

/**
 * How deep the pressure defender steps out to meet the carrier.
 *
 * This is where a shooting back and a breakthrough back stop being the same
 * problem. A defender must come out far enough to contest a shot he actually
 * fears, and staying home against a 10 m shooter is how a defence concedes.
 * Against a man who beats people off the dribble the same defender holds his
 * depth and makes him play through a body. So the step-out is read from the
 * ATTACKER: his shooting threat pulls the defender up, his breakthrough threat
 * keeps the defender down, and the defender's own timing decides how far he
 * dares go.
 */
export function pressDepth(carrier: CorePlayer, defender: CorePlayer, carrierDepth: number): number {
  const shootingThreat = carrier.profile.shotPower * 0.6 + carrier.profile.shotPlacement * 0.4;
  const driveThreat = carrier.profile.breakthrough;
  const appetite = defender.profile.defTiming * 0.6 + defender.profile.defPositioning * 0.4;
  // A 6:0 defender MEETS the back. He does not stand on his line and watch a
  // man shoot over him, and a defence that never closes the last metre is not
  // defending at all -- it was also why the attack never had to work for a
  // chance. So the step-out starts by reaching the carrier and is then pulled
  // up or held down by what kind of attacker he is.
  const meet = clamp(carrierDepth - LINE_DEPTH_METERS - 0.65, 0, 3.4);
  const draw = (shootingThreat - driveThreat * 0.75) * (0.9 + 1.3 * appetite);
  return clamp(meet + draw, 0, 4.2);
}

/**
 * Allocate the line's responsibilities.
 *
 * Order matters and is the whole design. The zone containing the ball owns
 * pressure. His ball-side neighbour owns the help, because that is the interval
 * that opens when he steps out. The next man covers behind the helper. The zone
 * containing the line player owns the line player. Everybody else holds his
 * space and picks up whoever is standing in it. Nothing here asks who is
 * nearest to anything.
 */
export function allocate(s: CoreState, defenders: readonly CorePlayer[], attackers: readonly CorePlayer[], carrier: CorePlayer | null, read: DefenceRead, direction: Direction, retreating = false): Map<string, ZoneDuty> {
  const duties = new Map<string, ZoneDuty>();
  const byZone = new Map<number, CorePlayer>();
  for (const d of defenders) if (d.zone !== null) byZone.set(d.zone, d);
  const localX = (p: CorePlayer) => direction === 'BOTTOM' ? 20 - p.position.x : p.position.x;

  const line = attackers.filter(a => a.role === 'P' || a.role === 'P2');
  const pivotOwner = new Map<string, string>();
  for (const pivot of line) {
    // The line player belongs to the space he is standing in. When two line
    // players stand in one space, the second is taken by the neighbour toward
    // the ball, which is the ordinary answer and not an arbitrary nearest man.
    let want = zoneOf(localX(pivot));
    if ([...pivotOwner.values()].includes(String(want))) want = clamp(want + (read.shift >= 0 ? -1 : 1), 0, ZONE_COUNT - 1);
    const owner = byZone.get(want);
    if (owner) pivotOwner.set(owner.id, pivot.id);
  }

  let pressureId: string | null = null, helperId: string | null = null;
  if (carrier && read.engaged !== null) {
    // Whoever owns the space the ball is in presses it. If that man is beaten
    // or has been screened out, the job passes to the neighbour toward the
    // middle: a handover, not a scramble.
    for (const offset of [0, read.shift >= 0 ? -1 : 1, read.shift >= 0 ? 1 : -1]) {
      const candidate = byZone.get(clamp(read.engaged + offset, 0, ZONE_COUNT - 1));
      if (candidate && candidate.beatenUntilTick <= s.tick && candidate.screenedUntilTick <= s.tick) { pressureId = candidate.id; break; }
    }
  }
  if (pressureId) {
    const presser = getPlayer(s, pressureId);
    duties.set(pressureId, { kind: 'PRESSURE', targetId: carrier!.id, reason: 'Own the space the ball is in and meet the carrier in it' });
    // Help comes from the neighbour on the side the carrier is attacking,
    // because that is the interval the step-out opens. It is a zone
    // relationship, not a proximity search.
    const toward = carrier!.position.x - presser.position.x;
    const side = (direction === 'BOTTOM' ? -toward : toward) >= 0 ? 1 : -1;
    for (const offset of [side, -side]) {
      const neighbour = byZone.get(clamp((presser.zone ?? 0) + offset, 0, ZONE_COUNT - 1));
      if (neighbour && neighbour.id !== pressureId && neighbour.beatenUntilTick <= s.tick && !pivotOwner.has(neighbour.id)) { helperId = neighbour.id; break; }
    }
    if (helperId) {
      duties.set(helperId, { kind: 'HELP', targetId: carrier!.id, reason: 'Close the interval the step-out opened beside the pressing defender' });
      const helper = getPlayer(s, helperId);
      const beyond = byZone.get(clamp((helper.zone ?? 0) + ((helper.zone ?? 0) - (presser.zone ?? 0)), 0, ZONE_COUNT - 1));
      if (beyond && !duties.has(beyond.id) && beyond.beatenUntilTick <= s.tick) {
        duties.set(beyond.id, { kind: 'COVER', targetId: pivotOwner.get(beyond.id) ?? null, reason: 'Slide behind the helper and take the space he vacated' });
      }
    }
  }
  // The line player is never left to nobody. If the space he stands in has had
  // to go to the ball, the responsibility passes to the neighbour toward the
  // middle, which is where the cover already is. A pivot with no owner is the
  // single clearest way for a 6:0 to look broken, and the zonal allocation can
  // produce one whenever the pivot's own space becomes the pressing space.
  for (const [ownerId, pivotId] of [...pivotOwner]) {
    if (!duties.has(ownerId)) continue;
    const owner = defenders.find(d => d.id === ownerId);
    const from = owner?.zone ?? 3;
    const inward = from <= (ZONE_COUNT - 1) / 2 ? 1 : -1;
    const relay = [from + inward, from - inward, from + 2 * inward]
      .map(z => byZone.get(clamp(z, 0, ZONE_COUNT - 1)))
      .find(d => d !== undefined && !duties.has(d.id) && d.beatenUntilTick <= s.tick);
    pivotOwner.delete(ownerId);
    if (relay) pivotOwner.set(relay.id, pivotId);
  }

  for (const d of defenders) {
    if (duties.has(d.id)) continue;
    if (d.beatenUntilTick > s.tick) { duties.set(d.id, { kind: 'RECOVER', targetId: null, reason: 'Beaten; recover into the line before taking anything else' }); continue; }
    // A defender who is still up the court has no space to hold yet. Getting
    // goal-side of the ball comes first, and the line forms out of the players
    // who have arrived.
    if (retreating && local(d.position, direction).y > LINE_DEPTH_METERS + 9) {
      duties.set(d.id, { kind: 'RETREAT', targetId: null, reason: 'Recover goal-side before taking a place in the line' });
      continue;
    }
    const pivot = pivotOwner.get(d.id);
    if (pivot) { duties.set(d.id, { kind: 'PIVOT', targetId: pivot, reason: 'The line player is standing in this space and belongs to it' }); continue; }
    // Otherwise hold the space and take the man who is in it. An empty space is
    // still defended, which is the difference from man-marking.
    const inZone = attackers.filter(a => a.id !== carrier?.id && zoneOf(localX(a)) === d.zone)
      .sort((a, b) => local(a.position, direction).y - local(b.position, direction).y || a.id.localeCompare(b.id))[0];
    duties.set(d.id, { kind: 'MARK', targetId: inZone?.id ?? null, reason: inZone ? 'Hold the space and take the attacker occupying it' : 'Hold the space; nobody is in it yet' });
  }
  return duties;
}

/**
 * Where a defender actually stands, given his duty and his space.
 *
 * Every answer starts from his zone post, so even a defender doing something
 * urgent stays part of the line. Steering is the small lateral bias that keeps
 * him on his man's inside shoulder: a defence that lets attackers come inside
 * is not defending, and pushing them wide is most of what a 6:0 does.
 */
export function dutyTarget(s: CoreState, d: CorePlayer, duty: ZoneDuty, read: DefenceRead, direction: Direction): Point {
  const post = zonePost(s, d.zone ?? 3, read, direction, d.radius);
  const q = local(post, direction);
  const target = (x: number, y: number) => clearGoalArea(world({ x: clamp(x, 1.1, 18.9), y: clamp(y, 6.2, 17) }, direction), direction, d.radius + 0.12);
  const man = duty.targetId ? getPlayer(s, duty.targetId) : null;
  const manQ = man ? local(man.position, direction) : null;

  if (duty.kind === 'RECOVER') return target(q.x, q.y);
  // Retreating runs at the post itself rather than at any man: the quickest way
  // back into a line is to go to where your place in it will be.
  if (duty.kind === 'RETREAT') return target(q.x, q.y);
  if (duty.kind === 'PRESSURE' && man && manQ) {
    const depth = pressDepth(man, d, manQ.y);
    // Steer him away from the middle: stand a little to his inside.
    const inside = Math.sign(10 - manQ.x) || 1;
    const lateral = 0.35 + 0.35 * d.profile.defPositioning;
    return target(manQ.x + inside * lateral, Math.max(q.y, Math.min(manQ.y - 0.45, q.y + depth)));
  }
  if (duty.kind === 'HELP' && manQ) {
    // Between his own post and the ball, goal-side of the carrier, never past
    // him. Helping is closing a door, not chasing a man.
    return target((q.x * 0.45 + manQ.x * 0.55), Math.max(q.y - 0.2, Math.min(manQ.y - 0.35, q.y + 1.1)));
  }
  if (duty.kind === 'PIVOT' && manQ) {
    // Front him when the ball is on the far side, sit behind him when it is
    // near: the ordinary line-player rule, expressed in one line.
    const front = Math.abs(read.ballX - manQ.x) > 4.5;
    return target(manQ.x + Math.sign(q.x - manQ.x) * 0.45, front ? manQ.y - 0.5 : Math.max(q.y - 0.35, manQ.y + 0.35));
  }
  if (duty.kind === 'COVER') return target(q.x + (read.shift >= 0 ? -0.3 : 0.3), q.y - 0.15);
  if (manQ) {
    // Marking inside his own space: hold the post, bias toward his man, and
    // never leave the line to follow him out of the zone.
    const bias = clamp(manQ.x - q.x, -1.5, 1.5);
    return target(q.x + bias * 0.55, q.y);
  }
  return target(q.x, q.y);
}

/**
 * Can the man who owns this job actually do it?
 *
 * Asked AFTER allocation and never before. A pressing defender who cannot get
 * to the carrier in time is not replaced by whoever is closest; the line simply
 * knows he is late, and the help relationship beside him is what covers it.
 */
export function dutyFeasible(s: CoreState, d: CorePlayer, duty: ZoneDuty, target: Point): boolean {
  if (duty.kind !== 'PRESSURE' && duty.kind !== 'HELP') return true;
  const man = duty.targetId ? getPlayer(s, duty.targetId) : null;
  if (!man) return false;
  // Two seconds is about how long a carrier takes to decide and release under
  // pressure; arriving after that is arriving after the ball has gone.
  return secondsTo(s, d, target) <= 2 + 0.6 * d.profile.defTiming;
}

/** True when the defence is genuinely organised rather than still retreating. */
export function lineFormed(s: CoreState, defenders: readonly CorePlayer[], direction: Direction): boolean {
  const home = defenders.filter(d => local(d.position, direction).y < LINE_DEPTH_METERS + 4.5).length;
  return home >= Math.min(5, defenders.length);
}

/** Distance from the goal-area line, for readable trace text. */
export const lineClearance = (p: Point, direction: Direction) => goalAreaClearance(p, direction);
