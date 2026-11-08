// HM-ALPHA2-01: real 2026/27 Profixio schedules (Handbollsligan +
// Herrallsvenskan) and manager-controlled (empty) lineups for New Game
// careers; legacy careers and CPU clubs keep automatic selection.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createNewCareerState } from "./newCareer";
import { snapshotWorldSquads, snapshotGameplayRatings } from "../gameWorld/serverSnapshot";
import { buildMatchdayReadyEvent } from "./careerEvents";
import { createProductionSession, startProductionMatch } from "./productionMatch";
import { buildSpatialMatchInput } from "./spatialMatch/spatialCareerMatch";
import { resolveCareerLineup } from "./spatialMatch/careerLineup";
import { getCareerSquad } from "./careerWorld";
import { getNextPlayerFixture, getPlayerFixtureOn } from "./calendar";
import { isSelectableForMatch } from "./playerStatus";
import { migrateCareerState } from "./saveMigration";
import { getClubsByCompetition } from "../game-data";
import { REAL_LEAGUE_SCHEDULES } from "../game-data/realLeagueSchedules";
import { parseProfixioScheduleSnapshot, validateRealLeagueSchedule, PROFIXIO_SCHEDULE_LEAGUES } from "../gameWorld/profixioSchedule";
import { buildEmptyMatchPlan, carriedLineupFor, manualLineupIssues, missingStartingPositions, previousLineupFor, resolveManualMatchPlan } from "./manualLineup";
import { addPlayerToSquad, assignNormalAttackSlot } from "../matchPlan/matchPlanEdits";
import { linkDefenceStarters } from "../matchPlan/startingUnits";
import { OUTCOURT_POSITIONS } from "../rating/types";
import type { CareerState } from "./types";
import type { MatchPlan } from "../matchPlan/types";
import { engineTeamMatchPlan } from '../matchPlan/engineMatchPlan';

const SNAPSHOT = new URL("../../../../data/real-world/sweden/2026-27/fixtures/profixio-schedules-2026-10-31.psv", import.meta.url);

test('Alpha hotfix: injury repair reserves the defensive specialist and reports an unresolved slot if nobody else can play', () => {
  const state = newGameCareer('se_club_ik_savehof', 'se_handbollsligan_herr');
  const own = state.fixtures.filter(f => f.homeClubId === state.playerClubId || f.awayClubId === state.playerClubId);
  let first = selectByHand(state, own[0].id);
  const squad = getCareerSquad(state);
  const starters = new Set(first.attackStartingUnit.slots.map(s => s.playerId));
  const specialist = squad.find(p => p.position !== 'MV' && !starters.has(p.id))!;
  const injured = first.attackStartingUnit.slots.find(s => s.position === specialist.position)!;
  const partner = first.attackStartingUnit.slots.find(s => s.position !== 'GK' && s.playerId !== injured.playerId)!;
  first = addPlayerToSquad(first, specialist.id, specialist.position as MatchPlan['squad']['players'][number]['position']);
  first = { ...first, substitutionPairs: [{ attackPlayerId: partner.playerId, defencePlayerId: specialist.id }], playerUsage: first.playerUsage.map(u => u.playerId === specialist.id ? { ...u, phaseUsage: 'DEFENCE_ONLY' } : u) };
  const withPlan = { ...state, matchPlans: { [own[0].id]: first } };
  const available = squad.filter(p => p.id !== injured.playerId && (starters.has(p.id) || p.id === specialist.id));
  const carried = carriedLineupFor(withPlan, own[1].id, available)!;
  assert.equal(carried.replacements[0].inId, null, 'a defender already occupying a different defensive slot is not a spare');
  assert.deepEqual(missingStartingPositions(carried.plan), [injured.position]);
  assert.ok(!carried.plan.attackStartingUnit.slots.some(s => s.playerId === specialist.id));
  assert.equal(engineTeamMatchPlan(carried.plan, undefined)!.pairs![0].defenceId, specialist.id);
  assert.ok(manualLineupIssues(carried.plan, available).length > 0);

  const spare = squad.find(p => p.position !== 'MV' && !starters.has(p.id) && p.id !== specialist.id)!;
  const repaired = carriedLineupFor(withPlan, own[1].id, [...available, spare])!;
  assert.equal(repaired.replacements[0].inId, spare.id);
  assert.deepEqual(manualLineupIssues(repaired.plan, [...available, spare]), []);
  assert.deepEqual(repaired.plan.substitutionPairs, first.substitutionPairs);
  const loaded = migrateCareerState(JSON.parse(JSON.stringify({ ...withPlan, matchPlans: { [own[1].id]: repaired.plan } })));
  assert.deepEqual(loaded.matchPlans[own[1].id], repaired.plan);
  const session = createProductionSession({ ...loaded, gameDate: own[1].date }, own[1]);
  assert.equal(new Set(session.core.players.map(p => p.id)).size, session.core.players.length);
  const defenders = repaired.plan.attackStartingUnit.slots.filter(s => s.position !== 'GK').map(s => s.playerId === partner.playerId ? specialist.id : s.playerId);
  assert.equal(new Set(defenders).size, 6);

  const partnerUnavailable = squad.filter(p => p.id !== partner.playerId && (starters.has(p.id) || p.id === specialist.id || p.id === spare.id));
  const partnerRepaired = carriedLineupFor(withPlan, own[1].id, partnerUnavailable)!;
  assert.equal(partnerRepaired.replacements[0].inId, spare.id);
  assert.deepEqual(partnerRepaired.plan.substitutionPairs, [{ attackPlayerId: spare.id, defencePlayerId: specialist.id }], 'an injured attacking partner is replaced without losing the specialist');
  assert.equal(engineTeamMatchPlan(partnerRepaired.plan, undefined)!.pairs![0].defenceId, specialist.id);
});

