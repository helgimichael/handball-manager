import { test } from "node:test";
import assert from "node:assert/strict";
import { diffFields } from "./diff";

test("only changed fields appear in the diff", () => {
  const before = { firstName: "Erik", lastName: "Andersson", heightCm: 188 };
  const after = { firstName: "Erik", lastName: "Andersén", heightCm: 190 };
  const diff = diffFields(before, after, ["firstName", "lastName", "heightCm"]);
  assert.deepEqual(diff, [
    { field: "lastName", oldValue: "Andersson", newValue: "Andersén" },
    { field: "heightCm", oldValue: 188, newValue: 190 },
  ]);
});

test("no diff entries when nothing changed", () => {
  const before = { a: 1, b: [1, 2] };
  const after = { a: 1, b: [1, 2] };
  assert.deepEqual(diffFields(before, after, ["a", "b"]), []);
});

test("array order changes are detected as a diff (order is part of the value)", () => {
  const before = { secondaryPositions: ["H6", "M9"] };
  const after = { secondaryPositions: ["M9", "H6"] };
  assert.deepEqual(diffFields(before, after, ["secondaryPositions"]), [
    { field: "secondaryPositions", oldValue: ["H6", "M9"], newValue: ["M9", "H6"] },
  ]);
});

test("null <-> value transitions are detected", () => {
  const before = { heightCm: null };
  const after = { heightCm: 190 };
  assert.deepEqual(diffFields(before, after, ["heightCm"]), [{ field: "heightCm", oldValue: null, newValue: 190 }]);
});
