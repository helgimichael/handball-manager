// Arena Nights 231 -- WLD-02 Newsstand view models: front pages per tier (own club first), dated list, quote archive, rivalry cards, favour meters.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { CareerState } from "../career/types";
import { emptyMedia } from "./people";
import { favourOf, frontPages, groupByDate, outletFavour, quoteArchive, rivalCards, storyImage, storyThreadMessageId } from "./newsstand";
import { CLUB_MEDIA, MEDIA_OUTLETS } from "./registry";
import type { NewsStory, PressConference } from "./types";

const OWN = Object.keys(CLUB_MEDIA)[0]!;
const OTHER = Object.keys(CLUB_MEDIA)[1]!;
const LOCAL_OUTLET = CLUB_MEDIA[OWN]!.outlets.find((id) => MEDIA_OUTLETS[id]?.category === "LOCAL") ?? CLUB_MEDIA[OWN]!.outlets[0]!;

function story(id: string, extra: Partial<NewsStory>): NewsStory {
  return { id, eventKey: id, date: "2026-01-10", kind: "MATCH_REPORT", outletId: LOCAL_OUTLET, scope: "LOCAL", headline: id, standfirst: "", body: [], clubIds: [OWN], importance: 2, destinations: [], ownClub: true, ...extra };
}
function state(extra: Partial<CareerState> = {}, media: Partial<ReturnType<typeof emptyMedia>> = {}): CareerState {
  return { playerClubId: OWN, gameDate: "2026-01-12", fixtures: [], results: {}, inbox: [], careerEvents: [], staffRoster: {}, seasonHistory: [], media: { ...emptyMedia(), ...media }, ...extra } as unknown as CareerState;
}

test("front pages: four tiers; own-club coverage leads even when older; one headline per event", () => {
  const stories = {
    a: story("a", { date: "2026-01-05", ownClub: true }),
    b: story("b", { date: "2026-01-11", ownClub: false, clubIds: [OTHER] }),
    c: story("c", { date: "2026-01-09", eventKey: "a", ownClub: true }),
    n: story("n", { scope: "NATIONAL", outletId: "aftonbladet", ownClub: false, clubIds: [OTHER] }),
  };
  const pages = frontPages(state({}, { stories }));
  assert.deepEqual(pages.map((p) => p.scope), ["LOCAL", "REGIONAL", "SPECIALIST", "NATIONAL"]);
  const local = pages[0]!;
  assert.equal(local.lead?.id, "c", "newest own-club story leads");
  assert.deepEqual(local.more.map((s) => s.id), ["b"], "the second take on event 'a' is not repeated");
  assert.equal(local.count, 3);
  assert.equal(pages[3]!.lead?.id, "n");
  assert.equal(pages[2]!.lead, undefined);
});

test("dated list groups by day, newest first; story image follows the story kind", () => {
  const g = groupByDate([story("x", { date: "2026-01-01" }), story("y", { date: "2026-01-03" }), story("z", { date: "2026-01-03" })]);
  assert.deepEqual(g.map((d) => [d.date, d.stories.length]), [["2026-01-03", 2], ["2026-01-01", 1]]);
  assert.equal(storyImage("MATCH_REPORT"), "arena-matchday");
  assert.equal(storyImage("TRANSFER"), "manager-office");
  assert.equal(storyImage("INTERVIEW"), "press-room");
});

