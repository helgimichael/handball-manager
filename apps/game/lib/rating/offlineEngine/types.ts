import type { PlayerEvidenceRecord } from "../evidencePipeline/schema";

export type CalibrationDecisionCategory =
  | "KEEP"
  | "PROPOSE"
  | "PROVISIONAL"
  | "REVIEW_REQUIRED";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | "PROVISIONAL";

export interface ProvisionalBand {
  paMin: number;
  paMax: number;
  paNominal: number;
  confidence: "MEDIUM" | "LOW" | "PROVISIONAL";
  uncertaintyBandWidth: number;
}

export interface OfflinePlayerContext {
  playerId: string;
  name: string;
  firstName: string;
  lastName: string;
  clubId: string;
  clubName: string;
  competitionId: string;
  primaryPosition: string;
  secondaryPositions: string[];
  shirtNumber: number | string | null;
  dateOfBirth: string | null;
  birthYear: number | null;
  age: number | null;
  ageGroup: string;
  nationality: string;
  heightCm: number | null;
  handedness: string | null;
  onActiveRoster: boolean;
  isLocked: boolean;
  storedCA: number | null;
  storedPA: number | null;
  runtimeCA: number;
  runtimePA: number;
  caSource: string;
  confidence: string;
  status: "RESEARCHED" | "PROVISIONAL";
  lockedDate: string;
  lockedNote: string;
  dataNotes?: string;
  outlierFlags: string[];
  isRetired?: boolean;
  evidence?: PlayerEvidenceRecord;
}

export interface CalibrationProposal {
  playerId: string;
  name: string;
  firstName: string;
  lastName: string;
  clubId: string;
  clubName: string;
  competitionId: string;
  position: string;
  age: number | null;
  currentCA: number;
  currentPA: number;
  proposedCA: number;
  proposedPA: number;
  caDelta: number;
  paDelta: number;
  decision: CalibrationDecisionCategory;
  confidence: ConfidenceLevel;
  provisionalBand?: ProvisionalBand;
  reviewFlags: string[];
  rationale: string;
  provenance: string;
  comparisonPlayer?: string;
}

export interface RegressionFixture {
  playerId: string;
  name: string;
  expectedCA: number;
  expectedPA: number;
  expectedDecision: CalibrationDecisionCategory;
  expectedConfidence: ConfidenceLevel;
  fixtureRole: string;
}

export interface CalibrationBatchSummary {
  totalPlayers: number;
  keepCount: number;
  proposeCount: number;
  provisionalCount: number;
  reviewRequiredCount: number;
  averageCADelta: number;
  averagePADelta: number;
  maxCADelta: number;
  maxPADelta: number;
  mathematicalInvariantViolations: number;
  byCompetition: Record<string, {
    total: number;
    keep: number;
    propose: number;
    provisional: number;
    reviewRequired: number;
  }>;
  byPosition: Record<string, {
    total: number;
    keep: number;
    propose: number;
    provisional: number;
    reviewRequired: number;
  }>;
  byConfidence: Record<ConfidenceLevel, number>;
}

export interface CalibrationBatchResult {
  proposals: CalibrationProposal[];
  summary: CalibrationBatchSummary;
  regressionCheck: {
    passed: boolean;
    totalFixtures: number;
    failures: string[];
  };
}
