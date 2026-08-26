// HM-STAFF-1.0 Part 33: directional proofs for role suitability, session
// coach resolution, and the training-quality multiplier.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateStaffAttributeProfile } from "./staffAttributeGeneration";
import { computeRoleSuitability, computeStaffTrainingQuality, eligibleStaffForSession, findHeadCoach, resolveResponsibleCoach } from "./roleSuitability";
import { STAFF_ROLES, type ResolvedStaffMember, type StaffAttribute } from "./types";

function member(id: string, roles: ResolvedStaffMember["roles"], overrides: Partial<Record<StaffAttribute, number>> = {}): ResolvedStaffMember {
  const profile = generateStaffAttributeProfile(id, roles, id);
  for (const [attr, value] of Object.entries(overrides)) {
    profile.attributes[attr as StaffAttribute] = { value: value!, origin: "GENERATED_PRIOR" };
  }
  return { id, clubId: "club1", displayName: id, roles, profile, source: "GENERATED_FICTIONAL" };
}

// (1) all canonical staff roles valid.
test("(1) STAFF_ROLES is a non-empty, deduplicated vocabulary", () => {
  assert.ok(STAFF_ROLES.length > 0);
  assert.equal(new Set(STAFF_ROLES).size, STAFF_ROLES.length);
});

// (3) role-specific suitability deterministic.
test("(3) computeRoleSuitability is deterministic for identical inputs", () => {
  const m = member("m1", ["HEAD_COACH"]);
  assert.equal(computeRoleSuitability(m, "HEAD_COACH"), computeRoleSuitability(m, "HEAD_COACH"));
});

// (4) GK coach suitability weights GK coaching heavily.
test("(4) a member with high GOALKEEPER_COACHING and low everything else scores high GOALKEEPER_COACH suitability", () => {
  const strong = member("gk-strong", ["GOALKEEPER_COACH"], { GOALKEEPER_COACHING: 20, PLAYER_DEVELOPMENT: 1 });
  const weak = member("gk-weak", ["GOALKEEPER_COACH"], { GOALKEEPER_COACHING: 1, PLAYER_DEVELOPMENT: 20 });
  assert.ok(computeRoleSuitability(strong, "GOALKEEPER_COACH") > computeRoleSuitability(weak, "GOALKEEPER_COACH"));
});

// (5) physical coach suitability weights physical coaching heavily.
test("(5) PHYSICAL_COACH suitability is dominated by PHYSICAL_COACHING, not an unrelated attribute", () => {
  const strong = member("phys-strong", ["PHYSICAL_COACH"], { PHYSICAL_COACHING: 20, ANALYSIS: 1 });
  const weak = member("phys-weak", ["PHYSICAL_COACH"], { PHYSICAL_COACHING: 1, ANALYSIS: 20 });
  assert.ok(computeRoleSuitability(strong, "PHYSICAL_COACH") > computeRoleSuitability(weak, "PHYSICAL_COACH"));
});

// (6) scout suitability ignores irrelevant training attributes.
test("(6) SCOUT suitability is unaffected by TECHNICAL_COACHING/PHYSICAL_COACHING -- only judgement attributes matter", () => {
  const m1 = member("scout1", ["SCOUT"], { PLAYER_JUDGEMENT: 15, POTENTIAL_JUDGEMENT: 15, TECHNICAL_COACHING: 1, PHYSICAL_COACHING: 1 });
  const m2 = member("scout2", ["SCOUT"], { PLAYER_JUDGEMENT: 15, POTENTIAL_JUDGEMENT: 15, TECHNICAL_COACHING: 20, PHYSICAL_COACHING: 20 });
  assert.equal(computeRoleSuitability(m1, "SCOUT"), computeRoleSuitability(m2, "SCOUT"));
});

// (7) session resolves eligible coach.
test("(7) resolveResponsibleCoach returns an eligible member for a session type with eligible roles", () => {
  const roster = [member("hc1", ["HEAD_COACH"]), member("ac1", ["ASSISTANT_COACH"])];
  const resolved = resolveResponsibleCoach(roster, "TECHNICAL", null);
  assert.ok(resolved);
  assert.ok(["hc1", "ac1"].includes(resolved!.id));
});

// (8) invalid-role coach rejected where applicable.
test("(8) an assigned coach who is NOT eligible for this session type is rejected in favor of the deterministic fallback", () => {
  const scout = member("scout1", ["SCOUT"]);
  const gkCoach = member("gk1", ["GOALKEEPER_COACH"]);
  const roster = [scout, gkCoach];
  const resolved = resolveResponsibleCoach(roster, "GOALKEEPER", scout.id);
  assert.equal(resolved?.id, gkCoach.id, "a SCOUT must never lead a GOALKEEPER session (Part 8)");
});

// (9) no assigned coach uses deterministic fallback.
test("(9) with no assignment at all, the best eligible staff member is chosen deterministically", () => {
  const weakGk = member("gk-weak", ["GOALKEEPER_COACH"], { GOALKEEPER_COACHING: 5 });
  const strongGk = member("gk-strong", ["GOALKEEPER_COACH"], { GOALKEEPER_COACHING: 18 });
  const roster = [weakGk, strongGk];
  const resolved = resolveResponsibleCoach(roster, "GOALKEEPER", null);
  assert.equal(resolved?.id, strongGk.id);
});

