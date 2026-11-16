// Arena Nights MGR-03 / MGR-03a: the projected path and the ghost bracket follow the verified rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { StandingRow } from "@handball-manager/game-simulation";
import { ALLSVENSKAN, HANDBOLLSLIGAN, SM_SLUTSPEL } from "../competition/rules";
import type { CompetitionTie } from "../competition/types";
import { buildSeasonPath, ghostBracket } from "./seasonPath";

const table = (prefix: string, n = 14): StandingRow[] => Array.from({ length: n }, (_, i) => ({ clubId: `${prefix}${i + 1}`, played: 10, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 30 - i * 2 }));
const tables = { [HANDBOLLSLIGAN]: table("h"), [ALLSVENSKAN]: table("a") };

test("ghost bracket pairs 1-8, 4-5, 2-7, 3-6 and marks the route", () => {
  const g = ghostBracket({ me: "h5", tables, ties: [] })!;
  assert.equal(g.hypothetical, true);
  assert.deepEqual(g.rounds[0]!.ties.map((t) => [t.high!.seed, t.low!.seed]), [[1, 8], [4, 5], [2, 7], [3, 6]]);
  assert.deepEqual(g.myPath, ["QF2", "SF1", "F"]);
});

test("real ties replace the projection", () => {
  const qf: CompetitionTie = { id: "s:sm:QF2", seasonId: "s", competitionId: SM_SLUTSPEL, stage: "QF", label: "Kvartsfinal 2", highClubId: "h4", lowClubId: "h5", format: { kind: "SINGLE" }, fixtureIds: [], key: "QF2", winnerClubId: "h4", loserClubId: "h5" };
  const g = ghostBracket({ me: "h5", tables, ties: [qf] })!;
  assert.equal(g.hypothetical, false);
  assert.equal(g.rounds[0]!.ties[1]!.tie, qf);
  assert.equal(g.rounds[1]!.ties[0]!.high, null, "QF1 not decided yet");
  assert.equal(g.rounds[1]!.ties[0]!.low!.clubId, "h4");
  assert.deepEqual(g.myPath, ["QF2"], "eliminated: the route stops");
});

test("HBL top eight: path through the projected quarter-final to gold", () => {
  const p = buildSeasonPath({ me: "h5", competitionId: HANDBOLLSLIGAN, phase: "REGULAR", tables, ties: [] });
  assert.equal(p.hypothetical, true);
  assert.deepEqual(p.nodes.map((n) => n.label), ["5:e", "KF", "SF", "Final", "Guld"]);
  assert.equal(p.nodes[1]!.opponentId, "h4");
  assert.match(p.headline, /3 poäng till 4:e plats = hemmafördel/);
  assert.deepEqual(p.threats.map((t) => t.clubId), ["h4", "h6"]);
});

test("HBL kval zone and Allsvenskan promotion kval use the verified pairs", () => {
  const hbl = buildSeasonPath({ me: "h12", competitionId: HANDBOLLSLIGAN, phase: "REGULAR", tables, ties: [] });
  assert.equal(hbl.nodes[1]!.label, "Kval");
  assert.equal(hbl.nodes[1]!.opponentId, "a3");
  const all = buildSeasonPath({ me: "a2", competitionId: ALLSVENSKAN, phase: "REGULAR", tables, ties: [] });
  assert.equal(all.nodes[1]!.opponentId, "h13");
  const top = buildSeasonPath({ me: "a1", competitionId: ALLSVENSKAN, phase: "REGULAR", tables, ties: [] });
  assert.equal(top.nodes[1]!.title, "Direkt till Handbollsligan");
});
