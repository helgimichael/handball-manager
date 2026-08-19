import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMatchdayReadyEvent,
  buildPlayerStatusChangedEvent,
  buildTrainingCompletedEvent,
  isStopWorthy,
} from "./careerEvents";

test("isStopWorthy: only IMPORTANT and ACTION_REQUIRED stop Continue", () => {
  assert.equal(isStopWorthy("INFORMATION"), false);
  assert.equal(isStopWorthy("IMPORTANT"), true);
  assert.equal(isStopWorthy("ACTION_REQUIRED"), true);
});

test("event builders produce stable, deterministic ids for the same semantic event", () => {
  const a = buildTrainingCompletedEvent("2026-08-20");
  const b = buildTrainingCompletedEvent("2026-08-20");
  assert.equal(a.id, b.id);

  const c = buildPlayerStatusChangedEvent("p-holmgren", "2026-09-10", true);
  const d = buildPlayerStatusChangedEvent("p-holmgren", "2026-09-10", true);
  assert.equal(c.id, d.id);

  const e = buildMatchdayReadyEvent("fx-1", "2026-08-22");
  const f = buildMatchdayReadyEvent("fx-1", "2026-08-22");
  assert.equal(e.id, f.id);
});

test("MATCHDAY_READY is ACTION_REQUIRED and starts unresolved", () => {
  const event = buildMatchdayReadyEvent("fx-1", "2026-08-22");
  assert.equal(event.priority, "ACTION_REQUIRED");
  assert.equal(event.requiresAction, true);
  assert.equal(event.resolved, false);
});

test("IMPORTANT events have requiresAction=false and start resolved (only ACTION_REQUIRED events block Continue)", () => {
  const event = buildPlayerStatusChangedEvent("p-holmgren", "2026-09-10", true);
  assert.equal(event.priority, "IMPORTANT");
  assert.equal(event.requiresAction, false);
  assert.equal(event.resolved, true);
  assert.equal(event.read, false);
});

test("destinations carry the required entity ids", () => {
  const event = buildPlayerStatusChangedEvent("p-holmgren", "2026-09-10", true);
  const destination = event.destinations.find((d) => d.route === "PLAYER_PROFILE");
  assert.ok(destination);
  assert.equal((destination as { route: "PLAYER_PROFILE"; playerId: string }).playerId, "p-holmgren");
});
