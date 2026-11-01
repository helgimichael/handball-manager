// HM-CLUB-PARTNERSHIPS-1.1: Player Development Placements -- the actual
// PLAYER MOVEMENT mechanism HM-CLUB-PARTNERSHIPS-1.0's own
// isPartnershipExposureEligible explicitly left unbuilt ("THIS FUNCTION
// NEVER MOVES A PLAYER... nothing does yet").
//
// Two genuinely different mechanisms live here, matching the two
// genuinely different relationship families in clubPartnerships.ts:
//
//  - DOMESTIC (AFFILIATED_B_TEAM / DEVELOPMENT_PARTNERSHIP): a
//    PlayerPlacement row. The player NEVER moves club-wise -- contract,
//    wage, owning club, worldSquads membership, gameplayRatings all stay
//    exactly where they are (Part: "Spelaren behåller: kontrakt, lön,
//    owning club, canonical identity"). Division 1 is never simulated
//    (Part: "Skapa inte fejkade Division 1-matchresultat"), so there is
//    nothing to move them INTO anyway -- no real match-squad ever gets
//    built for a Division 1/partner club. The only real effects are (a)
//    PlayerAvailability flips to ON_PLACEMENT (excludes the player from
//    the PARENT club's own match/training-load selection, via the
//    existing isSelectableForMatch/effectiveTrainingLoadSetting chain,
//    unchanged) and (b) a new development-stimulus source
//    (developmentIntegration.ts's applyPlacementDevelopmentStimulus)
//    feeds the SAME playerDevelopmentState pipeline every other source
//    already uses.
//
//  - INTERNATIONAL (INTERNATIONAL_LOAN_PARTNERSHIP): a REAL loan. This
//    genuinely IS meant to move the player (Part: "Regler kvarstår:
//    different country, normal loan, loan fee 0, wage share separat, no
//    age limit") -- startInternationalPartnershipLoan is a thin wrapper
//    that reuses transferExecution.ts's loanPlayerOut/LoanRecord
//    completely unmodified, exactly like a normal negotiated loan, minus
//    the club/player negotiation step (a partnership loan is pre-agreed
//    by definition -- the two clubs already have a standing relationship).
import { getClub } from "../game-data";
import { PERMANENT_B_TEAM_PAIRS, isPartnershipExposureEligible } from "./clubPartnerships";
import { getCareerPlayer } from "./careerWorld";
import { getPlayerContract } from "../economy/contractIntegration";
import { loanPlayerOut } from "../transfers/transferExecution";
import type { LoanRecord } from "../transfers/types";
import type { CareerState } from "./types";

export const PLACEMENT_RELATION_TYPES = ["AFFILIATED_B_TEAM", "DEVELOPMENT_PARTNERSHIP"] as const;
export type PlacementRelationType = (typeof PLACEMENT_RELATION_TYPES)[number];

export const PLACEMENT_STATUSES = ["ACTIVE", "RECALLED", "EXPIRED"] as const;
export type PlacementStatus = (typeof PLACEMENT_STATUSES)[number];

/**
 * `sourceClubId` is always the player's own OWNING club (never changes);
 * `partnerClubId` the B-team/development-partner club they are placed
 * at. `endDate` is set only when the placement ends (RECALLED: manager
 * action, any time; EXPIRED: the underlying ClubPartnership itself ended
 * -- a DEVELOPMENT_PARTNERSHIP terminated/expired out from under an
 * active placement). `exposureAccrued` is a simple, honest DAY COUNT
 * (never a fabricated stat) -- how many placement-stimulus days this row
 * has contributed, for UI display only.
 */
export interface PlayerPlacement {
  id: string;
  playerId: string;
  sourceClubId: string;
  partnerClubId: string;
  relationId: string;
  relationType: PlacementRelationType;
  startDate: string;
  endDate: string | null;
  status: PlacementStatus;
  exposureAccrued: number;
}

function nextPlacementId(state: CareerState, playerId: string, date: string): string {
  return `placement-${playerId}-${date}-${Object.keys(state.playerPlacements).length}`;
}

export function getActivePlacementForPlayer(state: CareerState, playerId: string): PlayerPlacement | undefined {
  return Object.values(state.playerPlacements).find((p) => p.playerId === playerId && p.status === "ACTIVE");
}

export function getPlacementHistoryForPlayer(state: CareerState, playerId: string): PlayerPlacement[] {
  return Object.values(state.playerPlacements)
    .filter((p) => p.playerId === playerId)
    .sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
}

/** Every ACTIVE placement whose target is `partnerClubId` -- for the Club Partnerships view's own "who is placed here right now" list. */
export function getActivePlacementsAtClub(state: CareerState, partnerClubId: string): PlayerPlacement[] {
  return Object.values(state.playerPlacements).filter((p) => p.status === "ACTIVE" && p.partnerClubId === partnerClubId);
}

