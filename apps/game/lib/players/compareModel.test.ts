// Arena Nights -- SQD-04 compare model: deltas only for comparable numbers, external sides as ranges.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import type { CareerState } from "../career/types";
import { buildCompareRows, buildCompareSide, buildSquadAverageSide, deltaBar, searchPlayers, sortCompareRows } from "./compareModel";

let base: string | undefined;
function career(): CareerState {
  if (!base) {
    const ids = ["swe-2", "se_handbollsligan_herr"];
    const squads = Object.assign({}, ...ids.map((c) => snapshotWorldSquads(c)));
    const ratings = Object.assign({}, ...ids.map((c) => snapshotGameplayRatings(c)));
    const staff = Object.assign({}, ...ids.map((c) => snapshotAllClubsStaff(c)));
    base = JSON.stringify(createNewCareerState("compare", "swe2-tumba", squads, undefined, ratings, staff));
  }
  return JSON.parse(base) as CareerState;
}
const label = (k: string) => k;

test("own vs own: attribute deltas present, better side highlighted", () => {
  const s = career();
  const squad = s.worldSquads[s.playerClubId]!.filter((p) => p.position !== "MV");
  const rows = buildCompareRows(buildCompareSide(s, squad[0]!), buildCompareSide(s, squad[1]!), label);
  const attrs = rows.filter((r) => r.group === "Egenskaper");
  assert.ok(attrs.length >= 6);
  for (const r of attrs) {
    assert.notEqual(r.delta, null);
    if (r.delta! > 0) assert.equal(r.better, "right");
    if (r.delta! < 0) assert.equal(r.better, "left");
  }
});

test("own vs external: no attribute values or deltas for the external side, ability as range", () => {
  const s = career();
  const own = s.worldSquads[s.playerClubId]![0]!;
  const extClub = Object.keys(s.worldSquads).find((c) => c !== s.playerClubId && (s.worldSquads[c]?.length ?? 0) > 0)!;
  const ext = s.worldSquads[extClub]![0]!;
  const side = buildCompareSide(s, ext);
  assert.equal(side.own, false);
  assert.equal(Object.keys(side.metrics).some((k) => k.startsWith("attr:")), false, "no raw attributes for external players");
  const rows = buildCompareRows(buildCompareSide(s, own), side, label);
  for (const r of rows.filter((x) => x.group === "Egenskaper")) assert.equal(r.delta, null);
  assert.equal(rows.find((r) => r.key === "ability")!.right.kind, "range");
});

test("squad average side, delta bar geometry, sort by delta, search", () => {
  const s = career();
  const avg = buildSquadAverageSide(s);
  assert.equal(avg.kind, "SQUAD_AVG");
  assert.ok(Object.keys(avg.metrics).some((k) => k.startsWith("attr:")));
  assert.deepEqual(deltaBar(null, 10), { left: 50, width: 0, dir: "none" });
  assert.deepEqual(deltaBar(5, 10), { left: 50, width: 25, dir: "right" });
  assert.deepEqual(deltaBar(-20, 10), { left: 0, width: 50, dir: "left" });
  const squad = s.worldSquads[s.playerClubId]!.filter((p) => p.position !== "MV");
  const rows = sortCompareRows(buildCompareRows(buildCompareSide(s, squad[0]!), buildCompareSide(s, squad[1]!), label), "DELTA");
  assert.notEqual(rows[0]!.delta, null);
  const all = Object.values(s.worldSquads).flat();
  assert.ok(searchPlayers(all, s.playerClubId, squad[0]!.lastName, () => "", 5).some((p) => p.id === squad[0]!.id));
  assert.equal(searchPlayers(all, s.playerClubId, "", () => "", 3)[0]!.clubId, s.playerClubId);
});
