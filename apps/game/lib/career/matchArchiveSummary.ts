import type { CareerState } from './types';
import type { PlayedMatchArchive } from './productionMatch';

export type MatchArchiveSummary = Pick<PlayedMatchArchive, 'fixture' | 'result' | 'load'>;

export function summarizeMatchArchive(archive: PlayedMatchArchive): MatchArchiveSummary {
  return { fixture: archive.fixture, result: archive.result, load: archive.load };
}

/** Lists/history use small summaries, never replay frames or engine events. */
export function careerArchiveSummaries(state: CareerState): Record<string, MatchArchiveSummary> {
  const summaries = { ...state.matchArchiveSummaries };
  for (const id of state.matchArchiveIds ?? []) {
    if (summaries[id]) continue;
    const fixture = state.fixtures?.find(f => f.id === id);
    const result = state.results?.[id];
    if (fixture && result) summaries[id] = { fixture, result, load: {} };
  }
  for (const [id, archive] of Object.entries(state.matchArchives ?? {})) summaries[id] = summarizeMatchArchive(archive);
  return summaries;
}

/** Only discard payloads after their archive writes have committed. */
export function withoutReplayPayloads(state: CareerState): CareerState {
  const inline = Object.keys(state.matchArchives ?? {});
  if (!inline.length) return state;
  return { ...state, matchArchives: undefined,
    matchArchiveIds: [...new Set([...(state.matchArchiveIds ?? []), ...inline])],
    matchArchiveSummaries: careerArchiveSummaries(state),
  };
}
