// Alpha hotfix (M6C/M6D + M7D release): M1.2 qualification fixture ids contain "/" ("2026/27:transition:..."), and an
// unencoded /career/match-day/<id> link split the route and answered 404. Every fixture route now encodes the id;
// stored ids never change; a qualification match starts, persists and resumes as a native V2 match.
import { test } from "node:test";
import assert from "node:assert/strict";
import { simulateMatch, seedFromString, type ClubStrength } from "@handball-manager/game-simulation";
import { CLUBS } from "../game-data";
import { createNewCareerState } from "./newCareer";
import { migrateCareerState } from "./saveMigration";
import type { CareerFixture, CareerState } from "./types";
import { buildNewSeasonCalendar } from "../competition/seasonCalendar";
import { applyKnockoutDecider } from "../competition/season";
import { progressCareerQualifications } from "../competition/transition/careerQualifications";
import { SWEDISH_2026_RULES as rules } from "../competition/transition/sweden2026";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { SWEDISH_WORLD_COMPETITION_IDS } from "./worldCompetitions";
import { buildMatchdayReadyEvent } from "./careerEvents";
import { finishProductionMatch, startProductionMatch } from "./productionMatch";
import { resolveContextualContinueAction } from "./contextualContinueAction";
import { fixtureHref, fixtureIdFromParam, fixtureSegment, matchDayHref, matchReportHref, samePath } from "./fixtureRoutes";
import { resolveDestinationHref } from "./destinations";
import { createSave, getSave, saveCareerState, __setSaveBackendForTests } from "../save/saveRepository";
import { createMemoryBackend } from "../save/saveStorage";
import { readMatchArchive } from "../save/matchArchiveStorage";

const QUALIFICATION = "2026/27:transition:d1-s-final-9:g1";
const LEAGUE = "swe-2-f5";
const CUP = "2026-cup-R32-15-l1";

test("fixture routes encode a qualification id as one segment and leave league and cup ids unchanged", () => {
  assert.equal(matchDayHref(QUALIFICATION), "/career/match-day/2026%2F27%3Atransition%3Ad1-s-final-9%3Ag1");
  assert.equal(matchDayHref(QUALIFICATION, { finish: true }), "/career/match-day/2026%2F27%3Atransition%3Ad1-s-final-9%3Ag1?finish=1");
  assert.equal(matchReportHref(QUALIFICATION), "/career/match-report/2026%2F27%3Atransition%3Ad1-s-final-9%3Ag1");
  assert.equal(fixtureHref(QUALIFICATION), "/career/fixtures/2026%2F27%3Atransition%3Ad1-s-final-9%3Ag1");
  assert.equal(fixtureSegment(QUALIFICATION).includes("/"), false, "a single path segment");
  // Ordinary league and cup ids keep exactly the URLs they always had.
  assert.equal(matchDayHref(LEAGUE), `/career/match-day/${LEAGUE}`);
  assert.equal(matchDayHref(CUP, { finish: true }), `/career/match-day/${CUP}?finish=1`);
  assert.equal(matchReportHref(LEAGUE), `/career/match-report/${LEAGUE}`);
  assert.equal(fixtureHref(CUP), `/career/fixtures/${CUP}`);
  // The page reads back the stored id whether or not the router already decoded the segment.
  for (const id of [QUALIFICATION, LEAGUE, CUP]) {
    assert.equal(fixtureIdFromParam(fixtureSegment(id)), id);
    assert.equal(fixtureIdFromParam(id), id);
  }
  assert.equal(fixtureIdFromParam(undefined), "");
  assert.ok(samePath("/career/match-day/2026/27:transition:d1-s-final-9:g1", matchDayHref(QUALIFICATION)));
});

