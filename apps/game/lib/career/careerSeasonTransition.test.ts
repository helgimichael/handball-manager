// HM-M9A-C: manager-mode rule package, live season evidence and club destinations.
// Targeted data: the canonical 28 top-two-tier clubs, a completed synthetic
// league season (seasonTransition.fixtures.ts) and KVAL_HBL series written in
// exactly the live engine's format (competition/season.ts tieFixtures).
import test from "node:test";
import assert from "node:assert/strict";
import type { FastMatchResult, TeamMatchStats } from "@handball-manager/game-simulation";
import { syntheticTransitionCareer } from "./seasonTransition.fixtures";
import { buildCareerTransitionRequest, deriveNextKickoffDate, managerModeLicence, managerModePackageOptions, transitionCareerSeason } from "./careerTransitionEvidence";
import { attemptSeasonTransition } from "./seasonTransition";
import { managerModeRules, MANAGER_MODE_AUTHORITY } from "../competition/transition/careerRules";
import { SWEDISH_2026_RULES, SWEDISH_LEAGUES as L } from "../competition/transition/sweden2026";
import { validatePlannerInput } from "../competition/transition/validation";
import { snapshotCompetitionTransitionInput } from "../competition/transition/careerSnapshot";
import { competitionTable, competitionClubIds } from "../competition/tables";
import { KVAL_HBL, KVAL_HBL_RULES } from "../competition/rules";
import { CLUBS } from "../game-data";
import type { CareerFixture, CareerState } from "./types";
import type { CompetitionTie } from "../competition/types";

const stats = (goals: number): TeamMatchStats => ({ goals, shots: 40, shootingPct: goals / 40, saves: 10, shotsFaced: 40, turnovers: 5, twoMinuteSuspensions: 0, sevenMetreGoals: 0, sevenMetreAttempts: 0 });
const result = (f: CareerFixture, homeGoals: number, awayGoals: number, decider?: FastMatchResult["decider"]): FastMatchResult => ({ fixtureId: f.id, seed: 1, homeClubId: f.homeClubId, awayClubId: f.awayClubId, homeGoals, awayGoals, homeStats: stats(homeGoals), awayStats: stats(awayGoals), events: [], homePlayerContributions: [], awayPlayerContributions: [], ...(decider ? { decider } : {}) });

/**
 * Adds the three KVAL_HBL series as the live engine would have played them:
 * HBL 11-13 (high) v Allsvenskan 4-2 (low), home pattern LOW,HIGH,HIGH,...
 * `challengersWin` decides every series 3-0 for one side. Game 1 of K1 is a
 * level score settled by a shoot-out, to exercise the decider path.
 */
function withLiveKval(state: CareerState, challengersWin: boolean): CareerState {
  const hbl = competitionTable(state, L.hbl).map((r) => r.clubId);
  const allsv = competitionTable(state, L.allsvenskan).map((r) => r.clubId);
  let next = state;
  KVAL_HBL_RULES.pairs.forEach(([h, a], i) => {
    const high = hbl[h - 1]!, low = allsv[a - 1]!;
    const winner = challengersWin ? low : high;
    const tieId = `${state.seasonId}:kval-hbl:K${i + 1}`;
    const fixtures: CareerFixture[] = KVAL_HBL_RULES.series.homePattern.slice(0, 3).map((side, k) => {
      const home = side === "HIGH" ? high : low;
      return { id: `2027-kval-K${i + 1}-g${k + 1}`, competitionId: KVAL_HBL, round: k + 1, date: `2027-04-${10 + k}`, homeClubId: home, awayClubId: home === high ? low : high, type: "QUALIFIER", stage: { tieId, game: k + 1, mustDecide: true } };
    });
    const results = Object.fromEntries(fixtures.map((f, k) => {
      if (i === 0 && k === 0) return [f.id, result(f, 25, 25, { overtime: { home: 2, away: 2 } as never, shootout: { home: 3, away: 2, kicks: [] } as never, winnerClubId: winner, method: "SHOOTOUT" } as never)];
      return [f.id, f.homeClubId === winner ? result(f, 28, 24) : result(f, 24, 28)];
    }));
    const tie: CompetitionTie = { id: tieId, seasonId: state.seasonId, competitionId: KVAL_HBL, stage: "KVAL_HBL", label: `Kval ${i + 1}`, highClubId: high, lowClubId: low, format: { kind: "SERIES", series: KVAL_HBL_RULES.series }, fixtureIds: fixtures.map((f) => f.id), key: `K${i + 1}`, winnerClubId: winner, loserClubId: winner === high ? low : high, stakes: { highCompetitionId: L.hbl, lowCompetitionId: L.allsvenskan } } as CompetitionTie;
    next = { ...next, fixtures: [...next.fixtures, ...fixtures], results: { ...next.results, ...results }, competitionTies: { ...next.competitionTies, [tie.id]: tie } };
  });
  return next;
}

