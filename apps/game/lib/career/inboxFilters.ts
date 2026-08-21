// Inbox filter predicates (HM-GAME-0.4, Spec §8). Pure and UI-free so
// they're directly unit-testable; app/career/inbox/page.tsx is the only
// consumer.
import type { InboxMessage } from "../game-data";

export type InboxFilterId = "ALL" | "UNREAD" | "ACTION_REQUIRED" | "ANALYSIS" | "SCOUTING" | "STAFF" | "ARCHIVED";

export const INBOX_FILTERS: { id: InboxFilterId; label: string }[] = [
  { id: "ALL", label: "Alla" },
  { id: "UNREAD", label: "Olästa" },
  { id: "ACTION_REQUIRED", label: "Åtgärd krävs" },
  { id: "ANALYSIS", label: "Analys" },
  { id: "SCOUTING", label: "Scouting" },
  { id: "STAFF", label: "Tränarstab" },
  { id: "ARCHIVED", label: "Arkiverat" },
];

/** Every filter except ARCHIVED implicitly excludes archived messages (Spec §7: "disappear from default Inbox"). */
export function matchesInboxFilter(message: InboxMessage, filter: InboxFilterId): boolean {
  switch (filter) {
    case "ALL":
      return !message.archived;
    case "UNREAD":
      return !message.archived && !message.read;
    case "ACTION_REQUIRED":
      return !message.archived && Boolean(message.actionRequired) && !message.resolved;
    case "ANALYSIS":
      return !message.archived && message.category === "ANALYSIS";
    case "SCOUTING":
      return !message.archived && message.category === "SCOUTING";
    case "STAFF":
      return !message.archived && message.category === "STAFF";
    case "ARCHIVED":
      return message.archived;
  }
}

export function filterInboxMessages(messages: readonly InboxMessage[], filter: InboxFilterId): InboxMessage[] {
  return messages.filter((m) => matchesInboxFilter(m, filter));
}
