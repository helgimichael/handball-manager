// HM-RATINGS-0.6 Part C: a SMALL, bounded per-club context shift for
// the game-prior CA population model -- club strength shapes the
// EXPECTED DISTRIBUTION, never a flat per-club bonus.
//
// This deliberately does NOT invent a strength number for all 14
// clubs. HM-RATINGS-0.6's own source audit found no numeric club-
// strength data anywhere in the repo, and lib/game-data/clubStrength.ts
// already established the precedent that inventing one from indirect
// proxies (height/age/nationality/shirt number/reputation) is out of
// bounds. What DOES exist, for roughly 6 of the 14 clubs, is real,
// VERIFIED_EXTERNAL_DATA-class prior-season context in
// data/real-world/.../identity/season/<clubId>.json (previous league
// finish, title contention, relegation risk, promotion status,
// relative squad strength). This module reads exactly that -- nothing
// more -- and returns a bounded shift; clubs with no season-context
// data get a shift of 0, which is the honest "no evidence" state, not
// a penalty.
import { loadSeasonIdentity } from "../../gameWorld/clubIdentityLoader";
import { leagueSegmentForClub } from "../../gameWorld/leagueSegment";
import { getClub } from "../../game-data";
import type { IdentityClaim } from "../../identity/types";
import type { RealWorldPlayerWorldPoolMetadata } from "../../gameWorld/realWorldLoader";
import type { PopulationBaselineProfile, PopulationTier } from "./populationModel";

const MAX_SHIFT = 6;

// HM-DATA-DIV1-1.0: the two Division 1 competitions, and nothing else,
// resolve to the DIVISION_1 population tier -- every other clubId
// (including any unrecognised one) stays "STANDARD", so this is a pure
// addition with zero behavior change for any existing Handbollsligan/
// Allsvenskan clubId.
const DIVISION_1_COMPETITION_IDS: ReadonlySet<string> = new Set(["se_division1_norra", "se_division1_sodra"]);

export function populationTierForClub(clubId: string): PopulationTier {
  const club = getClub(clubId);
  return club && DIVISION_1_COMPETITION_IDS.has(club.competitionId) ? "DIVISION_1" : "STANDARD";
}

function scoreClaim(claim: IdentityClaim): number {
  const value = String(claim.value).toUpperCase();
  switch (claim.key) {
    case "titleContention":
      return value.includes("TOP_3") || value.includes("TITLE") ? 4 : 0;
    case "previousSeason":
      return value.includes("TREBLE") || value.includes("CHAMPION") ? 4 : 0;
    case "previousLeagueSeason": {
      const match = /^(\d+)(ST|ND|RD|TH)_PLACE/.exec(value);
      if (!match) return 0;
      const place = Number(match[1]);
      return place <= 4 ? 2 : place >= 10 ? -1 : 0;
    }
    case "previousSeasonResult": {
      const match = /(\d+)TH_/.exec(value);
      if (match && Number(match[1]) >= 10) return -1;
      return 0;
    }
    case "relativeSquadStrengthVsPreviousSeason":
      return value.includes("LOWER") ? -2 : value.includes("HIGHER") ? 2 : 0;
    case "keyPlayerLosses":
      return value.includes("HIGH") ? -1 : 0;
    case "relegationRisk":
      return value.includes("HIGH") ? -4 : 0;
    case "leagueStatus":
      return value.includes("NEWLY_PROMOTED") ? -4 : 0;
    case "financialConstraints":
    case "currentFinancialStrength":
      return value.includes("HIGH") || value.includes("LIMITED") ? -1 : 0;
    default:
      return 0;
  }
}

/**
 * A bounded shift (in CA points) to apply to the game-prior population
 * baseline for `clubId`. 0 for the ~8 clubs with no season-context
 * data at all -- an explicit "no adjustment" default, never invented.
 */
export function clubContextShift(clubId: string): number {
  const season = loadSeasonIdentity(clubId, leagueSegmentForClub(clubId));
  if (!season) return 0;

  const claims = [...season.context.organisationalClaims, ...season.context.financialClaims, ...season.context.squadClaims, ...season.context.competitiveClaims, ...season.context.transitionClaims];

  let score = 0;
  for (const claim of claims) score += scoreClaim(claim);
  return Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, score));
}

// ---------------------------------------------------------------------------
// HM-WORLD-PLAYER-POOL-1.0: a simple, explicit, deterministic per-
// competition tier mapping for the 100-player international pool (Part:
// "World rating initialization måste vara competition-aware... Bygg en
// enkel, explicit och deterministic competition-tier mapping"). Six
// hand-assigned tiers, not a re-verified numeric ranking -- a
// deliberately coarse, game-design input, same spirit as
// clubContextTier's own bounded shift above. Every competitionId NOT
// listed here (all Swedish/Division 1/decorative-unused competitions)
// is untouched -- this table is consulted ONLY for the international
// pool's own 16 competitions.
// ---------------------------------------------------------------------------

