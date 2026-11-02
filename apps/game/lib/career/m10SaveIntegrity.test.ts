// HM-ALPHA3-M10 (save & contract integrity): loading a career must not move
// wages. Recalibration runs once per salary-formula version, legacy saves
// migrate only when their whole wage scale predates HM-WAGE-MARKET-1.0, and
// save -> load -> save keeps the economic state.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { migrateCareerState } from "./saveMigration";
import { getCareerClubSquad } from "./careerWorld";
import { CLUBS, TUMBA_CLUB_ID } from "../game-data";
import { competitionClubIds } from "../competition/tables";
import { CONTRACT_WAGE_FORMULA_VERSION, getPlayerFairWageEurPerMonth } from "../economy/contractIntegration";
import type { CareerState } from "./types";
import type { CompetitionTie } from "../competition/types";
import { ALLSVENSKAN, KVAL_ALLSVENSKAN } from "../competition/rules";
import { newSeasonOutcome } from "../competition/season";
import { rolloverSeason } from "./seasonRollover";
import { compactCareerHistory } from "./historyCompaction";

const base = migrateCareerState(createNewCareerState("m10-wages", TUMBA_CLUB_ID));
const wages = (s: CareerState) => Object.fromEntries(Object.entries(s.playerContracts).map(([id, c]) => [id, c.wageEurPerMonth]));
const roundTrip = (s: CareerState): CareerState => migrateCareerState(JSON.parse(JSON.stringify(s)));

test("a migrated career is stamped with the current salary formula version", () => {
  assert.equal(base.contractWageFormulaVersion, CONTRACT_WAGE_FORMULA_VERSION);
});

test("reloading keeps unnegotiated wages after a match-role change moves the salary formula", () => {
  const squad = getCareerClubSquad(base, TUMBA_CLUB_ID);
  const playerMatchDefaults = { ...base.playerMatchDefaults };
  for (const p of squad) playerMatchDefaults[p.id] = { ...(playerMatchDefaults[p.id] ?? { playingTimeIntention: "NORMAL", phaseUsage: "BOTH" }), matchRole: "DEVELOPMENT" } as never;
  const changed: CareerState = { ...base, playerMatchDefaults };
  const moved = squad.filter((p) => getPlayerFairWageEurPerMonth(changed, p.id) !== changed.playerContracts[p.id].wageEurPerMonth);
  assert.ok(moved.length > 0, "the role change must move the formula wage for at least one player");
  assert.deepEqual(wages(roundTrip(changed)), wages(changed));
});

test("an unstamped legacy save on the current wage scale keeps every wage and is only stamped", () => {
  const { contractWageFormulaVersion: _drop, ...legacy } = base;
  const squad = getCareerClubSquad(base, TUMBA_CLUB_ID);
  const drifted: CareerState = { ...(legacy as CareerState), playerContracts: { ...legacy.playerContracts, [squad[0].id]: { ...legacy.playerContracts[squad[0].id], wageEurPerMonth: legacy.playerContracts[squad[0].id].wageEurPerMonth * 1.4 } } };
  const migrated = migrateCareerState(drifted);
  assert.deepEqual(wages(migrated), wages(drifted));
  assert.equal(migrated.contractWageFormulaVersion, CONTRACT_WAGE_FORMULA_VERSION);
});

test("an unstamped save on the pre-wage-market scale (about 2.5x) is recalibrated once; negotiated wages stay", () => {
  const { contractWageFormulaVersion: _drop, ...legacy } = base;
  const [agreedId] = Object.keys(legacy.playerContracts);
  const inflated = Object.fromEntries(Object.entries(legacy.playerContracts).map(([id, c]) => [id, { ...c, wageEurPerMonth: Math.round(c.wageEurPerMonth * 2.5), ...(id === agreedId ? { wageAgreed: true } : {}) }]));
  const migrated = migrateCareerState({ ...(legacy as CareerState), playerContracts: inflated });
  assert.equal(migrated.playerContracts[agreedId].wageEurPerMonth, inflated[agreedId].wageEurPerMonth);
  for (const [id, w] of Object.entries(wages(base))) if (id !== agreedId) assert.equal(migrated.playerContracts[id].wageEurPerMonth, w);
  assert.deepEqual(wages(roundTrip(migrated)), wages(migrated), "the second load is a no-op");
});

test("a save stamped with an older formula version is recalibrated once to the current formula", () => {
  const old: CareerState = { ...base, contractWageFormulaVersion: CONTRACT_WAGE_FORMULA_VERSION - 1, playerContracts: Object.fromEntries(Object.entries(base.playerContracts).map(([id, c]) => [id, { ...c, wageEurPerMonth: c.wageEurPerMonth + 7 }])) };
  const migrated = migrateCareerState(old);
  assert.deepEqual(wages(migrated), wages(base));
  assert.equal(migrated.contractWageFormulaVersion, CONTRACT_WAGE_FORMULA_VERSION);
});

