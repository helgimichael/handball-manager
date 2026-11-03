// HM-CONTRACTS-1.0A & HM-PLAYTEST-IMPROVEMENT-02: the CareerState-level read for training
// compensation -- deliberately its OWN module, never merged into
// contractIntegration.ts, so market value/contracts and training
// compensation stay structurally separate all the way up to the UI
// (Part: "Den får INTE bakas in i market value eller transfer fee").
// Always freshly derived from the player's CURRENT age + their
// persisted club history and current club training period.
import type { CareerState } from "../career/types";
import type { TrainingCompensationResult } from "./types";
import {
  calculatePlayerTrainingCompensation,
  type TrainingCompensationResultDetailed,
} from "../transfers/trainingCompensation";

export {
  calculatePlayerTrainingCompensation,
  type TrainingCompensationResultDetailed,
};

export function getPlayerTrainingCompensation(
  state: CareerState,
  playerId: string,
  acquiringClubId?: string,
  sellingClubId?: string
): TrainingCompensationResult | undefined {
  const detailed = calculatePlayerTrainingCompensation(state, playerId, acquiringClubId, sellingClubId);
  return {
    totalEur: detailed.totalEur,
    perClub: detailed.perClub.map((c) => ({
      clubId: c.clubId,
      years: c.seasons,
      amountEur: c.amountEur,
    })),
    ruleSetVersion: detailed.ruleSetVersion,
  };
}
