// Identity-level roster corrections the canonical import-fidelity tests must
// follow (HM-DATA-1.3 Herrallsvenskan correction; HM-DATA-1.5 Swedish player
// database quality -- both against Profixio, snapshot 2026-10-31). No CA/PA
// value changed except the documented superseded rating below: locked
// ratings either moved with the player unchanged, or stayed in place while
// only the season roster membership was removed. Audit trail:
// C:\DEV\QA\reports\HM-DATA-1.3 and C:\DEV\QA\reports\HM-DATA-1.5.

/** Existing identities whose 2026/27 membership moved to a Herrallsvenskan club (same playerId; locked rating moved, or kept from the merged duplicate). */
export const RELOCATED_TO_ALLSVENSKAN: readonly { playerId: string; fromCompetitionId: string; toClubId: string }[] = [
  { playerId: "se_player_alexander_hambalek_3236286b", fromCompetitionId: "se_handbollsligan_herr", toClubId: "swe2-guif" },
    { playerId: "player_albin_henriksson_051a1d9b", fromCompetitionId: "se_division1_sodra", toClubId: "swe2-kungalv" },
  { playerId: "player_liam_thulin_c1345228", fromCompetitionId: "se_division1_sodra", toClubId: "swe2-ystad2" },
  // HM-DATA-1.5: on loan from Hammarby IF HF (contract club), playable at IFK Tumba HK.
  { playerId: "se_player_olle_soderqvist_d1155006", fromCompetitionId: "se_handbollsligan_herr", toClubId: "swe2-tumba" },
];

/** Herrallsvenskan 2026/27 roster memberships removed (not registered on Profixio); identity and locked rating retained. */
export const REMOVED_MEMBERSHIPS: readonly { playerId: string; clubId: string }[] = [
  { playerId: "se_player_jonathan_johansson_8a96d4a5", clubId: "swe2-h43lund" },
  { playerId: "se_player_erik_ekstrand_b8cbf67a", clubId: "swe2-h43lund" },
  { playerId: "se_player_jonas_stromberg_a360c810", clubId: "swe2-h43lund" },
  { playerId: "se_player_rasmus_carnehult_2c16c2f4", clubId: "swe2-h43lund" },
  { playerId: "se_player_hampus_martensson_85131bfd", clubId: "swe2-h43lund" },
  { playerId: "se_player_rasmus_nilsson_cd0d2ddc", clubId: "swe2-h43lund" },
  { playerId: "se_player_erik_altimiras_4e73199c", clubId: "swe2-h43lund" },
  { playerId: "se_player_isak_brandin_5150ba19", clubId: "swe2-aranas" },
  { playerId: "se_player_samuel_woldu_887cd46d", clubId: "swe2-huddinge" },
  { playerId: "se_player_melvin_andre_b49125e8", clubId: "swe2-huddinge" },
  { playerId: "se_player_olof_hall_19d20e27", clubId: "swe2-huddinge" },
  { playerId: "se_player_fredrik_kampe_c333aa59", clubId: "swe2-huddinge" },
  { playerId: "se_player_adam_sommensjo_c76b24f0", clubId: "swe2-huddinge" },
  { playerId: "se_player_felix_svensson_2d585f02", clubId: "swe2-kungalv" },
  { playerId: "se_player_victor_paldanius_265cebe9", clubId: "swe2-kungalv" },
    { playerId: "se_player_luka_cvjetkovic_9e685b1d", clubId: "swe2-redbergslid" },
  // HM-DATA-1.5: absent from both Profixio and the official club squad page.
  { playerId: "se_player_andreas_flodman_1fb70c61", clubId: "swe2-guif" },
  { playerId: "se_player_nicklas_andreasson_ecbbbb4c", clubId: "swe2-huddinge" },
  // HM-OWNER-DECISION (2026-11-05): Markus Stegefelt retired; Oskar Alf Dahlin duplicate registrations merged.
  { playerId: "player_markus_stegefelt_8aedec38", clubId: "se_club_rp_if_linkoping" },
  { playerId: "se_player_oskar_alf_dahlin_591a8ba2", clubId: "se_club_alingsas_hk" },
  { playerId: "player_oskar_alf_dahlin_29d39f91", clubId: "se_club_hp_alingsas" },
];

/** Display-name corrections to the Profixio-registered name (playerId unchanged; the old name is kept as an alias). */
export const RENAMED: ReadonlyMap<string, string> = new Map([
  ["se_player_sebastian_fagerdahl_33464c91", "Sebastian Råberg Fagerdahl"],
  ["se_player_gustav_molhede_06edf334", "Gustav Andreasson Mölhede"],
  ["se_player_olof_lundh_nilsson_7766931d", "Olof Lundahl Olsson"],
  ["se_player_oskar_dahlin_50f8181d", "Oskar Alf Dahlin"],
]);

