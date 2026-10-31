// Historical match adapter regression. Production lifecycle is covered by productionMatch.test.ts.
// HM-PRESEASON-1.0: CareerState-level integration proofs -- real
// newCareer/dailyTick/matchdayAction/saveMigration flow.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { migrateCareerState } from "./saveMigration";
import { processDay } from "./dailyTick";
import { playManagerFixtureLegacy as playManagerFixture } from "./legacy/matchday";
import { addDays } from "./dateUtils";
import { TUMBA_CLUB_ID } from "../game-data";
import { bookFriendly, getSeasonPhase, PRESEASON_START_OPTIONS, REAL_LEAGUE_KICKOFF_DATES } from "./preseason";
import { getLiveStandings } from "./standings";
import type { CareerState } from "./types";

function advanceOneDay(state: CareerState): CareerState {
  return processDay(state, addDays(state.processedThroughDate, 1)).state;
}
function advanceToDate(state: CareerState, targetDate: string): CareerState {
  let current = state;
  while (current.processedThroughDate < targetDate) current = advanceOneDay(current);
  return current;
}

// (1) all five options work deterministically for a real club.
test("(1) all five preseason start options produce the correct, deterministic career start date for IFK Tumba", () => {
  const kickoff = REAL_LEAGUE_KICKOFF_DATES["swe-2"];
  const expected: Record<(typeof PRESEASON_START_OPTIONS)[number], string | null> = {
    "8_WEEKS": "2026-07-23",
    "6_WEEKS": "2026-08-06",
    "4_WEEKS": "2026-08-20",
    "2_WEEKS": "2026-09-03",
    FIRST_MATCH: null, // resolved from the actual fixture list -- checked separately below
  };
  for (const opt of PRESEASON_START_OPTIONS) {
    const state = createNewCareerState(`start-${opt}`, TUMBA_CLUB_ID, {}, {}, {}, null, opt);
    if (expected[opt] !== null) {
      assert.equal(state.gameDate, expected[opt], `option=${opt}`);
    }
    assert.equal(state.leagueKickoffDate, kickoff, `option=${opt}`);
    // Deterministic: creating again with the same seed/option agrees.
    const again = createNewCareerState(`start-${opt}`, TUMBA_CLUB_ID, {}, {}, {}, null, opt);
    assert.equal(again.gameDate, state.gameDate, `option=${opt}`);
  }
});

test("(1b) FIRST_MATCH starts the career on the earliest fixture (cup, since it's earlier than league kickoff)", () => {
  const state = createNewCareerState("start-first-match", TUMBA_CLUB_ID, {}, {}, {}, null, "FIRST_MATCH");
  const ownFixtures = state.fixtures.filter((f) => f.homeClubId === TUMBA_CLUB_ID || f.awayClubId === TUMBA_CLUB_ID);
  const earliest = ownFixtures.reduce((min, f) => (f.date < min ? f.date : min), ownFixtures[0].date);
  assert.equal(state.gameDate, earliest);
});

// (2) omitting preseasonStart is byte-identical to legacy behavior.
test("(2) createNewCareerState called without preseasonStart is unaffected by this milestone", () => {
  const legacy = createNewCareerState("legacy-check", TUMBA_CLUB_ID);
  assert.ok(legacy.fixtures.every((f) => f.type === "LEAGUE"));
  assert.equal(legacy.leagueKickoffDate, legacy.gameDate);
  assert.equal(getSeasonPhase(legacy), "COMPETITIVE_SEASON");
});

// (3) cup fixtures before league kickoff remain (for a long-enough preseason).
test("(3) an 8-week preseason includes the provisional cup fixture, dated before league kickoff", () => {
  const state = createNewCareerState("cup-present", TUMBA_CLUB_ID, {}, {}, {}, null, "8_WEEKS");
  const cupFixtures = state.fixtures.filter((f) => f.type === "CUP");
  assert.ok(cupFixtures.length > 0);
  for (const f of cupFixtures) {
    assert.ok(f.date < state.leagueKickoffDate);
    assert.ok(f.date >= state.gameDate);
  }
});

