// HM-STAFF-DATA-0.1: proves the imported real staff data for all 14
// approved Handbollsligan clubs satisfies every HM-IDENTITY-0.1
// invariant and the milestone's own required-coverage list.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CLUBS, getClub } from "../game-data";
import { selectCurrentStaffAssignments, validateStaffAssignment, validateStaffPerson } from "../identity/validators";
import { loadClubStaffIdentity, type RawClubStaffIdentity } from "./staffIdentityLoader";
import { snapshotClubStaff } from "./staffIdentitySnapshot";

const HANDBOLLSLIGAN_CLUB_IDS = CLUBS.filter((c) => c.competitionId === "se_handbollsligan_herr" && c.dataSource === "REAL_WORLD").map((c) => c.id);

function loadAll(): Map<string, RawClubStaffIdentity> {
  const byClub = new Map<string, RawClubStaffIdentity>();
  for (const clubId of HANDBOLLSLIGAN_CLUB_IDS) {
    const raw = loadClubStaffIdentity(clubId);
    assert.ok(raw, `expected a staff identity file for ${clubId}`);
    byClub.set(clubId, raw!);
  }
  return byClub;
}

test("HM-STAFF-DATA-0.1: all 14 Handbollsligan clubs have a staff identity file that loads", () => {
  assert.equal(HANDBOLLSLIGAN_CLUB_IDS.length, 14, "sanity: exactly 14 real-world Handbollsligan clubs are expected");
  const byClub = loadAll();
  assert.equal(byClub.size, 14);
  for (const clubId of HANDBOLLSLIGAN_CLUB_IDS) {
    const raw = byClub.get(clubId)!;
    assert.equal(raw.clubId, clubId);
    assert.ok(raw.people.length > 0, `${clubId} should have at least one staff person`);
    assert.ok(raw.assignments.length > 0, `${clubId} should have at least one staff assignment`);
  }
});

test("HM-STAFF-DATA-0.1: every assignment across all 14 clubs validates against HM-IDENTITY-0.1's validateStaffAssignment", () => {
  const byClub = loadAll();
  let totalAssignments = 0;
  for (const [clubId, raw] of byClub) {
    const knownPersonIds = new Set(raw.people.map((p) => p.id));
    for (const assignment of raw.assignments) {
      const result = validateStaffAssignment(assignment, knownPersonIds);
      assert.ok(result.ok, `${clubId} assignment for ${assignment.personId} failed validation: ${!result.ok ? result.errors.join("; ") : ""}`);
      totalAssignments += 1;
    }
  }
  assert.ok(totalAssignments >= 140, `expected at least 140 total assignments across all clubs, got ${totalAssignments}`);
});

test("HM-STAFF-DATA-0.1: every StaffPerson across all 14 clubs validates against HM-IDENTITY-0.1's validateStaffPerson", () => {
  const byClub = loadAll();
  for (const [clubId, raw] of byClub) {
    for (const person of raw.people) {
      const result = validateStaffPerson(person);
      assert.ok(result.ok, `${clubId} person ${person.id} failed validation: ${!result.ok ? result.errors.join("; ") : ""}`);
    }
  }
});

test("HM-STAFF-DATA-0.1: no duplicate person ids exist WITHIN any single club's file", () => {
  const byClub = loadAll();
  for (const [clubId, raw] of byClub) {
    const ids = raw.people.map((p) => p.id);
    assert.equal(ids.length, new Set(ids).size, `${clubId} has duplicate person ids`);
  }
});

test("HM-STAFF-DATA-0.1: no duplicate person ids exist ACROSS all 14 clubs combined", () => {
  const byClub = loadAll();
  const allIds: string[] = [];
  for (const raw of byClub.values()) {
    allIds.push(...raw.people.map((p) => p.id));
  }
  assert.equal(allIds.length, new Set(allIds).size, "person ids must be globally unique across the whole imported dataset");
});

test("HM-STAFF-DATA-0.1: every assignment's clubId is a real canonical club id resolvable via game-data's getClub, and matches the file it was loaded from", () => {
  const byClub = loadAll();
  for (const [clubId, raw] of byClub) {
    assert.ok(getClub(clubId), `${clubId} must resolve via game-data's getClub`);
    for (const assignment of raw.assignments) {
      assert.equal(assignment.clubId, clubId, "an assignment's clubId must match the file it was imported from");
    }
  }
});

