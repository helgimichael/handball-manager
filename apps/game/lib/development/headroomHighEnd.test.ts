// HM-PLAYER-DEVELOPMENT-2.0 PHASE 2: the high-headroom side of
// headroomDevelopmentMultiplier.
//
// The tests that must never be deleted are "sub-30 behaviour is bit-for-bit
// unchanged" and "PA120/PA130 prospects do not become elite". The defect this
// milestone fixed was that headroom above 30 gave a longer runway but zero
// extra speed, so PA150+ prospects matured almost exclusively after 30. The
// risk in fixing it is global CA inflation, and these two tests are what
// prevent that regression from passing unnoticed.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  headroomDevelopmentMultiplier,
  ageDevelopmentMultiplier,
  applyResolvedAttributeChanges,
  caNudgePerAttributePoint,
  PROGRESS_THRESHOLD_PER_POINT,
} from "./developmentResolution";
import { computeCpuSeasonStimulus } from "./cpuDevelopment";
import { progressYouthIntake, YOUTH_INTAKE_DATE_MMDD } from "../career/youthIntake";
import { SWEDISH_WORLD_COMPETITION_IDS } from "../career/worldCompetitions";
import { createNewCareerState } from "../career/newCareer";
import { getClubsByCompetition, type PlayerMock } from "../game-data";
import { ATTRIBUTE_MAX, ATTRIBUTE_MIN, CA_MAX } from "../rating/types";
import type { DevelopableAttribute } from "./types";
import type { CareerState } from "../career/types";

const PA = 155;
const hm = (headroom: number) => headroomDevelopmentMultiplier(PA - headroom, PA);

// ---------------------------------------------------------------------------
// Curve shape
// ---------------------------------------------------------------------------

test("sub-30 headroom behaviour is bit-for-bit unchanged", () => {
  // The exact pre-change formula, reproduced here as the frozen reference.
  const previous = (ca: number, pa: number) => {
    const headroom = pa - ca;
    if (headroom <= 0) return 0.05;
    return Math.min(1, headroom / 30) * 0.95 + 0.05;
  };
  for (let headroom = -20; headroom <= 30; headroom++) {
    assert.equal(
      headroomDevelopmentMultiplier(PA - headroom, PA),
      previous(PA - headroom, PA),
      `headroom ${headroom} must be identical to the pre-change curve`,
    );
  }
  // The documented landmarks of the existing taper, unchanged.
  assert.ok(Math.abs(hm(20) - 0.683333) < 1e-5, `headroom 20 must stay ~0.683, got ${hm(20)}`);
  assert.ok(Math.abs(hm(10) - 0.366667) < 1e-5, `headroom 10 must stay ~0.367, got ${hm(10)}`);
  assert.ok(Math.abs(hm(5) - 0.208333) < 1e-5, `headroom 5 must stay ~0.208, got ${hm(5)}`);
  assert.equal(hm(0), 0.05, "at or past PA the multiplier stays the 0.05 floor -- PA remains a soft ceiling");
});

test("the curve is continuous at headroom 30", () => {
  assert.equal(hm(30), 1, "both sides must meet at exactly 1.0");
  for (const eps of [1e-6, 1e-4, 0.01, 0.1]) {
    assert.ok(Math.abs(hm(30 + eps) - hm(30)) < 0.01, `no discontinuity crossing 30 (eps ${eps})`);
    assert.ok(hm(30 + eps) >= hm(30), `must not dip crossing 30 (eps ${eps})`);
  }
});

test("the curve increases monotonically from 30 to 70", () => {
  let previous = -Infinity;
  for (let headroom = 30; headroom <= 70; headroom += 0.5) {
    const value = hm(headroom);
    assert.ok(value >= previous, `headroom ${headroom} (${value}) must not fall below ${previous}`);
    previous = value;
  }
  // ...and it must actually be a rise, not a flat line.
  assert.ok(hm(50) > hm(30) + 0.1, `headroom 50 (${hm(50)}) must be materially above 30 (${hm(30)})`);
});

test("the maximum is ~1.35 at 70 and is capped above it", () => {
  assert.ok(Math.abs(hm(70) - 1.35) < 1e-9, `headroom 70 must be 1.35, got ${hm(70)}`);
  for (const headroom of [70, 75, 90, 120, 199]) {
    assert.ok(Math.abs(hm(headroom) - 1.35) < 1e-9, `headroom ${headroom} must stay capped at 1.35, got ${hm(headroom)}`);
  }
});

