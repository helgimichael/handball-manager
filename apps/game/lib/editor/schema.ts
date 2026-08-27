// Editor validation schema (HM-DATA-EDITOR-0.1, Spec S3/S13/S17).
//
// Adapts to the ACTUAL real-world data schema
// (data/real-world/.../schema-foundation-v0.2.json) rather than
// inventing parallel field names. A "player" for editing purposes spans
// two source-of-truth entities: the person (players-*.json) and this
// season's roster entry (roster-*.json), matched by playerId.
//
// Field scope decisions (documented, not silent):
// - playerId, clubId, competitionId, rosterEntryId, season, snapshotDate
//   are READ-ONLY (Spec S5/S6: stable identity keys; reassigning clubId
//   would mean moving a roster entry into a different club's file, which
//   is a transfer operation -- explicitly out of scope, Spec S41).
// - aliases, fieldConfidence, sourceRefs, dataNotes are READ-ONLY
//   display-only in v0.1 (Spec S16: provenance may stay read-only).

export const CANONICAL_POSITIONS = ["MV", "V6", "V9", "M9", "M6", "H9", "H6"] as const;
export type CanonicalPosition = (typeof CANONICAL_POSITIONS)[number];

export const CONFIDENCE_VALUES = ["VERIFIED", "PARTIAL", "UNKNOWN"] as const;
export type Confidence = (typeof CONFIDENCE_VALUES)[number];

export const HANDEDNESS_VALUES = ["LEFT", "RIGHT"] as const;
export type Handedness = (typeof HANDEDNESS_VALUES)[number] | null;

export const ROSTER_STATUS_VALUES = [
  "CONFIRMED",
  "ANNOUNCED_IN",
  "REGISTERED",
  "LOAN_IN",
  "LOAN_OUT",
  "DEPARTING",
  "LEFT",
  "UNCERTAIN",
] as const;
export type RosterStatus = (typeof ROSTER_STATUS_VALUES)[number];

export interface ContractFields {
  untilDate: string | null;
  untilSeason: string | null;
  optionUntilSeason: string | null;
}

export interface PlayerEditableFields {
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string | null;
  birthYear: number | null;
  nationalities: string[] | null;
  heightCm: number | null;
  handedness: Handedness;
  recordConfidence: Confidence;
}

// HM-PLAYER-DATA-EDITOR-1.0: `SQUAD_STATUS_TIER_VALUES` is a literal
// duplicate of lib/career/squadStatus.ts's own SQUAD_STATUS_TIERS --
// lib/editor never imports from lib/career (a one-way dependency this
// codebase already keeps strictly, confirmed by audit: no existing
// editor module imports anything career-scoped), so the 5 tier strings
// are repeated here rather than creating that new coupling. Both lists
// must be kept in sync by hand if a tier is ever added/renamed.
export const SQUAD_STATUS_TIER_VALUES = ["KEY_PLAYER", "FIRST_CHOICE", "ROTATION", "SQUAD_PLAYER", "TALENT"] as const;
export type SquadStatusTierValue = (typeof SQUAD_STATUS_TIER_VALUES)[number];

export const PLAYER_TAG_VALUES = [
  "ATTACK_SPECIALIST",
  "DEFENCE_SPECIALIST",
  "SEVEN_METER_TAKER",
  "SEVEN_VS_SIX_IMPORTANT",
  "CAPTAIN",
  "FIRST_GOALKEEPER",
  "BACKUP_GOALKEEPER",
] as const;
export type PlayerTagValue = (typeof PLAYER_TAG_VALUES)[number];

