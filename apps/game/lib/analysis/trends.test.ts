import { test } from "node:test";
import assert from "node:assert/strict";
import type { TeamMatchStats } from "@handball-manager/game-simulation";
import type { ClubMatchStatRow } from "./types";
import { fmtMetric, kpiTiles, mirrorRows, trendSeries, whatChanged, windowPlayerTotals } from "./trends";
import { threatCards } from "./threats";
import type { OpponentScoutReport } from "../scouting/opponentScouting";

const stats = (goals: number, shots: number, extra: Partial<TeamMatchStats> = {}): TeamMatchStats => ({ goals, shots, shootingPct: 0, saves: 10, shotsFaced: 30, turnovers: 10, twoMinuteSuspensions: 2, sevenMetreGoals: 3, sevenMetreAttempts: 4, ...extra });
function row(i: number, gf: number, ga: number, extra: Partial<TeamMatchStats> = {}): ClubMatchStatRow {
  return { fixtureId: `f${i}`, date: `2026-09-${String(i + 1).padStart(2, "0")}`, round: i + 1, opponentClubId: `c${i}`, isHome: i % 2 === 0, goalsFor: gf, goalsAgainst: ga, result: gf > ga ? "W" : gf < ga ? "L" : "D", own: stats(gf, 50, extra), opponent: stats(ga, 50), events: [] };
}

test("trend series: one point per match and a rolling average over the last three", () => {
  const rows = [row(0, 20, 25), row(1, 26, 24), row(2, 29, 22)];
  const s = trendSeries(rows, "GF");
  assert.deepEqual(s.map((p) => p.value), [20, 26, 29]);
  assert.equal(s[2].rolling, 25);
  assert.equal(s[0].rolling, 20);
});

test("kpi tiles compare the last five with the season; no delta without a longer season", () => {
  const short = kpiTiles([row(0, 20, 25), row(1, 22, 25)]);
  assert.equal(short.find((t) => t.id === "GF")!.delta, null);
  const rows = [row(0, 20, 30), row(1, 20, 30), row(2, 20, 30), row(3, 30, 20), row(4, 30, 20), row(5, 30, 20), row(6, 30, 20), row(7, 30, 20)];
  const gf = kpiTiles(rows).find((t) => t.id === "GF")!;
  assert.equal(gf.recent, 30);
  assert.ok(gf.delta! > 0 && gf.better === true);
  const ga = kpiTiles(rows).find((t) => t.id === "GA")!;
  assert.ok(ga.delta! < 0 && ga.better === true, "fewer conceded is better");
});

test("what changed: biggest relative changes only, with a link to act on", () => {
  const rows = [row(0, 20, 30, { turnovers: 8 }), row(1, 20, 30, { turnovers: 8 }), row(2, 20, 30, { turnovers: 8 }), row(3, 30, 20, { turnovers: 16 }), row(4, 30, 20, { turnovers: 16 }), row(5, 30, 20, { turnovers: 16 }), row(6, 30, 20, { turnovers: 16 }), row(7, 30, 20, { turnovers: 16 })];
  const cards = whatChanged(rows);
  assert.ok(cards.length > 0 && cards.length <= 3);
  for (let i = 1; i < cards.length; i++) assert.ok(Math.abs(cards[i - 1].relative) >= Math.abs(cards[i].relative));
  assert.ok(cards.every((c) => c.href.startsWith("/career/")));
  assert.equal(whatChanged(rows.slice(0, 5)).length, 0, "no season to compare with");
});

test("mirror: who is stronger respects lower-is-better metrics and missing data", () => {
  const them = [row(0, 30, 20, { turnovers: 6 })], us = [row(1, 25, 25, { turnovers: 12 })];
  const m = mirrorRows(them, us);
  assert.equal(m.find((r) => r.id === "GF")!.stronger, "them");
  assert.equal(m.find((r) => r.id === "TURNOVERS")!.stronger, "them");
  assert.equal(mirrorRows([], us).find((r) => r.id === "GF")!.stronger, null);
});

test("window-aware player totals sum only the given matches from the stored contributions", () => {
  const c = (playerId: string, goals: number, rating: number) => ({ playerId, goals, shots: goals + 2, rating, started: true });
  const results = {
    f0: { homePlayerContributions: [c("p1", 5, 8)], awayPlayerContributions: [c("x", 9, 9)] },
    f1: { homePlayerContributions: [c("x", 9, 9)], awayPlayerContributions: [c("p1", 3, 6)] },
  } as never;
  const totals = windowPlayerTotals({ results }, [row(0, 0, 0), row(1, 0, 0)]);
  assert.deepEqual(totals.map((t) => [t.playerId, t.matches, t.goals, t.averageRating]), [["p1", 2, 8, 7]]);
  assert.equal(windowPlayerTotals({ results }, [row(1, 0, 0)])[0].goals, 3);
});

test("format: decimals with comma, percentages whole, missing as a dash", () => {
  assert.equal(fmtMetric(25.25, false), "25,3");
  assert.equal(fmtMetric(0.456, true), "46 %");
  assert.equal(fmtMetric(null, true), "—");
});

test("threat cards: scouting claims carry the report's confidence; LOW claims are gated; results fill in", () => {
  const report = { reliability: 0.72, recommendations: ["Mot 6–0 ger skott från distans bäst lägen."], scouted: [
    { topic: "Försvarsstruktur", text: "Spelar troligen 6–0-försvar.", confidence: "MEDIUM" },
    { topic: "Tempo", text: "Anfallstempot är högt.", confidence: "LOW" },
    { topic: "Trolig startsjua", text: "…", confidence: "HIGH" },
  ] } as unknown as OpponentScoutReport;
  const mirror = mirrorRows([row(0, 32, 20)], [row(1, 24, 26)]);
  const cards = threatCards(report, mirror);
  assert.ok(cards.length <= 4);
  assert.equal(cards[0].id, "claim:Försvarsstruktur");
  assert.equal(cards[0].confidencePct, 72);
  assert.match(cards[0].answer, /^Mot 6–0/);
  assert.ok(!cards.some((c) => c.id === "claim:Tempo"), "LOW claim left out when a trusted one exists");
  assert.ok(cards.some((c) => c.source === "RESULTS" && c.confidence === "FACT"));
  const none = threatCards(undefined, mirror);
  assert.ok(none.every((c) => c.source === "RESULTS"));
  assert.ok(none.every((c) => c.href.startsWith("/career/tactics")));
});
