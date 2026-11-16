// HM-TRANSFER-REALISM-1.0 M6: long-term transfer ecosystem simulation.
//
// OBSERVATION ONLY. Drives the real career engine (createNewCareerState ->
// processDay) over N seasons with the FULL world a real career has: the four
// Swedish competitions AND the international world pool. Records the metrics
// the transfer-realism sprint is judged on and, with --check, fails on the
// acceptance thresholds defined in ACCEPTANCE below (set before the final
// calibration runs; see docs/audits/TRANSFER-REALISM-IMPLEMENTATION-REPORT.md).
//
// Deterministic: every number is a pure function of (seed, canonical data).
//
// Usage:
//   npx tsx scripts/transfer-realism-sim.ts --seasons 20 --seed s1 [--out <dir>] [--check]
import * as fs from "node:fs";
import * as path from "node:path";
import { createNewCareerState } from "../lib/career/newCareer";
import { processDay } from "../lib/career/dailyTick";
import { snapshotWorldSquads, snapshotGameplayRatings } from "../lib/gameWorld/serverSnapshot";
import { getClub, type PlayerMock } from "../lib/game-data";
import { SWEDISH_WORLD_COMPETITION_IDS, careerWorldClubIds } from "../lib/career/worldCompetitions";
import { WORLD_POOL_COMPETITION_IDS } from "../lib/career/careerWorld";
import { RETIRED_CLUB_ID } from "../lib/career/playerLifecycle";
import { FREE_AGENT_CLUB_ID } from "../lib/career/contractExpiry";
import { clubCompetitionId } from "../lib/career/competitionMembership";
import { playerAgeAtDate } from "../lib/development/developmentIntegration";
import { addDays } from "../lib/career/dateUtils";
import { assessSquadNeeds, positionEmergencyLevel } from "../lib/career/cpuSquadNeeds";
import { getClubFinancialHealth } from "../lib/economy/clubEconomyIntegration";
import { ownLevelScore } from "../lib/career/cpuCandidateEvaluation";
import type { CareerState } from "../lib/career/types";
import type { GameplayPlayerRating } from "../lib/gameWorld/gameplayRatingSnapshot";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const seasons = Number(arg("seasons", "20"));
const seed = arg("seed", "transfer-realism-s1");
const managerClub = arg("club", "se_club_hammarby_if_hf");
const outDir = arg("out", "");
const check = process.argv.includes("--check");

// ---------------------------------------------------------------------------
// League grouping used for reporting only (never for decisions).
// ---------------------------------------------------------------------------
const ELITE_LEAGUES = new Set(["ger-1", "den-1", "esp-1", "hun-1"]);
type Group = "EURO_ELITE" | "EURO_OTHER" | "HBL" | "ALLSV" | "DIV1" | "FA" | "RETIRED";
const GROUPS: Group[] = ["EURO_ELITE", "EURO_OTHER", "HBL", "ALLSV", "DIV1", "FA", "RETIRED"];
const GROUP_RANK: Record<Group, number> = { EURO_ELITE: 5, EURO_OTHER: 4, HBL: 3, ALLSV: 2, DIV1: 1, FA: 0, RETIRED: -1 };

function groupOf(state: CareerState, clubId: string): Group {
  if (clubId === FREE_AGENT_CLUB_ID) return "FA";
  if (clubId === RETIRED_CLUB_ID) return "RETIRED";
  const comp = clubCompetitionId(state, clubId) ?? "";
  if (comp === "se_handbollsligan_herr") return "HBL";
  if (comp === "swe-2") return "ALLSV";
  if (comp.startsWith("se_division1")) return "DIV1";
  if (ELITE_LEAGUES.has(comp)) return "EURO_ELITE";
  return "EURO_OTHER";
}

