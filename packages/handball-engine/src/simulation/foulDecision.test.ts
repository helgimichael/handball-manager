// MATCH-EXPERIENCE-2.0 M10: fouls, 7 metres and suspensions.
//
// The test that must never be deleted is "a suspended player is really off the
// court": M10's claim is that a numerical disadvantage is a spatial fact, not a
// modifier. A change that kept the man on the court and applied a penalty to
// his team's numbers instead would satisfy most of the rest of this file and
// still be a lie.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFullCourt6v6State } from "../scenarios/fullCourt6v6";
import { simulatePossession } from "./possessionEngine";
import { simulateSequence } from "./sequenceEngine";
import {
  applySuspension,
  createGameFlowState,
  expireSuspensions,
  outfieldCount,
  simulateGameSequence,
  startPendingSuspensions,
  teamOf,
  SUBSTITUTION_LINE,
  type MatchTeamId,
} from "./gameFlow";
import { simulateMatch, HALF_LENGTH_SECONDS } from "./matchRunner";
import { FOUL_LIMITS, clearScoringChance, judgeFoul, sevenMetreMark } from "./foulDecision";
import { MATCH_PACING_FACTOR } from "./matchClock";
import { distanceBetween, type MeterPoint } from "../domain/geometry/coordinates";
import type { Player } from "../domain/handball/player";
import type { HandballState } from "../domain/handball/state";

const TOP = createFullCourt6v6State({ attackingGoalSide: "TOP" });
const BASE = TOP.handball;
const CARRIER_ID = "attack-attack-6-3";

function playerById(state: HandballState, id: string): Player {
  const player = state.players.find((p) => p.id === id);
  if (!player) throw new Error(`no player ${id}`);
  return player;
}

/** The same world with players stood elsewhere, and optionally moving. */
function withPositions(state: HandballState, moves: Record<string, MeterPoint>, velocities: Record<string, MeterPoint> = {}): HandballState {
  return {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      position: moves[p.id] ? { ...moves[p.id] } : p.position,
      velocity: velocities[p.id] ? { ...velocities[p.id] } : p.velocity,
    })),
  };
}

/** Every outfield defender parked far away, so only the geometry under test matters. */
function clearDefenders(state: HandballState, except: string[] = []): HandballState {
  let i = 0;
  return {
    ...state,
    players: state.players.map((p) => {
      if (p.team !== "DEFENSE" || p.kind !== "FIELD_PLAYER" || except.includes(p.id)) return p;
      i += 1;
      return { ...p, position: { x: 2 + i * 2, y: 34 } };
    }),
  };
}

// ---------------------------------------------------------------------------
// 1. Foul classification comes from the situation
// ---------------------------------------------------------------------------

test("a clear scoring chance is measured, not flagged", () => {
  const runner = { x: 10, y: 6 };
  // Alone against the keeper: clear.
  const alone = clearDefenders(withPositions(BASE, { [CARRIER_ID]: runner }));
  const clear = clearScoringChance(alone, playerById(alone, CARRIER_ID), "TOP");
  assert.equal(clear.clear, true, clear.reason);
  assert.equal(clear.coveringDefenderIds.length, 0);

  // One defender goal-side and in the way: not clear.
  const covered = withPositions(alone, { "defense-defence-6-0-3": { x: 10, y: 4 } });
  const notClear = clearScoringChance(covered, playerById(covered, CARRIER_ID), "TOP");
  assert.equal(notClear.clear, false);
  assert.deepEqual(notClear.coveringDefenderIds, ["defense-defence-6-0-3"]);

  // A defender BEHIND him does not cover anything.
  const behind = withPositions(alone, { "defense-defence-6-0-3": { x: 10, y: 9 } });
  assert.equal(clearScoringChance(behind, playerById(behind, CARRIER_ID), "TOP").clear, true, "a chasing defender is not cover");

  // Too far out is not a clear chance however open it is.
  const distant = clearDefenders(withPositions(BASE, { [CARRIER_ID]: { x: 10, y: 16 } }));
  assert.equal(clearScoringChance(distant, playerById(distant, CARRIER_ID), "TOP").clear, false, "16m out is not a clear chance");
});

