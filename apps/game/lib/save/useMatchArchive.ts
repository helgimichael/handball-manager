'use client';
import { useEffect, useState } from 'react';
import { useCareer } from '../career/CareerContext';
import { getMatchArchiveById, type MatchArchive } from './saveRepository';

/** Component-local payload ownership: navigation releases the replay instead
 * of adding it to CareerState or a process-wide cache. */
export function useMatchArchive(archiveId: string, enabled = true) {
  const { career, save } = useCareer();
  const [attempt, setAttempt] = useState(0);
  const [read, setRead] = useState<{ key: string; archive: MatchArchive | null; error: string | null }>();
  const inline = enabled ? career.matchArchives?.[archiveId] : undefined;
  const exists = career.matchArchiveIds?.includes(archiveId) ?? false;
  const key = `${save.saveId}:${archiveId}:${attempt}`;
  useEffect(() => {
    if (!enabled || !archiveId || inline || !exists) return;
    let cancelled = false;
    void getMatchArchiveById(archiveId, save.saveId).then(archive => {
      if (!cancelled) setRead({ key, archive, error: archive ? null : 'Matcharkivet saknas. Återställ en komplett backup för att se reprisen.' });
    }).catch((cause: unknown) => {
      if (!cancelled) setRead({ key, archive: null, error: cause instanceof Error ? cause.message : 'Matcharkivet kunde inte läsas. Försök igen.' });
    });
    return () => { cancelled = true; };
  }, [archiveId, enabled, exists, inline, key, save.saveId]);
  return {
    archive: enabled ? inline ?? (read?.key === key ? read.archive : null) : null,
    loading: enabled && !!archiveId && exists && !inline && read?.key !== key,
    error: enabled && read?.key === key ? read.error : null,
    retry: () => setAttempt(value => value + 1),
  };
}
