// HM-YOUTH-INTAKE-1.1D-A: per-player profile identity.
//
// THE DEFECT THIS FIXES. Generated attributes were
// `baselineFromCA(ca) + positionFamilyEmphasis + oneArchetypeRoleBoost + jitter(+-1)`,
// and VARIATION_MAGNITUDE is 1. Measured over 4,668 generated players, two
// players at the same position and the same CA differed by a mean attribute SD
// of 0.87 with a mean span of 2.38 -- against 2.29-3.98 SD and 13.5-14.1 span
// for REAL players in the canonical Swedish database at comparable CA. Every
// generated M9 at a given ability was functionally the same footballer. Because
// World Development faithfully preserves an intake profile (90.5% of a player's
// top-8 attributes are still his top-8 eight seasons later), that sameness was
// permanent for a twenty-year career.
//
// WHY NOT SIMPLY RAISE VARIATION_MAGNITUDE. Larger independent jitter adds
// noise, not identity: it would blur the positional separation that currently
// works (a wing's ACCELERATION 10.35 against an M9's 6.98) without ever
// producing a coherent strength. A player is interesting because he is good at
// RELATED things and weak at others, which is a family-level property.
//
// THE MODEL. Each player deterministically lifts two attribute families and
// depresses two others, by a per-player point budget. The lift and drop sets
// are disjoint, and the position's own defining family can be lifted but never
// dropped -- so a wing may be an especially explosive wing or a technical one,
// but never a slow wing. Position emphasis, archetype role boosts and the
// existing jitter all still apply underneath; this composes with them rather
// than replacing them. No archetype label is stored: the attribute vector IS
// the identity.
//
// CA NEUTRALITY IS EXACT, NOT APPROXIMATE. The game has exactly one
// attribute-to-CA path -- developmentResolution.ts's caNudgePerAttributePoint,
// which weights every attribute in a branch EQUALLY:
//   caDelta = attributeDelta * (CA_MAX-CA_MIN)/(ATTRIBUTE_MAX-ATTRIBUTE_MIN)/attributeCount
// (lib/rating/types.ts states outright that there is no other attribute-to-CA
// computation, and estimateCA works from evidence claims, not from a generated
// vector.) So CA neutrality reduces to: the APPLIED integer deltas must sum to
// exactly zero. That is stronger than "the intended deltas sum to zero",
// because clampAttribute both ROUNDS and bounds to [1,20]: at low CA the
// baseline sits near 5 and at high CA near 13, so a drop can hit the floor or a
// lift the ceiling and silently lose points. This module therefore builds
// integer deltas, applies them, measures what actually landed, and repairs any
// clamp-induced residual against attributes that still have headroom -- so the
// sum is zero by construction rather than by assumption.
import { seededOffset } from "./deterministicVariation";
import {
  ATTRIBUTE_MAX,
  ATTRIBUTE_MIN,
  GOALKEEPER_ATTRIBUTE_FAMILIES,
  OUTCOURT_ATTRIBUTE_FAMILIES,
  type OutcourtPositionId,
} from "../types";

/** Families that must never be DROPPED for a position -- what makes the position that position. Lifting them is always allowed. */
const POSITION_PROTECTED_FAMILY: Record<OutcourtPositionId, string> = {
  M9: "PERCEPTION_DECISION",
  V9: "TECHNICAL",
  H9: "TECHNICAL",
  M6: "PHYSICAL",
  V6: "PHYSICAL",
  H6: "PHYSICAL",
};

/** Goalkeepers must stay shot-stoppers first. */
const GK_PROTECTED_FAMILY = "SHOT_STOPPING";

/**
 * Total attribute points moved in each direction. Chosen per player so some
 * prospects are sharply specialised and others rounded -- another axis of
 * variety, not just a magnitude. Budgets are deliberately modest relative to
 * the 1-20 scale: the aim is a recognisable shape, not a caricature.
 */
const OUTCOURT_BUDGETS = [26, 34, 42, 50] as const;
const GOALKEEPER_BUDGETS = [10, 14, 18] as const;

function seededIndex(seedKey: string, n: number): number {
  return Math.abs(seededOffset(seedKey, n)) % n;
}

/** Distributes `total` points across `n` slots as evenly as possible, largest remainders first. Sum is exactly `total`. */
function distribute(total: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  const out = new Array<number>(n).fill(base);
  for (let i = 0; i < total - base * n; i++) out[i] += 1;
  return out;
}

