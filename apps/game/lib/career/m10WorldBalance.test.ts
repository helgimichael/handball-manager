// HM-ALPHA3-M10 completion: CPU squad planning, wage discipline, the Division 1
// economic tier, and national-duty injuries for CPU players.
import { test } from "node:test";
import assert from "node:assert/strict";
import { decideContractAction, type ContractDecisionInputs } from "./cpuContractDecisions";
import { SQUAD_PLANNING_SIZE } from "./squadPlanning";
import { createNewCareerState } from "./newCareer";
import { TUMBA_CLUB_ID, CLUBS } from "../game-data";
import { clubOperationsCostEurAnnual, tierRevenueFactor } from "../economy/clubEconomyIntegration";
import { withoutNationalDuty } from "../nationalTeam/duty";
import type { CareerState } from "./types";

const ordinary: ContractDecisionInputs = {
  tier: "ROTATION", age: 26, ca: 100, paHeadroom: 2, positionRank: 3, caGapToPositionBest: 6, caVsClubAvg: 0.95,
  wageEurPerMonth: 1000, fairWageEurPerMonth: 1000, financialPressure: "NONE",
  daysUntilExpiry: 20, needIfLeaves: "LOW", needIfLeavesSaturated: false, hasAgreedReplacement: false,
};

test("a surplus player is renewed within the planned squad size and let go above it", () => {
  assert.equal(decideContractAction({ ...ordinary, squadSize: SQUAD_PLANNING_SIZE }).decision, "RENEW");
  const over = decideContractAction({ ...ordinary, squadSize: SQUAD_PLANNING_SIZE + 3 });
  assert.equal(over.decision, "RELEASE");
  assert.match(over.reasons.join(" "), /större än klubben planerar/);
  assert.equal(decideContractAction({ ...ordinary, squadSize: SQUAD_PLANNING_SIZE + 3, daysUntilExpiry: 200 }).decision, "WAIT", "not decided early");
});

test("squad planning never thins a position, and never touches a key player", () => {
  assert.equal(decideContractAction({ ...ordinary, squadSize: 28, needIfLeaves: "HIGH" }).decision, "RENEW");
  assert.equal(decideContractAction({ ...ordinary, tier: "KEY_PLAYER", positionRank: 1, caGapToPositionBest: 0, caVsClubAvg: 1.2, squadSize: 28 }).decision, "RENEW");
  assert.equal(decideContractAction({ ...ordinary, tier: "FIRST_CHOICE", positionRank: 1, caVsClubAvg: 1.1, squadSize: 28 }).decision, "RENEW", "a first-choice player at the club's level stays");
});

test("a wage bill over the club's own budget counts as financial pressure", () => {
  const dear = { ...ordinary, positionRank: 2, caVsClubAvg: 1.0, wageEurPerMonth: 1300, fairWageEurPerMonth: 1000, needIfLeavesSaturated: false };
  assert.equal(decideContractAction(dear).decision, "RENEW");
  assert.equal(decideContractAction({ ...dear, wageBillOverBudget: true }).decision, "RELEASE");
});

test("Division 1 is an economic tier below Allsvenskan: relegation into it and promotion out of it move revenue", () => {
  const s = createNewCareerState("m10-tier", TUMBA_CLUB_ID);
  const allsv = CLUBS.find((c) => c.competitionId === "swe-2")!.id;
  const div1 = CLUBS.find((c) => c.competitionId === "se_division1_sodra")!.id;
  const hbl = CLUBS.find((c) => c.competitionId === "se_handbollsligan_herr")!.id;
  assert.equal(tierRevenueFactor(s, allsv), 1);
  assert.equal(tierRevenueFactor({ ...s, competitionMembership: { [allsv]: "se_division1_norra" } }, allsv), 0.72);
  assert.equal(tierRevenueFactor({ ...s, competitionMembership: { [div1]: "swe-2" } }, div1), 1.35);
  assert.ok(Math.abs(tierRevenueFactor({ ...s, competitionMembership: { [hbl]: "se_division1_sodra" } }, hbl) - 0.72 ** 2) < 1e-9, "two levels down");
});

test("a CPU player injured on national duty misses his club's matches until he recovers", () => {
  const squad = [{ id: "gk", position: "MV" }, ...["a", "b", "c", "d", "e", "f", "g"].map((id) => ({ id, position: "V6" }))] as never[];
  const injured: Pick<CareerState, "nationalTeam" | "playerStatuses"> = { nationalTeam: { windows: {} }, playerStatuses: { a: { playerId: "a", availability: "INJURED" } } };
  assert.ok(!withoutNationalDuty(injured, squad).some((p: { id: string }) => p.id === "a"));
  const limited: typeof injured = { ...injured, playerStatuses: { a: { playerId: "a", availability: "LIMITED" } } };
  assert.ok(withoutNationalDuty(limited, squad).some((p: { id: string }) => p.id === "a"), "a player in return-to-play may play, as for the manager");
});

test("club operations follow the tier like revenue: a relegated club runs a smaller operation, an unmoved club is unchanged", () => {
  const s = createNewCareerState("m10-clubops", TUMBA_CLUB_ID);
  const allsv = CLUBS.find((c) => c.competitionId === "swe-2")!.id;
  assert.equal(clubOperationsCostEurAnnual(s, allsv, 100_000), 100_000);
  assert.equal(clubOperationsCostEurAnnual({ ...s, competitionMembership: { [allsv]: "se_division1_norra" } }, allsv, 100_000), 72_000);
  assert.equal(clubOperationsCostEurAnnual(s, allsv, -50_000), 0, "association support is income, not a cost");
});
