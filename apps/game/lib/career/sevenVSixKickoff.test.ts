// HM-ALPHA2-04D: the plan's 7v6 policy reaches the played match only when it
// is marked active; existing careers and CPU sides start in 6v6. The live
// control switches it, and it survives saves.
import test from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { snapshotWorldSquads, snapshotGameplayRatings } from "../gameWorld/serverSnapshot";
import { buildMatchdayReadyEvent } from "./careerEvents";
import { commandProductionMatch, createProductionSession } from "./productionMatch";
import { resolveClubMatchPlanForFixture } from "./playerMatchStrength";
import { getCareerSquad } from "./careerWorld";
import { engineSevenVSixMode, sevenVSixPolicyFor } from "../matchPlan/sevenVSix";
import type { CareerState } from "./types";

test("7v6 format: only an active policy starts a match in 7v6", () => {
  assert.equal(engineSevenVSixMode(undefined), "OFF");
  assert.equal(engineSevenVSixMode({ level: "SITUATIONAL", activeFromKickoff: false }), "OFF", "the never-shown default stays 6v6");
  assert.equal(engineSevenVSixMode({ level: "NEVER", activeFromKickoff: true }), "OFF");
  assert.equal(engineSevenVSixMode({ level: "SITUATIONAL", activeFromKickoff: true }), "SITUATIONAL");
  assert.equal(engineSevenVSixMode({ level: "FREQUENT", activeFromKickoff: true }), "ALWAYS");
  assert.equal(engineSevenVSixMode({ level: "PRIMARY", activeFromKickoff: true }), "ALWAYS");
  for (const mode of ["OFF", "SITUATIONAL", "ALWAYS"] as const) assert.equal(engineSevenVSixMode(sevenVSixPolicyFor(mode)), mode);
});

let cached: CareerState | null = null;
function matchday(): { state: CareerState; fixtureId: string } {
  cached ??= createNewCareerState("seven-v-six-kickoff-2026", "swe2-tumba", snapshotWorldSquads("swe-2"), undefined, snapshotGameplayRatings("swe-2"));
  const s = structuredClone(cached);
  const fixture = s.fixtures.find((f) => f.homeClubId === s.playerClubId || f.awayClubId === s.playerClubId)!;
  return { state: { ...s, gameDate: fixture.date, careerEvents: [buildMatchdayReadyEvent(fixture.id, fixture.date)] }, fixtureId: fixture.id };
}

test("kickoff: existing careers and CPU sides play 6v6; an active plan reaches the engine", () => {
  for (const mode of [null, "SITUATIONAL", "ALWAYS"] as const) {
    const { state, fixtureId } = matchday();
    const fixture = state.fixtures.find((f) => f.id === fixtureId)!;
    const plan = resolveClubMatchPlanForFixture(state.playerClubId, fixtureId, getCareerSquad(state), undefined)!;
    const stored = mode === null ? state : { ...state, matchPlans: { [fixtureId]: { ...plan, attackPlan: { ...plan.attackPlan, sevenVSixPolicy: sevenVSixPolicyFor(mode) } } } };
    const session = createProductionSession(stored, fixture);
    const team = fixture.homeClubId === state.playerClubId ? "HOME" : "AWAY";
    const cpu = team === "HOME" ? "AWAY" : "HOME";
    assert.equal(session.core.coaching[team].sevenVSix, mode ?? "OFF");
    assert.equal(session.core.coaching[cpu].sevenVSix, "OFF");
    assert.equal(session.kickoffTactics?.[team].sevenVSix, mode ?? "OFF");
    assert.equal(session.core.players.filter((p) => p.team === team && p.population === "COURT" && p.kind === "GOALKEEPER").length, 1, "every match starts with a keeper");
  }
});

test("a live 7v6 switch applies to the engine and survives a save round-trip", () => {
  const { state, fixtureId } = matchday();
  const fixture = state.fixtures.find((f) => f.id === fixtureId)!;
  const team = fixture.homeClubId === state.playerClubId ? "HOME" : "AWAY";
  const running: CareerState = { ...state, productionMatch: createProductionSession(state, fixture) };
  const changed = commandProductionMatch(running, { kind: "TACTICS", team, patch: { sevenVSix: "ALWAYS" } });
  assert.equal(changed.productionMatch!.core.coaching[team].sevenVSix, "ALWAYS");
  assert.equal(changed.productionMatch!.core.events.at(-1)!.details.sevenVSix, "ALWAYS");
  const reloaded = JSON.parse(JSON.stringify(changed)) as CareerState;
  assert.equal(reloaded.productionMatch!.core.coaching[team].sevenVSix, "ALWAYS");
  assert.equal(reloaded.productionMatch!.kickoffTactics![team].sevenVSix, "OFF");
});
