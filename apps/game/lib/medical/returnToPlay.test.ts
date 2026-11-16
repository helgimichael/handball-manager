// Arena Nights 231 -- MED-01 C: the return-to-play projection follows the rehab rules exactly and never changes an injury.
import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceRehabOneDay } from "./rehab";
import { daysToProgress, projectReturn } from "./returnToPlay";
import type { ActiveInjury } from "./types";

const injury = (progress: number, days = 20, phase: ActiveInjury["currentPhase"] = "REHAB"): ActiveInjury => ({
  injuryId: "i1", injuryType: "ANKLE_SPRAIN", bodyArea: "ANKLE", mechanism: "CONTACT", severity: "MODERATE", occurredDate: "2026-09-01", source: "MATCH",
  expectedReturnDate: "2026-09-21", expectedDurationDays: days, currentPhase: phase, rehabProgress: progress, recurrenceRiskMultiplier: 1, lastRehabProcessedDate: null,
});

test("days to a phase match the daily rehab step at the same medical quality", () => {
  for (const quality of [0.8, 1, 1.2]) {
    let i = injury(0.2);
    const days = daysToProgress(i, 0.95, quality);
    for (let d = 0; d < days; d++) i = advanceRehabOneDay(i, `d${d}`, quality);
    assert.ok(i.rehabProgress >= 0.95 - 1e-9, `quality ${quality}`);
    let j = injury(0.2);
    for (let d = 0; d < days - 1; d++) j = advanceRehabOneDay(j, `d${d}`, quality);
    assert.ok(j.rehabProgress < 0.95);
  }
});

test("projection: selectable (limited) before fully back; passed phases are done, the current one is current", () => {
  const p = projectReturn(injury(0.5, 20, "REHAB"), "2026-09-11", 1);
  assert.equal(p.playableFrom, "2026-09-20");
  assert.equal(p.fullReturn, "2026-09-21");
  assert.deepEqual(p.steps.map((s) => s.state), ["done", "current", "todo", "todo"]);
  assert.equal(p.steps[2]!.from, "2026-09-16");
  const back = projectReturn(injury(0.97, 20, "RETURN_TO_PLAY"), "2026-09-11", 1);
  assert.equal(back.playableFrom, "2026-09-11");
});

test("the projection is read-only", () => {
  const i = injury(0.4);
  const before = JSON.stringify(i);
  projectReturn(i, "2026-09-11", 1.1);
  assert.equal(JSON.stringify(i), before);
});
