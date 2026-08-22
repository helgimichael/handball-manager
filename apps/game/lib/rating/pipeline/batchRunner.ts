// HM-RATINGS-0.3: batch runner across the current 14-club Handbollsligan
// roster. Server-only (see evidenceCollection.ts's own boundary note).
// Never writes anywhere -- read-only, headless, produces PROPOSED
// profiles in memory only. Not wired into Fast Match, gameplay, or any
// persisted save data in this milestone.
import { loadRealWorldClubSquad } from "../../gameWorld/realWorldLoader";
import { getClubsByCompetition } from "../../game-data";
import { validatePlayerRatingProfile } from "../validators";
import type { AbilityConfidence, PlayerRatingProfile } from "../types";
import { proposePlayerRating } from "./proposalEngine";

export const HANDBOLLSLIGAN_COMPETITION_ID = "se_handbollsligan_herr";

/** Every currently REAL_WORLD-backed Handbollsligan club id, derived from the same canonical club list the rest of the game uses -- never a hardcoded duplicate list. */
export function handbollsliganClubIds(): string[] {
  return getClubsByCompetition(HANDBOLLSLIGAN_COMPETITION_ID)
    .filter((c) => c.dataSource === "REAL_WORLD")
    .map((c) => c.id);
}

export interface ClubRatingPipelineResult {
  clubId: string;
  clubName: string | null;
  profiles: PlayerRatingProfile[];
  matchedCalibrationCount: number;
  unresolvedPositionCount: number;
  invalidProfileCount: number;
}

/** Runs the pipeline for one club. Returns a result with an empty `profiles` array (never throws) if the club has no importable real-world roster. */
export function runRatingPipelineForClub(clubId: string): ClubRatingPipelineResult {
  const squad = loadRealWorldClubSquad(clubId);
  if (!squad) {
    return { clubId, clubName: null, profiles: [], matchedCalibrationCount: 0, unresolvedPositionCount: 0, invalidProfileCount: 0 };
  }

  const profiles: PlayerRatingProfile[] = [];
  let matchedCalibrationCount = 0;
  let unresolvedPositionCount = 0;
  let invalidProfileCount = 0;

  for (const player of squad.players) {
    const outcome = proposePlayerRating(player);
    profiles.push(outcome.profile);
    if (outcome.matchedCalibration) matchedCalibrationCount += 1;
    if (outcome.unresolvedPosition) unresolvedPositionCount += 1;
    if (!validatePlayerRatingProfile(outcome.profile).ok) invalidProfileCount += 1;
  }

  return { clubId, clubName: squad.clubName, profiles, matchedCalibrationCount, unresolvedPositionCount, invalidProfileCount };
}

// ---------------------------------------------------------------------------
// League-wide audit summary
// ---------------------------------------------------------------------------

export interface RatingPipelineAuditSummary {
  clubsProcessed: number;
  totalPlayers: number;
  caProposedCount: number;
  caUnresolvedCount: number;
  paProposedCount: number;
  paUnresolvedCount: number;
  /** Players with at least one numeric outcourt or goalkeeper attribute. */
  attributeCoverageCount: number;
  attributeCoverageFraction: number;
  caConfidenceDistribution: Record<AbilityConfidence, number>;
  paConfidenceDistribution: Record<AbilityConfidence, number>;
  /** clubId -> count of players matched to a calibration reference. Clubs at 0 have zero HM-RATINGS-0.2-anchored evidence at all. */
  matchedCalibrationByClub: Record<string, number>;
  /** Clubs with zero matched calibration players -- weak evidence coverage, flagged for follow-up, not silently accepted as "fine". */
  clubsWithWeakEvidenceCoverage: string[];
  /** Players flagged as structurally suspicious (see buildAuditSummary's own doc for each check). */
  outliers: RatingPipelineOutlier[];
  invalidProfileCount: number;
  unresolvedPositionCount: number;
}

export interface RatingPipelineOutlier {
  playerId: string;
  clubId: string;
  reason: string;
}

function emptyConfidenceDistribution(): Record<AbilityConfidence, number> {
  return { LOW: 0, MEDIUM: 0, HIGH: 0 };
}

