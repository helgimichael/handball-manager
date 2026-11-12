// HM-ALPHA3-M07: board objectives and confidence, dismissal, the job market and a club change that keeps the world intact.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import type { CareerState } from "../career/types";
import type { CareerEvent } from "../career/careerEvents";
import { ensureClubFinances } from "../economy/ledger";
import { competitionClubIds } from "../competition/tables";
import { HANDBOLLSLIGAN } from "../competition/rules";
import { buildObjectives, confidenceFactors, ensureBoard, predictedPositionOf, progressBoard, DISMISSAL_LINE } from "./board";
import { acceptJobOffer, clubChangeBlocker } from "../manager/changeClub";
import { acceptBoardContract, answerInterview, applyForJob, clubStature, clubWish, dismissManager, ensureManagerCareer, interviewVerdict, openOffers, progressManagerCareer } from "../manager/managerCareer";
import { boardSeasonEnd } from "./board";

const SKOVDE = "se_club_ifk_skovde_hk";
function career(): CareerState {
  const squads = snapshotWorldSquads(HANDBOLLSLIGAN);
  return ensureClubFinances(createNewCareerState("m07-tests", SKOVDE, squads, undefined, snapshotGameplayRatings(HANDBOLLSLIGAN), snapshotAllClubsStaff(HANDBOLLSLIGAN)), "2026-07-01");
}
const collect = () => { const events: CareerEvent[] = []; return { events, emit: (e: CareerEvent) => events.push(e) }; };

test("objectives follow the squad's real level and every one says why", () => {
  const s = career();
  const ranked = competitionClubIds(s, HANDBOLLSLIGAN).map((id) => ({ id, p: predictedPositionOf(s, id, HANDBOLLSLIGAN) })).sort((a, b) => a.p - b.p);
  const strongest = buildObjectives(s, ranked[0]!.id).objectives.find((o) => o.kind === "LEAGUE")!;
  const weakest = buildObjectives(s, ranked.at(-1)!.id).objectives.find((o) => o.kind === "LEAGUE")!;
  assert.ok(strongest.target < weakest.target, "a stronger squad is asked for a better place");
  for (const o of buildObjectives(s, SKOVDE).objectives) assert.ok(o.why.length > 10, `${o.id} explains itself`);
});

test("monthly confidence moves at most eight points toward an explained target", () => {
  let s = ensureBoard(career(), "2026-09-15");
  s = { ...s, board: { ...s.board!, confidence: 90 }, clubFinances: { ...s.clubFinances, [SKOVDE]: { ...s.clubFinances![SKOVDE]!, status: "CRISIS" } } };
  const { emit } = collect();
  const next = progressBoard(s, "2026-10-01", emit, (x) => x);
  assert.equal(next.board!.confidence, 82);
  assert.ok(next.board!.factors.some((f) => f.label.includes("ekonomisk kris") && f.points < 0));
});

test("after two warnings a confidence below the line means dismissal, explained, with offers and a calendar that keeps running", () => {
  let s = ensureManagerCareer(ensureBoard(career(), "2026-09-15"));
  s = { ...s, board: { ...s.board!, confidence: 4, warnings: 2, pressureStage: "CRITICAL" }, clubFinances: { ...s.clubFinances, [SKOVDE]: { ...s.clubFinances![SKOVDE]!, status: "CRISIS" } } };
  const { events, emit } = collect();
  const next = progressBoard(s, "2026-10-01", emit, (x, reason) => dismissManager(x, "2026-10-01", reason, emit));
  assert.ok(next.board!.confidence < DISMISSAL_LINE);
  assert.equal(next.managerCareer!.seekingJob?.reason, "DISMISSED");
  // HM-M7D: the dismissal is important news, but the calendar no longer freezes while he looks for a job.
  assert.ok(events.some((e) => e.priority === "IMPORTANT" && e.type === "MANAGER_CAREER" && e.id.startsWith("MANAGER_CAREER:dismissed:")), "the dismissal stops Continue once as important news");
  assert.ok(!events.some((e) => e.requiresAction), "nothing blocks Continue while unemployed");
  assert.ok(next.board!.meetings.some((m) => m.kind === "DISMISSAL" && m.summary.includes("varningar")));
  assert.ok(openOffers({ ...next, gameDate: "2026-10-01" }).length >= 2, "a sacked manager is never stranded");
  assert.equal(next.managerCareer!.stints.at(-1)!.leftReason, "DISMISSED");
});