function newGameCareer(clubId: string, competitionId: string): CareerState {
  return createNewCareerState(`alpha2-${clubId}`, clubId, snapshotWorldSquads(competitionId), undefined, snapshotGameplayRatings(competitionId), null, "4_WEEKS");
}

function onMatchday(state: CareerState): CareerState {
  const fixture = getNextPlayerFixture(state)!;
  return { ...state, gameDate: fixture.date, careerEvents: [buildMatchdayReadyEvent(fixture.id, fixture.date)] };
}

/** What a manager does by hand in Taktik: pick a goalkeeper and six outfield players, one per position. */
function selectByHand(state: CareerState, fixtureId: string): MatchPlan {
  const available = getCareerSquad(state).filter((p) => isSelectableForMatch(state.playerStatuses, p.id));
  let plan = buildEmptyMatchPlan(fixtureId, state.playerClubId);
  const gk = available.find((p) => p.position === "MV")!;
  plan = assignNormalAttackSlot(addPlayerToSquad(plan, gk.id, "GK"), "GK", gk.id);
  const outfield = available.filter((p) => p.position !== "MV");
  OUTCOURT_POSITIONS.forEach((position, i) => {
    plan = assignNormalAttackSlot(addPlayerToSquad(plan, outfield[i].id, outfield[i].position as MatchPlan["squad"]["players"][number]["position"]), position, outfield[i].id);
  });
  return linkDefenceStarters(plan);
}

// ---------------------------------------------------------------------------
// Schedule data
// ---------------------------------------------------------------------------

test("generated schedule module is exactly the committed Profixio snapshot", () => {
  const parsed = parseProfixioScheduleSnapshot(fs.readFileSync(SNAPSHOT, "utf8"));
  for (const league of PROFIXIO_SCHEDULE_LEAGUES) {
    assert.deepEqual(REAL_LEAGUE_SCHEDULES[league.competitionId].fixtures, parsed[league.competitionId], league.competitionId);
  }
});

