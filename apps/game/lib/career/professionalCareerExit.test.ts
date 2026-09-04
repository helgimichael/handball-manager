// HM-PLAYER-DEVELOPMENT-2.0 PHASE 1B.3: Professional Career Exit.
//
// Measured defect this closes (Phase 1B.2, 20 simulated seasons): 1217 players
// entered free agency, only 87 (7.1%) were ever signed again, 692 were still
// unemployed at season 20 -- 361 of them for 6+ seasons, and 276 aged UNDER 28.
// RETIREMENT_MIN_EVAL_AGE is 28, so those 276 were never evaluated for any exit
// at all: a failed 20-year-old prospect was structurally immortal in the active
// population. Clubs were not rejecting them on cost (a free agent's fee is
// already 0) -- every competition had saturated its squad-size logic.
//
// Career exit is deliberately DISTINCT from retirement: same terminal storage,
// different reason, different roll namespace, and reported separately so no
// surface can claim a 22-year-old "avslutade karriären" because nobody signed him.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeProfessionalCareerExitProbability,
  professionalCareerExitRoll,
  professionalCareerExitSeedKey,
  PROFESSIONAL_CAREER_EXIT_CONSTANTS,
} from "./professionalCareerExit";
import { progressPlayerLifecycle, retirementSeedKey, RETIRED_CLUB_ID, isPlayerRetired, LIFECYCLE_EVALUATION_DATE_MMDD } from "./playerLifecycle";
import { FREE_AGENT_CLUB_ID } from "./contractExpiry";
import { buildPlayerCareerExitEvent } from "./careerEvents";
import { createNewCareerState } from "./newCareer";
import type { CareerState } from "./types";
import type { PlayerMock } from "../game-data";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import { OUTCOURT_ATTRIBUTES } from "../rating/types";

const HUMAN_CLUB = "se_club_hammarby_if_hf";
const CPU_CLUB = "se_club_ifk_kristianstad";
const EVAL_DATE = `2035-${LIFECYCLE_EVALUATION_DATE_MMDD}`;

function player(id: string, birthYear: number, clubId: string): PlayerMock {
  return { id, firstName: "Test", lastName: id, position: "M9", clubId, dateOfBirth: `${birthYear}-04-01`, birthYear } as unknown as PlayerMock;
}

function rating(playerId: string, ca: number, pa: number): GameplayPlayerRating {
  const attributes: Record<string, { value: number; origin: string }> = {};
  for (const a of OUTCOURT_ATTRIBUTES) attributes[a] = { value: 10, origin: "GENERATED_PRIOR" };
  return { playerId, ca, pa, branch: { branch: "OUTCOURT", attributes } } as unknown as GameplayPlayerRating;
}

interface Spec { id: string; birthYear: number; ca: number; pa: number; unattachedSince: string; clubId?: string }

let cachedBase: CareerState | undefined;
function baseCareer(): CareerState {
  if (!cachedBase) cachedBase = createNewCareerState("phase1b3", HUMAN_CLUB);
  return cachedBase;
}

/** `unattachedSince` becomes contractEndDate -- the canonical "became unattached on" signal. */
function stateWith(specs: Spec[]): CareerState {
  const base = baseCareer();
  const worldSquads = { ...base.worldSquads };
  const gameplayRatings = { ...base.gameplayRatings };
  const playerContracts = { ...base.playerContracts };
  for (const s of specs) {
    const clubId = s.clubId ?? FREE_AGENT_CLUB_ID;
    worldSquads[clubId] = [...(worldSquads[clubId] ?? []).filter((p) => p.id !== s.id), player(s.id, s.birthYear, clubId)];
    gameplayRatings[clubId] = [...(gameplayRatings[clubId] ?? []).filter((r) => r.playerId !== s.id), rating(s.id, s.ca, s.pa)];
    playerContracts[s.id] = { playerId: s.id, clubId, contractEndDate: s.unattachedSince, wageEurPerMonth: 0 };
  }
  return { ...base, gameDate: EVAL_DATE, processedThroughDate: EVAL_DATE, worldSquads, gameplayRatings, playerContracts, playerLifecycleYears: {} } as CareerState;
}

// ---------------------------------------------------------------------------
// The probability model
// ---------------------------------------------------------------------------

test("a newly unemployed young player has essentially no career-exit risk", () => {
  const p = computeProfessionalCareerExitProbability({ yearsUnattached: 0.3, age: 22, ca: 95, headroom: 25 });
  assert.ok(p < 0.02, `a few months unemployed must be near-zero risk, got ${(p * 100).toFixed(1)}%`);
  assert.equal(computeProfessionalCareerExitProbability({ yearsUnattached: 0, age: 22, ca: 95, headroom: 25 }), 0);
});

