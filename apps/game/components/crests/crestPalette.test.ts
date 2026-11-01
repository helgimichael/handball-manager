// HM-ALPHA3-M01: club-coloured fallback shields and the crest registry.
import { test } from "node:test";
import assert from "node:assert/strict";
import { contrastRatio, crestPalette } from "./crestPalette";
import { CLUB_CREST_ASSETS } from "./clubCrests";
import { CLUBS, getClub } from "../../lib/game-data";

const PLAYABLE_SWEDISH = CLUBS.filter((c) => c.playable && (c.competitionId === "se_handbollsligan_herr" || c.competitionId === "swe-2"));

test("the 28 playable Handbollsligan and Herrallsvenskan clubs all get a club-coloured shield with legible initials", () => {
  assert.equal(PLAYABLE_SWEDISH.length, 28);
  for (const club of PLAYABLE_SWEDISH) {
    const palette = crestPalette(club.primaryColor, club.secondaryColor);
    assert.ok(palette, `${club.id} has a palette`);
    assert.equal(palette!.fill, club.primaryColor);
    assert.ok(contrastRatio(palette!.text, palette!.fill) >= 3, `${club.id}: initials contrast ${contrastRatio(palette!.text, palette!.fill).toFixed(2)}`);
  }
});

test("the secondary colour is used for the initials when it is legible, otherwise white or ink", () => {
  assert.equal(crestPalette("#0a7a3d", "#ffffff")!.text, "#ffffff");
  assert.equal(crestPalette("#111318", "#e2b13c")!.text, "#e2b13c");
  // Black on dark blue is illegible, so the shield falls back to white initials.
  assert.equal(crestPalette("#1e3a8a", "#111318")!.text, "#ffffff");
  assert.equal(crestPalette("#e2b13c", "#ffffff")!.text, "#111318", "white on gold is too faint, ink wins");
});

test("no usable colour keeps the neutral themed shield", () => {
  assert.equal(crestPalette("", "#ffffff"), undefined);
  assert.equal(crestPalette("var(--hm-text-primary)", undefined), undefined);
  assert.equal(crestPalette(undefined, undefined), undefined);
});

test("every registered authentic crest maps to a real club and records its source and terms", () => {
  for (const [clubId, asset] of Object.entries(CLUB_CREST_ASSETS)) {
    assert.ok(getClub(clubId), `${clubId} is a known club id`);
    assert.ok(asset!.source.trim().length > 0, `${clubId}: source recorded`);
    assert.ok(asset!.usage.trim().length > 0, `${clubId}: usage terms recorded`);
  }
});
