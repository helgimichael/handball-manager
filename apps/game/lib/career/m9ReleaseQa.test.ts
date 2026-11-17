// HM-M9 FINAL OWNER-RELEASE QA: the manager's own club promoted and relegated,
// squads/contracts/loans/registrations across rollover, stale state, save
// compatibility, rollback and retry. Targeted data (the canonical 28 top-two-tier
// clubs, synthetic completed season, live-format kval); season 2 is played up to
// and including the manager's first league match through the real daily tick.
import test from "node:test";
import assert from "node:assert/strict";
import { syntheticTransitionCareer, withSyntheticLiveKval } from "./seasonTransition.fixtures";
import { transitionCareerSeason, buildCareerTransitionRequest } from "./careerTransitionEvidence";
import { attemptSeasonTransition } from "./seasonTransition";
import { processDay } from "./dailyTick";
import { addDays } from "./dateUtils";
import { getPlayerFixtureOn } from "./calendar";
import { playManagerFixtureLegacy } from "./legacy/matchday";
import { migrateCareerState } from "./saveMigration";
import { clubCompetitionId } from "./competitionMembership";
import { loanPlayerOut } from "../transfers/transferExecution";
import { competitionTable, competitionClubIds } from "../competition/tables";
import { SWEDISH_LEAGUES as L } from "../competition/transition/sweden2026";
import { CLUBS } from "../game-data";
import type { CareerState } from "./types";

const base = withSyntheticLiveKval(syntheticTransitionCareer(), true);
const hbl = competitionTable(base, L.hbl).map((r) => r.clubId);
const allsv = competitionTable(base, L.allsvenskan).map((r) => r.clubId);
const PROMOTED = allsv[0]!; // Allsvenskan winner: direct promotion
const RELEGATED = hbl[13]!; // HBL 14th: direct relegation

function asManager(state: CareerState, clubId: string): CareerState {
  return { ...state, playerClubId: clubId, competitionId: clubCompetitionId(state, clubId)! };
}

/** Runs the real daily tick from the transition date to the manager's first league match and plays it. */
function playToFirstManagerMatch(state: CareerState): CareerState {
  let s: CareerState = { ...state, processedThroughDate: state.gameDate };
  let date = s.gameDate;
  const first = s.fixtures.filter((f) => f.type === "LEAGUE" && (f.homeClubId === s.playerClubId || f.awayClubId === s.playerClubId)).map((f) => f.date).sort()[0]!;
  while (date < first) {
    date = addDays(date, 1);
    s = processDay(s, date).state;
  }
  const fixture = getPlayerFixtureOn(s, first) ?? s.fixtures.find((f) => f.type === "LEAGUE" && f.date === first && (f.homeClubId === s.playerClubId || f.awayClubId === s.playerClubId))!;
  if (!s.results[fixture.id]) s = playManagerFixtureLegacy(s).state;
  return s;
}

function assertManagerSeasonTwo(next: CareerState, clubId: string, league: string, otherLeague: string): void {
  assert.equal(next.competitionId, league, "the manager follows his club into its new league");
  assert.equal(clubCompetitionId(next, clubId), league);
  const own = next.fixtures.filter((f) => f.type === "LEAGUE" && (f.homeClubId === clubId || f.awayClubId === clubId));
  assert.equal(own.length, 26);
  assert.ok(own.every((f) => f.competitionId === league));
  assert.ok(!next.fixtures.some((f) => f.competitionId === otherLeague && (f.homeClubId === clubId || f.awayClubId === clubId)));
  const played = playToFirstManagerMatch(next);
  const firstResult = played.fixtures.filter((f) => f.type === "LEAGUE" && f.competitionId === league && played.results[f.id] && (f.homeClubId === clubId || f.awayClubId === clubId));
  assert.ok(firstResult.length >= 1, "the manager's first season-2 league match is played");
  assert.ok(competitionTable(played, league).some((r) => r.clubId === clubId && r.played >= 1), "the club is in its new league table");
  assert.ok(!competitionTable(played, otherLeague).some((r) => r.clubId === clubId), "and not in the old one");
  assert.ok(played.fixtures.some((f) => f.type === "CUP"), "Svenska cupen joins the new season through the existing calendar flow");
}

test("QA-1: the manager's own club is promoted -- he plays season 2 in Handbollsligan", { timeout: 300_000 }, () => {
  const done = asManager(base, PROMOTED);
  assert.equal(done.competitionId, L.allsvenskan);
  const t = transitionCareerSeason(done);
  assert.equal(t.status, "APPLIED", JSON.stringify(t.blockers.slice(0, 5)));
  assertManagerSeasonTwo(t.state, PROMOTED, L.hbl, L.allsvenskan);
});

test("QA-2: the manager's own club is relegated -- he plays season 2 in Allsvenskan", { timeout: 300_000 }, () => {
  const done = asManager(base, RELEGATED);
  assert.equal(done.competitionId, L.hbl);
  const t = transitionCareerSeason(done);
  assert.equal(t.status, "APPLIED", JSON.stringify(t.blockers.slice(0, 5)));
  assertManagerSeasonTwo(t.state, RELEGATED, L.allsvenskan, L.hbl);
});

