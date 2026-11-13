// Club Identity C3: season-bound league membership (MIGRATION-STRATEGY §3-§4, ROADMAP C4 acceptance, I4/I5).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { CLUBS, CLUB_WORLD_EPOCH, getClub, getClubsByCompetition, isSwedishClub, TUMBA_CLUB_ID } from "../game-data";
import { careerClubsInCompetition, clubCompetitionForSeason, clubCompetitionId, isLegacyClubWorld } from "./competitionMembership";
import { getExternalCandidateClubs, WORLD_POOL_COMPETITION_IDS } from "./careerWorld";
import { createNewCareerState } from "./newCareer";
import { migrateCareerState } from "./saveMigration";
import { assessClubWorldCompatibility, assertClubWorldCompatible, ClubWorldCompatibilityError } from "./clubWorldCompatibility";
import type { CareerState } from "./types";

const FOREIGN_LEAGUES = ["ger-1", "den-1", "nor-1", "esp-1", "hun-1"]; // players/market.ts

const newCareer = (): CareerState => migrateCareerState(createNewCareerState("club-identity-c3", TUMBA_CLUB_ID));
/** A legacy v8 career: identical state, created before the club-world marker existed. */
const legacyCareer = (): CareerState => { const s = { ...newCareer() }; delete s.clubWorldBaseline; return migrateCareerState(JSON.parse(JSON.stringify(s))); };
const inSeason = (s: CareerState, seasonId: string): CareerState => ({ ...s, seasonId });

const CORRECTED_2026: Record<string, string> = {
  "ger1-leipzig": "ger-2", "ger1-minden": "ger-2", "ger2-balingen": "ger-1", "ger1-bietigheim": "ger-1",
  "den1-hoj": "den-2", "den1-grindsted": "den-2", "den1-kif-kolding": "den-1",
  "isl2-fram": "isl-1", "hun2-komlo": "hun-1", "esp1-alicante": "esp-2", "svn2-skofjaloka": "svn-1", "svn2-jeruzalem": "svn-1",
};

test("markers: new careers carry the club-world epoch; legacy saves stay unmarked through migration", () => {
  assert.equal(newCareer().clubWorldBaseline, CLUB_WORLD_EPOCH);
  const legacy = legacyCareer();
  assert.equal(legacy.clubWorldBaseline, undefined, "migration never backfills the marker (absence is the marker)");
  assert.equal(isLegacyClubWorld(legacy), true);
});

test("I4: a legacy career in its start season sees exactly the frozen v8 world", () => {
  const legacy = legacyCareer();
  for (const c of CLUBS) assert.equal(clubCompetitionId(legacy, c.id), c.addedInWorld ? undefined : c.competitionId, c.id);
  for (const l of [...FOREIGN_LEAGUES, ...WORLD_POOL_COMPETITION_IDS]) {
    assert.deepEqual(careerClubsInCompetition(legacy, l).map((c) => c.id), getClubsByCompetition(l).map((c) => c.id), `${l}: same members, same order => same deterministic foreign-bid pick`);
  }
  const v8Pool = new Set([...WORLD_POOL_COMPETITION_IDS.flatMap((id) => getClubsByCompetition(id).map((c) => c.id))]);
  const pool = getExternalCandidateClubs(legacy).filter((c) => !isSwedishClub(c.id)).map((c) => c.id);
  assert.deepEqual(pool, [...v8Pool].filter((id) => id !== legacy.playerClubId));
});

