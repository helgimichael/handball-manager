import assert from "node:assert/strict";
import test from "node:test";
import {
  COURT_BOUNDS_METERS,
  COURT_LENGTH_METERS,
  COURT_WIDTH_METERS,
  buildViewportForCourtView
} from "./court";
import { clampPointToBounds } from "./coordinates";

test("court dimensions and bounds are canonical meters", () => {
  assert.equal(COURT_WIDTH_METERS, 20);
  assert.equal(COURT_LENGTH_METERS, 40);
  assert.deepEqual(COURT_BOUNDS_METERS, { minX: 0, minY: 0, maxX: 20, maxY: 40 });
});

test("half court is a viewport over the full court model", () => {
  assert.deepEqual(buildViewportForCourtView("HALF_COURT"), { x: 0, y: 0, width: 20, height: 20 });
  assert.deepEqual(buildViewportForCourtView("FULL_COURT"), { x: 0, y: 0, width: 20, height: 40 });
});

test("points clamp to court bounds", () => {
  assert.deepEqual(clampPointToBounds({ x: -3, y: 42 }, COURT_BOUNDS_METERS), { x: 0, y: 40 });
});
