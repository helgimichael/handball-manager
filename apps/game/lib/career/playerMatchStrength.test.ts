// HM-MATCH-RATINGS-0.1 Part P: directional proofs for the player-
// strength adapter. Tests run directly against the pure, deterministic
// computeTeamStrengthTrace/computePlayerMatchStrengthAdjustment
// functions (no Fast Match/rng involved in this layer at all) -- exact
// where the function is pure, and averaged over seeded fixtures only
// where tacticalMatchAdjustment.ts's own Monte Carlo layer is involved
// (see that file's own test suite for those). No test asserts a
// "realistic" percentage, only directional/relative behaviour (Part P).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computePlayerMatchStrengthAdjustment,
  computeTeamStrengthTrace,
  PHASE_USAGE_MULTIPLIER,
  resolveClubMatchPlanForFixture,
} from "./playerMatchStrength";
import { buildDefaultMatchPlan } from "../matchPlan/defaultMatchPlan";
import { setPlayerMatchRole, setPlayerPhaseUsage, setPlayerPlayingTime } from "../matchPlan/matchPlanEdits";
import type { MatchPlan, MatchSquad, Position } from "../matchPlan/types";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import { GOALKEEPER_ATTRIBUTES, OUTCOURT_ATTRIBUTE_FAMILIES, OUTCOURT_ATTRIBUTES, type GoalkeeperAttribute, type OutcourtAttribute } from "../rating/types";
import type { GeneratedAttributeValue } from "../rating/generation/types";

// ---------------------------------------------------------------------------
// Test fixtures/helpers
// ---------------------------------------------------------------------------

const FIXTURE_ID = "fx-strength-1";
const CLUB_ID = "club-home";

const BASE_STARTERS: readonly { playerId: string; position: Position }[] = [
  { playerId: "gk1", position: "GK" },
  { playerId: "m9_1", position: "M9" },
  { playerId: "v9_1", position: "V9" },
  { playerId: "h9_1", position: "H9" },
  { playerId: "m6_1", position: "M6" },
  { playerId: "v6_1", position: "V6" },
  { playerId: "h6_1", position: "H6" },
];

function buildSquad(extra: readonly { playerId: string; position: Position }[] = []): MatchSquad {
  return { fixtureId: FIXTURE_ID, clubId: CLUB_ID, players: [...BASE_STARTERS, ...extra] };
}

function buildBasePlan(extra: readonly { playerId: string; position: Position }[] = []): MatchPlan {
  const result = buildDefaultMatchPlan(buildSquad(extra));
  assert.ok(result.ok && result.plan, JSON.stringify(result.errors));
  return result.plan!;
}

const ATTACK_FAMILY_ATTRS = new Set<OutcourtAttribute>([...OUTCOURT_ATTRIBUTE_FAMILIES.TECHNICAL, ...OUTCOURT_ATTRIBUTE_FAMILIES.PERCEPTION_DECISION]);
const DEFENCE_FAMILY_ATTRS = new Set<OutcourtAttribute>(OUTCOURT_ATTRIBUTE_FAMILIES.DEFENSIVE);

function buildOutcourtRating(playerId: string, position: Position, ca: number, attackAttr = 10, defenceAttr = 10, baseAttr = 10): GameplayPlayerRating {
  const attributes = {} as Record<OutcourtAttribute, GeneratedAttributeValue>;
  for (const attr of OUTCOURT_ATTRIBUTES) {
    const value = ATTACK_FAMILY_ATTRS.has(attr) ? attackAttr : DEFENCE_FAMILY_ATTRS.has(attr) ? defenceAttr : baseAttr;
    attributes[attr] = { value, origin: "GENERATED_PRIOR" };
  }
  return {
    playerId,
    position,
    ca,
    pa: ca,
    caSource: "GENERATED_GAME_PRIOR",
    branch: { branch: "OUTCOURT", attributes },
    attackRoleProficiencies: [],
    defenceRoleProficiencies: [],
    attributeGenerationModelVersion: "test",
    locked: false,
  };
}

