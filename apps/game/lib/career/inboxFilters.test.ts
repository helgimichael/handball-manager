import { test } from "node:test";
import assert from "node:assert/strict";
import { filterInboxMessages, INBOX_FILTERS } from "./inboxFilters";
import type { InboxMessage } from "../game-data";

function message(overrides: Partial<InboxMessage>): InboxMessage {
  return {
    id: "m",
    category: "MATCH",
    sender: "x",
    subject: "x",
    preview: "x",
    body: ["x"],
    date: "2026-08-20",
    read: false,
    important: false,
    archived: false,
    resolved: true,
    ...overrides,
  };
}

const FIXTURE: InboxMessage[] = [
  message({ id: "read-match", category: "MATCH", read: true }),
  message({ id: "unread-analysis", category: "ANALYSIS", read: false }),
  message({ id: "unread-scouting", category: "SCOUTING", read: false }),
  message({ id: "unread-staff", category: "STAFF", read: false }),
  message({ id: "action-required-open", category: "MATCH", actionRequired: true, resolved: false }),
  message({ id: "action-required-resolved", category: "MATCH", actionRequired: true, resolved: true }),
  message({ id: "archived-one", category: "MATCH", archived: true }),
];

test("ALL returns every non-archived message", () => {
  const result = filterInboxMessages(FIXTURE, "ALL").map((m) => m.id);
  assert.deepEqual(result.sort(), ["read-match", "unread-analysis", "unread-scouting", "unread-staff", "action-required-open", "action-required-resolved"].sort());
});

test("UNREAD returns only unread, non-archived messages", () => {
  const result = filterInboxMessages(FIXTURE, "UNREAD").map((m) => m.id);
  assert.deepEqual(result.sort(), ["unread-analysis", "unread-scouting", "unread-staff", "action-required-open", "action-required-resolved"].sort());
});

test("ACTION_REQUIRED returns only unresolved action-required, non-archived messages", () => {
  const result = filterInboxMessages(FIXTURE, "ACTION_REQUIRED").map((m) => m.id);
  assert.deepEqual(result, ["action-required-open"]);
});

test("ANALYSIS/SCOUTING/STAFF each return exactly their category, excluding archived", () => {
  assert.deepEqual(filterInboxMessages(FIXTURE, "ANALYSIS").map((m) => m.id), ["unread-analysis"]);
  assert.deepEqual(filterInboxMessages(FIXTURE, "SCOUTING").map((m) => m.id), ["unread-scouting"]);
  assert.deepEqual(filterInboxMessages(FIXTURE, "STAFF").map((m) => m.id), ["unread-staff"]);
});

test("ARCHIVED returns only archived messages", () => {
  assert.deepEqual(filterInboxMessages(FIXTURE, "ARCHIVED").map((m) => m.id), ["archived-one"]);
});

test("every declared filter id is handled (no filter silently returns everything)", () => {
  for (const f of INBOX_FILTERS) {
    const result = filterInboxMessages(FIXTURE, f.id);
    assert.ok(Array.isArray(result));
  }
});

test("an archived unread message is excluded from UNREAD -- archive state affects filter membership correctly", () => {
  const archivedUnread = [message({ id: "x", read: false, archived: true })];
  assert.deepEqual(filterInboxMessages(archivedUnread, "UNREAD"), []);
  assert.deepEqual(filterInboxMessages(archivedUnread, "ARCHIVED").map((m) => m.id), ["x"]);
});
