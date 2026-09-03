// HM-PLAYER-DEVELOPMENT-2.0 PHASE 1B.1: the EXPENSIVE half of the world-scope
// proof. Run with `npm run test:sim`, not the default suite.
//
// youthIntakeWorldScope.test.ts asserts every scope, fairness, idempotency and
// exclusion invariant against a minimal synthetic world (real club ids, empty
// squads) in under a second. These assertions genuinely need the REAL 52-club
// world loaded from canonical data -- real squads, real club strength feeding
// clubQualityShift, real ratings -- so they are split out by cost, not dropped.
import { test } from "node:test";
import assert from "node:assert/strict";
import { progressYouthIntake, YOUTH_INTAKE_DATE_MMDD } from "./youthIntake";
import { SWEDISH_WORLD_COMPETITION_IDS } from "./worldCompetitions";
import { getClub } from "../game-data";
import { CA_MIN, CA_MAX, PA_MIN, PA_MAX } from "../rating/types";
import { buildSwedishWorld, createHarnessCareer } from "../../scripts/simulate-player-development";
import type { CareerState } from "./types";

const HUMAN_CLUB = "se_club_hammarby_if_hf";
const INTAKE_DATE = `2027-${YOUTH_INTAKE_DATE_MMDD}`;

let cached: CareerState | undefined;
function realWorld(): CareerState {
  if (!cached) cached = createHarnessCareer("phase1b1-sim", HUMAN_CLUB);
  return cached;
}

test("sim: a real-world intake covers every competition with plausible tiered quality", () => {
  const { state, generated } = progressYouthIntake(realWorld(), INTAKE_DATE);
  const byCompetition = new Map<string, { n: number; ca: number[]; pa: number[] }>();
  for (const [clubId, ids] of Object.entries(generated)) {
    const comp = getClub(clubId)?.competitionId;
    if (!comp) continue;
    const bucket = byCompetition.get(comp) ?? { n: 0, ca: [], pa: [] };
    const ratings = new Map((state.gameplayRatings[clubId] ?? []).map((r) => [r.playerId, r]));
    for (const id of ids) {
      const r = ratings.get(id)!;
      bucket.ca.push(r.ca);
      bucket.pa.push(r.pa);
      bucket.n++;
    }
    byCompetition.set(comp, bucket);
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  for (const competitionId of SWEDISH_WORLD_COMPETITION_IDS) {
    const b = byCompetition.get(competitionId);
    assert.ok(b && b.n > 0, `${competitionId} must receive real-world intake`);
    assert.ok(b!.ca.every((ca) => ca >= CA_MIN && ca <= CA_MAX), `${competitionId} CA in bounds`);
    assert.ok(b!.pa.every((pa) => pa >= PA_MIN && pa <= PA_MAX), `${competitionId} PA in bounds`);
  }
  // The existing per-tier CA profiles must still order the world: top tier
  // produces better youth on average than Division 1. Generation is unchanged
  // by this milestone -- this guards that it STAYED unchanged.
  const hbl = mean(byCompetition.get("se_handbollsligan_herr")!.ca);
  const d1n = mean(byCompetition.get("se_division1_norra")!.ca);
  assert.ok(hbl > d1n, `Handbollsligan youth should out-rate Division 1 youth on average (${hbl.toFixed(1)} vs ${d1n.toFixed(1)})`);
});

test("sim: total real-world intake follows the existing per-club rule, not a new quota", () => {
  const { generated } = progressYouthIntake(realWorld(), INTAKE_DATE);
  const clubs = Object.keys(generated).length;
  const total = Object.values(generated).reduce((a, ids) => a + ids.length, 0);
  assert.ok(clubs >= 45, `expected the full world club set to take intake, got ${clubs}`);
  const perClub = total / clubs;
  // intakeSizeForClub is 45% -> 1, 45% -> 2, 10% -> 3 (mean 1.65), unchanged.
  assert.ok(perClub > 1.3 && perClub < 2.0, `per-club intake must still average ~1.65, got ${perClub.toFixed(2)}`);
  assert.ok(total > 70 && total < 105, `world intake should be ~52 x 1.65 = ~86, got ${total}`);
});


test("sim: canonical data is never mutated by an intake pass", () => {
  const before = Object.values(buildSwedishWorld().worldSquads).reduce((a, s) => a + s.length, 0);
  progressYouthIntake(realWorld(), INTAKE_DATE);
  const after = Object.values(buildSwedishWorld().worldSquads).reduce((a, s) => a + s.length, 0);
  assert.equal(after, before, "the canonical world snapshot must be untouched by intake");
});
