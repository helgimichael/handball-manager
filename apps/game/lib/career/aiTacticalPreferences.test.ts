// HM-IDENTITY-0.3: proves the CurrentTeamIdentity -> AI tactical
// preference adapter is deterministic, explainable, and never lets
// conflicting/unknown/projected evidence produce a confident preference.
import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveAiTacticalPreferences } from "./aiTacticalPreferences";
import { resolveClubIdentityForMatch } from "../gameWorld/resolveClubIdentity";
import { resolveCurrentTeamIdentity, type ResolvedCurrentTeamIdentity } from "../identity/resolver";
import type { IdentityClaim } from "../identity/types";

const ALL_14_CLUB_IDS = [
  "se_club_alingsas_hk",
  "se_club_amo_hk",
  "se_club_hammarby_if_hf",
  "se_club_hf_karlskrona",
  "se_club_hk_malmo",
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

function resolveForClub(clubId: string) {
  return resolveClubIdentityForMatch(clubId, "2026/27", "2026-08-19");
}

// A minimal synthetic CurrentTeamIdentity for testing edge cases the real
// 14-club data may not exercise directly (conflicting evidence, raw
// unresolved projection/unknown claims fed straight in).
function syntheticIdentity(clubId: string, claims: ResolvedCurrentTeamIdentity["claims"]): ResolvedCurrentTeamIdentity {
  return {
    clubId,
    season: "2026/27",
    claims,
    derivedFrom: { clubIdentityRef: clubId },
    currentTacticalSelection: null,
  };
}

function baseClaim(overrides: Partial<IdentityClaim> & Pick<IdentityClaim, "id" | "domain" | "key" | "value">): IdentityClaim {
  return {
    subjectType: "CLUB",
    subjectId: "se_club_alingsas_hk",
    evidenceClass: "USER_EXPERT_ASSESSMENT",
    temporalScope: "LONG_TERM",
    sourceRefs: ["ev-test"],
    ...overrides,
  };
}

test("HM-IDENTITY-0.3: deterministic mapping -- the same resolved identity always produces byte-identical AI tactical preferences", () => {
  const identity = resolveForClub("se_club_ifk_kristianstad");
  const a = deriveAiTacticalPreferences(identity);
  const b = deriveAiTacticalPreferences(identity);
  assert.deepEqual(a, b);
});

test("HM-IDENTITY-0.3: all 14 clubs resolve to a safe AiTacticalPreferences, never throwing, always producing an approved-vocabulary profile", () => {
  assert.equal(ALL_14_CLUB_IDS.length, 14);
  for (const clubId of ALL_14_CLUB_IDS) {
    const identity = resolveForClub(clubId);
    const prefs = deriveAiTacticalPreferences(identity);
    assert.equal(prefs.clubId, clubId);
    assert.ok(["LOW", "MEDIUM", "HIGH"].includes(prefs.profile.ati001UsageTendency));
    assert.ok(["H2_HOLDS", "H2_DELAYS", "H2_STEERS", "H2_STEPS", "H2_STOPS"].includes(prefs.profile.h2ResponsePreference));
    assert.ok(["LOW", "MEDIUM", "HIGH"].includes(prefs.profile.tacticalFamiliarity));
  }
});

test("HM-IDENTITY-0.3: different supported identities produce different AI preferences -- IFK Kristianstad's real m6Involvement claim yields HIGH ati001UsageTendency, while a club with no such claim defaults to MEDIUM", () => {
  const kristianstad = deriveAiTacticalPreferences(resolveForClub("se_club_ifk_kristianstad"));
  const skovde = deriveAiTacticalPreferences(resolveForClub("se_club_ifk_skovde_hk"));
  assert.equal(kristianstad.profile.ati001UsageTendency, "HIGH");
  assert.equal(skovde.profile.ati001UsageTendency, "MEDIUM");
  assert.notEqual(kristianstad.profile.ati001UsageTendency, skovde.profile.ati001UsageTendency);
});

test("HM-IDENTITY-0.3: different supported identities produce different h2ResponsePreference -- Hammarby's literal 'defensiveSteering' claim yields H2_STEERS, IF Hallby's aggressive ball-winning defence yields H2_STOPS, and Ystad's defence claims (none on the whitelist) default to H2_STEPS", () => {
  const hammarby = deriveAiTacticalPreferences(resolveForClub("se_club_hammarby_if_hf"));
  const hallby = deriveAiTacticalPreferences(resolveForClub("se_club_if_hallby_hk"));
  const ystad = deriveAiTacticalPreferences(resolveForClub("se_club_ystads_if_hf"));

  assert.equal(hammarby.profile.h2ResponsePreference, "H2_STEERS");
  assert.equal(hallby.profile.h2ResponsePreference, "H2_STOPS");
  assert.equal(ystad.profile.h2ResponsePreference, "H2_STEPS");

  assert.ok(hammarby.h2ResponsePreference.contributingClaims.length > 0);
  assert.ok(hallby.h2ResponsePreference.contributingClaims.length > 0);
  assert.deepEqual(ystad.h2ResponsePreference.contributingClaims, []);
});

test("HM-IDENTITY-0.3: OV Helsingborg's real season tacticalCertainty LOW claim and its real currentAttackingIdentity NOT_YET_ESTABLISHED claim both drive tacticalFamiliarity to LOW, distinct from a club with no such evidence", () => {
  const ov = deriveAiTacticalPreferences(resolveForClub("se_club_ov_helsingborg"));
  const skanela = deriveAiTacticalPreferences(resolveForClub("se_club_skanela_if"));
  assert.equal(ov.profile.tacticalFamiliarity, "LOW");
  assert.ok(ov.tacticalFamiliarity.contributingClaims.length > 0);
  assert.equal(skanela.profile.tacticalFamiliarity, "MEDIUM");
});

test("HM-IDENTITY-0.3: IFK Kristianstad's real head-coach transition (season context) drives tacticalFamiliarity to LOW even without an explicit tacticalCertainty claim", () => {
  const identity = deriveAiTacticalPreferences(resolveForClub("se_club_ifk_kristianstad"));
  assert.equal(identity.profile.tacticalFamiliarity, "LOW");
  assert.ok(identity.tacticalFamiliarity.contributingClaims.some((c) => c.key === "headCoachTransition"));
});

test("HM-IDENTITY-0.3: conflicting evidence never produces a confident preference -- a resolved claim flagged conflicting (regardless of its sentinel value) is ignored, and the neutral default is used instead", () => {
  const conflictingClaim = {
    id: "team-test-attack-m6involvement",
    subjectType: "TEAM" as const,
    subjectId: "se_club_alingsas_hk",
    domain: "ATTACK",
    key: "m6Involvement",
    value: "CONFLICTING",
    evidenceClass: "INFERENCE" as const,
    temporalScope: "CURRENT" as const,
    sourceRefs: ["ev-a", "ev-b"],
    contributingClaims: [
      baseClaim({ id: "a", subjectType: "CLUB", domain: "ATTACK", key: "m6Involvement", value: "HIGH" }),
      baseClaim({ id: "b", subjectType: "COACH", domain: "ATTACK", key: "m6Involvement", value: "LOW" }),
    ],
    conflicting: true,
  };
  const identity = syntheticIdentity("se_club_alingsas_hk", [conflictingClaim]);
  const prefs = deriveAiTacticalPreferences(identity);
  assert.equal(prefs.profile.ati001UsageTendency, "MEDIUM");
  assert.deepEqual(prefs.ati001UsageTendency.contributingClaims, []);
});

test("HM-IDENTITY-0.3: UNKNOWN_NOT_ASSESSED evidence never produces a confident preference", () => {
  const unknownClaim = {
    id: "team-test-defence-contactseeking",
    subjectType: "TEAM" as const,
    subjectId: "se_club_alingsas_hk",
    domain: "DEFENCE",
    key: "contactSeeking",
    value: "UNKNOWN",
    evidenceClass: "UNKNOWN_NOT_ASSESSED" as const,
    temporalScope: "LONG_TERM" as const,
    sourceRefs: ["ev-a"],
    contributingClaims: [baseClaim({ id: "a", domain: "DEFENCE", key: "contactSeeking", value: "UNKNOWN", evidenceClass: "UNKNOWN_NOT_ASSESSED" })],
    conflicting: false,
  };
  const identity = syntheticIdentity("se_club_alingsas_hk", [unknownClaim]);
  const prefs = deriveAiTacticalPreferences(identity);
  assert.equal(prefs.profile.h2ResponsePreference, "H2_STEPS");
  assert.deepEqual(prefs.h2ResponsePreference.contributingClaims, []);
});

test("HM-IDENTITY-0.3: USER_PROJECTION never becomes established AI behaviour, even when it would otherwise match a whitelisted (domain,key)", () => {
  const projectedClaim = {
    id: "team-test-attack-m6involvement-projected",
    subjectType: "TEAM" as const,
    subjectId: "se_club_alingsas_hk",
    domain: "ATTACK",
    key: "m6Involvement",
    value: "HIGH",
    evidenceClass: "USER_PROJECTION" as const,
    temporalScope: "PROJECTED" as const,
    sourceRefs: ["ev-a"],
    contributingClaims: [baseClaim({ id: "a", domain: "ATTACK", key: "m6Involvement", value: "HIGH", evidenceClass: "USER_PROJECTION", temporalScope: "PROJECTED" })],
    conflicting: false,
  };
  const identity = syntheticIdentity("se_club_alingsas_hk", [projectedClaim]);
  const prefs = deriveAiTacticalPreferences(identity);
  assert.equal(prefs.profile.ati001UsageTendency, "MEDIUM", "a projected HIGH must never resolve to an established HIGH tendency");
  assert.deepEqual(prefs.ati001UsageTendency.contributingClaims, []);
});

test("HM-IDENTITY-0.3: real OV Helsingborg data -- the club's own PROJECTED claims (Siglev-era projections) never leak into the resolved AI tactical preference even though the club also has genuine CURRENT/SEASON evidence", () => {
  const identity = resolveForClub("se_club_ov_helsingborg");
  assert.ok(identity.claims.some((c) => c.evidenceClass === "USER_PROJECTION"), "sanity check: OV Helsingborg's resolved identity really does contain a projection");
  const prefs = deriveAiTacticalPreferences(identity);
  const allContributing = [...prefs.ati001UsageTendency.contributingClaims, ...prefs.h2ResponsePreference.contributingClaims, ...prefs.tacticalFamiliarity.contributingClaims];
  assert.ok(allContributing.every((c) => c.evidenceClass !== "USER_PROJECTION"), "no USER_PROJECTION claim may contribute to an AI tactical preference");
});

test("HM-IDENTITY-0.3: provenance/explanation is always available -- every mapped dimension carries a non-empty explanation string, and a non-default value always traces back to real contributing IdentityClaims", () => {
  for (const clubId of ALL_14_CLUB_IDS) {
    const prefs = deriveAiTacticalPreferences(resolveForClub(clubId));
    for (const dim of [prefs.ati001UsageTendency, prefs.h2ResponsePreference, prefs.tacticalFamiliarity]) {
      assert.ok(dim.explanation.length > 0);
      const isDefaultValue = dim === prefs.ati001UsageTendency ? dim.value === "MEDIUM" : dim === prefs.h2ResponsePreference ? dim.value === "H2_STEPS" : dim.value === "MEDIUM";
      if (!isDefaultValue) {
        assert.ok(dim.contributingClaims.length > 0, `${clubId}: a non-default value must always carry provenance`);
      }
    }
  }
});

test("HM-IDENTITY-0.3: AI-vs-AI determinism preserved -- deriving preferences for two different AI clubs from freshly resolved identities twice each yields identical results (no randomness, no shared mutable state between clubs)", () => {
  const clubA1 = deriveAiTacticalPreferences(resolveForClub("se_club_hammarby_if_hf"));
  const clubB1 = deriveAiTacticalPreferences(resolveForClub("se_club_ifk_kristianstad"));
  const clubA2 = deriveAiTacticalPreferences(resolveForClub("se_club_hammarby_if_hf"));
  const clubB2 = deriveAiTacticalPreferences(resolveForClub("se_club_ifk_kristianstad"));
  assert.deepEqual(clubA1, clubA2);
  assert.deepEqual(clubB1, clubB2);
  assert.notDeepEqual(clubA1.profile, clubB1.profile);
});

test("HM-IDENTITY-0.3: a club with no imported identity data at all resolves to the fully neutral default profile, never inventing a preference", () => {
  const empty = resolveCurrentTeamIdentity({
    clubId: "se_club_onnereds_hk",
    season: "2026/27",
    clubIdentity: null,
    coachPersonId: null,
    coachIdentity: null,
    squadContext: null,
    seasonContext: null,
    tacticalProfile: null,
  });
  const prefs = deriveAiTacticalPreferences(empty);
  assert.deepEqual(prefs.profile, { ati001UsageTendency: "MEDIUM", h2ResponsePreference: "H2_STEPS", tacticalFamiliarity: "MEDIUM" });
});
