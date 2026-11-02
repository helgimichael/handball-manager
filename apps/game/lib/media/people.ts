// HM-ALPHA3-M08: the people in the story -- rival head coaches with
// lasting personalities, relationships that follow a person (not a club)
// across seasons and moves, fictional journalists at real outlets, and
// club rivalries grown from geography and actual competitive history.
import type { CareerState } from "../career/types";
import { getClub } from "../game-data";
import { clubMedia, geographicTie, MEDIA_OUTLETS } from "./registry";
import type { Journalist, MediaState, Relation } from "./types";

export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

export function emptyMedia(): MediaState {
  return { stories: {}, journalists: {}, press: {}, relations: {}, outletRelations: {}, supporters: 0, boardMood: 0, pressure: {}, discipline: {}, seen: [], week: { key: "", count: 0 } };
}

export function mediaOf(state: CareerState): MediaState {
  return state.media ?? emptyMedia();
}

export function withMedia(state: CareerState, fn: (m: MediaState) => MediaState): CareerState {
  return { ...state, media: fn(mediaOf(state)) };
}

// ---------------------------------------------------------------------------
// Rival coaches
// ---------------------------------------------------------------------------

export type CoachStyle = "DIPLOMAT" | "FIERY" | "ANALYST" | "JOKER" | "PROUD";
export const COACH_STYLE_LABEL: Record<CoachStyle, string> = { DIPLOMAT: "Diplomatisk", FIERY: "Het på gröten", ANALYST: "Analytisk", JOKER: "Skämtsam", PROUD: "Stolt och lättstött" };

export interface CoachPersona { staffId: string; name: string; clubId: string; style: CoachStyle; ego: number; sensitivity: number }

/** A head coach's lasting traits, stable for the person wherever they work. */
export function coachPersona(state: CareerState, staffId: string): CoachPersona | null {
  for (const [clubId, roster] of Object.entries(state.staffRoster)) {
    const m = roster.find((x) => x.id === staffId);
    if (!m) continue;
    const r = hash(`${staffId}:style`);
    const style: CoachStyle = r < 0.3 ? "DIPLOMAT" : r < 0.5 ? "FIERY" : r < 0.72 ? "ANALYST" : r < 0.86 ? "JOKER" : "PROUD";
    return { staffId, name: m.displayName, clubId, style, ego: 1 + Math.floor(hash(`${staffId}:ego`) * 5), sensitivity: 1 + Math.floor(hash(`${staffId}:sens`) * 5) };
  }
  return null;
}

/** The CPU club's head coach, if it has one. */
export function headCoachOf(state: CareerState, clubId: string): CoachPersona | null {
  const hc = (state.staffRoster[clubId] ?? []).find((m) => m.roles[0] === "HEAD_COACH");
  return hc && clubId !== state.playerClubId ? coachPersona(state, hc.id) : null;
}

const relKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function relationOf(state: CareerState, a: string, b: string): Relation {
  return mediaOf(state).relations[relKey(a, b)] ?? { a, b, score: 0, history: [] };
}

export function adjustRelation(m: MediaState, a: string, b: string, delta: number, date: string, text: string): MediaState {
  const key = relKey(a, b);
  const prev = m.relations[key] ?? { a, b, score: 0, history: [] };
  const score = Math.max(-100, Math.min(100, prev.score + delta));
  return { ...m, relations: { ...m.relations, [key]: { ...prev, score, history: [...prev.history, { date, text, delta }].slice(-30) } } };
}

export function relationLabel(score: number): string {
  return score <= -40 ? "Öppen fejd" : score <= -15 ? "Frostig" : score < 15 ? "Neutral" : score < 40 ? "Respektfull" : "Varm";
}

// ---------------------------------------------------------------------------
// Journalists (fictional people at real outlets)
// ---------------------------------------------------------------------------

const FIRST = ["Anna", "Johan", "Sara", "Erik", "Lina", "Magnus", "Emma", "Daniel", "Karin", "Oskar", "Frida", "Henrik", "Maja", "Jonas", "Elin", "Patrik", "Sofia", "Mattias", "Ida", "Niklas"];
const LAST = ["Lindqvist", "Berg", "Holm", "Sjöberg", "Ekström", "Nyström", "Wallin", "Forsberg", "Engström", "Lundgren", "Hedlund", "Sandberg", "Björk", "Dahl", "Hermansson", "Strand", "Lindahl", "Åberg", "Falk", "Nord"];

