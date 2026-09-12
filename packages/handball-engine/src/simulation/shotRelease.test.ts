// HUMAN QA FIX 2A: legal shot release and goal-area entry.
//
// A human watched a fast break and saw the carrier run into the goal area and
// score from inside it. A tenth of every shot in the engine was released from
// in there.
//
// The test that must never be deleted is "the ball goes before the line does".
// Everything else here is a consequence of it. The rule being modelled is
// narrow and it is easy to model the wrong, wider one: a player may cross the
// goal-area line, may take off over it, may land in it. What he may never do is
// carry the ball in. A fix that keeps players out of the area instead of
// keeping the BALL out of their hands looks like it works, and it was measured:
// it cost 42% of all possessions, because a man running at an open goal braked
// at the six-metre line and stood on it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scenario, requireScenarioPlayer } from "../scenarios/matchScenario";
import { createFullCourt6v6State } from "../scenarios/fullCourt6v6";
import { simulateMatch } from "./matchRunner";
import { buildCanonicalMatchEvents } from "./canonicalEvents";
import { step } from "./engine";
import { takeOffPoint, releasePointOf } from "./shotRelease";
import {
  goalAreaClearance,
  insideGoalArea,
  insideAnyGoalArea,
  latestLegalPointOnPath,
  nearestLegalPoint,
} from "../domain/geometry/goalArea";
import { mirrorYForOppositeGoalSide } from "@handball-manager/match-contract";
import type { HandballState } from "../domain/handball/state";
import type { Player } from "../domain/handball/player";
import type { MeterPoint } from "../domain/geometry/coordinates";

const TOP = createFullCourt6v6State({ attackingGoalSide: "TOP" });
const BOTTOM = createFullCourt6v6State({ attackingGoalSide: "BOTTOM" });
const DT = 0.05;
const SEEDS = [1, 3, 5, 7, 11, 12, 17, 23] as const;

// ---------------------------------------------------------------------------
// 1. The shape of the D
// ---------------------------------------------------------------------------

test("the goal area is measured from the posts, not from the goal centre", () => {
  // The discriminating pair. A circle of six metres around the goal centre --
  // the wrong shape, and the one that put the first 3:2:1 base inside the D --
  // puts this point outside; the real D, which is six metres from the GOAL
  // LINE, contains it.
  const besideThePost = { x: 13.5, y: 5 };
  assert.ok(insideGoalArea(besideThePost, "TOP"), "6.10m from the goal centre, 5.39m from the near post: inside");
  assert.ok(Math.hypot(besideThePost.x - 10, besideThePost.y) > 6, "and a circle round the centre would have missed it");
});

test("the goal area is not the half-court line y = 6", () => {
  // The other wrong shape, and the one every caller reached for before this
  // module existed. Out on the wing, three metres from the end line, a player
  // is nowhere near the area -- but `y < 6` says he is standing in it.
  const wideOnTheWing = { x: 2, y: 3 };
  assert.ok(!insideGoalArea(wideOnTheWing, "TOP"), "7.16m from the nearest post: legal ground");
  assert.ok(wideOnTheWing.y < 6, "though the naive test would have called it inside");
});

test("the straight part of the line runs between the posts at six metres", () => {
  assert.ok(insideGoalArea({ x: 10, y: 5.9 }, "TOP"));
  assert.ok(!insideGoalArea({ x: 10, y: 6.1 }, "TOP"));
  assert.ok(Math.abs(goalAreaClearance({ x: 10, y: 6 }, "TOP")) < 1e-9, "the line itself is exactly the boundary");
});

test("both ends of the court have the same area, mirrored", () => {
  for (const point of [{ x: 13.5, y: 5 }, { x: 2, y: 3 }, { x: 10, y: 5.9 }, { x: 10, y: 6.1 }, { x: 7, y: 4 }]) {
    const mirrored = { x: point.x, y: mirrorYForOppositeGoalSide(point.y) };
    assert.equal(
      insideGoalArea(point, "TOP"),
      insideGoalArea(mirrored, "BOTTOM"),
      `(${point.x}, ${point.y}) and its mirror agree`,
    );
    assert.ok(
      Math.abs(goalAreaClearance(point, "TOP") - goalAreaClearance(mirrored, "BOTTOM")) < 1e-9,
      "and by the same distance",
    );
  }
});