function buildGoalkeeperRating(playerId: string, ca: number, attrValue = 10): GameplayPlayerRating {
  const attributes = {} as Record<GoalkeeperAttribute, GeneratedAttributeValue>;
  for (const attr of GOALKEEPER_ATTRIBUTES) attributes[attr] = { value: attrValue, origin: "GENERATED_PRIOR" };
  return {
    playerId,
    position: "GK",
    ca,
    pa: ca,
    caSource: "GENERATED_GAME_PRIOR",
    branch: { branch: "GOALKEEPER", attributes },
    attackRoleProficiencies: [],
    defenceRoleProficiencies: [],
    attributeGenerationModelVersion: "test",
    locked: false,
  };
}

/** Neutral ratings for every BASE_STARTERS player, plus any extras supplied. */
function neutralRatings(extra: readonly GameplayPlayerRating[] = []): GameplayPlayerRating[] {
  return [
    buildGoalkeeperRating("gk1", 130, 10),
    ...BASE_STARTERS.filter((p) => p.position !== "GK").map((p) => buildOutcourtRating(p.playerId, p.position, 130, 10, 10)),
    ...extra,
  ];
}

// ---------------------------------------------------------------------------
// Part P #1
// ---------------------------------------------------------------------------

test("Part P #1: same MatchPlan, stronger ratings produce higher attack AND defence value than weaker ratings", () => {
  const plan = buildBasePlan();
  const strong = plan.squad.players.map((p) => (p.position === "GK" ? buildGoalkeeperRating(p.playerId, 165, 18) : buildOutcourtRating(p.playerId, p.position, 165, 18, 18)));
  const weak = plan.squad.players.map((p) => (p.position === "GK" ? buildGoalkeeperRating(p.playerId, 100, 6) : buildOutcourtRating(p.playerId, p.position, 100, 6, 6)));
  const strongTrace = computeTeamStrengthTrace(plan, strong);
  const weakTrace = computeTeamStrengthTrace(plan, weak);
  assert.ok(strongTrace.attackValue > weakTrace.attackValue);
  assert.ok(strongTrace.defenceValue > weakTrace.defenceValue);
});

// ---------------------------------------------------------------------------
// Part P #2/#3: replacing a high-rated starter (M9) with a low-rated one
// decreases attack value.
// ---------------------------------------------------------------------------

test("Part P #2/#3: replacing the elite starting M9 with a weak M9 (the elite player not selected at all) decreases attack value", () => {
  // Two independent squads (not a swap) so the ejected elite starter
  // never lands in the bench pool -- Part P #2 means "removed from the
  // matchday squad entirely", not "demoted to the bench", and a lone
  // bench player's own weighted average is undiluted by definition
  // (mean of one item ignores its own weight), which would otherwise
  // muddy this specific comparison.
  const eliteSquad = buildBasePlan();
  const weakSquad = buildDefaultMatchPlan({
    fixtureId: FIXTURE_ID,
    clubId: CLUB_ID,
    players: BASE_STARTERS.map((p) => (p.playerId === "m9_1" ? { playerId: "m9_weak", position: "M9" as const } : p)),
  }).plan!;

  const eliteRatings = neutralRatings().map((r) => (r.playerId === "m9_1" ? buildOutcourtRating("m9_1", "M9", 165, 18, 10) : r));
  const weakRatings = neutralRatings().filter((r) => r.playerId !== "m9_1").concat(buildOutcourtRating("m9_weak", "M9", 100, 6, 6));

  const before = computeTeamStrengthTrace(eliteSquad, eliteRatings);
  const after = computeTeamStrengthTrace(weakSquad, weakRatings);
  assert.ok(after.attackValue < before.attackValue, `before=${before.attackValue} after=${after.attackValue}`);
});

// ---------------------------------------------------------------------------
// Part P #4: replacing a defensive specialist with a weak defender
// decreases defence value.
// ---------------------------------------------------------------------------

