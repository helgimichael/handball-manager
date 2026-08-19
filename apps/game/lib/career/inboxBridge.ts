// Career Event -> Inbox Message bridge (HM-GAME-0.3, Spec S28).
//
//   WORLD STATE CHANGE -> CAREER EVENT -> INBOX MESSAGE
//
// This is the ONLY producer of InboxMessages from CareerEvents. It must
// not invent world changes -- it purely renders semantic event data
// (Spec S14) into presentation text/category. TRAINING_COMPLETED
// deliberately produces no message (Spec S4.1: "does not need a separate
// Inbox message every day"); it stays in careerEvents as domain state.

import { getClub, getPlayer, type InboxCategory, type InboxMessage } from "../game-data";
import type { CareerEvent } from "./careerEvents";

const CATEGORY_BY_TYPE: Partial<Record<CareerEvent["type"], InboxCategory>> = {
  TRAINING_REPORT: "Träning",
  PLAYER_STATUS_CHANGED: "Spelare",
  PLAYER_INJURED: "Spelare",
  SCOUT_REPORT_READY: "Scouting",
  OPPONENT_REPORT_READY: "Assisterande tränare",
  MATCH_PREPARATION_READY: "Assisterande tränare",
  MATCHDAY_READY: "Match",
  MATCH_COMPLETED: "Match",
  COMPETITION_UPDATE: "Match",
  STAFF_REPORT: "Assisterande tränare",
  CLUB_NEWS: "Styrelse",
};

const SENDER_BY_TYPE: Partial<Record<CareerEvent["type"], string>> = {
  TRAINING_REPORT: "Fystränare",
  PLAYER_STATUS_CHANGED: "Läkare",
  PLAYER_INJURED: "Läkare",
  SCOUT_REPORT_READY: "Huvudscout",
  OPPONENT_REPORT_READY: "Assisterande tränare",
  MATCH_PREPARATION_READY: "Assisterande tränare",
  MATCHDAY_READY: "Assisterande tränare",
  MATCH_COMPLETED: "Assisterande tränare",
  COMPETITION_UPDATE: "Allsvenskan",
  STAFF_REPORT: "Tränarstaben",
  CLUB_NEWS: "Klubbstyrelsen",
};

function bodyFor(event: CareerEvent): string[] {
  switch (event.type) {
    case "PLAYER_STATUS_CHANGED":
    case "PLAYER_INJURED": {
      const player = event.primaryEntity ? getPlayer(event.primaryEntity.entityId) : undefined;
      const name = player ? `${player.firstName} ${player.lastName}` : "Spelaren";
      return [event.summary, `${name} berörs av förändringen.`];
    }
    case "SCOUT_REPORT_READY": {
      const player = event.primaryEntity ? getPlayer(event.primaryEntity.entityId) : undefined;
      return [event.summary, player ? `Rapporten gäller ${player.firstName} ${player.lastName}.` : ""].filter(Boolean);
    }
    case "OPPONENT_REPORT_READY": {
      const club = event.primaryEntity ? getClub(event.primaryEntity.entityId) : undefined;
      return [event.summary, club ? `Nästa motståndare: ${club.name}.` : ""].filter(Boolean);
    }
    case "MATCHDAY_READY":
      return [event.summary, "Gå till matchförhandsvisningen för att spela eller simulera matchen."];
    case "MATCH_COMPLETED":
      return [event.summary, "Se matchrapporten för detaljer."];
    case "COMPETITION_UPDATE":
      return [event.summary];
    default:
      return [event.summary];
  }
}

export function careerEventToInboxMessage(event: CareerEvent): InboxMessage {
  return {
    id: `msg:${event.id}`,
    category: CATEGORY_BY_TYPE[event.type] ?? "Assisterande tränare",
    sender: SENDER_BY_TYPE[event.type] ?? "Klubben",
    subject: event.subject,
    preview: event.summary,
    body: bodyFor(event),
    date: event.date,
    read: false,
    important: event.priority !== "INFORMATION",
    careerEventId: event.id,
    priority: event.priority,
    actionRequired: event.requiresAction,
    destinations: event.destinations,
  };
}
