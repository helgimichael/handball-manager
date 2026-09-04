// HM-PLAYER-DEVELOPMENT-2.0 PHASE 1B.2: world population lifecycle audit.
//
// Read-only. Answers why the corrected world grows 1100 -> ~1979 active players
// over 20 seasons with ~692 of them unemployed, BEFORE any population parameter
// is changed.
//
// Architecture the ledger relies on (verified by grep, not assumed):
//   CREATE  -- exactly one path: youthIntake.ts
//   MOVE    -- exactly one primitive: transferPlayerPermanently, with four call
//              sites: contractExpiry -> FREE_AGENT, playerLifecycle -> RETIRED,
//              and two in transferIntegration (club <-> club, incl. FA signings)
//   REMOVE  -- retirement is the ONLY permanent exit
// So the identity activeStart + entrants - permanentExits = activeEnd must hold
// exactly; any drift is a bug in this script or a fifth path nobody knows about.
//
// Everything is derived by DIFFING career state between season boundaries, so no
// production hook is needed and no production behaviour is touched.
import * as fs from "node:fs";
import * as path from "node:path";
import { createHarnessCareer } from "./simulate-player-development";
import { processDay } from "../lib/career/dailyTick";
import { addDays } from "../lib/career/dateUtils";
import { RETIRED_CLUB_ID, progressPlayerLifecycle } from "../lib/career/playerLifecycle";
import { FREE_AGENT_CLUB_ID } from "../lib/career/contractExpiry";
import { careerWorldClubIds, SWEDISH_WORLD_COMPETITION_IDS } from "../lib/career/worldCompetitions";
import { getClub, getClubsByCompetition } from "../lib/game-data";
import { playerAgeAtDate } from "../lib/development/developmentIntegration";
import type { CareerState } from "../lib/career/types";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const seasons = Number(arg("seasons", "20"));
const seed = arg("seed", "phase0-baseline");
const club = arg("club", "se_club_hammarby_if_hf");
const outDir = arg("out", "");

const LABEL: Record<string, string> = {
  se_handbollsligan_herr: "Handbollsligan",
  "swe-2": "Herrallsvenskan",
  se_division1_norra: "Division 1 Norra",
  se_division1_sodra: "Division 1 Sodra",
};

interface Snap {
  clubId: string;
  age: number | null;
  ca: number;
  pa: number;
  position: string;
  generated: boolean;
}

/** Every player the world knows about, keyed by id, including FA and retired. */
function snapshot(state: CareerState, date: string): Map<string, Snap> {
  const out = new Map<string, Snap>();
  for (const [clubId, squad] of Object.entries(state.worldSquads)) {
    const ratings = new Map((state.gameplayRatings[clubId] ?? []).map((r) => [r.playerId, r]));
    for (const p of squad) {
      const r = ratings.get(p.id);
      out.set(p.id, {
        clubId,
        age: playerAgeAtDate(p.dateOfBirth, p.birthYear, date),
        ca: r?.ca ?? NaN,
        pa: r?.pa ?? NaN,
        position: p.position,
        generated: p.id.startsWith("youth-"),
      });
    }
  }
  return out;
}

const isFA = (clubId: string) => clubId === FREE_AGENT_CLUB_ID;
const isRet = (clubId: string) => clubId === RETIRED_CLUB_ID;
const isClub = (clubId: string) => !isFA(clubId) && !isRet(clubId);

interface SeasonLedger {
  season: number;
  activeStart: number;
  entrants: number;
  permanentExits: number;
  activeEnd: number;
  reconciles: boolean;
  contracted: number;
  freeAgents: number;
  retiredCumulative: number;
  real: number;
  generated: number;
  // FA pipeline
  faStart: number;
  faEntered: number;
  faSigned: number;
  faRetired: number;
  faEnd: number;
  // retirement split
  retiredFromClub: number;
  retiredFromFA: number;
  careerExits: number;
}

let state = createHarnessCareer(seed, club);
let date = state.processedThroughDate;
let prev = snapshot(state, date);

/** playerId -> season they entered free agency (most recent spell). */
const faSince = new Map<string, number>();
/** playerId -> intake season, for cohort tracking. */
const youthCohort = new Map<string, number>();
const ledger: SeasonLedger[] = [];
const faDurationsOnExit: { playerId: string; seasons: number; exit: "SIGNED" | "RETIRED" }[] = [];

