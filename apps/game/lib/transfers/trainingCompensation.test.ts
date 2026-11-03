import test from "node:test";
import assert from "node:assert/strict";
import {
  calculatePlayerTrainingCompensation,
  calculateAcquisitionCost,
  SHF_2026_2027_TABLE,
  EHF_IHF_2026_TABLE,
} from "./trainingCompensation";
import { createNewCareerState } from "../career/newCareer";
import { snapshotWorldSquads, snapshotGameplayRatings } from "../gameWorld/serverSnapshot";
import { getCareerClubSquad } from "../career/careerWorld";

const HANDBOLLSLIGAN_ID = "se_handbollsligan_herr";

function makeTestState(playerClubId: string) {
  const worldSquads = snapshotWorldSquads(HANDBOLLSLIGAN_ID);
  const gameplayRatings = snapshotGameplayRatings(HANDBOLLSLIGAN_ID);
  return createNewCareerState(`tc-test-${playerClubId}`, playerClubId, worldSquads, {}, gameplayRatings);
}

test("HM-PLAYTEST-IMPROVEMENT-02: training compensation age boundaries comply with SHF 2026-2027", () => {
  const state = makeTestState("se_club_ifk_skovde_hk");
  const squad = getCareerClubSquad(state, "se_club_ifk_skovde_hk");
  assert.ok(squad.length > 0);

  // Find or check players of different ages
  for (const p of squad) {
    const res = calculatePlayerTrainingCompensation(state, p.id, "se_club_ifk_skovde_hk", "se_club_ifk_skovde_hk");
    if (res.playerAge !== null) {
      if (res.playerAge > 23) {
        assert.equal(res.totalEur, 0, `Player aged ${res.playerAge} should not generate compensation`);
        assert.equal(res.eligible, false);
      } else if (res.playerAge >= 16 && res.playerAge <= 23 && res.perClub.length > 0) {
        assert.ok(res.totalEur > 0, `Eligible youth player aged ${res.playerAge} should have compensation`);
        assert.equal(res.eligible, true);
        assert.match(res.ruleSetVersion, /SHF_2026_2027/);
      }
    }
  }
});

test("HM-PLAYTEST-IMPROVEMENT-02: Handbollsligan acquiring club pays higher rate than Allsvenskan acquiring club", () => {
  const state = makeTestState("se_club_ifk_skovde_hk");
  const squad = getCareerClubSquad(state, "se_club_ifk_skovde_hk");
  // Find a young player under 24
  const youngPlayer = squad.find((p) => {
    const res = calculatePlayerTrainingCompensation(state, p.id, "se_club_ifk_skovde_hk");
    return res.playerAge !== null && res.playerAge >= 17 && res.playerAge <= 21;
  });

  if (youngPlayer) {
    // Handbollsligan club (Tier 1) buying
    const toHl = calculatePlayerTrainingCompensation(state, youngPlayer.id, "se_club_ik_savehof", youngPlayer.clubId);
    // Allsvenskan club (Tier 2) buying
    const toAllsvenskan = calculatePlayerTrainingCompensation(state, youngPlayer.id, "se_club_ifk_tumba_hk", youngPlayer.clubId);

    assert.ok(toHl.totalEur > toAllsvenskan.totalEur, "Handbollsligan acquiring club must pay higher compensation than Allsvenskan club");
    assert.equal(toHl.isDomesticTransfer, true);
    assert.equal(toAllsvenskan.isDomesticTransfer, true);
  }
});

test("HM-PLAYTEST-IMPROVEMENT-02: international transfers use EHF/IHF ITC Education Compensation tables", () => {
  const state = makeTestState("se_club_ifk_skovde_hk");
  const squad = getCareerClubSquad(state, "se_club_ifk_skovde_hk");
  const youngPlayer = squad.find((p) => {
    const res = calculatePlayerTrainingCompensation(state, p.id, "se_club_ifk_skovde_hk");
    return res.playerAge !== null && res.playerAge >= 18 && res.playerAge <= 22;
  });

  if (youngPlayer) {
    // International buyer (mock foreign club or external id)
    const internationalRes = calculatePlayerTrainingCompensation(state, youngPlayer.id, "ger_club_thw_kiel", youngPlayer.clubId);
    assert.equal(internationalRes.isDomesticTransfer, false);
    assert.match(internationalRes.ruleSetVersion, /EHF_IHF_ITC_2026/);
    assert.match(internationalRes.documentationNote, /EHF\/IHF/i);
    for (const share of internationalRes.perClub) {
      assert.equal(share.isDomestic, false);
      assert.equal(share.ratePerSeasonEur, EHF_IHF_2026_TABLE.perSeasonEur.category1Nation);
    }
  }
});

test("HM-PLAYTEST-IMPROVEMENT-02: free transfers strictly distinguish fee from total acquisition cost", () => {
  const breakdown = calculateAcquisitionCost({
    transferFeeEur: 0,
    trainingCompensationEur: 12000,
    signingCostsEur: 3000,
    monthlyWageEur: 2500,
    contractYears: 2,
  });

  assert.equal(breakdown.isFreeTransfer, true);
  assert.equal(breakdown.transferFeeEur, 0);
  assert.equal(breakdown.trainingCompensationEur, 12000);
  assert.equal(breakdown.signingCostsEur, 3000);
  assert.equal(breakdown.annualWageEur, 30000);
  // First year commitment = 0 + 12000 + 3000 + 30000 = 45000
  assert.equal(breakdown.totalFirstYearCommitmentEur, 45000);
  // Total contract commitment = 0 + 12000 + 3000 + 60000 = 75000
  assert.equal(breakdown.totalContractCommitmentEur, 75000);
  assert.ok(breakdown.totalFirstYearCommitmentEur > 0, "A free transfer has non-zero total acquisition cost when training compensation is due");
});

test("HM-PLAYTEST-IMPROVEMENT-02: missing youth registrations provide documented approximation note", () => {
  const state = makeTestState("se_club_ifk_skovde_hk");
  const squad = getCareerClubSquad(state, "se_club_ifk_skovde_hk");
  const youngPlayer = squad.find((p) => {
    const res = calculatePlayerTrainingCompensation(state, p.id, "se_club_ifk_skovde_hk");
    return res.playerAge !== null && res.playerAge >= 17 && res.playerAge <= 21 && res.isApproximation;
  });

  if (youngPlayer) {
    const res = calculatePlayerTrainingCompensation(state, youngPlayer.id, "se_club_ik_savehof");
    assert.equal(res.isApproximation, true);
    assert.match(res.documentationNote, /schablonberäkning/i);
    assert.doesNotMatch(res.documentationNote, /verifierad historik/i);
  }
});
