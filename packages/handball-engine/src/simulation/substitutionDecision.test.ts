// MATCH-EXPERIENCE-2.0 M11: substitutions and bench state.
//
// The test that must never be deleted is "a suspension cannot be bypassed by
// substitution": the whole reason a bench is dangerous is that it offers a way
// to quietly undo a punishment. A change that let a team replace a suspended
// player, or bring one on without sending anybody off, would satisfy most of
// the rest of this file and make two minutes mean nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFullCourt6v6State } from "../scenarios/fullCourt6v6";
import { BENCH_OUTFIELD_PER_TEAM, SUBSTITUTION_AREA, buildMatchBench } from "../scenarios/matchSquad";
import { simulatePossession } from "./possessionEngine";
import { simulateSequence } from "./sequenceEngine";
import { simulateMatch } from "./matchRunner";
import { createPossessionRng } from "./possessionRng";
import { decideSubstitutions } from "./substitutionDecision";
import {
  applySuspension,
  createGameFlowState,
  expireSuspensions,
  outfieldEntitlement,
  simulateGameSequence,
  startPendingSuspensions,
  requestSubstitution,
  settlePendingSubstitutions,
  teamOf,
  type GameFlowState,
  type MatchTeamId,
} from "./gameFlow";
import { FOUL_LIMITS } from "./foulDecision";
import { MATCH_PACING_FACTOR } from "./matchClock";
import { SUBSTITUTION_ARRIVAL_METERS, hasReachedSubstitutionArea, isLeavingCourt, stepWithSubstitutions } from "./substitutionExit";
import { SIMULATION_DT_SECONDS } from "./fixedStep";
import { distanceBetween } from "../domain/geometry/coordinates";
import type { Player } from "../domain/handball/player";

const TOP = createFullCourt6v6State({ attackingGoalSide: "TOP" });
const BENCH = buildMatchBench(TOP);

function flowWithBench(matchSeconds = 0): GameFlowState {
  return createGameFlowState(TOP, matchSeconds, BENCH);
}

function onCourt(flow: GameFlowState, team: MatchTeamId): readonly Player[] {
  return flow.match.handball.players.filter((p) => teamOf(flow.rosters as Record<MatchTeamId, readonly string[]>, p.id) === team);
}

/**
 * Runs the world forward with the ordinary shared step until nobody is leaving
 * any more -- which happens because the exchange COMPLETES mid-step, not
 * because anything here settles it.
 */
function walkExitingPlayersOff(flow: GameFlowState, maxSteps = 400): { flow: GameFlowState; steps: number } {
  let handball = flow.match.handball;
  let steps = 0;
  while (steps < maxSteps && handball.players.some(isLeavingCourt)) {
    handball = stepWithSubstitutions(handball, [], SIMULATION_DT_SECONDS);
    steps += 1;
  }
  return { flow: { ...flow, match: { ...flow.match, handball } }, steps };
}

/** The whole lifecycle, driven to completion: REQUESTED -> EXITING -> COMPLETE. */
function forceSub(flow: GameFlowState, team: MatchTeamId, outgoingPlayerId: string, incomingPlayerId: string): GameFlowState {
  const requested = requestSubstitution(flow, { team, outgoingPlayerId, incomingPlayerId, reason: "test" });
  assert.ok(requested.ok, `substitution refused: ${requested.ok ? "" : requested.reason}`);
  const walked = walkExitingPlayersOff(requested.flow);
  const settled = settlePendingSubstitutions(walked.flow);
  assert.equal(settled.completed.length, 1, "the change completes once he is at the line");
  return settled.flow;
}

// ---------------------------------------------------------------------------
// 1. Squad and bench are different things
// ---------------------------------------------------------------------------

test("a match squad is bigger than the seven on court, and the bench is off it", () => {
  const flow = flowWithBench();
  assert.equal(flow.match.handball.players.length, 14, "fourteen players are on the court");
  assert.equal(flow.bench.HOME.length, BENCH_OUTFIELD_PER_TEAM + 1, "with outfield substitutes and a reserve keeper behind them");
  assert.equal(flow.bench.AWAY.length, BENCH_OUTFIELD_PER_TEAM + 1);
  // The squad -- not the line-up -- is what the rosters describe.
  assert.equal(flow.rosters.HOME.length, 7 + flow.bench.HOME.length);
  for (const substitute of flow.bench.HOME) {
    assert.ok(flow.rosters.HOME.includes(substitute.id), `${substitute.id} belongs to HOME`);
    assert.equal(flow.match.handball.players.some((p) => p.id === substitute.id), false, "but is not on the court");
  }
  // Nobody is in two squads, and nobody is duplicated.
  const all = [...flow.rosters.HOME, ...flow.rosters.AWAY];
  assert.equal(new Set(all).size, all.length, "every squad member is distinct");
  assert.ok(flow.goalkeeperIds.length >= 4, "both keepers and both reserves are known to be keepers");
});

