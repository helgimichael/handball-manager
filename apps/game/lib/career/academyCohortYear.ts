// HM-YOUTH-INTAKE-1.1C: cohort-year quality -- how good ONE academy's ONE
// intake year happens to be, on top of the club's standing Academy Quality.
//
// TWO LEVELS, KEPT SEPARATE. Academy Quality (academyQuality.ts) is persistent
// club identity, resolved from clubId alone. Cohort-year quality is temporary
// and resolved from (saveSeed, clubId, intakeYear). The second NEVER writes to
// the first: there is no accumulator and no drift, so an AQ 59 club is still
// AQ 59 the morning after an EXCEPTIONAL intake, and still AQ 59 after a POOR
// one. Nothing is persisted -- the state is recomputed from inputs CareerState
// already holds, so there is no new field and no save migration.
//
// WHY u-SPACE AND NOT `AQ + delta`. The Academy Quality transform is
// `percentile' = 100 * (raw/100)^gamma`, and the chance of clearing a band edge
// e is `1 - (e/100)^u` where `u = 1/gamma`. Composing a club effect with a year
// effect is therefore plain ADDITION in u-space. Adding a zero-mean delta to AQ
// instead is NOT mean-preserving: u is convex in AQ, so Jensen pushes the mean
// exponent up and silently manufactures elite talent. The 1.1c design audit
// measured exactly that -- PA>=150 at 1.019x for +-10 AQ, 1.079x for +-20, and
// 1.198x for +-30. That model is rejected; do not reintroduce it.
//
// THE PROPERTY THAT MAKES CALIBRATION POSSIBLE. Writing the year effect as an
// offset d in u-space, the mixture CDF at band edge e for a club with exponent
// u0 is
//
//   sum_y w_y * x^(u0 + d_y)  =  x^u0 * sum_y w_y * x^(d_y)      where x = e/100
//
// so preservation requires `sum_y w_y * x^(d_y) = 1` at every band edge -- and
// that condition does not contain u0. Calibrate the table once and it preserves
// the long-run baseline for EVERY club at EVERY Academy Quality, which is why
// the regression test can assert preservation across the whole AQ range from a
// single set of constants.
//
// WHY DISCRETE STATES RATHER THAN A CONTINUOUS DRAW. Intake is 1-3 players
// (intakeSizeForClub, 45/45/10, mean 1.65). At that sample size any resolution
// finer than a handful of states is statistically invisible in the only place a
// manager ever observes it, and a named state is additionally exactly
// calibratable, trivially testable, and its own future UI label.
//
// TERMINOLOGY. The top state is EXCEPTIONAL, not GOLDEN_GENERATION: it
// describes unusually favourable academy CONDITIONS, not a guaranteed outcome.
// Each player still takes an independent PA draw, so an EXCEPTIONAL cohort of
// one or two players can and often does realise as an ordinary-looking intake.
// Whether a REALISED intake deserves to be called a golden generation is a
// question about its actual generated players, and belongs to a future UI.
import { seededOffset } from "../rating/generation/deterministicVariation";

export const ACADEMY_COHORT_STATES = ["POOR", "WEAK", "ORDINARY", "STRONG", "VERY_STRONG", "EXCEPTIONAL"] as const;
export type AcademyCohortState = (typeof ACADEMY_COHORT_STATES)[number];

/**
 * The un-normalised shape: how far each state sits from an ordinary year, in
 * u-space, BEFORE the mean-preservation correction below. ORDINARY is the
 * anchor at 0. EXCEPTIONAL's 0.811594 is `U(82) - U(50)` -- the offset that
 * makes a neutral club behave, for one intake, like a researched AQ 82 academy.
 */
const RAW_OFFSETS: Readonly<Record<AcademyCohortState, number>> = {
  POOR: -0.14,
  WEAK: -0.063,
  ORDINARY: 0,
  STRONG: 0.077,
  VERY_STRONG: 0.154,
  EXCEPTIONAL: 0.811594,
};

