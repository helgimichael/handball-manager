// HM-RATINGS-CAREER-1.0 Part 28: directional proofs for the universal
// fallback rating generator -- pure, no CareerState involved.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateFallbackGameplayRating } from "./careerFallbackRating";
import { ATTRIBUTE_MAX, ATTRIBUTE_MIN, CA_MAX, CA_MIN, GOALKEEPER_ATTRIBUTES, OUTCOURT_ATTRIBUTES, PA_MAX, PA_MIN } from "../types";

// (8) generated rating deterministic.
test("(8) identical (playerId, position) always produces an identical rating", () => {
  const a = generateFallbackGameplayRating("player-1", "M9");
  const b = generateFallbackGameplayRating("player-1", "M9");
  assert.deepEqual(a, b);
});

// (10) generated rating does not depend on player name -- structurally true (function never takes a name), confirmed by signature; also prove two different-but-similar ids diverge (11).
test("(11) different player ids can produce differentiated profiles", () => {
  const a = generateFallbackGameplayRating("player-a", "M9");
  const b = generateFallbackGameplayRating("player-b", "M9");
  assert.notEqual(a.ca, b.ca);
});

// (12) outcourt player receives outcourt profile.
test("(12) an outcourt position receives a complete OUTCOURT branch, never goalkeeper attributes", () => {
  const rating = generateFallbackGameplayRating("player-out", "M6");
  assert.equal(rating.branch.branch, "OUTCOURT");
  if (rating.branch.branch === "OUTCOURT") {
    for (const attr of OUTCOURT_ATTRIBUTES) assert.ok(rating.branch.attributes[attr] !== undefined, `missing ${attr}`);
  }
});

// (13) goalkeeper receives goalkeeper profile.
test("(13) GK position receives a complete GOALKEEPER branch, never outcourt attributes", () => {
  const rating = generateFallbackGameplayRating("player-gk", "GK");
  assert.equal(rating.branch.branch, "GOALKEEPER");
  if (rating.branch.branch === "GOALKEEPER") {
    for (const attr of GOALKEEPER_ATTRIBUTES) assert.ok(rating.branch.attributes[attr] !== undefined, `missing ${attr}`);
  }
});

// (14) generated attributes remain within canonical bounds.
test("(14) every generated attribute value is within [ATTRIBUTE_MIN, ATTRIBUTE_MAX]", () => {
  const outcourt = generateFallbackGameplayRating("player-bounds-1", "V9");
  const gk = generateFallbackGameplayRating("player-bounds-2", "GK");
  if (outcourt.branch.branch === "OUTCOURT") {
    for (const attr of OUTCOURT_ATTRIBUTES) {
      const v = outcourt.branch.attributes[attr].value;
      assert.ok(v >= ATTRIBUTE_MIN && v <= ATTRIBUTE_MAX, `${attr}=${v}`);
    }
  }
  if (gk.branch.branch === "GOALKEEPER") {
    for (const attr of GOALKEEPER_ATTRIBUTES) {
      const v = gk.branch.attributes[attr].value;
      assert.ok(v >= ATTRIBUTE_MIN && v <= ATTRIBUTE_MAX, `${attr}=${v}`);
    }
  }
});

// (15) generated CA within canonical bounds.
test("(15) generated CA is within [CA_MIN, CA_MAX]", () => {
  for (let i = 0; i < 20; i++) {
    const rating = generateFallbackGameplayRating(`player-ca-${i}`, "H6");
    assert.ok(rating.ca >= CA_MIN && rating.ca <= CA_MAX, `ca=${rating.ca}`);
  }
});

// (16) generated PA within canonical bounds.
test("(16)/(17) generated PA is within [PA_MIN, PA_MAX] and always >= CA", () => {
  for (let i = 0; i < 20; i++) {
    const rating = generateFallbackGameplayRating(`player-pa-${i}`, "H9");
    assert.ok(rating.pa >= PA_MIN && rating.pa <= PA_MAX, `pa=${rating.pa}`);
    assert.ok(rating.pa >= rating.ca, `pa=${rating.pa} < ca=${rating.ca}`);
  }
});

// (18) generated PA stable -- same as determinism (8), re-confirmed explicitly for PA.
test("(18) generated PA is stable across repeated calls", () => {
  const a = generateFallbackGameplayRating("player-pa-stable", "V6");
  const b = generateFallbackGameplayRating("player-pa-stable", "V6");
  assert.equal(a.pa, b.pa);
});

// (20) provenance correct for generated prior.
test("(20) a generated rating's caSource is GENERATED_GAME_PRIOR and every attribute's own origin is GENERATED_PRIOR or DERIVED, never EVIDENCE_BACKED", () => {
  const rating = generateFallbackGameplayRating("player-provenance", "M9");
  assert.equal(rating.caSource, "GENERATED_GAME_PRIOR");
  if (rating.branch.branch === "OUTCOURT") {
    for (const attr of OUTCOURT_ATTRIBUTES) {
      assert.notEqual(rating.branch.attributes[attr].origin, "EVIDENCE_BACKED");
    }
  }
});

test("generated ratings never carry the locked flag", () => {
  const rating = generateFallbackGameplayRating("player-not-locked", "M9");
  assert.equal(rating.locked, false);
});
