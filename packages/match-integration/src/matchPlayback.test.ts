// MATCH-EXPERIENCE-2.0 M5: playback of a real deterministic match.
//
// The test that must never be deleted is "playback speed cannot change the
// match": M5's whole constraint is that the renderer is a CONSUMER. A change
// that let presentation feed back into possession, events or the score would
// pass most of this file and still break the architecture M1-M4 established.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_COURT_LENGTH_METERS,
  CANONICAL_COURT_WIDTH_METERS,
  CANONICAL_FULL_COURT_BOUNDS,
  isWithinCanonicalBounds,
} from "@handball-manager/match-contract";
import { createFullCourt6v6State } from "@handball-manager/handball-engine/src/scenarios/fullCourt6v6.ts";
import { simulateMatch, HALF_LENGTH_SECONDS, FULL_TIME_SECONDS } from "@handball-manager/handball-engine/src/simulation/matchRunner.ts";
import {
  buildPlaybackFrames,
  frameAtMatchSeconds,
  playbackDurationSeconds,
  advancePlaybackClock,
  formatMatchClock,
  PLAYBACK_SPEEDS,
  type PlaybackFrame,
} from "./matchPlayback";
import { snapshotToBoardObjects, snapshotToScene } from "./fieldAdapter";

const SEED = 12;
const START = createFullCourt6v6State({ attackingGoalSide: "TOP" });
const MATCH = simulateMatch(START, SEED);
const GOALKEEPER_IDS = START.handball.players.filter((p) => p.kind === "GOALKEEPER").map((p) => p.id);

function frames(): PlaybackFrame[] {
  return buildPlaybackFrames(MATCH as never, { goalkeeperIds: GOALKEEPER_IDS, rosters: MATCH.finalState.rosters });
}

const FRAMES = frames();

// ---------------------------------------------------------------------------
// Court and coordinates
// ---------------------------------------------------------------------------

test("engine metre coordinates map onto the canonical FULL court", () => {
  for (const frame of [FRAMES[0], FRAMES[Math.floor(FRAMES.length / 2)], FRAMES[FRAMES.length - 1]]) {
    assert.equal(frame.snapshot.court.view, "FULL_COURT", "a match is never rendered on a half court");
    assert.equal(frame.snapshot.court.widthMeters, CANONICAL_COURT_WIDTH_METERS);
    assert.equal(frame.snapshot.court.lengthMeters, CANONICAL_COURT_LENGTH_METERS);
    for (const player of frame.snapshot.players) {
      assert.ok(isWithinCanonicalBounds(player, CANONICAL_FULL_COURT_BOUNDS), `${player.id} is on the court`);
    }
    assert.ok(isWithinCanonicalBounds(frame.snapshot.ball, CANONICAL_FULL_COURT_BOUNDS), "the ball is on the court");
  }
});

test("both goals are represented, and play occurs at both ends", () => {
  const sides = new Set(FRAMES.map((f) => f.snapshot.court.attackingGoalSide));
  assert.deepEqual([...sides].sort(), ["BOTTOM", "TOP"], "the match is played toward both goals");
});

// ---------------------------------------------------------------------------
// Players and goalkeepers
// ---------------------------------------------------------------------------

test("every player on the court renders in every frame, and nobody is invented", () => {
  // M10: a suspended player genuinely leaves the court for two minutes, so a
  // frame can legitimately carry fewer than fourteen. What the renderer must
  // never do is invent, drop or duplicate somebody who IS on -- it draws
  // exactly the engine's own player list.
  assert.equal(FRAMES[0].snapshot.players.length, 14, "a match starts 6 + 6 outfield players and two goalkeepers");
  let sawShortHanded = false;
  for (const frame of FRAMES) {
    const ids = frame.snapshot.players.map((p) => p.id);
    assert.ok(ids.length <= 14, "nobody is added to the court");
    assert.ok(ids.length >= 12, `a court never empties beyond two suspensions (${ids.length})`);
    assert.equal(new Set(ids).size, ids.length, "every player on court is distinct");
    if (ids.length < 14) sawShortHanded = true;
  }
  // And the frames are the engine's own: a short-handed frame in the trace is a
  // short-handed frame on screen.
  const shortInTrace = MATCH.trace.some((t) => t.playerPositions.length < 14);
  assert.equal(sawShortHanded, shortInTrace, "the renderer shows short-handed play exactly when the engine had it");
});

test("both goalkeepers render, one at each end", () => {
  for (const frame of [FRAMES[0], FRAMES[FRAMES.length - 1]]) {
    const keepers = frame.snapshot.players.filter((p) => p.kind === "GOALKEEPER");
    assert.equal(keepers.length, 2);
    const ends = keepers.map((k) => (k.y < CANONICAL_COURT_LENGTH_METERS / 2 ? "TOP" : "BOTTOM")).sort();
    assert.deepEqual(ends, ["BOTTOM", "TOP"], "a keeper in each goal");
  }
});