// ---------------------------------------------------------------------------
// World construction: Swedish pyramid + world pool, exactly as a real career.
// ---------------------------------------------------------------------------
function buildFullWorld(): { worldSquads: Record<string, PlayerMock[]>; gameplayRatings: Record<string, GameplayPlayerRating[]> } {
  const worldSquads: Record<string, PlayerMock[]> = {};
  const gameplayRatings: Record<string, GameplayPlayerRating[]> = {};
  for (const competitionId of [...SWEDISH_WORLD_COMPETITION_IDS, ...WORLD_POOL_COMPETITION_IDS]) {
    Object.assign(worldSquads, snapshotWorldSquads(competitionId));
    Object.assign(gameplayRatings, snapshotGameplayRatings(competitionId));
  }
  return { worldSquads, gameplayRatings };
}

interface Snap { clubId: string; group: Group; age: number | null; ca: number; contractEnd: string | null; name: string }

function snapshot(state: CareerState, date: string): Map<string, Snap> {
  const out = new Map<string, Snap>();
  for (const [clubId, squad] of Object.entries(state.worldSquads)) {
    const ratings = new Map((state.gameplayRatings[clubId] ?? []).map((r) => [r.playerId, r.ca]));
    for (const p of squad) {
      out.set(p.id, {
        clubId,
        group: groupOf(state, clubId),
        age: playerAgeAtDate(p.dateOfBirth, p.birthYear, date),
        ca: ratings.get(p.id) ?? p.currentAbility,
        contractEnd: state.playerContracts[p.id]?.contractEndDate ?? null,
        name: `${p.firstName} ${p.lastName}`,
      });
    }
  }
  return out;
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))]!;
}
const r1 = (n: number) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const started = Date.now();
const world = buildFullWorld();
let state = createNewCareerState(seed, managerClub, world.worldSquads, {}, world.gameplayRatings);
let date = state.gameDate;

const initial = snapshot(state, date);
// World-class = top 3% of CA among every player at a club at career start. A fixed CA bar, so
// "world-class" keeps meaning the same thing across seasons.
const startCAs = [...initial.values()].filter((s) => s.group !== "FA" && s.group !== "RETIRED").map((s) => s.ca);
const WORLD_CLASS_CA = quantile(startCAs, 0.97);
const ELITE_CA = quantile(startCAs, 0.9);
const initialWorldClassInEurope = [...initial.values()].filter((s) => s.ca >= WORLD_CLASS_CA && (s.group === "EURO_ELITE" || s.group === "EURO_OTHER")).length;
const NAMED = ["Gidsel", "Skipagøtu"];
const namedIds = [...initial.entries()].filter(([, s]) => NAMED.some((n) => s.name.includes(n))).map(([id]) => id);

interface SeasonRow {
  season: number;
  endDate: string;
  caByGroup: Record<string, { n: number; median: number; p90: number }>;
  worldClassByGroup: Record<string, number>;
  worldClassUnder33InDiv1: number;
  worldClassUnder33InSweden: number;
  moves: number;
  movesInternational: number;
  eliteDowngrades: number; // elite (top 10%) players under 31 moving down >= 2 group ranks to a club
  eliteDowngradesToDiv1: number;
  signedFromFA: number;
  faPoolStart: number;
  faPoolEnd: number;
  faReemployed: number;
  renewals: number;
  renewalsWorldPool: number;
  contractExpiries: number;
  swedishSquadMedian: number;
  swedishSquadsUnder14: number;
  emergencyClubWeeks: number;
  swedishClubWeeks: number;
  pressuredSwedishClubs: number;
  swedishClubCashMedianEur: number;
  leagueLevel: Record<string, number>;
  named: Record<string, { club: string; group: Group; age: number | null; ca: number }>;
}
const rows: SeasonRow[] = [];

const swedishClubIds = () => careerWorldClubIds(state).filter((id) => id !== state.playerClubId);

