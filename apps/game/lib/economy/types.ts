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
 * here -- contractEndDate and wageSekPerMonth are set once at
 * generation and never silently rerolled.
 */
export interface PlayerContract {
  playerId: string;
  clubId: string;
  /** ISO date. */
  contractEndDate: string;
  wageSekPerMonth: number;
}

/** Contract-status day-count thresholds, counting down from contractEndDate. */
export const CONTRACT_EXPIRING_SOON_DAYS = 365;
export const CONTRACT_EXPIRING_DAYS = 180;
