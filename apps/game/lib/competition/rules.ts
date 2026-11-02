// HM-ALPHA3-M03: Swedish men's competition formats, 2025/26 and 2026/27.
//
// Every value below is either VERIFIED against Svenska Handbollförbundet's
// own documents or marked as an ASSUMPTION. Assumptions are isolated here so
// they can be corrected without touching the season engine.
//
// Sources (fetched and read 2026-11-02):
// - [TB]  Tävlingsbestämmelser 2025/26 and 2026/27, §2:7 (points, tiebreaks,
//         series), §2:9 (two-legged ties)
//         https://svenskhandboll.se/download/18.1b6a4306199a34c4a6dda540/1759908910729/TB%202025-2026%20hela%20samlad.pdf
// - [THB] Tävlingshandbok 2025/26 (2025-06-11) and 2026/27 (2026-06-05),
//         §2:1-2:3 (SM-slutspel), §2:13 (draws in series), §3:3 (leagues, kval)
//         https://svenskhandboll.se/download/18.1b6a4306199a34c4a6dda536/1759908889212/THB%202025-2026%20hela%20samlad.pdf
// - [CUP] ATG Svenska cupen 2025/26 tävlingsreglemente
//         https://www.svenskhandboll.se/download/18.5397bd2e1947419831b6b9a7/1737382251824/ATG%20Svenska%20cupen%2025-26%20t%C3%A4vlingsreglemente.pdf
// No structural change between 2025/26 and 2026/27 for these tiers.

export const HANDBOLLSLIGAN = "se_handbollsligan_herr";
export const ALLSVENSKAN = "swe-2";
export const DIVISION_1 = ["se_division1_norra", "se_division1_sodra"] as const;
/** Pseudo-competition ids for the knockout competitions (never a league: no table, no club membership). */
export const SM_SLUTSPEL = "se-sm-slutspel-herr";
export const KVAL_HBL = "se-kval-handbollsligan";
export const KVAL_ALLSVENSKAN = "se-kval-allsvenskan";
export const SVENSKA_CUPEN = "se-svenska-cupen-herr";

export type Provenance = { verified: true; source: string } | { verified: false; assumption: string };

export interface SeriesFormat {
  bestOf: number;
  /** Who is at home in each game, by seed: HIGH = the higher-placed team. */
  homePattern: readonly ("HIGH" | "LOW")[];
  days: number; // days between games
}

export const LEAGUE_RULES = {
  /** 14 clubs, double round robin, 26 rounds; 2-1-0. [THB §3:3, TB §2:7] VERIFIED. */
  points: { win: 2, draw: 1, loss: 0 },
  /** Level on points: goal difference, goals scored, head-to-head; then a deciding match at a neutral venue when it matters for promotion/relegation. [TB §2:7] VERIFIED. */
  tiebreakers: ["GOAL_DIFFERENCE", "GOALS_FOR", "HEAD_TO_HEAD"] as const,
  tiebreakProvenance: { verified: true, source: "TB 2025/26 & 2026/27 §2:7" } as Provenance,
  /** ASSUMPTION: head-to-head among three or more level clubs uses their mini-table (points, goal difference, goals); a still-unresolved tie is settled by a seeded lot standing in for the neutral deciding match. */
  multiwayTieAssumption: { verified: false, assumption: "Mini-table for 3+ level clubs; a seeded lot replaces the neutral deciding match." } as Provenance,
};

export const SM_SLUTSPEL_RULES = {
  qualifiers: 8,
  /** Fixed bracket, no reseeding. [THB §2:1-2:3] VERIFIED. */
  quarterFinals: [[1, 8], [4, 5], [2, 7], [3, 6]] as const,
  /** SF1 = winners of QF1 and QF2, SF2 = winners of QF3 and QF4. */
  semiFinals: [[0, 1], [2, 3]] as const,
  /** Every round best of five, H-B-H-B-H with the higher-placed team at home first. [THB §2:1-2:3] VERIFIED. */
  series: { bestOf: 5, homePattern: ["HIGH", "LOW", "HIGH", "LOW", "HIGH"], days: 3 } as SeriesFormat,
  provenance: { verified: true, source: "THB 2025/26 & 2026/27 §2:1-2:3" } as Provenance,
};

