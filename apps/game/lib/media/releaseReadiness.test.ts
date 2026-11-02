// HM-ALPHA3-M08/M09 release readiness: club geography, the suspended
// manager's bench, supporter sentiment, national-team windows and Klubbhuset.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import type { CareerFixture, CareerState } from "../career/types";
import type { CareerEvent } from "../career/careerEvents";
import { buildMatchdayReadyEvent } from "../career/careerEvents";
import { ensureClubFinances, homeAttendance } from "../economy/ledger";
import { getClubEconomyBaseline } from "../economy/clubEconomyIntegration";
import { getClub } from "../game-data";
import { HANDBOLLSLIGAN } from "../competition/rules";
import { getRealLeagueSchedule } from "../game-data/realLeagueSchedules";
import { addDaysIso, managerSquadIds } from "../players/dynamicsState";
import { commandProductionMatch, createProductionSession, finishProductionMatch, startProductionMatch } from "../career/productionMatch";
import { migrateCareerState } from "../career/saveMigration";
import { geographicTie } from "./registry";
import { emptyMedia, mediaOf, withMedia } from "./people";
import { effectsOf } from "./press";
import { matchControl, progressDiscipline } from "./discipline";
import { progressMedia } from "./worldTick";
import type { DisciplineCase, PressQuestion } from "./types";
import { avoidNationalBreaks, NATIONAL_WINDOWS, nationalTeamOf, ownCallUps, progressNationalTeam, windowOn } from "../nationalTeam/nationalTeam";
import { clubHq, hqTier } from "../clubhq/clubhq";

const SKOVDE = "se_club_ifk_skovde_hk";
function career(club = SKOVDE): CareerState {
  const s = createNewCareerState("rr-tests", club, snapshotWorldSquads(HANDBOLLSLIGAN), undefined, snapshotGameplayRatings(HANDBOLLSLIGAN), snapshotAllClubsStaff(HANDBOLLSLIGAN));
  return { ...ensureClubFinances(s, "2026-07-01"), media: emptyMedia() };
}
const sink = () => { const events: CareerEvent[] = []; return { events, emit: (e: CareerEvent) => events.push(e) }; };
function suspend(s: CareerState, date: string, matches = 1): CareerState {
  const c: DisciplineCase = { id: "dc:test", openedOn: addDaysIso(date, -10), statement: "Domarna var köpta.", provision: "RF 14:2 p.7", severity: 2, status: "DECIDED", decisionOn: date, outcome: "AVSTANGNING", matches, servedMatches: 0 };
  return withMedia(s, (m) => ({ ...m, discipline: { ...m.discipline, [c.id]: c } }));
}

test("club geography: Amo HK plays in Alstermo and IF Hallby HK in Jönköping; Hallby–Kristianstad is no longer a derby", () => {
  assert.equal(getClub("se_club_amo_hk")?.city, "Alstermo");
  assert.equal(getClub("se_club_if_hallby_hk")?.city, "Jönköping");
  assert.ok(geographicTie("se_club_if_hallby_hk", "se_club_ifk_kristianstad") < 3);
  const s = career("se_club_if_hallby_hk");
  const f = { id: "geo-test", competitionId: HANDBOLLSLIGAN, round: 1, date: "2026-10-01", homeClubId: "se_club_if_hallby_hk", awayClubId: "se_club_ifk_kristianstad", type: "LEAGUE" } as CareerFixture;
  const g = { ...f, id: "geo-test-2", awayClubId: "se_club_amo_hk" } as CareerFixture;
  const base = getClubEconomyBaseline(s, f.homeClubId)!;
  // Same fixture id and seed, only the visitor differs: Kristianstad draws no derby bonus, like any other visitor of its level.
  const vsKristianstad = homeAttendance(s, f, base).attendance, vsAmo = homeAttendance(s, { ...g, id: f.id }, base).attendance;
  assert.ok(vsKristianstad - vsAmo < homeAttendance(s, f, base).capacity * 0.1, `${vsKristianstad} vs ${vsAmo}`);
});

