// MATCH-EXPERIENCE-2.0 M22: seven out, in a real match.
//
// The unit tests beside this one prove each piece. This one proves the sequence
// the milestone actually asks for, end to end and through nothing but the
// ordinary engine:
//
//   the keeper leaves -> a seventh attacker comes on -> the attack plays seven
//   out -> the ball is lost -> the opponent attacks a goal that is genuinely
//   empty while the keeper is legally walking back.
//
// The test that must never be deleted is "the court is always legal". Every
// instant of every match here is checked for a side of seven with at most one
// goalkeeper. A milestone that adds a player to the court is one mistake away
// from adding two, and unlike a wrong probability that mistake would never look
// wrong in a scoreline.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFullCourt6v6State } from "../scenarios/fullCourt6v6";
import { simulateMatch } from "./matchRunner";
import { buildCanonicalMatchEvents, eventsOfType } from "./canonicalEvents";
import { COURT_SIDE_SIZE } from "./sevenVsSix";
import type { CoachCommand, CoachController, CoachView } from "./coach";
import type { MatchTeamId } from "./gameFlow";

const TOP = createFullCourt6v6State({ attackingGoalSide: "TOP" });

/**
 * A coach who plays seven out whenever his side has the ball, and takes the
 * keeper back the moment it does not.
 *
 * Deliberately crude -- M22 is not about when to do this, only about whether
 * the engine can do it truthfully. He asks at every boundary; M11 refuses him
 * whenever the exchange would be illegal, which is most of the point.
 */
function sevenOutCoach(team: MatchTeamId): CoachController {
  return (view: CoachView): readonly CoachCommand[] => {
    const hasKeeper = view.onCourt.some((p) => p.kind === "GOALKEEPER");
    const inPossession = view.possessionTeam === team;
    if (inPossession && hasKeeper) {
      return [{ kind: "SEVEN_V_SIX", team, active: true, playerId: null, reason: "seven out" }];
    }
    if (!inPossession && !hasKeeper) {
      return [{ kind: "SEVEN_V_SIX", team, active: false, playerId: null, reason: "keeper back" }];
    }
    return [];
  };
}

type Sweep = {
  matches: number;
  emptyGoalFrames: number;
  totalFrames: number;
  sevenOutFrames: number;
  illegal: number;
  goalsConcededWithEmptyGoal: number;
  shotsFacedWithEmptyGoal: number;
  keeperReturnSamples: number[];
  sevenOutRequests: number;
};

function sweep(seeds: readonly number[]): Sweep {
  const out: Sweep = {
    matches: 0,
    emptyGoalFrames: 0,
    totalFrames: 0,
    sevenOutFrames: 0,
    illegal: 0,
    goalsConcededWithEmptyGoal: 0,
    shotsFacedWithEmptyGoal: 0,
    keeperReturnSamples: [],
    sevenOutRequests: 0,
  };

  for (const seed of seeds) {
    const match = simulateMatch(TOP, seed, { coaches: { HOME: sevenOutCoach("HOME") } });
    out.matches += 1;

    const homeIds = new Set(match.finalState.rosters.HOME);
    // Counted in FRAMES, not in simulationTime. The spatial clock restarts per
    // possession, so subtracting two trace timestamps across a boundary
    // measures nothing -- a fixed step is 0.05s wherever it sits, and that is
    // what makes a duration comparable here.
    let emptyFrames = 0;

    for (const entry of match.trace) {
      out.totalFrames += 1;
      const onCourt = entry.playerPositions.filter((p) => homeIds.has(p.playerId));
      const keeperIds = new Set(match.finalState.goalkeeperIds);
      const keepersOn = onCourt.filter((p) => keeperIds.has(p.playerId)).length;
      const fieldOn = onCourt.length - keepersOn;

      // THE invariant: a legal side, at every instant of the match.
      if (onCourt.length > COURT_SIDE_SIZE || keepersOn > 1 || fieldOn > COURT_SIDE_SIZE) out.illegal += 1;

      if (keepersOn === 0) {
        out.emptyGoalFrames += 1;
        if (fieldOn === COURT_SIDE_SIZE) out.sevenOutFrames += 1;
        emptyFrames += 1;
      } else if (emptyFrames > 0) {
        out.keeperReturnSamples.push(emptyFrames * 0.05);
        emptyFrames = 0;
      }
    }

    // Shots the seven-out side faced while its own goal stood empty.
    const events = buildCanonicalMatchEvents(match);
    const emptyWindows = new Set<number>();
    for (const entry of match.trace) {
      const onCourt = entry.playerPositions.filter((p) => homeIds.has(p.playerId));
      const keeperIds = new Set(match.finalState.goalkeeperIds);
      if (onCourt.every((p) => !keeperIds.has(p.playerId))) emptyWindows.add(Math.round(entry.simulationTime * 20));
    }
    for (const shot of eventsOfType(events, "SHOT")) {
      if (shot.teamId === "HOME") continue;
      if (!emptyWindows.has(Math.round(shot.simulationTime * 20))) continue;
      out.shotsFacedWithEmptyGoal += 1;
    }
    for (const goal of eventsOfType(events, "GOAL")) {
      if (goal.teamId === "HOME") continue;
      if (!emptyWindows.has(Math.round(goal.simulationTime * 20))) continue;
      out.goalsConcededWithEmptyGoal += 1;
    }

    out.sevenOutRequests += match.segments.reduce(
      (n, s) => n + s.interventions.filter((i) => i.detail.includes("seven out") || i.detail.includes("comes back on")).length,
      0,
    );
  }

  return out;
}

