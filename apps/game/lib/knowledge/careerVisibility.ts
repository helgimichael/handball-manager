// HM-ALPHA3 release readiness: one resolver for an external player's star
// ranges, used by every screen. The scout's suitability changes how often an
// estimate is off; if two screens resolved the same player with different
// suitability, comparing them would reveal the truth. Every caller goes
// through here and gets the latest report's suitability.
import { getPlayerScoutReports } from "../career/scouting";
import type { CareerState } from "../career/types";
import { resolvePlayerVisibility, type KnowledgeRatingInput, type PlayerVisibleView } from "./playerVisibility";

export function careerPlayerVisibility(state: CareerState, rating: KnowledgeRatingInput, playerId: string, knowledgePct: number): PlayerVisibleView {
  const report = getPlayerScoutReports(state, playerId)[0];
  return resolvePlayerVisibility({ ...rating, playerId }, knowledgePct, report?.scoutSuitability);
}