test("D5: legacy careers switch to the corrected foreign leagues at their next season, never mid-season", () => {
  const legacy = legacyCareer();
  for (const [id, league] of Object.entries(CORRECTED_2026)) {
    assert.notEqual(clubCompetitionId(legacy, id), league, `${id} unchanged during 2026/27`);
    assert.equal(clubCompetitionId(inSeason(legacy, "2027/28"), id), league, `${id} from 2027/28`);
    assert.equal(clubCompetitionId(inSeason(legacy, "2031/32"), id), league, `${id} carried forward`);
  }
  const next = inSeason(legacy, "2027/28");
  assert.ok(careerClubsInCompetition(next, "ger-1").some((c) => c.id === "ger1-bietigheim"));
  assert.ok(!careerClubsInCompetition(next, "ger-1").some((c) => c.id === "ger1-leipzig"));
  assert.ok(!careerClubsInCompetition(next, "ger-2").some((c) => c.id === "ger2-wilhelmshaven"), "tombstone excluded after validTo");
  assert.ok(careerClubsInCompetition(legacy, "ger-2").some((c) => c.id === "ger2-wilhelmshaven"), "tombstone still present where the legacy season already had it");
});

test("D5: new careers get the corrected 2026/27 world from day one", () => {
  const s = newCareer();
  for (const [id, league] of Object.entries(CORRECTED_2026)) assert.equal(clubCompetitionId(s, id), league, id);
  assert.equal(clubCompetitionId(s, "ger2-wilhelmshaven"), undefined);
  const pool = new Set(getExternalCandidateClubs(s).map((c) => c.id));
  for (const id of ["ger2-balingen", "ger1-bietigheim", "den1-kif-kolding", "isl2-fram", "hun2-komlo"]) assert.ok(pool.has(id), `${id} is in the 2026/27 world pool`);
  for (const id of ["ger1-leipzig", "ger1-minden", "den1-hoj", "den1-grindsted", "esp1-alicante"]) assert.ok(!pool.has(id), `${id} left the 2026/27 world pool`);
});

test("I5: Swedish leagues belong to the career -- real-world data never moves a Swedish club, and simulation always wins", () => {
  for (const s of [legacyCareer(), newCareer()]) for (const season of ["2026/27", "2027/28", "2030/31"]) {
    for (const c of CLUBS.filter((x) => isSwedishClub(x.id))) assert.equal(clubCompetitionForSeason(s, c.id, season), c.competitionId, `${c.id} ${season}`);
  }
  const promoted = { ...newCareer(), competitionMembership: { "swe2-tumba": "se_handbollsligan_herr", "ger1-leipzig": "ger-1" } };
  assert.equal(clubCompetitionId(promoted, "swe2-tumba"), "se_handbollsligan_herr");
  assert.equal(clubCompetitionId(promoted, "ger1-leipzig"), "ger-1", "a career-written membership wins over real-world history");
});

test("REAL_WORLD squad clubs never change league, so rating priors, world-pool squads and economies stay static-safe", () => {
  for (const c of CLUBS.filter((x) => x.dataSource === "REAL_WORLD")) {
    for (const h of c.competitionHistory ?? []) assert.equal(h.competitionId, c.competitionId, `${c.id}: moving a squad-bearing club needs clubContextTier/worldPoolIntegration to become career-aware first`);
  }
});