// ---------------------------------------------------------------------------
// 2. The substitution itself
// ---------------------------------------------------------------------------

test("the outgoing player leaves the spatial state and the incoming one enters it", () => {
  const flow = flowWithBench(300);
  const outgoing = onCourt(flow, "HOME").find((p) => p.kind === "FIELD_PLAYER")!;
  const incoming = flow.bench.HOME.find((p) => p.kind === "FIELD_PLAYER")!;

  const after = forceSub(flow, "HOME", outgoing.id, incoming.id);
  assert.equal(after.match.handball.players.some((p) => p.id === outgoing.id), false, "he is genuinely off the court");
  assert.ok(after.match.handball.players.some((p) => p.id === incoming.id), "and his replacement is genuinely on it");
  assert.equal(after.match.handball.players.length, flow.match.handball.players.length, "the size of the population is unchanged");

  // He goes to the bench; his replacement leaves it. Nobody is invented or lost.
  assert.ok(after.bench.HOME.some((p) => p.id === outgoing.id), "the man who came off is now a substitute");
  assert.equal(after.bench.HOME.some((p) => p.id === incoming.id), false);
  assert.equal(after.bench.HOME.length, flow.bench.HOME.length, "the bench is the same size");
  const ids = after.match.handball.players.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, "no duplicate player entities");
});

test("identity and role survive the change, but position does not", () => {
  const flow = flowWithBench(300);
  const outgoing = onCourt(flow, "HOME").find((p) => p.kind === "FIELD_PLAYER" && p.role === "LEFT_WING") ?? onCourt(flow, "HOME")[0];
  const incoming = flow.bench.HOME.find((p) => p.kind === "FIELD_PLAYER")!;
  const after = forceSub(flow, "HOME", outgoing.id, incoming.id);
  const arrived = after.match.handball.players.find((p) => p.id === incoming.id)!;

  assert.equal(arrived.id, incoming.id, "he comes on as himself, not as a copy of the man he replaced");
  assert.equal(arrived.role, outgoing.role, "and takes over his role in the shape");
  assert.equal(arrived.team, outgoing.team, "on the same side of the current situation");
  assert.equal(arrived.kind, outgoing.kind);

  // He is NOT placed into the position he is inheriting.
  assert.deepEqual(arrived.position, SUBSTITUTION_AREA, "he enters through the substitution area");
  assert.ok(
    distanceBetween(arrived.position, outgoing.position) > 3,
    `and has real ground to make up (${distanceBetween(arrived.position, outgoing.position).toFixed(1)}m)`,
  );
  assert.deepEqual(arrived.velocity, { x: 0, y: 0 }, "standing still as he steps on");
  assert.equal(after.onCourtSince[incoming.id], 300, "his time on court starts now");
  assert.equal(after.onCourtSince[outgoing.id], undefined, "and the other man's stops");
});

test("a substitution is refused when it would not be a legal swap", () => {
  const flow = flowWithBench();
  const homeOnCourt = onCourt(flow, "HOME").find((p) => p.kind === "FIELD_PLAYER")!;
  const homeBench = flow.bench.HOME.find((p) => p.kind === "FIELD_PLAYER")!;
  const homeKeeperBench = flow.bench.HOME.find((p) => p.kind === "GOALKEEPER")!;

  const notOnCourt = requestSubstitution(flow, { team: "HOME", outgoingPlayerId: homeBench.id, incomingPlayerId: homeBench.id, reason: "x" });
  assert.equal(notOnCourt.ok, false, "a man on the bench cannot come off");

  const wrongTeam = requestSubstitution(flow, { team: "AWAY", outgoingPlayerId: homeOnCourt.id, incomingPlayerId: homeBench.id, reason: "x" });
  assert.equal(wrongTeam.ok, false, "a side cannot substitute the opposition");

  const wrongKind = requestSubstitution(flow, { team: "HOME", outgoingPlayerId: homeOnCourt.id, incomingPlayerId: homeKeeperBench.id, reason: "x" });
  assert.equal(wrongKind.ok, false, "a goalkeeper does not replace an outfield player");
});

// ---------------------------------------------------------------------------
// 3. Goalkeepers
// ---------------------------------------------------------------------------

