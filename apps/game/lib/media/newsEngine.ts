// HM-ALPHA3-M08: from a game event to stories. One event is covered by
// the outlets that would really care -- the club's local paper always,
// the regional desk when it matters, Handbollskanalen for anything of
// handball interest, national media only for the big ones -- each with
// its own angle. A weekly editorial budget keeps other clubs' news to a
// handful of items; the manager's own club is never crowded out.
import type { EventDestination } from "../career/careerEvents";
import type { CareerState } from "../career/types";
import { getCareerPlayer } from "../career/careerWorld";
import { getClub } from "../game-data";
import { hash, journalistFor, mediaOf, withMedia } from "./people";
import { CLUB_MEDIA, MEDIA_OUTLETS } from "./registry";
import type { MediaState, NewsStory, StoryKind, StoryScope } from "./types";

export const WEEKLY_WORLD_BUDGET = 6;

export interface WorldEvent {
  key: string;
  kind: StoryKind;
  date: string;
  importance: number;
  clubIds: string[];
  playerIds?: string[];
  personIds?: string[];
  fixtureId?: string;
  facts: Record<string, string | number | boolean | undefined>;
  destinations: EventDestination[];
  quote?: { who: string; text: string };
  /** Only these outlets cover it (e.g. a specialist's own round-up). */
  onlyOutlets?: string[];
  /** Top-flight event (national media follow Handbollsligan). */
  topFlight?: boolean;
}

export const clubName = (id?: string | number | boolean) => (typeof id === "string" ? getClub(id)?.name ?? id : "");
export const clubShort = (id?: string | number | boolean) => (typeof id === "string" ? getClub(id)?.shortName ?? id : "");
export const playerName = (state: CareerState, id?: string) => { const p = id ? getCareerPlayer(state, id) : undefined; return p ? `${p.firstName} ${p.lastName}` : ""; };

