import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DISPLAY, displayRootAttributes, parseDisplayPreferences } from "./displayPreferences";

test("missing, corrupt or foreign values fall back to the defaults", () => {
  assert.deepEqual(parseDisplayPreferences(null), DEFAULT_DISPLAY);
  assert.deepEqual(parseDisplayPreferences("{not json"), DEFAULT_DISPLAY);
  assert.deepEqual(parseDisplayPreferences(JSON.stringify({ motion: "FAST", density: "TINY", textSize: 300 })), DEFAULT_DISPLAY);
});

test("an older v1 value that only stored motion keeps it and gains density/text-size defaults", () => {
  assert.deepEqual(parseDisplayPreferences(JSON.stringify({ motion: "REDUCED" })), { motion: "REDUCED", density: "COMFORTABLE", textSize: 100 });
});

test("valid density and text size survive a round trip", () => {
  const stored = { motion: "SYSTEM", density: "COMPACT", textSize: 125 } as const;
  assert.deepEqual(parseDisplayPreferences(JSON.stringify(stored)), stored);
  assert.equal(parseDisplayPreferences(JSON.stringify({ textSize: 112 })).textSize, 112);
});

test("root attributes: defaults remove everything; choices map to the CSS hooks in motion.css", () => {
  assert.deepEqual(displayRootAttributes(DEFAULT_DISPLAY), { motion: null, density: null, textSize: null, zoom: null });
  assert.deepEqual(displayRootAttributes({ motion: "REDUCED", density: "COMPACT", textSize: 112 }), { motion: "reduced", density: "compact", textSize: "112", zoom: "1.12" });
  assert.equal(displayRootAttributes({ ...DEFAULT_DISPLAY, textSize: 125 }).zoom, "1.25");
});