test("both leagues: 182 fixtures, all 14 canonical clubs, complete double round-robin, no duplicates", () => {
  for (const competitionId of ["se_handbollsligan_herr", "swe-2"]) {
    const clubIds = getClubsByCompetition(competitionId).map((c) => c.id);
    const { fixtures } = REAL_LEAGUE_SCHEDULES[competitionId];
    assert.equal(clubIds.length, 14);
    assert.equal(fixtures.length, 182);
    assert.deepEqual(validateRealLeagueSchedule(fixtures, clubIds), []);
    assert.equal(new Set(fixtures.map((f) => f.id)).size, 182);
    for (const club of clubIds) assert.equal(fixtures.filter((f) => f.homeClubId === club || f.awayClubId === club).length, 26, club);
    assert.ok(fixtures.every((f) => /^profixio-\d+$/.test(f.id) && f.id === `profixio-${f.profixioMatchId}`));
  }
});

test("spot checks against Profixio: kickoff, local time across DST, postponed fixture keeps its round", () => {
  const hbl = REAL_LEAGUE_SCHEDULES["se_handbollsligan_herr"].fixtures;
  const swe2 = REAL_LEAGUE_SCHEDULES["swe-2"].fixtures;
  assert.deepEqual(hbl[0], hbl.find((f) => f.id === "profixio-32642827"));
  assert.deepEqual(hbl.find((f) => f.id === "profixio-32642827"), { id: "profixio-32642827", profixioMatchId: "32642827", round: 1, date: "2026-09-23", kickoffTime: "19:00", homeClubId: "se_club_skanela_if", awayClubId: "se_club_hk_malmo" });
  // CET (after 25 Oct) -- Karlskrona v Hammarby, 31 Oct 18:30.
  assert.deepEqual(hbl.find((f) => f.id === "profixio-32642885"), { id: "profixio-32642885", profixioMatchId: "32642885", round: 9, date: "2026-10-31", kickoffTime: "18:30", homeClubId: "se_club_hf_karlskrona", awayClubId: "se_club_hammarby_if_hf" });
  // Postponed round-2 match played in December.
  assert.equal(hbl.find((f) => f.id === "profixio-32642837")!.round, 2);
  assert.equal(hbl.find((f) => f.id === "profixio-32642837")!.date, "2026-12-04");
  // Herrallsvenskan premiere (17 Sep) and IFK Tumba's own premiere (20 Sep).
  assert.equal(swe2[0].date, "2026-09-17");
  assert.deepEqual(swe2.find((f) => f.id === "profixio-32643548"), { id: "profixio-32643548", profixioMatchId: "32643548", round: 1, date: "2026-09-20", kickoffTime: "16:15", homeClubId: "swe2-tumba", awayClubId: "swe2-guif" });
});

// ---------------------------------------------------------------------------
// Career wiring
// ---------------------------------------------------------------------------

test("New Game career uses the real schedule (ids, rounds, dates, kickoff times) and no real results", () => {
  for (const [clubId, competitionId] of [["se_club_ik_savehof", "se_handbollsligan_herr"], ["swe2-tumba", "swe-2"]] as const) {
    const state = newGameCareer(clubId, competitionId);
    const league = state.fixtures.filter((f) => f.type === "LEAGUE");
    assert.equal(league.length, 182);
    assert.deepEqual(
      league.map((f) => [f.id, f.round, f.date, f.kickoffTime, f.homeClubId, f.awayClubId, f.sourceMatchId]),
      REAL_LEAGUE_SCHEDULES[competitionId].fixtures.map((f) => [f.id, f.round, f.date, f.kickoffTime, f.homeClubId, f.awayClubId, f.profixioMatchId]),
    );
    assert.deepEqual(state.results, {});
    assert.ok(league.every((f) => f.date >= state.gameDate), "no league fixture before the career's first day");
    const own = REAL_LEAGUE_SCHEDULES[competitionId].fixtures.filter((f) => f.homeClubId === clubId || f.awayClubId === clubId);
    const next = getNextPlayerFixture({ ...state, fixtures: league });
    assert.equal(next?.id, own[0].id, "next match is the club's first real fixture");
    assert.equal(getPlayerFixtureOn(state, own[0].date)?.id, own[0].id, "calendar finds the matchday by date");
  }
});

