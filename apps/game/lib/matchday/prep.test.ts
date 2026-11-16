// Arena Nights -- match preparation models: checklist tiles (MDY-01c), fix-it rows (MDY-01b),
// stakes strip (MDY-01a) and empty states (MDY-01f).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import { ensureSeasonCalendar } from "../competition/seasonCalendar";
import type { CareerState } from "../career/types";
import { previewEmptyState, ritualTiles, squadFixRows, stakesStrip } from "./preMatch";

function career(): CareerState {
  const ids = ["swe-2", "se_handbollsligan_herr"];
  const s = createNewCareerState("prep", "swe2-tumba", Object.assign({}, ...ids.map((c) => snapshotWorldSquads(c))), undefined, Object.assign({}, ...ids.map((c) => snapshotGameplayRatings(c))), Object.assign({}, ...ids.map((c) => snapshotAllClubsStaff(c))));
  return ensureSeasonCalendar(s);
}

test("checklist tiles: a lineup error turns 'Laget' red with the reason and a fix link; always three tiles", () => {
  const blocked = ritualTiles({ attention: [], lineupErrors: ["Startsjun saknar målvakt."], blocking: [], hasPlan: true, report: "NONE" });
  assert.equal(blocked.length, 3);
  assert.equal(blocked[1].state, "block");
  assert.equal(blocked[1].reason, "Startsjun saknar målvakt.");
  assert.ok(blocked[1].href?.startsWith("/career/tactics"));
  assert.equal(blocked[2].state, "todo");
  const ready = ritualTiles({ attention: [{ id: "ready", tone: "ok", text: "Klart" }], lineupErrors: [], blocking: [], hasPlan: true, report: "READY" });
  assert.deepEqual(ready.map((t) => t.state), ["done", "done", "done"]);
  const noPlan = ritualTiles({ attention: [], lineupErrors: [], blocking: [], hasPlan: false, report: "PENDING" });
  assert.equal(noPlan[1].state, "block");
  assert.match(noPlan[2].reason!, /på väg/);
});

test("fix-it rows: each warning gets a consequence and a fix link; unknown codes still get one", () => {
  const rows = squadFixRows([{ code: "NO_SUBSTITUTES", text: "Inga avbytare." }, { code: "SOMETHING_NEW", text: "Annat." }]);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.consequence && r.href.startsWith("/career/tactics") && r.cta));
  assert.equal(rows[0].title, "Inga avbytare");
});

test("stakes strip: league fixtures get both positions and win/loss outcomes; nothing is invented elsewhere", () => {
  const s = career();
  const league = s.fixtures.find((f) => f.type === "LEAGUE" && (f.homeClubId === s.playerClubId || f.awayClubId === s.playerClubId));
  assert.ok(league);
  const strip = stakesStrip(s, league!);
  assert.equal(strip.table, true);
  assert.ok(strip.own && strip.own.position >= 1);
  assert.equal(strip.gap, 0, "level before the season starts");
  assert.match(strip.win!, /^Vinst = 1:a/);
  assert.match(strip.loss!, /^Förlust = /);
  const other = { ...league!, type: "FRIENDLY" as const };
  assert.equal(stakesStrip(s, other).table, false);
});

test("empty states always offer a way forward", () => {
  const done = previewEmptyState({ seasonComplete: true, seasonId: "2026/27" });
  assert.ok(done.actions.some((a) => a.primary && a.href === "/career/season"));
  const none = previewEmptyState({ seasonComplete: false, seasonId: "2026/27" });
  assert.ok(none.actions.length >= 2 && none.actions.every((a) => a.href.startsWith("/career")));
});
