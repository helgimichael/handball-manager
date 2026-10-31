// HM-ALPHA2-02A: a real production (v2) match feeds the workload ledger.
import test from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { snapshotWorldSquads, snapshotGameplayRatings } from "../gameWorld/serverSnapshot";
import { buildMatchdayReadyEvent } from "./careerEvents";
import { finishProductionMatch, startProductionMatch } from "./productionMatch";
import { decayedRecentWorkload, recordWorkload, workloadWindow } from "../training/workloadLedger";
import type { CareerState } from "./types";

function matchday(): CareerState {
  let state = createNewCareerState("workload-match-2026", "swe2-tumba", snapshotWorldSquads("swe-2"), undefined, snapshotGameplayRatings("swe-2"));
  const club = Object.keys(state.worldSquads).find((id) => id.toLowerCase().includes("tumba"));
  if (club) state = { ...state, playerClubId: club };
  const fixture = state.fixtures.find((f) => f.homeClubId === state.playerClubId || f.awayClubId === state.playerClubId)!;
  return { ...state, gameDate: fixture.date, careerEvents: [buildMatchdayReadyEvent(fixture.id, fixture.date)] };
}

test("a completed production match records each participant's measured workload once, separate from minutes", () => {
  const before = matchday();
  const done = finishProductionMatch(startProductionMatch(before));
  const fixtureId = Object.keys(done.results)[0];
  const archive = done.matchArchives![fixtureId];
  const ledger = done.workloadLedger!;
  const participants = archive.people.filter((p) => archive.load[p.id].minutes > 0);
  const unused = archive.people.filter((p) => !(archive.load[p.id].minutes > 0));
  assert.ok(participants.length >= 14, "both teams' participants");
  for (const person of participants) {
    const entries = ledger.entries[person.id];
    assert.equal(entries.length, 1, person.id);
    const e = entries[0];
    assert.equal(e.id, `match:${fixtureId}`);
    assert.equal(e.source, "MATCH");
    assert.equal(e.load, archive.load[person.id].workload);
    assert.equal(e.minutes, Math.round(archive.load[person.id].minutes * 10) / 10, "minutes stored as their own field");
    assert.equal(e.quality, person.role === "GK" ? "ESTIMATED" : "MEASURED", `${person.id} ${person.role}`);
  }
  for (const person of unused) assert.equal(ledger.entries[person.id], undefined, "unused substitutes get no workload");
  // Measured load reflects physical demand, not time: per-minute load varies across field players.
  const perMinute = participants.filter((p) => p.role !== "GK" && archive.load[p.id].minutes > 20).map((p) => archive.load[p.id].workload! / archive.load[p.id].minutes);
  assert.ok(Math.max(...perMinute) - Math.min(...perMinute) > 0.05, `per-minute load should vary: ${perMinute.map((x) => x.toFixed(2))}`);
  // Manager players' injury input is the ledger-derived figure.
  const managerTeam = archive.fixture.homeClubId === done.playerClubId ? "HOME" : "AWAY";
  for (const person of participants.filter((p) => p.team === managerTeam)) {
    assert.equal(done.playerPhysicalState[person.id].recentLoad, decayedRecentWorkload(ledger, person.id, archive.fixture.date));
  }
  // A retried completion re-records the same ids: nothing changes.
  const retried = recordWorkload(ledger, participants.map((p) => ({ playerId: p.id, ...ledger.entries[p.id][0] })), archive.fixture.date);
  assert.deepEqual(retried, ledger);
  // Opponent (CPU) windows are never presented as complete: their training is not tracked.
  const cpu = participants.find((p) => p.team !== managerTeam)!;
  assert.equal(workloadWindow(ledger, cpu.id, archive.fixture.date, 7, false).complete, false);
});

test("recording workload does not change the match: same seed, same result and same workloads", () => {
  const a = finishProductionMatch(startProductionMatch(matchday()));
  const b = finishProductionMatch(startProductionMatch(matchday()));
  const id = Object.keys(a.results)[0];
  assert.deepEqual(b.results[id], a.results[id]);
  assert.deepEqual(b.matchArchives![id].load, a.matchArchives![id].load);
  assert.deepEqual(b.workloadLedger, a.workloadLedger);
});
