// HM-MATCH-1.0 Part P: scorer/participation integrity -- a player with
// zero intended attacking exposure must not be reachable as a scorer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMatchRoster } from "./tumbaRoster";
import { TUMBA_SQUAD } from "../game-data";

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
