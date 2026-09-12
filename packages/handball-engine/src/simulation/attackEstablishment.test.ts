// HUMAN QA FIX 2B: an attack must be built before it is played.
//
// A human watched a centre throw-off end in a shot after two and a quarter
// seconds with the line player and both wings still running up from halfway,
// and watched a deliberate 7v6 shoot before the seventh man had joined
// anything.
//
// The test that must never be deleted is "an ordinary possession pays no
// establishment delay". Fix Pass 1 already tried the tempting version of this
// -- every possession settles first -- and it cost 114.8 possessions and 51.7
// goals a match because it steered the carrier every step. Any future change
// that makes establishment generic will pass most of this file and fail that
// one, which is exactly what it is for.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createFullCourt6v6State } from "../scenarios/fullCourt6v6";
import { simulateGameSequence, type GameFlowSegment, type GameFlowTraceEntry, type MatchTeamId } from "./gameFlow";
import { simulateMatch } from "./matchRunner";
import { autonomousCoach, type CoachCommand, type CoachController, type CoachView } from "./coach";
import { readEstablishment, MAX_ESTABLISHING_SECONDS } from "./attackEstablishment";
import { organizedRolePosition } from "./organizedAttack";
import { distanceBetween } from "../domain/geometry/coordinates";
import { goalCentre } from "../domain/match/possession";
import type { HandballState } from "../domain/handball/state";

const TOP = createFullCourt6v6State({ attackingGoalSide: "TOP" });
const BOTTOM = createFullCourt6v6State({ attackingGoalSide: "BOTTOM" });
const SEED = 12;

