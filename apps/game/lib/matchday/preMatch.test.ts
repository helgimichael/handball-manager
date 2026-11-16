// Arena Nights Phase 2 -- matchday presentation models: attention order, court line-up, history navigation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import { ensureSeasonCalendar } from "../competition/seasonCalendar";
import { ensureClubFinances } from "../economy/ledger";
import { ensureBoard } from "../board/board";
import { ensureManagerCareer } from "../manager/managerCareer";
import { getCareerSquad } from "../career/careerWorld";
import type { CareerState } from "../career/types";
import type { MatchPlan } from "../matchPlan/types";
import { clubMatchNeighbours, headToHead, lineupBoard, playedMatches, positionGroup, preMatchAttention } from "./preMatch";

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
let base: string | undefined;
function career(): CareerState {
  if (!base) {
    const ids = ["swe-2", "se_handbollsligan_herr"];
    const s = createNewCareerState("prematch", "swe2-tumba", Object.assign({}, ...ids.map((c) => snapshotWorldSquads(c))), undefined, Object.assign({}, ...ids.map((c) => snapshotGameplayRatings(c))), Object.assign({}, ...ids.map((c) => snapshotAllClubsStaff(c))));
    base = JSON.stringify(ensureManagerCareer(ensureBoard(ensureSeasonCalendar(ensureClubFinances(s, s.gameDate)), s.gameDate)));
  }
  return JSON.parse(base) as CareerState;
}

test("attention: blocking items first, warnings next; 'ready' only when nothing needs the manager", () => {
  const s = career();
  const items = preMatchAttention(s, { lineupErrors: ["Startsjun saknar målvakt."], blocking: [], warnings: [{ code: "NO_SUBSTITUTES", text: "Inga avbytare." }], plan: undefined, lowReadiness: 2, unavailable: 1 });
  const tones = items.map((i) => i.tone);
  assert.equal(tones[0], "block");
  assert.ok(tones.lastIndexOf("block") < tones.indexOf("warn"), "blocking before warnings");
  assert.ok(!items.some((i) => i.id === "ready"));
  assert.ok(items.filter((i) => i.tone !== "ok").every((i) => i.href?.startsWith("/career")), "every actionable item links to its screen");
});

test("court line-up: seven attack spots from the real plan, the bench grouped by position, nothing invented", () => {
  const s = career();
  const squad = getCareerSquad(s);
  const pick = (pos: string) => squad.find((p) => p.position === pos)!;
  const starters = [["GK", "MV"], ["V6", "V6"], ["V9", "V9"], ["M9", "M9"], ["H9", "H9"], ["H6", "H6"], ["M6", "M6"]].map(([slot, pos]) => ({ position: slot, playerId: pick(pos!).id }));
  const benchIds = squad.filter((p) => !starters.some((x) => x.playerId === p.id)).slice(0, 5);
  const plan = { squad: { players: [...starters.map((x) => ({ playerId: x.playerId, position: x.position })), ...benchIds.map((p) => ({ playerId: p.id, position: p.position === "MV" ? "GK" : p.position }))] }, attackStartingUnit: { slots: starters } } as unknown as MatchPlan;
  const before = hash(s);
  const board = lineupBoard(s, plan, squad);
  assert.equal(board.spots.length, 7);
  assert.ok(board.spots.every((sp) => sp.playerId && sp.name), "every slot filled from the plan");
  assert.equal(board.spots.find((sp) => sp.slot === "GK")!.label, "MV");
  assert.equal(board.bench.length, 5);
  for (const b of board.bench) assert.equal(b.group, positionGroup(b.position));
  assert.deepEqual(lineupBoard(s, undefined, squad).bench, [], "no plan, no bench");
  assert.ok(lineupBoard(s, undefined, squad).spots.every((sp) => !sp.playerId));
  assert.equal(hash(s), before);
});

test("history: head-to-head and report navigation only use stored results", () => {
  const s = career();
  const own = s.fixtures.filter((f) => f.homeClubId === s.playerClubId || f.awayClubId === s.playerClubId).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  assert.equal(playedMatches(s).length, 0, "no results, no history");
  const played: CareerState = { ...s, results: { ...s.results, ...Object.fromEntries(own.map((f, i) => [f.id, { fixtureId: f.id, homeGoals: 28 + i, awayGoals: 25 } as never])) } };
  const n = clubMatchNeighbours(played, s.playerClubId, own[1]!.id);
  assert.equal(n.previous?.fixtureId, own[0]!.id);
  assert.equal(n.next?.fixtureId, own[2]!.id);
  const opp = own[0]!.homeClubId === s.playerClubId ? own[0]!.awayClubId : own[0]!.homeClubId;
  const h2h = headToHead(played, s.playerClubId, opp);
  assert.ok(h2h.length >= 1 && h2h.every((m) => [m.homeClubId, m.awayClubId].includes(opp)));
  assert.equal(headToHead(played, s.playerClubId, opp, own[0]!.id).some((m) => m.fixtureId === own[0]!.id), false, "the current match is excluded");
});
