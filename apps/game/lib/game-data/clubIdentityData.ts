// Club Identity C1: the static identity layer (MIGRATION-STRATEGY §1), keyed
// by storage id. It is merged into each record when CLUBS is assembled
// (clubs.ts), so the club record stays the ONE source of truth -- this file
// only keeps metadata out of the long one-line `club({...})` literals.
//
// Rules (locked L10 / D1):
// - Never change what an id means; correct identity through metadata here.
// - Never merge on name similarity; link with `relations` instead.
// - `competitionHistory` is append-only. Never edit `Club.competitionId`.
// - Every entry carries its evidence (docs/experience-2027/...-CORRECTION-PLAN.md
//   finding id + source). Nothing here is invented: unverified items are left out
//   and listed as deferred in docs/club-identity/CLUB-IDENTITY-DATA-CORRECTIONS.md.
import type { Club, ClubCompetitionHistoryEntry, ClubIdentityFields } from "./types";

/** Identity metadata plus the few record fields an identity correction may add (never name/competitionId: those stay in clubs.ts). */
export type ClubIdentityOverlay = ClubIdentityFields & Partial<Pick<Club, "founded">>;

/** The data epoch new careers start from. Saves without CareerState.clubWorldBaseline are legacy (v8 world). */
export const CLUB_WORLD_EPOCH = "cid-2026-27-v1";
/** The season every legacy career started in, and the first season of CLUB_WORLD_EPOCH. */
export const CLUB_WORLD_START_SEASON = "2026/27";

const SRC = {
  hbl2627: "F14: https://en.wikipedia.org/wiki/2026%E2%80%9327_Handball-Bundesliga",
  hbl2: "F05/F14: https://www.daikin-hbl.de/downloads/HBL/HBL_GmbH/Spielplan/Spielplan_2.HBL_Saison-26-27.pdf",
  hbl2526: "https://en.wikipedia.org/wiki/2025%E2%80%9326_Handball-Bundesliga",
  dk2526: "F15: https://en.wikipedia.org/wiki/2025%E2%80%9326_H%C3%A5ndboldligaen",
  kolding: "F15: https://en.wikipedia.org/wiki/KIF_Kolding; https://gohandball.com/?p=12311",
  asobal: "F03: https://en.wikipedia.org/wiki/2025%E2%80%9326_Liga_ASOBAL; https://www.cbmpuertosagunto.com/noticias/anaitasuna-primera-piedra-en-el-camino?lang=en",
  fram: "F18: https://en.wikipedia.org/wiki/Fram_men%27s_handball; https://www.wikiwand.com/en/articles/%C3%9Arvalsdeild_karla_(handball)",
  nlb: "F19: https://siol.net/sportal/rokomet/liga-nlb-9-krog-704482; https://siol.net/sportal/rokomet/liga-nlb-22-krog-686215",
  nb1: "F20: https://en.wikipedia.org/wiki/2025%E2%80%9326_Nemzeti_Bajnoks%C3%A1g_I_(men%27s_handball)",
} as const;

/** Real-world league move at the 2026/27 boundary: the legacy league up to 2025/26, the new one from 2026/27 (append-only). */
function moved(from: string, to: string, source: string): readonly ClubCompetitionHistoryEntry[] {
  return [
    { competitionId: from, validFrom: "2025/26", validTo: "2025/26", source },
    { competitionId: to, validFrom: CLUB_WORLD_START_SEASON, source },
  ];
}

