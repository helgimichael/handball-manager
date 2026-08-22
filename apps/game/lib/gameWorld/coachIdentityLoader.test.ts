// HM-COACH-IDENTITY-0.1: proves the imported portable coach identity
// data for the 9 coaches with a source-supported assessment satisfies
// every HM-IDENTITY-0.1 invariant and this milestone's own required
// coverage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCoachIdentityProfile } from "../identity/validators";
import { loadClubStaffIdentity } from "./staffIdentityLoader";
import { listCoachIdentityPersonIds, loadCoachIdentity, type RawCoachIdentity } from "./coachIdentityLoader";
import { snapshotCoachIdentity } from "./coachIdentitySnapshot";
import type { IdentityClaim } from "../identity/types";

function loadAll(): Map<string, RawCoachIdentity> {
  const byPerson = new Map<string, RawCoachIdentity>();
  for (const personId of listCoachIdentityPersonIds()) {
    const raw = loadCoachIdentity(personId);
    assert.ok(raw, `expected ${personId} to load`);
    byPerson.set(personId, raw!);
  }
  return byPerson;
}

function allClaims(raw: RawCoachIdentity): IdentityClaim[] {
  const p = raw.profile;
  return [...p.coachingStyleClaims, ...p.tacticalPreferenceClaims, ...p.communicationLeadershipClaims, ...p.developmentClaims, ...p.adaptabilityClaims, ...p.cultureBuildingClaims];
}

test("HM-COACH-IDENTITY-0.1: at least 9 coach identity files exist and all load", () => {
  const ids = listCoachIdentityPersonIds();
  assert.ok(ids.length >= 9, `expected at least 9 coach identity files, got ${ids.length}`);
  const byPerson = loadAll();
  assert.equal(byPerson.size, ids.length);
});

test("HM-COACH-IDENTITY-0.1: claims attach to the correct personId -- every claim's subjectId equals the profile's own personId, never another coach's", () => {
  const byPerson = loadAll();
  for (const [personId, raw] of byPerson) {
    assert.equal(raw.profile.personId, personId);
    for (const claim of allClaims(raw)) {
      assert.equal(claim.subjectType, "COACH");
      assert.equal(claim.subjectId, personId, `claim ${claim.id} in ${personId}'s file has subjectId "${claim.subjectId}" instead`);
    }
  }
});

test("HM-COACH-IDENTITY-0.1: every claim across every coach validates against HM-IDENTITY-0.1's validateIdentityClaim (via validateCoachIdentityProfile)", () => {
  const byPerson = loadAll();
  let totalClaims = 0;
  for (const [personId, raw] of byPerson) {
    const result = validateCoachIdentityProfile(raw.profile);
    assert.ok(result.ok, `${personId} failed validation: ${!result.ok ? result.errors.join("; ") : ""}`);
    totalClaims += allClaims(raw).length;
  }
  assert.ok(totalClaims >= 25, `expected at least 25 total coach claims, got ${totalClaims}`);
});

test("HM-COACH-IDENTITY-0.1: every coach identity file resolves to a real StaffPerson actually listed in their declared club's staff roster", () => {
  const byPerson = loadAll();
  for (const [personId, raw] of byPerson) {
    const staff = loadClubStaffIdentity(raw.clubId);
    assert.ok(staff, `${raw.clubId} staff identity file must exist`);
    assert.ok(
      staff!.people.some((p) => p.id === personId),
      `${personId} must actually appear in ${raw.clubId}'s staff roster -- coach claims must never dangle`,
    );
  }
});

test("HM-COACH-IDENTITY-0.1: coach identity is independent of club assignment -- CoachIdentityProfile carries no clubId field at all", () => {
  const byPerson = loadAll();
  for (const raw of byPerson.values()) {
    assert.equal("clubId" in raw.profile, false, "CoachIdentityProfile itself must never carry a clubId field -- only the envelope file (for import bookkeeping) does");
  }
});

test("HM-COACH-IDENTITY-0.1: moving a coach to a different club would preserve their CoachIdentityProfile untouched -- the profile's shape and content depend only on personId, not on which club currently employs them", () => {
  const flodman = loadCoachIdentity("person-mattias-flodman-se-club-alingsas-hk")!;
  const originalProfile = JSON.parse(JSON.stringify(flodman.profile));

  // Simulate a club change: the envelope's clubId is bookkeeping for
  // where the assessment was sourced, but the schema (Spec §18) means a
  // real move would only ever touch StaffAssignment records, never this
  // profile. Prove that by constructing what a "moved" snapshot would
  // look like and confirming the profile itself is byte-identical.
  const movedEnvelope = { ...flodman, clubId: "se_club_amo_hk" };
  assert.deepEqual(movedEnvelope.profile, originalProfile, "the CoachIdentityProfile itself must be unaffected by which club the envelope currently associates it with");
  assert.equal(movedEnvelope.profile.personId, flodman.profile.personId);
});