test("the accepted curve's pinned points", () => {
  // Exactly the values the audit benchmarked Candidate C on.
  for (const [headroom, expected] of [[30, 1.0], [40, 1.0875], [50, 1.175], [60, 1.2625], [70, 1.35], [80, 1.35]] as const) {
    assert.ok(Math.abs(hm(headroom) - expected) < 1e-6, `headroom ${headroom} must be ${expected}, got ${hm(headroom)}`);
  }
});

test("the age curve is untouched", () => {
  for (const [age, expected] of [[16, 1.5], [21, 1.3], [24, 1.0], [28, 0.65], [31, 0.35], [35, 0.15], [40, 0.05]] as const) {
    assert.equal(ageDevelopmentMultiplier(age), expected, `age ${age} must still be ${expected}`);
  }
});

// ---------------------------------------------------------------------------
// Trajectory effect -- production functions, real generated players
// ---------------------------------------------------------------------------

interface Row { id: string; pa: number; ca0: number; rating: ReturnType<typeof ratingOf> }
function ratingOf(r: unknown) { return r as { ca: number; pa: number; branch: { branch: "OUTCOURT" | "GOALKEEPER"; attributes: Record<string, { value: number; origin: string }> } }; }

let cached: Row[] | undefined;
/** Real generated outcourt prospects, built through the production intake path. */
function cohort(): Row[] {
  if (cached) return cached;
  const base = createNewCareerState("p1-cohort", "se_club_hammarby_if_hf");
  const ws: Record<string, PlayerMock[]> = { ...base.worldSquads };
  for (const c of SWEDISH_WORLD_COMPETITION_IDS) for (const cl of getClubsByCompetition(c)) ws[cl.id] = ws[cl.id] ?? [];
  let st = { ...base, worldSquads: ws } as CareerState;
  const rows: Row[] = [];
  for (let y = 2027; y < 2033; y++) {
    const { state: next, generated } = progressYouthIntake(st, `${y}-${YOUTH_INTAKE_DATE_MMDD}`);
    for (const [clubId, ids] of Object.entries(generated)) {
      const ratings = next.gameplayRatings[clubId] ?? [];
      for (const id of ids) {
        const r = ratings.find((x) => x.playerId === id);
        if (r && r.branch.branch === "OUTCOURT") rows.push({ id, pa: r.pa, ca0: r.ca, rating: ratingOf(r) });
      }
    }
    st = next;
  }
  cached = rows;
  return rows;
}

const NUDGE = caNudgePerAttributePoint("OUTCOURT");

/** Drives one prospect 17->30 through the real CPU pipeline. `stimulusScale` models a richer (human-club) stimulus budget. */
function trajectory(row: Row, competitionTier = 1, stimulusScale = 1): Record<number, number> {
  let rating = row.rating;
  const progress: Record<string, number> = {};
  const at: Record<number, number> = {};
  for (let age = 17; age < 30; age++) {
    at[age] = rating.ca;
    for (let month = 1; month <= 12; month++) {
      const attributes = rating.branch.attributes;
      const stimulus = computeCpuSeasonStimulus({
        playerId: row.id, periodId: `${2027 + age - 17}-M${String(month).padStart(2, "0")}`,
        branch: "OUTCOURT", attributes, tier: "TALENT", competitionTier, isFreeAgent: false, isAvailable: true,
      });
      const changes: { attribute: DevelopableAttribute; newValue: number; caDelta: number }[] = [];
      for (const [attr, raw] of Object.entries(stimulus)) {
        if (!raw || raw <= 0) continue;
        const cell = attributes[attr];
        if (!cell) continue;
        const effective = Math.min(raw * stimulusScale * ageDevelopmentMultiplier(age) * headroomDevelopmentMultiplier(rating.ca, rating.pa), 2.5);
        let p = (progress[attr] ?? 0) + effective;
        let gained = 0;
        if (p >= PROGRESS_THRESHOLD_PER_POINT) { p -= PROGRESS_THRESHOLD_PER_POINT; gained = 1; p = Math.min(p, PROGRESS_THRESHOLD_PER_POINT - 0.01); }
        progress[attr] = p;
        if (gained) {
          const next = Math.min(ATTRIBUTE_MAX, Math.max(ATTRIBUTE_MIN, cell.value + 1));
          if (next !== cell.value) changes.push({ attribute: attr as DevelopableAttribute, newValue: next, caDelta: (next - cell.value) * NUDGE });
        }
      }
      if (changes.length) rating = ratingOf(applyResolvedAttributeChanges(rating as never, changes));
    }
  }
  at[30] = rating.ca;
  return at;
}

const band = (lo: number, hi: number) => cohort().filter((r) => r.pa >= lo && r.pa < hi);
const meanAt = (rows: Row[], age: number, tier = 1) => rows.reduce((s, r) => s + trajectory(r, tier)[age], 0) / rows.length;
const pctAt = (rows: Row[], age: number, threshold: number) => 100 * rows.filter((r) => trajectory(r, age === 0 ? 1 : 1)[age] >= threshold).length / rows.length;

