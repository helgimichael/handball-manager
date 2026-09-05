// HM-YOUTH-INTAKE-1.1C: cohort-year variance.
//
// The two tests that must never be deleted are "long-run PA output is
// preserved" and "CA is untouched": the first guards the economics of the whole
// world (an AQ-space model inflated elite output by up to 19.8%), the second
// guards the boundary this milestone promised not to cross.
//
// Statistical tests drive generateYouthPA directly with SYNTHETIC academy
// values so they test the model rather than whichever real clubs happen to be
// calibrated.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveAcademyCohortYear,
  academyCohortExponentOffset,
  ACADEMY_COHORT_STATES,
  ACADEMY_COHORT_PROBABILITIES,
  ACADEMY_COHORT_EXPONENT_OFFSETS,
  COHORT_MEAN_PRESERVATION_NORMALISER,
  type AcademyCohortState,
} from "./academyCohortYear";
import { generateYouthPA, progressYouthIntake, eligibleYouthIntakeClubIds, YOUTH_INTAKE_DATE_MMDD, MIN_COHORT_ADJUSTED_EXPONENT } from "./youthIntake";
import { resolveAcademyQuality, academyPotentialGamma } from "./academyQuality";
import { isPermanentBTeamClub, PERMANENT_B_TEAM_PAIRS } from "./clubPartnerships";
import { SWEDISH_WORLD_COMPETITION_IDS } from "./worldCompetitions";
import { createNewCareerState } from "./newCareer";
import { getClubsByCompetition, type PlayerMock } from "../game-data";
import { PA_MAX } from "../rating/types";
import type { CareerState } from "./types";

const SYNTHETIC_AQ = [20, 35, 50, 65, 80] as const;
const BASE_CA = 80;
const SAMPLE = 4000;

function paSample(aq: number, offset: number, n = SAMPLE, tag = "s"): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(generateYouthPA(`${tag}-cohort-${i}`, BASE_CA, aq, offset));
  return out;
}
const rate = (xs: number[], t: number) => xs.filter((v) => v >= t).length / xs.length;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function syntheticWorld(seed: string): CareerState {
  const base = createNewCareerState(seed, "se_club_hammarby_if_hf");
  const worldSquads: Record<string, PlayerMock[]> = { ...base.worldSquads };
  for (const c of SWEDISH_WORLD_COMPETITION_IDS) for (const club of getClubsByCompetition(c)) worldSquads[club.id] = worldSquads[club.id] ?? [];
  return { ...base, worldSquads } as CareerState;
}

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

test("the same save, club and year always resolve to the same cohort state", () => {
  for (const clubId of ["se_club_lugi_hf", "se_club_ik_savehof", "se_club_taby_hbk"]) {
    for (const year of [2027, 2031, 2044]) {
      const a = resolveAcademyCohortYear("seed-a", clubId, year);
      assert.equal(resolveAcademyCohortYear("seed-a", clubId, year), a, `${clubId} ${year} must be stable`);
    }
  }
});

test("a reload cannot reroll a cohort: re-processing an intake year changes nothing", () => {
  const state = syntheticWorld("no-reroll-cohort");
  const first = progressYouthIntake(state, `2027-${YOUTH_INTAKE_DATE_MMDD}`);
  const second = progressYouthIntake(first.state, `2027-${YOUTH_INTAKE_DATE_MMDD}`);
  assert.deepEqual(second.generated, {}, "a second pass must generate nobody");
  const paOf = (s: CareerState) =>
    Object.entries(first.generated).flatMap(([clubId, ids]) =>
      ids.map((id) => (s.gameplayRatings[clubId] ?? []).find((r) => r.playerId === id)?.pa),
    );
  assert.deepEqual(paOf(second.state), paOf(first.state), "existing potentials must survive reprocessing untouched");
});

test("different years, clubs and saves vary independently", () => {
  const years = Array.from({ length: 60 }, (_, i) => resolveAcademyCohortYear("s1", "se_club_lugi_hf", 2027 + i));
  assert.ok(new Set(years).size > 1, "one club must not sit in a single state forever");

  const clubs = eligibleYouthIntakeClubIds(syntheticWorld("s1")).map((id) => resolveAcademyCohortYear("s1", id, 2030));
  assert.ok(new Set(clubs).size > 1, "clubs in the same year must not all share one state");

  const a = Array.from({ length: 40 }, (_, i) => resolveAcademyCohortYear("save-a", "se_club_lugi_hf", 2027 + i));
  const b = Array.from({ length: 40 }, (_, i) => resolveAcademyCohortYear("save-b", "se_club_lugi_hf", 2027 + i));
  assert.notDeepEqual(b, a, "different careers must be able to produce different cohort histories");
});

