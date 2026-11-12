// HM-M7D (original roadmap 7D): manager reputation, history and opportunities across the
// playable Swedish pyramid -- eligibility, resignation, unemployment with a running
// calendar, offers and their guards, handover, save/load and plausible recruitment.
import { test } from "node:test";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import { SWEDISH_WORLD_COMPETITION_IDS } from "../career/worldCompetitions";
import { ensureSeasonCalendar } from "../competition/seasonCalendar";
import { ensureClubFinances } from "../economy/ledger";
import { competitionClubIds } from "../competition/tables";
import { ALLSVENSKAN, DIVISION_1, HANDBOLLSLIGAN } from "../competition/rules";
import { continueCareerRhythm } from "../career/continueController";
import { processDay } from "../career/dailyTick";
import { playManagerFixtureLegacy } from "../career/legacy/matchday";
import { migrateCareerState } from "../career/saveMigration";
import { resolveContextualContinueAction } from "../career/contextualContinueAction";
import { ensureBoard, submitBoardRecoveryPlan } from "../board/board";
import { answerConcern } from "../players/talks";
import { answerPress, delegatePress, openPressConferences } from "../media/press";
import { withEvents } from "./events";
import type { CareerState } from "../career/types";
import type { CareerEvent } from "../career/careerEvents";
import { acceptJobOffer, clubChangeBlocker } from "./changeClub";
import {
  adjustReputation, answerInterview, applyForJob, assessCandidate, clubConsiders, clubStature, clubWish, declineOffer, dismissManager,
  eligibleClubs, ensureManagerCareer, interviewVerdict, leagueLevel, managerCareerSummary, managerExperience, openOffers, openVacancies,
  progressManagerCareer, resignationPreview, resignFromClub, seasonReputationParts,
} from "./managerCareer";

const TUMBA = "swe2-tumba";
let world: { squads: Parameters<typeof createNewCareerState>[2]; ratings: Parameters<typeof createNewCareerState>[4]; staff: Parameters<typeof createNewCareerState>[5] } | undefined;
function pyramid(seed = "m7d", clubId = TUMBA): CareerState {
  world ??= {
    squads: Object.assign({}, ...SWEDISH_WORLD_COMPETITION_IDS.map((c) => snapshotWorldSquads(c))),
    ratings: Object.assign({}, ...SWEDISH_WORLD_COMPETITION_IDS.map((c) => snapshotGameplayRatings(c))),
    staff: Object.assign({}, ...SWEDISH_WORLD_COMPETITION_IDS.map((c) => snapshotAllClubsStaff(c))),
  };
  const s = createNewCareerState(seed, clubId, world.squads, undefined, world.ratings, world.staff);
  return ensureManagerCareer(ensureBoard(ensureSeasonCalendar(ensureClubFinances(s, s.gameDate)), s.gameDate));
}
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v) ?? "null").digest("hex");
const collect = () => { const events: CareerEvent[] = []; return { events, emit: (e: CareerEvent) => events.push(e) }; };
const d1Members = (s: CareerState) => DIVISION_1.flatMap((d) => competitionClubIds(s, d));
const d1Club = (s: CareerState) => eligibleClubs(s).find((id) => d1Members(s).includes(id))!;
function withVacancy(s: CareerState, clubId: string): CareerState {
  return { ...s, managerCareer: { ...s.managerCareer!, vacancies: [...s.managerCareer!.vacancies, { clubId, openedOn: s.gameDate, closesOn: "2027-06-30", reason: "test" }] } };
}
const advancedCache = new Map<string, string>();
/** One ordinary career advanced into the season (a few league games played), shared by the slower tests. */
function inSeason(): CareerState {
  if (!advancedCache.has("base")) advancedCache.set("base", JSON.stringify(continueUntil(pyramid("m7d-season"), "2026-09-26")));
  return JSON.parse(advancedCache.get("base")!) as CareerState;
}
/** Advance by ordinary Continue presses until `date`, answering only what the test allows. */
function continueUntil(s: CareerState, date: string): CareerState {
  for (let guard = 0; guard < 200 && s.gameDate < date; guard++) {
    // Employed: ordinary decisions are answered the way a manager would.
    if (!s.managerCareer?.seekingJob) {
      const concern = Object.values(s.playerDynamics?.concerns ?? {}).find((c) => c.status === "OPEN");
      if (concern) { s = answerConcern(s, concern.id, (concern.options.find((o) => ["EARN_IT", "PATIENCE", "LATER"].includes(o.id)) ?? concern.options[0]!).id); continue; }
      const meeting = s.board?.meetings.find((m) => ["WARNING", "FINAL_WARNING"].includes(m.kind) && s.careerEvents.some((e) => e.id === `BOARD_UPDATE:${m.id}` && e.requiresAction && !e.resolved));
      if (meeting) { s = submitBoardRecoveryPlan(s, meeting.id); continue; }
      for (const press of openPressConferences(s)) { const ev: CareerEvent[] = []; try { s = withEvents(delegatePress(s, press.id, (e) => ev.push(e)), ev); } catch { s = withEvents(answerPress(s, press.id, Object.fromEntries(press.questions.map((q) => [q.id, "DIPLOMATIC" as const])), (e) => ev.push(e)), ev); } }
    }
    const pending = s.careerEvents.filter((e) => e.requiresAction && !e.resolved);
    if (pending.length && pending.every((e) => e.type === "MATCHDAY_READY") && !s.managerCareer?.seekingJob) {
      // Employed: his own matchday is played (quick legacy match keeps these unit tests fast; the scenario script uses native V2).
      const played = playManagerFixtureLegacy(s);
      assert.ok(played.result, "the manager plays his own fixture");
      s = played.state;
      continue;
    }
    const r = continueCareerRhythm(s);
    assert.notEqual(r.stopReason, "ACTION_REQUIRED_PENDING", JSON.stringify(s.careerEvents.filter((e) => e.requiresAction && !e.resolved).map((e) => e.id)));
    assert.notEqual(r.stopReason, "CALENDAR_CONFLICT");
    s = r.state;
  }
  return s;
}

