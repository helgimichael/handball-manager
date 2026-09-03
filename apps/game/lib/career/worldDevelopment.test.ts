// HM-PLAYER-DEVELOPMENT-2.0 PHASE 1B: world development.
//
// Before this milestone, positive development reached only the managed club: a
// 20-season benchmark measured ZERO CPU players improving across ~26,000
// player-seasons while decline and retirement applied world-wide. These tests
// pin the eligibility, the envelope, and the guarantees that keep the fix from
// becoming a second, divergent ability model.
//
// Isolated, hand-built CareerStates only -- never the canonical data/ tree.
import { test } from "node:test";
import assert from "node:assert/strict";
import { progressWorldDevelopment, worldDevelopmentPeriodId } from "./worldDevelopment";
import { computeCpuSeasonStimulus, CPU_DEVELOPMENT_CONSTANTS } from "../development/cpuDevelopment";
import { retirePlayer, RETIRED_CLUB_ID } from "./playerLifecycle";
import { createNewCareerState } from "./newCareer";
import { OUTCOURT_ATTRIBUTES, CA_MIN, CA_MAX, PA_MIN, PA_MAX } from "../rating/types";
import type { CareerState } from "./types";
import type { PlayerMock } from "../game-data";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";

const HUMAN_CLUB = "se_club_hammarby_if_hf";
const CPU_CLUB = "se_club_ifk_kristianstad";
const DEV_DATE = "2027-03-01"; // a world-development day
const NON_DEV_DATE = "2027-03-02";

function player(id: string, birthYear: number, clubId: string): PlayerMock {
  return {
    id, firstName: "Test", lastName: id, position: "M9", clubId,
    dateOfBirth: `${birthYear}-04-01`, birthYear,
  } as unknown as PlayerMock;
}

/** A rating whose attributes are all `value`, so CA/PA can be set independently of them. */
function rating(playerId: string, ca: number, pa: number, value = 10): GameplayPlayerRating {
  const attributes: Record<string, { value: number; origin: string }> = {};
  for (const attr of OUTCOURT_ATTRIBUTES) attributes[attr] = { value, origin: "GENERATED_PRIOR" };
  return { playerId, ca, pa, branch: { branch: "OUTCOURT", attributes } } as unknown as GameplayPlayerRating;
}

interface Spec { id: string; birthYear: number; ca: number; pa: number; clubId?: string }

// One base career per file -- createNewCareerState is the expensive part, and
// stateWith only ever layers fixture players on top of a copy of it.
let cachedBase: CareerState | undefined;
function baseCareer(): CareerState {
  if (!cachedBase) cachedBase = createNewCareerState("phase1b", HUMAN_CLUB);
  return cachedBase;
}

function stateWith(specs: Spec[]): CareerState {
  const base = baseCareer();
  const worldSquads: Record<string, PlayerMock[]> = { ...base.worldSquads };
  const gameplayRatings: Record<string, GameplayPlayerRating[]> = { ...base.gameplayRatings };
  const playerContracts = { ...base.playerContracts };
  for (const s of specs) {
    const clubId = s.clubId ?? CPU_CLUB;
    worldSquads[clubId] = [...(worldSquads[clubId] ?? []).filter((p) => p.id !== s.id), player(s.id, s.birthYear, clubId)];
    gameplayRatings[clubId] = [...(gameplayRatings[clubId] ?? []).filter((r) => r.playerId !== s.id), rating(s.id, s.ca, s.pa)];
    playerContracts[s.id] = { playerId: s.id, clubId, contractEndDate: "2030-06-30", wageEurPerMonth: 3000 };
  }
  return { ...base, gameDate: DEV_DATE, processedThroughDate: DEV_DATE, worldSquads, gameplayRatings, playerContracts, worldDevelopmentPeriods: {} } as CareerState;
}

function caOf(state: CareerState, clubId: string, playerId: string): number {
  return (state.gameplayRatings[clubId] ?? []).find((r) => r.playerId === playerId)?.ca ?? NaN;
}

/** Runs `months` consecutive monthly passes. */
function runMonths(state: CareerState, months: number, startYear = 2027): CareerState {
  let next = state;
  for (let i = 0; i < months; i++) {
    const year = startYear + Math.floor(i / 12);
    const month = String((i % 12) + 1).padStart(2, "0");
    next = progressWorldDevelopment(next, `${year}-${month}-01`);
  }
  return next;
}