// (10) GK session selects GK-suitable coach.
test("(10) GOALKEEPER session's eligible staff includes GOALKEEPER_COACH", () => {
  const roster = [member("gk1", ["GOALKEEPER_COACH"]), member("scout1", ["SCOUT"])];
  const eligible = eligibleStaffForSession(roster, "GOALKEEPER");
  assert.ok(eligible.some((m) => m.id === "gk1"));
  assert.ok(!eligible.some((m) => m.id === "scout1"));
});

// (11) physical session selects physical-suitable coach.
test("(11) STRENGTH session's eligible staff is exactly PHYSICAL_COACH", () => {
  const roster = [member("phys1", ["PHYSICAL_COACH"]), member("hc1", ["HEAD_COACH"])];
  const eligible = eligibleStaffForSession(roster, "STRENGTH");
  assert.deepEqual(eligible.map((m) => m.id), ["phys1"]);
});

// (12) tactical session selects tactical-suitable coach.
test("(12) TEAM_TACTICAL session's eligible staff is HEAD_COACH/ASSISTANT_COACH only", () => {
  const roster = [member("hc1", ["HEAD_COACH"]), member("phys1", ["PHYSICAL_COACH"])];
  const eligible = eligibleStaffForSession(roster, "TEAM_TACTICAL");
  assert.ok(eligible.some((m) => m.id === "hc1"));
  assert.ok(!eligible.some((m) => m.id === "phys1"));
});

// (13) staff quality multiplier bounded.
test("(13) computeStaffTrainingQuality is always within [0.75, 1.25] regardless of extreme attribute values", () => {
  const elite = member("elite", ["PHYSICAL_COACH"], { PHYSICAL_COACHING: 20 });
  const terrible = member("terrible", ["PHYSICAL_COACH"], { PHYSICAL_COACHING: 1 });
  const qElite = computeStaffTrainingQuality("STRENGTH", elite, null);
  const qTerrible = computeStaffTrainingQuality("STRENGTH", terrible, null);
  assert.ok(qElite <= 1.25 && qElite >= 0.75);
  assert.ok(qTerrible <= 1.25 && qTerrible >= 0.75);
});

// (14) stronger relevant coach > weaker coach.
test("(14) a stronger relevant coach produces a strictly higher quality multiplier than a weaker one", () => {
  const strong = member("strong", ["GOALKEEPER_COACH"], { GOALKEEPER_COACHING: 18 });
  const weak = member("weak", ["GOALKEEPER_COACH"], { GOALKEEPER_COACHING: 4 });
  const qStrong = computeStaffTrainingQuality("GOALKEEPER", strong, null);
  const qWeak = computeStaffTrainingQuality("GOALKEEPER", weak, null);
  assert.ok(qStrong > qWeak);
});

// (15) irrelevant attribute does not dominate quality.
test("(15) a coach with a maxed IRRELEVANT attribute and a low relevant one still produces low quality for that session", () => {
  const m = member("m1", ["GOALKEEPER_COACH"], { GOALKEEPER_COACHING: 2, ANALYSIS: 20, LEADERSHIP: 20 });
  const quality = computeStaffTrainingQuality("GOALKEEPER", m, null);
  assert.ok(quality < 1.0, `expected low quality despite high irrelevant attributes, got ${quality}`);
});

test("RECOVERY sessions always carry neutral quality (no coaching-quality effect, Part 7/30)", () => {
  const elite = member("elite", ["HEAD_COACH"], { TACTICAL_COACHING: 20, LEADERSHIP: 20 });
  assert.equal(computeStaffTrainingQuality("RECOVERY", elite, elite), 1.0);
});

test("no eligible coach at all -> neutral quality, never zero/undefined (Part 9)", () => {
  assert.equal(computeStaffTrainingQuality("GOALKEEPER", null, null), 1.0);
});

// Part 10: head coach umbrella, bounded and non-dominant.
test("Part 10: a great head coach cannot turn poor GK coaching into elite GK development", () => {
  const eliteHeadCoach = member("hc-elite", ["HEAD_COACH"], { LEADERSHIP: 20, TACTICAL_COACHING: 20 });
  const poorGkCoach = member("gk-poor", ["GOALKEEPER_COACH"], { GOALKEEPER_COACHING: 2 });
  const quality = computeStaffTrainingQuality("GOALKEEPER", poorGkCoach, eliteHeadCoach);
  assert.ok(quality < 1.0, `expected the poor GK coach's own weakness to still dominate, got ${quality}`);
});

test("the head coach's own umbrella contributes zero extra when THEY are the resolved coach (no double counting)", () => {
  const headCoach = member("hc1", ["HEAD_COACH"], { TACTICAL_COACHING: 15, LEADERSHIP: 15 });
  const qualityAsResolved = computeStaffTrainingQuality("TEAM_TACTICAL", headCoach, headCoach);
  const qualityWithoutHeadCoachArg = computeStaffTrainingQuality("TEAM_TACTICAL", headCoach, null);
  assert.equal(qualityAsResolved, qualityWithoutHeadCoachArg);
});

test("findHeadCoach returns the roster's own HEAD_COACH, or null if none", () => {
  const hc = member("hc1", ["HEAD_COACH"]);
  assert.equal(findHeadCoach([hc, member("ac1", ["ASSISTANT_COACH"])])?.id, "hc1");
  assert.equal(findHeadCoach([member("ac1", ["ASSISTANT_COACH"])]), null);
});
