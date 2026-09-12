// HUMAN QA CORRECTION: the 3:2:1 as a set of jobs, not a shape that slides.
//
// QA Fix 2C made the triangle move and a human said, correctly, that a moving
// triangle is still a triangle. Every defender's target was a point computed
// from the ball's x: the base slid by a per-metre constant, the half-space men
// stepped out on a distance test, the point man leaned. Nothing in it ever
// asked the questions a defence actually asks, so nothing in it could answer
// them differently as the situation changed.
//
// The questions are these, and this module answers them every step:
//
//   Who is pressing the ball?
//   Who is covering behind him if he is beaten?
//   Who is protecting the inside lane?
//   Who owns the next man the ball can go to?
//   Who has the pivot?
//   Who has just given a man up, and is therefore going back to his post?
//
// The geometry then follows from the answers instead of replacing them. That is
// the whole difference: the shape a human sees is an OUTPUT of six men doing
// six different jobs, and it changes because the jobs change hands.
//
// WHAT IS REUSED RATHER THAN REINVENTED. Whether a defender can actually do a
// job is Spatial Control's question and is asked with `timeToReach`, exactly as
// M18 asks it everywhere else. A man is not given the ball to press because he
// is nearest; he is given it because he can get there first and is still
// goal-side of it. Nothing here is a new physics.

import { COURT_WIDTH_METERS } from "../../domain/geometry/court";
import { distanceBetween, type MeterPoint } from "../../domain/geometry/coordinates";
import { DEFENDER_REACTION_SECONDS, reachProfileOf, timeToReach } from "../../simulation/spatialControl";
import { defensiveHomePosition, defensiveLayerOf, type DefensiveLayer } from "./defensiveSystem";
import type { DefenseRole, Player } from "../../domain/handball/player";
import type { SixZeroDefender } from "./responsibility";

/** What one defender is responsible for, this instant. */
export type DefensiveDuty =
  /** On the ball: stop it, and decide where it can be played. */
  | "PRESS_BALL"
  /** Behind the press: absorb the carrier if he gets past it. */
  | "COVER_BEHIND"
  /** The inside path to goal, between the ball and the middle. */
  | "INSIDE_LANE"
  /** The man the ball is most likely to go to next. */
  | "NEXT_THREAT"
  /** The line player. */
  | "PIVOT"
  /** Narrowed in, holding the next inside threat and the far side of the line. */
  | "COMPACT_INSIDE"
  /** Has given a man up, and is going back to his post rather than chasing. */
  | "RECOVER";

export type DutyAssignment = {
  readonly duties: ReadonlyMap<string, DefensiveDuty>;
  /** Who each duty fell to, where the duty has one owner. */
  readonly pressId: string | null;
  readonly coverId: string | null;
  readonly insideId: string | null;
  readonly nextThreatId: string | null;
  readonly pivotId: string | null;
  /** The man the press was taken off this step, when it changed hands. */
  readonly handedOverId: string | null;
  /** The attacker `NEXT_THREAT` is watching, when there is one. */
  readonly nextThreatTargetId: string | null;
  /** True when the carrier has beaten the advanced layers and the base has him. */
  readonly penetrated: boolean;
  readonly summary: string;
};

/**
 * How far the ball may be from the middle and still be the point man's.
 *
 * The corridor each advanced defender OWNS, which is the thing that makes this
 * a system rather than three men racing for the ball. The point man has the
 * central backcourt; each half-space defender has his own side. Three metres
 * either side of the middle is the centre back's working width, so a ball
 * inside it is the point man's problem however close a half-space man happens
 * to be standing.
 */
const CENTRAL_CORRIDOR_HALF_WIDTH_METERS = 3;

/**
 * How long the man who OWNS the ball's corridor may take to get to it and still
 * be given the job.
 *
 * Deliberately an ABSOLUTE bound rather than a race against his teammates.
 * Comparing him to the quickest defender sounds right and is not: whoever
 * pressed the ball last is already standing on the press point and is therefore
 * always the quickest, so the job never came back to its owner and the point
 * man never retook the middle. The question is whether HE can do it, not
 * whether somebody else could do it sooner. Just under two seconds is about six
 * metres at a defender's pace -- a man further away than that is not in this
 * play, and the job goes to whoever is.
 */
