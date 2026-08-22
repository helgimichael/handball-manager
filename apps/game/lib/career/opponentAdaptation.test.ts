import { test } from "node:test";
import assert from "node:assert/strict";
import { detectOpponentAdaptationTrigger, OPPONENT_ADAPTATION_TRIGGER_MINUTES, type ObservableTacticalState } from "./opponentAdaptation";

function baseState(overrides: Partial<ObservableTacticalState> = {}): ObservableTacticalState {
  return {
    sevenVSixActive: false,
    sevenVSixActiveSinceMinute: null,
    ati001UsageTendency: "MEDIUM",
    ati001HighSinceMinute: null,
    ...overrides,
  };
}

test("no adaptation if there is nothing supported to react to: an entirely neutral state never triggers", () => {
  assert.equal(detectOpponentAdaptationTrigger(baseState(), 30), null);
});

test("no adaptation if there is nothing supported to react to: 7v6 active but not yet persisted long enough", () => {
  const state = baseState({ sevenVSixActive: true, sevenVSixActiveSinceMinute: 30 - (OPPONENT_ADAPTATION_TRIGGER_MINUTES - 1) });
  assert.equal(detectOpponentAdaptationTrigger(state, 30), null);
});

test("no adaptation if there is nothing supported to react to: HIGH ati001 usage but not yet persisted long enough", () => {
  const state = baseState({ ati001UsageTendency: "HIGH", ati001HighSinceMinute: 30 - (OPPONENT_ADAPTATION_TRIGGER_MINUTES - 1) });
  assert.equal(detectOpponentAdaptationTrigger(state, 30), null);
});

test("7v6 sustained for at least the trigger window triggers SEVEN_V_SIX", () => {
  const state = baseState({ sevenVSixActive: true, sevenVSixActiveSinceMinute: 30 - OPPONENT_ADAPTATION_TRIGGER_MINUTES });
  assert.equal(detectOpponentAdaptationTrigger(state, 30), "SEVEN_V_SIX");
});

test("ati001UsageTendency HIGH sustained for at least the trigger window triggers ATI001_HIGH", () => {
  const state = baseState({ ati001UsageTendency: "HIGH", ati001HighSinceMinute: 30 - OPPONENT_ADAPTATION_TRIGGER_MINUTES });
  assert.equal(detectOpponentAdaptationTrigger(state, 30), "ATI001_HIGH");
});

test("7v6 is checked first when both would independently qualify -- a fixed, documented tie-break, never a hidden priority", () => {
  const state = baseState({
    sevenVSixActive: true,
    sevenVSixActiveSinceMinute: 30 - OPPONENT_ADAPTATION_TRIGGER_MINUTES,
    ati001UsageTendency: "HIGH",
    ati001HighSinceMinute: 30 - OPPONENT_ADAPTATION_TRIGGER_MINUTES,
  });
  assert.equal(detectOpponentAdaptationTrigger(state, 30), "SEVEN_V_SIX");
});

test("7v6 no longer active never triggers, regardless of how long ago it was active", () => {
  const state = baseState({ sevenVSixActive: false, sevenVSixActiveSinceMinute: 5 });
  assert.equal(detectOpponentAdaptationTrigger(state, 30), null);
});

test("ati001UsageTendency no longer HIGH never triggers, regardless of how long ago it was HIGH", () => {
  const state = baseState({ ati001UsageTendency: "MEDIUM", ati001HighSinceMinute: 5 });
  assert.equal(detectOpponentAdaptationTrigger(state, 30), null);
});

test("deterministic: identical state and minute always resolve identically", () => {
  const state = baseState({ sevenVSixActive: true, sevenVSixActiveSinceMinute: 10 });
  assert.equal(detectOpponentAdaptationTrigger(state, 30), detectOpponentAdaptationTrigger(state, 30));
});
