// HM-RATINGS-0.5: proves the orchestration layer -- calibrated players
// pass through untouched, extended-evidence players get an ESTIMATED
// CA, and evidence/provenance (claims) are retained in the resulting
// profile for audit, never silently discarded.
import { test } from "node:test";
import assert from "node:assert/strict";
import { unassessedAbilityRating } from "../validators";
import { CA_MAX, CA_MIN, PA_MAX, PA_MIN, type PlayerRatingProfile } from "../types";
import { applyCAEstimation } from "./applyCAEstimation";
import { matchExtendedEvidence } from "./extendedPlayerEvidence";

function unassessedProfile(playerId: string): PlayerRatingProfile {
  return {
    playerId,
    position: "GK",
    physicalProfile: {},
    attackRoleProficiencies: [],
    defenceRoleProficiencies: [],
    phaseAbilities: [],
    usage: { attackUsageShare: 0, defenceUsageShare: 0, transitionUsageShare: 0 },
    utility: { utility: 0, positionalFlexibility: 0 },
    ca: unassessedAbilityRating(CA_MIN, CA_MAX),
    pa: unassessedAbilityRating(PA_MIN, PA_MAX),
    claims: [],
  };
}

test("HM-RATINGS-0.5: a calibrated player passes through completely untouched -- no estimation attempted or needed", () => {
  const profile = { ...unassessedProfile("p1"), ca: { value: 166, confidence: "HIGH" as const, plausibleRange: { min: 160, max: 172 } } };
  const outcome = applyCAEstimation(profile, "Gustav Davidsson", true);
  assert.equal(outcome.caProposal, null);
  assert.deepEqual(outcome.profile, profile);
});

test("HM-RATINGS-0.5: an extended-evidence-matched player (Niklas Kraft) gets an ESTIMATED CA with the estimate applied to the profile", () => {
  const profile = unassessedProfile("real_niklas_kraft_x1");
  const outcome = applyCAEstimation(profile, "Niklas Kraft", false);
  assert.equal(outcome.caProposal?.status, "ESTIMATED");
  assert.equal(outcome.profile.ca.value, outcome.caProposal?.value);
  assert.ok(outcome.extendedEvidenceClaims.length > 0);
  assert.ok(outcome.profile.claims.some((c) => c.id.startsWith("ext-niklas-kraft")));
});

test("HM-RATINGS-0.5: an unmatched player (no calibration, no extended evidence) stays UNRESOLVED and the profile is unchanged", () => {
  const profile = unassessedProfile("random_player_id");
  const outcome = applyCAEstimation(profile, "Completely Unknown Player", false);
  assert.equal(outcome.caProposal?.status, "UNRESOLVED");
  assert.equal(outcome.profile.ca.value, null);
  assert.deepEqual(outcome.profile, profile);
});

test("HM-RATINGS-0.5: evidence/provenance is retained -- the estimated profile's claims include both the original structural claims and the new extended-evidence claims", () => {
  const positionClaim = { id: "pos", playerId: "real_niklas_kraft_x1", evidenceClass: "VERIFIED_CAREER_SIGNAL" as const, domain: "POSITION", key: "primaryPosition", value: "GK", sourceRefs: [] };
  const profile = { ...unassessedProfile("real_niklas_kraft_x1"), claims: [positionClaim] };
  const outcome = applyCAEstimation(profile, "Niklas Kraft", false);
  assert.ok(outcome.profile.claims.some((c) => c.id === "pos"), "original structural claim must survive");
  assert.ok(outcome.profile.claims.length > 1, "extended evidence claims must be added, not replace the original claims");
});

test("HM-RATINGS-0.5: matchExtendedEvidence is deterministic and returns [] for the ~262 players outside the small hand-transcribed set", () => {
  assert.deepEqual(matchExtendedEvidence("Some Random Handbollsligan Player", "id1"), []);
  const a = matchExtendedEvidence("August Wiger", "id2");
  const b = matchExtendedEvidence("August Wiger", "id2");
  assert.deepEqual(a, b);
  assert.ok(a.length > 0);
});
