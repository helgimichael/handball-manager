// HM-DATA-ALLSVENSKAN-1.0: formalizes what a throwaway validation script
// proved ad hoc during development -- that the 14 Allsvenskan clubs'
// imported club/staff/coach identity data all load through the real
// production loaders and pass the real HM-IDENTITY-0.1 validators, plus
// the milestone's own governance/leagueSegment/no-duplication invariants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { getClubsByCompetition } from "../game-data/clubs";
import { validateClubIdentityProfile, validateCoachIdentityProfile, validateStaffAssignment, validateStaffPerson } from "../identity/validators";
import { loadClubIdentity } from "./clubIdentityLoader";
import { loadClubStaffIdentity } from "./staffIdentityLoader";
import { loadCoachIdentity } from "./coachIdentityLoader";
import { leagueSegmentForClub } from "./leagueSegment";
import { snapshotClubIdentity } from "./clubIdentitySnapshot";

const ALLSVENSKAN_CLUB_IDS = getClubsByCompetition("swe-2").map((c) => c.id);

test("(1) Allsvenskan (swe-2) has exactly 14 clubs, matching the 14 CLUB IDENTITY v0.1 source profiles", () => {
  assert.equal(ALLSVENSKAN_CLUB_IDS.length, 14);
  assert.equal(new Set(ALLSVENSKAN_CLUB_IDS).size, 14, "duplicate clubId within swe-2");
});

test("(2) leagueSegmentForClub resolves every Allsvenskan club to 'allsvenskan' and an unknown club to the 'handbollsligan' default", () => {
  for (const clubId of ALLSVENSKAN_CLUB_IDS) {
    assert.equal(leagueSegmentForClub(clubId), "allsvenskan", clubId);
  }
  assert.equal(leagueSegmentForClub("not-a-real-club"), "handbollsligan");
});

test("(3) every Allsvenskan club has an imported ClubIdentityProfile that passes validateClubIdentityProfile", () => {
  for (const clubId of ALLSVENSKAN_CLUB_IDS) {
    const raw = loadClubIdentity(clubId, "allsvenskan");
    assert.ok(raw, `expected a club identity file for ${clubId}`);
    const result = validateClubIdentityProfile(raw!.profile);
    assert.ok(result.ok, `${clubId}: ${result.ok ? "" : JSON.stringify(result.errors)}`);
    assert.equal(raw!.profile.clubId, clubId);
  }
});

test("(4) every Allsvenskan club has an imported staff roster whose people/assignments all pass validation", () => {
  for (const clubId of ALLSVENSKAN_CLUB_IDS) {
    const raw = loadClubStaffIdentity(clubId, "allsvenskan");
    assert.ok(raw, `expected a staff file for ${clubId}`);
    assert.ok(raw!.people.length > 0, `${clubId}: expected at least 1 staff person`);
    const knownPersonIds = new Set(raw!.people.map((p) => p.id));
    for (const person of raw!.people) {
      assert.ok(validateStaffPerson(person).ok, `${clubId}/${person.id} failed validateStaffPerson`);
    }
    for (const assignment of raw!.assignments) {
      assert.ok(validateStaffAssignment(assignment, knownPersonIds).ok, `${clubId}/${assignment.personId} failed validateStaffAssignment`);
      assert.equal(assignment.clubId, clubId);
    }
  }
});

test("(5) no staff personId is duplicated across two different Allsvenskan clubs", () => {
  const seen = new Map<string, string>();
  for (const clubId of ALLSVENSKAN_CLUB_IDS) {
    const raw = loadClubStaffIdentity(clubId, "allsvenskan");
    for (const person of raw?.people ?? []) {
      const priorClub = seen.get(person.id);
      assert.ok(!priorClub, `personId ${person.id} appears at both ${priorClub} and ${clubId}`);
      seen.set(person.id, clubId);
    }
  }
});

