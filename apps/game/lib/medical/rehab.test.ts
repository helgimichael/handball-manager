import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceRehabOneDay, isFullyRecovered } from "./rehab";
import { computeMedicalRehabQuality, findBestPhysio } from "./medicalStaffQuality";
import { addDays } from "../career/dateUtils";
import type { ActiveInjury } from "./types";
import type { ResolvedStaffMember, StaffAttribute } from "../staff/types";

function freshInjury(overrides: Partial<ActiveInjury> = {}): ActiveInjury {
  return {
    injuryId: "injury:test:1",
    injuryType: "HAMSTRING_STRAIN",
    bodyArea: "HAMSTRING",
    mechanism: "OVERUSE",
    severity: "MODERATE",
    occurredDate: "2026-09-01",
    source: "TRAINING",
    expectedReturnDate: addDays("2026-09-01", 20),
    expectedDurationDays: 20,
    currentPhase: "ACUTE",
    rehabProgress: 0,
    recurrenceRiskMultiplier: 1.0,
    lastRehabProcessedDate: null,
    ...overrides,
  };
}

function buildPhysio(id: string, medical: number, overrides: Partial<Record<StaffAttribute, number>> = {}): ResolvedStaffMember {
  const attributes: Record<string, { value: number; origin: "GENERATED_PRIOR" }> = { MEDICAL: { value: medical, origin: "GENERATED_PRIOR" } };
  for (const [attr, value] of Object.entries(overrides)) attributes[attr] = { value: value!, origin: "GENERATED_PRIOR" };
  return { id, clubId: "club-x", displayName: id, roles: ["PHYSIO"], profile: { personId: id, attributes: attributes as ResolvedStaffMember["profile"]["attributes"] }, source: "GENERATED_FICTIONAL" };
}

// (26) minor injury recovers faster than major.
test("(26) a MINOR injury (short expectedDurationDays) reaches full recovery in far fewer days than a MAJOR one", () => {
  const minor = freshInjury({ severity: "MINOR", expectedDurationDays: 5 });
  const major = freshInjury({ severity: "MAJOR", expectedDurationDays: 90 });
  let minorDays = 0;
  let cur = minor;
  let date = "2026-09-01";
  while (!isFullyRecovered(cur) && minorDays < 200) {
    date = addDays(date, 1);
    cur = advanceRehabOneDay(cur, date, 1.0);
    minorDays++;
  }
  let majorDays = 0;
  cur = major;
  date = "2026-09-01";
  while (!isFullyRecovered(cur) && majorDays < 400) {
    date = addDays(date, 1);
    cur = advanceRehabOneDay(cur, date, 1.0);
    majorDays++;
  }
  assert.ok(minorDays < majorDays, `minorDays=${minorDays} majorDays=${majorDays}`);
  assert.ok(minorDays <= 6, `minorDays=${minorDays}`);
  assert.ok(majorDays >= 85 && majorDays <= 95, `majorDays=${majorDays}`);
});

// (27) strong medical staff > weak medical staff rehab speed.
test("(27) a strong PHYSIO (high MEDICAL) speeds up rehab; a weak one slows it, relative to neutral", () => {
  const strong = computeMedicalRehabQuality([buildPhysio("p1", 20)]);
  const weak = computeMedicalRehabQuality([buildPhysio("p2", 1)]);
  const none = computeMedicalRehabQuality([]);
  assert.ok(strong > none);
  assert.ok(weak < none);
  assert.equal(none, 1.0);
});

// (28) medical effect bounded.
test("(28) computeMedicalRehabQuality never leaves [0.75, 1.25] regardless of extreme MEDICAL values", () => {
  assert.ok(computeMedicalRehabQuality([buildPhysio("p1", 20)]) <= 1.25);
  assert.ok(computeMedicalRehabQuality([buildPhysio("p2", 1)]) >= 0.75);
});

test("findBestPhysio picks the highest-MEDICAL PHYSIO on the roster, deterministically", () => {
  const roster = [buildPhysio("p-low", 8), buildPhysio("p-high", 18)];
  const best = findBestPhysio(roster);
  assert.equal(best?.id, "p-high");
  assert.equal(findBestPhysio([]), null);
});

