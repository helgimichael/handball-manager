// Arena Nights SYS-02c/02d -- rating review queue buckets, progress and override diff are honest.
import { test } from "node:test";
import assert from "node:assert/strict";
import { filterQueue, overrideDiffRows, queueProgress, reviewBucket } from "./ratingQueue";

test("reviewBucket: lock record or LOCKED wins, REVIEWED next, everything else unreviewed", () => {
  assert.equal(reviewBucket({ status: "UNASSESSED", locked: null }), "UNREVIEWED");
  assert.equal(reviewBucket({ status: "PROPOSED", locked: null }), "UNREVIEWED");
  assert.equal(reviewBucket({ status: "REVIEWED", locked: null }), "REVIEWED");
  assert.equal(reviewBucket({ status: "REVIEWED", locked: { at: "x" } }), "LOCKED");
  assert.equal(reviewBucket({ status: "LOCKED" }), "LOCKED");
});

test("queueProgress counts each bucket and the done share", () => {
  const p = queueProgress([{ status: "UNASSESSED" }, { status: "REVIEWED" }, { status: "LOCKED" }, { status: "PROPOSED" }]);
  assert.deepEqual(p, { total: 4, unreviewed: 2, reviewed: 1, locked: 1, done: 0.5 });
  assert.equal(queueProgress([]).done, 0);
});

test("filterQueue puts unreviewed first, keeps order within a bucket, filters by bucket and search", () => {
  const rows = [{ id: "a", status: "REVIEWED" }, { id: "b", status: "UNASSESSED" }, { id: "c", status: "LOCKED" }, { id: "d", status: "PROPOSED" }];
  assert.deepEqual(filterQueue(rows, null).map((r) => r.id), ["b", "d", "a", "c"]);
  assert.deepEqual(filterQueue(rows, "REVIEWED").map((r) => r.id), ["a"]);
  assert.deepEqual(filterQueue(rows, null, (r) => r.id !== "b").map((r) => r.id), ["d", "a", "c"]);
});

test("overrideDiffRows compares against real bases only and labels missing ones", () => {
  assert.deepEqual(overrideDiffRows({ override: null, caEstimate: 100, knownAttributes: {} }), []);
  const rows = overrideDiffRows({ override: { ca: 120, pa: 150, attributeOverrides: { pace: 14, finishing: 12 } }, caEstimate: 110, knownAttributes: { pace: 11 } });
  assert.deepEqual(rows.map((r) => [r.key, r.base, r.override]), [["CA", 110, 120], ["PA", null, 150], ["pace", 11, 14], ["finishing", null, 12]]);
});
