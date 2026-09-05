// HM-YOUTH-INTAKE-1.1D-B: initial senior readiness.
//
// The tests that must never be deleted are the two independence guards --
// "CA and PA stay independent" and "PA supply is unchanged". Readiness and
// potential are separate dimensions, and this milestone moved only the first.
import { test } from "node:test";
import assert from "node:assert/strict";
import { progressYouthIntake, eligibleYouthIntakeClubIds, YOUTH_INTAKE_DATE_MMDD } from "./youthIntake";
import { isPermanentBTeamClub } from "./clubPartnerships";
import { SWEDISH_WORLD_COMPETITION_IDS } from "./worldCompetitions";
import { createNewCareerState } from "./newCareer";
import { getClubsByCompetition, getClub, type PlayerMock } from "../game-data";
import { playerAgeAtDate } from "../development/developmentIntegration";
import { CA_MAX, CA_MIN } from "../rating/types";
import type { CareerState } from "./types";

const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pearson = (a: number[], b: number[]) => {
  const ma = mean(a), mb = mean(b);
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return n / Math.sqrt(da * db);
};

interface Row { tier: string; age: number; ca: number; pa: number }
const cohortSizes: number[] = [];
let cached: Row[] | undefined;
function corpus(): Row[] {
  if (cached) return cached;
  const base = createNewCareerState("readiness-corpus", "se_club_hammarby_if_hf");
  const ws: Record<string, PlayerMock[]> = { ...base.worldSquads };
  for (const c of SWEDISH_WORLD_COMPETITION_IDS) for (const cl of getClubsByCompetition(c)) ws[cl.id] = ws[cl.id] ?? [];
  let st = { ...base, worldSquads: ws } as CareerState;
  const rows: Row[] = [];
  for (let y = 2027; y < 2067; y++) {
    const { state: next, generated } = progressYouthIntake(st, `${y}-${YOUTH_INTAKE_DATE_MMDD}`);
    for (const [clubId, ids] of Object.entries(generated)) {
      cohortSizes.push(ids.length);
      const comp = getClub(clubId)?.competitionId ?? "";
      const tier = comp === "se_handbollsligan_herr" ? "HBL" : comp === "swe-2" ? "ALLSV" : "DIV1";
      const ratings = next.gameplayRatings[clubId] ?? [];
      const squad = next.worldSquads[clubId] ?? [];
      for (const id of ids) {
        const r = ratings.find((x) => x.playerId === id);
        const p = squad.find((x) => x.id === id);
        if (!r || !p) continue;
        rows.push({ tier, age: playerAgeAtDate(p.dateOfBirth, undefined, `${y}-07-01`) ?? -1, ca: r.ca, pa: r.pa });
      }
    }
    st = next;
  }
  cached = rows;
  return rows;
}

// ---------------------------------------------------------------------------
// Age readiness
// ---------------------------------------------------------------------------

test("age carries a real but modest readiness signal", () => {
  const rows = corpus();
  const byAge = [16, 17, 18].map((a) => rows.filter((r) => r.age === a).map((r) => r.ca));
  assert.ok(byAge.every((s) => s.length > 200), "need all three age bands");
  assert.ok(mean(byAge[1]) > mean(byAge[0]), "17-year-olds must be readier than 16-year-olds");
  assert.ok(mean(byAge[2]) > mean(byAge[1]), "18-year-olds must be readier than 17-year-olds");
  const corr = pearson(rows.map((r) => r.age), rows.map((r) => r.ca));
  // Before 1.1d-B this was 0.019 -- effectively nothing. It must be real, and
  // must NOT become a deterministic ladder.
  assert.ok(corr > 0.05, `corr(age, CA) ${corr.toFixed(4)} must be a real signal`);
  assert.ok(corr < 0.35, `corr(age, CA) ${corr.toFixed(4)} must stay modest -- age is not a ranking`);
});

test("the age bands overlap heavily in both directions", () => {
  const rows = corpus();
  const a16 = rows.filter((r) => r.age === 16).map((r) => r.ca);
  const a18 = rows.filter((r) => r.age === 18).map((r) => r.ca);
  const med18 = q(a18, 0.5), med16 = q(a16, 0.5);
  const exceptional16 = a16.filter((c) => c > med18).length / a16.length;
  const ordinary18 = a18.filter((c) => c < med16).length / a18.length;
  assert.ok(exceptional16 > 0.15, `exceptional 16-year-olds must stay common (${(100 * exceptional16).toFixed(1)}% above the median 18-year-old)`);
  assert.ok(ordinary18 > 0.15, `ordinary 18-year-olds must stay common (${(100 * ordinary18).toFixed(1)}% below the median 16-year-old)`);
});

// ---------------------------------------------------------------------------
// Tier readiness and the rare tail
// ---------------------------------------------------------------------------

test("tier ordering holds in aggregate but does not determine a player", () => {
  const rows = corpus();
  const ca = (t: string) => rows.filter((r) => r.tier === t).map((r) => r.ca);
  const [hbl, allsv, div1] = [ca("HBL"), ca("ALLSV"), ca("DIV1")];
  assert.ok(mean(hbl) > mean(allsv), "Handbollsligan mean readiness must exceed Allsvenskan");
  assert.ok(mean(allsv) > mean(div1), "Allsvenskan mean readiness must exceed Division 1");
  // ...but the tiers must overlap substantially, or CA alone would name the league.
  const d1AboveAllsvMedian = div1.filter((c) => c > q(allsv, 0.5)).length / div1.length;
  const allsvAboveHblMedian = allsv.filter((c) => c > q(hbl, 0.5)).length / allsv.length;
  assert.ok(d1AboveAllsvMedian > 0.08, `Division 1 must overlap Allsvenskan (${(100 * d1AboveAllsvMedian).toFixed(1)}%)`);
  assert.ok(allsvAboveHblMedian > 0.12, `Allsvenskan must overlap Handbollsligan (${(100 * allsvAboveHblMedian).toFixed(1)}%)`);
});

