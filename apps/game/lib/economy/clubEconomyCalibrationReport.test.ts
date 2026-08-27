// HM-ECONOMY-1.0: the mandatory calibration report -- real engine output
// across a sample of real career clubs, logged for manual review (same
// "report actual numbers, never silently tune to hit a preconceived
// target" philosophy as lib/economy/calibrationReport.test.ts). This is
// also the ONE place that directly answers the milestone's own central
// question: "har klubbarna faktiskt råd att operera på den marknad vi
// skapat?" -- by comparing real generated club economies against the
// EXISTING, separately-calibrated player wage model (marketValue.ts),
// never retuning either system to make the comparison look better.
import { test } from "node:test";
import { createNewCareerState } from "../career/newCareer";
import { getClubsByCompetition, TUMBA_CLUB_ID } from "../game-data";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { getClubEconomySnapshot } from "./clubEconomyIntegration";
import { formatEur } from "./currency";
import { generateClubEconomyBaseline } from "./clubEconomyGeneration";

const HANDBOLLSLIGAN_ID = "se_handbollsligan_herr";

function reportRow(label: string, snapshot: ReturnType<typeof getClubEconomySnapshot>) {
  if (!snapshot) return { CLUB: label, BAND: "-", REVENUE: "-", "PLAYER WAGES": "-", "WAGE BUDGET": "-", "TRANSFER BUDGET": "-", CASH: "-", HEALTH: "no data" };
  return {
    CLUB: label,
    BAND: snapshot.band,
    REVENUE: formatEur(snapshot.recurringRevenueEur),
    "PLAYER WAGES": formatEur(snapshot.playerWageCostsEurAnnual),
    "WAGE BUDGET": formatEur(snapshot.budgets.wageBudgetEur),
    "TRANSFER BUDGET": formatEur(snapshot.budgets.transferBudgetEur),
    CASH: formatEur(snapshot.cashEur),
    HEALTH: snapshot.health.pressure + (snapshot.budgets.wageOverBudget ? " (OVER BUDGET)" : ""),
  };
}

test("Part: HM-ECONOMY-1.0 calibration report -- Tumba, Allsvenskan, Handbollsligan, top club, illustrative European archetype", () => {
  // IFK Tumba -- Allsvenskan (mock competition, only Tumba itself has a real squad).
  const tumbaState = createNewCareerState("calib-tumba", TUMBA_CLUB_ID);
  const tumbaRow = reportRow("IFK Tumba (Allsvenskan)", getClubEconomySnapshot(tumbaState, TUMBA_CLUB_ID));

  // A second Allsvenskan club -- honestly has NO squad/contract data at
  // all (Allsvenskan is mock-only besides Tumba -- see careerWorld.ts's
  // own getCareerClubSquad fallback), so its wage costs are genuinely 0,
  // not a bug -- this is reported as-is, not papered over.
  const otherAllsvenskanId = getClubsByCompetition(tumbaState.competitionId).find((c) => c.id !== TUMBA_CLUB_ID)!.id;
  const otherAllsvenskanRow = reportRow(`Annan Allsvenskan-klubb (${otherAllsvenskanId}, ingen truppdata)`, getClubEconomySnapshot(tumbaState, otherAllsvenskanId));

  // Handbollsligan -- real worldSquads/gameplayRatings, so every club has genuine player wage data.
  const worldSquads = snapshotWorldSquads(HANDBOLLSLIGAN_ID);
  const gameplayRatings = snapshotGameplayRatings(HANDBOLLSLIGAN_ID);
  const hlState = createNewCareerState("calib-hl", "se_club_ifk_skovde_hk", worldSquads, {}, gameplayRatings);
  const hlClubIds = getClubsByCompetition(hlState.competitionId).map((c) => c.id);
  const hlSnapshots = hlClubIds.map((id) => ({ id, snapshot: getClubEconomySnapshot(hlState, id)! })).filter((x) => x.snapshot);

  const bandRank: Record<string, number> = { E1: 1, E2: 2, E3: 3, E4: 4, E5: 5, E6: 6, E7: 7 };
  const sortedByBand = [...hlSnapshots].sort((a, b) => bandRank[a.snapshot.band] - bandRank[b.snapshot.band]);
  const topClub = sortedByBand[0];
  const normalHlClub = sortedByBand[Math.floor(sortedByBand.length / 2)];

  const topRow = reportRow(`Svenskt topplag (${topClub.id})`, topClub.snapshot);
  const normalHlRow = reportRow(`Normal Handbollsligan-klubb (${normalHlClub.id})`, normalHlClub.snapshot);

  // Illustrative-only European archetype -- NOT a real club, NOT persisted anywhere, just the same pure generator forced into a richer band to show what E2-scale would look like next to Swedish handball's own real scale.
  const europeanBaseline = generateClubEconomyBaseline("illustrative-european-e2", 1);
  const forcedE2 = { ...europeanBaseline, band: "E2" as const, revenue: { commercialRevenueEur: 2_400_000, mediaRevenueEur: 1_600_000, matchdayRevenueEur: 2_400_000, sportingRevenueEur: 640_000, otherRevenueEur: 960_000 } };
  const europeanRevenue = forcedE2.revenue.commercialRevenueEur + forcedE2.revenue.mediaRevenueEur + forcedE2.revenue.matchdayRevenueEur + forcedE2.revenue.sportingRevenueEur + forcedE2.revenue.otherRevenueEur;
  const europeanRow = {
    CLUB: "Illustrativt europeiskt E2-arketyp (hypotetisk, ej en riktig klubb)",
    BAND: "E2",
    REVENUE: formatEur(europeanRevenue),
    "PLAYER WAGES": "-",
    "WAGE BUDGET": formatEur(Math.round(europeanRevenue * 0.55 * 1.25)),
    "TRANSFER BUDGET": "-",
    CASH: "-",
    HEALTH: "illustrative only",
  };

  const rows = [tumbaRow, otherAllsvenskanRow, normalHlRow, topRow, europeanRow];

  // eslint-disable-next-line no-console
  console.log("HM-ECONOMY-1.0 calibration report -- real engine output:");
  // eslint-disable-next-line no-console
  console.table(rows);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(rows, null, 1));

  // eslint-disable-next-line no-console
  console.log("\nFull Handbollsligan club sample (all 14 clubs, real player wage data):");
  // eslint-disable-next-line no-console
  console.table(hlSnapshots.map(({ id, snapshot }) => reportRow(id, snapshot)));

  // No hard assertions on wages <= wageBudget here -- deliberately. This
  // report exists to SURFACE whether the existing, separately-calibrated
  // player wage model (HM-CONTRACTS-1.0/1.0A) is compatible with the
  // club economy this milestone generates, per the user's own explicit
  // instruction: "Om player-value/wage-modellen ser inkompatibel ut:
  // rapportera det. Retuna inte andra system i smyg." See the milestone
  // completion report for the actual finding.
});
