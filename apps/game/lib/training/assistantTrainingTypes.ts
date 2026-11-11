import type { PlayerTrainingAssignment, TrainingWeek, WeeklyTrainingTemplate } from './types';
import type { IndividualDevelopmentFocus } from '../development/types';

export interface TrainingPlayerRecommendation {
  playerId: string;
  loadSetting: PlayerTrainingAssignment['loadSetting'];
  individualFocus: IndividualDevelopmentFocus;
  reason: string;
  /** Individual instructions are never applied without the manager selecting them. */
  selected: boolean;
  baseline?: PlayerTrainingAssignment;
}

export interface AssistantTrainingPlan {
  clubId: string;
  week: TrainingWeek;
  template: WeeklyTrainingTemplate;
  generatedOn: string;
  staffName: string;
  reasons: string[];
  fixtures: string;
  baselineWeek?: TrainingWeek;
  players: TrainingPlayerRecommendation[];
  teamApplied?: boolean;
}