export const CLUB_IDENTITY_METADATA: Readonly<Record<string, ClubIdentityOverlay>> = {
  // ---------------------------------------------------------------- Spain
  "esp1-anaitasuna": { // F01 (D1-A)
    canonicalId: "es-bidasoa-irun",
    legacyIdNote: "Id text names SD Anaitasuna; the record has meant CD Bidasoa Irún since HM-GAME-0.1. Storage key kept (D1).",
    aliases: ["Irudek Bidasoa Irún", "CD Bidasoa"],
    externalIds: { wikipedia: "https://en.wikipedia.org/wiki/CD_Bidasoa" },
  },
  "esp1-logrono": { // F02 (D1-A)
    canonicalId: "es-ademar-leon",
    legacyIdNote: "Id text names BM Logroño La Rioja; the record has meant CB Ademar León since HM-GAME-0.1. Storage key kept (D1). Logroño, if added, gets a NEW id (D2).",
    aliases: ["ABANCA Ademar León", "CB Ademar León"],
  },
  "esp1-alicante": { // F03 (D1-A + D5)
    canonicalId: "es-anaitasuna",
    legacyIdNote: "Id text names an Alicante club; the record has meant SCDR Anaitasuna (Pamplona) since HM-GAME-0.1. Storage key kept (D1).",
    aliases: ["Helvetia Anaitasuna", "Anaitasuna"],
    competitionHistory: moved("esp-1", "esp-2", SRC.asobal),
  },
  "esp2-cisne": { canonicalId: "es-cisne", aliases: ["Club Cisne"] }, // F08 (city corrected in clubs.ts)
  "esp2-teucro": { canonicalId: "es-teucro", approximate: true, identityNote: "F21: SD Teucro played the third tier (Primera Nacional) in 2025/26; no esp-3 exists in the game, so the esp-2 assignment is approximate." },
  "esp2-cordoba": { approximate: true, identityNote: "F21: 'BM Córdoba' was not found as a men's División de Honor Plata club. Retirement and replacement await owner decision D6; the id is kept and never re-labelled." },

  // ---------------------------------------------------------------- Hungary
  "hun1-gyor": { // F04 + F16 (D1-A, D4 neutral name)
    canonicalId: "hu-tatabanya",
    legacyIdNote: "Id text names Győri ETO; the record has meant Tatabánya KC since HM-GAME-0.1. Storage key kept (D1). Győr, if added, gets a NEW id (D2).",
    aliases: ["MOL Tatabánya KC", "Grundfos Tatabánya", "Grundfos Tatabánya KC"],
    // The end season of the Grundfos sponsor name is unconfirmed (correction plan F04): kept as an alias, not as a season-bounded name.
  },
  "hun1-veszprem": { // F16 (D4 neutral name; REAL_WORLD key kept)
    canonicalId: "hu-veszprem",
    aliases: ["ONE Veszprém HC", "Telekom Veszprém", "Veszprém"],
  },
  "hun2-eger": { // F10 (D4)
    canonicalId: "hu-eger-eszterhazy",
    aliases: ["SBS-Eger", "QHB-Eger", "Egri Spartacus"],
  },
  "hun2-komlo": { canonicalId: "hu-komlo", aliases: ["Carbonex-Komló"], competitionHistory: moved("hun-2", "hun-1", SRC.nb1) }, // F20
  "int-veszprem-academy": { relations: [{ parentClubId: "hun1-veszprem", relation: "ACADEMY", relationConfidence: "PROBABLE", validFrom: CLUB_WORLD_START_SEASON, evidence: "F16: Veszprém Handball Academy is the academy team of Veszprém (international player pool source workbook)." }], canonicalId: "hu-veszprem-academy" }, // relation in C4 data below

  // ---------------------------------------------------------------- Germany
  "ger2-wilhelmshaven": { // F05: tombstone, never deleted, never reused
    status: "retired",
    validTo: "2025/26",
    duplicateOf: "ger1-stuttgart",
    legacyIdNote: "Id text names Wilhelmshavener HV (3. Liga); the record held 'TV Bittenfeld', a duplicate identity of TVB Stuttgart.",
    retiredReason: "F05: duplicate identity of ger1-stuttgart (TV Bittenfeld is TVB Stuttgart's origin association); id text names Wilhelmshavener HV (3. Liga). Kept for saves and history only. Replacement club awaits owner decision D3.",
  },
  "ger1-stuttgart": { canonicalId: "de-tvb-stuttgart", historicalNames: [{ name: "TV Bittenfeld", shortName: "Bittenfeld", validTo: "2014/15" }] }, // F05
  "ger2-dessau": { canonicalId: "de-dessau-rosslauer-hv", aliases: ["Dessauer HV", "DRHV", "SC DHfK Dessau"] }, // F06
  "ger1-hamburg": { // S1
    canonicalId: "de-handball-club-hamburg",
    aliases: ["HSV Hamburg", "HCH", "Handball Sport Verein Hamburg"],
    // The rename date is not confirmed (correction plan S1/T6): the former name is therefore bounded only at its last certain season.
    historicalNames: [{ name: "HSV Handball", shortName: "HSV Hamburg", validTo: "2015/16" }],
  },
  "ger1-leipzig": { canonicalId: "de-sc-dhfk-leipzig", competitionHistory: moved("ger-1", "ger-2", SRC.hbl2627) }, // F14
  "ger1-minden": { canonicalId: "de-gwd-minden", competitionHistory: moved("ger-1", "ger-2", SRC.hbl2627) }, // F14
  "ger2-balingen": { canonicalId: "de-hbw-balingen", competitionHistory: moved("ger-2", "ger-1", SRC.hbl2627) }, // F14
  "ger1-bietigheim": { // F14 (N)
    canonicalId: "de-sg-bbm-bietigheim",
    addedInWorld: CLUB_WORLD_EPOCH,
    competitionHistory: [{ competitionId: "ger-1", validFrom: CLUB_WORLD_START_SEASON, source: SRC.hbl2627 }],
  },

  // ---------------------------------------------------------------- Denmark
  "den1-hoj": { canonicalId: "dk-hoj-elite", competitionHistory: moved("den-1", "den-2", SRC.dk2526) }, // F09 city + F15
  "den1-grindsted": { canonicalId: "dk-grindsted-gif", competitionHistory: moved("den-1", "den-2", SRC.dk2526) }, // F15
  "den1-kif-kolding": { // F15 (N). Denmark's second promotee is unconfirmed (T6) and deliberately not added.
    canonicalId: "dk-kif-kolding",
    addedInWorld: CLUB_WORLD_EPOCH,
    competitionHistory: [{ competitionId: "den-1", validFrom: CLUB_WORLD_START_SEASON, source: SRC.kolding }],
  },
  "den1-sonderjyske": { canonicalId: "dk-sonderjyske" }, // F11 (city)
  "den2-fif": { canonicalId: "dk-fif", aliases: ["Frederiksberg IF"] }, // F07
  "den2-aarhus": { // F12
    canonicalId: "dk-aarhus-handbold-2024",
    founded: 2024,
    identityNote: "The Aarhus Håndbold founded 1 July 2024 (Aarhus United + Aarhus HC). NOT the pre-2021 Århus Håndbold, whose top-flight operation continued as Skanderborg Aarhus (den1-skanderborg). No predecessor link.",
  },
  "den1-skanderborg": { // F13 (REAL_WORLD key kept)
    canonicalId: "dk-skanderborg-agf",
    aliases: ["Skanderborg Aarhus", "SAH", "Skanderborg Aarhus Håndbold"],
    historicalNames: [
      { name: "Skanderborg Håndbold", shortName: "Skanderborg", validTo: "2020/21" },
      { name: "Skanderborg Aarhus Håndbold", shortName: "Skanderborg Aarhus", validFrom: "2021/22", validTo: "2022/23" },
    ],
  },

  // ---------------------------------------------------------------- Iceland / Slovenia
  "isl2-fram": { canonicalId: "is-fram", competitionHistory: moved("isl-2", "isl-1", SRC.fram) }, // F18
  "svn2-skofjaloka": { // F19
    canonicalId: "si-rd-loka",
    aliases: ["RD Loka", "RD Loka 2012"],
    identityNote: "RD Loka 2012 succeeds the club that went bankrupt in 2011; recorded as history only, no predecessor id.",
    competitionHistory: moved("svn-2", "svn-1", SRC.nlb),
  },
  "svn2-jeruzalem": { canonicalId: "si-jeruzalem-ormoz", competitionHistory: moved("svn-2", "svn-1", SRC.nlb) }, // F19

  // ---------------------------------------------------------------- Sweden
  "swe2-guif": { canonicalId: "se-eskilstuna-guif", aliases: ["Eskilstuna Guif", "IF Guif", "Guif"] }, // S3
  "se_club_hk_cliff": { relations: [{ parentClubId: "se_club_hammarby_if_hf", relation: "U_TEAM_UNDER_PARTNER_LICENCE", relationConfidence: "FULL", validFrom: CLUB_WORLD_START_SEASON, evidence: "F22/D7: 19/19 players registered with Hammarby IF HF (SHF 25963); Division 1 licence held by HK Cliff (SHF 26051). https://www.profixio.com/app/lx/competition/leagueid28142/teams/1578872?t=players" }], // F22 (D7): selectable; relation lives in `relations` (C4)
    canonicalId: "se-hk-cliff",
    licenceHolderAssociation: { name: "HK Cliff", shfClubId: "26051" },
    externalIds: { shfClubId: "26051", profixioTeam: { "2026/27": "1578872" } },
  },
  "se_club_hammarby_if_hf": { externalIds: { shfClubId: "25963" } },
  "se_club_if_kristianstad": { relations: [{ parentClubId: "se_club_ifk_kristianstad", relation: "PARTNER_ASSOCIATION_WITH_SHARED_PLAYERS", relationConfidence: "PARTIAL", validFrom: CLUB_WORLD_START_SEASON, evidence: "F23/D8-A: separate association (SHF 25971); only 3 players registered with IFK Kristianstad (SHF 25964). The existing permanent B-team row is kept. https://www.profixio.com/app/lx/competition/leagueid28142/teams/1575285?t=players" }], canonicalId: "se-if-kristianstad", externalIds: { shfClubId: "25971", profixioTeam: { "2026/27": "1575285" } } }, // F23
  "se_club_ifk_kristianstad": { externalIds: { shfClubId: "25964" } },
  "se_club_hp_alingsas": { relations: [{ parentClubId: "se_club_alingsas_hk", relation: "SECOND_TEAM", relationConfidence: "FULL", validFrom: CLUB_WORLD_START_SEASON, evidence: "F24: players registered with Alingsås HK. https://www.profixio.com/app/lx/competition/leagueid28142/teams/1572549?t=players" }], canonicalId: "se-hp-alingsas", externalIds: { profixioTeam: { "2026/27": "1572549" } } }, // F24
  "se_club_hk_onnerediterna": { relations: [{ parentClubId: "se_club_onnereds_hk", relation: "SECOND_TEAM_UNDER_PARTNER_ASSOCIATION", relationConfidence: "FULL", validFrom: CLUB_WORLD_START_SEASON, evidence: "F25: all players registered with Önnereds HK (SHF 26047); team under association 26228. https://www.profixio.com/app/lx/competition/leagueid28142/teams/1575759?t=players" }], canonicalId: "se-hk-onnerediterna", licenceHolderAssociation: { name: "HK Önnerediterna", shfClubId: "26228" }, externalIds: { shfClubId: "26228", profixioTeam: { "2026/27": "1575759" } } }, // F25
  "se_club_onnereds_hk": { externalIds: { shfClubId: "26047" } },
  "se_club_hk_s_hof": { relations: [{ parentClubId: "se_club_ik_savehof", relation: "SECOND_TEAM", relationConfidence: "PROBABLE", validFrom: CLUB_WORLD_START_SEASON, evidence: "F26: roster source is IK Sävehof's P18 page (not verified on Profixio). https://www.iksungdom.se/iksavehof-p18/truppen" }], canonicalId: "se-hk-s-hof", identityNote: "F26: B team of IK Sävehof is PROBABLE (roster source is IK Sävehof's P18 page); not verified on Profixio." },
  "se_club_hf_karlskrona": { externalIds: { shfClubId: "26363" } },
  // S5: SHF association ids of the Division 2 registrations (Profixio team ids are derived per season from sourceRegistration, swedishDivision2.ts).
  "se_div2_team_1585295": { relations: [{ parentClubId: "se_club_lugi_hf", relation: "U_TEAM", relationConfidence: "FULL", validFrom: CLUB_WORLD_START_SEASON, evidence: "F27: association 26102; 18/18 registered with Lugi HF. https://www.profixio.com/app/leagueid28096/teams/1585295" }], canonicalId: "se-lugi-hf-u", externalIds: { shfClubId: "26102" } },
  "se_div2_team_1582183": { relations: [{ parentClubId: "se_club_hf_karlskrona", relation: "SAME_CLUB_SECOND_TEAM", relationConfidence: "FULL", validFrom: CLUB_WORLD_START_SEASON, evidence: "F27: club 26363 = HF Karlskrona; 20/21 registered. https://www.profixio.com/app/leagueid28096/teams/1582183" }], canonicalId: "se-hf-karlskrona-u", externalIds: { shfClubId: "26363" } },
  "se_div2_team_1585596": { relations: [{ parentClubId: "se_club_ystads_if_hf", relation: "U_TEAM", relationConfidence: "FULL", validFrom: CLUB_WORLD_START_SEASON, evidence: "F27: association 26429; 25/25 registered with Ystads IF HF. https://www.profixio.com/app/leagueid28096/teams/1585596" }], canonicalId: "se-ystads-if-u", externalIds: { shfClubId: "26429" } },
  "se_div2_team_1582988": { relations: [{ parentClubId: "swe2-tumba", relation: "SECOND_TEAM_UNDER_PARTNER_ASSOCIATION", relationConfidence: "FULL", validFrom: CLUB_WORLD_START_SEASON, evidence: "F28: association 26146; all registered with IFK Tumba HK. Profixio team 1582988 (Herr Div 2 Öst)." }], canonicalId: "se-tumba-hk", externalIds: { shfClubId: "26146" } },
  "se_div2_team_1578886": { relations: [{ parentClubId: "swe2-vasterasirsta", relation: "SECOND_TEAM_UNDER_PARTNER_ASSOCIATION", relationConfidence: "FULL", validFrom: CLUB_WORLD_START_SEASON, evidence: "F28: association 26317; registered with VästeråsIrsta HF. Profixio team 1578886." }], canonicalId: "se-vasterasirsta-hk", externalIds: { shfClubId: "26317" } },
  "se_div2_team_1575715": { relations: [{ parentClubId: "swe2-varberg", relation: "SECOND_TEAM_UNDER_PARTNER_ASSOCIATION", relationConfidence: "MAJORITY", validFrom: CLUB_WORLD_START_SEASON, evidence: "F28: association 26185; 12/15 registered with HK Varberg. Profixio team 1575715." }], canonicalId: "se-hk-varberg-09", externalIds: { shfClubId: "26185" } },
  "se_div2_team_1578982": { relations: [{ parentClubId: "se_club_ov_helsingborg", relation: "SECOND_TEAM_UNDER_PARTNER_ASSOCIATION", relationConfidence: "FULL", validFrom: CLUB_WORLD_START_SEASON, evidence: "F28: association 26450; 21/23 registered with OV Helsingborg HK. Profixio team 1578982." }], canonicalId: "se-helsingborgs-hk", externalIds: { shfClubId: "26450" } },
  "se_div2_team_1579219": { relations: [{ parentClubId: "se_club_hk_malmo", relation: "SECOND_TEAM_UNDER_PARTNER_ASSOCIATION", relationConfidence: "FULL", validFrom: CLUB_WORLD_START_SEASON, evidence: "F28: association 26298; 29/29 registered with HK Malmö. Profixio team 1579219." }], canonicalId: "se-malmo-hp", externalIds: { shfClubId: "26298" } },
  "se_div2_team_1575788": { relations: [{ parentClubId: "se_club_lif_lindesberg", relation: "SECOND_TEAM_UNDER_PARTNER_ASSOCIATION", relationConfidence: "FULL", validFrom: CLUB_WORLD_START_SEASON, evidence: "F28: association 26101; 18/18 registered with LIF Lindesberg. Profixio team 1575788." }], canonicalId: "se-hk-lif-bla", externalIds: { shfClubId: "26101" } },
  "se_div2_team_1583015": { relations: [{ parentClubId: "swe2-ystad2", relation: "SECOND_TEAM_UNDER_PARTNER_ASSOCIATION", relationConfidence: "FULL", validFrom: CLUB_WORLD_START_SEASON, evidence: "F28: association 26411; 22/22 registered with IFK Ystad HK. Profixio team 1583015." }], canonicalId: "se-hk-ystadpagarna", externalIds: { shfClubId: "26411" } },
  "se_div2_team_1576008": { relations: [{ parentClubId: "swe2-h43lund", relation: "SECOND_TEAM_UNDER_PARTNER_ASSOCIATION", relationConfidence: "FULL", validFrom: CLUB_WORLD_START_SEASON, evidence: "S2: association 26090; 19/19 registered with H43 Lund HF ('H43 Lejonen'). https://www.profixio.com/app/leagueid28096/teams/1576008" }], canonicalId: "se-lunds-hs-lejon", aliases: ["H43 Lejonen"], externalIds: { shfClubId: "26090" } },
  "se_div2_team_1578270": { relations: [{ parentClubId: "swe2-torslanda", relation: "YOUTH_LINK", relationConfidence: "PARTIAL", validFrom: CLUB_WORLD_START_SEASON, evidence: "F29: separate club (26041); six players (born 2005-2008) registered with HK Torslanda Elit. Informational only: not a B team. https://www.profixio.com/app/leagueid28052/teams/1578270" }], canonicalId: "se-torslanda-hk", externalIds: { shfClubId: "26041" } },
};
