// HM-M9G: the primary acceptance test -- a real Handbollsligan + Allsvenskan
// career, played through the actual season engine, carried into season 2 by the
// atomic transition fed with that season's own results, and played again.
//
// Real flow, as a manager plays it (scripts/qa-advance-career.ts): Continue,
// the manager's own matches resolved on their matchday, everything else in
// the daily world tick. Swedish world only (no international pool): the test
// is about the season lifecycle, not the transfer world.
import test from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import { continueCareerRhythm } from "./continueController";
import { playManagerFixtureLegacy } from "./legacy/matchday";
import { transitionCareerSeason } from "./careerTransitionEvidence";
import { clubCompetitionId } from "./competitionMembership";
import { competitionTable, competitionClubIds } from "../competition/tables";
import { tierRevenueFactor } from "../economy/clubEconomyIntegration";
import { HANDBOLLSLIGAN as HBL, ALLSVENSKAN as ALLSV, KVAL_ALLSVENSKAN } from "../competition/rules";
import { CLUBS } from "../game-data";
import type { CareerState } from "./types";

const MANAGER = "se_club_ifk_skovde_hk";
const competitions = [HBL, ALLSV];
const world = [...competitions, "se_division1_norra", "se_division1_sodra"];
const squads = Object.assign({}, ...world.map((c) => snapshotWorldSquads(c)));
const ratings = Object.assign({}, ...world.map((c) => snapshotGameplayRatings(c)));
const staff = Object.assign({}, ...competitions.map((c) => snapshotAllClubsStaff(c)));

/** Plays the current season to completion exactly as Continue + matchday do. */
function playSeason(start: CareerState): { state: CareerState; autoResolved: number } {
  let s = start;
  let autoResolved = 0;
  for (let i = 0; i < 4000 && !s.seasonComplete; i++) {
    const r = continueCareerRhythm(s);
    s = r.state;
    if (r.stopReason === "ACTION_REQUIRED" || r.stopReason === "ACTION_REQUIRED_PENDING") {
      const before = s;
      s = playManagerFixtureLegacy(s).state;
      if (s === before) {
        // A non-match decision the manager would take in the UI; accept the default to keep the season moving.
        autoResolved += s.careerEvents.filter((e) => e.requiresAction && !e.resolved).length;
        s = { ...s, careerEvents: s.careerEvents.map((e) => (e.requiresAction && !e.resolved ? { ...e, resolved: true } : e)) };
      }
    }
  }
  return { state: s, autoResolved };
}

const leagueFixtures = (s: CareerState, competitionId: string) => s.fixtures.filter((f) => f.type === "LEAGUE" && f.competitionId === competitionId);
const matchdayIncome = (s: CareerState, clubId: string, fromMonth: string, toMonth: string) =>
  (s.clubFinances?.[clubId]?.statements ?? []).filter((st) => st.month >= fromMonth && st.month <= toMonth).reduce((sum, st) => sum + (st.lines.find((l) => l.category === "MATCHDAY")?.amountEur ?? 0), 0);

