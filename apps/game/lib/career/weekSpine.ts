// Arena Nights C5.1 -- the Week Spine (ENT-07 C / DSH-01i / ENT-10 / WLD-05): the game clock as a
// Monday-Sunday strip built ONLY from real career state. Pure and deterministic: no Date.now(),
// no invented events. Every pin links to an existing route.
import type { CareerState } from "./types";
import { addDays } from "./dateUtils";
import { mondayOf, resolveTrainingWeek } from "../training/trainingSchedule";
import { SESSION_TYPE_LABEL } from "../training/labels";
import { isTransferWindowOpen } from "../transfers/transferWindow";
import { contractRows } from "./management";
import { resolveDestinationHref } from "./destinations";
import { matchReportHref } from "./fixtureRoutes";
import { mediaOf } from "../media/people";
import { getClub } from "../game-data";

export type SpinePinKind = "MATCH" | "RESULT" | "ACTION" | "PRESS" | "BOARD" | "WINDOW" | "TRANSFER" | "CONTRACT" | "SCOUTING" | "KICKOFF";

export interface SpinePin {
  id: string;
  kind: SpinePinKind;
  /** Short label for the pin (fits a day cell). */
  label: string;
  /** Full sentence for the tooltip / screen reader ("what happens"). */
  detail: string;
  href: string;
}

export interface SpineDay {
  date: string;
  /** Mon..Sun (Swedish short). */
  weekday: string;
  dayOfMonth: number;
  isToday: boolean;
  isPast: boolean;
  /** Training day type from the club's real training week (MATCH / TRAINING / RECOVERY / REST / TRAVEL). */
  dayType: string;
  /** Planned or executed training sessions, by label. */
  sessions: string[];
  pins: SpinePin[];
  /** Continue stops on this day (the next own match, or today while decisions are pending). */
  continueStop: boolean;
}

export interface UpNextItem { date: string; label: string; href: string; kind: SpinePinKind }

export interface WeekSpine {
  weekStart: string;
  days: SpineDay[];
  /** The next own match (any week), for the chip at the Spine's right end. */
  nextMatch?: { fixtureId: string; date: string; opponentId: string; opponent: string; home: boolean; daysUntil: number; competition: string; href: string };
  /** ENT-10: the next three things, in order, from today. */
  upNext: UpNextItem[];
  /** Unresolved decisions that hold Continue right now. */
  pendingDecisions: number;
}

const WEEKDAY = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"];
const DAY_MS = 86_400_000;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
const managed = (s: CareerState) => (s.managerCareer?.seekingJob ? undefined : s.playerClubId);
const fixtureLabel = (type: string, round?: number) => (type === "LEAGUE" ? `omg ${round ?? ""}`.trim() : type === "CUP" ? "Cup" : "Träningsmatch");

/** Pins for one date (pure). Shared by the Spine and the up-next queue. */
export function pinsOn(state: CareerState, date: string, cache = spineCache(state)): SpinePin[] {
  const pins: SpinePin[] = [];
  const club = managed(state);
  if (club) {
    for (const f of state.fixtures) {
      if (f.date !== date || (f.homeClubId !== club && f.awayClubId !== club)) continue;
      const home = f.homeClubId === club;
      const oppId = home ? f.awayClubId : f.homeClubId;
      const opp = getClub(oppId)?.shortName ?? oppId;
      const result = state.results[f.id];
      if (result) {
        const ours = home ? result.homeGoals : result.awayGoals, theirs = home ? result.awayGoals : result.homeGoals;
        pins.push({ id: `result:${f.id}`, kind: "RESULT", label: `${ours}–${theirs} ${opp}`, detail: `${fixtureLabel(f.type, f.round)} · ${home ? "hemma mot" : "borta mot"} ${opp}: ${ours}–${theirs}`, href: matchReportHref(f.id) });
      } else {
        pins.push({ id: `match:${f.id}`, kind: "MATCH", label: `${opp} (${home ? "H" : "B"})`, detail: `${fixtureLabel(f.type, f.round)} · ${opp} ${home ? "hemma" : "borta"}`, href: `/career/fixtures/${encodeURIComponent(f.id)}` });
      }
    }
  }
  for (const e of cache.actions) {
    if ((e.date <= state.gameDate ? state.gameDate : e.date) !== date) continue;
    const href = e.destinations.map(resolveDestinationHref).find((h): h is string => !!h) ?? "/career/inbox";
    pins.push({ id: `action:${e.id}`, kind: "ACTION", label: e.subject, detail: `Att avgöra: ${e.subject}`, href });
  }
  for (const p of cache.press) if (p.date === date) pins.push({ id: `press:${p.id}`, kind: "PRESS", label: "Presskonferens", detail: p.title, href: "/career/media" });
  for (const m of cache.board) if (m.date === date) pins.push({ id: `board:${m.id}`, kind: "BOARD", label: "Styrelsemöte", detail: m.title, href: "/career/board" });
  const open = isTransferWindowOpen(date);
  if (open && !isTransferWindowOpen(addDays(date, -1))) pins.push({ id: `window-open:${date}`, kind: "WINDOW", label: "Fönstret öppnar", detail: "Transferfönstret öppnar", href: "/career/transfers" });
  if (open && !isTransferWindowOpen(addDays(date, 1))) pins.push({ id: `window-close:${date}`, kind: "WINDOW", label: "Fönstret stänger", detail: "Sista dagen i transferfönstret", href: "/career/transfers" });
  for (const o of cache.transfers) if (o.scheduledCompletionDate === date) pins.push({ id: `transfer:${o.id}`, kind: "TRANSFER", label: "Övergång", detail: `Planerad övergång från ${getClub(o.fromClubId)?.shortName ?? "fri agent"}`, href: `/career/squad/${encodeURIComponent(o.playerId)}` });
  for (const r of cache.contracts) if (r.contract?.contractEndDate === date) pins.push({ id: `contract:${r.player.id}`, kind: "CONTRACT", label: "Avtal löper ut", detail: `${r.player.firstName} ${r.player.lastName}: avtalet löper ut`, href: `/career/squad/${encodeURIComponent(r.player.id)}` });
  for (const a of cache.scouting) if (a.endDate === date) pins.push({ id: `scouting:${a.id}`, kind: "SCOUTING", label: "Scouting klar", detail: "Scoutinguppdraget beräknas klart", href: "/career/scouting" });
  if (state.leagueKickoffDate === date) pins.push({ id: `kickoff:${date}`, kind: "KICKOFF", label: "Ligastart", detail: "Ligan startar", href: `/career/competitions/${encodeURIComponent(state.competitionId)}` });
  return pins;
}

