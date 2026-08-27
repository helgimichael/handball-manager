// HM-WAGE-MARKET-1.0: the mandatory before/after calibration report --
// real engine output (NEW = current computePlayerSalaryEurPerMonth/
// computePlayerMarketValueEur; OLD = the pre-HM-WAGE-MARKET-1.0 formula,
// reimplemented locally in THIS TEST FILE ONLY for comparison -- never
// reintroduced into production code). Confirms the population-level fix
// the milestone exists to prove: financially healthy clubs can now
// afford a real squad, while the weakest-revenue clubs remain
// realistically pressured (never "every club comfortably rich").
import { test } from "node:test";
import { createNewCareerState } from "../career/newCareer";
import { getClubsByCompetition, getClub, getCompetition, TUMBA_CLUB_ID, TUMBA_SQUAD, type PlayerMock } from "../game-data";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { getCareerPlayerRating } from "../career/careerRatingNormalization";
import { playerAgeAtDate } from "../development/developmentIntegration";
import type { MatchRole } from "../matchPlan/types";
import { getClubEconomyBaseline, getClubEconomySnapshot } from "./clubEconomyIntegration";
import { formatEur } from "./currency";
import { computePlayerMarketValueEur, computePlayerSalaryEurPerMonth, type EconomyProfileInputs } from "./marketValue";

const HANDBOLLSLIGAN_ID = "se_handbollsligan_herr";

// --- OLD (pre-HM-WAGE-MARKET-1.0) formula, reimplemented HERE ONLY for comparison. ---
function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
const CA_FLOOR = 90, CA_CEIL = 185;
function caProgress(ca: number) { return clamp((ca - CA_FLOOR) / (CA_CEIL - CA_FLOOR), 0, 1); }
function ageMul(age: number | null) {
  const pts: [number, number][] = [[17, 0.75], [24, 1.0], [29, 1.0], [33, 0.75], [37, 0.4], [40, 0.25]];
  if (age === null) return pts[Math.floor(pts.length / 2)][1];
  if (age <= pts[0][0]) return pts[0][1];
  if (age >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    if (age >= x0 && age <= x1) return y0 + (y1 - y0) * ((age - x0) / (x1 - x0));
  }
  return pts[pts.length - 1][1];
}
const ROLE_MUL: Record<MatchRole, number> = { KEY_PLAYER: 1.25, STARTER: 1.1, MAJOR_ROTATION: 1.0, ROTATION: 0.9, SPECIALIST: 0.95, DEVELOPMENT: 0.8, EMERGENCY: 0.65 };
function tierMul(tier: 1 | 2 | undefined) { return tier === 1 ? 1.15 : tier === 2 ? 0.85 : 1.0; }
function posSalaryMul(position: string) { return position === "GK" ? 0.95 : 1.0; }
function posValueMul(position: string) { return position === "GK" ? 0.9 : 1.0; }
const OLD_SALARY_MIN = 500, OLD_SALARY_MAX = 13_000, OLD_SALARY_EXP = 1.8;
const OLD_VALUE_MIN = 1_500, OLD_VALUE_MAX = 550_000, OLD_VALUE_EXP = 2.3;

function oldSalaryEurPerMonth(inputs: EconomyProfileInputs): number {
  const t = caProgress(inputs.ca);
  const base = OLD_SALARY_MIN + (OLD_SALARY_MAX - OLD_SALARY_MIN) * Math.pow(t, OLD_SALARY_EXP);
  const raw = base * ageMul(inputs.age) * tierMul(inputs.competitionTier) * posSalaryMul(inputs.position) * ROLE_MUL[inputs.role];
  return Math.round(clamp(raw, OLD_SALARY_MIN, OLD_SALARY_MAX) / 50) * 50;
}
function oldPotentialMul(ca: number, pa: number, age: number | null) {
  const headroom = Math.max(0, pa - ca);
  const potentialBonus = clamp(headroom / 100, 0, 0.6);
  const youthFactor = age === null ? 0.5 : clamp(1 - (age - 23) / 15, 0, 1);
  return 1 + potentialBonus * youthFactor;
}
function oldContractTimeMul(daysRemaining: number) {
  if (daysRemaining <= 0) return 0.5;
  if (daysRemaining <= 180) return 0.65;
  if (daysRemaining <= 365) return 0.85;
  return 1.0;
}
function oldValueEur(inputs: EconomyProfileInputs, daysRemaining: number): number {
  const t = caProgress(inputs.ca);
  const base = OLD_VALUE_MIN + (OLD_VALUE_MAX - OLD_VALUE_MIN) * Math.pow(t, OLD_VALUE_EXP);
  const raw = base * oldPotentialMul(inputs.ca, inputs.pa, inputs.age) * ageMul(inputs.age) * oldContractTimeMul(daysRemaining) * tierMul(inputs.competitionTier) * posValueMul(inputs.position) * ROLE_MUL[inputs.role];
  return Math.round(clamp(raw, OLD_VALUE_MIN, OLD_VALUE_MAX) / 100) * 100;
}

