// HM-ALPHA3-M09: the matchday around the engine. Everything here is
// presentation of what the career already knows: why the match matters,
// what has been said, how the two clubs have met before, what the media
// expect -- and afterwards what was written and what followed. Opponent
// detail comes only from public results or a completed opponent analysis;
// nothing hidden is shown. Results always come from the engine.
import type { CareerFixture, CareerState } from "../career/types";
import { getClubEconomyBaseline } from "../economy/clubEconomyIntegration";
import { homeAttendance } from "../economy/ledger";
import { competitionTable } from "../competition/tables";
import { getClub } from "../game-data";
import { activeSuspension } from "../media/discipline";
import { coachPersona, mediaOf, relationOf, rivalryBetween, type Rivalry } from "../media/people";
import { matchStakes, type MatchStakes } from "../media/worldTick";
import type { Consequence, NewsStory, PressConference } from "../media/types";
import { matchWinnerClubId } from "@handball-manager/game-simulation";

export interface MatchdayBriefing {
  fixture: CareerFixture;
  opponentId: string;
  home: boolean;
  stakes: MatchStakes;
  rivalry: Rivalry;
  table: { own: number | null; opp: number | null; size: number };
  form: { own: ("W" | "D" | "L")[]; opp: ("W" | "D" | "L")[] };
  /** Past meetings, this season and in archived seasons' knockout ties. */
  history: string[];
  narratives: NewsStory[];
  rivalQuote?: { name: string; text: string; relation: number };
  pressure: { level: number; reason: string } | null;
  press: PressConference | null;
  attendance: { expected: number; capacity: number } | null;
  analysisReady: boolean;
  suspended: boolean;
  /** A short line that sets the scene, built from the stakes. */
  headline: string;
}

function pos(state: CareerState, clubId: string, comp: string): number | null {
  const t = competitionTable(state, comp);
  const i = t.findIndex((r) => r.clubId === clubId);
  return i >= 0 ? i + 1 : null;
}

export function matchdayBriefing(state: CareerState, f: CareerFixture): MatchdayBriefing {
  const me = state.playerClubId;
  const home = f.homeClubId === me;
  const opp = home ? f.awayClubId : f.homeClubId;
  const stakes = matchStakes(state, f);
  const rivalry = rivalryBetween(state, me, opp);
  const media = mediaOf(state);
  const cutoff = addDays(state.gameDate, -10);
  const narratives = Object.values(media.stories)
    .filter((s) => s.date >= cutoff && (s.fixtureId === f.id || (s.clubIds.includes(opp) && s.clubIds.includes(me))))
    .sort((a, b) => b.importance - a.importance || b.date.localeCompare(a.date));
  const seen = new Set<string>();
  const uniq = narratives.filter((s) => (seen.has(s.eventKey) ? false : (seen.add(s.eventKey), true))).slice(0, 4);
  const rivalStory = uniq.find((s) => s.kind === "RIVAL_COMMENT" && s.quote);
  const coach = stakes.rival ? coachPersona(state, stakes.rival.staffId) : null;
  const history = rivalry.meetings.map((m) => `${m.date}: ${getClub(m.homeClubId)?.shortName ?? ""} hemma ${m.homeGoals}–${m.awayGoals}${m.stage ? " (" + m.stage.toLowerCase() + ")" : ""}`).reverse();
  for (const h of [...(state.seasonHistory ?? [])].reverse()) for (const t of h.ties ?? []) if ((t.highClubId === me && t.lowClubId === opp) || (t.highClubId === opp && t.lowClubId === me)) history.push(`${h.seasonId}: ${t.stage} – ${t.winnerClubId ? `${getClub(t.winnerClubId)?.shortName ?? ""} gick vidare` : "oavgjort"}`);
  const baseline = getClubEconomyBaseline(state, f.homeClubId);
  let attendance: MatchdayBriefing["attendance"] = null;
  if (baseline) { const a = homeAttendance(state, f, baseline); attendance = { expected: a.attendance, capacity: a.capacity }; }
  const press = Object.values(media.press).find((p) => p.fixtureId === f.id && p.kind === "PRE_MATCH") ?? null;
  const analysisReady = state.tasks.some((t) => t.id === `task:OPPONENT_ANALYSIS:${f.id}` && t.status === "COMPLETED");
  const headline = stakes.labels[0] ?? (f.type === "LEAGUE" ? "Seriematch" : "Cupmatch");
  return {
    fixture: f, opponentId: opp, home, stakes, rivalry,
    table: { own: pos(state, me, f.competitionId), opp: pos(state, opp, f.competitionId), size: competitionTable(state, f.competitionId).length },
    form: { own: (state.clubForm[me] ?? []).slice(-5) as ("W" | "D" | "L")[], opp: (state.clubForm[opp] ?? []).slice(-5) as ("W" | "D" | "L")[] },
    history: history.slice(0, 5),
    narratives: uniq,
    rivalQuote: rivalStory?.quote && coach ? { name: coach.name, text: rivalStory.quote.text, relation: relationOf(state, "manager", coach.staffId).score } : undefined,
    pressure: media.pressure[f.id] ?? null,
    press,
    attendance,
    analysisReady,
    suspended: !!activeSuspension(state),
    headline,
  };
}

