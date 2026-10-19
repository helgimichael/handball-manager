// HM-COACH-IDENTITY-0.1/HM-DATA-ALLSVENSKAN-1.0: portable coach identity loader.
//
// Server-only (touches the filesystem), mirroring staffIdentityLoader.ts's
// shape exactly. Reads one file per coach at
// data/real-world/sweden/2026-27/<leagueSegment>/identity/coach/<personId>.json
// -- keyed by personId (never clubId), since CoachIdentityProfile
// belongs to the person and must survive a club change untouched (Spec
// §5/§18). Only coaches a source profile actually gives a personal
// trait assessment to have a file here; every other coaching-staff
// person (the majority) deliberately has none -- no coach trait is
// ever invented to fill the gap. `leagueSegment` defaults to
// "handbollsligan" for existing callers; pass "allsvenskan" for a
// tier-2 coach.
import { dataFileExists, readDataFile, readDataDirectory } from "./dataFiles";
import path from "node:path";
import { DEFAULT_DATA_ROOT } from "../editor/paths";
import type { CoachIdentityProfile, EvidenceReference } from "../identity/types";

export interface RawCoachIdentity {
  personId: string;
  clubId: string;
  sourceDocument: string;
  evidenceReferences: EvidenceReference[];
  profile: CoachIdentityProfile;
}

function coachIdentityDir(leagueSegment: string): string {
  return path.join(DEFAULT_DATA_ROOT, "sweden", "2026-27", leagueSegment, "identity", "coach");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Loads one coach's raw portable identity file, by their EXACT personId
 * (used directly as the filename -- callers must only ever pass an id
 * already resolved against a known StaffPerson, never unvalidated
 * client input; see coachIdentitySnapshot.ts, the only caller). Returns
 * `null` for a coach with no assessed identity file (most coaches --
 * this is the normal, expected case, not an error) or a malformed one.
 */
export function loadCoachIdentity(personId: string, leagueSegment = "handbollsligan"): RawCoachIdentity | null {
  const filePath = path.join(coachIdentityDir(leagueSegment), `${personId}.json`);
  if (!dataFileExists(filePath)) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(readDataFile(filePath));
  } catch {
    return null;
  }
  if (!isPlainObject(raw) || !isPlainObject(raw.profile)) return null;
  return raw as unknown as RawCoachIdentity;
}

/** Every coach personId that currently has a portable identity file for `leagueSegment` -- for discovery/testing, never for gameplay lookups (those always go through loadCoachIdentity(personId) with a known id). */
export function listCoachIdentityPersonIds(leagueSegment = "handbollsligan"): string[] {
  const dir = coachIdentityDir(leagueSegment);
  if (!dataFileExists(dir)) return [];
  return readDataDirectory(dir).map(entry => entry.name)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}
