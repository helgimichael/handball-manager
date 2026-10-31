// HM-DATA-1.3 (Herrallsvenskan 2026/27 roster correction against Profixio
// leagueid28141, snapshot 2026-10-31): the identity-level changes the
// canonical import-fidelity tests must follow. No CA/PA value changed --
// these players' locked ratings either moved with them unchanged, or stayed
// in place while only the season roster membership was removed. Full audit
// trail: C:\DEV\QA\reports\HM-DATA-1.3.

/** Existing identities whose 2026/27 membership moved to a Herrallsvenskan club (same playerId; locked rating moved unchanged). */
export const HM_DATA_1_3_RELOCATED_TO_ALLSVENSKAN: readonly { playerId: string; fromCompetitionId: string; toClubId: string }[] = [
  { playerId: "se_player_alexander_hambalek_3236286b", fromCompetitionId: "se_handbollsligan_herr", toClubId: "swe2-guif" },
  { playerId: "player_malte_mansson_1d49a03b", fromCompetitionId: "se_handbollsligan_herr", toClubId: "swe2-kroppskultur" },
  { playerId: "player_albin_henriksson_051a1d9b", fromCompetitionId: "se_division1_sodra", toClubId: "swe2-kungalv" },
  { playerId: "player_liam_thulin_c1345228", fromCompetitionId: "se_division1_sodra", toClubId: "swe2-ystad2" },
];

/** Herrallsvenskan 2026/27 roster memberships removed (not registered on Profixio); identity and locked rating retained. */
export const HM_DATA_1_3_REMOVED_MEMBERSHIPS: readonly { playerId: string; clubId: string }[] = [
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
  { playerId: "se_player_adam_fule_5020dcbf", clubId: "swe2-kungalv" },
  { playerId: "se_player_luka_cvjetkovic_9e685b1d", clubId: "swe2-redbergslid" },
];

/** Display-name corrections to the Profixio-registered name (playerId unchanged; the old name is kept as an alias). */
export const HM_DATA_1_3_RENAMED: ReadonlyMap<string, string> = new Map([
  ["se_player_sebastian_fagerdahl_33464c91", "Sebastian Råberg Fagerdahl"],
  ["se_player_gustav_molhede_06edf334", "Gustav Andreasson Mölhede"],
  ["se_player_olof_lundh_nilsson_7766931d", "Olof Lundahl Olsson"],
]);
