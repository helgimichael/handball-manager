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
import { getClub, COMPETITIONS, type HandballPosition, type InboxCategory } from "../game-data";
import { getCareerSquad } from "./careerWorld";
import { squadEnergy } from "./management";
import { matchFitnessOf } from "../players/matchFitness";
import { annotatedStandings, zoneFor, type Zone } from "../competition/standingsZones";
import { competitionTable } from "../competition/tables";
import { clubCompetitionId } from "./competitionMembership";
import { COURT_POSITIONS, POSITION_NAME } from "../club/clubJournal";
import type { ClubFormEntry } from "./types";
import type { Dependency } from "../competition/transition/types";

export interface FrontPageEar { label: string; caption: string; value: number; delta: number | null; reason: string; href: string }
export type LeadKind = "LIVE" | "SEASON_COMPLETE" | "SEEKING_JOB" | "MATCHDAY" | "RESULT" | "BOARD" | "DEADLINE" | "INJURIES" | "PREVIEW" | "QUIET";
export interface LeadStory { kind: LeadKind; kicker: string; headline: string; standfirst: string; href: string; cta: string; fixtureId?: string }
export interface FrontDecision { n: number; title: string; detail: string; href: string; cta: string; urgent: boolean }
export interface LadderRow { position: number; clubId: string; name: string; played: number; points: number; goalDifference: number; own: boolean; zone: Pick<Zone, "label" | "tone"> | null; zoneStart: boolean }
/** DSH-01h: club briefs are ranked -- action required, then important, then unread, then the rest. */
export type BriefPriority = "ACTION" | "IMPORTANT" | "UNREAD" | "READ";
export interface Brief { id: string; text: string; detail: string; href: string; priority?: BriefPriority; category?: InboxCategory; sender?: string; date?: string }
export interface FrontPage {
  masthead: { title: string; club: string; week: number; date: string };
  ears: [FrontPageEar, FrontPageEar];
  lead: LeadStory;
  decisions: FrontDecision[];
  ladder: LadderRow[];
  leagueBriefs: Brief[];
  clubBriefs: Brief[];
  /** Unread, non-archived inbox messages (the 'Inkorgen (n)' link). */
  inboxUnread: number;
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
  // DSH-01b: the ladder carries the verified zone marks (SM-slutspel / kval / nedflyttning) of the own league.
  const marks = annotatedStandings(state, state.competitionId, table);
  const ladder = (idx < 0 ? table.slice(0, 5) : table.slice(from, from + 5)).map((r) => {
    const position = table.indexOf(r) + 1, mark = marks[position - 1];
    return { position, clubId: r.clubId, name: name(r.clubId), played: r.played, points: r.points, goalDifference: r.goalDifference, own: r.clubId === clubId, zone: mark?.zone ? { label: mark.zone.label, tone: mark.zone.tone } : null, zoneStart: !!mark?.zoneStart };
  });
  const league = state.fixtures.filter((f) => state.results[f.id] && f.competitionId === state.competitionId && f.homeClubId !== clubId && f.awayClubId !== clubId).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)).slice(0, 4);
  const leagueBriefs = league.map((f) => { const r = state.results[f.id]!; return { id: f.id, text: `${name(f.homeClubId)} ${r.homeGoals}–${r.awayGoals} ${name(f.awayClubId)}`, detail: f.date, href: matchReportHref(f.id) }; });
  return {
    masthead: { title: "Matchveckan", club: getClub(clubId)?.name ?? clubId, week: isoWeek(state.gameDate), date: state.gameDate },
    ears: ears(state), lead: lead(state), decisions: decisions(state), ladder, leagueBriefs, clubBriefs: rankedClubBriefs(state),
    inboxUnread: state.inbox.filter((m) => !m.archived && !m.read).length,
  };
}

// ---------------------------------------------------------------- DSH-01h ranked briefs
const PRIORITY_RANK: Record<BriefPriority, number> = { ACTION: 0, IMPORTANT: 1, UNREAD: 2, READ: 3 };
/** Three inbox briefs, most pressing first: an unresolved important message needs action, then important, unread, the rest (newest first within a rank). */
export function rankedClubBriefs(state: CareerState, limit = 3): Brief[] {
  return state.inbox.filter((m) => !m.archived).map((m, order) => {
    const priority: BriefPriority = m.important && !m.resolved ? "ACTION" : m.important ? "IMPORTANT" : !m.read ? "UNREAD" : "READ";
    return { m, order, priority };
  }).sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.m.date.localeCompare(a.m.date) || b.order - a.order)
    .slice(0, limit)
    .map(({ m, priority }) => ({ id: m.id, text: m.subject, detail: m.preview, href: `/career/inbox?message=${encodeURIComponent(m.id)}`, priority, category: m.category, sender: m.sender, date: m.date }));
}

