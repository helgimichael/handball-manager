import type { EventDestination } from "./careerEvents";

/**
 * Resolves a typed EventDestination (Spec S15) to a real Next.js route.
 * Every route below now has a live screen (HM-GAME-0.4 wired the four
 * ANALYSIS_* destinations into HM-ANALYSIS-0.1's Analysis Hub) --
 * `null` is kept as the general "no live screen yet" contract for any
 * future reserved destination, so callers must still never render a
 * button for a `null` result.
 */
export function resolveDestinationHref(destination: EventDestination): string | null {
  switch (destination.route) {
    case "HOME":
      return "/career";
    case "INBOX":
      return "/career/inbox";
    case "PLAYER_PROFILE":
      return `/career/squad/${destination.playerId}`;
    case "SQUAD":
      return "/career/squad";
    case "TACTICS":
      return "/career/tactics";
    case "TRAINING":
      return "/career/training";
    case "SCHEDULE":
      return "/career/schedule";
    case "MATCH_PREVIEW":
      return "/career/match-preview";
    case "MATCH_DAY":
      return `/career/match-day/${destination.fixtureId}`;
    case "MATCH_REPORT":
      return `/career/match-report/${destination.fixtureId}`;
    case "SCOUTING":
      return "/career/scouting";
    case "SCOUT_REPORT":
      // No dedicated scout-report detail route exists yet -- the closest
      // real, live screen is the Scouting list itself.
      return "/career/scouting";
    case "COMPETITION":
      return "/career/competitions";
    case "CLUB":
      return "/career/club";
    case "ANALYSIS_OVERVIEW":
      return "/career/analysis";
    case "ANALYSIS_OPPONENT":
      return "/career/analysis/opponent";
    case "ANALYSIS_OUR_TEAM":
      return "/career/analysis/our-team";
    case "ANALYSIS_LAST_MATCH":
      return "/career/analysis/last-match";
    default:
      return null;
  }
}

export function destinationLabel(destination: EventDestination): string {
  switch (destination.route) {
    case "HOME":
      return "Öppna hem";
    case "INBOX":
      return "Öppna inkorg";
    case "PLAYER_PROFILE":
      return "Öppna spelare";
    case "SQUAD":
      return "Öppna trupp";
    case "TACTICS":
      return "Öppna taktik";
    case "TRAINING":
      return "Öppna träning";
    case "SCHEDULE":
      return "Öppna schema";
    case "MATCH_PREVIEW":
      return "Öppna matchförhandsvisning";
    case "MATCH_DAY":
      return "Öppna matchdag";
    case "MATCH_REPORT":
      return "Öppna matchrapport";
    case "SCOUTING":
      return "Öppna scouting";
    case "SCOUT_REPORT":
      return "Öppna rapport";
    case "COMPETITION":
      return "Öppna tabell";
    case "CLUB":
      return "Öppna klubb";
    case "ANALYSIS_OVERVIEW":
      return "Öppna analys";
    case "ANALYSIS_OPPONENT":
      return "Öppna motståndaranalys";
    case "ANALYSIS_OUR_TEAM":
      return "Öppna laganalys";
    case "ANALYSIS_LAST_MATCH":
      return "Öppna matchanalys";
    default:
      return "Öppna";
  }
}