test("M9G: a full HBL + Allsvenskan career plays season 1, transitions with genuine promotion and relegation, and plays season 2", { timeout: 20 * 60_000 }, () => {
  // ------------------------------------------------------------- season 1
  const created = createNewCareerState("m9g-two-seasons", MANAGER, squads, undefined, ratings, staff, "4_WEEKS");
  const s1 = playSeason(created);
  const one = s1.state;
  assert.equal(one.seasonComplete, true, "season 1 completes");
  assert.equal(one.seasonOutcome?.phase, "COMPLETE");
  assert.equal(one.seasonOutcome?.bothTiersSimulated, true);
  for (const c of competitions) {
    assert.equal(leagueFixtures(one, c).length, 182);
    assert.ok(leagueFixtures(one, c).every((f) => one.results[f.id]), `${c} fully played`);
  }
  assert.equal(one.fixtures.filter((f) => f.type !== "FRIENDLY" && !one.results[f.id]).length, 0, "playoffs, kval and cup complete");
  // D1: the closed boundary -- no Division 1 kval, no strength-selected Division 1 movement.
  assert.equal(Object.values(one.competitionTies ?? {}).filter((t) => t.competitionId === KVAL_ALLSVENSKAN).length, 0);
  const liveMoved = [...one.seasonOutcome!.promoted, ...one.seasonOutcome!.relegated];
  assert.ok(liveMoved.every((id) => [HBL, ALLSV].includes(clubCompetitionId(one, id) ?? "")), "live movement only between HBL and Allsvenskan");
  const hblTable = competitionTable(one, HBL).map((r) => r.clubId);
  const allsvTable = competitionTable(one, ALLSV).map((r) => r.clubId);
  const promotedClub = allsvTable[0]!;
  const relegatedClub = hblTable[13]!;
  const contractsBefore = Object.fromEntries(Object.entries(one.playerContracts).filter(([, c]) => c.clubId === promotedClub || c.clubId === relegatedClub));
  const firstLeagueDate = [...leagueFixtures(one, HBL), ...leagueFixtures(one, ALLSV)].map((f) => f.date).sort()[0]!;
  const s1Year = Number(one.seasonId.slice(0, 4));
  const s1MatchdayPromoted = matchdayIncome(one, promotedClub, `${s1Year}-08`, `${s1Year + 1}-06`);
  const s1MatchdayRelegated = matchdayIncome(one, relegatedClub, `${s1Year}-08`, `${s1Year + 1}-06`);

  // --------------------------------------------------------- transition
  const t = transitionCareerSeason(one);
  assert.equal(t.status, "APPLIED", JSON.stringify(t.blockers.slice(0, 8)));
  const two0 = t.state;
  const m = (id: string) => clubCompetitionId(two0, id);
  assert.equal(m(promotedClub), HBL, "the Allsvenskan winner is promoted");
  assert.equal(m(relegatedClub), ALLSV, "the HBL 14th is relegated");
  // The planner's result IS the live season's result: identical moves between the two tiers.
  for (const id of [...hblTable, ...allsvTable]) {
    const live: string | undefined = one.seasonOutcome!.nextMembership[id];
    if (live) assert.equal(m(id), live, `${id}: planner follows the live postseason`);
    else assert.equal(m(id), clubCompetitionId(one, id), `${id}: unchanged`);
  }
  assert.equal(competitionClubIds(two0, HBL).length, 14);
  assert.equal(competitionClubIds(two0, ALLSV).length, 14);
  assert.deepEqual([...competitionClubIds(two0, HBL), ...competitionClubIds(two0, ALLSV)].sort(), [...hblTable, ...allsvTable].sort(), "no club lost or duplicated");
  for (const c of CLUBS.filter((c) => c.competitionId.startsWith("se_division1"))) assert.equal(m(c.id), clubCompetitionId(one, c.id), "Division 1 untouched");
  // Calendar: fresh, complete, after the derived kickoff (same weekday, one year on).
  const kickoff = two0.leagueKickoffDate!;
  assert.ok(kickoff.startsWith(`${s1Year + 1}-`) && kickoff > one.gameDate);
  assert.equal(new Date(`${kickoff}T00:00:00Z`).getUTCDay(), new Date(`${firstLeagueDate}T00:00:00Z`).getUTCDay());
  const oldIds = new Set(one.fixtures.map((f) => f.id));
  for (const c of competitions) {
    const fx = leagueFixtures(two0, c);
    assert.equal(fx.length, 182);
    assert.ok(fx.every((f) => !oldIds.has(f.id) && f.date >= kickoff));
  }
  assert.equal(leagueFixtures(two0, HBL).filter((f) => f.homeClubId === promotedClub || f.awayClubId === promotedClub).length, 26);
  assert.equal(leagueFixtures(two0, ALLSV).filter((f) => f.homeClubId === relegatedClub || f.awayClubId === relegatedClub).length, 26);
  // History, contracts, finances.
  assert.equal(two0.seasonHistory!.length, (one.seasonHistory?.length ?? 0) + 1);
  assert.equal(two0.seasonHistory!.at(-1)!.seasonId, one.seasonId);
  for (const [id, c] of Object.entries(contractsBefore)) assert.deepEqual(two0.playerContracts[id], c, "contracts intact");
  assert.ok(Math.abs(tierRevenueFactor(two0, promotedClub) - 1.35) < 1e-9 || clubCompetitionId(created, promotedClub) === HBL, "a promoted club earns at the higher tier");
  assert.ok(Math.abs(tierRevenueFactor(two0, relegatedClub) - 0.72) < 1e-9 || clubCompetitionId(created, relegatedClub) === ALLSV, "a relegated club no longer earns at HBL tier");
  assert.deepEqual(two0.clubEconomies, one.clubEconomies, "cash carries over unchanged at the transition itself");

  // ------------------------------------------------------------- season 2
  const s2 = playSeason(two0);
  const two = s2.state;
  assert.equal(two.seasonComplete, true, "season 2 completes");
  assert.equal(two.seasonId, `${s1Year + 1}/${String(s1Year + 2).slice(-2)}`);
  for (const c of competitions) assert.ok(leagueFixtures(two, c).every((f) => two.results[f.id]), `${c} season 2 fully played`);
  assert.ok(competitionTable(two, HBL).some((r) => r.clubId === promotedClub && r.played === 26), "the promoted club competes in HBL");
  assert.ok(!competitionTable(two, HBL).some((r) => r.clubId === relegatedClub));
  assert.ok(competitionTable(two, ALLSV).some((r) => r.clubId === relegatedClub && r.played === 26), "the relegated club competes in Allsvenskan");
  assert.ok(!competitionTable(two, ALLSV).some((r) => r.clubId === promotedClub));
  // Membership is consistent everywhere: every league fixture's clubs belong to that league.
  for (const f of two.fixtures.filter((f) => f.type === "LEAGUE")) {
    assert.equal(clubCompetitionId(two, f.homeClubId), f.competitionId);
    assert.equal(clubCompetitionId(two, f.awayClubId), f.competitionId);
  }
  assert.equal(two.seasonOutcome?.seasonId, two.seasonId, "no old-season outcome active");
  assert.ok(two.fixtures.every((f) => !oldIds.has(f.id)), "no season-1 fixture remains active");
  // Matchday income: every HBL and Allsvenskan club earns from its home games in season 2.
  const from = `${s1Year + 1}-08`, to = `${s1Year + 2}-06`;
  for (const id of [...competitionClubIds(two, HBL), ...competitionClubIds(two, ALLSV)]) {
    if (id === two.playerClubId) continue; // the manager's club keeps its own full ledger history; checked the same way below
    assert.ok(matchdayIncome(two, id, from, to) > 0, `${id} earns matchday income in season 2`);
  }
  assert.ok(matchdayIncome(two, two.playerClubId, from, to) > 0);
  // Tier-bound revenue follows the new division exactly (x1.35 up, x0.72 down). Matchday income also
  // moves with attendance (form, derbies, extra kval/playoff home games), so it is reported, not asserted.
  const monthlyLine = (st: CareerState, clubId: string, month: string, category: string) => st.clubFinances?.[clubId]?.statements.find((x) => x.month === month)?.lines.find((l) => l.category === category)?.amountEur ?? 0;
  const s1Month = `${s1Year + 1}-03`, s2Month = `${s1Year + 2}-03`;
  for (const category of ["SPONSORSHIP", "MEDIA"]) {
    const up1 = monthlyLine(one, promotedClub, s1Month, category), up2 = monthlyLine(two, promotedClub, s2Month, category);
    const down1 = monthlyLine(one, relegatedClub, s1Month, category), down2 = monthlyLine(two, relegatedClub, s2Month, category);
    assert.ok(up1 > 0 && Math.abs(up2 / up1 - 1.35) < 0.01, `${category}: promoted club earns at HBL tier (${up1} -> ${up2})`);
    assert.ok(down1 > 0 && Math.abs(down2 / down1 - 0.72) < 0.01, `${category}: relegated club no longer earns at HBL tier (${down1} -> ${down2})`);
  }

  // ------------------------------------------------- season 2 -> season 3
  const t2 = transitionCareerSeason(two);
  assert.equal(t2.status, "APPLIED", JSON.stringify(t2.blockers.slice(0, 8)));
  assert.equal(competitionClubIds(t2.state, HBL).length, 14);
  assert.equal(competitionClubIds(t2.state, ALLSV).length, 14);
  assert.equal(t2.state.seasonHistory!.length, two.seasonHistory!.length + 1);
  console.log(JSON.stringify({ promotedClub, relegatedClub, kickoff, autoResolved: s1.autoResolved + s2.autoResolved, s1MatchdayPromoted, s2MatchdayPromoted: matchdayIncome(two, promotedClub, from, to), s1MatchdayRelegated, s2MatchdayRelegated: matchdayIncome(two, relegatedClub, from, to), livePromoted: one.seasonOutcome!.promoted, liveRelegated: one.seasonOutcome!.relegated, season3: t2.state.seasonId }));
});
