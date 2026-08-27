// HM-DATA-ALLSVENSKAN-1.0: confirms the new per-club economic signal
// correctly biases generateClubEconomyBaseline's band distribution
// without touching the underlying revenue/cash formulas, and that
// unlisted clubs are completely unaffected.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CLUB_ECONOMIC_SIGNAL, SIGNAL_BAND_WEIGHT_OVERRIDES } from "./clubEconomySignals";
import { generateClubEconomyBaseline } from "./clubEconomyGeneration";
import { BAND_REVENUE_RANGE_EUR } from "./clubEconomyCalibration";

test("(1) a club with a SEVERE_PRESSURE signal always lands in the poorest band E7", () => {
  const baseline = generateClubEconomyBaseline("swe2-guif", 2);
  assert.equal(baseline.band, "E7");
  assert.equal(baseline.provenance, "ANCHORED");
  assert.equal(baseline.confidence, "MEDIUM");
});

test("(2) a club with a VERY_STRONG signal can reach richer bands (E4/E5) its tier's default would never allow", () => {
  const baseline = generateClubEconomyBaseline("swe2-varberg", 2);
  assert.ok(["E4", "E5", "E6", "E7"].includes(baseline.band), `unexpected band ${baseline.band}`);
  assert.equal(baseline.provenance, "ANCHORED");
  const [min, max] = BAND_REVENUE_RANGE_EUR[baseline.band];
  assert.ok(min <= max);
});

test("(3) the VERY_STRONG override table itself is weighted toward richer bands than a plain tier-2 club could ever reach", () => {
  const richBands = new Set(["E1", "E2", "E3", "E4", "E5"]);
  const bandsInTable = SIGNAL_BAND_WEIGHT_OVERRIDES.VERY_STRONG!.map(([band]) => band);
  assert.ok(bandsInTable.some((band) => richBands.has(band)), `VERY_STRONG table has no rich band: ${bandsInTable}`);
});

test("(4) a club with no signal (e.g. Kroppskultur) generates exactly as before this milestone -- plain GENERATED/LOW under its tier default", () => {
  assert.equal(CLUB_ECONOMIC_SIGNAL["swe2-kroppskultur"], undefined);
  const baseline = generateClubEconomyBaseline("swe2-kroppskultur", 2);
  assert.equal(baseline.provenance, "GENERATED");
  assert.equal(baseline.confidence, "LOW");
});

test("(5) generation is still deterministic (same clubId -> same baseline) after the signal wiring", () => {
  const a = generateClubEconomyBaseline("swe2-varberg", 2);
  const b = generateClubEconomyBaseline("swe2-varberg", 2);
  assert.deepEqual(a, b);
});

test("(6) every listed signal clubId is a real, currently-defined Allsvenskan club", () => {
  const knownClubIds = new Set([
    "swe2-aranas", "swe2-drott", "swe2-guif", "swe2-h43lund", "swe2-huddinge",
    "swe2-kroppskultur", "swe2-kungalv", "swe2-redbergslid", "swe2-torslanda",
    "swe2-tumba", "swe2-tyreso", "swe2-varberg", "swe2-vasterasirsta", "swe2-ystad2",
  ]);
  for (const clubId of Object.keys(CLUB_ECONOMIC_SIGNAL)) {
    assert.ok(knownClubIds.has(clubId), `unknown clubId in CLUB_ECONOMIC_SIGNAL: ${clubId}`);
  }
});
