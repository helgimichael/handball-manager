// HM-ALPHA3-M03: knockout ties and the season's competitive outcome.
import type { SeriesFormat } from "./rules";

export type TieStage = "QF" | "SF" | "F" | "KVAL_HBL" | "KVAL_ALLSV" | "KVAL_DIV1" | "CUP_GROUP" | "CUP_R32" | "CUP_R16" | "CUP_QF" | "CUP_SF" | "CUP_F" | "CUP_3RD";

export interface CompetitionTie {
  id: string;
  seasonId: string;
  /** Existing planner stage authorizes this tie; no separate qualification bracket. */
  transition?: { ruleId: string; stageId: string };
  /** SM_SLUTSPEL / KVAL_HBL / KVAL_ALLSVENSKAN / SVENSKA_CUPEN from rules.ts. */
  competitionId: string;
  stage: TieStage;
  label: string;
  /** The higher-placed club (home advantage). */
  highClubId: string;
  lowClubId: string;
  format: { kind: "SERIES"; series: SeriesFormat } | { kind: "TWO_LEGS" } | { kind: "SINGLE" };
  /** Fixture ids in game order. */
  fixtureIds: string[];
  winnerClubId?: string;
  loserClubId?: string;
  /** Where the winner goes next (bracket position), if anywhere. */
  feeds?: { tieKey: string; slot: 0 | 1 };
  /** Stable bracket key, e.g. "QF1" -- what `feeds.tieKey` points at. */
  key: string;
  /** For kval: which competition each side belongs to (for promotion/relegation). */
  stakes?: { highCompetitionId: string; lowCompetitionId: string };
  /** For cup group ties: the group letter and its four clubs. */
  group?: string;
  clubIds?: string[];
}

export type SeasonPhase = "REGULAR" | "POSTSEASON" | "COMPLETE";

export interface SeasonAward {
  id: "TOP_SCORER" | "BEST_GOALKEEPER" | "MVP" | "ALL_STAR";
  label: string;
  competitionId: string;
  playerId: string;
  clubId: string;
  value: string;
  position?: string;
}

export interface SeasonOutcome {
  seasonId: string;
  phase: SeasonPhase;
  /** Whether both Swedish tiers have a calendar this season (older saves: only the manager's league). */
  bothTiersSimulated: boolean;
  regularSeasonWinners: Record<string, string>;
  champion?: string;
  runnerUp?: string;
  cupWinner?: string;
  /** clubId -> competitionId for next season, decided as the postseason resolves. */
  nextMembership: Record<string, string>;
  /** Unresolved scheduling decisions; persisted so a missed window remains explicit after load. */
  qualificationBlockers?: readonly import("./transition/types").Dependency[];
  promoted: string[];
  relegated: string[];
  awards: SeasonAward[];
  /** Ids of milestones already announced (dedup for events and Moments). */
  announced: string[];
}