test("the restart and the punishment are judged independently: all four combinations exist", () => {
  // Seven metres out, central, with a defender on his back. Two independent
  // questions: was a clear chance destroyed (the restart), and was the
  // challenge itself worth two minutes (the punishment)?
  //
  // M13 moved him in from nine metres: calibration measured that a foul nine
  // metres out with a defence behind the ball is not a chance a referee gives
  // a 7 metre for, and tightened clearChanceRangeMeters to 8. The point of this
  // test is that all four combinations exist, so the fixture now stands where a
  // clear chance genuinely is.
  const runner = { x: 10, y: 7 };
  const offender = "defense-defence-6-0-4";
  const held = { x: 0, y: 0 };
  const sprinting = { x: 0, y: 4 };

  const judge = (clear: boolean, velocity: MeterPoint) => {
    const base = withPositions(BASE, { [CARRIER_ID]: runner, [offender]: { x: 10, y: 10 } }, { [offender]: velocity });
    const state = clear ? clearDefenders(base, [offender]) : base;
    return judgeFoul(state, playerById(state, CARRIER_ID), playerById(state, offender), "TOP", 1);
  };

  // (a) ordinary contact, chance covered -> free throw, nothing else.
  const ordinary = judge(false, held);
  assert.equal(ordinary.kind, "ORDINARY");
  assert.equal(ordinary.destroyedClearChance, false);
  assert.equal(ordinary.restart, "FREE_THROW");
  assert.equal(ordinary.punishment, "NO_PERSONAL_PUNISHMENT");

  // (b) late challenge, chance covered -> free throw AND two minutes.
  const hardFoul = judge(false, sprinting);
  assert.equal(hardFoul.kind, "HARD");
  assert.equal(hardFoul.destroyedClearChance, false);
  assert.equal(hardFoul.restart, "FREE_THROW");
  assert.equal(hardFoul.punishment, "TWO_MINUTES");
  assert.ok(hardFoul.reason.includes("arrives late"));

  // (c) ordinary contact, chance destroyed -> 7 metres and NO suspension.
  //     This is the correction: a 7m does not imply two minutes.
  const cleanSevenMetre = judge(true, held);
  assert.equal(cleanSevenMetre.kind, "ORDINARY");
  assert.equal(cleanSevenMetre.destroyedClearChance, true);
  assert.equal(cleanSevenMetre.restart, "SEVEN_METRE");
  assert.equal(cleanSevenMetre.punishment, "NO_PERSONAL_PUNISHMENT");
  assert.equal(cleanSevenMetre.suspend, false, "a 7 metre on its own is not a personal punishment");

  // (d) late challenge, chance destroyed -> 7 metres AND two minutes.
  const both = judge(true, sprinting);
  assert.equal(both.destroyedClearChance, true);
  assert.equal(both.restart, "SEVEN_METRE");
  assert.equal(both.punishment, "TWO_MINUTES");

  // The two axes really are independent: the restart tracks the clear chance,
  // the punishment tracks the challenge, and neither follows the other.
  assert.equal(ordinary.restart, hardFoul.restart, "severity alone does not change the restart");
  assert.notEqual(ordinary.punishment, hardFoul.punishment);
  assert.equal(cleanSevenMetre.punishment, ordinary.punishment, "a destroyed chance alone does not change the punishment");
  assert.notEqual(cleanSevenMetre.restart, ordinary.restart);
});

// M18 NOTE, and the reason the seed ranges below are what they are.
//
// Organized fouls became very rare when contact stopped meaning "a defender is
// inside 1.6m" and started meaning "a defender who can reach and influence the
// carrier is in the duel with him". The old test fired on every step a defender
// happened to stand near the ball, most of which were not contact at all, and
// M10's per-step rate was measured against that. Against real contact the same
// rate yields roughly one organized free throw in two thousand possessions.
//
// These tests are widened rather than weakened: what they assert -- that
// organized play does produce ordinary fouls, and that a foul stops play -- is
// still true and still worth pinning. That it now takes a thousand possessions
// to witness is an M18 finding for calibration to answer, not something to hide
// by lowering the bar to "sometimes, maybe".
const ORGANIZED_FOUL_SEED_LIMIT = 1300;