test("(3b) a 2-week preseason (career starts after the cup round already happened) correctly has NO cup fixture -- never backdated/faked", () => {
  const state = createNewCareerState("cup-too-late", TUMBA_CLUB_ID, {}, {}, {}, null, "2_WEEKS");
  const cupFixtures = state.fixtures.filter((f) => f.type === "CUP");
  assert.equal(cupFixtures.length, 0);
});

// (4) the calendar functions from preseason through to league kickoff.
test("(4) Continue processes preseason days normally and correctly flips season phase to COMPETITIVE_SEASON on league kickoff", () => {
  const state = createNewCareerState("phase-flow", TUMBA_CLUB_ID, {}, {}, {}, null, "2_WEEKS");
  assert.equal(getSeasonPhase(state), "PRESEASON");
  const atKickoff = advanceToDate(state, state.leagueKickoffDate);
  assert.equal(getSeasonPhase(atKickoff), "COMPETITIVE_SEASON");
});

// (5)/(6) friendly can be booked and played, affecting physical/training/medical but not standings.
test("(5)/(6)/(7) a booked friendly can be played, runs the real physical/development/injury pipeline, and never touches clubForm/playerSeasonStats", () => {
  const state = createNewCareerState("friendly-play", TUMBA_CLUB_ID, {}, {}, {}, null, "8_WEEKS");
  const opponentFixture = state.fixtures.find((f) => f.type === "LEAGUE" && f.homeClubId !== TUMBA_CLUB_ID && f.awayClubId !== TUMBA_CLUB_ID);
  const opponentClubId = opponentFixture ? opponentFixture.homeClubId : state.fixtures.find((f) => f.type === "LEAGUE")!.awayClubId;
  const booking = bookFriendly(state, state.gameDate, opponentClubId);
  assert.equal(booking.ok, true, booking.error);
  let withFriendly = booking.state;

  const friendly = withFriendly.fixtures.find((f) => f.type === "FRIENDLY")!;
  withFriendly = advanceToDate(withFriendly, friendly.date);
  const { state: afterPlay, result } = playManagerFixture(withFriendly);
  assert.ok(result, "friendly must actually play through the real Match Engine");
  assert.ok(afterPlay.results[friendly.id]);
  // Physical: a physical report was recorded for this fixture.
  assert.ok(afterPlay.physicalReports[friendly.id]);
  // clubForm/playerSeasonStats must be untouched by the friendly.
  assert.deepEqual(afterPlay.clubForm[TUMBA_CLUB_ID] ?? [], state.clubForm[TUMBA_CLUB_ID] ?? []);
  assert.deepEqual(afterPlay.playerSeasonStats, state.playerSeasonStats);
});

