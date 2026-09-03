// HM-PLAYER-DEVELOPMENT-2.0 PHASE 0: the long-career simulation harness.
//
// Measures whether Handball Manager's player population and league quality
// stay healthy over 20 simulated seasons. This is OBSERVATION ONLY -- it
// changes no development rule and writes nothing into canonical data/.
//
// It deliberately drives the REAL career engine (createNewCareerState ->
// processDay), never a parallel simulator: development resolution, decline,
// retirement, youth intake, contracts and transfers all run exactly as they
// do in a played career, so a measurement here cannot drift from production
// behaviour. The only thing this file owns is metric extraction.
//
// Determinism: every number below is a pure function of (career seed,
// canonical data). No Math.random, no wall-clock input -- the two `--seed`
// runs of the same seed must produce identical metrics (see the harness
// tests in lib/career/simulationHarness.test.ts).
//
// Usage:
//   npx tsx scripts/simulate-player-development.ts [--seasons 20] [--seed s1] [--out <dir>]
import * as fs from "node:fs";
import * as path from "node:path";
import { createNewCareerState } from "../lib/career/newCareer";
import { processDay } from "../lib/career/dailyTick";
import { snapshotWorldSquads, snapshotGameplayRatings } from "../lib/gameWorld/serverSnapshot";
import { getClubsByCompetition, type PlayerMock } from "../lib/game-data";
import { SWEDISH_WORLD_COMPETITION_IDS } from "../lib/career/worldCompetitions";
import { RETIRED_CLUB_ID } from "../lib/career/playerLifecycle";
import { FREE_AGENT_CLUB_ID } from "../lib/career/contractExpiry";
import { playerAgeAtDate } from "../lib/development/developmentIntegration";
import { addDays } from "../lib/career/dateUtils";
import { OUTCOURT_ATTRIBUTE_FAMILIES, GOALKEEPER_ATTRIBUTE_FAMILIES, ATTRIBUTE_MIN, ATTRIBUTE_MAX } from "../lib/rating/types";
import type { CareerState } from "../lib/career/types";
import type { GameplayPlayerRating } from "../lib/gameWorld/gameplayRatingSnapshot";

// ---------------------------------------------------------------------------
// World construction -- the same four-competition setup worldCompetitions.test.ts
// already uses, so the harness starts from exactly the world a real career does.
// ---------------------------------------------------------------------------

const COMPETITION_LABEL: Record<string, string> = {
  se_handbollsligan_herr: "Handbollsligan",
  "swe-2": "Herrallsvenskan",
  se_division1_norra: "Division 1 Norra",
  se_division1_sodra: "Division 1 Sodra",
};

export interface BuiltWorld {
  worldSquads: Record<string, PlayerMock[]>;
  gameplayRatings: Record<string, GameplayPlayerRating[]>;
  competitionOfClub: Map<string, string>;
}

let cachedWorld: BuiltWorld | undefined;

/** Loads all four Swedish competitions once. Read-only against canonical data/. */
export function buildSwedishWorld(): BuiltWorld {
  if (cachedWorld) return cachedWorld;
  const worldSquads: Record<string, PlayerMock[]> = {};
  const gameplayRatings: Record<string, GameplayPlayerRating[]> = {};
  const competitionOfClub = new Map<string, string>();
  for (const competitionId of SWEDISH_WORLD_COMPETITION_IDS) {
    Object.assign(worldSquads, snapshotWorldSquads(competitionId));
    Object.assign(gameplayRatings, snapshotGameplayRatings(competitionId));
    for (const club of getClubsByCompetition(competitionId)) competitionOfClub.set(club.id, competitionId);
  }
  cachedWorld = { worldSquads, gameplayRatings, competitionOfClub };
  return cachedWorld;
}

export function createHarnessCareer(seed: string, playerClubId: string): CareerState {
  const world = buildSwedishWorld();
  return createNewCareerState(seed, playerClubId, world.worldSquads, {}, world.gameplayRatings);
}

// ---------------------------------------------------------------------------
// Metric extraction
// ---------------------------------------------------------------------------