test("interview verdicts weigh reputation and answers and always explain", () => {
  let s = ensureManagerCareer(career());
  const target = competitionClubIds(s, HANDBOLLSLIGAN).find((id) => id !== SKOVDE)!;
  s = { ...s, managerCareer: { ...s.managerCareer!, vacancies: [{ clubId: target, openedOn: s.gameDate, closesOn: "2026-12-31", reason: "test" }] } };
  s = applyForJob(s, target);
  const app = Object.values(s.managerCareer!.applications)[0]!;
  const wish = clubWish(s, target);
  const good = interviewVerdict(s, { ...app, answers: { goal: wish.goal, youth: wish.youth, money: wish.money } });
  const bad = interviewVerdict(s, { ...app, answers: { goal: wish.goal === "PATIENT" ? "AMBITIOUS" : "PATIENT", youth: wish.youth === "YOUTH" ? "MERIT" : "YOUTH", money: wish.money === "INVEST" ? "PRUDENT" : "INVEST" } });
  assert.ok(good.fit > bad.fit);
  assert.match(good.note, /rykte/);
  assert.throws(() => answerInterview(s, app.id, { goal: "AMBITIOUS" }), /alla frågor/);
});

test("changing club keeps the world and hands the manager the new club", () => {
  let s = ensureManagerCareer(ensureBoard(career(), "2026-09-15"));
  const { emit } = collect();
  s = dismissManager(s, "2026-09-15", "Test.", emit);
  s = { ...s, careerEvents: [...s.careerEvents, { id: "x", type: "MANAGER_CAREER", date: s.gameDate, priority: "ACTION_REQUIRED", subject: "", summary: "", relatedEntities: [], destinations: [], requiresAction: true, resolved: false, read: false, createdAtGameDate: s.gameDate } as CareerEvent] };
  const offer = openOffers({ ...s, gameDate: "2026-09-15" })[0]!;
  s = { ...s, gameDate: "2026-09-15" };
  const before = { players: Object.values(s.worldSquads).flat().length, contracts: Object.keys(s.playerContracts).length, fixtures: s.fixtures.length, staff: Object.values(s.staffRoster).flat().length, oldSquad: s.worldSquads[SKOVDE]!.map((p) => p.id) };
  assert.equal(clubChangeBlocker(s, offer.clubId), null);
  const next = acceptJobOffer(s, offer.id);
  assert.equal(next.playerClubId, offer.clubId);
  assert.equal(Object.values(next.worldSquads).flat().length, before.players);
  assert.equal(Object.keys(next.playerContracts).length, before.contracts);
  assert.equal(next.fixtures.length, before.fixtures);
  assert.equal(Object.values(next.staffRoster).flat().length, before.staff - (s.staffRoster[offer.clubId] ?? []).filter((m) => m.roles[0] === "HEAD_COACH").length, "only the new club's head coach leaves (to the free-agent pool)");
  assert.deepEqual(next.worldSquads[SKOVDE]!.map((p) => p.id), before.oldSquad);
  assert.equal(next.careerEvents.filter((e) => e.requiresAction && !e.resolved).length, 0);
  assert.equal(next.board!.clubId, offer.clubId);
  assert.equal(next.managerCareer!.seekingJob, undefined);
  assert.equal(next.managerCareer!.stints.at(-1)!.clubId, offer.clubId);
  assert.ok(next.managerCareer!.vacancies.some((v) => v.clubId === SKOVDE), "the old club looks for a coach");
  assert.ok(before.oldSquad.every((id) => (next.playerKnowledge[id] ?? 0) >= 85), "the old squad stays well known");
  for (const p of next.worldSquads[offer.clubId] ?? []) assert.ok(next.playerContracts[p.id], `${p.id} has a contract`);
});

