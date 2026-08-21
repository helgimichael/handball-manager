// Pure Inbox mutation actions (HM-GAME-0.3), kept separate from
// CareerContext.tsx so they are unit-testable without a browser/React
// environment.

import type { CareerState } from "./types";

/** Marks one Inbox message read, and (if it was generated from a CareerEvent) the linked event too. No-ops if already read or the message id is unknown. */
export function markMessageRead(state: CareerState, messageId: string): CareerState {
  const message = state.inbox.find((m) => m.id === messageId);
  if (!message || message.read) {
    return state;
  }
  const inbox = state.inbox.map((m) => (m.id === messageId ? { ...m, read: true } : m));
  const careerEvents = message.careerEventId
    ? state.careerEvents.map((e) => (e.id === message.careerEventId ? { ...e, read: true } : e))
    : state.careerEvents;
  return { ...state, inbox, careerEvents };
}

/**
 * Archives one message (Spec §7). Refuses (no-ops, same state reference)
 * for an unresolved ACTION_REQUIRED message -- archiving must never hide
 * a blocking game requirement (Spec §25). Callers that need to know
 * whether the archive actually happened should compare the returned
 * state by reference, matching this module's existing no-op convention.
 */
export function archiveMessage(state: CareerState, messageId: string): CareerState {
  const message = state.inbox.find((m) => m.id === messageId);
  if (!message || message.archived) {
    return state;
  }
  if (message.actionRequired && !message.resolved) {
    return state;
  }
  return { ...state, inbox: state.inbox.map((m) => (m.id === messageId ? { ...m, archived: true } : m)) };
}

/** Restores one archived message back to the active Inbox. No-ops if it wasn't archived or the id is unknown. */
export function unarchiveMessage(state: CareerState, messageId: string): CareerState {
  const message = state.inbox.find((m) => m.id === messageId);
  if (!message || !message.archived) {
    return state;
  }
  return { ...state, inbox: state.inbox.map((m) => (m.id === messageId ? { ...m, archived: false } : m)) };
}