for (let season = 1; season <= seasons; season++) {
  const before = snapshot(state, date);
  let emergencyClubWeeks = 0;
  let swedishClubWeeks = 0;
  for (let day = 0; day < 365; day++) {
    date = addDays(date, 1);
    state = processDay(state, date).state;
    if (day % 7 === 3) {
      for (const clubId of swedishClubIds()) {
        swedishClubWeeks++;
        const a = assessSquadNeeds(state, clubId, date);
        if (a.positions.some((p) => positionEmergencyLevel(p.position, p.projectedDepth) !== "NONE")) emergencyClubWeeks++;
      }
    }
  }
  const after = snapshot(state, date);

  const caByGroup: SeasonRow["caByGroup"] = {};
  const worldClassByGroup: Record<string, number> = {};
  for (const g of GROUPS) {
    const cas = [...after.values()].filter((s) => s.group === g).map((s) => s.ca);
    caByGroup[g] = { n: cas.length, median: r1(quantile(cas, 0.5)), p90: r1(quantile(cas, 0.9)) };
    worldClassByGroup[g] = [...after.values()].filter((s) => s.group === g && s.ca >= WORLD_CLASS_CA).length;
  }
  const wcU33 = [...after.values()].filter((s) => s.ca >= WORLD_CLASS_CA && (s.age ?? 99) < 33);

  let moves = 0, movesInternational = 0, eliteDowngrades = 0, eliteDowngradesToDiv1 = 0, signedFromFA = 0, renewals = 0, renewalsWorldPool = 0, contractExpiries = 0, faReemployed = 0;
  for (const [id, now] of after) {
    const was = before.get(id);
    if (!was) continue;
    if (was.clubId !== now.clubId) {
      if (now.group === "FA" && was.group !== "FA") contractExpiries++;
      if (was.group === "FA" && now.group !== "FA" && now.group !== "RETIRED") { signedFromFA++; faReemployed++; }
      if (now.group !== "FA" && now.group !== "RETIRED") {
        moves++;
        const intl = (g: Group) => g === "EURO_ELITE" || g === "EURO_OTHER";
        if (intl(was.group) || intl(now.group)) movesInternational++;
        if (was.ca >= ELITE_CA && (was.age ?? 99) < 31) {
          // Reference level: where he was, or for a free agent the best level he held at season start.
          const fromRank = was.group === "FA" ? GROUP_RANK.HBL : GROUP_RANK[was.group];
          if (fromRank - GROUP_RANK[now.group] >= 2) eliteDowngrades++;
          if (now.group === "DIV1") eliteDowngradesToDiv1++;
        }
      }
    } else if (was.contractEnd && now.contractEnd && now.contractEnd > was.contractEnd && now.group !== "FA" && now.group !== "RETIRED") {
      renewals++;
      if (now.group === "EURO_ELITE" || now.group === "EURO_OTHER") renewalsWorldPool++;
    }
  }

  const swedishSizes = swedishClubIds().map((id) => (state.worldSquads[id] ?? []).length);
  const leagueLevel: Record<string, number> = {};
  for (const g of ["EURO_ELITE", "EURO_OTHER", "HBL", "ALLSV", "DIV1"] as Group[]) {
    const clubs = Object.keys(state.worldSquads).filter((id) => id !== FREE_AGENT_CLUB_ID && id !== RETIRED_CLUB_ID && getClub(id) && groupOf(state, id) === g);
    leagueLevel[g] = r1(quantile(clubs.map((id) => ownLevelScore(state, id)).filter((v) => v > 0), 0.5));
  }
  const cash = swedishClubIds().map((id) => state.clubEconomies[id]?.cashEur).filter((v): v is number => typeof v === "number");
  const pressured = swedishClubIds().filter((id) => { const p = getClubFinancialHealth(state, id)?.pressure; return p === "SERIOUS" || p === "CRITICAL"; }).length;

  const named: SeasonRow["named"] = {};
  for (const id of namedIds) {
    const s = after.get(id);
    if (s) named[s.name] = { club: getClub(s.clubId)?.shortName ?? s.clubId, group: s.group, age: s.age, ca: Math.round(s.ca) };
  }

  const row: SeasonRow = {
    season,
    endDate: date,
    caByGroup,
    worldClassByGroup,
    worldClassUnder33InDiv1: wcU33.filter((s) => s.group === "DIV1").length,
    worldClassUnder33InSweden: wcU33.filter((s) => s.group === "HBL" || s.group === "ALLSV" || s.group === "DIV1").length,
    moves,
    movesInternational,
    eliteDowngrades,
    eliteDowngradesToDiv1,
    signedFromFA,
    faPoolStart: [...before.values()].filter((s) => s.group === "FA").length,
    faPoolEnd: [...after.values()].filter((s) => s.group === "FA").length,
    faReemployed,
    renewals,
    renewalsWorldPool,
    contractExpiries,
    swedishSquadMedian: quantile(swedishSizes, 0.5),
    swedishSquadsUnder14: swedishSizes.filter((n) => n < 14).length,
    emergencyClubWeeks,
    swedishClubWeeks,
    pressuredSwedishClubs: pressured,
    swedishClubCashMedianEur: Math.round(quantile(cash, 0.5)),
    leagueLevel,
    named,
  };
  rows.push(row);
  const n = Object.entries(named).map(([k, v]) => `${k.split(" ").slice(-1)[0]}=${v.group}/${v.club}(${v.age})`).join(" ");
  console.log(
    `S${String(season).padStart(2)} ${date} lvl E${leagueLevel.EURO_ELITE} O${leagueLevel.EURO_OTHER} H${leagueLevel.HBL} A${leagueLevel.ALLSV} D${leagueLevel.DIV1}` +
      ` | WC E${worldClassByGroup.EURO_ELITE}/O${worldClassByGroup.EURO_OTHER}/H${worldClassByGroup.HBL}/A${worldClassByGroup.ALLSV}/D${worldClassByGroup.DIV1}/FA${worldClassByGroup.FA}` +
      ` | moves ${moves} intl ${movesInternational} eliteDown ${eliteDowngrades} toD1 ${eliteDowngradesToDiv1}` +
      ` | FA ${row.faPoolStart}->${row.faPoolEnd} reemp ${faReemployed} | renew ${renewals} (wp ${renewalsWorldPool}) exp ${contractExpiries}` +
      ` | sq med ${row.swedishSquadMedian} <14:${row.swedishSquadsUnder14} emerg ${r1((100 * emergencyClubWeeks) / Math.max(1, swedishClubWeeks))}% press ${pressured} | ${n}`,
  );
}

