import type { CareerState } from '../career/types';
import { advanceProductionMatch } from '../career/productionMatch';
export const DEFAULT_MATCH_MODE = 'MATCH_CENTER';
/** Speed selects a tick budget. Stops never alter a canonical tick or its RNG. */
export function advanceMatchCenter(state: CareerState, ticks: number, keyMoments = false, onStop?: () => void): CareerState {
    return advanceProductionMatch(state, ticks, true, undefined, (core, events) => {
        const stop = events.some(e => e.type === 'TEAM_TIMEOUT_STARTED' || keyMoments && (['TWO_MINUTE_SUSPENSION', 'DISQUALIFICATION'].includes(e.type) || e.type === 'WHISTLE_RESTART' && e.details.kind === 'SEVEN_METRE' || e.type === 'GOAL' && (e.officialMs >= 55 * 60000 || Math.abs(core.score.HOME - core.score.AWAY) === 1)));
        if (stop)
            onStop?.();
        return stop;
    });
}
export function resumeMatchTimeout(state: CareerState): CareerState {
    const s = state.productionMatch, timeout = s?.core.referee.timeout;
    return s && timeout?.reason === 'TEAM_TIMEOUT' ? advanceProductionMatch(state, Math.max(1, timeout.untilTick - s.core.tick + 1)) : state;
}
