// Arena Nights -- Finance Cockpit view models: figures straight from lib/economy, the reallocation clamped as the rule.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import { ensureSeasonCalendar } from "../competition/seasonCalendar";
import { ensureClubFinances, projectClubFinances } from "../economy/ledger";
import { getClubEconomyBaseline, MAX_BUDGET_SHIFT_SHARE } from "../economy/clubEconomyIntegration";
import { setBudgetPlan } from "../economy/budgetPlan";
import type { CareerState } from "../career/types";
import type { MonthlyStatement } from "../economy/ledgerTypes";
import { budgetSlider, financeActions, financeKpis, ledgerMonths, projectionBand } from "./financeCockpit";

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
let base: string | undefined;
function career(): CareerState {
  if (!base) {
    const ids = ["swe-2"];
    const s = createNewCareerState("finance-cockpit", "swe2-tumba", Object.assign({}, ...ids.map((c) => snapshotWorldSquads(c))), undefined, Object.assign({}, ...ids.map((c) => snapshotGameplayRatings(c))), Object.assign({}, ...ids.map((c) => snapshotAllClubsStaff(c))));
    base = JSON.stringify(ensureSeasonCalendar(ensureClubFinances(s, s.gameDate)));
  }
  return JSON.parse(base) as CareerState;
}

test("kpis: cash from the baseline, season-end from the projection, pure", () => {
  const s = career();
  const before = hash(s);
  const projection = projectClubFinances(s, s.playerClubId);
  const k = financeKpis(s, s.playerClubId, projection)!;
  assert.equal(hash(s), before);
  assert.equal(k.cashEur, getClubEconomyBaseline(s, s.playerClubId)!.cashEur);
  assert.ok(k.floorEur <= 0);
  if (k.seasonEndEur !== null) assert.equal(k.seasonEndDeltaEur, k.seasonEndEur - k.cashEur);
  assert.equal(k.lastMonthEur, null, "no closed month on day one");
});

test("actions: every warning has exactly one verb and a real route", () => {
  const s = career();
  const actions = financeActions(s, s.playerClubId, projectClubFinances(s, s.playerClubId));
  assert.ok(actions.some((a) => a.id === "budget"), "an unplanned season asks for the budget decision");
  for (const a of actions) { assert.ok(a.verb.length > 0); assert.match(a.href, /^\/career\//); }
  const planned = setBudgetPlan(s, 0);
  assert.ok(!financeActions(planned, planned.playerClubId, projectClubFinances(planned, planned.playerClubId)).some((a) => a.id === "budget"));
});

test("budget slider: clamps exactly like the board rule and previews both budgets", () => {
  const s = career();
  const b = budgetSlider(s, s.playerClubId, 10 ** 12)!;
  assert.equal(b.shiftEur, b.maxOutEur);
  assert.equal(b.maxOutEur, Math.round(b.boardWageEur * MAX_BUDGET_SHIFT_SHARE));
  assert.equal(b.wageEur + b.transferEur, b.boardWageEur + b.boardTransferEur, "money moves 1:1");
  assert.equal(b.marginUsed, b.maxOutEur ? 1 : 0);
  const back = budgetSlider(s, s.playerClubId, -(10 ** 12))!;
  assert.equal(back.shiftEur, -back.maxInEur);
  // The confirmed plan stores the same clamped number the preview showed.
  const planned = setBudgetPlan(s, b.shiftEur);
  assert.equal(planned.budgetPlans![planned.playerClubId]!.wageToTransferEur, b.shiftEur);
  assert.equal(budgetSlider(planned, planned.playerClubId, b.shiftEur)!.activeShiftEur, b.shiftEur);
});

test("ledger months newest first with a cash path; projection band never above the projection", () => {
  const st = (month: string, open: number, close: number): MonthlyStatement => ({ month, closedOn: `${month}-28`, openingCashEur: open, closingCashEur: close, lines: [], transactions: [], homeMatches: [] });
  const rows = ledgerMonths([st("2026-08", 100, 90), st("2026-09", 90, 120)]);
  assert.deepEqual(rows.map((r) => r.month), ["2026-09", "2026-08"]);
  assert.equal(rows[0]!.netEur, 30);
  assert.deepEqual(rows[0]!.spark, [100, 90, 120]);
  const s = career();
  for (const b of projectionBand(projectClubFinances(s, s.playerClubId))) assert.ok(b.low <= b.high);
});