/**
 * Flags structurally suspicious proposals -- never a judgement about
 * whether a NUMBER is "right" (this milestone has no ground truth to
 * compare against), only internal-consistency checks:
 *  - a resolved ca/pa value paired with LOW confidence (LOW confidence
 *    should mean "wide range, often no point value" -- a narrowly
 *    pinned point value under LOW confidence is a contradiction worth a
 *    human look, not a hard validator error).
 *  - pa resolved while ca is not (a real, legitimate case per this
 *    milestone's own rules -- e.g. Robin Järling -- but still worth
 *    surfacing so a reviewer can see every instance at a glance).
 */
function findOutliers(profiles: PlayerRatingProfile[]): RatingPipelineOutlier[] {
  const outliers: RatingPipelineOutlier[] = [];
  for (const profile of profiles) {
    const clubId = profile.claims.find((c) => c.domain === "POSITION")?.sourceRefs[0]?.split(":")[1] ?? "unknown";
    if (profile.ca.value !== null && profile.ca.confidence === "LOW") {
      outliers.push({ playerId: profile.playerId, clubId, reason: `ca has a resolved value (${profile.ca.value}) but LOW confidence -- narrow-looking point estimate paired with thin evidence` });
    }
    if (profile.pa.value !== null && profile.ca.value === null) {
      outliers.push({ playerId: profile.playerId, clubId, reason: "pa is resolved while ca remains fully unassessed -- a real, legitimate case (potential known independent of current ability), flagged for visibility" });
    }
  }
  return outliers;
}

export function buildAuditSummary(clubResults: ClubRatingPipelineResult[]): RatingPipelineAuditSummary {
  const allProfiles = clubResults.flatMap((r) => r.profiles);

  const caConfidenceDistribution = emptyConfidenceDistribution();
  const paConfidenceDistribution = emptyConfidenceDistribution();
  let caProposedCount = 0;
  let paProposedCount = 0;
  let attributeCoverageCount = 0;

  for (const profile of allProfiles) {
    caConfidenceDistribution[profile.ca.confidence] += 1;
    paConfidenceDistribution[profile.pa.confidence] += 1;
    if (profile.ca.value !== null) caProposedCount += 1;
    if (profile.pa.value !== null) paProposedCount += 1;
    const hasAttributes = (profile.outcourtAttributes && Object.keys(profile.outcourtAttributes).length > 0) || (profile.goalkeeperAttributes && Object.keys(profile.goalkeeperAttributes).length > 0);
    if (hasAttributes) attributeCoverageCount += 1;
  }

  const matchedCalibrationByClub: Record<string, number> = {};
  for (const r of clubResults) matchedCalibrationByClub[r.clubId] = r.matchedCalibrationCount;

  return {
    clubsProcessed: clubResults.length,
    totalPlayers: allProfiles.length,
    caProposedCount,
    caUnresolvedCount: allProfiles.length - caProposedCount,
    paProposedCount,
    paUnresolvedCount: allProfiles.length - paProposedCount,
    attributeCoverageCount,
    attributeCoverageFraction: allProfiles.length > 0 ? attributeCoverageCount / allProfiles.length : 0,
    caConfidenceDistribution,
    paConfidenceDistribution,
    matchedCalibrationByClub,
    clubsWithWeakEvidenceCoverage: clubResults.filter((r) => r.matchedCalibrationCount === 0).map((r) => r.clubId),
    outliers: findOutliers(allProfiles),
    invalidProfileCount: clubResults.reduce((sum, r) => sum + r.invalidProfileCount, 0),
    unresolvedPositionCount: clubResults.reduce((sum, r) => sum + r.unresolvedPositionCount, 0),
  };
}

export interface LeagueRatingPipelineResult {
  clubResults: ClubRatingPipelineResult[];
  auditSummary: RatingPipelineAuditSummary;
}

/** Runs the pipeline for every given club id (defaults to all 14 current Handbollsligan clubs) and produces the league-wide audit summary. */
export function runRatingPipelineForLeague(clubIds: string[] = handbollsliganClubIds()): LeagueRatingPipelineResult {
  const clubResults = clubIds.map((id) => runRatingPipelineForClub(id));
  return { clubResults, auditSummary: buildAuditSummary(clubResults) };
}
