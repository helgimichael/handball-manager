// HM-IDENTITY-0.2/HM-DATA-ALLSVENSKAN-1.0: real club/squad/season
// identity loaders, mirroring staffIdentityLoader.ts/coachIdentityLoader.ts's
// shape exactly.
//
// Server-only (touches the filesystem). Reads the structured
// HM-IDENTITY-0.1 source files at
// data/real-world/sweden/2026-27/<leagueSegment>/identity/{club,squad,season}/<clubId>.json
// -- `leagueSegment` defaults to "handbollsligan" (every existing
// caller stays byte-identical) but any caller that knows which league a
// clubId belongs to can pass "allsvenskan" instead (see
// lib/gameWorld/leagueSegment.ts's `leagueSegmentForClub`). Used by the
// Current Team Identity resolver's tests/callers to assemble real
// inputs; the resolver itself (resolver.ts) never touches the
// filesystem.
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_DATA_ROOT } from "../editor/paths";
import type { ClubIdentityProfile, EvidenceReference, SeasonClubContext, SquadIdentityContext } from "../identity/types";

function identityRoot(leagueSegment: string): string {
  return path.join(DEFAULT_DATA_ROOT, "sweden", "2026-27", leagueSegment, "identity");
}

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

/** `null` for a club with no imported ClubIdentityProfile yet. `leagueSegment` defaults to "handbollsligan" for existing callers; pass "allsvenskan" for a tier-2 clubId. */
export function loadClubIdentity(clubId: string, leagueSegment = "handbollsligan"): RawClubIdentity | null {
  const raw = readJsonFile(path.join(identityRoot(leagueSegment), "club", `${clubId}.json`));
  if (!isPlainObject(raw) || !isPlainObject(raw.profile)) return null;
  return raw as unknown as RawClubIdentity;
}

export function loadSquadIdentity(clubId: string, leagueSegment = "handbollsligan"): RawSquadIdentity | null {
  const raw = readJsonFile(path.join(identityRoot(leagueSegment), "squad", `${clubId}.json`));
  if (!isPlainObject(raw) || !isPlainObject(raw.context)) return null;
  return raw as unknown as RawSquadIdentity;
}

export function loadSeasonIdentity(clubId: string, leagueSegment = "handbollsligan"): RawSeasonIdentity | null {
  const raw = readJsonFile(path.join(identityRoot(leagueSegment), "season", `${clubId}.json`));
  if (!isPlainObject(raw) || !isPlainObject(raw.context)) return null;
  return raw as unknown as RawSeasonIdentity;
}
