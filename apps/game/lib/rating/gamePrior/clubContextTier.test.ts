// HM-RATINGS-0.6 Part C/O: proves the club context shift is bounded,
// deterministic, and defaults to 0 (no invented bonus) for a club with
// no season-context data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { clubContextShift } from "./clubContextTier";

test("HM-RATINGS-0.6: clubContextShift returns 0 for an unknown club (never throws, never invents a bonus)", () => {
  assert.equal(clubContextShift("not_a_real_club"), 0);
});

test("HM-RATINGS-0.6: clubContextShift is deterministic", () => {
  assert.equal(clubContextShift("se_club_hammarby_if_hf"), clubContextShift("se_club_hammarby_if_hf"));
});

test("HM-RATINGS-0.6: clubContextShift is bounded to a small range for every real club", () => {
  const realClubIds = [
    "se_club_alingsas_hk",
    "se_club_amo_hk",
    "se_club_hf_karlskrona",
    "se_club_hk_malmo",
    "se_club_hammarby_if_hf",
    "se_club_if_hallby_hk",
    "se_club_ifk_kristianstad",
    "se_club_ifk_skovde_hk",
    "se_club_ik_savehof",
    "se_club_lugi_hf",
    "se_club_ov_helsingborg",
    "se_club_skanela_if",
    "se_club_ystads_if_hf",
    "se_club_onnereds_hk",
  ];
  for (const clubId of realClubIds) {
    const shift = clubContextShift(clubId);
    assert.ok(shift >= -6 && shift <= 6, `${clubId} shift ${shift} out of bounds`);
  }
});
