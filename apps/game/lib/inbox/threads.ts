// Arena Nights 231 -- WLD-01 / 01a / 01b: the Correspondence Desk view model.
//
// Pure, read-only presentation over existing state. Threads are derived
// only from fields the messages and their career events already carry
// (careerEventId -> primaryEntity, typed destinations, id prefixes); no
// new event links are invented. Decisions are the existing mutations
// (answerConcern, decideTransferRequest, submitBoardRecoveryPlan, the
// press actions) -- this module only says which one applies and what its
// outcome was.
//
// Grouping rules (in order):
//   1. careerEvent.primaryEntity of type player / fixture / competition
//   2. a destination naming one entity (PLAYER_PROFILE, SCOUT_REPORT,
//      NEGOTIATION, MATCH_REPORT, MATCH_DAY, TRANSFER_OFFER, STAFF_MEMBER,
//      PRESS -> the press conference's fixture when it has one)
//   3. the event type's standing counterpart (BOARD_UPDATE -> board,
//      MANAGER_CAREER -> your career, CLUB_FINANCE -> club finances)
//   4. otherwise the message is its own thread (documented gap: club news,
//      training reports and generic staff reports carry no entity link).
import type { CareerEvent } from "../career/careerEvents";
import { filterInboxMessages, matchesInboxFilter, type InboxFilterId } from "../career/inboxFilters";
import type { CareerState } from "../career/types";
import type { InboxMessage } from "../game-data";
import { boardOf } from "../board/board";
import { dynamicsOf } from "../players/dynamicsState";
import { mediaOf } from "../media/people";
import type { Consequence, NewsStory, PressConference } from "../media/types";
import type { TalkOption } from "../players/types";

// ---------------------------------------------------------------------------
// Segment + chips (WLD-01a)
// ---------------------------------------------------------------------------

export type InboxSegment = "todo" | "all" | "archive";
export const INBOX_SEGMENTS: { id: InboxSegment; label: string }[] = [
  { id: "todo", label: "Att göra" },
  { id: "all", label: "Allt" },
  { id: "archive", label: "Arkiv" },
];
export type InboxChip = Exclude<InboxFilterId, "ALL" | "ACTION_REQUIRED" | "ARCHIVED">;
export const INBOX_CHIPS: { id: InboxChip; label: string }[] = [
  { id: "UNREAD", label: "Olästa" },
  { id: "CONTRACTS", label: "Kontrakt" },
  { id: "TRANSFERS", label: "Transfers" },
  { id: "ANALYSIS", label: "Analys" },
  { id: "SCOUTING", label: "Scouting" },
  { id: "STAFF", label: "Tränarstab" },
];

export function parseSegment(v: string | null | undefined): InboxSegment {
  return v === "todo" || v === "archive" ? v : "all";
}
export function parseChips(v: string | null | undefined): InboxChip[] {
  const ids = new Set((v ?? "").split(",").map((x) => x.trim().toUpperCase()));
  return INBOX_CHIPS.filter((c) => ids.has(c.id)).map((c) => c.id);
}

/** Messages in a segment, before chips. "Att göra" = every open decision (unresolved action or an open inline decision). */
export function segmentMessages(state: CareerState, segment: InboxSegment): InboxMessage[] {
  if (segment === "archive") return filterInboxMessages(state.inbox, "ARCHIVED");
  const active = filterInboxMessages(state.inbox, "ALL");
  return segment === "todo" ? active.filter((m) => isOpenDecision(state, m)) : active;
}

/** Chips combine as a union (any selected chip matches); no chips = every message in the segment. */
export function applyChips(messages: readonly InboxMessage[], chips: readonly InboxChip[]): InboxMessage[] {
  if (!chips.length) return [...messages];
  return messages.filter((m) => chips.some((c) => matchesInboxFilter({ ...m, archived: false }, c)));
}

export function chipCounts(messages: readonly InboxMessage[]): Record<InboxChip, number> {
  return Object.fromEntries(INBOX_CHIPS.map((c) => [c.id, messages.filter((m) => matchesInboxFilter({ ...m, archived: false }, c.id)).length])) as Record<InboxChip, number>;
}

// ---------------------------------------------------------------------------
// Inline decisions (WLD-01 tray, WLD-01b decision block)
// ---------------------------------------------------------------------------

