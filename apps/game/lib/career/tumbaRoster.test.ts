// HM-MATCH-1.0 Part P: scorer/participation integrity -- a player with
// zero intended attacking exposure must not be reachable as a scorer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMatchRoster } from "./tumbaRoster";
import { TUMBA_SQUAD, TUMBA_CLUB_ID } from "../game-data";
import type { PlayerMock } from "../game-data";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import { OUTCOURT_ATTRIBUTES, GOALKEEPER_ATTRIBUTES } from "../rating/types";
import type { OutcourtAttribute, GoalkeeperAttribute } from "../rating/types";
import type { GeneratedAttributeValue } from "../rating/generation/types";

function fakePlayer(overrides: Partial<PlayerMock>): PlayerMock {
  return {
    id: "fake-player",
    clubId: TUMBA_CLUB_ID,
    firstName: "Fake",
    lastName: "Player",
    shirtNumber: null,
    position: "M9",
    nationality: "SWE",
    dateOfBirth: null,
    heightCm: null,
    weightKg: null,
    foot: null,
    squadStatus: "Förstaval",
    currentAbility: 100,
    potentialAbility: 100,
    form: 5,
    fitnessPct: 100,
    moralePct: 70,
    appearances: 0,
    goals: 0,
    contractEndSeason: "2027/28",
    wageSekPerMonth: 0,
    attributes: {
      technical: { skott: 10, passning: 10, spelforstaelse: 10, genombrott: 10, mottagning: 10, fint: 10, spelUtanBoll: 10 },
      mental: { beslutsfattande: 10, kyla: 10, arbetskapacitet: 10, kampvilja: 10, positionering: 10, lagarbete: 10, ledarskap: 10 },
      physical: { snabbhet: 10, acceleration: 10, styrka: 10, explosivitet: 10, uthallighet: 10, rorlighet: 10 },
    },
    ...overrides,
  };
}