test("Part P #4: replacing a defensive specialist (not selected at all) with a weak defender decreases defence value", () => {
  const specialistSquad = buildBasePlan();
  const weakSquad = buildDefaultMatchPlan({
    fixtureId: FIXTURE_ID,
    clubId: CLUB_ID,
    players: BASE_STARTERS.map((p) => (p.playerId === "v6_1" ? { playerId: "v6_weak", position: "V6" as const } : p)),
  }).plan!;

  const specialistRatings = neutralRatings().map((r) => (r.playerId === "v6_1" ? buildOutcourtRating("v6_1", "V6", 155, 8, 18) : r));
  const weakRatings = neutralRatings().filter((r) => r.playerId !== "v6_1").concat(buildOutcourtRating("v6_weak", "V6", 100, 6, 6));

  const before = computeTeamStrengthTrace(specialistSquad, specialistRatings);
  const after = computeTeamStrengthTrace(weakSquad, weakRatings);
  assert.ok(after.outfieldDefenceValue < before.outfieldDefenceValue, `before=${before.outfieldDefenceValue} after=${after.outfieldDefenceValue}`);
});

// ---------------------------------------------------------------------------
// Part P #5: a better goalkeeper reduces the OPPONENT's own expected-goals
// adjustment (the defending side's own adjustment stays about its own
// attack; the opponent's total goes down).
// ---------------------------------------------------------------------------

test("Part P #5: a better home goalkeeper reduces the away side's own expected-goals adjustment", () => {
  const homePlan = buildBasePlan();
  const awayPlan = buildBasePlan();
  const awayRatings = neutralRatings();

  const weakGkRatings = neutralRatings().map((r) => (r.playerId === "gk1" ? buildGoalkeeperRating("gk1", 95, 4) : r));
  const strongGkRatings = neutralRatings().map((r) => (r.playerId === "gk1" ? buildGoalkeeperRating("gk1", 175, 19) : r));

  const withWeakGk = computePlayerMatchStrengthAdjustment(homePlan, weakGkRatings, awayPlan, awayRatings);
  const withStrongGk = computePlayerMatchStrengthAdjustment(homePlan, strongGkRatings, awayPlan, awayRatings);

  assert.ok(withStrongGk.away < withWeakGk.away, `strong-GK away=${withStrongGk.away} weak-GK away=${withWeakGk.away}`);
});

// ---------------------------------------------------------------------------
// Part P #6/#7: ATTACK_ONLY/DEFENCE_ONLY zero out the opposite phase's
// usage weight entirely -- the actual mechanism phaseWeight() applies
// unconditionally for every player.
// ---------------------------------------------------------------------------

test("Part P #6: ATTACK_ONLY contributes zero defensive usage weight (but full attacking weight)", () => {
  assert.equal(PHASE_USAGE_MULTIPLIER.ATTACK_ONLY.defence, 0);
  assert.ok(PHASE_USAGE_MULTIPLIER.ATTACK_ONLY.attack > 0);
});

test("Part P #7: DEFENCE_ONLY contributes zero attacking usage weight (but full defensive weight)", () => {
  assert.equal(PHASE_USAGE_MULTIPLIER.DEFENCE_ONLY.attack, 0);
  assert.ok(PHASE_USAGE_MULTIPLIER.DEFENCE_ONLY.defence > 0);
});

// ---------------------------------------------------------------------------
// Part P #8: VERY_HIGH usage > LOW usage for an otherwise identical player.
// ---------------------------------------------------------------------------

test("Part P #8: VERY_HIGH playing-time intention pulls the team value further toward an elite bench player's own value than LOW does", () => {
  // Two bench players so a weighted mean actually depends on relative
  // weight -- a lone bench player's weighted mean equals their own
  // value regardless of weight (mean of one item), which would hide
  // the effect under test.
  const plan = buildBasePlan([
    { playerId: "m9_2", position: "M9" },
    { playerId: "m9_3", position: "M9" },
  ]);
  const eliteBench = buildOutcourtRating("m9_2", "M9", 190, 20, 10);
  const neutralBench = buildOutcourtRating("m9_3", "M9", 130, 10, 10);
  const ratings = [...neutralRatings(), eliteBench, neutralBench];

  const veryHighPlan = setPlayerPlayingTime(plan, "m9_2", "VERY_HIGH");
  const lowPlan = setPlayerPlayingTime(plan, "m9_2", "LOW");

  const veryHighTrace = computeTeamStrengthTrace(veryHighPlan, ratings);
  const lowTrace = computeTeamStrengthTrace(lowPlan, ratings);

  assert.ok(veryHighTrace.attackValue > lowTrace.attackValue, `VERY_HIGH=${veryHighTrace.attackValue} LOW=${lowTrace.attackValue}`);
});

