// MATCH-EXPERIENCE-2.0 M15: canonical match events.
//
// The test that must never be deleted is "no canonical fact is read from a
// display string". The whole point of this layer is that it is DATA: the moment
// a consumer starts parsing "M9 shoots but the goalkeeper saves", the engine has
// two sources of truth and one of them is prose. A change that let a note back
// into the derivation would satisfy most of the rest of this file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createFullCourt6v6State } from "../scenarios/fullCourt6v6";
import { simulateMatch, type MatchResult } from "./matchRunner";
import { autonomousCoach } from "./coach";
import { buildCanonicalMatchEvents, eventsOfType, goalsFromEvents, type CanonicalMatchEvent } from "./canonicalEvents";

const TOP = createFullCourt6v6State({ attackingGoalSide: "TOP" });

function play(seed: number): { match: MatchResult; events: CanonicalMatchEvent[] } {
  const match = simulateMatch(TOP, seed, { coaches: { HOME: autonomousCoach(), AWAY: autonomousCoach() } });
  return { match, events: buildCanonicalMatchEvents(match) };
}

// ---------------------------------------------------------------------------
// 1. The stream describes the match it came from
// ---------------------------------------------------------------------------

test("the goal events are the final score", () => {
  for (const seed of [12, 7, 33]) {
    const { match, events } = play(seed);
    const goals = goalsFromEvents(events);
    assert.equal(goals.HOME, match.finalScore.HOME, `seed ${seed}: home goals`);
    assert.equal(goals.AWAY, match.finalScore.AWAY, `seed ${seed}: away goals`);
    assert.equal(eventsOfType(events, "GOAL").length, match.finalScore.HOME + match.finalScore.AWAY);

    // The last GOAL event's own score snapshot is the final score.
    const lastGoal = [...eventsOfType(events, "GOAL")].pop();
    if (lastGoal) assert.deepEqual(lastGoal.score, match.finalScore, "the running score ends where the match ended");
    const fullTime = eventsOfType(events, "FULL_TIME");
    assert.equal(fullTime.length, 1, "one full time");
    assert.deepEqual(fullTime[0].finalScore, match.finalScore);
  }
});

test("shot outcomes reconcile with the shots, goals and saves the match recorded", () => {
  const { match, events } = play(12);
  const shots = eventsOfType(events, "SHOT");

  // Every shot outcome the engine produced has exactly one SHOT event.
  const shotSegments = match.segments.filter((s) => s.outcome === "SHOT_GOAL" || s.outcome === "SHOT_SAVED" || s.outcome === "SHOT_MISSED");
  assert.equal(shots.length, shotSegments.length, "one SHOT event per shot the match took");

  // The four outcomes partition the shots, and each maps back to the engine's own.
  const byOutcome = (o: string) => shots.filter((s) => s.outcome === o).length;
  assert.equal(byOutcome("GOAL") + byOutcome("SAVED") + byOutcome("MISSED") + byOutcome("BLOCKED"), shots.length);
  assert.equal(byOutcome("GOAL"), match.segments.filter((s) => s.outcome === "SHOT_GOAL").length);
  assert.equal(byOutcome("SAVED"), match.segments.filter((s) => s.outcome === "SHOT_SAVED").length);
  assert.equal(byOutcome("MISSED") + byOutcome("BLOCKED"), match.segments.filter((s) => s.outcome === "SHOT_MISSED").length);

  // A GOAL event exists for every SHOT whose outcome was a goal, and for no other.
  assert.equal(eventsOfType(events, "GOAL").length, byOutcome("GOAL"));

  // A BLOCKED shot names the defender who blocked it; nothing else does.
  for (const shot of shots) {
    if (shot.outcome === "BLOCKED") assert.ok(shot.blockedByDefenderId, "a blocked shot knows its blocker");
    else assert.equal(shot.blockedByDefenderId, null, `${shot.outcome} shots have no blocker`);
  }
  assert.ok(byOutcome("BLOCKED") > 0, "blocks genuinely happen in a match");

  // A saved shot names the goalkeeper who saved it.
  for (const shot of shots.filter((s) => s.outcome === "SAVED")) {
    assert.ok(shot.goalkeeperId, "a save has a goalkeeper");
    assert.ok(match.finalState.goalkeeperIds.includes(shot.goalkeeperId!), "and he is a real goalkeeper");
  }
});