// (29) rehab progresses daily.
test("(29) advanceRehabOneDay strictly increases rehabProgress each call", () => {
  const injury = freshInjury();
  const day1 = advanceRehabOneDay(injury, "2026-09-02", 1.0);
  assert.ok(day1.rehabProgress > injury.rehabProgress);
  const day2 = advanceRehabOneDay(day1, "2026-09-03", 1.0);
  assert.ok(day2.rehabProgress > day1.rehabProgress);
});

// (30) reload does not duplicate rehab progression -- the pure function itself is safe to call twice for the SAME date only if the caller re-passes the SAME prior object; the real duplication guard lives in injuryIntegration.ts's lastRehabProcessedDate check, proven at the integration level (see injuryCareerIntegration.test.ts). Here we prove the marker itself updates correctly so that guard can work.
test("(30) advanceRehabOneDay stamps lastRehabProcessedDate with the date it was called for", () => {
  const injury = freshInjury();
  const advanced = advanceRehabOneDay(injury, "2026-09-05", 1.0);
  assert.equal(advanced.lastRehabProcessedDate, "2026-09-05");
});

// (31) injury transitions through intermediate return phase.
test("(31) rehabProgress passes through ACUTE -> REHAB -> RETURN_TO_TRAINING -> RETURN_TO_PLAY in order, never skipping a phase", () => {
  let injury = freshInjury({ expectedDurationDays: 40 });
  let date = "2026-09-01";
  const seenPhases: string[] = [injury.currentPhase];
  for (let i = 0; i < 60 && !isFullyRecovered(injury); i++) {
    date = addDays(date, 1);
    injury = advanceRehabOneDay(injury, date, 1.0);
    if (injury.currentPhase !== seenPhases[seenPhases.length - 1]) seenPhases.push(injury.currentPhase);
  }
  assert.deepEqual(seenPhases, ["ACUTE", "REHAB", "RETURN_TO_TRAINING", "RETURN_TO_PLAY"]);
});

// (32) player does not jump directly major injury -> full availability.
test("(32) a MAJOR injury never reaches full recovery in a single day's advance, even with elite medical quality", () => {
  const injury = freshInjury({ severity: "MAJOR", expectedDurationDays: 90 });
  const advanced = advanceRehabOneDay(injury, "2026-09-02", 1.25);
  assert.equal(isFullyRecovered(advanced), false);
  assert.notEqual(advanced.currentPhase, "RETURN_TO_PLAY");
});

// (33) expected return deterministic -- expectedReturnDate is fixed at injury creation (pickExpectedDurationDays is deterministic, proven in injuryRisk.test.ts); here we confirm the field itself never changes as rehab progresses.
test("(33) expectedReturnDate stays fixed across daily rehab advances -- only rehabProgress/currentPhase move", () => {
  let injury = freshInjury();
  const originalReturn = injury.expectedReturnDate;
  let date = "2026-09-01";
  for (let i = 0; i < 5; i++) {
    date = addDays(date, 1);
    injury = advanceRehabOneDay(injury, date, 1.0);
  }
  assert.equal(injury.expectedReturnDate, originalReturn);
});

// (34) recurrence risk falls after successful return period -- proven via injuryRisk.test.ts's recurrenceRiskModifier tests (10/10b); referenced here for the rehab-phase completion boundary.
test("(34) isFullyRecovered is false until rehabProgress reaches exactly 1, then true", () => {
  assert.equal(isFullyRecovered(freshInjury({ rehabProgress: 0.999 })), false);
  assert.equal(isFullyRecovered(freshInjury({ rehabProgress: 1 })), true);
});

// (35) injury history persists after recovery -- proven at the integration level (injuryCareerIntegration.test.ts), since history construction happens in injuryIntegration.ts, not rehab.ts. Here we confirm rehab.ts itself never touches history.
test("(35) advanceRehabOneDay never introduces a history field -- history management stays the integration layer's job", () => {
  const injury = advanceRehabOneDay(freshInjury(), "2026-09-02", 1.0);
  assert.ok(!("injuryHistory" in injury));
});
