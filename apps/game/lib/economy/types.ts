// HM-CONTRACTS-1.0: the economic-identity domain's own vocabulary.
// Deliberately compact -- this is the FOUNDATION contracts/salary/value
// layer (Part: "Det här är foundation -- inte hela transfermarknaden"),
// not a negotiation/transfer-market system.

/**
 * Part: "under kontrakt / kontrakt löper snart ut / utgående kontrakt /
 * kontraktslös" -- a pure function of `contractEndDate` vs the career's
 * own `gameDate` (never separately stored/mutated -- see
 * getContractStatus in contractLifecycle.ts). Thresholds are day-counts,
 * never season-string comparisons, so status tracks the real in-career
 * calendar (including preseason) precisely.
 */
export const CONTRACT_STATUSES = ["UNDER_CONTRACT", "EXPIRING_SOON", "EXPIRING", "FREE_AGENT"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

/**
 * Part 4: "kontrakt ska vara persistenta career-data och inte genereras
 * om varje gång sidan öppnas." Deliberately does NOT store market value
 * -- value is a DYNAMIC, always-freshly-derived function of CA/PA/age/
 * role/league/contract-time-remaining (marketValue.ts), recomputed on
 * every read from these already-persistent inputs, same "derived, never
 * cached" precedent as lib/career/standings.ts's own getLiveStandings.
 * Only the two genuinely STICKY facts (when a manager could actually
 * change them: a future renewal/negotiation milestone) are persisted
 * here -- contractEndDate and wageEurPerMonth are set once at
 * generation and never silently rerolled.
 *
 * HM-CONTRACTS-1.0A: EUR is the canonical internal currency (see
 * lib/economy/currency.ts) -- `wageEurPerMonth` replaces the original
 * `wageSekPerMonth` field. Any display currency conversion happens only
 * at the UI boundary, never here.
 */
export interface PlayerContract {
  playerId: string;
  clubId: string;
  /** ISO date. */
  contractEndDate: string;
  wageEurPerMonth: number;
  /** A real agreement must survive legacy formula recalibration on load. */
  wageAgreed?: boolean;
  /** HM-ALPHA2-05E: the squad role promised when the player signed -- kept with the contract so a broken promise stays visible. */
  promisedSquadRole?: "KEY_PLAYER" | "FIRST_CHOICE" | "ROTATION" | "SQUAD_PLAYER" | "TALENT";
}

/** Contract-status day-count thresholds, counting down from contractEndDate. */
export const CONTRACT_EXPIRING_SOON_DAYS = 365;
export const CONTRACT_EXPIRING_DAYS = 180;

// ---------------------------------------------------------------------------
// HM-CONTRACTS-1.0A: club/youth history + training compensation.
// ---------------------------------------------------------------------------

/**
 * Part: "en kompakt, persistent klubb-/utbildningshistorik" -- ONLY past
 * (departed) clubs, chronological. The player's CURRENT club is never
 * duplicated in here -- it's already known via the player's own
 * `clubId`. No existing club-history concept exists anywhere else in the
 * codebase to reuse (confirmed by audit) -- this is new, purpose-built,
 * intentionally compact vocabulary (no per-season match/appearance
 * detail, just enough for training-compensation attribution).
 */
export interface PlayerClubHistoryEntry {
  clubId: string;
  fromAge: number;
  toAge: number;
}

export interface PlayerClubHistory {
  playerId: string;
  entries: readonly PlayerClubHistoryEntry[];
}

/**
 * Part: "regler/provenance/version kan skiljas åt" -- a training-
 * compensation rule set is a small, swappable, VERSIONED object, never
 * hardcoded inline math. `GENERIC_FOUNDATION_v0.1` (trainingCompensation.ts)
 * is a deliberately generic first pass -- no SHF/EHF-specific formula
 * exists in this project's sources (confirmed by audit), so this must
 * not be presented or calibrated as if it were one. A real
 * country/federation-specific rule set can be added later as a sibling
 * object implementing this exact same shape, selected by competitionId/
 * nation -- never a rewrite of the engine itself.
 */
export interface TrainingCompensationRuleSet {
  version: string;
  /** A player strictly older than this (at evaluation time) generates zero training compensation, regardless of history. */
  maxCompensationAge: number;
  /** Flat EUR-per-year-of-training rate for a club at the given competition tier (undefined = unknown/other). */
  perClubPerYearEur: (competitionTier: 1 | 2 | undefined) => number;
}

export interface TrainingCompensationClubShare {
  clubId: string;
  years: number;
  amountEur: number;
}

export interface TrainingCompensationResult {
  totalEur: number;
  /** One entry per past training club that contributed a non-zero share, in history order. */
  perClub: readonly TrainingCompensationClubShare[];
  ruleSetVersion: string;
}
