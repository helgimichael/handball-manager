// HM-MULTI-COMPETITION-WORLD-FOUNDATION-1.0: the ONE canonical answer to
// "what competitions/clubs actively participate in this career's world
// economy/player market", distinct from `state.competitionId` (the
// MANAGER's own playable competition -- unchanged meaning, still exactly
// one of Handbollsligan/Allsvenskan, still what fixtures/standings/match
// simulation are scoped to).
//
// Before this milestone, every world-wide system (CPU recruitment, CPU
// contract decisions, club economies, candidate sourcing) was scoped to
// `getClubsByCompetition(state.competitionId)` -- correct for the ONE
// competition the manager actually plays, but silently excluding
// whichever Swedish tier ISN'T the manager's own (if the manager plays
// Handbollsligan, Allsvenskan clubs got no economy/recruitment/candidate
// participation at all, and vice versa). Division 1 Norra/Södra's
// worldSquads/gameplayRatings were ALREADY unconditionally fetched
// (CareerContext.tsx's fetchDivision1WorldSquads, present since HM-DATA-
// DIV1-1.0) -- but Division 1 clubs were never given a real
// ClubEconomyBaseline and were never included in `cpuRecruiterClubIds`,
// so they could never actually buy anything even though their players
// were already real, biddable candidates.
//
// This module is the single place that lists which Swedish competitions
// are WORLD-ACTIVE (all four tiers, always) so every other subsystem can
// stop re-deriving or hard-coding its own club-enumeration logic.
import { getClubsByCompetition } from "../game-data";
import type { CareerState } from "./types";

/**
 * Every Swedish competition this career's world economy/player market
 * spans, regardless of which ONE the manager actually plays --
 * Handbollsligan (tier 1), Allsvenskan (tier 2), and both Division 1
 * pools (non-playable, Part 19: NON-PLAYABLE != NON-EXISTENT). Fixed,
 * not derived from `state` -- every Swedish career world is the same
 * four tiers today; `state` is still threaded through
 * `getCareerWorldCompetitionIds` below so callers have one stable
 * resolver to call even if a future milestone needs this to vary
 * per-career (e.g. a non-Swedish career).
 */
export const SWEDISH_WORLD_COMPETITION_IDS = ["se_handbollsligan_herr", "swe-2", "se_division1_norra", "se_division1_sodra"] as const;

/** The canonical resolver every world-wide subsystem should call instead of hard-coding its own competition list. */
export function getCareerWorldCompetitionIds(state: CareerState): readonly string[] {
  void state;
  return SWEDISH_WORLD_COMPETITION_IDS;
}

/**
 * Every club across every world-active competition that this career
 * ACTUALLY has real squad data for (`state.worldSquads[clubId]` present
 * -- the same "key presence, not length" check `eligibleYouthIntakeClubIds`
 * already established, so a club whose squad has legitimately collapsed
 * to zero players remains included). This is the canonical "which clubs
 * are real, biddable, decidable world participants" list -- used by CPU
 * recruitment, CPU contract decisions, and the player lifecycle
 * (retirement/decline), all of which must apply uniformly across every
 * tier, not just the manager's own competition (Part 18: "Player Career
 * Lifecycle should apply to all active players regardless of tier").
 * Deliberately NOT reused by Youth Intake -- see youthIntake.ts's own
 * doc on `eligibleYouthIntakeClubIds` for why that stays narrower.
 */
export function careerWorldClubIds(state: CareerState): string[] {
  return getCareerWorldCompetitionIds(state)
    .flatMap((competitionId) => getClubsByCompetition(competitionId))
    .map((c) => c.id)
    .filter((clubId) => state.worldSquads[clubId] !== undefined);
}
