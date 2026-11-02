// HM-ALPHA3-M03: knockout decider -- regulation untouched, overtime then shootout, always a winner.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveKnockoutDecider, matchWinnerClubId } from "./knockout.js";
import { simulateMatch } from "./matchEngine.js";
import type { ClubStrength, FastMatchResult } from "./types.js";

const strength = (attack: number, goalkeeper = 60): ClubStrength => ({ clubId: "x", overall: 60, attack, defense: 60, goalkeeper, depth: 60 });

function levelResult(goals = 28): FastMatchResult {
  const base = simulateMatch({ fixtureId: "f-1", seed: 7, homeClubId: "h", awayClubId: "a", homeStrength: strength(60), awayStrength: strength(60) });
  return { ...base, fixtureId: "f-1", homeGoals: goals, awayGoals: goals, homeStats: { ...base.homeStats, goals }, awayStats: { ...base.awayStats, goals } };
}

test("a decided result is returned unchanged", () => {
  const r = { ...levelResult(), homeGoals: 30, awayGoals: 27 };
  assert.equal(resolveKnockoutDecider({ result: r, seedPrefix: "s", homeStrength: strength(60), awayStrength: strength(60), overtimeRounds: 2 }), r);
});

test("a level game always produces a winner, deterministically, and overtime goals count in the score", () => {
  for (let i = 0; i < 200; i++) {
    const input = { result: levelResult(), seedPrefix: `seed-${i}`, homeStrength: strength(60), awayStrength: strength(60), overtimeRounds: 2 };
    const a = resolveKnockoutDecider(input);
    assert.deepEqual(resolveKnockoutDecider(input), a);
    assert.ok(a.decider, "decider recorded");
    assert.equal(matchWinnerClubId(a), a.decider!.winnerClubId);
    const otHome = a.decider!.overtime.reduce((s, o) => s + o.homeGoals, 0);
    const otAway = a.decider!.overtime.reduce((s, o) => s + o.awayGoals, 0);
    assert.equal(a.homeGoals, 28 + otHome);
    assert.equal(a.awayGoals, 28 + otAway);
    assert.ok(a.decider!.overtime.length >= 1 && a.decider!.overtime.length <= 2);
    if (a.decider!.method === "SHOOTOUT") {
      assert.equal(a.homeGoals, a.awayGoals, "a shootout only follows a level overtime");
      assert.notEqual(a.decider!.shootout!.home, a.decider!.shootout!.away);
    }
  }
});

test("cup rules: no overtime, straight to the shootout; two-legged ties compare the aggregate", () => {
  const cup = resolveKnockoutDecider({ result: levelResult(), seedPrefix: "cup", homeStrength: strength(60), awayStrength: strength(60), overtimeRounds: 0 });
  assert.equal(cup.decider!.method, "SHOOTOUT");
  assert.deepEqual(cup.decider!.overtime, []);
  const secondLeg = { ...levelResult(), homeGoals: 30, awayGoals: 27 };
  const decided = resolveKnockoutDecider({ result: secondLeg, seedPrefix: "agg", homeStrength: strength(60), awayStrength: strength(60), overtimeRounds: 0, aggregateBefore: { home: 25, away: 28 } });
  assert.ok(decided.decider, "30-27 after losing the first leg 25-28 is level on aggregate");
});