for (let season = 1; season <= seasons; season++) {
  const activeStart = [...prev.values()].filter((s) => isClub(s.clubId) || isFA(s.clubId)).length;
  const faStart = [...prev.values()].filter((s) => isFA(s.clubId)).length;

  let careerExitsThisSeason = 0;
  for (let day = 0; day < 365; day++) {
    date = addDays(date, 1);
    if (date.slice(5, 10) === "06-15") {
      // Observe the lifecycle's own split BEFORE the tick applies it, so exits
      // can be attributed to reason without persisting anything.
      // Read-only dry run of the same pass the tick is about to perform, purely
      // to read its exit SPLIT. The result is discarded; processDay below does
      // the real work.
      careerExitsThisSeason = progressPlayerLifecycle(state, date).careerExitPlayerIds.length;
    }
    state = processDay(state, date).state;
  }
  const cur = snapshot(state, date);

  let entrants = 0, permanentExits = 0, faEntered = 0, faSigned = 0, faRetired = 0;
  let retiredFromClub = 0, retiredFromFA = 0;

  for (const [id, now] of cur) {
    const before = prev.get(id);
    if (!before) {
      entrants++;
      if (now.generated) youthCohort.set(id, season);
      if (isFA(now.clubId)) faSince.set(id, season);
      continue;
    }
    const wasActive = isClub(before.clubId) || isFA(before.clubId);
    const nowActive = isClub(now.clubId) || isFA(now.clubId);
    if (wasActive && !nowActive) {
      permanentExits++;
      if (isFA(before.clubId)) { retiredFromFA++; faRetired++; const s = faSince.get(id); if (s !== undefined) faDurationsOnExit.push({ playerId: id, seasons: season - s, exit: "RETIRED" }); }
      else retiredFromClub++;
      faSince.delete(id);
      continue;
    }
    if (!isFA(before.clubId) && isFA(now.clubId)) { faEntered++; faSince.set(id, season); }
    if (isFA(before.clubId) && isClub(now.clubId)) {
      faSigned++;
      const s = faSince.get(id);
      if (s !== undefined) faDurationsOnExit.push({ playerId: id, seasons: season - s, exit: "SIGNED" });
      faSince.delete(id);
    }
  }

  const activeEnd = [...cur.values()].filter((s) => isClub(s.clubId) || isFA(s.clubId)).length;
  ledger.push({
    season, activeStart, entrants, permanentExits, activeEnd,
    reconciles: activeStart + entrants - permanentExits === activeEnd,
    contracted: [...cur.values()].filter((s) => isClub(s.clubId)).length,
    freeAgents: [...cur.values()].filter((s) => isFA(s.clubId)).length,
    retiredCumulative: [...cur.values()].filter((s) => isRet(s.clubId)).length,
    real: [...cur.values()].filter((s) => !s.generated && !isRet(s.clubId)).length,
    generated: [...cur.values()].filter((s) => s.generated && !isRet(s.clubId)).length,
    faStart, faEntered, faSigned, faRetired,
    faEnd: [...cur.values()].filter((s) => isFA(s.clubId)).length,
    retiredFromClub, retiredFromFA, careerExits: careerExitsThisSeason,
  });
  prev = cur;
}

const final = prev;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))] : 0; };

// ---------------------------------------------------------------------------

console.log(`\n=== 1. POPULATION LEDGER (seed "${seed}", ${seasons} seasons) ===`);
console.log(`  S  activeStart  entrants  exits  activeEnd  OK | contracted   FA  retired |  real   gen`);
for (const l of ledger) {
  console.log(
    `  ${String(l.season).padEnd(2)} ${String(l.activeStart).padStart(11)} ${String(l.entrants).padStart(9)} ${String(l.permanentExits).padStart(6)} ${String(l.activeEnd).padStart(10)}  ${l.reconciles ? "y" : "N!"} |` +
    ` ${String(l.contracted).padStart(10)} ${String(l.freeAgents).padStart(4)} ${String(l.retiredCumulative).padStart(8)} | ${String(l.real).padStart(5)} ${String(l.generated).padStart(5)}`,
  );
}
const broken = ledger.filter((l) => !l.reconciles);
console.log(`\n  identity activeStart + entrants - exits = activeEnd holds in ${ledger.length - broken.length}/${ledger.length} seasons`);
if (broken.length) console.log(`  !! seasons that do NOT reconcile: ${broken.map((b) => b.season).join(", ")}`);

