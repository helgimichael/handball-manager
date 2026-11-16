// Arena Nights 231 -- WLD-01 Correspondence Desk view model: threads from real message fields, segment + chips, inline decisions, chain.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { CareerEvent } from "../career/careerEvents";
import type { CareerState } from "../career/types";
import type { InboxMessage } from "../game-data";
import { applyChips, buildThreads, chainFor, chipCounts, decisionFor, isOpenDecision, parseChips, parseSegment, segmentMessages, threadKeyFor, threadOf, trayItems } from "./threads";

function msg(id: string, extra: Partial<InboxMessage> = {}): InboxMessage {
  return { id, category: "CLUB", sender: "Klubben", subject: id, preview: "", body: [], date: "2026-01-10", read: false, important: false, archived: false, resolved: true, ...extra };
}
function ev(id: string, type: CareerEvent["type"], extra: Partial<CareerEvent> = {}): CareerEvent {
  return { id, type, date: "2026-01-10", priority: "INFORMATION", subject: id, summary: "", relatedEntities: [], destinations: [], requiresAction: false, resolved: true, read: false, createdAtGameDate: "2026-01-10", ...extra };
}
function state(inbox: InboxMessage[], careerEvents: CareerEvent[] = [], extra: Partial<CareerState> = {}): CareerState {
  return { inbox, careerEvents, gameDate: "2026-01-12", playerClubId: "own", fixtures: [{ id: "fx1", date: "2026-01-14" }], ...extra } as unknown as CareerState;
}

test("threads: primaryEntity first, then a single-entity destination, then the event type; the rest stand alone", () => {
  const events = [ev("PLAYER_INJURED:p1", "PLAYER_INJURED", { primaryEntity: { entityType: "player", entityId: "p1" } }), ev("BOARD_UPDATE:m1", "BOARD_UPDATE"), ev("CLUB_NEWS:x", "CLUB_NEWS")];
  const inbox = [
    msg("a", { careerEventId: "PLAYER_INJURED:p1", date: "2026-01-02" }),
    msg("b", { destinations: [{ route: "PLAYER_PROFILE", playerId: "p1" }], date: "2026-01-05" }),
    msg("c", { careerEventId: "BOARD_UPDATE:m1" }),
    msg("d", { careerEventId: "CLUB_NEWS:x", destinations: [{ route: "CLUB" }] }),
    msg("e", { destinations: [{ route: "MATCH_REPORT", fixtureId: "fx1" }], date: "2026-01-11" }),
  ];
  const s = state(inbox, events);
  assert.deepEqual(threadKeyFor(s, inbox[0]!), { key: "player:p1", kind: "player", entityId: "p1" });
  assert.equal(threadKeyFor(s, inbox[1]!).key, "player:p1");
  assert.equal(threadKeyFor(s, inbox[2]!).key, "board");
  assert.equal(threadKeyFor(s, inbox[3]!).key, "msg:d");
  const threads = buildThreads(s, inbox);
  assert.equal(threads.length, 4);
  const p1 = threads.find((t) => t.key === "player:p1")!;
  assert.deepEqual(p1.messages.map((m) => m.id), ["a", "b"], "oldest first inside a thread");
  assert.equal(p1.latest.id, "b");
  assert.equal(p1.unread, 2);
  assert.equal(threads[0]!.key, "fixture:fx1", "newest activity first when nothing is open");
  assert.equal(threadOf(s, "b")!.messages.length, 2);
});

test("segment + chips: Att göra/Allt/Arkiv, union of chips, counts; parse from URL", () => {
  const inbox = [
    msg("management-contract:1", { read: true }),
    msg("msg:TRANSFER_NEGOTIATION:1"),
    msg("s1", { category: "SCOUTING" }),
    msg("old", { archived: true, category: "SCOUTING" }),
    msg("act", { actionRequired: true, resolved: false }),
  ];
  const s = state(inbox);
  assert.deepEqual(segmentMessages(s, "todo").map((m) => m.id), ["act"]);
  assert.equal(segmentMessages(s, "all").length, 4);
  assert.deepEqual(segmentMessages(s, "archive").map((m) => m.id), ["old"]);
  assert.deepEqual(applyChips(segmentMessages(s, "all"), ["CONTRACTS", "SCOUTING"]).map((m) => m.id), ["management-contract:1", "s1"]);
  assert.deepEqual(applyChips(segmentMessages(s, "archive"), ["SCOUTING"]).map((m) => m.id), ["old"], "chips also work inside the archive");
  const counts = chipCounts(segmentMessages(s, "all"));
  assert.equal(counts.CONTRACTS, 1); assert.equal(counts.TRANSFERS, 1); assert.equal(counts.SCOUTING, 1); assert.equal(counts.UNREAD, 3);
  assert.equal(parseSegment("todo"), "todo"); assert.equal(parseSegment("x"), "all"); assert.equal(parseSegment(null), "all");
  assert.deepEqual(parseChips("scouting,BOGUS,contracts"), ["CONTRACTS", "SCOUTING"]);
});

