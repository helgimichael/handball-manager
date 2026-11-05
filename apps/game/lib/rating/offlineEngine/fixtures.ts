import type { CalibrationProposal, RegressionFixture } from "./types";

/**
 * Authoritative regression fixtures established across Phase 1, Phase 2A,
 * Phase 2B, and Phase 2C closeout (including owner decisions).
 *
 * Any automated calibration proposal that violates these accepted benchmarks
 * represents regression or drift and must fail calibration validation.
 */
export const REGRESSION_FIXTURES: RegressionFixture[] = [
  // 1. Sander Sagosen (Phase 2A Anchor 1)
  {
    playerId: "player_intl_sander_sagosen_c782fa51",
    name: "Sander Sagosen",
    expectedCA: 178,
    expectedPA: 180,
    expectedDecision: "KEEP",
    expectedConfidence: "HIGH",
    fixtureRole: "World-Class Playmaker / Benchmark Summit",
  },
  // 2. Lasse Ludwig (Phase 2B Sample / Young Elite GK)
  {
    playerId: "player_intl_lasse_ludwig_180f40b8",
    name: "Lasse Ludwig",
    expectedCA: 150,
    expectedPA: 165,
    expectedDecision: "KEEP",
    expectedConfidence: "HIGH",
    fixtureRole: "Bundesliga Starting Goalkeeper",
  },
  // 3. Mirko Alilovic (Phase 2B Sample / Veteran GK)
  {
    playerId: "player_intl_mirko_alilovic_a5ed9b83",
    name: "Mirko Alilović",
    expectedCA: 145,
    expectedPA: 145,
    expectedDecision: "KEEP",
    expectedConfidence: "HIGH",
    fixtureRole: "International Veteran Goalkeeper",
  },
  // 4. Emil Hovgaard Pedersen (Phase 2C Reverted PA)
  {
    playerId: "player_intl_emil_hovgaard_pedersen_a169f355",
    name: "Emil Hovgaard Pedersen",
    expectedCA: 105,
    expectedPA: 158,
    expectedDecision: "KEEP",
    expectedConfidence: "MEDIUM",
    fixtureRole: "Danish Academy Youth Goalkeeper (PA 158 Reverted from unsupported 142)",
  },
  // 5. August Wiger (Phase 2A Anchor 2 / Phase 2C Retained)
  {
    playerId: "se_player_august_wiger_94e4bcd0",
    name: "August Wiger",
    expectedCA: 152,
    expectedPA: 154,
    expectedDecision: "KEEP",
    expectedConfidence: "HIGH",
    fixtureRole: "Premier Domestic Playmaker Benchmark",
  },
  // 6. Niklas Kraft (Phase 2A Anchor 3 / Phase 2C Retained)
  {
    playerId: "se_player_niklas_kraft_e8842f13",
    name: "Niklas Kraft",
    expectedCA: 150,
    expectedPA: 150,
    expectedDecision: "KEEP",
    expectedConfidence: "HIGH",
    fixtureRole: "Premier Domestic Goalkeeper Benchmark",
  },
  // 7. Andreas Nilsson (Phase 2A Anchor 14 / Veteran Pivot Benchmark)
  {
    playerId: "player_andreas_nilsson_e7db3e42",
    name: "Andreas Nilsson",
    expectedCA: 160,
    expectedPA: 160,
    expectedDecision: "KEEP",
    expectedConfidence: "HIGH",
    fixtureRole: "World-Class Offensive Pivot Ceiling",
  },
  // 8. Benjamin Helander (Phase 2A Anchor 4 / Phase 2C Retained)
  {
    playerId: "se_player_benjamin_helander_b5cece84",
    name: "Benjamin Helander",
    expectedCA: 142,
    expectedPA: 142,
    expectedDecision: "KEEP",
    expectedConfidence: "HIGH",
    fixtureRole: "Elite Finisher / International Left Wing Benchmark",
  },
  // 9. Arvid Boquist (Phase 2A Anchor 5 / Defender of the Year)
  {
    playerId: "se_player_arvid_boquist_39bb770d",
    name: "Arvid Boquist",
    expectedCA: 145,
    expectedPA: 156,
    expectedDecision: "KEEP",
    expectedConfidence: "HIGH",
    fixtureRole: "Handbollsligan All-Star Defender of the Year",
  },
  // 10. Samuel Lindberg (Phase 2A Anchor 15 / HBL Right Wing Benchmark)
  {
    playerId: "se_player_samuel_lindberg_1a6e8618",
    name: "Samuel Lindberg",
    expectedCA: 148,
    expectedPA: 148,
    expectedDecision: "KEEP",
    expectedConfidence: "HIGH",
    fixtureRole: "Established Right Wing / Foreign Pro Benchmark",
  },
  // 11. Anders Wik Rydberg (Phase 2A Anchor 17 / Pure Defensive Specialist)
  {
    playerId: "se_player_anders_wik_rydberg_795e9eac",
    name: "Anders Wik Rydberg",
    expectedCA: 134,
    expectedPA: 134,
    expectedDecision: "KEEP",
    expectedConfidence: "HIGH",
    fixtureRole: "Pure 6-0 Defensive Specialist Benchmark",
  },
  // 12. Alexander Regen (Phase 2A Anchor 6 / Solid Starting Pivot)
  {
    playerId: "se_player_alexander_regen_705fa7a6",
    name: "Alexander Regen",
    expectedCA: 134,
    expectedPA: 134,
    expectedDecision: "KEEP",
    expectedConfidence: "HIGH",
    fixtureRole: "Solid Starting Line Player / Captain Benchmark",
  },
  // 13. Carl Rydén (Phase 2A Anchor 16 / Phase 2C Retained)
  {
    playerId: "se_player_carl_ryden_d5428e1f",
    name: "Carl Rydén",
    expectedCA: 136,
    expectedPA: 148,
    expectedDecision: "KEEP",
    expectedConfidence: "HIGH",
    fixtureRole: "Cross-League Transition Benchmark (Allsvenskan Scorer to HBL)",
  },
  // 14. Petter Donaldson (Phase 2B Sample / Established Scoring Back)
  {
    playerId: "se_player_petter_donaldson_80cffba4",
    name: "Petter Donaldson",
    expectedCA: 140,
    expectedPA: 144,
    expectedDecision: "KEEP",
    expectedConfidence: "HIGH",
    fixtureRole: "Established HBL Distance Scoring Back",
  },
  // 15. Liam Hultberg (Phase 2A Anchor 7 / High-Upside Young Scorer)
  {
    playerId: "player_liam_hultberg_d2b82295",
    name: "Liam Hultberg",
    expectedCA: 150,
    expectedPA: 168,
    expectedDecision: "KEEP",
    expectedConfidence: "HIGH",
    fixtureRole: "Top-Flight Scoring Revelation / High Upside",
  },
  // 16. Malte Månsson (Phase 2A Anchor 8 / Phase 2C Retained)
  {
    playerId: "player_malte_mansson_1d49a03b",
    name: "Malte Månsson",
    expectedCA: 114,
    expectedPA: 156,
    expectedDecision: "KEEP",
    expectedConfidence: "HIGH",
    fixtureRole: "U20 International Right Back / Approved Transfer to HK Malmö",
  },
  // 17. Edwin Tengros (Phase 2B Sample / Phase 2C Retained)
  {
    playerId: "se_player_edwin_tengros_eec4c59b",
    name: "Edwin Tengros",
    expectedCA: 122,
    expectedPA: 148,
    expectedDecision: "KEEP",
    expectedConfidence: "HIGH",
    fixtureRole: "Sweden U20 European Championship Wing / HBL Rotation",
  },
  // 18. Max Sellstedt (Phase 2B Sample / Phase 2C Retained)
  {
    playerId: "se_player_max_sellstedt_314fc84c",
    name: "Max Sellstedt",
    expectedCA: 98,
    expectedPA: 152,
    expectedDecision: "KEEP",
    expectedConfidence: "MEDIUM",
    fixtureRole: "P16 USM Best Attacking Player 2026 / Normalized from PA 170",
  },
  // 19. Elliot Hövre Björck (Phase 2A Anchor 9 / Phase 2C Retained)
  {
    playerId: "se_player_elliot_hovre_bjorck_40a6f29e",
    name: "Elliot Hövre Björck",
    expectedCA: 118,
    expectedPA: 136,
    expectedDecision: "KEEP",
    expectedConfidence: "HIGH",
    fixtureRole: "Allsvenskan Starting Goalkeeper (HK Drott / Rejected Transfer)",
  },
  // 20. Axel Winström (Phase 2A Anchor 10 / Phase 2C Retained)
  {
    playerId: "se_player_axel_winstrom_c59447b8",
    name: "Axel Winström",
    expectedCA: 114,
    expectedPA: 128,
    expectedDecision: "KEEP",
    expectedConfidence: "HIGH",
    fixtureRole: "Allsvenskan Rotation Goalkeeper (Redbergslids IK / Deferred Case)",
  },
  // 21. Emil Arthursson (Phase 2B Sample / Approved Transfer to H43 Lund)
  {
    playerId: "se_player_emil_arthursson_e99d2749",
    name: "Emil Arthursson",
    expectedCA: 126,
    expectedPA: 128,
    expectedDecision: "KEEP",
    expectedConfidence: "HIGH",
    fixtureRole: "Allsvenskan Starting Goalkeeper (H43 Lund)",
  },
  // 22. Hugo Lundberg (Phase 2B Sample / Phase 2C Retained)
  {
    playerId: "se_player_hugo_lundberg_eef2c0f4",
    name: "Hugo Lundberg",
    expectedCA: 109,
    expectedPA: 138,
    expectedDecision: "KEEP",
    expectedConfidence: "HIGH",
    fixtureRole: "Allsvenskan Young Defensive Specialist (IFK Ystad)",
  },
  // 23. Alvin Sundström (Phase 2C Reverted PA)
  {
    playerId: "se_player_alvin_sundstrom_733a7887",
    name: "Alvin Sundström",
    expectedCA: 91,
    expectedPA: 158,
    expectedDecision: "KEEP",
    expectedConfidence: "LOW",
    fixtureRole: "Young Goalkeeper Reserve (PA 158 Reverted from unsupported 126)",
  },
  // 24. Love Ljungqvist (Phase 2C Reverted PA)
  {
    playerId: "se_player_love_ljungqvist_3f94aca6",
    name: "Love Ljungqvist",
    expectedCA: 92,
    expectedPA: 160,
    expectedDecision: "KEEP",
    expectedConfidence: "LOW",
    fixtureRole: "Young Wing Reserve (PA 160 Reverted from unsupported 128)",
  },
  // 25. Arwid Krontorp (Phase 2B Sample / Phase 2C Retained)
  {
    playerId: "se_player_arwid_krontorp_c6d8c3de",
    name: "Arwid Krontorp",
    expectedCA: 105,
    expectedPA: 132,
    expectedDecision: "KEEP",
    expectedConfidence: "MEDIUM",
    fixtureRole: "Allsvenskan Young Right Wing (Eskilstuna Guif)",
  },
  // 26. Markus Stegefelt (Owner Decision: Retired / Inactive)
  {
    playerId: "player_markus_stegefelt_8aedec38",
    name: "Markus Stegefelt",
    expectedCA: 146,
    expectedPA: 146,
    expectedDecision: "KEEP",
    expectedConfidence: "HIGH",
    fixtureRole: "Retired Pro / Excluded from Active Calibration by Owner Decision",
  },
  // 27. Theodor Kapnias Olsson (Phase 2A Anchor 11 / Phase 2C Retained)
  {
    playerId: "se_player_theodor_kapnias_olsson_60beed3c",
    name: "Theodor Kapnias Olsson",
    expectedCA: 118,
    expectedPA: 132,
    expectedDecision: "KEEP",
    expectedConfidence: "HIGH",
    fixtureRole: "Division 1 Standout Back / Overlap with Allsvenskan (Kärra HF)",
  },
  // 28. Adam Füle (Phase 2A Anchor 12 / Phase 2C Closeout)
  {
    playerId: "se_player_adam_fule_5020dcbf",
    name: "Adam Füle",
    expectedCA: 108,
    expectedPA: 149,
    expectedDecision: "KEEP",
    expectedConfidence: "HIGH",
    fixtureRole: "Division 1 Starting Playmaker (HP Warta / CA 108 retained, PA 149 restored)",
  },
  // 29. Viggo Möller Holmén (Phase 2A Anchor 13 / Phase 2C Retained)
  {
    playerId: "player_viggo_moller_holmen_9c5affc4",
    name: "Viggo Möller Holmén",
    expectedCA: 104,
    expectedPA: 152,
    expectedDecision: "KEEP",
    expectedConfidence: "HIGH",
    fixtureRole: "Division 1 Youth National Team Standout (HK S-hof / Sävehof)",
  },
  // 30. Oskar Alf Dahlin (Owner Decision: Canonical Unification)
  {
    playerId: "se_player_oskar_dahlin_50f8181d",
    name: "Oskar Alf Dahlin",
    expectedCA: 118,
    expectedPA: 150,
    expectedDecision: "KEEP",
    expectedConfidence: "HIGH",
    fixtureRole: "Canonical Unified Identity (Alingsås HK with HP Alingsås farm affiliation)",
  },
  // 31. Alexander Andersson (Phase 2B Sample / Phase 2C Retained)
  {
    playerId: "player_alexander_andersson_1718521d",
    name: "Alexander Andersson",
    expectedCA: 104,
    expectedPA: 104,
    expectedDecision: "KEEP",
    expectedConfidence: "HIGH",
    fixtureRole: "Division 1 Veteran Rotation (Vinslövs HK)",
  },
];