test("eligibility covers all four simulated Swedish leagues with current memberships and playable squads", () => {
  const s = pyramid();
  const eligible = new Set(eligibleClubs(s));
  for (const comp of [HANDBOLLSLIGAN, ALLSVENSKAN, ...DIVISION_1]) {
    const members = competitionClubIds(s, comp);
    assert.ok(members.some((id) => eligible.has(id)), `${comp} clubs can employ the manager`);
  }
  const leagues = [HANDBOLLSLIGAN, ALLSVENSKAN, ...DIVISION_1].flatMap((c) => competitionClubIds(s, c));
  assert.ok([...eligible].every((id) => leagues.includes(id)), "only clubs in the four simulated leagues");
  // A club moved to a Division 2 pool by membership is no longer an employer; a club with too few players is excluded.
  const d1 = competitionClubIds(s, DIVISION_1[0])[0]!;
  const moved: CareerState = { ...s, competitionMembership: { ...s.competitionMembership, [d1]: "se_division2_norra" } };
  assert.ok(!eligibleClubs(moved).includes(d1), "Division 2 remains a non-manageable pool");
  const thin = competitionClubIds(s, DIVISION_1[1]).find((id) => eligible.has(id))!;
  const short: CareerState = { ...s, worldSquads: { ...s.worldSquads, [thin]: (s.worldSquads[thin] ?? []).slice(0, 11) } };
  assert.ok(!eligibleClubs(short).includes(thin), "a squad below twelve players is not a playable job");
  // Stature follows the division.
  const hbl = competitionClubIds(s, HANDBOLLSLIGAN)[0]!, alls = competitionClubIds(s, ALLSVENSKAN)[0]!;
  assert.ok(clubStature(s, hbl) > clubStature(s, alls) && clubStature(s, alls) > clubStature(s, d1));
});

