import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, compareDates, daysBetween, isAfter, isBefore, isSameOrBefore } from "./dateUtils";

test("addDays advances and rewinds across month/year boundaries", () => {
  assert.equal(addDays("2026-08-19", 1), "2026-08-20");
  assert.equal(addDays("2026-08-31", 1), "2026-09-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-08-19", -1), "2026-08-18");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
});

test("compareDates/isBefore/isAfter/isSameOrBefore agree with chronological order", () => {
  assert.equal(compareDates("2026-08-19", "2026-08-20"), -1);
  assert.equal(compareDates("2026-08-20", "2026-08-19"), 1);
  assert.equal(compareDates("2026-08-19", "2026-08-19"), 0);
  assert.ok(isBefore("2026-08-19", "2026-08-20"));
  assert.ok(!isBefore("2026-08-20", "2026-08-19"));
  assert.ok(isAfter("2026-08-20", "2026-08-19"));
  assert.ok(isSameOrBefore("2026-08-19", "2026-08-19"));
  assert.ok(isSameOrBefore("2026-08-19", "2026-08-20"));
  assert.ok(!isSameOrBefore("2026-08-20", "2026-08-19"));
});

test("daysBetween returns whole-day differences in both directions", () => {
  assert.equal(daysBetween("2026-08-19", "2026-08-20"), 1);
  assert.equal(daysBetween("2026-08-20", "2026-08-19"), -1);
  assert.equal(daysBetween("2026-08-19", "2026-08-19"), 0);
  assert.equal(daysBetween("2026-08-19", "2026-09-19"), 31);
});
