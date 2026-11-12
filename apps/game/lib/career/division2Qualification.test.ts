// Division 2 playable qualification (Alpha hotfix): a Division 2 pool club has no roster. When the manager's club is
// drawn against one in an M1.2 qualifier, the pool club gets one persistent fictional squad from the existing
// promotion generator -- once, deterministically, with provenance -- and the qualifier plays as a native V2 match.
// AI-vs-AI qualifiers and every other pool club stay exactly as they were.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createNewCareerState } from "./newCareer";
import { migrateCareerState } from "./saveMigration";
import type { CareerFixture, CareerState } from "./types";
import { gameContinuityRules, hasCompetitionSquad, isDivision2PoolClub, prepareGameContinuity } from "../competition/transition/gameContinuity";
import { SWEDISH_WORLD_COMPETITION_IDS } from "./worldCompetitions";
import { buildMatchdayReadyEvent } from "./careerEvents";
import { finishProductionMatch, startProductionMatch, tryStartProductionMatch } from "./productionMatch";
import { ensureQualificationOpponentSquads, generatePromotionSquads } from "./promotionSquads";
import { simulateAiFixturesForDate } from "./calendar";
import { processDay } from "./dailyTick";
import { createSave, getSave, saveCareerState, __setSaveBackendForTests } from "../save/saveRepository";
import { createMemoryBackend } from "../save/saveStorage";
import { readMatchArchive } from "../save/matchArchiveStorage";

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v) ?? "null").digest("hex");

// A stock career: the manager at IFK Tumba, Division 2 pool clubs rosterless as in every new Alpha career.
// The pool entrant is the one the M1.2 game-continuity planner itself puts forward; the qualifier is shaped like the
// planner's own fixtures (QUALIFIER, a season-scoped transition id containing "/").
let cached: { state: CareerState; fixture: CareerFixture; pool: string; manager: string; ai: CareerFixture; otherPool: string } | undefined;
function poolQualifier() {
  if (cached) return structuredClone(cached);
  const base = createNewCareerState("division2-playable-qualification", "swe2-tumba");
  const entrants = prepareGameContinuity(base, "2027-03-18").request.evidence!.externalEntrants!.map((e) => e.clubId);
  const [pool, otherPool] = entrants.filter((c) => isDivision2PoolClub(base, c) && !(base.worldSquads[c] ?? []).length);
  assert.ok(pool && otherPool, "the planner names rosterless Division 2 pool entrants");
  const manager = base.playerClubId;
  const opponentOfOther = Object.keys(base.worldSquads).find((c) => c !== manager && (base.worldSquads[c] ?? []).length >= 12)!;
  const fixture: CareerFixture = { id: `${base.seasonId}:transition:test-pool-final:g1`, competitionId: "se_division1_sodra", round: 1, date: base.gameDate, homeClubId: pool, awayClubId: manager, type: "QUALIFIER" };
  const ai: CareerFixture = { id: `${base.seasonId}:transition:test-ai-final:g1`, competitionId: "se_division1_norra", round: 1, date: base.gameDate, homeClubId: otherPool, awayClubId: opponentOfOther, type: "QUALIFIER" };
  const state: CareerState = { ...base, fixtures: [...base.fixtures, fixture, ai], careerEvents: [...base.careerEvents, buildMatchdayReadyEvent(fixture.id, fixture.date)] };
  cached = { state, fixture, pool, manager, ai, otherPool };
  return structuredClone(cached);
}

test("without a pool-club squad the start fails clearly in Swedish and changes nothing", () => {
  const { state, pool, fixture } = poolQualifier();
  assert.equal((state.worldSquads[pool] ?? []).length, 0, "the pool club is rosterless before the fix applies");
  const before = hash(state);
  const attempt = tryStartProductionMatch(state, fixture.id, {});
  assert.equal(attempt.ok, false);
  assert.match((attempt as { error: string }).error, /har ingen spelbar trupp just nu – det behövs sex tillgängliga utespelare och en målvakt\. Matchen kan inte startas, och karriären har inte ändrats\./);
  assert.equal(hash(state), before, "no partial session or other mutation");
  assert.equal(state.productionMatch ?? null, null);
});

test("the pool opponent gets one persistent, valid, provenance-marked squad -- once, with no duplicates on retry", () => {
  const { state, fixture, pool } = poolQualifier();
  const idsBefore = new Set(Object.values(state.worldSquads).flat().map((p) => p.id));
  const s = ensureQualificationOpponentSquads(state);
  const squad = s.worldSquads[pool]!;
  assert.equal(squad.length, 16, "the existing sixteen-player template");
  assert.equal(squad.filter((p) => p.position === "MV").length, 2, "goalkeeper coverage");
  assert.deepEqual([...new Set(squad.map((p) => p.position))].sort(), ["H6", "H9", "M6", "M9", "MV", "V6", "V9"], "every position covered");
  assert.ok(hasCompetitionSquad(s, pool), "registered and playable");
  for (const p of squad) {
    assert.equal(p.clubId, pool);
    assert.deepEqual(p.generatedOrigin, { kind: "DIVISION2_QUALIFICATION", seasonId: state.seasonId, modelVersion: "division2-qualification-v1" }, "fictional provenance recorded");
    assert.ok(!idsBefore.has(p.id), "never reuses an existing identity");
    const contract = s.playerContracts[p.id]!;
    assert.equal(contract.clubId, pool);
    assert.ok(contract.contractEndDate >= fixture.date, "a valid registration on match day");
    assert.ok(s.gameplayRatings[pool]!.some((r) => r.playerId === p.id), "a gameplay rating");
    assert.equal(s.playerStatuses[p.id]?.availability, "AVAILABLE");
    assert.ok(s.playerClubHistory[p.id], "club history");
  }
  const allIds = Object.values(s.worldSquads).flat().map((p) => p.id);
  assert.equal(new Set(allIds).size, allIds.length, "no duplicate players anywhere");
  // Existing identities, contracts and results are untouched.
  for (const [clubId, players] of Object.entries(state.worldSquads)) if (clubId !== pool) assert.equal(hash(s.worldSquads[clubId]), hash(players));
  for (const [id, c] of Object.entries(state.playerContracts)) assert.equal(hash(s.playerContracts[id]), hash(c));
  assert.equal(hash(s.results), hash(state.results));
  assert.deepEqual(s.fixtures.map((f) => f.id), state.fixtures.map((f) => f.id), "fixture ids unchanged");
  // Retries, reloads and the daily path add nobody.
  assert.equal(hash(ensureQualificationOpponentSquads(s)), hash(s), "idempotent");
  const reloaded = migrateCareerState(JSON.parse(JSON.stringify(s)) as CareerState);
  assert.equal(hash(reloaded.worldSquads[pool]), hash(s.worldSquads[pool]), "reload keeps the same squad");
  assert.equal(hash(migrateCareerState(JSON.parse(JSON.stringify(state)) as CareerState).worldSquads[pool]), hash(s.worldSquads[pool]), "loading the rosterless save generates the identical squad (deterministic)");
});