// ---------------------------------------------------------------------------
// 2. The latest legal point on a path
// ---------------------------------------------------------------------------

test("running straight at the goal, the last legal point is the six-metre line", () => {
  const crossing = latestLegalPointOnPath({ x: 10, y: 14 }, { x: 10, y: 0 }, "TOP");
  assert.ok(Math.abs(crossing.y - 6) < 1e-3, `he crosses at y=${crossing.y.toFixed(4)}`);
  assert.ok(goalAreaClearance(crossing, "TOP") >= 0, "and the point itself is legal");
});

test("running at the goal from an angle, the last legal point is on the arc", () => {
  // From the wing, so the path meets the CURVED part around the post rather
  // than the straight line -- the case a `y >= 6` model gets wrong by metres.
  const crossing = latestLegalPointOnPath({ x: 18, y: 12 }, { x: 10, y: 0 }, "TOP");
  assert.ok(goalAreaClearance(crossing, "TOP") >= 0, "legal");
  assert.ok(Math.abs(Math.hypot(crossing.x - 11.5, crossing.y) - 6) < 1e-2, "exactly six metres from the near post");
  // And the direction the naive model gets it wrong in. Beyond the post the
  // arc curls BELOW six metres, so `y >= 6` would have made him release a good
  // metre earlier than he has to -- a shot given away rather than a rule kept.
  assert.ok(crossing.y < 6, `he may run in past the six-metre mark out here (y=${crossing.y.toFixed(2)})`);
});

test("a path that never reaches the area is returned untouched", () => {
  const to = { x: 4, y: 14 };
  assert.deepEqual(latestLegalPointOnPath({ x: 10, y: 20 }, to, "TOP"), to);
});

test("a point inside the area is put back on legal ground, close to where it was", () => {
  const inside = { x: 10.6, y: 1.9 };
  const legal = nearestLegalPoint(inside, "TOP");
  assert.ok(!insideGoalArea(legal, "TOP"), "legal when measured again, not merely on the line");
  assert.ok(Math.hypot(legal.x - inside.x, legal.y - inside.y) < 4.5, "and he is not teleported across the court");
});

// ---------------------------------------------------------------------------
// 3. The take-off
// ---------------------------------------------------------------------------

/** A lone player, ordered at the goal, run until his next step would cross. */
function runAtTheGoal(from: MeterPoint): { player: Player; takeOff: MeterPoint } {
  const base = requireScenarioPlayer(scenario({}).handball, "M9");
  let state: HandballState = { ...scenario({}).handball, players: [{ ...base, position: { ...from } }] };
  for (let i = 0; i < 400; i += 1) {
    const player = state.players[0];
    const takeOff = takeOffPoint(player, DT);
    if (takeOff) return { player, takeOff };
    state = step(state, { actions: [{ type: "MOVE", playerId: player.id, target: { x: 10, y: 0 } }] }, DT);
  }
  throw new Error("he never reached the line");
}

test("the take-off is the last legal point of the step that would have crossed", () => {
  const { player, takeOff } = runAtTheGoal({ x: 10, y: 15 });
  assert.ok(goalAreaClearance(takeOff, "TOP") >= 0, "the release point is legal");
  assert.ok(!insideAnyGoalArea(player.position), "he himself has not crossed yet");
  assert.ok(Math.abs(takeOff.y - 6) < 0.3, `and it is at the line, not a step short of it (y=${takeOff.y.toFixed(3)})`);
});

test("a take-off is offered from the wing too, against the curve", () => {
  const { takeOff } = runAtTheGoal({ x: 18, y: 11 });
  assert.ok(goalAreaClearance(takeOff, "TOP") >= 0);
  assert.ok(takeOff.x > 11.5, "he meets the curved part around the post, not the straight");
  assert.ok(
    Math.abs(Math.hypot(takeOff.x - 11.5, takeOff.y) - 6) < 0.25,
    `and takes off six metres from that post (${Math.hypot(takeOff.x - 11.5, takeOff.y).toFixed(2)}m)`,
  );
});