// ---------------------------------------------------------------------------
// Acceptance thresholds (defined BEFORE final calibration; see report §8).
// ---------------------------------------------------------------------------
const sum = (f: (r: SeasonRow) => number) => rows.reduce((a, r) => a + f(r), 0);
const last = rows[rows.length - 1]!;
const totalMoves = Math.max(1, sum((r) => r.moves));
const faStartTotal = Math.max(1, sum((r) => r.faPoolStart));
const metrics = {
  worldClassCA: r1(WORLD_CLASS_CA),
  eliteCA: r1(ELITE_CA),
  maxWorldClassUnder33InDiv1: Math.max(...rows.map((r) => r.worldClassUnder33InDiv1)),
  eliteDowngradeToDiv1Total: sum((r) => r.eliteDowngradesToDiv1),
  eliteDowngradeShareOfMoves: r1((100 * sum((r) => r.eliteDowngrades)) / totalMoves),
  internationalMoveShare: r1((100 * sum((r) => r.movesInternational)) / totalMoves),
  worldClassStillInEurope: last.worldClassByGroup.EURO_ELITE + last.worldClassByGroup.EURO_OTHER,
  worldClassInEuropeAtStart: initialWorldClassInEurope,
  worldClassInFA_final: last.worldClassByGroup.FA,
  faPoolFinal: last.faPoolEnd,
  faReemploymentRate: r1((100 * sum((r) => r.faReemployed)) / faStartTotal),
  worldPoolRenewalsTotal: sum((r) => r.renewalsWorldPool),
  minSwedishSquadMedian: Math.min(...rows.map((r) => r.swedishSquadMedian)),
  maxSwedishSquadsUnder14: Math.max(...rows.map((r) => r.swedishSquadsUnder14)),
  emergencyWeekShare: r1((100 * sum((r) => r.emergencyClubWeeks)) / Math.max(1, sum((r) => r.swedishClubWeeks))),
  leagueOrderHeldEverySeason: rows.every((r) => r.leagueLevel.EURO_ELITE > r.leagueLevel.HBL && r.leagueLevel.HBL > r.leagueLevel.ALLSV && r.leagueLevel.ALLSV > r.leagueLevel.DIV1),
  maxPressuredSwedishClubs: Math.max(...rows.map((r) => r.pressuredSwedishClubs)),
  namedInDiv1Under33: rows.flatMap((r) => Object.entries(r.named).filter(([, v]) => v.group === "DIV1" && (v.age ?? 99) < 33).map(([k]) => `${k}@S${r.season}`)),
  runtimeSeconds: Math.round((Date.now() - started) / 1000),
};