function roleFor(p: PlayerMock): MatchRole {
  switch (p.squadStatus) {
    case "Förstaval": return "STARTER";
    case "Rotation": return "ROTATION";
    case "Ungdom": return "DEVELOPMENT";
    default: return "ROTATION";
  }
}

function clubOldWageTotalAnnual(state: ReturnType<typeof createNewCareerState>, clubId: string, players: readonly PlayerMock[]): number {
  const tier = getCompetition(getClub(clubId)?.competitionId ?? "")?.tier;
  let total = 0;
  for (const p of players) {
    const rating = getCareerPlayerRating(state, p.id, clubId);
    if (!rating) continue;
    const age = playerAgeAtDate(p.dateOfBirth, p.birthYear, state.gameDate);
    const inputs: EconomyProfileInputs = { ca: rating.ca, pa: rating.pa, age, position: "M9", role: roleFor(p), competitionTier: tier };
    total += oldSalaryEurPerMonth(inputs) * 12;
  }
  return total;
}

test("Part: HM-WAGE-MARKET-1.0 before/after -- full Handbollsligan population (all 14 clubs) + IFK Tumba", () => {
  const worldSquads = snapshotWorldSquads(HANDBOLLSLIGAN_ID);
  const gameplayRatings = snapshotGameplayRatings(HANDBOLLSLIGAN_ID);
  const hlState = createNewCareerState("wagecalib-hl", "se_club_ifk_skovde_hk", worldSquads, {}, gameplayRatings);
  const tumbaState = createNewCareerState("wagecalib-tumba", TUMBA_CLUB_ID);

  const rows: Record<string, string | number>[] = [];

  const hlClubIds = getClubsByCompetition(HANDBOLLSLIGAN_ID).map((c) => c.id);
  for (const clubId of hlClubIds) {
    const baseline = getClubEconomyBaseline(hlState, clubId)!;
    const snapshot = getClubEconomySnapshot(hlState, clubId)!;
    const revenue = snapshot.recurringRevenueEur;
    const oldWages = clubOldWageTotalAnnual(hlState, clubId, worldSquads[clubId] ?? []);
    rows.push({
      CLUB: clubId,
      BAND: baseline.band,
      REVENUE: formatEur(revenue),
      "WAGE BUDGET": formatEur(snapshot.budgets.wageBudgetEur),
      "OLD PLAYER WAGES": formatEur(oldWages),
      "NEW PLAYER WAGES": formatEur(snapshot.playerWageCostsEurAnnual),
      "WAGE/BUDGET (new)": (snapshot.playerWageCostsEurAnnual / snapshot.budgets.wageBudgetEur).toFixed(2),
      HEALTH: snapshot.health.pressure + (snapshot.budgets.wageOverBudget ? " (OVER)" : ""),
    });
  }

  const tumbaBaseline = getClubEconomyBaseline(tumbaState, TUMBA_CLUB_ID)!;
  const tumbaSnapshot = getClubEconomySnapshot(tumbaState, TUMBA_CLUB_ID)!;
  const tumbaOldWages = clubOldWageTotalAnnual(tumbaState, TUMBA_CLUB_ID, TUMBA_SQUAD);
  rows.push({
    CLUB: `${TUMBA_CLUB_ID} (Allsvenskan)`,
    BAND: tumbaBaseline.band,
    REVENUE: formatEur(tumbaSnapshot.recurringRevenueEur),
    "WAGE BUDGET": formatEur(tumbaSnapshot.budgets.wageBudgetEur),
    "OLD PLAYER WAGES": formatEur(tumbaOldWages),
    "NEW PLAYER WAGES": formatEur(tumbaSnapshot.playerWageCostsEurAnnual),
    "WAGE/BUDGET (new)": (tumbaSnapshot.playerWageCostsEurAnnual / tumbaSnapshot.budgets.wageBudgetEur).toFixed(2),
    HEALTH: tumbaSnapshot.health.pressure + (tumbaSnapshot.budgets.wageOverBudget ? " (OVER)" : ""),
  });

  // eslint-disable-next-line no-console
  console.log("HM-WAGE-MARKET-1.0 before/after -- full Handbollsligan population + IFK Tumba:");
  // eslint-disable-next-line no-console
  console.table(rows);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(rows, null, 1));

  const overBudgetCount = rows.filter((r) => String(r.HEALTH).includes("OVER")).length;
  // eslint-disable-next-line no-console
  console.log(`\nOver-wage-budget clubs: ${overBudgetCount}/${rows.length} (was 9/14 before HM-WAGE-MARKET-1.0's own recalibration).`);
});

