// HM-YOUTH-INTAKE-1.1D-A: profile identity.
//
// The test that must never be deleted is "CA-neutral": the game has exactly one
// attribute-to-CA path (caNudgePerAttributePoint, equal weight per attribute
// within a branch), so a tilt whose applied integer deltas do not sum to zero
// silently desynchronises a player's CA from his own attributes -- permanently,
// because intake CA is an input and is never recomputed from the vector.
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyProfileTilt, type TiltableBranch } from "./profileTilt";
import { progressYouthIntake, YOUTH_INTAKE_DATE_MMDD } from "../../career/youthIntake";
import { SWEDISH_WORLD_COMPETITION_IDS } from "../../career/worldCompetitions";
import { createNewCareerState } from "../../career/newCareer";
import { getClubsByCompetition, type PlayerMock } from "../../game-data";
import {
  ATTRIBUTE_MAX, ATTRIBUTE_MIN,
  GOALKEEPER_ATTRIBUTE_FAMILIES, OUTCOURT_ATTRIBUTE_FAMILIES,
} from "../types";
import type { CareerState } from "../../career/types";

const OUT = Object.values(OUTCOURT_ATTRIBUTE_FAMILIES).flat();
const GK = Object.values(GOALKEEPER_ATTRIBUTE_FAMILIES).flat();
const OUTCOURT_POSITIONS = ["M9", "V9", "H9", "M6", "V6", "H6"] as const;

function flat(level: number, gk = false): TiltableBranch {
  const attributes: Record<string, { value: number; origin: string }> = {};
  for (const a of gk ? GK : OUT) attributes[a] = { value: level, origin: "GENERATED_PRIOR" };
  return { branch: gk ? "GOALKEEPER" : "OUTCOURT", attributes };
}
/** A realistically uneven profile -- position emphasis and archetype boosts already applied. */
function shaped(level: number, salt: number): TiltableBranch {
  const b = flat(level);
  const keys = Object.keys(b.attributes);
  for (let i = 0; i < keys.length; i++) {
    b.attributes[keys[i]].value = Math.max(ATTRIBUTE_MIN, Math.min(ATTRIBUTE_MAX, level + ((i * 7 + salt) % 5) - 2));
  }
  return b;
}
const sum = (b: TiltableBranch) => Object.values(b.attributes).reduce((a, c) => a + c.value, 0);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };

function syntheticWorld(seed: string): CareerState {
  const base = createNewCareerState(seed, "se_club_hammarby_if_hf");
  const ws: Record<string, PlayerMock[]> = { ...base.worldSquads };
  for (const c of SWEDISH_WORLD_COMPETITION_IDS) for (const cl of getClubsByCompetition(c)) ws[cl.id] = ws[cl.id] ?? [];
  return { ...base, worldSquads: ws } as CareerState;
}

interface Row { id: string; pos: string; ca: number; pa: number; attrs: Record<string, number>; branch: string }
let cached: Row[] | undefined;
function corpus(): Row[] {
  if (cached) return cached;
  const rows: Row[] = [];
  let st = syntheticWorld("tilt-corpus");
  for (let y = 2027; y < 2047; y++) {
    const { state: next, generated } = progressYouthIntake(st, `${y}-${YOUTH_INTAKE_DATE_MMDD}`);
    for (const [clubId, ids] of Object.entries(generated)) {
      const ratings = next.gameplayRatings[clubId] ?? [];
      const squad = next.worldSquads[clubId] ?? [];
      for (const id of ids) {
        const r = ratings.find((x) => x.playerId === id);
        const p = squad.find((x) => x.id === id);
        if (!r || !p) continue;
        const b = r.branch as { branch: string; attributes: Record<string, { value: number }> };
        const attrs: Record<string, number> = {};
        for (const [k, v] of Object.entries(b.attributes ?? {})) attrs[k] = v.value;
        rows.push({ id, pos: p.position, ca: r.ca, pa: r.pa, attrs, branch: b.branch });
      }
    }
    st = next;
  }
  cached = rows;
  return rows;
}

