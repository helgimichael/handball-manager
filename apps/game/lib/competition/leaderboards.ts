// Arena Nights -- CMP-04 A "Leaderboards by position" + CMP-01d (shared stats component).
// Pure ranking over recorded match statistics (goals, shots, saves, match ratings). These are public match
// facts; no current/potential ability is read for anyone.
import type { CareerState, PlayerSeasonStats } from "../career/types";
import { averageRating } from "../career/types";
import type { PlayerMock } from "../game-data";
import { managementPlayers } from "../career/management";
import { clubCompetitionId } from "../career/competitionMembership";

export type StatMetric = "goals" | "appearances" | "shooting" | "saves" | "saving" | "rating";
export const STAT_METRICS: readonly { id: StatMetric; label: string }[] = [
  { id: "goals", label: "Mål" }, { id: "appearances", label: "Matcher" }, { id: "shooting", label: "Skotteffektivitet" },
  { id: "saves", label: "Räddningar" }, { id: "saving", label: "Räddningsprocent" }, { id: "rating", label: "Snittbetyg" },
];
export const STAT_POSITIONS = ["MV", "V6", "V9", "M9", "M6", "H9", "H6"] as const;
export const POSITION_LABEL: Record<string, string> = { MV: "Målvakt", V6: "Vänsterkant", V9: "Vänsternia", M9: "Mittnia", M6: "Linje", H9: "Högernia", H6: "Högerkant" };

export interface RankQuery { metric: StatMetric; minimum: number; position: string }
export interface RankedRow { player: PlayerMock; stats: PlayerSeasonStats; score: number }

export function playerIndex(state: CareerState): Map<string, PlayerMock> {
  return new Map(managementPlayers(state).map((p) => [p.id, p]));
}
const score = (s: PlayerSeasonStats, metric: StatMetric) => metric === "shooting" ? (s.shots ? s.goals / s.shots : 0) : metric === "saving" ? (s.shotsFaced ? s.saves / s.shotsFaced : 0) : metric === "rating" ? averageRating(s) : s[metric];

/**
 * The ranking behind the shared table. With `archived` stats (a finished season) every recorded player counts;
 * otherwise only players whose club plays in `competitionId` this season.
 */
export function rankPlayers(state: CareerState, competitionId: string, q: RankQuery, archived?: Record<string, PlayerSeasonStats>, index = playerIndex(state), limit = 100): RankedRow[] {
  const stats = archived ?? state.playerSeasonStats;
  const min = Math.max(1, q.minimum);
  return Object.values(stats).flatMap((s): RankedRow[] => {
    const player = index.get(s.playerId);
    if (!player || !s.appearances) return [];
    if (!archived && clubCompetitionId(state, player.clubId) !== competitionId) return [];
    if (q.position !== "ALL" && player.position !== q.position) return [];
    if (q.metric === "shooting" && (player.position === "MV" || s.shots < min)) return [];
    if (q.metric === "saving" && (player.position !== "MV" || s.shotsFaced < min)) return [];
    if (q.metric === "saves" && player.position !== "MV") return [];
    if (q.metric === "rating" && s.appearances < Math.min(min, 3)) return [];
    return [{ player, stats: s, score: score(s, q.metric) }];
  }).sort((a, b) => b.score - a.score || b.stats.appearances - a.stats.appearances || a.player.lastName.localeCompare(b.player.lastName, "sv")).slice(0, limit);
}

export interface LeaderCard { position: string; title: string; metricLabel: string; leaders: { player: PlayerMock; value: string; detail: string }[] }
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "—");
/** One card per court position with its own yardstick: keepers by save %, wings and the line by goals (with efficiency), backs by goals (with shots), centre backs by match rating. */
export function positionLeaders(state: CareerState, competitionId: string, archived?: Record<string, PlayerSeasonStats>, top = 3): LeaderCard[] {
  const index = playerIndex(state);
  const rank = (position: string, metric: StatMetric, minimum: number) => rankPlayers(state, competitionId, { metric, minimum, position }, archived, index, top);
  const card = (position: string, metricLabel: string, rows: RankedRow[], value: (r: RankedRow) => string, detail: (r: RankedRow) => string): LeaderCard =>
    ({ position, title: POSITION_LABEL[position]!, metricLabel, leaders: rows.filter((r) => r.score > 0).map((r) => ({ player: r.player, value: value(r), detail: detail(r) })) });
  return STAT_POSITIONS.map((position) => {
    if (position === "MV") return card(position, "Räddningsprocent", rank(position, "saving", 20), (r) => pct(r.stats.saves, r.stats.shotsFaced), (r) => `${r.stats.saves}/${r.stats.shotsFaced} räddningar`);
    if (position === "M9") return card(position, "Snittbetyg", rank(position, "rating", 3), (r) => averageRating(r.stats).toFixed(1), (r) => `${r.stats.appearances} matcher · ${r.stats.goals} mål`);
    if (position === "V9" || position === "H9") return card(position, "Mål", rank(position, "goals", 1), (r) => String(r.stats.goals), (r) => `${r.stats.shots} skott · ${pct(r.stats.goals, r.stats.shots)}`);
    return card(position, "Mål", rank(position, "goals", 1), (r) => String(r.stats.goals), (r) => `Effektivitet ${pct(r.stats.goals, r.stats.shots)}`);
  });
}
