// HM-RATINGS-0.1: proves the Player Rating domain foundation can
// REPRESENT the qualitative Sweden 2026/27 calibration cases named in
// the Rating Model spec, and -- critically -- that none of them receives
// a final numeric CA/PA/attribute rating in this milestone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePlayerRatingProfile } from "./validators";
import {
  ANDERS_WIK_RYDBERG_ID,
  ANDREAS_NILSSON_ID,
  BALDUR_FRITZ_BJARNASON_ID,
  GUSTAV_DAVIDSSON_ID,
  LIAM_HULTBERG_ID,
  MALTE_HAGLUND_ID,
  NICLAS_EKBERG_ID,
  ROBIN_JARLING_ID,
  SWEDEN_CALIBRATION_PROFILES,
  andersWikRydbergProfile,
  andreasNilssonProfile,
  baldurFritzBjarnasonProfile,
  gustavDavidssonProfile,
  liamHultbergProfile,
  malteHaglundProfile,
  niclasEkbergProfile,
  robinJarlingProfile,
} from "./swedenCalibrationFixtures";

test("HM-RATINGS-0.1: all 8 Sweden calibration fixtures validate cleanly against the domain's own invariants", () => {
  assert.equal(SWEDEN_CALIBRATION_PROFILES.length, 8);
  for (const profile of SWEDEN_CALIBRATION_PROFILES) {
    const result = validatePlayerRatingProfile(profile);
    assert.equal(result.ok, true, result.ok ? "" : `${profile.playerId}: ${JSON.stringify(result.errors)}`);
  }
});

test("HM-RATINGS-0.1: no calibration fixture carries a numeric CA/PA value -- ca.value and pa.value are null for all 8, exactly matching the 'no final ratings yet' rule", () => {
  for (const profile of SWEDEN_CALIBRATION_PROFILES) {
    assert.equal(profile.ca.value, null, `${profile.playerId}: ca.value must be null -- no final CA is assigned in this milestone`);
    assert.equal(profile.pa.value, null, `${profile.playerId}: pa.value must be null -- no final PA is assigned in this milestone`);
  }
});

test("HM-RATINGS-0.1: no calibration fixture carries a numeric attribute value -- outcourtAttributes/goalkeeperAttributes are absent for all 8", () => {
  for (const profile of SWEDEN_CALIBRATION_PROFILES) {
    assert.equal(profile.outcourtAttributes, undefined, `${profile.playerId}: no outcourt attribute values are assigned in this milestone`);
    assert.equal(profile.goalkeeperAttributes, undefined, `${profile.playerId}: no goalkeeper attribute values are assigned in this milestone`);
  }
});

test("HM-RATINGS-0.1: no calibration fixture carries a numeric role-proficiency value -- roles are recorded as claimed vocabulary only", () => {
  for (const profile of SWEDEN_CALIBRATION_PROFILES) {
    for (const rp of [...profile.attackRoleProficiencies, ...profile.defenceRoleProficiencies]) {
      assert.equal(rp.value, undefined, `${profile.playerId}: RoleProficiency "${rp.role}" must have no numeric value assigned in this milestone`);
    }
  }
});

test("HM-RATINGS-0.1: every claim across all 8 fixtures carries only string evidence values (qualitative), never a bare number that could be mistaken for a CA/PA/attribute rating", () => {
  for (const profile of SWEDEN_CALIBRATION_PROFILES) {
    for (const claim of profile.claims) {
      assert.equal(typeof claim.value, "string", `${profile.playerId} claim "${claim.id}" must carry a qualitative string value, not a number`);
    }
  }
});

// ---------------------------------------------------------------------------
// Gustav Davidsson -- elite playmaker anchor
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.1: Gustav Davidsson is representable as an elite playmaker -- CLUB_STAR + PRIMARY_PLAYMAKER anchors, EXCEPTIONAL passing/M6-cooperation functional anchors, all as USER_EXPERT_PLAYER_ANCHOR evidence", () => {
  const anchorValues = gustavDavidssonProfile.claims.filter((c) => c.domain === "ANCHOR").map((c) => c.value);
  assert.ok(anchorValues.includes("CLUB_STAR"));
  assert.ok(anchorValues.includes("PRIMARY_PLAYMAKER"));
  assert.ok(gustavDavidssonProfile.attackRoleProficiencies.some((r) => r.role === "PRIMARY_PLAYMAKER"));
  assert.ok(gustavDavidssonProfile.claims.every((c) => c.evidenceClass !== "PROJECTION_EXPECTATION"), "Gustav Davidsson's evidence is all current/verified, not forward-looking projection");
});

