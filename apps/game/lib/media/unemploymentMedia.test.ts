// Alpha hotfix (M6C/M6D + M7D release): after a spell out of work the media must not replay the new club's past
// results as the manager's own. Resign, six months unemployed with a reload, join another club: no stale press
// conferences or own match reports, a genuinely new match is reported normally, and reload keeps the media state.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import { SWEDISH_WORLD_COMPETITION_IDS } from "../career/worldCompetitions";
import { ensureSeasonCalendar } from "../competition/seasonCalendar";
import { ensureClubFinances } from "../economy/ledger";
import { continueCareerRhythm } from "../career/continueController";
import { playManagerFixtureLegacy } from "../career/legacy/matchday";
import { migrateCareerState } from "../career/saveMigration";
import { ensureBoard, submitBoardRecoveryPlan } from "../board/board";
import { answerConcern } from "../players/talks";
import { answerPress, delegatePress, openPressConferences } from "./press";
import { withEvents } from "../manager/events";
import { acceptJobOffer } from "../manager/changeClub";
import { eligibleClubs, ensureManagerCareer, resignationPreview, resignFromClub } from "../manager/managerCareer";
import { addDaysIso } from "../players/dynamicsState";
import { createSave, getSave, saveCareerState, __setSaveBackendForTests } from "../save/saveRepository";
import { createMemoryBackend } from "../save/saveStorage";
import type { CareerState } from "../career/types";
import type { CareerEvent } from "../career/careerEvents";

const TUMBA = "swe2-tumba";
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v) ?? "null").digest("hex");

function pyramid(seed: string): CareerState {
  const squads = Object.assign({}, ...SWEDISH_WORLD_COMPETITION_IDS.map((c) => snapshotWorldSquads(c)));
  const ratings = Object.assign({}, ...SWEDISH_WORLD_COMPETITION_IDS.map((c) => snapshotGameplayRatings(c)));
  const staff = Object.assign({}, ...SWEDISH_WORLD_COMPETITION_IDS.map((c) => snapshotAllClubsStaff(c)));
  const s = createNewCareerState(seed, TUMBA, squads, undefined, ratings, staff);
  return ensureManagerCareer(ensureBoard(ensureSeasonCalendar(ensureClubFinances(s, s.gameDate)), s.gameDate));
}

/** Ordinary Continue presses until `date`: decisions answered as a manager would, own matches played quickly. */
function continueUntil(s: CareerState, date: string, onDay?: (s: CareerState) => void): CareerState {
  for (let guard = 0; guard < 600 && s.gameDate < date; guard++) {
    if (!s.managerCareer?.seekingJob) {
      const concern = Object.values(s.playerDynamics?.concerns ?? {}).find((c) => c.status === "OPEN");
      if (concern) { s = answerConcern(s, concern.id, (concern.options.find((o) => ["EARN_IT", "PATIENCE", "LATER"].includes(o.id)) ?? concern.options[0]!).id); continue; }
      const meeting = s.board?.meetings.find((m) => ["WARNING", "FINAL_WARNING"].includes(m.kind) && s.careerEvents.some((e) => e.id === `BOARD_UPDATE:${m.id}` && e.requiresAction && !e.resolved));
      if (meeting) { s = submitBoardRecoveryPlan(s, meeting.id); continue; }
      const press = openPressConferences(s)[0];
      if (press) {
        const ev: CareerEvent[] = [];
        try { s = withEvents(delegatePress(s, press.id, (e) => ev.push(e)), ev); }
        catch { s = withEvents(answerPress(s, press.id, Object.fromEntries(press.questions.map((q) => [q.id, "DIPLOMATIC"])), (e) => ev.push(e)), ev); }
        continue;
      }
    }
    const pending = s.careerEvents.filter((e) => e.requiresAction && !e.resolved);
    if (pending.length && pending.every((e) => e.type === "MATCHDAY_READY") && !s.managerCareer?.seekingJob) {
      const played = playManagerFixtureLegacy(s);
      assert.ok(played.result, "the manager plays his own fixture");
      s = played.state;
      continue;
    }
    const r = continueCareerRhythm(s);
    assert.notEqual(r.stopReason, "ACTION_REQUIRED_PENDING", JSON.stringify(pending.map((e) => e.id)));
    assert.notEqual(r.stopReason, "CALENDAR_CONFLICT");
    s = r.state;
    onDay?.(s);
  }
  return s;
}

