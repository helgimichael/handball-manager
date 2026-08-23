// HM-TACTICS-1.3: directional proofs for the MatchPlan tactical-effects
// adapter. All tests run against the pure, deterministic
// computeTeamTacticalPlanTrace/computeTacticalMatchPlanAdjustment
// functions -- no Fast Match/rng involved in this layer at all. No
// test asserts a "realistic" percentage, only directional/relative
// behaviour, per the milestone's own instruction.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTacticalMatchPlanAdjustment, computeTeamTacticalPlanTrace } from "./tacticalPlanEffects";
import { computeTeamUsageTrace } from "./matchUsageEngine";
import { buildDefaultMatchPlan } from "../matchPlan/defaultMatchPlan";
import { updateAttackPlan, updateDefencePlan, updateTransitionPlan, setSubstitutionPair } from "../matchPlan/matchPlanEdits";
import type { MatchPlan, MatchSquad, Position } from "../matchPlan/types";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import { GOALKEEPER_ATTRIBUTES, OUTCOURT_ATTRIBUTES, type GoalkeeperAttribute, type OutcourtAttribute } from "../rating/types";
import type { GeneratedAttributeValue } from "../rating/generation/types";

const FIXTURE_ID = "fx-tactical-plan";
const CLUB_ID = "club-home";
const AWAY_CLUB_ID = "club-away";

const BASE_STARTERS: readonly { playerId: string; position: Position }[] = [
  { playerId: "gk1", position: "GK" },
  { playerId: "m9_1", position: "M9" },
  { playerId: "v9_1", position: "V9" },
  { playerId: "h9_1", position: "H9" },
  { playerId: "m6_1", position: "M6" },
  { playerId: "v6_1", position: "V6" },
  { playerId: "h6_1", position: "H6" },
];

function buildSquad(clubId: string, extra: readonly { playerId: string; position: Position }[] = []): MatchSquad {
  return { fixtureId: FIXTURE_ID, clubId, players: [...BASE_STARTERS.map((p) => ({ playerId: `${clubId}-${p.playerId}`, position: p.position })), ...extra] };
}

function buildBasePlan(clubId: string = CLUB_ID, extra: readonly { playerId: string; position: Position }[] = []): MatchPlan {
  const result = buildDefaultMatchPlan(buildSquad(clubId, extra));
  assert.ok(result.ok && result.plan, JSON.stringify(result.errors));
  return result.plan!;
}

function buildOutcourtRating(playerId: string, position: Position, ca: number, attrValue: number): GameplayPlayerRating {
  const attributes = {} as Record<OutcourtAttribute, GeneratedAttributeValue>;
  for (const attr of OUTCOURT_ATTRIBUTES) attributes[attr] = { value: attrValue, origin: "GENERATED_PRIOR" };
  return { playerId, position, ca, pa: ca, caSource: "GENERATED_GAME_PRIOR", branch: { branch: "OUTCOURT", attributes }, attackRoleProficiencies: [], defenceRoleProficiencies: [], attributeGenerationModelVersion: "test", locked: false };
}

function buildGoalkeeperRating(playerId: string, ca: number, attrValue: number): GameplayPlayerRating {
  const attributes = {} as Record<GoalkeeperAttribute, GeneratedAttributeValue>;
  for (const attr of GOALKEEPER_ATTRIBUTES) attributes[attr] = { value: attrValue, origin: "GENERATED_PRIOR" };
  return { playerId, position: "GK", ca, pa: ca, caSource: "GENERATED_GAME_PRIOR", branch: { branch: "GOALKEEPER", attributes }, attackRoleProficiencies: [], defenceRoleProficiencies: [], attributeGenerationModelVersion: "test", locked: false };
}

/** Ratings for every BASE_STARTERS player of one club, all with the same attrValue -- a "uniformly strong" or "uniformly weak" squad. */
function uniformRatings(clubId: string, ca: number, attrValue: number): GameplayPlayerRating[] {
  return BASE_STARTERS.map((p) => (p.position === "GK" ? buildGoalkeeperRating(`${clubId}-${p.playerId}`, ca, attrValue) : buildOutcourtRating(`${clubId}-${p.playerId}`, p.position, ca, attrValue)));
}