const season = syntheticTransitionCareer();

test("M9A: the manager-mode package is explicit, complete and keeps validation intact", () => {
  const rules = managerModeRules(2026);
  assert.equal(rules.authority, MANAGER_MODE_AUTHORITY);
  assert.deepEqual(rules.limitations, []);
  assert.equal(rules.seasonId, "2026/27");
  assert.equal(rules.nextSeasonId, "2027/28");
  assert.deepEqual(rules.leagues.map((l) => l.id).sort(), [L.allsvenskan, L.hbl].sort());
  assert.deepEqual(rules.stages.map((s) => s.id), ["hbl-11", "hbl-12", "hbl-13"]);
  // The verified interchange is unchanged; the lower boundary is closed.
  const entry = (c: string, r: number) => rules.entries.find((e) => e.selector.kind === "RANK" && e.selector.competitionId === c && e.selector.rank === r)!;
  assert.equal(entry(L.hbl, 14).purpose, "DIRECT");
  assert.equal(entry(L.allsvenskan, 1).purpose, "DIRECT");
  for (const r of [11, 12, 13, 14]) assert.equal(entry(L.allsvenskan, r).purpose, "RETAIN");
  assert.deepEqual(rules.stages.map((s) => s.homeOrder), SWEDISH_2026_RULES.stages.filter((s) => s.id.startsWith("hbl-")).map((s) => s.homeOrder));
  // The official package is untouched and still carries its permanent limitations.
  assert.equal(SWEDISH_2026_RULES.authority, undefined);
  assert.ok(SWEDISH_2026_RULES.limitations.some((l) => l.code === "ADMINISTRATIVE_REVIEW_REQUIRED"));
  assert.deepEqual(validatePlannerInput(snapshotCompetitionTransitionInput(season, {}, rules)), []);
  for (const variant of [managerModeRules(2026, { frozen: true }), managerModeRules(2026, { interchangeLeagues: [L.hbl] }), managerModeRules(2026, { closedLeagues: [{ id: L.norra, size: 12 }] })]) {
    assert.equal(variant.authority, MANAGER_MODE_AUTHORITY);
    assert.ok(variant.entries.every((e) => e.purpose === "RETAIN" || variant.id.includes("hbl-allsvenskan")));
  }
});

test("M9A/D3: every active club is licensed through the single licence hook", () => {
  assert.equal(managerModeLicence(season, CLUBS[0]!.id, "se-men-tier-1").status, "ELIGIBLE");
  const request = buildCareerTransitionRequest(season);
  assert.ok(request.evidence!.eligibility!.length >= 28 * 2);
  assert.ok(request.evidence!.eligibility!.every((e) => e.status === "ELIGIBLE" && e.evidence.trim()));
});

test("M9A/D2: next kickoff is derived from this season's own calendar -- same week and weekday, one year on", () => {
  const base = { ...season, fixtures: season.fixtures.map((f, i) => (i === 0 ? { ...f, date: "2026-09-23" } : f)) } as CareerState;
  const earliest = base.fixtures.filter((f) => f.type === "LEAGUE").map((f) => f.date).sort()[0]!;
  const kickoff = deriveNextKickoffDate(base, [L.hbl, L.allsvenskan]);
  assert.equal(new Date(`${kickoff}T00:00:00Z`).getUTCDay(), new Date(`${earliest}T00:00:00Z`).getUTCDay());
  assert.ok(kickoff.startsWith("2027-"));
  assert.ok(Math.abs(Date.parse(kickoff) - Date.parse(`2027${earliest.slice(4)}`)) <= 3 * 86_400_000);
  assert.notEqual(kickoff, "2027-09-20", "no fixed date");
  assert.ok(kickoff > base.gameDate);
  assert.equal(deriveNextKickoffDate(base, [L.hbl, L.allsvenskan]), kickoff, "deterministic");
});