test("an ordinary foul produces a free throw in a running possession", () => {
  let seen = false;
  for (let seed = 1; seed <= ORGANIZED_FOUL_SEED_LIMIT && !seen; seed += 1) {
    const result = simulatePossession({ seed, initialState: TOP });
    const ordinary = result.fouls.find((f) => f.restart === "FREE_THROW");
    if (!ordinary) continue;
    seen = true;
    assert.equal(result.outcome, "FREE_THROW", "the possession ends in the free throw it was given");
    assert.ok(result.trace.some((t) => t.note.startsWith("FOUL:")), "and the trace says a foul was given");
    assert.equal(result.sevenMetreTaken, false);
  }
  assert.ok(seen, "ordinary fouls do occur in organized play");
});

/**
 * A genuine clear chance, built rather than waited for: the carrier seven
 * metres out and central with every defender cleared away except one, who is on
 * him. `chasing` is the only difference between the two cases -- a defender who
 * arrives at speed is the late challenge, one who is simply there is not.
 */
function destroyedClearChance(chasing: boolean): HandballState {
  const runner = { x: 10, y: 7 };
  const offender = "defense-defence-6-0-4";
  const players = BASE.players.map((player) => {
    if (player.id === CARRIER_ID) return { ...player, position: { ...runner } };
    if (player.team !== "DEFENSE" || player.kind !== "FIELD_PLAYER") return player;
    if (player.id === offender) {
      return { ...player, position: { x: 10, y: 9.4 }, velocity: chasing ? { x: 0, y: 4 } : { x: 0, y: 0 } };
    }
    // Everybody else is out of it -- that is what makes the chance clear.
    return { ...player, position: { x: 1, y: 30 } };
  });
  return { ...BASE, players, ball: { position: { ...runner }, possessorId: CARRIER_ID, status: "POSSESSED", flight: null } };
}

