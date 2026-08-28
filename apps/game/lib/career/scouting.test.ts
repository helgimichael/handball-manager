// HM-SCOUTING-1.0: focused proofs for the real scouting loop -- ASSIGN
// SCOUT -> TIME PASSES -> KNOWLEDGE INCREASES -> REPORT.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { generateStaffAttributeProfile } from "../staff/staffAttributeGeneration";
import type { ResolvedStaffMember, StaffAttribute } from "../staff/types";
import { getPlayerKnowledgePct } from "../knowledge/knowledgeIntegration";
import { TUMBA_CLUB_ID, TUMBA_SQUAD } from "../game-data";
import type { CareerState } from "./types";
import {
  computeAssignmentProgressPct,
  computeScoutAssignmentSuitability,
  createScoutingAssignment,
  getAllScoutingAssignments,
  getClubScouts,
  getPlayerScoutReports,
  progressScoutingAssignments,
} from "./scouting";

function staffMember(id: string, clubId: string, roles: ResolvedStaffMember["roles"], overrides: Partial<Record<StaffAttribute, number>> = {}): ResolvedStaffMember {
  const profile = generateStaffAttributeProfile(id, roles, id);
  for (const [attr, value] of Object.entries(overrides)) {
    profile.attributes[attr as StaffAttribute] = { value: value!, origin: "GENERATED_PRIOR" };
  }
  return { id, clubId, displayName: id, roles, hmRoles: [], employmentType: "SALARIED", profile, source: "GENERATED_FICTIONAL" };
}

function baseState(): CareerState {
  return createNewCareerState("scouting-test-seed", TUMBA_CLUB_ID);
}

function withScout(state: CareerState, scout: ResolvedStaffMember): CareerState {
  return { ...state, staffRoster: { ...state.staffRoster, [scout.clubId]: [...(state.staffRoster[scout.clubId] ?? []), scout] } };
}

const OTHER_CLUB = "se_club_alingsas_hk";
const TARGET_PLAYER_ID = TUMBA_SQUAD[0].id; // any real player id works as a generic "target" for these state-shape tests -- only its id matters, not its real club.

test("createScoutingAssignment succeeds for a real SCOUT-role staff member of the manager's own club, targeting an external player", () => {
  const eliteScout = staffMember("scout-1", TUMBA_CLUB_ID, ["SCOUT"], { PLAYER_JUDGEMENT: 18, POTENTIAL_JUDGEMENT: 18 });
  const state = withScout(baseState(), eliteScout);
  const result = createScoutingAssignment(state, "scout-1", TARGET_PLAYER_ID, OTHER_CLUB, "2026-08-19");
  assert.equal(result.ok, true);
  assert.ok(result.assignment);
  assert.equal(result.assignment!.status, "IN_PROGRESS");
  assert.equal(result.assignment!.scoutStaffId, "scout-1");
  assert.equal(result.assignment!.targetPlayerId, TARGET_PLAYER_ID);
  assert.equal(result.assignment!.reportId, null);
  assert.ok(result.assignment!.endDate > result.assignment!.startDate);
});

test("createScoutingAssignment refuses honestly when the club has no scout at all -- never invents one", () => {
  const state = baseState(); // TUMBA_CLUB_ID's default staff roster has no SCOUT (SCOUT is not an ESSENTIAL_ROLE)
  assert.equal(getClubScouts(state).length, 0, "sanity: this fixture genuinely has no scout");
  const result = createScoutingAssignment(state, "nonexistent-scout", TARGET_PLAYER_ID, OTHER_CLUB, "2026-08-19");
  assert.equal(result.ok, false);
  assert.equal(result.assignment, null);
  assert.ok(result.errors.length > 0);
});

test("createScoutingAssignment refuses a staff member who exists but does not hold the SCOUT role", () => {
  const coach = staffMember("coach-1", TUMBA_CLUB_ID, ["HEAD_COACH"]);
  const state = withScout(baseState(), coach);
  const result = createScoutingAssignment(state, "coach-1", TARGET_PLAYER_ID, OTHER_CLUB, "2026-08-19");
  assert.equal(result.ok, false);
});

