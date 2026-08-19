import type { MatchEvent } from "@handball-manager/game-simulation";
import { getPlayer } from "../game-data";

function playerLabel(playerId: string | undefined): string {
  if (!playerId) {
    return "";
  }
  const player = getPlayer(playerId);
  return player ? `${player.firstName[0]}. ${player.lastName}` : "";
}

/** Renders one MatchEvent as classic CM-style Swedish handball commentary text. */
export function describeEvent(event: MatchEvent, homeName: string, awayName: string): string {
  const teamName = event.side === "home" ? homeName : awayName;
  const scorer = playerLabel(event.playerId);

  switch (event.type) {
    case "GOAL":
      return scorer ? `${teamName} — mål, ${scorer} (${event.homeScoreAfter}–${event.awayScoreAfter})` : `${teamName} — mål (${event.homeScoreAfter}–${event.awayScoreAfter})`;
    case "SAVE":
      return `Räddning, ${teamName}`;
    case "MISS":
      return `${teamName} skjuter utanför`;
    case "TURNOVER":
      return `Tekniskt fel, ${teamName}`;
    case "TWO_MIN":
      return `2 minuter, ${teamName}`;
    case "SEVEN_M":
      return `Straffkast, ${teamName}`;
    default:
      return `${teamName}`;
  }
}