// ---------------------------------------------------------------- DSH-01b match box + DSH-01g form strip
const WEEKDAY = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"];
export interface FormBlock { fixtureId: string; outcome: ClubFormEntry; score: string; opponentId: string; opponent: string; home: boolean; date: string; label: string; href: string }
export interface Readiness { total: number; available: number; doubtful: number; injured: number; suspended: number; away: number }
export interface MatchBoxNext {
  fixtureId: string; headline: string; when: string; countdown: string; days: number; competition: string; home: boolean;
  opponentId: string; opponent: string; opponentPosition: number | null; opponentTeams: number; opponentForm: ClubFormEntry[]; matchday: boolean; href: string;
}
export interface MatchBox { next: MatchBoxNext | null; readiness: Readiness; recent: FormBlock[] }

/** "Doubtful" = may be selected but is short of energy or match fitness, or is a LIMITED returner. */
function playerState(state: CareerState, p: ReturnType<typeof getCareerSquad>[number]): { state: "OK" | "DOUBT" | "OUT"; detail: string } {
  const st = state.playerStatuses[p.id];
  const availability = st?.availability ?? "AVAILABLE";
  const energy = Math.round(squadEnergy(state, p));
  const fitness = Math.round(matchFitnessOf(state, p.id));
  if (availability !== "AVAILABLE" && availability !== "LIMITED") {
    const back = state.playerInjuries[p.id]?.activeInjury?.expectedReturnDate ?? st?.returnDate;
    const label = availability === "INJURED" ? "Skadad" : availability === "SUSPENDED" ? "Avstängd" : availability === "RECOVERING" ? "Rehab" : availability === "NATIONAL_TEAM" ? "Landslaget" : "Utlånad";
    return { state: "OUT", detail: back ? `${label} · åter ${back}` : label };
  }
  if (availability === "LIMITED") return { state: "DOUBT", detail: `Begränsad · energi ${energy} %` };
  if (energy < 75) return { state: "DOUBT", detail: `Energi ${energy} % · matchträning ${fitness} %` };
  if (fitness < 50) return { state: "DOUBT", detail: `Låg matchträning ${fitness} % · energi ${energy} %` };
  return { state: "OK", detail: `Energi ${energy} % · matchträning ${fitness} %` };
}

export function squadReadiness(state: CareerState): Readiness {
  const squad = getCareerSquad(state);
  const r: Readiness = { total: squad.length, available: 0, doubtful: 0, injured: 0, suspended: 0, away: 0 };
  for (const p of squad) {
    const a = state.playerStatuses[p.id]?.availability ?? "AVAILABLE";
    if (a === "INJURED" || a === "RECOVERING") r.injured++;
    else if (a === "SUSPENDED") r.suspended++;
    else if (a === "ON_PLACEMENT" || a === "NATIONAL_TEAM") r.away++;
    else { r.available++; if (playerState(state, p).state === "DOUBT") r.doubtful++; }
  }
  return r;
}

/** Position in the club's own league table this season, with the table size; null when the league has no simulated table. */
export function clubLeaguePosition(state: CareerState, clubId: string): { position: number | null; teams: number } {
  const comp = clubCompetitionId(state, clubId);
  if (!comp) return { position: null, teams: 0 };
  const table = comp === state.competitionId ? getLiveStandings(state) : competitionTable(state, comp);
  const i = table.findIndex((r) => r.clubId === clubId);
  return { position: i < 0 || !table.some((r) => r.played > 0) ? null : i + 1, teams: table.length };
}

