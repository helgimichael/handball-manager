// Arena Nights -- Klubbhuset folded into the Club Journal (CLB-01 C): the clubhouse header's departments
// (CLB-01a A, rooms with live status, ranked by need) and the Club Almanac (CLB-01c C): founding, colours,
// home arena, honours timeline, the stands' mood and rivals with head-to-head. Pure and read-only: every
// value comes from clubHq (lib/clubhq) and the save's own season history, fixtures and results.
import type { CareerState } from "../career/types";
import { clubHq, TIER_LABEL, type ClubHq, type HqRoom, type HqTier } from "../clubhq/clubhq";
import { ECONOMIC_BAND_LABEL } from "../economy/clubEconomyLabels";
import { headToHead, honoursOf, type HeadToHead } from "./clubTimeline";

const toneRank: Record<HqRoom["alertTone"], number> = { bad: 0, warn: 1, neutral: 2, ok: 3 };

export interface AlmanacSeason { seasonId: string; position: number | null; teams: number; honours: string[]; current: boolean }
export interface AlmanacRival { clubId: string; reasons: string[]; h2h: HeadToHead }
export interface ClubAlmanac {
  tier: HqTier;
  tierLabel: string;
  facts: { label: string; value: string }[];
  colors: string[];
  seasons: AlmanacSeason[];
  honoursCount: number;
  supporters: { score: number; label: string; tone: "good" | "warn" | "bad" | "neutral"; causes: string[] };
  rivals: AlmanacRival[];
  nationalBreak: { title: string; start: string; end: string } | null;
  /** Departments for the clubhouse header -- those that need attention first. */
  departments: HqRoom[];
}

export function clubAlmanac(state: CareerState, hq: ClubHq = clubHq(state)): ClubAlmanac {
  const me = hq.clubId;
  const seasons: AlmanacSeason[] = (state.seasonHistory ?? []).map((h) => {
    const table = h.tables?.[h.competitionId] ?? h.table;
    const i = table.findIndex((r) => r.clubId === me);
    return { seasonId: h.seasonId, position: i >= 0 ? i + 1 : null, teams: table.length, honours: honoursOf(h.outcome, me), current: false };
  });
  seasons.push({ seasonId: state.seasonId, position: null, teams: 0, honours: [], current: true });

  const facts = [
    hq.founded ? { label: "Grundad", value: String(hq.founded) } : null,
    hq.town ? { label: "Hemort", value: hq.town } : null,
    hq.venue ? { label: "Hemmaarena", value: hq.capacity ? `${hq.venue} · ${hq.capacity.toLocaleString("sv-SE")} platser` : hq.venue } : null,
    { label: "Anläggning", value: TIER_LABEL[hq.tier] },
    hq.band ? { label: "Ekonomisk nivå", value: ECONOMIC_BAND_LABEL[hq.band] } : null,
  ].filter((f): f is { label: string; value: string } => !!f);

  const s = hq.supporters.score;
  // The causes the game itself uses for the stands' mood (lib/media): results against expectation, derbies,
  // the season's outcome -- shown with the live signals behind them, never an invented reason.
  const form = (state.clubForm[me] ?? []).slice(-5);
  const wins = form.filter((f) => f === "W").length, losses = form.filter((f) => f === "L").length;
  const causes = [
    form.length ? `Form: ${wins} vinster, ${losses} förluster av ${form.length}` : "Inga matcher spelade ännu",
    hq.rivals.length ? `${hq.rivals.length} rivaler i serien` : "Inga utpekade rivaler",
    seasons.some((x) => x.honours.length) ? "Titlar i din tid" : null,
  ].filter((c): c is string => !!c);

  const next = hq.national.upcoming[0]?.window;
  return {
    tier: hq.tier,
    tierLabel: TIER_LABEL[hq.tier],
    facts,
    colors: [hq.colors.primary, hq.colors.secondary].filter((c): c is string => !!c),
    seasons,
    honoursCount: seasons.reduce((n, x) => n + x.honours.filter((h) => h !== "Nedflyttning").length, 0),
    supporters: { score: s, label: hq.supporters.label, tone: s >= 8 ? "good" : s <= -8 ? "bad" : s < 0 ? "warn" : "neutral", causes },
    rivals: hq.rivals.map((r) => ({ clubId: r.clubId, reasons: r.reasons, h2h: headToHead(state, r.clubId, me) })),
    nationalBreak: next ? { title: next.title, start: next.start, end: next.end } : null,
    departments: [...hq.rooms].sort((a, b) => toneRank[a.alertTone] - toneRank[b.alertTone]),
  };
}
