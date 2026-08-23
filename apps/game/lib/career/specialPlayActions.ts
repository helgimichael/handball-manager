// HM-MATCH-1.2 Part H: pure Specialspel persistence, mirroring
// matchPlanActions.ts's/tacticalProfileActions.ts's exact pattern --
// kept separate from CareerContext.tsx so it's unit-testable without a
// browser/React environment. Targeted at ONE club's entry in
// `career.specialPlay`.
import type { SpecialPlayPlan } from "../matchPlan/specialPlay";
import type { CareerState } from "./types";

export function setSpecialPlayPlan(state: CareerState, clubId: string, plan: SpecialPlayPlan): CareerState {
  return { ...state, specialPlay: { ...state.specialPlay, [clubId]: plan } };
}
