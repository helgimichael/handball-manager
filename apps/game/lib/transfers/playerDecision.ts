// HM-TRANSFER-REALISM-1.0: the player's answer to a concrete transfer offer.
//
// Before this milestone this file held its own weighted rule (wage delta 0.5,
// binary tier delta 0.25, jitter) -- the rule every CPU bid went through. It
// ignored the player's level and the club's level entirely, and a free agent's
// recorded wage of 0 made every offer look like a 100% raise, so a free agent
// accepted ANY CPU bid (audit P1/P2). It is now a thin delegate to the shared
// Player Career Decision Model, the same model the manager's negotiations,
// rival bids, incoming offers, renewals and the international market use.
import type { CareerState } from "../career/types";
import type { SquadStatusTier } from "../career/squadStatus";
import { playerDecisionOnMove } from "./careerDecision/stateAdapter";

export interface PlayerDecisionResult {
  accept: boolean;
  reason: string;
}

export interface PlayerTransferDecisionInputs {
  playerId: string;
  toClubId: string;
  offeredWageEurPerMonth: number;
  contractYears: number;
  signingBonusEur?: number;
  promisedSquadRole?: SquadStatusTier;
}

/** Same player + same club + same terms -> the same answer, whoever is buying. */
export function evaluatePlayerTransferDecision(state: CareerState, inputs: PlayerTransferDecisionInputs): PlayerDecisionResult {
  const outcome = playerDecisionOnMove(state, inputs.playerId, inputs.toClubId, {
    wageEurPerMonth: inputs.offeredWageEurPerMonth,
    contractYears: inputs.contractYears,
    signingBonusEur: inputs.signingBonusEur,
    promisedRole: inputs.promisedSquadRole,
  });
  return { accept: outcome.accept, reason: outcome.reason };
}
