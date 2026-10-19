import { getClubsByCompetition, type PlayerMock } from '../game-data';

export const SQUAD_SNAPSHOT_ERROR = 'Kunde inte ladda spelartrupper. Kontrollera anslutningen och försök igen.';

/** A successful HTTP response is insufficient: every real club in the league
 * needs a usable roster before a career can be published. */
export async function fetchWorldSquads(competitionId: string): Promise<Record<string, PlayerMock[]>> {
  try {
    const response = await fetch(`/api/game-world/squad-snapshot?competitionId=${encodeURIComponent(competitionId)}`);
    if (!response.ok) throw new Error('Squad snapshot HTTP failure');
    const data: unknown = await response.json();
    const squads = data && typeof data === 'object' ? (data as { worldSquads?: unknown }).worldSquads : undefined;
    if (!squads || typeof squads !== 'object' || Array.isArray(squads)) throw new Error('Missing squad snapshot');
    const expected = getClubsByCompetition(competitionId).filter(club => club.dataSource === 'REAL_WORLD');
    const snapshot = squads as Record<string, PlayerMock[]>;
    const positions = new Set(['MV', 'V6', 'V9', 'M9', 'H9', 'H6', 'M6']);
    for (const club of expected) {
      const roster = snapshot[club.id];
      if (!Array.isArray(roster) || !roster.length || roster.some(p => !p || typeof p.id !== 'string' || !p.id || !positions.has(p.position))
        || new Set(roster.map(p => p.id)).size !== roster.length) throw new Error('Incomplete squad snapshot');
      if (club.playable && (roster.filter(p => p.position === 'MV').length < 1 || roster.filter(p => p.position !== 'MV').length < 6)) throw new Error('Unplayable squad snapshot');
    }
    return snapshot;
  } catch (cause) {
    throw new Error(SQUAD_SNAPSHOT_ERROR, { cause });
  }
}