test("a goalkeeper substitution makes the shot contest operate on the new keeper", () => {
  const flow = flowWithBench(600);
  // AWAY defends the goal HOME attacks, so its keeper is the one M9 will read.
  const keeper = onCourt(flow, "AWAY").find((p) => p.kind === "GOALKEEPER")!;
  const reserve = flow.bench.AWAY.find((p) => p.kind === "GOALKEEPER")!;
  const after = forceSub(flow, "AWAY", keeper.id, reserve.id);

  const defendingKeeper = after.match.handball.players.find((p) => p.team === "DEFENSE" && p.kind === "GOALKEEPER");
  assert.ok(defendingKeeper, "the defending side still has a goalkeeper");
  assert.equal(defendingKeeper!.id, reserve.id, "and it is the man who just came on");
  assert.equal(after.match.handball.players.filter((p) => p.kind === "GOALKEEPER").length, 2, "still exactly two keepers on court");

  // A possession played from that state is faced by him.
  const result = simulatePossession({ seed: 12, initialState: after.match });
  if (result.outcome === "SHOT_GOAL" || result.outcome === "SHOT_SAVED") {
    assert.equal(result.goalkeeperId, reserve.id, "the substitute keeper faced the shot");
  }
  // He is tracked as an active keeper: he moves off his line during the possession.
  const track = result.trace.map((t) => t.playerPositions.find((p) => p.playerId === reserve.id)?.position).filter(Boolean);
  assert.ok(track.length > 0, "he is on the court throughout");
  const moved = track.reduce((total, p, i) => (i === 0 ? 0 : total + distanceBetween(track[i - 1]!, p!)), 0);
  assert.ok(moved > 1, `and plays as a goalkeeper rather than standing still (${moved.toFixed(1)}m)`);
});

// ---------------------------------------------------------------------------
// 4. Suspensions -- do not delete
// ---------------------------------------------------------------------------

test("a suspension cannot be bypassed by substitution", () => {
  const flow = flowWithBench(600);
  const offender = onCourt(flow, "AWAY").find((p) => p.kind === "FIELD_PLAYER")!;
  const short = applySuspension(flow, offender.id, "test");
  const bench = short.bench.AWAY.find((p) => p.kind === "FIELD_PLAYER")!;

  assert.equal(outfieldEntitlement(short, "AWAY"), 5, "a man down means five outfield players are permitted");
  const outfieldNow = onCourt(short, "AWAY").filter((p) => p.kind === "FIELD_PLAYER").length;
  assert.equal(outfieldNow, 5, "and five are on the court");

  // He cannot be replaced: he is not on the court to come off.
  const replaceHim = requestSubstitution(short, { team: "AWAY", outgoingPlayerId: offender.id, incomingPlayerId: bench.id, reason: "cheat" });
  assert.equal(replaceHim.ok, false, "the suspended man cannot be substituted");
  assert.ok(!replaceHim.ok && replaceHim.reason.includes("not on the court"));

  // Nor can he come back on as somebody else's replacement.
  const survivor = onCourt(short, "AWAY").find((p) => p.kind === "FIELD_PLAYER")!;
  const sneakBack = requestSubstitution(short, { team: "AWAY", outgoingPlayerId: survivor.id, incomingPlayerId: offender.id, reason: "cheat" });
  assert.equal(sneakBack.ok, false, "a suspended player is not an eligible substitute");

  // A legal substitution is still available, and it does NOT restore strength.
  const legal = forceSub(short, "AWAY", survivor.id, bench.id);
  assert.equal(onCourt(legal, "AWAY").filter((p) => p.kind === "FIELD_PLAYER").length, 5, "still five outfield players");
  assert.equal(outfieldEntitlement(legal, "AWAY"), 5, "still a man down");
  assert.equal(legal.suspensions.length, 1, "the suspension is untouched");
});

test("suspension expiry and substitutions coexist: a side is never given an extra man", () => {
  const offender = onCourt(flowWithBench(), "AWAY").find((p) => p.kind === "FIELD_PLAYER")!;
  const suspended = startPendingSuspensions(applySuspension(flowWithBench(600), offender.id, "test"), 600);

  // (a) Nobody replaced him: when his time is up he comes back on himself.
  const plain = expireSuspensions({ ...suspended, matchSeconds: 600 + FOUL_LIMITS.suspensionSeconds });
  assert.equal(plain.returned.length, 1);
  assert.ok(plain.flow.match.handball.players.some((p) => p.id === offender.id), "he returns to the court");
  assert.equal(onCourt(plain.flow, "AWAY").filter((p) => p.kind === "FIELD_PLAYER").length, 6, "back to six");

  // (b) His side used the time to change somebody else. When his suspension
  //     ends they are already at full permitted strength, so he rejoins the
  //     BENCH rather than becoming a seventh outfield player.
  const survivor = onCourt(suspended, "AWAY").find((p) => p.kind === "FIELD_PLAYER")!;
  const rotated = forceSub(suspended, "AWAY", survivor.id, suspended.bench.AWAY.find((p) => p.kind === "FIELD_PLAYER")!.id);
  const afterRotation = expireSuspensions({ ...rotated, matchSeconds: 600 + FOUL_LIMITS.suspensionSeconds });
  assert.equal(afterRotation.returned.length, 1, "his two minutes are served either way");
  assert.equal(
    onCourt(afterRotation.flow, "AWAY").filter((p) => p.kind === "FIELD_PLAYER").length,
    6,
    "the side is back to six outfield players, never seven",
  );
  const ids = afterRotation.flow.match.handball.players.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, "and nobody is on the court twice");
  assert.equal(afterRotation.flow.suspensions.length, 0);
});