const CORRIDOR_ABLE_SECONDS = 1.8;

/** How far goal-side of the carrier a presser stands. */
export const PRESS_STANDOFF_METERS = 1.3;

const EMPTY: DutyAssignment = {
  duties: new Map(),
  pressId: null,
  coverId: null,
  insideId: null,
  nextThreatId: null,
  pivotId: null,
  handedOverId: null,
  nextThreatTargetId: null,
  penetrated: false,
  summary: "",
};

type Context = {
  readonly goalSide: "TOP" | "BOTTOM";
  readonly goal: MeterPoint;
  readonly carrier: Player | null;
  readonly pivot: Player | null;
  readonly attackers: readonly Player[];
  /** M22: everybody working the line, which a seven-out attack makes two of. */
  readonly linePlayers: readonly Player[];
};

/** The point a presser is trying to occupy: goal-side of the carrier. */
export function pressPointFor(carrier: Player, goal: MeterPoint): MeterPoint {
  const toGoal = distanceBetween(carrier.position, goal);
  if (toGoal < 1e-6) return { ...carrier.position };
  const t = Math.min(1, PRESS_STANDOFF_METERS / toGoal);
  return { x: carrier.position.x + (goal.x - carrier.position.x) * t, y: carrier.position.y + (goal.y - carrier.position.y) * t };
}

/**
 * How far past a defender the carrier must be before that defender is beaten.
 *
 * Level is not beaten. The point man of a 3:2:1 stands at twelve metres and the
 * centre back he is there to press stands at about eleven and a half, so the
 * two are shoulder to shoulder by design -- and an exact comparison made the
 * point man "beaten" by a man standing beside him, which handed the central
 * ball to a half-space defender and left the point empty. Three quarters of a
 * metre is about half a stride: enough to mean he has actually gone past.
 */
const BEATEN_TOLERANCE_METERS = 0.75;

/** Is this defender still between the carrier and the goal he defends? */
function goalSideOf(defender: Player, carrier: Player, goalSide: "TOP" | "BOTTOM"): boolean {
  return goalSide === "TOP"
    ? defender.position.y <= carrier.position.y + BEATEN_TOLERANCE_METERS
    : defender.position.y >= carrier.position.y - BEATEN_TOLERANCE_METERS;
}

function secondsTo(defender: Player, point: MeterPoint): number {
  return timeToReach(reachProfileOf(defender, DEFENDER_REACTION_SECONDS), point);
}

/**
 * Who the ball can go to next, and how dangerous that is.
 *
 * The attacker other than the carrier and the line player who is nearest to
 * having a clear run at the goal. It is deliberately the same thing the attack
 * itself is looking at -- a man in space, goal-side, within a pass -- so the
 * defender who owns him is owning a real option rather than a guess.
 */
function nextThreatOf(context: Context): Player | null {
  const { carrier, pivot, goal } = context;
  if (!carrier) return null;
  let best: { player: Player; score: number } | null = null;
  for (const attacker of context.attackers) {
    if (attacker.id === carrier.id || attacker.id === pivot?.id) continue;
    const pass = distanceBetween(carrier.position, attacker.position);
    if (pass > 14) continue;
    // Closer to goal is more dangerous; a pass he cannot receive is not a
    // threat at all, so distance from the ball counts against him.
    const score = -distanceBetween(attacker.position, goal) - 0.35 * pass;
    if (!best || score > best.score) best = { player: attacker, score };
  }
  return best?.player ?? null;
}

/**
 * Assign the six jobs of a 3:2:1 from the state in front of it.
 *
 * Order matters and is the system's own priority. The pivot is settled first,
 * because a 3:2:1 that loses the line has lost the reason it stands three men
 * there. The ball is settled second. What is left covers, protects and watches,
 * and anybody with nothing to do is going back to his post.
 */