function relationTypeForEligibleClub(state: CareerState, parentClubId: string, partnerClubId: string): { relationId: string; relationType: PlacementRelationType } | undefined {
  const permanent = PERMANENT_B_TEAM_PAIRS.find((p) => p.clubAId === parentClubId && p.clubBId === partnerClubId);
  if (permanent) {
    const permanentRow = Object.values(state.clubPartnerships).find((p) => p.type === "AFFILIATED_B_TEAM" && p.clubAId === parentClubId && p.clubBId === partnerClubId);
    if (permanentRow) return { relationId: permanentRow.id, relationType: "AFFILIATED_B_TEAM" };
  }
  const development = Object.values(state.clubPartnerships).find(
    (p) => p.type === "DEVELOPMENT_PARTNERSHIP" && p.status === "ACTIVE" && p.clubAId === parentClubId && p.clubBId === partnerClubId,
  );
  if (development) return { relationId: development.id, relationType: "DEVELOPMENT_PARTNERSHIP" };
  return undefined;
}

/**
 * Part: eligibility (isPartnershipExposureEligible, unchanged) PLUS the
 * two guardrails Part explicitly requires: no two active placements for
 * one player, and never both development-placed and on a normal loan at
 * the same time (a loan is a real ownership-adjacent move; a placement
 * assumes the player is still fully at the parent club's disposal).
 */
export function canStartPlacement(state: CareerState, playerId: string, partnerClubId: string): string[] {
  const errors: string[] = [];
  const eligibility = isPartnershipExposureEligible(state, playerId, partnerClubId);
  if (!eligibility.eligible) errors.push(eligibility.reason ?? "Spelaren är inte kvalificerad för spelmöjlighet hos denna klubb.");
  if (getActivePlacementForPlayer(state, playerId)) errors.push("Spelaren är redan placerad hos en partnerklubb.");
  const hasActiveLoan = Object.values(state.loans).some((l) => l.active && l.playerId === playerId);
  if (hasActiveLoan) errors.push("Spelaren är utlånad och kan inte samtidigt placeras hos en partnerklubb.");
  return errors;
}

export interface StartPlacementResult {
  ok: boolean;
  errors: string[];
  placement?: PlayerPlacement;
}

/**
 * Never moves worldSquads/gameplayRatings/contract (Part: "Spelaren
 * behåller..."). The only state changes are the new PlayerPlacement row
 * and PlayerAvailability -> ON_PLACEMENT.
 */
export function startPlacement(state: CareerState, playerId: string, partnerClubId: string, date: string): StartPlacementResult {
  const errors = canStartPlacement(state, playerId, partnerClubId);
  if (errors.length > 0) return { ok: false, errors };

  const player = getCareerPlayer(state, playerId);
  if (!player) return { ok: false, errors: ["Spelaren hittades inte."] };
  const relation = relationTypeForEligibleClub(state, player.clubId, partnerClubId);
  if (!relation) return { ok: false, errors: ["Ingen aktiv partnerskapsrelation mellan spelarens klubb och denna klubb."] };

  const placement: PlayerPlacement = {
    id: nextPlacementId(state, playerId, date),
    playerId,
    sourceClubId: player.clubId,
    partnerClubId,
    relationId: relation.relationId,
    relationType: relation.relationType,
    startDate: date,
    endDate: null,
    status: "ACTIVE",
    exposureAccrued: 0,
  };
  return { ok: true, errors: [], placement };
}

function endPlacement(state: CareerState, placement: PlayerPlacement, date: string, status: "RECALLED" | "EXPIRED"): CareerState {
  let next: CareerState = {
    ...state,
    playerPlacements: { ...state.playerPlacements, [placement.id]: { ...placement, status, endDate: date } },
  };
  // Only restore AVAILABLE if the player is still flagged ON_PLACEMENT --
  // never clobbers an unrelated status (e.g. an injury) that may have
  // been recorded independently while the player was placed.
  const currentStatus = next.playerStatuses[placement.playerId];
  if (currentStatus?.availability === "ON_PLACEMENT") {
    next = { ...next, playerStatuses: { ...next.playerStatuses, [placement.playerId]: { playerId: placement.playerId, availability: "AVAILABLE" } } };
  }
  return next;
}

/** Idempotent (Part: "Recall ska vara idempotent") -- a no-op if the player has no ACTIVE placement. Preserves the row's own history (status flips to RECALLED, never deleted). */
export function recallPlayerFromPlacement(state: CareerState, playerId: string, date: string): CareerState {
  const placement = getActivePlacementForPlayer(state, playerId);
  if (!placement) return state;
  return endPlacement(state, placement, date, "RECALLED");
}

/** HM-PLAYER-CONTRACT-LIFECYCLE-1.0 Part 10: generic "end whatever ACTIVE placement this player has, for a caller-chosen reason" -- reused by contractExpiry.ts when the parent club's own contract expires out from under an active placement (a placement is never an ownership transfer, so losing the contract means losing the placement too). Idempotent, same as recallPlayerFromPlacement. */
export function endActivePlacementForPlayer(state: CareerState, playerId: string, date: string, status: "RECALLED" | "EXPIRED"): CareerState {
  const placement = getActivePlacementForPlayer(state, playerId);
  if (!placement) return state;
  return endPlacement(state, placement, date, status);
}

