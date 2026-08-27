// HM-TACTICS-1.1: proves the HandballPosition -> Position bridge.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mapHandballPositionToMatchPlanPosition, toSelectablePlayers } from "./careerSquadBridge";
import type { PlayerMock } from "../game-data/types";

test("HM-TACTICS-1.1/HM-DATA-ALLSVENSKAN-1.1B: mapHandballPositionToMatchPlanPosition maps MV to GK, and every other code (including M6, the one canonical pivot position) 1:1", () => {
  assert.equal(mapHandballPositionToMatchPlanPosition("MV"), "GK");
  for (const code of ["V9", "V6", "M9", "M6", "H9", "H6"] as const) {
    assert.equal(mapHandballPositionToMatchPlanPosition(code), code);
  }
});

test("HM-TACTICS-1.1: toSelectablePlayers preserves every player and maps their position", () => {
  const squad = [{ id: "p1", firstName: "Gustav", lastName: "Davidsson", shirtNumber: 25, position: "M6" }] as unknown as PlayerMock[];
  const result = toSelectablePlayers(squad);
  assert.equal(result.length, 1);
  assert.equal(result[0].playerId, "p1");
  assert.equal(result[0].fullName, "Gustav Davidsson");
  assert.equal(result[0].position, "M6");
  assert.equal(result[0].handballPosition, "M6");
});
