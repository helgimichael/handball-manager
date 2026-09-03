// HM-PLAYER-DEVELOPMENT-2.0 PHASE 1B.1: youth intake is a WORLD rule.
//
// Measured defect: with intake scoped to `state.competitionId`, a 5-season
// benchmark gave Handbollsligan 22-24 entrants a year and Herrallsvenskan,
// Division 1 Norra and Division 1 Sodra EXACTLY ZERO. Those tiers only aged --
// Herrallsvenskan's mean squad age went 23.9 -> 27.7 in five seasons with no
// replacement cohort -- while Handbollsligan alone absorbed the low-CA youth
// that diluted its mean. League-quality calibration was measuring that, not
// development.
//
// Generation itself is deliberately unchanged here (CA/PA ranges, positions,
// age, intake size, club-quality shift): this milestone corrects SCOPE only.
//
// THIS FILE IS THE FAST HALF. It builds a MINIMAL synthetic world -- the real
// club ids of all four competitions with empty squads -- which is all
// `careerWorldClubIds` (and therefore eligibility) actually reads. That proves
// every scope, fairness, idempotency and exclusion invariant in under a second
// and never touches disk. The expensive assertions that genuinely need the real
// 52-club world with real ratings (generation quality, CA/PA invariants over a
// real intake, world-development integration, canonical-data safety) live in
// youthIntakeWorldScope.sim.test.ts and run under `npm run test:sim`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { progressYouthIntake, eligibleYouthIntakeClubIds, YOUTH_INTAKE_DATE_MMDD } from "./youthIntake";
import { RETIRED_CLUB_ID } from "./playerLifecycle";
import { FREE_AGENT_CLUB_ID } from "./contractExpiry";
import { SWEDISH_WORLD_COMPETITION_IDS, careerWorldClubIds } from "./worldCompetitions";
import { createNewCareerState } from "./newCareer";
import { getClub, getClubsByCompetition, type PlayerMock } from "../game-data";
import { CA_MIN, CA_MAX, PA_MIN, PA_MAX } from "../rating/types";
import type { CareerState } from "./types";

const HUMAN_CLUB = "se_club_hammarby_if_hf"; // Handbollsligan
const INTAKE_DATE = `2027-${YOUTH_INTAKE_DATE_MMDD}`;

/**
 * Every real club id across the four Swedish competitions, with an EMPTY squad.
 * `careerWorldClubIds` checks key presence, not length, so this is a faithful
 * minimal stand-in for a populated world as far as intake eligibility is
 * concerned -- and it costs nothing to build.
 */
function syntheticWorld(seed = "phase1b1"): CareerState {
  const base = createNewCareerState(seed, HUMAN_CLUB);
  const worldSquads: Record<string, PlayerMock[]> = { ...base.worldSquads };
  for (const competitionId of SWEDISH_WORLD_COMPETITION_IDS) {
    for (const club of getClubsByCompetition(competitionId)) {
      worldSquads[club.id] = worldSquads[club.id] ?? [];
    }
  }
  return { ...base, worldSquads } as CareerState;
}

const competitionOf = (clubId: string) => getClub(clubId)?.competitionId;

// ---------------------------------------------------------------------------
// 1-4: every tier receives intake
// ---------------------------------------------------------------------------

test("every Swedish world competition receives youth intake", () => {
  const { generated } = progressYouthIntake(syntheticWorld(), INTAKE_DATE);
  const byCompetition = new Map<string, number>();
  for (const [clubId, ids] of Object.entries(generated)) {
    const comp = competitionOf(clubId);
    if (comp) byCompetition.set(comp, (byCompetition.get(comp) ?? 0) + ids.length);
  }
  for (const competitionId of SWEDISH_WORLD_COMPETITION_IDS) {
    assert.ok((byCompetition.get(competitionId) ?? 0) > 0, `${competitionId} must receive youth intake`);
  }
});

test("eligibility IS the career-world club set, not a parallel list", () => {
  const state = syntheticWorld();
  assert.deepEqual(
    [...eligibleYouthIntakeClubIds(state)].sort(),
    [...careerWorldClubIds(state)].sort(),
    "intake must reuse the same membership source retirement and CPU recruitment use",
  );
  const eligible = new Set(eligibleYouthIntakeClubIds(state));
  for (const competitionId of SWEDISH_WORLD_COMPETITION_IDS) {
    const clubs = getClubsByCompetition(competitionId).map((c) => c.id);
    assert.ok(clubs.every((id) => eligible.has(id)), `${competitionId} clubs must all be eligible`);
  }
  assert.ok(eligible.size >= 40, `expected the full world club set, got ${eligible.size}`);
});

// ---------------------------------------------------------------------------
// 5: the manager's competition gets no special treatment
// ---------------------------------------------------------------------------

