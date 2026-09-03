// HM-PLAYER-DEVELOPMENT-2.0 PHASE 0.5: retirement decision audit.
//
// Phase 0 measured ZERO retirements across 20 simulated seasons against a
// non-zero expected count. This script determines whether that is calibration,
// a deterministic-roll defect, a lifecycle-execution defect, an eligibility
// defect, or a contract interaction -- by observing the REAL lifecycle path
// through the REAL daily career simulation (playerLifecycle.ts's opt-in
// RetirementDecisionTrace sink), never by re-deriving the formula here.
//
// Read-only: touches no canonical data and writes only to --out.
//
// Usage: npx tsx scripts/audit-retirement-decisions.ts [--seasons 5] [--seed s] [--out dir]
import * as fs from "node:fs";
import * as path from "node:path";
import { createHarnessCareer } from "./simulate-player-development";
import { processDay } from "../lib/career/dailyTick";
import { addDays } from "../lib/career/dateUtils";
import { setRetirementTraceSink, retirementRoll, RETIRED_CLUB_ID, type RetirementDecisionTrace } from "../lib/career/playerLifecycle";
import { careerWorldClubIds } from "../lib/career/worldCompetitions";
import { getPlayerContractStatus } from "../lib/economy/contractIntegration";
import { playerAgeAtDate } from "../lib/development/developmentIntegration";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const seasons = Number(arg("seasons", "5"));
const seed = arg("seed", "retirement-audit");
const club = arg("club", "se_club_hammarby_if_hf");
const outDir = arg("out", "");

// ---------------------------------------------------------------------------
// PART 1 -- trace every retirement decision through the real daily simulation
// ---------------------------------------------------------------------------

const traces: RetirementDecisionTrace[] = [];
setRetirementTraceSink((t) => traces.push(t));

let state = createHarnessCareer(seed, club);
let date = state.processedThroughDate;
const perSeason: { season: number; date: string; evaluated: number; expected: number; rollPassed: number; executed: number; blocked: number; retiredSquad: number }[] = [];
const contractSnapshots: { season: number; eligible: number; underContract: number; expiring: number; freeAgent: number; byAge: Record<string, { n: number; underContract: number }> }[] = [];

for (let season = 1; season <= seasons; season++) {
  const before = traces.length;
  for (let day = 0; day < 365; day++) {
    date = addDays(date, 1);
    // Snapshot contract situation of the age-eligible cohort the day before evaluation.
    if (date.slice(5, 10) === "06-14") {
      let eligible = 0, underContract = 0, expiring = 0, freeAgent = 0;
      const byAge: Record<string, { n: number; underContract: number }> = {};
      for (const clubId of careerWorldClubIds(state)) {
        for (const p of state.worldSquads[clubId] ?? []) {
          const age = playerAgeAtDate(p.dateOfBirth, p.birthYear, addDays(date, 1));
          if (age === null || age < 28) continue;
          eligible++;
          const status = getPlayerContractStatus(state, p.id);
          if (status === "FREE_AGENT") freeAgent++;
          else if (status === "EXPIRING" || status === "EXPIRING_SOON") expiring++;
          else underContract++;
          const bucket = age >= 38 ? "38+" : age >= 36 ? "36-37" : age >= 34 ? "34-35" : age >= 32 ? "32-33" : "28-31";
          byAge[bucket] = byAge[bucket] ?? { n: 0, underContract: 0 };
          byAge[bucket].n++;
          if (status !== "FREE_AGENT" && status !== "EXPIRING" && status !== "EXPIRING_SOON") byAge[bucket].underContract++;
        }
      }
      contractSnapshots.push({ season, eligible, underContract, expiring, freeAgent, byAge });
    }
    state = processDay(state, date).state;
  }
  const seasonTraces = traces.slice(before);
  perSeason.push({
    season, date,
    evaluated: seasonTraces.length,
    expected: seasonTraces.reduce((a, t) => a + t.probability, 0),
    rollPassed: seasonTraces.filter((t) => t.rollPassed).length,
    executed: seasonTraces.filter((t) => t.executed).length,
    blocked: seasonTraces.filter((t) => t.rollPassed && !t.executed).length,
    retiredSquad: (state.worldSquads[RETIRED_CLUB_ID] ?? []).length,
  });
}
setRetirementTraceSink(null);

console.log(`\n=== PART 1: RETIREMENT DECISIONS THROUGH THE REAL DAILY SIMULATION ===`);
console.log(`seed "${seed}", club ${club}, ${seasons} seasons, ${traces.length} decisions traced\n`);
console.log(`  ${"S".padEnd(4)}${"evaluated".padStart(11)}${"expected".padStart(10)}${"rollPassed".padStart(12)}${"executed".padStart(10)}${"blocked".padStart(9)}${"retiredSquad".padStart(14)}`);
for (const r of perSeason) {
  console.log(`  ${String(r.season).padEnd(4)}${String(r.evaluated).padStart(11)}${r.expected.toFixed(2).padStart(10)}${String(r.rollPassed).padStart(12)}${String(r.executed).padStart(10)}${String(r.blocked).padStart(9)}${String(r.retiredSquad).padStart(14)}`);
}

const blocked = traces.filter((t) => t.rollPassed && !t.executed);
if (blocked.length) {
  console.log(`\n  !! ${blocked.length} decisions passed the roll but did NOT execute. Reasons:`);
  const byReason: Record<string, number> = {};
  for (const b of blocked) byReason[b.blockedReason ?? "?"] = (byReason[b.blockedReason ?? "?"] ?? 0) + 1;
  for (const [reason, n] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) console.log(`     ${n.toString().padStart(5)}  ${reason}`);
  console.log(`\n  sample blocked decisions:`);
  for (const b of blocked.slice(0, 5)) {
    console.log(`     ${b.playerId} age=${b.age} club=${b.clubId} status=${b.contractStatus} p=${b.probability.toFixed(4)} roll=${b.roll.toFixed(4)} -> ${b.blockedReason}`);
  }
}

