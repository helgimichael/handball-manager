// HM-PLAYER-CALIBRATION-1.0 Part D: the ONE canonical, squad-derived
// ClubStrength -- replaces lib/game-data/clubStrength.ts's two competing
// "sportive truths" (Allsvenskan's 13 hand-curated flat numbers, and
// Handbollsligan's identical flat 50/50/50/50 default for every real
// club) with a single path computed from the exact same canonical
// GameplayPlayerRating[] snapshot Match Engine, Development, and market
// value already read (see gameplayRatingSnapshot.ts) plus the manually-
// calibrated squad hierarchy (squadStatus.ts's SquadStatusTier).
//
// Deliberately NOT a flat average CA over the whole squad: each
// player's contribution is weighted by their squad-hierarchy tier
// (TIER_WEIGHT below), so a bench Talang does not weigh as much as a
// Nyckelspelare -- mirrors the SAME tier-weighting principle
// lib/matchPlan/defaultMatchPlan.ts's STARTER_ROLE_BY_TIER/
// BENCH_ROLE_BY_TIER already establishes for match-usage, applied here
// to season-long team quality instead of one match's selection.
//
// Reuses playerMatchStrength.ts's own playerAttackValue/
// playerDefenceValue/playerGoalkeeperValue/weightedMean verbatim -- one
// quality model (CA + a phase-relevant attribute-family blend), never a
// second competing one.
//
// Economy and Staff intentionally have NO input here (Part D: "Economy
// ska INTE ge direkt matchbonus. Staff ska INTE ge generell direkt
// matchbonus i detta pass.") -- their effect on team strength stays
// fully indirect, via which players a club can afford/develop, exactly
// as before.
import type { ClubStrength } from "@handball-manager/game-simulation";
import type { HandballPosition, PlayerMock } from "../game-data";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import { deriveDefaultSquadStatusTier, SQUAD_STATUS_TIERS, type SquadStatusTier } from "./squadStatus";
import { playerAttackValue, playerDefenceValue, playerGoalkeeperValue, weightedMean } from "./playerMatchStrength";

/** How much a player's own quality counts toward the club's overall strength -- a benched Talang barely moves the needle; a Nyckelspelare (starter or not) counts almost fully. */
const TIER_WEIGHT: Record<SquadStatusTier, number> = {
  KEY_PLAYER: 1.0,
  FIRST_CHOICE: 0.8,
  ROTATION: 0.55,
  SQUAD_PLAYER: 0.3,
  TALENT: 0.15,
};

const TIER_ORDER: Record<SquadStatusTier, number> = Object.fromEntries(SQUAD_STATUS_TIERS.map((tier, i) => [tier, i])) as Record<SquadStatusTier, number>;

const OUTCOURT_POSITIONS: readonly HandballPosition[] = ["V6", "V9", "M9", "M6", "H9", "H6"];
const ALL_POSITIONS: readonly HandballPosition[] = ["MV", ...OUTCOURT_POSITIONS];

/** No rostered player at all for a position/depth slot is a genuine weakness, not a neutral unknown -- a low, non-neutral baseline (never 0, never NEUTRAL_VALUE). */
const MISSING_DEPTH_BASELINE = 25;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function playerGenericQuality(player: PlayerMock, ratingById: ReadonlyMap<string, GameplayPlayerRating>): number {
  const rating = ratingById.get(player.id);
  if (player.position === "MV") return playerGoalkeeperValue(rating);
  return (playerAttackValue(rating) + playerDefenceValue(rating)) / 2;
}

/**
 * Positional/squad depth: for each of the 7 positions (6 outcourt + GK),
 * the average quality of the top-2 available players at that position
 * (ranked by squad-hierarchy tier, then quality) -- a position with only
 * one rostered player, or two weak ones, pulls depth down; a position
 * with two genuinely strong options does not. Averaged across all 7
 * positions into a single 0-100 depth score.
 */
function computeDepth(squad: readonly PlayerMock[], ratingById: ReadonlyMap<string, GameplayPlayerRating>): number {
  const scores: number[] = [];
  for (const position of ALL_POSITIONS) {
    const ranked = squad
      .filter((p) => p.position === position)
      .map((p) => ({ tier: deriveDefaultSquadStatusTier(p), quality: playerGenericQuality(p, ratingById) }))
      .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.quality - a.quality)
      .map((x) => x.quality);
    const top2 = [ranked[0] ?? MISSING_DEPTH_BASELINE, ranked[1] ?? MISSING_DEPTH_BASELINE];
    scores.push((top2[0] + top2[1]) / 2);
  }
  return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 45;
}

/**
 * The ONE canonical ClubStrength computation -- used identically for
 * every real-world club in both leagues (Allsvenskan and
 * Handbollsligan), IFK Tumba, and any future club. `ratings` is the
 * club's CareerState.gameplayRatings[clubId] snapshot; `squad` is its
 * PlayerMock[] roster (for position + squad-hierarchy tier). Missing/
 * empty inputs resolve to the same neutral 50/50/50/50 default the old
 * Handbollsligan fallback used, never a crash or an invented extreme.
 */
export function computeSquadDerivedClubStrength(clubId: string, squad: readonly PlayerMock[], ratings: readonly GameplayPlayerRating[]): ClubStrength {
  if (squad.length === 0) {
    return { clubId, overall: 50, attack: 50, defense: 50, goalkeeper: 50, depth: 45 };
  }
  const ratingById = new Map(ratings.map((r) => [r.playerId, r]));
  const outfield = squad.filter((p) => p.position !== "MV");
  const goalkeepers = squad.filter((p) => p.position === "MV");

  const attackItems = outfield.map((p) => ({ value: playerAttackValue(ratingById.get(p.id)), weight: TIER_WEIGHT[deriveDefaultSquadStatusTier(p)] }));
  const defenceItems = outfield.map((p) => ({ value: playerDefenceValue(ratingById.get(p.id)), weight: TIER_WEIGHT[deriveDefaultSquadStatusTier(p)] }));
  const goalkeeperItems = goalkeepers.map((p) => ({ value: playerGoalkeeperValue(ratingById.get(p.id)), weight: TIER_WEIGHT[deriveDefaultSquadStatusTier(p)] }));

  const attack = outfield.length > 0 ? weightedMean(attackItems) : 50;
  const defense = outfield.length > 0 ? weightedMean(defenceItems) : 50;
  const goalkeeper = goalkeepers.length > 0 ? weightedMean(goalkeeperItems) : 50;
  const depth = computeDepth(squad, ratingById);
  const overall = attack * 0.35 + defense * 0.35 + goalkeeper * 0.3;

  return {
    clubId,
    overall: Math.round(clamp(overall, 0, 100)),
    attack: Math.round(clamp(attack, 0, 100)),
    defense: Math.round(clamp(defense, 0, 100)),
    goalkeeper: Math.round(clamp(goalkeeper, 0, 100)),
    depth: Math.round(clamp(depth, 0, 100)),
  };
}