export interface MatchAftermath {
  stories: NewsStory[];
  rivalComment?: NewsStory;
  press: PressConference | null;
  consequences: Consequence[];
  tablePos: number | null;
  result: "WIN" | "DRAW" | "LOSS" | null;
  /** The goal difference minute by minute, from the engine's own events (if recorded). */
  flow: { minute: number; diff: number }[];
}

export function matchAftermath(state: CareerState, fixtureId: string): MatchAftermath {
  const media = mediaOf(state);
  const f = state.fixtures.find((x) => x.id === fixtureId);
  const r = state.results[fixtureId];
  const me = state.playerClubId;
  // Coverage of the match itself first, then what was said before it.
  const stories = Object.values(media.stories).filter((s) => s.fixtureId === fixtureId).sort((a, b) => Number(b.date >= (f?.date ?? "")) - Number(a.date >= (f?.date ?? "")) || b.importance - a.importance);
  const winner = r ? matchWinnerClubId(r) : undefined;
  const result = !r ? null : winner === null ? "DRAW" : winner === me ? "WIN" : "LOSS";
  const ownHome = f?.homeClubId === me;
  const flow: MatchAftermath["flow"] = [{ minute: 0, diff: 0 }];
  for (const e of r?.events ?? []) if (e.type === "GOAL" && e.homeScoreAfter !== undefined && e.awayScoreAfter !== undefined) flow.push({ minute: e.minute, diff: (e.homeScoreAfter - e.awayScoreAfter) * (ownHome ? 1 : -1) });
  return {
    stories,
    rivalComment: stories.find((s) => s.eventKey.startsWith("rival-after:")),
    press: Object.values(media.press).find((p) => p.fixtureId === fixtureId && p.kind === "POST_MATCH") ?? null,
    consequences: media.aftermath?.[fixtureId] ?? [],
    tablePos: f ? pos(state, me, f.competitionId) : null,
    result,
    flow: flow.length > 1 ? flow : [],
  };
}

// ---------------------------------------------------------------------------
// Club colours in the match view (readable against the court, no kit clash)
// ---------------------------------------------------------------------------

const COURT = "#173e51";
function rgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function luminance(hex: string): number {
  const c = rgb(hex);
  if (!c) return 0;
  const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}
function distance(a: string, b: string): number {
  const x = rgb(a), y = rgb(b);
  if (!x || !y) return 999;
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

const FALLBACK_HOME = "#4da5ef";
const FALLBACK_AWAY = "#ef775f";

/** A team colour that stands out on the court: the club's primary, else its secondary, else a neutral fallback. */
function readable(club: { primaryColor?: string; secondaryColor?: string } | undefined, fallback: string): string[] {
  return [club?.primaryColor, club?.secondaryColor, fallback].filter((c): c is string => !!c && !!rgb(c) && contrast(c, COURT) >= 2.2);
}

/** Home and away colours for the court: readable on the floor and clearly different from each other (kit clash → away changes). */
export function matchColors(homeClubId: string, awayClubId: string): { home: string; away: string } {
  const homeOptions = readable(getClub(homeClubId), FALLBACK_HOME);
  const home = homeOptions[0] ?? FALLBACK_HOME;
  const awayOptions = [...readable(getClub(awayClubId), FALLBACK_AWAY), FALLBACK_AWAY, "#f2f2f2", "#ffd34d"];
  const away = awayOptions.find((c) => distance(c, home) >= 120) ?? (distance(FALLBACK_AWAY, home) >= 120 ? FALLBACK_AWAY : "#f2f2f2");
  return { home, away };
}

/** White or dark ink for a number printed on a team colour. */
export function inkOn(color: string): string {
  return contrast(color, "#ffffff") >= contrast(color, "#10202b") ? "#ffffff" : "#10202b";
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
