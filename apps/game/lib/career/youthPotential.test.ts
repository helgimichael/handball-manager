// HM-YOUTH-INTAKE-1.1A: potential is drawn independently of current ability.
//
// THE DEFECT THESE PIN. The previous model computed PA = min(165, ca + headroom)
// with headroom <= 45 and only a 3% band reaching that far. Measured over 3377
// generated players across 40 intake seasons, that produced world-wide rates of
// PA>=130 at 0.3/season, PA>=140 at 0.03/season (one player in the whole sample)
// and PA>=150 at EXACTLY ZERO. It also made the most interesting prospect in the
// sport inexpressible: with CA 75, PA could not exceed 120.
//
// These tests prove the COUPLING is gone -- not that any particular seed yields
// any particular number.
import { test } from "node:test";
import assert from "node:assert/strict";
import { progressYouthIntake, YOUTH_INTAKE_DATE_MMDD } from "./youthIntake";
import { createNewCareerState } from "./newCareer";
import { SWEDISH_WORLD_COMPETITION_IDS } from "./worldCompetitions";
import { getClub, getClubsByCompetition, type PlayerMock } from "../game-data";
import { PA_MAX } from "../rating/types";
import type { CareerState } from "./types";

const HUMAN_CLUB = "se_club_hammarby_if_hf";

/** Minimal synthetic world: real club ids, empty squads -- all intake eligibility reads. */
function syntheticWorld(seed: string): CareerState {
  const base = createNewCareerState(seed, HUMAN_CLUB);
  const worldSquads: Record<string, PlayerMock[]> = { ...base.worldSquads };
  for (const competitionId of SWEDISH_WORLD_COMPETITION_IDS) {
    for (const club of getClubsByCompetition(competitionId)) worldSquads[club.id] = worldSquads[club.id] ?? [];
  }
  return { ...base, worldSquads } as CareerState;
}

interface Row { ca: number; pa: number; tier: string }

/** Runs `years` intake passes and returns every generated player's CA/PA. */
function sample(seed: string, years: number): Row[] {
  let state = syntheticWorld(seed);
  const rows: Row[] = [];
  for (let year = 2027; year < 2027 + years; year++) {
    const { state: next, generated } = progressYouthIntake(state, `${year}-${YOUTH_INTAKE_DATE_MMDD}`);
    for (const [clubId, ids] of Object.entries(generated)) {
      const competitionId = getClub(clubId)?.competitionId ?? "";
      const ratings = new Map((next.gameplayRatings[clubId] ?? []).map((r) => [r.playerId, r]));
      for (const id of ids) {
        const r = ratings.get(id);
        if (r) rows.push({ ca: r.ca, pa: r.pa, tier: competitionId });
      }
    }
    state = next;
  }
  return rows;
}

let cached: Row[] | undefined;
function corpus(): Row[] {
  if (!cached) cached = sample("pa-corpus", 12); // ~1000 players, enough for the tail
  return cached;
}

// ---------------------------------------------------------------------------
// Invariants
// ---------------------------------------------------------------------------

test("PA is never below CA and never above the global maximum", () => {
  for (const r of corpus()) {
    assert.ok(r.pa >= r.ca, `PA ${r.pa} must be >= CA ${r.ca}`);
    assert.ok(r.pa <= PA_MAX, `PA ${r.pa} must be <= ${PA_MAX}`);
  }
});

// ---------------------------------------------------------------------------
// Expressibility -- the profiles the old model could not produce
// ---------------------------------------------------------------------------

test("a low-CA, very-high-PA prospect is now expressible", () => {
  // The old model's hard bound was PA <= CA + 45, so this could not exist.
  const found = corpus().filter((r) => r.ca < 85 && r.pa >= 145);
  assert.ok(found.length > 0, "expected raw elite talents (low current ability, very high ceiling)");
  const best = found.reduce((a, b) => (b.pa - b.ca > a.pa - a.ca ? b : a));
  assert.ok(best.pa - best.ca > 45, `headroom must be able to exceed the old 45 cap, got ${best.pa - best.ca}`);
});

test("a medium-CA, high-PA prospect is expressible", () => {
  assert.ok(corpus().some((r) => r.ca >= 85 && r.ca <= 100 && r.pa >= 135), "expected medium-CA / high-PA prospects");
});

test("a high-CA, moderate-PA prospect is expressible", () => {
  // The mature youth: useful now, limited ceiling. Under the old model a high
  // CA mechanically implied a high PA floor.
  assert.ok(corpus().some((r) => r.ca >= 80 && r.pa - r.ca <= 20), "expected mature youth with modest remaining upside");
});

test("the old maximum-headroom coupling is gone", () => {
  const overOldCap = corpus().filter((r) => r.pa - r.ca > 45).length;
  assert.ok(overOldCap > 0, "no player exceeded the old 45-point headroom cap -- the coupling would still be in force");
  // And it is not a rare accident: a substantial share should clear it.
  assert.ok(overOldCap / corpus().length > 0.1, `expected the old cap to be routinely exceeded, got ${((100 * overOldCap) / corpus().length).toFixed(1)}%`);
});

