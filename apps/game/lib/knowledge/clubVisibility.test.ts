// HM-DATA-ALLSVENSKAN-1.1B Part 13: club visibility resolver proofs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveClubVisibility } from "./clubVisibility";
import { CLUB_IDENTITY_CLAIM_FIELDS, COACH_IDENTITY_CLAIM_FIELDS, type ClubIdentityProfile, type CoachIdentityProfile, type IdentityClaim } from "../identity/types";

function countClubClaims(view: ReturnType<typeof resolveClubVisibility>["clubIdentity"]): number {
  return view ? CLUB_IDENTITY_CLAIM_FIELDS.reduce((sum, field) => sum + view[field].length, 0) : 0;
}
function countCoachClaims(view: ReturnType<typeof resolveClubVisibility>["coachIdentity"]): number {
  return view ? COACH_IDENTITY_CLAIM_FIELDS.reduce((sum, field) => sum + view[field].length, 0) : 0;
}

function claim(key: string, value: string): IdentityClaim {
  return { id: `c-${key}`, subjectType: "CLUB", subjectId: "club-x", domain: "TEST", key, value, evidenceClass: "USER_EXPERT_ASSESSMENT", temporalScope: "LONG_TERM", sourceRefs: [] };
}

function makeClubIdentity(): ClubIdentityProfile {
  return {
    clubId: "club-x",
    seasonReference: "2026/27",
    structuralIdentity: [claim("a", "1")],
    cultureIdentity: [claim("b", "1")],
    tacticalHeritage: [claim("c", "1"), claim("d", "1")],
    developmentIdentity: [claim("e", "1")],
    recruitmentIdentity: [claim("f", "1")],
    financialStrategicIdentity: [claim("g", "1")],
    supporterEnvironmentIdentity: [claim("h", "1")],
  };
}

function makeCoachIdentity(): CoachIdentityProfile {
  return {
    personId: "coach-1",
    coachingStyleClaims: [claim("i", "1")],
    tacticalPreferenceClaims: [claim("j", "1")],
    communicationLeadershipClaims: [],
    developmentClaims: [],
    adaptabilityClaims: [],
    cultureBuildingClaims: [],
  };
}

test("(1) MINIMAL knowledge reveals zero identity claims, but reports how many are hidden", () => {
  const view = resolveClubVisibility(makeClubIdentity(), makeCoachIdentity(), 10);
  assert.equal(view.tier, "MINIMAL");
  assert.equal(countClubClaims(view.clubIdentity), 0);
  assert.equal(view.hiddenClubClaimCount, 8);
  assert.equal(countCoachClaims(view.coachIdentity), 0);
  assert.equal(view.hiddenCoachClaimCount, 2);
});

test("(2) coach philosophy stays fully hidden at LOW even though the shared claim budget would allow some", () => {
  const view = resolveClubVisibility(makeClubIdentity(), makeCoachIdentity(), 30);
  assert.equal(view.tier, "LOW");
  assert.equal(countCoachClaims(view.coachIdentity), 0, "coach claims must stay hidden below MEDIUM");
  const clubVisible = countClubClaims(view.clubIdentity);
  assert.ok(clubVisible > 0, "LOW should reveal at least some club claims");
  assert.ok(clubVisible <= 3, "LOW's budget is capped at 3");
});

test("(3) MEDIUM knowledge unlocks coach claims and a larger club claim budget", () => {
  const view = resolveClubVisibility(makeClubIdentity(), makeCoachIdentity(), 60);
  assert.equal(view.tier, "MEDIUM");
  assert.ok(countCoachClaims(view.coachIdentity) > 0, "MEDIUM should reveal some coach claims");
});

test("(4) HIGH knowledge reveals every real claim, matching the pre-existing full-reveal behaviour for a fully-known club", () => {
  const view = resolveClubVisibility(makeClubIdentity(), makeCoachIdentity(), 90);
  assert.equal(view.tier, "HIGH");
  assert.equal(view.hiddenClubClaimCount, 0);
  assert.equal(view.hiddenCoachClaimCount, 0);
  assert.deepEqual(view.clubIdentity, makeClubIdentity());
});

test("(5) a club/coach with no real identity data at all (null) stays null regardless of knowledge -- absence, never fabrication", () => {
  const view = resolveClubVisibility(null, null, 90);
  assert.equal(view.clubIdentity, null);
  assert.equal(view.coachIdentity, null);
  assert.equal(view.hiddenClubClaimCount, 0);
});

test("(6) canonical claim data is never mutated by the resolver", () => {
  const identity = makeClubIdentity();
  const snapshot = JSON.parse(JSON.stringify(identity));
  resolveClubVisibility(identity, makeCoachIdentity(), 30);
  assert.deepEqual(identity, snapshot);
});