function trace(plan: MatchPlan, ratings: readonly GameplayPlayerRating[], seed: string, opponentPlan: MatchPlan | null = null) {
  const usage = computeTeamUsageTrace(plan, seed);
  return computeTeamTacticalPlanTrace(plan, ratings, usage, opponentPlan);
}

// ---------------------------------------------------------------------------
// #1: same lineup, different supported tactics -> different adjustment
// ---------------------------------------------------------------------------

test("#1: same lineup + ratings, different supported attack tactics change the resulting trace", () => {
  const plan = buildBasePlan();
  const ratings = uniformRatings(CLUB_ID, 140, 14);
  const balanced = trace(plan, ratings, "t1-balanced");
  const fastTempo = trace(updateAttackPlan(plan, { tempo: "FAST" }), ratings, "t1-fast");
  assert.notEqual(balanced.attackBonus, fastTempo.attackBonus);
});

// ---------------------------------------------------------------------------
// #2/#3: same tactic, better tactical-fit players perform better
// ---------------------------------------------------------------------------

test("#2: the same FAST tempo tactic produces a higher attack bonus for a strong-fit squad than a weak-fit one", () => {
  const plan = updateAttackPlan(buildBasePlan(), { tempo: "FAST" });
  const strong = trace(plan, uniformRatings(CLUB_ID, 140, 18), "t2-strong");
  const weak = trace(plan, uniformRatings(CLUB_ID, 140, 4), "t2-weak");
  assert.ok(strong.attackBonus > weak.attackBonus, `strong=${strong.attackBonus} weak=${weak.attackBonus}`);
});

test("#3: HIGH pivotUsage (M6 focus) benefits more from a strong M6 player than a weak one, holding everyone else fixed", () => {
  const plan = updateAttackPlan(buildBasePlan(), { pivotUsage: "HIGH" });
  const baseRatings = uniformRatings(CLUB_ID, 140, 10);
  const strongM6 = baseRatings.map((r) => (r.playerId === `${CLUB_ID}-m6_1` ? buildOutcourtRating(r.playerId, "M6", 140, 19) : r));
  const weakM6 = baseRatings.map((r) => (r.playerId === `${CLUB_ID}-m6_1` ? buildOutcourtRating(r.playerId, "M6", 140, 3) : r));
  const strong = trace(plan, strongM6, "t3-strong");
  const weak = trace(plan, weakM6, "t3-weak");
  assert.ok(strong.attackBonus > weak.attackBonus, `strong=${strong.attackBonus} weak=${weak.attackBonus}`);
});

// ---------------------------------------------------------------------------
// #4: aggressive defence produces both upside and bounded downside
// ---------------------------------------------------------------------------

test("#4: HIGH contactIntent produces a real trade-off -- a positive contribution to defenceBonus (upside) and a real, non-zero downside component", () => {
  const plan = updateDefencePlan(buildBasePlan(), { contactIntent: "HIGH" });
  const usage = computeTeamUsageTrace(plan, "t4");
  const result = computeTeamTacticalPlanTrace(plan, uniformRatings(CLUB_ID, 140, 14), usage, null);
  const contactContribution = result.contributions.find((c) => c.dimension === "contactIntent:HIGH")!;
  assert.ok(contactContribution.active);
  assert.ok(contactContribution.upside > 0, "aggressive contact should carry a positive upside component");
  assert.ok(contactContribution.downside > 0, "aggressive contact should carry a real, non-zero downside component");
});

// ---------------------------------------------------------------------------
// #5: high tempo produces a meaningful trade-off
// ---------------------------------------------------------------------------

test("#5: FAST tempo carries both an upside and a downside component", () => {
  const plan = updateAttackPlan(buildBasePlan(), { tempo: "FAST" });
  const usage = computeTeamUsageTrace(plan, "t5");
  const result = computeTeamTacticalPlanTrace(plan, uniformRatings(CLUB_ID, 140, 14), usage, null);
  const tempoContribution = result.contributions.find((c) => c.dimension === "tempo:FAST")!;
  assert.ok(tempoContribution.upside > 0);
  assert.ok(tempoContribution.downside > 0);
});

// ---------------------------------------------------------------------------
// #6: substitutionPriority interacts with transition intent
// ---------------------------------------------------------------------------

