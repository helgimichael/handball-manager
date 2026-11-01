// HM-TRANSFERS-1.0: the transfer/free-agent/loan domain's own vocabulary.
// Reuses lib/economy's existing PlayerContract/PlayerClubHistory/
// TrainingCompensationResult/ClubBudgets rather than duplicating any of
// them (Part: "Skapa inte parallella player/club/economy-system").
//
// HM-ALPHA2-05A: the manager's PERMANENT signings now go through a
// persisted two-stage TransferNegotiation (below) first; the one-shot
// path remains for CPU recruitment and loans.
//
// Deliberately kept SYNCHRONOUS/one-shot for this first version: a
// single `submitTransferOffer` call resolves affordability -> selling
// club decision -> player decision -> (window-gated) completion in one
// step, rather than a multi-day back-and-forth negotiation -- Part:
// "Ingen modern AI-agent". Every intermediate rule (affordability, club
// decision, player decision) is still its own independently testable
// pure function; only the ORCHESTRATION is synchronous.

import type { SquadStatusTier } from "../career/squadStatus";

export const TRANSFER_DEAL_TYPES =["PERMANENT", "LOAN"] as const;
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
  /** HM-ALPHA2-05A: the squad role promised in a negotiated deal -- applied to the buying manager's own `playerSquadStatus` on arrival. Absent on one-shot/CPU offers and pre-05A saves. */
  promisedSquadRole?: SquadStatusTier;
  /** HM-ALPHA2-05A: the TransferNegotiation this offer concluded, when it came out of the two-stage flow. */
  negotiationId?: string;
}

// ---------------------------------------------------------------------------
// HM-ALPHA2-05A: two-stage negotiation (club fee -> player terms).
// ---------------------------------------------------------------------------

/**
 * CLUB: haggling over the fee with the selling club. PLAYER: fee agreed
 * (or free agent), haggling over wage/length/role with the player.
 * COMPLETED: player accepted, a TransferOffer was created (`offerId`).
 * COLLAPSED: one side broke off talks -- `closedUntil` blocks a fresh
 * approach for the same player. WITHDRAWN: the manager walked away.
 * HM-ALPHA2-05B: EXPIRED: the manager let a response deadline pass.
 * LOST: the player signed for (or agreed with) another club meanwhile.
 */
export const TRANSFER_NEGOTIATION_STAGES = ["CLUB", "PLAYER", "COMPLETED", "COLLAPSED", "WITHDRAWN", "EXPIRED", "LOST"] as const;
export type TransferNegotiationStage = (typeof TRANSFER_NEGOTIATION_STAGES)[number];

export type NegotiationResponse = "ACCEPT" | "COUNTER" | "REJECT" | "BREAK_OFF";

export interface NegotiationRound {
  date: string;
  /** HM-ALPHA2-05B: MARKET -- an informational entry about a rival club's move, not an answer to the manager. */
  party: "CLUB" | "PLAYER" | "MARKET";
  offeredFeeEur?: number;
  offeredWageEurPerMonth?: number;
  contractYears?: number;
  promisedSquadRole?: SquadStatusTier;
  response: NegotiationResponse;
  /** CLUB counter -- the club's stated asking fee. */
  counterFeeEur?: number;
  /** PLAYER counter -- the player's stated wage demand. */
  counterWageEurPerMonth?: number;
  /** HM-ALPHA2-05C (LOAN): the borrowing club's offered wage share and loan end date, and the owner's required share. */
  offeredWageSharePct?: number;
  loanEndDate?: string;
  counterWageSharePct?: number;
  reason: string;
}

export interface TransferNegotiation {
  id: string;
  playerId: string;
  /** "" for a free agent (no selling club -- negotiation starts at PLAYER). */
  fromClubId: string;
  toClubId: string;
  stage: TransferNegotiationStage;
  startedDate: string;
  updatedDate: string;
  /** Set once the selling club accepts (0 for a free agent); locked for the player stage. */
  agreedFeeEur?: number;
  rounds: NegotiationRound[];
  /** COLLAPSED only -- no new negotiation for this player/buyer before this date. */
  closedUntil?: string;
  /** COMPLETED only -- the TransferOffer the agreement produced. */
  offerId?: string;
  /** HM-ALPHA2-05B: the manager's offer awaiting an answer -- resolved by the daily tick on `responseDate`. */
  pending?: PendingNegotiationOffer;
  /** HM-ALPHA2-05B: after an answer, the manager must make the next move by this date or the negotiation EXPIRES (an agreed fee lapses with it). */
  expiresDate?: string;
  /** HM-ALPHA2-05B: CPU clubs pursuing the same player, found with the existing recruitment logic when talks opened. */
  rivals?: RivalInterest[];
  /**
   * HM-ALPHA2-05C: absent = PERMANENT (every pre-05C negotiation). A LOAN
   * negotiation agrees a wage share and end date with the OWNING club
   * (`fromClubId`), then a playing role with the player; the contract and
   * its ownership never change.
   */
  dealType?: TransferDealType;
  /** LOAN only -- set once the owner accepts, locked for the player stage. */
  agreedWageSharePct?: number;
  loanEndDate?: string;
}

export interface PendingNegotiationOffer {
  party: "CLUB" | "PLAYER";
  submittedDate: string;
  responseDate: string;
  offeredFeeEur?: number;
  offeredWageEurPerMonth?: number;
  contractYears?: number;
  promisedSquadRole?: SquadStatusTier;
  /** HM-ALPHA2-05C (LOAN). */
  wageSharePct?: number;
  loanEndDate?: string;
}

/**
 * HM-ALPHA2-05B: one CPU club's competing pursuit. Its terms are fixed
 * when it is found (the same fee/wage estimate cpuCandidateEvaluation.ts
 * uses for its own offers, the role the player would earn there); on
 * `decisionDate` it either signs the player or drops out.
 */
export interface RivalInterest {
  clubId: string;
  feeEur: number;
  wageEurPerMonth: number;
  contractYears: number;
  role: SquadStatusTier;
  decisionDate: string;
  status: "ACTIVE" | "WITHDRAWN" | "SIGNED";
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
