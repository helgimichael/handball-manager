// HM-STAFF-1.0 Part 26: human-facing Swedish labels for staff roles and
// attributes -- no raw code labels (TACTICAL_COACHING, HEAD_COACH, ...)
// ever shown in normal UI.
import type { StaffAttribute, StaffEmploymentType, StaffRole } from "./types";

export const STAFF_EMPLOYMENT_TYPE_LABEL: Record<StaffEmploymentType, string> = {
  SALARIED: "Anställd",
  VOLUNTARY: "Frivillig/oavlönad",
  GOVERNANCE: "Styrelse/ledning",
};

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  HEAD_COACH: "Huvudtränare",
  ASSISTANT_COACH: "Assisterande tränare",
  GOALKEEPER_COACH: "Målvaktstränare",
  PHYSICAL_COACH: "Fystränare",
  ANALYST: "Analytiker",
  PHYSIO: "Fysioterapeut",
  SCOUT: "Scout",
  SPORTING_DIRECTOR: "Sportchef",
  TEAM_MANAGER: "Lagledare",
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
  RECRUITMENT: "Rekrytering",
  NEGOTIATION: "Förhandling",
  SQUAD_PLANNING: "Truppplanering",
  FINANCIAL_JUDGEMENT: "Ekonomiskt omdöme",
  ORGANISATION: "Organisation",
  LOGISTICS: "Logistik",
  TEAM_ENVIRONMENT: "Lagmiljö",
  TACTICAL_ASSESSMENT: "Taktisk bedömning",
  NETWORK: "Nätverk",
  REGIONAL_KNOWLEDGE: "Regional kunskap",
  INTERNATIONAL_KNOWLEDGE: "Internationell kunskap",
};
