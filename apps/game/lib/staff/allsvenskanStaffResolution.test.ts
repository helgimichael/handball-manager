// HM-DATA-ALLSVENSKAN-1.2: proves "VERIFIED/CANONICAL REAL STAFF >
// generated filler staff" holds for all 14 real-world Allsvenskan clubs,
// end-to-end through the exact real production loaders/resolver -- not
// a synthetic fixture. Root cause of the original bug (Tumba showing
// generated GOALKEEPER_COACH/PHYSICAL_COACH fillers while its real
// TEAM_MANAGER/SPORTING_DIRECTOR people were silently dropped) was that
// buildFromIdentity() returned null for a real person with no
// gameplay-relevant StaffRole mapping -- fixed to always include them
// (roles: [], officialRoleLabel set) instead.
import { test } from "node:test";
import assert from "node:assert/strict";
import { getClubsByCompetition } from "../game-data/clubs";
import { snapshotClubStaff } from "../gameWorld/staffIdentitySnapshot";
import { selectCurrentStaffAssignments } from "../identity/validators";
import { resolveClubStaffRoster } from "./staffRosterResolution";

const ALLSVENSKAN_CLUB_IDS = getClubsByCompetition("swe-2").map((c) => c.id);
const AS_OF_DATE = "2026-08-19";

test("(1) every real, canonical staff person for every Allsvenskan club appears in the resolved roster -- none silently dropped", () => {
  for (const clubId of ALLSVENSKAN_CLUB_IDS) {
    const snap = snapshotClubStaff(clubId);
    assert.ok(snap, `expected staff identity data for ${clubId}`);
    const current = selectCurrentStaffAssignments(snap!.assignments, AS_OF_DATE);
    const roster = resolveClubStaffRoster(clubId, { people: snap!.people, assignments: current });
    const realMembers = roster.filter((m) => m.source === "REAL_WORLD_IDENTITY");
    assert.equal(realMembers.length, current.length, `${clubId}: expected every current real assignment to produce a roster entry (got ${realMembers.length}/${current.length})`);
  }
});

test("(2) IFK Tumba's roster contains exactly the 6 real people from its canonical CLUB IDENTITY source, with the right roles/titles", () => {
  const snap = snapshotClubStaff("swe2-tumba")!;
  const current = selectCurrentStaffAssignments(snap.assignments, AS_OF_DATE);
  const roster = resolveClubStaffRoster("swe2-tumba", { people: snap.people, assignments: current });
  const byName = new Map(roster.map((m) => [m.displayName, m]));

  assert.deepEqual(byName.get("Mats Kardell")?.roles, ["HEAD_COACH"]);
  assert.ok(byName.get("Helgi Magnusson")?.roles.includes("ASSISTANT_COACH"));
  assert.equal(byName.get("Malin Kardell")?.officialRoleLabel, "Lagledare");
  assert.deepEqual(byName.get("Malin Kardell")?.roles, []);
  assert.equal(byName.get("Naman Raja Gul")?.officialRoleLabel, "Sportchef");
  assert.ok(byName.get("Marie Hellkvist"));
  assert.ok(byName.get("Samir Svedin"));

  const realCount = roster.filter((m) => m.source === "REAL_WORLD_IDENTITY").length;
  assert.equal(realCount, 6);
});

test("(3) generated fictional staff only ever fills a genuinely uncovered essential role, never a role real staff already covers", () => {
  for (const clubId of ALLSVENSKAN_CLUB_IDS) {
    const snap = snapshotClubStaff(clubId);
    const current = snap ? selectCurrentStaffAssignments(snap.assignments, AS_OF_DATE) : [];
    const roster = resolveClubStaffRoster(clubId, snap ? { people: snap.people, assignments: current } : null);
    const realRoles = new Set(roster.filter((m) => m.source === "REAL_WORLD_IDENTITY").flatMap((m) => m.roles));
    for (const generated of roster.filter((m) => m.source === "GENERATED_FICTIONAL")) {
      for (const role of generated.roles) {
        assert.ok(!realRoles.has(role), `${clubId}: generated staff covers ${role}, which real staff already covers`);
      }
    }
  }
});

test("(4) no person id is duplicated within a single club's resolved roster (no duplicated people, no parallel staff state)", () => {
  for (const clubId of ALLSVENSKAN_CLUB_IDS) {
    const snap = snapshotClubStaff(clubId);
    const current = snap ? selectCurrentStaffAssignments(snap.assignments, AS_OF_DATE) : [];
    const roster = resolveClubStaffRoster(clubId, snap ? { people: snap.people, assignments: current } : null);
    const ids = roster.map((m) => m.id);
    assert.equal(new Set(ids).size, ids.length, `${clubId}: duplicate id in resolved roster`);
  }
});

test("(5) a real person with no gameplay StaffRole mapping never gets a generated fictional counterpart for the same official title", () => {
  // Regression guard for the exact reported bug shape: a real Sportchef/Lagledare must not
  // coexist with a GENERATED_FICTIONAL member that duplicates their real-world function.
  for (const clubId of ALLSVENSKAN_CLUB_IDS) {
    const snap = snapshotClubStaff(clubId);
    const current = snap ? selectCurrentStaffAssignments(snap.assignments, AS_OF_DATE) : [];
    const roster = resolveClubStaffRoster(clubId, snap ? { people: snap.people, assignments: current } : null);
    const generatedOfficialLabels = roster.filter((m) => m.source === "GENERATED_FICTIONAL").map((m) => m.officialRoleLabel);
    assert.ok(generatedOfficialLabels.every((l) => l === undefined), `${clubId}: a GENERATED_FICTIONAL member unexpectedly carries an officialRoleLabel`);
  }
});