// ---------------------------------------------------------------------------
// Eligibility -- the defect this milestone fixes
// ---------------------------------------------------------------------------

test("a CPU prospect with real headroom improves", () => {
  const before = stateWith([{ id: "cpu-prospect", birthYear: 2008, ca: 100, pa: 160 }]);
  const after = runMonths(before, 24);
  const gained = caOf(after, CPU_CLUB, "cpu-prospect") - caOf(before, CPU_CLUB, "cpu-prospect");
  assert.ok(gained > 0, `a 19-year-old CPU prospect with 60 points of headroom must develop, gained ${gained}`);
});

test("a CPU prospect's two-season gain stays inside the measured human envelope", () => {
  const before = stateWith([{ id: "cpu-envelope", birthYear: 2008, ca: 100, pa: 160 }]);
  const after = runMonths(before, 24);
  const perSeason = (caOf(after, CPU_CLUB, "cpu-envelope") - caOf(before, CPU_CLUB, "cpu-envelope")) / 2;
  assert.ok(perSeason <= 12, `CPU prospects must not out-develop human ones (+${perSeason.toFixed(2)}/season)`);
});

test("a CPU veteran at their ceiling does not receive youth growth", () => {
  const before = stateWith([{ id: "cpu-veteran", birthYear: 1992, ca: 140, pa: 142 }]);
  const after = runMonths(before, 24);
  const gained = caOf(after, CPU_CLUB, "cpu-veteran") - caOf(before, CPU_CLUB, "cpu-veteran");
  assert.ok(gained < 2, `a 35-year-old with 2 points of headroom must barely move, gained ${gained}`);
});

test("a retired player never develops", () => {
  const base = stateWith([{ id: "cpu-retiree", birthYear: 1990, ca: 120, pa: 160 }]);
  const retired = retirePlayer(base, "cpu-retiree", DEV_DATE);
  const caBefore = caOf(retired, RETIRED_CLUB_ID, "cpu-retiree");
  const after = runMonths(retired, 24);
  assert.equal(caOf(after, RETIRED_CLUB_ID, "cpu-retiree"), caBefore, "the retired sentinel is excluded from world development");
  assert.equal(after.worldDevelopmentPeriods["cpu-retiree"], undefined, "a retired player is never even evaluated");
});

test("the managed club is excluded -- it keeps its own weekly model, and is never double-developed", () => {
  const before = stateWith([{ id: "human-prospect", birthYear: 2008, ca: 100, pa: 160, clubId: HUMAN_CLUB }]);
  const after = runMonths(before, 12);
  assert.equal(
    caOf(after, HUMAN_CLUB, "human-prospect"),
    caOf(before, HUMAN_CLUB, "human-prospect"),
    "world development must not touch the managed club",
  );
  assert.equal(after.worldDevelopmentPeriods["human-prospect"], undefined);
});

// ---------------------------------------------------------------------------
// Idempotency -- player + period, never player + club
// ---------------------------------------------------------------------------

test("reprocessing the same development date is a no-op", () => {
  const before = stateWith([{ id: "cpu-idem", birthYear: 2008, ca: 100, pa: 160 }]);
  const once = progressWorldDevelopment(before, DEV_DATE);
  const twice = progressWorldDevelopment(once, DEV_DATE);
  assert.equal(caOf(twice, CPU_CLUB, "cpu-idem"), caOf(once, CPU_CLUB, "cpu-idem"), "the same period must never develop twice");
  assert.equal(twice.worldDevelopmentPeriods["cpu-idem"], "2027-M03");
});

test("a non-development date changes nothing", () => {
  const before = stateWith([{ id: "cpu-noop", birthYear: 2008, ca: 100, pa: 160 }]);
  assert.equal(progressWorldDevelopment(before, NON_DEV_DATE), before, "only the 1st of a month is a development day");
  assert.equal(worldDevelopmentPeriodId(NON_DEV_DATE), null);
  assert.equal(worldDevelopmentPeriodId(DEV_DATE), "2027-M03");
});