/** One or two recurring (fictional) reporters per outlet, generated on first use and then kept. */
export function journalistFor(m: MediaState, outletId: string, seed: string): { media: MediaState; journalist: Journalist } {
  const outlet = MEDIA_OUTLETS[outletId];
  const n = outlet && outlet.reach >= 4 ? 2 : 1;
  const idx = Math.floor(hash(`${outletId}:${seed}`) * n);
  const id = `j:${outletId}:${idx}`;
  if (m.journalists[id]) return { media: m, journalist: m.journalists[id]! };
  const name = `${FIRST[Math.floor(hash(`${id}:f`) * FIRST.length)]} ${LAST[Math.floor(hash(`${id}:l`) * LAST.length)]}`;
  const style: Journalist["style"] = outlet?.category === "NATIONAL_TABLOID" ? "BLUNT" : outlet?.category === "LOCAL" || outlet?.category === "REGIONAL_RADIO" ? "LOCAL" : "ANALYTICAL";
  const journalist: Journalist = { id, name, outletId, style };
  return { media: { ...m, journalists: { ...m.journalists, [id]: journalist } }, journalist };
}

// ---------------------------------------------------------------------------
// Club rivalries
// ---------------------------------------------------------------------------

export interface Rivalry { a: string; b: string; score: number; reasons: string[]; meetings: { date: string; fixtureId: string; homeClubId: string; homeGoals: number; awayGoals: number; stage?: string }[] }

/** All meetings between two clubs in this career (this season's results and archived seasons' ties). */
function meetings(state: CareerState, a: string, b: string): Rivalry["meetings"] {
  const out: Rivalry["meetings"] = [];
  for (const f of state.fixtures) {
    const r = state.results[f.id];
    if (!r) continue;
    if ((f.homeClubId === a && f.awayClubId === b) || (f.homeClubId === b && f.awayClubId === a)) out.push({ date: f.date, fixtureId: f.id, homeClubId: f.homeClubId, homeGoals: r.homeGoals, awayGoals: r.awayGoals, stage: f.type === "LEAGUE" ? undefined : f.type });
  }
  return out.sort((x, y) => x.date.localeCompare(y.date));
}

/** How much two clubs matter to each other: geography, close games, knockout meetings, title races -- and the coaches. */
export function rivalryBetween(state: CareerState, a: string, b: string): Rivalry {
  const reasons: string[] = [];
  const geo = geographicTie(a, b);
  let score = geo * 18;
  if (geo === 3) reasons.push("Samma stad");
  else if (geo === 2) reasons.push("Grannar i regionen");
  const games = meetings(state, a, b);
  const close = games.filter((g) => Math.abs(g.homeGoals - g.awayGoals) <= 2).length;
  if (close >= 2) { score += close * 4; reasons.push(`${close} jämna matcher den här säsongen`); }
  const knock = games.filter((g) => g.stage && g.stage !== "LEAGUE").length;
  let pastKnock = 0;
  for (const h of state.seasonHistory ?? []) pastKnock += (h.ties ?? []).filter((t) => (t.highClubId === a && t.lowClubId === b) || (t.highClubId === b && t.lowClubId === a)).length;
  if (knock + pastKnock > 0) { score += (knock + pastKnock) * 10; reasons.push("Möts i slutspel och cup"); }
  const me = state.playerClubId;
  if (a === me || b === me) {
    const other = a === me ? b : a;
    const coach = headCoachOf(state, other);
    if (coach) {
      const rel = relationOf(state, "manager", coach.staffId).score;
      if (rel <= -15) { score += Math.min(25, -rel / 2); reasons.push(`Du och ${coach.name} har en historia`); }
    }
  }
  return { a, b, score: Math.min(100, Math.round(score)), reasons, meetings: games };
}

export function isDerby(a: string, b: string): boolean {
  return geographicTie(a, b) >= 2;
}

export function derbyName(a: string, b: string): string | null {
  const tie = geographicTie(a, b);
  if (tie === 3) return `Derby i ${clubMedia(a)?.town ?? getClub(a)?.city ?? "staden"}`;
  if (tie === 2) return "Regionalt derby";
  return null;
}