/** Deterministic k-subset of `pool`, without replacement. */
function pickFamilies(pool: readonly string[], k: number, seedKey: string): string[] {
  const remaining = [...pool];
  const chosen: string[] = [];
  for (let i = 0; i < k && remaining.length > 0; i++) {
    chosen.push(...remaining.splice(seededIndex(`${seedKey}:pick:${i}`, remaining.length), 1));
  }
  return chosen;
}

export interface TiltableBranch {
  branch: "OUTCOURT" | "GOALKEEPER";
  attributes: Record<string, { value: number; origin: string }>;
}

/**
 * Applies the player's profile tilt in place of nothing -- returns a NEW branch,
 * never mutating the input.
 *
 * `position` is the outcourt position id (ignored for goalkeepers). `seedKey`
 * must be the player's own stable generation seed, so the same player always
 * receives the same profile and a reload cannot reshape him.
 */
export function applyProfileTilt<T extends TiltableBranch>(branch: T, position: string, seedKey: string): T {
  const isGk = branch.branch === "GOALKEEPER";
  const families = isGk ? GOALKEEPER_ATTRIBUTE_FAMILIES : OUTCOURT_ATTRIBUTE_FAMILIES;
  const familyNames = Object.keys(families);
  const protectedFamily = isGk ? GK_PROTECTED_FAMILY : POSITION_PROTECTED_FAMILY[position as OutcourtPositionId];
  const budgets = isGk ? GOALKEEPER_BUDGETS : OUTCOURT_BUDGETS;

  // Goalkeepers have only four families, so they tilt one-up/one-down; outcourt
  // players have six and can carry a two-up/two-down shape.
  const setSize = isGk ? 1 : 2;

  const lift = pickFamilies(familyNames, setSize, `${seedKey}:tilt:lift`);
  const dropPool = familyNames.filter((f) => !lift.includes(f) && f !== protectedFamily);
  const drop = pickFamilies(dropPool, setSize, `${seedKey}:tilt:drop`);
  if (lift.length === 0 || drop.length === 0) return branch;

  const budget = budgets[seededIndex(`${seedKey}:tilt:budget`, budgets.length)];

  const liftAttrs = lift.flatMap((f) => (families as Record<string, readonly string[]>)[f]);
  const dropAttrs = drop.flatMap((f) => (families as Record<string, readonly string[]>)[f]);

  const intended = new Map<string, number>();
  distribute(budget, liftAttrs.length).forEach((d, i) => intended.set(liftAttrs[i], d));
  distribute(budget, dropAttrs.length).forEach((d, i) => intended.set(dropAttrs[i], -d));

  // Apply with the SAME clamp the generation engine uses, then measure what
  // actually landed -- the clamp is where a naive zero-sum silently breaks.
  const next: Record<string, { value: number; origin: string }> = {};
  let applied = 0;
  for (const [attr, cell] of Object.entries(branch.attributes)) {
    const want = intended.get(attr) ?? 0;
    const value = Math.min(ATTRIBUTE_MAX, Math.max(ATTRIBUTE_MIN, cell.value + want));
    applied += value - cell.value;
    next[attr] = { ...cell, value };
  }

  // Repair the clamp residual so the applied deltas sum to EXACTLY zero, which
  // is what makes the tilt CA-neutral under the real accounting model. Walks a
  // stable, seed-independent order so the repair is itself deterministic, and
  // only touches attributes that still have headroom in the needed direction.
  if (applied !== 0) {
    const order = Object.keys(next).sort();
    const step = applied > 0 ? -1 : 1;
    let remaining = Math.abs(applied);
    // Prefer attributes this tilt already moved the same way, so the repair
    // deepens the intended shape instead of flattening an untouched attribute.
    for (const pass of [0, 1]) {
      for (const attr of order) {
        if (remaining === 0) break;
        const moved = (intended.get(attr) ?? 0) !== 0;
        if (pass === 0 && !moved) continue;
        if (pass === 1 && moved) continue;
        const v = next[attr].value + step;
        if (v < ATTRIBUTE_MIN || v > ATTRIBUTE_MAX) continue;
        next[attr] = { ...next[attr], value: v };
        remaining -= 1;
      }
      if (remaining === 0) break;
    }
    // If every attribute is pinned at a bound the tilt cannot be balanced --
    // return the untilted branch rather than ship a CA-inconsistent player.
    if (remaining !== 0) return branch;
  }

  return { ...branch, attributes: next };
}