/** Existing identities whose 2026/27 membership moved to a Division 1 club (same playerId; locked rating moved). */
export const RELOCATED_TO_DIVISION1: readonly { playerId: string; fromCompetitionId: string; toClubId: string; toCompetitionId: string }[] = [
  { playerId: "se_player_adam_fule_5020dcbf", fromCompetitionId: "swe-2", toClubId: "se_club_hp_warta", toCompetitionId: "se_division1_sodra" },
  { playerId: "se_player_theodor_kapnias_olsson_60beed3c", fromCompetitionId: "swe-2", toClubId: "se_club_karra_hf", toCompetitionId: "se_division1_sodra" },
];

/** HM-DATA-1.5: duplicate records of one real person; the retired id survives only as provenance on the canonical identity. */
export const MERGED_IDENTITIES: readonly { retiredPlayerId: string; canonicalPlayerId: string; clubId: string }[] = [
  { retiredPlayerId: "se_player_emil_arthursson_db40e94c", canonicalPlayerId: "se_player_emil_arthursson_e99d2749", clubId: "swe2-h43lund" },
  { retiredPlayerId: "se_player_olle_soderqvist_467b211d", canonicalPlayerId: "se_player_olle_soderqvist_d1155006", clubId: "swe2-tumba" },
  { retiredPlayerId: "se_player_oskar_alf_dahlin_591a8ba2", canonicalPlayerId: "se_player_oskar_dahlin_50f8181d", clubId: "se_club_alingsas_hk" },
  { retiredPlayerId: "player_oskar_alf_dahlin_29d39f91", canonicalPlayerId: "se_player_oskar_dahlin_50f8181d", clubId: "se_club_hp_alingsas" },
];