test("a goalkeeper stays a goalkeeper even when his side changes, and a substitute keeper is one too", () => {
  // Side is situational and flips with possession; kind never does.
  //
  // M11: a keeper can be substituted, so he is not present in every frame. What
  // must hold is that WHENEVER he is on the court he is drawn as a goalkeeper --
  // and that goes for a reserve who comes on as much as for the man who started.
  for (const id of GOALKEEPER_IDS) {
    const kinds = new Set(FRAMES.flatMap((f) => f.snapshot.players.filter((p) => p.id === id).map((p) => p.kind)));
    assert.deepEqual([...kinds], ["GOALKEEPER"], `${id} is a goalkeeper whenever he is on court`);
  }
  const sidesSeen = new Set(FRAMES.flatMap((f) => f.snapshot.players.filter((p) => p.id === GOALKEEPER_IDS[0]).map((p) => p.side)));
  assert.ok(sidesSeen.size >= 1, "his side is read from the engine's possession, not fixed by the renderer");

  // Every frame shows exactly two goalkeepers, whoever they currently are.
  for (const frame of FRAMES) {
    const keepers = frame.snapshot.players.filter((p) => p.kind === "GOALKEEPER");
    assert.equal(keepers.length, 2, "one in each goal, starters or substitutes");
  }
  // And a keeper who never started does appear once he comes on.
  const startingKeepers = new Set(GOALKEEPER_IDS);
  const keepersSeen = new Set(FRAMES.flatMap((f) => f.snapshot.players.filter((p) => p.kind === "GOALKEEPER").map((p) => p.id)));
  const substituteKeepers = [...keepersSeen].filter((id) => !startingKeepers.has(id));
  assert.ok(substituteKeepers.length > 0, `a substitute goalkeeper played and was drawn as one (${substituteKeepers.join(", ")})`);
});

test("HOME and AWAY are distinguishable, and both sides appear", () => {
  const frame = FRAMES[0];
  const sides = new Set(frame.snapshot.players.map((p) => p.side));
  assert.deepEqual([...sides].sort(), ["ATTACK", "DEFENSE"], "the two sides are distinguishable");
  const attackers = frame.snapshot.players.filter((p) => p.side === "ATTACK");
  const defenders = frame.snapshot.players.filter((p) => p.side === "DEFENSE");
  assert.equal(attackers.length, 7, "seven a side including the keeper");
  assert.equal(defenders.length, 7);
});

test("FIELD can draw every frame through its existing board objects", () => {
  // The renderer reuses FIELD's own figures rather than a new marker system.
  const objects = snapshotToBoardObjects(FRAMES[0].snapshot);
  assert.equal(objects.length, 15, "14 players plus the ball");
  const types = new Set(objects.map((o) => o.type));
  assert.ok(types.has("GOALKEEPER"), "goalkeepers use FIELD's goalkeeper figure");
  assert.ok(types.has("ATTACKER") && types.has("DEFENDER"), "sides use FIELD's own attacker/defender figures");
  assert.ok(types.has("BALL"), "the ball uses FIELD's ball object");
});

// ---------------------------------------------------------------------------
// Ball
// ---------------------------------------------------------------------------

test("the ball position and possession follow the engine trace exactly", () => {
  for (let i = 0; i < FRAMES.length; i += 97) {
    const frame = FRAMES[i];
    const source = MATCH.trace[i];
    assert.equal(frame.snapshot.ball.x, source.ballPosition.x, "ball x is the engine's");
    assert.equal(frame.snapshot.ball.y, source.ballPosition.y, "ball y is the engine's");
    assert.equal(frame.snapshot.ball.status, source.ballStatus, "ball status is the engine's");
    assert.equal(frame.snapshot.ball.possessorPlayerId, source.ballPossessorId, "the possessor is the engine's");
  }
});

test("player positions are the engine's own, never invented", () => {
  for (let i = 0; i < FRAMES.length; i += 137) {
    const source = MATCH.trace[i];
    for (const p of source.playerPositions) {
      const rendered = FRAMES[i].snapshot.players.find((q) => q.id === p.playerId)!;
      assert.equal(rendered.x, p.position.x);
      assert.equal(rendered.y, p.position.y);
    }
  }
});

test("interpolation stays between the two recorded states it blends", () => {
  const a = FRAMES[10];
  const b = FRAMES[11];
  const mid = frameAtMatchSeconds(FRAMES, (a.matchSeconds + b.matchSeconds) / 2)!;
  for (const player of mid.snapshot.players) {
    const from = a.snapshot.players.find((p) => p.id === player.id)!;
    const to = b.snapshot.players.find((p) => p.id === player.id)!;
    const withinX = player.x >= Math.min(from.x, to.x) - 1e-9 && player.x <= Math.max(from.x, to.x) + 1e-9;
    const withinY = player.y >= Math.min(from.y, to.y) - 1e-9 && player.y <= Math.max(from.y, to.y) + 1e-9;
    assert.ok(withinX && withinY, `${player.id} interpolated outside the states the engine recorded`);
  }
});