async function reload(s: CareerState): Promise<CareerState> {
  const save = await createSave({ selectedNations: ["SWE"], selectedCompetitionIds: [...SWEDISH_WORLD_COMPETITION_IDS], clubId: s.playerClubId, manager: { name: "Hotfix QA", nationality: "SWE", dateOfBirth: "1980-01-01" }, gameDate: s.gameDate });
  await saveCareerState(save.saveId, s);
  return migrateCareerState((await getSave(save.saveId))!.careerState!);
}

const dateOf = (s: CareerState) => new Map(s.fixtures.map((f) => [f.id, f.date]));
const involves = (clubId: string) => (f: { homeClubId: string; awayClubId: string }) => f.homeClubId === clubId || f.awayClubId === clubId;

/** An approach from `clubId`, made the way an approaching club makes one. */
function withApproach(s: CareerState, clubId: string): { state: CareerState; offerId: string } {
  const offerId = `hotfix:${clubId}:${s.gameDate}`;
  const offer = { id: offerId, clubId, offeredOn: s.gameDate, expiresOn: addDaysIso(s.gameDate, 10), wageEurPerMonth: 1500, years: 2, source: "APPROACH" as const, pitch: "Test approach.", status: "OPEN" as const };
  return { state: { ...s, managerCareer: { ...s.managerCareer!, offers: { ...s.managerCareer!.offers, [offerId]: offer } } }, offerId };
}

let unemployed: { state: CareerState; resignedOn: string; storiesAtResignation: number; pressAtResignation: string[] } | undefined;
async function sixMonthsUnemployed() {
  if (unemployed) return { ...unemployed, state: structuredClone(unemployed.state) };
  __setSaveBackendForTests(createMemoryBackend());
  let s = continueUntil(pyramid("hotfix-unemployment-media"), "2026-08-21");
  assert.ok(resignationPreview(s).allowed, resignationPreview(s).blocker ?? "");
  s = resignFromClub(s);
  const resignedOn = s.gameDate;
  const storiesAtResignation = Object.keys(s.media?.stories ?? {}).length;
  const pressAtResignation = Object.keys(s.media?.press ?? {});
  // While unemployed: no story and no press conference is produced, but the media clock keeps time with the calendar.
  const watch = (x: CareerState) => {
    assert.equal(Object.keys(x.media?.stories ?? {}).length, storiesAtResignation, `no stories while unemployed (${x.gameDate})`);
    assert.deepEqual(Object.keys(x.media?.press ?? {}), pressAtResignation, `no press conferences while unemployed (${x.gameDate})`);
    assert.equal(x.media?.lastResultsDate, addDaysIso(x.processedThroughDate!, -1), `the media clock follows the calendar (${x.processedThroughDate})`);
  };
  s = continueUntil(s, addDaysIso(resignedOn, 91), watch);
  // Reload while unemployed, midway.
  const reloaded = await reload(s);
  assert.equal(hash(reloaded.media), hash(s.media), "reload while unemployed keeps the media state");
  assert.equal(hash(reloaded.managerCareer), hash(s.managerCareer), "reload while unemployed keeps the manager career");
  s = continueUntil(reloaded, addDaysIso(resignedOn, 182), watch);
  assert.ok(s.managerCareer?.seekingJob, "still out of work after six months");
  unemployed = { state: s, resignedOn, storiesAtResignation, pressAtResignation };
  return { ...unemployed, state: structuredClone(s) };
}

/** A club (not the old one) with results during the unemployed spell and its next own fixture within two weeks. */
function nextEmployer(s: CareerState, resignedOn: string): { clubId: string; nextFixtureDate: string } {
  for (const clubId of eligibleClubs(s)) {
    if (clubId === TUMBA) continue;
    const own = s.fixtures.filter(involves(clubId));
    const playedWhileAway = own.filter((f) => s.results[f.id] && f.date > resignedOn && f.date <= s.gameDate).length;
    const next = own.filter((f) => !s.results[f.id] && f.date > s.gameDate && f.date <= addDaysIso(s.gameDate, 14)).sort((a, b) => a.date.localeCompare(b.date))[0];
    if (playedWhileAway >= 3 && next) return { clubId, nextFixtureDate: next.date };
  }
  throw new Error(`no club with a backlog and a fixture soon after ${s.gameDate}`);
}