const PROBABILITIES: Readonly<Record<AcademyCohortState, number>> = {
  POOR: 0.10,
  WEAK: 0.22,
  ORDINARY: 0.37,
  STRONG: 0.20,
  VERY_STRONG: 0.08,
  EXCEPTIONAL: 0.03,
};

/**
 * MEAN-PRESERVATION NORMALISER, applied to every state including EXCEPTIONAL.
 *
 * The raw shape above is deliberately asymmetric -- it carries a long positive
 * tail -- so on its own it would inflate elite output. This single constant
 * shifts the whole table down until PA>=150 is preserved EXACTLY at every
 * Academy Quality. It is solved numerically, not guessed: it is the value of
 * `c` for which `sum_y w_y * 0.938^(RAW_OFFSETS[y] + c) = 1`, 0.938 being the
 * PA>=150 band edge (YOUTH_PA_BANDS' 93.8th percentile).
 *
 * One constant cannot zero all four band edges at once -- PA>=130/140 land
 * fractionally low and PA>=160 fractionally high. The audit measured the worst
 * residual across AQ 20-80 x all four tails at 0.54%, against a rejection
 * threshold of 10-20%; academyCohortYear.test.ts pins that as a regression
 * bound. Do NOT "tidy" this number: changing it moves long-run national talent
 * supply.
 */
export const COHORT_MEAN_PRESERVATION_NORMALISER = -0.023414;

/** Final u-space offset per state: shape + normaliser. This is what generation actually applies. */
export const ACADEMY_COHORT_EXPONENT_OFFSETS: Readonly<Record<AcademyCohortState, number>> = Object.freeze(
  Object.fromEntries(
    ACADEMY_COHORT_STATES.map((s) => [s, RAW_OFFSETS[s] + COHORT_MEAN_PRESERVATION_NORMALISER]),
  ) as Record<AcademyCohortState, number>,
);

export const ACADEMY_COHORT_PROBABILITIES = PROBABILITIES;

/** Cumulative upper bounds in percentile space, in ACADEMY_COHORT_STATES order. */
const CUMULATIVE: readonly { state: AcademyCohortState; upToPercentile: number }[] = (() => {
  let acc = 0;
  return ACADEMY_COHORT_STATES.map((state) => {
    acc += PROBABILITIES[state] * 100;
    return { state, upToPercentile: acc };
  });
})();

/** Percentile in [0,100) with one decimal -- the same primitive youthIntake.ts already uses for its own draws. */
function seededPercentile(seedKey: string): number {
  return (Math.abs(seededOffset(seedKey, 1000)) % 1000) / 10;
}

/**
 * The cohort state for one club's intake in one year.
 *
 * Keys on (saveSeed, clubId, intakeYear) and NOTHING else -- deliberately no
 * playerId and no index, which is precisely what makes every player generated
 * for the same club-year share one signal. Individual variation continues to
 * come from each player's own `:youth-pa-talent:v2` draw, so a cohort is
 * correlated without being uniform.
 *
 * Same save + club + year always returns the same state, so a reload cannot
 * reroll it; different years, clubs and saves vary independently. No
 * Math.random, no wall clock, no mutable state. The seed key is versioned so a
 * future recalibration is an explicit `:v2` rather than a silent
 * reinterpretation of existing careers.
 */
export function resolveAcademyCohortYear(saveSeed: string, clubId: string, intakeYear: number): AcademyCohortState {
  const roll = seededPercentile(`${saveSeed}:${clubId}:${intakeYear}:academy-cohort-year:v1`);
  return (CUMULATIVE.find((b) => roll < b.upToPercentile) ?? CUMULATIVE[CUMULATIVE.length - 1]).state;
}

/** The u-space offset generation applies for a club-year. Convenience over the two lookups. */
export function academyCohortExponentOffset(saveSeed: string, clubId: string, intakeYear: number): number {
  return ACADEMY_COHORT_EXPONENT_OFFSETS[resolveAcademyCohortYear(saveSeed, clubId, intakeYear)];
}
