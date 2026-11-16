// Arena Nights -- CMP-01 League Centre view models: read-only, zones only from the verified rules, honest gaps.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ALLSVENSKAN, SVENSKA_CUPEN } from "./rules";
import { competitionTable } from "./tables";
import { annotatedStandings } from "./standingsZones";
import { clubPeek, clubTiles, competitionOverview, decidingFixtures, fixturesByRound, halfTimeScore, ownClubCentre, rollOfHonour, roundProgress, tableView, zoneLines } from "./leagueCentre";
import { leagueCareer, playRounds } from "./competitionTestCareer";

test("round progress counts complete rounds and finds the next round", () => {
  const s = playRounds(leagueCareer(), 3);
  const p = roundProgress(s, ALLSVENSKAN);
  assert.equal(p.completed, 3);
  assert.ok(p.total >= 26);
  assert.equal(p.nextRound, 4);
  assert.ok(p.nextRoundDate);
});

test("home + away views add up to the official table; form view holds at most five games", () => {
  const s = playRounds(leagueCareer(), 7);
  const total = new Map(competitionTable(s, ALLSVENSKAN).map((r) => [r.clubId, r]));
  const home = new Map(tableView(s, ALLSVENSKAN, "HOME").map((r) => [r.clubId, r]));
  const away = new Map(tableView(s, ALLSVENSKAN, "AWAY").map((r) => [r.clubId, r]));
  for (const [id, t] of total) {
    assert.equal(home.get(id)!.played + away.get(id)!.played, t.played, id);
    assert.equal(home.get(id)!.points + away.get(id)!.points, t.points, id);
    assert.equal(home.get(id)!.goalsFor + away.get(id)!.goalsFor, t.goalsFor, id);
  }
  for (const r of tableView(s, ALLSVENSKAN, "FORM")) { assert.ok(r.played <= 5); assert.equal(r.form.length, r.played); }
});

test("own club gaps measure to the verified zone lines only", () => {
  const s = playRounds(leagueCareer(), 6);
  const annotated = annotatedStandings(s, ALLSVENSKAN);
  // Allsvenskan zones: 1 | 2-4 | 5-10 | 11-12 | 13-14 -> boundaries after 1, 4, 10, 12.
  assert.deepEqual(zoneLines(ALLSVENSKAN, annotated), [1, 4, 10, 12]);
  const centre = ownClubCentre(s, ALLSVENSKAN, annotated)!;
  const me = annotated.find((a) => a.row.clubId === s.playerClubId)!;
  assert.equal(centre.position, me.position);
  if (centre.above) { assert.ok(centre.above.after < me.position); assert.equal(centre.above.gap, annotated[centre.above.after - 1]!.row.points - me.row.points); }
  if (centre.below) { assert.ok(centre.below.after >= me.position); assert.equal(centre.below.gap, me.row.points - annotated[centre.below.after]!.row.points); }
  assert.ok(centre.next.length <= 3);
  // A league without verified zones has no lines at all.
  assert.deepEqual(zoneLines("se_division1_norra", annotated), []);
  for (const f of decidingFixtures(s, ALLSVENSKAN, [s.playerClubId])) { assert.equal(s.results[f.id], undefined); assert.ok(f.homeClubId === s.playerClubId || f.awayClubId === s.playerClubId); }
});

test("fixtures and results group by round: next round first, latest result first, own game first in its round", () => {
  const s = playRounds(leagueCareer(), 4);
  const up = fixturesByRound(s, ALLSVENSKAN, "upcoming");
  assert.equal(up[0]!.label, "Omgång 5");
  const done = fixturesByRound(s, ALLSVENSKAN, "played");
  assert.equal(done[0]!.label, "Omgång 4");
  assert.equal(done.at(-1)!.label, "Omgång 1");
  for (const g of [...up, ...done]) if (g.own) assert.equal(g.rows[0]!.own, true);
  assert.equal(done[0]!.rows[0]!.halfTime, "10–9");
});

test("half-time score comes only from a stored goal timeline", () => {
  assert.equal(halfTimeScore(null), null);
  assert.equal(halfTimeScore({ events: [] }), null);
  assert.equal(halfTimeScore({ events: [{ minute: 40, side: "home", type: "GOAL", homeScoreAfter: 1, awayScoreAfter: 0 }] }), "0–0");
  assert.equal(halfTimeScore({ events: [{ minute: 12, side: "away", type: "GOAL", homeScoreAfter: 3, awayScoreAfter: 4 }, { minute: 31, side: "home", type: "GOAL", homeScoreAfter: 4, awayScoreAfter: 4 }] }), "3–4");
});

test("overview: own league first, cup listed, recruitment leagues marked not simulated", () => {
  const s = leagueCareer();
  const o = competitionOverview(s);
  assert.equal(o.mine[0]!.id, ALLSVENSKAN);
  assert.equal(o.mine[0]!.own, true);
  assert.ok([...o.mine, ...o.sweden].some((c) => c.id === SVENSKA_CUPEN && c.kind === "CUP"));
  assert.ok(o.world.length > 0);
  assert.ok(o.world.every((c) => c.nation !== "SWE"));
});

test("club tiles and the club Peek carry no ability ratings", () => {
  const s = playRounds(leagueCareer(), 2);
  const tiles = clubTiles(s, ALLSVENSKAN);
  assert.ok(tiles.length >= 12);
  assert.ok(tiles.some((t) => t.own));
  const other = tiles.find((t) => !t.own)!;
  const peek = clubPeek(s, other.clubId)!;
  assert.equal(peek.own, false);
  assert.ok(peek.position !== null);
  assert.ok(!/currentAbility|potentialAbility/i.test(JSON.stringify(peek)));
  if (peek.squad) assert.ok(peek.squad.byPosition.reduce((n, p) => n + p.count, 0) <= peek.squad.total);
});

test("roll of honour is empty before any season is archived", () => {
  assert.deepEqual(rollOfHonour(leagueCareer(), ALLSVENSKAN), []);
});