/** A youth-intake player's id is `youth-<clubId>-<year>-<index>` (youthIntake.ts). */
function isGeneratedPlayer(playerId: string): boolean {
  return playerId.startsWith("youth-");
}

export interface PlayerRow {
  playerId: string;
  clubId: string;
  competitionId: string | null;
  age: number | null;
  ca: number;
  pa: number;
  position: string;
  generated: boolean;
  retired: boolean;
  freeAgent: boolean;
  branch: "OUTCOURT" | "GOALKEEPER";
  attributeTotal: number;
  atMin: number;
  atMax: number;
  familyTotals: Record<string, number>;
}

const POSITIONAL_FAMILY: Record<string, string> = {
  MV: "goalkeeper", V6: "wing", H6: "wing", V9: "backcourt", H9: "backcourt", M9: "centre", M6: "pivot",
};

/** Every player the career currently knows about, with their live rating. */
export function collectPlayers(state: CareerState, date: string): PlayerRow[] {
  const world = buildSwedishWorld();
  const rows: PlayerRow[] = [];
  for (const [clubId, squad] of Object.entries(state.worldSquads)) {
    const ratings = state.gameplayRatings[clubId] ?? [];
    const byId = new Map(ratings.map((r) => [r.playerId, r]));
    for (const player of squad) {
      const rating = byId.get(player.id);
      if (!rating) continue; // no live rating -> not measurable ability
      const attrs = rating.branch.attributes as unknown as Record<string, { value: number }>;
      const familyDefs = rating.branch.branch === "GOALKEEPER" ? GOALKEEPER_ATTRIBUTE_FAMILIES : OUTCOURT_ATTRIBUTE_FAMILIES;
      const familyTotals: Record<string, number> = {};
      let attributeTotal = 0, atMin = 0, atMax = 0;
      for (const [family, list] of Object.entries(familyDefs)) {
        let sum = 0;
        for (const attr of list as readonly string[]) {
          const v = attrs[attr]?.value ?? 0;
          sum += v; attributeTotal += v;
          if (v <= ATTRIBUTE_MIN) atMin++;
          if (v >= ATTRIBUTE_MAX) atMax++;
        }
        familyTotals[family] = sum;
      }
      rows.push({
        playerId: player.id,
        clubId,
        competitionId: world.competitionOfClub.get(clubId) ?? null,
        age: playerAgeAtDate(player.dateOfBirth, player.birthYear, date),
        ca: rating.ca,
        pa: rating.pa,
        position: player.position,
        generated: isGeneratedPlayer(player.id),
        retired: clubId === RETIRED_CLUB_ID,
        freeAgent: clubId === FREE_AGENT_CLUB_ID,
        branch: rating.branch.branch,
        attributeTotal, atMin, atMax, familyTotals,
      });
    }
  }
  return rows;
}

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
}

export interface Distribution {
  n: number; min: number; p10: number; p25: number; median: number; mean: number; p75: number; p90: number; max: number;
}

export function distribution(values: number[]): Distribution {
  if (values.length === 0) return { n: 0, min: 0, p10: 0, p25: 0, median: 0, mean: 0, p75: 0, p90: 0, max: 0 };
  const s = [...values].sort((a, b) => a - b);
  const mean = s.reduce((acc, v) => acc + v, 0) / s.length;
  return {
    n: s.length, min: s[0], p10: quantile(s, 0.1), p25: quantile(s, 0.25), median: quantile(s, 0.5),
    mean: Number(mean.toFixed(2)), p75: quantile(s, 0.75), p90: quantile(s, 0.9), max: s[s.length - 1],
  };
}

const AGE_BUCKETS: readonly (readonly [string, number, number])[] = [
  ["<18", 0, 17], ["18-20", 18, 20], ["21-23", 21, 23], ["24-27", 24, 27],
  ["28-31", 28, 31], ["32-35", 32, 35], ["36+", 36, 200],
];

const DELTA_AGE_BUCKETS: readonly (readonly [string, number, number])[] = [
  ["15-17", 0, 17], ["18-20", 18, 20], ["21-23", 21, 23], ["24-26", 24, 26],
  ["27-29", 27, 29], ["30-32", 30, 32], ["33-35", 33, 35], ["36+", 36, 200],
];

