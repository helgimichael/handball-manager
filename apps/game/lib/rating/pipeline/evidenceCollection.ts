// HM-RATINGS-0.3: evidence collection/normalization layer.
//
// Server-only (touches the filesystem via gameWorld/realWorldLoader.ts,
// which itself reuses lib/editor/catalog.ts's discovery layer) -- same
// client/server boundary rule as gameWorld/serverSnapshot.ts. Not wired
// into any client-bundled code or gameplay path in this milestone.
//
// Turns real roster facts + the HM-RATINGS-0.2 calibration set into
// normalized PlayerRatingClaim evidence and a per-player calibration
// match, WITHOUT computing any CA/PA itself (that is proposalEngine.ts's
// job) and WITHOUT pattern-matching qualitative anchor labels into
// numbers (Rating Model §25: "Do not invent tactical/rating variables to
// absorb prose" -- the only source of a numeric CA/PA in this milestone
// is a DIRECT match onto an already-hand-calibrated HM-RATINGS-0.2
// profile, never a generic "CLUB_STAR -> 155" rule).
import { getClub } from "../../game-data";
import type { RealWorldPlayer } from "../../gameWorld/realWorldLoader";
import {
  ALBERT_MANSSON_ID,
  ALEXANDER_MORSTEN_ID,
  LEONARD_GEGAJ_ID,
  PETER_JOHANNESSON_ID,
  SWEDEN_CALIBRATION_V2_PROFILES,
} from "../swedenCalibrationV2";
import type { PlayerRatingClaim, PlayerRatingProfile, Position } from "../types";

// ---------------------------------------------------------------------------
// Position mapping: real-world roster codes -> rating domain Position.
// The game-data model's goalkeeper code is "MV" ("Målvakt"); the rating
// domain's is "GK" -- everything else maps 1:1. Never invents a
// position for a code it doesn't recognize.
// ---------------------------------------------------------------------------

const PRIMARY_POSITION_MAP: Record<string, Position> = {
  MV: "GK",
  V6: "V6",
  V9: "V9",
  M9: "M9",
  M6: "M6",
  H9: "H9",
  H6: "H6",
};

export function mapPrimaryPosition(sourceCode: string): Position | null {
  return PRIMARY_POSITION_MAP[sourceCode] ?? null;
}

export function mapSecondaryPositions(sourceCodes: string[]): Position[] {
  return sourceCodes.map(mapPrimaryPosition).filter((p): p is Position => p !== null);
}

// ---------------------------------------------------------------------------
// Calibration-set matching (HM-RATINGS-0.2). Fixture playerIds are
// hand-authored slugs (e.g. "se_player_gustav_davidsson") and never
// equal the real, hash-suffixed roster playerIds (e.g.
// "se_player_gustav_davidsson_fcd7b654") -- matching is by normalized
// full name across the whole league, not by id and not scoped to a
// single expected club (several source anchors don't state an exact
// club unambiguously; name matching is more robust than guessing one).
// ---------------------------------------------------------------------------

/** Display names for the 12 HM-RATINGS-0.2 calibration players, keyed by their fixture playerId -- the only place this name<->id mapping lives. */
export const CALIBRATION_PLAYER_NAMES: Record<string, string> = {
  se_player_gustav_davidsson: "Gustav Davidsson",
  se_player_niclas_ekberg: "Niclas Ekberg",
  se_player_andreas_nilsson: "Andreas Nilsson",
  [PETER_JOHANNESSON_ID]: "Peter Johannesson",
  se_player_liam_hultberg: "Liam Hultberg",
  [ALEXANDER_MORSTEN_ID]: "Alexander Morsten",
  se_player_anders_wik_rydberg: "Anders Wik Rydberg",
  [LEONARD_GEGAJ_ID]: "Leonard Gegaj",
  [ALBERT_MANSSON_ID]: "Albert Månsson",
  se_player_baldur_fritz_bjarnason: "Baldur Fritz Bjarnason",
  se_player_malte_haglund: "Malte Haglund",
  se_player_robin_jarling: "Robin Järling",
};

