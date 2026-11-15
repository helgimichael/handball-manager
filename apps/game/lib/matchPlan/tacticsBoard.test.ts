// Arena Nights Phase 2 completion -- tactics board helpers (TRN-02a/e/f/g/i): diff, 7 m stats, strip, legends.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import { ensureSeasonCalendar } from "../competition/seasonCalendar";
import { ensureClubFinances } from "../economy/ledger";
import { getCareerSquad } from "../career/careerWorld";
import type { CareerState } from "../career/types";
import type { MatchPlan } from "./types";
import { COACH_AGGRESSION_LABEL, COACH_ATTACK_LABEL, COACH_ROTATION_LABEL, COACH_SEVEN_V_SIX_LABEL, COACH_TEMPO_LABEL } from "../../components/game/CoachingChoices";
import { benchStrip, COACHING_TRADEOFFS, diffLineups, MATCH_SQUAD_SLOTS, moveInOrder, OVERLAY_LEGEND, outsideByReadiness, penaltyStatsThisSeason } from "./tacticsBoard";

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
let base: string | undefined;
function career(): CareerState {
  if (!base) {
    const ids = ["swe-2"];
    const s = createNewCareerState("tactics-board", "swe2-tumba", Object.assign({}, ...ids.map((c) => snapshotWorldSquads(c))), undefined, Object.assign({}, ...ids.map((c) => snapshotGameplayRatings(c))), Object.assign({}, ...ids.map((c) => snapshotAllClubsStaff(c))));
    base = JSON.stringify(ensureSeasonCalendar(ensureClubFinances(s, s.gameDate)));
  }
  return JSON.parse(base) as CareerState;
}
function planOf(s: CareerState, starters: string[], bench: string[]): MatchPlan {
  const squad = getCareerSquad(s);
  const pos = (id: string) => { const p = squad.find((x) => x.id === id)!; return p.position === "MV" ? "GK" : p.position; };
  const slots = ["GK", "V6", "V9", "M9", "H9", "H6", "M6"].map((position, i) => ({ position, playerId: starters[i] ?? "" }));
  return { squad: { players: [...starters, ...bench].filter(Boolean).map((id) => ({ playerId: id, position: pos(id) })) }, attackStartingUnit: { formation: "NORMAL", slots } } as unknown as MatchPlan;
}

test("TRN-02f: every coaching option the board offers has a trade-off line (no option left unexplained)", () => {
  const keys = (o: object) => Object.keys(o).sort();
  assert.deepEqual(keys(COACHING_TRADEOFFS.defence), ["5:1", "6:0"]);
  assert.deepEqual(keys(COACHING_TRADEOFFS.aggression), keys(COACH_AGGRESSION_LABEL));
  assert.deepEqual(keys(COACHING_TRADEOFFS.tempo), keys(COACH_TEMPO_LABEL));
  assert.deepEqual(keys(COACHING_TRADEOFFS.attack), keys(COACH_ATTACK_LABEL));
  assert.deepEqual(keys(COACHING_TRADEOFFS.rotation), keys(COACH_ROTATION_LABEL));
  assert.deepEqual(keys(COACHING_TRADEOFFS.sevenVSix), keys(COACH_SEVEN_V_SIX_LABEL));
  // The rotation thresholds quoted match the engine's ROTATION_PROFILES.
  const engine = readFileSync(fileURLToPath(new URL("../../../../packages/handball-engine/src/v2/core/coaching.ts", import.meta.url)), "utf8");
  for (const [k, pct] of [["SHORT", 50], ["BALANCED", 62], ["WIDE", 72]] as const) {
    assert.ok(engine.includes(`${k}:{tiredBelow:${String(pct / 100).replace(/^0/, "")},`), `${k} threshold in engine`);
    assert.match(COACHING_TRADEOFFS.rotation[k], new RegExp(`${pct} %`));
  }
});

test("TRN-02e: the legend quotes the page's real chip thresholds", () => {
  const page = readFileSync(fileURLToPath(new URL("../../app/career/tactics/page.tsx", import.meta.url)), "utf8");
  assert.match(page, /energy < 75/);
  assert.match(OVERLAY_LEGEND.ENERGY.entries.map((e) => e.label).join(" "), /75 %/);
  assert.match(page, /lastRating >= 7\.5 \? .* : lastRating >= 6\.5/);
  assert.deepEqual(OVERLAY_LEGEND.LAST_MATCH.entries.map((e) => e.tone), ["pos", "info", "warn", "none"]);
  assert.deepEqual(OVERLAY_LEGEND.SUITABILITY.entries.map((e) => e.tone), ["pos", "warn", "neg"]);
});