test("every tier can produce a senior-ready teenager, rarer the lower you go", () => {
  const rows = corpus();
  const rate = (t: string, thr: number) => {
    const s = rows.filter((r) => r.tier === t);
    return s.filter((r) => r.ca >= thr).length / s.length;
  };
  // Before 1.1d-B both lower tiers were EXACTLY zero at CA 100.
  assert.ok(rate("ALLSV", 100) > 0, "an Allsvenskan club must be able to produce a CA 100+ teenager");
  assert.ok(rate("DIV1", 100) > 0, "a Division 1 club must be able to produce a CA 100+ teenager");
  assert.ok(rate("DIV1", 100) < rate("ALLSV", 100), "but it must be rarer in Division 1 than in Allsvenskan");
  assert.ok(rate("ALLSV", 100) < rate("HBL", 100), "and rarer in Allsvenskan than in Handbollsligan");
  // The upper tail must actually reach past the old hard maximum of 103.
  assert.ok(Math.max(...rows.filter((r) => r.tier === "HBL").map((r) => r.ca)) > 108, "the Handbollsligan tail must extend well past the old max of 103");
  assert.ok(rate("HBL", 110) > 0, "a Handbollsligan club must be able to produce a CA 110+ teenager");
  // ...without the tail becoming ordinary.
  assert.ok(rate("HBL", 110) < 0.03, `CA 110+ must stay rare even in Handbollsligan (${(100 * rate("HBL", 110)).toFixed(2)}%)`);
});

test("CA stays on the global scale and inside the tier ceilings", () => {
  const rows = corpus();
  const ceiling: Record<string, number> = { HBL: 118, ALLSV: 110, DIV1: 102 };
  const floor: Record<string, number> = { HBL: 60, ALLSV: 55, DIV1: 45 };
  for (const r of rows) {
    assert.ok(r.ca >= CA_MIN && r.ca <= CA_MAX, `CA ${r.ca} outside the global scale`);
    assert.ok(r.ca <= ceiling[r.tier], `${r.tier} CA ${r.ca} exceeded its configured ceiling`);
    assert.ok(r.ca >= floor[r.tier], `${r.tier} CA ${r.ca} below its configured floor`);
  }
});

// ---------------------------------------------------------------------------
// Independence guards -- do not delete
// ---------------------------------------------------------------------------

test("CA and PA stay independent, and all four profiles remain expressible", () => {
  const rows = corpus();
  const corr = pearson(rows.map((r) => r.ca), rows.map((r) => r.pa));
  assert.ok(Math.abs(corr) < 0.1, `corr(CA, PA) ${corr.toFixed(4)} must stay ~0 -- readiness must never imply potential`);
  const mc = q(rows.map((r) => r.ca), 0.5), mp = q(rows.map((r) => r.pa), 0.5);
  for (const hc of [false, true]) {
    for (const hp of [false, true]) {
      const n = rows.filter((r) => (r.ca >= mc) === hc && (r.pa >= mp) === hp).length;
      assert.ok(n / rows.length > 0.10, `the CA-${hc ? "high" : "low"}/PA-${hp ? "high" : "low"} profile must stay expressible (${(100 * n / rows.length).toFixed(1)}%)`);
    }
  }
  // A senior-ready teenager must be able to have either modest or high potential.
  const ready = rows.filter((r) => r.ca >= 95);
  assert.ok(ready.some((r) => r.pa - r.ca <= 10), "an early-mature prospect (little headroom) must exist");
  assert.ok(ready.some((r) => r.pa >= 145), "a ready AND high-potential prospect must exist");
});

test("PA supply is unchanged by the readiness model", () => {
  // Measured before 1.1d-B: 32.9 / 17.0 / 7.0 / 1.5 percent world-wide.
  const pa = corpus().map((r) => r.pa);
  const rate = (t: number) => (100 * pa.filter((v) => v >= t).length) / pa.length;
  for (const [t, expected] of [[130, 32.9], [140, 17.0], [150, 7.0], [160, 1.5]] as [number, number][]) {
    assert.ok(Math.abs(rate(t) - expected) < 3, `PA>=${t} is ${rate(t).toFixed(2)}%, expected ~${expected}% -- readiness must not move potential supply`);
  }
});

test("intake volume and B-team exclusion are unchanged", () => {
  const base = createNewCareerState("readiness-scope", "se_club_hammarby_if_hf");
  const ws: Record<string, PlayerMock[]> = { ...base.worldSquads };
  for (const c of SWEDISH_WORLD_COMPETITION_IDS) for (const cl of getClubsByCompetition(c)) ws[cl.id] = ws[cl.id] ?? [];
  const eligible = eligibleYouthIntakeClubIds({ ...base, worldSquads: ws } as CareerState);
  assert.equal(eligible.length, 47, "47 Swedish clubs run an independent youth intake");
  assert.equal(eligible.filter(isPermanentBTeamClub).length, 0, "no affiliated B team may be eligible");
  corpus();
  // Per COHORT, not per player: counting once per player is size-biased
  // (E[size^2]/E[size] = 1.89) and would look like inflated intake.
  assert.ok(cohortSizes.length > 1000, "need a broad cohort sample");
  assert.ok(mean(cohortSizes) > 1.55 && mean(cohortSizes) < 1.75, `mean cohort ${mean(cohortSizes).toFixed(3)} must still sit near 1.65`);
  assert.ok(cohortSizes.every((s) => s >= 1 && s <= 3), "cohort sizes stay within the unchanged 1-3 rule");
});
