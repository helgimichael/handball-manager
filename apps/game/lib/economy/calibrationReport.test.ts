// HM-CONTRACTS-1.0/1.0A: the mandatory calibration test -- real engine
// output across 12 player archetypes (contracts/value/salary, now EUR)
// PLUS a separate training-compensation example set, logged for manual
// review (Part: "kalibreringen kan förbättras senare" -- this reports
// actual numbers, never silently tunes to hit a preconceived target).
import { test } from "node:test";
import assert from "node:assert/strict";
import { computePlayerMarketValueEur, computePlayerSalaryEurPerMonth, type EconomyProfileInputs } from "./marketValue";
import { getContractStatus } from "./contractLifecycle";
import { formatEur } from "./currency";
import { computeTotalAcquisitionCostEur, computeTrainingCompensationEur, GENERIC_FOUNDATION_RULE_SET } from "./trainingCompensation";
import type { PlayerClubHistoryEntry } from "./types";

const ASOF = "2026-08-19";

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

const ARCHETYPES: Archetype[] = [
  { label: "Ung stor talang (Handbollsligan)", age: 18, ca: 115, pa: 178, position: "M9", role: "STARTER", competitionTier: 1, contractEndDate: "2030-06-30" },
  { label: "Vanlig Allsvenskan-spelare", age: 25, ca: 105, pa: 110, position: "V9", role: "ROTATION", competitionTier: 2, contractEndDate: "2028-06-30" },
  { label: "Etablerad Handbollsligan-spelare", age: 27, ca: 140, pa: 145, position: "M6", role: "STARTER", competitionTier: 1, contractEndDate: "2029-06-30" },
  { label: "Svensk landslagsspelare / toppspelare", age: 28, ca: 175, pa: 180, position: "H9", role: "KEY_PLAYER", competitionTier: 1, contractEndDate: "2030-06-30" },
  { label: "Åldrande veteran (Handbollsligan)", age: 35, ca: 130, pa: 130, position: "H6", role: "ROTATION", competitionTier: 1, contractEndDate: "2027-06-30" },
  { label: "Ung Allsvenskan-talang", age: 17, ca: 95, pa: 150, position: "V6", role: "DEVELOPMENT", competitionTier: 2, contractEndDate: "2029-06-30" },
  { label: "Reservmålvakt (Allsvenskan)", age: 24, ca: 100, pa: 105, position: "GK", role: "EMERGENCY", competitionTier: 2, contractEndDate: "2028-06-30" },
  { label: "Förstamålvakt (Handbollsligan)", age: 29, ca: 150, pa: 155, position: "GK", role: "STARTER", competitionTier: 1, contractEndDate: "2029-06-30" },
  { label: "Etablerad spelare, utgående kontrakt", age: 28, ca: 130, pa: 130, position: "M9", role: "STARTER", competitionTier: 1, contractEndDate: "2027-01-15" },
  { label: "Kontraktslös spelare (free agent)", age: 30, ca: 120, pa: 125, position: "V9", role: "ROTATION", competitionTier: 2, contractEndDate: "2026-07-01" },
  { label: "Elitspelare, kort kontrakt kvar", age: 29, ca: 175, pa: 180, position: "H6", role: "KEY_PLAYER", competitionTier: 1, contractEndDate: "2027-02-01" },
  { label: "Genomsnittlig rotationsspelare (Allsvenskan)", age: 26, ca: 108, pa: 112, position: "M6", role: "MAJOR_ROTATION", competitionTier: 2, contractEndDate: "2028-06-30" },
];

test("Part: HM-CONTRACTS-1.0/1.0A calibration report -- 12 player archetypes, EUR, real engine output", () => {
  const rows = ARCHETYPES.map((a) => {
    const inputs: EconomyProfileInputs = { ca: a.ca, pa: a.pa, age: a.age, position: a.position, role: a.role, competitionTier: a.competitionTier };
    const salary = computePlayerSalaryEurPerMonth(inputs);
    const value = computePlayerMarketValueEur(inputs, a.contractEndDate, ASOF);
    const status = getContractStatus(a.contractEndDate, ASOF);
    return {
      PLAYER: a.label,
      AGE: a.age,
      CA: a.ca,
      PA: a.pa,
      LEVEL: a.competitionTier === 1 ? "Handbollsligan" : "Allsvenskan",
      CONTRACT: status,
      SALARY: formatEur(salary) + "/mån",
      VALUE: formatEur(value),
    };
  });

  // eslint-disable-next-line no-console
  console.log("HM-CONTRACTS-1.0/1.0A calibration report -- EUR (real engine output, 12 archetypes):");
  // eslint-disable-next-line no-console
  console.table(rows);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(rows, null, 1));

  // Sanity assertions -- directional plausibility, never asserting an exact preconceived number.
  const byLabel = new Map(rows.map((r) => [r.PLAYER, r]));
  const talent = byLabel.get("Ung stor talang (Handbollsligan)")!;
  const ordinary = byLabel.get("Vanlig Allsvenskan-spelare")!;
  const elite = byLabel.get("Svensk landslagsspelare / toppspelare")!;
  const established = byLabel.get("Etablerad Handbollsligan-spelare")!;

  // "stor skillnad mellan vanlig Allsvenskan-spelare, etablerad Handbollsligan-spelare, ung stor talang, svensk landslagsspelare/toppspelare"
  const parseEur = (s: string) => Number(s.replace(/[^\d]/g, ""));
  assert.ok(parseEur(elite.VALUE) > parseEur(established.VALUE));
  assert.ok(parseEur(established.VALUE) > parseEur(talent.VALUE));
  assert.ok(parseEur(talent.VALUE) > parseEur(ordinary.VALUE));
  assert.ok(parseEur(elite.SALARY) > parseEur(ordinary.SALARY));

  // Never football-scale numbers anywhere in the table.
  for (const row of rows) {
    assert.ok(parseEur(row.VALUE) <= 550_000, `${row.PLAYER} value too high: ${row.VALUE}`);
    assert.ok(parseEur(row.SALARY) <= 13_000, `${row.PLAYER} salary too high: ${row.SALARY}`);
  }
});

