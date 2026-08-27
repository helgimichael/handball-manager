// HM-TRANSFERS-1.0: simple, deterministic player decision rule (Part:
// "enkel deterministic logic... Bygg inte personality/morale-agent-
// system ännu"). A small per-player seeded variance is included -- this
// is numeric jitter to avoid every player behaving identically under
// the same inputs, the same precedent lib/economy/clubHistoryGeneration.ts
// already uses for club-count variance, NOT a personality/morale system
// (no persisted trait, no stored mood, nothing beyond a one-off
// deterministic offset keyed on this specific decision).
import { seededOffset } from "../rating/generation/deterministicVariation";
import type { SquadStatus } from "../game-data";
import type { FinancialPressureLevel } from "../economy/clubEconomyTypes";

export interface PlayerDecisionResult {
  accept: boolean;
  reason: string;
}

export interface PlayerDecisionInputs {
  playerId: string;
  currentWageEurPerMonth: number;
  offeredWageEurPerMonth: number;
  currentClubTier: 1 | 2 | undefined;
  newClubTier: 1 | 2 | undefined;
  currentSquadStatus: SquadStatus;
  currentClubPressure: FinancialPressureLevel;
}

/**
 * A weighted, bounded score -- wage change matters most, a tier
 * upgrade/downgrade matters, and the player's own current situation
 * (an underused squad member, or a club in real financial trouble)
 * nudges them toward accepting. Never a stored trait -- recomputed
 * fresh from the offer + the player's CURRENT situation every call.
 */
export function evaluatePlayerDecision(inputs: PlayerDecisionInputs): PlayerDecisionResult {
  const wageDelta = inputs.currentWageEurPerMonth > 0 ? (inputs.offeredWageEurPerMonth - inputs.currentWageEurPerMonth) / inputs.currentWageEurPerMonth : 1;
  const currentTierScore = inputs.currentClubTier === 1 ? 1 : 0;
  const newTierScore = inputs.newClubTier === 1 ? 1 : 0;
  const tierDelta = newTierScore - currentTierScore;

  let situational = 0;
  if (inputs.currentSquadStatus === "Rotation" || inputs.currentSquadStatus === "Ungdom") situational += 0.1;
  else if (inputs.currentSquadStatus === "Förstaval") situational -= 0.05;

  const pressureBonus: Record<FinancialPressureLevel, number> = { NONE: 0, WATCH: 0, PRESSURED: 0.05, SERIOUS: 0.1, CRITICAL: 0.15 };

  const jitter = seededOffset(`${inputs.playerId}:transfer:decision-jitter`, 10) / 100; // deterministic +/-0.10

  const score = wageDelta * 0.5 + tierDelta * 0.25 + situational + pressureBonus[inputs.currentClubPressure] + jitter;

  if (score > -0.05) {
    return { accept: true, reason: "Spelaren är nöjd med löneerbjudandet och den nya situationen." };
  }
  return { accept: false, reason: "Spelaren tackar nej -- erbjudandet väger inte upp mot nuvarande situation." };
}