test("a destroyed clear chance really produces a 7 metre in running play", () => {
  // QA FIX 2A replaced the old witness for this.
  //
  // It used to scan six hundred random sequences and rely on one of them
  // happening to produce each combination. That worked only because a breaking
  // carrier ran ILLEGALLY on into the goal area with a defender chasing him
  // there, which is a second of handball that no longer happens -- so the sweep
  // stopped finding 7 metres, and re-pinning it to a wider sweep would have
  // been preserving a witness that the old defect used to fire.
  //
  // The claim worth keeping is that the branch is reachable from real play, not
  // that random play reaches it often. So the chance is CONSTRUCTED and the
  // real possession engine is run on it: same contact model, same M19 episode,
  // same M10 judgement, nothing staged about the outcome.
  const seen = new Map<string, number>();
  for (const chasing of [false, true]) {
    for (let seed = 1; seed <= 200; seed += 1) {
      const result = simulatePossession({ seed, initialState: { ...TOP, handball: destroyedClearChance(chasing) } });
      for (const foul of result.fouls) {
        const key = `${foul.restart}${foul.punishment === "TWO_MINUTES" ? "+2min" : ""}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
    }
  }
  const saw = [...seen].map(([k, v]) => `${k}=${v}`).join(", ");
  for (const combination of ["FREE_THROW", "FREE_THROW+2min", "SEVEN_METRE", "SEVEN_METRE+2min"]) {
    assert.ok((seen.get(combination) ?? 0) > 0, `${combination} is reachable from real play (saw ${saw})`);
  }
});

test("a 7 metre and a suspension remain separate decisions in running play", () => {
  // The defender who is simply there gives 7 metres without two minutes; the
  // one who arrives at speed gives both. Same chance, same engine, and the two
  // axes still move independently once a real possession has run.
  const countOf = (chasing: boolean) => {
    const seen = new Map<string, number>();
    for (let seed = 1; seed <= 200; seed += 1) {
      for (const foul of simulatePossession({ seed, initialState: { ...TOP, handball: destroyedClearChance(chasing) } }).fouls) {
        const key = `${foul.restart}${foul.punishment === "TWO_MINUTES" ? "+2min" : ""}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
    }
    return seen;
  };
  const standing = countOf(false);
  const arriving = countOf(true);
  assert.ok((standing.get("SEVEN_METRE") ?? 0) > 0, "a defender who is merely there concedes 7 metres and no more");
  assert.ok((arriving.get("SEVEN_METRE+2min") ?? 0) > 0, "one who arrives late concedes 7 metres and two minutes");
  assert.ok(
    (arriving.get("SEVEN_METRE+2min") ?? 0) > (standing.get("SEVEN_METRE+2min") ?? 0),
    "the suspension tracks the challenge, not the chance",
  );
});

// ---------------------------------------------------------------------------
// 2. The 7 metre
// ---------------------------------------------------------------------------

test("a destroyed clear chance produces a 7 metre, taken through the M9 contest", () => {
  let taken: ReturnType<typeof simulateSequence> | null = null;
  for (let seed = 1; seed <= 200 && taken === null; seed += 1) {
    const sequence = simulateSequence({ seed, initialState: TOP });
    if (sequence.transition?.sevenMetreTaken || sequence.possession.sevenMetreTaken) taken = sequence;
  }
  assert.ok(taken, "a 7 metre was awarded somewhere in 200 sequences");
  const part = taken!.possession.sevenMetreTaken ? taken!.possession : taken!.transition!;
  const award = part.fouls.find((f) => f.restart === "SEVEN_METRE")!;
  assert.ok(award, "it came from a foul that destroyed a clear chance");
  assert.equal(award.destroyedClearChance, true);

  // It resolves as a shot, through the same M9 machinery.
  assert.ok(["SHOT_GOAL", "SHOT_SAVED", "SHOT_MISSED"].includes(part.outcome), `a 7m ends as a shot (${part.outcome})`);
  assert.ok(part.shotOrigin, "it has a real origin");
  const mark = sevenMetreMark(part.finalState.possession.attackingGoalSide);
  assert.ok(distanceBetween(part.shotOrigin!, mark) < 0.01, "which is the 7m mark");
  // The M9 shot vocabulary is present, so this is not a separate penalty model.
  const shotNote = part.trace.find((t) => /NEAR_|FAR_|CENTRE_POWER|LOB/.test(t.note));
  assert.ok(shotNote, "the taker chose one of the M9 shot intentions");
  assert.ok(part.trace.some((t) => t.note.includes("keeper commits") || t.note.includes("misses")), "against a real goalkeeper read");
  assert.ok(part.trace.some((t) => t.note.includes("on the mark, everybody clear")), "after a legal 7m formation");
});

test("everybody clears out for a 7 metre before it is taken", () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const sequence = simulateSequence({ seed, initialState: TOP });
    const part = sequence.possession.sevenMetreTaken ? sequence.possession : sequence.transition?.sevenMetreTaken ? sequence.transition : null;
    if (!part) continue;
    const goalSide = part.finalState.possession.attackingGoalSide;
    const ready = part.trace.find((t) => t.note.includes("on the mark, everybody clear"));
    assert.ok(ready, "the formation is reached");
    const takerId = ready!.ballPossessorId!;
    const mark = sevenMetreMark(goalSide);
    for (const p of ready!.playerPositions) {
      if (p.playerId === takerId) {
        assert.ok(distanceBetween(p.position, mark) < 0.7, "the taker is on the mark");
        continue;
      }
      if (p.playerId.includes("goalkeeper")) continue;
      assert.ok(
        distanceBetween(p.position, mark) >= FOUL_LIMITS.sevenMetreClearanceMeters - 0.4,
        `${p.playerId} stood ${distanceBetween(p.position, mark).toFixed(2)}m from the mark`,
      );
    }
    return;
  }
  assert.fail("no 7 metre occurred in 200 sequences");
});

// ---------------------------------------------------------------------------
// 3. Suspensions -- do not delete
// ---------------------------------------------------------------------------

test("a suspended player is really off the court, and his team really plays short", () => {
  const flow = createGameFlowState(TOP, 600);
  const offender = "defense-defence-6-0-3";
  const team = teamOf(flow.rosters as Record<MatchTeamId, readonly string[]>, offender)!;
  const before = outfieldCount(flow, team);

  const short = applySuspension(flow, offender, "test");
  assert.equal(outfieldCount(short, team), before - 1, "his team has one outfield player fewer");
  assert.equal(short.match.handball.players.some((p) => p.id === offender), false, "he is not on the court at all");
  assert.equal(short.suspensions.length, 1);
  assert.equal(short.suspensions[0].awardedAtMatchSeconds, 600, "the decision is timestamped");
  assert.equal(short.suspensions[0].startedAtMatchSeconds, null, "but it has not started running yet");
  assert.equal(FOUL_LIMITS.suspensionSeconds, 120, "two minutes");
  // The other side is untouched.
  const other: MatchTeamId = team === "HOME" ? "AWAY" : "HOME";
  assert.equal(outfieldCount(short, other), outfieldCount(flow, other));
});

