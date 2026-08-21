// Minimal persistent Team Tactical Profile (HM-TACTICS-0.6A).
//
// This is the ONE missing prerequisite the HM-TACTICS-0.6 audit
// identified: tactical-domain's ATI-001 x TI-001 resolver has no
// legitimate, non-invented game-state input to read from. This module
// adds exactly the three approved-vocabulary fields the audit asked
// for -- nothing else. It does NOT call the resolver, does NOT touch
// Fast Match, and does NOT modify packages/tactical-domain.
//
// Reuses H2Response and CapabilityLevel from @handball-manager/
// tactical-domain (type-only significance here) rather than
// redefining the same vocabulary a second time -- a type import is not
// an integration; nothing in this module executes tactical-domain code.
import type { CapabilityLevel, H2Response } from "@handball-manager/tactical-domain";

export type { CapabilityLevel, H2Response };

/** Bible S60: how strongly this team's tactical design favours attempting ATI-001 (the V9/M6 provoke-H2/H3 interaction) at all. Not a probability, not a player attribute -- a team-level design tendency, same three-value scale as CapabilityLevel. */
export type ATI001UsageTendency = CapabilityLevel;

/**
 * TeamTacticalProfile (Spec: "minimal persistent TeamTacticalProfile for
 * a career team"). Every field maps to an already-approved Bible v0.4
 * concept referenced in the HM-TACTICS-0.6 audit; none is a new
 * tactical concept, and none is a player attribute.
 */
export interface TeamTacticalProfile {
  /** Bible S60: team-level tendency to attempt the ATI-001 interaction. */
  ati001UsageTendency: ATI001UsageTendency;
  /** Bible S6/S60: TI-001's H2 Working Rule response this team's defensive design intends -- reuses tactical-domain's own H2Response vocabulary verbatim, never a locally-invented alternative. */
  h2ResponsePreference: H2Response;
  /** Bible S63: consistency between tactical intent, player interpretation, and the collective response -- a single team-level scalar in this minimal scope (HM-TACTICS-0.5's per-relationship familiarity split is not introduced here). */
  tacticalFamiliarity: CapabilityLevel;
}

/**
 * The ONE isolated provisional-neutral baseline (Spec: "one explicitly
 * named and isolated PROVISIONAL_NEUTRAL baseline approved for plumbing
 * only"). Used ONLY where a future tactical-domain call would require a
 * player capability/relationship-quality input this game has no real
 * data source for yet (e.g. individual H2/H3/V9/M6 PERCEIVE/TIME/
 * EXECUTE/RECOVER capability, or V9<->M6 relationship quality).
 *
 * This is NOT a player rating, NOT a real-world claim, and NOT to be
 * displayed anywhere as if it were scouted or measured ability -- it
 * exists purely so a future integration has a defined, honestly-labeled
 * placeholder instead of silently inventing per-player numbers. MEDIUM
 * is chosen deliberately: tactical-domain's own calibration multipliers
 * treat MEDIUM/NEUTRAL as "no modifier" (provisionalCalibration.ts), so
 * this baseline shapes nothing on its own.
 */
export const PROVISIONAL_NEUTRAL_CAPABILITY: CapabilityLevel = "MEDIUM";

/**
 * Deterministic default for every new career (Spec: "new careers
 * receive a deterministic default profile"). H2_STEPS is TI-001's own
 * central Working Rule response (Bible S6: "H2 may step/influence") --
 * not an arbitrary pick. Tendency/familiarity default to MEDIUM, the
 * same "no shaping yet" baseline as PROVISIONAL_NEUTRAL_CAPABILITY.
 */
export function defaultTeamTacticalProfile(): TeamTacticalProfile {
  return {
    ati001UsageTendency: "MEDIUM",
    h2ResponsePreference: "H2_STEPS",
    tacticalFamiliarity: "MEDIUM",
  };
}

export const ATI001_USAGE_TENDENCY_VALUES: readonly ATI001UsageTendency[] = ["LOW", "MEDIUM", "HIGH"];
export const TACTICAL_FAMILIARITY_VALUES: readonly CapabilityLevel[] = ["LOW", "MEDIUM", "HIGH"];
export const H2_RESPONSE_PREFERENCE_VALUES: readonly H2Response[] = ["H2_HOLDS", "H2_DELAYS", "H2_STEERS", "H2_STEPS", "H2_STOPS"];

/** Swedish display labels -- presentation only, never stored. */
export function h2ResponseLabel(response: H2Response): string {
  switch (response) {
    case "H2_HOLDS":
      return "Håll position";
    case "H2_DELAYS":
      return "Fördröj";
    case "H2_STEERS":
      return "Styr";
    case "H2_STEPS":
      return "Stig ut";
    case "H2_STOPS":
      return "Stoppa";
  }
}

export function capabilityLevelLabel(level: CapabilityLevel): string {
  switch (level) {
    case "LOW":
      return "Låg";
    case "MEDIUM":
      return "Medel";
    case "HIGH":
      return "Hög";
  }
}