// ---------------------------------------------------------------------------
// 5. The rest of the engine keeps working
// ---------------------------------------------------------------------------

test("attack, defence and transition keep working with substituted players", () => {
  let flow = flowWithBench(400);
  // Change two outfield players per side, so a third of the court is new.
  for (const team of ["HOME", "AWAY"] as const) {
    for (let i = 0; i < 2; i += 1) {
      // Always the front of the CURRENT bench: the man who came off joins it,
      // so the list is different after every change.
      const out = onCourt(flow, team).filter((p) => p.kind === "FIELD_PLAYER")[0];
      const inc = flow.bench[team].filter((p) => p.kind === "FIELD_PLAYER")[0];
      flow = forceSub(flow, team, out.id, inc.id);
    }
  }
  const substitutes = ["home-sub-1", "home-sub-2", "away-sub-1", "away-sub-2"];
  for (const id of substitutes) assert.ok(flow.match.handball.players.some((p) => p.id === id), `${id} is on the court`);

  // A whole possession, and then a whole sequence including the transition.
  const possession = simulatePossession({ seed: 12, initialState: flow.match });
  assert.equal(possession.guardTripped, false, "the possession resolves normally");
  assert.ok(possession.trace.some((t) => t.note.startsWith("defence:")), "the 6:0 still assigns jobs");
  const sequence = simulateSequence({ seed: 3, initialState: flow.match });
  assert.ok(sequence.possession.steps > 0);
  if (sequence.transition) assert.equal(sequence.transition.guardTripped, false, "and so does the transition it caused");

  // The substitutes are genuinely part of the play, not passengers.
  const moved = substitutes.filter((id) => {
    const first = possession.trace[0].playerPositions.find((p) => p.playerId === id)!.position;
    const last = possession.trace[possession.trace.length - 1].playerPositions.find((p) => p.playerId === id)!.position;
    return distanceBetween(first, last) > 1;
  });
  assert.ok(moved.length >= 2, `substitutes run into the situation (${moved.length} of 4 moved)`);
  // And the engine never assumes the original ids are still there.
  for (const entry of possession.trace) {
    const ids = entry.playerPositions.map((p) => p.playerId);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(ids.length, 14);
  }
});