console.log(`\n=== 2. FREE-AGENT PIPELINE ===`);
console.log(`  S   faStart  entered  signed  retired  careerExit  faEnd  |  net`);
for (const l of ledger) {
  console.log(`  ${String(l.season).padEnd(2)} ${String(l.faStart).padStart(8)} ${String(l.faEntered).padStart(8)} ${String(l.faSigned).padStart(7)} ${String(l.faRetired).padStart(8)} ${String(l.careerExits).padStart(11)} ${String(l.faEnd).padStart(6)}  | ${String(l.faEnd - l.faStart).padStart(4)}`);
}
const totalEntered = ledger.reduce((a, l) => a + l.faEntered, 0);
const totalSigned = ledger.reduce((a, l) => a + l.faSigned, 0);
const totalFaRetired = ledger.reduce((a, l) => a + l.faRetired, 0);
console.log(`\n  cumulative: entered=${totalEntered}  signed=${totalSigned} (${((100 * totalSigned) / Math.max(1, totalEntered)).toFixed(1)}% absorbed)  retiredFromFA=${totalFaRetired}`);
console.log(`  retirement split: fromClub=${ledger.reduce((a, l) => a + l.retiredFromClub, 0)}  fromFA=${ledger.reduce((a, l) => a + l.retiredFromFA, 0)}`);

console.log(`\n=== 3. UNEMPLOYMENT DURATION ===`);
const currentFa = [...final.entries()].filter(([, s]) => isFA(s.clubId));
const buckets: Record<string, number> = { "<1": 0, "1": 0, "2": 0, "3": 0, "4-5": 0, "6+": 0 };
for (const [id] of currentFa) {
  const since = faSince.get(id);
  const d = since === undefined ? 0 : seasons - since;
  const k = d < 1 ? "<1" : d === 1 ? "1" : d === 2 ? "2" : d === 3 ? "3" : d <= 5 ? "4-5" : "6+";
  buckets[k]++;
}
console.log(`  still unemployed at S${seasons} (n=${currentFa.length}):`);
for (const [k, v] of Object.entries(buckets)) console.log(`    ${k.padEnd(4)} seasons: ${String(v).padStart(4)}  (${((100 * v) / Math.max(1, currentFa.length)).toFixed(1)}%)`);
const signedDur = faDurationsOnExit.filter((d) => d.exit === "SIGNED").map((d) => d.seasons);
console.log(`  of those who DID leave FA: signed after mean ${mean(signedDur).toFixed(2)} / median ${med(signedDur)} seasons (n=${signedDur.length})`);

console.log(`\n=== 4. FREE-AGENT QUALITY at S${seasons} ===`);
const faAges = currentFa.map(([, s]) => s.age ?? 0).filter((a) => a > 0);
const faCA = currentFa.map(([, s]) => s.ca).filter((c) => !Number.isNaN(c));
const faPA = currentFa.map(([, s]) => s.pa).filter((c) => !Number.isNaN(c));
console.log(`  n=${currentFa.length}  age mean=${mean(faAges).toFixed(1)} median=${med(faAges)}  CA mean=${mean(faCA).toFixed(1)} median=${med(faCA)}`);
console.log(`  CA p10=${q(faCA, 0.1).toFixed(0)} p25=${q(faCA, 0.25).toFixed(0)} p75=${q(faCA, 0.75).toFixed(0)} p90=${q(faCA, 0.9).toFixed(0)}   PA mean=${mean(faPA).toFixed(1)}  headroom mean=${mean(currentFa.map(([, s]) => s.pa - s.ca)).toFixed(1)}`);
const faUnder28 = currentFa.filter(([, s]) => (s.age ?? 99) < 28).length;
console.log(`  aged UNDER 28 (never evaluated for retirement): ${faUnder28} (${((100 * faUnder28) / Math.max(1, currentFa.length)).toFixed(1)}%)`);
const posDist: Record<string, number> = {};
for (const [, s] of currentFa) posDist[s.position] = (posDist[s.position] ?? 0) + 1;
console.log(`  positions: ${Object.entries(posDist).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join("  ")}`);
const clubCA = [...final.values()].filter((s) => isClub(s.clubId)).map((s) => s.ca).filter((c) => !Number.isNaN(c));
console.log(`  contracted players for comparison: n=${clubCA.length} CA mean=${mean(clubCA).toFixed(1)} median=${med(clubCA)}`);