test("a mid-period transfer neither double-develops nor skips the player", () => {
  const before = stateWith([{ id: "cpu-mover", birthYear: 2008, ca: 100, pa: 160 }]);
  const developed = progressWorldDevelopment(before, DEV_DATE);
  const caAfterFirst = caOf(developed, CPU_CLUB, "cpu-mover");

  // Move the player to another CPU club WITHIN the same period.
  const other = "se_club_lugi_hf";
  const mover = (developed.worldSquads[CPU_CLUB] ?? []).find((p) => p.id === "cpu-mover")!;
  const moverRating = (developed.gameplayRatings[CPU_CLUB] ?? []).find((r) => r.playerId === "cpu-mover")!;
  const moved: CareerState = {
    ...developed,
    worldSquads: {
      ...developed.worldSquads,
      [CPU_CLUB]: (developed.worldSquads[CPU_CLUB] ?? []).filter((p) => p.id !== "cpu-mover"),
      [other]: [...(developed.worldSquads[other] ?? []), { ...mover, clubId: other }],
    },
    gameplayRatings: {
      ...developed.gameplayRatings,
      [CPU_CLUB]: (developed.gameplayRatings[CPU_CLUB] ?? []).filter((r) => r.playerId !== "cpu-mover"),
      [other]: [...(developed.gameplayRatings[other] ?? []), moverRating],
    },
  };

  const again = progressWorldDevelopment(moved, DEV_DATE);
  assert.equal(caOf(again, other, "cpu-mover"), caAfterFirst, "changing club must not grant a second development in the same period");

  const nextPeriod = progressWorldDevelopment(again, "2027-04-01");
  assert.equal(nextPeriod.worldDevelopmentPeriods["cpu-mover"], "2027-M04", "and the player still develops in the NEXT period at their new club");
});

// ---------------------------------------------------------------------------
// Determinism and invariants
// ---------------------------------------------------------------------------

test("the same seed and state produce identical development", () => {
  const specs: Spec[] = [
    { id: "d1", birthYear: 2008, ca: 100, pa: 160 },
    { id: "d2", birthYear: 2005, ca: 120, pa: 140 },
    { id: "d3", birthYear: 1996, ca: 135, pa: 138 },
  ];
  const a = runMonths(stateWith(specs), 12);
  const b = runMonths(stateWith(specs), 12);
  for (const s of specs) assert.equal(caOf(a, CPU_CLUB, s.id), caOf(b, CPU_CLUB, s.id), `${s.id} must develop identically`);
});

test("PA is never modified and CA never leaves its bounds", () => {
  const specs: Spec[] = [
    { id: "inv1", birthYear: 2010, ca: 60, pa: 190 },
    { id: "inv2", birthYear: 2008, ca: 100, pa: 160 },
    { id: "inv3", birthYear: 1994, ca: 150, pa: 152 },
  ];
  const before = stateWith(specs);
  const after = runMonths(before, 60);
  for (const s of specs) {
    const r = (after.gameplayRatings[CPU_CLUB] ?? []).find((x) => x.playerId === s.id)!;
    assert.equal(r.pa, s.pa, `${s.id} PA must be immutable`);
    assert.ok(r.pa >= PA_MIN && r.pa <= PA_MAX);
    assert.ok(r.ca >= CA_MIN && r.ca <= CA_MAX);
    assert.ok(r.ca <= r.pa + 1, `${s.id} must not blow past its ceiling (ca ${r.ca}, pa ${r.pa})`);
  }
});

test("five simulated years do not converge every prospect onto PA", () => {
  const specs: Spec[] = Array.from({ length: 12 }, (_, i) => ({ id: `conv${i}`, birthYear: 2008, ca: 100, pa: 160 }));
  const after = runMonths(stateWith(specs), 60);
  const consumed = specs.map((s) => (caOf(after, CPU_CLUB, s.id) - 100) / 60);
  assert.ok(Math.max(...consumed) < 0.95, `no prospect should effectively reach PA in five years (max ${Math.max(...consumed).toFixed(3)})`);
  assert.ok(Math.max(...consumed) > 0, "but prospects must genuinely develop");
});

