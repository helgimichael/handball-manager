// HM-ALPHA3 (M02-M04): an older save -- written before the ledger, the season
// engine and the staff market existed -- keeps working when loaded mid-season.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { processDay } from "./dailyTick";
import { addDays } from "./dateUtils";
import { migrateCareerState } from "./saveMigration";
import type { CareerState } from "./types";

const ME = "se_club_ifk_skovde_hk";

/** A pre-Alpha-3 shaped save: one league only, no ledger, no competition or staff-market state, joined in mid-October. */
function legacyMidSeasonSave(): CareerState {
  const squads = snapshotWorldSquads("se_handbollsligan_herr");
  let state = createNewCareerState("legacy-compat", ME, squads, undefined, snapshotGameplayRatings("se_handbollsligan_herr"));
  const d = "2026-10-15";
  state = { ...state, gameDate: d, processedThroughDate: d };
  const { clubFinances: _f, budgetPlans: _b, competitionMembership: _m, competitionTies: _t, seasonOutcome: _o, staffMarket: _s, staffKnowledge: _k, staffResearch: _r, staffNegotiations: _n, staffAppointments: _a, ...legacy } = state;
  return JSON.parse(JSON.stringify(legacy)) as CareerState;
}

test("an older mid-season save loads, starts the ledger without back-billing, and keeps only its own league this season", () => {
  let state = migrateCareerState(legacyMidSeasonSave());
  const fixturesBefore = state.fixtures.length;
  let date = state.gameDate;
  for (let i = 0; i < 50; i++) {
    date = addDays(date, 1);
    state = processDay(state, date).state;
  }
  const finance = state.clubFinances![ME]!;
  assert.equal(finance.activatedOn, "2026-10-16");
  assert.equal(finance.firstBillableMonth, "2026-11");
  assert.deepEqual(finance.statements.map((s) => s.month), ["2026-11"], "October is never billed retroactively");
  assert.equal(state.fixtures.filter((f) => f.competitionId === "swe-2").length, 0, "no half-season calendar is fabricated for the other tier");
  assert.equal(state.fixtures.length >= fixturesBefore, true);
  assert.equal(state.seasonOutcome?.bothTiersSimulated, false);
  assert.ok(state.staffMarket?.seasonId === state.seasonId, "the staff market starts lazily too");
});

test("loading never changes a save's money until a month closes (no activation-day charge)", () => {
  const legacy = migrateCareerState(legacyMidSeasonSave());
  const cashBefore = legacy.clubEconomies[ME]!.cashEur;
  const after = processDay(legacy, addDays(legacy.gameDate, 1)).state;
  assert.equal(after.clubEconomies[ME]!.cashEur, cashBefore);
});
