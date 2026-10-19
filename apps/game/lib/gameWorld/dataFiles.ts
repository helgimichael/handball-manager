// Server-only read boundary. The editor keeps live filesystem reads in Node;
// workerd reads the same canonical JSON, packaged before the application build.
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_DATA_ROOT } from '../editor/paths';
import bundledFiles from './generated/realWorldFiles';

type DirectoryEntry = { name: string; isDirectory(): boolean };
let bundledDirectories: Map<string, DirectoryEntry[]> | undefined;

function bundledKey(filename: string): string | null {
  const relative = path.relative(DEFAULT_DATA_ROOT, path.resolve(filename)).split(path.sep).join('/');
  return relative === '..' || relative.startsWith('../') || path.isAbsolute(relative) ? null : relative;
}

function directoryIndex(): Map<string, DirectoryEntry[]> {
  if (bundledDirectories) return bundledDirectories;
  const entries = new Map<string, Map<string, boolean>>();
  for (const key of Object.keys(bundledFiles)) {
    const parts = key.split('/');
    for (let i = 0; i < parts.length; i++) {
      const parent = parts.slice(0, i).join('/');
      const directory = entries.get(parent) ?? new Map<string, boolean>();
      directory.set(parts[i], i < parts.length - 1);
      entries.set(parent, directory);
    }
  }
  bundledDirectories = new Map([...entries].map(([key, children]) => [key,
    [...children].map(([name, isDirectory]) => ({ name, isDirectory: () => isDirectory })),
  ]));
  return bundledDirectories;
}

export function dataFileExists(filename: string): boolean {
  if (process.env.HM_REAL_WORLD_DATA !== 'bundled') return fs.existsSync(filename);
  const key = bundledKey(filename);
  return key !== null && (Object.hasOwn(bundledFiles, key) || directoryIndex().has(key));
}

export function readDataFile(filename: string): string {
  if (process.env.HM_REAL_WORLD_DATA !== 'bundled') return fs.readFileSync(filename, 'utf8');
  const key = bundledKey(filename);
  if (key === null || !Object.hasOwn(bundledFiles, key)) {
    throw new Error('Kunde inte läsa den paketerade datakällan. Bygg om spelets spelartrupper.');
  }
  return bundledFiles[key];
}

export function readDataDirectory(directory: string): DirectoryEntry[] {
  if (process.env.HM_REAL_WORLD_DATA !== 'bundled') return fs.readdirSync(directory, { withFileTypes: true });
  const key = bundledKey(directory);
  const entries = key === null ? undefined : directoryIndex().get(key);
  if (!entries) throw new Error('Kunde inte läsa den paketerade datakatalogen. Bygg om spelets spelartrupper.');
  return entries;
}