test("a suspended manager cannot coach during the match: the assistant runs the bench until the suspension is served", () => {
  let s = career();
  const f = s.fixtures.find((x) => x.homeClubId === SKOVDE || x.awayClubId === SKOVDE)!;
  s = { ...s, gameDate: f.date, careerEvents: [buildMatchdayReadyEvent(f.id, f.date)] };
  assert.equal(matchControl(s).by, "MANAGER");
  const free = createProductionSession(s, f);
  const own = f.homeClubId === SKOVDE ? "HOME" : "AWAY";
  assert.equal(free.control, undefined);
  s = suspend(s, f.date);
  const control = matchControl(s);
  assert.equal(control.by, "ASSISTANT");
  if (control.by === "ASSISTANT") { assert.ok(control.name.length > 0); assert.match(control.reason, /avstängd/); }
  let running = startProductionMatch(s);
  const session = running.productionMatch!;
  assert.equal(session.control?.by, "ASSISTANT");
  assert.equal(session.core.coaching[own].rotation, true, "the assistant rotates the squad");
  assert.equal(session.core.coaching[own].timeouts, true, "the assistant takes timeouts");
  assert.throws(() => commandProductionMatch(running, { kind: "TACTICS", team: own, patch: { tempo: "QUICK" } }), /leder laget/);
  assert.throws(() => commandProductionMatch(running, { kind: "TIMEOUT", team: own }), /leder laget/);
  // The match is played to the end, the suspension is served, and control returns.
  running = finishProductionMatch(running);
  assert.ok(running.results[f.id], "played by the engine");
  running = progressDiscipline(running, addDaysIso(f.date, 1), () => undefined);
  assert.equal(mediaOf(running).discipline["dc:test"]!.servedMatches, 1);
  assert.equal(matchControl(running).by, "MANAGER");
});

test("supporters follow results against expectations, fade back over time, and words lift them less the higher they are", () => {
  let s = career();
  const { emit } = sink();
  // A long quiet spell: sentiment fades towards neutral, it does not stay where it was.
  s = withMedia(s, (m) => ({ ...m, supporters: 30 }));
  let d = "2026-07-06"; // a Monday, no matches yet
  for (let i = 0; i < 4; i++, d = addDaysIso(d, 7)) s = progressMedia({ ...s, gameDate: d }, d, [], emit);
  assert.ok(mediaOf(s).supporters < 22, `faded to ${mediaOf(s).supporters}`);
  // Talk lifts the stands less when they are already high.
  const q = { id: "q0", journalistId: "j", topic: "PREVIEW", text: "", answers: [] } as unknown as PressQuestion;
  const low = effectsOf(withMedia(s, (m) => ({ ...m, supporters: 0 })), q, "PROVOCATIVE", { topic: "PREVIEW" }).find((c) => c.area === "SUPPORTERS")!.delta;
  const high = effectsOf(withMedia(s, (m) => ({ ...m, supporters: 45 })), q, "PROVOCATIVE", { topic: "PREVIEW" }).find((c) => c.area === "SUPPORTERS")?.delta ?? 0;
  assert.ok(high < low, `${high} < ${low}`);
});