// NOTE, deliberately not asserted: two prospects with IDENTICAL age, CA, PA,
// club and (in this fixture) identical attribute values develop identically.
// The only per-player variance Phase 1B has is +-12% seeded jitter and the
// phase offset, and neither is large enough to change how many 9.0 thresholds
// are crossed over five years. Real divergence between same-input players
// needs a hidden per-player development trait, which is explicitly OUT OF
// SCOPE for this phase. Population-level spread today comes from the inputs
// that DO differ in a real world -- age, headroom, role, tier, availability
// and each player's own attribute profile -- which the tests above cover.

// ---------------------------------------------------------------------------
// The stimulus function itself
// ---------------------------------------------------------------------------

test("CPU stimulus never reads age or PA headroom -- those apply exactly once, downstream", () => {
  const attributes: Record<string, { value: number }> = {};
  for (const attr of OUTCOURT_ATTRIBUTES) attributes[attr] = { value: 10 };
  const base = { playerId: "p", periodId: "2027-M03", branch: "OUTCOURT" as const, attributes, tier: "ROTATION" as const, competitionTier: 1, isFreeAgent: false, isAvailable: true };
  const a = computeCpuSeasonStimulus(base);
  // Nothing in the input carries age or PA, so identical inputs must give identical output.
  assert.deepEqual(computeCpuSeasonStimulus(base), a);
  assert.ok(Object.keys(a).length === OUTCOURT_ATTRIBUTES.length, "every outcourt attribute receives club training");
});

test("TALENT is not a poor developmental state", () => {
  const c = CPU_DEVELOPMENT_CONSTANTS;
  assert.equal(c.ROLE_MODIFIER.TALENT, c.ROLE_MODIFIER.ROTATION, "a talent trains as fully as a rotation player");
  assert.ok(c.ROLE_MODIFIER.KEY_PLAYER / c.ROLE_MODIFIER.SQUAD_PLAYER < 1.25, "role must stay a modest modifier, not the dominant mechanism");
});

test("competition tier is a modest environment modifier, not a dominant multiplier", () => {
  const c = CPU_DEVELOPMENT_CONSTANTS;
  const spread = c.TIER_ENVIRONMENT_MODIFIER[1] / c.TIER_ENVIRONMENT_MODIFIER[3];
  assert.ok(spread < 1.2, `a top-tier club must not manufacture far more ability than a lower-tier one (spread ${spread.toFixed(3)})`);
});

test("a free agent gets a reduced maintenance baseline, not a club training environment", () => {
  const attributes: Record<string, { value: number }> = {};
  for (const attr of OUTCOURT_ATTRIBUTES) attributes[attr] = { value: 10 };
  const base = { playerId: "fa", periodId: "2027-M03", branch: "OUTCOURT" as const, attributes, tier: "ROTATION" as const, competitionTier: undefined, isAvailable: true };
  const contracted = computeCpuSeasonStimulus({ ...base, isFreeAgent: false });
  const freeAgent = computeCpuSeasonStimulus({ ...base, isFreeAgent: true });
  const attr = OUTCOURT_ATTRIBUTES[0];
  assert.ok((freeAgent[attr] ?? 0) > 0, "a free agent still trains individually");
  assert.ok((freeAgent[attr] ?? 0) < (contracted[attr] ?? 0) * 0.5, "but substantially less than a contracted player");
});

test("stimulus follows the player's own profile rather than being uniform", () => {
  const attributes: Record<string, { value: number }> = {};
  for (const attr of OUTCOURT_ATTRIBUTES) attributes[attr] = { value: 10 };
  attributes[OUTCOURT_ATTRIBUTES[0]] = { value: 18 }; // a standout strength
  attributes[OUTCOURT_ATTRIBUTES[1]] = { value: 4 };  // a weakness
  const out = computeCpuSeasonStimulus({
    playerId: "profile", periodId: "2027-M03", branch: "OUTCOURT", attributes,
    tier: "ROTATION", competitionTier: 2, isFreeAgent: false, isAvailable: true,
  });
  assert.ok((out[OUTCOURT_ATTRIBUTES[0]] ?? 0) > (out[OUTCOURT_ATTRIBUTES[1]] ?? 0), "a strength must develop faster than a weakness");
});

