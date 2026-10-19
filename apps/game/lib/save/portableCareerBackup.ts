import type { PlayedMatchArchive } from '../career/productionMatch';
import type { CareerSave } from './saveRepository';

export interface PortableCareerBackup {
  backupVersion: 1;
  exportedAt: string;
  save: CareerSave;
  archives: Record<string, unknown>;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string' && v.length > 0);
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function invalid(message: string): never {
  throw new Error(`Sparafilen är ogiltig: ${message}`);
}

/** Validate the file boundary before any storage writes. Older supported saves
 * retain their schema version so the normal career loader can migrate them. */
export function validatePortableCareerBackup(value: unknown, currentSchema: number): PortableCareerBackup {
  if (!record(value)) invalid('välj en exporterad Handball Manager-sparafil.');
  if (value.backupVersion !== 1) invalid('backupversionen stöds inte. Exportera filen med en kompatibel spelversion.');
  if (!text(value.exportedAt) || !Number.isFinite(Date.parse(value.exportedAt))) invalid('exportdatum saknas eller kan inte läsas.');
  const save = value.save;
  if (!record(save)) invalid('karriären saknas.');
  if (!Number.isInteger(save.schemaVersion) || (save.schemaVersion as number) < 1 || (save.schemaVersion as number) > currentSchema) {
    invalid(`sparaversionen stöds inte. Spelet kan läsa version 1–${currentSchema}. Uppdatera spelet om filen är nyare.`);
  }
  if (!text(save.saveId) || !text(save.clubId) || !text(save.gameDate) || !text(save.createdAt) || !text(save.lastPlayedAt)
    || !strings(save.selectedNations) || !strings(save.selectedCompetitionIds)) invalid('karriärens grunduppgifter saknas.');
  if (!record(save.manager) || !text(save.manager.name) || !text(save.manager.nationality) || !text(save.manager.dateOfBirth)) invalid('manageruppgifterna saknas.');
  if (save.preseasonStart !== undefined && !['8_WEEKS', '6_WEEKS', '4_WEEKS', '2_WEEKS', 'FIRST_MATCH'].includes(String(save.preseasonStart))) invalid('försäsongsvalet stöds inte.');
  if (!record(value.archives)) invalid('matcharkiven saknas.');

  const career = save.careerState;
  let archiveIds: string[] = [];
  if (career !== undefined) {
    if (!record(career) || !['seasonId', 'competitionId', 'playerClubId', 'gameDate', 'saveSeed'].every(k => text(career[k]))
      || typeof career.seasonComplete !== 'boolean' || !Array.isArray(career.fixtures) || !Array.isArray(career.inbox)
      || !record(career.results) || !record(career.playerSeasonStats) || !record(career.clubForm)) invalid('karriärens speltillstånd är ofullständigt.');
    if (career.playerClubId !== save.clubId || career.gameDate !== save.gameDate) invalid('klubb eller speldatum stämmer inte med karriären.');
    for (const key of ['worldSquads', 'gameplayRatings', 'physicalReports', 'playerStatuses', 'matchPlans', 'liveMatchPlans',
      'tactics', 'playerPhysicalState', 'playerContracts', 'playerInjuries', 'staffRoster', 'clubEconomies']) {
      if (career[key] !== undefined && !record(career[key])) invalid(`karriärfältet "${key}" har fel format.`);
    }
    for (const key of ['careerEvents', 'tasks', 'seasonHistory']) {
      if (career[key] !== undefined && !Array.isArray(career[key])) invalid(`karriärfältet "${key}" har fel format.`);
    }
    if (career.productionMatch !== undefined && career.productionMatch !== null) {
      const session = career.productionMatch;
      if (!record(session) || session.format !== 1 || !record(session.core) || !record(session.core.rng)
        || !Array.isArray(session.core.players) || !Array.isArray(session.core.events) || !Array.isArray(session.frames)
        || !Array.isArray(session.people) || !record(session.fixture)) invalid('den pågående matchen är ofullständig.');
    }
    if (career.matchArchiveIds !== undefined && !strings(career.matchArchiveIds)) invalid('matcharkivens referenser är ogiltiga.');
    archiveIds = (career.matchArchiveIds ?? []) as string[];
    if (new Set(archiveIds).size !== archiveIds.length) invalid('matcharkivens referenser innehåller dubbletter.');
    if (career.matchArchives !== undefined && (!record(career.matchArchives) || Object.keys(career.matchArchives).length > 0)) invalid('matcharkiven ska ligga i backupens separata arkivdel.');
  }
  const bundledIds = Object.keys(value.archives);
  if (bundledIds.length !== archiveIds.length || archiveIds.some(id => !Object.hasOwn(value.archives as object, id))) invalid('ett refererat matcharkiv saknas eller ett okänt arkiv har lagts till. Exportera en komplett sparafil igen.');
  for (const id of archiveIds) {
    const archive = value.archives[id];
    if (!record(archive) || ![1, 2].includes(archive.format as number) || !record(archive.fixture) || archive.fixture.id !== id
      || !text(archive.version) || typeof archive.seed !== 'number' || !Number.isFinite(archive.seed)
      || !Array.isArray(archive.people) || !Array.isArray(archive.events) || !record(archive.load)
      || !record(archive.result) || archive.result.fixtureId !== id
      || !(typeof archive.frameData === 'string' || Array.isArray(archive.frames))) invalid(`matcharkivet "${id}" är skadat eller har fel identitet.`);
  }
  return value as unknown as PortableCareerBackup;
}

export function backupArchives(backup: PortableCareerBackup): PlayedMatchArchive[] {
  // Only call after validation at the JSON boundary.
  return Object.values(backup.archives) as PlayedMatchArchive[];
}
