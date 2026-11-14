// Arena Nights C5.2 -- DSH-01 (C) "Today's Paper", Arena adaptation "Matchweek Front Page".
// A pure model over real career state: masthead with two ears (board confidence | manager reputation,
// each with delta and reason), a lead story chosen from game state, numbered decisions ("Att avgöra"),
// a ±2 ladder and around-the-league / from-the-club briefs. Nothing is invented: every line comes from
// a stored fact and links to the screen where it is handled.
import type { CareerState } from "./types";
import { addDays } from "./dateUtils";
import { getLiveStandings } from "./standings";
import { managementAttention } from "./management";
import { resolveDestinationHref } from "./destinations";
import { matchReportHref } from "./fixtureRoutes";
import { isTransferWindowOpen } from "../transfers/transferWindow";
import { mediaOf } from "../media/people";
import { getClub } from "../game-data";

export interface FrontPageEar { label: string; caption: string; value: number; delta: number | null; reason: string; href: string }
export type LeadKind = "LIVE" | "SEASON_COMPLETE" | "SEEKING_JOB" | "MATCHDAY" | "RESULT" | "BOARD" | "DEADLINE" | "INJURIES" | "PREVIEW" | "QUIET";
export interface LeadStory { kind: LeadKind; kicker: string; headline: string; standfirst: string; href: string; cta: string; fixtureId?: string }
export interface FrontDecision { n: number; title: string; detail: string; href: string; cta: string; urgent: boolean }
export interface LadderRow { position: number; clubId: string; name: string; played: number; points: number; goalDifference: number; own: boolean }
export interface Brief { id: string; text: string; detail: string; href: string }
export interface FrontPage {
  masthead: { title: string; club: string; week: number; date: string };
  ears: [FrontPageEar, FrontPageEar];
  lead: LeadStory;
  decisions: FrontDecision[];
  ladder: LadderRow[];
  leagueBriefs: Brief[];
  clubBriefs: Brief[];
}

const name = (id: string) => getClub(id)?.shortName ?? id;
const DAY_MS = 86_400_000;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);

