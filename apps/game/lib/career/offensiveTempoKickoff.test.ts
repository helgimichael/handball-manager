// HM-ALPHA2-04B: the plan's tempo reaches the played match as LOW (SLOW) /
// BALANCED / HIGH (QUICK), before kickoff and live, and survives saves.
import test from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { snapshotWorldSquads, snapshotGameplayRatings } from "../gameWorld/serverSnapshot";
import { buildMatchdayReadyEvent } from "./careerEvents";
import { commandProductionMatch, createProductionSession } from "./productionMatch";
import { resolveClubMatchPlanForFixture } from "./playerMatchStrength";
import { getCareerSquad } from "./careerWorld";
import { attackPlanTempo, engineOffensiveTempo } from "../matchPlan/offensiveTempo";
import type { AttackPlanConfig } from "../matchPlan/types";
import type { CareerState } from "./types";

test("tempo format: plan values map to the engine and back", () => {
  assert.equal(engineOffensiveTempo({ tempo: "SLOW" }), "SLOW");
  assert.equal(engineOffensiveTempo({ tempo: "BALANCED" }), "BALANCED");
  assert.equal(engineOffensiveTempo({ tempo: "FAST" }), "QUICK");
  assert.equal(engineOffensiveTempo(undefined), "BALANCED");
  assert.equal(engineOffensiveTempo({ tempo: "TURBO" } as unknown as AttackPlanConfig), "BALANCED");
  for (const tempo of ["SLOW", "BALANCED", "QUICK"] as const) assert.equal(engineOffensiveTempo({ tempo: attackPlanTempo(tempo) }), tempo);
});

let cached: CareerState | null = null;
function matchday(): { state: CareerState; fixtureId: string } {
  cached ??= createNewCareerState("tempo-kickoff-2026", "swe2-tumba", snapshotWorldSquads("swe-2"), undefined, snapshotGameplayRatings("swe-2"));
  const s = structuredClone(cached);
  const fixture = s.fixtures.find((f) => f.homeClubId === s.playerClubId || f.awayClubId === s.playerClubId)!;
  return { state: { ...s, gameDate: fixture.date, careerEvents: [buildMatchdayReadyEvent(fixture.id, fixture.date)] }, fixtureId: fixture.id };
}

test("each stored tempo reaches the engine at kickoff; existing careers play BALANCED", () => {
  for (const tempo of ["SLOW", "BALANCED", "QUICK", null] as const) {
    const { state, fixtureId } = matchday();
    const fixture = state.fixtures.find((f) => f.id === fixtureId)!;
    const plan = resolveClubMatchPlanForFixture(state.playerClubId, fixtureId, getCareerSquad(state), undefined)!;
    const stored = tempo === null ? state : { ...state, matchPlans: { [fixtureId]: { ...plan, attackPlan: { ...plan.attackPlan, tempo: attackPlanTempo(tempo) } } } };
    const session = createProductionSession(stored, fixture);
    const team = fixture.homeClubId === state.playerClubId ? "HOME" : "AWAY";
    const cpu = team === "HOME" ? "AWAY" : "HOME";
    assert.equal(session.core.coaching[team].tempo, tempo ?? "BALANCED", `stored ${tempo}`);
    assert.equal(session.core.coaching[cpu].tempo, "BALANCED", "the CPU side keeps its default plan");
    assert.equal(session.kickoffTactics?.[team].tempo, tempo ?? "BALANCED");
  }
});

test("a live tempo change applies to the engine and survives a save round-trip", () => {
  const { state, fixtureId } = matchday();
  const fixture = state.fixtures.find((f) => f.id === fixtureId)!;
  const team = fixture.homeClubId === state.playerClubId ? "HOME" : "AWAY";
  const running: CareerState = { ...state, productionMatch: createProductionSession(state, fixture) };
  const changed = commandProductionMatch(running, { kind: "TACTICS", team, patch: { tempo: "SLOW" } });
  assert.equal(changed.productionMatch!.core.coaching[team].tempo, "SLOW");
  assert.equal(changed.productionMatch!.core.events.at(-1)!.details.tempo, "SLOW");
  const reloaded = JSON.parse(JSON.stringify(changed)) as CareerState;
  assert.equal(reloaded.productionMatch!.core.coaching[team].tempo, "SLOW");
  assert.equal(reloaded.productionMatch!.kickoffTactics![team].tempo, "BALANCED");
});
