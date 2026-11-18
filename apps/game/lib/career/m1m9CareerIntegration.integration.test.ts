// HM M1-M9 INTEGRATION: a real two-season career on main's architecture.
//
// The M9 requirements (real sporting results feed the transition, promotion and
// relegation, atomic rollover, consistent membership, financial context,
// fixtures, history, season 2 playable) verified on main's own season pipeline
// -- GAME_CONTINUITY through the unchanged atomic transition -- and the M8
// transfer ecosystem (PCDM, international market, youth intake, ageing) running
// inside the same career. Flow as main's stock-career validation
// (scripts/division2-stock-career.ts): Continue, manager match plans and
// production quick matches, ordinary manager answers to concerns and board
// warnings; CPU clubs use their unmodified daily lifecycle.
import test from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { SWEDISH_WORLD_COMPETITION_IDS } from "./worldCompetitions";
import { WORLD_POOL_COMPETITION_IDS } from "./careerWorld";
import { continueCareerRhythm } from "./continueController";
import { playManagerFixture } from "./matchdayAction";
import { attemptSeasonTransition } from "./seasonTransition";
import { acceptBoardContract } from "../manager/managerCareer";
import { answerConcern } from "../players/talks";
import { submitBoardRecoveryPlan } from "../board/board";
import { withoutNationalDuty } from "../nationalTeam/duty";
import { getCareerSquad } from "./careerWorld";
import { isSelectableForMatch } from "./playerStatus";
import { resolveClubMatchPlanForFixture } from "./playerMatchStrength";
import { getPlayerFixtureOn } from "./calendar";
import { renewPlayerContract } from "./contractRenewal";
import { intentionMinimumWage } from "../players/intentions";
import { clubCompetitionId } from "./competitionMembership";
import { competitionTable, competitionClubIds } from "../competition/tables";
import { tierRevenueFactor } from "../economy/clubEconomyIntegration";
import { HANDBOLLSLIGAN as HBL, ALLSVENSKAN as ALLSV } from "../competition/rules";
import { worldPoolClubIds } from "../transfers/careerDecision/sportingStrength";
import type { CareerState } from "./types";

const MANAGER = "se_club_ifk_skovde_hk";
const world = [...SWEDISH_WORLD_COMPETITION_IDS, ...WORLD_POOL_COMPETITION_IDS];
const squads = Object.assign({}, ...world.map((c) => snapshotWorldSquads(c)));
const ratings = Object.assign({}, ...world.map((c) => snapshotGameplayRatings(c)));

function playSeason(start: CareerState): CareerState {
  let s = start;
  const from = s.seasonId;
  for (let guard = 0; guard < 3000 && !s.seasonComplete; guard++) {
    if (s.board?.contractOffer && s.board.contractOffer.expiresOn >= s.gameDate) s = acceptBoardContract(s);
    // Ordinary manager retention decisions, exactly as main's stock-career validation: offer the expiring
    // players a renewal at their wage floor; the player (PCDM) and the budget may still refuse.
    for (const p of s.worldSquads[s.playerClubId] ?? []) {
      const c = s.playerContracts[p.id];
      if (c && c.contractEndDate <= `${Number(s.gameDate.slice(0, 4)) + 1}-05-31` && c.contractEndDate >= s.gameDate) {
        try { s = renewPlayerContract(s, p.id, 3, Math.max(c.wageEurPerMonth, intentionMinimumWage(s, p.id))); } catch { /* a normal refusal or budget limit */ }
      }
    }
    const press = continueCareerRhythm(s);
    s = press.state;
    if (press.stopReason === "ACTION_REQUIRED" || press.stopReason === "ACTION_REQUIRED_PENDING") {
      let handled = false;
      for (const c of Object.values(s.playerDynamics?.concerns ?? {}).filter((c) => c.status === "OPEN")) {
        const option = c.options.find((o) => ["EARN_IT", "PATIENCE", "LATER"].includes(o.id)) ?? c.options[0];
        if (option) { s = answerConcern(s, c.id, option.id); handled = true; }
      }
      for (const m of s.board?.meetings ?? []) {
        if (s.careerEvents.some((e) => e.id === `BOARD_UPDATE:${m.id}` && e.requiresAction && !e.resolved) && ["WARNING", "FINAL_WARNING"].includes(m.kind)) { s = submitBoardRecoveryPlan(s, m.id); handled = true; }
      }
      const fixture = getPlayerFixtureOn(s, s.gameDate);
      if (!fixture && handled) continue;
      if (fixture) {
        const available = withoutNationalDuty(s, getCareerSquad(s).filter((p) => isSelectableForMatch(s.playerStatuses, p.id)));
        const plan = resolveClubMatchPlanForFixture(s.playerClubId, fixture.id, available, undefined);
        assert.ok(plan, `the manager can field a valid seven (${s.gameDate}, squad ${getCareerSquad(s).length}, available ${available.length})`);
        s = { ...s, matchPlans: { ...s.matchPlans, [fixture.id]: plan } };
      }
      const action = playManagerFixture(s);
      assert.ok(action.result, JSON.stringify({ date: s.gameDate, pending: s.careerEvents.filter((e) => e.requiresAction && !e.resolved).map((e) => e.id) }));
      s = action.state;
    }
    assert.ok(s.gameDate <= `${Number(from.slice(0, 4)) + 1}-07-01`, "season exceeded its deadline");
  }
  return s;
}