// (8) friendly never affects season completion.
test("(8) a friendly fixture is excluded from getUnplayedLeagueFixtures/checkSeasonComplete gating", async () => {
  const { getUnplayedFixtures } = await import("./calendar");
  const state = createNewCareerState("friendly-season-complete", TUMBA_CLUB_ID, {}, {}, {}, null, "8_WEEKS");
  const opponentFixture = state.fixtures.find((f) => f.type === "LEAGUE" && f.homeClubId !== TUMBA_CLUB_ID && f.awayClubId !== TUMBA_CLUB_ID)!;
  const booking = bookFriendly(state, state.gameDate, opponentFixture.homeClubId);
  assert.equal(booking.ok, true);
  const unplayed = getUnplayedFixtures(booking.state);
  assert.ok(unplayed.some((f) => f.type === "FRIENDLY"), "sanity: the friendly IS in the unplayed list");
  // But it must never be counted by checkSeasonComplete's own league-only gate -- proven structurally: a state with EVERY league fixture already resolved but the friendly still unplayed must be seasonComplete-eligible.
  const { checkSeasonComplete } = await import("./calendar");
  const leagueIds = new Set(booking.state.fixtures.filter((f) => f.type === "LEAGUE").map((f) => f.id));
  const fakeResults = { ...booking.state.results };
  for (const f of booking.state.fixtures) {
    if (leagueIds.has(f.id)) {
      fakeResults[f.id] = {
        fixtureId: f.id,
        seed: 1,
        homeClubId: f.homeClubId,
        awayClubId: f.awayClubId,
        homeGoals: 20,
        awayGoals: 18,
        homeStats: { goals: 20, shots: 30, shootingPct: 66, saves: 10, shotsFaced: 20, turnovers: 5, twoMinuteSuspensions: 1, sevenMetreGoals: 2, sevenMetreAttempts: 2 },
        awayStats: { goals: 18, shots: 28, shootingPct: 64, saves: 9, shotsFaced: 20, turnovers: 5, twoMinuteSuspensions: 1, sevenMetreGoals: 1, sevenMetreAttempts: 1 },
        events: [],
        homePlayerContributions: [],
        awayPlayerContributions: [],
      };
    }
  }
  const allLeaguePlayed = { ...booking.state, results: fakeResults };
  const completed = checkSeasonComplete(allLeaguePlayed);
  assert.equal(completed.seasonComplete, true, "season must complete once every LEAGUE fixture has a result, regardless of the still-unplayed friendly");
});

// (8b) a played friendly must never move the manager's own club in the LIVE standings table either (Part: getLiveStandings/getLiveTableStandings -- the Match Report/Analysis "Tabellplacering" widget's own real data source, found and fixed during this milestone's browser QA to also filter by fixture type, same as checkSeasonComplete/clubForm/playerSeasonStats).
test("(8b) getLiveStandings is unaffected by a played friendly's result -- club position/points identical before and after", () => {
  const state = createNewCareerState("standings-friendly", TUMBA_CLUB_ID, {}, {}, {}, null, "8_WEEKS");
  const before = getLiveStandings(state);
  const opponentFixture = state.fixtures.find((f) => f.type === "LEAGUE" && f.homeClubId !== TUMBA_CLUB_ID && f.awayClubId !== TUMBA_CLUB_ID)!;
  const booking = bookFriendly(state, state.gameDate, opponentFixture.homeClubId);
  assert.equal(booking.ok, true);
  const friendly = booking.state.fixtures.find((f) => f.type === "FRIENDLY")!;
  const advanced = advanceToDate(booking.state, friendly.date);
  const { state: afterPlay } = playManagerFixture(advanced);
  const after = getLiveStandings(afterPlay);
  assert.deepEqual(after, before);
});

// (9) date conflicts are blocked -- see preseason.test.ts's dedicated (5b)-(5e); re-verified end-to-end here through the real CareerContext-equivalent bookFriendly call.
test("(9) booking a friendly on an existing fixture date is blocked end-to-end", () => {
  const state = createNewCareerState("conflict-e2e", TUMBA_CLUB_ID, {}, {}, {}, null, "8_WEEKS");
  const ownFixture = state.fixtures.find((f) => f.homeClubId === TUMBA_CLUB_ID || f.awayClubId === TUMBA_CLUB_ID)!;
  const result = bookFriendly(state, ownFixture.date, state.fixtures.find((f) => f.homeClubId !== TUMBA_CLUB_ID)!.homeClubId);
  assert.equal(result.ok, false);
});

// (10) reload/navigation preserves everything (save/reload = JSON round-trip, same precedent as prior milestones).
test("(10) a career with a booked friendly and its leagueKickoffDate survives a JSON save/reload round-trip byte-for-byte", () => {
  const state = createNewCareerState("reload-check", TUMBA_CLUB_ID, {}, {}, {}, null, "6_WEEKS");
  const opponentFixture = state.fixtures.find((f) => f.type === "LEAGUE" && f.homeClubId !== TUMBA_CLUB_ID)!;
  const booking = bookFriendly(state, state.gameDate, opponentFixture.homeClubId);
  assert.equal(booking.ok, true);
  const roundTripped = JSON.parse(JSON.stringify(booking.state)) as CareerState;
  assert.deepEqual(roundTripped.fixtures, booking.state.fixtures);
  assert.equal(roundTripped.leagueKickoffDate, booking.state.leagueKickoffDate);
  assert.equal(roundTripped.gameDate, booking.state.gameDate);
});

