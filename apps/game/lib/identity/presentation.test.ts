// HM-DATA-ALLSVENSKAN-1.2: proves the identity presentation layer never
// leaks a raw machine key or enum value into its rendered text, across
// EVERY real claim in the current 14-club Allsvenskan dataset (club +
// coach identity files) -- not just a handful of hand-picked examples.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { presentClaim } from "./presentation";
import type { IdentityClaim } from "./types";

const IDENTITY_ROOT = path.join(__dirname, "..", "..", "..", "..", "data", "real-world", "sweden", "2026-27", "allsvenskan", "identity");

const CLUB_CLAIM_FIELDS = ["structuralIdentity", "cultureIdentity", "tacticalHeritage", "developmentIdentity", "recruitmentIdentity", "financialStrategicIdentity", "supporterEnvironmentIdentity"];
const COACH_CLAIM_FIELDS = ["coachingStyleClaims", "tacticalPreferenceClaims", "communicationLeadershipClaims", "developmentClaims", "adaptabilityClaims", "cultureBuildingClaims"];

function loadAllClaims(): IdentityClaim[] {
  const claims: IdentityClaim[] = [];
  for (const kind of ["club", "coach"] as const) {
    const dir = path.join(IDENTITY_ROOT, kind);
    const fields = kind === "club" ? CLUB_CLAIM_FIELDS : COACH_CLAIM_FIELDS;
    for (const file of fs.readdirSync(dir)) {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      const profile = data.profile;
      for (const field of fields) {
        for (const claim of profile[field] ?? []) claims.push(claim as IdentityClaim);
      }
    }
  }
  return claims;
}

test("(1) presentClaim produces at least 100 real claims from the current Allsvenskan dataset (sanity: the fixture path/loader itself works)", () => {
  const claims = loadAllClaims();
  assert.ok(claims.length >= 100, `expected >=100 real claims, found ${claims.length}`);
});

test("(2) presentClaim never renders a raw SCREAMING_SNAKE_CASE enum token (an underscore, or 2+ consecutive uppercase letters) for any real claim in the dataset", () => {
  const claims = loadAllClaims();
  const offenders: string[] = [];
  for (const claim of claims) {
    const text = presentClaim(claim);
    if (/_/.test(text) || /[A-Z]{2,}/.test(text)) {
      offenders.push(`${claim.key}=${claim.value} -> "${text}"`);
    }
  }
  assert.equal(offenders.length, 0, `raw-looking output for: ${offenders.join("; ")}`);
});

test("(3) presentClaim never renders the raw camelCase key verbatim as a label (e.g. 'sevenVSixFrequency' itself must not appear in the output)", () => {
  const claims = loadAllClaims();
  const offenders: string[] = [];
  for (const claim of claims) {
    const text = presentClaim(claim);
    if (text.includes(claim.key)) offenders.push(`${claim.key} -> "${text}"`);
  }
  assert.equal(offenders.length, 0, `raw key leaked for: ${offenders.join("; ")}`);
});

test("(4) presentClaim is a pure function of the claim -- calling it twice on the same claim produces byte-identical text", () => {
  const claims = loadAllClaims();
  for (const claim of claims.slice(0, 20)) {
    assert.equal(presentClaim(claim), presentClaim(claim));
  }
});

test("(5) the two documented worked examples match the spec's own expected phrasing shape", () => {
  const sevenVSix: IdentityClaim = {
    id: "x1", subjectType: "CLUB", subjectId: "c", domain: "TACTICAL_HERITAGE", key: "sevenVSixFrequency", value: "EXTREME",
    evidenceClass: "USER_EXPERT_ASSESSMENT", temporalScope: "LONG_TERM", sourceRefs: [],
  };
  assert.match(presentClaim(sevenVSix), /7 mot 6/);
  assert.match(presentClaim(sevenVSix), /ofta/);

  const centralisation: IdentityClaim = {
    id: "x2", subjectType: "CLUB", subjectId: "c", domain: "STRUCTURAL", key: "staffTacticalCentralisation", value: "EXTREME_AROUND_HEAD_COACH",
    evidenceClass: "USER_EXPERT_ASSESSMENT", temporalScope: "LONG_TERM", sourceRefs: [],
  };
  assert.match(presentClaim(centralisation), /Huvudtränaren/);
  assert.match(presentClaim(centralisation), /inflytande/);
});

test("(6) an unknown key still produces a non-empty, non-raw-looking string (safety net, not a crash)", () => {
  const claim: IdentityClaim = {
    id: "x3", subjectType: "CLUB", subjectId: "c", domain: "FUTURE_DOMAIN", key: "someFutureKeyNotYetTaught", value: "SOME_FUTURE_VALUE",
    evidenceClass: "INFERENCE", temporalScope: "CURRENT", sourceRefs: [],
  };
  const text = presentClaim(claim);
  assert.ok(text.length > 0);
  assert.ok(!text.includes("someFutureKeyNotYetTaught"));
  assert.ok(!/[A-Z]{2,}/.test(text));
});
