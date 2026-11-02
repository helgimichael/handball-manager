import type { FastMatchResult } from '@handball-manager/game-simulation';
import { startProductionMatch, finishProductionMatch } from './productionMatch';
import { getPlayerFixtureOn } from './calendar';
import type { CareerState } from './types';
export { buildMatchRoster, buildFallbackAttackExposure } from './tumbaRoster';
export interface PlayManagerFixtureResult { state: CareerState; result: FastMatchResult | null }
/** Direct result and scripted play complete the same production match session.
 * HM-ALPHA3-M10: a match started here is played without the manager on the bench, so the assistant coaches it. */
export function playManagerFixture(state: CareerState): PlayManagerFixtureResult {
  const fixture = state.productionMatch?.fixture ?? getPlayerFixtureOn(state, state.gameDate);
  const next = finishProductionMatch(startProductionMatch(state, undefined, { quick: true }));
  return { state: next, result: fixture ? next.results[fixture.id] ?? null : null };
}
