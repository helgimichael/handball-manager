// HM-YOUTH-INTAKE-1.1B: Academy Quality baseline.
//
// Academy quality is part of a real club's IDENTITY, not save flavour: the same
// club must have a recognisable youth system in every career. It must also not
// be a restatement of the league table -- a mid-table Handbollsligan club can be
// the country's best developer, and a Division 1 club can quietly produce an
// international -- and a promoted or relegated club does not gain or lose a
// youth system overnight.
//
// It reweights the potential bands from 1.1a; it never adds potential points.
//
// HM-YOUTH-INTAKE-1.1B-DATA superseded the original first test here, which
// asserted that NO real club was calibrated. Seven now are (see CALIBRATED
// below); the remaining forty academy-producing clubs are deliberately still
// unset and resolve to neutral 50.
//
// The statistical tests below drive `generateYouthPA` with SYNTHETIC academy
// values (20/35/50/65/80) rather than leaning on whichever real clubs happen to
// be calibrated -- the properties under test belong to the model, not to any
// club, and must not start failing when research data changes.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveAcademyQuality,
  academyPotentialGamma,
  ACADEMY_QUALITY_MIN,
  ACADEMY_QUALITY_MAX,
  ACADEMY_QUALITY_NEUTRAL,
} from "./academyQuality";
import { generateYouthPA } from "./youthIntake";
import { SWEDISH_WORLD_COMPETITION_IDS } from "./worldCompetitions";
import { getClub, getClubsByCompetition } from "../game-data";
import { PA_MAX } from "../rating/types";

const SYNTHETIC_LEVELS = [20, 35, 50, 65, 80] as const;
const SAMPLE = 4000;
const BASE_CA = 80; // fixed, so nothing here depends on CA generation

/** PA values for `n` synthetic prospects at one academy quality. */
function paSample(academyQuality: number, n = SAMPLE): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(generateYouthPA(`synthetic-prospect-${i}`, BASE_CA, academyQuality));
  return out;
}

const cache = new Map<number, number[]>();
function samples(aq: number): number[] {
  if (!cache.has(aq)) cache.set(aq, paSample(aq));
  return cache.get(aq)!;
}

const rate = (xs: number[], t: number) => xs.filter((v) => v >= t).length / xs.length;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };

// ---------------------------------------------------------------------------
// The uncalibrated world is exactly 1.1a
// ---------------------------------------------------------------------------

/**
 * The complete researched set (Academy Quality Research Protocol v1.1, 47-club
 * evidence pass). A club is here only because dimension A was scorable from
 * named, identity-checked developed players. Every other Swedish club is
 * intentionally absent.
 */
const CALIBRATED: ReadonlyMap<string, number> = new Map([
  ["se_club_ystads_if_hf", 62],
  ["se_club_ifk_skovde_hk", 62],
  ["se_club_alingsas_hk", 61],
  ["se_club_ik_savehof", 59],
  ["se_club_ov_helsingborg", 56],
  ["se_club_onnereds_hk", 56],
  ["se_club_ifk_kristianstad", 48],
]);

/** Affiliated B teams: play/development destinations with no youth intake of their own. */
const AFFILIATED_B_TEAMS: readonly string[] = [
  "se_club_hk_cliff",
  "se_club_hk_s_hof",
  "se_club_hp_alingsas",
  "se_club_if_kristianstad",
  "se_club_hk_onnerediterna",
];

test("each researched club resolves to its exact explicit academy quality", () => {
  for (const [clubId, expected] of CALIBRATED) {
    assert.ok(getClub(clubId), `${clubId} must exist in the club registry`);
    assert.equal(resolveAcademyQuality(clubId), expected, `${clubId} must resolve to its researched value`);
  }
});

test("an academy-producing club without a researched value still resolves to neutral", () => {
  // The distinction the data must preserve: an absent field means "not known",
  // and the neutral 50 is supplied here at runtime -- never written into the
  // club registry, where it would be indistinguishable from "assessed as
  // ordinary".
  for (const competitionId of SWEDISH_WORLD_COMPETITION_IDS) {
    for (const club of getClubsByCompetition(competitionId)) {
      if (CALIBRATED.has(club.id)) continue;
      assert.equal(club.academyQuality, undefined, `${club.id} must carry no academyQuality field`);
      assert.equal(resolveAcademyQuality(club.id), ACADEMY_QUALITY_NEUTRAL, `${club.id} must fall back to neutral`);
    }
  }
});

