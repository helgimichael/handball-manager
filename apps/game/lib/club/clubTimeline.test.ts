// Arena Nights -- club story timeline, head-to-head, almanac and other-club portrait: real data only, pure.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import { ensureSeasonCalendar } from "../competition/seasonCalendar";
import { ensureClubFinances } from "../economy/ledger";
import type { CareerState } from "../career/types";
import { clubMatches, clubStory, headToHead } from "./clubTimeline";
import { clubAlmanac } from "./clubAlmanac";
import { clubPortrait, CLUB_DOMAINS } from "./clubPortrait";

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
let base: string | undefined;
function career(): CareerState {
  if (!base) {
    const ids = ["swe-2"];
    const s = createNewCareerState("club-org", "swe2-tumba", Object.assign({}, ...ids.map((c) => snapshotWorldSquads(c))), undefined, Object.assign({}, ...ids.map((c) => snapshotGameplayRatings(c))), Object.assign({}, ...ids.map((c) => snapshotAllClubsStaff(c))));
    base = JSON.stringify(ensureSeasonCalendar(ensureClubFinances(s, s.gameDate)));
  }
  return JSON.parse(base) as CareerState;
}

/** Plays the club's first n fixtures with a given score, as results the save would hold. */
function withResults(s: CareerState, n: number, score = { homeGoals: 30, awayGoals: 27 }): CareerState {
  const own = s.fixtures.filter((f) => f.homeClubId === s.playerClubId || f.awayClubId === s.playerClubId).sort((a, b) => a.date.localeCompare(b.date)).slice(0, n);
  return { ...s, results: { ...s.results, ...Object.fromEntries(own.map((f) => [f.id, { ...score } as never])) } };
}

test("timeline: no matches before any result, newest month first, filters by kind, pure", () => {
  const s = career();
  const before = hash(s);
  assert.equal(clubStory(s, s.playerClubId, "match").length, 0);
  const played = withResults(s, 3);
  const months = clubStory(played, played.playerClubId, "match");
  assert.equal(months.flatMap((m) => m.items).length, 3);
  for (let i = 1; i < months.length; i++) assert.ok(months[i - 1]!.key > months[i]!.key);
  assert.ok(months.flatMap((m) => m.items).every((i) => i.kind === "match"));
  assert.equal(clubStory(played, played.playerClubId, "transfer").flatMap((m) => m.items).every((i) => i.kind === "transfer"), true);
  assert.equal(hash(s), before);
});

test("head-to-head: counts only meetings between the two clubs, outcome from your side", () => {
  const s = withResults(career(), 4);
  const matches = clubMatches(s, s.playerClubId);
  const opponent = matches[0]!.opponentId;
  const h = headToHead(s, opponent);
  const vs = matches.filter((m) => m.opponentId === opponent);
  assert.equal(h.played, vs.length);
  assert.equal(h.won + h.drawn + h.lost, h.played);
  assert.equal(h.goalsFor, vs.reduce((n, m) => n + m.goalsFor, 0));
  for (const m of vs) assert.equal(m.outcome, m.goalsFor > m.goalsAgainst ? "W" : m.goalsFor < m.goalsAgainst ? "L" : "D");
});

test("almanac: live season last, departments ranked by need, no invented honours", () => {
  const s = career();
  const a = clubAlmanac(s);
  assert.equal(a.seasons.at(-1)!.current, true);
  assert.equal(a.seasons.at(-1)!.seasonId, s.seasonId);
  assert.equal(a.honoursCount, 0, "a fresh career has no honours");
  const rank = { bad: 0, warn: 1, neutral: 2, ok: 3 } as const;
  for (let i = 1; i < a.departments.length; i++) assert.ok(rank[a.departments[i - 1]!.alertTone] <= rank[a.departments[i]!.alertTone]);
  assert.ok(a.facts.some((f) => f.label === "Anläggning"));
});

test("portrait: unknown domains are fogged, never filled; headline from the table", () => {
  const s = career();
  const other = s.fixtures.find((f) => f.homeClubId === s.playerClubId)!.awayClubId;
  const p = clubPortrait(s, other, null)!;
  assert.ok(p);
  assert.equal(p.identity.length, CLUB_DOMAINS.length);
  assert.ok(p.identity.every((l) => !l.known && l.sentences.length === 0));
  assert.ok(p.coach.every((l) => !l.known));
  assert.equal(p.standfirst, null);
  assert.equal(p.noIdentityData, true);
  assert.match(p.headline, /\.$/);
});