test("the two minutes do not begin counting until play restarts", () => {
  const offender = "defense-defence-6-0-3";
  // Sent off at 10:00. The ball is dead while everybody walks into position.
  const decided = applySuspension(createGameFlowState(TOP, 600), offender, "test");
  assert.equal(decided.suspensions[0].startedAtMatchSeconds, null);
  assert.equal(decided.suspensions[0].returnsAtMatchSeconds, null, "no return time exists yet");

  // While the ball is dead the clock cannot bring him back, however long the
  // dead ball lasts -- a suspension is served in playing time.
  const stillDead = expireSuspensions({ ...decided, matchSeconds: 600 + FOUL_LIMITS.suspensionSeconds + 60 });
  assert.equal(stillDead.returned.length, 0, "a suspension that never started cannot expire");
  assert.equal(stillDead.flow.match.handball.players.some((p) => p.id === offender), false, "he is still off");

  // Play restarts 20 seconds later: NOW his two minutes begin, from the
  // restart and not from the decision.
  const restarted = startPendingSuspensions(decided, 620);
  assert.equal(restarted.suspensions[0].awardedAtMatchSeconds, 600, "the decision keeps its own timestamp");
  assert.equal(restarted.suspensions[0].startedAtMatchSeconds, 620);
  assert.equal(restarted.suspensions[0].returnsAtMatchSeconds, 620 + FOUL_LIMITS.suspensionSeconds, "counted from the restart");
  assert.notEqual(restarted.suspensions[0].returnsAtMatchSeconds, 600 + FOUL_LIMITS.suspensionSeconds, "not from the whistle");

  // Starting again is idempotent: a suspension already running is not reset by
  // the next restart.
  const later = startPendingSuspensions(restarted, 700);
  assert.equal(later.suspensions[0].startedAtMatchSeconds, 620, "an already-running suspension is not restarted");
});

test("expiry is exactly 120 official playing seconds after the restart", () => {
  const offender = "defense-defence-6-0-3";
  const restartAt = 620;
  const suspended = startPendingSuspensions(applySuspension(createGameFlowState(TOP, 600), offender, "test"), restartAt);
  const team = teamOf(suspended.rosters as Record<MatchTeamId, readonly string[]>, offender)!;

  // One second short of two minutes FROM THE RESTART: still off.
  const early = expireSuspensions({ ...suspended, matchSeconds: restartAt + FOUL_LIMITS.suspensionSeconds - 1 });
  assert.equal(early.returned.length, 0, "119 seconds of playing time is not two minutes");
  assert.equal(early.flow.match.handball.players.some((p) => p.id === offender), false);

  // Two minutes after the DECISION is still not enough, because the dead ball
  // in between was not part of his punishment.
  const atDecisionPlusTwo = expireSuspensions({ ...suspended, matchSeconds: 600 + FOUL_LIMITS.suspensionSeconds });
  assert.equal(atDecisionPlusTwo.returned.length, 0, "two minutes from the whistle is too early");

  // On the second, measured from the restart: back.
  const due = expireSuspensions({ ...suspended, matchSeconds: restartAt + FOUL_LIMITS.suspensionSeconds });
  assert.equal(due.returned.length, 1);
  assert.equal(due.flow.suspensions.length, 0, "the ledger is cleared");
  const back = due.flow.match.handball.players.find((p) => p.id === offender);
  assert.ok(back, "he is on the court again");
  assert.deepEqual(back!.position, SUBSTITUTION_LINE, "entering at the substitution line, not teleported into the defence");
  assert.equal(outfieldCount(due.flow, team), outfieldCount(createGameFlowState(TOP), team), "back to full strength");
  // He is the SAME player, not a reconstruction.
  const original = playerById(TOP.handball, offender);
  assert.equal(back!.id, original.id);
  assert.equal(back!.role, original.role);
  assert.equal(back!.kind, original.kind);
});

test("the goalkeeper is never sent off, because no keeper ever commits these fouls", () => {
  const flow = createGameFlowState(TOP);
  const keeperId = "defense-defence-6-0-goalkeeper";
  const unchanged = applySuspension(flow, keeperId, "test");
  assert.equal(unchanged.suspensions.length, 0, "a goalkeeper suspension is refused");
  assert.ok(unchanged.match.handball.players.some((p) => p.id === keeperId));
});