test("#6: with a real specialist pair in play, prioritizing specialist substitutions dampens the fastTransition upside compared with BALANCED priority", () => {
  const planWithPair = setSubstitutionPair(buildBasePlan(CLUB_ID, [{ playerId: "extra9", position: "M9" }, { playerId: "extra6", position: "M6" }]), `${CLUB_ID}-extra9`, `${CLUB_ID}-extra6`);
  const fastPlan = updateTransitionPlan(planWithPair, { firstWaveAggression: "HIGH" });
  const ratings = uniformRatings(CLUB_ID, 140, 14).concat(buildOutcourtRating(`${CLUB_ID}-extra9`, "M9", 140, 14), buildOutcourtRating(`${CLUB_ID}-extra6`, "M6", 140, 14));

  const balanced = updateTransitionPlan(fastPlan, { substitutionPriority: "BALANCED" });
  const attackFirst = updateTransitionPlan(fastPlan, { substitutionPriority: "ATTACK_FIRST" });

  const balancedResult = computeTeamTacticalPlanTrace(balanced, ratings, computeTeamUsageTrace(balanced, "t6-balanced"), null);
  const attackFirstResult = computeTeamTacticalPlanTrace(attackFirst, ratings, computeTeamUsageTrace(attackFirst, "t6-attackfirst"), null);

  const balancedFastTransition = balancedResult.contributions.find((c) => c.dimension === "fastTransition")!;
  const attackFirstFastTransition = attackFirstResult.contributions.find((c) => c.dimension === "fastTransition")!;
  assert.ok(attackFirstFastTransition.upside < balancedFastTransition.upside, `attackFirst=${attackFirstFastTransition.upside} balanced=${balancedFastTransition.upside}`);

  // The trade-off's other half: prioritizing specialists grants its own small reliability bonus.
  const priorityContribution = attackFirstResult.contributions.find((c) => c.dimension === "substitutionPriority:ATTACK_FIRST")!;
  assert.ok(priorityContribution.active && priorityContribution.upside > 0);
});

// ---------------------------------------------------------------------------
// #7: 7v6 keeps its EXISTING behavior -- this adapter must not duplicate it
// ---------------------------------------------------------------------------

test("#7: this adapter never produces a contribution for sevenVSixPolicy -- that effect stays isolated to tacticalMatchAdjustment.ts (HM-MATCH-RATINGS-0.1 Part K), never duplicated here", () => {
  const plan = buildBasePlan();
  const usage = computeTeamUsageTrace(plan, "t7");
  const result = computeTeamTacticalPlanTrace(plan, uniformRatings(CLUB_ID, 140, 14), usage, null);
  assert.ok(!result.contributions.some((c) => c.dimension.includes("sevenVSix")));
});

// ---------------------------------------------------------------------------
// #8: formation choice is no longer inert
// ---------------------------------------------------------------------------

test("#8: switching baseFormation changes the resulting defenceBonus, since each formation rewards a different attribute family", () => {
  const plan = buildBasePlan();
  // 6-0's own fit attributes (DEFENSIVE_POSITIONING/CENTRAL_DEFENCE/
  // COVERING) are elite here; 5-1's (BALL_WINNING/CONTACT_ABILITY/
  // LATERAL_DEFENCE) are weak -- a squad genuinely suited to one
  // formation and not the other, so the two formations must produce a
  // different defenceBonus, not merely different labels.
  const attributes = {} as Record<OutcourtAttribute, GeneratedAttributeValue>;
  for (const attr of OUTCOURT_ATTRIBUTES) attributes[attr] = { value: 10, origin: "GENERATED_PRIOR" as const };
  for (const attr of ["DEFENSIVE_POSITIONING", "CENTRAL_DEFENCE", "COVERING"] as const) attributes[attr] = { value: 19, origin: "GENERATED_PRIOR" };
  for (const attr of ["BALL_WINNING", "CONTACT_ABILITY", "LATERAL_DEFENCE"] as const) attributes[attr] = { value: 2, origin: "GENERATED_PRIOR" };
  const ratings: GameplayPlayerRating[] = BASE_STARTERS.map((p) =>
    p.position === "GK"
      ? buildGoalkeeperRating(`${CLUB_ID}-${p.playerId}`, 140, 14)
      : { playerId: `${CLUB_ID}-${p.playerId}`, position: p.position, ca: 140, pa: 140, caSource: "GENERATED_GAME_PRIOR", branch: { branch: "OUTCOURT", attributes }, attackRoleProficiencies: [], defenceRoleProficiencies: [], attributeGenerationModelVersion: "test", locked: false },
  );
  const sixZero = trace(updateDefencePlan(plan, { baseFormation: "6-0" }), ratings, "t8");
  const fiveOne = trace(updateDefencePlan(plan, { baseFormation: "5-1" }), ratings, "t8");
  assert.notEqual(sixZero.defenceBonus, fiveOne.defenceBonus);
  assert.ok(sixZero.defenceBonus > fiveOne.defenceBonus, "a squad suited to 6-0's own fit attributes should score higher under 6-0 than 5-1");
});

