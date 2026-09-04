// HM-PLAYER-DEVELOPMENT-2.0 PHASE 1B.3: Professional Career Exit.
//
// A player who cannot find a professional club for long enough stops being a
// professional. This is NOT age-driven retirement -- it is the other way a
// career ends, and the two must stay distinguishable: a 22-year-old who never
// got another contract did not "avsluta karriären" at 22.
//
// WHY THIS EXISTS (measured in Phase 1B.2, over 20 simulated seasons):
//   * 1217 players entered free agency; only 87 (7.1%) were ever signed again.
//   * 692 were still unemployed at season 20, 361 of them for 6+ seasons.
//   * 276 of those were UNDER 28 -- and RETIREMENT_MIN_EVAL_AGE is 28, so they
//     were never evaluated for any exit at all. A failed 20-year-old prospect
//     was structurally immortal in the active population for eight years.
//   * Clubs were not rejecting them on cost (a free agent's transfer fee is
//     already 0); every competition had simply saturated its squad-size logic.
// So the defect was never "too many players are created" -- it was that the
// world had no way to let go of the ones nobody wanted.
//
// DELIBERATELY NOT a hard "unemployed >= N years => remove" rule. That would
// produce a world where free agency is a fixed-length queue and nothing else.
// The model below is smooth and seeded, so some players leave quickly, some
// persist for years, and a genuinely good unattached player stays a credible
// comeback candidate for a long time.
import { seededOffset } from "../rating/generation/deterministicVariation";

/**
 * Expected exit probability by YEARS UNATTACHED, before quality/headroom/age
 * modifiers. Interpolated smoothly -- never a cliff at a whole number of
 * seasons.
 *
 * Shape (the design intent this milestone was given):
 *   a few months  -> essentially no risk; the transfer market has not failed yet
 *   1-2 seasons   -> still a realistic comeback, especially when young/useful
 *   3-5 seasons   -> materially likely, especially for weak or stalled players
 *   6+ seasons    -> a weak player persisting indefinitely becomes unlikely
 */
const EXIT_YEARS_ANCHORS: readonly (readonly [years: number, probability: number])[] = [
  [0.0, 0.0],
  [0.5, 0.02],
  [1.0, 0.06],
  [2.0, 0.15],
  [3.0, 0.30],
  [5.0, 0.50],
  [8.0, 0.70],
  [12.0, 0.80],
];

/** Never certain -- a comeback is always possible in principle. */
const MAX_EXIT_PROBABILITY = 0.85;

/**
 * Quality runway. A CA 120 player without a club is a genuinely different
 * situation from a CA 70 player: clubs keep looking at the first one. Broad
 * effect only -- no scouting logic, no market reputation, no hidden prestige.
 */
const CA_ANCHORS: readonly (readonly [ca: number, multiplier: number])[] = [
  [60, 1.35],
  [80, 1.15],
  [100, 1.0],
  [120, 0.7],
  [140, 0.45],
];

/**
 * Development runway. A young player with real remaining upside is worth a
 * punt for longer than one whose development has effectively stalled. Headroom
 * is PA - CA, which the rating model already owns.
 */
const HEADROOM_ANCHORS: readonly (readonly [headroom: number, multiplier: number])[] = [
  [0, 1.15],
  [10, 1.0],
  [25, 0.8],
  [45, 0.6],
];

/**
 * Age is a MODIFIER, never a gate. This system exists precisely because the
 * under-28 dead zone had no exit, so it must not reintroduce an age floor --
 * it only reflects that an older unattached player is somewhat likelier to
 * stop than a younger one with the same record.
 */
const AGE_ANCHORS: readonly (readonly [age: number, multiplier: number])[] = [
  [18, 0.85],
  [22, 0.95],
  [26, 1.0],
  [30, 1.1],
  [34, 1.25],
];

function interpolate(anchors: readonly (readonly [number, number])[], x: number): number {
  if (x <= anchors[0][0]) return anchors[0][1];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [xa, ya] = anchors[i];
    const [xb, yb] = anchors[i + 1];
    if (x >= xa && x <= xb) return ya + ((yb - ya) * (x - xa)) / (xb - xa);
  }
  return anchors[anchors.length - 1][1];
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export interface ProfessionalCareerExitInputs {
  /** How long this player has been without a club, in years. */
  yearsUnattached: number;
  age: number | null;
  ca: number;
  /** PA - CA. Remaining development upside. */
  headroom: number;
}

/**
 * Pure: the annual probability that an unattached player leaves professional
 * handball. Unit-testable without a CareerState.
 */
export function computeProfessionalCareerExitProbability(inputs: ProfessionalCareerExitInputs): number {
  if (inputs.yearsUnattached <= 0) return 0;
  const base = interpolate(EXIT_YEARS_ANCHORS, inputs.yearsUnattached);
  if (base <= 0) return 0;
  const quality = interpolate(CA_ANCHORS, inputs.ca);
  const upside = interpolate(HEADROOM_ANCHORS, Math.max(0, inputs.headroom));
  const age = inputs.age === null ? 1.0 : interpolate(AGE_ANCHORS, inputs.age);
  return clamp(base * quality * upside * age, 0, MAX_EXIT_PROBABILITY);
}

/** The exact seed key the career-exit roll uses -- its own namespace, never shared with the retirement roll. */
export function professionalCareerExitSeedKey(playerId: string, year: string): string {
  return `${playerId}:${year}:professional-career-exit`;
}

function seededIndex(seedKey: string, n: number): number {
  return Math.abs(seededOffset(seedKey, n)) % n;
}

/** [0, 1), deterministic from playerId + year. No Math.random, no wall clock. */
export function professionalCareerExitRoll(playerId: string, year: string): number {
  return seededIndex(professionalCareerExitSeedKey(playerId, year), 100_000) / 100_000;
}

/** Exposed for tests and calibration reporting -- never read by production logic. */
export const PROFESSIONAL_CAREER_EXIT_CONSTANTS = {
  EXIT_YEARS_ANCHORS,
  CA_ANCHORS,
  HEADROOM_ANCHORS,
  AGE_ANCHORS,
  MAX_EXIT_PROBABILITY,
} as const;
