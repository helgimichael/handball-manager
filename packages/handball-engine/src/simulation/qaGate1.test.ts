// HUMAN QA GATE 1 — FIX PASS 1.
//
// A human watched the harness and reported five concrete things that were
// wrong. These are the proofs for exactly those five, written so that the
// specific failure he saw cannot come back silently.
//
// The test that must never be deleted is "the goal is empty until the keeper is
// actually in it". Two of the five failures were the same shape -- a player who
// completed a legal exchange and was then never told where to go -- and the
// keeper's version of it is the dangerous one, because a keeper standing on the
// halfway line while his goal is credited as guarded is a lie the score would
// eventually be told as truth.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scenario, requireScenarioPlayer } from "../scenarios/matchScenario";
import { createFullCourt6v6State } from "../scenarios/fullCourt6v6";
import { simulateMatch } from "./matchRunner";
import { step } from "./engine";
import { stepWithSubstitutions, withExchange, markLeavingCourt } from "./substitutionExit";
import { organizedShapeTargetFor, sixZeroHomePosition } from "./organizedAttack";
import { distanceBetween } from "../domain/geometry/coordinates";
import {
  goalkeeperOnCourt,
  ownGoalIsEmpty,
  startSevenVsSix,
  endSevenVsSix,
  COURT_SIDE_SIZE,
  courtPopulationIsLegal,
  GOAL_GUARDED_WITHIN_METERS,
} from "./sevenVsSix";
import { goalCentre } from "../domain/match/possession";
import {
  THREE_TWO_ONE_BASE_ROLE_ORDER,
  FIVE_ONE_DEFENSE_FORMATION_ID,
  THREE_TWO_ONE_DEFENSE_FORMATION_ID,
  THREE_TWO_ONE_INTERMEDIATE_ROLES,
  defensiveHomePosition,
  frontDefenderRoleOf,
} from "../policies/defense/defensiveSystem";
import type { HandballState } from "../domain/handball/state";
import type { MeterPoint } from "../domain/geometry/coordinates";
import type { DefenseRole } from "../domain/handball/player";

const TOP = createFullCourt6v6State({ attackingGoalSide: "TOP" });
const DT = 0.05;

// ---------------------------------------------------------------------------
// 3. No 3:2:1 defender may stand inside the goal area
// ---------------------------------------------------------------------------

/**
 * The goal area, as the court actually defines it: two quarter circles of six
 * metres around the POSTS, joined by a straight line between them. Not a circle
 * around the goal centre -- getting that wrong is how the broken shape looked
 * plausible on paper while putting three men inside the D.
 */
const GOAL_AREA_RADIUS = 6;
const POST_LEFT_X = 8.5;
const POST_RIGHT_X = 11.5;

function insideGoalArea(point: MeterPoint, goalSide: "TOP" | "BOTTOM"): boolean {
  const goalY = goalSide === "TOP" ? 0 : 40;
  const depth = Math.abs(point.y - goalY);
  if (point.x >= POST_LEFT_X && point.x <= POST_RIGHT_X) return depth < GOAL_AREA_RADIUS;
  const postX = point.x < POST_LEFT_X ? POST_LEFT_X : POST_RIGHT_X;
  return Math.hypot(point.x - postX, depth) < GOAL_AREA_RADIUS;
}

test("no 3:2:1 home position is inside the goal area, at either end", () => {
  // THE invariant this pass exists to add. A human saw three defenders standing
  // in the D; the middle one was 3.2m from his own goal line.
  for (const goalSide of ["TOP", "BOTTOM"] as const) {
    for (const role of ["L1", "L2", "L3", "R3", "R2", "R1"] as const) {
      const home = defensiveHomePosition(THREE_TWO_ONE_DEFENSE_FORMATION_ID, role, goalSide);
      assert.ok(home, `${role} has a home`);
      assert.equal(
        insideGoalArea(home, goalSide),
        false,
        `${goalSide} ${role} stands outside the goal area (${home.x.toFixed(1)}, ${home.y.toFixed(1)})`,
      );
    }
  }
});

test("the 3:2:1 is still three, then two, then one, at clearly separated depths", () => {
  const depth = (role: DefenseRole) => defensiveHomePosition(THREE_TWO_ONE_DEFENSE_FORMATION_ID, role, "TOP")!.y;
  const base = THREE_TWO_ONE_BASE_ROLE_ORDER.map(depth);
  const middle = THREE_TWO_ONE_INTERMEDIATE_ROLES.map(depth);
  const front = depth(frontDefenderRoleOf(THREE_TWO_ONE_DEFENSE_FORMATION_ID)!);
  assert.equal(base.length, 3);
  assert.equal(middle.length, 2);
  assert.ok(Math.max(...base) < Math.min(...middle) - 2, "the line is clearly behind the half-spaces");
  assert.ok(Math.max(...middle) < front - 2, "and the half-spaces clearly behind the point");
});