test("every state is reachable and frequencies match the table", () => {
  const counts = new Map<AcademyCohortState, number>(ACADEMY_COHORT_STATES.map((s) => [s, 0]));
  const clubs = eligibleYouthIntakeClubIds(syntheticWorld("freq"));
  let n = 0;
  for (const clubId of clubs) {
    for (let y = 2027; y < 2027 + 200; y++) { counts.set(resolveAcademyCohortYear("freq", clubId, y), counts.get(resolveAcademyCohortYear("freq", clubId, y))! + 1); n++; }
  }
  for (const s of ACADEMY_COHORT_STATES) {
    const observed = counts.get(s)! / n;
    assert.ok(counts.get(s)! > 0, `${s} must be reachable`);
    assert.ok(Math.abs(observed - ACADEMY_COHORT_PROBABILITIES[s]) < 0.02, `${s}: observed ${(100 * observed).toFixed(2)}% vs table ${(100 * ACADEMY_COHORT_PROBABILITIES[s]).toFixed(0)}%`);
  }
});

// ---------------------------------------------------------------------------
// The baseline is untouched
// ---------------------------------------------------------------------------

test("Academy Quality itself never changes, whatever the cohort year", () => {
  const clubId = "se_club_ik_savehof";
  const before = resolveAcademyQuality(clubId);
  for (let y = 2027; y < 2077; y++) resolveAcademyCohortYear("aq-stable", clubId, y);
  assert.equal(resolveAcademyQuality(clubId), before, "cohort variance must never write back to the club baseline");
  assert.equal(resolveAcademyQuality.length, 1, "the AQ resolver must still depend on clubId alone");
});

test("a zero offset reproduces the 1.1b draw exactly", () => {
  for (const aq of SYNTHETIC_AQ) {
    for (let i = 0; i < 200; i++) {
      const id = `parity-${aq}-${i}`;
      assert.equal(generateYouthPA(id, BASE_CA, aq, 0), generateYouthPA(id, BASE_CA, aq), `${id} must be unchanged when no cohort offset is applied`);
    }
  }
});

// ---------------------------------------------------------------------------
// Long-run preservation -- the regression guard
// ---------------------------------------------------------------------------

/**
 * Long-run tail rate under cohort variance, as a PAIRED estimator: every state
 * is evaluated over the SAME set of player seeds as the baseline, then weighted
 * by the state's probability. Because each state re-transforms the identical
 * `raw` draws, the sampling noise is shared and cancels -- an unpaired estimator
 * (a separate sub-sample per state) is dominated by noise in the rare states,
 * where EXCEPTIONAL would contribute only 3% of the draws.
 */
function longRunRate(aq: number, threshold: number, n: number, tag: string): number {
  let acc = 0;
  for (const s of ACADEMY_COHORT_STATES) {
    acc += ACADEMY_COHORT_PROBABILITIES[s] * rate(paSample(aq, ACADEMY_COHORT_EXPONENT_OFFSETS[s], n, tag), threshold);
  }
  return acc;
}

test("long-run PA output is preserved across every academy quality", () => {
  // The whole point of the feature: variance in WHEN talent appears, not in how
  // much the world produces. Analytically the shipped constants hold PA>=150 at
  // exactly 1.00000x for every AQ, with a worst deviation of 0.543% across all
  // four tails; the 3% bound here leaves room for the residual sampling noise a
  // finite seed set still carries.
  // PA>=160 is ~1% of any sample, so at SAMPLE size a two-player shift across
  // the 98.8th-percentile band edge is already a ~5% swing. The far tails get a
  // larger sample rather than a looser bound, so this stays a real regression
  // guard rather than a formality.
  const PRESERVATION_SAMPLE = 20_000;
  for (const aq of SYNTHETIC_AQ) {
    const tag = `lr-${aq}`;
    const baseline = paSample(aq, 0, PRESERVATION_SAMPLE, tag);
    for (const t of [130, 140, 150, 160]) {
      const b = rate(baseline, t);
      if (b === 0) continue;
      const m = longRunRate(aq, t, PRESERVATION_SAMPLE, tag);
      assert.ok(
        Math.abs(m / b - 1) < 0.03,
        `AQ ${aq} PA>=${t}: ${(m / b).toFixed(4)}x -- long-run output must be preserved (an AQ-space model measured up to 1.198x)`,
      );
    }
  }
});