const SEEDS = [1, 3, 5, 7, 11, 12] as const;

test("a match can be played with one side going seven out, and the court stays legal throughout", () => {
  const result = sweep(SEEDS);
  assert.equal(result.illegal, 0, "no instant of any match had an illegal side");
  assert.ok(result.sevenOutRequests > 0, "the coach actually asked for it");
  assert.ok(result.emptyGoalFrames > 0, "and the goal was genuinely empty for part of the match");
  assert.ok(result.sevenOutFrames > 0, "with seven outfield players on for part of it");
});

test("the whole sequence happens: keeper off, seven out, ball lost, empty goal attacked", () => {
  const result = sweep(SEEDS);
  // The opponent got shots away at a goal with nobody in it. This is the risk
  // 7v6 is supposed to carry, and it is not scripted anywhere -- M8 read an
  // empty goal and took what the court offered.
  assert.ok(
    result.shotsFacedWithEmptyGoal > 0,
    `the opponent shot at the empty goal (${result.shotsFacedWithEmptyGoal} shots, ${result.goalsConcededWithEmptyGoal} goals)`,
  );
});

test("the keeper takes real time to get back, every time", () => {
  const result = sweep(SEEDS);
  assert.ok(result.keeperReturnSamples.length > 0, "he came back at least once");
  assert.ok(
    result.keeperReturnSamples.every((seconds) => seconds > 0),
    "and never once appeared in his goal without having walked there",
  );
  const longest = Math.max(...result.keeperReturnSamples);
  assert.ok(longest > 1, `the walk back is a real one, not a formality (longest empty spell ${longest.toFixed(2)}s)`);
});

test("playing seven out is deterministic", () => {
  const a = simulateMatch(TOP, 12, { coaches: { HOME: sevenOutCoach("HOME") } });
  const b = simulateMatch(TOP, 12, { coaches: { HOME: sevenOutCoach("HOME") } });
  assert.equal(a.segments.length, b.segments.length);
  assert.deepEqual(
    a.segments.map((s) => [s.kind, s.outcome, s.team]),
    b.segments.map((s) => [s.kind, s.outcome, s.team]),
  );
});

test("seven out is not a HOME privilege", () => {
  // The same instruction given to the other side must work the same way, or the
  // feature is really about which end of the court a team happens to attack.
  const home = sweep([1, 3, 5]);
  const away = (() => {
    const out = { empty: 0, illegal: 0 };
    for (const seed of [1, 3, 5]) {
      const match = simulateMatch(TOP, seed, { coaches: { AWAY: sevenOutCoach("AWAY") } });
      const awayIds = new Set(match.finalState.rosters.AWAY);
      const keeperIds = new Set(match.finalState.goalkeeperIds);
      for (const entry of match.trace) {
        const onCourt = entry.playerPositions.filter((p) => awayIds.has(p.playerId));
        const keepersOn = onCourt.filter((p) => keeperIds.has(p.playerId)).length;
        if (onCourt.length > COURT_SIDE_SIZE || keepersOn > 1) out.illegal += 1;
        if (keepersOn === 0) out.empty += 1;
      }
    }
    return out;
  })();

  assert.equal(away.illegal, 0, "AWAY's court stays legal too");
  assert.ok(away.empty > 0, "and AWAY can genuinely empty its goal");
  assert.ok(home.emptyGoalFrames > 0, "as can HOME");
});
