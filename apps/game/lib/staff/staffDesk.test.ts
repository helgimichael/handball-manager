// Arena Nights 231 -- staff view models: one matrix (no triple representation), vacancies first, real delegation
// modes, week grid from the training week, negotiation columns by whose move it is.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import { ensureSeasonCalendar } from "../competition/seasonCalendar";
import { ensureClubFinances } from "../economy/ledger";
import { setDelegation } from "../delegation/delegation";
import type { CareerState } from "../career/types";
import { clubOrganisation, vacancies } from "./organisation";
import { delegationSummary, filterDelegationLog, fitTone, negotiationColumn, organisationMatrix, staffFitRange, unassignedAreas, vacancyCards, weekGrid } from "./staffDesk";

let base: string | undefined;
function career(): CareerState {
  if (!base) {
    const ids = ["swe-2"];
    const s = createNewCareerState("staff-desk", "swe2-tumba", Object.assign({}, ...ids.map((c) => snapshotWorldSquads(c))), undefined, Object.assign({}, ...ids.map((c) => snapshotGameplayRatings(c))), Object.assign({}, ...ids.map((c) => snapshotAllClubsStaff(c))));
    base = JSON.stringify(ensureSeasonCalendar(ensureClubFinances(s, s.gameDate)));
  }
  return JSON.parse(base) as CareerState;
}

test("fit tone and range: 1-20 resolution, exact only from 90 % knowledge", () => {
  assert.equal(fitTone(16), "good");
  assert.equal(fitTone(12), "ok");
  assert.equal(fitTone(6), "weak");
  assert.deepEqual(staffFitRange(12.4, 95), { low: 12, high: 12, exact: true });
  const r = staffFitRange(12, 30);
  assert.equal(r.exact, false);
  assert.ok(r.low < 12 && r.high > 12 && r.low >= 1 && r.high <= 20);
});

test("matrix: every organisation position exactly once, vacancies first within a department", () => {
  const s = career();
  const groups = organisationMatrix(s);
  const rows = groups.flatMap((g) => g.rows).filter((r) => r.state !== "board");
  assert.equal(rows.length, clubOrganisation(s, s.playerClubId).length);
  assert.equal(new Set(rows.map((r) => r.key)).size, rows.length);
  assert.equal(groups.reduce((n, g) => n + g.vacant, 0), vacancies(s, s.playerClubId).length);
  for (const g of groups) {
    const firstFilled = g.rows.findIndex((r) => r.state !== "vacant");
    const lastVacant = g.rows.map((r) => r.state).lastIndexOf("vacant");
    if (lastVacant >= 0 && firstFilled >= 0) assert.ok(lastVacant < firstFilled || g.rows.slice(0, lastVacant).every((r) => r.state === "vacant"));
  }
  for (const r of rows) if (r.fit !== null) assert.ok(r.fit >= 1 && r.fit <= 20);
});

test("matrix: each carried responsibility sits on exactly one row and reflects the real mode", () => {
  let s = career();
  const summary = delegationSummary(s);
  const carried = summary.filter((a) => a.who).map((a) => a.area);
  const placed = organisationMatrix(s).flatMap((g) => g.rows).flatMap((r) => r.areas.map((a) => a.area));
  assert.deepEqual([...placed].sort(), [...carried].sort());
  assert.deepEqual(unassignedAreas(s).sort(), summary.filter((a) => !a.who).map((a) => a.area).sort());
  const scouting = summary.find((a) => a.area === "SCOUTING_ASSIGNMENTS" && a.who);
  if (scouting) {
    s = setDelegation(s, "SCOUTING_ASSIGNMENTS", "ADVISE", scouting.who!.staffId);
    const area = organisationMatrix(s).flatMap((g) => g.rows).flatMap((r) => r.areas).find((a) => a.area === "SCOUTING_ASSIGNMENTS");
    assert.equal(area?.mode, "ADVISE");
  }
  assert.deepEqual(filterDelegationLog(s, { area: "ALL" }), []);
});

test("week grid: seven days from the training week, coaches resolved from the roster", () => {
  const s = career();
  const grid = weekGrid(s);
  assert.equal(grid.length, 7);
  for (const d of grid) for (const x of d.sessions) if (x.coachId) assert.ok((s.staffRoster[s.playerClubId] ?? []).some((m) => m.id === x.coachId));
});

test("vacancy cards: one per vacant role with candidates from the market", () => {
  const s = career();
  const cards = vacancyCards(s);
  assert.equal(cards.reduce((n, c) => n + c.open, 0), vacancies(s, s.playerClubId).length);
  assert.equal(new Set(cards.map((c) => c.role)).size, cards.length);
});

test("negotiation column: your move without a pending answer, waiting with one, done once closed", () => {
  assert.equal(negotiationColumn({ stage: "TERMS", answerOn: null }), "YOUR_MOVE");
  assert.equal(negotiationColumn({ stage: "CLUB", answerOn: "2026-08-02" }), "WAITING");
  assert.equal(negotiationColumn({ stage: "COMPLETED", answerOn: null }), "DONE");
  assert.equal(negotiationColumn({ stage: "REJECTED", answerOn: "2026-08-02" }), "DONE");
});
