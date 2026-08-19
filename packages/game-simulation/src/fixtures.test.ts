import { test } from "node:test";
import assert from "node:assert/strict";
import { generateDoubleRoundRobin } from "./fixtures";

const CLUB_IDS = Array.from({ length: 14 }, (_, i) => `club-${i + 1}`);
const TUMBA_ID = "club-6";

function generate() {
  return generateDoubleRoundRobin({
    competitionId: "swe-2",
    clubIds: CLUB_IDS,
    seasonStartDate: "2026-08-15",
    daysBetweenRounds: 7,
  });
}

test("generates exactly 182 matches for 14 clubs (26 rounds x 7 matches)", () => {
  const fixtures = generate();
  assert.equal(fixtures.length, 182);
});

test("every club plays exactly 26 matches", () => {
  const fixtures = generate();
  for (const clubId of CLUB_IDS) {
    const count = fixtures.filter((f) => f.homeClubId === clubId || f.awayClubId === clubId).length;
    assert.equal(count, 26, `expected 26 matches for ${clubId}, got ${count}`);
  }
});

test("every pair meets exactly twice, once home once away for each side", () => {
  const fixtures = generate();
  for (let i = 0; i < CLUB_IDS.length; i += 1) {
    for (let j = i + 1; j < CLUB_IDS.length; j += 1) {
      const a = CLUB_IDS[i];
      const b = CLUB_IDS[j];
      const aHomeBAway = fixtures.filter((f) => f.homeClubId === a && f.awayClubId === b).length;
      const bHomeAAway = fixtures.filter((f) => f.homeClubId === b && f.awayClubId === a).length;
      assert.equal(aHomeBAway, 1, `expected exactly one ${a} home vs ${b}`);
      assert.equal(bHomeAAway, 1, `expected exactly one ${b} home vs ${a}`);
    }
  }
});

test("no duplicate fixtures (same home/away pair appearing more than the required twice)", () => {
  const fixtures = generate();
  const seen = new Map<string, number>();
  for (const f of fixtures) {
    const key = `${f.homeClubId}->${f.awayClubId}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  for (const [key, count] of seen) {
    assert.equal(count, 1, `fixture ${key} appears ${count} times, expected 1`);
  }
});

test("all clubs have balanced home/away totals (13 home, 13 away each)", () => {
  const fixtures = generate();
  for (const clubId of CLUB_IDS) {
    const homeCount = fixtures.filter((f) => f.homeClubId === clubId).length;
    const awayCount = fixtures.filter((f) => f.awayClubId === clubId).length;
    assert.equal(homeCount, 13, `expected 13 home matches for ${clubId}`);
    assert.equal(awayCount, 13, `expected 13 away matches for ${clubId}`);
  }
});

test("fixture dates are chronologically sensible (non-decreasing with round)", () => {
  const fixtures = generate();
  const byRound = new Map<number, string>();
  for (const f of fixtures) {
    byRound.set(f.round, f.date);
  }
  const rounds = [...byRound.keys()].sort((a, b) => a - b);
  for (let i = 1; i < rounds.length; i += 1) {
    const prevDate = new Date(byRound.get(rounds[i - 1])!).getTime();
    const currDate = new Date(byRound.get(rounds[i])!).getTime();
    assert.ok(currDate > prevDate, `round ${rounds[i]} date should be after round ${rounds[i - 1]}`);
  }
});

test("IFK Tumba (club-6) participates in all 26 rounds with no self-fixture", () => {
  const fixtures = generate();
  const tumbaFixtures = fixtures.filter((f) => f.homeClubId === TUMBA_ID || f.awayClubId === TUMBA_ID);
  assert.equal(tumbaFixtures.length, 26);
  assert.ok(tumbaFixtures.every((f) => f.homeClubId !== f.awayClubId));
  const rounds = new Set(tumbaFixtures.map((f) => f.round));
  assert.equal(rounds.size, 26, "Tumba should play in 26 distinct rounds, never twice in the same round");
});

test("no club plays itself anywhere in the schedule", () => {
  const fixtures = generate();
  assert.ok(fixtures.every((f) => f.homeClubId !== f.awayClubId));
});

test("generation is deterministic across repeated calls", () => {
  assert.deepEqual(generate(), generate());
});
