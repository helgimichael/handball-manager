// Career Event -> Inbox Message bridge (HM-GAME-0.3, extended HM-GAME-0.4).
//
//   WORLD STATE CHANGE -> CAREER EVENT -> INBOX MESSAGE
//
// This is the ONLY producer of InboxMessages from CareerEvents. It must
// not invent world changes -- it purely renders semantic event data
// (Spec S14) into presentation text/category, reading the REST of its
// context from the live CareerState passed in (HM-GAME-0.4: this is
// what lets message bodies use the actual imported player/club identity
// for a real Handbollsligan career, instead of the old zero-argument
// Tumba-hardcoded accessors -- Spec §16 "no Tumba assumptions").
// TRAINING_COMPLETED deliberately produces no message (Spec S4.1: "does
// not need a separate Inbox message every day"); it stays in
// careerEvents as domain state.

import { getClub, type InboxCategory, type InboxMessage } from "../game-data";
import { getCareerPlayer } from "./careerWorld";
import { getLastPlayedPlayerFixture, getNextPlayerFixture } from "./calendar";
import { getLiveStandings } from "./standings";
import type { CareerEvent } from "./careerEvents";
import type { CareerState } from "./types";

const CATEGORY_BY_TYPE: Record<CareerEvent["type"], InboxCategory> = {
  TRAINING_COMPLETED: "STAFF",
  TRAINING_REPORT: "STAFF",
  PLAYER_STATUS_CHANGED: "MEDICAL",
  PLAYER_INJURED: "MEDICAL",
  SCOUT_REPORT_READY: "SCOUTING",
  SCOUT_DISCOVERY_READY: "SCOUTING",
  OPPONENT_REPORT_READY: "ANALYSIS",
  MATCH_PREPARATION_READY: "MATCH",
  MATCHDAY_READY: "MATCH",
  MATCH_COMPLETED: "MATCH",
  COMPETITION_UPDATE: "COMPETITION",
  STAFF_REPORT: "STAFF",
  CLUB_NEWS: "CLUB",
};

/** Swedish display label for a category -- the same pattern as game-data/players.ts's positionLabel(). */
export function categoryLabel(category: InboxCategory): string {
  switch (category) {
    case "MATCH":
      return "Match";
    case "ANALYSIS":
      return "Analys";
    case "SCOUTING":
      return "Scouting";
    case "STAFF":
      return "Tränarstab";
    case "MEDICAL":
      return "Medicinskt";
    case "PLAYER":
      return "Spelare";
    case "COMPETITION":
      return "Tävling";
    case "CLUB":
      return "Klubb";
    case "SYSTEM":
      return "System";
  }
}

const SENDER_BY_TYPE: Record<CareerEvent["type"], string> = {
  TRAINING_COMPLETED: "Tränarstaben",
  TRAINING_REPORT: "Fystränare",
  PLAYER_STATUS_CHANGED: "Läkare",
  PLAYER_INJURED: "Läkare",
  SCOUT_REPORT_READY: "Huvudscout",
  SCOUT_DISCOVERY_READY: "Huvudscout",
  OPPONENT_REPORT_READY: "Analysteam",
  MATCH_PREPARATION_READY: "Assisterande tränare",
  MATCHDAY_READY: "Assisterande tränare",
  MATCH_COMPLETED: "Assisterande tränare",
  COMPETITION_UPDATE: "Tävlingsledningen",
  STAFF_REPORT: "Tränarstaben",
  CLUB_NEWS: "Klubbstyrelsen",
};

function playerName(career: CareerState, playerId: string | undefined): string {
  if (!playerId) return "Spelaren";
  const player = getCareerPlayer(career, playerId);
  return player ? `${player.firstName} ${player.lastName}` : "Spelaren";
}

