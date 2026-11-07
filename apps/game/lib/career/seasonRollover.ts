import type { CareerState } from './types';
import { attemptSeasonTransition, type SeasonTransitionRequest, type SeasonTransitionResult } from './seasonTransition';
export { attemptSeasonTransition } from './seasonTransition';

export class SeasonTransitionBlockedError extends Error {
  constructor(readonly result: SeasonTransitionResult) {
    super(result.blockers.map((b) => `${b.code} (${b.ref}): ${b.message}`).join('\n'));
    this.name = 'SeasonTransitionBlockedError';
  }
}

/** Script compatibility API: blocked completed seasons fail explicitly.
 * Interactive callers should consume attemptSeasonTransition's structured result. */
export function rolloverSeason(input: CareerState, request?: SeasonTransitionRequest): CareerState {
  if (!input.seasonComplete || input.productionMatch || input.activeMatchSession) return input;
  const result = attemptSeasonTransition(input, request);
  if (result.status === 'BLOCKED') throw new SeasonTransitionBlockedError(result);
  return result.state;
}