test("the corrected 3:2:1 is still symmetric and still mirrors", () => {
  const x = (role: DefenseRole) => defensiveHomePosition(THREE_TWO_ONE_DEFENSE_FORMATION_ID, role, "TOP")!.x;
  assert.equal(x("L1") + x("R1"), 20);
  assert.equal(x("L2") + x("R2"), 20);
  assert.equal(x("R3"), 10);
  for (const role of ["L1", "L2", "L3", "R3", "R2", "R1"] as const) {
    const top = defensiveHomePosition(THREE_TWO_ONE_DEFENSE_FORMATION_ID, role, "TOP")!;
    const bottom = defensiveHomePosition(THREE_TWO_ONE_DEFENSE_FORMATION_ID, role, "BOTTOM")!;
    assert.equal(top.x, bottom.x);
    assert.equal((40 - bottom.y).toFixed(6), top.y.toFixed(6));
  }
});

// ---------------------------------------------------------------------------
// 4 + 5. A man who completes an exchange is told where to go
// ---------------------------------------------------------------------------

/** Run the possession machinery for `seconds` with no orders of its own. */
function idle(state: HandballState, seconds: number): HandballState {
  let next = state;
  for (let i = 0; i < Math.round(seconds / DT); i += 1) next = stepWithSubstitutions(next, [], DT);
  return next;
}

test("the seventh attacker comes on as an outfield player, not as a goalkeeper", () => {
  // The root cause of him standing at halfway: he inherited the role of the man
  // he replaced, and the man he replaced was the goalkeeper -- so the organized
  // shape had no spot for him and nobody ever gave him a target.
  const base = createFullCourt6v6State({ attackingGoalSide: "TOP" }).handball;
  const seventh = { ...requireScenarioPlayer(base, "M6"), id: "seventh" };
  let state = startSevenVsSix(base, "ATTACK", seventh);
  state = idle(state, 20);

  const arrived = state.players.find((p) => p.id === "seventh");
  assert.ok(arrived, "he came on");
  assert.equal(arrived.kind, "FIELD_PLAYER", "as an outfield player");
  assert.notEqual(arrived.role, "GOALKEEPER", "and not carrying the keeper's role");
  assert.equal(arrived.role, "EXTRA_ATTACKER", "he is the extra attacker, which the shape has a spot for");
  assert.ok(organizedShapeTargetFor(arrived, state, "TOP"), "and that spot is a real one");
  assert.ok(courtPopulationIsLegal(state, "ATTACK"));
  assert.equal(state.players.filter((p) => p.team === "ATTACK" && p.kind === "FIELD_PLAYER").length, COURT_SIDE_SIZE);
});

test("the seventh attacker leaves the substitution area and joins the attack", () => {
  // End to end, through the real match: he must not still be standing where the
  // exchange dropped him.
  const match = simulateMatch(TOP, 12, {
    coaches: {
      HOME: (view) => {
        const hasKeeper = view.onCourt.some((p) => p.kind === "GOALKEEPER");
        if (view.possessionTeam === "HOME" && hasKeeper) {
          return [{ kind: "SEVEN_V_SIX", team: "HOME", active: true, playerId: null, reason: "qa" }];
        }
        return [];
      },
    },
  });

  // Every frame in which HOME has seven out, how far up the court is the man
  // who came on? He starts at the substitution area on the halfway line.
  const homeIds = new Set(match.finalState.rosters.HOME);
  const keeperIds = new Set(match.finalState.goalkeeperIds);
  let sawSevenOut = false;
  let leftTheLine = false;
  for (const entry of match.trace) {
    const onCourt = entry.playerPositions.filter((p) => homeIds.has(p.playerId));
    if (onCourt.length === 0 || onCourt.some((p) => keeperIds.has(p.playerId))) continue;
    sawSevenOut = true;
    // Somebody on this side is now well away from the halfway line: the attack
    // has taken him with it rather than leaving him parked.
    if (onCourt.some((p) => Math.abs(p.position.y - 20) > 6)) leftTheLine = true;
  }
  assert.ok(sawSevenOut, "HOME really played seven out");
  assert.ok(leftTheLine, "and the extra man travelled with the attack instead of standing at halfway");
});

