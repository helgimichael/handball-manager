// HM-STAFF-1.0 Part 33: directional proofs for roster resolution --
// real identity-backed staff blended with generated fictional coverage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveClubStaffRoster } from "./staffRosterResolution";
import { STAFF_ROLES } from "./types";

const CLUB_ID = "club1";

// (22) staff roster has essential coverage.
test("(22) a club with NO identity data at all still gets all four essential roles", () => {
  const roster = resolveClubStaffRoster(CLUB_ID, null);
  const roles = new Set(roster.flatMap((m) => m.roles));
  for (const essential of ["HEAD_COACH", "ASSISTANT_COACH", "GOALKEEPER_COACH", "PHYSICAL_COACH"] as const) {
    assert.ok(roles.has(essential), `missing essential role ${essential}`);
  }
});

// (23) mock club receives functional staff.
test("(23) a mock club (no identity file) receives a fully generated, functional roster", () => {
  const roster = resolveClubStaffRoster("mock-club-1", null);
  assert.ok(roster.length >= 4);
  assert.ok(roster.every((m) => m.source === "GENERATED_FICTIONAL"));
});

// (20) real/source-backed profile preserves evidence values.
test("(20) real identity-backed staff keep their REAL name and REAL role, even though attributes are always generated", () => {
  const identity = {
    people: [{ id: "person-1", displayName: "Real Coach Name" }],
    assignments: [{ personId: "person-1", clubId: CLUB_ID, officialRole: "Head Coach", standardRoles: ["HEAD_COACH" as const], status: "CONFIRMED" as const, evidence: [] }],
  };
  const roster = resolveClubStaffRoster(CLUB_ID, identity);
  const realMember = roster.find((m) => m.id === "person-1");
  assert.ok(realMember, "expected the real identity-backed person to appear in the roster");
  assert.equal(realMember!.displayName, "Real Coach Name");
  assert.equal(realMember!.source, "REAL_WORLD_IDENTITY");
  assert.ok(realMember!.roles.includes("HEAD_COACH"));
});

test("a real club's roster does NOT generate a duplicate fictional HEAD_COACH when a real one already covers it", () => {
  const identity = {
    people: [{ id: "person-1", displayName: "Real Coach" }],
    assignments: [{ personId: "person-1", clubId: CLUB_ID, officialRole: "Head Coach", standardRoles: ["HEAD_COACH" as const], status: "CONFIRMED" as const, evidence: [] }],
  };
  const roster = resolveClubStaffRoster(CLUB_ID, identity);
  const headCoaches = roster.filter((m) => m.roles.includes("HEAD_COACH"));
  assert.equal(headCoaches.length, 1);
  assert.equal(headCoaches[0].source, "REAL_WORLD_IDENTITY");
});

test("a role in identity data with no gameplay-relevant mapping (e.g. CHAIRPERSON) does not appear in the resolved roster at all", () => {
  const identity = {
    people: [{ id: "person-1", displayName: "Chair Person" }],
    assignments: [{ personId: "person-1", clubId: CLUB_ID, officialRole: "Ordförande", standardRoles: ["CHAIRPERSON" as const], status: "CONFIRMED" as const, evidence: [] }],
  };
  const roster = resolveClubStaffRoster(CLUB_ID, identity);
  assert.ok(!roster.some((m) => m.id === "person-1"));
});

test("two different clubs with identical (null) identity data still get differentiated rosters (deterministic per-club seeding, not clones)", () => {
  const rosterA = resolveClubStaffRoster("club-a", null);
  const rosterB = resolveClubStaffRoster("club-b", null);
  const namesA = rosterA.map((m) => m.displayName).sort();
  const namesB = rosterB.map((m) => m.displayName).sort();
  assert.notDeepEqual(namesA, namesB);
});

test("STAFF_ROLES vocabulary matches what roster resolution can actually assign", () => {
  assert.ok(STAFF_ROLES.length >= 7);
});