export const KVAL_HBL_RULES = {
  /** HBL 11 v Allsvenskan 4, 12 v 3, 13 v 2; 14th relegated directly. [THB §3:3] VERIFIED. */
  pairs: [[11, 4], [12, 3], [13, 2]] as const,
  directRelegation: [14],
  /** Best of five, B-H-H-B-H from the HBL club's side: it starts away. [THB §3:3] VERIFIED. */
  series: { bestOf: 5, homePattern: ["LOW", "HIGH", "HIGH", "LOW", "HIGH"], days: 3 } as SeriesFormat,
  provenance: { verified: true, source: "THB 2025/26 & 2026/27 §3:3" } as Provenance,
};

export const ALLSVENSKAN_RULES = {
  directPromotion: [1],
  toHblKval: [2, 3, 4],
  /** 11th and 12th play kval to stay up; 13th and 14th are relegated. [THB §3:3] VERIFIED. */
  relegationKval: [11, 12],
  directRelegation: [13, 14],
  /** Final kval best of three, B-H-H: the Allsvenskan club starts away. [THB §3:3] VERIFIED. */
  kvalSeries: { bestOf: 3, homePattern: ["LOW", "HIGH", "HIGH"], days: 3 } as SeriesFormat,
  provenance: { verified: true, source: "THB 2025/26 & 2026/27 §3:3" } as Provenance,
  /**
   * ASSUMPTION: Division 1 (two groups of 12) is not simulated. Its group
   * winners (promoted directly in reality) and the two semi-kval winners
   * that meet Allsvenskan 11-12 are chosen from Division 1 clubs ranked by
   * squad strength, with a seeded tiebreak -- the semi-kval itself is not played.
   */
  division1Assumption: { verified: false, assumption: "Division 1 not simulated: promoted clubs and kval opponents are ranked by squad strength." } as Provenance,
};

/** Draws in series games: 2x5 min overtime, a second 2x5, then a shootout. [THB §2:13] VERIFIED. */
export const SERIES_OVERTIME_ROUNDS = 2;
/**
 * ASSUMPTION: THB annex 1 describes both a breakaway "shoot-out" and a
 * 7 m deciding procedure; which one HBL playoffs use could not be
 * confirmed. The game uses 7 m throws (5 each, then sudden death), matching
 * IHF rule 2:2.
 */
export const SHOOTOUT_ASSUMPTION: Provenance = { verified: false, assumption: "7 m throws (IHF 2:2) rather than the breakaway shoot-out." };

export const CUP_RULES = {
  /** Round 4: 32 clubs in eight groups of four, single round robin; top two advance. [CUP] VERIFIED (2025/26). */
  groups: 8,
  groupSize: 4,
  advancePerGroup: 2,
  /** Round of 16 and quarterfinals two-legged; no overtime -- a level tie goes straight to a shootout. Final4: single-match semifinals and final (and a 3rd-place match). [CUP] VERIFIED (2025/26). */
  overtimeRounds: 0,
  /** Bonuses 100 000 / 50 000 / 25 000 SEK for 1st / 2nd / 3rd. [CUP] VERIFIED (2025/26). */
  prizeSek: { winner: 100_000, runnerUp: 50_000, third: 25_000 },
  provenance: { verified: true, source: "ATG Svenska cupen 2025/26 tävlingsreglemente" } as Provenance,
  /**
   * ASSUMPTIONS: (1) the 2026/27 regulations were not found, the 2025/26
   * format is used; (2) cup rounds 1-3 (district rounds) are not played --
   * the 28 HBL and Allsvenskan clubs plus the four strongest Division 1
   * clubs make up the 32; (3) the "shoot-out inför match" handicap is not
   * modelled; (4) dates are set by the game around the league calendar.
   */
  assumptions: { verified: false, assumption: "2025/26 format; rounds 1-3 and the pre-match handicap shoot-out are not played; game-set dates." } as Provenance,
};

/**
 * ASSUMPTION: no prize money for SM-slutspel is published (decisive-game
 * revenue sharing exists, THB §2:4). The game pays fictional, clearly
 * labelled sporting bonuses so a deep run matters financially.
 */
export const PLAYOFF_BONUS_EUR = { champion: 40_000, final: 20_000, semiFinal: 10_000, quarterFinal: 4_000 };
export const PLAYOFF_BONUS_PROVENANCE: Provenance = { verified: false, assumption: "Fictional game bonuses; SHF publishes no SM-slutspel prize money." };
