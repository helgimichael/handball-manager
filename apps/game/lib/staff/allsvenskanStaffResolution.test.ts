// HM-DATA-ALLSVENSKAN-1.2/1.1B: proves "VERIFIED/CANONICAL REAL STAFF >
// generated filler staff" holds for all 14 real-world Allsvenskan clubs,
// end-to-end through the exact real production loaders/resolver -- not
// a synthetic fixture. HM-DATA-ALLSVENSKAN-1.1B root cause: a REAL_WORLD
// club (e.g. IFK Tumba) was still getting GENERATED_FICTIONAL filler for
// any essential role its real source doesn't cover (Lars Åberg/Maria
// Sjögren as goalkeeper/physical coach) -- fixed so REAL_WORLD clubs
// never synthesize fictional staff at all; a genuine data gap stays a
// genuine gap (UNKNOWN STAFF != GENERATED PERSON).
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
    const roster = resolveClubStaffRoster(clubId, { people: snap!.people, assignments: current }, true);
    const realMembers = roster.filter((m) => m.source === "REAL_WORLD_IDENTITY");
    assert.equal(realMembers.length, current.length, `${clubId}: expected every current real assignment to produce a roster entry (got ${realMembers.length}/${current.length})`);
  }
});

test("(2) IFK Tumba's roster contains exactly the 6 real people from its canonical CLUB IDENTITY source, with the right roles/titles, and NO generated filler at all", () => {
  const snap = snapshotClubStaff("swe2-tumba")!;
  const current = selectCurrentStaffAssignments(snap.assignments, AS_OF_DATE);
  const roster = resolveClubStaffRoster("swe2-tumba", { people: snap.people, assignments: current }, true);
  const byName = new Map(roster.map((m) => [m.displayName, m]));

  assert.deepEqual(byName.get("Mats Kardell")?.roles, ["HEAD_COACH"]);
  assert.ok(byName.get("Helgi Magnusson")?.roles.includes("ASSISTANT_COACH"));
  // HM-STAFF-CAREER-1.0: Lagledare/Sportchef now map to real StaffRoles
  // (TEAM_MANAGER/SPORTING_DIRECTOR) for real attributes/suitability,
  // so `officialRoleLabel` (the no-mapping fallback) is no longer set --
  // but they stay VOLUNTARY employment (no salary evidence), never
  // auto-SALARIED merely from gaining a role mapping.
  assert.deepEqual(byName.get("Malin Kardell")?.roles, ["TEAM_MANAGER"]);
  assert.equal(byName.get("Malin Kardell")?.employmentType, "VOLUNTARY");
  assert.deepEqual(byName.get("Naman Raja Gul")?.roles, ["SPORTING_DIRECTOR"]);
  assert.equal(byName.get("Naman Raja Gul")?.employmentType, "VOLUNTARY");
  assert.ok(byName.get("Marie Hellkvist"));
  assert.ok(byName.get("Samir Svedin"));

  // The exact regression this milestone fixes: no Lars Åberg/Maria Sjögren-style filler.
  assert.equal(roster.length, 6);
  assert.ok(roster.every((m) => m.source === "REAL_WORLD_IDENTITY"));
  assert.ok(!roster.some((m) => m.displayName === "Lars Åberg" || m.displayName === "Maria Sjögren"));
});

test("(3) NO Allsvenskan club's resolved roster contains any GENERATED_FICTIONAL member -- every one of the 14 is a REAL_WORLD club, so a genuine staffing gap must stay a genuine gap", () => {
  for (const clubId of ALLSVENSKAN_CLUB_IDS) {
    const snap = snapshotClubStaff(clubId);
    const current = snap ? selectCurrentStaffAssignments(snap.assignments, AS_OF_DATE) : [];
    const roster = resolveClubStaffRoster(clubId, snap ? { people: snap.people, assignments: current } : null, true);
    assert.ok(roster.every((m) => m.source === "REAL_WORLD_IDENTITY"), `${clubId}: found unexpected GENERATED_FICTIONAL member(s): ${roster.filter((m) => m.source === "GENERATED_FICTIONAL").map((m) => m.displayName)}`);
  }
});