test("resume and notification links to a qualification match use the encoded route", () => {
  const career = { productionMatch: { fixture: { id: QUALIFICATION } } } as unknown as CareerState;
  // Elsewhere in the career, Continue leads back to the encoded match route.
  const away = resolveContextualContinueAction(career, null, "/career");
  assert.equal(away.kind, "RESUME_MATCH");
  assert.equal(away.targetHref, matchDayHref(QUALIFICATION));
  // On the match page itself -- however the browser spells the segment -- it recognises the route.
  for (const pathname of [matchDayHref(QUALIFICATION), "/career/match-day/2026/27:transition:d1-s-final-9:g1"]) {
    const here = resolveContextualContinueAction(career, null, pathname);
    assert.equal(here.kind, "RESUME_MATCH");
    assert.equal(here.disabled, true, `on the match route (${pathname})`);
    assert.equal(here.targetHref, null);
  }
  assert.equal(resolveDestinationHref({ route: "MATCH_DAY", fixtureId: QUALIFICATION } as never), matchDayHref(QUALIFICATION));
  assert.equal(resolveDestinationHref({ route: "MATCH_REPORT", fixtureId: QUALIFICATION } as never), matchReportHref(QUALIFICATION));
});

// A real M1.2 qualification fixture, built the way the transition tests build one (fixed test strengths decide
// the leagues; results never depend on which club the manager runs), then rebuilt with full squads for that club.
const strength = (clubId: string): ClubStrength => ({ clubId, overall: 60, attack: 60, defense: 60, goalkeeper: 60, depth: 60 });
function simulate(state: CareerState, f: CareerFixture): CareerState {
  const score = simulateMatch({ fixtureId: f.id, seed: seedFromString(`m12e:${f.id}`), homeClubId: f.homeClubId, awayClubId: f.awayClubId, homeStrength: strength(f.homeClubId), awayStrength: strength(f.awayClubId) });
  return { ...state, results: { ...state.results, [f.id]: applyKnockoutDecider(state, f, score, strength) } };
}
function withQualifiers(manager: string, squads?: Parameters<typeof createNewCareerState>[2], ratings?: Parameters<typeof createNewCareerState>[4]): CareerState {
  let s = buildNewSeasonCalendar(createNewCareerState("hotfix-qualification-route", manager, squads, undefined, ratings), "2026-08-01");
  for (const f of s.fixtures) s = simulate(s, f);
  s = { ...s, gameDate: "2027-03-19", seasonComplete: false };
  // Test-only attestation and partnership state, as in careerQualifications.test.ts; not an official register.
  s = { ...s, clubPartnerships: Object.fromEntries(Object.entries(s.clubPartnerships).map(([id, p]) => [id, { ...p, permanent: false, status: "TERMINATED" as const, endDate: "2026-12-31" }])), seasonTransitionRequest: { fromSeasonId: s.seasonId, rules, evidence: { eligibility: CLUBS.filter((c) => rules.leagues.some((l) => l.id === c.competitionId)).flatMap((c) => rules.families.map((f) => ({ clubId: c.id, targetFamilyId: f.id, seasonId: s.seasonId, status: "ELIGIBLE" as const, evidence: "Test-only reviewed acceptance/licence/cooperation fixture; not a real official decision." }))) } } };
  return progressCareerQualifications(s, "2027-03-19").state;
}

