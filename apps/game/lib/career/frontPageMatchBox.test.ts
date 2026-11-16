// Arena Nights -- DSH-01b/c/e/g/h: match box, court coverage, ranked briefs and the season curtain are pure reads.
import { test } from "node:test";
import assert from "node:assert/strict";
import { leagueCareer, playRounds } from "../competition/competitionTestCareer";
import { getCareerSquad } from "./careerWorld";
import { COURT_POSITIONS } from "../club/clubJournal";
import { buildFrontPage, buildMatchBox, buildSeasonCurtain, courtCoverage, describeTransitionBlocker, rankedClubBriefs, squadReadiness } from "./frontPage";
import type { InboxMessage } from "../game-data";

test("match box: headline, countdown and opponent come from the next own fixture", () => {
  const s = leagueCareer();
  const box = buildMatchBox(s);
  const next = s.fixtures.filter((f) => (f.homeClubId === s.playerClubId || f.awayClubId === s.playerClubId) && !s.results[f.id] && f.date >= s.gameDate).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))[0]!;
  assert.equal(box.next!.fixtureId, next.id);
  assert.equal(box.next!.home, next.homeClubId === s.playerClubId);
  assert.match(box.next!.headline, box.next!.home ? /hemma$/ : /borta$/);
  assert.ok(box.next!.days >= 0);
  assert.deepEqual(box.recent, []);
});

test("form strip: the last five own results, oldest first, outcome from the own side", () => {
  const s = playRounds(leagueCareer(), 7);
  const box = buildMatchBox(s);
  assert.equal(box.recent.length, 5);
  const dates = box.recent.map((b) => b.date);
  assert.deepEqual(dates, [...dates].sort());
  for (const b of box.recent) {
    const [ours, theirs] = b.score.split("–").map(Number) as [number, number];
    assert.equal(b.outcome, ours > theirs ? "W" : ours < theirs ? "L" : "D");
  }
});

test("readiness and court coverage partition the squad; injured players are OUT", () => {
  const s = leagueCareer();
  const squad = getCareerSquad(s);
  const victim = squad.find((p) => p.position === "V9")!;
  const hurt = { ...s, playerStatuses: { ...s.playerStatuses, [victim.id]: { playerId: victim.id, availability: "INJURED" as const, returnDate: "2099-01-01" } } };
  const r = squadReadiness(hurt);
  assert.equal(r.available + r.injured + r.suspended + r.away, r.total);
  assert.ok(r.injured >= 1);
  const spots = courtCoverage(hurt);
  assert.deepEqual(spots.map((x) => x.position), [...COURT_POSITIONS]);
  const v9 = spots.find((x) => x.position === "V9")!;
  assert.equal(v9.players.find((p) => p.id === victim.id)!.state, "OUT");
  assert.match(v9.players.find((p) => p.id === victim.id)!.detail, /Skadad/);
  for (const x of spots) {
    assert.equal(x.tone, x.selectable === 0 ? "bad" : x.fit >= 2 ? "good" : "warn");
    assert.ok(x.cover.every((c) => c.position !== x.position));
  }
});

test("ladder rows carry the verified zone marks", () => {
  const s = playRounds(leagueCareer(), 5);
  const front = buildFrontPage(s);
  assert.ok(front.ladder.some((r) => r.own));
  for (const r of front.ladder) if (r.position === 1) assert.equal(r.zone?.label, "Uppflyttning");
});

test("club briefs: action required first, then important, unread, read; archived never", () => {
  const msg = (id: string, o: Partial<InboxMessage>): InboxMessage => ({ id, category: "CLUB", sender: "Klubben", subject: id, preview: "", body: [], date: "2026-08-01", read: true, important: false, archived: false, resolved: true, destinations: [], ...o } as InboxMessage);
  const s = { ...leagueCareer(), inbox: [msg("read", {}), msg("unread", { read: false, date: "2026-09-01" }), msg("archived", { archived: true, important: true, resolved: false }), msg("important", { important: true }), msg("action", { important: true, resolved: false, date: "2026-07-01" })] };
  assert.deepEqual(rankedClubBriefs(s).map((b) => b.id), ["action", "important", "unread"]);
  assert.deepEqual(rankedClubBriefs(s).map((b) => b.priority), ["ACTION", "IMPORTANT", "UNREAD"]);
  assert.equal(buildFrontPage(s).inboxUnread, 1);
});

test("season curtain reads the table and the board; blockers get human copy", () => {
  const s = playRounds(leagueCareer(), 4);
  const c = buildSeasonCurtain(s, [{ status: "MET" }, { status: "FAILED" }]);
  assert.ok(c.position !== null && c.position >= 1 && c.position <= c.teams);
  assert.equal(c.board?.met, 1);
  assert.equal(c.board?.failed, 1);
  assert.equal(c.board?.total, 2);
  for (const code of ["QUALIFICATION_WINDOW_UNAVAILABLE", "PARENT_PRIORITY_NO_DESTINATION", "NEXT_SEASON_RULES_UNVERIFIED", "ACTIVE_MATCH", "SOMETHING_NEW"]) {
    const copy = describeTransitionBlocker({ code });
    assert.ok(copy.title.length > 0 && !copy.title.includes("_"), code);
  }
});
