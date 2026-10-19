// HM-STAFF-DATA-0.1/HM-DATA-ALLSVENSKAN-1.0: real staff identity loader.
//
// Server-only (touches the filesystem), mirroring realWorldLoader.ts's
// shape exactly. Reads the structured HM-IDENTITY-0.1 source files at
// data/real-world/sweden/2026-27/<leagueSegment>/identity/<clubId>.json
// (Spec §21's recommended location) -- one file per club, generated
// offline from the approved CLUB IDENTITY v0.1 DOCX source profiles,
// never parsed from DOCX at runtime. `leagueSegment` defaults to
// "handbollsligan" (every existing caller stays byte-identical); pass
// "allsvenskan" for a tier-2 clubId (see leagueSegment.ts).
import { dataFileExists, readDataFile } from "./dataFiles";
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

function identityDir(leagueSegment: string): string {
  return path.join(DEFAULT_DATA_ROOT, "sweden", "2026-27", leagueSegment, "identity");
}

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
export function loadClubStaffIdentity(clubId: string, leagueSegment = "handbollsligan"): RawClubStaffIdentity | null {
  const filePath = path.join(identityDir(leagueSegment), `${clubId}.json`);
  if (!dataFileExists(filePath)) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(readDataFile(filePath));
  } catch {
    return null;
  }
  if (!isPlainObject(raw) || !Array.isArray(raw.people) || !Array.isArray(raw.assignments)) return null;
  return raw as unknown as RawClubStaffIdentity;
}