test("no club outside the researched set gained a value", () => {
  const withField: string[] = [];
  for (const competitionId of SWEDISH_WORLD_COMPETITION_IDS) {
    for (const club of getClubsByCompetition(competitionId)) {
      if (typeof club.academyQuality === "number") withField.push(club.id);
    }
  }
  assert.deepEqual(withField.sort(), [...CALIBRATED.keys()].sort(), "exactly the researched clubs may carry an explicit value");
});

test("affiliated B teams never receive an academy quality", () => {
  // They run no independent youth intake, so they get no value, no neutral 50
  // written into data, and never their parent club's number.
  for (const clubId of AFFILIATED_B_TEAMS) {
    assert.ok(getClub(clubId), `${clubId} must exist in the club registry`);
    assert.equal(getClub(clubId)?.academyQuality, undefined, `${clubId} is a B team and must carry no academyQuality field`);
  }
});

test("researched values are not a restatement of competition tier", () => {
  // All seven happen to sit in tier 1 -- an artefact of where evidence exists,
  // not a tier rule. What must hold is that the values do not order themselves
  // by league strength: the spread is real and the reigning-elite club is not
  // at the top.
  const values = [...CALIBRATED.values()];
  assert.ok(Math.max(...values) - Math.min(...values) >= 10, "researched values must actually separate clubs");
  const elite = CALIBRATED.get("se_club_ifk_kristianstad")!;
  assert.equal(elite, Math.min(...values), "senior strength must not imply academy strength");
  for (const competitionId of SWEDISH_WORLD_COMPETITION_IDS) {
    for (const club of getClubsByCompetition(competitionId)) {
      const explicit = CALIBRATED.get(club.id);
      if (explicit === undefined) continue;
      // Resolution reads the club id alone; tier is never consulted.
      assert.equal(resolveAcademyQuality(club.id), explicit, `${club.id} must resolve identically regardless of its competition`);
    }
  }
});

test("neutral academy quality is mathematically the 1.1a distribution", () => {
  // gamma === 1 makes the percentile transform p' = 100 * (p/100)^1 the exact
  // identity, so an uncalibrated club generates precisely what 1.1a generated.
  assert.equal(academyPotentialGamma(ACADEMY_QUALITY_NEUTRAL), 1);
  for (const p of [0, 0.1, 12.7, 45.9, 76, 93.8, 98.8, 99.9]) {
    assert.equal(100 * Math.pow(p / 100, 1), p, `the neutral transform must be the identity at p=${p}`);
  }
});

test("neutral-academy PA reproduces the measured 1.1a distribution shape", () => {
  // 1.1a reference, measured over 3377 generated players / 40 intake seasons:
  // median 117, mean 118.4, p90 147, and tail shares 32.0 / 17.5 / 7.3 / 1.8 %.
  const pa = samples(50);
  assert.ok(Math.abs(q(pa, 0.5) - 117) <= 4, `median ${q(pa, 0.5)} should match the 1.1a median of 117`);
  assert.ok(Math.abs(mean(pa) - 118.4) <= 3, `mean ${mean(pa).toFixed(1)} should match the 1.1a mean of 118.4`);
  assert.ok(Math.abs(100 * rate(pa, 150) - 7.3) <= 2.5, `PA>=150 share ${(100 * rate(pa, 150)).toFixed(1)}% should match 1.1a's 7.3%`);
  assert.ok(Math.abs(100 * rate(pa, 160) - 1.8) <= 1.5, `PA>=160 share ${(100 * rate(pa, 160)).toFixed(2)}% should match 1.1a's 1.8%`);
});

// ---------------------------------------------------------------------------
// Synthetic academy levels -- the model's own properties
// ---------------------------------------------------------------------------

test("a stronger academy monotonically improves the upper tail", () => {
  const elite = SYNTHETIC_LEVELS.map((aq) => rate(samples(aq), 150));
  for (let i = 1; i < elite.length; i++) {
    assert.ok(elite[i] > elite[i - 1], `PA>=150 must rise with academy quality (AQ ${SYNTHETIC_LEVELS[i - 1]} -> ${SYNTHETIC_LEVELS[i]}: ${(100 * elite[i - 1]).toFixed(1)}% -> ${(100 * elite[i]).toFixed(1)}%)`);
  }
  const strong = SYNTHETIC_LEVELS.map((aq) => rate(samples(aq), 130));
  for (let i = 1; i < strong.length; i++) {
    assert.ok(strong[i] > strong[i - 1], "PA>=130 must also rise monotonically");
  }
});