function bucketFor(buckets: readonly (readonly [string, number, number])[], age: number | null): string | null {
  if (age === null) return null;
  for (const [label, lo, hi] of buckets) if (age >= lo && age <= hi) return label;
  return null;
}

export interface Checkpoint {
  season: number;
  date: string;
  totalActive: number;
  realPlayers: number;
  generatedPlayers: number;
  retired: number;
  freeAgents: number;
  averageAge: number;
  ageDistribution: Record<string, number>;
  caWorld: Distribution;
  caByCompetition: Record<string, Distribution>;
  top25MeanCA: number;
  countCA150: number;
  countCA140: number;
  countCA130: number;
  countCAUnder100: number;
  attributePointsTotal: number;
  attributesAtMin: number;
  attributesAtMax: number;
  familyMeans: Record<string, number>;
  paHeadroomByAge: Record<string, number>;
  stateSizeBytes: number;
}

export function checkpoint(state: CareerState, date: string, season: number): Checkpoint {
  const rows = collectPlayers(state, date);
  const active = rows.filter((r) => !r.retired);
  const ages = active.map((r) => r.age).filter((a): a is number => a !== null);
  const ageDistribution: Record<string, number> = {};
  for (const [label] of AGE_BUCKETS) ageDistribution[label] = 0;
  for (const a of ages) { const b = bucketFor(AGE_BUCKETS, a); if (b) ageDistribution[b]++; }

  const caByCompetition: Record<string, Distribution> = {};
  for (const competitionId of SWEDISH_WORLD_COMPETITION_IDS) {
    caByCompetition[COMPETITION_LABEL[competitionId]] = distribution(
      active.filter((r) => r.competitionId === competitionId).map((r) => r.ca),
    );
  }
  const allCA = active.map((r) => r.ca);
  const top25 = [...allCA].sort((a, b) => b - a).slice(0, 25);

  const familySums: Record<string, number> = {};
  const familyCounts: Record<string, number> = {};
  for (const r of active) {
    for (const [family, total] of Object.entries(r.familyTotals)) {
      const key = `${r.branch === "GOALKEEPER" ? "GK." : ""}${family}`;
      familySums[key] = (familySums[key] ?? 0) + total;
      familyCounts[key] = (familyCounts[key] ?? 0) + 1;
    }
  }
  const familyMeans: Record<string, number> = {};
  for (const k of Object.keys(familySums)) familyMeans[k] = Number((familySums[k] / familyCounts[k]).toFixed(2));

  const headroomSums: Record<string, { sum: number; n: number }> = {};
  for (const r of active) {
    const b = bucketFor(DELTA_AGE_BUCKETS, r.age);
    if (!b) continue;
    headroomSums[b] = headroomSums[b] ?? { sum: 0, n: 0 };
    headroomSums[b].sum += r.pa - r.ca;
    headroomSums[b].n += 1;
  }
  const paHeadroomByAge: Record<string, number> = {};
  for (const [k, v] of Object.entries(headroomSums)) paHeadroomByAge[k] = Number((v.sum / v.n).toFixed(2));

  return {
    season, date,
    totalActive: active.length,
    realPlayers: active.filter((r) => !r.generated).length,
    generatedPlayers: active.filter((r) => r.generated).length,
    retired: rows.filter((r) => r.retired).length,
    freeAgents: active.filter((r) => r.freeAgent).length,
    averageAge: ages.length ? Number((ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(2)) : 0,
    ageDistribution,
    caWorld: distribution(allCA),
    caByCompetition,
    top25MeanCA: top25.length ? Number((top25.reduce((a, b) => a + b, 0) / top25.length).toFixed(2)) : 0,
    countCA150: active.filter((r) => r.ca >= 150).length,
    countCA140: active.filter((r) => r.ca >= 140).length,
    countCA130: active.filter((r) => r.ca >= 130).length,
    countCAUnder100: active.filter((r) => r.ca < 100).length,
    attributePointsTotal: active.reduce((a, r) => a + r.attributeTotal, 0),
    attributesAtMin: active.reduce((a, r) => a + r.atMin, 0),
    attributesAtMax: active.reduce((a, r) => a + r.atMax, 0),
    familyMeans,
    paHeadroomByAge,
    stateSizeBytes: JSON.stringify(state).length,
  };
}

export interface SeasonDelta {
  season: number;
  humanRose: number; humanFell: number; humanFlat: number;
  cpuRose: number; cpuFell: number; cpuFlat: number;
  humanMeanPositive: number; humanMeanNegative: number;
  cpuMeanPositive: number; cpuMeanNegative: number;
  largestRise: number; largestFall: number;
  deltaByAgeBucket: Record<string, { mean: number; n: number }>;
  deltaByPositionalFamily: Record<string, { mean: number; n: number }>;
  retiredThisSeason: number;
  enteredThisSeason: number;
}

const FLAT_EPSILON = 0.5; // CA points -- below one attribute point's worth of outcourt movement (0.187) x ~3

export function seasonDelta(
  season: number,
  before: Map<string, PlayerRow>,
  after: Map<string, PlayerRow>,
  humanClubId: string,
): SeasonDelta {
  let humanRose = 0, humanFell = 0, humanFlat = 0, cpuRose = 0, cpuFell = 0, cpuFlat = 0;
  const humanPos: number[] = [], humanNeg: number[] = [], cpuPos: number[] = [], cpuNeg: number[] = [];
  let largestRise = 0, largestFall = 0;
  const ageAcc: Record<string, { sum: number; n: number }> = {};
  const famAcc: Record<string, { sum: number; n: number }> = {};

  for (const [playerId, a] of after) {
    const b = before.get(playerId);
    if (!b || a.retired || b.retired) continue;
    const delta = a.ca - b.ca;
    const isHuman = b.clubId === humanClubId;
    if (delta > FLAT_EPSILON) {
      if (isHuman) { humanRose++; humanPos.push(delta); } else { cpuRose++; cpuPos.push(delta); }
    } else if (delta < -FLAT_EPSILON) {
      if (isHuman) { humanFell++; humanNeg.push(delta); } else { cpuFell++; cpuNeg.push(delta); }
    } else if (isHuman) humanFlat++; else cpuFlat++;
    if (delta > largestRise) largestRise = delta;
    if (delta < largestFall) largestFall = delta;

    const ab = bucketFor(DELTA_AGE_BUCKETS, b.age);
    if (ab) { ageAcc[ab] = ageAcc[ab] ?? { sum: 0, n: 0 }; ageAcc[ab].sum += delta; ageAcc[ab].n++; }
    const fam = POSITIONAL_FAMILY[b.position];
    if (fam) { famAcc[fam] = famAcc[fam] ?? { sum: 0, n: 0 }; famAcc[fam].sum += delta; famAcc[fam].n++; }
  }

  const mean = (xs: number[]) => (xs.length ? Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3)) : 0);
  const toMeanMap = (acc: Record<string, { sum: number; n: number }>) => {
    const out: Record<string, { mean: number; n: number }> = {};
    for (const [k, v] of Object.entries(acc)) out[k] = { mean: Number((v.sum / v.n).toFixed(3)), n: v.n };
    return out;
  };

  let retiredThisSeason = 0;
  for (const [playerId, a] of after) { const b = before.get(playerId); if (a.retired && b && !b.retired) retiredThisSeason++; }
  let enteredThisSeason = 0;
  for (const playerId of after.keys()) if (!before.has(playerId)) enteredThisSeason++;

  return {
    season, humanRose, humanFell, humanFlat, cpuRose, cpuFell, cpuFlat,
    humanMeanPositive: mean(humanPos), humanMeanNegative: mean(humanNeg),
    cpuMeanPositive: mean(cpuPos), cpuMeanNegative: mean(cpuNeg),
    largestRise: Number(largestRise.toFixed(3)), largestFall: Number(largestFall.toFixed(3)),
    deltaByAgeBucket: toMeanMap(ageAcc), deltaByPositionalFamily: toMeanMap(famAcc),
    retiredThisSeason, enteredThisSeason,
  };
}