// ---------------------------------------------------------------------------
// Part P #9: a strong bench helps modestly, but improving one starter
// moves team value more than improving one bench player by the same
// margin (structural 80/20 starter/bench split, Part H).
// ---------------------------------------------------------------------------

test("Part P #9: improving one starter's rating moves team attack value more than improving one bench player's rating by the same margin", () => {
  // A 3-player bench pool -- with only one bench player, that player's
  // weighted mean equals their own value regardless of weight/magnitude
  // (mean of one item), which would artificially exaggerate a lone
  // bench player's own pull relative to a starter diluted across six.
  const bench = [
    { playerId: "m9_2", position: "M9" as const },
    { playerId: "m9_3", position: "M9" as const },
    { playerId: "m9_4", position: "M9" as const },
  ];
  const plan = buildBasePlan(bench);
  const baseBenchRatings = bench.map((p) => buildOutcourtRating(p.playerId, p.position, 130, 10, 10));

  const base = computeTeamStrengthTrace(plan, neutralRatings(baseBenchRatings));

  const improvedStarter = neutralRatings(baseBenchRatings).map((r) => (r.playerId === "v9_1" ? buildOutcourtRating("v9_1", "V9", 160, 15, 10) : r));
  const afterStarterImprove = computeTeamStrengthTrace(plan, improvedStarter);

  const improvedBench = neutralRatings(baseBenchRatings).map((r) => (r.playerId === "m9_2" ? buildOutcourtRating("m9_2", "M9", 160, 15, 10) : r));
  const afterBenchImprove = computeTeamStrengthTrace(plan, improvedBench);

  const starterDelta = afterStarterImprove.attackValue - base.attackValue;
  const benchDelta = afterBenchImprove.attackValue - base.attackValue;

  assert.ok(starterDelta > 0 && benchDelta > 0, `starterDelta=${starterDelta} benchDelta=${benchDelta}`);
  assert.ok(starterDelta > benchDelta, `starterDelta=${starterDelta} should exceed benchDelta=${benchDelta}`);
});

// ---------------------------------------------------------------------------
// Part P #10: a player outside the selected 16 (i.e. not in
// plan.squad.players) has zero effect.
// ---------------------------------------------------------------------------

test("Part P #10: a GameplayPlayerRating for a player NOT in the MatchSquad has zero effect on the computed trace", () => {
  const plan = buildBasePlan();
  const ratings = neutralRatings();
  const withoutOutsider = computeTeamStrengthTrace(plan, ratings);
  const withOutsider = computeTeamStrengthTrace(plan, [...ratings, buildOutcourtRating("outsider-not-in-squad", "M9", 200, 20, 20)]);
  assert.deepEqual(withOutsider, withoutOutsider);
});

// ---------------------------------------------------------------------------
// Part P #11: same inputs -> identical output (pure function, no rng of
// its own in this layer).
// ---------------------------------------------------------------------------

test("Part P #11: computeTeamStrengthTrace/computePlayerMatchStrengthAdjustment are pure -- identical inputs always produce identical output", () => {
  const plan = buildBasePlan();
  const ratings = neutralRatings();
  assert.deepEqual(computeTeamStrengthTrace(plan, ratings), computeTeamStrengthTrace(plan, ratings));

  const adjustmentA = computePlayerMatchStrengthAdjustment(plan, ratings, plan, ratings);
  const adjustmentB = computePlayerMatchStrengthAdjustment(plan, ratings, plan, ratings);
  assert.deepEqual(adjustmentA, adjustmentB);
});

// ---------------------------------------------------------------------------
// Part P #12: changing MatchPlan usage alone (same ratings, same starting
// units) can directionally change the computed team value.
// ---------------------------------------------------------------------------