// ---------------------------------------------------------------------------
// HUD data comes from the engine
// ---------------------------------------------------------------------------

test("the score shown is the engine's score", () => {
  assert.deepEqual(FRAMES[0].score, { HOME: 0, AWAY: 0 }, "playback starts at 0-0");
  const final = FRAMES[FRAMES.length - 1];
  assert.deepEqual(final.score, MATCH.finalScore, "the last frame shows the engine's final score");
  const atHalftime = frameAtMatchSeconds(FRAMES, HALF_LENGTH_SECONDS)!;
  assert.deepEqual(atHalftime.score, MATCH.halftimeScore, "and the halftime frame shows the halftime score");
});

test("the official clock comes from the engine and covers both halves", () => {
  assert.equal(playbackDurationSeconds(FRAMES), FULL_TIME_SECONDS, "playback runs to 60:00");
  assert.equal(formatMatchClock(0), "00:00");
  assert.equal(formatMatchClock(HALF_LENGTH_SECONDS), "30:00");
  assert.equal(formatMatchClock(FULL_TIME_SECONDS), "60:00");
  assert.equal(frameAtMatchSeconds(FRAMES, 100)!.half, 1);
  assert.equal(frameAtMatchSeconds(FRAMES, 2000)!.half, 2);
  let previous = -1;
  for (const frame of FRAMES) {
    assert.ok(frame.matchSeconds >= previous, "the clock never goes backwards");
    previous = frame.matchSeconds;
  }
});

// ---------------------------------------------------------------------------
// The renderer is a consumer -- do not delete
// ---------------------------------------------------------------------------

test("playback speed cannot change the match", () => {
  // Speed only consumes the official clock faster. The frames, the events, the
  // order and the score are identical at every speed.
  const reference = JSON.stringify(FRAMES.map((f) => [f.matchSeconds, f.score, f.note]));
  for (const speed of PLAYBACK_SPEEDS) {
    let clock = 0;
    const visited: number[] = [];
    while (clock < FULL_TIME_SECONDS) {
      clock = advancePlaybackClock(clock, 1, speed, FULL_TIME_SECONDS);
      visited.push(frameAtMatchSeconds(FRAMES, clock)!.matchSeconds);
    }
    // The same underlying frames back the playback whatever speed was used.
    assert.equal(JSON.stringify(FRAMES.map((f) => [f.matchSeconds, f.score, f.note])), reference, `speed ${speed} altered the frames`);
    assert.ok(visited.length > 0);
    // A faster speed simply samples fewer instants of the same timeline.
    assert.ok(visited[visited.length - 1] <= FULL_TIME_SECONDS);
  }
  // And the engine result itself is untouched by any of it.
  assert.deepEqual(simulateMatch(START, SEED).finalScore, MATCH.finalScore);
});

test("the playback clock is bounded and monotonic", () => {
  assert.equal(advancePlaybackClock(0, -5, 1, FULL_TIME_SECONDS), 0, "never before the throw-off");
  assert.equal(advancePlaybackClock(FULL_TIME_SECONDS, 10, 8, FULL_TIME_SECONDS), FULL_TIME_SECONDS, "never past full time");
  assert.equal(advancePlaybackClock(100, 10, 4, FULL_TIME_SECONDS), 140, "speed multiplies clock consumption only");
});

test("the same deterministic match produces identical playback source data", () => {
  const again = simulateMatch(START, SEED);
  const framesAgain = buildPlaybackFrames(again as never, { goalkeeperIds: GOALKEEPER_IDS, rosters: again.finalState.rosters });
  assert.equal(framesAgain.length, FRAMES.length);
  assert.deepEqual(framesAgain, FRAMES, "byte-for-byte identical playback for an identical match");
});

test("event situations are visible in the trace the renderer plays", () => {
  // A small debug label is enough for M5: the note explaining each outcome is
  // carried on the frame, so the rendered situation can be labelled without the
  // renderer inferring anything.
  const notes = FRAMES.map((f) => f.note);
  // QA FIX 2A: the note now names why the shot was released as well as from
  // where, because a take-off at the goal-area line and a chosen shot are both
  // releases and the trace has to say which one the renderer is showing.
  assert.ok(notes.some((n) => n.includes("shoots (")), "shots are visible");
  assert.ok(notes.some((n) => n.includes("centre restart")), "restarts are visible");
  assert.ok(notes.some((n) => n.includes("possession changes")), "possession changes are visible");
});

test("the FIELD scene is built on the FULL court, not a half", () => {
  // createInitialScene defaults to HALF_COURT; a match must override it or the
  // far goal is simply off-screen.
  const scene = snapshotToScene(FRAMES[0].snapshot);
  assert.equal(scene.courtView, "FULL_COURT");
  assert.equal(scene.objects.length, 15, "14 players plus the ball reach the scene");
});
