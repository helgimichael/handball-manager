// HM-PLAYER-DATA-EDITOR-1.0C: regression coverage for the reported failure
// "I edit Division 1 positions in the Player Data Editor, press Save, and
// nothing is written".
//
// The backend was never the fault. Every defect was in the client's
// edit -> dirty -> save -> reconcile lifecycle, and the two that actually
// destroyed work are pinned first below.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isSourceDirty,
  isRatingDirty,
  isDirty,
  matchesFilters,
  dirtyPlayerIds,
  runSaveAll,
  applySaveOutcome,
  type DirtyComparable,
  type FilterableRow,
} from "./bulkEditorState";

type Row = DirtyComparable & FilterableRow;

function row(over: Partial<Row> = {}): Row {
  return {
    playerId: "p1",
    competitionSlug: "division1-norra",
    clubId: "club_a",
    fullName: "Test Spelare",
    primaryPosition: "MV",
    dateOfBirth: "2000-01-01",
    birthYear: 2000,
    defaultSquadStatus: null,
    specialTags: [],
    ca: 100,
    pa: 120,
    ...over,
  };
}

const NO_FILTERS = { league: "", club: "", position: "", status: "", search: "" };

// ---------------------------------------------------------------------------
// THE BUG: an edited row used to delete itself from the table
// ---------------------------------------------------------------------------

test("an edited row stays visible when the POSITION filter matches its SAVED value", () => {
  // The exact reported workflow: filter to goalkeepers, then correct one.
  const saved = row({ primaryPosition: "MV" });
  const draft = row({ primaryPosition: "H9" }); // user corrects MV -> H9
  const filters = { ...NO_FILTERS, position: "MV" };

  assert.equal(
    matchesFilters(draft, saved, filters),
    true,
    "the row must remain in view while its correction is unsaved -- otherwise the row, and its own Spara button, vanish mid-edit",
  );
});

test("a row leaves the POSITION-filtered view only once the edit is SAVED", () => {
  const filters = { ...NO_FILTERS, position: "MV" };
  const draft = row({ primaryPosition: "H9" });
  // After a confirmed save the draft becomes the baseline...
  const originals = applySaveOutcome<Row>({ p1: row({ primaryPosition: "MV" }) }, "p1", draft, true);
  assert.equal(matchesFilters(draft, originals.p1, filters), false, "a saved H9 no longer belongs in an MV filter");
});

test("an edited row stays visible when the TRUPPSTATUS filter matches its SAVED value", () => {
  const saved = row({ defaultSquadStatus: null });
  const draft = row({ defaultSquadStatus: "KEY_PLAYER" });
  assert.equal(matchesFilters(draft, saved, { ...NO_FILTERS, status: "" }), true);
  // Filtering on the not-yet-calibrated bucket must not eject the row being calibrated.
  const savedNull = row({ defaultSquadStatus: null });
  assert.equal(matchesFilters(draft, savedNull, { ...NO_FILTERS, status: "KEY_PLAYER" }), false);
});

test("league, club and search filters still match the LIVE row", () => {
  const saved = row({ clubId: "club_a", competitionSlug: "division1-norra" });
  assert.equal(matchesFilters(row(), saved, { ...NO_FILTERS, league: "division1-sodra" }), false);
  assert.equal(matchesFilters(row(), saved, { ...NO_FILTERS, club: "club_b" }), false);
  assert.equal(matchesFilters(row(), saved, { ...NO_FILTERS, search: "spelare" }), true);
  assert.equal(matchesFilters(row(), saved, { ...NO_FILTERS, search: "nobody" }), false);
});

test("a row with no saved baseline yet falls back to its own values", () => {
  assert.equal(matchesFilters(row({ primaryPosition: "MV" }), undefined, { ...NO_FILTERS, position: "MV" }), true);
});

// ---------------------------------------------------------------------------
// INVARIANT: dirty state is never cleared without a successful response
// ---------------------------------------------------------------------------

test("a successful save promotes the draft to the new baseline", () => {
  const draft = row({ primaryPosition: "H9" });
  const next = applySaveOutcome<Row>({ p1: row() }, "p1", draft, true);
  assert.equal(next.p1.primaryPosition, "H9");
  assert.equal(isDirty(draft, next.p1), false, "the row is clean only after the server confirmed it");
});

