// HM-PLAYER-DEVELOPMENT-2.0 PHASE 1B: the CPU club-training stimulus source.
//
// This is a THIRD stimulus source alongside training sessions and match
// exposure -- exactly the shape computePlacementAttributeStimulus already
// established. It produces per-attribute DEVELOPMENT STIMULUS UNITS and
// nothing else: age, PA headroom, fatigue and coaching quality are applied
// downstream by developmentResolution.ts, and CA is derived from attribute
// points there. No CA is written here or anywhere in this milestone.
//
// WHY A PROXY AT ALL -- what real CPU exposure data exists (measured, not
// assumed):
//   * Only Handbollsligan has fixtures. swe-2, se_division1_norra and
//     se_division1_sodra have ZERO fixtures in a career -- they are not
//     simulated, so ~832 of 1100 players play no matches even in principle.
//   * Stored FastMatchResults carry NO player contributions (0 of 156 in a
//     measured season), so even played CPU fixtures record no per-player
//     minutes, appearances or starts.
//   * playerSeasonStats is written only for the managed club's own fixtures
//     (matchResultApplication.ts: `if (!isOwnFixture) return`).
// There is therefore no trustworthy season-level playing-time signal for CPU
// players, and inventing one is out of scope for this phase. So the CLUB
// TRAINING BASELINE is the primary mechanism, not match exposure -- which is
// also what keeps unsimulated leagues and low-minutes youngsters developable.
//
// DESIGN CONSTRAINTS this formula is calibrated against:
//   * Human-club prospects were measured at +5..+10 CA/season (a 19-year-old
//     with 46 points of headroom gained +9.97). CPU prospects must occupy the
//     SAME envelope -- never systematically better.
//   * developmentResolution.ts caps effective stimulus at 2.5 per attribute
//     per resolution against a 9.0 progress threshold, so a single annual
//     pass could never produce a point and a quarterly one would have to sit
//     AT the cap for every attribute. World development runs MONTHLY, which
//     keeps each pass well under the cap and reaches the human envelope
//     without altering resolution at all.
//   * The base budget is deliberately sized so a strong prospect lands NEAR
//     but BELOW the 2.5 cap. If the cap bound routinely, every high-headroom
//     youngster would grow identically -- universal wonderkids, and flattened
//     profiles.
import { GOALKEEPER_ATTRIBUTE_FAMILIES, OUTCOURT_ATTRIBUTE_FAMILIES } from "../rating/types";
import { seededOffset } from "../rating/generation/deterministicVariation";
import type { DevelopableAttribute } from "./types";
import type { SquadStatusTier } from "../career/squadStatus";

/**
 * Per-attribute club-training units for one MONTHLY pass, for a fully
 * available contracted player. Everything else here is a modest multiplier on
 * this. Sized against the measured human envelope -- see the header.
 */
const CPU_MONTHLY_BASE_UNITS_PER_ATTRIBUTE = 0.33;

/**
 * Squad role is an OPPORTUNITY FALLBACK only, and deliberately narrow
 * (0.95-1.10). Real participation data does not exist (see header), so role is
 * the only proxy available -- but it must not become the dominant mechanism,
 * and TALENT is explicitly NOT a poor developmental state: a talent may play
 * few matches while still training fully with the squad. A KEY_PLAYER's edge
 * represents extra match-level learning, not a better training environment.
 */
const ROLE_MODIFIER: Record<SquadStatusTier, number> = {
  KEY_PLAYER: 1.1,
  FIRST_CHOICE: 1.05,
  ROTATION: 1.0,
  SQUAD_PLAYER: 0.95,
  TALENT: 1.0,
};

/**
 * Competition level is a modest ENVIRONMENT modifier (0.94-1.08), never a
 * dominant multiplier. A top-tier club is a slightly better place to develop,
 * but a Division 1 club must stay fully capable of producing a player who
 * outgrows it and moves up -- that upward flow is what makes the transfer
 * market alive, and a steep tier multiplier would make league hierarchy
 * self-reinforcing instead of emergent.
 */
const TIER_ENVIRONMENT_MODIFIER: Record<number, number> = { 1: 1.08, 2: 1.0, 3: 0.94 };
const DEFAULT_TIER_MODIFIER = 1.0;

/**
 * A free agent has no club training environment at all. They keep a small
 * maintenance baseline rather than zero -- an unattached professional still
 * trains individually, and a hard zero would make free agency a silent
 * ability cliff rather than a career setback. They remain fully eligible for
 * decline and the rest of the lifecycle either way.
 */
const FREE_AGENT_BASELINE_MODIFIER = 0.35;

