// Arena 231 -- entry models: the save cover (ENT-02/ENT-04) and the ambition club wall (ENT-03d). Pure, real data only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createNewCareerState } from "../../lib/career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../../lib/gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../../lib/gameWorld/staffIdentitySnapshot";
import { ensureSeasonCalendar } from "../../lib/competition/seasonCalendar";
import type { CareerState } from "../../lib/career/types";
import type { CareerSave } from "../../lib/save/saveRepository";
import { buildSaveCover, coverHeadline } from "./saveCover";
import { ambitionCounts, ambitionOf, expectationMeter, filterWall, strengthMeter } from "./clubWallModel";
import type { ClubPreseasonContext } from "../../lib/newGame/clubSelectionContext";

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
let base: string | undefined;
function career(): CareerState {
  if (!base) {
    const ids = ["swe-2"];
    const s = createNewCareerState("entry-cover", "swe2-tumba", Object.assign({}, ...ids.map((c) => snapshotWorldSquads(c))), undefined, Object.assign({}, ...ids.map((c) => snapshotGameplayRatings(c))), Object.assign({}, ...ids.map((c) => snapshotAllClubsStaff(c))));
    base = JSON.stringify(ensureSeasonCalendar(s));
  }
  return JSON.parse(base) as CareerState;
}
function save(state: CareerState | undefined): CareerSave {
  return { saveId: "s1", schemaVersion: 8, selectedNations: ["SWE"], selectedCompetitionIds: ["swe-2"], clubId: "swe2-tumba", manager: { name: "Test Tränare", nationality: "SWE", dateOfBirth: "1985-01-01" } as CareerSave["manager"], gameDate: state?.gameDate ?? "2026-08-01", createdAt: "2026-08-01T00:00:00Z", lastPlayedAt: "2026-08-02T10:00:00Z", careerState: state };
}

test("save cover: fresh career has no position, names the next own fixture and is pure", () => {
  const s = career();
  const before = hash(s);
  const c = buildSaveCover(save(s));
  assert.equal(hash(s), before);
  assert.equal(c.hasCareer, true);
  assert.equal(c.position, null, "no table position before a match is played");
  assert.equal(c.lastResult, null);
  assert.match(c.issueLine, /^Vecka \d+ · \d{4}\/\d{2}/);
  const own = s.fixtures.filter((f) => (f.homeClubId === "swe2-tumba" || f.awayClubId === "swe2-tumba") && f.date >= s.gameDate).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))[0];
  if (own) {
    assert.equal(c.nextFixture?.fixtureId, own.id);
    assert.ok(c.headline.includes(c.nextFixture!.opponent), "the headline names the real next opponent");
  }
});

test("save cover: three straight wins become the streak headline; results come only from stored fixtures", () => {
  const s = career();
  const own = s.fixtures.filter((f) => f.homeClubId === "swe2-tumba" || f.awayClubId === "swe2-tumba").sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  assert.ok(own.length >= 4, "the calendar has own fixtures");
  const results = { ...s.results } as Record<string, unknown>;
  for (const f of own.slice(0, 3)) results[f.id] = { homeClubId: f.homeClubId, awayClubId: f.awayClubId, homeGoals: f.homeClubId === "swe2-tumba" ? 30 : 25, awayGoals: f.homeClubId === "swe2-tumba" ? 25 : 30 };
  const played = { ...s, results, gameDate: own[2]!.date } as unknown as CareerState;
  const c = buildSaveCover(save(played));
  assert.equal(c.recent.length, 3);
  assert.deepEqual(c.streak, { outcome: "V", count: 3 });
  assert.equal(c.lastResult?.fixtureId, own[2]!.id);
  assert.match(c.headline, /tre raka segrar/);
  assert.equal(c.nextFixture?.fixtureId, own.slice(3).find((f) => f.date >= own[2]!.date)?.id);
});

test("save cover: a schema-1 save without a career snapshot degrades to a plain cover", () => {
  const c = buildSaveCover(save(undefined));
  assert.equal(c.hasCareer, false);
  assert.equal(c.nextFixture, null);
  assert.equal(c.position, null);
  assert.ok(c.headline.length > 0 && c.standfirst.length > 0);
});

test("cover headline: away trip after a loss, season complete and seeking job", () => {
  const common = { clubShortName: "Tumba", position: 3, tableSize: 14, competitionName: "Allsvenskan", seasonId: "2026/27", hasCareer: true, seekingJob: false, seasonComplete: false } as const;
  const h = coverHeadline({ ...common, streak: { outcome: "F", count: 1 }, lastResult: { fixtureId: "f", date: "2026-09-01", opponentId: "x", opponent: "Önnered", home: true, ours: 24, theirs: 27, outcome: "F" }, nextFixture: { fixtureId: "n", date: "2026-09-05", opponentId: "y", opponent: "Kristianstad", home: false, daysUntil: 4, label: "Omgång 3" } });
  assert.equal(h.headline, "Tumba reser till Kristianstad efter förlusten mot Önnered");
  assert.match(h.standfirst, /3:a av 14 i Allsvenskan/);
  assert.match(coverHeadline({ ...common, seasonComplete: true, streak: null, lastResult: null, nextFixture: null }).headline, /i mål/);
  assert.match(coverHeadline({ ...common, seekingJob: true, streak: null, lastResult: null, nextFixture: null }).headline, /Utan klubb/);
});

test("club wall: ambition from the preseason forecast only; unknown clubs only under Alla", () => {
  const ctx = (clubId: string, predicted: number, n = 14, s = 0): ClubPreseasonContext => ({ clubId, predicted, clubsInLeague: n, expectation: "", strengthVsLeague: s, economyLabel: "", annualRevenueEur: 0, cashEur: 0 });
  assert.equal(ambitionOf(ctx("a", 1)), "VINNA");
  assert.equal(ambitionOf(ctx("a", 3)), "VINNA");
  assert.equal(ambitionOf(ctx("a", 4)), "UTMANA");
  assert.equal(ambitionOf(ctx("a", 11)), "UTMANA");
  assert.equal(ambitionOf(ctx("a", 12)), "OVERLEVA");
  assert.equal(ambitionOf(undefined), null);
  const clubs = [{ id: "a", leagueId: "L1" }, { id: "b", leagueId: "L1" }, { id: "c", leagueId: "L2" }, { id: "d", leagueId: "L2" }];
  const contexts = { a: ctx("a", 1), b: ctx("b", 13), c: ctx("c", 6) };
  assert.deepEqual(filterWall(clubs, contexts, "ALLA", "ALLA").map((c) => c.id), ["a", "b", "c", "d"]);
  assert.deepEqual(filterWall(clubs, contexts, "VINNA", "ALLA").map((c) => c.id), ["a"]);
  assert.deepEqual(filterWall(clubs, contexts, "UTMANA", "L2").map((c) => c.id), ["c"]);
  assert.deepEqual(filterWall(clubs, contexts, "ALLA", "L2").map((c) => c.id), ["c", "d"]);
  assert.deepEqual(ambitionCounts(clubs, contexts, "ALLA"), { ALLA: 4, VINNA: 1, UTMANA: 1, OVERLEVA: 1 });
  assert.equal(strengthMeter(0), 0.5);
  assert.equal(strengthMeter(40), 1);
  assert.equal(expectationMeter({ predicted: 1, clubsInLeague: 14 }), 1);
  assert.equal(expectationMeter({ predicted: 14, clubsInLeague: 14 }), 0);
});