const leagueFixtures = (s: CareerState, c: string) => s.fixtures.filter((f) => f.type === "LEAGUE" && f.competitionId === c);
const matchday = (s: CareerState, clubId: string, from: string, to: string) =>
  (s.clubFinances?.[clubId]?.statements ?? []).filter((st) => st.month >= from && st.month <= to).reduce((sum, st) => sum + (st.lines.find((l) => l.category === "MATCHDAY")?.amountEur ?? 0), 0);

test("M1-M9 integration: a real HBL career on main plays season 1, rolls over with genuine promotion and relegation, and plays season 2 -- with the M8 transfer world active", { timeout: 60 * 60_000 }, () => {
  const created = createNewCareerState("m1m9-integration", MANAGER, squads, undefined, ratings, {}, "4_WEEKS");
  const poolAtStart = worldPoolClubIds(created).reduce((n, id) => n + (created.worldSquads[id]?.length ?? 0), 0);
  const one = playSeason(created);
  assert.equal(one.seasonComplete, true, "season 1 completes");
  for (const c of [HBL, ALLSV]) assert.ok(leagueFixtures(one, c).length === 182 && leagueFixtures(one, c).every((f) => one.results[f.id]), `${c} fully played`);
  const hbl = competitionTable(one, HBL).map((r) => r.clubId);
  const allsv = competitionTable(one, ALLSV).map((r) => r.clubId);
  const promoted = allsv[0]!, relegated = hbl[13]!;
  const y = Number(one.seasonId.slice(0, 4));

  // M8 inside the career: the international market ran (youth promotions, renewals or signings) and the pool grew from its 100-player start.
  const intl = one.cpuDecisionLog.filter((e) => e.id.startsWith("intl-"));
  assert.ok(intl.length > 0, "the international market is active in a real career");
  assert.ok(worldPoolClubIds(one).reduce((n, id) => n + (one.worldSquads[id]?.length ?? 0), 0) > poolAtStart, "international youth intake replenishes the world pool");

  // ------------------------------------------------------------ transition
  const t = attemptSeasonTransition(one);
  assert.equal(t.status, "APPLIED", JSON.stringify(t.blockers.slice(0, 8)));
  const two0 = t.state;
  assert.equal(clubCompetitionId(two0, promoted), HBL, "the Allsvenskan winner is promoted");
  assert.equal(clubCompetitionId(two0, relegated), ALLSV, "the HBL 14th is relegated");
  assert.equal(competitionClubIds(two0, HBL).length, 14);
  assert.equal(competitionClubIds(two0, ALLSV).length, 14);
  const oldIds = new Set(one.fixtures.map((f) => f.id));
  for (const c of [HBL, ALLSV]) assert.ok(leagueFixtures(two0, c).length === 182 && leagueFixtures(two0, c).every((f) => !oldIds.has(f.id)), `${c}: a fresh season-2 calendar`);
  assert.equal(two0.seasonHistory!.length, (one.seasonHistory?.length ?? 0) + 1, "the finished season is archived");
  for (const [id, c] of Object.entries(one.playerContracts)) if (two0.playerContracts[id]) assert.deepEqual(two0.playerContracts[id], c, "contracts intact at rollover");
  assert.ok(Math.abs(tierRevenueFactor(two0, promoted) - 1.35) < 1e-9 || tierRevenueFactor(two0, promoted) > tierRevenueFactor(one, promoted), "promotion raises the club's financial tier");
  assert.ok(tierRevenueFactor(two0, relegated) < tierRevenueFactor(one, relegated), "relegation lowers it");

  // --------------------------------------------------------------- season 2
  const two = playSeason(two0);
  assert.equal(two.seasonComplete, true, "season 2 completes");
  assert.ok(competitionTable(two, HBL).some((r) => r.clubId === promoted && r.played === 26), "the promoted club competes in HBL");
  assert.ok(competitionTable(two, ALLSV).some((r) => r.clubId === relegated && r.played === 26), "the relegated club competes in Allsvenskan");
  for (const f of two.fixtures.filter((f) => f.type === "LEAGUE")) {
    assert.equal(clubCompetitionId(two, f.homeClubId), f.competitionId);
    assert.equal(clubCompetitionId(two, f.awayClubId), f.competitionId);
  }
  assert.ok(two.fixtures.every((f) => !oldIds.has(f.id)), "no season-1 fixture remains active");
  const from = `${y + 1}-08`, to = `${y + 2}-06`;
  for (const id of [...competitionClubIds(two, HBL), ...competitionClubIds(two, ALLSV)]) assert.ok(matchday(two, id, from, to) > 0, `${id} earns matchday income in season 2`);
  const t2 = attemptSeasonTransition(two);
  assert.equal(t2.status, "APPLIED", JSON.stringify(t2.blockers.slice(0, 8)));
  console.log(JSON.stringify({ promoted, relegated, livePromoted: one.seasonOutcome?.promoted, liveRelegated: one.seasonOutcome?.relegated, intlEvents: intl.length, poolAtStart, poolAfterSeason1: worldPoolClubIds(one).reduce((n, id) => n + (one.worldSquads[id]?.length ?? 0), 0), season3: t2.state.seasonId }));
});