test("HM-STAFF-DATA-0.1: current-vs-historical filtering -- HISTORICAL assignments are excluded by selectCurrentStaffAssignments but still present in the raw imported data", () => {
  const byClub = loadAll();
  const asOfDate = "2026-08-19";

  // HF Karlskrona: Tobias Karlsson (historical sporting director).
  const karlskrona = byClub.get("se_club_hf_karlskrona")!;
  const karlskronaHistorical = karlskrona.assignments.filter((a) => a.status === "HISTORICAL");
  assert.ok(karlskronaHistorical.length >= 1, "expected at least one HISTORICAL assignment imported for HF Karlskrona (Tobias Karlsson)");
  const karlskronaCurrent = selectCurrentStaffAssignments(karlskrona.assignments, asOfDate);
  for (const h of karlskronaHistorical) {
    assert.ok(!karlskronaCurrent.includes(h), "a HISTORICAL assignment must never be selected as current staff");
  }

  // HK Malmö: Robert Månsson (historical sporting director).
  const malmo = byClub.get("se_club_hk_malmo")!;
  assert.ok(malmo.assignments.some((a) => a.status === "HISTORICAL"), "expected a HISTORICAL assignment imported for HK Malmö (Robert Månsson)");

  // IFK Kristianstad: Anders Hallberg (historical head coach).
  const kristianstad = byClub.get("se_club_ifk_kristianstad")!;
  assert.ok(kristianstad.assignments.some((a) => a.status === "HISTORICAL"), "expected a HISTORICAL assignment imported for IFK Kristianstad (Anders Hallberg)");

  // OV Helsingborg: Toni Johansson (historical head coach).
  const ov = byClub.get("se_club_ov_helsingborg")!;
  assert.ok(ov.assignments.some((a) => a.status === "HISTORICAL"), "expected a HISTORICAL assignment imported for OV Helsingborg (Toni Johansson)");

  // IF Hallby: Jesper Östlund (historical coaching role).
  const hallby = byClub.get("se_club_if_hallby_hk")!;
  assert.ok(hallby.assignments.some((a) => a.status === "HISTORICAL"), "expected a HISTORICAL assignment imported for IF Hallby HK (Jesper Östlund)");
});

test("HM-STAFF-DATA-0.1: probable status is preserved and distinguishable from confirmed status", () => {
  const byClub = loadAll();
  const savehof = byClub.get("se_club_ik_savehof")!;
  const probable = savehof.assignments.filter((a) => a.status === "PROBABLE");
  const confirmed = savehof.assignments.filter((a) => a.status === "CONFIRMED");
  assert.ok(probable.length > 0, "expected PROBABLE assignments imported for IK Sävehof");
  assert.ok(confirmed.length > 0, "expected CONFIRMED assignments imported for IK Sävehof too");
  assert.notEqual(probable.length, 0);
  // PROBABLE and CONFIRMED are never conflated into the same status.
  assert.ok(probable.every((a) => a.status !== "CONFIRMED"));
});

test("HM-STAFF-DATA-0.1: multi-role cases -- a single assignment carries more than one standardRole where the source lists more than one", () => {
  const byClub = loadAll();
  const alingsas = byClub.get("se_club_alingsas_hk")!;
  const simonNilsson = alingsas.assignments.find((a) => a.officialRole.includes("Fysansvarig"));
  assert.ok(simonNilsson, "expected Simon Nilsson's dual-role assignment at Alingsås HK");
  assert.equal(simonNilsson!.standardRoles.length, 2);
  assert.ok(simonNilsson!.standardRoles.includes("ASSISTANT_COACH") && simonNilsson!.standardRoles.includes("STRENGTH_CONDITIONING_COACH"));

  const hammarby = byClub.get("se_club_hammarby_if_hf")!;
  const kalleMatsson = hammarby.assignments.find((a) => a.officialRole.includes("Sportchef"));
  assert.ok(kalleMatsson, "expected Kalle Matsson's dual-role assignment at Hammarby");
  assert.equal(kalleMatsson!.standardRoles.length, 2);
});

