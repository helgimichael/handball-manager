// HM-ALPHA2-04A: the plan's pressure/risk dials reach the played match as one
// defensive-aggression instruction, before kickoff and live, and survive saves.
import test from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { snapshotWorldSquads, snapshotGameplayRatings } from "../gameWorld/serverSnapshot";
import { buildMatchdayReadyEvent } from "./careerEvents";
import { commandProductionMatch, createProductionSession } from "./productionMatch";
import { resolveClubMatchPlanForFixture } from "./playerMatchStrength";
import { getCareerSquad } from "./careerWorld";
import { defencePlanAggression, engineDefensiveAggression } from "../matchPlan/defensiveAggression";
import type { DefencePlanConfig } from "../matchPlan/types";
import type { CareerState } from "./types";

test("aggression format: plan dials map to one engine level and back", () => {
  assert.equal(engineDefensiveAggression({ ballOrientedPressure: "LOW" }), "LOW");
  assert.equal(engineDefensiveAggression({ ballOrientedPressure: "MEDIUM" }), "BALANCED");
  assert.equal(engineDefensiveAggression({ ballOrientedPressure: "HIGH" }), "HIGH");
  assert.equal(engineDefensiveAggression(undefined), "BALANCED");
  assert.equal(engineDefensiveAggression({ ballOrientedPressure: "EXTREME" } as unknown as DefencePlanConfig), "BALANCED", "an invalid stored value plays BALANCED");
  for (const level of ["LOW", "BALANCED", "HIGH"] as const) assert.equal(engineDefensiveAggression(defencePlanAggression(level)), level);
  assert.deepEqual(defencePlanAggression("BALANCED"), { ballOrientedPressure: "MEDIUM", riskLevel: "MEDIUM" });
});

let cached: CareerState | null = null;
function matchday(): { state: CareerState; fixtureId: string } {
  cached ??= createNewCareerState("aggression-kickoff-2026", "swe2-tumba", snapshotWorldSquads("swe-2"), undefined, snapshotGameplayRatings("swe-2"));
  const s = structuredClone(cached);
  const fixture = s.fixtures.find((f) => f.homeClubId === s.playerClubId || f.awayClubId === s.playerClubId)!;
  return { state: { ...s, gameDate: fixture.date, careerEvents: [buildMatchdayReadyEvent(fixture.id, fixture.date)] }, fixtureId: fixture.id };
}

test("each stored level reaches the engine at kickoff; existing careers play BALANCED", () => {
  for (const level of ["LOW", "BALANCED", "HIGH", null] as const) {
    const { state, fixtureId } = matchday();
    const fixture = state.fixtures.find((f) => f.id === fixtureId)!;
    const plan = resolveClubMatchPlanForFixture(state.playerClubId, fixtureId, getCareerSquad(state), undefined)!;
    // null: a career that never touched the control keeps the default plan.
    const stored = level === null ? state : { ...state, matchPlans: { [fixtureId]: { ...plan, defencePlan: { ...plan.defencePlan, ...defencePlanAggression(level) } } } };
    const session = createProductionSession(stored, fixture);
    const team = fixture.homeClubId === state.playerClubId ? "HOME" : "AWAY";
    const cpu = team === "HOME" ? "AWAY" : "HOME";
    assert.equal(session.core.coaching[team].aggression, level ?? "BALANCED", `stored ${level}`);
    assert.equal(session.core.coaching[cpu].aggression, "BALANCED", "the CPU side keeps its default plan");
    assert.deepEqual(session.kickoffTactics?.[team].aggression, level ?? "BALANCED");
  }
});

test("a live change applies to the engine and survives a save round-trip", () => {
  const { state, fixtureId } = matchday();
  const fixture = state.fixtures.find((f) => f.id === fixtureId)!;
  const team = fixture.homeClubId === state.playerClubId ? "HOME" : "AWAY";
  const running: CareerState = { ...state, productionMatch: createProductionSession(state, fixture) };
  const changed = commandProductionMatch(running, { kind: "TACTICS", team, patch: { aggression: "LOW" } });
  assert.equal(changed.productionMatch!.core.coaching[team].aggression, "LOW");
  const event = changed.productionMatch!.core.events.at(-1)!;
  assert.equal(event.type, "TACTICS_CHANGED");
  assert.equal(event.details.aggression, "LOW");
  const reloaded = JSON.parse(JSON.stringify(changed)) as CareerState;
  assert.equal(reloaded.productionMatch!.core.coaching[team].aggression, "LOW");
  assert.equal(reloaded.productionMatch!.kickoffTactics![team].aggression, "BALANCED");
});