test("createScoutingAssignment refuses a scout who belongs to a DIFFERENT club (never usable across clubs)", () => {
  const rivalScout = staffMember("rival-scout", OTHER_CLUB, ["SCOUT"]);
  const state = withScout(baseState(), rivalScout);
  const result = createScoutingAssignment(state, "rival-scout", TARGET_PLAYER_ID, OTHER_CLUB, "2026-08-19");
  assert.equal(result.ok, false);
});

test("createScoutingAssignment refuses targeting the manager's OWN club (already fully known)", () => {
  const scout = staffMember("scout-1", TUMBA_CLUB_ID, ["SCOUT"]);
  const state = withScout(baseState(), scout);
  const result = createScoutingAssignment(state, "scout-1", "own-player-id", TUMBA_CLUB_ID, "2026-08-19");
  assert.equal(result.ok, false);
});

test("createScoutingAssignment refuses a duplicate active assignment (same scout, same player, already IN_PROGRESS)", () => {
  const scout = staffMember("scout-1", TUMBA_CLUB_ID, ["SCOUT"]);
  const state = withScout(baseState(), scout);
  const first = createScoutingAssignment(state, "scout-1", TARGET_PLAYER_ID, OTHER_CLUB, "2026-08-19");
  assert.equal(first.ok, true);
  const second = createScoutingAssignment(first.state, "scout-1", TARGET_PLAYER_ID, OTHER_CLUB, "2026-08-20");
  assert.equal(second.ok, false);
});

test("an elite scout's assignment completes in fewer days than a weak scout's -- 'hur snabbt knowledge ökar'", () => {
  const elite = staffMember("elite", TUMBA_CLUB_ID, ["SCOUT"], { PLAYER_JUDGEMENT: 20, POTENTIAL_JUDGEMENT: 20 });
  const weak = staffMember("weak", TUMBA_CLUB_ID, ["SCOUT"], { PLAYER_JUDGEMENT: 1, POTENTIAL_JUDGEMENT: 1 });
  const state = withScout(withScout(baseState(), elite), weak);

  const eliteResult = createScoutingAssignment(state, "elite", TARGET_PLAYER_ID, OTHER_CLUB, "2026-08-19");
  const weakResult = createScoutingAssignment(state, "weak", "some-other-player-id", OTHER_CLUB, "2026-08-19");
  assert.ok(eliteResult.assignment!.endDate < weakResult.assignment!.endDate, "an elite scout's assignment must finish sooner than a weak scout's");
});

test("computeAssignmentProgressPct is 0 at start, ~50 at the midpoint, and 100 at/after the end date", () => {
  const scout = staffMember("scout-1", TUMBA_CLUB_ID, ["SCOUT"], { PLAYER_JUDGEMENT: 10, POTENTIAL_JUDGEMENT: 11 }); // neutral-ish
  const state = withScout(baseState(), scout);
  const { assignment } = createScoutingAssignment(state, "scout-1", TARGET_PLAYER_ID, OTHER_CLUB, "2026-08-19");
  assert.ok(assignment);

  assert.equal(computeAssignmentProgressPct(assignment!, assignment!.startDate), 0);
  assert.equal(computeAssignmentProgressPct(assignment!, assignment!.endDate), 100);
  const midDay = new Date(assignment!.startDate);
  midDay.setDate(midDay.getDate() + Math.floor((new Date(assignment!.endDate).getTime() - new Date(assignment!.startDate).getTime()) / (2 * 86400000)));
  const midPct = computeAssignmentProgressPct(assignment!, midDay.toISOString().slice(0, 10));
  assert.ok(midPct > 0 && midPct < 100, `expected a midpoint progress strictly between 0 and 100, got ${midPct}`);
});

test("computeAssignmentProgressPct always returns 100 for a COMPLETED assignment, regardless of the queried date", () => {
  const scout = staffMember("scout-1", TUMBA_CLUB_ID, ["SCOUT"]);
  const state = withScout(baseState(), scout);
  const { assignment } = createScoutingAssignment(state, "scout-1", TARGET_PLAYER_ID, OTHER_CLUB, "2026-08-19");
  const completed = { ...assignment!, status: "COMPLETED" as const };
  assert.equal(computeAssignmentProgressPct(completed, completed.startDate), 100);
});

