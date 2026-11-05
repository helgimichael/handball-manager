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
];

/** Display-name corrections to the Profixio-registered name (playerId unchanged; the old name is kept as an alias). */
export const RENAMED: ReadonlyMap<string, string> = new Map([
  ["se_player_sebastian_fagerdahl_33464c91", "Sebastian Råberg Fagerdahl"],
  ["se_player_gustav_molhede_06edf334", "Gustav Andreasson Mölhede"],
  ["se_player_olof_lundh_nilsson_7766931d", "Olof Lundahl Olsson"],
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
];

/** HM-DATA-1.5: an import's researched value deliberately superseded by a later, more specific researched value for the same person. */
export const SUPERSEDED_RATINGS: ReadonlyMap<string, { ca: number; pa: number; reason: string }> = new Map([
  ["se_player_olle_soderqvist_d1155006", { ca: 123, pa: 162, reason: "identity merge: Allsvenskan v0.13 research (Sweden U20 EC silver goalkeeper) supersedes HBL v2.13 114/160" }],
  ["se_player_emil_arthursson_db40e94c", { ca: 126, pa: 128, reason: "identity merge: Allsvenskan v0.13 research (H43 Lund) supersedes HBL v2.13 Karlskrona 116/120" }],
]);
