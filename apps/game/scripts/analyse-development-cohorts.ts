// HM-PLAYER-DEVELOPMENT-2.0 PHASE 1B CALIBRATION PASS 2.
//
// Two measurements the aggregate harness cannot express:
//
//  1. PROSPECT COHORTS. The aggregate "% who consumed >=50% of headroom" mixes
//     38-year-olds with 17-year-olds and is dominated by whoever happens to be
//     measurable at the end. Cohorts are fixed at season 0 and followed by AGE,
//     which is the question actually being asked: of the prospects who started
//     with real room to grow, how far had they travelled by 21 / 23 / 24?
//
//  2. LEAGUE QUALITY DECOMPOSITION. A competition's mean CA can move because
//     its players developed, declined, retired, transferred, or were replaced
//     by youth intake. Attributing a league shift to "development" without
//     separating those is how a development formula ends up compensating for a
//     transfer or squad-building defect.
//
// Read-only. Writes only to --out.
import * as fs from "node:fs";
import * as path from "node:path";
import { createHarnessCareer, collectPlayers, type PlayerRow } from "./simulate-player-development";
import { processDay } from "../lib/career/dailyTick";
import { addDays } from "../lib/career/dateUtils";
import { SWEDISH_WORLD_COMPETITION_IDS } from "../lib/career/worldCompetitions";
import { RETIRED_CLUB_ID } from "../lib/career/playerLifecycle";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const seasons = Number(arg("seasons", "5"));
const seed = arg("seed", "phase0-baseline");
const club = arg("club", "se_club_hammarby_if_hf");
const outDir = arg("out", "");

const LABEL: Record<string, string> = {
  se_handbollsligan_herr: "Handbollsligan",
  "swe-2": "Herrallsvenskan",
  se_division1_norra: "Division 1 Norra",
  se_division1_sodra: "Division 1 Sodra",
};

// ---------------------------------------------------------------------------
// Cohorts, fixed at season 0
// ---------------------------------------------------------------------------

interface CohortMember {
  playerId: string;
  cohort: "A" | "B";
  age0: number;
  ca0: number;
  pa0: number;
  headroom0: number;
  competition0: string;
  /** Headroom fraction consumed, sampled the first time the player is seen at each age. */
  atAge: Record<number, number>;
  retiredAtAge: number | null;
}

const MIN_HEADROOM = 20;
const SAMPLE_AGES = [21, 23, 24];

function classify(consumed: number): string {
  if (consumed < 0.1) return "stalled";
  if (consumed < 0.25) return "slow";
  if (consumed < 0.5) return "normal";
  if (consumed < 0.75) return "strong";
  return "near-ceiling";
}

function band(consumed: number): string {
  if (consumed < 0.1) return "<10%";
  if (consumed < 0.25) return "10-25%";
  if (consumed < 0.5) return "25-50%";
  if (consumed < 0.75) return "50-75%";
  if (consumed < 0.9) return "75-90%";
  return ">=90%";
}

// ---------------------------------------------------------------------------
// League decomposition, accumulated season by season
// ---------------------------------------------------------------------------

interface LeagueSeason {
  competition: string;
  season: number;
  squad: number;
  meanAge: number;
  meanCA: number;
  meanPA: number;
  meanHeadroom: number;
  /** Sum of CA gained by players who stayed in this competition. */
  developmentGained: number;
  /** Sum of CA lost by players who stayed (decline). */
  declineLost: number;
  retiredCount: number;
  retiredCA: number;
  arrivedCount: number;
  arrivedCA: number;
  departedCount: number;
  departedCA: number;
  youthCount: number;
  youthCA: number;
}

function mean(xs: number[]): number {
  return xs.length ? Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2)) : 0;
}

function isYouth(id: string): boolean {
  return id.startsWith("youth-");
}

// ---------------------------------------------------------------------------

let state = createHarnessCareer(seed, club);
let date = state.processedThroughDate;