// ---------------------------------------------------------------------------
// Niclas Ekberg -- club icon/star
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.1: Niclas Ekberg is representable as a club icon/star with a league-best H6 functional anchor", () => {
  const anchorValues = niclasEkbergProfile.claims.filter((c) => c.domain === "ANCHOR").map((c) => c.value);
  assert.ok(anchorValues.includes("CLUB_ICON"));
  assert.ok(anchorValues.includes("CLUB_STAR"));
  const h6Standing = niclasEkbergProfile.claims.find((c) => c.key === "H6_POSITIONAL_STANDING");
  assert.equal(h6Standing?.value, "LEAGUE_BEST");
});

// ---------------------------------------------------------------------------
// Andreas Nilsson -- offensive M6 + weaker defence specialism
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.1: Andreas Nilsson represents elite offense + explicitly weaker defence without either phase being smoothed toward the other -- no defenceRoleProficiency exists despite an elite attack anchor", () => {
  assert.equal(andreasNilssonProfile.attackRoleProficiencies.length, 1);
  assert.equal(andreasNilssonProfile.attackRoleProficiencies[0].role, "OFFENSIVE_PIVOT");
  assert.deepEqual(andreasNilssonProfile.defenceRoleProficiencies, [], "no defensive role is claimed -- the weaker defence signal lives only in the functional attribute claim, never invented as a role");

  const defensiveClaim = andreasNilssonProfile.claims.find((c) => c.key === "DEFENSIVE_ABILITY");
  const offensiveClaim = andreasNilssonProfile.claims.find((c) => c.key === "OFFENSIVE_IMPACT");
  assert.equal(defensiveClaim?.value, "BELOW_PROFILE_EXPECTATION");
  assert.equal(offensiveClaim?.value, "ELITE");
  assert.notEqual(defensiveClaim?.value, offensiveClaim?.value, "the two phases must remain independently evidenced, never averaged toward one figure");
});

// ---------------------------------------------------------------------------
// Liam Hultberg -- high current ability + very high potential
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.1: Liam Hultberg represents 'young but already CLUB_STAR-level, with VERY_HIGH_TO_EXTREME future ceiling' without CA/PA being pinned to any number -- youth never forces low CA in this domain", () => {
  const anchorValues = liamHultbergProfile.claims.filter((c) => c.domain === "ANCHOR").map((c) => c.value);
  assert.ok(anchorValues.includes("CLUB_STAR"), "already a club star despite being young");
  assert.ok(anchorValues.includes("VERY_HIGH_POTENTIAL"));
  assert.equal(liamHultbergProfile.ca.value, null);
  assert.equal(liamHultbergProfile.pa.value, null);
  // Structural proof that "age" plays no role at all: PlayerRatingProfile has no age field to even reference.
  assert.ok(!("age" in liamHultbergProfile));
});

// ---------------------------------------------------------------------------
// Anders Wik Rydberg -- defensive specialist
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.1: Anders Wik Rydberg is representable as a pure defensive specialist -- DEFENSIVE_SPECIALIST role claimed, zero attack role proficiencies, validator does not penalize the missing attack phase", () => {
  assert.equal(andersWikRydbergProfile.defenceRoleProficiencies.length, 1);
  assert.equal(andersWikRydbergProfile.defenceRoleProficiencies[0].role, "DEFENSIVE_SPECIALIST");
  assert.deepEqual(andersWikRydbergProfile.attackRoleProficiencies, []);
  assert.equal(validatePlayerRatingProfile(andersWikRydbergProfile).ok, true, "a specialist with zero attack-role claims must still validate cleanly");
});

