// HM-IDENTITY-0.2: real club/squad/season identity loaders, mirroring
// staffIdentityLoader.ts/coachIdentityLoader.ts's shape exactly.
//
// Server-only (touches the filesystem). Reads the structured
// HM-IDENTITY-0.1 source files at
// data/real-world/sweden/2026-27/handbollsligan/identity/{club,squad,season}/<clubId>.json
// -- a representative subset of clubs, not yet all 14 (a future pass
// can complete the set; see this milestone's report). Used by the
// Current Team Identity resolver's tests/callers to assemble real
// inputs; the resolver itself (resolver.ts) never touches the
// filesystem.
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_DATA_ROOT } from "../editor/paths";
import type { ClubIdentityProfile, EvidenceReference, SeasonClubContext, SquadIdentityContext } from "../identity/types";

const IDENTITY_ROOT = path.join(DEFAULT_DATA_ROOT, "sweden", "2026-27", "handbollsligan", "identity");

export interface RawClubIdentity {
  clubId: string;
  sourceDocument: string;
  evidenceReferences: EvidenceReference[];
  profile: ClubIdentityProfile;
}

export interface RawSquadIdentity {
  clubId: string;
  season: string;
  sourceDocument: string;
  evidenceReferences: EvidenceReference[];
  context: SquadIdentityContext;
}

export interface RawSeasonIdentity {
  clubId: string;
  season: string;
  sourceDocument: string;
  evidenceReferences: EvidenceReference[];
  context: SeasonClubContext;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJsonFile(filePath: string): unknown | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/** `null` for a club with no imported ClubIdentityProfile yet -- the normal, expected case for most of the 14 clubs at this point (see this milestone's report). */
export function loadClubIdentity(clubId: string): RawClubIdentity | null {
  const raw = readJsonFile(path.join(IDENTITY_ROOT, "club", `${clubId}.json`));
  if (!isPlainObject(raw) || !isPlainObject(raw.profile)) return null;
  return raw as unknown as RawClubIdentity;
}

export function loadSquadIdentity(clubId: string): RawSquadIdentity | null {
  const raw = readJsonFile(path.join(IDENTITY_ROOT, "squad", `${clubId}.json`));
  if (!isPlainObject(raw) || !isPlainObject(raw.context)) return null;
  return raw as unknown as RawSquadIdentity;
}

export function loadSeasonIdentity(clubId: string): RawSeasonIdentity | null {
  const raw = readJsonFile(path.join(IDENTITY_ROOT, "season", `${clubId}.json`));
  if (!isPlainObject(raw) || !isPlainObject(raw.context)) return null;
  return raw as unknown as RawSeasonIdentity;
}
