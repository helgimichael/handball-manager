// Arena Nights SYS-02 -- dev console tool list: routing helpers are pure and unambiguous.
import { test } from "node:test";
import assert from "node:assert/strict";
import { activeDevTool, DEV_TOOLS, devDataCounts, devToolForShortcut, isDevRoute } from "./devTools";

test("every dev tool has a unique id, href and shortcut", () => {
  assert.equal(new Set(DEV_TOOLS.map((t) => t.id)).size, DEV_TOOLS.length);
  assert.equal(new Set(DEV_TOOLS.map((t) => t.href)).size, DEV_TOOLS.length);
  assert.equal(new Set(DEV_TOOLS.map((t) => t.shortcut)).size, DEV_TOOLS.length);
});

test("every dev tool lives under a gated dev route, never a player route", () => {
  for (const tool of DEV_TOOLS) {
    assert.ok(isDevRoute(tool.href), tool.href);
    assert.ok(!tool.href.startsWith("/career"), `${tool.href} must not be a player route`);
  }
});

test("isDevRoute: dev roots and their children only", () => {
  assert.ok(isDevRoute("/editor"));
  assert.ok(isDevRoute("/editor/ratings/p1"));
  assert.ok(isDevRoute("/scenario-lab/match"));
  assert.ok(isDevRoute("/match-qa"));
  assert.ok(!isDevRoute("/editorial"));
  assert.ok(!isDevRoute("/career"));
  assert.ok(!isDevRoute("/career/club/cpu-recruitment"));
  assert.ok(!isDevRoute(null));
});

test("activeDevTool: longest href wins", () => {
  assert.equal(activeDevTool("/scenario-lab/core")?.id, "scenario-core");
  assert.equal(activeDevTool("/scenario-lab")?.id, "scenario-lab");
  assert.equal(activeDevTool("/editor/players/abc")?.id, "players");
  assert.equal(activeDevTool("/editor"), undefined);
});

test("devToolForShortcut maps digits to tools", () => {
  assert.equal(devToolForShortcut("1")?.id, "players");
  assert.equal(devToolForShortcut("x"), undefined);
});

test("devDataCounts counts distinct nations/competitions and sums players", () => {
  const counts = devDataCounts([
    { clubId: "a", competitionId: "swe-1", nation: "SWE", playerCount: 16 },
    { clubId: "b", competitionId: "swe-1", nation: "SWE", playerCount: 18 },
    { clubId: "c", competitionId: "swe-2", nation: "SWE", playerCount: 15 },
  ]);
  assert.deepEqual(counts, { nations: 1, competitions: 2, clubs: 3, players: 49 });
  assert.deepEqual(devDataCounts([]), { nations: 0, competitions: 0, clubs: 0, players: 0 });
});