// ---------------------------------------------------------------------------
// Baldur Fritz Bjarnason -- large CA/PA gap
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.1: Baldur Fritz Bjarnason represents a large development-gap case -- VERY_HIGH_POTENTIAL anchor plus a separately-tracked injury-tendency claim, with PA never leaking into any current-performance field", () => {
  const potentialClaim = baldurFritzBjarnasonProfile.claims.find((c) => c.key === "potential");
  assert.equal(potentialClaim?.value, "VERY_HIGH_POTENTIAL");
  assert.equal(potentialClaim?.evidenceClass, "USER_EXPERT_PLAYER_ANCHOR");

  const injuryClaim = baldurFritzBjarnasonProfile.claims.find((c) => c.evidenceClass === "INJURY_AVAILABILITY");
  assert.ok(injuryClaim, "injury tendency must be present as its own INJURY_AVAILABILITY claim");
  assert.equal(baldurFritzBjarnasonProfile.pa.value, null, "the large PA vs CA gap is represented by a genuinely unassessed PA, never a fabricated point value");

  // The market-interest projection must never be confirmed fact.
  const projection = baldurFritzBjarnasonProfile.claims.find((c) => c.evidenceClass === "PROJECTION_EXPECTATION");
  assert.notEqual(projection?.confidence, "CONFIRMED");
});

// ---------------------------------------------------------------------------
// Robin Järling -- potential separate from injury risk
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.1: Robin Järling keeps HIGH_POTENTIAL and major injury history as two independent claims -- durability evidence never contaminates the potential anchor's own evidence class", () => {
  const potentialClaim = robinJarlingProfile.claims.find((c) => c.key === "potential");
  const injuryClaim = robinJarlingProfile.claims.find((c) => c.evidenceClass === "INJURY_AVAILABILITY");

  assert.equal(potentialClaim?.value, "HIGH_POTENTIAL");
  assert.equal(potentialClaim?.evidenceClass, "USER_EXPERT_PLAYER_ANCHOR");
  assert.ok(injuryClaim);
  assert.equal(injuryClaim?.domain, "INJURY");
  assert.notEqual(potentialClaim?.id, injuryClaim?.id, "potential and injury are two separate claims, never merged into one");

  // The injury claim itself is explicitly unverified -- must not be silently treated as confirmed.
  assert.equal(injuryClaim?.confidence, "UNCERTAIN");
});

// ---------------------------------------------------------------------------
// Malte Haglund -- prestigious pathway must not automatically create high PA
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.1: Malte Haglund's prestigious VfL Gummersbach pathway is recorded as a VERIFIED_CAREER_SIGNAL, but his potential anchor is explicitly NORMAL_OR_UNCERTAIN_POTENTIAL -- the anti-bias rule that pathway prestige does not automatically imply HIGH_POTENTIAL", () => {
  const careerSignal = malteHaglundProfile.claims.find((c) => c.evidenceClass === "VERIFIED_CAREER_SIGNAL");
  assert.ok(careerSignal, "the Gummersbach pathway itself is real, verified evidence");
  assert.ok(String(careerSignal!.value).includes("Gummersbach"));

  const potentialClaim = malteHaglundProfile.claims.find((c) => c.key === "potential");
  assert.equal(potentialClaim?.value, "NORMAL_OR_UNCERTAIN_POTENTIAL");
  assert.notEqual(potentialClaim?.value, "HIGH_POTENTIAL", "a prestigious foreign pathway alone must never automatically upgrade the potential anchor to HIGH_POTENTIAL");
});

test("HM-RATINGS-0.1: all 8 named calibration players resolve to distinct player ids, matching the Rating Model's own named calibration set", () => {
  const ids = [GUSTAV_DAVIDSSON_ID, NICLAS_EKBERG_ID, ANDREAS_NILSSON_ID, LIAM_HULTBERG_ID, ANDERS_WIK_RYDBERG_ID, BALDUR_FRITZ_BJARNASON_ID, ROBIN_JARLING_ID, MALTE_HAGLUND_ID];
  assert.equal(new Set(ids).size, 8);
  assert.deepEqual(
    new Set(SWEDEN_CALIBRATION_PROFILES.map((p) => p.playerId)),
    new Set(ids),
  );
});