test("legacy no-preseason careers keep the generated schedule and automatic lineups", () => {
  const legacy = createNewCareerState("alpha2-legacy", "swe2-tumba", snapshotWorldSquads("swe-2"), undefined, snapshotGameplayRatings("swe-2"));
  assert.equal(legacy.lineupSelection, undefined);
  assert.ok(legacy.fixtures.every((f) => !f.id.startsWith("profixio-") && f.kickoffTime === undefined));
  const fixture = getNextPlayerFixture(legacy)!;
  const input = buildSpatialMatchInput(legacy, fixture);
  const own = fixture.homeClubId === legacy.playerClubId ? input.home : input.away;
  assert.ok(resolveCareerLineup(own.clubId, own.squad, own.plan), "default lineup still resolves");
});

// ---------------------------------------------------------------------------
// Manual lineup
// ---------------------------------------------------------------------------

test("new human career starts with zero selected players and the full squad available", () => {
  const state = newGameCareer("se_club_ik_savehof", "se_handbollsligan_herr");
  assert.equal(state.lineupSelection, "MANUAL");
  assert.deepEqual(state.matchPlans, {});
  const fixture = getNextPlayerFixture(state)!;
  const input = buildSpatialMatchInput(state, fixture);
  const own = fixture.homeClubId === state.playerClubId ? input.home : input.away;
  assert.equal(own.plan!.squad.players.length, 0, "bench and squad empty");
  assert.deepEqual(missingStartingPositions(own.plan!), ["GK", ...OUTCOURT_POSITIONS], "all seven slots empty");
  assert.equal(resolveCareerLineup(own.clubId, own.squad, own.plan), null, "nothing is selected behind the manager's back");
  assert.equal(own.squad.length, getCareerSquad(state).filter((p) => isSelectableForMatch(state.playerStatuses, p.id)).length);
  assert.ok(own.squad.length >= 7);
});

test("CPU opponents in a manual career still get a working automatic lineup", () => {
  const state = newGameCareer("se_club_ik_savehof", "se_handbollsligan_herr");
  const fixture = getNextPlayerFixture(state)!;
  const input = buildSpatialMatchInput(state, fixture);
  const cpu = fixture.homeClubId === state.playerClubId ? input.away : input.home;
  const lineup = resolveCareerLineup(cpu.clubId, cpu.squad, cpu.plan);
  assert.ok(lineup);
  assert.equal(Object.keys(lineup.startersByRole).length, 6);
});

test("kickoff is refused without an explicit complete lineup, with clear feedback", () => {
  const state = onMatchday(newGameCareer("se_club_ik_savehof", "se_handbollsligan_herr"));
  const fixture = getNextPlayerFixture(state)!;
  assert.throws(() => startProductionMatch(state), /Ingen startsju är vald/);
  const partial = assignNormalAttackSlot(buildEmptyMatchPlan(fixture.id, state.playerClubId), "GK", "");
  const available = getCareerSquad(state).filter((p) => isSelectableForMatch(state.playerStatuses, p.id));
  const gk = available.find((p) => p.position === "MV")!;
  const oneSelected = assignNormalAttackSlot(addPlayerToSquad(partial, gk.id, "GK"), "GK", gk.id);
  assert.match(manualLineupIssues(oneSelected, available).join(" "), /1 av 7 valda/);
  assert.throws(() => startProductionMatch({ ...state, matchPlans: { [fixture.id]: oneSelected } }), /Startsjuan är inte komplett/);
});

