// HM-COACH-IDENTITY-0.1: portable coach identity loader.
//
// Server-only (touches the filesystem), mirroring staffIdentityLoader.ts's
// shape exactly. Reads one file per coach at
// data/real-world/sweden/2026-27/handbollsligan/identity/coach/<personId>.json
// -- keyed by personId (never clubId), since CoachIdentityProfile
// belongs to the person and must survive a club change untouched (Spec
// §5/§18). Only the ~9 coaches the 14 approved source profiles actually
// give a personal trait assessment to have a file here; every other
// coaching-staff person (the majority) deliberately has none -- no
// coach trait is ever invented to fill the gap.
import fs from "node:fs";
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

const COACH_IDENTITY_DIR = path.join(DEFAULT_DATA_ROOT, "sweden", "2026-27", "handbollsligan", "identity", "coach");

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
export function loadCoachIdentity(personId: string): RawCoachIdentity | null {
  const filePath = path.join(COACH_IDENTITY_DIR, `${personId}.json`);
  if (!fs.existsSync(filePath)) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
  if (!isPlainObject(raw) || !isPlainObject(raw.profile)) return null;
  return raw as unknown as RawCoachIdentity;
}

/** Every coach personId that currently has a portable identity file -- for discovery/testing, never for gameplay lookups (those always go through loadCoachIdentity(personId) with a known id). */
export function listCoachIdentityPersonIds(): string[] {
  if (!fs.existsSync(COACH_IDENTITY_DIR)) return [];
  return fs
    .readdirSync(COACH_IDENTITY_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}
