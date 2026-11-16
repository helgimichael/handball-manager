// Arena Nights 231 -- WLD-02 Newsstand, WLD-02a dated list, WLD-02b quote
// archive, WLD-02c rivalry cards, WLD-02e media favour meters.
//
// Pure, read-only view models over the existing media state (lib/media/*).
// Nothing here changes how stories, press conferences or relations are
// produced; it only arranges what is already stored.
import type { CareerState } from "../career/types";
import { threadKeyFor } from "../inbox/threads";
import { coachPersona, mediaOf, relationLabel, rivalryBetween } from "./people";
import { TONE_LABEL } from "./press";
import { CLUB_MEDIA, MEDIA_OUTLETS } from "./registry";
import type { Consequence, NewsStory, PressConference, StoryKind, StoryScope } from "./types";

// ---------------------------------------------------------------------------
// Newsstand: one front page per outlet tier
// ---------------------------------------------------------------------------

export const TIERS: { scope: StoryScope; label: string }[] = [
  { scope: "LOCAL", label: "Lokaltidningen" },
  { scope: "REGIONAL", label: "Regionalt" },
  { scope: "SPECIALIST", label: "Handbollsmedia" },
  { scope: "NATIONAL", label: "Riks" },
];

export interface FrontPage {
  scope: StoryScope;
  label: string;
  /** The outlet whose masthead heads the page (the lead story's outlet, else the club's own outlet in this tier). */
  outletId?: string;
  lead?: NewsStory;
  more: NewsStory[];
  /** Stories this tier has written in total. */
  count: number;
}

const newestFirst = (a: NewsStory, b: NewsStory) => b.date.localeCompare(a.date) || b.importance - a.importance;

/** Your club's coverage first in every tier, then the rest of the tier's news. */
export function frontPages(state: CareerState): FrontPage[] {
  const all = Object.values(mediaOf(state).stories);
  const own = CLUB_MEDIA[state.playerClubId]?.outlets ?? [];
  return TIERS.map(({ scope, label }) => {
    const list = all.filter((s) => s.scope === scope).sort((a, b) => Number(b.ownClub) - Number(a.ownClub) || newestFirst(a, b));
    // One headline per event in a front page; other outlets' takes live in the article's "Så skrev andra".
    const seen = new Set<string>();
    const unique = list.filter((s) => (seen.has(s.eventKey) ? false : (seen.add(s.eventKey), true)));
    const lead = unique[0];
    const fallbackOutlet = own.find((id) => scopeOfOutlet(id) === scope);
    return { scope, label, outletId: lead?.outletId ?? fallbackOutlet, lead, more: unique.slice(1, 4), count: list.length };
  });
}

/** The scope an outlet writes in, from its category (matches newsEngine.outletsFor). */
export function scopeOfOutlet(outletId: string): StoryScope | undefined {
  const o = MEDIA_OUTLETS[outletId];
  if (!o) return undefined;
  if (o.category === "HANDBALL_SPECIALIST") return "SPECIALIST";
  if (o.category === "LOCAL") return "LOCAL";
  return o.reach >= 4 ? "NATIONAL" : "REGIONAL";
}

// ---------------------------------------------------------------------------
// Dated list (WLD-02a) and story imagery
// ---------------------------------------------------------------------------

export function groupByDate(stories: readonly NewsStory[]): { date: string; stories: NewsStory[] }[] {
  const out: { date: string; stories: NewsStory[] }[] = [];
  for (const s of [...stories].sort(newestFirst)) {
    const last = out[out.length - 1];
    if (last && last.date === s.date) last.stories.push(s); else out.push({ date: s.date, stories: [s] });
  }
  return out;
}

/** Which existing environment photograph illustrates a story kind (image policy: reuse the club's own environment art; no new images). */
export type StoryImage = "arena-matchday" | "arena-club" | "press-room" | "boardroom" | "manager-office" | "dressing-room" | "training-hall";
export function storyImage(kind: StoryKind): StoryImage {
  switch (kind) {
    case "MATCH_REPORT": case "UPSET": case "DERBY_PREVIEW": case "BIG_MATCH_PREVIEW": case "FORM": case "RECORD": return "arena-matchday";
    case "TITLE": case "PROMOTION": case "RELEGATION": case "AWARD": return "arena-club";
    case "TRANSFER": case "TRANSFER_RUMOUR": case "SALE": return "manager-office";
    case "BOARD_PRESSURE": case "CRISIS": case "MANAGER_DISMISSED": case "MANAGER_APPOINTED": case "COACH_CHANGE": return "boardroom";
    case "PLAYER_UNHAPPY": return "dressing-room";
    case "TALENT": case "NATIONAL_TEAM": return "training-hall";
    default: return "press-room";
  }
}