test("(4) no person id is duplicated within a single club's resolved roster (no duplicated people, no parallel staff state)", () => {
  for (const clubId of ALLSVENSKAN_CLUB_IDS) {
    const snap = snapshotClubStaff(clubId);
    const current = snap ? selectCurrentStaffAssignments(snap.assignments, AS_OF_DATE) : [];
    const roster = resolveClubStaffRoster(clubId, snap ? { people: snap.people, assignments: current } : null, true);
    const ids = roster.map((m) => m.id);
    assert.equal(new Set(ids).size, ids.length, `${clubId}: duplicate id in resolved roster`);
  }
});

test("(5) at least one Allsvenskan club genuinely has no coach mapped to GOALKEEPER_COACH or PHYSICAL_COACH -- and correctly shows that as an absence, not a fabricated person", () => {
  let sawGenuineGap = false;
  for (const clubId of ALLSVENSKAN_CLUB_IDS) {
    const snap = snapshotClubStaff(clubId);
    const current = snap ? selectCurrentStaffAssignments(snap.assignments, AS_OF_DATE) : [];
    const roster = resolveClubStaffRoster(clubId, snap ? { people: snap.people, assignments: current } : null, true);
    const roles = new Set(roster.flatMap((m) => m.roles));
    if (!roles.has("GOALKEEPER_COACH") || !roles.has("PHYSICAL_COACH")) sawGenuineGap = true;
  }
  assert.ok(sawGenuineGap, "expected at least one real club to genuinely lack a specialist coaching role");
});

test("(6) governance (Ordförande/styrelse/committee) and voluntary administrative staff (Lagledare/Materialansvarig) are never classified SALARIED", () => {
  for (const clubId of ALLSVENSKAN_CLUB_IDS) {
    const snap = snapshotClubStaff(clubId);
    const current = snap ? selectCurrentStaffAssignments(snap.assignments, AS_OF_DATE) : [];
    const roster = resolveClubStaffRoster(clubId, snap ? { people: snap.people, assignments: current } : null, true);
    for (const member of roster) {
      if (member.roles.length === 0) {
        assert.notEqual(member.employmentType, "SALARIED", `${clubId}/${member.displayName}: has no gameplay role but is classified SALARIED`);
      }
    }
  }
});

test("(7) every resolved roster is sorted by staff hierarchy, most senior first", () => {
  const HM_ROLE_HIERARCHY_RANK: Record<string, number> = {
    CHAIRPERSON: 0, CLUB_DIRECTOR: 0, SENIOR_DIRECTOR: 0, ELITE_DIRECTOR: 0,
    SPORTING_DIRECTOR: 1, HEAD_COACH: 2, ASSISTANT_COACH: 3, COACH: 3,
    GOALKEEPER_COACH: 4, STRENGTH_CONDITIONING_COACH: 4, ANALYST: 5, SCOUT: 5,
    PHYSIOTHERAPIST: 6, DOCTOR: 6, PERFORMANCE_STAFF: 6, TEAM_MANAGER: 7, TEAM_ADMIN: 7,
    EQUIPMENT_MANAGER: 8, OTHER: 8, ACTIVE_PLAYER: 8,
  };
  const rankOf = (hmRoles: readonly string[]) => (hmRoles.length === 0 ? 8 : Math.min(...hmRoles.map((r) => HM_ROLE_HIERARCHY_RANK[r] ?? 8)));

  for (const clubId of ALLSVENSKAN_CLUB_IDS) {
    const snap = snapshotClubStaff(clubId);
    const current = snap ? selectCurrentStaffAssignments(snap.assignments, AS_OF_DATE) : [];
    const roster = resolveClubStaffRoster(clubId, snap ? { people: snap.people, assignments: current } : null, true);
    const ranks = roster.map((m) => rankOf(m.hmRoles));
    for (let i = 1; i < ranks.length; i++) {
      assert.ok(ranks[i] >= ranks[i - 1], `${clubId}: roster not sorted by hierarchy at index ${i} (${roster[i - 1].displayName}=${ranks[i - 1]} -> ${roster[i].displayName}=${ranks[i]})`);
    }
  }
});