test("a returning goalkeeper is ON COURT and NOT YET GUARDING for real frames, then guards", () => {
  // THE test, and the one Fix Pass 1 claimed without proving. Being substituted
  // on is not guarding a goal: the exchange puts him at the substitution area on
  // the halfway line, and the goal behind him is as open as it was while he sat
  // on the bench. The three phases below have to be separately observable, or
  // the harness will show a guarded goal that nobody is standing in.
  const base = createFullCourt6v6State({ attackingGoalSide: "TOP" }).handball;
  const keeper = requireScenarioPlayer(base, "GK_ATTACK");
  const seventh = { ...requireScenarioPlayer(base, "M6"), id: "seventh" };
  const ownGoal = goalCentre("BOTTOM");

  // Phase 0: he goes off, and the goal is open.
  let state = idle(startSevenVsSix(base, "ATTACK", seventh), 20);
  assert.equal(goalkeeperOnCourt(state, "ATTACK"), null, "he is off the court");
  assert.equal(ownGoalIsEmpty(state, "ATTACK", "BOTTOM"), true, "so the goal is open");

  // Ask for him back and run the exchange, then drive him home the way the
  // possession engine drives an arriving keeper.
  state = endSevenVsSix(state, "ATTACK", keeper);
  let onCourtButNotGuarding = 0;
  let guardedAt: number | null = null;
  let arrivedDistance = Infinity;

  for (let i = 0; i < 900; i += 1) {
    const back = goalkeeperOnCourt(state, "ATTACK");
    const actions = back
      ? [{ type: "MOVE" as const, playerId: back.id, target: { x: ownGoal.x, y: ownGoal.y - 0.5 } }]
      : [];
    state = stepWithSubstitutions(state, actions, DT);

    const keeperNow = goalkeeperOnCourt(state, "ATTACK");
    const empty = ownGoalIsEmpty(state, "ATTACK", "BOTTOM");
    if (keeperNow && empty) {
      // Phase 1: ON COURT, not yet at his goal, and the goal still reads EMPTY.
      onCourtButNotGuarding += 1;
      assert.ok(
        distanceBetween(keeperNow.position, ownGoal) > GOAL_GUARDED_WITHIN_METERS,
        "he is genuinely away from his goal while it reads empty",
      );
    }
    if (keeperNow && !empty && guardedAt === null) {
      // Phase 2: he has arrived, and only now does the goal read GUARDED.
      guardedAt = i;
      arrivedDistance = distanceBetween(keeperNow.position, ownGoal);
      break;
    }
  }

  assert.ok(
    onCourtButNotGuarding > 0,
    `there are real frames with the keeper on court and the goal still empty (${onCourtButNotGuarding})`,
  );
  assert.ok(guardedAt !== null, "and he does eventually guard it");
  assert.ok(
    arrivedDistance <= GOAL_GUARDED_WITHIN_METERS,
    `the goal becomes guarded only once he is in a real keeping position (${arrivedDistance.toFixed(2)}m)`,
  );
});

test("a goalkeeper standing on the halfway line does not guard his goal", () => {
  // The invariant stated on its own, without a lifecycle around it: presence is
  // not guarding, and no amount of being on the court substitutes for being
  // in the goal.
  const base = createFullCourt6v6State({ attackingGoalSide: "TOP" }).handball;
  const keeper = base.players.find((p) => p.team === "ATTACK" && p.kind === "GOALKEEPER")!;
  const stranded: HandballState = {
    ...base,
    players: base.players.map((p) => (p.id === keeper.id ? { ...p, position: { x: 10, y: 20 } } : p)),
  };
  assert.ok(goalkeeperOnCourt(stranded, "ATTACK"), "he is on the court");
  assert.equal(ownGoalIsEmpty(stranded, "ATTACK", "BOTTOM"), true, "and his goal is empty anyway");

  // And in his goal, he guards it.
  const home: HandballState = {
    ...base,
    players: base.players.map((p) => (p.id === keeper.id ? { ...p, position: { x: 10, y: 39.5 } } : p)),
  };
  assert.equal(ownGoalIsEmpty(home, "ATTACK", "BOTTOM"), false, "in his goal, it is guarded");
});

test("a goalkeeper coming on for an outfield player keeps his own role", () => {
  const base = createFullCourt6v6State({ attackingGoalSide: "TOP" }).handball;
  const keeper = requireScenarioPlayer(base, "GK_ATTACK");
  const outgoing = requireScenarioPlayer(base, "M6");
  const state = idle(
    withExchange(
      { ...base, players: markLeavingCourt(base.players.filter((p) => p.id !== keeper.id), outgoing.id, true) },
      { outgoingPlayerId: outgoing.id, incoming: keeper, completedAtSimulationTime: null },
    ),
    20,
  );
  const arrived = state.players.find((p) => p.id === keeper.id);
  assert.ok(arrived, "he came on");
  assert.equal(arrived.kind, "GOALKEEPER");
  assert.equal(arrived.role, "GOALKEEPER", "and did not inherit a pivot's role");
});

// ---------------------------------------------------------------------------
// 2. The throw-off reforms into an organized attack
// ---------------------------------------------------------------------------