/** The inbox message (thread) a story concerns, when the inbox holds one for the same match or player. */
export function storyThreadMessageId(state: CareerState, story: NewsStory): string | undefined {
  if (!story.ownClub) return undefined;
  const keys = new Set<string>([...(story.fixtureId ? [`fixture:${story.fixtureId}`] : []), ...(story.playerIds ?? []).map((p) => `player:${p}`)]);
  if (!keys.size) return undefined;
  for (let i = state.inbox.length - 1; i >= 0; i--) {
    const m = state.inbox[i]!;
    if (keys.has(threadKeyFor(state, m).key)) return m.id;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Press: open slot + quote archive (WLD-02b)
// ---------------------------------------------------------------------------

export const AREA_LABEL: Record<Consequence["area"], string> = { PLAYER: "Spelaren", TEAM: "Truppen", BOARD: "Styrelsen", MEDIA: "Media", RIVAL: "Rivalen", SUPPORTERS: "Supportrarna", REPUTATION: "Ditt rykte", PRESSURE: "Pressen", DISCIPLINE: "Disciplin" };

export interface QuoteCard {
  press: PressConference;
  /** Your most telling answer (a non-diplomatic one when there is one), verbatim from the conference. */
  quote?: { text: string; tone: string };
  who: string;
  /** Net direction per affected group, in the order the consequences were recorded. */
  chips: { area: Consequence["area"]; label: string; sign: "plus" | "minus" }[];
}

export function quoteArchive(state: CareerState, limit = 24): QuoteCard[] {
  return Object.values(mediaOf(state).press).filter((p) => p.status !== "OPEN").sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit).map((p) => {
    const answered = p.questions.map((q) => ({ q, tone: p.answers?.[q.id] })).filter((x) => x.tone).map((x) => ({ tone: x.tone!, text: x.q.answers.find((a) => a.tone === x.tone)?.text ?? "" })).filter((x) => x.text);
    const pick = answered.find((a) => a.tone !== "DIPLOMATIC" && a.tone !== "DECLINE") ?? answered[0];
    const net = new Map<Consequence["area"], number>();
    for (const c of p.consequences ?? []) net.set(c.area, (net.get(c.area) ?? 0) + c.delta);
    const chips = [...net.entries()].filter(([, d]) => d !== 0).map(([area, d]) => ({ area, label: AREA_LABEL[area], sign: d > 0 ? "plus" as const : "minus" as const }));
    const who = p.status === "EXPIRED" ? "Inga svar" : p.status === "DECLINED" ? "Du avböjde" : p.status === "DELEGATED" ? "Assisterande tränaren svarade" : p.answeredBy && p.answeredBy !== "MANAGER" ? `${p.answeredBy.name} svarade` : "Du svarade";
    return { press: p, quote: pick ? { text: pick.text, tone: TONE_LABEL[pick.tone] } : undefined, who, chips };
  });
}

// ---------------------------------------------------------------------------
// Rivalry cards (WLD-02c)
// ---------------------------------------------------------------------------

export interface RivalCard {
  clubId: string;
  /** Club rivalry 0..100 (geography, close games, knockouts, the coaches). */
  rivalry: number;
  reasons: string[];
  coach?: { staffId: string; name: string; score: number; label: string };
  flashpoint?: { date: string; text: string };
  h2h: { won: number; drawn: number; lost: number };
  nextMeeting?: { fixtureId: string; date: string; home: boolean };
  /** Sort key: the hottest feud first. */
  heat: number;
}

export function rivalCards(state: CareerState, limit = 8): RivalCard[] {
  const me = state.playerClubId;
  const media = mediaOf(state);
  const coachRel = Object.values(media.relations).filter((r) => r.a === "manager" || r.b === "manager").map((r) => ({ r, staffId: r.a === "manager" ? r.b : r.a }));
  const byClub = new Map<string, (typeof coachRel)[number] & { name: string }>();
  for (const x of coachRel) { const p = coachPersona(state, x.staffId); if (p && p.clubId !== me) byClub.set(p.clubId, { ...x, name: p.name }); }
  const clubIds = new Set<string>([...Object.keys(CLUB_MEDIA).filter((id) => id !== me && rivalryBetween(state, me, id).score >= 18), ...byClub.keys()]);
  const cards: RivalCard[] = [];
  for (const clubId of clubIds) {
    const rv = rivalryBetween(state, me, clubId);
    const rel = byClub.get(clubId);
    const h2h = { won: 0, drawn: 0, lost: 0 };
    for (const g of rv.meetings) { const gf = g.homeClubId === me ? g.homeGoals : g.awayGoals; const ga = g.homeClubId === me ? g.awayGoals : g.homeGoals; if (gf > ga) h2h.won++; else if (gf < ga) h2h.lost++; else h2h.drawn++; }
    const lastGame = rv.meetings.at(-1);
    const lastWord = rel?.r.history.at(-1);
    const flashpoint = lastWord && (!lastGame || lastWord.date >= lastGame.date) ? { date: lastWord.date, text: lastWord.text }
      : lastGame ? { date: lastGame.date, text: `${lastGame.homeClubId === me ? "Hemma" : "Borta"} ${lastGame.homeGoals}–${lastGame.awayGoals}` } : undefined;
    const next = state.fixtures.filter((f) => !state.results[f.id] && f.date >= state.gameDate && ((f.homeClubId === me && f.awayClubId === clubId) || (f.awayClubId === me && f.homeClubId === clubId))).sort((a, b) => a.date.localeCompare(b.date))[0];
    cards.push({ clubId, rivalry: rv.score, reasons: rv.reasons, coach: rel ? { staffId: rel.staffId, name: rel.name, score: rel.r.score, label: relationLabel(rel.r.score) } : undefined, flashpoint, h2h, nextMeeting: next ? { fixtureId: next.id, date: next.date, home: next.homeClubId === me } : undefined, heat: Math.max(rv.score, rel ? -rel.r.score : 0) });
  }
  return cards.sort((a, b) => b.heat - a.heat).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Media favour meters (WLD-02e)
// ---------------------------------------------------------------------------

export interface Favour { label: string; tone: "pos" | "neutral" | "neg"; meaning: string }

/**
 * The outlet relation (-50..50) in words. It moves only with press
 * conferences that outlet's journalists attend (your tone, -3 when you
 * decline); the copy says exactly that and does not claim effects the game
 * does not have.
 */
export function favourOf(score: number): Favour {
  if (score >= 20) return { label: "Varm", tone: "pos", meaning: "Redaktionen har tagit emot många av dina svar väl." };
  if (score >= 6) return { label: "Välvillig", tone: "pos", meaning: "Dina svar har tagits väl emot här." };
  if (score > -6) return { label: "Neutral", tone: "neutral", meaning: "Ingen tydlig hållning ännu. Presskonferenserna där deras journalister är med avgör." };
  if (score > -20) return { label: "Kritisk", tone: "neg", meaning: "Dina svar eller uteblivna presskonferenser har skavt här." };
  return { label: "Fientlig", tone: "neg", meaning: "Relationen är sur. Diplomatiska svar till deras journalister är vägen tillbaka." };
}

export interface OutletFavourRow { outletId: string; score: number; favour: Favour; count: number; last?: NewsStory }

/** Your local outlets plus the national/handball outlets, most critical first. */
export function outletFavour(state: CareerState, nationalIds: readonly string[]): { local: OutletFavourRow[]; national: OutletFavourRow[] } {
  const media = mediaOf(state);
  const stories = Object.values(media.stories);
  const row = (outletId: string): OutletFavourRow => {
    const mine = stories.filter((s) => s.outletId === outletId).sort(newestFirst);
    const score = media.outletRelations[outletId] ?? 0;
    return { outletId, score, favour: favourOf(score), count: mine.length, last: mine[0] };
  };
  const byCritical = (a: OutletFavourRow, b: OutletFavourRow) => a.score - b.score;
  const localIds = CLUB_MEDIA[state.playerClubId]?.outlets ?? [];
  return { local: localIds.filter((id) => MEDIA_OUTLETS[id]).map(row).sort(byCritical), national: nationalIds.filter((id) => MEDIA_OUTLETS[id] && !localIds.includes(id)).map(row).sort(byCritical) };
}