function isoWeek(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Which outlets cover an event, nearest first, with the scope each writes in. */
export function outletsFor(state: CareerState, e: WorldEvent): { outletId: string; scope: StoryScope }[] {
  if (e.onlyOutlets) return e.onlyOutlets.filter((id) => MEDIA_OUTLETS[id]).map((id) => ({ outletId: id, scope: MEDIA_OUTLETS[id]!.category === "HANDBALL_SPECIALIST" ? "SPECIALIST" as const : MEDIA_OUTLETS[id]!.category === "LOCAL" ? "LOCAL" as const : MEDIA_OUTLETS[id]!.reach >= 4 ? "NATIONAL" as const : "REGIONAL" as const }));
  const out: { outletId: string; scope: StoryScope }[] = [];
  const add = (outletId: string, scope: StoryScope) => { if (MEDIA_OUTLETS[outletId] && !out.some((o) => o.outletId === outletId)) out.push({ outletId, scope }); };
  const desks: string[] = [];
  // Local and regional: the first club's own media, and the second club's local paper for big events.
  e.clubIds.slice(0, 2).forEach((clubId, i) => {
    const media = CLUB_MEDIA[clubId];
    if (!media) return;
    if (i === 1 && e.importance < 3) return;
    const rest = media.outlets;
    // A club's papers share its news: one of them for everyday stories (in turn), all of them for the big ones.
    const papers = media.outlets.filter((id) => ["LOCAL", "REGIONAL_DAILY", "NATIONAL_DAILY"].includes(MEDIA_OUTLETS[id]?.category ?? ""));
    const chosen = e.importance >= 3 ? papers : papers.length ? [papers[Math.floor(hash(e.key) * papers.length)]!] : [];
    for (const p of chosen) add(p, MEDIA_OUTLETS[p]!.category === "LOCAL" ? "LOCAL" : "REGIONAL");
    // Regional radio and tv share the bigger stories: one of them in turn, both for the biggest.
    if (e.importance >= 3) { const all = rest.filter((id) => MEDIA_OUTLETS[id]?.category === "REGIONAL_RADIO" || MEDIA_OUTLETS[id]?.category === "REGIONAL_TV"); desks.push(...(e.importance >= 4 || all.length < 2 ? all : [all[Math.floor(hash(`${e.key}:desk`) * all.length)]!])); }
  });
  if (e.importance >= 2 || e.kind === "TRANSFER" || e.kind === "COACH_CHANGE") add("handbollskanalen", "SPECIALIST");
  if (e.importance >= 4 && e.topFlight !== false) {
    const tabloidKinds: StoryKind[] = ["MANAGER_DISMISSED", "CRISIS", "DISCIPLINE", "RIVAL_COMMENT", "CONTROVERSY", "TITLE", "MANAGER_APPOINTED"];
    const broadcasters = ["svt-sport", "svt-sport", "radiosporten", "tt"];
    add(tabloidKinds.includes(e.kind) ? (hash(e.key) < 0.5 ? "aftonbladet" : "expressen") : broadcasters[Math.floor(hash(`${e.key}:nat`) * broadcasters.length)]!, "NATIONAL");
    if (e.importance >= 5) add(tabloidKinds.includes(e.kind) ? "svt-sport" : "dn", "NATIONAL");
  }
  // Regional radio and tv come after the papers, specialists and national media.
  for (const d of desks) add(d, "REGIONAL");
  return out;
}

type Copy = { headline: string; standfirst: string; body: string[] };

const pick = <T,>(arr: T[], seed: string): T => arr[Math.floor(hash(seed) * arr.length)]!;

/** The story an outlet writes about an event, in its own register. */
export function writeStory(state: CareerState, e: WorldEvent, outletId: string, scope: StoryScope): Copy {
  const f = e.facts;
  const s = `${e.key}:${outletId}`;
  const local = scope === "LOCAL" || scope === "REGIONAL";
  const home = clubShort(f.home), away = clubShort(f.away), club = clubShort(f.club), clubFull = clubName(f.club);
  const who = playerName(state, e.playerIds?.[0]);
  switch (e.kind) {
    case "MATCH_REPORT": {
      if (f.roundup) return { headline: pick([`Veckan i Handbollsligan: ${clubShort(f.leader)} leder`, `Omgången: ${home}–${away} ${f.hg}–${f.ag} stack ut`], s), standfirst: `${clubShort(f.leader)} toppar tabellen med ${f.leaderPoints} poäng. Veckans största seger: ${home}–${away} ${f.hg}–${f.ag}.`, body: ["Handbollskanalen summerar omgången."] };
      const hg = Number(f.hg), ag = Number(f.ag);
      const ownHome = f.ownSide === "home";
      const own = ownHome ? home : away, opp = ownHome ? away : home;
      const ownG = ownHome ? hg : ag, oppG = ownHome ? ag : hg;
      const result = ownG > oppG ? "WIN" : ownG < oppG ? "LOSS" : "DRAW";
      const score = `${hg}–${ag}`;
      const headline = local
        ? result === "WIN" ? pick([`${own} vann mot ${opp}`, `Seger för ${own}: ${score}`, `${own} tog poängen mot ${opp}`], s) : result === "LOSS" ? pick([`Tung förlust för ${own}`, `${own} föll mot ${opp}`, `${opp} för starkt för ${own}`], s) : `Delad pott mellan ${home} och ${away}`
        : `${home}–${away} ${score}`;
      const scorer = f.topScorer ? ` ${f.topScorer} gjorde ${f.topGoals} mål.` : "";
      return { headline: f.derby && local ? `Derbyt: ${headline}` : headline, standfirst: `${home}–${away} slutade ${score}.${scorer}`, body: [
        local ? `Inför ${f.crowd ? `${f.crowd} åskådare ` : ""}blev det ${result === "WIN" ? `en efterlängtad seger för ${own}` : result === "LOSS" ? `en kväll att glömma för ${own}` : "oavgjort"} mot ${opp}.` : `Matchen slutade ${score}.`,
        f.suspensions ? `Domarna delade ut ${f.suspensions} utvisningar.` : "",
        f.tablePos ? `${own} ligger nu ${f.tablePos}:a i tabellen.` : "",
      ].filter(Boolean) };
    }
    case "UPSET":
      return { headline: pick([`Skrällen: ${clubShort(f.winner)} slog ${clubShort(f.loser)}`, `${clubShort(f.winner)} chockade ${clubShort(f.loser)}`], s), standfirst: `${f.score}. ${clubShort(f.winner)} låg ${f.winnerPos}:a, ${clubShort(f.loser)} ${f.loserPos}:a före matchen.`, body: [`Ingen hade räknat med det, men ${clubShort(f.winner)} vände tabellen upp och ner.`, scope === "SPECIALIST" ? "Handbollskanalen analyserar vad som avgjorde." : ""].filter(Boolean) };
    case "DERBY_PREVIEW":
    case "BIG_MATCH_PREVIEW":
      return { headline: e.kind === "DERBY_PREVIEW" ? pick([`Derbyfeber inför ${home}–${away}`, `Staden laddar för derbyt`, `Allt står på spel i derbyt`], s) : `${String(f.angle ?? "Storstrid").split(" · ")[0]}: ${home} mot ${away}`, standfirst: `${home} (${f.homePos}:a) möter ${away} (${f.awayPos}:a) ${f.when}.`, body: [String(f.angle ?? ""), f.history ? `Senast: ${f.history}.` : ""].filter(Boolean) };
    case "TRANSFER":
    case "SALE":
      return { headline: local && f.from === e.clubIds[0] ? pick([`${who} lämnar ${clubShort(f.from)}`, `Klart: ${who} säljs till ${clubShort(f.to)}`], s) : local ? `${clubShort(f.to)} värvar ${who}` : pick([`Klart: ${who} till ${clubShort(f.to)}`, `${clubShort(f.to)} säkrar ${who}`], s), standfirst: `${who} går från ${clubName(f.from)} till ${clubName(f.to)}${f.fee ? ` för ${f.fee}` : ""}.`, body: [f.foreign ? "Ännu en svensk spelare lockas utomlands." : "Affären är en av de större i svensk handboll den här säsongen."] };
    case "TRANSFER_RUMOUR":
      return { headline: pick([`Uppgifter: ${clubShort(f.buyer)} vill ha ${who}`, `${who} lockar ${clubShort(f.buyer)}`], s), standfirst: `${clubShort(f.buyer)} har lagt ett bud på ${club}-spelaren, enligt ${MEDIA_OUTLETS[outletId]?.name}s uppgifter.`, body: ["Klubben vill inte kommentera."] };
    case "COACH_CHANGE":
      return f.change === "DISMISSED" ? { headline: pick([`${club} sparkar ${f.coach}`, `${f.coach} får gå i ${club}`], s), standfirst: `${clubFull} har skilts från huvudtränaren ${f.coach}. ${f.reason ?? ""}`, body: ["Klubben söker nu en ersättare."] } : { headline: pick([`${f.coach} ny tränare i ${club}`, `${club} har hittat sin nya tränare`], s), standfirst: `${f.coach} tar över ${clubFull}.`, body: [""].filter(Boolean) };
    case "MANAGER_DISMISSED":
      return { headline: local ? pick([`Sparkad: ${f.manager} lämnar ${club}`, `${club} bryter med tränaren`], s) : `${club} sparkar ${f.manager}`, standfirst: String(f.reason ?? `${clubFull} går skilda vägar med sin huvudtränare.`), body: ["Styrelsen motiverar beslutet med resultaten och förtroendet."] };
    case "MANAGER_APPOINTED":
      return { headline: pick([`${f.manager} ny tränare i ${club}`, `${club} presenterar ny huvudtränare`], s), standfirst: `${f.manager} skriver på för ${clubFull}${f.from ? ` efter tiden i ${clubShort(f.from)}` : ""}.`, body: [] };
    case "BOARD_PRESSURE":
      return { headline: pick([`Styrelsen oroad i ${club}`, `Pressen ökar på ${club}-tränaren`, `${club}: förtroendet sviktar`], s), standfirst: `Förtroendet för tränaren i ${clubFull} är ${f.confidence} av 100. ${f.detail ?? ""}`, body: [] };
    case "PLAYER_UNHAPPY":
      return { headline: pick([`${who} vill lämna ${club}`, `Missnöje: ${who} begär att få gå`], s), standfirst: String(f.reason ?? ""), body: [] };
    case "CRISIS":
      return { headline: pick([`Ekonomisk kris i ${club}`, `${club} på obestånd`], s), standfirst: `${clubFull} ligger under sin kredit.`, body: ["Klubbens ledning arbetar med en räddningsplan."] };
    case "TITLE":
      return { headline: local ? `SVENSKA MÄSTARE!` : `${club} svenska mästare`, standfirst: `${clubFull} vann SM-guldet ${f.season}.`, body: [local ? "Firandet pågick långt in på natten." : ""].filter(Boolean) };
    case "PROMOTION":
      return { headline: local ? pick([`${club} är klart för Handbollsligan`, `Uppflyttning!`], s) : `${club} upp i Handbollsligan`, standfirst: `${clubFull} spelar i Handbollsligan nästa säsong.`, body: [] };
    case "RELEGATION":
      return { headline: local ? pick([`Ett tungt besked: ${club} åker ur`, `${club} degraderat`], s) : `${club} åker ur Handbollsligan`, standfirst: `${clubFull} spelar i Allsvenskan nästa säsong.`, body: [] };
    case "AWARD":
      return { headline: `${who || f.name}: ${f.award}`, standfirst: String(f.detail ?? ""), body: [] };
    case "RECORD":
      return { headline: pick([`Rekord för ${who}`, `${who} skriver historia`], s), standfirst: String(f.detail ?? ""), body: [] };
    case "TALENT":
      return { headline: pick([`Talangen alla pratar om`, `${who}, ${f.age}, tar plats`, `Ny stjärna i ${club}`], s), standfirst: `${who} (${f.age}) har gjort ${f.goals} mål för ${clubFull} den här säsongen.`, body: [] };
    case "RIVAL_COMMENT":
      return { headline: String(f.headline ?? `${f.coach} om ${clubShort(f.target)}`), standfirst: `${f.coach}, tränare i ${club}, ${f.after ? "efter" : "inför"} mötet med ${clubShort(f.target)}.`, body: [] };
    case "INTERVIEW":
      return { headline: String(f.headline ?? "Tränaren om läget"), standfirst: String(f.standfirst ?? ""), body: [] };
    case "DISCIPLINE":
      return { headline: String(f.headline ?? "Disciplinnämnden har beslutat"), standfirst: String(f.detail ?? ""), body: [String(f.provision ?? "")].filter(Boolean) };
    case "CONTROVERSY":
      return { headline: pick([`Domarbesluten i fokus efter ${home}–${away}`, `Ilska efter utvisningarna`], s), standfirst: `${f.detail}`, body: [] };
    case "NATIONAL_TEAM":
      return { headline: String(f.headline), standfirst: String(f.standfirst), body: f.body ? [String(f.body)] : [] };
    case "FORM":
      return f.leaderChange ? { headline: pick([`${club} ny serieledare`, `${club} tar över toppen`], s), standfirst: String(f.detail), body: [] } : { headline: pick([`Krisen fördjupas i ${club}`, `${club} har tappat greppet`], s), standfirst: `${f.detail}`, body: [] };
  }
}

/** Turns an event into stories (once per event key), within the week's budget for other clubs' news. */
export function publish(state: CareerState, e: WorldEvent): CareerState {
  const m0 = mediaOf(state);
  if (m0.seen.includes(e.key)) return state;
  const own = e.clubIds.includes(state.playerClubId);
  const week = isoWeek(e.date);
  const count = m0.week.key === week ? m0.week.count : 0;
  if (!own && e.importance < 4 && count >= WEEKLY_WORLD_BUDGET) return withMedia(state, (m) => ({ ...m, seen: [...m.seen, e.key].slice(-800) }));
  let m: MediaState = { ...m0, seen: [...m0.seen, e.key].slice(-800), week: { key: week, count: own ? count : count + 1 } };
  const targets = outletsFor(state, e).slice(0, own ? 5 : e.importance >= 4 ? 4 : 3);
  for (const { outletId, scope } of targets) {
    const copy = writeStory(state, e, outletId, scope);
    if (!copy.headline) continue;
    const j = journalistFor(m, outletId, e.key);
    m = j.media;
    const story: NewsStory = { id: `story:${e.key}:${outletId}`, eventKey: e.key, date: e.date, kind: e.kind, outletId, scope, journalistId: j.journalist.id, ...copy, quote: e.quote, clubIds: e.clubIds, playerIds: e.playerIds, personIds: e.personIds, fixtureId: e.fixtureId, importance: e.importance, breaking: e.importance >= 4, destinations: e.destinations, ownClub: own };
    m = { ...m, stories: { ...m.stories, [story.id]: story } };
  }
  return { ...state, media: pruneStories(m) };
}

/** Keeps the archive bounded: all own-club and important stories, the most recent of the rest. */
function pruneStories(m: MediaState): MediaState {
  const all = Object.values(m.stories);
  if (all.length <= 1500) return m;
  const keep = all.filter((s) => s.ownClub || s.importance >= 4);
  const rest = all.filter((s) => !(s.ownClub || s.importance >= 4)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 700);
  return { ...m, stories: Object.fromEntries([...keep, ...rest].map((s) => [s.id, s])) };
}

/** The feed, newest first, one story per event unless `allOutlets`. */
export function feed(state: CareerState, opts: { scope?: StoryScope | "OWN"; query?: string; clubId?: string; allOutlets?: boolean; limit?: number } = {}): NewsStory[] {
  const q = opts.query?.trim().toLowerCase();
  let list = Object.values(mediaOf(state).stories);
  if (opts.scope === "OWN") list = list.filter((s) => s.ownClub);
  else if (opts.scope) list = list.filter((s) => s.scope === opts.scope);
  if (opts.clubId) list = list.filter((s) => s.clubIds.includes(opts.clubId!));
  if (q) list = list.filter((s) => `${s.headline} ${s.standfirst} ${s.body.join(" ")} ${MEDIA_OUTLETS[s.outletId]?.name ?? ""}`.toLowerCase().includes(q));
  list.sort((a, b) => b.date.localeCompare(a.date) || b.importance - a.importance);
  if (!opts.allOutlets && !opts.scope) {
    // One version per event: the local paper for the manager's own club, the widest reach for everyone else.
    const best = new Map<string, NewsStory>();
    const score = (s: NewsStory) => (s.ownClub ? (s.scope === "LOCAL" || s.scope === "REGIONAL" ? 10 : 0) - (MEDIA_OUTLETS[s.outletId]?.reach ?? 0) : MEDIA_OUTLETS[s.outletId]?.reach ?? 0);
    for (const s of list) { const cur = best.get(s.eventKey); if (!cur || score(s) > score(cur)) best.set(s.eventKey, s); }
    list = list.filter((s) => best.get(s.eventKey) === s);
  }
  return list.slice(0, opts.limit ?? 200);
}

/** Every outlet's version of the same event. */
export function coverageOf(state: CareerState, eventKey: string): NewsStory[] {
  return Object.values(mediaOf(state).stories).filter((s) => s.eventKey === eventKey).sort((a, b) => (MEDIA_OUTLETS[b.outletId]?.reach ?? 0) - (MEDIA_OUTLETS[a.outletId]?.reach ?? 0));
}