test("inline decisions: a playing-time concern is open until answered, then its answer and outcome join the chain", () => {
  const concern = { id: "c1", playerId: "p1", kind: "PLAYING_TIME", raisedOn: "2026-01-10", message: "", options: [{ id: "EARN_IT", label: "Förtjäna det", consequence: "Beror på honom" }], status: "OPEN" };
  const e = ev("PLAYER_DYNAMICS:concern:c1", "PLAYER_DYNAMICS", { priority: "ACTION_REQUIRED", requiresAction: true, resolved: false, primaryEntity: { entityType: "player", entityId: "p1" } });
  const m = msg("msg:PLAYER_DYNAMICS:concern:c1", { careerEventId: e.id, actionRequired: true, resolved: false });
  const open = state([m], [e], { playerDynamics: { morale: {}, promises: {}, concerns: { c1: concern }, requests: {}, listings: {}, departures: [] } } as unknown as Partial<CareerState>);
  const d = decisionFor(open, m)!;
  assert.equal(d.kind, "concern"); assert.equal(d.open, true);
  assert.equal(trayItems(open).length, 1);
  const answered = state([{ ...m, resolved: true, actionRequired: false }], [e], { playerDynamics: { morale: {}, promises: {}, concerns: { c1: { ...concern, status: "ANSWERED", answer: "Förtjäna det", outcome: "Han tänker visa dig på träningen.", answeredOn: "2026-01-11", responseEffect: "POSITIVE" } }, requests: {}, listings: {}, departures: [] } } as unknown as Partial<CareerState>);
  assert.equal(isOpenDecision(answered, answered.inbox[0]!), false);
  assert.equal(trayItems(answered).length, 0);
  const chain = chainFor(answered, buildThreads(answered, answered.inbox)[0]!);
  assert.deepEqual(chain.map((n) => n.step), ["ask", "decision", "outcome"]);
  assert.equal(chain[2]!.sign, "plus");
});

test("inline decisions: an IMPORTANT transfer request is still an open decision (tray) while the request is OPEN", () => {
  const e = ev("PLAYER_DYNAMICS:request:p2:2026-01-09", "PLAYER_DYNAMICS", { priority: "IMPORTANT" });
  const m = msg("msg:x", { careerEventId: e.id });
  const dyn = (status: string) => ({ playerDynamics: { morale: {}, promises: {}, concerns: {}, requests: { p2: { playerId: "p2", submittedOn: "2026-01-09", reason: "", status } }, listings: {}, departures: [] } }) as unknown as Partial<CareerState>;
  assert.equal(isOpenDecision(state([m], [e], dyn("OPEN")), m), true);
  assert.equal(isOpenDecision(state([m], [e], dyn("REFUSED")), m), false);
  // A newer request for the same player does not reopen the old message.
  const newer = { playerDynamics: { morale: {}, promises: {}, concerns: {}, requests: { p2: { playerId: "p2", submittedOn: "2026-03-01", reason: "", status: "OPEN" } }, listings: {}, departures: [] } } as unknown as Partial<CareerState>;
  assert.equal(decisionFor(state([m], [e], newer), m), null);
});

test("press: open conference is a tray item with its deadline; once answered its consequences join the fixture thread once", () => {
  const press = { id: "pr1", date: "2026-01-12", kind: "PRE_MATCH", title: "Inför", context: "", fixtureId: "fx1", outletIds: [], questions: [], contexts: [], status: "OPEN", expiresOn: "2026-01-13" };
  const m = msg("msg:MEDIA:pr1", { destinations: [{ route: "PRESS", pressId: "pr1" }] });
  const media = (p: object) => ({ media: { stories: {}, journalists: {}, press: { pr1: p }, relations: {}, outletRelations: {}, supporters: 0, boardMood: 0, pressure: {}, discipline: {}, seen: [], week: { key: "", count: 0 } } }) as unknown as Partial<CareerState>;
  const open = state([m], [], media(press));
  assert.equal(threadKeyFor(open, m).key, "fixture:fx1", "a press conference joins its match's thread");
  assert.equal(trayItems(open)[0]!.deadline, "2026-01-13");
  const expired = state([m], [], { ...media(press), gameDate: "2026-01-14" } as Partial<CareerState>);
  assert.equal(isOpenDecision(expired, m), false, "past expiry is no longer a decision");
  const done = { ...press, status: "ANSWERED", answeredBy: "MANAGER", consequences: [{ area: "TEAM", delta: 2, text: "Truppen gillade det" }, { area: "RIVAL", delta: -3, text: "Rivalen irriterad" }] };
  const follow = msg("msg:MEDIA:pr1:after", { destinations: [{ route: "PRESS", pressId: "pr1" }], date: "2026-01-12" });
  const answered = state([m, follow], [], media(done));
  const chain = chainFor(answered, buildThreads(answered, answered.inbox)[0]!);
  assert.equal(chain.filter((n) => n.step === "decision").length, 1);
  assert.deepEqual(chain.filter((n) => n.step === "outcome").map((n) => n.sign), ["plus", "minus"]);
});
