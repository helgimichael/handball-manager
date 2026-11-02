// Season-complete Inbox message (HM-GAME-0.3, extended HM-GAME-0.4).
//
// The one Inbox message not built from a CareerEvent -- season
// completion is detected structurally (calendar.ts's checkSeasonComplete,
// "every fixture now has a result"), not modeled as its own event type.
// Kept isolated here for the same reason inboxBridge.ts exists: a single,
// easy-to-audit place that turns world state into presentation text.
import { COMPETITIONS } from "../game-data";
import type { InboxMessage } from "../game-data";
import { svOrdinal } from "../format/ordinal";

/** HM-ALPHA3-M01: one stable id per season. The former module-level counter restarted on every page load, so a later season's message could reuse an earlier one's id (shared React key; marking one read marked both). Saves that already hold `career-msg-N` ids keep them -- the new form can never collide with them. */
export function seasonCompleteMessageId(seasonId: string): string {
  return `season-complete:${seasonId}`;
}

export function buildSeasonCompleteMessage(finalPosition: number, seasonId: string, competitionId: string, date: string): InboxMessage {
  const competitionName = COMPETITIONS.find((c) => c.id === competitionId)?.name ?? "ligan";
  return {
    id: seasonCompleteMessageId(seasonId),
    category: "COMPETITION",
    sender: "Klubbstyrelsen",
    subject: `Säsongen ${seasonId} är avslutad`,
    preview: `Slutplacering: ${svOrdinal(finalPosition)} plats i ${competitionName}.`,
    body: [
      `${competitionName}-säsongen ${seasonId} är nu avslutad. Laget slutade på ${svOrdinal(finalPosition)} plats.`,
      "Tack för en genomförd säsong. Fler funktioner för säsongsavslut kommer i en senare version.",
    ],
    date,
    read: false,
    important: true,
    archived: false,
    resolved: true,
  };
}