function bodyFor(event: CareerEvent, career: CareerState): string[] {
  switch (event.type) {
    case "PLAYER_STATUS_CHANGED":
    case "PLAYER_INJURED": {
      const name = playerName(career, event.primaryEntity?.entityId);
      return [event.summary, `${name} berörs av förändringen.`];
    }
    case "SCOUT_REPORT_READY": {
      const name = playerName(career, event.primaryEntity?.entityId);
      return [event.summary, `Rapporten gäller ${name}.`];
    }
    case "OPPONENT_REPORT_READY": {
      const club = event.primaryEntity ? getClub(event.primaryEntity.entityId) : undefined;
      return [event.summary, club ? `Nästa motståndare: ${club.name}. Se motståndaranalysen för detaljer.` : ""].filter(Boolean);
    }
    case "MATCH_PREPARATION_READY": {
      const next = getNextPlayerFixture(career);
      const opponentId = next ? (next.homeClubId === career.playerClubId ? next.awayClubId : next.homeClubId) : undefined;
      const opponent = opponentId ? getClub(opponentId) : undefined;
      return [event.summary, opponent ? `Förberedelserna inför ${opponent.name} är klara -- se förhandsvisning, motståndaranalys och taktik.` : ""].filter(Boolean);
    }
    case "MATCHDAY_READY":
      return [event.summary, "Gå till matchförhandsvisningen för att spela eller simulera matchen."];
    case "MATCH_COMPLETED": {
      const result = career.results[event.primaryEntity?.entityId ?? ""];
      if (!result) return [event.summary];
      return [event.summary, `Slutresultat ${result.homeGoals}–${result.awayGoals}. Se matchrapporten eller den detaljerade matchanalysen.`];
    }
    case "COMPETITION_UPDATE": {
      const table = getLiveStandings(career);
      const position = table.findIndex((row) => row.clubId === career.playerClubId) + 1;
      return position > 0 ? [event.summary, `Er placering: ${position}:a plats.`] : [event.summary];
    }
    case "STAFF_REPORT":
      return staffReportBody(career);
    default:
      return [event.summary];
  }
}

/**
 * A deterministic, template-based digest of already-known career facts
 * (Spec §19: "keep it deterministic/template-based", never invented AI
 * staff advice) -- next fixture, squad availability, most recent result,
 * and unread key items.
 */
function staffReportBody(career: CareerState): string[] {
  const lines: string[] = [];
  const next = getNextPlayerFixture(career);
  if (next) {
    const opponentId = next.homeClubId === career.playerClubId ? next.awayClubId : next.homeClubId;
    const opponent = getClub(opponentId);
    lines.push(`Nästa match: ${opponent?.name ?? opponentId} (${next.date}).`);
  } else {
    lines.push("Ingen kommande match schemalagd.");
  }

  const unavailable = Object.values(career.playerStatuses).filter((s) => s.availability !== "AVAILABLE").length;
  lines.push(unavailable > 0 ? `${unavailable} spelare otillgängliga för tillfället.` : "Hela truppen tillgänglig.");

  const lastPlayed = getLastPlayedPlayerFixture(career);
  if (lastPlayed) {
    const isHome = lastPlayed.fixture.homeClubId === career.playerClubId;
    const own = isHome ? lastPlayed.result.homeGoals : lastPlayed.result.awayGoals;
    const opp = isHome ? lastPlayed.result.awayGoals : lastPlayed.result.homeGoals;
    lines.push(`Senaste resultat: ${own}–${opp}.`);
  }

  const unresolvedActionCount = career.careerEvents.filter((e) => e.priority === "ACTION_REQUIRED" && !e.resolved).length;
  const unreadImportant = career.inbox.filter((m) => !m.read && (m.priority === "IMPORTANT" || m.priority === "ACTION_REQUIRED") && !m.archived).length;
  if (unresolvedActionCount > 0 || unreadImportant > 0) {
    lines.push(`Olästa viktiga meddelanden: ${unreadImportant}.`);
  }

  return lines;
}

export function careerEventToInboxMessage(event: CareerEvent, career: CareerState): InboxMessage {
  return {
    id: `msg:${event.id}`,
    category: CATEGORY_BY_TYPE[event.type],
    sender: SENDER_BY_TYPE[event.type],
    subject: event.subject,
    preview: event.summary,
    body: bodyFor(event, career),
    date: event.date,
    read: false,
    important: event.priority !== "INFORMATION",
    archived: false,
    resolved: event.resolved,
    careerEventId: event.id,
    priority: event.priority,
    actionRequired: event.requiresAction,
    destinations: event.destinations,
  };
}
