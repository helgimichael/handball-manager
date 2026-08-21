// Season-complete Inbox message (HM-GAME-0.3, extended HM-GAME-0.4).
//
// The one Inbox message not built from a CareerEvent -- season
// completion is detected structurally (calendar.ts's checkSeasonComplete,
// "every fixture now has a result"), not modeled as its own event type.
// Kept isolated here for the same reason inboxBridge.ts exists: a single,
// easy-to-audit place that turns world state into presentation text.
import { COMPETITIONS } from "../game-data";
import type { InboxMessage } from "../game-data";

let messageCounter = 0;
function nextMessageId(): string {
  messageCounter += 1;
  return `career-msg-${messageCounter}`;
}

export function buildSeasonCompleteMessage(finalPosition: number, seasonId: string, competitionId: string): InboxMessage {
  const competitionName = COMPETITIONS.find((c) => c.id === competitionId)?.name ?? "ligan";
  return {
    id: nextMessageId(),
    category: "COMPETITION",
    sender: "Klubbstyrelsen",
    subject: `Säsongen ${seasonId} är avslutad`,
    preview: `Slutplacering: ${finalPosition}:a plats i ${competitionName}.`,
    body: [
      `${competitionName}-säsongen ${seasonId} är nu avslutad. Laget slutade på ${finalPosition}:a plats.`,
      "Tack för en genomförd säsong. Fler funktioner för säsongsavslut kommer i en senare version.",
    ],
    date: "",
    read: false,
    important: true,
    archived: false,
    resolved: true,
  };
}