test("PA120 and PA130 prospects stay controlled -- no global inflation", () => {
  const pa120 = band(115, 125), pa130 = band(125, 135);
  assert.ok(pa120.length > 20 && pa130.length > 20, "need usable bands");
  // Measured before: 107.4 / 114.5 at 25. The fix must move these only slightly.
  assert.ok(meanAt(pa120, 25) < 112, `PA120 mean CA at 25 (${meanAt(pa120, 25).toFixed(1)}) must stay near its 107.4 baseline`);
  assert.ok(meanAt(pa130, 25) < 120, `PA130 mean CA at 25 (${meanAt(pa130, 25).toFixed(1)}) must stay near its 114.5 baseline`);
  // The hard non-inflation gate: ordinary prospects must not become elite.
  assert.equal(pctAt(pa120, 30, 130), 0, "no PA120 prospect may reach CA130");
  assert.ok(pctAt(pa130, 30, 130) < 15, `PA130 prospects must stay mostly below CA130 (${pctAt(pa130, 30, 130).toFixed(0)}%)`);
  assert.equal(pctAt(pa130, 30, 140), 0, "no PA130 prospect may reach CA140");
});

test("PA150 and PA160 prospects mature materially earlier", () => {
  const pa150 = band(145, 155), pa160 = band(155, 170);
  assert.ok(pa150.length > 20 && pa160.length > 10, "need usable elite bands");
  // Baselines measured before the change: PA150 120.5 @25 with 21% at CA130;
  // PA160 123.4 @25 with 31%. The point of the milestone is mid-20s maturation.
  assert.ok(meanAt(pa150, 25) > 124, `PA150 mean CA at 25 (${meanAt(pa150, 25).toFixed(1)}) must clearly exceed the 120.5 baseline`);
  assert.ok(meanAt(pa160, 25) > 129, `PA160 mean CA at 25 (${meanAt(pa160, 25).toFixed(1)}) must clearly exceed the 123.4 baseline`);
  assert.ok(pctAt(pa150, 25, 130) > 30, `PA150 reaching CA130 by 25 (${pctAt(pa150, 25, 130).toFixed(0)}%) must rise well above the 21% baseline`);
  assert.ok(pctAt(pa160, 25, 130) > 50, `PA160 reaching CA130 by 25 (${pctAt(pa160, 25, 130).toFixed(0)}%) must rise well above the 31% baseline`);
  // ...but PA is still not a destination: nobody may be handed their ceiling.
  for (const r of [...pa150, ...pa160]) {
    const final = trajectory(r)[30];
    assert.ok(final < r.pa, `${r.id} must not reach his PA (${final.toFixed(1)} vs PA ${r.pa})`);
    assert.ok(final <= CA_MAX, "CA must never exceed the global maximum");
  }
});

test("tier ordering is unchanged", () => {
  const elite = band(145, 155);
  const hbl = meanAt(elite, 30, 1), allsvenskan = meanAt(elite, 30, 2), division1 = meanAt(elite, 30, 3);
  assert.ok(hbl > allsvenskan, `HBL (${hbl.toFixed(1)}) must still develop better than Allsvenskan (${allsvenskan.toFixed(1)})`);
  assert.ok(allsvenskan > division1, `Allsvenskan (${allsvenskan.toFixed(1)}) must still develop better than Division 1 (${division1.toFixed(1)})`);
});

test("the human/CPU relationship survives -- a richer stimulus still develops faster", () => {
  // The human weekly path supplies more stimulus than the CPU monthly proxy.
  // The shared multiplier must not invert or collapse that ordering.
  const elite = band(145, 155);
  const cpu = meanAt(elite, 25, 1);
  const human = elite.reduce((s, r) => s + trajectory(r, 1, 1.15)[25], 0) / elite.length;
  assert.ok(human > cpu, `a richer human stimulus (${human.toFixed(1)}) must still outdevelop the CPU proxy (${cpu.toFixed(1)}) at 25`);
  // ...and the gap must stay proportionate, not explode through the new curve.
  assert.ok(human - cpu < 12, `the human advantage (${(human - cpu).toFixed(1)} CA) must stay proportionate`);
});

test("attributes stay bounded and CA never exceeds the scale", () => {
  for (const r of [...band(145, 155), ...band(155, 170)].slice(0, 25)) {
    const final = trajectory(r)[30];
    assert.ok(final >= 1 && final <= CA_MAX, `CA ${final} outside the global scale`);
  }
});