test("QA-3: squads, contracts, ratings, loans and registrations carry across the rollover unchanged", () => {
  // An active loan across the boundary: a relegated club's player on loan at the promoted club.
  const loanee = base.worldSquads[RELEGATED]!.find((p) => base.playerContracts[p.id]?.clubId === RELEGATED)!;
  const original = base.playerContracts[loanee.id]!.wageEurPerMonth;
  let state = loanPlayerOut(base, loanee.id, RELEGATED, PROMOTED);
  state = { ...state, loans: { ...state.loans, "qa-loan": { id: "qa-loan", playerId: loanee.id, parentClubId: RELEGATED, borrowingClubId: PROMOTED, startDate: state.gameDate, endDate: "2027-12-31", wageShareBorrowingPct: 100, originalWageEurPerMonth: original, active: true } } };
  const t = transitionCareerSeason(state);
  assert.equal(t.status, "APPLIED");
  const next = t.state;
  for (const key of ["worldSquads", "playerContracts", "gameplayRatings", "loans", "playerSquadStatus", "playerStatuses", "playerPlacements", "playerClubHistory", "clubEconomies"] as const) assert.deepEqual(next[key], state[key], key);
  assert.ok(next.worldSquads[PROMOTED]!.some((p) => p.id === loanee.id), "the loanee still plays for the borrowing club");
  assert.equal(next.playerContracts[loanee.id]!.clubId, RELEGATED, "his contract stays with the parent club");
  assert.equal(next.loans["qa-loan"]!.active, true);
  // Every registered player belongs to exactly one squad.
  const seen = new Map<string, number>();
  for (const squad of Object.values(next.worldSquads)) for (const p of squad) seen.set(p.id, (seen.get(p.id) ?? 0) + 1);
  assert.ok([...seen.values()].every((n) => n === 1), "no duplicated registration");
});

test("QA-4: no stale fixtures, results, ties, outcome or memberships after the transition", () => {
  const t = transitionCareerSeason(base);
  assert.equal(t.status, "APPLIED");
  const next = t.state;
  const oldIds = new Set(base.fixtures.map((f) => f.id));
  assert.ok(next.fixtures.every((f) => !oldIds.has(f.id)), "no season-1 fixture remains");
  assert.deepEqual(next.results, {});
  assert.deepEqual(next.competitionTies, {});
  assert.deepEqual(next.matchPlans, {});
  assert.equal(next.seasonComplete, false);
  assert.equal(next.seasonOutcome?.seasonId, next.seasonId);
  assert.deepEqual(next.seasonOutcome?.promoted ?? [], []);
  assert.deepEqual(next.seasonOutcome?.relegated ?? [], []);
  for (const f of next.fixtures.filter((f) => f.type === "LEAGUE")) {
    assert.equal(clubCompetitionId(next, f.homeClubId), f.competitionId);
    assert.equal(clubCompetitionId(next, f.awayClubId), f.competitionId);
  }
  const ids = [...competitionClubIds(next, L.hbl), ...competitionClubIds(next, L.allsvenskan)];
  assert.equal(new Set(ids).size, 28, "28 distinct clubs, none in two leagues");
  for (const [clubId, league] of Object.entries(next.competitionMembership ?? {})) {
    assert.ok(CLUBS.some((c) => c.id === clubId), `${clubId} is canonical`);
    assert.ok([L.hbl, L.allsvenskan, L.norra, L.sodra].includes(league as never), `${clubId} -> ${league} is a live league`);
  }
});

test("QA-5: a transitioned career survives save/load and keeps running; an M8-era save transitions unchanged", () => {
  const t = transitionCareerSeason(base);
  const reloaded = migrateCareerState(JSON.parse(JSON.stringify(t.state)));
  assert.deepEqual(reloaded.competitionMembership, t.state.competitionMembership);
  assert.deepEqual(reloaded.fixtures.map((f) => f.id), t.state.fixtures.map((f) => f.id));
  assert.deepEqual(reloaded.lastSeasonTransition, t.state.lastSeasonTransition);
  const date = addDays(reloaded.gameDate, 1);
  const ticked = processDay({ ...reloaded, processedThroughDate: reloaded.gameDate }, date).state;
  assert.equal(ticked.gameDate, date, "the daily tick continues after load");
  // A completed season saved before M9 (no receipt, no manager-mode fields) transitions as-is.
  const preM9: CareerState = migrateCareerState(JSON.parse(JSON.stringify(base)));
  delete preM9.lastSeasonTransition;
  const again = transitionCareerSeason(preM9);
  assert.equal(again.status, "APPLIED");
  assert.deepEqual(again.state.competitionMembership, t.state.competitionMembership);
});

test("QA-6: atomic rollback and retry", () => {
  // Missing kval evidence: blocked, the original object back, nothing written.
  const incomplete: CareerState = { ...base, results: Object.fromEntries(Object.entries(base.results).filter(([id]) => !id.includes("kval"))) };
  const blocked = transitionCareerSeason(incomplete);
  assert.equal(blocked.status, "BLOCKED");
  assert.equal(blocked.state, incomplete);
  // Retry with the results restored succeeds.
  const applied = transitionCareerSeason({ ...incomplete, results: base.results });
  assert.equal(applied.status, "APPLIED");
  // Retrying the committed transition with the same request is idempotent.
  const request = buildCareerTransitionRequest(base);
  const committed = attemptSeasonTransition(base, request);
  assert.equal(attemptSeasonTransition(committed.state, request).status, "ALREADY_APPLIED");
  // Pressing the button again on the new season cannot advance it a second time.
  const pressedAgain = transitionCareerSeason(committed.state);
  assert.equal(pressedAgain.status, "BLOCKED");
  assert.equal(pressedAgain.state, committed.state);
  // An exception while building evidence is a recoverable block, never a partial write.
  const broken = { ...base, fixtures: null } as unknown as CareerState;
  const failed = transitionCareerSeason(broken);
  assert.equal(failed.status, "BLOCKED");
  assert.equal(failed.state, broken);
});
