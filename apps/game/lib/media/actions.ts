// HM-ALPHA3-M08: the manager's media actions from the UI -- events they
// raise go to the event log and inbox like tick events.
import type { CareerEvent } from "../career/careerEvents";
import type { CareerState } from "../career/types";
import { withEvents } from "../manager/events";
import { appealCase, apologise } from "./discipline";
import { withMedia } from "./people";
import { answerPress, delegatePress, skipPress } from "./press";
import type { Tone } from "./types";

function run(state: CareerState, fn: (s: CareerState, emit: (e: CareerEvent) => void) => CareerState): CareerState {
  const events: CareerEvent[] = [];
  return withEvents(fn(state, (e) => events.push(e)), events);
}

export const answerPressAction = (state: CareerState, pressId: string, answers: Record<string, Tone>) => run(state, (s, emit) => answerPress(s, pressId, answers, emit));
export const delegatePressAction = (state: CareerState, pressId: string) => run(state, (s, emit) => delegatePress(s, pressId, emit));
export const skipPressAction = (state: CareerState, pressId: string) => run(state, (s, emit) => skipPress(s, pressId, emit));
export const appealAction = (state: CareerState, caseId: string) => appealCase(state, caseId);
export const apologiseAction = (state: CareerState, caseId: string) => apologise(state, caseId);
export const setRoutinePressDelegation = (state: CareerState, on: boolean) => withMedia(state, (m) => ({ ...m, delegatePress: on }));