test("rule events keep the referee's own facts", () => {
  const { match, events } = play(12);
  const fouls = eventsOfType(events, "FOUL");
  const engineFouls = match.segments.flatMap((s) => s.fouls);
  assert.equal(fouls.length, engineFouls.length, "one FOUL event per foul given");
  for (const foul of fouls) {
    assert.ok(foul.playerId && foul.victimPlayerId, "an offender and a victim");
    assert.notEqual(foul.playerId, foul.victimPlayerId);
    assert.ok(["ORDINARY", "HARD"].includes(foul.foulKind));
    assert.ok(["FREE_THROW", "SEVEN_METRE"].includes(foul.restart));
    assert.ok(["NO_PERSONAL_PUNISHMENT", "TWO_MINUTES"].includes(foul.punishment));
    assert.ok(Number.isFinite(foul.location.x) && Number.isFinite(foul.location.y), "and a real place on the court");
  }

  // A suspension exists for exactly the fouls that carried one, on the
  // offender's own side.
  const suspensions = eventsOfType(events, "SUSPENSION");
  assert.equal(suspensions.length, engineFouls.filter((f) => f.suspend).length);
  for (const suspension of suspensions) {
    assert.equal(suspension.seconds, 120);
    const foul = fouls.find((f) => f.playerId === suspension.playerId && f.simulationTime === suspension.simulationTime);
    assert.ok(foul, "every suspension sits on a foul");
    assert.equal(suspension.teamId, foul!.teamId, "and belongs to the same side as the offender");
  }

  // A 7 metre is marked on the shot it produced, and there is never a 7 metre
  // shot without a 7 metre foul to have awarded it.
  const sevenMetreShots = eventsOfType(events, "SHOT").filter((s) => s.sevenMetre);
  assert.ok(sevenMetreShots.length > 0, "the match contained 7 metre throws");
  assert.ok(sevenMetreShots.length <= fouls.filter((f) => f.restart === "SEVEN_METRE").length);
});

test("substitution, timeout and coaching events keep their real timing", () => {
  const { match, events } = play(12);

  const completed = eventsOfType(events, "SUBSTITUTION_COMPLETED");
  const engineSubs = match.segments.flatMap((s) => s.substitutions);
  assert.equal(completed.length, engineSubs.length, "one event per completed substitution");
  for (const event of completed) {
    const record = engineSubs.find((s) => s.outgoingPlayerId === event.outgoingPlayerId && s.incomingPlayerId === event.incomingPlayerId && s.atSimulationTime === event.simulationTime);
    assert.ok(record, "each one is a substitution the match actually made");
    assert.equal(event.matchSeconds, record!.atMatchSeconds, "at the second the exchange happened");
    assert.equal(event.requestedAtMatchSeconds, record!.requestedAtMatchSeconds, "and remembering when it was asked for");
    assert.ok(event.requestedAtMatchSeconds <= event.matchSeconds, "a change completes after it is requested");
  }

  const requested = eventsOfType(events, "SUBSTITUTION_REQUESTED");
  for (const event of requested) {
    assert.ok(event.outgoingPlayerId && event.incomingPlayerId, "the request names both players as ids");
  }

  const started = eventsOfType(events, "TIMEOUT_STARTED");
  const ended = eventsOfType(events, "TIMEOUT_ENDED");
  assert.ok(started.length > 0, "the match contained timeouts");
  assert.equal(started.length, ended.length, "every timeout ends");
  for (const timeout of started) {
    const record = match.finalState.timeouts.find((t) => t.team === timeout.teamId && t.atMatchSeconds === timeout.matchSeconds);
    assert.ok(record, "each is a timeout the match granted, at the second it granted it");
  }

  // An instruction change carries the dials as DATA.
  const instructions = eventsOfType(events, "INSTRUCTION_CHANGED");
  assert.ok(instructions.length > 0, "the coaches changed instructions");
  for (const event of instructions) {
    assert.ok(["ATTACK", "DEFENCE"].includes(event.scope));
    assert.ok(event.changes.length > 0, "and it says which dials moved");
    for (const change of event.changes) {
      assert.equal(typeof change.key, "string");
      assert.equal(typeof change.from, "number");
      assert.equal(typeof change.to, "number");
      assert.notEqual(change.from, change.to, "a recorded change is a change");
    }
  }
});