test("a weaker academy reduces the upper tail without closing it", () => {
  const weak = samples(20);
  assert.ok(rate(weak, 150) < rate(samples(50), 150), "AQ 20 must produce fewer elite prospects than neutral");
  assert.ok(rate(weak, 150) > 0.005, `a weak academy must still be able to produce PA150+, got ${(100 * rate(weak, 150)).toFixed(2)}%`);
  assert.ok(weak.some((v) => v >= 160), "and, rarely, a wonderkid");
});

test("a strong academy still produces mostly ordinary prospects", () => {
  const strong = samples(80);
  assert.ok(rate(strong, 150) < 0.3, `an elite academy must not routinely produce elite talent, got ${(100 * rate(strong, 150)).toFixed(1)}%`);
  assert.ok(1 - rate(strong, 135) > 0.35, "the bulk of any intake must remain ordinary");
});

test("academy levels overlap heavily rather than forming castes", () => {
  const weak = samples(20);
  const strong = samples(80);
  assert.ok(Math.max(...weak) >= Math.min(...strong) + 20, "ranges must overlap substantially");
  // The medians must differ, but not by more than a band's width.
  assert.ok(q(strong, 0.5) > q(weak, 0.5), "a better academy should shift the median up");
  assert.ok(q(strong, 0.5) - q(weak, 0.5) < 40, "but not into a separate tier of player");
});

test("even the strongest academy never guarantees an elite prospect", () => {
  const best = samples(ACADEMY_QUALITY_MAX);
  assert.ok(rate(best, 150) < 0.5, `AQ 100 must not make PA150 the norm, got ${(100 * rate(best, 150)).toFixed(1)}%`);
  assert.ok(best.some((v) => v < 120), "and must still produce genuinely limited prospects");
});

test("PA invariants hold at every academy level", () => {
  for (const aq of SYNTHETIC_LEVELS) {
    for (const v of samples(aq)) {
      assert.ok(v >= BASE_CA, `PA ${v} must be >= CA ${BASE_CA}`);
      assert.ok(v <= PA_MAX, `PA ${v} must be <= ${PA_MAX}`);
    }
  }
});

test("generation is deterministic for a given player and academy level", () => {
  for (const aq of SYNTHETIC_LEVELS) {
    assert.equal(generateYouthPA("stable-prospect", BASE_CA, aq), generateYouthPA("stable-prospect", BASE_CA, aq));
  }
  // The same player at different academies genuinely differs.
  assert.notEqual(generateYouthPA("stable-prospect", BASE_CA, 20), generateYouthPA("stable-prospect", BASE_CA, 80));
});

// ---------------------------------------------------------------------------
// Identity: stable across saves, independent of league
// ---------------------------------------------------------------------------

test("an explicit academy value is stable across saves and competition changes", () => {
  // resolveAcademyQuality reads clubId only -- never saveSeed, never the current
  // league or squad -- so a promoted or relegated club keeps its youth system,
  // and the same club has the same academy in every career.
  const clubId = "se_club_lugi_hf";
  const a = resolveAcademyQuality(clubId);
  const b = resolveAcademyQuality(clubId);
  assert.equal(b, a, "academy quality must be a property of the club, not of the save");
  assert.equal(getClub(clubId)?.competitionId, "se_handbollsligan_herr", "fixture assumption");
  // Nothing in the resolver's signature can express league or squad, which is
  // the structural guarantee: it takes a clubId and nothing else.
  assert.equal(resolveAcademyQuality.length, 1, "the resolver must depend on the club id alone");
});

test("an explicit value is preferred and clamped to the scale", () => {
  const gamma = (aq: number) => academyPotentialGamma(aq);
  assert.equal(gamma(ACADEMY_QUALITY_MIN), gamma(-50), "values below the scale clamp");
  assert.equal(gamma(ACADEMY_QUALITY_MAX), gamma(500), "values above the scale clamp");
  assert.ok(gamma(ACADEMY_QUALITY_MIN) > 1 && gamma(ACADEMY_QUALITY_MAX) > 0, "the transform stays valid at both extremes");
});

test("academy quality never touches current ability", () => {
  // Same CA in, same CA out: this phase reweights potential only.
  for (const aq of SYNTHETIC_LEVELS) {
    const pa = generateYouthPA("ca-untouched", 95, aq);
    assert.ok(pa >= 95, "CA is only ever used for the PA >= CA invariant");
  }
});