// ---------------------------------------------------------------------------
// CA neutrality -- the invariant this whole module exists to satisfy
// ---------------------------------------------------------------------------

test("the tilt is exactly CA-neutral at every baseline level, both branches", () => {
  for (const gk of [false, true]) {
    for (let level = ATTRIBUTE_MIN; level <= ATTRIBUTE_MAX; level++) {
      for (let i = 0; i < 60; i++) {
        const before = flat(level, gk);
        const pos = gk ? "MV" : OUTCOURT_POSITIONS[i % OUTCOURT_POSITIONS.length];
        const after = applyProfileTilt(before, pos, `neutral-${gk}-${level}-${i}`);
        assert.equal(sum(after), sum(before), `${gk ? "GK" : "outcourt"} level ${level} #${i}: applied deltas must sum to zero`);
      }
    }
  }
});

test("the tilt is exactly CA-neutral on realistically uneven profiles", () => {
  for (let i = 0; i < 1500; i++) {
    const before = shaped(5 + (i % 10), i);
    const after = applyProfileTilt(before, OUTCOURT_POSITIONS[i % OUTCOURT_POSITIONS.length], `uneven-${i}`);
    assert.equal(sum(after), sum(before), `uneven profile #${i} must stay CA-neutral`);
  }
});

test("a profile pinned at a bound falls back to untilted rather than shipping a CA-inconsistent player", () => {
  for (const level of [ATTRIBUTE_MIN, ATTRIBUTE_MAX]) {
    const before = flat(level);
    const after = applyProfileTilt(before, "M9", `pinned-${level}`);
    assert.equal(sum(after), sum(before), "sum must hold even in the degenerate case");
    for (const k of Object.keys(before.attributes)) {
      assert.equal(after.attributes[k].value, before.attributes[k].value, `${k} must be untouched when no headroom exists`);
    }
  }
});