const season0 = collectPlayers(state, date).filter((r) => !r.retired);
const cohorts = new Map<string, CohortMember>();
for (const r of season0) {
  if (r.age === null || r.competitionId === null) continue;
  const headroom = r.pa - r.ca;
  if (headroom < MIN_HEADROOM) continue;
  const cohort = r.age >= 16 && r.age <= 18 ? "A" : r.age >= 19 && r.age <= 20 ? "B" : null;
  if (!cohort) continue;
  cohorts.set(r.playerId, {
    playerId: r.playerId, cohort, age0: r.age, ca0: r.ca, pa0: r.pa, headroom0: headroom,
    competition0: r.competitionId, atAge: {}, retiredAtAge: null,
  });
}

const leagueSeasons: LeagueSeason[] = [];
let previous = new Map(season0.map((r) => [r.playerId, r]));

for (let season = 1; season <= seasons; season++) {
  for (let day = 0; day < 365; day++) {
    date = addDays(date, 1);
    state = processDay(state, date).state;
  }
  const rows = collectPlayers(state, date);
  const current = new Map(rows.map((r) => [r.playerId, r]));
  const active = rows.filter((r) => !r.retired);

  // --- cohort sampling ---
  for (const [id, m] of cohorts) {
    const now = current.get(id);
    if (!now) continue;
    if (now.retired) { if (m.retiredAtAge === null) m.retiredAtAge = now.age ?? null; continue; }
    if (now.age === null) continue;
    for (const target of SAMPLE_AGES) {
      if (now.age >= target && m.atAge[target] === undefined) {
        m.atAge[target] = m.headroom0 > 0 ? (now.ca - m.ca0) / m.headroom0 : 0;
      }
    }
  }

  // --- league decomposition ---
  for (const competitionId of SWEDISH_WORLD_COMPETITION_IDS) {
    const inLeagueNow = active.filter((r) => r.competitionId === competitionId);
    const wasInLeague = [...previous.values()].filter((r) => !r.retired && r.competitionId === competitionId);
    const nowById = new Map(inLeagueNow.map((r) => [r.playerId, r]));

    let developmentGained = 0, declineLost = 0;
    let retiredCount = 0, retiredCA = 0, departedCount = 0, departedCA = 0;
    for (const before of wasInLeague) {
      const now = current.get(before.playerId);
      if (!now || now.clubId === RETIRED_CLUB_ID) { retiredCount++; retiredCA += before.ca; continue; }
      if (now.competitionId !== competitionId) { departedCount++; departedCA += before.ca; continue; }
      const delta = now.ca - before.ca;
      if (delta > 0) developmentGained += delta; else declineLost += -delta;
    }
    const wasIds = new Set(wasInLeague.map((r) => r.playerId));
    let arrivedCount = 0, arrivedCA = 0, youthCount = 0, youthCA = 0;
    for (const r of inLeagueNow) {
      if (wasIds.has(r.playerId)) continue;
      if (isYouth(r.playerId) && !previous.has(r.playerId)) { youthCount++; youthCA += r.ca; }
      else { arrivedCount++; arrivedCA += r.ca; }
    }

    leagueSeasons.push({
      competition: LABEL[competitionId], season,
      squad: inLeagueNow.length,
      meanAge: mean(inLeagueNow.map((r) => r.age ?? 0)),
      meanCA: mean(inLeagueNow.map((r) => r.ca)),
      meanPA: mean(inLeagueNow.map((r) => r.pa)),
      meanHeadroom: mean(inLeagueNow.map((r) => r.pa - r.ca)),
      developmentGained: Number(developmentGained.toFixed(1)),
      declineLost: Number(declineLost.toFixed(1)),
      retiredCount, retiredCA: Number(retiredCA.toFixed(0)),
      arrivedCount, arrivedCA: Number(arrivedCA.toFixed(0)),
      departedCount, departedCA: Number(departedCA.toFixed(0)),
      youthCount, youthCA: Number(youthCA.toFixed(0)),
    });
  }
  previous = current as Map<string, PlayerRow>;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log(`\n=== PROSPECT COHORTS (fixed at season 0, headroom >= ${MIN_HEADROOM}) ===`);
for (const c of ["A", "B"] as const) {
  const members = [...cohorts.values()].filter((m) => m.cohort === c);
  const ageRange = c === "A" ? "16-18" : "19-20";
  console.log(`\nCohort ${c} -- age ${ageRange} at S0, n=${members.length}`);
  console.log(`  mean CA0=${mean(members.map((m) => m.ca0))}  mean PA0=${mean(members.map((m) => m.pa0))}  mean headroom0=${mean(members.map((m) => m.headroom0))}`);
  for (const target of SAMPLE_AGES) {
    const sampled = members.filter((m) => m.atAge[target] !== undefined).map((m) => m.atAge[target]);
    if (sampled.length === 0) { console.log(`  by age ${target}: (not reached in ${seasons} seasons)`); continue; }
    const bands: Record<string, number> = { "<10%": 0, "10-25%": 0, "25-50%": 0, "50-75%": 0, "75-90%": 0, ">=90%": 0 };
    const classes: Record<string, number> = { stalled: 0, slow: 0, normal: 0, strong: 0, "near-ceiling": 0 };
    for (const v of sampled) { bands[band(v)]++; classes[classify(v)]++; }
    const pct = (n: number) => ((100 * n) / sampled.length).toFixed(1).padStart(5) + "%";
    console.log(`  by age ${target}: n=${sampled.length}  mean consumed=${(100 * mean(sampled)).toFixed(1)}%`);
    console.log(`     bands  ` + Object.entries(bands).map(([k, v]) => `${k}:${pct(v)}`).join("  "));
    console.log(`     class  ` + Object.entries(classes).map(([k, v]) => `${k}:${pct(v)}`).join("  "));
    console.log(`     >=50% of headroom: ${(100 * sampled.filter((v) => v >= 0.5).length / sampled.length).toFixed(1)}%   (diagnostic target ~25%)`);
  }
  const retired = members.filter((m) => m.retiredAtAge !== null).length;
  if (retired) console.log(`  retired before final sample: ${retired}`);
}

console.log(`\n=== LEAGUE QUALITY DECOMPOSITION ===`);
for (const label of Object.values(LABEL)) {
  const rows = leagueSeasons.filter((r) => r.competition === label);
  console.log(`\n--- ${label} ---`);
  console.log(`  S  squad  age   meanCA  meanPA  head |  devGain  declLoss | retN  retCA | inN   inCA | outN  outCA | youthN youthCA`);
  for (const r of rows) {
    console.log(
      `  ${String(r.season).padEnd(2)} ${String(r.squad).padStart(5)} ${r.meanAge.toFixed(1).padStart(5)} ${r.meanCA.toFixed(1).padStart(7)} ${r.meanPA.toFixed(1).padStart(7)} ${r.meanHeadroom.toFixed(1).padStart(5)} |` +
      ` ${r.developmentGained.toFixed(0).padStart(8)} ${r.declineLost.toFixed(0).padStart(9)} |` +
      ` ${String(r.retiredCount).padStart(4)} ${String(r.retiredCA).padStart(6)} |` +
      ` ${String(r.arrivedCount).padStart(3)} ${String(r.arrivedCA).padStart(6)} |` +
      ` ${String(r.departedCount).padStart(4)} ${String(r.departedCA).padStart(6)} |` +
      ` ${String(r.youthCount).padStart(6)} ${String(r.youthCA).padStart(7)}`,
    );
  }
}

if (outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `cohorts-${seed}-${seasons}s.json`);
  fs.writeFileSync(file, JSON.stringify({ cohorts: [...cohorts.values()], leagueSeasons }, null, 2), "utf8");
  console.log(`\nmachine-readable: ${file}`);
}