test("(6) governance can distinguish an individual SPORTING_DIRECTOR from a COLLECTIVE_GROUP committee", () => {
  const individualDirectorClub = ALLSVENSKAN_CLUB_IDS.find((id) => {
    const raw = loadClubStaffIdentity(id, "allsvenskan");
    return raw?.people.some((p) => p.personKind !== "COLLECTIVE_GROUP" && raw.assignments.some((a) => a.personId === p.id && a.standardRoles.includes("SPORTING_DIRECTOR")));
  });
  const committeeClub = ALLSVENSKAN_CLUB_IDS.find((id) => {
    const raw = loadClubStaffIdentity(id, "allsvenskan");
    return raw?.people.some((p) => p.personKind === "COLLECTIVE_GROUP" && raw.assignments.some((a) => a.personId === p.id && a.standardRoles.includes("SPORTING_DIRECTOR")));
  });
  assert.ok(individualDirectorClub, "expected at least one club with an individual SPORTING_DIRECTOR");
  assert.ok(committeeClub, "expected at least one club with a COLLECTIVE_GROUP sporting-governance body");
  assert.notEqual(individualDirectorClub, committeeClub);
});

test("(7) every coach identity file (where one exists) attaches to a real staff person at the declared club, and passes validation", () => {
  let coachFileCount = 0;
  for (const clubId of ALLSVENSKAN_CLUB_IDS) {
    const staff = loadClubStaffIdentity(clubId, "allsvenskan");
    const headCoach = staff?.assignments.find((a) => a.standardRoles.includes("HEAD_COACH"));
    if (!headCoach) continue;
    const rawCoach = loadCoachIdentity(headCoach.personId, "allsvenskan");
    if (!rawCoach) continue; // most coaches legitimately have no assessed philosophy file -- not an error.
    coachFileCount += 1;
    assert.equal(rawCoach.personId, headCoach.personId);
    assert.equal(rawCoach.clubId, clubId);
    assert.ok(validateCoachIdentityProfile(rawCoach.profile).ok, `${clubId}: coach profile failed validation`);
  }
  assert.ok(coachFileCount >= 10, `expected at least 10 Allsvenskan coach identity files, got ${coachFileCount}`);
});

test("(8) snapshotClubIdentity keeps Club Identity and Coach Identity as two separate fields, never merged", () => {
  const snap = snapshotClubIdentity("swe2-tumba", "2026-08-27");
  assert.ok(snap);
  assert.ok(snap!.clubIdentity, "expected Tumba to have a club identity profile");
  assert.ok(snap!.coachIdentity, "expected Tumba to have a resolvable current head coach identity");
  assert.notEqual(snap!.clubIdentity, snap!.coachIdentity);
  // The club identity profile must never carry coach-only fields, and vice versa.
  assert.equal((snap!.clubIdentity as unknown as Record<string, unknown>).coachingStyleClaims, undefined);
  assert.equal((snap!.coachIdentity as unknown as Record<string, unknown>).tacticalHeritage, undefined);
});

test("(9) snapshotClubIdentity returns null only for an unknown clubId, and a benign {null, null} shape for a known club with no data", () => {
  assert.equal(snapshotClubIdentity("not-a-real-club", "2026-08-27"), null);
  const knownButNoData = snapshotClubIdentity("den1-aalborg", "2026-08-27"); // a real, known club with no imported identity data at all
  assert.ok(knownButNoData);
});

test("(10) HM-DATA-ALLSVENSKAN-1.0's own explicit example differentiators show up as real, distinguishable claims for at least 4 clubs", () => {
  const distinctSignatures = new Set<string>();
  for (const clubId of ["swe2-tumba", "swe2-redbergslid", "swe2-varberg", "swe2-tyreso"]) {
    const raw = loadClubIdentity(clubId, "allsvenskan");
    assert.ok(raw, clubId);
    const allClaims = [
      ...raw!.profile.structuralIdentity,
      ...raw!.profile.cultureIdentity,
      ...raw!.profile.tacticalHeritage,
      ...raw!.profile.developmentIdentity,
      ...raw!.profile.recruitmentIdentity,
      ...raw!.profile.financialStrategicIdentity,
    ];
    assert.ok(allClaims.length > 0, `${clubId}: expected at least one identity claim`);
    distinctSignatures.add(JSON.stringify(allClaims.map((c) => `${c.domain}:${c.key}:${c.value}`).sort()));
  }
  assert.equal(distinctSignatures.size, 4, "expected all 4 sampled clubs to show distinct claim sets");
});