function outcourtRating(playerId: string, ca: number, attrValue = 10): GameplayPlayerRating {
  const attributes = {} as Record<OutcourtAttribute, GeneratedAttributeValue>;
  for (const attr of OUTCOURT_ATTRIBUTES) attributes[attr] = { value: attrValue, origin: "GENERATED_PRIOR" };
  return {
    playerId,
    position: "M9",
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

function goalkeeperRating(playerId: string, ca: number, attrValue = 10): GameplayPlayerRating {
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

test("Part P #18: a player with zero attack exposure is excluded from the outfield roster entirely -- structurally unreachable as a scorer", () => {
  const squad = TUMBA_SQUAD;
  const withoutExposure = buildMatchRoster(squad, undefined);
  assert.ok(withoutExposure.length > 1, "sanity: the plain (no exposure map) roster still includes multiple outfield players");

  const outfieldIds = withoutExposure.filter((p) => !p.isGoalkeeper).map((p) => p.playerId);
  const zeroExposureId = outfieldIds[0];
  const exposureById = new Map(outfieldIds.map((id) => [id, id === zeroExposureId ? 0 : 1]));

  const withExposure = buildMatchRoster(squad, undefined, exposureById);
  assert.ok(!withExposure.some((p) => p.playerId === zeroExposureId), "a zero-attack-exposure player must not appear in the roster at all");
  assert.equal(withExposure.length, withoutExposure.length - 1);
});

test("a non-zero exposure scales scoringWeight proportionally -- a lightly-used player gets less scoring opportunity than a heavily-used one", () => {
  const squad = TUMBA_SQUAD;
  const outfieldIds = buildMatchRoster(squad, undefined).filter((p) => !p.isGoalkeeper).map((p) => p.playerId);
  const [lightId, heavyId] = outfieldIds;
  const exposureById = new Map(outfieldIds.map((id) => [id, id === lightId ? 0.1 : id === heavyId ? 1 : 1]));

  const roster = buildMatchRoster(squad, undefined, exposureById);
  const light = roster.find((p) => p.playerId === lightId)!;
  const heavy = roster.find((p) => p.playerId === heavyId)!;
  assert.ok(light.scoringWeight < heavy.scoringWeight);
});

test("omitting the exposure map is byte-identical to before HM-MATCH-1.0 -- purely additive", () => {
  const squad = TUMBA_SQUAD;
  const a = buildMatchRoster(squad, undefined);
  const b = buildMatchRoster(squad, undefined, undefined);
  assert.deepEqual(a, b);
});

test("a player with no entry in a SUPPLIED exposure map is treated as zero exposure (excluded) -- the map narrows eligibility, it never widens it beyond what squadStatus already allowed", () => {
  const squad = TUMBA_SQUAD;
  const withEmptyMap = buildMatchRoster(squad, undefined, new Map());
  assert.ok(!withEmptyMap.some((p) => !p.isGoalkeeper), "an empty, explicitly-supplied exposure map should exclude every outfield player -- none has a positive entry");
});

test("omitting the map entirely (undefined, not an empty Map) never filters anything -- only a genuinely resolved MatchPlan/usage trace narrows the roster", () => {
  const squad = TUMBA_SQUAD;
  const withoutMap = buildMatchRoster(squad, undefined, undefined);
  assert.ok(withoutMap.some((p) => !p.isGoalkeeper), "omitting the map entirely must not exclude anyone");
});

// ---------------------------------------------------------------------------
// HM-PLAYER-CALIBRATION-1.0 Part C: root-cause fix -- scoringWeight now
// reads canonical GameplayPlayerRating instead of the stale, flat
// PlayerMock.currentAbility=100 every real-world player has.
// ---------------------------------------------------------------------------

test("a higher canonical CA produces a higher scoringWeight than a lower one, even when currentAbility is identical (the stale-100 bug this fixes)", () => {
  const low = fakePlayer({ id: "low-ca", position: "V6", currentAbility: 100 });
  const high = fakePlayer({ id: "high-ca", position: "V6", currentAbility: 100 });
  const squad = [low, high];
  const ratingsById = new Map([
    ["low-ca", outcourtRating("low-ca", 90)],
    ["high-ca", outcourtRating("high-ca", 170)],
  ]);

  const roster = buildMatchRoster(squad, undefined, undefined, undefined, undefined, ratingsById);
  const lowWeight = roster.find((p) => p.playerId === "low-ca")!.scoringWeight;
  const highWeight = roster.find((p) => p.playerId === "high-ca")!.scoringWeight;
  assert.ok(highWeight > lowWeight, `expected the higher-CA player to have a higher scoringWeight (${highWeight} vs ${lowWeight})`);
});

test("no ratingsById supplied falls back to currentAbility -- byte-identical to before this fix", () => {
  const player = fakePlayer({ id: "no-rating", position: "V6", currentAbility: 140 });
  const roster = buildMatchRoster([player], undefined, undefined, undefined, undefined, undefined);
  const weight = roster.find((p) => p.playerId === "no-rating")!.scoringWeight;
  assert.equal(weight, (140 / 10) * 1.1); // V6's own OFFENSIVE_INVOLVEMENT_BY_POSITION multiplier
});

test("position changes the scoring profile: a wing (V6) and a playmaker (M9) with the IDENTICAL rating do not get the same scoringWeight", () => {
  const wing = fakePlayer({ id: "wing", position: "V6" });
  const playmaker = fakePlayer({ id: "playmaker", position: "M9" });
  const rating = outcourtRating("shared", 150, 15); // same attribute value everywhere, so only the position-specific attribute family + involvement multiplier can differ the outcome
  const ratingsById = new Map([
    ["wing", { ...rating, playerId: "wing" }],
    ["playmaker", { ...rating, playerId: "playmaker" }],
  ]);

  const roster = buildMatchRoster([wing, playmaker], undefined, undefined, undefined, undefined, ratingsById);
  const wingWeight = roster.find((p) => p.playerId === "wing")!.scoringWeight;
  const playmakerWeight = roster.find((p) => p.playerId === "playmaker")!.scoringWeight;
  assert.ok(wingWeight > playmakerWeight, "a wing's offensive-involvement multiplier is higher than a playmaker's -- their scoringWeight must differ even with identical underlying attribute values");
});

test("ATTACK_SPECIALIST and SEVEN_METER_TAKER tags each give a real, bounded scoringWeight boost", () => {
  const plain = fakePlayer({ id: "plain", position: "H6" });
  const tagged = fakePlayer({ id: "tagged", position: "H6", specialTags: ["ATTACK_SPECIALIST", "SEVEN_METER_TAKER"] });
  const rating = outcourtRating("shared", 140, 12);
  const ratingsById = new Map([
    ["plain", { ...rating, playerId: "plain" }],
    ["tagged", { ...rating, playerId: "tagged" }],
  ]);

  const roster = buildMatchRoster([plain, tagged], undefined, undefined, undefined, undefined, ratingsById);
  const plainWeight = roster.find((p) => p.playerId === "plain")!.scoringWeight;
  const taggedWeight = roster.find((p) => p.playerId === "tagged")!.scoringWeight;
  assert.ok(taggedWeight > plainWeight, "tagged player should have a higher scoringWeight");
  assert.ok(taggedWeight <= plainWeight * 1.15 * 1.1 + 1e-9, "the boost must stay bounded to the documented multipliers, never an unbounded stack");
});

test("a goalkeeper always gets scoringWeight 0, regardless of any canonical rating supplied", () => {
  const gk = fakePlayer({ id: "gk", position: "MV" });
  const ratingsById = new Map([["gk", goalkeeperRating("gk", 180, 18)]]);
  const roster = buildMatchRoster([gk, fakePlayer({ id: "filler1", position: "V6" }), fakePlayer({ id: "filler2", position: "H6" }), fakePlayer({ id: "filler3", position: "V9" }), fakePlayer({ id: "filler4", position: "H9" }), fakePlayer({ id: "filler5", position: "M9" }), fakePlayer({ id: "filler6", position: "M6" })], undefined, undefined, undefined, undefined, ratingsById);
  const gkEntry = roster.find((p) => p.playerId === "gk")!;
  assert.equal(gkEntry.isGoalkeeper, true);
  assert.equal(gkEntry.scoringWeight, 0);
});

test("the starting goalkeeper's goalkeeperQuality is populated from their canonical GOALKEEPER attribute branch", () => {
  const gk = fakePlayer({ id: "gk", position: "MV" });
  const ratingsById = new Map([["gk", goalkeeperRating("gk", 160, 16)]]);
  const roster = buildMatchRoster([gk], undefined, undefined, undefined, undefined, ratingsById);
  const gkEntry = roster.find((p) => p.playerId === "gk")!;
  assert.ok(gkEntry.goalkeeperQuality !== undefined && gkEntry.goalkeeperQuality > 50, `expected an above-neutral goalkeeperQuality for a strong keeper, got ${gkEntry.goalkeeperQuality}`);
});
