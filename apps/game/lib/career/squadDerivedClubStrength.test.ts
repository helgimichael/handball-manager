// HM-PLAYER-CALIBRATION-1.0 Part D: the ONE canonical, squad-derived
// ClubStrength -- proofs that it actually differentiates clubs by their
// real squad quality/hierarchy/depth, instead of a flat curated number
// or a flat 50/50/50/50 default.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSquadDerivedClubStrength } from "./squadDerivedClubStrength";
import { TUMBA_CLUB_ID } from "../game-data";
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

/** A minimal complete squad: one GK + one player per outcourt position. */
function buildSquad(positions: readonly PlayerMock["position"][] = ["MV", "V6", "V9", "M9", "M6", "H9", "H6"], overrides: Record<string, Partial<PlayerMock>> = {}): PlayerMock[] {
  return positions.map((position, i) => fakePlayer({ id: `${position}-${i}`, position, ...(overrides[`${position}-${i}`] ?? {}) }));
}

test("an empty squad resolves to the same neutral 50/50/50/50 default, never a crash", () => {
  const cs = computeSquadDerivedClubStrength("empty-club", [], []);
  assert.deepEqual(cs, { clubId: "empty-club", overall: 50, attack: 50, defense: 50, goalkeeper: 50, depth: 45 });
});

test("a squad of uniformly higher-CA players produces a higher attack/defense/goalkeeper than a uniformly lower-CA one", () => {
  const strongSquad = buildSquad();
  const weakSquad = buildSquad(["MV", "V6", "V9", "M9", "M6", "H9", "H6"]).map((p) => ({ ...p, id: `weak-${p.id}` }));
  const strongRatings = strongSquad.map((p) => (p.position === "MV" ? goalkeeperRating(p.id, 170, 17) : outcourtRating(p.id, 170, 17)));
  const weakRatings = weakSquad.map((p) => (p.position === "MV" ? goalkeeperRating(p.id, 90, 9) : outcourtRating(p.id, 90, 9)));

  const strong = computeSquadDerivedClubStrength("strong-club", strongSquad, strongRatings);
  const weak = computeSquadDerivedClubStrength("weak-club", weakSquad, weakRatings);

  assert.ok(strong.attack > weak.attack, `attack: ${strong.attack} vs ${weak.attack}`);
  assert.ok(strong.defense > weak.defense, `defense: ${strong.defense} vs ${weak.defense}`);
  assert.ok(strong.goalkeeper > weak.goalkeeper, `goalkeeper: ${strong.goalkeeper} vs ${weak.goalkeeper}`);
  assert.ok(strong.overall > weak.overall, `overall: ${strong.overall} vs ${weak.overall}`);
});

test("a bench player does NOT weigh as much as a starter of the same CA -- a club with a strong bench Talang is not as strong as one with that same quality as a starting Nyckelspelare", () => {
  const squadWithKeyStarter = buildSquad(["MV", "V6", "V9", "M9", "M6", "H9", "H6"]);
  // Add a second, identically-strong V6 but as a TALENT (deep bench) --
  // team attack should barely move, since TALENT carries a small weight.
  const benchTalent = fakePlayer({ id: "v6-bench-talent", position: "V6", calibratedSquadStatusTier: "TALENT" });
  const squadWithBenchTalent = [...squadWithKeyStarter, benchTalent];

  const baseRatings = squadWithKeyStarter.map((p) => (p.position === "MV" ? goalkeeperRating(p.id, 120, 12) : outcourtRating(p.id, 120, 12)));
  const eliteBenchRating = outcourtRating("v6-bench-talent", 190, 19); // far stronger than everyone else, but deep bench

  const without = computeSquadDerivedClubStrength("club", squadWithKeyStarter, baseRatings);
  const withEliteBenchTalent = computeSquadDerivedClubStrength("club", squadWithBenchTalent, [...baseRatings, eliteBenchRating]);

  const delta = withEliteBenchTalent.attack - without.attack;
  assert.ok(delta >= 0 && delta < 8, `adding a far-stronger TALENT-tier bench player should barely move team attack (delta=${delta})`);
});

test("depth reflects positional thinness: a squad with only one player at V6 has lower depth than an otherwise-identical squad with two strong V6 options", () => {
  const thin = buildSquad();
  const deepV6Backup = fakePlayer({ id: "v6-backup", position: "V6", calibratedSquadStatusTier: "FIRST_CHOICE" });
  const deep = [...thin, deepV6Backup];

  const thinRatings = thin.map((p) => (p.position === "MV" ? goalkeeperRating(p.id, 140, 14) : outcourtRating(p.id, 140, 14)));
  const deepRatings = [...thinRatings, outcourtRating("v6-backup", 140, 14)];

  const thinStrength = computeSquadDerivedClubStrength("thin-club", thin, thinRatings);
  const deepStrength = computeSquadDerivedClubStrength("deep-club", deep, deepRatings);

  assert.ok(deepStrength.depth > thinStrength.depth, `deep=${deepStrength.depth} should exceed thin=${thinStrength.depth}`);
});

test("every field stays within the documented 0-100 scale even for extreme (very high/low) CA inputs", () => {
  const squad = buildSquad();
  const extremeRatings = squad.map((p) => (p.position === "MV" ? goalkeeperRating(p.id, 200, 20) : outcourtRating(p.id, 200, 20)));
  const cs = computeSquadDerivedClubStrength("extreme-club", squad, extremeRatings);
  for (const field of ["overall", "attack", "defense", "goalkeeper", "depth"] as const) {
    assert.ok(cs[field] >= 0 && cs[field] <= 100, `${field}=${cs[field]} must stay within 0-100`);
  }
});

test("is pure/deterministic: identical inputs always produce identical output", () => {
  const squad = buildSquad();
  const ratings = squad.map((p) => (p.position === "MV" ? goalkeeperRating(p.id, 130, 13) : outcourtRating(p.id, 130, 13)));
  const a = computeSquadDerivedClubStrength("club", squad, ratings);
  const b = computeSquadDerivedClubStrength("club", squad, ratings);
  assert.deepEqual(a, b);
});
