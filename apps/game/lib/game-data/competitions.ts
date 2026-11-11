import { SWEDISH_DIVISION_2_COMPETITIONS } from './swedishDivision2';
import type { Competition } from "./types";

/**
 * Real competition names, verified via web search during HM-GAME-0.1
 * (August 2026) against Wikipedia/Sofascore/Flashscore for the current
 * or most recently confirmed 2025/26 season. Every entry's sourceNote
 * records the confidence level -- see the HM-GAME-0.1 report's World
 * Data section for the full source list. Where a league has both a
 * federation name and a sponsor name, `name` uses the sponsor/common
 * name a fan would recognise and `officialName` records the federation
 * name, per the task brief.
 */
export const COMPETITIONS: readonly Competition[] = [
  ...SWEDISH_DIVISION_2_COMPETITIONS,
  {
    // HM-DATA-0.2: aligned to the real-world database's own competitionId
    // (data/real-world/sweden/2026-27/handbollsligan/*/roster-*.json),
    // rather than the earlier placeholder "swe-1".
    id: "se_handbollsligan_herr",
    nation: "SWE",
    tier: 1,
    name: "Handbollsligan",
    sourceNote: "Verified: Wikipedia/Sofascore, 2025/26 season, 14 clubs. Club/player identity for 2026/27 imported from the verified real-world database (HM-DATA-0.2).",
  },
  {
    id: "swe-2",
    nation: "SWE",
    tier: 2,
    name: "Allsvenskan",
    sourceNote: "HM-DATA-ALLSVENSKAN-1.0: club list matches the 14 approved CLUB IDENTITY v0.1 source profiles for 2026/27 (real club/coach/staff identity imported; player squads remain mock until HM-DATA-ALLSVENSKAN-1.1). IFK Tumba is the only playable club.",
  },
  {
    // HM-DATA-DIV1-1.0: NON-PLAYABLE recruitment/scouting pool, one tier
    // below Allsvenskan. `tier` is set to 2 (same nominal value as
    // Allsvenskan) purely to avoid touching every `1 | 2`-typed economy
    // signature (contract/wage/market-value generation) that assumes
    // exactly two tiers exist -- those generators are never actually
    // invoked for a Division 1 club (ensureCareerAllClubEconomies/
    // ensureCareerPlayerContracts both iterate only
    // getClubsByCompetition(state.competitionId), the MANAGER's own
    // competition, which can never be Division 1 since no club here is
    // playable -- see clubs.ts). The one thing that actually
    // distinguishes Division 1 clubs is CLUB.playable === false for all
    // of them; UI surfaces that must hide Division 1 (New Game's league
    // picker) filter on that, never on `tier`.
    id: "se_division1_norra",
    nation: "SWE",
    tier: 2,
    name: "Division 1 Norra",
    sourceNote: "HM-DATA-DIV1-1.0: non-playable recruitment/scouting pool. 12 real clubs for 2026/27, verified via svenskhandboll.se's official series list; per-club roster confidence (VERIFIED/PARTIAL) recorded per player in the real-world database. Never simulated (no fixtures/standings/promotion).",
  },
  {
    id: "se_division1_sodra",
    nation: "SWE",
    tier: 2,
    name: "Division 1 Södra",
    sourceNote: "HM-DATA-DIV1-1.0: non-playable recruitment/scouting pool. 12 real clubs for 2026/27, verified via svenskhandboll.se's official series list; per-club roster confidence (VERIFIED/PARTIAL) recorded per player in the real-world database. Never simulated (no fixtures/standings/promotion).",
  },
  {
    id: "den-1",
    nation: "DEN",
    tier: 1,
    name: "Håndboldligaen",
    sourceNote: "Verified: Wikipedia, 2025/26 season, 14 clubs, 90th season.",
  },
  {
    id: "den-2",
    nation: "DEN",
    tier: 2,
    name: "1. Division",
    officialName: "Danish 1st Division",
    sourceNote: "Verified: Wikipedia (2025–26 Danish 1st Division).",
  },
  {
    id: "nor-1",
    nation: "NOR",
    tier: 1,
    name: "REMA 1000-ligaen",
    officialName: "Eliteserien i håndball for menn",
    sourceNote: "Verified: Wikipedia, current sponsor name for 2025/26, title holder Kolstad.",
  },
  {
    id: "nor-2",
    nation: "NOR",
    tier: 2,
    name: "1. divisjon",
    sourceNote: "Verified via Wikipedia article title (1. divisjon, Norwegian handball); full 2025/26 club list page returned 404 during verification, name itself confirmed.",
  },
  {
    id: "ger-1",
    nation: "GER",
    tier: 1,
    name: "Handball-Bundesliga",
    officialName: "Daikin Handball-Bundesliga (2025/26 title sponsor)",
    sourceNote: "Verified: Wikipedia, 2025/26 season, 18 clubs.",
  },
  {
    id: "ger-2",
    nation: "GER",
    tier: 2,
    name: "2. Handball-Bundesliga",
    sourceNote: "Verified: referenced directly by the German top-tier Wikipedia season page as the promotion/relegation partner league.",
  },
  {
    id: "esp-1",
    nation: "ESP",
    tier: 1,
    name: "Liga ASOBAL",
    sourceNote: "Verified: Flashscore standings page, 2025/26 season.",
  },
  {
    id: "esp-2",
    nation: "ESP",
    tier: 2,
    name: "División de Honor Plata",
    officialName: "División de Plata de Balonmano",
    sourceNote: "Verified: Wikipedia + Flashscore, 2025/26 season name.",
  },
  {
    id: "hun-1",
    nation: "HUN",
    tier: 1,
    name: "NB I",
    officialName: "Nemzeti Bajnokság I (sponsored as K&H férfi kézilabda liga)",
    sourceNote: "Verified: Wikipedia, 2025/26 season, 75th edition.",
  },
  {
    id: "hun-2",
    nation: "HUN",
    tier: 2,
    name: "NB II",
    officialName: "Nemzeti Bajnokság II",
    sourceNote: "Verified: Wikipedia (2025–26 Nemzeti Bajnokság II).",
  },
  {
    id: "svn-1",
    nation: "SVN",
    tier: 1,
    name: "Liga NLB",
    officialName: "Slovenian First League of Handball",
    sourceNote: "Verified: Wikipedia, current sponsor name (Liga NLB since 2017).",
  },
  {
    id: "svn-2",
    nation: "SVN",
    tier: 2,
    name: "Slovenian Second League",
    sourceNote: "Verified: Wikipedia (2025–26 Slovenian Second League).",
  },
  {
    id: "isl-1",
    nation: "ISL",
    tier: 1,
    name: "Olís deild karla",
    officialName: "Úrvalsdeild karla",
    sourceNote: "Verified: Wikipedia + Flashscore, current sponsor name, 2025/26 season active.",
  },
  {
    id: "isl-2",
    nation: "ISL",
    tier: 2,
    name: "1. deild karla",
    sourceNote: "Verified: Wikipedia (2025 1. deild karla).",
  },

  // --- HM-WORLD-PLAYER-POOL-1.0: 10 new competitions required by the
  // 100-player international pool. NON-PLAYABLE -- never added to
  // nations.ts's NATIONS array, so these never appear in New Game's
  // country/league picker regardless of `tier`. Names are the source
  // workbook's own current league names; no fixture/standings
  // simulation exists for any of them.
  {
    id: "int-aut-1",
    nation: "AUT",
    tier: 1,
    name: "HLA Meisterliga",
    sourceNote: "HM-WORLD-PLAYER-POOL-1.0: from the international player pool source workbook (research snapshot 2026-08-27). Non-playable recruitment/scouting/transfer-target pool only.",
  },
  {
    id: "int-fro-1",
    nation: "FRO",
    tier: 1,
    name: "Burn-kappingin",
    sourceNote: "HM-WORLD-PLAYER-POOL-1.0: from the international player pool source workbook (research snapshot 2026-08-27). Non-playable recruitment/scouting/transfer-target pool only.",
  },
  {
    id: "int-hun-2b",
    nation: "HUN",
    tier: 2,
    name: "NB I/B",
    sourceNote: "HM-WORLD-PLAYER-POOL-1.0: Hungary's reserve/development tier feeding NB I -- distinct from the pre-existing hun-2 (NB II). From the international player pool source workbook (research snapshot 2026-08-27). Non-playable.",
  },
  {
    id: "int-ita-1",
    nation: "ITA",
    tier: 1,
    name: "Serie A Gold",
    sourceNote: "HM-WORLD-PLAYER-POOL-1.0: from the international player pool source workbook (research snapshot 2026-08-27). Non-playable recruitment/scouting/transfer-target pool only.",
  },
  {
    id: "int-ita-2",
    nation: "ITA",
    tier: 2,
    name: "Serie A Silver",
    sourceNote: "HM-WORLD-PLAYER-POOL-1.0: from the international player pool source workbook (research snapshot 2026-08-27). Non-playable recruitment/scouting/transfer-target pool only.",
  },
  {
    id: "int-ned-1",
    nation: "NED",
    tier: 1,
    name: "Super Handball League",
    sourceNote: "HM-WORLD-PLAYER-POOL-1.0: from the international player pool source workbook (research snapshot 2026-08-27). Non-playable recruitment/scouting/transfer-target pool only.",
  },
  {
    id: "int-pol-1",
    nation: "POL",
    tier: 1,
    name: "ORLEN Superliga",
    sourceNote: "HM-WORLD-PLAYER-POOL-1.0: from the international player pool source workbook (research snapshot 2026-08-27). Non-playable recruitment/scouting/transfer-target pool only.",
  },
  {
    id: "int-por-1",
    nation: "POR",
    tier: 1,
    name: "Campeonato Betclic Masculino",
    sourceNote: "HM-WORLD-PLAYER-POOL-1.0: from the international player pool source workbook (research snapshot 2026-08-27). Non-playable recruitment/scouting/transfer-target pool only.",
  },
  {
    id: "int-qat-1",
    nation: "QAT",
    tier: 1,
    name: "Qatar Handball League",
    sourceNote: "HM-WORLD-PLAYER-POOL-1.0: from the international player pool source workbook (research snapshot 2026-08-27). Non-playable recruitment/scouting/transfer-target pool only.",
  },
  {
    id: "int-che-1",
    nation: "CHE",
    tier: 1,
    name: "Quickline Handball League",
    sourceNote: "HM-WORLD-PLAYER-POOL-1.0: from the international player pool source workbook (research snapshot 2026-08-27). Non-playable recruitment/scouting/transfer-target pool only.",
  },
];

export function getCompetitionsByNation(nation: string): readonly Competition[] {
  return COMPETITIONS.filter((c) => c.nation === nation);
}

export function getCompetition(id: string): Competition | undefined {
  return COMPETITIONS.find((c) => c.id === id);
}
