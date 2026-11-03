import type { CSSProperties } from "react";
import type { Club, Player } from "@/lib/game-data/types";
import { getClub } from "@/lib/game-data";
import { PlayerLink } from "@/components/entityLinks";
import { NationFlag } from "./NationFlag";

export function clubColorVars(club: Pick<Club, "primaryColor" | "secondaryColor"> | undefined): CSSProperties {
  return {
    "--club-primary": club?.primaryColor || "#1a3c6e",
    "--club-secondary": club?.secondaryColor || "#e2b13c",
  } as CSSProperties;
}

export function JerseyGlyph({
  number,
  primary = "#1a3c6e",
  secondary = "#ffffff",
  goalkeeper = false,
}: {
  number?: number | string;
  primary?: string;
  secondary?: string;
  goalkeeper?: boolean;
}) {
  const body = goalkeeper ? "#d49a2a" : primary;
  const trim = goalkeeper ? "#121d31" : secondary;
  return (
    <span className="game-jersey-glyph" aria-hidden="true">
      <svg viewBox="0 0 36 34">
        <path
          d="M9 4l5-2h8l5 2 6 6-4 5-3-2v17H10V13l-3 2-4-5 6-6z"
          fill={body}
          stroke="#11161d"
          strokeWidth="1.5"
        />
        <path d="M14 2c1.2 2.4 6.8 2.4 8 0" fill="none" stroke={trim} strokeWidth="2" />
        <path d="M10 26h16" stroke={trim} strokeWidth="2" opacity=".75" />
        {number !== undefined && (
          <text
            x="18"
            y="22"
            textAnchor="middle"
            fill={body === "#ffffff" || body === "#e2b13c" ? "#11161d" : "#ffffff"}
            fontSize="11"
            fontWeight="800"
          >
            {number}
          </text>
        )}
      </svg>
    </span>
  );
}

export function PlayerCell({
  player,
  jerseyNumber,
}: {
  player: Pick<Player, "id" | "firstName" | "lastName" | "position" | "clubId" | "nationality">;
  jerseyNumber?: number;
}) {
  const club = getClub(player.clubId);
  const showFlag = Boolean(player.nationality && player.nationality !== "UNK");
  return (
    <span className="game-player-cell">
      <JerseyGlyph
        number={jerseyNumber}
        primary={club?.primaryColor}
        secondary={club?.secondaryColor}
        goalkeeper={player.position === "MV"}
      />
      <span className="game-player-cell-name">
        <PlayerLink playerId={player.id}>
          {player.firstName} {player.lastName}
        </PlayerLink>
        {showFlag && <NationFlag code={player.nationality} />}
      </span>
    </span>
  );
}
