import { test } from "node:test";
import assert from "node:assert/strict";
import type { MatchEvent } from "@handball-manager/game-simulation";
import { buildMatchStory, goalTimeline, ratingsColumn, restCandidates, workloadRows, type WorkloadInput } from "./matchReport";

const names = { home: "Tumba", away: "Ystad" };
function match(sides: ("h" | "a")[], minutes?: number[]) {
  let h = 0, a = 0;
  const events: MatchEvent[] = sides.map((s, i) => { if (s === "h") h++; else a++; return { minute: minutes?.[i] ?? (i + 1) * 2, side: s === "h" ? "home" : "away", type: "GOAL", homeScoreAfter: h, awayScoreAfter: a }; });
  return { events, homeGoals: h, awayGoals: a };
}

test("goal timeline keeps only goals with a score, in time order", () => {
  const r = match(["h", "a"], [10, 5]);
  const extra = { ...r, events: [...r.events, { minute: 3, side: "home", type: "SAVE" } as MatchEvent] };
  assert.deepEqual(goalTimeline(extra).map((g) => g.minute), [5, 10]);
});

test("flow is the goal difference from the report's own side", () => {
  const r = match(["h", "h", "a"]);
  assert.deepEqual(buildMatchStory(r, "home", names).flow.map((p) => p.diff), [1, 2, 1]);
  assert.deepEqual(buildMatchStory(r, "away", names).flow.map((p) => p.diff), [-1, -2, -1]);
});

test("a comeback: decisive goal, the deficit and a 'vände' headline; at most three turning points in time order", () => {
  // Away leads 0-4, home scores six in a row in the second half.
  const r = match(["a", "a", "a", "a", "h", "h", "h", "h", "h", "h"], [5, 10, 15, 20, 35, 40, 45, 48, 50, 52]);
  const s = buildMatchStory(r, "home", names, "Tumba");
  assert.equal(s.outcome, "W");
  assert.deepEqual(s.halfTime, { home: 0, away: 4 });
  assert.equal(s.maxLead.opp, 4);
  assert.ok(s.turningPoints.length <= 3 && s.turningPoints.length >= 2);
  assert.deepEqual(s.turningPoints.map((t) => t.minute), [...s.turningPoints.map((t) => t.minute)].sort((a, b) => a - b));
  const decisive = s.turningPoints.find((t) => t.kind === "DECISIVE");
  assert.deepEqual(decisive?.score, { home: 5, away: 4 });
  assert.equal(decisive?.tone, "for");
  assert.match(s.headline, /vände och vann/);
  assert.match(s.kicker, / i Tumba$/);
  assert.ok(s.runs.some((run) => run.own && run.goals === 6));
});

test("a draw has no decisive goal; the last equaliser is a turning point", () => {
  const r = match(["h", "a", "h", "a"]);
  const s = buildMatchStory(r, "away", names);
  assert.equal(s.outcome, "D");
  assert.ok(!s.turningPoints.some((t) => t.kind === "DECISIVE"));
  assert.deepEqual(s.turningPoints.find((t) => t.kind === "EQUALISER")?.score, { home: 2, away: 2 });
  assert.match(s.headline, /delade på poängen, 2–2/);
  assert.equal(s.leadChanges, 0);
});

test("the same result always reads the same (deterministic copy)", () => {
  const r = match(["h", "a", "a", "h", "h", "h"]);
  assert.deepEqual(buildMatchStory(r, "home", names), buildMatchStory(r, "home", names));
});

test("a match without goal events degrades: no flow, no turning points, but a headline", () => {
  const s = buildMatchStory({ events: [], homeGoals: 25, awayGoals: 22 }, "home", names);
  assert.equal(s.flow.length, 0);
  assert.equal(s.turningPoints.length, 0);
  assert.equal(s.halfTime, null);
  assert.match(s.headline, /Tumba besegrade Ystad, 25–22/);
});

test("ratings column merges both sides, best first", () => {
  const c = (playerId: string, rating: number) => ({ playerId, goals: 1, shots: 2, rating, started: true });
  const rows = ratingsColumn({ homePlayerContributions: [c("a", 6.5), c("b", 8.1)], awayPlayerContributions: [c("x", 7.2)] });
  assert.deepEqual(rows.map((r) => [r.playerId, r.side]), [["b", "home"], ["x", "away"], ["a", "home"]]);
});

test("workload rows: highest risk first, only players who played; bulk rest skips resting players", () => {
  const p = (id: string, minutes: number, energy: number, week: number | null, typical: number | null, setting: WorkloadInput["setting"] = "FULL"): WorkloadInput => ({ id, name: id, minutes, energy, workload: minutes, estimated: false, week, typical, setting });
  const rows = workloadRows([p("fresh", 20, 90, 100, 100), p("bench", 0, 100, null, null), p("tired", 55, 52, 150, 100), p("heavy", 58, 80, 160, 100), p("long", 52, 80, 100, 100, "REST")]);
  assert.deepEqual(rows.map((r) => r.id), ["heavy", "tired", "long", "fresh"]);
  assert.equal(rows[0].risk, "HIGH");
  assert.equal(rows.at(-1)!.risk, "LOW");
  assert.ok(rows.find((r) => r.id === "heavy")!.reasons.some((x) => x.includes("60 %")));
  assert.deepEqual(restCandidates(rows), ["heavy", "tired"]);
});

test("lessons come only from stats where we clearly lost the comparison, at most three", async () => {
  const { matchLessons } = await import("./matchReport");
  const s = (o: Partial<import("@handball-manager/game-simulation").TeamMatchStats>) => ({ goals: 25, shots: 50, shootingPct: 50, saves: 12, shotsFaced: 40, turnovers: 10, twoMinuteSuspensions: 2, sevenMetreGoals: 2, sevenMetreAttempts: 3, ...o });
  assert.deepEqual(matchLessons({ homeStats: s({}), awayStats: s({}), events: [] }, "home"), []);
  const l = matchLessons({ homeStats: s({ turnovers: 16, goals: 20 }), awayStats: s({ turnovers: 9, goals: 30 }), events: [] }, "home");
  assert.deepEqual(l.map((x) => x.id), ["turnovers", "finishing"]);
  assert.ok(l.every((x) => x.href.startsWith("/career/")));
  assert.deepEqual(matchLessons({ homeStats: s({ turnovers: 16 }), awayStats: s({ turnovers: 9 }), events: [] }, "away"), [], "the other side's problem is not ours");
});