test("TRN-02a: the proposal diff names every changed place and squad change; identical plans have no changes", () => {
  const s = career();
  const sq = getCareerSquad(s);
  const gk = sq.filter((p) => p.position === "MV"), out = sq.filter((p) => p.position !== "MV");
  const current = planOf(s, [gk[0]!.id, ...out.slice(0, 6).map((p) => p.id)], out.slice(6, 9).map((p) => p.id));
  assert.equal(diffLineups(current, current).changes, 0);
  const proposed = planOf(s, [gk[0]!.id, out[6]!.id, ...out.slice(1, 6).map((p) => p.id)], [out[0]!.id, out[9]!.id]);
  const d = diffLineups(current, proposed);
  assert.deepEqual(d.slots.filter((x) => x.changed).map((x) => x.position), ["V6"]);
  assert.equal(d.slots.find((x) => x.position === "V6")!.from, out[0]!.id);
  assert.deepEqual(d.added, [out[9]!.id].sort());
  assert.deepEqual(d.removed, [out[7]!.id, out[8]!.id].sort());
  assert.equal(diffLineups(null, proposed).slots.filter((x) => x.changed).length, 7, "from an empty plan every place is new");
});

test("TRN-02g: 7 m stats come only from stored SEVEN_M events of this season; reorder is a pure swap", () => {
  const s = career();
  assert.deepEqual(penaltyStatsThisSeason(s), {});
  const f = s.fixtures.find((x) => x.homeClubId === s.playerClubId || x.awayClubId === s.playerClubId)!;
  const shooter = getCareerSquad(s).find((p) => p.position !== "MV")!.id;
  const withResult: CareerState = { ...s, results: { ...s.results, [f.id]: { fixtureId: f.id, homeGoals: 1, awayGoals: 0, homePlayerContributions: [], awayPlayerContributions: [], events: [
    { minute: 3, side: "home", type: "SEVEN_M", playerId: shooter, sevenMetreOutcome: "GOAL" },
    { minute: 9, side: "home", type: "SEVEN_M", playerId: shooter, sevenMetreOutcome: "MISS" },
    { minute: 12, side: "home", type: "GOAL", playerId: shooter },
  ] } as never } };
  assert.deepEqual(penaltyStatsThisSeason(withResult)[shooter], { goals: 1, attempts: 2 });
  assert.deepEqual(moveInOrder(["a", "b", "c"], 2, -1), ["a", "c", "b"]);
  assert.deepEqual(moveInOrder(["a", "b"], 0, -1), ["a", "b"], "the first cannot move up");
});

test("TRN-02i: 16 places (court, bench, empty) and the drawer sorted available-first then freshest; pure", () => {
  const s = career();
  const before = hash(s);
  const sq = getCareerSquad(s);
  const gk = sq.filter((p) => p.position === "MV"), out = sq.filter((p) => p.position !== "MV");
  const plan = planOf(s, [gk[0]!.id, ...out.slice(0, 6).map((p) => p.id)], [gk[1]!.id, ...out.slice(6, 9).map((p) => p.id)]);
  const strip = benchStrip(s, plan);
  assert.equal(strip.slots.length, MATCH_SQUAD_SLOTS);
  assert.equal(strip.registered, 11);
  assert.deepEqual(strip.slots.map((x) => x.kind).slice(0, 12), [...Array(7).fill("COURT"), ...Array(4).fill("BENCH"), "EMPTY"]);
  assert.equal(strip.slots[0]!.label, "MV");
  const drawer = outsideByReadiness(s, plan, sq);
  assert.equal(drawer.length, sq.length - 11);
  for (let i = 1; i < drawer.length; i++) {
    const a = drawer[i - 1]!, b = drawer[i]!;
    assert.ok(Number(a.available) > Number(b.available) || (a.available === b.available && a.readiness >= b.readiness));
  }
  assert.equal(hash(s), before);
});