test("the exponent clamp never binds, so the preservation proof holds unclipped", () => {
  // The mean-preservation guarantee is derived for
  //   u = 1/academyPotentialGamma(AQ) + cohortOffset
  // with NO clipping. MIN_COHORT_ADJUSTED_EXPONENT exists only so a future
  // recalibration cannot drive u to zero and invert the transform -- if it ever
  // became active in a real cell, that cell would silently fall outside the
  // analytic proof. Measured minimum across the supported range is 0.4248
  // (AQ 0 + POOR) against a floor of 0.05.
  let min = Infinity;
  let minAt = "";
  for (let aq = 0; aq <= 100; aq++) {
    for (const s of ACADEMY_COHORT_STATES) {
      const u = 1 / academyPotentialGamma(aq) + ACADEMY_COHORT_EXPONENT_OFFSETS[s];
      if (u < min) { min = u; minAt = `AQ ${aq} + ${s}`; }
    }
  }
  assert.ok(
    min > MIN_COHORT_ADJUSTED_EXPONENT,
    `the clamp must stay inactive for every supported cell; lowest u was ${min.toFixed(6)} at ${minAt}, floor ${MIN_COHORT_ADJUSTED_EXPONENT}`,
  );
  // Not merely inactive -- comfortably so, so a small future retune cannot
  // quietly cross it without this test noticing.
  assert.ok(min > 4 * MIN_COHORT_ADJUSTED_EXPONENT, `expected real headroom above the floor, lowest u was ${min.toFixed(6)} at ${minAt}`);
});

test("the mean-preservation normaliser is applied to every state", () => {
  for (const s of ACADEMY_COHORT_STATES) {
    assert.ok(Number.isFinite(ACADEMY_COHORT_EXPONENT_OFFSETS[s]), `${s} offset must be finite`);
  }
  assert.ok(COHORT_MEAN_PRESERVATION_NORMALISER < 0, "the raw shape has a positive tail, so the normaliser must pull it down");
  assert.ok(ACADEMY_COHORT_EXPONENT_OFFSETS.ORDINARY < 0, "even an ordinary year carries the normaliser");
  // Strictly ordered, which is what makes the states meaningful at all.
  for (let i = 1; i < ACADEMY_COHORT_STATES.length; i++) {
    assert.ok(
      ACADEMY_COHORT_EXPONENT_OFFSETS[ACADEMY_COHORT_STATES[i]] > ACADEMY_COHORT_EXPONENT_OFFSETS[ACADEMY_COHORT_STATES[i - 1]],
      `${ACADEMY_COHORT_STATES[i]} must sit above ${ACADEMY_COHORT_STATES[i - 1]}`,
    );
  }
});

// ---------------------------------------------------------------------------
// Shape: tails, overlap, ordering
// ---------------------------------------------------------------------------

test("both extremes keep a non-zero elite tail", () => {
  const worst = paSample(20, ACADEMY_COHORT_EXPONENT_OFFSETS.POOR, SAMPLE, "worst");
  assert.ok(rate(worst, 150) > 0.005, `the worst cell in the model must still reach PA150, got ${(100 * rate(worst, 150)).toFixed(2)}%`);
  assert.ok(worst.some((v) => v >= 160), "and, rarely, a wonderkid");
  const best = paSample(80, ACADEMY_COHORT_EXPONENT_OFFSETS.EXCEPTIONAL, SAMPLE, "best");
  assert.ok(rate(best, 150) < 0.35, `even the best cell must not make PA150 routine, got ${(100 * rate(best, 150)).toFixed(1)}%`);
  assert.ok(best.some((v) => v < 120), "and must still produce limited prospects");
});

test("a stronger academy still outperforms a weaker one over the long run", () => {
  const r = SYNTHETIC_AQ.map((aq) => longRunRate(aq, 150, SAMPLE, `sep-${aq}`));
  for (let i = 1; i < r.length; i++) {
    assert.ok(r[i] > r[i - 1], `AQ ${SYNTHETIC_AQ[i]} must beat AQ ${SYNTHETIC_AQ[i - 1]} long-term (${(100 * r[i - 1]).toFixed(2)}% -> ${(100 * r[i]).toFixed(2)}%)`);
  }
});

test("a weak academy's exceptional year beats a strong academy's poor year", () => {
  const weakExceptional = rate(paSample(35, ACADEMY_COHORT_EXPONENT_OFFSETS.EXCEPTIONAL, SAMPLE, "we"), 150);
  const strongPoor = rate(paSample(65, ACADEMY_COHORT_EXPONENT_OFFSETS.POOR, SAMPLE, "sp"), 150);
  const strongWeak = rate(paSample(65, ACADEMY_COHORT_EXPONENT_OFFSETS.WEAK, SAMPLE, "sw"), 150);
  assert.ok(weakExceptional > strongPoor, `AQ35 exceptional (${(100 * weakExceptional).toFixed(2)}%) must beat AQ65 poor (${(100 * strongPoor).toFixed(2)}%)`);
  assert.ok(weakExceptional > strongWeak, `AQ35 exceptional must also beat AQ65 weak (${(100 * strongWeak).toFixed(2)}%)`);
});