test("clubs judge reputation and relevant experience plausibly, and explain it", () => {
  let s = pyramid();
  const hbl = competitionClubIds(s, HANDBOLLSLIGAN).sort((a, b) => clubStature(s, b) - clubStature(s, a))[0]!;
  const d1 = d1Club(s);
  assert.ok(clubConsiders(s, d1), "a Division 1 club considers an Allsvenskan coach");
  assert.ok(!clubConsiders(s, hbl), "the biggest Handbollsligan job does not approach a little-known Allsvenskan coach");
  // Experience: a season coached at the level helps; a recent dismissal hurts.
  const base = assessCandidate(s, hbl);
  const experienced: CareerState = { ...s, managerCareer: { ...s.managerCareer!, stints: [{ clubId: hbl, from: "2024-07-01", to: "2026-05-31", leftReason: "NEW_JOB", competitionId: HANDBOLLSLIGAN, seasons: [{ seasonId: "2025/26", competitionId: HANDBOLLSLIGAN, position: 3, objectivesScore: 0.8, honours: ["Cupvinnare"] }] }, ...s.managerCareer!.stints] } };
  assert.ok(assessCandidate(experienced, hbl).experiencePoints > base.experiencePoints);
  const sacked: CareerState = { ...s, managerCareer: { ...s.managerCareer!, stints: [{ clubId: d1, from: "2025-07-01", to: "2026-03-01", leftReason: "DISMISSED", competitionId: DIVISION_1[0], seasons: [] }, ...s.managerCareer!.stints] } };
  assert.ok(assessCandidate(sacked, d1).parts.some((p) => p.points < 0 && p.label.includes("sparkad")));
  // The interview note names the experience that counted.
  s = withVacancy(s, d1);
  s = applyForJob(s, d1);
  const app = Object.values(s.managerCareer!.applications)[0]!;
  const w = clubWish(s, d1);
  const v = interviewVerdict(s, { ...app, answers: { goal: w.goal, youth: w.youth, money: w.money } });
  assert.equal(v.hired, true);
  assert.match(v.note, /rykte/);
});

test("voluntary resignation shows its consequences, closes the stint once and keeps the calendar running", () => {
  let s = inSeason();
  const own = s.playerClubId;
  const preview = resignationPreview(s);
  assert.equal(preview.allowed, true, preview.blocker ?? "");
  assert.ok(preview.consequences.length >= 4 && preview.consequences.some((c) => c.includes("interimstränare")));
  const before = { fixtures: s.fixtures.length, players: Object.values(s.worldSquads).flat().length, contracts: Object.keys(s.playerContracts).length };
  s = resignFromClub(s);
  const c = s.managerCareer!;
  assert.equal(c.seekingJob?.reason, "RESIGNED");
  assert.equal(c.stints.at(-1)!.leftReason, "RESIGNED");
  assert.equal(c.stints.filter((x) => x.leftReason === "RESIGNED").length, 1);
  assert.equal(c.contract.endDate, s.gameDate);
  assert.ok(c.milestones.some((m) => m.kind === "RESIGNED" && m.clubId === own));
  assert.ok(c.vacancies.some((v) => v.clubId === own), "the club looks for a coach");
  assert.ok(!openVacancies(s).some((v) => v.clubId === own), "he cannot walk straight back in");
  assert.throws(() => resignFromClub(s), /ingen klubb/);
  assert.equal(s.careerEvents.filter((e) => e.requiresAction && !e.resolved).length, 0);
  assert.equal(s.fixtures.length, before.fixtures);
  assert.equal(Object.values(s.worldSquads).flat().length, before.players);
  assert.equal(Object.keys(s.playerContracts).length, before.contracts);
  // The calendar keeps running; the old club's fixtures are simulated by the world.
  assert.equal(resolveContextualContinueAction(s).kind, "ADVANCE_DAY");
  const ownUnplayed = s.fixtures.filter((f) => (f.homeClubId === own || f.awayClubId === own) && !s.results[f.id] && f.date <= "2026-11-30");
  assert.ok(ownUnplayed.length > 0);
  const later = continueUntil(s, "2026-12-01");
  assert.ok(later.gameDate >= "2026-12-01");
  for (const f of ownUnplayed) assert.ok(later.results[f.id], `${f.id} was played under the interim`);
  assert.equal(later.careerEvents.filter((e) => e.requiresAction && !e.resolved).length, 0, "nothing at the old club asks him to act");
  assert.equal(later.managerCareer!.stints.length, c.stints.length, "no new stint while unemployed");
});

test("resignation and employer changes wait for an active or due match", () => {
  const s = pyramid("m7d-guards");
  const own = s.fixtures.filter((f) => f.homeClubId === s.playerClubId || f.awayClubId === s.playerClubId).sort((a, b) => a.date.localeCompare(b.date))[0]!;
  const due: CareerState = { ...s, gameDate: own.date, processedThroughDate: own.date };
  assert.match(resignationPreview(due).blocker ?? "", /dagens match/);
  assert.throws(() => resignFromClub(due), /dagens match/);
  const live = { ...s, productionMatch: { fixture: own } } as unknown as CareerState;
  assert.match(resignationPreview(live).blocker ?? "", /matchen/);
  const target = d1Club(s);
  assert.match(clubChangeBlocker(live, target) ?? "", /matchen/);
  assert.match(clubChangeBlocker(due, target) ?? "", /dagens match/);
});