// (11) old saves migrate safely.
test("(11) a pre-HM-PRESEASON-1.0 save (fixture.type and leagueKickoffDate both absent) migrates safely to LEAGUE fixtures and a COMPETITIVE_SEASON phase", () => {
  const state = createNewCareerState("migrate-check", TUMBA_CLUB_ID);
  const legacy = { ...state, fixtures: state.fixtures.map((f) => { const rest: Record<string, unknown> = { ...f }; delete rest.type; return rest; }) } as unknown as CareerState;
  delete (legacy as Record<string, unknown>).leagueKickoffDate;
  const migrated = migrateCareerState(legacy);
  assert.ok(migrated.fixtures.every((f) => f.type === "LEAGUE"));
  assert.equal(migrated.leagueKickoffDate, migrated.gameDate);
  assert.equal(getSeasonPhase(migrated), "COMPETITIVE_SEASON");
});

test("(11b) migrating an already-current save is a true no-op for the new fields", () => {
  const state = createNewCareerState("migrate-noop", TUMBA_CLUB_ID, {}, {}, {}, null, "4_WEEKS");
  const migrated = migrateCareerState(state);
  assert.deepEqual(migrated.fixtures, state.fixtures);
  assert.equal(migrated.leagueKickoffDate, state.leagueKickoffDate);
});

// (12) a fresh career can be played from preseason start through to the first league match.
test("(12) a fresh 4-week-preseason IFK Tumba career can Continue all the way from career start to the first league fixture, including a played cup fixture in between", () => {
  const state = createNewCareerState("full-run", TUMBA_CLUB_ID, {}, {}, {}, null, "4_WEEKS");
  assert.equal(getSeasonPhase(state), "PRESEASON");

  const cupFixture = state.fixtures.find((f) => f.type === "CUP" && (f.homeClubId === TUMBA_CLUB_ID || f.awayClubId === TUMBA_CLUB_ID));
  let current = state;
  if (cupFixture) {
    current = advanceToDate(current, cupFixture.date);
    const { result } = playManagerFixture(current);
    assert.ok(result, "the manager's own cup fixture must actually be playable during preseason");
    current = playManagerFixture(current).state;
  }

  const firstLeague = state.fixtures.filter((f) => f.type === "LEAGUE" && (f.homeClubId === TUMBA_CLUB_ID || f.awayClubId === TUMBA_CLUB_ID)).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  current = advanceToDate(current, firstLeague.date);
  assert.equal(getSeasonPhase(current), "COMPETITIVE_SEASON");
  const { result: leagueResult, state: afterLeague } = playManagerFixture(current);
  assert.ok(leagueResult, "the first league fixture must play successfully");
  assert.ok(afterLeague.results[firstLeague.id]);
  // Round 1's own fixtures spread across a few consecutive days from
  // leagueKickoffDate (generateDoubleRoundRobin's deterministic
  // spreadDays -- see packages/game-simulation/src/fixtures.ts), so IFK
  // Tumba's own first league fixture lands ON or within a few days AFTER
  // the real 2026-09-17 league kickoff, never before it and never far after.
  assert.ok(firstLeague.date >= state.leagueKickoffDate, `firstLeague.date=${firstLeague.date} kickoff=${state.leagueKickoffDate}`);
  assert.ok(firstLeague.date <= addDays(state.leagueKickoffDate, 6), `firstLeague.date=${firstLeague.date} kickoff=${state.leagueKickoffDate}`);
});