export function assignThreeTwoOneDuties(
  formationId: string,
  defenders: readonly SixZeroDefender[],
  context: Context,
  previousPressId: string | null,
): DutyAssignment {
  if (defenders.length === 0) return EMPTY;
  const duties = new Map<string, DefensiveDuty>();
  const layerOf = (d: SixZeroDefender): DefensiveLayer => defensiveLayerOf(formationId, d.role as DefenseRole);
  const base = defenders.filter((d) => layerOf(d) === "BASE");
  const advanced = defenders.filter((d) => layerOf(d) !== "BASE");
  const centreX = COURT_WIDTH_METERS / 2;
  const taken = new Set<string>();
  const claim = (defender: SixZeroDefender | null | undefined, duty: DefensiveDuty): string | null => {
    if (!defender || taken.has(defender.id)) return null;
    taken.add(defender.id);
    duties.set(defender.id, duty);
    return defender.id;
  };

  // 1. THE PIVOT, first and always. The nearest base defender laterally, which
  //    is the man whose part of the line the pivot is standing in.
  const pivotId = context.pivot
    ? claim(
        [...base].sort(
          (a, b) =>
            Math.abs(a.position.x - context.pivot!.position.x) - Math.abs(b.position.x - context.pivot!.position.x) ||
            a.id.localeCompare(b.id),
        )[0],
        "PIVOT",
      )
    : null;

  if (!context.carrier) {
    for (const defender of defenders) if (!taken.has(defender.id)) duties.set(defender.id, "RECOVER");
    return { ...EMPTY, duties, pivotId, summary: pivotId ? "no ball threat; the line holds the pivot" : "no ball threat" };
  }

  const carrier = context.carrier;
  const press = pressPointFor(carrier, context.goal);

  // 2. THE BALL. Whoever can get to it first AND is still in front of it. The
  //    advanced three are asked before the line, because pressing the ball is
  //    what the advanced layers of a 3:2:1 are for -- but if all three have
  //    been beaten, the ball has penetrated and the line has to take it, which
  //    is the first link of the breakthrough chain.
  const canPress = (candidates: readonly SixZeroDefender[]) =>
    candidates
      .filter((d) => !taken.has(d.id) && goalSideOf(d, carrier, context.goalSide))
      .sort((a, b) => secondsTo(a, press) - secondsTo(b, press) || a.id.localeCompare(b.id))[0];

  let penetrated = false;
  const fastest = canPress(advanced);
  // WHOSE BALL IS IT? Ownership first, reach second. The corridor the carrier
  // is standing in belongs to somebody, and that man takes him unless he
  // plainly cannot get there -- which is what makes the ball come back to the
  // point when it comes back to the middle, instead of staying with whichever
  // half-space defender last touched it.
  const owner = corridorOwnerOf(formationId, carrier.position.x, advanced, context.goalSide);
  let presser: SixZeroDefender | undefined;
  if (owner && !taken.has(owner.id) && goalSideOf(owner, carrier, context.goalSide) && secondsTo(owner, press) <= CORRIDOR_ABLE_SECONDS) {
    presser = owner;
  } else {
    presser = fastest;
  }
  if (!presser) {
    // Every advanced defender has been beaten: the ball is through, and the
    // line has it. The first link of the breakthrough chain.
    penetrated = true;
    presser = canPress(base) ?? [...base].filter((d) => !taken.has(d.id))[0];
  }
  const pressId = claim(presser, "PRESS_BALL");
  const handedOverId = previousPressId && pressId !== previousPressId ? previousPressId : null;

  // 3. BEHIND THE PRESS. The base defender nearest the line the carrier would
  //    run if he beat it. This is the man who makes pressure affordable: the
  //    3:2:1 buys pressure outside with space behind, and he is the space.
  const coverId = claim(
    [...base]
      .filter((d) => !taken.has(d.id))
      .sort(
        (a, b) =>
          Math.abs(a.position.x - press.x) - Math.abs(b.position.x - press.x) || a.id.localeCompare(b.id),
      )[0],
    "COVER_BEHIND",
  );

  // 3b. A SECOND MAN ON THE LINE. A seven-out attack puts one there, and a
  //     base three that can only account for one of them is being outnumbered
  //     in the one place a 3:2:1 cannot afford it. He is taken by whichever
  //     base man is still free, before anybody narrows or watches a pass.
  const secondLine = context.linePlayers.find((p) => p.id !== context.pivot?.id);
  const secondPivotId = secondLine
    ? claim(
        [...base]
          .filter((d) => !taken.has(d.id))
          .sort(
            (a, b) =>
              Math.abs(a.position.x - secondLine.position.x) - Math.abs(b.position.x - secondLine.position.x) ||
              a.id.localeCompare(b.id),
          )[0],
        "PIVOT",
      )
    : null;
  void secondPivotId;

  // 4. THE INSIDE LANE. Of whoever is left in the advanced layers, the man
  //    nearer the middle of the court takes the path from the ball to the goal.
  const insideId = claim(
    [...advanced]
      .filter((d) => !taken.has(d.id))
      .sort((a, b) => Math.abs(a.position.x - centreX) - Math.abs(b.position.x - centreX) || a.id.localeCompare(b.id))[0],
    "INSIDE_LANE",
  );

  // 5. THE NEXT MAN. The last advanced defender watches where the ball is
  //    going, not where it is -- which is what lets the next handover happen
  //    before the pass rather than after it.
  const threat = nextThreatOf(context);
  const nextThreatId = claim(
    [...advanced]
      .filter((d) => !taken.has(d.id))
      .sort(
        (a, b) =>
          Math.abs(a.position.x - (threat?.position.x ?? centreX)) -
            Math.abs(b.position.x - (threat?.position.x ?? centreX)) || a.id.localeCompare(b.id),
      )[0],
    "NEXT_THREAT",
  );

  // 6. AND THE REST COMPACT IN. A base defender with no man narrows toward the
  //    middle; anybody else has given his man up and is going back to his post.
  for (const defender of defenders) {
    if (taken.has(defender.id)) continue;
    duties.set(defender.id, layerOf(defender) === "BASE" ? "COMPACT_INSIDE" : "RECOVER");
  }

  const roleOf = (id: string | null) => defenders.find((d) => d.id === id)?.role ?? null;
  const parts = [
    pressId ? `${roleOf(pressId)} presses the ball` : "nobody on the ball",
    coverId ? `${roleOf(coverId)} covers behind` : null,
    insideId ? `${roleOf(insideId)} holds the inside lane` : null,
    nextThreatId && threat ? `${roleOf(nextThreatId)} owns the next pass` : null,
    pivotId ? `${roleOf(pivotId)} has the pivot` : "pivot unowned",
    handedOverId ? `${roleOf(handedOverId)} hands over and recovers` : null,
    penetrated ? "the ball is through: the line has it" : null,
  ].filter((part): part is string => part !== null);

  return {
    duties,
    pressId,
    coverId,
    insideId,
    nextThreatId,
    pivotId,
    handedOverId,
    nextThreatTargetId: threat?.id ?? null,
    penetrated,
    summary: parts.join("; "),
  };
}

/**
 * The advanced defender whose corridor this x belongs to.
 *
 * Read from the system's own HOME shape rather than from where anybody is
 * standing, because it is a statement about whose job this is. A half-space
 * defender who has been dragged into the middle still owns his half-space.
 */
function corridorOwnerOf(
  formationId: string,
  ballX: number,
  advanced: readonly SixZeroDefender[],
  goalSide: "TOP" | "BOTTOM",
): SixZeroDefender | null {
  const centreX = COURT_WIDTH_METERS / 2;
  const homeX = (defender: SixZeroDefender) =>
    defensiveHomePosition(formationId, defender.role as DefenseRole, goalSide)?.x ?? defender.position.x;
  if (Math.abs(ballX - centreX) <= CENTRAL_CORRIDOR_HALF_WIDTH_METERS) {
    return advanced.find((d) => defensiveLayerOf(formationId, d.role as DefenseRole) === "FRONT") ?? null;
  }
  const wantLeft = ballX < centreX;
  return (
    advanced.find(
      (d) => defensiveLayerOf(formationId, d.role as DefenseRole) === "INTERMEDIATE" && (homeX(d) < centreX) === wantLeft,
    ) ?? null
  );
}

export type { Context as DutyContext };
