import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PRESEASON_START_OPTIONS,
  REAL_LEAGUE_KICKOFF_DATES,
  bookFriendly,
  computeCareerStartDate,
  generateProvisionalCupRound,
  getSeasonPhase,
  resolveLeagueKickoffDate,
} from "./preseason";
import { createNewCareerState } from "./newCareer";
import { TUMBA_CLUB_ID } from "../game-data";
import type { CareerState } from "./types";

// (1) real 2026/27 kickoff dates the user provided.
test("(1) the real 2026/27 Swedish league kickoff dates are exactly as specified", () => {
  assert.equal(REAL_LEAGUE_KICKOFF_DATES["swe-2"], "2026-09-20"); // IFK Tumba / Allsvenskan
  assert.equal(REAL_LEAGUE_KICKOFF_DATES["se_handbollsligan_herr"], "2026-09-23");
});

test("(1b) resolveLeagueKickoffDate falls back to the given default for an unknown competition", () => {
  assert.equal(resolveLeagueKickoffDate("unknown-comp", "2026-08-19"), "2026-08-19");
});

// (2) all five start options resolve deterministically.
test("(2) every fixed-weeks preseason option computes a deterministic date exactly N*7 days before kickoff", () => {
  const kickoff = "2026-09-20";
  assert.equal(computeCareerStartDate(kickoff, "8_WEEKS"), "2026-07-26");
  assert.equal(computeCareerStartDate(kickoff, "6_WEEKS"), "2026-08-09");
  assert.equal(computeCareerStartDate(kickoff, "4_WEEKS"), "2026-08-23");
  assert.equal(computeCareerStartDate(kickoff, "2_WEEKS"), "2026-09-06");
});

test("(2b) FIRST_MATCH returns null -- the caller resolves it from the actual fixture list", () => {
  assert.equal(computeCareerStartDate("2026-09-20", "FIRST_MATCH"), null);
});

test("(2c) every option is deterministic -- calling twice with the same inputs always agrees", () => {
  for (const opt of PRESEASON_START_OPTIONS) {
    const a = computeCareerStartDate("2026-09-20", opt);
    const b = computeCareerStartDate("2026-09-20", opt);
    assert.equal(a, b);
  }
});

// (3) provisional cup round -- deterministic pairings, 3 weeks before kickoff.
test("(3) generateProvisionalCupRound pairs clubs deterministically and dates the round 3 weeks before kickoff", () => {
  const clubIds = ["a", "b", "c", "d", "e"]; // odd count -- "e" gets a bye
  const round = generateProvisionalCupRound("swe-2", clubIds, "2026-09-20");
  assert.equal(round.length, 2);
  assert.deepEqual(round.map((f) => [f.homeClubId, f.awayClubId]), [
    ["a", "b"],
    ["c", "d"],
  ]);
  assert.ok(round.every((f) => f.date === "2026-08-30"));
  assert.ok(round.every((f) => f.type === "CUP"));
  const again = generateProvisionalCupRound("swe-2", clubIds, "2026-09-20");
  assert.deepEqual(round, again);
});

// (4) season phase is a pure date comparison.
test("(4) getSeasonPhase is PRESEASON before leagueKickoffDate and COMPETITIVE_SEASON on/after it", () => {
  const base = createNewCareerState("phase-test", TUMBA_CLUB_ID);
  const before: CareerState = { ...base, gameDate: "2026-09-19", leagueKickoffDate: "2026-09-20" };
  const onDay: CareerState = { ...base, gameDate: "2026-09-20", leagueKickoffDate: "2026-09-20" };
  const after: CareerState = { ...base, gameDate: "2026-09-25", leagueKickoffDate: "2026-09-20" };
  assert.equal(getSeasonPhase(before), "PRESEASON");
  assert.equal(getSeasonPhase(onDay), "COMPETITIVE_SEASON");
  assert.equal(getSeasonPhase(after), "COMPETITIVE_SEASON");
});

// (5) friendly booking -- happy path and conflicts.
function freshTumba(seed: string): CareerState {
  return createNewCareerState(seed, TUMBA_CLUB_ID, {}, {}, {}, null, "4_WEEKS");
}

test("(5) bookFriendly appends a well-formed FRIENDLY fixture on success", () => {
  const state = freshTumba("book-1");
  const opponent = state.fixtures.find((f) => f.type === "LEAGUE")!.homeClubId === TUMBA_CLUB_ID ? state.fixtures.find((f) => f.type === "LEAGUE")!.awayClubId : state.fixtures.find((f) => f.type === "LEAGUE")!.homeClubId;
  const freeDate = state.gameDate; // career's own first day -- guaranteed free of any generated fixture
  const result = bookFriendly(state, freeDate, opponent);
  assert.equal(result.ok, true);
  const friendly = result.state.fixtures.find((f) => f.type === "FRIENDLY");
  assert.ok(friendly);
  assert.equal(friendly!.date, freeDate);
  assert.equal(friendly!.homeClubId, TUMBA_CLUB_ID);
  assert.equal(friendly!.awayClubId, opponent);
});

test("(5b) bookFriendly rejects a date before the career's own start", () => {
  const state = freshTumba("book-2");
  const before = "2000-01-01";
  const result = bookFriendly(state, before, state.fixtures[0].awayClubId);
  assert.equal(result.ok, false);
  assert.ok(result.error);
});

test("(5c) bookFriendly rejects a date already used by the manager's own club", () => {
  const state = freshTumba("book-3");
  const ownFixture = state.fixtures.find((f) => f.homeClubId === TUMBA_CLUB_ID || f.awayClubId === TUMBA_CLUB_ID)!;
  const otherOpponent = state.fixtures.find((f) => f.type === "LEAGUE" && f.homeClubId !== TUMBA_CLUB_ID && f.awayClubId !== TUMBA_CLUB_ID)?.homeClubId;
  const result = bookFriendly(state, ownFixture.date, otherOpponent ?? "swe2-varberg");
  assert.equal(result.ok, false);
});

test("(5d) bookFriendly rejects a date already used by the chosen opponent", () => {
  const state = freshTumba("book-4");
  const opponentFixture = state.fixtures.find((f) => f.type === "LEAGUE" && f.homeClubId !== TUMBA_CLUB_ID && f.awayClubId !== TUMBA_CLUB_ID)!;
  const result = bookFriendly(state, opponentFixture.date, opponentFixture.homeClubId);
  assert.equal(result.ok, false);
});

test("(5e) bookFriendly rejects booking against your own club", () => {
  const state = freshTumba("book-5");
  const result = bookFriendly(state, state.gameDate, TUMBA_CLUB_ID);
  assert.equal(result.ok, false);
});
