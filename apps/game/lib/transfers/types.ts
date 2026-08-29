// HM-TRANSFERS-1.0: the transfer/free-agent/loan domain's own vocabulary.
// Reuses lib/economy's existing PlayerContract/PlayerClubHistory/
// TrainingCompensationResult/ClubBudgets rather than duplicating any of
// them (Part: "Skapa inte parallella player/club/economy-system").
//
// Deliberately kept SYNCHRONOUS/one-shot for this first version: a
// single `submitTransferOffer` call resolves affordability -> selling
// club decision -> player decision -> (window-gated) completion in one
// step, rather than a multi-day back-and-forth negotiation -- Part:
// "Ingen modern AI-agent". Every intermediate rule (affordability, club
// decision, player decision) is still its own independently testable
// pure function; only the ORCHESTRATION is synchronous.

export const TRANSFER_DEAL_TYPES = ["PERMANENT", "LOAN"] as const;
export type TransferDealType = (typeof TRANSFER_DEAL_TYPES)[number];

/**
 * Final, terminal status of a resolved offer -- there is no lingering
 * "pending" state in v1 (see module doc: everything resolves
 * synchronously in one `submitTransferOffer` call).
 */
// HM-CPU-SQUAD-BUILDING-1.0B Part 1/2: "BLOCKED_PENDING_TRANSFER" -- a new
// offer was rejected outright because the player already has an active
// AGREED_AWAITING_WINDOW deal that can still execute (Part: "A player
// must never have more than one unresolved/pending transfer outcome
// that can later execute"). "CANCELLED_STALE" -- an AGREED_AWAITING_WINDOW
// offer that reached its scheduled completion date but the player no
// longer canonically belongs to the offer's own `fromClubId` (they moved
// via a different deal in the meantime) -- never executed, safely
// cancelled instead of corrupting squad data with a stale move.
export const TRANSFER_OFFER_STATUSES = ["BLOCKED_UNAFFORDABLE", "BLOCKED_PENDING_TRANSFER", "REJECTED_BY_CLUB", "REJECTED_BY_PLAYER", "AGREED_AWAITING_WINDOW", "COMPLETED", "CANCELLED_STALE"] as const;
export type TransferOfferStatus = (typeof TRANSFER_OFFER_STATUSES)[number];

/**
 * Part: "loan med enkel wage-share" -- the ONE economic effect a loan
 * has beyond roster movement. `wageShareBorrowingPct` (0-100) is the
 * share of the player's ORIGINAL wage the borrowing club pays; the
 * parent club's own derived wage costs simply no longer include this
 * player for the loan's duration (a 100% relief simplification --
 * documented in transferExecution.ts, not a claim of partial dual-book
 * accounting). No option-to-buy field (Part: "Ingen option-to-buy ännu
 * om det blir onödigt stort").
 */
export interface LoanTerms {
  startDate: string;
  endDate: string;
  wageShareBorrowingPct: number;
}

/**
 * Part: keep Market Value / Asking Price / Transfer Fee / Training
 * Compensation / Total Acquisition Cost distinct. `transferFeeEur` is
 * the MANAGER'S OWN OFFER (never auto-derived from market value --
 * Market Value ≠ Transfer Fee), `trainingCompensationEur` is computed
 * once at offer time from the player's own club history (separate
 * economic line, never folded into the fee), and the two are only ever
 * SUMMED for affordability/reporting via
 * lib/economy/trainingCompensation.ts's own `computeTotalAcquisitionCostEur`
 * -- never blended into one number anywhere upstream of that.
 */
export interface TransferOffer {
  id: string;
  dealType: TransferDealType;
  playerId: string;
  fromClubId: string;
  toClubId: string;
  transferFeeEur: number;
  trainingCompensationEur: number;
  newWageEurPerMonth: number;
  /** PERMANENT only -- ignored for LOAN (the player's existing contract is left untouched by a loan). */
  newContractEndDate: string;
  loanTerms?: LoanTerms;
  status: TransferOfferStatus;
  offeredDate: string;
  clubDecisionReason?: string;
  playerDecisionReason?: string;
  /** PERMANENT deals only, only when the transfer window was closed at offer time -- the date the daily-tick hook will actually execute the roster move (Part: "deal agreed" vs "transfer completed/registered" vs "future arrival"). */
  scheduledCompletionDate?: string;
  resolvedDate?: string;
}

/**
 * Part: "no permanent ownership change" -- the player's own
 * PlayerContract.clubId is temporarily reassigned to `borrowingClubId`
 * for roster/tactics/wage-cost purposes (see transferExecution.ts), but
 * `parentClubId` here is the one persistent record of true ownership,
 * read by returnPlayerFromLoan when `endDate` is reached.
 */
export interface LoanRecord {
  id: string;
  playerId: string;
  parentClubId: string;
  borrowingClubId: string;
  startDate: string;
  endDate: string;
  wageShareBorrowingPct: number;
  /** The player's own wage at the PARENT club before the loan -- restored exactly on return, never re-derived (a genuinely sticky fact for the loan's own duration). */
  originalWageEurPerMonth: number;
  active: boolean;
}
