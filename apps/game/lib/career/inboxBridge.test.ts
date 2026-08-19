import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMatchdayReadyEvent, buildTrainingCompletedEvent } from "./careerEvents";
import { careerEventToInboxMessage } from "./inboxBridge";

test("careerEventToInboxMessage renders semantic event data into a presentable message with a stable, linked id", () => {
  const event = buildMatchdayReadyEvent("fx-1", "2026-08-22");
  const message = careerEventToInboxMessage(event);

  assert.equal(message.id, `msg:${event.id}`);
  assert.equal(message.careerEventId, event.id);
  assert.equal(message.priority, "ACTION_REQUIRED");
  assert.equal(message.actionRequired, true);
  assert.equal(message.read, false);
  assert.ok(message.body.length > 0);
  assert.deepEqual(message.destinations, event.destinations);
});

test("TRAINING_COMPLETED never needs a message rendered for it (dailyTick already suppresses it, but the bridge itself remains capable)", () => {
  const event = buildTrainingCompletedEvent("2026-08-20");
  const message = careerEventToInboxMessage(event);
  // The bridge can render it if asked -- dailyTick.ts is the layer that
  // chooses not to call this for TRAINING_COMPLETED (Spec S4.1).
  assert.equal(message.important, false);
});
