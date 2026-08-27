// HM-CONTRACTS-1.0 Part: the mandatory calibration test -- real engine
// output across 12 player archetypes, logged for manual review (Part:
// "kalibreringen kan förbättras senare" -- this reports actual numbers,
// never silently tunes to hit a preconceived target).
import { test } from "node:test";
import assert from "node:assert/strict";
import { computePlayerMarketValueSek, computePlayerSalarySekPerMonth, type EconomyProfileInputs } from "./marketValue";
import { getContractStatus } from "./contractLifecycle";
import { formatSek } from "./labels";

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

test("Part: HM-CONTRACTS-1.0 calibration report -- 12 player archetypes, real engine output", () => {
  const rows = ARCHETYPES.map((a) => {
    const inputs: EconomyProfileInputs = { ca: a.ca, pa: a.pa, age: a.age, position: a.position, role: a.role, competitionTier: a.competitionTier };
    const salary = computePlayerSalarySekPerMonth(inputs);
    const value = computePlayerMarketValueSek(inputs, a.contractEndDate, ASOF);
    const status = getContractStatus(a.contractEndDate, ASOF);
    return {
      PLAYER: a.label,
      AGE: a.age,
      CA: a.ca,
      PA: a.pa,
      LEVEL: a.competitionTier === 1 ? "Handbollsligan" : "Allsvenskan",
      CONTRACT: status,
      SALARY: formatSek(salary) + "/mån",
      VALUE: formatSek(value),
    };
  });

  // eslint-disable-next-line no-console
  console.log("HM-CONTRACTS-1.0 calibration report (real engine output, 12 archetypes):");
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
  const parseSek = (s: string) => Number(s.replace(/[^\d]/g, ""));
  assert.ok(parseSek(elite.VALUE) > parseSek(established.VALUE));
  assert.ok(parseSek(established.VALUE) > parseSek(talent.VALUE));
  assert.ok(parseSek(talent.VALUE) > parseSek(ordinary.VALUE));
  assert.ok(parseSek(elite.SALARY) > parseSek(ordinary.SALARY));

  // Never football-scale numbers anywhere in the table.
  for (const row of rows) {
    assert.ok(parseSek(row.VALUE) <= 6_000_000, `${row.PLAYER} value too high: ${row.VALUE}`);
    assert.ok(parseSek(row.SALARY) <= 140_000, `${row.PLAYER} salary too high: ${row.SALARY}`);
  }
});
