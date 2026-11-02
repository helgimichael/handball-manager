// HM-ALPHA3-M07: events raised by a manager action outside the daily tick
// (accepting a job, the season close at rollover) go into the event log and
// the inbox exactly like tick events, deduplicated by id.
import type { CareerEvent } from "../career/careerEvents";
import { careerEventToInboxMessage } from "../career/inboxBridge";
import type { CareerState } from "../career/types";

export function withEvents(state: CareerState, events: CareerEvent[]): CareerState {
  let next = state;
  for (const e of events) {
    if (next.careerEvents.some((x) => x.id === e.id)) continue;
    next = { ...next, careerEvents: [...next.careerEvents, e], inbox: [...next.inbox, careerEventToInboxMessage(e, next)] };
  }
  return next;
}