test("attributes stay within 1-20 everywhere", () => {
  for (const r of corpus()) {
    for (const [a, v] of Object.entries(r.attrs)) {
      assert.ok(v >= ATTRIBUTE_MIN && v <= ATTRIBUTE_MAX, `${r.id} ${a} = ${v} is outside 1-20`);
    }
  }
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

test("the tilt is deterministic for a given player", () => {
  for (let i = 0; i < 200; i++) {
    const b = shaped(9, i);
    const a1 = applyProfileTilt(b, "M9", `det-${i}`);
    const a2 = applyProfileTilt(b, "M9", `det-${i}`);
    assert.deepEqual(a2.attributes, a1.attributes, "same player must always receive the same profile");
  }
});

test("re-running an intake year cannot reshape existing players", () => {
  const state = syntheticWorld("tilt-reload");
  const first = progressYouthIntake(state, `2029-${YOUTH_INTAKE_DATE_MMDD}`);
  const second = progressYouthIntake(first.state, `2029-${YOUTH_INTAKE_DATE_MMDD}`);
  assert.deepEqual(second.generated, {}, "a second pass generates nobody");
  const attrsOf = (s: CareerState) =>
    Object.entries(first.generated).flatMap(([clubId, ids]) =>
      ids.map((id) => JSON.stringify((s.gameplayRatings[clubId] ?? []).find((r) => r.playerId === id)?.branch)),
    );
  assert.deepEqual(attrsOf(second.state), attrsOf(first.state), "existing attribute vectors must be untouched");
});

// ---------------------------------------------------------------------------
// The point of the milestone
// ---------------------------------------------------------------------------

test("two same-position, same-CA players differ meaningfully", () => {
  // Pre-1.1d-A this was mean SD 0.87 / mean span 2.38. Real canonical players
  // at comparable CA sit at 2.29-3.98 SD. The bound below is a regression
  // guard, not a target: it must not silently fall back toward a template.
  for (const pos of ["M9", "V9", "M6", "V6", "MV"]) {
    const band = corpus().filter((r) => r.pos === pos && r.ca >= 82 && r.ca <= 92);
    assert.ok(band.length >= 20, `${pos}: need a usable band, got ${band.length}`);
    const names = [...new Set(band.flatMap((r) => Object.keys(r.attrs)))];
    const sds = names.map((a) => sd(band.map((r) => r.attrs[a] ?? 0)));
    const spans = names.map((a) => { const v = band.map((r) => r.attrs[a] ?? 0); return Math.max(...v) - Math.min(...v); });
    assert.ok(mean(sds) > 1.5, `${pos}: fixed-CA attribute SD ${mean(sds).toFixed(2)} must clearly exceed the 0.87 template baseline`);
    assert.ok(mean(spans) > 5, `${pos}: fixed-CA attribute span ${mean(spans).toFixed(2)} must clearly exceed the old 2.38`);
  }
});

test("positional identity survives the tilt", () => {
  const rows = corpus().filter((r) => r.branch === "OUTCOURT");
  const at = (pos: string, attr: string) => mean(rows.filter((r) => r.pos === pos).map((r) => r.attrs[attr] ?? 0));
  // A wing is quick and a playmaker reads the game -- the separation measured
  // before the tilt (10.35 vs 6.98 on ACCELERATION) must not narrow.
  assert.ok(at("V6", "ACCELERATION") - at("M9", "ACCELERATION") > 3, `wings must stay clearly quicker than playmakers (${at("V6", "ACCELERATION").toFixed(2)} vs ${at("M9", "ACCELERATION").toFixed(2)})`);
  assert.ok(at("M9", "ADVANTAGE_RECOGNITION") - at("V6", "ADVANTAGE_RECOGNITION") > 3, "playmakers must stay clearly better readers than wings");
  assert.ok(at("V9", "BREAKTHROUGH") - at("M9", "BREAKTHROUGH") > 1.5, "backs must stay stronger at breakthrough than playmakers");
  assert.ok(at("M6", "CONTACT_ABILITY") - at("V6", "CONTACT_ABILITY") > 0.5, "pivots must stay more contact-capable than wings");

  // Goalkeepers keep an entirely separate attribute branch.
  const gks = corpus().filter((r) => r.pos === "MV");
  assert.ok(gks.length > 50, "need goalkeepers");
  assert.ok(gks.every((r) => r.branch === "GOALKEEPER"), "every MV must use the goalkeeper branch");
  assert.ok(gks.every((r) => r.attrs.ACCELERATION === undefined), "a goalkeeper must not carry outcourt attributes");
});

test("the tilt changes neither CA nor PA", () => {
  // Both are decided before the attribute vector exists; the tilt only reshapes
  // attributes. Guards the 1.1d-A scope boundary (initial CA is 1.1d-B's job).
  const rows = corpus();
  const ca = rows.map((r) => r.ca);
  assert.ok(Math.min(...ca) >= 1 && Math.max(...ca) <= 200, "CA stays on the global scale");
  assert.ok(rows.every((r) => r.pa >= r.ca), "PA >= CA invariant survives");
  // HM-YOUTH-INTAKE-1.1D-B superseded the original landmarks here. They pinned
  // median 74 / max <= 110, correct while 1.1d-A owned the scope, but 1.1d-B
  // deliberately added the age shift and the rare readiness tail and lifted the
  // Handbollsligan tail to its configured 118 ceiling. What this test actually
  // guards is that the TILT does not move CA -- proven directly by the
  // CA-neutrality tests above -- so the landmarks are kept only as loose
  // sanity bounds that no future tilt change should breach.
  const sorted = [...ca].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  assert.ok(Math.abs(median - 75) <= 4, `initial CA median ${median} must not be moved by profile tilting`);
  assert.ok(Math.max(...ca) <= 118, "initial CA must stay inside the configured tier ceilings");
});
