// HM-STAFF-1.0 Part 26: human-facing Swedish labels for staff roles and
// attributes -- no raw code labels (TACTICAL_COACHING, HEAD_COACH, ...)
// ever shown in normal UI.
import type { StaffAttribute, StaffRole } from "./types";

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  HEAD_COACH: "Huvudtränare",
  ASSISTANT_COACH: "Assisterande tränare",
  GOALKEEPER_COACH: "Målvaktstränare",
  PHYSICAL_COACH: "Fystränare",
  ANALYST: "Analytiker",
  PHYSIO: "Fysioterapeut",
  SCOUT: "Scout",
};

export const STAFF_ATTRIBUTE_LABEL: Record<StaffAttribute, string> = {
  TECHNICAL_COACHING: "Teknikträning",
  TACTICAL_COACHING: "Taktisk träning",
  DEFENSIVE_COACHING: "Försvarsträning",
  ATTACKING_COACHING: "Anfallsträning",
  GOALKEEPER_COACHING: "Målvaktsträning",
  PHYSICAL_COACHING: "Fysisk träning",
  PLAYER_DEVELOPMENT: "Spelarutveckling",
  YOUTH_DEVELOPMENT: "Ungdomsutveckling",
  LEADERSHIP: "Ledarskap",
  COMMUNICATION: "Kommunikation",
  MOTIVATION: "Motivation",
  ANALYSIS: "Analys",
  MATCH_PREPARATION: "Matchförberedelse",
  MEDICAL: "Medicin/rehab",
  PLAYER_JUDGEMENT: "Spelarbedömning",
  POTENTIAL_JUDGEMENT: "Potentialbedömning",
};