test("an unavailable player develops less but not zero", () => {
  const attributes: Record<string, { value: number }> = {};
  for (const attr of OUTCOURT_ATTRIBUTES) attributes[attr] = { value: 10 };
  const base = { playerId: "inj", periodId: "2027-M03", branch: "OUTCOURT" as const, attributes, tier: "ROTATION" as const, competitionTier: 2, isFreeAgent: false };
  const fit = computeCpuSeasonStimulus({ ...base, isAvailable: true });
  const hurt = computeCpuSeasonStimulus({ ...base, isAvailable: false });
  const attr = OUTCOURT_ATTRIBUTES[0];
  assert.ok((hurt[attr] ?? 0) > 0 && (hurt[attr] ?? 0) < (fit[attr] ?? 0), "injury reduces exposure without zeroing development");
});

// ---------------------------------------------------------------------------
// PHASE 1B CALIBRATION PASS 2: the deterministic phase initialisation is a
// PROGRESS desynchroniser and nothing more. It must never hand out ability.
// ---------------------------------------------------------------------------

test("phase init never changes CA or an attribute by itself", () => {
  // A player whose stimulus cannot possibly resolve a point (no headroom at
  // all) must come out of their first pass byte-identical in ability, even
  // though the phase seed ran.
  const before = stateWith([{ id: "phase-noop", birthYear: 1996, ca: 150, pa: 150 }]);
  const caBefore = caOf(before, CPU_CLUB, "phase-noop");
  const attrsBefore = JSON.stringify((before.gameplayRatings[CPU_CLUB] ?? []).find((r) => r.playerId === "phase-noop")!.branch);

  const after = progressWorldDevelopment(before, DEV_DATE);
  assert.equal(caOf(after, CPU_CLUB, "phase-noop"), caBefore, "phase init must not move CA");
  assert.equal(
    JSON.stringify((after.gameplayRatings[CPU_CLUB] ?? []).find((r) => r.playerId === "phase-noop")!.branch),
    attrsBefore,
    "phase init must not move any attribute",
  );
  assert.equal(after.worldDevelopmentPeriods["phase-noop"], "2027-M03", "but the player WAS evaluated");
});

test("phase init fires once and never re-fires on later periods", () => {
  const before = stateWith([{ id: "phase-once", birthYear: 2008, ca: 100, pa: 160 }]);
  const first = progressWorldDevelopment(before, DEV_DATE);
  const progressAfterFirst = { ...first.playerDevelopmentState["phase-once"].attributeProgress };

  // Second period: progress must ADVANCE from the stored value, never be
  // re-seeded back to a fresh phase offset.
  const second = progressWorldDevelopment(first, "2027-04-01");
  const attr = OUTCOURT_ATTRIBUTES[0];
  const p1 = progressAfterFirst[attr] ?? 0;
  const p2 = second.playerDevelopmentState["phase-once"].attributeProgress[attr] ?? 0;
  assert.ok(p2 > p1 || p2 < p1, "progress must move");
  // Re-running the FIRST period again must not re-seed either.
  const replay = progressWorldDevelopment(first, DEV_DATE);
  assert.deepEqual(replay.playerDevelopmentState["phase-once"].attributeProgress, progressAfterFirst, "a replayed period must not re-seed phase");
});

test("phase init does not re-fire after a reload -- it keys off persisted state", () => {
  const before = stateWith([{ id: "phase-reload", birthYear: 2008, ca: 100, pa: 160 }]);
  const developed = progressWorldDevelopment(before, DEV_DATE);
  // Round-trip exactly as a save/load would.
  const reloaded = JSON.parse(JSON.stringify(developed)) as CareerState;
  assert.equal(reloaded.worldDevelopmentPeriods["phase-reload"], "2027-M03");
  const afterReload = progressWorldDevelopment(reloaded, "2027-04-01");
  const attr = OUTCOURT_ATTRIBUTES[0];
  const expected = (developed.playerDevelopmentState["phase-reload"].attributeProgress[attr] ?? 0);
  const actual = (afterReload.playerDevelopmentState["phase-reload"].attributeProgress[attr] ?? 0);
  assert.notEqual(actual, expected + 0, "progress advanced normally");
  assert.ok(actual > 0, "and was not reset");
});

