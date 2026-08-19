import type { FastMatchResult } from "@handball-manager/game-simulation";
import type { InboxMessage } from "../game-data";

export type CareerFixture = {
  id: string;
  competitionId: string;
  round: number;
  date: string; // ISO date
  homeClubId: string;
  awayClubId: string;
};

export type ClubFormEntry = "W" | "D" | "L";

export type PlayerSeasonStats = {
  playerId: string;
  appearances: number;
  starts: number;
  goals: number;
  shots: number;
  /** Goalkeepers only. */
  saves: number;
  shotsFaced: number;
  ratingSum: number;
};

export function emptyPlayerSeasonStats(playerId: string): PlayerSeasonStats {
  return { playerId, appearances: 0, starts: 0, goals: 0, shots: 0, saves: 0, shotsFaced: 0, ratingSum: 0 };
}

export function averageRating(stats: PlayerSeasonStats): number {
  return stats.appearances > 0 ? Math.round((stats.ratingSum / stats.appearances) * 10) / 10 : 0;
}

/**
 * The authoritative, mutable per-save career/world state. Owns
 * everything HM-GAME-0.2A's simulated Allsvenskan season needs; static
 * mock modules under lib/game-data only ever SEED a new career (see
 * newCareer.ts) and are never mutated themselves.
 */
export type CareerState = {
  seasonId: string; // e.g. "2026/27"
  competitionId: string; // "swe-2" -- the one fully-simulated competition this pass
  playerClubId: string;
  gameDate: string; // ISO date
  seasonComplete: boolean;
  /** The save's own deterministic seed -- match seeds derive from `${saveSeed}:${fixtureId}` (see game-simulation's season.ts). */
  saveSeed: string;
  fixtures: readonly CareerFixture[];
  /** Keyed by fixtureId. Only fixtures with a stored result have been played. */
  results: Record<string, FastMatchResult>;
  /** Keyed by playerId -- IFK Tumba's own squad only (see Section 9 scope note). */
  playerSeasonStats: Record<string, PlayerSeasonStats>;
  /** Keyed by clubId, most recent result last, capped at 5 entries. */
  clubForm: Record<string, ClubFormEntry[]>;
  inbox: InboxMessage[];
};

export type CareerSaveEnvelope = {
  schemaVersion: 2;
  career: CareerState;
};