test("risk becomes material after several seasons unemployed", () => {
  const one = computeProfessionalCareerExitProbability({ yearsUnattached: 1, age: 24, ca: 85, headroom: 10 });
  const three = computeProfessionalCareerExitProbability({ yearsUnattached: 3, age: 24, ca: 85, headroom: 10 });
  const six = computeProfessionalCareerExitProbability({ yearsUnattached: 6, age: 24, ca: 85, headroom: 10 });
  assert.ok(one < three && three < six, `risk must rise with unemployment (${one}, ${three}, ${six})`);
  assert.ok(three > 0.15, `three seasons unemployed should be material, got ${(three * 100).toFixed(1)}%`);
  assert.ok(six > 0.4, `six seasons unemployed should be likely, got ${(six * 100).toFixed(1)}%`);
});

test("a stronger free agent gets more runway than a weak one", () => {
  const weak = computeProfessionalCareerExitProbability({ yearsUnattached: 3, age: 24, ca: 75, headroom: 3 });
  const strong = computeProfessionalCareerExitProbability({ yearsUnattached: 3, age: 24, ca: 120, headroom: 3 });
  assert.ok(strong < weak, `CA 120 must persist longer than CA 75 (${strong} vs ${weak})`);
});

test("a high-headroom young free agent gets more runway than a stalled one", () => {
  const stalled = computeProfessionalCareerExitProbability({ yearsUnattached: 3, age: 21, ca: 85, headroom: 0 });
  const upside = computeProfessionalCareerExitProbability({ yearsUnattached: 3, age: 21, ca: 85, headroom: 45 });
  assert.ok(upside < stalled, `remaining upside must buy runway (${upside} vs ${stalled})`);
});

test("age modifies but never gates -- an under-28 player is fully eligible", () => {
  const young = computeProfessionalCareerExitProbability({ yearsUnattached: 5, age: 21, ca: 75, headroom: 2 });
  const older = computeProfessionalCareerExitProbability({ yearsUnattached: 5, age: 33, ca: 75, headroom: 2 });
  assert.ok(young > 0.2, `a long-unemployed 21-year-old must be genuinely at risk, got ${(young * 100).toFixed(1)}%`);
  assert.ok(older > young, "age still modifies the outcome");
});