/**
 * Called from dailyTick.ts step 5, immediately after
 * progressPartnershipExpiry -- any ACTIVE placement whose own
 * ClubPartnership row is no longer ACTIVE (expired or manager-terminated)
 * is auto-ended as EXPIRED (distinct from a manager-initiated RECALLED),
 * since the underlying relationship that made the placement possible no
 * longer exists. A permanent AFFILIATED_B_TEAM row never expires on its
 * own, so a B-team placement only ever ends via manager recall.
 */
export function progressPlacementExpiry(state: CareerState, date: string): { state: CareerState; expired: PlayerPlacement[] } {
  const active = Object.values(state.playerPlacements).filter((p) => p.status === "ACTIVE");
  const due = active.filter((p) => {
    const relation = state.clubPartnerships[p.relationId];
    return !relation || relation.status !== "ACTIVE";
  });
  if (due.length === 0) return { state, expired: [] };

  let next = state;
  const expired: PlayerPlacement[] = [];
  for (const placement of due) {
    next = endPlacement(next, next.playerPlacements[placement.id], date, "EXPIRED");
    expired.push(next.playerPlacements[placement.id]);
  }
  return { state: next, expired };
}

/**
 * Called from dailyTick.ts step 3, alongside applyPlacementDevelopmentStimulus --
 * a simple, honest day-count (Part: "no fake stats") for the UI's own
 * "X dagar hos partnerklubb" display, never a fabricated match/goal/assist
 * tally.
 */
export function accrueDailyPlacementExposure(state: CareerState): CareerState {
  const active = Object.values(state.playerPlacements).filter((p) => p.status === "ACTIVE");
  if (active.length === 0) return state;
  let playerPlacements = state.playerPlacements;
  for (const placement of active) {
    playerPlacements = { ...playerPlacements, [placement.id]: { ...placement, exposureAccrued: placement.exposureAccrued + 1 } };
  }
  return { ...state, playerPlacements };
}

// ---------------------------------------------------------------------------
// International loan partnership: minimal integration -- reuses the
// existing, unmodified loan mechanism (transferExecution.ts's
// loanPlayerOut, transfers/types.ts's LoanRecord), skipping only the
// club/player market-negotiation layer (a partnership loan is pre-agreed
// by the standing INTERNATIONAL_LOAN_PARTNERSHIP itself). Loan fee stays
// 0 (loanPlayerOut has no fee parameter at all); wageShareBorrowingPct is
// caller-supplied and never forced to any particular value (Part: "salary
// contribution är separat").
// ---------------------------------------------------------------------------

export interface StartPartnershipLoanResult {
  ok: boolean;
  errors: string[];
  loan?: LoanRecord;
  state?: CareerState;
}

export function startInternationalPartnershipLoan(
  state: CareerState,
  partnershipId: string,
  playerId: string,
  wageShareBorrowingPct: number,
  endDate: string,
  date: string,
): StartPartnershipLoanResult {
  const partnership = state.clubPartnerships[partnershipId];
  if (!partnership || partnership.type !== "INTERNATIONAL_LOAN_PARTNERSHIP" || partnership.status !== "ACTIVE") {
    return { ok: false, errors: ["Inget aktivt internationellt låneavtal."] };
  }
  const player = getCareerPlayer(state, playerId);
  if (!player || player.clubId !== partnership.clubAId) return { ok: false, errors: ["Spelaren tillhör inte den utlånande klubben."] };
  if (!getClub(partnership.clubBId)) return { ok: false, errors: ["Okänd låntagande klubb."] };
  const contract = getPlayerContract(state, playerId);
  if (!contract) return { ok: false, errors: ["Spelaren saknar kontrakt."] };
  const hasActiveLoan = Object.values(state.loans).some((l) => l.active && l.playerId === playerId);
  if (hasActiveLoan) return { ok: false, errors: ["Spelaren är redan utlånad."] };
  if (getActivePlacementForPlayer(state, playerId)) return { ok: false, errors: ["Spelaren är placerad hos en partnerklubb och kan inte samtidigt lånas ut."] };

  let next = loanPlayerOut(state, playerId, partnership.clubAId, partnership.clubBId);
  const loan: LoanRecord = {
    id: `pship-loan-${playerId}-${date}-${Object.keys(next.loans).length}`,
    playerId,
    parentClubId: partnership.clubAId,
    borrowingClubId: partnership.clubBId,
    startDate: date,
    endDate,
    wageShareBorrowingPct,
    originalWageEurPerMonth: contract.wageEurPerMonth,
    active: true,
  };
  next = { ...next, loans: { ...next.loans, [loan.id]: loan } };
  return { ok: true, errors: [], loan, state: next };
}