function spineCache(state: CareerState) {
  const club = managed(state);
  return {
    actions: state.careerEvents.filter((e) => e.requiresAction && !e.resolved),
    press: Object.values(mediaOf(state).press ?? {}).filter((p) => p.status === "OPEN"),
    board: state.board?.meetings ?? [],
    transfers: Object.values(state.transferOffers ?? {}).filter((o) => o.status === "AGREED_AWAITING_WINDOW" && o.toClubId === club && o.scheduledCompletionDate),
    contracts: club ? contractRows(state) : [],
    scouting: Object.values(state.scoutingAssignments ?? {}).filter((a) => a.status === "IN_PROGRESS"),
  };
}

/** The week containing `anchor` (default: today), Monday first. */
export function buildWeekSpine(state: CareerState, anchor = state.gameDate): WeekSpine {
  const weekStart = mondayOf(anchor);
  const cache = spineCache(state);
  const club = managed(state);
  const training = club ? resolveTrainingWeek(state, weekStart) : undefined;
  const nextOwn = club
    ? state.fixtures.filter((f) => !state.results[f.id] && f.date >= state.gameDate && (f.homeClubId === club || f.awayClubId === club)).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))[0]
    : undefined;
  const pendingDecisions = cache.actions.length;
  const stopDate = pendingDecisions ? state.gameDate : nextOwn?.date;
  const days: SpineDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const t = training?.days.find((d) => d.date === date);
    days.push({
      date, weekday: WEEKDAY[new Date(`${date}T00:00:00Z`).getUTCDay()]!, dayOfMonth: Number(date.slice(8, 10)),
      isToday: date === state.gameDate, isPast: date < state.gameDate,
      dayType: t?.dayType ?? "REST", sessions: (t?.sessions ?? []).map((s) => SESSION_TYPE_LABEL[s.type] ?? s.type),
      pins: pinsOn(state, date, cache), continueStop: date === stopDate,
    });
  }
  const nextMatch = nextOwn && club ? (() => {
    const home = nextOwn.homeClubId === club;
    const opponentId = home ? nextOwn.awayClubId : nextOwn.homeClubId;
    return { fixtureId: nextOwn.id, date: nextOwn.date, opponentId, opponent: getClub(opponentId)?.shortName ?? opponentId, home, daysUntil: daysBetween(state.gameDate, nextOwn.date), competition: fixtureLabel(nextOwn.type, nextOwn.round), href: `/career/fixtures/${encodeURIComponent(nextOwn.id)}` };
  })() : undefined;
  // ENT-10 up-next: scan forward (bounded) for the next three pinned things, results excluded.
  const upNext: UpNextItem[] = [];
  for (let i = 0; i < 60 && upNext.length < 3; i++) {
    const date = addDays(state.gameDate, i);
    for (const p of pinsOn(state, date, cache)) if (p.kind !== "RESULT" && upNext.length < 3) upNext.push({ date, label: p.detail, href: p.href, kind: p.kind });
  }
  return { weekStart, days, nextMatch, upNext, pendingDecisions };
}
