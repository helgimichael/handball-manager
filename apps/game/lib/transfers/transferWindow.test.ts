import { test } from "node:test";
import assert from "node:assert/strict";
import { isTransferWindowOpen, nextTransferWindowOpenDate } from "./transferWindow";

test("(1) summer window is open in July", () => {
  assert.ok(isTransferWindowOpen("2026-07-15"));
});

test("(2) winter window is open in mid-January", () => {
  assert.ok(isTransferWindowOpen("2027-01-15"));
});

test("(3) window is closed in a normal mid-season month (e.g. November)", () => {
  assert.ok(!isTransferWindowOpen("2026-11-15"));
});

test("(4) window is closed in spring (e.g. April)", () => {
  assert.ok(!isTransferWindowOpen("2027-04-10"));
});

test("(5) nextTransferWindowOpenDate returns a date strictly after the query date, and it is itself an open date", () => {
  const next = nextTransferWindowOpenDate("2026-11-15");
  assert.ok(next > "2026-11-15");
  assert.ok(isTransferWindowOpen(next));
});

test("(6) nextTransferWindowOpenDate from inside an open window returns a LATER window, not the same one", () => {
  const next = nextTransferWindowOpenDate("2026-07-01");
  assert.ok(next > "2026-07-01");
});
