import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { snapshotAllClubsStaff } from "../gameWorld/staffIdentitySnapshot";
import { ensureClubFinances } from "../economy/ledger";
import { addDays } from "../career/dateUtils";
import type { CareerState } from "../career/types";
import type { DossierMatch } from "./playerDossier";
import { careerRibbon, dealBudget, matchChart, rehabTimeline } from "./profileModels";

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
let base: string | undefined;
function career(): CareerState {
  if (!base) {
    const s = createNewCareerState("profile", "swe2-tumba", snapshotWorldSquads("swe-2"), undefined, snapshotGameplayRatings("swe-2"), snapshotAllClubsStaff("swe-2"));
    base = JSON.stringify(ensureClubFinances(s, s.gameDate));
  }
  return JSON.parse(base) as CareerState;
}
const ownId = (s: CareerState) => s.worldSquads[s.playerClubId]![0]!.id;

test("rehab timeline: phase, progress, fixtures missed before the expected return; pure", () => {
  const s = career();
  const id = ownId(s);
  assert.equal(rehabTimeline(s, id).active, null);
  const ret = addDays(s.gameDate, 20);
  s.playerInjuries = { ...s.playerInjuries, [id]: { playerId: id, activeInjury: { injuryId: "i1", injuryType: "HAMSTRING_STRAIN", bodyArea: "THIGH", mechanism: "NON_CONTACT", severity: "MODERATE", occurredDate: addDays(s.gameDate, -5), source: "MATCH", expectedReturnDate: ret, expectedDurationDays: 25, currentPhase: "REHAB", rehabProgress: 0.2, recurrenceRiskMultiplier: 1 } as never, injuryHistory: [] } as never };
  const before = hash(s);
  const t = rehabTimeline(s, id).active!;
  assert.equal(hash(s), before);
  assert.equal(t.phaseIndex, 1);
  assert.equal(t.progressPct, 20);
  assert.equal(t.daysToReturn, 20);
  assert.ok(t.fixtures.every((f) => f.missed === f.date < ret));
  assert.equal(t.missedCount, t.fixtures.filter((f) => f.missed).length);
  assert.ok(t.returnPct > 0 && t.returnPct <= 100);
});

test("deal budget reads payroll and wage budget", () => {
  const s = career();
  const b = dealBudget(s, ownId(s));
  assert.ok(b);
  assert.ok(b.payrollEur > 0 && b.budgetEur > 0);
  assert.equal(b.playerAnnualEur, s.playerContracts[ownId(s)]!.wageEurPerMonth * 12);
  assert.equal(b.over, b.payrollEur > b.budgetEur);
  assert.equal(dealBudget(s, "nobody"), null);
});

test("career ribbon orders clubs by age and appends the current club", () => {
  const s = career();
  const id = ownId(s);
  s.playerClubHistory = { ...s.playerClubHistory, [id]: { playerId: id, entries: [{ clubId: "swe2-tumba", fromAge: 18, toAge: 21 }, { clubId: "other-club", fromAge: 12, toAge: 17 }] } as never };
  const r = careerRibbon(s, id, "new-club", 24);
  assert.deepEqual(r.map((x) => x.clubId), ["other-club", "swe2-tumba", "new-club"]);
  assert.equal(r.at(-1)!.current, true);
  assert.equal(r.at(-1)!.fromAge, 21);
});

test("match chart: oldest first, ratings on 0-10, bars relative to max", () => {
  const m = (id: string, goals: number, rating: number): DossierMatch => ({ fixtureId: id, date: `2026-10-0${id}`, competitionId: "c", type: "LEAGUE", opponent: "X", home: true, score: "1–0", outcome: "W", started: true, minutes: 60, goals, shots: goals, saves: null, shotsFaced: null, rating });
  const c = matchChart([m("3", 4, 8), m("2", 2, 6), m("1", 0, 5)], false);
  assert.deepEqual(c.map((p) => p.fixtureId), ["1", "2", "3"]);
  assert.deepEqual(c.map((p) => p.barPct), [0, 50, 100]);
  assert.deepEqual(c.map((p) => p.x), [0, 50, 100]);
});