/** ISO-8601 week number of a YYYY-MM-DD date (UTC, deterministic). */
export function isoWeek(date: string): number {
  const d = new Date(`${date}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / DAY_MS - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

function ears(state: CareerState): [FrontPageEar, FrontPageEar] {
  const b = state.board;
  const hist = b?.history ?? [];
  const prev = [...hist].reverse().find((h) => h.date < state.gameDate && h.confidence !== b?.confidence);
  const topFactor = [...(b?.factors ?? [])].sort((x, y) => Math.abs(y.points) - Math.abs(x.points))[0];
  const board: FrontPageEar = {
    label: "Förtroende", caption: "styrelsen", value: b?.confidence ?? 50,
    delta: b && prev ? b.confidence - prev.confidence : null,
    reason: topFactor ? `${topFactor.label} (${topFactor.points > 0 ? "+" : ""}${topFactor.points})` : "Styrelsen bedömer utvecklingen månadsvis.",
    href: "/career/board",
  };
  const mc = state.managerCareer;
  const last = mc?.reputationLog?.at(-1);
  const rep: FrontPageEar = {
    label: "Rykte", caption: "manager", value: mc?.reputation ?? 50,
    delta: last ? last.delta : null, reason: last ? last.reason : "Ryktet byggs säsong för säsong.", href: "/career/manager",
  };
  return [board, rep];
}

function lead(state: CareerState): LeadStory {
  const club = state.managerCareer?.seekingJob ? undefined : state.playerClubId;
  const session = state.activeMatchSession;
  if (state.productionMatch || (session && session.clock.phase !== "PRE_MATCH" && session.clock.phase !== "FULL_TIME")) {
    const fixtureId = state.productionMatch?.fixture.id ?? session!.fixtureId;
    return { kind: "LIVE", kicker: "Direkt", headline: "Matchen pågår", standfirst: "Laget står på planen. Gå tillbaka till matchen – tiden går inte utan dig.", href: `/career/match-day/${encodeURIComponent(fixtureId)}`, cta: "Till matchen", fixtureId };
  }
  if (state.seasonComplete) return { kind: "SEASON_COMPLETE", kicker: `Säsongen ${state.seasonId}`, headline: "Säsongen är i mål", standfirst: "Sluttabellen står. Se över avtalen och starta nästa säsong när truppen är klar.", href: `/career/competitions/${encodeURIComponent(state.competitionId)}`, cta: "Sluttabellen" };
  if (!club) {
    const former = state.managerCareer?.seekingJob?.clubId;
    return { kind: "SEEKING_JOB", kicker: "Jobbmarknaden", headline: "Du står utan klubb", standfirst: `${former ? `${name(former)} leds nu av en tillförordnad tränare. ` : ""}Kalendern fortsätter och klubbar med lediga tjänster hör av sig.`, href: "/career/manager?tab=jobs", cta: "Lediga jobb" };
  }
  const own = (f: { homeClubId: string; awayClubId: string }) => f.homeClubId === club || f.awayClubId === club;
  const today = state.fixtures.find((f) => f.date === state.gameDate && own(f) && !state.results[f.id]);
  if (today) {
    const home = today.homeClubId === club;
    return { kind: "MATCHDAY", kicker: `Matchdag · ${today.type === "LEAGUE" ? `omgång ${today.round}` : today.type === "CUP" ? "Cup" : "Träningsmatch"}`, headline: `${name(today.homeClubId)} – ${name(today.awayClubId)}`, standfirst: `${home ? "Hemma" : "Borta"} i dag. Sätt matchtruppen, välj plan och gå ut på planen.`, href: `/career/fixtures/${encodeURIComponent(today.id)}`, cta: "Förbered match", fixtureId: today.id };
  }
  const recent = state.fixtures.filter((f) => own(f) && state.results[f.id] && daysBetween(f.date, state.gameDate) <= 2 && f.date <= state.gameDate).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (recent) {
    const r = state.results[recent.id]!;
    const home = recent.homeClubId === club;
    const ours = home ? r.homeGoals : r.awayGoals, theirs = home ? r.awayGoals : r.homeGoals;
    const verdict = ours > theirs ? "Seger" : ours < theirs ? "Förlust" : "Oavgjort";
    return { kind: "RESULT", kicker: `${verdict} · ${recent.type === "LEAGUE" ? `omgång ${recent.round}` : recent.type === "CUP" ? "Cup" : "Träningsmatch"}`, headline: `${name(recent.homeClubId)} ${r.homeGoals}–${r.awayGoals} ${name(recent.awayClubId)}`, standfirst: `${verdict} ${home ? "hemma" : "borta"} mot ${name(home ? recent.awayClubId : recent.homeClubId)}. Matchrapporten visar varför.`, href: matchReportHref(recent.id), cta: "Matchrapport", fixtureId: recent.id };
  }
  const meeting = [...(state.board?.meetings ?? [])].reverse().find((m) => (m.kind === "WARNING" || m.kind === "FINAL_WARNING") && daysBetween(m.date, state.gameDate) <= 7 && m.date <= state.gameDate);
  if (meeting) return { kind: "BOARD", kicker: "Styrelsen", headline: meeting.title, standfirst: meeting.summary, href: "/career/board", cta: "Styrelserummet" };
  if (isTransferWindowOpen(state.gameDate)) {
    const left = [0, 1, 2, 3].find((d) => !isTransferWindowOpen(addDays(state.gameDate, d + 1)));
    if (left !== undefined) return { kind: "DEADLINE", kicker: "Transferfönstret", headline: left === 0 ? "Sista dagen i transferfönstret" : `Transferfönstret stänger om ${left + 1} dagar`, standfirst: "Affärer som inte är klara nu får vänta till nästa fönster.", href: "/career/transfers", cta: "Transfers" };
  }
  const attention = managementAttention(state);
  if (attention.unavailable.length >= 3) return { kind: "INJURIES", kicker: "Truppläget", headline: `${attention.unavailable.length} spelare kan inte spela`, standfirst: "Skador och avstängningar tunnar ut truppen. Se över belastning och matchtrupp.", href: "/career/medical", cta: "Medicinskt" };
  const next = state.fixtures.filter((f) => own(f) && !state.results[f.id] && f.date >= state.gameDate).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))[0];
  if (next) {
    const home = next.homeClubId === club, opp = home ? next.awayClubId : next.homeClubId, days = daysBetween(state.gameDate, next.date);
    return { kind: "PREVIEW", kicker: `Nästa match · om ${days} ${days === 1 ? "dag" : "dagar"}`, headline: `${home ? "Hemma" : "Borta"} mot ${name(opp)}`, standfirst: "Bygg veckan runt matchen: träning, återhämtning och motståndaranalys.", href: `/career/fixtures/${encodeURIComponent(next.id)}`, cta: "Matchförberedelse", fixtureId: next.id };
  }
  return { kind: "QUIET", kicker: "Klubbjournalen", headline: "En lugn vecka", standfirst: "Inga matcher inplanerade. Använd tiden till truppen och rekryteringen.", href: "/career/squad", cta: "Truppen" };
}

function decisions(state: CareerState): FrontDecision[] {
  const out: Omit<FrontDecision, "n">[] = [];
  const events = state.careerEvents.filter((e) => e.requiresAction && !e.resolved).sort((a, b) => (a.priority === b.priority ? a.date.localeCompare(b.date) : a.priority === "ACTION_REQUIRED" ? -1 : 1));
  for (const e of events) out.push({ title: e.subject, detail: e.summary, href: e.destinations.map(resolveDestinationHref).find((h): h is string => !!h) ?? "/career/inbox", cta: "Hantera", urgent: e.priority === "ACTION_REQUIRED" });
  const pressInEvents = events.some((e) => e.type === "MEDIA");
  if (!pressInEvents) for (const p of Object.values(mediaOf(state).press ?? {}).filter((x) => x.status === "OPEN" && x.expiresOn >= state.gameDate)) out.push({ title: p.title, detail: `Svara senast ${p.expiresOn}.`, href: "/career/media", cta: "Svara", urgent: false });
  if (!state.managerCareer?.seekingJob) {
    const expiring = managementAttention(state).contracts.filter((r) => r.status === "EXPIRING");
    if (expiring.length) out.push({ title: `${expiring.length} avtal löper ut snart`, detail: expiring.slice(0, 3).map((r) => `${r.player.firstName} ${r.player.lastName}`).join(", "), href: "/career/contracts", cta: "Kontrakten", urgent: false });
  }
  const offer = state.board?.contractOffer;
  if (offer) out.push({ title: "Styrelsen erbjuder ett nytt avtal", detail: "Ta ställning till förlängningen.", href: "/career/board", cta: "Styrelsen", urgent: false });
  return out.slice(0, 5).map((d, i) => ({ ...d, n: i + 1 }));
}

export function buildFrontPage(state: CareerState): FrontPage {
  const clubId = state.playerClubId;
  const table = getLiveStandings(state);
  const idx = table.findIndex((r) => r.clubId === clubId);
  const from = idx < 0 ? 0 : Math.max(0, Math.min(idx - 2, table.length - 5));
  const ladder = (idx < 0 ? table.slice(0, 5) : table.slice(from, from + 5)).map((r) => ({ position: table.indexOf(r) + 1, clubId: r.clubId, name: name(r.clubId), played: r.played, points: r.points, goalDifference: r.goalDifference, own: r.clubId === clubId }));
  const league = state.fixtures.filter((f) => state.results[f.id] && f.competitionId === state.competitionId && f.homeClubId !== clubId && f.awayClubId !== clubId).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)).slice(0, 4);
  const leagueBriefs = league.map((f) => { const r = state.results[f.id]!; return { id: f.id, text: `${name(f.homeClubId)} ${r.homeGoals}–${r.awayGoals} ${name(f.awayClubId)}`, detail: f.date, href: matchReportHref(f.id) }; });
  const clubBriefs = [...state.inbox].filter((m) => !m.archived).reverse().slice(0, 3).map((m) => ({ id: m.id, text: m.subject, detail: m.preview, href: `/career/inbox?message=${encodeURIComponent(m.id)}` }));
  return {
    masthead: { title: "Matchveckan", club: getClub(clubId)?.name ?? clubId, week: isoWeek(state.gameDate), date: state.gameDate },
    ears: ears(state), lead: lead(state), decisions: decisions(state), ladder, leagueBriefs, clubBriefs,
  };
}
