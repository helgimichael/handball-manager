// Pure TeamTacticalProfile mutation (HM-TACTICS-0.6A), mirroring the
// existing inboxActions.ts pattern: kept separate from CareerContext.tsx
// so it's unit-testable without a browser/React environment.
import type { CareerState } from "./types";
import type { TeamTacticalProfile } from "./teamTacticalProfile";

/** Updates ONLY the manager's tacticalProfile -- every other field of CareerState is passed through unchanged (Spec: "changing controls updates only TeamTacticalProfile"). */
export function updateTacticalProfile(state: CareerState, changes: Partial<TeamTacticalProfile>): CareerState {
  return { ...state, tacticalProfile: { ...state.tacticalProfile, ...changes } };
}