test("a FAILED save preserves the draft and leaves the row dirty", () => {
  const baseline = row({ primaryPosition: "MV" });
  const draft = row({ primaryPosition: "H9" });
  const next = applySaveOutcome<Row>({ p1: baseline }, "p1", draft, false);
  assert.equal(next.p1.primaryPosition, "MV", "the baseline must not move on failure");
  assert.equal(isDirty(draft, next.p1), true, "the user's edit must still be pending after a failed save");
  assert.equal(next.p1, baseline, "the baseline object itself must be untouched on failure");
});

test("a save that never dispatched leaves every dirty row dirty", () => {
  const rows = [row({ playerId: "p1", primaryPosition: "H9" })];
  const originals = { p1: row({ playerId: "p1", primaryPosition: "MV" }) };
  // No request issued at all -- nothing may be reconciled.
  assert.deepEqual(dirtyPlayerIds(rows, originals), ["p1"]);
});

// ---------------------------------------------------------------------------
// Save All orchestration
// ---------------------------------------------------------------------------

test("Save All with 3 dirty players dispatches all 3 saves", async () => {
  const dispatched: string[] = [];
  const outcome = await runSaveAll(["p1", "p2", "p3"], async (id) => {
    dispatched.push(id);
    return true;
  });
  assert.deepEqual(dispatched, ["p1", "p2", "p3"], "every dirty row must get its own request");
  assert.deepEqual(outcome.saved, ["p1", "p2", "p3"]);
  assert.deepEqual(outcome.failed, []);
});

test("Save All attempts every row even when one fails, and reports the failures", async () => {
  const dispatched: string[] = [];
  const outcome = await runSaveAll(["p1", "p2", "p3"], async (id) => {
    dispatched.push(id);
    return id !== "p2";
  });
  assert.deepEqual(dispatched, ["p1", "p2", "p3"], "one failure must not abort the rest of the batch");
  assert.deepEqual(outcome.saved, ["p1", "p3"]);
  assert.deepEqual(outcome.failed, ["p2"], "the failed row must be reported so it can stay dirty and visible");
});

test("Save All over zero dirty rows dispatches nothing", async () => {
  let calls = 0;
  const outcome = await runSaveAll([], async () => {
    calls += 1;
    return true;
  });
  assert.equal(calls, 0);
  assert.deepEqual(outcome, { attempted: [], saved: [], failed: [] });
});

test("the pending count reported to the user is the exact set of dirty rows", () => {
  const rows = [
    row({ playerId: "p1", primaryPosition: "H9" }), // edited
    row({ playerId: "p2" }), // untouched
    row({ playerId: "p3", ca: 140 }), // rating edited
  ];
  const originals = { p1: row({ playerId: "p1" }), p2: row({ playerId: "p2" }), p3: row({ playerId: "p3" }) };
  assert.deepEqual(dirtyPlayerIds(rows, originals), ["p1", "p3"]);
});

test("a row with no baseline is never counted as dirty", () => {
  assert.deepEqual(dirtyPlayerIds([row({ playerId: "p9" })], {}), []);
});

// ---------------------------------------------------------------------------
// Dirty-field classification (source vs rating write paths stay independent)
// ---------------------------------------------------------------------------

test("a position change is SOURCE dirty and not RATING dirty", () => {
  const before = row();
  const after = row({ primaryPosition: "H9" });
  assert.equal(isSourceDirty(after, before), true);
  assert.equal(isRatingDirty(after, before), false, "a pure position edit must never touch the rating write path");
});

test("a CA change is RATING dirty and not SOURCE dirty", () => {
  const before = row();
  const after = row({ ca: 150 });
  assert.equal(isRatingDirty(after, before), true);
  assert.equal(isSourceDirty(after, before), false, "a pure CA edit must never rewrite the source JSON files");
});

test("specialTags is compared by value, not by reference", () => {
  assert.equal(isSourceDirty(row({ specialTags: [] }), row({ specialTags: [] })), false);
  assert.equal(isSourceDirty(row({ specialTags: ["CAPTAIN"] }), row({ specialTags: [] })), true);
});

test("an identical row is not dirty", () => {
  assert.equal(isDirty(row(), row()), false);
});
