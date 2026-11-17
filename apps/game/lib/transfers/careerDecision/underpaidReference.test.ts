// HM-TRANSFER-REALISM M8C: a player who has outgrown his contract measures
// money against his market wage. Diagnosed case: a CA-153, 25-year-old
// Allsvenskan player on 240 EUR/month accepted Division 1 for 300 EUR/month,
// because +60 EUR read as a +25% raise.
import test from "node:test";
import assert from "node:assert/strict";
import { createFullWorldCareer } from "../../../scripts/lib/fullWorldCareer";
import { UNDERPAID_REFERENCE_FLOOR, marketWageFactor, playerCareerProfile, playerDecisionOnMove } from "./stateAdapter";
import { getPlayerFairWageEurPerMonth } from "../../economy/contractIntegration";
import { careerWorldClubIds } from "../../career/worldCompetitions";
import { clubCompetitionId } from "../../career/competitionMembership";
import { playerAgeAtDate } from "../../development/developmentIntegration";
import type { CareerState } from "../../career/types";

const base = createFullWorldCareer("m8c-underpaid");
const div1Club = careerWorldClubIds(base).find((id) => (clubCompetitionId(base, id) ?? "").startsWith("se_division1"))!;
const elite = careerWorldClubIds(base)
  .filter((id) => clubCompetitionId(base, id) === "swe-2" || clubCompetitionId(base, id) === "se_handbollsligan_herr")
  .flatMap((id) => (base.gameplayRatings[id] ?? []).map((r) => ({ id: r.playerId, ca: r.ca, clubId: id })))
  .filter((r) => r.ca >= 140 && r.id !== undefined)
  .filter((r) => {
    const p = base.worldSquads[r.clubId].find((x) => x.id === r.id)!;
    return (playerAgeAtDate(p.dateOfBirth, p.birthYear, base.gameDate) ?? 99) < 31;
  })
  .sort((a, b) => b.ca - a.ca || a.id.localeCompare(b.id))[0]!;

function withWage(state: CareerState, playerId: string, wage: number): CareerState {
  return { ...state, playerContracts: { ...state.playerContracts, [playerId]: { ...state.playerContracts[playerId], wageEurPerMonth: wage } } };
}

test("M8C: a fairly paid player's reference is his own wage (unchanged behaviour)", () => {
  const profile = playerCareerProfile(base, elite.id)!;
  assert.equal(profile.referenceWageEurPerMonth, base.playerContracts[elite.id].wageEurPerMonth);
});

test("M8C: a clearly underpaid player's reference is his market wage", () => {
  const market = (getPlayerFairWageEurPerMonth(base, elite.id) ?? 0) * marketWageFactor(base);
  const underpaid = withWage(base, elite.id, Math.round(market * 0.2));
  const profile = playerCareerProfile(underpaid, elite.id)!;
  assert.ok(Math.abs(profile.referenceWageEurPerMonth - UNDERPAID_REFERENCE_FLOOR * market) < 1);
});

test("M8C: an underpaid elite player is not bought into Division 1 by a small raise on a stale wage", () => {
  const market = (getPlayerFairWageEurPerMonth(base, elite.id) ?? 0) * marketWageFactor(base);
  const stale = Math.max(200, Math.round(market * 0.2));
  const underpaid = withWage(base, elite.id, stale);
  const decision = playerDecisionOnMove(underpaid, elite.id, div1Club, { wageEurPerMonth: Math.round(stale * 1.25), contractYears: 3 });
  assert.equal(decision.accept, false, decision.reason);
});

test("M8C: regression case -- an underpaid Allsvenskan regular (Adam Krantz, CA 134) stays out of Division 1 on a small raise", () => {
  // Found by sweeping every Allsvenskan player with CA >= 128 paid 20% of his market wage: without the
  // M8C reference 5 of 80 accepted the strongest Division 1 club for +25%, with it 1 of 80 does.
  const id = "se_player_adam_krantz_990c5b45";
  const div1 = careerWorldClubIds(base).filter((c) => (clubCompetitionId(base, c) ?? "").startsWith("se_division1"));
  const strongest = "se_club_anderstorps_sk";
  assert.ok(div1.includes(strongest));
  const market = (getPlayerFairWageEurPerMonth(base, id) ?? 0) * marketWageFactor(base);
  const stale = Math.max(200, Math.round(market * 0.2));
  const decision = playerDecisionOnMove(withWage(base, id, stale), id, strongest, { wageEurPerMonth: Math.round(stale * 1.25), contractYears: 3 });
  assert.equal(decision.accept, false, decision.reason);
});
