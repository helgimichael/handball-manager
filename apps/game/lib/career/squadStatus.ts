// HM-DATA-ALLSVENSKAN-1.1B Part 3: Persistent Squad Status -- a
// manager-controlled, LONG-TERM squad-role tier ("Nyckelspelare",
// "Förstaval", "Rotation", "Truppspelare", "Talang"). Deliberately
// SEPARATE from:
//  - MatchUsage/MatchPlan (lib/matchPlan/types.ts's MatchRole,
//    PlayerMatchDefault) -- that vocabulary is explicitly documented as
//    "importance in THIS match... never permanent squad status" and
//    drives starting-lineup/substitution decisions per fixture. This
//    module is the permanent identity the coach holds about a player
//    ACROSS fixtures, independent of any one match's selection.
//  - PlayerCareerStatus (lib/career/playerStatus.ts) -- medical/
//    discipline AVAILABILITY (injured/suspended/recovering), a totally
//    orthogonal live-state concern this module never touches or reads.
//  - The static mock's own PlayerMock.squadStatus field (Förstaval/
//    Rotation/Ungdom/Skadad/Avstängd) -- that field is frozen import
//    data (real-world players are ALL "Förstaval" per gameWorldAdapter.ts)
//    and conflates role tier with availability; this module only reads
//    it ONCE, as a reasonable starting default, then never again.
//
// Reserved for later consumers (contracts, morale, player decisions,
// playing-time expectations) -- none of those consequences are built
// yet (Part 3: "Bygg inte dessa konsekvenser ännu"). This pass only
// establishes the persistent, editable state itself.
import type { PlayerMock } from "../game-data";
import type { CareerState } from "./types";

export const SQUAD_STATUS_TIERS = ["KEY_PLAYER", "FIRST_CHOICE", "ROTATION", "SQUAD_PLAYER", "TALENT"] as const;
export type SquadStatusTier = (typeof SQUAD_STATUS_TIERS)[number];

export const SQUAD_STATUS_TIER_LABEL_SV: Record<SquadStatusTier, string> = {
  KEY_PLAYER: "Nyckelspelare",
  FIRST_CHOICE: "Förstaval",
  ROTATION: "Rotation",
  SQUAD_PLAYER: "Truppspelare",
  TALENT: "Talang",
};

/**
 * A reasonable, honest STARTING default -- never claimed as a scouted/
 * researched assessment, just a sane initial tier the manager is free to
 * change immediately. Derived from the static mock's own squadStatus
 * (the only signal available at career-creation time): "Förstaval" ->
 * FIRST_CHOICE, "Rotation" -> ROTATION, "Ungdom" -> TALENT; a live
 * medical/discipline mock state ("Skadad"/"Avstängd") says nothing about
 * ROLE, so it falls back to ROTATION (a neutral middle tier, never
 * inferred from the unrelated injury/suspension fact).
 */
function deriveDefaultSquadStatusTier(player: PlayerMock): SquadStatusTier {
  // HM-PLAYER-DATA-EDITOR-1.0: an editor-calibrated default (from
  // roster-*.json's `defaultSquadStatus`, threaded through PlayerMock.
  // calibratedSquadStatusTier by gameWorldAdapter.ts) wins outright --
  // it is a real, deliberate calibration decision, not a coarse guess.
  if (player.calibratedSquadStatusTier) return player.calibratedSquadStatusTier;
  switch (player.squadStatus) {
    case "Förstaval":
      return "FIRST_CHOICE";
    case "Rotation":
      return "ROTATION";
    case "Ungdom":
      return "TALENT";
    default:
      return "ROTATION";
  }
}

/**
 * Part 3: fills ONLY missing roster-player squad-status entries for
 * `clubId` -- mirrors ensureCareerPlayerContracts/ensureCareerGameplayRatings's
 * exact idempotency contract (never touches an existing, possibly
 * manager-edited, entry; true no-op when nothing is missing; safe to
 * call on every migration).
 */
export function ensureCareerPlayerSquadStatus(state: CareerState, clubId: string, squad: readonly PlayerMock[]): CareerState {
  if (squad.length === 0) return state;
  const existing = state.playerSquadStatus;
  const missing = squad.filter((p) => !existing[p.id]);
  if (missing.length === 0) return state;

  const next: Record<string, SquadStatusTier> = { ...existing };
  for (const player of missing) next[player.id] = deriveDefaultSquadStatusTier(player);
  return { ...state, playerSquadStatus: next };
}

/** The one write path -- a manager's explicit edit, persisted immediately, never re-derived or overwritten by any other system. */
export function updatePlayerSquadStatus(state: CareerState, playerId: string, tier: SquadStatusTier): CareerState {
  if (state.playerSquadStatus[playerId] === tier) return state;
  return { ...state, playerSquadStatus: { ...state.playerSquadStatus, [playerId]: tier } };
}

export function getPlayerSquadStatus(state: CareerState, playerId: string): SquadStatusTier | undefined {
  return state.playerSquadStatus[playerId];
}