const INTERNATIONAL_TIER_PROFILES: readonly PopulationBaselineProfile[] = [
  { baselineCA: 130, caSpread: 28, caCeiling: 172, caFloor: 100, paMaxBonus: 20 }, // Tier 1: elite
  { baselineCA: 122, caSpread: 26, caCeiling: 158, caFloor: 92, paMaxBonus: 18 }, // Tier 2: very strong
  { baselineCA: 112, caSpread: 24, caCeiling: 145, caFloor: 85, paMaxBonus: 18 }, // Tier 3: strong
  { baselineCA: 100, caSpread: 24, caCeiling: 132, caFloor: 75, paMaxBonus: 20 }, // Tier 4: solid mid
  { baselineCA: 90, caSpread: 24, caCeiling: 122, caFloor: 65, paMaxBonus: 22 }, // Tier 5: developing
  { baselineCA: 80, caSpread: 24, caCeiling: 112, caFloor: 55, paMaxBonus: 24 }, // Tier 6: weak/fringe
];

/** competitionId -> tier index into INTERNATIONAL_TIER_PROFILES. Every one of the 16 international-pool competitions must appear exactly once. */
const INTERNATIONAL_COMPETITION_TIER: Readonly<Record<string, number>> = {
  "ger-1": 0, // Bundesliga (Germany) -- Tier 1
  "esp-1": 1, // Liga NEXUS ENERGÍA ASOBAL (Spain) -- Tier 2
  "den-1": 1, // Bambuni Herreligaen (Denmark) -- Tier 2
  "hun-1": 1, // K&H férfi kézilabda liga / NB I (Hungary) -- Tier 2
  "nor-1": 2, // Elkjøp-ligaen (Norway) -- Tier 3
  "isl-1": 2, // Olís-deild karla (Iceland) -- Tier 3
  "int-che-1": 3, // Quickline Handball League (Switzerland) -- Tier 4
  "int-aut-1": 3, // HLA Meisterliga (Austria) -- Tier 4
  "int-pol-1": 3, // ORLEN Superliga (Poland) -- Tier 4
  "int-por-1": 3, // Campeonato Betclic Masculino (Portugal) -- Tier 4
  "int-ita-1": 4, // Serie A Gold (Italy) -- Tier 5
  "int-qat-1": 4, // Qatar Handball League -- Tier 5
  "int-hun-2b": 4, // NB I/B (Hungary, reserve tier) -- Tier 5
  "int-fro-1": 5, // Burn-kappingin (Faroe Islands) -- Tier 6
  "int-ned-1": 5, // Super Handball League (Netherlands) -- Tier 6
  "int-ita-2": 5, // Serie A Silver (Italy) -- Tier 6
};

/** `null` for any competitionId outside the international pool (Swedish/Division 1/decorative -- unaffected). */
export function internationalCompetitionProfile(clubId: string): PopulationBaselineProfile | null {
  const club = getClub(clubId);
  if (!club) return null;
  const tierIndex = INTERNATIONAL_COMPETITION_TIER[club.competitionId];
  return tierIndex === undefined ? null : INTERNATIONAL_TIER_PROFILES[tierIndex];
}

// Part: "HM Level ska hjälpa till att skilja... men får INTE bli en
// andra CA" -- a small, bounded shift on top of the competition-tier
// baseline (same bounded-shift philosophy as clubContextShift above),
// never a second rating scale.
const HM_LEVEL_SHIFT: Readonly<Record<string, number>> = {
  Elite: 14,
  Top: 7,
  Established: 0,
  Pro: -5,
  Development: -12,
  Youth: -18,
};

export function hmLevelShift(hmLevel: string | undefined): number {
  return hmLevel !== undefined ? (HM_LEVEL_SHIFT[hmLevel] ?? 0) : 0;
}

// Part: "Wonderkid Candidate betyder INTE automatiskt extrem PA...
// Använd det som en signal... Var restriktiv." A modest, bounded
// widening of the PA ceiling ONLY -- never touches CA, never guarantees
// a high roll (the underlying seeded jitter can still land low).
const WONDERKID_PA_BONUS_EXTRA = 12;

/** Combines an international tier's own paMaxBonus with a small wonderkid-candidate widening, when applicable. */
export function applyWonderkidPaBonus(profile: PopulationBaselineProfile, wonderkidCandidate: boolean | undefined): PopulationBaselineProfile {
  if (!wonderkidCandidate) return profile;
  return { ...profile, paMaxBonus: profile.paMaxBonus + WONDERKID_PA_BONUS_EXTRA };
}

/**
 * The full resolved profile for one international-pool player, or
 * `null` if `clubId` isn't part of the pool -- combines the
 * competition-tier baseline, the HM Level shift (folded into
 * baselineCA, mirroring how clubContextShift is added elsewhere), and
 * the wonderkid PA widening.
 */
export function resolveInternationalPopulationProfile(clubId: string, metadata: RealWorldPlayerWorldPoolMetadata | null): PopulationBaselineProfile | null {
  const base = internationalCompetitionProfile(clubId);
  if (!base) return null;
  const shifted: PopulationBaselineProfile = { ...base, baselineCA: base.baselineCA + hmLevelShift(metadata?.hmLevel) };
  return applyWonderkidPaBonus(shifted, metadata?.wonderkidCandidate);
}