test("save -> load -> save preserves contracts, finances and the formula stamp exactly", () => {
  const once = roundTrip(base);
  const twice = roundTrip(once);
  assert.deepEqual(twice.playerContracts, once.playerContracts);
  assert.deepEqual(twice.clubFinances, once.clubFinances);
  assert.deepEqual(twice.clubEconomies, once.clubEconomies);
  assert.equal(twice.contractWageFormulaVersion, once.contractWageFormulaVersion);
});

// ---------------------------------------------------------------------------
// Long-career structure: promotion/relegation membership and bounded history
// ---------------------------------------------------------------------------

test("a relegation play-off loser goes to the challenger's actual Division 1 group, also in saves made before the fix", () => {
  const s0 = createNewCareerState("m10-kval", TUMBA_CLUB_ID);
  const challenger = "swe2-drott"; // catalogue league Allsvenskan, relegated earlier in this career
  const defender = "swe2-redbergslid";
  const tie: CompetitionTie = { id: `${s0.seasonId}:kval-allsv:A1`, seasonId: s0.seasonId, competitionId: KVAL_ALLSVENSKAN, stage: "KVAL_ALLSV", label: "Kval 1", highClubId: defender, lowClubId: challenger, format: { kind: "TWO_LEGS" }, fixtureIds: [], winnerClubId: challenger, loserClubId: defender, key: "A1", stakes: { highCompetitionId: ALLSVENSKAN, lowCompetitionId: ALLSVENSKAN } };
  const before: CareerState = {
    ...s0,
    seasonComplete: true,
    competitionMembership: { ...s0.competitionMembership, [challenger]: "se_division1_sodra", se_club_hk_s_hof: ALLSVENSKAN }, // an earlier swap: Drott down, S-hof up
    competitionTies: { [tie.id]: tie },
    seasonOutcome: { ...newSeasonOutcome(s0), phase: "COMPLETE", nextMembership: { [challenger]: ALLSVENSKAN, [defender]: ALLSVENSKAN } },
  };
  const after = rolloverSeason(before);
  assert.equal(after.competitionMembership?.[challenger], ALLSVENSKAN);
  assert.equal(after.competitionMembership?.[defender], "se_division1_sodra", "the beaten Allsvenskan club drops to Division 1, not back into Allsvenskan");
});

test("season rollover trims old working records but keeps history and anything still open", () => {
  const s0 = createNewCareerState("m10-compact", TUMBA_CLUB_ID);
  const today = "2029-05-31";
  const old = "2027-04-01", recent = "2029-03-01";
  const msg = (id: string, date: string, open = false) => ({ id, category: "Klubb", sender: "x", subject: id, preview: "", body: "", date, read: true, important: false, archived: false, resolved: !open, priority: "INFORMATION", actionRequired: open }) as never;
  const state: CareerState = { ...s0, inbox: [msg("old", old), msg("recent", recent), msg("open", old, true)] };
  const out = compactCareerHistory(state, today);
  assert.deepEqual(out.inbox.map((m) => m.id), ["recent", "open"]);
  assert.deepEqual(out.seasonHistory, state.seasonHistory);
  assert.deepEqual(out.playerContracts, state.playerContracts);
  assert.deepEqual(out.clubFinances, state.clubFinances);
  assert.deepEqual(compactCareerHistory(out, today), out, "idempotent");
});

test("Division 1 groups that drifted apart are evened out at rollover, so every group can get a fixture list", () => {
  const s0 = createNewCareerState("m10-div1", TUMBA_CLUB_ID);
  const sodra = CLUBS.filter((c) => c.competitionId === "se_division1_sodra").slice(0, 3).map((c) => c.id);
  const drifted: CareerState = { ...s0, seasonComplete: true, competitionMembership: { ...s0.competitionMembership, ...Object.fromEntries(sodra.map((id) => [id, "se_division1_norra"])) } };
  const size = (s: CareerState, g: string) => competitionClubIds(s, g).length;
  assert.equal(size(drifted, "se_division1_norra") - size(drifted, "se_division1_sodra"), 6);
  const after = rolloverSeason(drifted);
  assert.ok(Math.abs(size(after, "se_division1_norra") - size(after, "se_division1_sodra")) <= 1);
  assert.equal(size(after, "se_division1_norra") + size(after, "se_division1_sodra"), size(drifted, "se_division1_norra") + size(drifted, "se_division1_sodra"));
});