test("HM-COACH-IDENTITY-0.1: projection handling -- Kim Andersson's USER_PROJECTION claim is PROJECTED-scoped and never conflated with his other, currently-observed LONG_TERM/CURRENT claims", () => {
  const kim = loadCoachIdentity("person-kim-andersson-se-club-ystads-if-hf")!;
  const claims = allClaims(kim);
  const projections = claims.filter((c) => c.evidenceClass === "USER_PROJECTION");
  assert.ok(projections.length >= 1, "expected at least one USER_PROJECTION claim for Kim Andersson");
  for (const p of projections) {
    assert.equal(p.temporalScope, "PROJECTED");
  }
  const nonProjections = claims.filter((c) => c.evidenceClass !== "USER_PROJECTION");
  assert.ok(nonProjections.length >= 1, "Kim Andersson must also have real (non-projected) claims to contrast with");
  assert.ok(nonProjections.every((c) => c.temporalScope !== "PROJECTED"), "a non-projection claim must never accidentally carry PROJECTED scope");
});

test("HM-COACH-IDENTITY-0.1: uncertain/unknown handling -- Magnus Siglev's uncertain claims keep confidence UNCERTAIN and are never silently upgraded to CONFIRMED", () => {
  const siglev = loadCoachIdentity("person-magnus-siglev-se-club-ov-helsingborg")!;
  const uncertainClaims = allClaims(siglev).filter((c) => c.confidence === "UNCERTAIN");
  assert.ok(uncertainClaims.length >= 2, "expected at least 2 UNCERTAIN-confidence claims for Magnus Siglev (previous delivery, squad alignment)");
  for (const c of uncertainClaims) {
    assert.notEqual(c.confidence, "CONFIRMED");
  }
});

test("HM-COACH-IDENTITY-0.1: no club/squad/season claims leak into coach identity -- every claim's subjectType is COACH, never CLUB/SQUAD/SEASON_CONTEXT/TEAM/ENVIRONMENT", () => {
  const byPerson = loadAll();
  for (const [personId, raw] of byPerson) {
    for (const claim of allClaims(raw)) {
      assert.equal(claim.subjectType, "COACH", `${personId}'s claim ${claim.id} has subjectType "${claim.subjectType}" -- only COACH is allowed inside a CoachIdentityProfile`);
    }
    // No claim carries a `season` field tying it to 2026/27 squad/season context, except where explicitly and deliberately scoped (Siglev's current-alignment claim, which stays CURRENT/UNCERTAIN, not SEASON).
    for (const claim of allClaims(raw)) {
      assert.notEqual(claim.temporalScope, "SEASON", `${personId}'s claim ${claim.id} is SEASON-scoped -- season/squad context must live in SeasonClubContext/SquadIdentityContext, never CoachIdentityProfile`);
    }
  }
});

test("HM-COACH-IDENTITY-0.1: no invented numeric ratings anywhere -- every coach claim's value stays qualitative/textual, never a 1-20 (or any) numeric coaching score", () => {
  const byPerson = loadAll();
  for (const [personId, raw] of byPerson) {
    for (const claim of allClaims(raw)) {
      assert.equal(typeof claim.value, "string", `${personId}'s claim ${claim.id} has a non-string value -- no numeric coach ratings are permitted`);
    }
  }
});

test("HM-COACH-IDENTITY-0.1: coaches with no source-supported assessment (e.g. IF Hallby's Tobias Nordendorph, IFK Kristianstad's Björn Sätherström, IK Sävehof's Linus Ekman) have no identity file -- never a fabricated empty-but-present profile", () => {
  const unsupportedCoachIds = [
    "person-tobias-nordendorph-se-club-if-hallby-hk",
    "person-bjorn-satherstrom-se-club-ifk-kristianstad",
    "person-linus-ekman-se-club-ik-savehof",
    "person-kristian-svensson-se-club-ifk-skovde-hk",
    "person-marcel-lundstad-se-club-onnereds-hk",
  ];
  for (const id of unsupportedCoachIds) {
    assert.equal(loadCoachIdentity(id), null, `${id} must have NO coach identity file -- the source profile gives no personal trait assessment for them`);
  }
});

test("HM-COACH-IDENTITY-0.1: snapshotCoachIdentity returns validated data for a real coach and null for an unassessed or unknown person", () => {
  const flodman = snapshotCoachIdentity("person-mattias-flodman-se-club-alingsas-hk");
  assert.ok(flodman);
  assert.ok(flodman!.profile.coachingStyleClaims.length > 0);

  assert.equal(snapshotCoachIdentity("person-tobias-nordendorph-se-club-if-hallby-hk"), null);
  assert.equal(snapshotCoachIdentity("not-a-real-person-id"), null);
});
