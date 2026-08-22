// HM-STAFF-DATA-0.1: real staff identity loader.
//
// Server-only (touches the filesystem), mirroring realWorldLoader.ts's
// shape exactly. Reads the structured HM-IDENTITY-0.1 source files at
// data/real-world/sweden/2026-27/handbollsligan/identity/<clubId>.json
// (Spec §21's recommended location) -- one file per club, generated
// offline from the 14 approved CLUB IDENTITY v0.1 DOCX source profiles,
// never parsed from DOCX at runtime.
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_DATA_ROOT } from "../editor/paths";
import type { StaffAssignment, StaffPerson } from "../identity/types";

export interface RawClubStaffIdentity {
  clubId: string;
  season: string;
  sourceDocument: string;
  people: StaffPerson[];
  assignments: StaffAssignment[];
}

const IDENTITY_DIR = path.join(DEFAULT_DATA_ROOT, "sweden", "2026-27", "handbollsligan", "identity");

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Loads one club's raw staff identity file, by its EXACT canonical
 * clubId (used directly as the filename -- callers must only ever pass
 * an id already resolved against game-data's known club list, never
 * unvalidated client input; see staffIdentitySnapshot.ts, which is the
 * only caller). Returns `null` for a club with no identity file yet
 * (not every club need have one), or a malformed one.
 */
export function loadClubStaffIdentity(clubId: string): RawClubStaffIdentity | null {
  const filePath = path.join(IDENTITY_DIR, `${clubId}.json`);
  if (!fs.existsSync(filePath)) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
  if (!isPlainObject(raw) || !Array.isArray(raw.people) || !Array.isArray(raw.assignments)) return null;
  return raw as unknown as RawClubStaffIdentity;
}