for (const challengersWin of [true, false]) {
  test(`M9B/M9C: the live season (${challengersWin ? "Allsvenskan challengers win" : "HBL clubs hold"} the kval) drives every destination`, () => {
    const done = withLiveKval(season, challengersWin);
    const hbl = competitionTable(done, L.hbl).map((r) => r.clubId);
    const allsv = competitionTable(done, L.allsvenskan).map((r) => r.clubId);
    const request = buildCareerTransitionRequest(done);
    assert.equal(request.evidence!.qualificationFixtures!.length, 9, "every live kval game is evidence");
    assert.ok(request.evidence!.qualificationFixtures!.some((f) => f.result?.decider), "a level score carries its shoot-out decider");
    const outcome = attemptSeasonTransition(done, request);
    assert.equal(outcome.status, "APPLIED", JSON.stringify(outcome.blockers.slice(0, 5)));
    const m = outcome.state.competitionMembership!;
    // Direct moves.
    assert.equal(m[allsv[0]!], L.hbl, "Allsvenskan winner promoted");
    assert.equal(m[hbl[13]!], L.allsvenskan, "HBL 14th relegated");
    // Kval moves follow the live series winners.
    KVAL_HBL_RULES.pairs.forEach(([h, a]) => {
      assert.equal(m[hbl[h - 1]!], challengersWin ? L.allsvenskan : L.hbl);
      assert.equal(m[allsv[a - 1]!], challengersWin ? L.hbl : L.allsvenskan);
    });
    // Everyone else stays; the lower boundary is closed.
    for (const id of hbl.slice(0, 10)) assert.equal(m[id], L.hbl);
    for (const id of allsv.slice(4)) assert.equal(m[id], L.allsvenskan);
    // Every one of the 28 clubs has exactly one destination, sizes hold, nobody disappears.
    assert.equal(outcome.preview!.proposal.clubs.filter((c) => c.status !== "CONFIRMED").length, 0, "no CLUB_DESTINATION_UNRESOLVED");
    assert.equal(competitionClubIds(outcome.state, L.hbl).length, 14);
    assert.equal(competitionClubIds(outcome.state, L.allsvenskan).length, 14);
    assert.deepEqual([...competitionClubIds(outcome.state, L.hbl), ...competitionClubIds(outcome.state, L.allsvenskan)].sort(), [...hbl, ...allsv].sort());
    // Division 1 membership is not touched.
    for (const c of CLUBS.filter((c) => c.competitionId.startsWith("se_division1"))) assert.equal(m[c.id] ?? c.competitionId, done.competitionMembership?.[c.id] ?? c.competitionId);
  });
}

test("M9B: the same completed season always yields the same request and plan", () => {
  const done = withLiveKval(season, true);
  assert.deepEqual(buildCareerTransitionRequest(done), buildCareerTransitionRequest(done));
  const a = transitionCareerSeason(done), b = transitionCareerSeason(done);
  assert.deepEqual(a.state.competitionMembership, b.state.competitionMembership);
  assert.deepEqual(a.state.fixtures.map((f) => f.id), b.state.fixtures.map((f) => f.id));
});

test("M9C: a season without its kval results stays BLOCKED, untouched and retryable", () => {
  const blocked = transitionCareerSeason(season);
  assert.equal(blocked.status, "BLOCKED");
  assert.equal(blocked.state, season);
  const retried = transitionCareerSeason(withLiveKval(season, true));
  assert.equal(retried.status, "APPLIED");
});

test("M9F: package options follow what the season actually played", () => {
  assert.deepEqual(managerModePackageOptions(withLiveKval(season, true)), { frozen: false, interchangeLeagues: [L.hbl, L.allsvenskan], closedLeagues: [] });
});