test("offers: stale, expired, declined and repeated acceptance are refused; acceptance hands over cleanly", () => {
  const { emit } = collect();
  let s = inSeason();
  s = dismissManager(s, s.gameDate, "Test.", emit);
  assert.equal(s.managerCareer!.seekingJob?.reason, "DISMISSED");
  const offers = openOffers(s);
  assert.ok(offers.length >= 2);
  const [first, second] = offers as [typeof offers[0], typeof offers[0]];
  // Expired.
  const late: CareerState = { ...s, gameDate: "2027-01-01" };
  assert.throws(() => acceptJobOffer(late, first.id), /gäller inte/);
  // Declined.
  const declined = declineOffer(s, second.id);
  assert.throws(() => acceptJobOffer(declined, second.id), /gäller inte/);
  // Accepted once; a second press on the same or another stale offer is refused.
  const next = acceptJobOffer(s, first.id);
  assert.throws(() => acceptJobOffer(next, first.id), /gäller inte/);
  assert.throws(() => acceptJobOffer(next, second.id), /gäller inte/);
  const stints = next.managerCareer!.stints;
  assert.equal(stints.filter((x) => !x.to).length, 1, "exactly one open stint");
  assert.equal(stints.at(-1)!.clubId, first.clubId);
  assert.equal(stints.at(-1)!.competitionId, next.competitionId);
  assert.equal(next.playerClubId, first.clubId);
  assert.equal(next.managerCareer!.seekingJob, undefined);
  // Handover: new board, no old-club delegation/plans/requests.
  assert.equal(next.board!.clubId, first.clubId);
  assert.equal(next.delegation, undefined);
  assert.equal(Object.keys(next.matchPlans).filter((id) => !next.results[id]).length, 0);
  assert.ok(Object.values(next.trainingWeeks).every((w) => w.weekStart < next.gameDate));
  assert.equal(next.careerEvents.filter((e) => e.requiresAction && !e.resolved).length, 0);
  // Contracts are not duplicated and every new-club player has one.
  assert.equal(Object.keys(next.playerContracts).length, Object.keys(s.playerContracts).length);
  for (const p of next.worldSquads[first.clubId] ?? []) assert.ok(next.playerContracts[p.id]);
});