// ---------------------------------------------------------------------------
// The run loop -- drives the REAL processDay, one day at a time.
// ---------------------------------------------------------------------------

export interface SimulationResult {
  seed: string;
  humanClubId: string;
  seasons: number;
  checkpoints: Checkpoint[];
  seasonDeltas: SeasonDelta[];
  timings: { seasonsSimulated: number; msTotal: number; msPerSeason: number[] };
  paUtilisation: { reached50: number; reached75: number; reached90: number; stagnant: number; measured: number };
  blockers: string[];
}

const CHECKPOINT_SEASONS = [0, 1, 3, 5, 10, 15, 20];

/**
 * `daysPerSeason` exists so the DEFAULT test suite can assert the harness's
 * real invariants (canonical data untouched, CA/PA bounds, determinism)
 * against a short horizon in seconds instead of minutes, while the
 * `test:sim` suite runs the same assertions over full 365-day seasons. It
 * shortens the simulated window only -- it never changes any rule.
 */
export function runSimulation(
  seed: string,
  humanClubId: string,
  seasons: number,
  checkpointSeasons: number[] = CHECKPOINT_SEASONS,
  daysPerSeason = 365,
): SimulationResult {
  const t0 = Date.now();
  let state = createHarnessCareer(seed, humanClubId);
  const blockers: string[] = [];

  const startDate = state.processedThroughDate;
  const checkpoints: Checkpoint[] = [];
  const seasonDeltas: SeasonDelta[] = [];
  const msPerSeason: number[] = [];

  const rowsToMap = (rows: PlayerRow[]) => new Map(rows.map((r) => [r.playerId, r]));
  let previousRows = rowsToMap(collectPlayers(state, startDate));
  // Initial PA headroom, for the utilisation measurement at the end.
  const initialHeadroom = new Map<string, { ca0: number; headroom0: number }>();
  for (const [id, r] of previousRows) if (!r.retired) initialHeadroom.set(id, { ca0: r.ca, headroom0: r.pa - r.ca });

  if (checkpointSeasons.includes(0)) checkpoints.push(checkpoint(state, startDate, 0));

  let date = startDate;
  for (let season = 1; season <= seasons; season++) {
    const seasonStart = Date.now();
    // One season = 365 days advanced through the real daily tick.
    for (let day = 0; day < daysPerSeason; day++) {
      date = addDays(date, 1);
      try {
        state = processDay(state, date).state;
      } catch (error) {
        blockers.push(`season ${season} (${date}): ${error instanceof Error ? error.message : String(error)}`);
        return {
          seed, humanClubId, seasons: season - 1, checkpoints, seasonDeltas,
          timings: { seasonsSimulated: season - 1, msTotal: Date.now() - t0, msPerSeason },
          paUtilisation: { reached50: 0, reached75: 0, reached90: 0, stagnant: 0, measured: 0 },
          blockers,
        };
      }
    }
    msPerSeason.push(Date.now() - seasonStart);

    const currentRows = rowsToMap(collectPlayers(state, date));
    seasonDeltas.push(seasonDelta(season, previousRows, currentRows, humanClubId));
    previousRows = currentRows;
    if (checkpointSeasons.includes(season)) checkpoints.push(checkpoint(state, date, season));
  }

  // PA utilisation: how much of each player's ORIGINAL headroom was consumed.
  let reached50 = 0, reached75 = 0, reached90 = 0, stagnant = 0, measured = 0;
  for (const [id, start] of initialHeadroom) {
    if (start.headroom0 <= 0) continue;
    const now = previousRows.get(id);
    if (!now || now.retired) continue;
    measured++;
    const consumed = (now.ca - start.ca0) / start.headroom0;
    if (consumed >= 0.5) reached50++;
    if (consumed >= 0.75) reached75++;
    if (consumed >= 0.9) reached90++;
    if (consumed < 0.1) stagnant++;
  }

  return {
    seed, humanClubId, seasons, checkpoints, seasonDeltas,
    timings: { seasonsSimulated: seasons, msTotal: Date.now() - t0, msPerSeason },
    paUtilisation: { reached50, reached75, reached90, stagnant, measured },
    blockers,
  };
}