export type InboxDecision =
  | { kind: "concern"; concernId: string; playerId: string; open: boolean; options: TalkOption[]; answer?: string; outcome?: string; answeredOn?: string; effect?: "POSITIVE" | "NEGATIVE" | "NEUTRAL" }
  | { kind: "transferRequest"; playerId: string; open: boolean; status: "OPEN" | "ACCEPTED" | "REFUSED" | "WITHDRAWN"; decidedOn?: string }
  | { kind: "boardPlan"; meetingId: string; open: boolean; plan?: { agreedOn: string; status: "ACTIVE" | "MET" | "FAILED"; reviewedOn?: string } }
  | { kind: "press"; pressId: string; open: boolean; press: PressConference }
  | { kind: "match"; fixtureId: string; open: boolean };

// Event lookup by id, built once per careerEvents array (the desk asks for many messages per render).
const eventIndex = new WeakMap<readonly CareerEvent[], Map<string, CareerEvent>>();
function eventOf(state: CareerState, m: InboxMessage): CareerEvent | undefined {
  if (!m.careerEventId) return undefined;
  let idx = eventIndex.get(state.careerEvents);
  if (!idx) { idx = new Map(state.careerEvents.map((e) => [e.id, e])); eventIndex.set(state.careerEvents, idx); }
  return idx.get(m.careerEventId);
}

/** Which existing decision this message asks for, and whether it is still open. Null when the message is information only. */
export function decisionFor(state: CareerState, m: InboxMessage): InboxDecision | null {
  const id = m.careerEventId ?? "";
  if (id.startsWith("PLAYER_DYNAMICS:concern:")) {
    const c = dynamicsOf(state).concerns[id.slice("PLAYER_DYNAMICS:concern:".length)];
    if (c) return { kind: "concern", concernId: c.id, playerId: c.playerId, open: c.status === "OPEN", options: c.options, answer: c.answer, outcome: c.outcome, answeredOn: c.answeredOn, effect: c.responseEffect };
  }
  if (id.startsWith("PLAYER_DYNAMICS:request:")) {
    const playerId = id.slice("PLAYER_DYNAMICS:request:".length).replace(/:\d{4}-\d{2}-\d{2}$/, "");
    const r = dynamicsOf(state).requests[playerId];
    // Only the request this message announced; a later request has its own message.
    if (r && id.endsWith(`:${r.submittedOn}`)) return { kind: "transferRequest", playerId, open: r.status === "OPEN", status: r.status, decidedOn: r.decidedOn };
  }
  if (id.startsWith("BOARD_UPDATE:")) {
    const meetingId = id.slice("BOARD_UPDATE:".length);
    const b = boardOf(state);
    const meeting = b?.meetings.find((x) => x.id === meetingId);
    const event = eventOf(state, m);
    if (b && meeting && (meeting.kind === "WARNING" || meeting.kind === "FINAL_WARNING") && event?.priority === "ACTION_REQUIRED") {
      const plan = b.recoveryPlans?.find((p) => p.meetingId === meetingId);
      const blocked = !!state.managerCareer?.seekingJob || !!b.recoveryPlans?.some((p) => p.status === "ACTIVE" && p.meetingId !== meetingId);
      return { kind: "boardPlan", meetingId, open: !!event.requiresAction && !event.resolved && !plan && !blocked, plan: plan ? { agreedOn: plan.agreedOn, status: plan.status, reviewedOn: plan.reviewedOn } : undefined };
    }
  }
  const pressDest = m.destinations?.find((d) => d.route === "PRESS");
  if (pressDest && pressDest.route === "PRESS") {
    const press = mediaOf(state).press[pressDest.pressId];
    if (press) return { kind: "press", pressId: press.id, open: press.status === "OPEN" && press.expiresOn >= state.gameDate, press };
  }
  if (id.startsWith("MATCHDAY_READY:")) return { kind: "match", fixtureId: id.slice("MATCHDAY_READY:".length), open: !m.resolved };
  return null;
}

/** An unresolved required action, or an inline decision that is still open. */
export function isOpenDecision(state: CareerState, m: InboxMessage): boolean {
  if (m.archived) return false;
  if (m.actionRequired && !m.resolved) return true;
  return decisionFor(state, m)?.open ?? false;
}

/** The latest day the decision can be taken, when the game states one. */
export function decisionDeadline(state: CareerState, m: InboxMessage): string | undefined {
  const d = decisionFor(state, m);
  if (d?.kind === "press") return d.press.expiresOn;
  if (d?.kind === "match") return state.fixtures.find((f) => f.id === d.fixtureId)?.date;
  return undefined;
}

// ---------------------------------------------------------------------------
// Threads by entity
// ---------------------------------------------------------------------------