export function buildMatchBox(state: CareerState): MatchBox {
  const club = state.playerClubId;
  const own = (f: { homeClubId: string; awayClubId: string }) => f.homeClubId === club || f.awayClubId === club;
  const nextFixture = state.managerCareer?.seekingJob ? undefined : state.fixtures.filter((f) => own(f) && !state.results[f.id] && f.date >= state.gameDate).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))[0];
  let next: MatchBoxNext | null = null;
  if (nextFixture) {
    const home = nextFixture.homeClubId === club, opponentId = home ? nextFixture.awayClubId : nextFixture.homeClubId;
    const days = daysBetween(state.gameDate, nextFixture.date);
    const weekday = WEEKDAY[new Date(`${nextFixture.date}T00:00:00Z`).getUTCDay()]!;
    const day = days === 0 ? "I dag" : days === 1 ? "I morgon" : weekday;
    const { position, teams } = clubLeaguePosition(state, opponentId);
    const comp = nextFixture.type === "LEAGUE" ? `${COMPETITIONS.find((c) => c.id === nextFixture.competitionId)?.name ?? "Ligan"} · omgång ${nextFixture.round}` : nextFixture.type === "CUP" ? "Svenska Cupen" : nextFixture.type === "PLAYOFF" ? "SM-slutspel" : nextFixture.type === "QUALIFIER" ? "Kvalspel" : "Träningsmatch";
    next = {
      fixtureId: nextFixture.id, headline: `${day}: ${name(opponentId)} ${home ? "hemma" : "borta"}`,
      when: `${weekday} ${nextFixture.date}${nextFixture.kickoffTime ? ` · ${nextFixture.kickoffTime}` : ""}`,
      countdown: days === 0 ? "Matchdag" : days === 1 ? "om 1 dag" : `om ${days} dagar`, days, competition: comp, home,
      opponentId, opponent: getClub(opponentId)?.name ?? opponentId, opponentPosition: position, opponentTeams: teams,
      opponentForm: (state.clubForm[opponentId] ?? []).slice(-5), matchday: days === 0, href: `/career/fixtures/${encodeURIComponent(nextFixture.id)}`,
    };
  }
  const recent = state.fixtures.filter((f) => own(f) && state.results[f.id]).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 5).reverse().map((f): FormBlock => {
    const r = state.results[f.id]!, home = f.homeClubId === club;
    const ours = home ? r.homeGoals : r.awayGoals, theirs = home ? r.awayGoals : r.homeGoals;
    const decided = r.decider?.winnerClubId;
    const outcome: ClubFormEntry = decided ? (decided === club ? "W" : "L") : ours > theirs ? "W" : ours < theirs ? "L" : "D";
    const opponentId = home ? f.awayClubId : f.homeClubId;
    return { fixtureId: f.id, outcome, score: `${ours}–${theirs}`, opponentId, opponent: name(opponentId), home, date: f.date, label: f.type === "LEAGUE" ? `Omgång ${f.round}` : f.type === "CUP" ? "Cup" : f.type === "FRIENDLY" ? "Träningsmatch" : f.type === "PLAYOFF" ? "Slutspel" : "Kval", href: matchReportHref(f.id) };
  });
  return { next, readiness: squadReadiness(state), recent };
}

// ---------------------------------------------------------------- DSH-01e court coverage
export type DotState = "OK" | "DOUBT" | "OUT";
export interface CoveragePlayer { id: string; name: string; shirt: number | null; state: DotState; detail: string }
export interface CoverageSpot { position: HandballPosition; name: string; tone: "good" | "warn" | "bad"; players: CoveragePlayer[]; cover: { id: string; name: string; position: string }[]; fit: number; selectable: number }
/** Per court position: natural players as dots (fit / doubtful / out) and available cover from secondary positions. Thin spots glow. */
export function courtCoverage(state: CareerState): CoverageSpot[] {
  const squad = getCareerSquad(state);
  const order: Record<DotState, number> = { OK: 0, DOUBT: 1, OUT: 2 };
  return COURT_POSITIONS.map((position) => {
    const players = squad.filter((p) => p.position === position).map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`, shirt: p.shirtNumber ?? null, ...playerState(state, p) })).sort((a, b) => order[a.state] - order[b.state] || a.name.localeCompare(b.name, "sv"));
    const cover = squad.filter((p) => p.position !== position && (p.secondaryPositions ?? (p.secondaryPosition ? [p.secondaryPosition] : [])).includes(position) && playerState(state, p).state !== "OUT").map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`, position: p.position }));
    const fit = players.filter((p) => p.state === "OK").length, selectable = players.filter((p) => p.state !== "OUT").length;
    return { position, name: POSITION_NAME[position], tone: selectable === 0 ? "bad" : fit >= 2 ? "good" : "warn", players, cover, fit, selectable };
  });
}