export interface RosterEditableFields {
  shirtNumber: number | null;
  sourcePosition: string;
  primaryPosition: CanonicalPosition;
  secondaryPositions: CanonicalPosition[];
  rosterStatus: RosterStatus;
  contract: ContractFields;
  rosterConfidence: Confidence;
  /** HM-PLAYER-DATA-EDITOR-1.0: the long-term squad-role CALIBRATION default a fresh career should start this player at -- `null` means "no calibration yet, let the career derive its own coarse guess" (Part: never silently invent a tier for a player nobody has actually reviewed). */
  defaultSquadStatus: SquadStatusTierValue | null;
  /** HM-PLAYER-DATA-EDITOR-1.0: multi-select special tags (playerTags.ts). Empty array, never null -- "no tags calibrated yet" and "explicitly no tags" are the same thing for this simple first model. */
  specialTags: PlayerTagValue[];
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const NAME_MAX = 80;
const SEASON_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SEASON_STRING_RE = /^\d{4}\/\d{2}$/;
const NATIONALITY_RE = /^[A-Z]{2}$/;
const MIN_BIRTH_YEAR = 1950;
const MAX_BIRTH_YEAR = 2015;
const MIN_HEIGHT_CM = 140;
const MAX_HEIGHT_CM = 230;
const MIN_SHIRT_NUMBER = 1;
const MAX_SHIRT_NUMBER = 99;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidCalendarDate(iso: string): boolean {
  if (!SEASON_DATE_RE.test(iso)) return false;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso;
}

function requireNonEmptyString(value: unknown, field: string, errors: string[], maxLen = NAME_MAX): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${field} must be a non-empty string`);
    return "";
  }
  if (value.length > maxLen) {
    errors.push(`${field} must be at most ${maxLen} characters`);
  }
  return value.trim();
}

function validateNullableDate(value: unknown, field: string, errors: string[]): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !isValidCalendarDate(value)) {
    errors.push(`${field} must be null or an ISO date (YYYY-MM-DD)`);
    return null;
  }
  return value;
}

function validateNullableSeasonString(value: unknown, field: string, errors: string[]): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !SEASON_STRING_RE.test(value)) {
    errors.push(`${field} must be null or a season string (YYYY/YY)`);
    return null;
  }
  return value;
}

function validateNullableInt(value: unknown, field: string, min: number, max: number, errors: string[]): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    errors.push(`${field} must be null or an integer between ${min} and ${max}`);
    return null;
  }
  return value;
}

function validateEnum<T extends string>(value: unknown, allowed: readonly T[], field: string, errors: string[]): T | undefined {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  errors.push(`${field} must be one of: ${allowed.join(", ")}`);
  return undefined;
}

export function validatePlayerEdit(input: unknown): ValidationResult<PlayerEditableFields> {
  const errors: string[] = [];
  if (!isPlainObject(input)) {
    return { ok: false, errors: ["player edit payload must be an object"] };
  }

  const firstName = requireNonEmptyString(input.firstName, "firstName", errors);
  const lastName = requireNonEmptyString(input.lastName, "lastName", errors);
  const fullName = requireNonEmptyString(input.fullName, "fullName", errors);
  const dateOfBirth = validateNullableDate(input.dateOfBirth, "dateOfBirth", errors);
  const birthYear = validateNullableInt(input.birthYear, "birthYear", MIN_BIRTH_YEAR, MAX_BIRTH_YEAR, errors);
  const heightCm = validateNullableInt(input.heightCm, "heightCm", MIN_HEIGHT_CM, MAX_HEIGHT_CM, errors);

  let nationalities: string[] | null = null;
  if (input.nationalities !== null && input.nationalities !== undefined) {
    if (!Array.isArray(input.nationalities) || !input.nationalities.every((n) => typeof n === "string" && NATIONALITY_RE.test(n))) {
      errors.push("nationalities must be null or an array of 2-letter uppercase country codes");
    } else {
      const unique = new Set(input.nationalities);
      if (unique.size !== input.nationalities.length) {
        errors.push("nationalities must not contain duplicate values");
      }
      nationalities = input.nationalities;
    }
  }

  let handedness: Handedness = null;
  if (input.handedness !== null && input.handedness !== undefined) {
    handedness = validateEnum(input.handedness, HANDEDNESS_VALUES, "handedness", errors) ?? null;
  }

  const recordConfidence = validateEnum(input.recordConfidence, CONFIDENCE_VALUES, "recordConfidence", errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: { firstName, lastName, fullName, dateOfBirth, birthYear, nationalities, heightCm, handedness, recordConfidence: recordConfidence! },
  };
}

export function validateRosterEdit(input: unknown): ValidationResult<RosterEditableFields> {
  const errors: string[] = [];
  if (!isPlainObject(input)) {
    return { ok: false, errors: ["roster edit payload must be an object"] };
  }

  const shirtNumber = validateNullableInt(input.shirtNumber, "shirtNumber", MIN_SHIRT_NUMBER, MAX_SHIRT_NUMBER, errors);
  const sourcePosition = requireNonEmptyString(input.sourcePosition, "sourcePosition", errors, 60);
  const primaryPosition = validateEnum(input.primaryPosition, CANONICAL_POSITIONS, "primaryPosition", errors);
  const rosterStatus = validateEnum(input.rosterStatus, ROSTER_STATUS_VALUES, "rosterStatus", errors);
  const rosterConfidence = validateEnum(input.rosterConfidence, CONFIDENCE_VALUES, "rosterConfidence", errors);

  let secondaryPositions: CanonicalPosition[] = [];
  if (!Array.isArray(input.secondaryPositions)) {
    errors.push("secondaryPositions must be an array");
  } else {
    const values: CanonicalPosition[] = [];
    for (const entry of input.secondaryPositions) {
      const validated = validateEnum(entry, CANONICAL_POSITIONS, "secondaryPositions entry", errors);
      if (validated) values.push(validated);
    }
    if (new Set(input.secondaryPositions).size !== input.secondaryPositions.length) {
      errors.push("secondaryPositions must not contain duplicate values");
    }
    secondaryPositions = values;
  }

  let contract: ContractFields = { untilDate: null, untilSeason: null, optionUntilSeason: null };
  if (!isPlainObject(input.contract)) {
    errors.push("contract must be an object");
  } else {
    contract = {
      untilDate: validateNullableDate(input.contract.untilDate, "contract.untilDate", errors),
      untilSeason: validateNullableSeasonString(input.contract.untilSeason, "contract.untilSeason", errors),
      optionUntilSeason: validateNullableSeasonString(input.contract.optionUntilSeason, "contract.optionUntilSeason", errors),
    };
  }

  let defaultSquadStatus: SquadStatusTierValue | null = null;
  if (input.defaultSquadStatus !== null && input.defaultSquadStatus !== undefined) {
    defaultSquadStatus = validateEnum(input.defaultSquadStatus, SQUAD_STATUS_TIER_VALUES, "defaultSquadStatus", errors) ?? null;
  }

  let specialTags: PlayerTagValue[] = [];
  if (!Array.isArray(input.specialTags)) {
    errors.push("specialTags must be an array");
  } else {
    const values: PlayerTagValue[] = [];
    for (const entry of input.specialTags) {
      const validated = validateEnum(entry, PLAYER_TAG_VALUES, "specialTags entry", errors);
      if (validated) values.push(validated);
    }
    if (new Set(input.specialTags).size !== input.specialTags.length) {
      errors.push("specialTags must not contain duplicate values");
    }
    specialTags = values;
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      shirtNumber,
      sourcePosition,
      primaryPosition: primaryPosition!,
      secondaryPositions,
      rosterStatus: rosterStatus!,
      contract,
      rosterConfidence: rosterConfidence!,
      defaultSquadStatus,
      specialTags,
    },
  };
}