let qualificationCareer: { state: CareerState; fixture: CareerFixture } | undefined;
function qualificationMatchday(): { state: CareerState; fixture: CareerFixture } {
  if (qualificationCareer) return structuredClone(qualificationCareer);
  const squads = Object.assign({}, ...SWEDISH_WORLD_COMPETITION_IDS.map((c) => snapshotWorldSquads(c)));
  const ratings = Object.assign({}, ...SWEDISH_WORLD_COMPETITION_IDS.map((c) => snapshotGameplayRatings(c)));
  const probe = withQualifiers("se_club_bodens_bk_hf");
  // A Swedish-pyramid club with a squad in a qualifier whose id carries the season, as on the Alpha.
  const target = probe.fixtures.filter((f) => f.type === "QUALIFIER" && f.id.includes("/") && !probe.results[f.id]).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).find((f) => [f.homeClubId, f.awayClubId].some((c) => (squads[c]?.length ?? 0) >= 12));
  assert.ok(target, "the season produced a qualification fixture with a slash in its id");
  const manager = [target.homeClubId, target.awayClubId].find((c) => (squads[c]?.length ?? 0) >= 12)!;
  const s = withQualifiers(manager, squads, ratings);
  const fixture = s.fixtures.find((f) => f.id === target.id)!;
  assert.ok(fixture && (fixture.homeClubId === manager || fixture.awayClubId === manager), "the rebuilt career has the same qualifier for the manager's club");
  qualificationCareer = { state: { ...s, gameDate: fixture.date, careerEvents: [buildMatchdayReadyEvent(fixture.id, fixture.date)] }, fixture };
  return structuredClone(qualificationCareer);
}

test("a qualification match starts as a native V2 session, persists through save/load with its archive, and keeps its stored id", async () => {
  __setSaveBackendForTests(createMemoryBackend());
  const { state, fixture } = qualificationMatchday();
  const idsBefore = state.fixtures.map((f) => f.id);
  // Quick result (the Alpha's 404 path) through the same calls the match preview makes.
  const started = startProductionMatch(state, fixture.id, { quick: true });
  assert.equal(started.productionMatch?.fixture.id, fixture.id, "a native session for the qualification fixture");
  const done = finishProductionMatch(started);
  const result = done.results[fixture.id]!;
  assert.equal(result.engine, "V2", "the qualification match is a native V2 match");
  assert.deepEqual(done.fixtures.map((f) => f.id), idsBefore, "stored fixture ids are unchanged");
  assert.ok(done.matchArchives?.[fixture.id] || done.matchArchiveIds?.includes(fixture.id), "the match is archived under its stored id");

  const save = await createSave({ selectedNations: ["SWE"], selectedCompetitionIds: [...SWEDISH_WORLD_COMPETITION_IDS], clubId: done.playerClubId, manager: { name: "Hotfix QA", nationality: "SWE", dateOfBirth: "1980-01-01" }, gameDate: done.gameDate });
  await saveCareerState(save.saveId, done);
  const loaded = migrateCareerState((await getSave(save.saveId))!.careerState!);
  assert.deepEqual(loaded.results[fixture.id], result, "the result survives save/load");
  assert.ok(loaded.matchArchiveIds?.includes(fixture.id), "the archive is referenced by the stored id");
  const archive = await readMatchArchive(save.saveId, fixture.id);
  assert.equal(archive.fixture.id, fixture.id);
  assert.deepEqual(archive.result, result, "the stored archive is the played match");
  assert.equal(matchReportHref(fixture.id).split("/").length, 4, "its report route is one encoded segment");
});

test("a live qualification match survives a reload mid-match and resumes to the same native result", () => {
  const { state, fixture } = qualificationMatchday();
  const live = startProductionMatch(state, fixture.id);
  assert.equal(live.productionMatch?.fixture.id, fixture.id);
  // The browser save is plain JSON: reload in the middle of the match, then resume and finish.
  const reloaded = migrateCareerState(JSON.parse(JSON.stringify(live)) as CareerState);
  assert.equal(reloaded.productionMatch?.fixture.id, fixture.id, "the session is still there after reload");
  const resumed = resolveContextualContinueAction(reloaded, null, "/career");
  assert.equal(resumed.kind, "RESUME_MATCH");
  assert.equal(resumed.targetHref, matchDayHref(fixture.id), "Continue resumes on the encoded match route");
  const done = finishProductionMatch(reloaded);
  assert.equal(done.results[fixture.id]!.engine, "V2");
  assert.deepEqual(done.results[fixture.id], finishProductionMatch(live).results[fixture.id], "a reload does not change the match");
});