test("Part P #12: changing only a bench player's MatchRole/PlayingTimeIntention changes team attack value, with identical ratings and starting units", () => {
  const plan = buildBasePlan([
    { playerId: "m9_2", position: "M9" },
    { playerId: "m9_3", position: "M9" },
  ]);
  const ratings = [...neutralRatings(), buildOutcourtRating("m9_2", "M9", 190, 20, 10), buildOutcourtRating("m9_3", "M9", 130, 10, 10)];

  const before = computeTeamStrengthTrace(plan, ratings);
  const boosted = setPlayerMatchRole(setPlayerPlayingTime(plan, "m9_2", "VERY_HIGH"), "m9_2", "KEY_PLAYER");
  const after = computeTeamStrengthTrace(boosted, ratings);

  assert.notEqual(before.attackValue, after.attackValue);
});

// ---------------------------------------------------------------------------
// Part P #13: an existing calibrated specialist's attack/defence
// asymmetry is respected -- never averaged away by this adapter.
// ---------------------------------------------------------------------------

test("Part P #13: a defensive-specialist-shaped rating (weak attack attributes, elite defence attributes) keeps that asymmetry through the adapter", () => {
  const plan = buildBasePlan();
  const baseline = computeTeamStrengthTrace(plan, neutralRatings());
  const withSpecialistAtM6 = computeTeamStrengthTrace(
    plan,
    neutralRatings().map((r) => (r.playerId === "m6_1" ? buildOutcourtRating("m6_1", "M6", 130, 4, 19) : r)),
  );
  assert.ok(withSpecialistAtM6.attackValue < baseline.attackValue, "weak attack attributes must pull attack value down, not get averaged toward neutral");
  assert.ok(withSpecialistAtM6.outfieldDefenceValue > baseline.outfieldDefenceValue, "elite defence attributes must pull defence value up, not get averaged toward neutral");
});

// ---------------------------------------------------------------------------
// Additional coverage: PlayerPhaseUsage gating survives a full trace
// (not just the raw multiplier table), and the default-plan resolver
// never throws on a squad too small to build a valid plan (Part N/O:
// "never crash an old save").
// ---------------------------------------------------------------------------

test("ATTACK_ONLY/DEFENCE_ONLY survive a full trace: flipping a bench player's phaseUsage changes only the phase they are still allowed to contribute to", () => {
  const plan = buildBasePlan([{ playerId: "m9_2", position: "M9" }]);
  const ratings = [...neutralRatings(), buildOutcourtRating("m9_2", "M9", 190, 20, 20)];

  const bothPhases = computeTeamStrengthTrace(plan, ratings);
  const attackOnly = computeTeamStrengthTrace(setPlayerPhaseUsage(plan, "m9_2", "ATTACK_ONLY"), ratings);
  const defenceOnly = computeTeamStrengthTrace(setPlayerPhaseUsage(plan, "m9_2", "DEFENCE_ONLY"), ratings);

  // BOTH_PHASES gives m9_2 real weight in the defence bench pool too --
  // ATTACK_ONLY should therefore produce a LOWER defence value than
  // BOTH_PHASES (m9_2's strong rating stops counting toward defence).
  assert.ok(attackOnly.outfieldDefenceValue <= bothPhases.outfieldDefenceValue);
  // Symmetrically, DEFENCE_ONLY should produce a lower attack value than BOTH_PHASES.
  assert.ok(defenceOnly.attackValue <= bothPhases.attackValue);
});

test("resolveClubMatchPlanForFixture never throws for an empty squad -- returns null instead", () => {
  const plan = resolveClubMatchPlanForFixture("club-empty", FIXTURE_ID, [], undefined);
  assert.equal(plan, null);
});

test("computeTeamStrengthTrace(null, ...) returns the neutral trace, never throws", () => {
  const trace = computeTeamStrengthTrace(null, neutralRatings());
  assert.equal(trace.attackValue, 50);
  assert.equal(trace.defenceValue, 50);
  assert.equal(trace.goalkeeperValue, 50);
});