// ---------------------------------------------------------------------------
// HM-CONTRACTS-1.0A: training compensation + total acquisition cost --
// PLAYER | AGE | TRANSFER FEE | TRAINING COMP | TOTAL ACQUISITION COST.
// No transfer system exists yet, so "TRANSFER FEE" is a supplied
// hypothetical for each example (0 for the free-transfer/Bosman cases),
// never computed by this module itself.
// ---------------------------------------------------------------------------

interface AcquisitionExample {
  label: string;
  age: number;
  transferFeeEur: number;
  history: PlayerClubHistoryEntry[];
}

const ACQUISITION_EXAMPLES: AcquisitionExample[] = [
  {
    label: "Ung talang, fri övergång (Bosman), en tidigare utbildningsklubb",
    age: 19,
    transferFeeEur: 0,
    history: [{ clubId: "se_club_hammarby_if_hf", fromAge: 12, toAge: 18 }],
  },
  {
    label: "Ung talang, fri övergång, TVÅ tidigare utbildningsklubbar",
    age: 20,
    transferFeeEur: 0,
    history: [
      { clubId: "se_club_ifk_kristianstad", fromAge: 12, toAge: 15 },
      { clubId: "se_club_hf_karlskrona", fromAge: 15, toAge: 18 },
    ],
  },
  {
    label: "Ung talang, betald övergång (fee > 0) OCH utbildningsersättning",
    age: 21,
    transferFeeEur: 45_000,
    history: [{ clubId: "swe2-tumba", fromAge: 12, toAge: 17 }],
  },
  {
    label: "Etablerad spelare (27 år) -- över åldersgränsen, ingen utbildningsersättning",
    age: 27,
    transferFeeEur: 120_000,
    history: [{ clubId: "swe2-tumba", fromAge: 12, toAge: 17 }],
  },
  {
    label: "Spelare utan känd klubbhistorik -- ingen utbildningsersättning möjlig",
    age: 19,
    transferFeeEur: 0,
    history: [],
  },
];

test("Part: HM-CONTRACTS-1.0A training-compensation / total-acquisition-cost examples", () => {
  const rows = ACQUISITION_EXAMPLES.map((ex) => {
    const comp = computeTrainingCompensationEur(ex.age, ex.history, GENERIC_FOUNDATION_RULE_SET);
    const total = computeTotalAcquisitionCostEur(ex.transferFeeEur, comp.totalEur);
    return {
      PLAYER: ex.label,
      AGE: ex.age,
      "TRANSFER FEE": formatEur(ex.transferFeeEur),
      "TRAINING COMP": formatEur(comp.totalEur),
      "TOTAL ACQUISITION COST": formatEur(total),
      "RECEIVING CLUBS": comp.perClub.map((c) => `${c.clubId} (${formatEur(c.amountEur)})`).join(", ") || "—",
    };
  });

  // eslint-disable-next-line no-console
  console.log("HM-CONTRACTS-1.0A training-compensation / total-acquisition-cost examples (real engine output):");
  // eslint-disable-next-line no-console
  console.table(rows);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(rows, null, 1));

  // Free transfer (fee=0) can still carry positive training compensation.
  assert.equal(rows[0]["TRANSFER FEE"], formatEur(0));
  assert.notEqual(rows[0]["TRAINING COMP"], formatEur(0));
  assert.equal(rows[0]["TOTAL ACQUISITION COST"], rows[0]["TRAINING COMP"]); // fee 0 + comp -- total is exactly the compensation

  // Two training clubs both represented.
  assert.ok(rows[1]["RECEIVING CLUBS"].includes(","), `expected two clubs: ${rows[1]["RECEIVING CLUBS"]}`);

  // Fee + comp add up correctly (never one silently absorbing the other).
  const feeEur = ACQUISITION_EXAMPLES[2].transferFeeEur;
  const comp2 = computeTrainingCompensationEur(ACQUISITION_EXAMPLES[2].age, ACQUISITION_EXAMPLES[2].history);
  assert.equal(rows[2]["TOTAL ACQUISITION COST"], formatEur(feeEur + comp2.totalEur));

  // Older player (27, over the age threshold) gets zero training compensation regardless of history.
  assert.equal(rows[3]["TRAINING COMP"], formatEur(0));

  // No history at all -- zero compensation, never a crash.
  assert.equal(rows[4]["TRAINING COMP"], formatEur(0));
});
