// Club Identity C5: one source of club colour truth, locked visual rules (L2-L5, L8), invariant I10.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CLUBS, getClub, clubVisualIdentity, clubMarkColours, clubVisualRecord, CLUBLESS_ORANGE, ICE_SILVER, FALLBACK_LABEL, parentClubOf } from "./index";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const registry = JSON.parse(readFileSync(here("../../../../design-lab/experience-2027/club-identity/registry.json"), "utf8")) as { clubless: string; monochrome: string; clubs: { id: string; neon: string; status: string; fallback: boolean; neonRule: string; sources: unknown[]; canonicalId: string; clubStatus: string; parentClubId: string | null }[] };

test("the production table is generated from the registry and is not stale", () => {
  const out = execFileSync(process.execPath, [here("../../scripts/generate-club-visual-identity.mjs"), "--check"], { encoding: "utf8" });
  assert.match(out, /up to date/);
});

test("I10: every club joins exactly one registry entry by storage id, and the registry mirrors the identity records", () => {
  assert.equal(registry.clubs.length, CLUBS.length);
  for (const c of CLUBS) {
    const r = registry.clubs.find((x) => x.id === c.id);
    assert.ok(r, `${c.id} in registry`);
    assert.ok(clubVisualRecord(c.id), `${c.id} in production table`);
    assert.equal(r.canonicalId, c.canonicalId ?? c.id, `${c.id} canonical id copied from the record`);
    assert.equal(r.clubStatus, c.status ?? "active");
    assert.equal(r.parentClubId, parentClubOf(c.id) ?? null);
    assert.equal(clubVisualIdentity(c.id).neon, r.fallback ? CLUBLESS_ORANGE : r.neon.toLowerCase());
  }
});

test("locked rules: Ice Silver for black/white, orange fallback (marked, never 'verified') for unknown / not researched / retired, orange when clubless", () => {
  for (const c of CLUBS) {
    const v = clubVisualIdentity(c.id), r = clubVisualRecord(c.id)!;
    if (["UNKNOWN", "NOT_RESEARCHED", "RETIRED"].includes(r.status)) assert.equal(v.kind, "fallback", c.id);
    if (v.kind === "fallback") { assert.equal(v.neon, CLUBLESS_ORANGE); assert.equal(v.verifiedColour, false); assert.equal(v.fallbackLabel, FALLBACK_LABEL); assert.equal(v.kit, null); }
    else { assert.equal(v.fallbackLabel, null); assert.equal(v.verifiedColour, true); }
    if (v.kind === "ice") assert.equal(v.neon, ICE_SILVER);
  }
  const none = clubVisualIdentity(undefined);
  assert.equal(none.kind, "clubless");
  assert.equal(none.neon, CLUBLESS_ORANGE);
  assert.equal(none.verifiedColour, false);
  assert.equal(clubVisualIdentity("ger2-wilhelmshaven").kind, "fallback", "retired tombstone renders with the fallback");
  assert.equal(clubVisualIdentity("ger1-bietigheim").status, "NOT_RESEARCHED", "new ids enter unresearched");
  assert.equal(clubVisualIdentity("se_club_hk_cliff").kind, "club", "HK Cliff keeps its own (yellow) identity");
  assert.notEqual(clubVisualIdentity("se_club_hk_cliff").neon, clubVisualIdentity("se_club_hammarby_if_hf").neon);
});

test("L8: B/U teams never inherit a parent's colours -- an affiliate colour always has its own evidence", () => {
  for (const r of registry.clubs.filter((x) => x.parentClubId)) {
    if (!r.fallback) assert.ok(r.sources.length > 0, `${r.id} has its own kit evidence`);
  }
});

test("one source of club colour truth: no hard-coded club colours in the club data or the crest specs", () => {
  for (const file of ["./clubs.ts", "../../components/crests/clubIdentity.ts"]) {
    const src = readFileSync(here(file), "utf8");
    // Only the neutral placeholder (#6b7280 / #ffffff, claims nothing) may appear.
    const literals = [...src.matchAll(/(?:primaryColor|secondaryColor):\s*"(#[0-9a-fA-F]{6})"/g)].map((m) => m[1]!.toLowerCase());
    assert.deepEqual(literals.filter((h) => h !== "#6b7280" && h !== "#ffffff"), [], `${file} stores no club colours`);
  }
  for (const c of CLUBS) {
    const mark = clubMarkColours(c.id);
    if (mark) { assert.equal(c.colourSource, "REGISTRY"); assert.equal(c.primaryColor, mark.primary); }
    else { assert.equal(c.colourSource, "PLACEHOLDER"); assert.equal(c.primaryColor, "#6b7280", `${c.id}: a neutral placeholder that claims nothing`); }
  }
  assert.ok(CLUBS.filter((c) => c.colourSource === "REGISTRY").length >= 190);
  assert.equal(getClub("swe2-torslanda")!.colourSource, "REGISTRY", "documented crest colours are used even when the shirt is unknown (crests keep their own colours)");
});