const COMBINING_DIACRITICAL_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

/** Exported for HM-RATINGS-0.5's extended-evidence matcher, which needs the exact same normalized-name-match semantics as calibration matching. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(COMBINING_DIACRITICAL_MARKS, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const CALIBRATION_BY_NORMALIZED_NAME: Map<string, PlayerRatingProfile> = new Map(
  SWEDEN_CALIBRATION_V2_PROFILES.map((profile) => [normalizeName(CALIBRATION_PLAYER_NAMES[profile.playerId] ?? profile.playerId), profile]),
);

/**
 * Finds the HM-RATINGS-0.2 calibration reference for a real roster
 * player, by normalized full-name match -- also checking the source
 * data's own `aliases` (e.g. a club roster commonly displays "Robin
 * Järling" while the verified full name is "Robin Järling Sanderhem";
 * the source data already records this via `aliases`, so the pipeline
 * checks it rather than silently missing the match). Returns `null` for
 * the ~190 players with no calibration entry -- this is the expected,
 * common case, not an error.
 */
export function matchCalibrationReference(player: RealWorldPlayer): PlayerRatingProfile | null {
  const candidates = [player.fullName, ...player.aliases];
  for (const candidate of candidates) {
    const match = CALIBRATION_BY_NORMALIZED_NAME.get(normalizeName(candidate));
    if (match) return match;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Structural (non-ability) evidence claims. Position and birth-year are
// real, verified roster facts, but they are NOT ability evidence --
// deliberately never used to seed a CA/PA value, only recorded here for
// traceability (the "every proposal must explain WHY" requirement
// applies even to players with zero ability-relevant evidence).
// ---------------------------------------------------------------------------

// HM-DATA-ALLSVENSKAN-1.1: was hardcoded to Handbollsligan's own
// competition id regardless of the player's actual club/competition --
// harmless while only Handbollsligan clubs existed in this pipeline, but
// would have mislabeled every Allsvenskan (tier-2) player's position
// claim as a Handbollsligan signal. Derived from the player's real club
// now; falls back to the historical Handbollsligan id only for the
// (real-world-only) edge case of a playerId with no resolvable club.
const HANDBOLLSLIGAN_COMPETITION_ID = "se_handbollsligan_herr";

function competitionIdForPlayer(player: RealWorldPlayer): string {
  return getClub(player.clubId)?.competitionId ?? HANDBOLLSLIGAN_COMPETITION_ID;
}

export function buildPositionClaim(player: RealWorldPlayer, position: Position): PlayerRatingClaim {
  return {
    id: `${player.playerId}-position`,
    playerId: player.playerId,
    evidenceClass: "VERIFIED_CAREER_SIGNAL",
    domain: "POSITION",
    key: "primaryPosition",
    value: position,
    contextRef: `competition:${competitionIdForPlayer(player)}`,
    sourceRefs: [`roster:${player.clubId}:2026/27`],
    notes: `Official 2026/27 club roster entry (source code "${player.sourcePosition || player.primaryPosition}").`,
  };
}

/**
 * Age is recorded as CONTEXT ONLY (Rating Model §2: "Age must not
 * directly lower CA") -- this claim is never read by proposalEngine.ts
 * to influence ca/pa, only stored for future development-model use
 * (Rating Model §14, explicitly out of scope for this milestone).
 * Returns null when birthYear is unknown -- never a guessed age.
 */
export function buildAgeContextClaim(player: RealWorldPlayer): PlayerRatingClaim | null {
  if (player.birthYear === null) return null;
  return {
    id: `${player.playerId}-birthyear`,
    playerId: player.playerId,
    evidenceClass: "VERIFIED_CAREER_SIGNAL",
    domain: "CONTEXT",
    key: "birthYear",
    value: player.birthYear,
    sourceRefs: [`roster:${player.clubId}:2026/27`],
    notes: "Career/development context only -- never read as a direct CA/PA modifier (Rating Model §2).",
  };
}