test("a suspension in a running match removes a player and returns him on the official clock", () => {
  // Re-pinned for M11: substitutions change every trajectory.
  const match = simulateMatch(TOP, 8);
  const sent = match.trace.filter((t) => t.note.includes("is suspended for two minutes"));
  const returned = match.trace.filter((t) => t.note.includes("returns from two minutes"));
  assert.ok(sent.length > 0, "somebody was sent off during the match");
  assert.equal(returned.length, sent.length - match.finalState.suspensions.length, "everybody sent off either came back or was still off at full time");

  // The squad on court genuinely drops below full strength.
  const full = TOP.handball.players.length;
  const sizes = match.trace.map((t) => t.playerPositions.length);
  assert.ok(Math.min(...sizes) < full, `the court really empties (min ${Math.min(...sizes)} of ${full})`);
  assert.ok(Math.max(...sizes) <= full, "and never exceeds a full squad");
  // Nobody is ever duplicated.
  for (const entry of match.trace) {
    const ids = entry.playerPositions.map((p) => p.playerId);
    assert.equal(new Set(ids).size, ids.length, `duplicate player at ${entry.note}`);
  }
});

test("a suspension carries across halftime rather than being served by the interval", () => {
  // Constructed: send a man off just before the break and check he is still
  // off when the second half starts.
  const decided = applySuspension(createGameFlowState(TOP, HALF_LENGTH_SECONDS - 30), "defense-defence-6-0-3", "test");
  const flow = startPendingSuspensions(decided, HALF_LENGTH_SECONDS - 30);
  assert.equal(flow.suspensions[0].returnsAtMatchSeconds, HALF_LENGTH_SECONDS + 90, "his time runs into the second half");
  const atRestart = expireSuspensions({ ...flow, matchSeconds: HALF_LENGTH_SECONDS });
  assert.equal(atRestart.returned.length, 0, "the interval does not serve his suspension");
});

// ---------------------------------------------------------------------------
// 4. Playing short actually works
// ---------------------------------------------------------------------------

test("attack and defence keep working with a man short, without inventing players", () => {
  const offender = "defense-defence-6-0-3";
  const short = applySuspension(createGameFlowState(TOP, 0), offender, "test");
  assert.equal(short.match.handball.players.length, TOP.handball.players.length - 1);

  // A whole possession runs from the short-handed state.
  const result = simulatePossession({ seed: 12, initialState: short.match });
  assert.equal(result.guardTripped, false, "the possession resolves normally");
  for (const entry of result.trace) {
    assert.equal(entry.playerPositions.length, TOP.handball.players.length - 1, "nobody is conjured up to fill the gap");
    assert.equal(entry.playerPositions.some((p) => p.playerId === offender), false, "and the suspended man never reappears");
  }
  // The defence still organises itself around the hole.
  assert.ok(result.trace.some((t) => t.note.startsWith("defence:")), "the 6:0 policy still assigns jobs");
  assert.ok(result.trace.some((t) => t.primaryDefenderId !== null) || result.outcome !== "SHOT_GOAL", "and still takes responsibility");

  // And a multi-possession run is stable short-handed.
  const run = simulateGameSequence(short.match, 5, { maxPossessions: 6 });
  assert.ok(run.segments.length >= 3, "play continues across possessions");
  for (const entry of run.trace) {
    const ids = entry.playerPositions.map((p) => p.playerId);
    assert.equal(new Set(ids).size, ids.length);
  }
});

// ---------------------------------------------------------------------------
// 5. Restart and clock
// ---------------------------------------------------------------------------

test("a foul creates a dead ball that does not flow on as ordinary play", () => {
  for (let seed = 1; seed <= ORGANIZED_FOUL_SEED_LIMIT; seed += 1) {
    const result = simulatePossession({ seed, initialState: TOP });
    if (result.outcome !== "FREE_THROW") continue;
    const foulIndex = result.trace.findIndex((t) => t.note.startsWith("FOUL:"));
    assert.ok(foulIndex >= 0, "the foul is traced");
    // The possession stops there: the phases after it are the dead ball and completion.
    const after = result.trace.slice(foulIndex + 1);
    assert.ok(after.every((t) => t.phase === "DEAD_BALL" || t.phase === "COMPLETE"), "no live play continues past the whistle");
    // ...and the flow gives it back to the same team as a free-throw continuation.
    const run = simulateGameSequence(TOP, seed, { maxPossessions: 4 });
    const index = run.segments.findIndex((s) => s.outcome === "FREE_THROW");
    if (index >= 0 && run.segments[index + 1]) {
      assert.equal(run.segments[index + 1].kind, "FREE_THROW_CONTINUATION");
      assert.equal(run.segments[index + 1].team, run.segments[index].team, "the fouled team restarts");
    }
    return;
  }
  assert.fail(`no free throw occurred in ${ORGANIZED_FOUL_SEED_LIMIT} possessions`);
});