export type ThreadKind = "player" | "fixture" | "competition" | "offer" | "staff" | "board" | "manager" | "finance" | "single";
export interface ThreadKey { key: string; kind: ThreadKind; entityId?: string }

export function threadKeyFor(state: CareerState, m: InboxMessage): ThreadKey {
  const e = eventOf(state, m);
  const p = e?.primaryEntity;
  if (p && (p.entityType === "player" || p.entityType === "fixture" || p.entityType === "competition")) return { key: `${p.entityType}:${p.entityId}`, kind: p.entityType, entityId: p.entityId };
  for (const d of m.destinations ?? []) {
    if (d.route === "PLAYER_PROFILE" || d.route === "SCOUT_REPORT" || d.route === "NEGOTIATION") return { key: `player:${d.playerId}`, kind: "player", entityId: d.playerId };
    if (d.route === "MATCH_REPORT" || d.route === "MATCH_DAY") return { key: `fixture:${d.fixtureId}`, kind: "fixture", entityId: d.fixtureId };
    if (d.route === "TRANSFER_OFFER") return { key: `offer:${d.offerId}`, kind: "offer", entityId: d.offerId };
    if (d.route === "STAFF_MEMBER") return { key: `staff:${d.staffId}`, kind: "staff", entityId: d.staffId };
    if (d.route === "PRESS") {
      const fx = mediaOf(state).press[d.pressId]?.fixtureId;
      if (fx) return { key: `fixture:${fx}`, kind: "fixture", entityId: fx };
    }
  }
  if (e?.type === "BOARD_UPDATE") return { key: "board", kind: "board" };
  if (e?.type === "MANAGER_CAREER") return { key: "manager", kind: "manager" };
  if (e?.type === "CLUB_FINANCE") return { key: "finance", kind: "finance" };
  return { key: `msg:${m.id}`, kind: "single" };
}

export interface InboxThread extends ThreadKey {
  /** Oldest first. */
  messages: InboxMessage[];
  latest: InboxMessage;
  unread: number;
  openDecisions: number;
}

/** Groups messages into threads; threads with an open decision first, then newest activity first. */
export function buildThreads(state: CareerState, messages: readonly InboxMessage[]): InboxThread[] {
  const map = new Map<string, { k: ThreadKey; list: InboxMessage[] }>();
  for (const m of messages) {
    const k = threadKeyFor(state, m);
    const cur = map.get(k.key);
    if (cur) cur.list.push(m); else map.set(k.key, { k, list: [m] });
  }
  const order = new Map(state.inbox.map((m, i) => [m.id, i]));
  const byTime = (a: InboxMessage, b: InboxMessage) => (a.date ?? "").localeCompare(b.date ?? "") || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  return [...map.values()].map(({ k, list }) => {
    const sorted = [...list].sort(byTime);
    return { ...k, messages: sorted, latest: sorted[sorted.length - 1]!, unread: sorted.filter((m) => !m.read).length, openDecisions: sorted.filter((m) => isOpenDecision(state, m)).length };
  }).sort((a, b) => (b.openDecisions > 0 ? 1 : 0) - (a.openDecisions > 0 ? 1 : 0) || -byTime(a.latest, b.latest));
}

/** The whole thread a message belongs to (across segments and archive), oldest first. */
export function threadOf(state: CareerState, messageId: string): InboxThread | undefined {
  const m = state.inbox.find((x) => x.id === messageId);
  if (!m) return undefined;
  const key = threadKeyFor(state, m).key;
  return buildThreads(state, state.inbox.filter((x) => threadKeyFor(state, x).key === key))[0];
}

// ---------------------------------------------------------------------------
// The tray (WLD-01): open decisions, deadlines first
// ---------------------------------------------------------------------------

export interface TrayItem { message: InboxMessage; decision: InboxDecision | null; deadline?: string }

export function trayItems(state: CareerState): TrayItem[] {
  return state.inbox.filter((m) => isOpenDecision(state, m)).map((m) => ({ message: m, decision: decisionFor(state, m), deadline: decisionDeadline(state, m) }))
    .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") || (a.message.date ?? "").localeCompare(b.message.date ?? ""));
}

// ---------------------------------------------------------------------------
// Chain rail (WLD-01b): event -> ask -> decision -> consequence, plus media
// ---------------------------------------------------------------------------

export type ChainStep = "event" | "ask" | "decision" | "outcome" | "media";
export interface ChainNode { id: string; date: string; step: ChainStep; label: string; detail?: string; messageId?: string; href?: string; sign?: "plus" | "minus" }

