// HM-ALPHA2-03B: the tactics page wrote "6:0"/"5:1" while kickoff accepted
// only "6-0"/"5-1". Both formations -- in both stored formats -- must start.
import test from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { snapshotWorldSquads, snapshotGameplayRatings } from "../gameWorld/serverSnapshot";
import { buildMatchdayReadyEvent } from "./careerEvents";
import { createProductionSession } from "./productionMatch";
import { resolveClubMatchPlanForFixture } from "./playerMatchStrength";
import { getCareerSquad } from "./careerWorld";
import { engineDefenceSystem, isPlayableBaseFormation, normalizeBaseFormation } from "../matchPlan/defenceFormation";
import type { CareerState } from "./types";

test("formation format: one canonical stored form, both forms accepted", () => {
  assert.equal(normalizeBaseFormation("6:0"), "6-0");
  assert.equal(normalizeBaseFormation("5:1"), "5-1");
  assert.equal(normalizeBaseFormation("5-1"), "5-1");
  for (const f of ["6:0", "6-0", "5:1", "5-1"]) assert.ok(isPlayableBaseFormation(f), f);
  for (const f of ["3-2-1", "4-2", "3:3"]) assert.equal(isPlayableBaseFormation(f), false, f);
  assert.equal(engineDefenceSystem("5:1"), "5:1");
  assert.equal(engineDefenceSystem("5-1"), "5:1");
  assert.equal(engineDefenceSystem("6:0"), "6:0");
  assert.equal(engineDefenceSystem(undefined), "6:0");
});

let cached: CareerState | null = null;
function matchday(): { state: CareerState; fixtureId: string } {
  cached ??= createNewCareerState("formation-kickoff-2026", "swe2-tumba", snapshotWorldSquads("swe-2"), undefined, snapshotGameplayRatings("swe-2"));
  const s = structuredClone(cached);
  const fixture = s.fixtures.find((f) => f.homeClubId === s.playerClubId || f.awayClubId === s.playerClubId)!;
  return { state: { ...s, gameDate: fixture.date, careerEvents: [buildMatchdayReadyEvent(fixture.id, fixture.date)] }, fixtureId: fixture.id };
}

test("both formations start a match from either stored format, and reach the engine", () => {
  for (const [stored, engine] of [["6:0", "6:0"], ["6-0", "6:0"], ["5:1", "5:1"], ["5-1", "5:1"]] as const) {
    const { state, fixtureId } = matchday();
    const fixture = state.fixtures.find((f) => f.id === fixtureId)!;
    const plan = resolveClubMatchPlanForFixture(state.playerClubId, fixtureId, getCareerSquad(state), undefined)!;
    const withPlan: CareerState = { ...state, matchPlans: { [fixtureId]: { ...plan, defencePlan: { ...plan.defencePlan, baseFormation: stored } } } };
    const session = createProductionSession(withPlan, fixture);
    const team = fixture.homeClubId === state.playerClubId ? "HOME" : "AWAY";
    assert.equal(session.core.coaching[team].defence, engine, `stored ${stored}`);
  }
});

test("an unsupported formation is still refused with the existing message", () => {
  const { state, fixtureId } = matchday();
  const fixture = state.fixtures.find((f) => f.id === fixtureId)!;
  const plan = resolveClubMatchPlanForFixture(state.playerClubId, fixtureId, getCareerSquad(state), undefined)!;
  assert.throws(() => createProductionSession({ ...state, matchPlans: { [fixtureId]: { ...plan, defencePlan: { ...plan.defencePlan, baseFormation: "3-2-1" } } } }, fixture), /Välj 6–0 eller 5–1/);
});