test("#8b: formation choice interacts with the opponent's own attack tempo (the one supported matchup dimension)", () => {
  const plan = updateDefencePlan(buildBasePlan(), { baseFormation: "5-1" });
  const ratings = uniformRatings(CLUB_ID, 140, 14);
  const usage = computeTeamUsageTrace(plan, "t8b");
  const neutralOpponent = buildBasePlan(AWAY_CLUB_ID);
  const fastOpponent = updateAttackPlan(buildBasePlan(AWAY_CLUB_ID), { tempo: "FAST" });
  const withNeutral = computeTeamTacticalPlanTrace(plan, ratings, usage, neutralOpponent);
  const withFastOpponent = computeTeamTacticalPlanTrace(plan, ratings, usage, fastOpponent);
  assert.notEqual(withNeutral.defenceBonus, withFastOpponent.defenceBonus);
});

// ---------------------------------------------------------------------------
// #9: effects remain bounded
// ---------------------------------------------------------------------------

test("#9: attackBonus/defenceBonus stay within their documented bound even with every dimension pushed to its most extreme, best-fit setting", () => {
  const plan = updateTransitionPlan(
    updateDefencePlan(
      updateAttackPlan(buildBasePlan(), {
        tempo: "FAST",
        structureFreedom: "FREE",
        pivotUsage: "HIGH",
        twoVTwoEmphasis: "HIGH",
        breakthroughEmphasis: "HIGH",
        shootingEmphasis: "HIGH",
        wingUsage: "HIGH",
        ballCirculation: "DIRECT",
      }),
      { baseFormation: "5-1", defensiveDepth: "HIGH", contactIntent: "HIGH", coverBlockingEmphasis: "HIGH", ballOrientedPressure: "HIGH", riskLevel: "HIGH" },
    ),
    { offensiveTransitionIntent: "HIGH", firstWaveAggression: "HIGH", goalkeeperInitiation: "HIGH", defensiveRetreatIntent: "HIGH" },
  );
  const ratings = uniformRatings(CLUB_ID, 168, 20); // maximal CA and attributes
  const result = trace(plan, ratings, "t9");
  assert.ok(Math.abs(result.attackBonus) <= 1.0, `attackBonus=${result.attackBonus}`);
  assert.ok(Math.abs(result.defenceBonus) <= 1.0, `defenceBonus=${result.defenceBonus}`);

  const adjustment = computeTacticalMatchPlanAdjustment(plan, ratings, computeTeamUsageTrace(plan, "t9"), buildBasePlan(AWAY_CLUB_ID), uniformRatings(AWAY_CLUB_ID, 140, 10), computeTeamUsageTrace(buildBasePlan(AWAY_CLUB_ID), "t9-away"));
  assert.ok(Math.abs(adjustment.home) <= 2.0, `home=${adjustment.home}`);
  assert.ok(Math.abs(adjustment.away) <= 2.0, `away=${adjustment.away}`);
});

// ---------------------------------------------------------------------------
// #10: determinism
// ---------------------------------------------------------------------------