test("a player who is not about to cross is not taking off", () => {
  const base = requireScenarioPlayer(scenario({}).handball, "M9");
  const strolling = { ...base, position: { x: 10, y: 15 } };
  assert.equal(takeOffPoint(strolling, DT), null, "standing still, fifteen metres out");
});

test("a shot from legal ground is released exactly where the shooter stands", () => {
  const base = requireScenarioPlayer(scenario({}).handball, "M9");
  const outside = { ...base, position: { x: 9, y: 9 } };
  assert.deepEqual(releasePointOf(outside), outside.position);
});

test("a shot from inside the area is released from legal ground all the same", () => {
  const base = requireScenarioPlayer(scenario({}).handball, "M9");
  const inside = { ...base, position: { x: 10.4, y: 2.1 } };
  assert.ok(!insideAnyGoalArea(releasePointOf(inside)), "M9 can never be handed an illegal origin");
});

// ---------------------------------------------------------------------------
// 4. Through real matches
// ---------------------------------------------------------------------------

/** The kind of every player who appears in a match, court and bench alike. */
function kindsIn(match: ReturnType<typeof simulateMatch>): Map<string, string> {
  const kinds = new Map<string, string>();
  for (const p of [...match.finalState.match.handball.players, ...match.finalState.bench.HOME, ...match.finalState.bench.AWAY]) {
    kinds.set(p.id, p.kind);
  }
  return kinds;
}

test("the ball goes before the line does: no shot is ever released from inside the area", () => {
  // THE ONE THAT MUST NOT BE DELETED. Before this fix, 203 of 2090 shots across
  // twenty-four seeds -- 9.7% -- were released from inside the goal area, and
  // most of them were goals.
  const offences: string[] = [];
  let shots = 0;
  for (const start of [TOP, BOTTOM]) {
    for (const seed of SEEDS) {
      for (const event of buildCanonicalMatchEvents(simulateMatch(start, seed))) {
        if (event.type !== "SHOT" || !event.location) continue;
        shots += 1;
        if (insideAnyGoalArea(event.location)) {
          offences.push(`seed ${seed}: (${event.location.x.toFixed(2)}, ${event.location.y.toFixed(2)})`);
        }
      }
    }
  }
  assert.ok(shots > 1000, `a real sample of shots (${shots})`);
  assert.deepEqual(offences.slice(0, 10), [], `${offences.length} illegal shot origins`);
});

test("the shot's reported location is the release it was actually resolved from", () => {
  // Not a render-time correction: what the match tells the world and what M9
  // used to decide the outcome are the same point, and the ball's own position
  // when it starts flying is that point too.
  const match = simulateMatch(TOP, 12);
  const shots = buildCanonicalMatchEvents(match).filter((e) => e.type === "SHOT");
  assert.ok(shots.length > 0);
  for (const shot of shots) {
    assert.ok(shot.location, "every shot has a location");
    assert.ok(!insideAnyGoalArea(shot.location!), "and it is legal ground");
  }
});

test("the ball leaves the hand: nobody possesses it while it is flying to goal", () => {
  // Scanned rather than pinned to one seed: how many trace frames fall inside
  // a given flight window depends on where the engine happened to record them,
  // which every change to play moves around. The property is unchanged.
  let checked = 0;
  for (const seed of SEEDS) {
    const match = simulateMatch(TOP, seed);
    const shotSeconds = buildCanonicalMatchEvents(match)
      .filter((e) => e.type === "SHOT")
      .map((e) => e.matchSeconds);
    assert.ok(shotSeconds.length > 0, `seed ${seed} contains shots`);
    for (const seconds of shotSeconds) {
      // The frames immediately before the shot is recorded ARE the flight: the
      // engine steps the world while the ball travels.
      for (const frame of match.trace) {
        if (frame.matchSeconds >= seconds || frame.matchSeconds <= seconds - 0.2) continue;
        if (frame.ballPossessorId === null) checked += 1;
      }
    }
  }
  assert.ok(checked > 0, "there are real frames with the ball in nobody's hands");
});

