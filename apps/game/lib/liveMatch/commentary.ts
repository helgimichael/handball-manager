// Live match commentary (HM-MATCH-0.1, Spec S8/S9).
//
// Template-based Swedish handball commentary -- deliberately not prose
// generation. No tactical-domain vocabulary (ATI-001/H2/H3) belongs
// here yet; only what the Fast Match Engine's timeline genuinely
// generated (Spec S22). Template selection is deterministic (derived
// from the event's own minute/type, not Math.random), so the same
// FastMatchResult always renders the same commentary feed.
import type { MatchEvent } from "@handball-manager/game-simulation";
import { getPlayer, type PlayerMock } from "../game-data";

function playerLabel(playerId: string | undefined, lookupPlayer: (id: string) => PlayerMock | undefined): string | undefined {
  if (!playerId) return undefined;
  const player = lookupPlayer(playerId);
  return player ? `${player.firstName[0]}. ${player.lastName}` : undefined;
}

function pick<T>(templates: readonly T[], salt: number): T {
  return templates[Math.abs(salt) % templates.length];
}

/**
 * `lookupPlayer` defaults to the legacy zero-argument mock accessor for
 * backward compatibility; callers with a live CareerState should pass
 * `(id) => getCareerPlayer(career, id)` (HM-DATA-0.2) so commentary uses
 * real imported names for a real-world club's own goals, exactly like
 * every other player-identity lookup in the app.
 */
export function commentaryLine(
  event: MatchEvent,
  homeName: string,
  awayName: string,
  lookupPlayer: (id: string) => PlayerMock | undefined = getPlayer,
): string {
  const team = event.side === "home" ? homeName : awayName;
  const scorer = playerLabel(event.playerId, lookupPlayer);
  const salt = event.minute * 7 + (event.playerId ? event.playerId.length : 0);

  switch (event.type) {
    case "GOAL": {
      const score = `(${event.homeScoreAfter}–${event.awayScoreAfter})`;
      const templates = scorer
        ? [
            `MÅL — ${team}: ${scorer} gör mål ${score}`,
            `${scorer} avslutar och hittar nätet — ${team} ${score}`,
            `${scorer} skjuter in det för ${team} ${score}`,
          ]
        : [`MÅL — ${team} ${score}`, `${team} nätar ${score}`];
      return pick(templates, salt);
    }
    case "SAVE": {
      const templates = [`RÄDDNING — ${team}`, `${team}s målvakt stoppar avslutet`, `Fin räddning av ${team}`];
      return pick(templates, salt);
    }
    case "MISS": {
      const templates = [`${team} skjuter utanför`, `Missat avslut, ${team}`, `${team} hittar inte målet den här gången`];
      return pick(templates, salt);
    }
    case "TURNOVER": {
      const templates = [`Tekniskt fel — ${team}`, `${team} tappar bollen`, `Boll förlorad, ${team}`];
      return pick(templates, salt);
    }
    case "TWO_MIN": {
      const templates = [`2 MIN — ${team}`, `Utvisning för ${team}`, `${team} får två minuter`];
      return pick(templates, salt);
    }
    case "SEVEN_M": {
      if (event.sevenMetreOutcome === "GOAL") {
        return pick([`7M — MÅL för ${team}`, `${team} sätter straffen`], salt);
      }
      if (event.sevenMetreOutcome === "MISS") {
        return pick([`7M — räddat mot ${team}`, `${team} missar straffen`], salt);
      }
      return `7M — ${team}`;
    }
    default:
      return team;
  }
}

/** Formats a match minute as classic mm:00 running-clock text. */
export function formatMatchMinute(minute: number): string {
  return `${String(minute).padStart(2, "0")}:00`;
}
