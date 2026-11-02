// HM-ALPHA3 release readiness: the management loop across systems --
// a loan's wage share, a staff hire and a dismissal each reach the monthly
// books exactly once, and the forecast reads wages the way the close bills
// them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import type { CareerState } from "./types";
import { getClubPlayerWageCostsEurAnnual } from "../economy/clubEconomyIntegration";
import { closeDueMonths, ensureClubFinances, projectClubFinances } from "../economy/ledger";
import { loanPlayerOut } from "../transfers/transferExecution";
import type { LoanRecord } from "../transfers/types";
import { ensureStaffMarket, staffKnowledge } from "../staff/staffMarket";
import { dismissalCost, dismissStaff, hireFreeAgent } from "../staff/staffNegotiation";

const SKOVDE = "se_club_ifk_skovde_hk";
const BORROWER = "se_club_hk_malmo";

function career(): CareerState {
  const squads = { ...snapshotWorldSquads("se_handbollsligan_herr"), ...snapshotWorldSquads("swe-2") };
  const ratings = { ...snapshotGameplayRatings("se_handbollsligan_herr"), ...snapshotGameplayRatings("swe-2") };
  return createNewCareerState("loop-tests", SKOVDE, squads, undefined, ratings);
}

const line = (state: CareerState, clubId: string, month: string, category: string) =>
  state.clubFinances![clubId]!.statements.find((s) => s.month === month)?.lines.find((l) => l.category === category)?.amountEur ?? 0;

test("a loan's wage share is billed to both clubs and the forecast agrees with the close", () => {
  let state = ensureClubFinances(career(), "2026-08-19");
  const contract = Object.values(state.playerContracts).filter((c) => c.clubId === SKOVDE).sort((a, b) => b.wageEurPerMonth - a.wageEurPerMonth)[0]!;
  const before = { parent: getClubPlayerWageCostsEurAnnual(state, SKOVDE), borrower: getClubPlayerWageCostsEurAnnual(state, BORROWER) };
  state = loanPlayerOut(state, contract.playerId, SKOVDE, BORROWER);
  const loan: LoanRecord = { id: "loop-loan", playerId: contract.playerId, parentClubId: SKOVDE, borrowingClubId: BORROWER, startDate: "2026-08-20", endDate: "2027-05-31", wageShareBorrowingPct: 40, originalWageEurPerMonth: contract.wageEurPerMonth, active: true };
  state = { ...state, loans: { ...state.loans, [loan.id]: loan } };

  const share = contract.wageEurPerMonth * 12 * 0.4;
  assert.equal(Math.round(getClubPlayerWageCostsEurAnnual(state, SKOVDE)), Math.round(before.parent - share));
  assert.equal(Math.round(getClubPlayerWageCostsEurAnnual(state, BORROWER)), Math.round(before.borrower + share));

  const forecast = projectClubFinances(state, SKOVDE)[0]!;
  assert.equal(forecast.month, "2026-09");
  const closed = closeDueMonths(state, "2026-10-01").state;
  assert.equal(line(closed, SKOVDE, "2026-09", "PLAYER_WAGES"), -Math.round(getClubPlayerWageCostsEurAnnual(state, SKOVDE) / 12));
  assert.ok(Math.abs(forecast.breakdown.playerWagesEur + line(closed, SKOVDE, "2026-09", "PLAYER_WAGES")) <= 1, "forecast and close bill the same player wages");
});

test("a staff hire reaches the next close once; a dismissal books its severance once and the wage stops", () => {
  let state = ensureStaffMarket(ensureClubFinances(career(), "2026-08-19"));
  const [staffId, agent] = Object.entries(state.staffMarket!.freeAgents)[0]!;
  assert.ok(agent);
  const staffBefore = -line(closeDueMonths(state, "2026-10-01").state, SKOVDE, "2026-09", "STAFF_WAGES");

  state = hireFreeAgent(state, staffId, SKOVDE, 900, "2028-05-31");
  state = closeDueMonths(state, "2026-10-01").state;
  assert.equal(-line(state, SKOVDE, "2026-09", "STAFF_WAGES"), staffBefore + 900);
  assert.equal(closeDueMonths(state, "2026-10-01").closed.length, 0, "September is not billed twice");

  state = { ...state, gameDate: "2026-10-05" };
  const severance = dismissalCost(state, staffId);
  assert.equal(severance, 900 * 6, "remaining wages, capped at six months");
  const cashBefore = state.clubEconomies[SKOVDE]!.cashEur;
  state = dismissStaff(state, staffId, "2026-10-05");
  assert.equal(state.clubEconomies[SKOVDE]!.cashEur, cashBefore - severance);
  assert.equal(staffKnowledge(state, staffId), 100, "a person who worked for the club stays fully known after leaving");
  state = closeDueMonths(state, "2026-11-01").state;
  const october = state.clubFinances![SKOVDE]!.statements.find((s) => s.month === "2026-10")!;
  assert.deepEqual(october.transactions.filter((t) => t.category === "STAFF_COMPENSATION").map((t) => t.amountEur), [-severance]);
  assert.equal(-line(state, SKOVDE, "2026-10", "STAFF_WAGES"), staffBefore, "the dismissed person's wage is gone from the next close");
});
