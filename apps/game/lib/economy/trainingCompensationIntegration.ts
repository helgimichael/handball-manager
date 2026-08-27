// HM-CONTRACTS-1.0A: the CareerState-level read for training
// compensation -- deliberately its OWN module, never merged into
// contractIntegration.ts, so market value/contracts and training
// compensation stay structurally separate all the way up to the UI
// (Part: "Den får INTE bakas in i market value eller transfer fee").
// Always freshly derived from the player's CURRENT age + their
// persisted club history -- same "derived, never stored" precedent as
// market value itself (an aging-out player's compensation eligibility
// must track the real in-career calendar, not a frozen number).
import { getCareerPlayer } from "../career/careerWorld";
import { playerAgeAtDate } from "../development/developmentIntegration";
import type { CareerState } from "../career/types";
import { getPlayerClubHistory } from "./clubHistoryIntegration";
import { computeTrainingCompensationEur, GENERIC_FOUNDATION_RULE_SET } from "./trainingCompensation";
import type { TrainingCompensationResult } from "./types";

export function getPlayerTrainingCompensation(state: CareerState, playerId: string): TrainingCompensationResult | undefined {
  const player = getCareerPlayer(state, playerId);
  const history = getPlayerClubHistory(state, playerId);
  if (!player || !history) return undefined;
  const age = playerAgeAtDate(player.dateOfBirth, player.birthYear, state.gameDate);
  return computeTrainingCompensationEur(age, history.entries, GENERIC_FOUNDATION_RULE_SET);
}
