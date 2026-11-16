// Arena Nights MGR-03b: the gala orders existing awards, own league first.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { SeasonOutcome } from "../competition/types";
import { buildGalaSequence } from "./galaSequence";

const outcome = {
  seasonId: "2026/27", phase: "COMPLETE", bothTiersSimulated: true, regularSeasonWinners: {}, nextMembership: {}, promoted: [], relegated: [], announced: [], champion: "c",
  awards: [
    { id: "MVP", label: "Årets spelare", competitionId: "hbl", playerId: "p1", clubId: "c", value: "8,1" },
    { id: "TOP_SCORER", label: "Skyttekung", competitionId: "all", playerId: "p2", clubId: "me", value: "160 mål" },
    { id: "BEST_GOALKEEPER", label: "Årets målvakt", competitionId: "all", playerId: "p3", clubId: "d", value: "36 %" },
    { id: "ALL_STAR", label: "All star", competitionId: "all", playerId: "p4", clubId: "me", value: "", position: "VN" },
  ],
} as SeasonOutcome;

test("own league first, all-stars only in the summary, own winners highlighted", () => {
  const g = buildGalaSequence(outcome, "me", "all")!;
  assert.deepEqual(g.stages.map((s) => s.id), ["BEST_GOALKEEPER:all", "TOP_SCORER:all", "MVP:hbl"]);
  assert.equal(g.stages[1]!.mine, true);
  assert.equal(g.summary.myWinners.length, 2);
  assert.equal(g.summary.allStars.length, 1);
});

test("no gala before the season is complete", () => {
  assert.equal(buildGalaSequence({ ...outcome, phase: "POSTSEASON" }, "me", "all"), null);
  assert.equal(buildGalaSequence(undefined, "me", "all"), null);
});
