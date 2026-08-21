import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { TUMBA_CLUB_ID, TUMBA_SQUAD } from "../game-data";
import { buildCatalog, findClubById } from "../editor/catalog";
import { snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { createNewCareerState } from "./newCareer";
import { getCareerClub, getCareerPlayer, getCareerSquad } from "./careerWorld";

const HANDBOLLSLIGAN = "se_handbollsligan_herr";

test("HM-TACTICS-0.6A: every new career receives a deterministic default TeamTacticalProfile", () => {
  const a = createNewCareerState("tactical-default-seed", TUMBA_CLUB_ID);
  const b = createNewCareerState("tactical-default-seed", TUMBA_CLUB_ID);
  assert.deepEqual(a.tacticalProfile, b.tacticalProfile);
  assert.equal(a.tacticalProfile.ati001UsageTendency, "MEDIUM");
  assert.equal(a.tacticalProfile.h2ResponsePreference, "H2_STEPS");
  assert.equal(a.tacticalProfile.tacticalFamiliarity, "MEDIUM");
});

test("HM-DATA-0.2: a career created for a real Handbollsligan club plays in Handbollsligan and snapshots real player identity", () => {
  const career = createNewCareerState("seed-1", "se_club_alingsas_hk", snapshotWorldSquads(HANDBOLLSLIGAN));
  assert.equal(career.competitionId, "se_handbollsligan_herr");
  assert.equal(career.playerClubId, "se_club_alingsas_hk");

  const squad = getCareerSquad(career);
  assert.ok(squad.length > 0);
  assert.ok(squad.every((p) => p.dataSource === "REAL_WORLD"));
  assert.ok(squad.every((p) => p.id.startsWith("se_player_")), "stable real-world playerIds, never regenerated");

  const club = getCareerClub(career);
  assert.equal(club.name, "Alingsås HK");

  // Fixtures are generated for the club's real competition, using the
  // real 14-club Handbollsligan field, not the mock Allsvenskan clubs.
  assert.ok(career.fixtures.some((f) => f.homeClubId === "se_club_alingsas_hk" || f.awayClubId === "se_club_alingsas_hk"));
  assert.ok(career.fixtures.every((f) => f.homeClubId.startsWith("se_club_") && f.awayClubId.startsWith("se_club_")));
});

test("HM-DATA-0.2: two different real Handbollsligan clubs each get their own correct squad, never each other's or Tumba's", () => {
  const squads = snapshotWorldSquads(HANDBOLLSLIGAN);
  const alingsas = createNewCareerState("seed-2", "se_club_alingsas_hk", squads);
  const malmo = createNewCareerState("seed-2", "se_club_hk_malmo", squads);

  const alingsasSquad = getCareerSquad(alingsas);
  const malmoSquad = getCareerSquad(malmo);

  assert.ok(alingsasSquad.every((p) => p.clubId === "se_club_alingsas_hk"));
  assert.ok(malmoSquad.every((p) => p.clubId === "se_club_hk_malmo"));
  assert.notDeepEqual(alingsasSquad.map((p) => p.id), malmoSquad.map((p) => p.id));

  const tumbaNamesInAlingsas = alingsasSquad.filter((p) => TUMBA_SQUAD.some((t) => t.id === p.id));
  assert.equal(tumbaNamesInAlingsas.length, 0);
});

test("IFK Tumba careers are unaffected by HM-DATA-0.2 -- still Allsvenskan, still the mock squad", () => {
  const career = createNewCareerState("seed-3", TUMBA_CLUB_ID);
  assert.equal(career.competitionId, "swe-2");
  const squad = getCareerSquad(career);
  assert.deepEqual(squad.map((p) => p.id).sort(), TUMBA_SQUAD.map((p) => p.id).sort());
  assert.equal(career.worldSquads[TUMBA_CLUB_ID], undefined, "Tumba has no real-world snapshot entry -- it falls back to the legacy mock squad");
});

test("HM-DATA-0.2 career-snapshot decision: an Editor-style source-file edit made AFTER career creation never reaches the already-created career", () => {
  const club = findClubById(buildCatalog(), "se_club_alingsas_hk")!;
  const before = fs.readFileSync(club.playersFile, "utf8");

  try {
    const career = createNewCareerState("seed-4", "se_club_alingsas_hk", snapshotWorldSquads(HANDBOLLSLIGAN));
    const originalFirstName = getCareerSquad(career)[0].firstName;

    // Simulate an Editor correction to the very same player this career
    // already snapshotted.
    const players = JSON.parse(before);
    players[0].firstName = "EDITED_AFTER_SNAPSHOT";
    fs.writeFileSync(club.playersFile, JSON.stringify(players, null, 2), "utf8");

    // The EXISTING career's own state object must be completely unchanged.
    assert.equal(getCareerSquad(career)[0].firstName, originalFirstName);
    assert.notEqual(getCareerSquad(career)[0].firstName, "EDITED_AFTER_SNAPSHOT");

    // A NEW career (re-fetching the snapshot, as the real app does on
    // every new career creation) picks up the correction.
    const laterCareer = createNewCareerState("seed-5", "se_club_alingsas_hk", snapshotWorldSquads(HANDBOLLSLIGAN));
    assert.equal(getCareerSquad(laterCareer)[0].firstName, "EDITED_AFTER_SNAPSHOT");
  } finally {
    fs.writeFileSync(club.playersFile, before, "utf8");
  }
});

test("getCareerPlayer finds a player in the manager's own squad and returns undefined for an unknown id", () => {
  const career = createNewCareerState("seed-6", "se_club_alingsas_hk", snapshotWorldSquads(HANDBOLLSLIGAN));
  const known = getCareerSquad(career)[0];
  assert.equal(getCareerPlayer(career, known.id)?.id, known.id);
  assert.equal(getCareerPlayer(career, "not_a_real_id"), undefined);
});
