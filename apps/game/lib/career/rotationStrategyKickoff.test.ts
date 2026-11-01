// HM-ALPHA2-04C: the plan's rotation strategy and assistant switch reach the
// played match, change live, and survive saves. Older plans keep manual-only
// substitutions on BALANCED.
import test from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { snapshotWorldSquads, snapshotGameplayRatings } from "../gameWorld/serverSnapshot";
import { buildMatchdayReadyEvent } from "./careerEvents";
import { commandProductionMatch, createProductionSession } from "./productionMatch";
import { resolveClubMatchPlanForFixture } from "./playerMatchStrength";
import { getCareerSquad } from "./careerWorld";
import { assistantRotationAtKickoff, engineRotationStrategy } from "../matchPlan/rotationStrategy";
import type { TransitionPlanConfig } from "../matchPlan/types";
import type { CareerState } from "./types";

test("rotation format: missing or unknown values keep BALANCED with the assistant off", () => {
  assert.equal(engineRotationStrategy(undefined), "BALANCED");
  assert.equal(engineRotationStrategy({ rotationStrategy: "SHORT" }), "SHORT");
  assert.equal(engineRotationStrategy({ rotationStrategy: "WIDE" }), "WIDE");
  assert.equal(engineRotationStrategy({ rotationStrategy: "ALL" } as unknown as TransitionPlanConfig), "BALANCED");
  assert.equal(assistantRotationAtKickoff(undefined), false);
  assert.equal(assistantRotationAtKickoff({ assistantRotation: true }), true);
});

let cached: CareerState | null = null;
function matchday(): { state: CareerState; fixtureId: string } {
  cached ??= createNewCareerState("rotation-kickoff-2026", "swe2-tumba", snapshotWorldSquads("swe-2"), undefined, snapshotGameplayRatings("swe-2"));
  const s = structuredClone(cached);
  const fixture = s.fixtures.find((f) => f.homeClubId === s.playerClubId || f.awayClubId === s.playerClubId)!;
  return { state: { ...s, gameDate: fixture.date, careerEvents: [buildMatchdayReadyEvent(fixture.id, fixture.date)] }, fixtureId: fixture.id };
}

test("the stored strategy and assistant switch reach the engine; existing careers stay manual on BALANCED", () => {
  for (const stored of [null, { rotationStrategy: "SHORT", assistantRotation: true }, { rotationStrategy: "WIDE", assistantRotation: false }] as const) {
    const { state, fixtureId } = matchday();
    const fixture = state.fixtures.find((f) => f.id === fixtureId)!;
    const plan = resolveClubMatchPlanForFixture(state.playerClubId, fixtureId, getCareerSquad(state), undefined)!;
    const withPlan = stored === null ? state : { ...state, matchPlans: { [fixtureId]: { ...plan, transitionPlan: { ...plan.transitionPlan, ...stored } } } };
    const session = createProductionSession(withPlan, fixture);
    const team = fixture.homeClubId === state.playerClubId ? "HOME" : "AWAY";
    const cpu = team === "HOME" ? "AWAY" : "HOME";
    assert.equal(session.core.coaching[team].rotationStrategy, stored?.rotationStrategy ?? "BALANCED");
    assert.equal(session.core.coaching[team].rotation, stored?.assistantRotation ?? false);
    assert.equal(session.core.coaching[team].timeouts, false, "the manager keeps his own timeouts");
    assert.equal(session.core.coaching[cpu].rotation, true, "the CPU assistant always rotates");
    assert.equal(session.core.coaching[cpu].rotationStrategy, "BALANCED");
    assert.equal(session.kickoffTactics?.[team].rotationStrategy, stored?.rotationStrategy ?? "BALANCED");
  }
});

test("a live strategy change applies to the engine and survives a save round-trip", () => {
  const { state, fixtureId } = matchday();
  const fixture = state.fixtures.find((f) => f.id === fixtureId)!;
  const team = fixture.homeClubId === state.playerClubId ? "HOME" : "AWAY";
  const running: CareerState = { ...state, productionMatch: createProductionSession(state, fixture) };
  let changed = commandProductionMatch(running, { kind: "TACTICS", team, patch: { rotationStrategy: "WIDE" } });
  changed = commandProductionMatch(changed, { kind: "TACTICS", team, patch: { rotation: true } });
  assert.equal(changed.productionMatch!.core.coaching[team].rotationStrategy, "WIDE");
  const reloaded = JSON.parse(JSON.stringify(changed)) as CareerState;
  assert.equal(reloaded.productionMatch!.core.coaching[team].rotationStrategy, "WIDE");
  assert.equal(reloaded.productionMatch!.core.coaching[team].rotation, true);
  assert.equal(reloaded.productionMatch!.kickoffTactics![team].rotationStrategy, "BALANCED");
});
