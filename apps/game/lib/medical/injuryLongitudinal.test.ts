// HM-INJURIES-1.0 Part 43/44/46: the mandatory longitudinal return-to-play
// scenario (weak/average/strong medical staff) and the population
// injury-rate sanity check -- both log real engine numbers via
// console.log for the final report, exactly like HM-TRAINING-1.1/
// HM-RATINGS-CAREER-1.0's own longitudinal tests before this one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceRehabOneDay, isFullyRecovered } from "./rehab";
import { computeMedicalRehabQuality } from "./medicalStaffQuality";
import { computeTrainingInjuryRisk, pickExpectedDurationDays, pickSeverity, seededRoll } from "./injuryRisk";
import type { ActiveInjury } from "./types";
import { rehabPhaseForProgress } from "./types";
import type { ResolvedStaffMember } from "../staff/types";

function buildPhysio(id: string, medical: number): ResolvedStaffMember {
  return { id, clubId: "club-x", displayName: id, roles: ["PHYSIO"], profile: { personId: id, attributes: { MEDICAL: { value: medical, origin: "GENERATED_PRIOR" } } as ResolvedStaffMember["profile"]["attributes"] }, source: "GENERATED_FICTIONAL" };
}

function addDaysLocal(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Part 43: longitudinal weak/average/strong medical scenario.
// ---------------------------------------------------------------------------

test("Part 43: MODERATE injury, day-by-day return-to-play under WEAK/AVERAGE/STRONG medical staff", () => {
  const occurredDate = "2026-09-01";
  const severity = "MODERATE" as const;
  const expectedDurationDays = pickExpectedDurationDays(severity, 25, "longitudinal-scenario-seed");

  function baseInjury(): ActiveInjury {
    return {
      injuryId: "injury:longitudinal:1",
      injuryType: "HAMSTRING_STRAIN",
      bodyArea: "HAMSTRING",
      mechanism: "OVERUSE",
      severity,
      occurredDate,
      source: "TRAINING",
      expectedReturnDate: addDaysLocal(occurredDate, expectedDurationDays),
      expectedDurationDays,
      currentPhase: "ACUTE",
      rehabProgress: 0,
      recurrenceRiskMultiplier: 1.0,
      lastRehabProcessedDate: null,
    };
  }

  const rosters: Record<string, ResolvedStaffMember[]> = {
    WEAK: [buildPhysio("physio-weak", 3)],
    AVERAGE: [buildPhysio("physio-avg", 10)],
    STRONG: [buildPhysio("physio-strong", 19)],
  };

  const report: Record<string, { medicalQuality: number; totalReturnDays: number; timeline: { day: number; date: string; phase: string; progress: string }[] }> = {};

  for (const [label, roster] of Object.entries(rosters)) {
    const medicalQuality = computeMedicalRehabQuality(roster);
    let injury = baseInjury();
    let date = occurredDate;
    const timeline: { day: number; date: string; phase: string; progress: string }[] = [{ day: 0, date, phase: injury.currentPhase, progress: injury.rehabProgress.toFixed(3) }];
    let day = 0;
    while (!isFullyRecovered(injury) && day < 400) {
      date = addDaysLocal(date, 1);
      injury = advanceRehabOneDay(injury, date, medicalQuality);
      day++;
      if (day <= 5 || day % 5 === 0 || isFullyRecovered(injury)) {
        timeline.push({ day, date, phase: injury.currentPhase, progress: injury.rehabProgress.toFixed(3) });
      }
    }
    report[label] = { medicalQuality: Number(medicalQuality.toFixed(3)), totalReturnDays: day, timeline };
  }

  // eslint-disable-next-line no-console
  console.log(
    "HM-INJURIES-1.0 Part 43/46: longitudinal MODERATE-injury return-to-play scenario (real engine output):",
    JSON.stringify({ severity, baseExpectedDurationDays: expectedDurationDays, weak: report.WEAK, average: report.AVERAGE, strong: report.STRONG }, null, 1),
  );

  assert.ok(report.STRONG.totalReturnDays < report.AVERAGE.totalReturnDays, `strong=${report.STRONG.totalReturnDays} average=${report.AVERAGE.totalReturnDays}`);
  assert.ok(report.AVERAGE.totalReturnDays < report.WEAK.totalReturnDays, `average=${report.AVERAGE.totalReturnDays} weak=${report.WEAK.totalReturnDays}`);
  // Effect meaningful but not absurd (Part 20/21: elite physio doesn't halve everything).
  const speedupRatio = report.WEAK.totalReturnDays / report.STRONG.totalReturnDays;
  assert.ok(speedupRatio > 1.1 && speedupRatio < 2.0, `speedupRatio=${speedupRatio}`);
});

// ---------------------------------------------------------------------------
// Part 44: population injury-rate sanity check.
// ---------------------------------------------------------------------------

test("Part 44: population sanity -- 1000 healthy player-weeks under NORMAL load vs HIGH load", () => {
  function simulateWeek(playerIndex: number, weekIndex: number, intensity: "NORMAL" | "HIGH"): boolean {
    // 4 training sessions/week, FULL load, CONDITIONING (a real physical-load session type).
    let injured = false;
    for (let session = 0; session < 4 && !injured; session++) {
      const seedKey = `population-sanity:${intensity}:player-${playerIndex}:week-${weekIndex}:session-${session}`;
      const risk = computeTrainingInjuryRisk("FULL", "CONDITIONING", intensity, {
        age: 25,
        currentEnergy: intensity === "HIGH" ? 55 : 80,
        recentLoad: intensity === "HIGH" ? 25 : 8,
        physicalResilience: 10.5,
        injuryHistory: [],
        asOfDate: "2026-09-01",
      });
      const roll = seededRoll(seedKey);
      if (roll < risk) injured = true;
    }
    return injured;
  }

  const SAMPLE_SIZE = 1000;
  let normalInjuries = 0;
  let highInjuries = 0;
  const severityCounts: Record<string, number> = { MINOR: 0, MODERATE: 0, MAJOR: 0, SEVERE: 0 };

  for (let i = 0; i < SAMPLE_SIZE; i++) {
    if (simulateWeek(i, 0, "NORMAL")) normalInjuries++;
    if (simulateWeek(i, 0, "HIGH")) {
      highInjuries++;
      severityCounts[pickSeverity(`population-sanity:HIGH:player-${i}:week-0:severity`)]++;
    }
  }

  const normalRate = normalInjuries / SAMPLE_SIZE;
  const highRate = highInjuries / SAMPLE_SIZE;

  // eslint-disable-next-line no-console
  console.log(
    "HM-INJURIES-1.0 Part 44/46: population sanity -- 1000 player-weeks, real engine output (not tuned to a preconceived percentage):",
    JSON.stringify({ sampleSize: SAMPLE_SIZE, normalLoadInjuryCount: normalInjuries, normalLoadInjuryRate: normalRate, highLoadInjuryCount: highInjuries, highLoadInjuryRate: highRate, highLoadSeverityBreakdown: severityCounts }, null, 1),
  );

  assert.ok(highRate > normalRate, `highRate=${highRate} normalRate=${normalRate}`);
  // Sanity bounds only (Part 9: meaningful but uncommon) -- not asserting an exact target percentage.
  assert.ok(normalRate < 0.15, `normalRate too high: ${normalRate}`);
  assert.ok(highRate < 0.4, `highRate too high: ${highRate}`);
});

test("rehabPhaseForProgress boundary values resolve to the correct phase", () => {
  assert.equal(rehabPhaseForProgress(0), "ACUTE");
  assert.equal(rehabPhaseForProgress(0.14), "ACUTE");
  assert.equal(rehabPhaseForProgress(0.15), "REHAB");
  assert.equal(rehabPhaseForProgress(0.74), "REHAB");
  assert.equal(rehabPhaseForProgress(0.75), "RETURN_TO_TRAINING");
  assert.equal(rehabPhaseForProgress(0.94), "RETURN_TO_TRAINING");
  assert.equal(rehabPhaseForProgress(0.95), "RETURN_TO_PLAY");
  assert.equal(rehabPhaseForProgress(1), "RETURN_TO_PLAY");
});
