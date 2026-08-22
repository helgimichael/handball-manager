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
import type { IdentityClaim } from "../../identity/types";

const MAX_SHIFT = 6;

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
  const season = loadSeasonIdentity(clubId);
  if (!season) return 0;

  const claims = [...season.context.organisationalClaims, ...season.context.financialClaims, ...season.context.squadClaims, ...season.context.competitiveClaims, ...season.context.transitionClaims];

  let score = 0;
  for (const claim of claims) score += scoreClaim(claim);
  return Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, score));
}