test("an older save without board or career data gets both lazily", () => {
  const s = career();
  const { board: _b, managerCareer: _m, ...old } = s;
  const next = ensureBoard(ensureManagerCareer(old as CareerState), s.gameDate);
  assert.ok(next.board && next.managerCareer);
  assert.equal(next.managerCareer!.stints[0]!.clubId, SKOVDE);
});

test("a bigger club with a vacancy within reach of the manager's reputation may approach him", () => {
  let s = ensureManagerCareer(career());
  const own = clubStature(s, SKOVDE);
  const bigger = competitionClubIds(s, HANDBOLLSLIGAN).filter((id) => clubStature(s, id) > own).sort((a, b) => clubStature(s, a) - clubStature(s, b))[0];
  assert.ok(bigger, "a bigger club exists");
  let approached = false;
  for (const month of ["2026-10-01", "2026-11-01", "2026-12-01", "2027-01-01", "2027-02-01", "2027-03-01", "2027-04-01", "2027-05-01"]) {
    s = { ...s, gameDate: month, managerCareer: { ...s.managerCareer!, reputation: clubStature(s, bigger!) + 2, offers: {}, vacancies: [{ clubId: bigger!, openedOn: month, closesOn: "2027-12-31", reason: "test" }] } };
    const next = progressManagerCareer(s, month, () => undefined);
    if (Object.values(next.managerCareer!.offers).some((o) => o.source === "APPROACH" && o.clubId === bigger)) { approached = true; break; }
  }
  assert.ok(approached, "an approach arrives within a few months");
});

test("a good season with under a year left earns a contract offer, and signing extends the contract", () => {
  let s = ensureManagerCareer(ensureBoard(career(), "2026-09-15"));
  s = { ...s, gameDate: "2027-05-20", managerCareer: { ...s.managerCareer!, contract: { ...s.managerCareer!.contract, endDate: "2027-05-31" } } };
  s = { ...s, board: { ...s.board!, confidence: 70, objectives: s.board!.objectives.filter((o) => o.kind !== "LEAGUE" && o.kind !== "CUP" && o.kind !== "YOUTH") } };
  // The manager has coached matches this season: mark one of his fixtures as played.
  const fx = s.fixtures.find((f) => (f.homeClubId === SKOVDE || f.awayClubId === SKOVDE) && f.date >= "2026-09-15")!;
  s = { ...s, results: { ...s.results, [fx.id]: { homeGoals: 30, awayGoals: 25 } as never } };
  assert.ok(boardSeasonEnd(s, "2027-05-20", () => undefined, (x) => x).board!.meetings.some((m) => m.kind === "SEASON_REVIEW"), "the season is reviewed");
  const reviewed = boardSeasonEnd(s, "2027-05-20", () => undefined, (x) => x);
  assert.ok(reviewed.board!.contractOffer, "the board offers a new contract");
  const signed = acceptBoardContract(reviewed);
  assert.ok(signed.managerCareer!.contract.endDate > "2027-05-31");
  assert.equal(signed.board!.contractOffer, undefined);
  assert.ok(signed.managerCareer!.milestones.some((m) => m.kind === "CONTRACT"));
});

test("a manager appointed mid-season is not judged on the matches or youth minutes before he took charge", () => {
  let s = career();
  // Six heavy defeats under the previous coach, all before the appointment.
  const before = s.fixtures.filter((f) => f.homeClubId === SKOVDE || f.awayClubId === SKOVDE).slice(0, 6);
  const results = { ...s.results };
  for (const f of before) results[f.id] = { homeClubId: f.homeClubId, awayClubId: f.awayClubId, homeGoals: f.homeClubId === SKOVDE ? 20 : 35, awayGoals: f.homeClubId === SKOVDE ? 35 : 20 } as never;
  const appointed = before.at(-1)!.date > "2026-12-01" ? before.at(-1)!.date : "2026-12-01";
  s = { ...s, results, gameDate: appointed, board: undefined };
  const b = ensureBoard(s, appointed).board!;
  assert.equal(b.since, appointed);
  const factors = confidenceFactors({ ...s, board: b }, b);
  assert.ok(!factors.some((f) => f.label.includes("form") || f.label.includes("i serien")), `no factor from the previous coach's matches: ${JSON.stringify(factors)}`);
});
