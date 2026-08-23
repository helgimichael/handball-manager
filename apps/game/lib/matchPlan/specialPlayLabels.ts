// HM-MATCH-1.2: Swedish coaching-language labels for the SPECIALSPEL
// domain (specialPlay.ts) -- mirrors matchPlanLabels.ts's own role for
// the rest of MatchPlan, never raw enum keys in the UI.
import type {
  DefensiveSpecialCentralFocus,
  DefensiveSpecialEmptyGoal,
  DefensiveSpecialPress,
  DefensiveSpecialRisk,
  FiveVSixGoalkeeperChoice,
  FiveVSixIntent,
  SixVFivePriority,
  SixVFiveRisk,
  SixVFiveTempo,
} from "./specialPlay";

export const SIX_V_FIVE_TEMPO_LABELS_SV: Record<SixVFiveTempo, string> = {
  CONTROLLED: "Kontrollerat",
  NORMAL: "Normalt",
  FAST: "Snabbt",
};

export const SIX_V_FIVE_RISK_LABELS_SV: Record<SixVFiveRisk, string> = {
  SAFETY_FIRST: "Säkerhet först",
  BALANCED: "Balanserat",
  AGGRESSIVE: "Aggressivt",
};

export const SIX_V_FIVE_PRIORITY_LABELS_SV: Record<SixVFivePriority, string> = {
  WIDTH: "Bredd",
  PIVOT: "M6",
  CIRCULATION: "Bollcirkulation / klart läge",
  NORMAL: "Normal",
};

export const FIVE_V_SIX_GOALKEEPER_CHOICE_LABELS_SV: Record<FiveVSixGoalkeeperChoice, string> = {
  KEEP_GK: "Målvakt kvar",
  SIX_OUTCOURT: "Ta ut målvakten / 6 utespelare",
};

export const FIVE_V_SIX_INTENT_LABELS_SV: Record<FiveVSixIntent, string> = {
  SLOW_TEMPO: "Dra ner tempo",
  PROTECT_BALL: "Skydda boll",
  BALANCED: "Balanserat",
  CONTINUE_ATTACKING: "Fortsätt attackera",
};

export const DEFENSIVE_SPECIAL_PRESS_LABELS_SV: Record<DefensiveSpecialPress, string> = {
  LOW: "Låg",
  NORMAL: "Normal",
  HIGH: "Hög",
};

export const DEFENSIVE_SPECIAL_CENTRAL_FOCUS_LABELS_SV: Record<DefensiveSpecialCentralFocus, string> = {
  NORMAL: "Normal",
  PROTECT_CENTER: "Skydda M6/centrum",
};

export const DEFENSIVE_SPECIAL_RISK_LABELS_SV: Record<DefensiveSpecialRisk, string> = {
  CAUTIOUS: "Försiktig",
  BALANCED: "Balanserad",
  AGGRESSIVE: "Aggressiv",
};

export const DEFENSIVE_SPECIAL_EMPTY_GOAL_LABELS_SV: Record<DefensiveSpecialEmptyGoal, string> = {
  SAFETY_FIRST: "Säkerhet först",
  SEEK_OPPORTUNITY: "Sök möjlighet",
};