test("#10: same seed + same MatchPlan = identical tactical-plan trace", () => {
  const plan = updateAttackPlan(buildBasePlan(), { tempo: "FAST" });
  const ratings = uniformRatings(CLUB_ID, 140, 14);
  const usage = computeTeamUsageTrace(plan, "same-seed");
  const a = computeTeamTacticalPlanTrace(plan, ratings, usage, null);
  const b = computeTeamTacticalPlanTrace(plan, ratings, usage, null);
  assert.deepEqual(a, b);

  const awayPlan = buildBasePlan(AWAY_CLUB_ID);
  const awayRatings = uniformRatings(AWAY_CLUB_ID, 140, 10);
  const awayUsage = computeTeamUsageTrace(awayPlan, "same-seed-away");
  const adjA = computeTacticalMatchPlanAdjustment(plan, ratings, usage, awayPlan, awayRatings, awayUsage);
  const adjB = computeTacticalMatchPlanAdjustment(plan, ratings, usage, awayPlan, awayRatings, awayUsage);
  assert.deepEqual(adjA, adjB);
});

// ---------------------------------------------------------------------------
// #11: CA alone never gets double-counted as tactical fit
// ---------------------------------------------------------------------------

test("#11: changing ONLY a player's CA (attributes held fixed) never changes the tactical-fit score or the resulting bonus", () => {
  const plan = updateAttackPlan(buildBasePlan(), { tempo: "FAST" });
  const usage = computeTeamUsageTrace(plan, "t11");
  const lowCa = uniformRatings(CLUB_ID, 100, 14);
  const highCa = uniformRatings(CLUB_ID, 168, 14); // same attribute value, only CA differs
  const lowResult = computeTeamTacticalPlanTrace(plan, lowCa, usage, null);
  const highResult = computeTeamTacticalPlanTrace(plan, highCa, usage, null);
  assert.deepEqual(lowResult, highResult, "tactical fit must depend only on attributes, never on CA");
});

// ---------------------------------------------------------------------------
// #12/#13: manager fixture and AI-vs-AI remain deterministic
// (matchdayAction.test.ts/calendar.test.ts already assert full-pipeline
// determinism end to end; this proves the new adapter itself is pure,
// the property those integration tests now transitively depend on.)
// ---------------------------------------------------------------------------

test("#12/#13: computeTacticalMatchPlanAdjustment is a pure function -- no hidden mutable state across repeated calls with different inputs in between", () => {
  const planA = buildBasePlan();
  const planB = updateAttackPlan(buildBasePlan(), { tempo: "FAST" });
  const ratings = uniformRatings(CLUB_ID, 140, 14);
  const usageA = computeTeamUsageTrace(planA, "seed-a");
  const usageB = computeTeamUsageTrace(planB, "seed-b");

  const first = computeTacticalMatchPlanAdjustment(planA, ratings, usageA, null, [], null);
  computeTacticalMatchPlanAdjustment(planB, ratings, usageB, null, [], null); // an unrelated call in between must not leak state
  const second = computeTacticalMatchPlanAdjustment(planA, ratings, usageA, null, [], null);
  assert.deepEqual(first, second);
});

// ---------------------------------------------------------------------------
// Null-plan / neutral-trace safety -- never throws.
// ---------------------------------------------------------------------------

test("computeTeamTacticalPlanTrace(null, ...) and a null usage trace both return the neutral trace, never throw", () => {
  const neutralFromPlan = computeTeamTacticalPlanTrace(null, [], null, null);
  assert.equal(neutralFromPlan.attackBonus, 0);
  assert.equal(neutralFromPlan.defenceBonus, 0);
  assert.deepEqual(neutralFromPlan.contributions, []);

  const plan = buildBasePlan();
  const neutralFromUsage = computeTeamTacticalPlanTrace(plan, uniformRatings(CLUB_ID, 140, 14), null, null);
  assert.equal(neutralFromUsage.attackBonus, 0);
});

test("a MatchPlan with every dial left at its default (MEDIUM/BALANCED/STANDARD/NORMAL) produces zero bonus in both directions -- inert controls really are inert", () => {
  const plan = buildBasePlan();
  const usage = computeTeamUsageTrace(plan, "t-default");
  const result = computeTeamTacticalPlanTrace(plan, uniformRatings(CLUB_ID, 140, 14), usage, null);
  // Formation still contributes its own baseline fit (formation is never "off"), so only assert the OTHER inert dials produced a zero contribution.
  const nonFormation = result.contributions.filter((c) => !c.dimension.startsWith("baseFormation") && !c.dimension.startsWith("riskLevel"));
  for (const c of nonFormation) {
    assert.equal(c.active, false, `${c.dimension} should be inert at its default setting`);
  }
});
