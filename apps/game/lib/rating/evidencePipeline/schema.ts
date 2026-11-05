/**
 * Milestone 2: Evidence Pipeline Data Schema
 *
 * Defines structured, verifiable player evidence records, isolating
 * verified empirical facts from qualitative claims and provisional assumptions.
 */

export type EvidenceSourceQuality =
  | "OFFICIAL_LEAGUE_STATS"       // Official league stats (Profixio / HandballStats season totals)
  | "OFFICIAL_MATCH_PROTOCOLS"    // Match-by-match official box scores (shots, saves, 7m, suspensions)
  | "VERIFIED_RESEARCH_ARCHIVE"   // Curated primary research (World Pool, Allsvenskan, Div 1 import candidates)
  | "EXPERT_CALIBRATION_ANCHOR"   // Phase 2A/2B/2C anchor reviews & national tournament honors
  | "BIOGRAPHICAL_ONLY"           // Verified bio/roster only; no senior performance metrics
  | "UNRESEARCHED_PRIOR";         // Default generated game prior without primary research

export interface VerifiedPerformanceFacts {
  competition: string;
  season: string;
  appearances: number | null;
  goals: number | null;
  assists: number | null;
  technicalErrors: number | null;
  suspensions: number | null;
  shotsFaced: number | null;
  saves: number | null;
  savePercentage: number | null;
  sevenMetreSaves: number | null;
  sevenMetresFaced: number | null;
  internationalCaps: number | null;
  internationalLevel: "SENIOR" | "U20" | "U18" | "NONE";
  honors: string[];
}

export interface CareerProgressionEvidence {
  previousClubs: string[];
  previousTiers: string[];
  isCrossLeagueMover: boolean;
  transitionContext: string | null;
}

export interface PlayerEvidenceRecord {
  playerId: string;
  name: string;
  clubId: string;
  clubName: string;
  competitionId: string;
  position: string;
  sourceId: string;
  sourceUrl: string | null;
  sourceDate: string;
  sourceQuality: EvidenceSourceQuality;
  completenessScore: number; // 0.0 (empty) to 1.0 (fully verified matches, goals, saves, discipline, bio)
  verifiedFacts: VerifiedPerformanceFacts;
  unverifiedClaims: string[];
  careerProgression: CareerProgressionEvidence;
  evidenceProvenanceNote: string;
}