test("quote archive: your telling quote verbatim, net direction per group, expired conferences say so", () => {
  const q = (id: string) => ({ id, journalistId: "j", topic: "PREVIEW", text: "?", answers: [{ tone: "DIPLOMATIC", text: "Vi tar match för match.", hint: "" }, { tone: "PROVOCATIVE", text: "Vi vinner med tio.", hint: "" }] });
  const answered = { id: "p1", date: "2026-01-10", kind: "PRE_MATCH", title: "Inför derbyt", context: "", outletIds: [], questions: [q("q1"), q("q2")], contexts: [], status: "ANSWERED", expiresOn: "2026-01-11", answers: { q1: "DIPLOMATIC", q2: "PROVOCATIVE" }, answeredBy: "MANAGER", consequences: [{ area: "TEAM", delta: 2, text: "" }, { area: "RIVAL", delta: -9, text: "" }, { area: "TEAM", delta: -1, text: "" }] } as unknown as PressConference;
  const expired = { ...answered, id: "p0", date: "2026-01-01", status: "EXPIRED", answers: undefined, consequences: [] } as unknown as PressConference;
  const open = { ...answered, id: "p2", status: "OPEN" } as unknown as PressConference;
  const cards = quoteArchive(state({}, { press: { p1: answered, p0: expired, p2: open } }));
  assert.deepEqual(cards.map((c) => c.press.id), ["p1", "p0"], "open conferences belong to the tray, not the archive");
  assert.equal(cards[0]!.quote?.text, "Vi vinner med tio.");
  assert.deepEqual(cards[0]!.chips.map((c) => [c.area, c.sign]), [["TEAM", "plus"], ["RIVAL", "minus"]]);
  assert.equal(cards[1]!.who, "Inga svar");
  assert.equal(cards[1]!.quote, undefined);
});

test("rivalry cards: head-to-head from our side and the next unplayed meeting", () => {
  const s = state({
    fixtures: [
      { id: "m1", date: "2026-01-02", homeClubId: OWN, awayClubId: OTHER, type: "LEAGUE" },
      { id: "m2", date: "2026-01-05", homeClubId: OTHER, awayClubId: OWN, type: "LEAGUE" },
      { id: "m3", date: "2026-02-01", homeClubId: OWN, awayClubId: OTHER, type: "LEAGUE" },
    ],
    results: { m1: { homeGoals: 30, awayGoals: 29 }, m2: { homeGoals: 31, awayGoals: 30 } },
    // A coach relation always puts the club on a card, whatever the geography.
    staffRoster: { [OTHER]: [{ id: "coach-x", displayName: "Coach X", roles: ["HEAD_COACH"] }] },
  } as unknown as Partial<CareerState>, { relations: { r: { a: "manager", b: "coach-x", score: -45, history: [{ date: "2026-01-06", text: "Han kallade er fega", delta: -10 }] } } });
  const card = rivalCards(s, 50).find((c) => c.clubId === OTHER)!;
  assert.ok(card, "the rival coach's club gets a card");
  assert.equal(card.coach?.label, "Öppen fejd");
  assert.deepEqual(card.flashpoint, { date: "2026-01-06", text: "Han kallade er fega" }, "the latest word beats an older game");
  assert.equal(card.heat, Math.max(card.rivalry, 45));
  assert.deepEqual(card.h2h, { won: 1, drawn: 0, lost: 1 });
  assert.deepEqual(card.nextMeeting, { fixtureId: "m3", date: "2026-02-01", home: true });
});

test("favour meters: labels per range, most critical first, last story; thread link only for own-club stories with an inbox thread", () => {
  assert.equal(favourOf(25).label, "Varm"); assert.equal(favourOf(8).label, "Välvillig"); assert.equal(favourOf(0).label, "Neutral"); assert.equal(favourOf(-8).label, "Kritisk"); assert.equal(favourOf(-30).label, "Fientlig");
  const s = state({}, { outletRelations: { aftonbladet: -12, expressen: 9 }, stories: { a: story("a", { outletId: "aftonbladet", scope: "NATIONAL" }) } });
  const f = outletFavour(s, ["expressen", "aftonbladet", "not-an-outlet"]);
  assert.deepEqual(f.national.map((r) => r.outletId), ["aftonbladet", "expressen"]);
  assert.equal(f.national[0]!.last?.id, "a");
  const withThread = state({ inbox: [{ id: "m", destinations: [{ route: "MATCH_REPORT", fixtureId: "fx" }] }] } as unknown as Partial<CareerState>);
  assert.equal(storyThreadMessageId(withThread, story("s", { fixtureId: "fx" })), "m");
  assert.equal(storyThreadMessageId(withThread, story("s", { fixtureId: "fx", ownClub: false })), undefined);
});
