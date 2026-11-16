import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import { getCareerSquad } from "../career/careerWorld";
import { getCareerPlayerRating } from "../career/careerRatingNormalization";
import type { CareerState } from "../career/types";
import { attributeTier, buildAttributeMatrix, developmentCurve, ownPlayerAttributes, squadAttributeAverage } from "./attributeMatrix";

let base: string | undefined;
function career(): CareerState {
  if (!base) {
    const squads = snapshotWorldSquads("swe-2"), ratings = snapshotGameplayRatings("swe-2"), staff = snapshotAllClubsStaff("swe-2");
    base = JSON.stringify(createNewCareerState("matrix", "swe2-tumba", squads, undefined, ratings, staff));
  }
  return JSON.parse(base) as CareerState;
}

test("tier ramp keeps the old thresholds", () => {
  assert.deepEqual([20, 15, 14, 12, 11, 9, 8, 1].map(attributeTier), ["elite", "elite", "strong", "strong", "solid", "solid", "weak", "weak"]);
});

test("matrix: families as columns, deltas only from the last 30 days, role tiles flagged", () => {
  const m = buildAttributeMatrix({
    branch: "OUTCOURT", position: "V6", gameDate: "2026-11-15",
    attributes: { FINISHING: { value: 14, origin: "DERIVED" }, PASSING: { value: 9 }, TOP_SPEED: { value: 16 } },
    events: [
      { date: "2026-11-01", attribute: "FINISHING", from: 13, to: 14, source: "Träning" },
      { date: "2026-09-01", attribute: "PASSING", from: 8, to: 9, source: "Träning" },
      { date: "2026-11-10", attribute: "TOP_SPEED", from: 17, to: 16, source: "Ålder" },
    ],
    compare: { FINISHING: 12 },
  });
  assert.equal(m.families.length, 6);
  const tiles = m.families.flatMap((f) => f.tiles);
  const fin = tiles.find((t) => t.key === "FINISHING")!;
  assert.equal(fin.delta, 1);
  assert.equal(fin.relevant, true);
  assert.equal(fin.compare, 12);
  assert.equal(tiles.find((t) => t.key === "PASSING")!.delta, 0, "older than 30 days");
  assert.equal(tiles.find((t) => t.key === "TOP_SPEED")!.delta, -1);
  assert.equal(m.changedCount, 2);
  assert.equal(m.families.find((f) => f.key === "TECHNICAL")!.compareAvg, 12);
});

test("squad average and compare overlay only read own players", () => {
  const s = career();
  const own = getCareerSquad(s).find((p) => p.position !== "MV")!;
  const avg = squadAttributeAverage(s, "OUTCOURT", own.id);
  assert.ok(Object.keys(avg).length > 20);
  assert.ok(Object.values(avg).every((v) => v >= 1 && v <= 20));
  assert.ok(ownPlayerAttributes(s, own.id));
  const external = Object.entries(s.worldSquads).find(([club]) => club !== s.playerClubId)![1]![0]!;
  assert.ok(getCareerPlayerRating(s, external.id, external.clubId), "external rating exists in state");
  assert.equal(ownPlayerAttributes(s, external.id), undefined, "external players never feed the overlay");
});

test("development curve is the running sum of stored changes", () => {
  const c = developmentCurve([
    { date: "2026-10-02", attribute: "PASSING", from: 9, to: 10, source: "Träning" },
    { date: "2026-10-01", attribute: "FINISHING", from: 12, to: 13, source: "Match" },
    { date: "2026-10-03", attribute: "TOP_SPEED", from: 15, to: 14, source: "Ålder" },
  ]);
  assert.deepEqual(c.map((p) => p.net), [1, 2, 1]);
  assert.deepEqual(c.map((p) => p.up), [true, true, false]);
});