test("an explicit hand-picked seven starts the match and is exactly who plays", () => {
  const state = onMatchday(newGameCareer("se_club_ik_savehof", "se_handbollsligan_herr"));
  const fixture = getNextPlayerFixture(state)!;
  const plan = selectByHand(state, fixture.id);
  const available = getCareerSquad(state).filter((p) => isSelectableForMatch(state.playerStatuses, p.id));
  assert.deepEqual(manualLineupIssues(plan, available), []);
  const withPlan = { ...state, matchPlans: { [fixture.id]: plan } };
  const session = createProductionSession(withPlan, fixture);
  const team = fixture.homeClubId === state.playerClubId ? "HOME" : "AWAY";
  const onCourt = session.core.players.filter((p) => p.team === team && p.population === "COURT").map((p) => p.id).sort();
  assert.deepEqual(onCourt, plan.attackStartingUnit.slots.map((s) => s.playerId).sort());
  assert.ok(startProductionMatch(withPlan).productionMatch);
});

test("'use last lineup' is explicit, re-keyed to the new fixture, and drops unavailable players", () => {
  const state = newGameCareer("se_club_ik_savehof", "se_handbollsligan_herr");
  const own = state.fixtures.filter((f) => f.homeClubId === state.playerClubId || f.awayClubId === state.playerClubId);
  const first = selectByHand(state, own[0].id);
  const withFirst = { ...state, matchPlans: { [own[0].id]: first } };
  assert.equal(previousLineupFor(state, own[1].id, new Set(getCareerSquad(state).map((p) => p.id))), null, "nothing to copy before any selection");
  const injured = first.attackStartingUnit.slots[1].playerId;
  const available = new Set(getCareerSquad(state).map((p) => p.id).filter((id) => id !== injured));
  const copied = previousLineupFor(withFirst, own[1].id, available)!;
  assert.equal(copied.fixtureId, own[1].id);
  assert.equal(copied.squad.fixtureId, own[1].id);
  assert.ok(!copied.squad.players.some((p) => p.playerId === injured));
  assert.deepEqual(missingStartingPositions(copied), [first.attackStartingUnit.slots[1].position]);
});

test("old saves keep their schedule and selections (no lineup policy added by migration)", () => {
  const legacy = createNewCareerState("alpha2-old-save", "swe2-tumba", snapshotWorldSquads("swe-2"), undefined, snapshotGameplayRatings("swe-2"));
  const fixture = getNextPlayerFixture(legacy)!;
  const saved = { ...legacy, matchPlans: { [fixture.id]: selectByHand(legacy, fixture.id) } };
  const migrated = migrateCareerState(JSON.parse(JSON.stringify(saved)));
  assert.equal(migrated.lineupSelection, undefined);
  assert.deepEqual(migrated.fixtures, saved.fixtures);
  assert.deepEqual(migrated.matchPlans, saved.matchPlans);
});

// ---------------------------------------------------------------------------
// HM-ALPHA3-M10: preferred lineup carries over
// ---------------------------------------------------------------------------

test("M10: the last saved seven carries over to the next fixture and starts the match unchanged", () => {
  const state = onMatchday(newGameCareer("se_club_ik_savehof", "se_handbollsligan_herr"));
  const own = state.fixtures.filter((f) => f.homeClubId === state.playerClubId || f.awayClubId === state.playerClubId).sort((a, b) => a.date.localeCompare(b.date));
  const first = selectByHand(state, own[0].id);
  const next = { ...state, gameDate: own[1].date, careerEvents: [buildMatchdayReadyEvent(own[1].id, own[1].date)], matchPlans: { [own[0].id]: first } };
  const available = getCareerSquad(next).filter((p) => isSelectableForMatch(next.playerStatuses, p.id));
  const carried = carriedLineupFor(next, own[1].id, available)!;
  assert.deepEqual(carried.replacements, []);
  assert.equal(carried.plan.fixtureId, own[1].id);
  assert.deepEqual(carried.plan.attackStartingUnit.slots, first.attackStartingUnit.slots);
  assert.deepEqual(manualLineupIssues(resolveManualMatchPlan(next, own[1].id, available), available), []);
  const session = createProductionSession(next, own[1]);
  const team = own[1].homeClubId === next.playerClubId ? "HOME" : "AWAY";
  assert.deepEqual(session.core.players.filter((p) => p.team === team && p.population === "COURT").map((p) => p.id).sort(), first.attackStartingUnit.slots.map((s) => s.playerId).sort());
});