/** An unavailable player trains less. Availability reduces exposure; it never zeroes development outright. */
const UNAVAILABLE_MODIFIER = 0.5;

/** +-12%, seeded -- the same deterministic-jitter convention every other stimulus source uses. Never Math.random. */
const JITTER_MAGNITUDE_PERCENT = 12;

/**
 * How far a single attribute's share may deviate from its family average,
 * driven by the player's OWN current values. This is what preserves an
 * individual profile instead of distributing points uniformly: a player who is
 * already a strong shooter keeps developing as a shooter. Bounded so a profile
 * is preserved, never amplified into a caricature.
 */
const PROFILE_WEIGHT_MIN = 0.8;
const PROFILE_WEIGHT_MAX = 1.2;

export interface CpuStimulusInputs {
  playerId: string;
  /** Development period id, e.g. "2027-M06" -- part of the seed so each pass varies but stays reproducible. */
  periodId: string;
  branch: "OUTCOURT" | "GOALKEEPER";
  /** The player's own current attribute values, for profile-preserving distribution. */
  attributes: Record<string, { value: number }>;
  tier: SquadStatusTier;
  /** Competition tier of the player's club (1 = top). Undefined for a free agent or an unknown club. */
  competitionTier: number | undefined;
  isFreeAgent: boolean;
  isAvailable: boolean;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * One monthly pass of club-training stimulus for one CPU player.
 *
 * Deliberately does NOT read age or PA headroom: developmentResolution.ts
 * applies ageDevelopmentMultiplier and headroomDevelopmentMultiplier to
 * exactly this output, and applying either twice would double-count the two
 * sensitivities the whole model depends on.
 */
export function computeCpuSeasonStimulus(inputs: CpuStimulusInputs): Partial<Record<DevelopableAttribute, number>> {
  const roleModifier = ROLE_MODIFIER[inputs.tier] ?? 1.0;
  const environmentModifier = inputs.competitionTier !== undefined
    ? TIER_ENVIRONMENT_MODIFIER[inputs.competitionTier] ?? DEFAULT_TIER_MODIFIER
    : DEFAULT_TIER_MODIFIER;
  const clubModifier = inputs.isFreeAgent ? FREE_AGENT_BASELINE_MODIFIER : 1.0;
  const availabilityModifier = inputs.isAvailable ? 1.0 : UNAVAILABLE_MODIFIER;
  const jitter = 1 + seededOffset(`${inputs.playerId}:${inputs.periodId}:world-dev:v1`, JITTER_MAGNITUDE_PERCENT) / 100;

  const perAttributeBase =
    CPU_MONTHLY_BASE_UNITS_PER_ATTRIBUTE * roleModifier * environmentModifier * clubModifier * availabilityModifier * jitter;
  if (perAttributeBase <= 0) return {};

  // A club trains the whole game over a month, so every family this
  // player's branch has is touched -- the same breadth a balanced human
  // training week covers, not a single targeted family.
  const families = inputs.branch === "GOALKEEPER"
    ? Object.values(GOALKEEPER_ATTRIBUTE_FAMILIES)
    : Object.values(OUTCOURT_ATTRIBUTE_FAMILIES);

  const result: Partial<Record<DevelopableAttribute, number>> = {};
  for (const attrs of families as readonly (readonly string[])[]) {
    if (attrs.length === 0) continue;
    let sum = 0;
    let counted = 0;
    for (const attr of attrs) {
      const v = inputs.attributes[attr]?.value;
      if (typeof v === "number") { sum += v; counted += 1; }
    }
    if (counted === 0) continue;
    const familyMean = sum / counted;
    for (const attr of attrs) {
      const value = inputs.attributes[attr]?.value;
      if (typeof value !== "number") continue; // not in this player's branch vocabulary
      const profileWeight = familyMean > 0 ? clamp(value / familyMean, PROFILE_WEIGHT_MIN, PROFILE_WEIGHT_MAX) : 1;
      result[attr as DevelopableAttribute] = perAttributeBase * profileWeight;
    }
  }
  return result;
}

/** Exposed for tests and calibration reporting -- never read by production logic. */
export const CPU_DEVELOPMENT_CONSTANTS = {
  CPU_MONTHLY_BASE_UNITS_PER_ATTRIBUTE,
  ROLE_MODIFIER,
  TIER_ENVIRONMENT_MODIFIER,
  FREE_AGENT_BASELINE_MODIFIER,
  UNAVAILABLE_MODIFIER,
  JITTER_MAGNITUDE_PERCENT,
  PROFILE_WEIGHT_MIN,
  PROFILE_WEIGHT_MAX,
} as const;