test("after a throw-off the thrower does not stay parked at the centre", () => {
  // The exact thing a human saw on seed 12: the man who restarted stood on the
  // halfway line waiting to be passed to again while his team ran past him.
  const match = simulateMatch(TOP, 12);
  const restart = match.segments.find((s) => s.kind === "CENTRE_RESTART");
  assert.ok(restart, "seed 12 contains a centre restart");

  const entries = match.trace.filter((t) => t.possessionNumber === restart.possessionNumber);
  assert.ok(entries.length > 5, "the restart possession is played out");
  const throwerId = entries[0].ballPossessorId;
  assert.ok(throwerId, "somebody took the throw-off");

  const startY = entries[0].playerPositions.find((p) => p.playerId === throwerId)!.position.y;
  const moved = entries.map((e) => e.playerPositions.find((p) => p.playerId === throwerId)!.position.y);
  const furthest = Math.max(...moved.map((y) => Math.abs(y - startY)));
  assert.ok(furthest > 3, `the thrower leaves the centre and joins the attack (moved ${furthest.toFixed(1)}m)`);
});

test("the attack takes up organized shape rather than playing from its own half", () => {
  const state = scenario({ phase: "CIRCULATION" }).handball;
  // Put the whole attack deep in its own half, as a throw-off leaves it.
  const deep: HandballState = {
    ...state,
    players: state.players.map((p) =>
      p.team === "ATTACK" && p.kind === "FIELD_PLAYER" ? { ...p, position: { x: p.position.x, y: 26 } } : p,
    ),
  };
  const before = deep.players
    .filter((p) => p.team === "ATTACK" && p.kind === "FIELD_PLAYER")
    .map((p) => distanceBetween(p.position, organizedShapeTargetFor(p, deep, "TOP") ?? p.position));
  assert.ok(Math.max(...before) > 10, "they start a long way from their spots");

  // Run the same orders the engine issues while the attack builds.
  let running = deep;
  for (let i = 0; i < 130; i += 1) {
    const actions = running.players
      .filter((p) => p.team === "ATTACK" && p.kind === "FIELD_PLAYER")
      .flatMap((p) => {
        const target = organizedShapeTargetFor(p, running, "TOP");
        return target ? [{ type: "MOVE" as const, playerId: p.id, target }] : [];
      });
    running = step(running, { actions }, DT);
  }

  const after = running.players
    .filter((p) => p.team === "ATTACK" && p.kind === "FIELD_PLAYER")
    .map((p) => distanceBetween(p.position, organizedShapeTargetFor(p, running, "TOP") ?? p.position));
  assert.ok(Math.max(...after) <= 2, `everybody reaches his organized spot (worst ${Math.max(...after).toFixed(1)}m)`);

  // And the shape is a shape: the line player is nearer the goal than the backs.
  const pivot = running.players.find((p) => p.team === "ATTACK" && p.role === "PIVOT")!;
  const backs = running.players.filter((p) => p.team === "ATTACK" && (p.role === "LEFT_BACK" || p.role === "CENTER_BACK" || p.role === "RIGHT_BACK"));
  for (const back of backs) {
    assert.ok(pivot.position.y < back.position.y, `the line player is in front of ${back.role}, not level with him`);
  }
});

// ---------------------------------------------------------------------------
// Nothing else moved
// ---------------------------------------------------------------------------

test("6:0 and 5:1 home positions are untouched and still legal", () => {
  // The same invariant, read from each system's OWN source: the 6:0 keeps its
  // canonical FIELD shape, the 5:1 its own. Neither was changed by this pass,
  // and neither was ever inside the area -- which is the point of checking.
  for (const goalSide of ["TOP", "BOTTOM"] as const) {
    for (const role of ["L1", "L2", "L3", "R3", "R2", "R1"] as const) {
      const sixZero = sixZeroHomePosition(role, goalSide);
      assert.ok(sixZero, `6:0 ${role} has a home`);
      assert.equal(insideGoalArea(sixZero, goalSide), false, `6:0 ${goalSide} ${role} is outside the goal area`);

      const fiveOne = defensiveHomePosition(FIVE_ONE_DEFENSE_FORMATION_ID, role, goalSide);
      assert.ok(fiveOne, `5:1 ${role} has a home`);
      assert.equal(insideGoalArea(fiveOne, goalSide), false, `5:1 ${goalSide} ${role} is outside the goal area`);
    }
  }
});

test("seed 12 still plays a complete, deterministic match", () => {
  const a = simulateMatch(TOP, 12);
  const b = simulateMatch(TOP, 12);
  assert.deepEqual(a.finalScore, b.finalScore);
  assert.equal(a.totalPossessions, b.totalPossessions);
  assert.ok(a.totalPossessions > 50, "a full match, not a stalled one");
});