test("exit is never certain", () => {
  const extreme = computeProfessionalCareerExitProbability({ yearsUnattached: 30, age: 39, ca: 40, headroom: 0 });
  assert.ok(extreme <= PROFESSIONAL_CAREER_EXIT_CONSTANTS.MAX_EXIT_PROBABILITY, "a comeback must always remain possible in principle");
  assert.ok(extreme < 1);
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

test("the roll is deterministic and has its own seed namespace", () => {
  assert.equal(professionalCareerExitRoll("p1", "2035"), professionalCareerExitRoll("p1", "2035"));
  assert.notEqual(professionalCareerExitSeedKey("p1", "2035"), retirementSeedKey("p1", "2035"));
  assert.notEqual(professionalCareerExitRoll("p1", "2035"), professionalCareerExitRoll("p1", "2036"));
});

// ---------------------------------------------------------------------------
// Lifecycle integration
// ---------------------------------------------------------------------------

test("a long-unemployed UNDER-28 free agent can leave professional handball", () => {
  // 24 years old, unattached since 2029 (6 years), weak and stalled.
  const state = stateWith([{ id: "fa-longterm", birthYear: 2011, ca: 70, pa: 72, unattachedSince: "2029-06-01" }]);
  const result = progressPlayerLifecycle(state, EVAL_DATE);
  assert.ok(result.careerExitPlayerIds.includes("fa-longterm"), "the under-28 dead zone must no longer protect a long-term unemployed player");
  assert.ok(isPlayerRetired(result.state, "fa-longterm"), "and the exit is terminal");
  assert.equal(result.retiredPlayerIds.includes("fa-longterm"), false, "it must NOT be reported as a normal retirement");
});

test("a contracted under-28 player is never touched by career exit", () => {
  const state = stateWith([{ id: "contracted-young", birthYear: 2011, ca: 70, pa: 72, unattachedSince: "2029-06-01", clubId: CPU_CLUB }]);
  const result = progressPlayerLifecycle(state, EVAL_DATE);
  assert.deepEqual(result.careerExitPlayerIds, [], "career exit applies only to free agents");
  assert.equal(isPlayerRetired(result.state, "contracted-young"), false);
});

test("a newly unemployed player is not swept out immediately", () => {
  const state = stateWith([{ id: "fa-fresh", birthYear: 2013, ca: 95, pa: 140, unattachedSince: "2035-04-01" }]);
  const result = progressPlayerLifecycle(state, EVAL_DATE);
  assert.deepEqual(result.careerExitPlayerIds, [], "a few months without a club must not end a career");
});

test("career exit and normal retirement never both fire for the same player in a period", () => {
  // 36 years old AND long unemployed: eligible for both paths.
  const state = stateWith([{ id: "fa-old", birthYear: 1999, ca: 70, pa: 70, unattachedSince: "2028-06-01" }]);
  const result = progressPlayerLifecycle(state, EVAL_DATE);
  const inBoth = result.careerExitPlayerIds.filter((id) => result.retiredPlayerIds.includes(id));
  assert.deepEqual(inBoth, [], "a player must have exactly one ending");
  assert.ok(result.careerExitPlayerIds.includes("fa-old") || result.retiredPlayerIds.includes("fa-old"), "but one of them should apply");
});

test("the same seed and state produce the same outcome, and re-evaluating the period is idempotent", () => {
  const specs: Spec[] = [
    { id: "d1", birthYear: 2011, ca: 70, pa: 72, unattachedSince: "2029-06-01" },
    { id: "d2", birthYear: 2013, ca: 110, pa: 140, unattachedSince: "2032-06-01" },
  ];
  const a = progressPlayerLifecycle(stateWith(specs), EVAL_DATE);
  const b = progressPlayerLifecycle(stateWith(specs), EVAL_DATE);
  assert.deepEqual(b.careerExitPlayerIds, a.careerExitPlayerIds, "identical inputs must give identical exits");

  // Re-running the same period must change nothing (playerLifecycleYears guard).
  const again = progressPlayerLifecycle(a.state, EVAL_DATE);
  assert.deepEqual(again.careerExitPlayerIds, [], "the same evaluation period must never fire twice");
});

test("a career exit is terminal -- the player leaves free agency and cannot return", () => {
  // Reuses the fixture proven to exit above, rather than assuming any given
  // seeded roll fires: the point under test is TERMINALITY, not the roll.
  const state = stateWith([{ id: "fa-longterm", birthYear: 2011, ca: 70, pa: 72, unattachedSince: "2029-06-01" }]);
  const result = progressPlayerLifecycle(state, EVAL_DATE);
  assert.ok(result.careerExitPlayerIds.includes("fa-longterm"), "precondition: this fixture exits");

  const faIds = (result.state.worldSquads[FREE_AGENT_CLUB_ID] ?? []).map((p) => p.id);
  assert.equal(faIds.includes("fa-longterm"), false, "must leave the free-agent pool");
  assert.ok((result.state.worldSquads[RETIRED_CLUB_ID] ?? []).some((p) => p.id === "fa-longterm"), "and sit at the terminal sentinel");

  // And stays gone: a later period must not resurrect or re-evaluate them.
  const later = progressPlayerLifecycle(result.state, `2036-${LIFECYCLE_EVALUATION_DATE_MMDD}`);
  assert.equal((later.state.worldSquads[FREE_AGENT_CLUB_ID] ?? []).some((p) => p.id === "fa-longterm"), false, "never returns to free agency");
  assert.equal(later.careerExitPlayerIds.includes("fa-longterm"), false, "and is never processed as an active free agent again");
});

test("normal retirement of a CONTRACTED player is unchanged by this milestone", () => {
  // A 38-year-old under contract: only the age-driven path can apply.
  const state = stateWith([{ id: "old-contracted", birthYear: 1997, ca: 120, pa: 122, unattachedSince: "2038-06-30", clubId: CPU_CLUB }]);
  const result = progressPlayerLifecycle(state, EVAL_DATE);
  assert.deepEqual(result.careerExitPlayerIds, [], "a contracted player never career-exits");
  // Whether he retires is the pre-existing model's business; this milestone must not have broken it running.
  assert.ok(Array.isArray(result.retiredPlayerIds));
});

// ---------------------------------------------------------------------------
// The event never mislabels an unemployment exit as retirement
// ---------------------------------------------------------------------------

test("the career-exit event never claims the player retired", () => {
  const event = buildPlayerCareerExitEvent("p1", "Test Spelare", 22, 4, "2035-06-15");
  assert.equal(event.type, "PLAYER_CAREER_EXIT");
  const text = `${event.subject} ${event.summary}`.toLowerCase();
  assert.ok(!text.includes("avslutar karriären"), "must not reuse the retirement phrasing");
  assert.ok(!text.includes("karriären är över"), "must not claim the career simply ended");
  assert.ok(text.includes("lämnar proffshandbollen"), "must say what actually happened");
  assert.ok(text.includes("utan klubb"), "and why");
});
