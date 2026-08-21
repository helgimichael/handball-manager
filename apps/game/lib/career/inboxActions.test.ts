import { test } from "node:test";
import assert from "node:assert/strict";
import { TUMBA_CLUB_ID } from "../game-data";
import { archiveMessage, markMessageRead, unarchiveMessage } from "./inboxActions";
import { createNewCareerState } from "./newCareer";
import type { CareerState } from "./types";
import type { InboxMessage } from "../game-data";

function message(overrides: Partial<InboxMessage>): InboxMessage {
  return {
    id: "msg:1",
    category: "MATCH",
    sender: "Assisterande tränare",
    subject: "Test",
    preview: "Test",
    body: ["Test"],
    date: "2026-08-20",
    read: false,
    important: false,
    archived: false,
    resolved: true,
    ...overrides,
  };
}

function stateWith(messages: InboxMessage[]): CareerState {
  const base = createNewCareerState("inbox-actions-seed", TUMBA_CLUB_ID);
  return { ...base, inbox: messages };
}

test("a new message starts unread", () => {
  const m = message({});
  assert.equal(m.read, false);
});

test("markMessageRead marks only the targeted message read, leaving others untouched", () => {
  const state = stateWith([message({ id: "a" }), message({ id: "b" })]);
  const next = markMessageRead(state, "a");
  assert.equal(next.inbox.find((m) => m.id === "a")!.read, true);
  assert.equal(next.inbox.find((m) => m.id === "b")!.read, false);
});

test("markMessageRead is a no-op (same state reference) for an already-read message or unknown id", () => {
  const state = stateWith([message({ id: "a", read: true })]);
  assert.equal(markMessageRead(state, "a"), state);
  assert.equal(markMessageRead(state, "does-not-exist"), state);
});

test("markMessageRead also marks the linked CareerEvent read when careerEventId is present", () => {
  const base = createNewCareerState("inbox-actions-seed-2", TUMBA_CLUB_ID);
  const event = base.careerEvents[0] ?? { id: "evt:1", type: "CLUB_NEWS" as const, date: "2026-08-19", priority: "INFORMATION" as const, subject: "x", summary: "x", relatedEntities: [], destinations: [], requiresAction: false, resolved: true, read: false, createdAtGameDate: "2026-08-19" };
  const state: CareerState = { ...base, careerEvents: [event], inbox: [message({ id: "a", careerEventId: event.id })] };
  const next = markMessageRead(state, "a");
  assert.equal(next.careerEvents.find((e) => e.id === event.id)!.read, true);
});

test("an active resolved message can be archived", () => {
  const state = stateWith([message({ id: "a", archived: false, resolved: true })]);
  const next = archiveMessage(state, "a");
  assert.equal(next.inbox[0].archived, true);
});

test("archiving refuses an unresolved ACTION_REQUIRED message -- state reference is unchanged", () => {
  const state = stateWith([message({ id: "a", actionRequired: true, resolved: false })]);
  const next = archiveMessage(state, "a");
  assert.equal(next, state);
  assert.equal(next.inbox[0].archived, false);
});

test("archiving an already-resolved ACTION_REQUIRED message succeeds", () => {
  const state = stateWith([message({ id: "a", actionRequired: true, resolved: true })]);
  const next = archiveMessage(state, "a");
  assert.equal(next.inbox[0].archived, true);
});

test("unarchiveMessage restores a message to active, and is a no-op for an already-active one", () => {
  const state = stateWith([message({ id: "a", archived: true })]);
  const next = unarchiveMessage(state, "a");
  assert.equal(next.inbox[0].archived, false);

  const alreadyActive = stateWith([message({ id: "a", archived: false })]);
  assert.equal(unarchiveMessage(alreadyActive, "a"), alreadyActive);
});

test("archiving does not change unread state or provenance (careerEventId)", () => {
  const state = stateWith([message({ id: "a", read: false, careerEventId: "evt:x" })]);
  const next = archiveMessage(state, "a");
  assert.equal(next.inbox[0].read, false);
  assert.equal(next.inbox[0].careerEventId, "evt:x");
});
