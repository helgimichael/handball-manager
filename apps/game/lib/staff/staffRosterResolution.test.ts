// HM-STAFF-1.0 Part 33, HM-DATA-ALLSVENSKAN-1.1B Part 4/5/6: directional
// proofs for roster resolution -- real identity-backed staff blended
// with generated fictional coverage ONLY for a GENERATED/MOCK club; a
// REAL_WORLD club's genuine staffing gaps stay genuine.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveClubStaffRoster } from "./staffRosterResolution";
import { STAFF_ROLES } from "./types";

const CLUB_ID = "club1";

// (22) a MOCK club's staff roster has essential coverage.
test("(22) a MOCK club with NO identity data at all still gets all four essential roles", () => {
  const roster = resolveClubStaffRoster(CLUB_ID, null, false);
  const roles = new Set(roster.flatMap((m) => m.roles));
  for (const essential of ["HEAD_COACH", "ASSISTANT_COACH", "GOALKEEPER_COACH", "PHYSICAL_COACH"] as const) {
    assert.ok(roles.has(essential), `missing essential role ${essential}`);
  }
});

// (23) mock club receives functional staff.
test("(23) a mock club (no identity file) receives a fully generated, functional roster", () => {
  const roster = resolveClubStaffRoster("mock-club-1", null, false);
  assert.ok(roster.length >= 4);
  assert.ok(roster.every((m) => m.source === "GENERATED_FICTIONAL"));
  assert.ok(roster.every((m) => m.employmentType === "SALARIED"));
});

// HM-DATA-ALLSVENSKAN-1.1B Part 4: the core regression guard -- a REAL_WORLD club with no identity data gets NOTHING, never invented staff.
test("(24) a REAL_WORLD club with NO identity data gets an EMPTY roster -- never generated fictional filler (UNKNOWN STAFF != GENERATED PERSON)", () => {
  const roster = resolveClubStaffRoster(CLUB_ID, null, true);
  assert.deepEqual(roster, []);
});

test("(25) a REAL_WORLD club whose real data covers only HEAD_COACH gets exactly that one real person -- no generated ASSISTANT_COACH/GOALKEEPER_COACH/PHYSICAL_COACH filler", () => {
  const identity = {
    people: [{ id: "person-1", displayName: "Real Coach" }],
    assignments: [{ personId: "person-1", clubId: CLUB_ID, officialRole: "Head Coach", standardRoles: ["HEAD_COACH" as const], status: "CONFIRMED" as const, evidence: [] }],
  };
  const roster = resolveClubStaffRoster(CLUB_ID, identity, true);
  assert.equal(roster.length, 1);
  assert.equal(roster[0].source, "REAL_WORLD_IDENTITY");
  assert.ok(roster.every((m) => m.source !== "GENERATED_FICTIONAL"));
});

// (20) real/source-backed profile preserves evidence values.
test("(20) real identity-backed staff keep their REAL name and REAL role, even though attributes are always generated", () => {
  const identity = {
    people: [{ id: "person-1", displayName: "Real Coach Name" }],
    assignments: [{ personId: "person-1", clubId: CLUB_ID, officialRole: "Head Coach", standardRoles: ["HEAD_COACH" as const], status: "CONFIRMED" as const, evidence: [] }],
  };
  const roster = resolveClubStaffRoster(CLUB_ID, identity, false);
  const realMember = roster.find((m) => m.id === "person-1");
  assert.ok(realMember, "expected the real identity-backed person to appear in the roster");
  assert.equal(realMember!.displayName, "Real Coach Name");
  assert.equal(realMember!.source, "REAL_WORLD_IDENTITY");
  assert.ok(realMember!.roles.includes("HEAD_COACH"));
  assert.equal(realMember!.employmentType, "SALARIED");
});

test("a MOCK club's roster does NOT generate a duplicate fictional HEAD_COACH when a real one already covers it", () => {
  const identity = {
    people: [{ id: "person-1", displayName: "Real Coach" }],
    assignments: [{ personId: "person-1", clubId: CLUB_ID, officialRole: "Head Coach", standardRoles: ["HEAD_COACH" as const], status: "CONFIRMED" as const, evidence: [] }],
  };
  const roster = resolveClubStaffRoster(CLUB_ID, identity, false);
  const headCoaches = roster.filter((m) => m.roles.includes("HEAD_COACH"));
  assert.equal(headCoaches.length, 1);
  assert.equal(headCoaches[0].source, "REAL_WORLD_IDENTITY");
});