function assertNoBacklog(s: CareerState, appointedOn: string, clubId: string) {
  const when = dateOf(s);
  const stalePress = Object.values(s.media!.press).filter((p) => p.fixtureId && when.get(p.fixtureId)! <= appointedOn && p.date >= appointedOn);
  assert.deepEqual(stalePress.map((p) => `${p.id} (${when.get(p.fixtureId!)})`), [], "no press conference about a match before the appointment");
  const staleStories = Object.values(s.media!.stories).filter((st) => st.date >= appointedOn && st.fixtureId && when.get(st.fixtureId)! <= appointedOn);
  assert.deepEqual(staleStories.filter((st) => st.ownClub).map((st) => `${st.kind} ${st.fixtureId}`), [], "no own-club story about a match before the appointment");
  const ownReportsBefore = staleStories.filter((st) => st.kind === "MATCH_REPORT" && st.clubIds.includes(clubId));
  assert.deepEqual(ownReportsBefore.map((st) => st.fixtureId), [], "no false manager match report for the new club's earlier games");
  assert.ok(!openPressConferences(s).some((p) => p.fixtureId && when.get(p.fixtureId)! <= appointedOn), "Continue is not blocked by a stale press conference");
}

test("Alpha hotfix: after six months unemployed and a new job, the new club's past results are not the manager's media", async () => {
  const { state: start, resignedOn } = await sixMonthsUnemployed();
  const { clubId, nextFixtureDate } = nextEmployer(start, resignedOn);
  const { state: offered, offerId } = withApproach(start, clubId);
  let s = acceptJobOffer(offered, offerId);
  const appointedOn = s.gameDate;
  assert.equal(s.playerClubId, clubId);
  assert.ok(s.media!.lastResultsDate! >= addDaysIso(appointedOn, -1), "the media clock is caught up at the appointment");

  // Through the first genuine match at the new club and the day after, when the media reports it.
  s = continueUntil(s, addDaysIso(nextFixtureDate, 2));
  assertNoBacklog(s, appointedOn, clubId);
  const genuine = s.fixtures.find((f) => involves(clubId)(f) && f.date === nextFixtureDate && s.results[f.id])!;
  assert.ok(genuine, "the first match at the new club was played");
  const report = Object.values(s.media!.stories).find((st) => st.eventKey === `result:${genuine.id}`);
  assert.ok(report && report.ownClub && report.kind === "MATCH_REPORT", "a genuinely new match is reported as the manager's own");

  // Reload keeps exactly this media state, and continuing does not duplicate the report.
  const reloaded = await reload(s);
  assert.equal(hash(reloaded.media), hash(s.media), "reload preserves the media state");
  const after = continueUntil(reloaded, addDaysIso(reloaded.gameDate, 3));
  assert.equal(Object.values(after.media!.stories).filter((st) => st.eventKey === `result:${genuine.id}`).length, Object.values(s.media!.stories).filter((st) => st.eventKey === `result:${genuine.id}`).length, "no duplicate report after reload");
  assertNoBacklog(after, appointedOn, clubId);
  // Manager history is untouched by the media handling.
  assert.deepEqual(after.managerCareer!.stints.map((x) => [x.clubId, x.from, x.to ?? null, x.leftReason ?? null]), [[TUMBA, start.managerCareer!.stints[0]!.from, resignedOn, "RESIGNED"], [clubId, appointedOn, null, null]]);
});

test("Alpha hotfix: a save made unemployed by the deployed release (frozen media clock) gets no backlog on its next job", async () => {
  const { state: start, resignedOn } = await sixMonthsUnemployed();
  // The deployed release left lastResultsDate at the resignation; reproduce that saved shape exactly.
  const frozen: CareerState = { ...start, media: { ...start.media!, lastResultsDate: addDaysIso(resignedOn, -1) } };
  const { clubId, nextFixtureDate } = nextEmployer(frozen, resignedOn);
  const { state: offered, offerId } = withApproach(frozen, clubId);
  let s = acceptJobOffer(offered, offerId);
  const appointedOn = s.gameDate;
  s = continueUntil(s, addDaysIso(nextFixtureDate, 2));
  assertNoBacklog(s, appointedOn, clubId);
  assert.ok(Object.values(s.media!.stories).some((st) => st.ownClub && st.kind === "MATCH_REPORT" && st.date > appointedOn), "normal media resumes after the appointment");
});