test("an unemployed manager is approached by clubs that consider him, and the season moves on", () => {
  let s = inSeason();
  s = resignFromClub(s);
  // Vacancies the manager is a fit for, across divisions.
  for (const id of eligibleClubs(s).filter((id) => clubConsiders(s, id) && id !== s.playerClubId).slice(0, 4)) s = withVacancy(s, id);
  const { events, emit } = collect();
  let day = s;
  for (let i = 1; i <= 21; i++) { const date = new Date(Date.parse(`${s.gameDate}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10); day = progressManagerCareer(day, date, emit); day = { ...day, gameDate: date }; }
  const approaches = events.filter((e) => e.type === "MANAGER_CAREER" && e.priority === "IMPORTANT" && e.id.includes(":APPROACH"));
  assert.ok(approaches.length >= 1, "a club with a vacancy calls within three weeks");
  for (const o of openOffers(day)) assert.ok(clubConsiders(day, o.clubId), `${o.clubId} only calls if he fits`);
});

test("save and reload while unemployed preserves the career and the calendar continues", () => {
  let s = inSeason();
  s = resignFromClub(s);
  s = continueUntil(s, "2026-11-05");
  const loaded = migrateCareerState(JSON.parse(JSON.stringify(s)));
  assert.equal(hash(loaded.managerCareer), hash(s.managerCareer));
  assert.equal(loaded.playerClubId, s.playerClubId);
  const a = continueUntil(s, "2026-11-25"), b = continueUntil(loaded, "2026-11-25");
  assert.equal(a.gameDate, b.gameDate);
  assert.equal(hash(a.results), hash(b.results), "a reloaded unemployed career advances identically");
  assert.equal(hash(a.managerCareer), hash(b.managerCareer));
});

test("reputation only moves with an explained, logged reason, and a season is judged against expectations and division", () => {
  const s = pyramid("m7d-rep");
  let c = s.managerCareer!;
  c = adjustReputation(c, "2027-05-01", 0, "inget");
  assert.equal((c.reputationLog ?? []).length, 0, "no change, no entry");
  c = adjustReputation(c, "2027-05-01", 500, "orimligt");
  assert.equal(c.reputation, 95);
  assert.equal(c.reputationLog!.at(-1)!.delta, 95 - s.managerCareer!.reputation);
  const overAchieved = seasonReputationParts(s, 1, 0.9);
  const underAchieved = seasonReputationParts(s, 14, 0.2);
  assert.ok(overAchieved.reduce((n, p) => n + p.points, 0) > 0 && underAchieved.reduce((n, p) => n + p.points, 0) < 0);
  for (const p of [...overAchieved, ...underAchieved]) assert.ok(p.reason.length > 10, "every part says why");
  // The same achievement counts for more in a higher division.
  const hblState: CareerState = { ...s, competitionId: HANDBOLLSLIGAN };
  const d1State: CareerState = { ...s, competitionId: DIVISION_1[0] };
  const sum = (x: CareerState) => seasonReputationParts(x, null, 0.9).reduce((n, p) => n + p.points, 0);
  assert.ok(sum(hblState) > sum(d1State));
});

test("older saves without M7D history fields still summarise, and the summary counts stints and records", () => {
  const s = pyramid("m7d-old");
  const old: CareerState = { ...s, managerCareer: { ...s.managerCareer!, reputationLog: undefined, stints: [{ clubId: "x", from: "2024-07-01", to: "2025-05-31", leftReason: "DISMISSED", seasons: [{ seasonId: "2024/25", competitionId: ALLSVENSKAN, position: 12, objectivesScore: 0.2, honours: [] }] }, { clubId: s.playerClubId, from: "2025-08-01", seasons: [{ seasonId: "2025/26", competitionId: ALLSVENSKAN, position: 2, objectivesScore: 0.9, honours: ["Uppflyttning"], record: { played: 26, won: 18, drawn: 2, lost: 6, goalsFor: 800, goalsAgainst: 700 } }] }] } };
  const sum = managerCareerSummary(old);
  assert.equal(sum.clubs, 2);
  assert.equal(sum.seasons, 2);
  assert.equal(sum.dismissals, 1);
  assert.equal(sum.promotions, 1);
  assert.equal(sum.record.played, 26);
  assert.equal(sum.highestLevel, 2);
  assert.equal(sum.daysUnemployed, 62);
  assert.equal(managerExperience(old).promotions, 1);
});

test("a dismissal mid-tick lets the day's own fixture be simulated and does not stall Continue", () => {
  let s = inSeason();
  const { emit } = collect();
  s = dismissManager(s, s.gameDate, "Test.", emit);
  const own = s.playerClubId;
  const nextOwn = s.fixtures.filter((f) => (f.homeClubId === own || f.awayClubId === own) && !s.results[f.id]).sort((a, b) => a.date.localeCompare(b.date))[0]!;
  let day = s;
  while (day.processedThroughDate < nextOwn.date) day = processDay(day, new Date(Date.parse(`${day.processedThroughDate}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)).state;
  assert.ok(day.results[nextOwn.id], "the interim's match is played by the world");
  assert.equal(day.careerEvents.filter((e) => e.id === `MATCHDAY_READY:${nextOwn.id}`).length, 0, "no matchday asks the unemployed manager to play");
});

test("applying, interviewing and accepting takes a Division 1 job through the normal flow", () => {
  let s = inSeason();
  s = resignFromClub(s);
  const d1 = d1Club(s);
  s = withVacancy(s, d1);
  s = applyForJob(s, d1);
  const app = Object.values(s.managerCareer!.applications).find((a) => a.clubId === d1)!;
  const w = clubWish(s, d1);
  s = answerInterview(s, app.id, { goal: w.goal, youth: w.youth, money: w.money });
  const decisionOn = s.managerCareer!.applications[app.id]!.decisionOn!;
  const { emit } = collect();
  s = progressManagerCareer(s, decisionOn, emit);
  s = { ...s, gameDate: decisionOn };
  const offer = openOffers(s).find((o) => o.clubId === d1 && o.source === "APPLICATION");
  assert.ok(offer, "the interview leads to an offer");
  const next = acceptJobOffer(s, offer.id);
  assert.equal(next.playerClubId, d1);
  assert.equal(leagueLevel(next.competitionId), 3);
  assert.equal(next.board?.clubId, d1);
  assert.ok(next.board!.objectives.length > 0, "the new board sets objectives for a Division 1 club");
  // The calendar continues at the new club.
  const after = continueCareerRhythm(next);
  assert.notEqual(after.stopReason, "CALENDAR_CONFLICT");
});