test("PA is not a deterministic function of CA", () => {
  // Group by CA and confirm the same CA yields different PA values.
  const byCa = new Map<number, Set<number>>();
  for (const r of corpus()) {
    if (!byCa.has(r.ca)) byCa.set(r.ca, new Set());
    byCa.get(r.ca)!.add(r.pa);
  }
  const spread = [...byCa.entries()].filter(([, pas]) => pas.size > 1);
  assert.ok(spread.length > 10, "players sharing a CA must not share a PA");
  const widest = spread.reduce((a, b) => (b[1].size > a[1].size ? b : a));
  assert.ok(Math.max(...widest[1]) - Math.min(...widest[1]) > 45, "the PA range for a single CA must exceed the old cap");
});

// ---------------------------------------------------------------------------
// The tail exists, and is rare
// ---------------------------------------------------------------------------

test("the elite tail exists but stays rare", () => {
  const rows = corpus();
  const rate = (t: number) => rows.filter((r) => r.pa >= t).length / rows.length;
  assert.ok(rate(150) > 0.02, `PA>=150 must actually occur, got ${(100 * rate(150)).toFixed(2)}%`);
  assert.ok(rate(150) < 0.15, `PA>=150 must stay rare, got ${(100 * rate(150)).toFixed(2)}%`);
  assert.ok(rate(160) > 0, "PA>=160 must be possible");
  assert.ok(rate(160) < 0.05, `PA>=160 must be very rare, got ${(100 * rate(160)).toFixed(2)}%`);
});

test("competition tier is not a potential ceiling", () => {
  const rows = corpus();
  const d1 = rows.filter((r) => r.tier.startsWith("se_division1"));
  assert.ok(d1.length > 0, "sanity: Division 1 receives intake");
  assert.ok(d1.some((r) => r.pa >= 150), "a Division 1 club must be able to produce an exceptional talent");
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

test("the same seed produces identical potentials", () => {
  const a = sample("determinism-pa", 3);
  const b = sample("determinism-pa", 3);
  assert.deepEqual(b.map((r) => r.pa), a.map((r) => r.pa), "identical seeds must reproduce identical potentials");
});

test("different seeds produce different potentials without changing the shape", () => {
  const a = sample("seed-alpha-pa", 6);
  const b = sample("seed-beta-pa", 6);
  assert.notDeepEqual(b.map((r) => r.pa), a.map((r) => r.pa), "different worlds must differ");
  const mean = (xs: number[]) => xs.reduce((x, y) => x + y, 0) / xs.length;
  assert.ok(Math.abs(mean(a.map((r) => r.pa)) - mean(b.map((r) => r.pa))) < 8, "but the distribution shape must be stable across seeds");
});

test("re-running the same intake period cannot reroll a potential", () => {
  // Reload-scumming guard: the intake is idempotent per club-year, and the draw
  // keys only on playerId, so re-processing changes nothing.
  const state = syntheticWorld("no-reroll");
  const first = progressYouthIntake(state, `2027-${YOUTH_INTAKE_DATE_MMDD}`);
  const second = progressYouthIntake(first.state, `2027-${YOUTH_INTAKE_DATE_MMDD}`);
  assert.deepEqual(second.generated, {}, "a second pass generates nobody");

  const paOf = (s: CareerState) =>
    Object.entries(first.generated).flatMap(([clubId, ids]) =>
      ids.map((id) => (s.gameplayRatings[clubId] ?? []).find((r) => r.playerId === id)?.pa),
    );
  assert.deepEqual(paOf(second.state), paOf(first.state), "existing potentials must be untouched by reprocessing");
});

// ---------------------------------------------------------------------------
// Statistical independence is an intentional architectural decision for 1.1a,
// not a missing feature. See youthIntake.ts's PA block: coupling PA back to CA
// (or to a tier-relative CA percentile) before a maturity / development-stage
// model exists would both recreate the dependency this phase removes and, since
// CA is tier-scaled, make competition tier a soft ceiling on potential. Any
// future correlation must EMERGE from maturity, profile, academy context or
// development stage -- never from a direct CA -> PA rule.
// ---------------------------------------------------------------------------

test("PA is statistically independent of CA -- deliberately, for this phase", () => {
  const rows = corpus();
  const n = rows.length;
  const sx = rows.reduce((a, r) => a + r.ca, 0);
  const sy = rows.reduce((a, r) => a + r.pa, 0);
  const sxy = rows.reduce((a, r) => a + r.ca * r.pa, 0);
  const sxx = rows.reduce((a, r) => a + r.ca * r.ca, 0);
  const syy = rows.reduce((a, r) => a + r.pa * r.pa, 0);
  const pearson = (n * sxy - sx * sy) / Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));

  assert.ok(
    Math.abs(pearson) < 0.2,
    `1.1a requires potential to be drawn independently of current ability; correlation was ${pearson.toFixed(3)}`,
  );
});
