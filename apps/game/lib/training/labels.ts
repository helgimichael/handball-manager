import type { TrainingDayType, TrainingSessionType } from './types';

export const DAY_TYPE_LABEL: Record<TrainingDayType, string> = {
  TRAINING: "Träning",
  RECOVERY: "Återhämtning",
  REST: "Vila",
  MATCH: "Match",
  TRAVEL: "Resa",
};

export const SESSION_TYPE_LABEL: Record<TrainingSessionType, string> = {
  TEAM_TACTICAL: "Lagtaktik",
  ATTACK: "Anfallsspel",
  DEFENCE: "Försvarsspel",
  TRANSITION: "Omställning",
  SPECIAL_PLAY: "Specialspel",
  TECHNICAL: "Teknik",
  PHYSICAL: "Fysik",
  STRENGTH: "Styrka",
  CONDITIONING: "Kondition",
  GOALKEEPER: "Målvakt",
  MATCH_PREPARATION: "Matchförberedelse",
  RECOVERY: "Återhämtning",
};