test("the official clock stays canonical, and suspensions are counted on it", () => {
  const match = simulateMatch(TOP, 2026);
  assert.equal(match.phase, "FULL_TIME");
  for (const event of match.events) {
    assert.ok(event.clockSeconds <= HALF_LENGTH_SECONDS + 1e-9, "no event beyond its half");
  }
  // The flow's own ledger clock agrees with the runner's, which is authoritative.
  assert.ok(match.finalState.matchSeconds >= HALF_LENGTH_SECONDS, "the ledger reached the second half");
  assert.ok(MATCH_PACING_FACTOR > 1, "the two clocks are still distinct quantities");
  // Every suspension still on the books at full time was awarded late enough
  // that it could not have expired.
  for (const suspension of match.finalState.suspensions) {
    if (suspension.returnsAtMatchSeconds === null) continue; // awarded at the final whistle, never restarted
    assert.ok(suspension.returnsAtMatchSeconds > match.finalState.matchSeconds, ` would have been back`);
    assert.equal(
      suspension.returnsAtMatchSeconds - suspension.startedAtMatchSeconds!,
      FOUL_LIMITS.suspensionSeconds,
      "two minutes measured from the restart, not the decision",
    );
  }
});

// ---------------------------------------------------------------------------
// 6. Determinism
// ---------------------------------------------------------------------------

test("the rule trace is deterministic for the same state and seed", () => {
  const a = simulateSequence({ seed: 7, initialState: TOP });
  const b = simulateSequence({ seed: 7, initialState: TOP });
  assert.deepEqual(b.possession.fouls, a.possession.fouls, "identical fouls");
  assert.deepEqual(b.transition?.fouls ?? [], a.transition?.fouls ?? []);
  assert.deepEqual(b.trace.map((t) => t.note), a.trace.map((t) => t.note), "identical rule narrative");

  const matchA = simulateMatch(TOP, 7);
  const matchB = simulateMatch(TOP, 7);
  const discipline = (match: typeof matchA) =>
    match.segments.map((s) => s.fouls.map((f) => [f.defenderId, f.kind, f.destroyedClearChance, f.restart, f.punishment]));
  assert.deepEqual(discipline(matchB), discipline(matchA), "identical discipline across a whole match");
  assert.ok(discipline(matchA).some((fouls) => fouls.length > 0), "the match actually contained fouls to compare");
  assert.deepEqual(
    matchB.finalState.suspensions.map((s) => [s.playerId, s.awardedAtMatchSeconds, s.startedAtMatchSeconds, s.returnsAtMatchSeconds]),
    matchA.finalState.suspensions.map((s) => [s.playerId, s.awardedAtMatchSeconds, s.startedAtMatchSeconds, s.returnsAtMatchSeconds]),
  );
});

test("fouls are awarded by the situation, never manufactured at random", () => {
  // Every foul in a match names a real defender who was genuinely close to the
  // carrier, and its award matches what the classifier says about that spot.
  const match = simulateMatch(TOP, 12);
  let checked = 0;
  for (const segment of match.segments) {
    for (const foul of segment.fouls) {
      checked += 1;
      assert.ok(foul.defenderId && foul.victimId, "a foul has an offender and a victim");
      assert.notEqual(foul.defenderId, foul.victimId);
      assert.ok(["ORDINARY", "HARD"].includes(foul.kind));
      assert.equal(foul.restart === "SEVEN_METRE", foul.destroyedClearChance, "the restart follows the chance that was destroyed");
      assert.equal(foul.suspend, foul.kind === "HARD", "the punishment follows the challenge, not the restart");
      assert.ok(foul.position.x >= 0 && foul.position.x <= 20 && foul.position.y >= 0 && foul.position.y <= 40, "and it happened on the court");
    }
  }
  assert.ok(checked > 0, `the match contained fouls (${checked})`);
});
