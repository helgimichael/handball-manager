import test from "node:test";
import assert from "node:assert/strict";
import { STAFF_ROLES } from "./types";
import {
  ambitionOf,
  getStaffAmbitionProfile,
  formatStaffAmbition,
  staffAmbitionDescription,
} from "./staffAmbition";

test("HM-PLAYTEST-IMPROVEMENT-02: staff ambition is role-specific across all roles", () => {
  for (const role of STAFF_ROLES) {
    for (const testId of ["staff-1", "staff-2", "staff-3", "staff-4", "staff-test-physio", "staff-test-scout"]) {
      const profile = getStaffAmbitionProfile(testId, role);
      assert.ok(profile.label && profile.label.length > 0, `Missing label for role ${role}`);
      assert.ok(profile.description && profile.description.length > 0, `Missing description for role ${role}`);
      assert.ok(["SUPPORT", "DEPARTMENT_LEAD", "ORGANISATION_HEAD"].includes(profile.leadershipDesire));
      assert.ok(["REGIONAL", "NATIONAL_ELITE", "INTERNATIONAL"].includes(profile.prestigeDesire));
      assert.ok(["MODEST", "STANDARD", "PREMIUM"].includes(profile.wageExpectationTier));

      const formatted = formatStaffAmbition(profile.ambition, role);
      assert.equal(formatted, profile.label);

      const desc = staffAmbitionDescription(testId, role);
      assert.equal(desc, profile.description);
    }
  }
});

test("HM-PLAYTEST-IMPROVEMENT-02: physiotherapists and medical staff never display generic head coach ambitions", () => {
  // Check many seeds to cover STABILITY, PROGRESSION and HEAD_ROLE
  for (let i = 0; i < 50; i++) {
    const id = `physio-test-${i}`;
    const profile = getStaffAmbitionProfile(id, "PHYSIO");
    assert.doesNotMatch(profile.description, /huvudtränare/i);
    assert.doesNotMatch(profile.description, /Siktar på en egen huvudroll/i);
    assert.doesNotMatch(profile.label, /huvudroll/i);

    if (profile.ambition === "HEAD_ROLE") {
      assert.equal(profile.label, "Medicinskt ledaransvar");
      assert.equal(profile.leadershipDesire, "DEPARTMENT_LEAD");
      assert.match(profile.description, /medicinska team/i);
    }
  }
});

test("HM-PLAYTEST-IMPROVEMENT-02: scouts, analysts and fitness specialists have role-appropriate career progression", () => {
  for (let i = 0; i < 30; i++) {
    const scoutProfile = getStaffAmbitionProfile(`scout-${i}`, "SCOUT");
    assert.doesNotMatch(scoutProfile.description, /huvudtränare/i);
    if (scoutProfile.ambition === "HEAD_ROLE") {
      assert.equal(scoutProfile.label, "Siktar på chefsscoutroll");
      assert.equal(scoutProfile.leadershipDesire, "DEPARTMENT_LEAD");
    }

    const analystProfile = getStaffAmbitionProfile(`analyst-${i}`, "ANALYST");
    assert.doesNotMatch(analystProfile.description, /huvudtränare/i);
    if (analystProfile.ambition === "HEAD_ROLE") {
      assert.equal(analystProfile.label, "Siktar på chefsanalytiker");
      assert.equal(analystProfile.leadershipDesire, "DEPARTMENT_LEAD");
    }

    const physCoachProfile = getStaffAmbitionProfile(`physcoach-${i}`, "PHYSICAL_COACH");
    assert.doesNotMatch(physCoachProfile.description, /huvudtränare/i);
    if (physCoachProfile.ambition === "HEAD_ROLE") {
      assert.equal(physCoachProfile.label, "Siktar på prestandachef");
      assert.equal(physCoachProfile.leadershipDesire, "DEPARTMENT_LEAD");
    }
  }
});

test("HM-PLAYTEST-IMPROVEMENT-02: assistant coaches retain clear ambition for head coach roles", () => {
  let foundHeadRole = false;
  for (let i = 0; i < 50; i++) {
    const profile = getStaffAmbitionProfile(`assistant-${i}`, "ASSISTANT_COACH");
    if (profile.ambition === "HEAD_ROLE") {
      foundHeadRole = true;
      assert.equal(profile.label, "Siktar på huvudtränarroll");
      assert.equal(profile.leadershipDesire, "ORGANISATION_HEAD");
      assert.match(profile.description, /huvudtränarroll/i);
    }
  }
  assert.ok(foundHeadRole, "Should find at least one assistant coach seeking head coach role");
});
