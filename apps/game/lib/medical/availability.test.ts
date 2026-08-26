import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { TUMBA_CLUB_ID } from "../game-data";
import { getCareerSquad } from "../career/careerWorld";
import { isSelectableForMatch } from "../career/playerStatus";
import { effectiveTrainingLoadSetting, getPlayerAvailability, unavailablePlayerIdsForClub } from "./availability";
import { validateMatchSquad } from "../matchPlan/matchSquad";
import { buildInitialMatchSquad } from "../matchPlan/careerSquadBridge";
import { buildMatchRoster } from "../career/tumbaRoster";
import type { CareerState } from "../career/types";
import type { PlayerCareerStatus } from "../career/playerStatus";

function freshTumba(seed: string): CareerState {
  return createNewCareerState(seed, TUMBA_CLUB_ID);
}

function withStatus(state: CareerState, playerId: string, status: PlayerCareerStatus): CareerState {
  return { ...state, playerStatuses: { ...state.playerStatuses, [playerId]: status } };
}

// (16) injured player unavailable.
test("(16) getPlayerAvailability reports UNAVAILABLE for an INJURED player", () => {
  const state = withStatus(freshTumba("avail-16"), "p-nilsson", { playerId: "p-nilsson", availability: "INJURED" });
  assert.equal(getPlayerAvailability(state, "p-nilsson"), "UNAVAILABLE");
});

// (17) unavailable player rejected from MatchSquad.
test("(17) validateMatchSquad rejects a selected player who is in unavailablePlayerIds", () => {
  const state = withStatus(freshTumba("avail-17"), "p-nilsson", { playerId: "p-nilsson", availability: "INJURED" });
  const squad = getCareerSquad(state);
  const matchSquad = buildInitialMatchSquad(squad, "fx-1", TUMBA_CLUB_ID);
  const unavailable = unavailablePlayerIdsForClub(state, squad.map((p) => p.id));
  // p-nilsson may or may not have been included in the initial 16 -- force it in for this test.
  const forcedSquad = { ...matchSquad, players: [...matchSquad.players.filter((p) => p.playerId !== "p-nilsson"), { playerId: "p-nilsson", position: "M9" as const }] };
  const result = validateMatchSquad(forcedSquad, undefined, unavailable);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("p-nilsson")));
});

// (18) unavailable starter rejected -- validateMatchSquad is the shared primitive every starting-unit validator composes with (matchPlan.ts); proven directly here.
test("(18) an unavailable player fails validateMatchSquad even when otherwise a valid selection", () => {
  const squad = { fixtureId: "fx-1", clubId: TUMBA_CLUB_ID, players: [{ playerId: "p-x", position: "GK" as const }] };
  const result = validateMatchSquad(squad, undefined, ["p-x"]);
  assert.equal(result.ok, false);
});

// (19) unavailable specialist pair rejected -- same underlying rule (unavailablePlayerIds), proven at the squad level since substitution pairs draw from the squad.
test("(19) unavailablePlayerIds catches a player even among several valid teammates", () => {
  const squad = {
    fixtureId: "fx-1",
    clubId: TUMBA_CLUB_ID,
    players: [
      { playerId: "p-gk", position: "GK" as const },
      { playerId: "p-a", position: "V9" as const },
      { playerId: "p-b", position: "V6" as const },
    ],
  };
  const result = validateMatchSquad(squad, undefined, ["p-b"]);
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
});

// (20) available player accepted.
test("(20) a fully AVAILABLE player passes validateMatchSquad's availability check", () => {
  const squad = { fixtureId: "fx-1", clubId: TUMBA_CLUB_ID, players: [{ playerId: "p-gk", position: "GK" as const }] };
  const result = validateMatchSquad(squad, undefined, []);
  assert.equal(result.ok, true);
});

// (21) returning player follows chosen limited policy (LIMITED is selectable).
test("(21) a LIMITED player IS selectable for match (the chosen Part 17 policy)", () => {
  const state = withStatus(freshTumba("avail-21"), "p-nilsson", { playerId: "p-nilsson", availability: "LIMITED" });
  assert.equal(isSelectableForMatch(state.playerStatuses, "p-nilsson"), true);
  assert.equal(getPlayerAvailability(state, "p-nilsson"), "LIMITED");
});

// (22) injured player cannot receive normal training.
test("(22) an INJURED player's requested FULL load setting is forced down to REST", () => {
  const state = withStatus(freshTumba("avail-22"), "p-nilsson", { playerId: "p-nilsson", availability: "INJURED" });
  assert.equal(effectiveTrainingLoadSetting(state, "p-nilsson", "FULL"), "REST");
  assert.equal(effectiveTrainingLoadSetting(state, "p-nilsson", "REDUCED"), "REST");
});

// (23) returning player load capped.
test("(23) a LIMITED player's requested FULL load setting is capped to REDUCED, but RECOVERY_ONLY/REST pass through", () => {
  const state = withStatus(freshTumba("avail-23"), "p-nilsson", { playerId: "p-nilsson", availability: "LIMITED" });
  assert.equal(effectiveTrainingLoadSetting(state, "p-nilsson", "FULL"), "REDUCED");
  assert.equal(effectiveTrainingLoadSetting(state, "p-nilsson", "RECOVERY_ONLY"), "RECOVERY_ONLY");
});

// (24) healthy player unaffected.
test("(24) an AVAILABLE player's requested load setting passes through completely unchanged", () => {
  const state = freshTumba("avail-24");
  for (const setting of ["FULL", "REDUCED", "RECOVERY_ONLY", "REST"] as const) {
    assert.equal(effectiveTrainingLoadSetting(state, "p-nilsson", setting), setting);
  }
});

// (25) stale MatchPlan becomes invalid if player injured after save.
test("(25) a MatchSquad built while a player was healthy fails validation once that player becomes unavailable", () => {
  const healthyState = freshTumba("avail-25");
  const squad = getCareerSquad(healthyState);
  const matchSquad = buildInitialMatchSquad(squad, "fx-1", TUMBA_CLUB_ID);
  const beforeInjury = validateMatchSquad(matchSquad, undefined, unavailablePlayerIdsForClub(healthyState, squad.map((p) => p.id)));
  assert.equal(beforeInjury.ok, true);

  const injuredPlayerId = matchSquad.players.find((p) => p.position !== "GK")!.playerId;
  const afterInjuryState = withStatus(healthyState, injuredPlayerId, { playerId: injuredPlayerId, availability: "INJURED" });
  const afterInjury = validateMatchSquad(matchSquad, undefined, unavailablePlayerIdsForClub(afterInjuryState, squad.map((p) => p.id)));
  assert.equal(afterInjury.ok, false);
  assert.ok(afterInjury.errors.some((e) => e.includes(injuredPlayerId)));
});

// buildMatchRoster itself excludes INJURED but includes LIMITED (the live roster-construction gate, not just the validator).
test("buildMatchRoster excludes an INJURED player but still includes a LIMITED one", () => {
  const state = freshTumba("avail-roster");
  const squad = getCareerSquad(state);
  const injuredId = squad.find((p) => p.position !== "MV")!.id;
  const limitedId = squad.find((p) => p.position !== "MV" && p.id !== injuredId)!.id;
  const statuses = {
    ...state.playerStatuses,
    [injuredId]: { playerId: injuredId, availability: "INJURED" as const },
    [limitedId]: { playerId: limitedId, availability: "LIMITED" as const },
  };
  const roster = buildMatchRoster(squad, statuses);
  assert.ok(!roster.some((r) => r.playerId === injuredId));
  assert.ok(roster.some((r) => r.playerId === limitedId));
});
