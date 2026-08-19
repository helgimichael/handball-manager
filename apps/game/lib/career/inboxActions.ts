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