test("he may land in the area, and the ball is never in his hands when he does", () => {
  // THE SECOND ONE THAT MUST NOT BE DELETED, and it is an absolute rather than
  // a bound. An outfield player may enter the goal area only after releasing
  // the ball; he may never receive there and never continue to hold it there.
  //
  // Reaching zero took three things beyond the release itself, and each was a
  // real hole rather than a tolerance: a pass may not complete on a receiver
  // who is inside, a regain may not be given to a defender who is standing
  // inside, and the take-off has to be judged against the step the engine is
  // actually about to take rather than the intent the carrier arrived with.
  let landings = 0;
  const offences: string[] = [];
  for (const start of [TOP, BOTTOM]) {
    for (const seed of SEEDS) {
      const match = simulateMatch(start, seed);
      const kinds = kindsIn(match);
      for (const frame of match.trace) {
        for (const p of frame.playerPositions) {
          if (kinds.get(p.playerId) !== "FIELD_PLAYER") continue;
          if (!insideAnyGoalArea(p.position)) continue;
          landings += 1;
          if (frame.ballPossessorId === p.playerId) {
            offences.push(`seed ${seed}: ${p.playerId} at ${frame.matchSeconds.toFixed(2)}s`);
          }
        }
      }
    }
  }
  assert.ok(landings > 0, "field players really do cross the line -- this is not vacuous");
  assert.deepEqual(offences.slice(0, 10), [], `${offences.length} frames of an outfield carrier inside the goal area`);
});

test("a pass is never completed to a man standing in the goal area", () => {
  // The mechanism behind the invariant above, stated on its own so that a
  // change to the passing model cannot quietly undo it. The ball waits on its
  // own line of flight; the receiver comes out and takes it on legal ground.
  const match = simulateMatch(TOP, 12);
  const kinds = kindsIn(match);
  let receptions = 0;
  for (let i = 1; i < match.trace.length; i += 1) {
    const now = match.trace[i];
    const before = match.trace[i - 1];
    if (now.ballPossessorId === null || now.ballPossessorId === before.ballPossessorId) continue;
    if (kinds.get(now.ballPossessorId) !== "FIELD_PLAYER") continue;
    const receiver = now.playerPositions.find((p) => p.playerId === now.ballPossessorId);
    if (!receiver) continue;
    receptions += 1;
    assert.ok(!insideAnyGoalArea(receiver.position), `${now.ballPossessorId} takes it on legal ground`);
  }
  assert.ok(receptions > 20, `a real number of receptions (${receptions})`);
});

test("neither end of the court is treated differently", () => {
  const top = simulateMatch(TOP, 12);
  const bottom = simulateMatch(BOTTOM, 12);
  const shotsOf = (m: ReturnType<typeof simulateMatch>): MeterPoint[] =>
    buildCanonicalMatchEvents(m).flatMap((e) => (e.type === "SHOT" && e.location ? [e.location] : []));
  const atTop = shotsOf(top);
  const atBottom = shotsOf(bottom);
  assert.ok(atTop.length > 0 && atBottom.length > 0);
  // Shots are taken at BOTH goals in either match, and none of them is illegal
  // at either end -- the mirroring is in the geometry, not in a special case.
  for (const shots of [atTop, atBottom]) {
    assert.ok(shots.some((s) => s.y < 20), "somebody attacks the top goal");
    assert.ok(shots.some((s) => s.y > 20), "and somebody attacks the bottom one");
    for (const shot of shots) assert.ok(!insideAnyGoalArea(shot));
  }
});

test("the same match is still the same match", () => {
  const a = simulateMatch(TOP, 12);
  const b = simulateMatch(TOP, 12);
  assert.deepEqual(a.finalScore, b.finalScore);
  assert.equal(a.totalPossessions, b.totalPossessions);
  assert.deepEqual(
    buildCanonicalMatchEvents(a).map((e) => `${e.sequence}:${e.type}`),
    buildCanonicalMatchEvents(b).map((e) => `${e.sequence}:${e.type}`),
  );
});