test("a run of play keeps rotating without ever breaking the population", () => {
  const run = simulateGameSequence(TOP, 12, { maxPossessions: 20 });
  for (const entry of run.trace) {
    const ids = entry.playerPositions.map((p) => p.playerId);
    assert.equal(new Set(ids).size, ids.length, `duplicate player at ${entry.note}`);
    for (const id of ids) {
      assert.ok(
        run.finalState.rosters.HOME.includes(id) || run.finalState.rosters.AWAY.includes(id),
        `${id} is a real squad member`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// 6. In a whole match
// ---------------------------------------------------------------------------

test("a match rotates its bench, changes goalkeepers, and never loses a player", () => {
  const match = simulateMatch(TOP, 12);
  const substitutions = match.segments.flatMap((s) => s.substitutions);
  assert.ok(substitutions.length > 5, `the bench is genuinely used (${substitutions.length} substitutions)`);
  assert.ok(substitutions.some((s) => s.kind === "GOALKEEPER"), "including a goalkeeper change");
  assert.ok(substitutions.some((s) => s.reason === "ROTATION"), "and planned rotation");

  // Every substitution is a real swap between two squad members.
  for (const change of substitutions) {
    assert.notEqual(change.incomingPlayerId, change.outgoingPlayerId);
    const squad = match.finalState.rosters[change.team];
    assert.ok(squad.includes(change.incomingPlayerId) && squad.includes(change.outgoingPlayerId), "both belong to that side");
  }

  // Players who never started do appear on court.
  const seen = new Set(match.trace.flatMap((t) => t.playerPositions.map((p) => p.playerId)));
  const startersOnly = new Set(TOP.handball.players.map((p) => p.id));
  const substitutesUsed = [...seen].filter((id) => !startersOnly.has(id));
  assert.ok(substitutesUsed.length >= 2, `substitutes actually played (${substitutesUsed.join(", ")})`);

  // The court is always a legal population of distinct, real players.
  for (const entry of match.trace) {
    const ids = entry.playerPositions.map((p) => p.playerId);
    assert.equal(new Set(ids).size, ids.length, `duplicate player at ${entry.note}`);
    assert.ok(ids.length <= 14 && ids.length >= 12, `population stayed sane (${ids.length})`);
    const keepers = ids.filter((id) => match.finalState.goalkeeperIds.includes(id));
    assert.equal(keepers.length, 2, "there are always exactly two goalkeepers on court");
  }
  // And the substitution is visible in the trace.
  assert.ok(match.trace.some((t) => t.note.includes("SUB (")), "substitutions are traced");
});

test("the substitution trace is deterministic", () => {
  const a = simulateMatch(TOP, 7);
  const b = simulateMatch(TOP, 7);
  const changes = (m: typeof a) =>
    m.segments.flatMap((s) => s.substitutions.map((x) => [x.team, x.outgoingPlayerId, x.incomingPlayerId, x.reason, x.atMatchSeconds]));
  assert.deepEqual(changes(b), changes(a), "identical substitutions at identical times");
  assert.ok(changes(a).length > 0, "the match contained substitutions to compare");
  assert.deepEqual(
    b.finalState.bench.HOME.map((p) => p.id),
    a.finalState.bench.HOME.map((p) => p.id),
    "and an identical bench at full time",
  );
});

test("the decision layer proposes, and only from real state", () => {
  const flow = flowWithBench(0);
  // Nobody has been on long enough at kickoff: no rotation is proposed.
  assert.deepEqual(decideSubstitutions(flow, "HOME", { atRestart: false, possessionTeam: "HOME" }, createPossessionRng(1)), [], "no reason to change anybody yet");

  // After a long stretch, the man who has been on longest is the candidate.
  const later = { ...flow, matchSeconds: 900 };
  const proposals: string[] = [];
  for (let seed = 1; seed <= 20; seed += 1) {
    for (const request of decideSubstitutions(later, "HOME", { atRestart: false, possessionTeam: "HOME" }, createPossessionRng(seed))) {
      proposals.push(request.outgoingPlayerId);
      assert.ok(flow.bench.HOME.some((p) => p.id === request.incomingPlayerId), "the replacement comes from that bench");
    }
  }
  assert.ok(proposals.length > 0, "rotation is proposed once players have been on a while");
  assert.equal(new Set(proposals).size, 1, "and it is always the longest-serving man");

  // An empty bench proposes nothing at all.
  assert.deepEqual(
    decideSubstitutions({ ...later, bench: { HOME: [], AWAY: [] } }, "HOME", { atRestart: true, possessionTeam: "HOME" }, createPossessionRng(1)),
    [],
    "a side with nobody to bring on makes no changes",
  );
});

// ---------------------------------------------------------------------------
// 7. The exit: REQUESTED -> EXITING -> COMPLETE
//
// A substitution is not an instant. The man going off has to leave THROUGH the
// substitution area, and until he is there his replacement stays sitting down.
// These five tests are the whole reason the lifecycle exists.
// ---------------------------------------------------------------------------

test("the outgoing player physically travels to the substitution area", () => {
  const flow = flowWithBench(300);
  const outgoing = onCourt(flow, "HOME").find((p) => p.kind === "FIELD_PLAYER")!;
  const incoming = flow.bench.HOME.find((p) => p.kind === "FIELD_PLAYER")!;
  const startedAt = { ...outgoing.position };
  const startedAway = distanceBetween(startedAt, SUBSTITUTION_AREA);
  assert.ok(startedAway > 5, `he starts a long way from the line (${startedAway.toFixed(1)}m)`);

  const requested = requestSubstitution(flow, { team: "HOME", outgoingPlayerId: outgoing.id, incomingPlayerId: incoming.id, reason: "test" });
  assert.ok(requested.ok);
  const leaving = requested.flow.match.handball.players.find((p) => p.id === outgoing.id)!;
  assert.ok(isLeavingCourt(leaving), "he is marked as leaving");
  assert.deepEqual(leaving.position, startedAt, "but he has not moved yet -- nothing teleports");

  // One step at a time, he closes on the line, and every step is real movement.
  let handball = requested.flow.match.handball;
  let steps = 0;
  let lastSeen = { ...startedAt };
  const distances: number[] = [];
  while (steps < 400 && handball.players.some((p) => p.id === outgoing.id)) {
    const man = handball.players.find((p) => p.id === outgoing.id)!;
    lastSeen = { ...man.position };
    distances.push(distanceBetween(lastSeen, SUBSTITUTION_AREA));
    handball = stepWithSubstitutions(handball, [], SIMULATION_DT_SECONDS);
    steps += 1;
  }
  assert.ok(steps > 5, `he covers the ground over many steps (${steps})`);
  // The distance to his line falls monotonically -- he walks there, he is not placed there.
  for (let i = 1; i < distances.length; i += 1) {
    assert.ok(distances[i] <= distances[i - 1] + 1e-9, `step ${i}: he keeps closing on the line`);
  }
  assert.ok(distances[distances.length - 1] < SUBSTITUTION_ARRIVAL_METERS + 0.5, "and the last place he stood was his own line");
  assert.ok(
    distanceBetween(startedAt, lastSeen) > startedAway - 1.5,
    "having actually travelled there rather than being placed there",
  );
});

test("the incoming player cannot enter before the outgoing one has left", () => {
  const flow = flowWithBench(300);
  const outgoing = onCourt(flow, "HOME").find((p) => p.kind === "FIELD_PLAYER")!;
  const incoming = flow.bench.HOME.find((p) => p.kind === "FIELD_PLAYER")!;
  const requested = requestSubstitution(flow, { team: "HOME", outgoingPlayerId: outgoing.id, incomingPlayerId: incoming.id, reason: "test" });
  assert.ok(requested.ok);
  const during = requested.flow;

  // REQUESTED changes nobody whereabouts at all.
  assert.ok(during.match.handball.players.some((p) => p.id === outgoing.id), "the man going off is still a real player on the court");
  assert.equal(during.match.handball.players.some((p) => p.id === incoming.id), false, "his replacement is not on");
  assert.ok(during.bench.HOME.some((p) => p.id === incoming.id), "he is still on the bench");
  assert.equal(during.match.handball.players.length, 14, "and the population has not changed");

  // Settling while he is still walking changes nothing at all.
  const tooEarly = settlePendingSubstitutions(during);
  assert.deepEqual(tooEarly.completed, [], "nothing completes while he is out on the court");
  assert.equal(tooEarly.flow.pendingSubstitutions.length, 1, "the request is still waiting");
  assert.equal(tooEarly.flow.match.handball.players.some((p) => p.id === incoming.id), false, "and still nobody has come on");

  // A second request for the same side is refused while one is in progress.
  const other = onCourt(during, "HOME").find((p) => p.kind === "FIELD_PLAYER" && p.id !== outgoing.id)!;
  const second = requestSubstitution(during, { team: "HOME", outgoingPlayerId: other.id, incomingPlayerId: during.bench.HOME[1].id, reason: "test" });
  assert.equal(second.ok, false, "one exchange at a time");
});

test("the swap completes mid-play, on the first fixed step he is at the substitution area", () => {
  const flow = flowWithBench(300);
  const outgoing = onCourt(flow, "HOME").find((p) => p.kind === "FIELD_PLAYER")!;
  const incoming = flow.bench.HOME.find((p) => p.kind === "FIELD_PLAYER")!;
  const requested = requestSubstitution(flow, { team: "HOME", outgoingPlayerId: outgoing.id, incomingPlayerId: incoming.id, reason: "test" });
  assert.ok(requested.ok);

  // Ordinary fixed steps -- the same call every engine makes. Nothing in this
  // test settles anything; the exchange has to complete inside the step.
  let handball = requested.flow.match.handball;
  let distanceLastStep = distanceBetween(outgoing.position, SUBSTITUTION_AREA);
  let swappedAtStep = -1;
  let distanceOnTheStepBefore = -1;
  for (let i = 1; i <= 400 && swappedAtStep < 0; i += 1) {
    handball = stepWithSubstitutions(handball, [], SIMULATION_DT_SECONDS);
    // Not one step of the exchange has a fifteenth player on the court.
    assert.equal(handball.players.length, 14, `population is fourteen on step ${i}`);
    const still = handball.players.find((p) => p.id === outgoing.id);
    if (!still) {
      swappedAtStep = i;
      distanceOnTheStepBefore = distanceLastStep;
      break;
    }
    // THE POINT OF THIS TEST: he is never once observed standing at his line
    // while still on the court. There is no waiting after he arrives.
    assert.ok(!hasReachedSubstitutionArea(still), `step ${i}: he is at the line and has not been taken off`);
    distanceLastStep = distanceBetween(still.position, SUBSTITUTION_AREA);
  }

  assert.ok(swappedAtStep > 5, `the swap happened during play, after a real walk (${swappedAtStep} steps)`);
  assert.ok(
    distanceOnTheStepBefore > SUBSTITUTION_ARRIVAL_METERS,
    `and not one step later than it could have been -- he was still ${distanceOnTheStepBefore.toFixed(2)}m out the step before`,
  );

  // The man coming on is there on that same step, at the substitution area.
  const arrived = handball.players.find((p) => p.id === incoming.id)!;
  assert.ok(arrived, "his replacement is on from the same step");
  assert.deepEqual(arrived.position, SUBSTITUTION_AREA, "entering from the substitution area");
  assert.equal(arrived.role, outgoing.role, "inheriting the role");
  assert.notDeepEqual(arrived.position, outgoing.position, "but never the position");
  assert.equal(arrived.leavingCourt, undefined, "and not himself marked as leaving");

  // And he can play from the very next step: an ordinary MOVE moves him.
  let after = stepWithSubstitutions(handball, [{ type: "MOVE", playerId: incoming.id, target: { x: 10, y: 20 } }], SIMULATION_DT_SECONDS);
  const accepted = after.players.find((p) => p.id === incoming.id)!;
  assert.equal(accepted.intent.type, "MOVE", "he accepts an ordinary command on the very next step");
  assert.ok(Math.hypot(accepted.velocity.x, accepted.velocity.y) > 0, "and is already moving under it");
  for (let i = 0; i < 40; i += 1) after = stepWithSubstitutions(after, [], SIMULATION_DT_SECONDS);
  assert.ok(
    distanceBetween(after.players.find((p) => p.id === incoming.id)!.position, SUBSTITUTION_AREA) > 1,
    "and runs into the situation from the substitution area",
  );
  assert.equal(after.players.length, 14);
});

test("an exchange never gives a side an extra player, at any instant", () => {
  // Played out across a whole match, with suspensions running at the same time.
  const match = simulateMatch(TOP, 12);
  const goalkeepers = new Set(match.finalState.goalkeeperIds);
  for (const entry of match.trace) {
    for (const team of ["HOME", "AWAY"] as const) {
      const squad = match.finalState.rosters[team];
      const onIt = entry.playerPositions.filter((p) => squad.includes(p.playerId));
      const outfield = onIt.filter((p) => !goalkeepers.has(p.playerId)).length;
      assert.ok(outfield <= 6, `${team} never has a seventh outfield player (${outfield}) at ${entry.note}`);
      assert.ok(onIt.filter((p) => goalkeepers.has(p.playerId)).length <= 1, `${team} never has two keepers on court`);
    }
  }

  // And an exchange during a suspension still cannot restore full strength: the
  // entitlement is what caps it, and the swap is one for one either way.
  const flow = flowWithBench(600);
  const offender = onCourt(flow, "AWAY").find((p) => p.kind === "FIELD_PLAYER")!;
  const short = applySuspension(flow, offender.id, "test");
  const survivor = onCourt(short, "AWAY").find((p) => p.kind === "FIELD_PLAYER")!;
  const swapped = forceSub(short, "AWAY", survivor.id, short.bench.AWAY.find((p) => p.kind === "FIELD_PLAYER")!.id);
  assert.equal(onCourt(swapped, "AWAY").filter((p) => p.kind === "FIELD_PLAYER").length, outfieldEntitlement(swapped, "AWAY"));
  assert.equal(outfieldEntitlement(swapped, "AWAY"), 5, "still a man down");
});

test("a goalkeeper change follows the same lifecycle, through the same area", () => {
  const flow = flowWithBench(900);
  const keeper = onCourt(flow, "AWAY").find((p) => p.kind === "GOALKEEPER")!;
  const reserve = flow.bench.AWAY.find((p) => p.kind === "GOALKEEPER")!;
  const startedAt = { ...keeper.position };
  assert.ok(distanceBetween(startedAt, SUBSTITUTION_AREA) > 5, "he starts on his line, not at the halfway line");

  const requested = requestSubstitution(flow, { team: "AWAY", outgoingPlayerId: keeper.id, incomingPlayerId: reserve.id, reason: "test" });
  assert.ok(requested.ok);
  // Same middle state as an outfield change: he is still in goal, the reserve is
  // still sitting down.
  assert.ok(isLeavingCourt(requested.flow.match.handball.players.find((p) => p.id === keeper.id)!));
  assert.equal(requested.flow.match.handball.players.some((p) => p.id === reserve.id), false, "the reserve has not come on yet");
  assert.deepEqual(settlePendingSubstitutions(requested.flow).completed, [], "and nothing completes until he is at the line");

  const walked = walkExitingPlayersOff(requested.flow);
  assert.ok(walked.steps > 5, `he walks the length he has to walk (${walked.steps} steps)`);
  const settled = settlePendingSubstitutions(walked.flow);
  assert.equal(settled.completed.length, 1);
  assert.equal(settled.completed[0].kind, "GOALKEEPER", "recorded as a goalkeeper change");

  const arrived = settled.flow.match.handball.players.find((p) => p.id === reserve.id)!;
  assert.deepEqual(arrived.position, SUBSTITUTION_AREA, "the new keeper enters through the substitution area too");
  assert.equal(arrived.kind, "GOALKEEPER");
  assert.equal(settled.flow.match.handball.players.some((p) => p.id === keeper.id), false, "and the old one is off");
  assert.equal(settled.flow.match.handball.players.filter((p) => p.kind === "GOALKEEPER").length, 2, "still two keepers on court");
});

// ---------------------------------------------------------------------------
// 8. Rolling: the exchange completes DURING live play
//
// A handball substitution does not wait for the ball to go dead, and it does
// not wait for a possession to end either. The moment the man going off crosses
// his line, the man coming on is on. These two tests are about that moment
// happening inside the simulation rather than at a segment boundary.
// ---------------------------------------------------------------------------

test("a substitution completes in the middle of a possession, without stopping play", () => {
  const flow = flowWithBench(300);
  const outgoing = onCourt(flow, "HOME").find((p) => p.kind === "FIELD_PLAYER")!;
  const incoming = flow.bench.HOME.find((p) => p.kind === "FIELD_PLAYER")!;
  const requested = requestSubstitution(flow, { team: "HOME", outgoingPlayerId: outgoing.id, incomingPlayerId: incoming.id, reason: "test" });
  assert.ok(requested.ok);

  // One ordinary possession, played by the ordinary engine. Nothing here
  // settles the substitution -- the possession engine's own step loop does.
  const possession = simulatePossession({ seed: 12, initialState: requested.flow.match });
  assert.equal(possession.guardTripped, false, "play carries on normally through the change");

  const startedWithHim = possession.trace[0].playerPositions.some((p) => p.playerId === outgoing.id);
  const endedWithHim = possession.finalState.handball.players.some((p) => p.id === outgoing.id);
  assert.ok(startedWithHim, "he is on the court when the possession begins");
  assert.equal(endedWithHim, false, "and off it before the possession ends");
  assert.ok(possession.finalState.handball.players.some((p) => p.id === incoming.id), "his replacement came on during it");

  // The swap is recorded on the state as having happened at a real instant
  // inside the possession, not at either end of it.
  const exchange = (possession.finalState.handball.exchanges ?? []).find((x) => x.outgoingPlayerId === outgoing.id)!;
  assert.ok(exchange, "the exchange is on the spatial state");
  assert.ok(exchange.completedAtSimulationTime !== null, "and it completed");
  const first = possession.trace[0].simulationTime;
  const last = possession.trace[possession.trace.length - 1].simulationTime;
  assert.ok(
    exchange.completedAtSimulationTime! > first && exchange.completedAtSimulationTime! < last,
    `mid-possession (${exchange.completedAtSimulationTime!.toFixed(2)}s, between ${first.toFixed(2)}s and ${last.toFixed(2)}s)`,
  );

  // Every recorded frame is a legal population, and the change is visible in
  // the frames rather than only in a ledger.
  let framesWithOld = 0;
  let framesWithNew = 0;
  for (const entry of possession.trace) {
    const ids = entry.playerPositions.map((p) => p.playerId);
    assert.equal(ids.length, 14, `fourteen players in every frame (${entry.note})`);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(ids.includes(outgoing.id) && ids.includes(incoming.id), false, "never both of them at once");
    if (ids.includes(outgoing.id)) framesWithOld += 1;
    if (ids.includes(incoming.id)) framesWithNew += 1;
  }
  assert.ok(framesWithOld > 0 && framesWithNew > 0, "both halves of the change are drawable");
  assert.equal(framesWithOld + framesWithNew, possession.trace.length, "one or the other in every frame, never neither");
});

test("no substitution waits at the line: nobody stands there un-exchanged", () => {
  // The whole-match measurement. For every substitution in a real match, find
  // the last unbroken run of frames in which the outgoing player is standing at
  // his line, and check how long it lasted before he was actually taken off.
  //
  // Frames are compared on the SPATIAL clock within their own half. The
  // official clock a frame carries is spread evenly across a segment for the
  // renderer, which is close but not the instant the swap happened.
  const match = simulateMatch(TOP, 12);
  const substitutions = match.segments.flatMap((s) => s.substitutions.map((x) => ({ ...x, half: s.half })));
  assert.ok(substitutions.length > 5, `the bench is genuinely used (${substitutions.length})`);

  let worstWaitSeconds = 0;
  let worstWho = "";
  let everSeenWaiting = 0;
  for (const change of substitutions) {
    const onCourtFrames = match.trace.filter(
      (t) =>
        t.half === change.half &&
        t.simulationTime <= change.atSimulationTime &&
        t.playerPositions.some((p) => p.playerId === change.outgoingPlayerId),
    );
    const atLine = (t: (typeof onCourtFrames)[number]): boolean => {
      const at = t.playerPositions.find((p) => p.playerId === change.outgoingPlayerId)!;
      return distanceBetween(at.position, SUBSTITUTION_AREA) <= SUBSTITUTION_ARRIVAL_METERS;
    };
    let i = onCourtFrames.length - 1;
    if (i < 0 || !atLine(onCourtFrames[i])) continue;
    while (i > 0 && atLine(onCourtFrames[i - 1])) i -= 1;
    everSeenWaiting += 1;
    const wait = (change.atSimulationTime - onCourtFrames[i].simulationTime) * MATCH_PACING_FACTOR;
    if (wait > worstWaitSeconds) {
      worstWaitSeconds = wait;
      worstWho = change.outgoingPlayerId;
    }
  }

  // Almost nobody is ever RECORDED standing at his line, because the exchange
  // happens on the step he arrives -- no frame catches him waiting there.
  // Expressed as a share rather than a count: "hardly ever" is the claim, and a
  // fixed integer was really a fact about one seed. M17 changed which shots are
  // taken, so the same match now has a few more exchanges land during a flight.
  assert.ok(
    everSeenWaiting / substitutions.length < 0.15,
    `hardly a change is ever seen waiting at the line (${everSeenWaiting} of ${substitutions.length})`,
  );
  // The one thing that can hold a change up is a shot already in flight: the
  // keeper is committed to a dive and the ball is resolving against him, so no
  // swap is made until it lands. That is a fraction of a second.
  assert.ok(
    worstWaitSeconds <= 3,
    `and never for longer than a shot takes to land (worst: ${worstWho} waited ${worstWaitSeconds.toFixed(1)} official seconds)`,
  );
});