// ---------------------------------------------------------------- DSH-01c season curtain
export interface SeasonCurtain {
  seasonId: string; competition: string; position: number | null; teams: number; points: number | null;
  record: { won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number } | null;
  zone: Pick<Zone, "label" | "tone"> | null; honours: string[];
  topScorer: { id: string; name: string; goals: number; appearances: number } | null;
  board: { confidence: number; met: number; partly: number; failed: number; total: number; verdict: string; tone: "pos" | "warn" | "neg" } | null;
  reputation: { value: number; delta: number } | null;
}
/** The completed season told in four beats, from stored facts only. `objectives` are the board's own final evaluation. */
export function buildSeasonCurtain(state: CareerState, objectives: readonly { status: string }[] = []): SeasonCurtain {
  const club = state.playerClubId;
  const table = getLiveStandings(state);
  const i = table.findIndex((r) => r.clubId === club), row = i < 0 ? undefined : table[i]!;
  const outcome = state.seasonOutcome?.seasonId === state.seasonId ? state.seasonOutcome : undefined;
  const honours: string[] = [];
  if (outcome?.champion === club) honours.push("Svenska mästare");
  else if (outcome?.runnerUp === club) honours.push("SM-silver");
  if (outcome?.regularSeasonWinners?.[state.competitionId] === club) honours.push("Seriesegrare");
  if (outcome?.cupWinner === club) honours.push("Vinnare av Svenska Cupen");
  if (outcome?.promoted.includes(club)) honours.push("Uppflyttning");
  if (outcome?.relegated.includes(club)) honours.push("Nedflyttning");
  const squadIds = new Set(getCareerSquad(state).map((p) => p.id));
  const top = Object.values(state.playerSeasonStats).filter((s) => squadIds.has(s.playerId) && s.goals > 0).sort((a, b) => b.goals - a.goals || a.appearances - b.appearances)[0];
  const topPlayer = top ? getCareerSquad(state).find((p) => p.id === top.playerId) : undefined;
  const b = state.board;
  const count = (s: string) => objectives.filter((o) => o.status === s).length;
  const seasonStart = `${state.seasonId.slice(0, 4)}-07-01`;
  const mc = state.managerCareer;
  return {
    seasonId: state.seasonId, competition: COMPETITIONS.find((c) => c.id === state.competitionId)?.name ?? state.competitionId,
    position: row ? i + 1 : null, teams: table.length, points: row?.points ?? null,
    record: row ? { won: row.won, drawn: row.drawn, lost: row.lost, goalsFor: row.goalsFor, goalsAgainst: row.goalsAgainst } : null,
    zone: row ? (() => { const z = zoneFor(state.competitionId, i + 1); return z ? { label: z.label, tone: z.tone } : null; })() : null,
    honours,
    topScorer: top && topPlayer ? { id: top.playerId, name: `${topPlayer.firstName} ${topPlayer.lastName}`, goals: top.goals, appearances: top.appearances } : null,
    board: b ? { confidence: b.confidence, met: count("MET"), partly: count("PARTLY_MET"), failed: count("FAILED"), total: objectives.length, verdict: b.confidence >= 60 ? "Styrelsen är nöjd" : b.confidence >= 35 ? "Styrelsen avvaktar" : "Styrelsen är missnöjd", tone: b.confidence >= 60 ? "pos" : b.confidence >= 35 ? "warn" : "neg" } : null,
    reputation: mc ? { value: mc.reputation, delta: (mc.reputationLog ?? []).filter((e) => e.date >= seasonStart).reduce((s, e) => s + e.delta, 0) } : null,
  };
}

/** Human-readable copy for a season-transition blocker. The code stays available as technical detail; it is never the headline. */
export function describeTransitionBlocker(d: Pick<Dependency, "code">): { title: string; detail: string } {
  const c = d.code;
  if (c === "ACTIVE_MATCH") return { title: "En match pågår", detail: "Spela klart matchen innan säsongen byts." };
  if (/UNPLAYED|SEASON_NOT_COMPLETE|TRANSITION_NOT_READY|AWAITS/.test(c)) return { title: "Säsongen har matcher kvar", detail: "Alla tävlingsmatcher måste vara spelade innan nästa säsong kan lottas. Fortsätt i kalendern." };
  if (/QUALIFICATION|KVAL|DECIDER|SERIES|TIE_CONFLICT|MUTUAL/.test(c)) return { title: "Kval eller slutspel är inte avgjort", detail: "Placeringarna i kvalet avgör nästa säsongs serier. Spela klart kvalmatcherna eller vänta på deras datum." };
  if (c.startsWith("PARENT_PRIORITY")) return { title: "A- och B-lag kan inte placeras", detail: "Ett B-lag måste lämna plats åt sitt A-lag, men ingen serie kan ta emot det enligt reglerna." };
  if (/GEOGRAPHY|POOL|GROUP/.test(c)) return { title: "Seriernas indelning kan inte avgöras", detail: "Nästa säsongs geografiska grupper kräver uppgifter som spelet saknar." };
  if (/RULES|PROFILE|ADMINISTRATIVE|VACANCY|UNSUPPORTED|OFFICIAL|RULE_SOURCE/.test(c)) return { title: "Nästa säsongs regler är inte verifierade", detail: "Spelet gissar inte tävlingsregler. Säsongsbytet väntar tills reglerna finns." };
  if (/ARCHIVED|STALE|ALREADY/.test(c)) return { title: "Säsongsbytet är redan gjort", detail: "Ladda om sidan för att se den nya säsongen." };
  return { title: "Säsongsdata stämmer inte", detail: "En kontroll av tabeller och serier gick inte igenom. Karriären är oförändrad." };
}
