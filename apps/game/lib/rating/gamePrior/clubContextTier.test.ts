// HM-RATINGS-0.6 Part C/O: proves the club context shift is bounded,
// deterministic, and defaults to 0 (no invented bonus) for a club with
// no season-context data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { clubContextShift, populationTierForClub, internationalCompetitionProfile, resolveInternationalPopulationProfile, hmLevelShift } from "./clubContextTier";

test("HM-RATINGS-0.6: clubContextShift returns 0 for an unknown club (never throws, never invents a bonus)", () => {
  assert.equal(clubContextShift("not_a_real_club"), 0);
});

test("HM-RATINGS-0.6: clubContextShift is deterministic", () => {
  assert.equal(clubContextShift("se_club_hammarby_if_hf"), clubContextShift("se_club_hammarby_if_hf"));
});

test("HM-RATINGS-0.6: clubContextShift is bounded to a small range for every real club", () => {
  const realClubIds = [
    "se_club_alingsas_hk",
    "se_club_amo_hk",
    "se_club_hf_karlskrona",
    "se_club_hk_malmo",
    "se_club_hammarby_if_hf",
    "se_club_if_hallby_hk",
    "se_club_ifk_kristianstad",
    "se_club_ifk_skovde_hk",
    "se_club_ik_savehof",
    "se_club_lugi_hf",
    "se_club_ov_helsingborg",
    "se_club_skanela_if",
    "se_club_ystads_if_hf",
    "se_club_onnereds_hk",
  ];
  for (const clubId of realClubIds) {
    const shift = clubContextShift(clubId);
    assert.ok(shift >= -6 && shift <= 6, `${clubId} shift ${shift} out of bounds`);
  }
});

// HM-DATA-DIV1-1.0
test("populationTierForClub: every existing Handbollsligan/Allsvenskan club and every unknown clubId resolves to STANDARD", () => {
  assert.equal(populationTierForClub("se_club_hammarby_if_hf"), "STANDARD");
  assert.equal(populationTierForClub("swe2-tumba"), "STANDARD");
  assert.equal(populationTierForClub("not_a_real_club"), "STANDARD");
});

test("populationTierForClub: a Division 1 Norra or Södra club resolves to DIVISION_1", () => {
  assert.equal(populationTierForClub("se_club_bodens_bk_hf"), "DIVISION_1"); // Division 1 Norra
  assert.equal(populationTierForClub("se_club_ahus_handboll"), "DIVISION_1"); // Division 1 Södra
});

// HM-WORLD-PLAYER-POOL-1.0
test("internationalCompetitionProfile: null for every non-international clubId (Swedish/Division 1/unknown)", () => {
  assert.equal(internationalCompetitionProfile("se_club_hammarby_if_hf"), null);
  assert.equal(internationalCompetitionProfile("se_club_bodens_bk_hf"), null);
  assert.equal(internationalCompetitionProfile("not_a_real_club"), null);
});

test("internationalCompetitionProfile: Bundesliga (ger1-kiel) has a clearly higher baseline than a weak-tier club (Faroe Islands, int-h71)", () => {
  const bundesliga = internationalCompetitionProfile("ger1-kiel");
  const faroe = internationalCompetitionProfile("int-h71");
  assert.ok(bundesliga && faroe);
  assert.ok(bundesliga!.baselineCA > faroe!.baselineCA + 30, `expected Bundesliga baseline (${bundesliga!.baselineCA}) to clearly exceed Faroe Islands baseline (${faroe!.baselineCA})`);
});

test("internationalCompetitionProfile is deterministic and covers every one of the 16 international-pool competitions", () => {
  const clubIds = [
    "ger1-kiel", "esp1-barca", "den1-aalborg", "hun1-veszprem", "nor1-elverum", "isl1-valur",
    "int-schaffhausen", "int-hard", "int-wisla-plock", "int-sporting",
    "int-meran", "int-alduhail", "int-veszprem-academy",
    "int-h71", "int-bevo", "int-camerano",
  ];
  for (const clubId of clubIds) {
    const profile = internationalCompetitionProfile(clubId);
    assert.ok(profile, `expected an international profile for ${clubId}`);
    assert.deepEqual(profile, internationalCompetitionProfile(clubId));
  }
});

test("hmLevelShift: Elite is clearly higher than Youth, Established is neutral (0)", () => {
  assert.equal(hmLevelShift("Established"), 0);
  assert.ok(hmLevelShift("Elite") > hmLevelShift("Top"));
  assert.ok(hmLevelShift("Top") > hmLevelShift("Established"));
  assert.ok(hmLevelShift("Established") > hmLevelShift("Pro"));
  assert.ok(hmLevelShift("Pro") > hmLevelShift("Development"));
  assert.ok(hmLevelShift("Development") > hmLevelShift("Youth"));
  assert.equal(hmLevelShift(undefined), 0);
  assert.equal(hmLevelShift("NOT_A_REAL_LEVEL"), 0);
});

test("resolveInternationalPopulationProfile: null for a non-international club; a wonderkid candidate gets a wider PA bonus than a non-wonderkid at the same club/level", () => {
  assert.equal(resolveInternationalPopulationProfile("se_club_hammarby_if_hf", null), null);

  const nonWonderkid = resolveInternationalPopulationProfile("ger1-kiel", { workbookId: "INT-X", poolRegion: "Germany", leagueCountry: "Germany", sourceNationality: "Germany", hmLevel: "Top", prospect: false, wonderkidCandidate: false, confidence: "A", notes: null });
  const wonderkid = resolveInternationalPopulationProfile("ger1-kiel", { workbookId: "INT-Y", poolRegion: "Germany", leagueCountry: "Germany", sourceNationality: "Germany", hmLevel: "Top", prospect: true, wonderkidCandidate: true, confidence: "A", notes: null });
  assert.ok(nonWonderkid && wonderkid);
  assert.ok(wonderkid!.paMaxBonus > nonWonderkid!.paMaxBonus);
  // HM Level shift must have been folded into baselineCA identically for both (same level, only wonderkid differs).
  assert.equal(wonderkid!.baselineCA, nonWonderkid!.baselineCA);
});

test("resolveInternationalPopulationProfile: HM Level shifts the baseline within the same competition tier", () => {
  const eliteLevel = resolveInternationalPopulationProfile("ger1-kiel", { workbookId: "INT-A", poolRegion: "Germany", leagueCountry: "Germany", sourceNationality: "Germany", hmLevel: "Elite", prospect: false, wonderkidCandidate: false, confidence: "A", notes: null });
  const youthLevel = resolveInternationalPopulationProfile("ger1-kiel", { workbookId: "INT-B", poolRegion: "Germany", leagueCountry: "Germany", sourceNationality: "Germany", hmLevel: "Youth", prospect: false, wonderkidCandidate: false, confidence: "A", notes: null });
  assert.ok(eliteLevel && youthLevel);
  assert.ok(eliteLevel!.baselineCA > youthLevel!.baselineCA);
});
