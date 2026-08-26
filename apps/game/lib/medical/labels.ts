// HM-INJURIES-1.0 Part 6/30: Swedish UI labels only -- domain types stay English.
import type { InjuryType, InjurySeverity, RehabPhase } from "./types";

export const INJURY_TYPE_LABELS: Record<InjuryType, string> = {
  ANKLE_SPRAIN: "Fotledsstukning",
  KNEE_SPRAIN: "Knädistorsion",
  HAMSTRING_STRAIN: "Baksidesskada (lår)",
  CALF_STRAIN: "Vadskada",
  SHOULDER_OVERUSE: "Överbelastning, axel",
  SHOULDER_TRAUMA: "Axelskada (trauma)",
  BACK_PAIN: "Ryggbesvär",
  HAND_FINGER_INJURY: "Hand-/fingerskada",
  HEAD_CONCUSSION: "Hjärnskakning",
  GENERAL_OVERUSE: "Allmän överbelastning",
  ACL_TEAR: "Korsbandsskada",
};

export const INJURY_SEVERITY_LABELS: Record<InjurySeverity, string> = {
  MINOR: "Lindrig",
  MODERATE: "Måttlig",
  MAJOR: "Allvarlig",
  SEVERE: "Mycket allvarlig",
};

export const REHAB_PHASE_LABELS: Record<RehabPhase, string> = {
  ACUTE: "Akut fas",
  REHAB: "Rehabilitering",
  RETURN_TO_TRAINING: "Tillbaka i träning",
  RETURN_TO_PLAY: "Tillbaka i spel",
};
