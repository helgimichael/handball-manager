// Arena Nights -- CMP-01g cup path, CMP-02 head-to-head and CMP-04 position leaders: pure reads of saved data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ALLSVENSKAN, SVENSKA_CUPEN } from "./rules";
import type { CompetitionTie } from "./types";
import { cupCentre } from "./cupCentre";
import { headToHead } from "./headToHead";
import { positionLeaders, rankPlayers } from "./leaderboards";
import { getCareerSquad } from "../career/careerWorld";
import { leagueCareer, playRounds } from "./competitionTestCareer";

test("cup centre: nothing drawn means no stages beyond the plan and no bracket", () => {
  const s = { ...leagueCareer(), competitionTies: {} };
  const c = cupCentre(s);
  assert.equal(c.ties.length, 0);
  assert.equal(c.bracket.length, 0);
  assert.ok(c.stages.every((x) => x.status === "UPCOMING" && x.own === null));
});

test("cup centre: a decided round is DONE, the next is CURRENT, and the own path is marked", () => {
  const base = leagueCareer();
  const me = base.playerClubId;
  const [a, b, c] = base.fixtures.flatMap((f) => [f.homeClubId, f.awayClubId]).filter((id, i, all) => id !== me && all.indexOf(id) === i);
  const tie = (id: string, stage: CompetitionTie["stage"], high: string, low: string, winner?: string): CompetitionTie => ({ id, seasonId: base.seasonId, competitionId: SVENSKA_CUPEN, stage, label: id, highClubId: high, lowClubId: low, format: { kind: "SINGLE" }, fixtureIds: [], key: id, winnerClubId: winner, loserClubId: winner ? (winner === high ? low : high) : undefined });
  const s = { ...base, competitionTies: { r1: tie("r1", "CUP_R16", me, a!, me), r2: tie("r2", "CUP_R16", b!, c!, b), q1: tie("q1", "CUP_QF", me, b!) } };
  const cup = cupCentre(s);
  const r16 = cup.stages.find((x) => x.stage === "CUP_R16")!, qf = cup.stages.find((x) => x.stage === "CUP_QF")!;
  assert.equal(r16.status, "DONE");
  assert.equal(r16.own, "THROUGH");
  assert.equal(qf.status, "CURRENT");
  assert.equal(qf.own, "IN");
  assert.equal(cup.bracket.map((r) => r.stage).join(","), "CUP_R16,CUP_QF");
  assert.ok(cup.bracket[0]!.ties.find((t) => t.id === "r1")!.own);
  assert.equal(cup.ownOut, null);
});

test("head-to-head: mirrored metrics from the tables, meetings only between the two clubs", () => {
  const s = playRounds(leagueCareer(), 10);
  const upcoming = s.fixtures.find((f) => f.type === "LEAGUE" && !s.results[f.id] && s.fixtures.some((g) => g.id !== f.id && s.results[g.id] && ((g.homeClubId === f.awayClubId && g.awayClubId === f.homeClubId) || (g.homeClubId === f.homeClubId && g.awayClubId === f.awayClubId))));
  const fixture = upcoming ?? s.fixtures.find((f) => f.type === "LEAGUE" && !s.results[f.id])!;
  const h = headToHead(s, fixture);
  assert.equal(h.home.clubId, fixture.homeClubId);
  assert.equal(h.away.clubId, fixture.awayClubId);
  assert.ok(h.home.position !== null && h.away.position !== null);
  assert.equal(h.metrics[0]!.label, "Tabellplacering");
  for (const m of h.meetings) {
    assert.ok(new Set([m.homeClubId, m.awayClubId]).has(fixture.homeClubId) && new Set([m.homeClubId, m.awayClubId]).has(fixture.awayClubId));
    assert.notEqual(m.fixtureId, fixture.id);
  }
  assert.equal(h.record.homeWins + h.record.awayWins + h.record.draws, h.meetings.length);
});

test("leaders: one card per court position, each scoped to the competition and ranked by its own yardstick", () => {
  const s = leagueCareer();
  const squad = getCareerSquad(s);
  const keeper = squad.find((p) => p.position === "MV")!, wing = squad.find((p) => p.position === "V6")!;
  const stats = { ...s.playerSeasonStats,
    [keeper.id]: { playerId: keeper.id, appearances: 6, starts: 6, goals: 0, shots: 0, saves: 60, shotsFaced: 150, ratingSum: 42 },
    [wing.id]: { playerId: wing.id, appearances: 6, starts: 6, goals: 30, shots: 40, saves: 0, shotsFaced: 0, ratingSum: 40 } };
  const cards = positionLeaders({ ...s, playerSeasonStats: stats }, ALLSVENSKAN);
  assert.deepEqual(cards.map((c) => c.position), ["MV", "V6", "V9", "M9", "M6", "H9", "H6"]);
  assert.equal(cards[0]!.leaders[0]!.player.id, keeper.id);
  assert.equal(cards[0]!.leaders[0]!.value, "40 %");
  assert.equal(cards[1]!.leaders[0]!.player.id, wing.id);
  assert.equal(cards[1]!.leaders[0]!.value, "30");
  // Another competition does not see these players; position filter narrows the table.
  assert.equal(rankPlayers({ ...s, playerSeasonStats: stats }, "se_handbollsligan_herr", { metric: "goals", minimum: 1, position: "ALL" }).length, 0);
  assert.ok(rankPlayers({ ...s, playerSeasonStats: stats }, ALLSVENSKAN, { metric: "goals", minimum: 1, position: "V6" }).every((r) => r.player.position === "V6"));
});