test("grep gate: static league reads only in reviewed files", () => {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const pattern = /getClubsByCompetition\(|\b(?:c|club|playerClub|getClub\([^)]*\)\??)\.competitionId\b/;
  // Every file below was reviewed in Club Identity C0/C3: Swedish-only, override-first, offline tooling, own-league fixtures, or a guarded fallback after the resolver.
  const REVIEWED = new Set([
    "app/api/editor/catalog/route.ts", "app/api/editor/players-bulk/route.ts", "app/career/club/cpu-recruitment/page.tsx", "app/career/clubs/[clubId]/page.tsx",
    "app/career/scouting/page.tsx", "app/career/manager/page.tsx", "app/editor/page.tsx", "app/new-game/page.tsx", "components/game/Identity.tsx", "components/manager/ClubContext.tsx",
    "components/manager/StatisticsTable.tsx", "lib/analysis/viewModels.ts", "lib/career/careerInitialization.ts", "lib/career/clubPartnerships.ts",
    "lib/career/competitionMembership.ts", "lib/career/cpuCandidateEvaluation.ts", "lib/career/division1Integration.ts", "lib/career/management.ts",
    "lib/career/newCareer.ts", "lib/career/recruitment.ts", "lib/career/scoutDiscovery.ts", "lib/career/seasonTransition.fixtures.ts", "lib/career/seasonTransition.ts",
    "lib/career/squadSnapshot.ts", "lib/career/worldCompetitions.ts", "lib/career/worldDevelopment.ts", "lib/career/worldPoolIntegration.ts", "lib/career/youthIntake.ts",
    "lib/competition/season.ts", "lib/competition/tables.ts", "lib/competition/transition/careerSnapshot.ts", "lib/competition/transition/cooperationEligibility.ts",
    "lib/competition/transition/gameContinuity.ts", "lib/economy/clubEconomyIntegration.ts", "lib/economy/clubHistoryGeneration.ts", "lib/economy/contractIntegration.ts",
    "lib/economy/trainingCompensation.ts", "lib/editor/catalog.ts", "lib/editor/playerRepository.ts", "lib/game-data/clubs.ts", "lib/game-data/clubIdentity.ts", "lib/gameWorld/leagueSegment.ts",
    "lib/gameWorld/realWorldLoader.ts", "lib/gameWorld/serverSnapshot.ts", "lib/gameWorld/staffIdentitySnapshot.ts", "lib/manager/changeClub.ts", "lib/manager/managerCareer.ts",
    "lib/matchBenchmarks/empirical.ts", "lib/media/worldTick.ts", "lib/newGame/clubSelectionContext.ts", "lib/players/market.ts", "lib/rating/evidencePipeline/ingestor.ts",
    "lib/rating/gamePrior/clubContextTier.ts", "lib/rating/pipeline/batchRunner.ts", "lib/rating/pipeline/evidenceCollection.ts", "lib/staff/scoutPool.ts",
    "lib/staff/staffCareerIntegration.ts", "lib/transfers/playerInterest.ts", "lib/career/cpuRecruitment.ts", "lib/career/types.ts", "lib/game-data/competitions.ts", "lib/transfers/trainingCompensation.ts", "lib/transfers/transferExecution.ts",
  ]);
  const found: string[] = [];
  const walk = (dir: string) => { for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (!["node_modules", ".next", "generated", "__fixtures__"].includes(name)) walk(p); continue; }
    if (!/\.(ts|tsx)$/.test(name) || /\.test\.ts$|\.sim\.test\.ts$/.test(name)) continue;
    if (pattern.test(readFileSync(p, "utf8"))) found.push(relative(root, p).replace(/\\/g, "/"));
  } };
  for (const d of ["app", "components", "lib"]) walk(join(root, d));
  assert.deepEqual(found.filter((f) => !REVIEWED.has(f)), [], "new static league reads must use career/competitionMembership.ts or be reviewed into this list");
});

test("T7: unknown club worlds are refused before anything is written; unresolved stray ids only warn", () => {
  const s = newCareer();
  assert.equal(assessClubWorldCompatibility(s).compatible, true);
  assert.equal(assessClubWorldCompatibility(legacyCareer()).compatible, true, "legacy saves are always readable");
  assert.throws(() => assertClubWorldCompatible({ ...s, clubWorldBaseline: "cid-2099-00-v9" }), ClubWorldCompatibilityError);
  assert.throws(() => assertClubWorldCompatible({ ...s, playerClubId: "no-such-club" }), ClubWorldCompatibilityError);
  const stray = { ...s, clubKnowledge: { ...s.clubKnowledge, "removed-club": 5 } } as CareerState;
  const report = assessClubWorldCompatibility(stray);
  assert.equal(report.compatible, true);
  assert.deepEqual(report.unresolvedClubIds, ["removed-club"]);
  assert.ok(getClub(s.playerClubId));
});
