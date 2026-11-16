// Club Identity C5: the experience follows the club the manager actually leads (club change, unemployment).
import { test } from "node:test";
import assert from "node:assert/strict";
import { CLUBLESS_ORANGE, TUMBA_CLUB_ID, clubVisualIdentity } from "../game-data";
import { createNewCareerState } from "./newCareer";
import { activeClubVisualIdentity, clubIdentityStyle } from "./activeClubIdentity";

test("employed -> the club's identity; seeking a job -> clubless orange; a new club -> its whole identity", () => {
  const s = createNewCareerState("club-identity-c5", TUMBA_CLUB_ID);
  assert.deepEqual(activeClubVisualIdentity(s), clubVisualIdentity(TUMBA_CLUB_ID));
  const unemployed = { ...s, managerCareer: { ...(s.managerCareer ?? {}), seekingJob: { since: s.gameDate, reason: "DISMISSED" } } } as typeof s;
  const clubless = activeClubVisualIdentity(unemployed);
  assert.equal(clubless.kind, "clubless");
  assert.equal(clubless.neon, CLUBLESS_ORANGE);
  assert.notEqual(clubless.neon, clubVisualIdentity(TUMBA_CLUB_ID).neon, "the former club's colours are not shown while clubless");
  const moved = { ...s, playerClubId: "se_club_hk_cliff" };
  assert.deepEqual(activeClubVisualIdentity(moved), clubVisualIdentity("se_club_hk_cliff"));
  assert.equal(activeClubVisualIdentity(null).kind, "clubless");
  const { style, dataIdentity } = clubIdentityStyle(activeClubVisualIdentity(moved));
  assert.equal(dataIdentity, "club");
  assert.equal(style["--club-neon"], clubVisualIdentity("se_club_hk_cliff").neon);
  assert.equal(clubIdentityStyle(clubless).style["--club-identity-primary"], undefined, "no kit colours while clubless");
});
