import type { PlayedMatchArchive } from '../career/productionMatch';
// Immutable archives live separately: advancing the calendar or live clock must
// not rewrite every historical frame on every career save.
const memory = new Map<string, PlayedMatchArchive>();
const known = new Set<string>();
let database: Promise<IDBDatabase> | undefined;
function db(): Promise<IDBDatabase> {
  return database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('hm-match-archives', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('archives');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(new Error('Matcharkiven kunde inte öppnas.')); };
  });
}
export async function storeMatchArchive(saveId: string, archive: PlayedMatchArchive): Promise<void> {
  const key = `${saveId}:${archive.fixture.id}`;
  if (known.has(key)) return;
  if (typeof indexedDB === 'undefined') { memory.set(key, structuredClone(archive)); known.add(key); return; }
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction('archives', 'readwrite');
    const store = tx.objectStore('archives');
    const existing = store.get(key);
    existing.onsuccess = () => { if (!existing.result) store.add(archive, key); };
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(new Error('Matcharkivet kunde inte sparas. Karriären har inte bokförts.'));
  });
  known.add(key);
}
export async function readMatchArchive(saveId: string, fixtureId: string): Promise<PlayedMatchArchive> {
  const key = `${saveId}:${fixtureId}`;
  let result: PlayedMatchArchive | undefined;
  if (typeof indexedDB === 'undefined') result = memory.get(key);
  else {
    const database = await db();
    result = await new Promise((resolve, reject) => {
      const request = database.transaction('archives', 'readonly').objectStore('archives').get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Matcharkivet kunde inte läsas.'));
    });
  }
  if (!result) throw new Error('Ett sparat matcharkiv saknas. Karriären har inte ändrats.');
  known.add(key);
  return structuredClone(result);
}