console.log(`\n=== 5-6. CLUB CAPACITY by competition at S${seasons} ===`);
console.log(`  competition            clubs  totalSquad  mean  min  max`);
for (const competitionId of SWEDISH_WORLD_COMPETITION_IDS) {
  const clubIds = getClubsByCompetition(competitionId).map((c) => c.id).filter((id) => careerWorldClubIds(state).includes(id));
  const sizes = clubIds.map((id) => (state.worldSquads[id] ?? []).length);
  if (sizes.length === 0) continue;
  console.log(`  ${LABEL[competitionId].padEnd(22)} ${String(sizes.length).padStart(5)} ${String(sizes.reduce((a, b) => a + b, 0)).padStart(11)} ${mean(sizes).toFixed(1).padStart(5)} ${String(Math.min(...sizes)).padStart(4)} ${String(Math.max(...sizes)).padStart(4)}`);
}

console.log(`\n=== 7. YOUTH COHORT ABSORPTION ===`);
for (const cohortSeason of [1, 3, 5, 10].filter((s) => s <= seasons)) {
  const ids = [...youthCohort.entries()].filter(([, s]) => s === cohortSeason).map(([id]) => id);
  if (ids.length === 0) continue;
  let atClub = 0, fa = 0, gone = 0;
  for (const id of ids) {
    const s = final.get(id);
    if (!s || isRet(s.clubId)) gone++;
    else if (isFA(s.clubId)) fa++;
    else atClub++;
  }
  console.log(`  cohort S${cohortSeason} (n=${ids.length}) after ${seasons - cohortSeason} seasons: atClub=${atClub} (${((100 * atClub) / ids.length).toFixed(0)}%)  freeAgent=${fa} (${((100 * fa) / ids.length).toFixed(0)}%)  exited=${gone}`);
}

console.log(`\n=== 9. GENERATED-ONLY WORLD QUALITY at S${seasons} ===`);
for (const competitionId of SWEDISH_WORLD_COMPETITION_IDS) {
  const clubIds = new Set(getClubsByCompetition(competitionId).map((c) => c.id));
  const gen = [...final.values()].filter((s) => s.generated && clubIds.has(s.clubId));
  if (gen.length === 0) { console.log(`  ${LABEL[competitionId].padEnd(22)} (none)`); continue; }
  const ca = gen.map((s) => s.ca).filter((c) => !Number.isNaN(c));
  const pa = gen.map((s) => s.pa).filter((c) => !Number.isNaN(c));
  console.log(`  ${LABEL[competitionId].padEnd(22)} n=${String(gen.length).padStart(4)}  CA mean=${mean(ca).toFixed(1)} med=${med(ca).toFixed(0)} p90=${q(ca, 0.9).toFixed(0)}  PA mean=${mean(pa).toFixed(1)}  CA>=130:${ca.filter((c) => c >= 130).length}  CA>=140:${ca.filter((c) => c >= 140).length}`);
}
const allGen = [...final.values()].filter((s) => s.generated && isClub(s.clubId)).map((s) => s.ca).filter((c) => !Number.isNaN(c));
const allReal = [...final.values()].filter((s) => !s.generated && isClub(s.clubId)).map((s) => s.ca).filter((c) => !Number.isNaN(c));
console.log(`  ALL contracted generated: n=${allGen.length} CA mean=${mean(allGen).toFixed(1)} p90=${q(allGen, 0.9).toFixed(0)}`);
console.log(`  ALL contracted real:      n=${allReal.length} CA mean=${mean(allReal).toFixed(1)} p90=${q(allReal, 0.9).toFixed(0)}`);

if (outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `population-ledger-${seed}-${seasons}s.json`);
  fs.writeFileSync(file, JSON.stringify({ ledger, faDurationsOnExit }, null, 2), "utf8");
  console.log(`\nmachine-readable: ${file}`);
}