/** A committed finish, as the trace writes one. */
const COMMITTED = /shoots \(|attacks the .* gap|decides to shoot/;
const ESTABLISHING = /^ESTABLISHING \(/;
const READY = /^READY: /;

type Run = ReturnType<typeof simulateGameSequence>;

/** The trace entries belonging to one segment's possession. */
function entriesOf(run: Run, segment: GameFlowSegment): readonly GameFlowTraceEntry[] {
  return run.trace.filter((e) => e.possessionNumber === segment.possessionNumber && e.possessionTeam === segment.team);
}

function readyAt(segment: GameFlowSegment): number | null | undefined {
  return (segment as { attackReadyAtSeconds?: number | null }).attackReadyAtSeconds;
}

function heldIn(segment: GameFlowSegment): number {
  return (segment as { finishesHeldWhileEstablishing?: number }).finishesHeldWhileEstablishing ?? 0;
}

/** A coach who plays seven out whenever his side has the ball -- the QA instrument. */
function sevenOutCoach(team: MatchTeamId): CoachController {
  const base = autonomousCoach();
  return (view: CoachView): readonly CoachCommand[] => {
    const hasKeeper = view.onCourt.some((p) => p.kind === "GOALKEEPER");
    const inPossession = view.possessionTeam === team;
    if (inPossession && hasKeeper) return [{ kind: "SEVEN_V_SIX", team, active: true, playerId: null, reason: "QA: seven out" }];
    if (!inPossession && !hasKeeper) return [{ kind: "SEVEN_V_SIX", team, active: false, playerId: null, reason: "QA: keeper back" }];
    return base(view);
  };
}

// ---------------------------------------------------------------------------
// 1. What "established" means
// ---------------------------------------------------------------------------

/** Put every attacker where the organized shape says, so the reading is a yes. */
function inOrganizedShape(goalSide: "TOP" | "BOTTOM"): HandballState {
  const base = (goalSide === "TOP" ? TOP : BOTTOM).handball;
  return {
    ...base,
    players: base.players.map((p) => {
      if (p.team !== "ATTACK" || p.kind !== "FIELD_PLAYER") return p;
      const spot = organizedRolePosition(p.role, goalSide);
      return spot ? { ...p, position: { ...spot } } : p;
    }),
  };
}

/** And in their own half, which is where a throw-off leaves them. */
function inTheirOwnHalf(goalSide: "TOP" | "BOTTOM"): HandballState {
  const base = (goalSide === "TOP" ? TOP : BOTTOM).handball;
  const ownHalfY = goalSide === "TOP" ? 24 : 16;
  return {
    ...base,
    players: base.players.map((p, i) =>
      p.team === "ATTACK" && p.kind === "FIELD_PLAYER" ? { ...p, position: { x: 3 + i * 2.5, y: ownHalfY } } : p,
    ),
  };
}

test("an attack in organized shape is established", () => {
  for (const side of ["TOP", "BOTTOM"] as const) {
    const reading = readEstablishment(inOrganizedShape(side), side, "CENTRE_RESTART");
    assert.ok(reading.ready, `${side}: ${reading.missing.join("; ")}`);
  }
});

test("an attack still in its own half is not established", () => {
  for (const side of ["TOP", "BOTTOM"] as const) {
    const reading = readEstablishment(inTheirOwnHalf(side), side, "CENTRE_RESTART");
    assert.equal(reading.ready, false);
    assert.ok(reading.missing.some((m) => m.includes("travelling")), `it says who is still coming: ${reading.missing.join("; ")}`);
  }
});

test("a six-man attack in shape is still not a seven-out attack", () => {
  // The distinction the QA gate is about: seven outfield players existing is
  // not the same fact as the seventh of them having joined the attack.
  const shaped = inOrganizedShape("TOP");
  assert.ok(readEstablishment(shaped, "TOP", "CENTRE_RESTART").ready);
  const asSevenOut = readEstablishment(shaped, "TOP", "SEVENTH_ATTACKER");
  assert.equal(asSevenOut.ready, false);
  assert.ok(asSevenOut.missing.some((m) => m.includes("seventh attacker")));
});

test("the seventh attacker counts once he reaches second-line depth", () => {
  const base = inOrganizedShape("TOP");
  const spare = base.players.find((p) => p.team === "ATTACK" && p.kind === "FIELD_PLAYER" && p.role === "LEFT_WING")!;
  const withExtra = (y: number): HandballState => ({
    ...base,
    players: base.players.map((p) => (p.id === spare.id ? { ...p, role: "EXTRA_ATTACKER" as const, position: { x: 12, y } } : p)),
  });
  assert.equal(readEstablishment(withExtra(20), "TOP", "SEVENTH_ATTACKER").ready, false, "still on his way");
  assert.equal(readEstablishment(withExtra(9), "TOP", "SEVENTH_ATTACKER").ready, true, "arrived in the second line");
});

test("both ends of the court read the same", () => {
  for (const trigger of ["CENTRE_RESTART", "SEVENTH_ATTACKER"] as const) {
    for (const shape of [inOrganizedShape, inTheirOwnHalf]) {
      assert.equal(
        readEstablishment(shape("TOP"), "TOP", trigger).ready,
        readEstablishment(shape("BOTTOM"), "BOTTOM", trigger).ready,
        `${trigger} reads the same at either goal`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// 2. The throw-off lifecycle
// ---------------------------------------------------------------------------

const RESTART_RUN = simulateGameSequence(TOP, SEED, { maxPossessions: 30 });
const RESTARTS = RESTART_RUN.segments.filter((s) => s.kind === "CENTRE_RESTART");

test("a centre restart really happens in this match", () => {
  assert.ok(RESTARTS.length > 0, "seed 12 concedes and restarts");
});

test("a restart attack enters ESTABLISHING and reaches READY in finite time", () => {
  let reached = 0;
  for (const segment of RESTARTS) {
    const notes = entriesOf(RESTART_RUN, segment).map((e) => e.note);
    assert.ok(notes.some((n) => ESTABLISHING.test(n)), "it announces that it is building an attack");
    const ready = readyAt(segment);
    if (ready === null || ready === undefined) continue; // ended before the attack formed
    reached += 1;
    assert.ok(ready > 0, "a restart does not begin established");
    // The bound is inclusive: an attack that runs out of time is declared READY
    // exactly at it, and a step of floating-point accumulation can land a hair
    // the far side.
    assert.ok(ready <= MAX_ESTABLISHING_SECONDS + 1e-6, `and it is bounded (${ready.toFixed(2)}s)`);
    assert.ok(notes.some((n) => READY.test(n)), "and it says so when it is");
  }
  assert.ok(reached > 0, "restart attacks do get built");
});

test("no committed shot or drive is taken before the attack is established", () => {
  // THE ONE THE HUMAN REPORTED. Not "no shot ever" -- circulation, passing and
  // playing the pivot all continue while the attack forms, and a genuine clear
  // chance is still taken. What may not happen is an ordinary committed finish
  // against a set defence by a team that has not formed up yet.
  let checked = 0;
  const offences: string[] = [];
  for (const segment of RESTARTS) {
    const entries = entriesOf(RESTART_RUN, segment);
    const readyIndex = entries.findIndex((e) => READY.test(e.note));
    if (readyIndex < 0) continue;
    checked += 1;
    for (const entry of entries.slice(0, readyIndex)) {
      if (COMMITTED.test(entry.note)) offences.push(`#${segment.possessionNumber}: ${entry.note.slice(0, 60)}`);
    }
  }
  assert.ok(checked > 5, `a real sample of restarts (${checked})`);
  assert.deepEqual(offences.slice(0, 5), [], `${offences.length} committed finishes before the attack existed`);
});

test("the attack does not stand still while it builds", () => {
  // Establishment is not passivity. The ball has to be moving.
  const segment = RESTARTS.find((s) => (readyAt(s) ?? 0) > 1)!;
  const entries = entriesOf(RESTART_RUN, segment);
  const readyIndex = entries.findIndex((e) => READY.test(e.note));
  const before = entries.slice(0, readyIndex).map((e) => e.note);
  assert.ok(before.some((n) => /passes to|plays the pivot/.test(n)), "the ball is circulated while the shape forms");
});

test("the line and the backcourt actually travel to their roles", () => {
  const segment = RESTARTS.find((s) => (readyAt(s) ?? 0) > 1)!;
  const entries = entriesOf(RESTART_RUN, segment);
  const start = entries[0];
  const end = entries[entries.findIndex((e) => READY.test(e.note))];
  const goal = goalCentre(segment.attackingGoalSide);
  const roster = new Set(RESTART_RUN.finalState.rosters[segment.team]);
  const keepers = new Set(RESTART_RUN.finalState.goalkeeperIds);
  const distances = (entry: GameFlowTraceEntry) =>
    entry.playerPositions
      .filter((p) => roster.has(p.playerId) && !keepers.has(p.playerId))
      .map((p) => distanceBetween(p.position, goal));
  const before = distances(start);
  const after = distances(end);
  assert.ok(before.length > 0 && after.length > 0);
  assert.ok(Math.max(...after) < Math.max(...before), "the last man up has closed on the goal");
  assert.ok(Math.min(...after) < Math.min(...before), "and so has the man nearest it");
});

test("once READY, M6 finishes attacks normally again", () => {
  const finished = RESTARTS.some((segment) => {
    const entries = entriesOf(RESTART_RUN, segment);
    const readyIndex = entries.findIndex((e) => READY.test(e.note));
    return readyIndex >= 0 && entries.slice(readyIndex).some((e) => COMMITTED.test(e.note));
  });
  assert.ok(finished, "an established restart attack takes its chances like any other");
});

// ---------------------------------------------------------------------------
// 3. No generic slowdown
// ---------------------------------------------------------------------------

test("an ordinary possession pays no establishment delay", () => {
  // THE ONE THAT MUST NOT BE DELETED.
  const ordinary = RESTART_RUN.segments.filter((s) => s.kind === "ORGANIZED" || s.kind === "FREE_THROW_CONTINUATION");
  assert.ok(ordinary.length > 0);
  for (const segment of ordinary) {
    assert.equal(readyAt(segment), 0, `${segment.kind} #${segment.possessionNumber} begins established`);
    assert.equal(heldIn(segment), 0, "and nothing is held back in it");
  }
  // And the note, for the segments that own their possession number outright.
  // A free-throw continuation deliberately shares one with the attack it
  // continues, so its trace legitimately contains that attack's entries.
  const owned = ordinary.filter(
    (s) => RESTART_RUN.segments.filter((other) => other.possessionNumber === s.possessionNumber).length === 1,
  );
  assert.ok(owned.length > 0, "some ordinary possessions stand alone");
  for (const segment of owned) {
    assert.ok(
      !entriesOf(RESTART_RUN, segment).some((e) => ESTABLISHING.test(e.note)),
      `${segment.kind} #${segment.possessionNumber} never announces that it is building an attack`,
    );
  }
});

test("establishment never steers the man on the ball", () => {
  // Structural, and aimed squarely at the regression it replaces. Fix Pass 1
  // re-issued shape orders to everybody every step, the carrier included, and
  // that is what destroyed a fifth of every match's possessions. The shape
  // orders here must exclude the carrier and must never be forced.
  const source = readFileSync("src/simulation/possessionEngine.ts", "utf8");
  assert.ok(
    source.includes("actions.push(...shapeActions(handball, carrier?.id ?? null, false));"),
    "establishment shapes everybody EXCEPT the carrier, and only when they are not already going there",
  );
});

test("a transition has no attacking structure to establish", () => {
  const transitions = RESTART_RUN.segments.filter((s) => s.kind === "TRANSITION");
  assert.ok(transitions.length > 0);
  for (const segment of transitions) {
    assert.equal(readyAt(segment), undefined, "a break is not an organized attack and is not asked to be one");
  }
});

// ---------------------------------------------------------------------------
// 4. The 7v6 lifecycle
// ---------------------------------------------------------------------------

// A real match rather than a bare sequence: 7v6 needs somebody on the bench to
// send on, and only a match squad has one.
const SEVEN_MATCH = simulateMatch(TOP, SEED, { coaches: { HOME: sevenOutCoach("HOME"), AWAY: autonomousCoach() } });
const SEVEN_SEGMENTS = SEVEN_MATCH.segments.filter((s) => s.team === "HOME" && s.kind !== "TRANSITION");
const sevenEntriesOf = (segment: GameFlowSegment) =>
  SEVEN_MATCH.trace.filter((e) => e.possessionNumber === segment.possessionNumber && e.possessionTeam === segment.team);

test("the keeper leaves, and a seventh outfield player comes on for him", () => {
  // `kind` on a substitution record is the OUTGOING player's, so the keeper
  // going off to make room is the GOALKEEPER record and the swap back is the
  // FIELD_PLAYER one.
  const exchanges = SEVEN_MATCH.segments.flatMap((s) => s.substitutions).filter((s) => s.team === "HOME" && s.reason.startsWith("COACH:QA"));
  assert.ok(exchanges.some((s) => s.kind === "GOALKEEPER"), "the goalkeeper goes off to make room");
  assert.ok(exchanges.some((s) => s.kind === "FIELD_PLAYER"), "and comes back on for an outfield player afterwards");
  assert.ok(
    SEVEN_MATCH.trace.some((e) => /ESTABLISHING \(SEVENTH_ATTACKER\)/.test(e.note)),
    "and the attack he joins knows it has to be rebuilt around him",
  );
});

test("seven outfield players on court is not the same fact as a seven-out attack", () => {
  // The QA complaint, stated as a test: the population is legal well before the
  // structure exists, and the attack must not treat the one as the other.
  const homeIds = new Set(SEVEN_MATCH.finalState.rosters.HOME);
  const keepers = new Set(SEVEN_MATCH.finalState.goalkeeperIds);
  let sawSevenBeforeReady = false;
  for (const segment of SEVEN_SEGMENTS) {
    const entries = sevenEntriesOf(segment);
    const readyIndex = entries.findIndex((e) => READY.test(e.note));
    if (readyIndex <= 0) continue;
    for (const entry of entries.slice(0, readyIndex)) {
      const outfield = entry.playerPositions.filter((p) => homeIds.has(p.playerId) && !keepers.has(p.playerId));
      if (outfield.length >= 7) sawSevenBeforeReady = true;
    }
  }
  assert.ok(sawSevenBeforeReady, "there really are frames with seven out and the attack not yet established");
});

test("the seven-out attack is READY only once the extra man has joined it", () => {
  const built = SEVEN_SEGMENTS.filter((s) => (readyAt(s) ?? 0) > 0);
  assert.ok(built.length > 0, "HOME builds seven-out attacks");
  let proven = 0;
  for (const segment of built) {
    const entries = sevenEntriesOf(segment);
    const readyEntry = entries.find((e) => READY.test(e.note));
    const establishingEntry = entries.find((e) => ESTABLISHING.test(e.note));
    if (!readyEntry || !establishingEntry || !/SEVENTH_ATTACKER/.test(establishingEntry.note)) continue;
    if (!/established/.test(readyEntry.note)) continue; // played what it had; not this proof's case
    proven += 1;
    const goal = goalCentre(segment.attackingGoalSide);
    const extra = SEVEN_MATCH.finalState.match.handball.players.find((p) => p.role === "EXTRA_ATTACKER");
    if (!extra) continue;
    const atReady = readyEntry.playerPositions.find((p) => p.playerId === extra.id);
    const atStart = establishingEntry.playerPositions.find((p) => p.playerId === extra.id);
    if (!atReady || !atStart) continue;
    assert.ok(
      distanceBetween(atReady.position, goal) < distanceBetween(atStart.position, goal),
      "he has actually travelled towards the attack, not been declared to have",
    );
  }
  assert.ok(proven > 0, "at least one seven-out attack was built rather than timed out");
});

test("a seven-out attack takes longer to build than an ordinary restart", () => {
  // It has one more man to wait for, and he starts from the substitution line.
  const mean = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
  const sevenOut = SEVEN_SEGMENTS
    .filter((s) => sevenEntriesOf(s).some((e) => /SEVENTH_ATTACKER/.test(e.note)))
    .map(readyAt)
    .filter((v): v is number => typeof v === "number" && v > 0);
  const restarts = RESTARTS.map(readyAt).filter((v): v is number => typeof v === "number" && v > 0);
  assert.ok(sevenOut.length > 0 && restarts.length > 0);
  assert.ok(mean(sevenOut) > mean(restarts), `${mean(sevenOut).toFixed(2)}s vs ${mean(restarts).toFixed(2)}s`);
});

// ---------------------------------------------------------------------------
// 5. Determinism and symmetry
// ---------------------------------------------------------------------------

test("the same match builds its attacks the same way every time", () => {
  const lifecycle = (run: Run) =>
    run.segments.map((s) => `${s.possessionNumber}:${s.kind}:${readyAt(s)}:${heldIn(s)}`);
  assert.deepEqual(lifecycle(simulateGameSequence(TOP, SEED, { maxPossessions: 20 })), lifecycle(simulateGameSequence(TOP, SEED, { maxPossessions: 20 })));
});

test("neither end of the court establishes faster than the other", () => {
  const readiness = (start: typeof TOP) =>
    simulateGameSequence(start, SEED, { maxPossessions: 30 })
      .segments.filter((s) => s.kind === "CENTRE_RESTART")
      .map(readyAt)
      .filter((v): v is number => typeof v === "number" && v > 0);
  const top = readiness(TOP);
  const bottom = readiness(BOTTOM);
  assert.ok(top.length > 0 && bottom.length > 0);
  const mean = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  assert.ok(
    Math.abs(mean(top) - mean(bottom)) < 2,
    `restarts build at the same speed at either goal (${mean(top).toFixed(2)}s vs ${mean(bottom).toFixed(2)}s)`,
  );
});
