// Club Identity C1: canonical identity model invariants (ROADMAP §3.1 I1-I3, I8).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CLUBS, getClub, getClubsByCompetition, resolveClubId, canonicalClubId, clubDisplayName, clubDisplayShortName,
  findClubsByName, resolveClubByName, parentClubOf, clubTeamType, realWorldCompetitionForSeason, clubNation,
  CLUB_WORLD_START_SEASON, TUMBA_CLUB_ID,
} from "./index";

const BASELINE: Record<string, string> = JSON.parse(readFileSync(new URL("./__snapshots__/club-legacy-baseline.v8.json", import.meta.url), "utf8")).clubs;

test("I3: the frozen legacy competitionId of every v8 club is unchanged", () => {
  assert.equal(Object.keys(BASELINE).length, 202);
  for (const [id, competitionId] of Object.entries(BASELINE)) {
    const club = getClub(id);
    assert.ok(club, `${id} must still resolve (ids are never deleted)`);
    assert.equal(club.competitionId, competitionId, `${id}: Club.competitionId is frozen; append competitionHistory instead`);
  }
});

test("I1/I2: every id resolves to exactly one record; new records declare the epoch that added them", () => {
  const ids = CLUBS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "storage ids are unique");
  const canon = CLUBS.map((c) => c.canonicalId ?? c.id);
  assert.equal(new Set(canon).size, canon.length, "canonical identities are unique (no silent duplicates)");
  for (const c of CLUBS) {
    assert.equal(getClub(c.id), c);
    assert.equal(resolveClubId(c.id), c.id);
    assert.equal(resolveClubId(canonicalClubId(c.id)!), c.id, `${c.id}: canonical id resolves back to its storage key`);
    if (!(c.id in BASELINE)) assert.ok(c.addedInWorld, `${c.id} is not in the v8 world and must carry addedInWorld`);
    assert.ok(clubNation(c.id), `${c.id} has a federation nation`);
  }
});

test("legacy-baseline enumeration keeps v8 order and excludes records the v8 world never had", () => {
  for (const competitionId of new Set(Object.values(BASELINE))) {
    const expected = Object.entries(BASELINE).filter(([, c]) => c === competitionId).map(([id]) => id);
    assert.deepEqual(getClubsByCompetition(competitionId).map((c) => c.id), expected, competitionId);
  }
});

test("resolution never goes through display names, and unknown ids stay unknown", () => {
  assert.equal(resolveClubId("IFK Tumba HK"), undefined);
  assert.equal(resolveClubId("no-such-club"), undefined);
  assert.equal(clubDisplayName("no-such-club"), "no-such-club");
  assert.equal(TUMBA_CLUB_ID, "swe2-tumba");
});

test("I8: name search is exact, deterministic and never resolves an ambiguous or partial name", () => {
  for (const c of CLUBS) assert.equal(resolveClubByName(c.name)?.id, c.id, `${c.name} resolves to its own id`);
  // A second team's registered name never resolves to its parent (F28, S2).
  for (const [name, notId] of [["Tumba HK", "swe2-tumba"], ["VästeråsIrsta HK", "swe2-vasterasirsta"], ["Helsingborgs HK", "se_club_ov_helsingborg"], ["Malmö HP", "se_club_hk_malmo"], ["Lunds HS Lejon", "swe2-h43lund"]] as const) {
    const hit = resolveClubByName(name);
    assert.ok(hit, name);
    assert.notEqual(hit.id, notId, `${name} must not resolve to ${notId}`);
  }
  assert.deepEqual(findClubsByName(""), []);
  assert.deepEqual(findClubsByName("ifk tumba hk").map((c) => c.id), ["swe2-tumba"], "case-insensitive exact match");
});

test("season helpers fall back to the current identity", () => {
  const c = CLUBS[0]!;
  assert.equal(clubDisplayName(c.id, CLUB_WORLD_START_SEASON), c.name);
  assert.equal(clubDisplayShortName(c.id), c.shortName);
  assert.equal(clubTeamType(c.id), "FIRST_TEAM");
  assert.equal(parentClubOf(c.id), undefined);
  assert.equal(realWorldCompetitionForSeason(c, CLUB_WORLD_START_SEASON), c.competitionId);
});