test("progressScoutingAssignments does nothing before the assignment's end date", () => {
  const scout = staffMember("scout-1", TUMBA_CLUB_ID, ["SCOUT"]);
  const state = withScout(baseState(), scout);
  const { state: withAssignment, assignment } = createScoutingAssignment(state, "scout-1", TARGET_PLAYER_ID, OTHER_CLUB, "2026-08-19");
  const dayBefore = new Date(assignment!.endDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const { state: after, completed } = progressScoutingAssignments(withAssignment, dayBefore.toISOString().slice(0, 10));
  assert.equal(completed.length, 0);
  assert.equal(after.scoutingAssignments[assignment!.id].status, "IN_PROGRESS");
});

test("progressScoutingAssignments completes the assignment on its end date, raises knowledge, and files a persistent report", () => {
  const scout = staffMember("scout-1", TUMBA_CLUB_ID, ["SCOUT"], { PLAYER_JUDGEMENT: 15, POTENTIAL_JUDGEMENT: 15 });
  const state = withScout(baseState(), scout);
  const before = getPlayerKnowledgePct(state, TARGET_PLAYER_ID, OTHER_CLUB);

  const { state: withAssignment, assignment } = createScoutingAssignment(state, "scout-1", TARGET_PLAYER_ID, OTHER_CLUB, "2026-08-19");
  const { state: after, completed } = progressScoutingAssignments(withAssignment, assignment!.endDate);

  assert.equal(completed.length, 1);
  const completedAssignment = after.scoutingAssignments[assignment!.id];
  assert.equal(completedAssignment.status, "COMPLETED");
  assert.ok(completedAssignment.reportId, "a reportId must be set once completed");

  const report = after.scoutReports[completedAssignment.reportId!];
  assert.ok(report, "the referenced report must actually exist in scoutReports");
  assert.equal(report.targetPlayerId, TARGET_PLAYER_ID);
  assert.equal(report.scoutStaffId, "scout-1");

  const afterKnowledge = getPlayerKnowledgePct(after, TARGET_PLAYER_ID, OTHER_CLUB);
  assert.ok(afterKnowledge > before, `knowledge must rise after a completed assignment (${before} -> ${afterKnowledge})`);
});

test("progressScoutingAssignments is idempotent -- calling it again for a later date never re-completes or duplicates a report", () => {
  const scout = staffMember("scout-1", TUMBA_CLUB_ID, ["SCOUT"]);
  const state = withScout(baseState(), scout);
  const { state: withAssignment, assignment } = createScoutingAssignment(state, "scout-1", TARGET_PLAYER_ID, OTHER_CLUB, "2026-08-19");
  const first = progressScoutingAssignments(withAssignment, assignment!.endDate);
  const later = new Date(assignment!.endDate);
  later.setDate(later.getDate() + 5);
  const second = progressScoutingAssignments(first.state, later.toISOString().slice(0, 10));
  assert.equal(second.completed.length, 0);
  assert.equal(Object.keys(second.state.scoutReports).length, 1);
});

test("a higher-suitability scout produces a larger knowledge gain than a lower-suitability one, all else equal", () => {
  const elite = staffMember("elite", TUMBA_CLUB_ID, ["SCOUT"], { PLAYER_JUDGEMENT: 20, POTENTIAL_JUDGEMENT: 20 });
  const weak = staffMember("weak", TUMBA_CLUB_ID, ["SCOUT"], { PLAYER_JUDGEMENT: 1, POTENTIAL_JUDGEMENT: 1 });
  const state = withScout(withScout(baseState(), elite), weak);

  const eliteAssignment = createScoutingAssignment(state, "elite", "player-a", OTHER_CLUB, "2026-08-19");
  const weakAssignment = createScoutingAssignment(state, "weak", "player-b", OTHER_CLUB, "2026-08-19");

  const eliteAfter = progressScoutingAssignments(eliteAssignment.state, eliteAssignment.assignment!.endDate);
  const weakAfter = progressScoutingAssignments(weakAssignment.state, weakAssignment.assignment!.endDate);

  const eliteKnowledge = getPlayerKnowledgePct(eliteAfter.state, "player-a", OTHER_CLUB);
  const weakKnowledge = getPlayerKnowledgePct(weakAfter.state, "player-b", OTHER_CLUB);
  assert.ok(eliteKnowledge > weakKnowledge, `elite scout (${eliteKnowledge}) must yield more knowledge than a weak one (${weakKnowledge})`);
});

test("progressScoutingAssignments still completes gracefully (neutral suitability) if the assigned scout has since left the club", () => {
  const scout = staffMember("scout-1", TUMBA_CLUB_ID, ["SCOUT"]);
  const state = withScout(baseState(), scout);
  const { state: withAssignment, assignment } = createScoutingAssignment(state, "scout-1", TARGET_PLAYER_ID, OTHER_CLUB, "2026-08-19");
  // Simulate the scout leaving: remove them from the roster entirely.
  const withoutScout: CareerState = { ...withAssignment, staffRoster: { ...withAssignment.staffRoster, [TUMBA_CLUB_ID]: [] } };
  const { completed } = progressScoutingAssignments(withoutScout, assignment!.endDate);
  assert.equal(completed.length, 1, "the assignment must still complete even though the scout is gone");
});

test("getPlayerScoutReports returns only reports for the requested player, most recent first", () => {
  const scout = staffMember("scout-1", TUMBA_CLUB_ID, ["SCOUT"]);
  const state = withScout(baseState(), scout);
  const first = createScoutingAssignment(state, "scout-1", "player-x", OTHER_CLUB, "2026-08-01");
  const afterFirst = progressScoutingAssignments(first.state, first.assignment!.endDate);
  const second = createScoutingAssignment(afterFirst.state, "scout-1", "player-x", OTHER_CLUB, afterFirst.state.gameDate);
  assert.equal(second.ok, true, "a NEW assignment for the same player is allowed once the first one has completed");
  const afterSecond = progressScoutingAssignments(second.state, second.assignment!.endDate);

  const reports = getPlayerScoutReports(afterSecond.state, "player-x");
  assert.equal(reports.length, 2);
  assert.ok(reports[0].createdDate >= reports[1].createdDate, "most recent report first");
});

// ---------------------------------------------------------------------------
// HM-STAFF-SCOUT-POOL-1.0: specialist scouts must actually outperform a
// higher-OVR generalist on the relevant assignment type.
// ---------------------------------------------------------------------------

test("a GK specialist (high GOALKEEPER_COACHING, lower general judgement) outperforms a higher-OVR generalist when the target is a goalkeeper", () => {
  const gkSpecialist = staffMember("gk-specialist", TUMBA_CLUB_ID, ["SCOUT"], { PLAYER_JUDGEMENT: 13, POTENTIAL_JUDGEMENT: 12, GOALKEEPER_COACHING: 19 });
  const generalist = staffMember("generalist", TUMBA_CLUB_ID, ["SCOUT"], { PLAYER_JUDGEMENT: 16, POTENTIAL_JUDGEMENT: 16, GOALKEEPER_COACHING: 9 });

  const gkContext = { targetPosition: "MV", targetAgeYears: 25, isInternational: false };
  const specialistSuitability = computeScoutAssignmentSuitability(gkSpecialist, gkContext);
  const generalistSuitability = computeScoutAssignmentSuitability(generalist, gkContext);
  assert.ok(specialistSuitability > generalistSuitability, `GK specialist (${specialistSuitability}) must outperform the higher-OVR generalist (${generalistSuitability}) on a goalkeeper assignment`);
});

test("the same generalist scout instead outperforms the GK specialist on a NON-goalkeeper target", () => {
  const gkSpecialist = staffMember("gk-specialist", TUMBA_CLUB_ID, ["SCOUT"], { PLAYER_JUDGEMENT: 13, POTENTIAL_JUDGEMENT: 12, GOALKEEPER_COACHING: 19 });
  const generalist = staffMember("generalist", TUMBA_CLUB_ID, ["SCOUT"], { PLAYER_JUDGEMENT: 16, POTENTIAL_JUDGEMENT: 16, GOALKEEPER_COACHING: 9 });

  const outcourtContext = { targetPosition: "V9", targetAgeYears: 25, isInternational: false };
  const specialistSuitability = computeScoutAssignmentSuitability(gkSpecialist, outcourtContext);
  const generalistSuitability = computeScoutAssignmentSuitability(generalist, outcourtContext);
  assert.ok(generalistSuitability > specialistSuitability, `generalist (${generalistSuitability}) must outperform the GK specialist (${specialistSuitability}) on a non-goalkeeper assignment`);
});

test("a youth specialist outperforms a generalist when the target is 21 or younger, but not against an older target", () => {
  const youthSpecialist = staffMember("youth-specialist", TUMBA_CLUB_ID, ["SCOUT"], { PLAYER_JUDGEMENT: 12, POTENTIAL_JUDGEMENT: 14, YOUTH_DEVELOPMENT: 19 });
  const generalist = staffMember("generalist2", TUMBA_CLUB_ID, ["SCOUT"], { PLAYER_JUDGEMENT: 16, POTENTIAL_JUDGEMENT: 16, YOUTH_DEVELOPMENT: 9 });

  const youthContext = { targetPosition: "V9", targetAgeYears: 19, isInternational: false };
  assert.ok(
    computeScoutAssignmentSuitability(youthSpecialist, youthContext) > computeScoutAssignmentSuitability(generalist, youthContext),
    "youth specialist must outperform the generalist on a 19-year-old target",
  );

  const adultContext = { targetPosition: "V9", targetAgeYears: 28, isInternational: false };
  assert.ok(
    computeScoutAssignmentSuitability(generalist, adultContext) > computeScoutAssignmentSuitability(youthSpecialist, adultContext),
    "generalist must outperform the youth specialist on a 28-year-old target",
  );
});

test("computeScoutAssignmentSuitability weights INTERNATIONAL_KNOWLEDGE for a cross-border target and REGIONAL_KNOWLEDGE for a domestic one", () => {
  const internationalScout = staffMember("intl-scout", TUMBA_CLUB_ID, ["SCOUT"], { PLAYER_JUDGEMENT: 14, POTENTIAL_JUDGEMENT: 14, INTERNATIONAL_KNOWLEDGE: 19, REGIONAL_KNOWLEDGE: 6 });
  const regionalScout = staffMember("regional-scout", TUMBA_CLUB_ID, ["SCOUT"], { PLAYER_JUDGEMENT: 14, POTENTIAL_JUDGEMENT: 14, INTERNATIONAL_KNOWLEDGE: 6, REGIONAL_KNOWLEDGE: 19 });

  const domesticContext = { targetPosition: "V9", targetAgeYears: 25, isInternational: false };
  assert.ok(computeScoutAssignmentSuitability(regionalScout, domesticContext) > computeScoutAssignmentSuitability(internationalScout, domesticContext));

  const internationalContext = { targetPosition: "V9", targetAgeYears: 25, isInternational: true };
  assert.ok(computeScoutAssignmentSuitability(internationalScout, internationalContext) > computeScoutAssignmentSuitability(regionalScout, internationalContext));
});

test("getAllScoutingAssignments returns every assignment across the whole career, most recently started first", () => {
  const scout = staffMember("scout-1", TUMBA_CLUB_ID, ["SCOUT"]);
  const state = withScout(baseState(), scout);
  const a = createScoutingAssignment(state, "scout-1", "player-a", OTHER_CLUB, "2026-08-01");
  const b = createScoutingAssignment(a.state, "scout-1", "player-b", OTHER_CLUB, "2026-08-10");
  const all = getAllScoutingAssignments(b.state);
  assert.equal(all.length, 2);
  assert.equal(all[0].targetPlayerId, "player-b", "the more recently started assignment must come first");
});