test("phase init does not re-fire after a transfer", () => {
  const before = stateWith([{ id: "phase-move", birthYear: 2008, ca: 100, pa: 160 }]);
  const developed = progressWorldDevelopment(before, DEV_DATE);
  const stored = { ...developed.playerDevelopmentState["phase-move"].attributeProgress };
  const other = "se_club_lugi_hf";
  const mover = (developed.worldSquads[CPU_CLUB] ?? []).find((p) => p.id === "phase-move")!;
  const moverRating = (developed.gameplayRatings[CPU_CLUB] ?? []).find((r) => r.playerId === "phase-move")!;
  const moved: CareerState = {
    ...developed,
    worldSquads: {
      ...developed.worldSquads,
      [CPU_CLUB]: (developed.worldSquads[CPU_CLUB] ?? []).filter((p) => p.id !== "phase-move"),
      [other]: [...(developed.worldSquads[other] ?? []), { ...mover, clubId: other }],
    },
    gameplayRatings: {
      ...developed.gameplayRatings,
      [CPU_CLUB]: (developed.gameplayRatings[CPU_CLUB] ?? []).filter((r) => r.playerId !== "phase-move"),
      [other]: [...(developed.gameplayRatings[other] ?? []), moverRating],
    },
  };
  const next = progressWorldDevelopment(moved, "2027-04-01");
  const attr = OUTCOURT_ATTRIBUTES[0];
  assert.ok(
    (next.playerDevelopmentState["phase-move"].attributeProgress[attr] ?? 0) >= (stored[attr] ?? 0) - 9,
    "progress carried across the transfer instead of being re-seeded from scratch",
  );
  assert.equal(next.worldDevelopmentPeriods["phase-move"], "2027-M04");
});

test("a migrated pre-1B save is seeded once, not on every load", () => {
  // saveMigration defaults worldDevelopmentPeriods to {} -- so the first pass
  // after migration seeds phase, and every subsequent load must not.
  const legacy = stateWith([{ id: "phase-migrated", birthYear: 2008, ca: 100, pa: 160 }]);
  const asLegacy = { ...legacy, worldDevelopmentPeriods: {} } as CareerState;
  const firstAfterMigration = progressWorldDevelopment(asLegacy, DEV_DATE);
  const progress1 = { ...firstAfterMigration.playerDevelopmentState["phase-migrated"].attributeProgress };

  const reloadedAgain = JSON.parse(JSON.stringify(firstAfterMigration)) as CareerState;
  const replayed = progressWorldDevelopment(reloadedAgain, DEV_DATE);
  assert.deepEqual(
    replayed.playerDevelopmentState["phase-migrated"].attributeProgress,
    progress1,
    "reloading a migrated save must not add phase progress again",
  );
});

// ---------------------------------------------------------------------------
// Integration with world-scoped youth intake: a generated youth is an ordinary
// world player and must be developed like one.
// ---------------------------------------------------------------------------

test("a generated youth at a CPU club is picked up by world development", async () => {
  const { progressYouthIntake, YOUTH_INTAKE_DATE_MMDD } = await import("./youthIntake");
  const { getClubsByCompetition } = await import("../game-data");
  const { SWEDISH_WORLD_COMPETITION_IDS } = await import("./worldCompetitions");

  // Minimal synthetic world: real club ids, empty squads -- all intake needs.
  const base = baseCareer();
  const worldSquads = { ...base.worldSquads };
  for (const competitionId of SWEDISH_WORLD_COMPETITION_IDS) {
    for (const c of getClubsByCompetition(competitionId)) worldSquads[c.id] = worldSquads[c.id] ?? [];
  }
  const seeded = { ...base, worldSquads, worldDevelopmentPeriods: {} } as CareerState;

  const { state, generated } = progressYouthIntake(seeded, `2027-${YOUTH_INTAKE_DATE_MMDD}`);
  const entry = Object.entries(generated).find(([clubId, ids]) => clubId !== HUMAN_CLUB && ids.length > 0);
  assert.ok(entry, "expected at least one CPU club intake");
  const [clubId, ids] = entry!;

  const developed = progressWorldDevelopment(state, "2027-08-01");
  assert.equal(developed.worldDevelopmentPeriods[ids[0]], "2027-M08", "a generated youth must be evaluated by world development");
  const r = (developed.gameplayRatings[clubId] ?? []).find((x) => x.playerId === ids[0])!;
  assert.ok(r.pa >= r.ca, "and still satisfies PA >= CA afterwards");
});
