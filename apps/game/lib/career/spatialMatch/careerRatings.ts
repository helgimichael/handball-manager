/**
 * MATCH-EXPERIENCE-2.0 M14: career attributes -> the small rating surface the
 * spatial engine actually reads.
 *
 * M6-M12 consume exactly five numbers per player, all on the same 1-20 scale
 * the game's own attributes already use:
 *
 *   shooting      finishing quality                (M9's shot execution)
 *   passing       quality of the options he makes  (M6 circulation, M8 outlets)
 *   attacking     willingness to take a gap on     (M6 drives and take-ons)
 *   defending     ball-winning and step-out reach  (M7, M8 retreat)
 *   shotStopping  a goalkeeper's save quality      (M9's contest)
 *
 * THIS IS NOT THE FINAL ATTRIBUTE MODEL. It is a small, explicit, inspectable
 * projection FROM the model the game already has ONTO the five inputs the
 * engine already had. Nothing new is invented on either side, and every blend
 * below is written out rather than hidden behind a weighting engine.
 *
 * THREE SOURCES, BEST FIRST. A player's canonical gameplay rating (the 56-key
 * outcourt / 21-key goalkeeper vocabulary) is used when the career has one.
 * Otherwise his PlayerMock attributes, which are already 1-20. Otherwise his
 * current ability alone, mapped onto the same scale -- an honest last resort
 * that keeps a match playable rather than silently giving him a neutral 10.
 */
import type { PlayerMock } from "../../game-data/types";
import type { GameplayPlayerRating } from "../../gameWorld/gameplayRatingSnapshot";
import type { GoalkeeperAttribute, OutcourtAttribute } from "../../rating/types";

/** The engine's own per-player rating surface. Structural, so no engine import is needed. */
export type SpatialPlayerRatings = {
  readonly shooting?: number;
  readonly attacking?: number;
  readonly passing?: number;
  readonly defending?: number;
  readonly shotStopping?: number;
};

/** Where a player's numbers came from, so a caller can report the mapping honestly. */
export type RatingSource = "GAMEPLAY_RATING" | "MOCK_ATTRIBUTES" | "CURRENT_ABILITY";

export type SpatialRatingEntry = SpatialPlayerRatings & { readonly source: RatingSource };

const NEUTRAL = 10;

function clamp1to20(value: number): number {
  return Math.max(1, Math.min(20, Math.round(value * 10) / 10));
}

function mean(values: readonly number[]): number {
  const usable = values.filter((v) => Number.isFinite(v));
  return usable.length === 0 ? NEUTRAL : usable.reduce((a, b) => a + b, 0) / usable.length;
}

// ---------------------------------------------------------------------------
// Source 1: the canonical gameplay rating
// ---------------------------------------------------------------------------

/**
 * The blends. Each engine input is the mean of the few canonical attributes
 * that plainly describe it -- deliberately few, and deliberately obvious.
 */
export const OUTCOURT_BLEND: Readonly<Record<"shooting" | "passing" | "attacking" | "defending", readonly OutcourtAttribute[]>> = Object.freeze({
  shooting: ["SHOOTING_POWER", "SHOOTING_PLACEMENT", "FINISHING"],
  passing: ["PASSING", "PLAYMAKING"],
  attacking: ["BREAKTHROUGH", "BALL_HANDLING"],
  defending: ["DEFENSIVE_POSITIONING", "BALL_WINNING", "CONTACT_ABILITY"],
});

export const GOALKEEPER_BLEND: Readonly<Record<"shotStopping" | "passing", readonly GoalkeeperAttribute[]>> = Object.freeze({
  shotStopping: ["GK_POSITIONING", "REACTION", "LOW_SAVES", "HIGH_SAVES"],
  // M8 asks a goalkeeper to start the break, so his outlet is a real input.
  passing: ["OUTLET_PASSING", "TRANSITION_DECISION"],
});

