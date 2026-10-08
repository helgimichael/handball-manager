import type { Interpretation, MissingDataState, ObservedPattern } from '@/lib/analysis/types';

export function missingAnalysisLabel(state: MissingDataState): string {
  return state === 'NO_MATCHES_YET' ? 'Ingen spelad match den här säsongen ännu.' : state === 'INSUFFICIENT_DATA' ? 'För litet matchunderlag för den här jämförelsen.' : 'Den här uppgiften finns inte i det registrerade matchunderlaget.';
}
export function patternLabel(pattern: ObservedPattern): string {
  const { evidence: e, ruleId } = pattern;
  if (ruleId === 'SCORING_CONSISTENCY' && Number.isFinite(e.minGoals) && Number.isFinite(e.matches)) return `Minst ${e.minGoals} mål i var och en av de senaste ${e.matches} matcherna.`;
  if (!Number.isFinite(e.recent) || !Number.isFinite(e.season)) return pattern.statement;
  if (e.recent === e.season) {
    const subject = { RECENT_SCORING_VS_SEASON:'Målproduktion', CONCEDED_TREND:'Insläppta mål', TURNOVER_FREQUENCY:'Bollförluster', GOALKEEPER_OUTPUT:'Målvaktsräddningar' }[ruleId as 'RECENT_SCORING_VS_SEASON'];
    if (subject) return `${subject}: ${e.recent}/match på sistone och ${e.season}/match under säsongen, med avrundade värden.`;
  }
  if (ruleId === 'RECENT_SCORING_VS_SEASON') return `Målproduktionen på sistone (${e.recent}/match) ligger ${e.recent > e.season ? 'över' : 'under'} säsongssnittet (${e.season}/match).`;
  if (ruleId === 'CONCEDED_TREND') return `Laget har släppt in ${e.recent < e.season ? 'färre' : 'fler'} mål på sistone (${e.recent}/match) än säsongssnittet (${e.season}/match).`;
  if (ruleId === 'TURNOVER_FREQUENCY') return `Bollförlusterna på sistone (${e.recent}/match) är ${e.recent > e.season ? 'fler' : 'färre'} än säsongssnittet (${e.season}/match).`;
  if (ruleId === 'GOALKEEPER_OUTPUT') return `Målvakternas räddningar på sistone (${e.recent}/match) ligger ${e.recent > e.season ? 'över' : 'under'} säsongssnittet (${e.season}/match).`;
  return pattern.statement;
}
const INTERPRETATIONS: Record<string,string> = {
  OFFENSIVE_PRODUCTION_STABLE: 'Målproduktionen har varit stabil i de senaste matcherna.',
  RECENT_SCORING_ABOVE_AVERAGE: 'Målproduktionen på sistone ligger över säsongssnittet.',
  TURNOVERS_ABOVE_AVERAGE: 'De senaste matcherna har innehållit fler bollförluster än säsongssnittet.',
  GOALKEEPER_OUTPUT_INCREASED: 'Målvakternas antal räddningar har ökat på sistone.',
  CONCEDED_FEWER_RECENTLY: 'Laget har släppt in färre mål på sistone.',
};
export function interpretationLabel(interpretation: Interpretation): string { return INTERPRETATIONS[interpretation.ruleId] ?? interpretation.statement; }
export const ANALYSIS_EVENT_LABEL: Record<string,string> = { GOAL:'Mål', SAVE:'Räddning', TURNOVER:'Bollförlust', TWO_MIN:'Två minuters utvisning', SEVEN_M:'7 meter', MISS:'Missat skott' };