test("PA invariants hold at every state and academy quality", () => {
  for (const aq of SYNTHETIC_AQ) {
    for (const s of ACADEMY_COHORT_STATES) {
      for (const v of paSample(aq, ACADEMY_COHORT_EXPONENT_OFFSETS[s], 300, `inv-${aq}-${s}`)) {
        assert.ok(v >= BASE_CA, `PA ${v} must be >= CA ${BASE_CA}`);
        assert.ok(v <= PA_MAX, `PA ${v} must be <= ${PA_MAX}`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Integration with the real intake
// ---------------------------------------------------------------------------

test("players from one club-year share the cohort signal but not their potentials", () => {
  const state = syntheticWorld("shared-signal");
  const { state: next, generated } = progressYouthIntake(state, `2029-${YOUTH_INTAKE_DATE_MMDD}`);
  const multi = Object.entries(generated).filter(([, ids]) => ids.length > 1);
  assert.ok(multi.length > 5, `expected several multi-player cohorts, got ${multi.length}`);

  // Shared: every player in a club-year was generated under one resolved state.
  for (const [clubId] of multi) {
    const offset = academyCohortExponentOffset(next.saveSeed, clubId, 2029);
    assert.equal(offset, ACADEMY_COHORT_EXPONENT_OFFSETS[resolveAcademyCohortYear(next.saveSeed, clubId, 2029)], `${clubId} offset must come from its resolved state`);
  }
  // Not uniform: at least one multi-player cohort has differing potentials.
  const varied = multi.some(([clubId, ids]) => {
    const ratings = next.gameplayRatings[clubId] ?? [];
    const pas = ids.map((id) => ratings.find((r) => r.playerId === id)?.pa);
    return new Set(pas).size > 1;
  });
  assert.ok(varied, "a shared cohort signal must not make a cohort uniform");
});

test("no affiliated B team ever receives a cohort state through intake", () => {
  let state = syntheticWorld("bteam-cohort");
  for (let year = 2027; year < 2037; year++) {
    const { state: next, generated } = progressYouthIntake(state, `${year}-${YOUTH_INTAKE_DATE_MMDD}`);
    for (const { clubBId } of PERMANENT_B_TEAM_PAIRS) {
      assert.equal(generated[clubBId], undefined, `${clubBId} must generate nobody in ${year}`);
      assert.equal(next.youthIntakeClubYears[clubBId], undefined, `${clubBId} must not record an intake year in ${year}`);
    }
    state = next;
  }
  // and eligibility itself still excludes them, so they contribute no club-years
  for (const clubId of eligibleYouthIntakeClubIds(state)) {
    assert.ok(!isPermanentBTeamClub(clubId), `${clubId} must not be eligible for intake`);
  }
});

test("intake volume and CA generation are unchanged by cohort variance", () => {
  const state = syntheticWorld("volume-ca");
  const { state: next, generated } = progressYouthIntake(state, `2028-${YOUTH_INTAKE_DATE_MMDD}`);
  const clubs = Object.keys(generated);
  assert.ok(clubs.length > 30, `expected a broad intake, got ${clubs.length}`);
  for (const clubId of clubs) {
    const n = generated[clubId].length;
    assert.ok(n >= 1 && n <= 3, `${clubId} generated ${n}, outside the unchanged 1-3 rule`);
  }
  const sizes = clubs.reduce((a, id) => a + generated[id].length, 0) / clubs.length;
  assert.ok(sizes > 1.3 && sizes < 2.0, `mean cohort ${sizes.toFixed(2)} must still sit near 1.65`);

  // CA must not respond to the cohort state at all: group clubs by state and
  // compare mean CA. 1.1c touches potential only.
  const byState = new Map<AcademyCohortState, number[]>();
  for (const clubId of clubs) {
    const s = resolveAcademyCohortYear(next.saveSeed, clubId, 2028);
    const ratings = next.gameplayRatings[clubId] ?? [];
    const cas = generated[clubId].map((id) => ratings.find((r) => r.playerId === id)?.ca).filter((c): c is number => typeof c === "number");
    byState.set(s, [...(byState.get(s) ?? []), ...cas]);
  }
  const poor = byState.get("POOR") ?? [], strong = [...(byState.get("STRONG") ?? []), ...(byState.get("VERY_STRONG") ?? [])];
  if (poor.length > 20 && strong.length > 20) {
    assert.ok(Math.abs(mean(poor) - mean(strong)) < 8, `CA must not track cohort state (POOR ${mean(poor).toFixed(1)} vs STRONG ${mean(strong).toFixed(1)})`);
  }
});