/** HM-DATA-1.5: an import's researched value deliberately superseded by a later, more specific researched value for the same person. */
export const SUPERSEDED_RATINGS: ReadonlyMap<string, { ca: number; pa: number; reason: string }> = new Map([
  ["se_player_olle_soderqvist_d1155006", { ca: 123, pa: 162, reason: "identity merge: Allsvenskan v0.13 research (Sweden U20 EC silver goalkeeper) supersedes HBL v2.13 114/160" }],
  ["se_player_emil_arthursson_db40e94c", { ca: 126, pa: 128, reason: "identity merge: Allsvenskan v0.13 research (H43 Lund) supersedes HBL v2.13 Karlskrona 116/120" }],
  // HM-CA-PA-PHASE-2B/2C: Controlled calibration sample accepted overrides
  ["se_player_august_wiger_94e4bcd0", { ca: 152, pa: 154, reason: "Phase 2B: Handbollsligan premier domestic playmaker benchmark" }],
  ["se_player_niklas_kraft_e8842f13", { ca: 150, pa: 150, reason: "Phase 2B: Handbollsligan elite goalkeeper benchmark" }],
  ["se_player_benjamin_helander_b5cece84", { ca: 142, pa: 142, reason: "Phase 2B: Finnish senior international wing, Bundesliga pedigree" }],
  ["se_player_carl_ryden_d5428e1f", { ca: 136, pa: 148, reason: "Phase 2B: Allsvenskan top scorer promoted to HBL starter" }],
  ["se_player_edwin_tengros_eec4c59b", { ca: 122, pa: 148, reason: "Phase 2B: Sweden U20 international backcourt rotation" }],
  ["se_player_max_sellstedt_314fc84c", { ca: 98, pa: 152, reason: "Phase 2B: Reserve GK, deflated unevidenced age formula PA" }],
  ["player_malte_mansson_1d49a03b", { ca: 114, pa: 156, reason: "Phase 2B: HK Malmö senior rotation right back, U18 national team" }],
  ["se_player_elliot_hovre_bjorck_40a6f29e", { ca: 118, pa: 136, reason: "Phase 2B: HK Drott starting goalkeeper" }],
  ["se_player_axel_winstrom_c59447b8", { ca: 114, pa: 128, reason: "Phase 2B: Redbergslids IK rotation back" }],
  ["se_player_hugo_lundberg_eef2c0f4", { ca: 109, pa: 138, reason: "Phase 2B: Ystads IF reserve wing" }],
  ["se_player_arwid_krontorp_c6d8c3de", { ca: 105, pa: 132, reason: "Phase 2B: Eskilstuna Guif rotation wing, normalized PA" }],
  ["se_player_theodor_kapnias_olsson_60beed3c", { ca: 118, pa: 132, reason: "Phase 2B: Kärra HF starting back, normalized PA" }],
  ["se_player_adam_fule_5020dcbf", { ca: 108, pa: 149, reason: "Phase 2C: HP Warta primary playmaker, retained calibrated CA 108; restored pre-calibration PA 149" }],
  ["player_viggo_moller_holmen_9c5affc4", { ca: 104, pa: 152, reason: "Phase 2B: HK S-hof / Sävehof academy wing, verified U18 NT" }],
  ["player_alexander_andersson_1718521d", { ca: 104, pa: 104, reason: "Phase 2B: Vinslövs HK rotation wing, re-centered from inflated baseline" }],
  // HM-CA-PA-MILESTONE-6: First Controlled Calibration Import (19 verified CA increases)
  ["se_player_hugo_svensson_4041dc45", { ca: 127, pa: 128, reason: "Milestone 6: Proven regular goalscorer in Allsvenskan (119 goals in 45 matches, 2.6 gpg). Cal" }],
  ["se_player_william_lund_a1cef7d9", { ca: 133, pa: 134, reason: "Milestone 6: Exceptional scoring volume in Allsvenskan (152 goals in 26 matches, 5.8 gpg). Up" }],
  ["se_player_lowe_knutsson_edd52e78", { ca: 144, pa: 158, reason: "Milestone 6: League-leading Allsvenskan goalscorer (198 goals in 26 matches, 7.6 gpg). Produc" }],
  ["se_player_isak_hasanic_holmgren_5a0639bd", { ca: 142, pa: 143, reason: "Milestone 6: Exceptional scoring volume in Allsvenskan (168 goals in 26 matches, 6.5 gpg). Up" }],
  ["se_player_marvin_barrett_8d02e65e", { ca: 131, pa: 142, reason: "Milestone 6: Established primary scorer in Allsvenskan (131 goals in 26 matches, 5.0 gpg). Up" }],
  ["se_player_ludde_nystrom_5250f25e", { ca: 125, pa: 133, reason: "Milestone 6: Proven regular goalscorer in Allsvenskan (110 goals in 25 matches, 4.4 gpg). Cal" }],
  ["se_player_albin_lindblom_ebc224c8", { ca: 124, pa: 145, reason: "Milestone 6: Proven senior starting goalkeeper workload in Allsvenskan (370 shots faced, 100 " }],
  ["se_player_shaban_zogaj_71e0c93f", { ca: 130, pa: 142, reason: "Milestone 6: High-volume Allsvenskan scorer (162 goals in 25 appearances, 6.5 gpg). Adjusted " }],
  ["se_player_mathias_mark_pedersen_46a47242", { ca: 149, pa: 150, reason: "Milestone 6: Elite domestic offensive engine (189 goals, 140 assists, 329 total involvements " }],
  ["se_player_melvin_hildingsson_edd5d2a3", { ca: 128, pa: 160, reason: "Milestone 6: Substantial top-flight goalkeeper workload in Handbollsligan (390 shots faced, 1" }],
  ["se_player_alex_andersson_654b2ac2", { ca: 147, pa: 148, reason: "Milestone 6: Premier Handbollsligan playmaker and contributor (115 goals, 86 assists, 201 tot" }],
  ["se_player_arnor_vi_arsson_6843cb3f", { ca: 138, pa: 144, reason: "Milestone 6: Consistent starting contributor in Handbollsligan (79 goals, 49 assists, 128 inv" }],
  ["se_player_isak_karlsson_1dbf967b", { ca: 138, pa: 142, reason: "Milestone 6: Consistent starting contributor in Handbollsligan (89 goals, 64 assists, 153 inv" }],
  ["player_niko_petrovic_d603dfbe", { ca: 124, pa: 160, reason: "Milestone 6: Proven Allsvenskan scoring record (101 goals in 26 appearances, 3.9 gpg) earns p" }],
  ["player_einar_adalsteinsson_26066696", { ca: 138, pa: 143, reason: "Milestone 6: Consistent starting contributor in Handbollsligan (88 goals, 43 assists, 131 inv" }],
  ["player_thomas_stenersen_781c3d9f", { ca: 126, pa: 145, reason: "Milestone 6: Regular starting rotation back in Handbollsligan (26 appearances, 71 goals, 31 a" }],
  ["player_arvid_noren_b702c6de", { ca: 136, pa: 152, reason: "Milestone 6: High-workload starting goalkeeper in Handbollsligan (641 shots faced, 186 saves," }],
  ["player_oskar_andersson_9382e771", { ca: 128, pa: 138, reason: "Milestone 6: Proven Allsvenskan scoring record (110 goals in 26 appearances, 4.2 gpg) earns p" }],
  ["player_elliot_eriksson_b0aec1ab", { ca: 132, pa: 148, reason: "Milestone 6: Consistent starting contributor in Handbollsligan (80 goals, 51 assists, 131 inv" }],
]);