// ---------------------------------------------------------------------------
// Console report
// ---------------------------------------------------------------------------

function fmtDist(d: Distribution): string {
  return `n=${String(d.n).padStart(4)} min=${String(d.min).padStart(3)} p10=${String(d.p10).padStart(3)} p25=${String(d.p25).padStart(3)} med=${String(d.median).padStart(3)} mean=${d.mean.toFixed(1).padStart(6)} p75=${String(d.p75).padStart(3)} p90=${String(d.p90).padStart(3)} max=${String(d.max).padStart(3)}`;
}

export function printReport(result: SimulationResult): void {
  console.log(`\n=== LONG-CAREER SIMULATION -- seed "${result.seed}", club ${result.humanClubId}, ${result.timings.seasonsSimulated} seasons ===`);
  if (result.blockers.length) {
    console.log(`\n!! BLOCKERS (${result.blockers.length}):`);
    for (const b of result.blockers) console.log(`   ${b}`);
  }

  console.log(`\n--- POPULATION ---`);
  console.log(`  ${"Season".padEnd(8)}${"Date".padEnd(12)}${"active".padStart(7)}${"real".padStart(7)}${"gen".padStart(7)}${"retired".padStart(9)}${"FA".padStart(5)}${"avgAge".padStart(8)}`);
  for (const c of result.checkpoints) {
    console.log(`  ${String(c.season).padEnd(8)}${c.date.padEnd(12)}${String(c.totalActive).padStart(7)}${String(c.realPlayers).padStart(7)}${String(c.generatedPlayers).padStart(7)}${String(c.retired).padStart(9)}${String(c.freeAgents).padStart(5)}${c.averageAge.toFixed(1).padStart(8)}`);
  }

  console.log(`\n--- AGE DISTRIBUTION ---`);
  const ageKeys = AGE_BUCKETS.map(([l]) => l);
  console.log(`  ${"Season".padEnd(8)}${ageKeys.map((k) => k.padStart(8)).join("")}`);
  for (const c of result.checkpoints) {
    console.log(`  ${String(c.season).padEnd(8)}${ageKeys.map((k) => String(c.ageDistribution[k] ?? 0).padStart(8)).join("")}`);
  }

  console.log(`\n--- CA: WHOLE SWEDISH WORLD ---`);
  for (const c of result.checkpoints) console.log(`  S${String(c.season).padEnd(3)} ${fmtDist(c.caWorld)}`);

  for (const label of Object.values(COMPETITION_LABEL)) {
    console.log(`\n--- CA: ${label} ---`);
    for (const c of result.checkpoints) {
      const d = c.caByCompetition[label];
      if (d) console.log(`  S${String(c.season).padEnd(3)} ${fmtDist(d)}`);
    }
  }

  console.log(`\n--- ELITE SUPPLY ---`);
  console.log(`  ${"Season".padEnd(8)}${"top25mean".padStart(11)}${"CA>=150".padStart(9)}${"CA>=140".padStart(9)}${"CA>=130".padStart(9)}${"CA<100".padStart(8)}`);
  for (const c of result.checkpoints) {
    console.log(`  ${String(c.season).padEnd(8)}${c.top25MeanCA.toFixed(1).padStart(11)}${String(c.countCA150).padStart(9)}${String(c.countCA140).padStart(9)}${String(c.countCA130).padStart(9)}${String(c.countCAUnder100).padStart(8)}`);
  }

  console.log(`\n--- DEVELOPMENT VS DECLINE (per season) ---`);
  console.log(`  ${"S".padEnd(4)}${"humanUp".padStart(9)}${"humanDn".padStart(9)}${"humanFlat".padStart(11)}${"cpuUp".padStart(8)}${"cpuDn".padStart(8)}${"cpuFlat".padStart(9)}${"maxRise".padStart(9)}${"maxFall".padStart(9)}${"retired".padStart(9)}${"entered".padStart(9)}`);
  for (const d of result.seasonDeltas) {
    console.log(`  ${String(d.season).padEnd(4)}${String(d.humanRose).padStart(9)}${String(d.humanFell).padStart(9)}${String(d.humanFlat).padStart(11)}${String(d.cpuRose).padStart(8)}${String(d.cpuFell).padStart(8)}${String(d.cpuFlat).padStart(9)}${d.largestRise.toFixed(1).padStart(9)}${d.largestFall.toFixed(1).padStart(9)}${String(d.retiredThisSeason).padStart(9)}${String(d.enteredThisSeason).padStart(9)}`);
  }

  console.log(`\n--- MEAN CA DELTA BY AGE BUCKET (season 1) ---`);
  const first = result.seasonDeltas[0];
  if (first) for (const [k, v] of Object.entries(first.deltaByAgeBucket)) console.log(`  ${k.padEnd(8)} mean=${v.mean.toFixed(3).padStart(8)}  n=${v.n}`);

  console.log(`\n--- MEAN CA DELTA BY POSITIONAL FAMILY (season 1) ---`);
  if (first) for (const [k, v] of Object.entries(first.deltaByPositionalFamily)) console.log(`  ${k.padEnd(12)} mean=${v.mean.toFixed(3).padStart(8)}  n=${v.n}`);

  console.log(`\n--- PA UTILISATION (over the full run) ---`);
  const u = result.paUtilisation;
  const pct = (n: number) => (u.measured ? ((100 * n) / u.measured).toFixed(1) + "%" : "-");
  console.log(`  measured=${u.measured}  >=50% headroom: ${u.reached50} (${pct(u.reached50)})  >=75%: ${u.reached75} (${pct(u.reached75)})  >=90%: ${u.reached90} (${pct(u.reached90)})  stagnant(<10%): ${u.stagnant} (${pct(u.stagnant)})`);

  console.log(`\n--- PA HEADROOM BY AGE ---`);
  for (const c of result.checkpoints) {
    console.log(`  S${String(c.season).padEnd(3)} ${Object.entries(c.paHeadroomByAge).map(([k, v]) => `${k}=${v.toFixed(1)}`).join("  ")}`);
  }

  console.log(`\n--- ATTRIBUTE HEALTH ---`);
  console.log(`  ${"Season".padEnd(8)}${"attrPoints".padStart(12)}${"atMin".padStart(8)}${"atMax".padStart(8)}`);
  for (const c of result.checkpoints) {
    console.log(`  ${String(c.season).padEnd(8)}${String(c.attributePointsTotal).padStart(12)}${String(c.attributesAtMin).padStart(8)}${String(c.attributesAtMax).padStart(8)}`);
  }
  console.log(`\n  Family means (outcourt) by checkpoint:`);
  const famKeys = Object.keys(result.checkpoints[0]?.familyMeans ?? {}).filter((k) => !k.startsWith("GK."));
  console.log(`  ${"Season".padEnd(8)}${famKeys.map((k) => k.slice(0, 10).padStart(12)).join("")}`);
  for (const c of result.checkpoints) {
    console.log(`  ${String(c.season).padEnd(8)}${famKeys.map((k) => (c.familyMeans[k] ?? 0).toFixed(1).padStart(12)).join("")}`);
  }

  console.log(`\n--- PERFORMANCE / STATE SIZE ---`);
  console.log(`  total ${(result.timings.msTotal / 1000).toFixed(1)}s for ${result.timings.seasonsSimulated} seasons`);
  const ms = result.timings.msPerSeason;
  if (ms.length) {
    console.log(`  season 1: ${(ms[0] / 1000).toFixed(1)}s   first 5: ${(ms.slice(0, 5).reduce((a, b) => a + b, 0) / 1000).toFixed(1)}s   all: ${(ms.reduce((a, b) => a + b, 0) / 1000).toFixed(1)}s`);
  }
  for (const c of result.checkpoints) {
    console.log(`  S${String(c.season).padEnd(3)} state ${(c.stateSizeBytes / 1024 / 1024).toFixed(2)} MB`);
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

if (require.main === module) {
  const seasons = Number(arg("seasons", "20"));
  const seed = arg("seed", "phase0-baseline");
  const club = arg("club", "se_club_hammarby_if_hf");
  const outDir = arg("out", "");

  const result = runSimulation(seed, club, seasons);
  printReport(result);

  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, `simulation-${seed}-${seasons}s.json`);
    fs.writeFileSync(file, JSON.stringify(result, null, 2), "utf8");
    console.log(`\nmachine-readable metrics: ${file}`);
  }
}