test("the manager's competition receives no extra intake per club", () => {
  const { generated } = progressYouthIntake(syntheticWorld(), INTAKE_DATE);
  const perClub = (competitionId: string) => {
    const clubs = getClubsByCompetition(competitionId).map((c) => c.id).filter((id) => generated[id]);
    return clubs.length ? clubs.reduce((acc, id) => acc + generated[id].length, 0) / clubs.length : 0;
  };
  const hbl = perClub("se_handbollsligan_herr");
  for (const competitionId of SWEDISH_WORLD_COMPETITION_IDS) {
    if (competitionId === "se_handbollsligan_herr") continue;
    const other = perClub(competitionId);
    assert.ok(Math.abs(hbl - other) < 1.0, `per-club intake must not favour the manager's competition (HBL ${hbl.toFixed(2)} vs ${competitionId} ${other.toFixed(2)})`);
  }
});

// ---------------------------------------------------------------------------
// 6-8: correct club, correct competition context, valid ratings
// ---------------------------------------------------------------------------

test("each generated player joins the club they were generated for", () => {
  const { state, generated } = progressYouthIntake(syntheticWorld(), INTAKE_DATE);
  for (const [clubId, ids] of Object.entries(generated)) {
    const squadIds = new Set((state.worldSquads[clubId] ?? []).map((p) => p.id));
    for (const id of ids) {
      assert.ok(squadIds.has(id), `${id} must be in ${clubId}'s squad`);
      assert.ok(id.startsWith(`youth-${clubId}-`), `${id} must carry its own club in its identity`);
      assert.equal((state.worldSquads[clubId] ?? []).find((p) => p.id === id)!.clubId, clubId);
    }
  }
});

test("generated metadata uses the club's OWN competition, never the manager's", () => {
  const { state, generated } = progressYouthIntake(syntheticWorld(), INTAKE_DATE);
  let checkedNonManager = 0;
  for (const [clubId, ids] of Object.entries(generated)) {
    const comp = competitionOf(clubId);
    if (!comp || comp === state.competitionId) continue;
    checkedNonManager += ids.length;
    for (const id of ids) {
      const contract = state.playerContracts[id];
      assert.ok(contract, `${id} must have a contract`);
      assert.equal(contract.clubId, clubId, "the contract must belong to the generating club, not the manager's");
    }
  }
  assert.ok(checkedNonManager > 0, "the test must actually cover non-manager competitions");
});

test("every generated rating satisfies the global CA/PA invariants", () => {
  const { state, generated } = progressYouthIntake(syntheticWorld(), INTAKE_DATE);
  let checked = 0;
  for (const [clubId, ids] of Object.entries(generated)) {
    const ratings = new Map((state.gameplayRatings[clubId] ?? []).map((r) => [r.playerId, r]));
    for (const id of ids) {
      const r = ratings.get(id);
      assert.ok(r, `${id} must have a gameplay rating`);
      assert.ok(r!.ca >= CA_MIN && r!.ca <= CA_MAX, `${id} CA ${r!.ca} out of bounds`);
      assert.ok(r!.pa >= PA_MIN && r!.pa <= PA_MAX, `${id} PA ${r!.pa} out of bounds`);
      assert.ok(r!.pa >= r!.ca, `${id} PA ${r!.pa} must be >= CA ${r!.ca}`);
      checked++;
    }
  }
  assert.ok(checked > 40, `expected a world-sized intake, checked ${checked}`);
});

// ---------------------------------------------------------------------------
// 9-10: idempotency and determinism
// ---------------------------------------------------------------------------

test("reprocessing the same intake date generates nothing further, for any competition", () => {
  const first = progressYouthIntake(syntheticWorld(), INTAKE_DATE);
  const countBefore = Object.values(first.generated).reduce((a, ids) => a + ids.length, 0);
  const second = progressYouthIntake(first.state, INTAKE_DATE);
  assert.deepEqual(second.generated, {}, "a second pass on the same date must generate nobody");

  const squadTotal = (s: CareerState) => Object.values(s.worldSquads).reduce((a, sq) => a + sq.length, 0);
  assert.equal(squadTotal(second.state), squadTotal(first.state), "no partial duplication across clubs");
  assert.ok(countBefore > 40, "sanity: the first pass really did generate a world-sized intake");
});

test("the same seed produces an identical world intake", () => {
  const a = progressYouthIntake(syntheticWorld("same-seed"), INTAKE_DATE);
  const b = progressYouthIntake(syntheticWorld("same-seed"), INTAKE_DATE);
  assert.deepEqual(b.generated, a.generated, "identical seeds must generate identical players at identical clubs");
});

// ---------------------------------------------------------------------------
// 12: pools that are not clubs
// ---------------------------------------------------------------------------

test("the retired sentinel and the free-agent pool never receive club intake", () => {
  const state = syntheticWorld();
  const withPools: CareerState = {
    ...state,
    worldSquads: { ...state.worldSquads, [RETIRED_CLUB_ID]: [], [FREE_AGENT_CLUB_ID]: [] },
  };
  const { generated } = progressYouthIntake(withPools, INTAKE_DATE);
  assert.equal(generated[RETIRED_CLUB_ID], undefined, "retired is not a club that runs an academy");
  assert.equal(generated[FREE_AGENT_CLUB_ID], undefined, "the free-agent pool is not a club that runs an academy");
});