test("national-team windows: the real calendar, call-ups from the game's Swedish players, news, returns with effects, and persistence", () => {
  // The 2026/27 Handbollsligan schedule already pauses for every window; generated seasons now do the same.
  const real = getRealLeagueSchedule(HANDBOLLSLIGAN)!.fixtures;
  for (const w of NATIONAL_WINDOWS.filter((x) => x.start < "2027-06-01")) assert.equal(real.filter((f) => f.date >= w.start && f.date <= w.end).length, 0, w.id);
  const generated = Array.from({ length: 26 }, (_, i) => ({ round: i + 1, date: addDaysIso("2027-09-04", i * 7) }));
  const moved = avoidNationalBreaks(generated);
  assert.equal(moved.filter((f) => windowOn(f.date)).length, 0, "no generated league round inside a national break");
  assert.ok(moved.every((f, i) => i === 0 || f.date > moved[i - 1]!.date), "round order kept");

  const w = NATIONAL_WINDOWS[0]!;
  // Manage the club of a player the federation will call, so the return is felt at home.
  let probe = career();
  for (let d = w.start; d <= w.start; d = addDaysIso(d, 1)) probe = progressNationalTeam({ ...probe, gameDate: d }, d, () => undefined);
  const home = nationalTeamOf(probe).windows[w.id]!.squad.find((p) => getClub(p.clubId)?.competitionId === HANDBOLLSLIGAN)!.clubId;
  let s = career(home);
  const { events, emit } = sink();
  for (let d = addDaysIso(w.start, -1); d <= addDaysIso(w.end, 1); d = addDaysIso(d, 1)) s = progressNationalTeam({ ...s, gameDate: d }, d, emit);
  const st = nationalTeamOf(s).windows[w.id]!;
  assert.equal(st.status, "DONE");
  assert.ok(st.squad.length >= 6);
  for (const p of st.squad) assert.equal(Object.values(s.worldSquads).flat().find((x) => x.id === p.playerId)?.nationality, "SWE");
  assert.equal(st.results.length, 4, "the whole group's round is simulated");
  assert.ok(st.results.some((r) => r.home === "Sverige" && r.away === "Grekland"));
  const stories = Object.values(mediaOf(s).stories).filter((x) => x.kind === "NATIONAL_TEAM");
  assert.ok(stories.some((x) => x.outletId === "svt-sport") && stories.some((x) => x.outletId === "handbollskanalen"));
  assert.ok(events.some((e) => e.subject.startsWith("Landslagsuppehåll")));
  const own = ownCallUps(s, w.id);
  assert.ok(own.length > 0, "the manager has a player in the squad");
  for (const id of own) assert.ok((s.playerPhysicalState[id]?.currentEnergy ?? 100) <= 82, "back tired");
  assert.ok(events.some((e) => e.subject === "Landslagsspelarna är tillbaka"));
  const reloaded = migrateCareerState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(nationalTeamOf(reloaded), nationalTeamOf(s));
  // Running the same days again changes nothing.
  const again = progressNationalTeam({ ...s, gameDate: w.end }, w.end, () => undefined);
  assert.deepEqual(nationalTeamOf(again), nationalTeamOf(s));
  assert.ok(managerSquadIds(s).length > 0);
});

test("Klubbhuset: the building follows the economic band, every room leads to a real screen, identity is the club's own", () => {
  assert.equal(hqTier("E1"), "elite");
  assert.equal(hqTier("E4"), "pro");
  assert.equal(hqTier("E6"), "local");
  assert.equal(hqTier(undefined), "local");
  const s = career();
  const hq = clubHq(s);
  assert.equal(hq.town, "Skövde");
  assert.ok(hq.rooms.length >= 8);
  const app = join(__dirname, "..", "..", "app");
  for (const r of hq.rooms) assert.ok(existsSync(join(app, ...r.href.split("/").filter(Boolean), "page.tsx")), r.href);
  assert.ok(existsSync(join(app, "career", "klubbhuset", "page.tsx")));
  assert.ok(hq.national.upcoming.length > 0);
});

test("pacing: in a play-off series the media and the press gather for the opener and the games that can decide it", async () => {
  const { seriesTalkGame } = await import("./worldTick");
  const s0 = career();
  const tie = { id: "t1", seasonId: s0.seasonId, competitionId: "SM", stage: "SF", label: "Semifinal", highClubId: SKOVDE, lowClubId: "se_club_skanela_if", format: { kind: "SERIES", series: { bestOf: 5, homePattern: ["HIGH", "LOW", "HIGH", "LOW", "HIGH"], days: 3 } }, fixtureIds: ["g1", "g2", "g3", "g4", "g5"] } as never;
  const game = (n: number) => ({ id: `g${n}`, competitionId: "SM", round: n, date: addDaysIso("2027-04-01", n * 3), homeClubId: SKOVDE, awayClubId: "se_club_skanela_if", type: "PLAYOFF", stage: { tieId: "t1", game: n } }) as unknown as CareerFixture;
  const win = (home: number) => ({ homeClubId: SKOVDE, awayClubId: "se_club_skanela_if", homeGoals: home, awayGoals: 25 }) as never;
  const s = { ...s0, competitionTies: { t1: tie } };
  assert.equal(seriesTalkGame(s, game(1)), true, "the opener");
  assert.equal(seriesTalkGame({ ...s, results: { ...s.results, g1: win(30) } }, game(2)), false, "1–0: game two is routine");
  assert.equal(seriesTalkGame({ ...s, results: { ...s.results, g1: win(30), g2: win(30) } }, game(3)), true, "2–0: game three can decide it");
  assert.equal(seriesTalkGame(s, { ...game(1), stage: undefined } as CareerFixture), true, "ordinary matches are unaffected");
});