const STEP_ORDER: Record<ChainStep, number> = { event: 0, media: 1, ask: 2, decision: 3, outcome: 4 };

function consequenceNodes(id: string, date: string, list: readonly Consequence[]): ChainNode[] {
  return list.slice(0, 6).map((c, i) => ({ id: `${id}:c${i}`, date, step: "outcome" as const, label: c.text, sign: c.delta >= 0 ? "plus" as const : "minus" as const }));
}

function storiesFor(state: CareerState, t: ThreadKey): NewsStory[] {
  if (!t.entityId || (t.kind !== "player" && t.kind !== "fixture")) return [];
  const all = Object.values(mediaOf(state).stories).filter((s) => s.ownClub && (t.kind === "fixture" ? s.fixtureId === t.entityId : s.playerIds?.includes(t.entityId!)));
  // One story per underlying event (the outlets covering it share eventKey).
  const seen = new Set<string>();
  return all.sort((a, b) => b.importance - a.importance).filter((s) => (seen.has(s.eventKey) ? false : (seen.add(s.eventKey), true))).slice(0, 4);
}

export function chainFor(state: CareerState, thread: InboxThread): ChainNode[] {
  const out: ChainNode[] = [];
  const seenPress = new Set<string>();
  for (const m of thread.messages) {
    const d = decisionFor(state, m);
    out.push({ id: m.id, date: (m.date ?? "").slice(0, 10), step: d ? "ask" : "event", label: m.subject, messageId: m.id });
    if (!d) continue;
    if (d.kind === "concern" && !d.open && d.answer) {
      out.push({ id: `${m.id}:answer`, date: d.answeredOn ?? m.date, step: "decision", label: `Du svarade: ${d.answer}` });
      if (d.outcome) out.push({ id: `${m.id}:outcome`, date: d.answeredOn ?? m.date, step: "outcome", label: d.outcome, sign: d.effect === "NEGATIVE" ? "minus" : d.effect === "POSITIVE" ? "plus" : undefined });
    }
    if (d.kind === "transferRequest" && !d.open) out.push({ id: `${m.id}:decided`, date: d.decidedOn ?? m.date, step: "decision", label: d.status === "ACCEPTED" ? "Du godkände: han är transferlistad" : d.status === "REFUSED" ? "Du avslog begäran" : "Han stannar på ditt löfte" });
    if (d.kind === "boardPlan" && d.plan) {
      out.push({ id: `${m.id}:plan`, date: d.plan.agreedOn, step: "decision", label: "Du lämnade en handlingsplan" });
      if (d.plan.status !== "ACTIVE") out.push({ id: `${m.id}:review`, date: d.plan.reviewedOn ?? d.plan.agreedOn, step: "outcome", label: d.plan.status === "MET" ? "Planen uppfylld: förtroendet steg" : "Planen inte uppfylld: förtroendet sjönk", sign: d.plan.status === "MET" ? "plus" : "minus" });
    }
    if (d.kind === "press" && !d.open && !seenPress.has(d.pressId)) {
      seenPress.add(d.pressId);
      const p = d.press;
      const who = p.answeredBy && p.answeredBy !== "MANAGER" ? `${p.answeredBy.name} svarade` : "Du svarade";
      out.push({ id: `${m.id}:press`, date: p.date, step: "decision", label: p.status === "ANSWERED" ? who : p.status === "DELEGATED" ? "Assisterande tränaren svarade" : p.status === "DECLINED" ? "Du avböjde" : "Inga svar lämnades", href: `/career/media/press/${encodeURIComponent(p.id)}` });
      out.push(...consequenceNodes(`${m.id}:press`, p.date, p.consequences ?? []));
    }
  }
  for (const s of storiesFor(state, thread)) out.push({ id: s.id, date: s.date, step: "media", label: s.headline, href: `/career/media/story/${encodeURIComponent(s.id)}` });
  return out.sort((a, b) => a.date.localeCompare(b.date) || STEP_ORDER[a.step] - STEP_ORDER[b.step]);
}

/** A short human title for the thread's counterpart -- the role/entity, never an invented person. */
export const THREAD_KIND_LABEL: Record<ThreadKind, string> = { player: "Spelare", fixture: "Match", competition: "Tävling", offer: "Bud", staff: "Stab", board: "Styrelsen", manager: "Din karriär", finance: "Ekonomi", single: "Besked" };