const passedAndRan = traces.filter((t) => t.rollPassed && t.executed);
console.log(`\n  sample decisions that DID execute: ${passedAndRan.length}`);
for (const t of passedAndRan.slice(0, 5)) {
  console.log(`     ${t.playerId} age=${t.age} status=${t.contractStatus} base=${t.baseProbability.toFixed(3)} tier=${t.tierMultiplier} contract=${t.contractMultiplier} p=${t.probability.toFixed(4)} roll=${t.roll.toFixed(4)}`);
}

// ---------------------------------------------------------------------------
// PART 2 -- deterministic roll distribution over the REAL key namespace
// ---------------------------------------------------------------------------

console.log(`\n=== PART 2: DETERMINISTIC ROLL DISTRIBUTION (real retirement keys) ===`);
const rollsObserved = traces.map((t) => t.roll);
// Plus a wider synthetic sweep over the SAME key shape, to separate "few keys"
// from "biased namespace".
const sweep: number[] = [];
const allPlayerIds = [...new Set(traces.map((t) => t.playerId))];
for (const pid of allPlayerIds) for (let y = 2027; y <= 2047; y++) sweep.push(retirementRoll(pid, String(y)));

function stats(label: string, xs: number[]): void {
  if (xs.length === 0) { console.log(`  ${label}: (none)`); return; }
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  console.log(`  ${label}  n=${s.length}`);
  console.log(`    min=${s[0].toFixed(5)} p10=${q(0.1).toFixed(4)} p25=${q(0.25).toFixed(4)} med=${q(0.5).toFixed(4)} mean=${mean.toFixed(4)} p75=${q(0.75).toFixed(4)} p90=${q(0.9).toFixed(4)} max=${s[s.length - 1].toFixed(5)}`);
  for (const t of [0.01, 0.02, 0.05, 0.1, 0.25]) {
    const n = s.filter((v) => v < t).length;
    console.log(`    below ${t.toFixed(2)}: ${String(n).padStart(6)}  (${((100 * n) / s.length).toFixed(2)}%  -- uniform would be ${(100 * t).toFixed(0)}%)`);
  }
}
stats("observed rolls (decisions actually taken)", rollsObserved);
stats("synthetic sweep over playerId x 2027-2047", sweep);

// ---------------------------------------------------------------------------
// PART 3 -- expected vs actual
// ---------------------------------------------------------------------------

console.log(`\n=== PART 3: EXPECTED VS ACTUAL RETIREMENTS ===`);
let cumExpected = 0, cumExecuted = 0, cumPassed = 0;
console.log(`  ${"S".padEnd(4)}${"expected".padStart(10)}${"cumExpected".padStart(13)}${"rollPassed".padStart(12)}${"executed".padStart(10)}${"cumExecuted".padStart(13)}`);
for (const r of perSeason) {
  cumExpected += r.expected; cumExecuted += r.executed; cumPassed += r.rollPassed;
  console.log(`  ${String(r.season).padEnd(4)}${r.expected.toFixed(2).padStart(10)}${cumExpected.toFixed(2).padStart(13)}${String(r.rollPassed).padStart(12)}${String(r.executed).padStart(10)}${String(cumExecuted).padStart(13)}`);
}
console.log(`\n  cumulative expected=${cumExpected.toFixed(2)}  rollPassed=${cumPassed}  actually executed=${cumExecuted}`);

// ---------------------------------------------------------------------------
// PART 4 -- contract interaction
// ---------------------------------------------------------------------------

console.log(`\n=== PART 4: CONTRACT INTERACTION ===`);
console.log(`  ${"S".padEnd(4)}${"eligible".padStart(10)}${"underContract".padStart(15)}${"expiring".padStart(10)}${"freeAgent".padStart(11)}${"%underContract".padStart(16)}`);
for (const c of contractSnapshots) {
  const pct = c.eligible ? ((100 * c.underContract) / c.eligible).toFixed(1) + "%" : "-";
  console.log(`  ${String(c.season).padEnd(4)}${String(c.eligible).padStart(10)}${String(c.underContract).padStart(15)}${String(c.expiring).padStart(10)}${String(c.freeAgent).padStart(11)}${pct.padStart(16)}`);
}
const lastSnap = contractSnapshots[contractSnapshots.length - 1];
if (lastSnap) {
  console.log(`\n  under-contract rate by age (final season):`);
  for (const [bucket, v] of Object.entries(lastSnap.byAge).sort()) {
    console.log(`    ${bucket.padEnd(8)} n=${String(v.n).padStart(5)}  underContract=${String(v.underContract).padStart(5)}  (${((100 * v.underContract) / v.n).toFixed(1)}%)`);
  }
}
// Counterfactual: what would expected retirements be if nobody were under contract?
const counterfactual = traces.reduce((acc, t) => {
  const withoutContractPenalty = t.contractMultiplier > 0 ? t.probability / t.contractMultiplier : t.probability;
  return acc + Math.min(0.98, withoutContractPenalty);
}, 0);
console.log(`\n  expected retirements WITH contract multiplier:    ${traces.reduce((a, t) => a + t.probability, 0).toFixed(2)}`);
console.log(`  expected retirements WITHOUT contract multiplier: ${counterfactual.toFixed(2)}`);

if (outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `retirement-audit-${seed}-${seasons}s.json`);
  fs.writeFileSync(file, JSON.stringify({ perSeason, contractSnapshots, traces }, null, 2), "utf8");
  console.log(`\nmachine-readable trace: ${file}`);
}