export function verifyRegressionFixtures(
  proposalsMap: Map<string, CalibrationProposal>
): { passed: boolean; totalFixtures: number; failures: string[] } {
  const failures: string[] = [];

  for (const fixture of REGRESSION_FIXTURES) {
    const proposal = proposalsMap.get(fixture.playerId);
    if (!proposal) {
      failures.push(
        `Fixture player ${fixture.name} (${fixture.playerId}) was NOT found in calibration proposals.`
      );
      continue;
    }

    if (proposal.proposedCA !== fixture.expectedCA) {
      failures.push(
        `Fixture player ${fixture.name} (${fixture.playerId}): expected CA ${fixture.expectedCA}, got ${proposal.proposedCA}.`
      );
    }

    if (proposal.proposedPA !== fixture.expectedPA) {
      failures.push(
        `Fixture player ${fixture.name} (${fixture.playerId}): expected PA ${fixture.expectedPA}, got ${proposal.proposedPA}.`
      );
    }

    if (proposal.decision !== fixture.expectedDecision) {
      failures.push(
        `Fixture player ${fixture.name} (${fixture.playerId}): expected decision ${fixture.expectedDecision}, got ${proposal.decision}.`
      );
    }
  }

  return {
    passed: failures.length === 0,
    totalFixtures: REGRESSION_FIXTURES.length,
    failures,
  };
}
