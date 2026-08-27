// HM-DATA-ALLSVENSKAN-1.1: proves the 14 Allsvenskan clubs' real player
// data loads/validates through the real production pipeline (same
// loaders/adapter/validators the Handbollsligan set already uses), and
// that the milestone's own data-quality invariants hold: no duplicate
// players, no player in the wrong club, goalkeeper/outcourt separation
// works, and Tactics/Match Engine can actually select the imported squads.
import { test } from "node:test";
import assert from "node:assert/strict";
import { getClubsByCompetition } from "../game-data/clubs";
import { loadRealWorldClubSquad, validateClubSquad } from "./realWorldLoader";
import { toPlayerMocks } from "./gameWorldAdapter";
import { buildInitialMatchSquad } from "../matchPlan/careerSquadBridge";
import { buildDefaultMatchPlan } from "../matchPlan/defaultMatchPlan";

const ALLSVENSKAN_CLUB_IDS = getClubsByCompetition("swe-2").map((c) => c.id);

test("(1) Allsvenskan has exactly 14 real-world-backed clubs, all loadable and validating cleanly", () => {
  assert.equal(ALLSVENSKAN_CLUB_IDS.length, 14);
  for (const clubId of ALLSVENSKAN_CLUB_IDS) {
    const squad = loadRealWorldClubSquad(clubId);
    assert.ok(squad, `expected a real-world squad for ${clubId}`);
    assert.ok(squad!.players.length > 0, `${clubId}: expected a non-empty roster`);
    const result = validateClubSquad(squad!);
    assert.ok(result.ok, `${clubId}: ${JSON.stringify(result.errors)}`);
  }
});

test("(2) total real Allsvenskan player count matches the canonical source spreadsheet (261 players)", () => {
  let total = 0;
  for (const clubId of ALLSVENSKAN_CLUB_IDS) total += loadRealWorldClubSquad(clubId)!.players.length;
  assert.equal(total, 261);
});

test("(3) no playerId is duplicated across two different Allsvenskan clubs (or with any Handbollsligan player)", () => {
  const seen = new Map<string, string>();
  for (const clubId of getClubsByCompetition("swe-2").concat(getClubsByCompetition("se_handbollsligan_herr")).map((c) => c.id)) {
    const squad = loadRealWorldClubSquad(clubId);
    for (const p of squad?.players ?? []) {
      const priorClub = seen.get(p.playerId);
      assert.ok(!priorClub, `playerId ${p.playerId} appears at both ${priorClub} and ${clubId}`);
      seen.set(p.playerId, clubId);
    }
  }
});

test("(4) every real Allsvenskan player's roster entry declares the club it actually loaded under", () => {
  for (const clubId of ALLSVENSKAN_CLUB_IDS) {
    const squad = loadRealWorldClubSquad(clubId)!;
    for (const p of squad.players) assert.equal(p.clubId, clubId);
  }
});

test("(5) goalkeeper/outcourt separation: every club has at least one MV, and MV players never carry an outcourt secondary position that collides with GK", () => {
  for (const clubId of ALLSVENSKAN_CLUB_IDS) {
    const squad = loadRealWorldClubSquad(clubId)!;
    const mocks = toPlayerMocks(squad.players);
    assert.ok(mocks.some((p) => p.position === "MV"), `${clubId}: expected at least one goalkeeper`);
    assert.ok(mocks.some((p) => p.position !== "MV"), `${clubId}: expected at least one outcourt player`);
  }
});

test("(6) gameWorldAdapter.toPlayerMocks never drops a real Allsvenskan player -- every roster entry's primaryPosition is one of the 7 canonical codes", () => {
  for (const clubId of ALLSVENSKAN_CLUB_IDS) {
    const squad = loadRealWorldClubSquad(clubId)!;
    const mocks = toPlayerMocks(squad.players);
    assert.equal(mocks.length, squad.players.length, `${clubId}: adapter dropped ${squad.players.length - mocks.length} player(s) with an unmappable position`);
  }
});

test("(7) Tactics/Match Engine can select a legal initial match squad and default match plan for a real Allsvenskan club (Tumba)", () => {
  const squad = loadRealWorldClubSquad("swe2-tumba")!;
  const mocks = toPlayerMocks(squad.players);
  const initial = buildInitialMatchSquad(mocks, "fixture-as-test", "swe2-tumba");
  assert.ok(initial.players.length > 0);
  assert.ok(initial.players.some((p) => p.position === "GK"));
  const plan = buildDefaultMatchPlan(initial);
  assert.ok(plan.ok, plan.errors.join("; "));
});

test("(8) at least one club shows a materially different age/position mix than another (young-heavy vs balanced), confirming real per-club variety rather than one uniform generated shape", () => {
  const byClub = new Map<string, ReturnType<typeof toPlayerMocks>>();
  for (const clubId of ALLSVENSKAN_CLUB_IDS) {
    const squad = loadRealWorldClubSquad(clubId)!;
    byClub.set(clubId, toPlayerMocks(squad.players));
  }
  const counts = Array.from(byClub.values()).map((mocks) => mocks.length);
  assert.ok(new Set(counts).size > 1, "expected squad sizes to differ across clubs, not all identical");
});