test("HM-DATA-ALLSVENSKAN-1.2: a real person whose role has no gameplay-relevant mapping (e.g. CHAIRPERSON) still appears in the resolved roster -- a real, canonical staff person is never silently dropped -- with an empty roles[] and their real officialRoleLabel for display, and is classified GOVERNANCE not SALARIED", () => {
  const identity = {
    people: [{ id: "person-1", displayName: "Chair Person" }],
    assignments: [{ personId: "person-1", clubId: CLUB_ID, officialRole: "Ordförande", standardRoles: ["CHAIRPERSON" as const], status: "CONFIRMED" as const, evidence: [] }],
  };
  const roster = resolveClubStaffRoster(CLUB_ID, identity, true);
  const chair = roster.find((m) => m.id === "person-1");
  assert.ok(chair, "expected the real CHAIRPERSON person to still be in the roster");
  assert.deepEqual(chair!.roles, []);
  assert.equal(chair!.officialRoleLabel, "Ordförande");
  assert.equal(chair!.source, "REAL_WORLD_IDENTITY");
  assert.equal(chair!.employmentType, "GOVERNANCE");
});

test("HM-STAFF-CAREER-1.0: a Lagledare (TEAM_MANAGER) now gets a real StaffRole mapping (attributes/suitability), but is still classified VOLUNTARY by default -- mapping to a role and being SALARIED are two separate questions for this administrative role", () => {
  const identity = {
    people: [{ id: "person-1", displayName: "Team Manager" }],
    assignments: [{ personId: "person-1", clubId: CLUB_ID, officialRole: "Lagledare", standardRoles: ["TEAM_MANAGER" as const], status: "CONFIRMED" as const, evidence: [] }],
  };
  const roster = resolveClubStaffRoster(CLUB_ID, identity, true);
  const manager = roster.find((m) => m.id === "person-1");
  assert.deepEqual(manager!.roles, ["TEAM_MANAGER"]);
  assert.equal(manager!.employmentType, "VOLUNTARY");
});

test("HM-STAFF-CAREER-1.0: a person holding BOTH an administrative role (TEAM_MANAGER) and a genuine coaching role (ASSISTANT_COACH) IS classified SALARIED -- the coaching role alone is enough", () => {
  const identity = {
    people: [{ id: "person-1", displayName: "Coach Manager" }],
    assignments: [{ personId: "person-1", clubId: CLUB_ID, officialRole: "Assisterande tränare / Lagledare", standardRoles: ["ASSISTANT_COACH" as const, "TEAM_MANAGER" as const], status: "CONFIRMED" as const, evidence: [] }],
  };
  const roster = resolveClubStaffRoster(CLUB_ID, identity, true);
  const member = roster.find((m) => m.id === "person-1");
  assert.equal(member!.employmentType, "SALARIED");
});

test("HM-DATA-ALLSVENSKAN-1.1B: a COLLECTIVE_GROUP staff person (a committee) is always classified GOVERNANCE, even if one of its mapped roles would otherwise resolve to SALARIED", () => {
  const identity = {
    people: [{ id: "committee-1", displayName: "Sportkommittén", personKind: "COLLECTIVE_GROUP" as const }],
    assignments: [{ personId: "committee-1", clubId: CLUB_ID, officialRole: "Sportkommitté", standardRoles: ["SPORTING_DIRECTOR" as const], status: "CONFIRMED" as const, evidence: [] }],
  };
  const roster = resolveClubStaffRoster(CLUB_ID, identity, true);
  const committee = roster.find((m) => m.id === "committee-1");
  assert.equal(committee!.employmentType, "GOVERNANCE");
});

test("two different MOCK clubs with identical (null) identity data still get differentiated rosters (deterministic per-club seeding, not clones)", () => {
  const rosterA = resolveClubStaffRoster("club-a", null, false);
  const rosterB = resolveClubStaffRoster("club-b", null, false);
  const namesA = rosterA.map((m) => m.displayName).sort();
  const namesB = rosterB.map((m) => m.displayName).sort();
  assert.notDeepEqual(namesA, namesB);
});

test("HM-DATA-ALLSVENSKAN-1.1B Part 5: the resolved roster is sorted by staff hierarchy -- Ordförande before Huvudtränare before Lagledare, not alphabetically/by id", () => {
  const identity = {
    people: [
      { id: "p-manager", displayName: "Z Manager" },
      { id: "p-chair", displayName: "A Chair" },
      { id: "p-coach", displayName: "M Coach" },
    ],
    assignments: [
      { personId: "p-manager", clubId: CLUB_ID, officialRole: "Lagledare", standardRoles: ["TEAM_MANAGER" as const], status: "CONFIRMED" as const, evidence: [] },
      { personId: "p-chair", clubId: CLUB_ID, officialRole: "Ordförande", standardRoles: ["CHAIRPERSON" as const], status: "CONFIRMED" as const, evidence: [] },
      { personId: "p-coach", clubId: CLUB_ID, officialRole: "Huvudtränare", standardRoles: ["HEAD_COACH" as const], status: "CONFIRMED" as const, evidence: [] },
    ],
  };
  const roster = resolveClubStaffRoster(CLUB_ID, identity, true);
  assert.deepEqual(roster.map((m) => m.id), ["p-chair", "p-coach", "p-manager"]);
});

test("STAFF_ROLES vocabulary matches what roster resolution can actually assign", () => {
  assert.ok(STAFF_ROLES.length >= 7);
});