function fromGameplayRating(rating: GameplayPlayerRating): SpatialRatingEntry {
  if (rating.branch.branch === "GOALKEEPER") {
    const attributes = rating.branch.attributes;
    const pick = (keys: readonly GoalkeeperAttribute[]) => mean(keys.map((k) => attributes[k]?.value ?? NEUTRAL));
    return {
      source: "GAMEPLAY_RATING",
      shotStopping: clamp1to20(pick(GOALKEEPER_BLEND.shotStopping)),
      passing: clamp1to20(pick(GOALKEEPER_BLEND.passing)),
    };
  }
  const attributes = rating.branch.attributes;
  const pick = (keys: readonly OutcourtAttribute[]) => mean(keys.map((k) => attributes[k]?.value ?? NEUTRAL));
  return {
    source: "GAMEPLAY_RATING",
    shooting: clamp1to20(pick(OUTCOURT_BLEND.shooting)),
    passing: clamp1to20(pick(OUTCOURT_BLEND.passing)),
    attacking: clamp1to20(pick(OUTCOURT_BLEND.attacking)),
    defending: clamp1to20(pick(OUTCOURT_BLEND.defending)),
  };
}

// ---------------------------------------------------------------------------
// Source 2: the PlayerMock attribute set (already 1-20)
// ---------------------------------------------------------------------------

function fromMockAttributes(player: PlayerMock): SpatialRatingEntry {
  const { technical, mental, physical } = player.attributes;
  if (player.position === "MV") {
    return {
      source: "MOCK_ATTRIBUTES",
      // No dedicated goalkeeper family exists in the mock set, so his save
      // quality is read from the three attributes the mock GK archetype is
      // actually built out of (see game-data/players.ts's GK_BIAS).
      shotStopping: clamp1to20(mean([mental.positionering, mental.kyla, physical.rorlighet])),
      passing: clamp1to20(technical.passning),
    };
  }
  return {
    source: "MOCK_ATTRIBUTES",
    shooting: clamp1to20(technical.skott),
    passing: clamp1to20(mean([technical.passning, technical.spelforstaelse])),
    attacking: clamp1to20(mean([technical.genombrott, technical.fint])),
    defending: clamp1to20(mean([mental.positionering, mental.kampvilja, physical.styrka])),
  };
}

// ---------------------------------------------------------------------------
// Source 3: current ability alone
// ---------------------------------------------------------------------------

/**
 * CA is a 1-200 hidden development scale; the engine's is 1-20. Dividing by ten
 * is the whole conversion, and it is stated rather than tuned.
 */
export function ratingFromCurrentAbility(currentAbility: number, isGoalkeeper: boolean): SpatialRatingEntry {
  const value = clamp1to20(currentAbility / 10);
  return isGoalkeeper
    ? { source: "CURRENT_ABILITY", shotStopping: value, passing: value }
    : { source: "CURRENT_ABILITY", shooting: value, passing: value, attacking: value, defending: value };
}

// ---------------------------------------------------------------------------
// The mapping itself
// ---------------------------------------------------------------------------

/**
 * Every selected player's engine ratings, keyed by his real career playerId.
 *
 * The returned map is exactly what `simulateMatch` takes as `ratings`, so no
 * further translation happens anywhere downstream.
 */
export function buildSpatialRatings(
  squad: readonly PlayerMock[],
  gameplayRatings: readonly GameplayPlayerRating[],
  playerIds: readonly string[],
): Record<string, SpatialRatingEntry> {
  const bySquadId = new Map(squad.map((p) => [p.id, p]));
  const byRatingId = new Map(gameplayRatings.map((r) => [r.playerId, r]));
  const out: Record<string, SpatialRatingEntry> = {};
  for (const playerId of playerIds) {
    const canonical = byRatingId.get(playerId);
    if (canonical) {
      out[playerId] = fromGameplayRating(canonical);
      continue;
    }
    const player = bySquadId.get(playerId);
    if (player) {
      out[playerId] = fromMockAttributes(player);
      continue;
    }
    // Nothing at all is known about him. He is still a real selected player, so
    // he plays at a neutral 10 rather than being dropped from the match.
    out[playerId] = ratingFromCurrentAbility(NEUTRAL * 10, false);
  }
  return out;
}