test("M10: an injured starter is replaced by an eligible player and the replacement is reported", () => {
  const state = newGameCareer("se_club_ik_savehof", "se_handbollsligan_herr");
  const own = state.fixtures.filter((f) => f.homeClubId === state.playerClubId || f.awayClubId === state.playerClubId).sort((a, b) => a.date.localeCompare(b.date));
  const first = selectByHand(state, own[0].id);
  const gkSlot = first.attackStartingUnit.slots.find((s) => s.position === "GK")!;
  const outfieldSlot = first.attackStartingUnit.slots.find((s) => s.position !== "GK")!;
  const injured: CareerState = { ...state, matchPlans: { [own[0].id]: first }, playerStatuses: { ...state.playerStatuses, [gkSlot.playerId]: { ...(state.playerStatuses[gkSlot.playerId] ?? {}), availability: "INJURED" } as never, [outfieldSlot.playerId]: { ...(state.playerStatuses[outfieldSlot.playerId] ?? {}), availability: "SUSPENDED" } as never } };
  const available = getCareerSquad(injured).filter((p) => isSelectableForMatch(injured.playerStatuses, p.id));
  const carried = carriedLineupFor(injured, own[1].id, available)!;
  assert.equal(carried.replacements.length, 2);
  const gkIn = carried.replacements.find((r) => r.position === "GK")!.inId!;
  assert.equal(getCareerSquad(injured).find((p) => p.id === gkIn)!.position, "MV", "a goalkeeper replaces a goalkeeper");
  const outIn = carried.replacements.find((r) => r.position === outfieldSlot.position)!.inId!;
  assert.notEqual(getCareerSquad(injured).find((p) => p.id === outIn)!.position, "MV", "never a goalkeeper outfield");
  assert.ok(!carried.plan.squad.players.some((p) => p.playerId === gkSlot.playerId || p.playerId === outfieldSlot.playerId));
  assert.deepEqual(manualLineupIssues(carried.plan, available), [], "the replaced seven is complete and valid");
});

test("M10: a fixture with its own saved selection is never overridden by the carried lineup", () => {
  const state = newGameCareer("se_club_ik_savehof", "se_handbollsligan_herr");
  const own = state.fixtures.filter((f) => f.homeClubId === state.playerClubId || f.awayClubId === state.playerClubId).sort((a, b) => a.date.localeCompare(b.date));
  const empty = buildEmptyMatchPlan(own[1].id, state.playerClubId);
  const withBoth = { ...state, matchPlans: { [own[0].id]: selectByHand(state, own[0].id), [own[1].id]: empty } };
  const available = getCareerSquad(withBoth).filter((p) => isSelectableForMatch(withBoth.playerStatuses, p.id));
  assert.equal(resolveManualMatchPlan(withBoth, own[1].id, available), empty, "the manager's explicit (even empty) choice wins");
  assert.equal(carriedLineupFor(state, own[0].id, available), null, "nothing carries before any selection");
});

test("M10: a quick result is coached by the assistant (substitutions and timeouts); a live match stays the manager's", () => {
  const state = onMatchday(newGameCareer("se_club_ik_savehof", "se_handbollsligan_herr"));
  const fixture = getNextPlayerFixture(state)!;
  const withPlan = { ...state, matchPlans: { [fixture.id]: selectByHand(state, fixture.id) } };
  const team = fixture.homeClubId === state.playerClubId ? "HOME" : "AWAY";
  const quick = startProductionMatch(withPlan, fixture.id, { quick: true }).productionMatch!;
  assert.equal(quick.core.coaching[team].rotation, true);
  assert.equal(quick.core.coaching[team].timeouts, true);
  const live = startProductionMatch(withPlan, fixture.id).productionMatch!;
  assert.equal(live.core.coaching[team].timeouts, false);
});