test("play events describe what the carrier actually decided", () => {
  const { match, events } = play(12);
  const passes = eventsOfType(events, "PASS");
  const drives = eventsOfType(events, "DRIVE");
  assert.ok(passes.length > 50, `the match contained passes (${passes.length})`);
  assert.ok(drives.length > 10, `and drives (${drives.length})`);

  const onCourt = new Set(match.trace.flatMap((t) => t.playerPositions.map((p) => p.playerId)));
  for (const pass of passes) {
    assert.ok(onCourt.has(pass.playerId), "a pass is made by somebody who played");
    if (pass.targetPlayerId) assert.ok(onCourt.has(pass.targetPlayerId), "to somebody who played");
    assert.ok(["CIRCULATION", "PIVOT_FEED", "RESET"].includes(pass.intent));
    assert.ok(Number.isFinite(pass.location.x), "from a real place");
  }
  assert.ok(passes.some((p) => p.intent === "PIVOT_FEED"), "a feed to the pivot is distinguishable from ordinary circulation");
  for (const drive of drives) {
    assert.ok(onCourt.has(drive.playerId));
    assert.ok(Number.isFinite(drive.location.x) && Number.isFinite(drive.location.y));
  }
});

// ---------------------------------------------------------------------------
// 2. Chronology and determinism
// ---------------------------------------------------------------------------

test("the stream is in the simulation's own chronological order", () => {
  const { events } = play(12);
  assert.ok(events.length > 200, `a real stream (${events.length} events)`);
  for (let i = 1; i < events.length; i += 1) {
    const previous = events[i - 1];
    const current = events[i];
    assert.equal(current.sequence, i, "sequence is the resolved order");
    assert.ok(current.half >= previous.half, "halves never go backwards");
    if (current.half === previous.half) {
      assert.ok(current.simulationTime >= previous.simulationTime, `event ${i} does not precede the one before it`);
    }
  }
  // The match's own shape brackets everything.
  assert.equal(events[0].type, "HALF_START");
  assert.equal(events[events.length - 1].type, "FULL_TIME");
  assert.equal(eventsOfType(events, "HALF_START").length, 2);
  assert.equal(eventsOfType(events, "HALF_END").length, 2);

  // A goal is recorded after the shot that produced it.
  for (const goal of eventsOfType(events, "GOAL")) {
    const shot = events.find((e) => e.type === "SHOT" && e.sequence < goal.sequence && e.matchSeconds === goal.matchSeconds);
    assert.ok(shot, "every goal follows its own shot");
  }
});

test("the same match always produces the same events", () => {
  const a = play(7);
  const b = play(7);
  assert.deepEqual(b.events, a.events, "identical streams from an identical match");

  // Building twice from the SAME match result is also identical -- the
  // projection holds no state of its own.
  assert.deepEqual(buildCanonicalMatchEvents(a.match), a.events);

  // A different match is a different stream.
  const other = play(33);
  assert.notDeepEqual(other.events, a.events);
});

// ---------------------------------------------------------------------------
// 3. DO NOT DELETE: this layer is data, not prose
// ---------------------------------------------------------------------------

test("no canonical fact is read from a display string", () => {
  const { match, events } = play(12);

  // Not one event carries the engine's human-readable note, under any key.
  const notes = new Set(match.trace.map((t) => t.note).filter((n) => n.length > 0));
  const serialised = JSON.stringify(events);
  for (const note of notes) {
    if (note.length < 12) continue;
    assert.equal(serialised.includes(note), false, `the note "${note.slice(0, 40)}..." is not in the event stream`);
  }

  // And the module that builds them does not read one either. The derivation is
  // the thing under test here, so this looks at the source itself.
  const source = readFileSync("src/simulation/canonicalEvents.ts", "utf8");
  assert.equal(/\.note\b/.test(source), false, "canonicalEvents.ts never touches a trace note");
  assert.equal(/\.detail\b/.test(source), false, "nor an intervention's readable detail");
  assert.equal(/\.reason\b/.test(source), false, "nor a foul's readable reason");

  // Every string-valued field in the stream is an identifier or an enum, never
  // a sentence: no event field contains a space.
  for (const event of events) {
    for (const [key, value] of Object.entries(event)) {
      if (typeof value !== "string") continue;
      assert.equal(value.includes(" "), false, `${event.type}.${key} = "${value}" is an identifier, not prose`);
    }
  }
});

test("the events never decide anything -- they only describe", () => {
  // Building the stream cannot change the match: the match is already over, and
  // the projection is pure. Playing the same seed with and without ever asking
  // for events gives the identical result.
  const withEvents = play(12);
  const without = simulateMatch(TOP, 12, { coaches: { HOME: autonomousCoach(), AWAY: autonomousCoach() } });
  assert.deepEqual(without.finalScore, withEvents.match.finalScore);
  assert.equal(without.trace.length, withEvents.match.trace.length);
  assert.equal(without.totalSegments, withEvents.match.totalSegments);
});