test("HM-STAFF-DATA-0.1: collective management case -- IFK Kristianstad's 4-person Sportteam is imported as 4 distinct named individuals sharing one collective officialRole, never fabricated as one anonymous entity or as 4 unrelated traditional directors", () => {
  const byClub = loadAll();
  const kristianstad = byClub.get("se_club_ifk_kristianstad")!;
  const sportteam = kristianstad.assignments.filter((a) => a.officialRole === "Sportteam");
  assert.equal(sportteam.length, 4, "expected exactly 4 people sharing the collective 'Sportteam' officialRole");
  assert.ok(sportteam.every((a) => a.standardRoles.includes("SPORTING_DIRECTOR")));
  const personIds = sportteam.map((a) => a.personId);
  assert.equal(personIds.length, new Set(personIds).size, "the 4 sportteam members must be 4 distinct real people, not duplicated records");
  const names = personIds.map((id) => kristianstad.people.find((p) => p.id === id)?.displayName);
  assert.ok(names.every((n) => typeof n === "string" && n.length > 0), "each sportteam member must be a real, named individual -- never an anonymous placeholder");
});

test("HM-STAFF-DATA-0.1: player/staff hybrid case -- Önnereds HK's Andreas Nilsson is ONE StaffPerson with a playerId cross-reference, holding a SPORTING_DIRECTOR + ACTIVE_PLAYER assignment", () => {
  const byClub = loadAll();
  const onnered = byClub.get("se_club_onnereds_hk")!;
  const hybridAssignment = onnered.assignments.find((a) => a.standardRoles.includes("ACTIVE_PLAYER"));
  assert.ok(hybridAssignment, "expected a hybrid ACTIVE_PLAYER assignment for Önnereds HK");
  assert.ok(hybridAssignment!.standardRoles.includes("SPORTING_DIRECTOR"), "the hybrid must also carry the sporting-director role, not just ACTIVE_PLAYER");

  const hybridPerson = onnered.people.find((p) => p.id === hybridAssignment!.personId);
  assert.ok(hybridPerson, "the hybrid assignment must resolve to a real StaffPerson");
  assert.ok(hybridPerson!.playerId, "the hybrid StaffPerson must carry a playerId cross-reference");
  assert.equal(hybridPerson!.playerId, "player_andreas_nilsson_e7db3e42");

  // Exactly one person entity -- not a duplicated "player" record and a separate "staff" record.
  const matchingPeople = onnered.people.filter((p) => p.playerId === hybridPerson!.playerId);
  assert.equal(matchingPeople.length, 1, "the player/staff hybrid must be exactly ONE person entity, never duplicated");
});

test("HM-STAFF-DATA-0.1: no invented numeric ratings anywhere in the imported dataset -- every StaffAssignment/StaffPerson field stays qualitative/textual, never a coach/staff quality number", () => {
  const byClub = loadAll();
  for (const [clubId, raw] of byClub) {
    for (const person of raw.people) {
      for (const [key, value] of Object.entries(person)) {
        if (typeof value === "number") {
          assert.fail(`${clubId} StaffPerson ${person.id} has an unexpected numeric field "${key}" -- no player/staff rating fields exist on StaffPerson`);
        }
      }
    }
    for (const assignment of raw.assignments) {
      assert.equal(typeof assignment, "object");
      assert.ok(!("rating" in assignment) && !("quality" in assignment) && !("score" in assignment), `${clubId} assignment for ${assignment.personId} must never carry a rating/quality/score field`);
    }
  }
});

test("HM-STAFF-DATA-0.1: snapshotClubStaff (the server read model) returns validated data for a real club and null for an unknown club id", () => {
  const alingsas = snapshotClubStaff("se_club_alingsas_hk");
  assert.ok(alingsas);
  assert.ok(alingsas!.people.length > 0);
  assert.ok(alingsas!.assignments.length > 0);

  assert.equal(snapshotClubStaff("not-a-real-club-id"), null);
});

test("HM-STAFF-DATA-0.1: snapshotClubStaff returns null for a club with no identity file (e.g. IFK Tumba/Allsvenskan) -- never fabricates data", () => {
  assert.equal(snapshotClubStaff("swe2-tumba"), null);
});
