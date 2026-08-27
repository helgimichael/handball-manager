import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DATA_ROOT } from "../editor/paths";
import { loadRealWorldClubSquad } from "./realWorldLoader";
import { toPlayerMock, toPlayerMocks } from "./gameWorldAdapter";

test("toPlayerMock preserves stable playerId, real identity fields, and marks dataSource REAL_WORLD", () => {
  const squad = loadRealWorldClubSquad("se_club_alingsas_hk", DEFAULT_DATA_ROOT)!;
  const raw = squad.players[0];
  const mock = toPlayerMock(raw)!;

  assert.equal(mock.id, raw.playerId, "playerId must be preserved verbatim, never regenerated");
  assert.equal(mock.clubId, raw.clubId);
  assert.equal(mock.firstName, raw.firstName);
  assert.equal(mock.lastName, raw.lastName);
  assert.equal(mock.dateOfBirth, raw.dateOfBirth);
  assert.equal(mock.heightCm, raw.heightCm);
  assert.equal(mock.dataSource, "REAL_WORLD");
  assert.deepEqual(mock.nationalities, raw.nationalities);
});

test("toPlayerMock never fabricates a value for a null real-world field", () => {
  const squad = loadRealWorldClubSquad("se_club_alingsas_hk", DEFAULT_DATA_ROOT)!;
  const withNulls = { ...squad.players[0], dateOfBirth: null, heightCm: null, shirtNumber: null, handedness: null };
  const mock = toPlayerMock(withNulls)!;
  assert.equal(mock.dateOfBirth, null);
  assert.equal(mock.heightCm, null);
  assert.equal(mock.shirtNumber, null);
  assert.equal(mock.foot, null);
});

test("toPlayerMock's game-simulation fields are the one fixed, documented, neutral provisional profile -- identical across different real players", () => {
  const squad = loadRealWorldClubSquad("se_club_hk_malmo", DEFAULT_DATA_ROOT)!;
  const mocks = toPlayerMocks(squad.players);
  assert.ok(mocks.length >= 2);
  const [a, b] = mocks;
  assert.equal(a.currentAbility, b.currentAbility);
  assert.equal(a.potentialAbility, b.potentialAbility);
  assert.deepEqual(a.attributes, b.attributes);
});

test("HM-PLAYER-DATA-EDITOR-1.0: toPlayerMock threads a calibrated defaultSquadStatus into calibratedSquadStatusTier, and leaves it undefined when nobody has calibrated one", () => {
  const squad = loadRealWorldClubSquad("se_club_alingsas_hk", DEFAULT_DATA_ROOT)!;
  const basePlayer = { ...squad.players[0], defaultSquadStatus: null, specialTags: [] };
  const uncalibrated = toPlayerMock(basePlayer)!;
  assert.equal(uncalibrated.calibratedSquadStatusTier, undefined);

  const calibrated = toPlayerMock({ ...basePlayer, defaultSquadStatus: "KEY_PLAYER" })!;
  assert.equal(calibrated.calibratedSquadStatusTier, "KEY_PLAYER");

  const invalid = toPlayerMock({ ...basePlayer, defaultSquadStatus: "NOT_A_REAL_TIER" })!;
  assert.equal(invalid.calibratedSquadStatusTier, undefined, "an unrecognized value must never be passed through as if it were a real tier");
});

test("HM-PLAYER-DATA-EDITOR-1.0: toPlayerMock threads calibrated specialTags, filtering out anything not in the canonical vocabulary", () => {
  const squad = loadRealWorldClubSquad("se_club_alingsas_hk", DEFAULT_DATA_ROOT)!;
  const basePlayer = { ...squad.players[0], defaultSquadStatus: null, specialTags: [] };
  const noTags = toPlayerMock(basePlayer)!;
  assert.equal(noTags.specialTags, undefined);

  const tagged = toPlayerMock({ ...basePlayer, specialTags: ["CAPTAIN", "SEVEN_METER_TAKER"] })!;
  assert.deepEqual(tagged.specialTags, ["CAPTAIN", "SEVEN_METER_TAKER"]);

  const mixed = toPlayerMock({ ...basePlayer, specialTags: ["CAPTAIN", "NOT_A_REAL_TAG"] })!;
  assert.deepEqual(mixed.specialTags, ["CAPTAIN"], "an unrecognized tag must be dropped, never passed through");
});

test("toPlayerMock refuses (returns null for) a non-canonical primaryPosition rather than inventing one", () => {
  const squad = loadRealWorldClubSquad("se_club_alingsas_hk", DEFAULT_DATA_ROOT)!;
  const bad = { ...squad.players[0], primaryPosition: "STRIKER" };
  assert.equal(toPlayerMock(bad), null);
});

test("toPlayerMocks produces one PlayerMock per valid real-world player for every real Handbollsligan club", () => {
  const ids = [
    "se_club_alingsas_hk", "se_club_amo_hk", "se_club_hammarby_if_hf", "se_club_hf_karlskrona",
    "se_club_hk_malmo", "se_club_if_hallby_hk", "se_club_ifk_kristianstad", "se_club_ifk_skovde_hk",
    "se_club_ik_savehof", "se_club_lugi_hf", "se_club_ov_helsingborg", "se_club_skanela_if",
    "se_club_ystads_if_hf", "se_club_onnereds_hk",
  ];
  for (const clubId of ids) {
    const squad = loadRealWorldClubSquad(clubId, DEFAULT_DATA_ROOT)!;
    const mocks = toPlayerMocks(squad.players);
    assert.equal(mocks.length, squad.players.length, `${clubId}: every real player has a canonical position, so none should be skipped`);
    for (const m of mocks) {
      assert.equal(m.clubId, clubId);
      assert.equal(m.dataSource, "REAL_WORLD");
    }
  }
});
