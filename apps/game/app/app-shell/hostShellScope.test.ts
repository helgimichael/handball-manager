import { test } from "node:test";
import assert from "node:assert/strict";
import { hostShellScope } from "./hostShellScope";

test("ENT-06: career and match routes get the corner escape hatch; everything else keeps the reveal edge", () => {
  assert.equal(hostShellScope("/career"), "career");
  assert.equal(hostShellScope("/career/squad/p-1"), "career");
  assert.equal(hostShellScope("/career/match-2d"), "career");
  assert.equal(hostShellScope("/match-qa"), "match");
  assert.equal(hostShellScope("/"), null);
  assert.equal(hostShellScope("/settings"), null);
  assert.equal(hostShellScope("/careers"), null);
  assert.equal(hostShellScope(null), null);
});