const ACCEPTANCE: { name: string; ok: boolean; detail: string }[] = [
  { name: "No world-class (top 3%) player under 33 in Division 1 at any season end", ok: metrics.maxWorldClassUnder33InDiv1 === 0, detail: String(metrics.maxWorldClassUnder33InDiv1) },
  { name: "Elite (top 10%) under-31 moves into Division 1 <= 1 over the whole run", ok: metrics.eliteDowngradeToDiv1Total <= 1, detail: String(metrics.eliteDowngradeToDiv1Total) },
  { name: "Elite downgrades (>= 2 levels) <= 5% of all club moves", ok: metrics.eliteDowngradeShareOfMoves <= 5, detail: `${metrics.eliteDowngradeShareOfMoves}%` },
  { name: "International clubs renew contracts (world-pool renewals > 0)", ok: metrics.worldPoolRenewalsTotal > 0, detail: String(metrics.worldPoolRenewalsTotal) },
  { name: "World-class presence in European leagues holds (>= 60% of the career-start count every season)", ok: rows.every((r) => r.worldClassByGroup.EURO_ELITE + r.worldClassByGroup.EURO_OTHER >= 0.6 * initialWorldClassInEurope), detail: `min ${Math.min(...rows.map((r) => r.worldClassByGroup.EURO_ELITE + r.worldClassByGroup.EURO_OTHER))} vs start ${initialWorldClassInEurope}` },
  { name: "League order Euro elite > HBL > Allsvenskan > Div 1 holds every season", ok: metrics.leagueOrderHeldEverySeason, detail: String(metrics.leagueOrderHeldEverySeason) },
  { name: "Swedish CPU squad median >= 16 every season", ok: metrics.minSwedishSquadMedian >= 16, detail: String(metrics.minSwedishSquadMedian) },
  { name: "At most 2 Swedish CPU squads under 14 players at any season end", ok: metrics.maxSwedishSquadsUnder14 <= 2, detail: String(metrics.maxSwedishSquadsUnder14) },
  { name: "Emergency squad state in <= 10% of Swedish club-weeks", ok: metrics.emergencyWeekShare <= 10, detail: `${metrics.emergencyWeekShare}%` },
  { name: "Named regression players never in Division 1 under 33", ok: metrics.namedInDiv1Under33.length === 0, detail: metrics.namedInDiv1Under33.join(",") || "none" },
];

console.log("\n=== METRICS ===");
console.log(JSON.stringify(metrics, null, 2));
console.log("\n=== ACCEPTANCE ===");
for (const a of ACCEPTANCE) console.log(`${a.ok ? "PASS" : "FAIL"}  ${a.name}  [${a.detail}]`);

if (outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `transfer-realism-${seed}.json`), JSON.stringify({ seed, seasons, managerClub, metrics, acceptance: ACCEPTANCE, rows }, null, 2));
}
if (check && ACCEPTANCE.some((a) => !a.ok)) process.exitCode = 1;