test("only the manager's own pool opponent is generated; AI qualifiers and other pool clubs are unchanged", () => {
  const { state, manager, ai, otherPool } = poolQualifier();
  const s = ensureQualificationOpponentSquads(state);
  assert.equal((s.worldSquads[otherPool] ?? []).length, 0, "a pool club in an AI qualifier keeps its aggregate pool form");
  assert.equal(hash(simulateAiFixturesForDate(s, ai.date).state.results[ai.id]), hash(simulateAiFixturesForDate(state, ai.date).state.results[ai.id]), "the AI qualifier simulates exactly as before");
  // Unemployed: the club he left is simulated, so its pool opponent stays rosterless.
  const unemployed = { ...state, managerCareer: { ...state.managerCareer!, seekingJob: { since: state.gameDate, reason: "RESIGNED" as const, clubId: manager } } } as CareerState;
  assert.equal(hash(ensureQualificationOpponentSquads(unemployed)), hash(unemployed));
});

test("the daily tick gives the drawn pool opponent its squad the day the qualifier is on the calendar, and only once", () => {
  const { state, pool, fixture } = poolQualifier();
  const day = processDay(state, fixture.date).state;
  assert.ok(hasCompetitionSquad(day, pool), "the daily calendar path creates the squad before the matchday opens");
  assert.equal((day.worldSquads[pool] ?? []).length, 16);
  const again = processDay(day, fixture.date).state;
  assert.equal(hash(again.worldSquads[pool]), hash(day.worldSquads[pool]), "a repeated tick adds nobody");
});

test("a pool club that wins promotion after its qualifier keeps those identities -- the promotion generator adds nobody", () => {
  const { state, pool } = poolQualifier();
  const s = ensureQualificationOpponentSquads(state);
  const promoted = generatePromotionSquads(s, { [pool]: "se_division1_norra" }, gameContinuityRules(s.seasonId, s.saveSeed), "2027-09-01");
  assert.equal(hash(promoted.worldSquads[pool]), hash(s.worldSquads[pool]), "same sixteen players, no DIVISION2_PROMOTION duplicates");
  assert.equal(hash(promoted.playerContracts), hash(s.playerContracts));
});

test("the qualifier against the pool club plays as a native V2 match, live with a reload or as a quick result, and persists", async () => {
  __setSaveBackendForTests(createMemoryBackend());
  const { state: raw, fixture } = poolQualifier();
  const state = migrateCareerState(JSON.parse(JSON.stringify(raw)) as CareerState); // the load path generates the opponent
  const live = tryStartProductionMatch(state, fixture.id, {});
  assert.ok(live.ok, (live as { error?: string }).error);
  const session = (live as { state: CareerState }).state;
  assert.equal(session.productionMatch?.fixture.id, fixture.id);
  const reloaded = migrateCareerState(JSON.parse(JSON.stringify(session)) as CareerState);
  assert.equal(reloaded.productionMatch?.fixture.id, fixture.id, "the session survives a reload mid-match");
  const done = finishProductionMatch(reloaded);
  assert.equal(done.results[fixture.id]!.engine, "V2");
  assert.deepEqual(done.results[fixture.id], finishProductionMatch(session).results[fixture.id], "a reload does not change the match");
  const quick = finishProductionMatch(startProductionMatch(state, fixture.id, { quick: true }));
  assert.equal(quick.results[fixture.id]!.engine, "V2", "quick result is native too");

  const save = await createSave({ selectedNations: ["SWE"], selectedCompetitionIds: [...SWEDISH_WORLD_COMPETITION_IDS], clubId: done.playerClubId, manager: { name: "Div2 QA", nationality: "SWE", dateOfBirth: "1980-01-01" }, gameDate: done.gameDate });
  await saveCareerState(save.saveId, done);
  const loaded = migrateCareerState((await getSave(save.saveId))!.careerState!);
  assert.deepEqual(loaded.results[fixture.id], done.results[fixture.id], "the result persists");
  assert.equal((await readMatchArchive(save.saveId, fixture.id)).result.homeGoals, done.results[fixture.id]!.homeGoals, "the archive persists under the stored id");
  const ids = Object.values(loaded.worldSquads).flat().map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, "no duplicate players after the match and reload");
});
