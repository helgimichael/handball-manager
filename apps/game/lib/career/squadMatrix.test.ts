// Arena Nights -- Squad Matrix saved views: overview columns, readiness heat-strip bands, position split,
// contract countdown and the explaining empty state. Pure over career state.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createNewCareerState } from "./newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import type { CareerState } from "./types";
import { buildMatrixRows, cardMetrics, contractCountdownPct, energyBand, explainEmpty, fitnessBand, heatStrip, loadBand, MATRIX_VIEWS, readinessRisk, reasonChips, splitByRole, type MatrixRow } from "./squadMatrix";

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
let base: string | undefined;
function career(): CareerState {
  if (!base) {
    const ids = ["swe-2"];
    const squads = Object.assign({}, ...ids.map((c) => snapshotWorldSquads(c)));
    const ratings = Object.assign({}, ...ids.map((c) => snapshotGameplayRatings(c)));
    const staff = Object.assign({}, ...ids.map((c) => snapshotAllClubsStaff(c)));
    base = JSON.stringify(createNewCareerState("matrix", "swe2-tumba", squads, undefined, ratings, staff));
  }
  return JSON.parse(base) as CareerState;
}

test("overview is the curated 8-column default (chip + 7) and phone cards show three metrics", () => {
  const overview = MATRIX_VIEWS[0]!;
  assert.equal(overview.id, "OVERVIEW");
  assert.equal(overview.columns.length, 7);
  assert.deepEqual(cardMetrics("OVERVIEW"), ["rating", "output", "contractEnd"]);
});

test("rows carry load ratio, reasons and per-match values; building is pure", () => {
  const s = career();
  const before = hash(s);
  const rows = buildMatrixRows(s);
  assert.ok(rows.length > 10);
  for (const r of rows) {
    assert.ok(Array.isArray(r.reasons));
    assert.ok(r.loadRatio === null || r.loadRatio >= 0);
    assert.equal(r.goalsPerMatch, r.appearances ? Math.round((r.goals / r.appearances) * 10) / 10 : null);
  }
  assert.equal(hash(s), before);
});

test("heat-strip bands follow the legend thresholds", () => {
  assert.equal(energyBand(80).band, "Pigg");
  assert.equal(energyBand(55).band, "Något sliten");
  assert.equal(energyBand(54).tone, "bad");
  assert.equal(fitnessBand(80).tone, "ok");
  assert.equal(fitnessBand(79).tone, "warn");
  assert.equal(fitnessBand(49).tone, "bad");
  assert.equal(loadBand(null).tone, "none");
  assert.equal(loadBand(1.2).tone, "warn");
  assert.equal(loadBand(0.8).tone, "info");
  assert.equal(loadBand(1).tone, "ok");
  const row = buildMatrixRows(career())[0]!;
  assert.deepEqual(heatStrip(row).map((c) => c.key), ["energy", "fitness", "load", "trend", "outlook"]);
});

test("risk ordering puts unavailable and tired players first; negative reasons lead the chips", () => {
  const row = buildMatrixRows(career())[0]!;
  const tired: MatrixRow = { ...row, energy: 40, fitness: 30, available: true };
  const out: MatrixRow = { ...row, available: false };
  const fresh: MatrixRow = { ...row, energy: 100, fitness: 100, available: true, recovery: "GOOD", trend: "STABLE", loadRatio: 1 };
  assert.ok(readinessRisk(out) > readinessRisk(tired));
  assert.ok(readinessRisk(tired) > readinessRisk(fresh));
  const chips = reasonChips({ ...row, reasons: ["God uthållighet", "Nyligen spelad match"] });
  assert.equal(chips[0]!.text, "Nyligen spelad match");
  assert.equal(chips[0]!.tone, "neg");
});

test("performance split and contract countdown", () => {
  const rows = buildMatrixRows(career());
  const { outcourt, goalkeepers } = splitByRole(rows);
  assert.equal(outcourt.length + goalkeepers.length, rows.length);
  assert.ok(goalkeepers.every((r) => r.position === "MV"));
  assert.equal(contractCountdownPct(null), null);
  assert.equal(contractCountdownPct(365), 50);
  assert.equal(contractCountdownPct(2000), 100);
  assert.equal(contractCountdownPct(-5), 0);
});

test("empty filter explains the zero and offers the nearest real matches", () => {
  const rows = buildMatrixRows(career());
  const pos = rows[0]!.position;
  const injured = rows.map((r) => (r.position === pos ? { ...r, available: false, availability: "INJURED", returnDate: "2026-11-14" } : r));
  const e = explainEmpty(injured, { query: "", position: pos, state: "AVAILABLE" });
  assert.match(e.message, new RegExp(`^0 tillgängliga ${pos}`));
  assert.match(e.message, /åter 2026-11-14/);
  assert.ok(e.nearest.length > 0 && e.nearest.every((r) => r.position === pos || r.secondaryPosition === pos));
  const q = explainEmpty(rows, { query: "zzzz", position: "ALL", state: "ALL" });
  assert.match(q.message, /ingen träff på "zzzz"/);
});