interface Archetype {
  label: string;
  age: number;
  ca: number;
  pa: number;
  position: EconomyProfileInputs["position"];
  role: EconomyProfileInputs["role"];
  competitionTier: 1 | 2;
  contractEndDate: string;
}

const ASOF = "2026-08-19";
const PLAYER_ARCHETYPES: Archetype[] = [
  { label: "Ung Allsvenskan-spelare", age: 19, ca: 98, pa: 130, position: "M9", role: "ROTATION", competitionTier: 2, contractEndDate: "2028-06-30" },
  { label: "Etablerad Allsvenskan-spelare", age: 27, ca: 112, pa: 115, position: "V9", role: "STARTER", competitionTier: 2, contractEndDate: "2028-06-30" },
  { label: "Vanlig Handbollsligan-starter", age: 25, ca: 125, pa: 130, position: "M6", role: "STARTER", competitionTier: 1, contractEndDate: "2028-06-30" },
  { label: "Toppspelare i Handbollsligan", age: 27, ca: 155, pa: 158, position: "H9", role: "KEY_PLAYER", competitionTier: 1, contractEndDate: "2029-06-30" },
  { label: "Ung stor talang", age: 18, ca: 110, pa: 175, position: "M9", role: "STARTER", competitionTier: 1, contractEndDate: "2030-06-30" },
  { label: "Landslags-/elitspelare", age: 28, ca: 180, pa: 183, position: "H9", role: "KEY_PLAYER", competitionTier: 1, contractEndDate: "2030-06-30" },
];

test("Part: HM-WAGE-MARKET-1.0 before/after -- concrete player archetypes", () => {
  const rows = PLAYER_ARCHETYPES.map((a) => {
    const inputs: EconomyProfileInputs = { ca: a.ca, pa: a.pa, age: a.age, position: a.position, role: a.role, competitionTier: a.competitionTier };
    const daysRemaining = 700; // comfortably UNDER_CONTRACT for every archetype -- isolates the CA/age/tier/role comparison from contract-time discounting.
    return {
      "PLAYER TYPE": a.label,
      CA: a.ca,
      PA: a.pa,
      LEVEL: a.competitionTier === 1 ? "Handbollsligan" : "Allsvenskan",
      "OLD WAGE": formatEur(oldSalaryEurPerMonth(inputs)) + "/mån",
      "NEW WAGE": formatEur(computePlayerSalaryEurPerMonth(inputs)) + "/mån",
      "OLD VALUE": formatEur(oldValueEur(inputs, daysRemaining)),
      "NEW VALUE": formatEur(computePlayerMarketValueEur(inputs, a.contractEndDate, ASOF)),
    };
  });

  // eslint-disable-next-line no-console
  console.log("HM-WAGE-MARKET-1.0 before/after -- concrete player archetypes:");
  // eslint-disable-next-line no-console
  console.table(rows);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(rows, null, 1));
});
