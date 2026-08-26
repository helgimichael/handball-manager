import { generateDoubleRoundRobin } from "@handball-manager/game-simulation";
import { GAME_CURRENT_DATE, TUMBA_SQUAD, getClub, getClubsByCompetition } from "../game-data";
import type { PlayerMock } from "../game-data";
import { addDays } from "./dateUtils";
import { seedCareerTasks } from "./careerTasks";
import { seedPlayerStatuses } from "./playerStatus";
import { defaultTeamTacticalProfile, type TeamTacticalProfile } from "./teamTacticalProfile";
import type { CareerState } from "./types";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import { selectCurrentStaffAssignments } from "../identity/validators";
import { resolveClubStaffRoster, type RawClubStaffIdentityLike } from "../staff/staffRosterResolution";
import type { StaffEmployment } from "../staff/types";

const FALLBACK_COMPETITION_ID = "swe-2"; // used only if playerClubId doesn't resolve to a known club

/**
 * Pure, filesystem-free career constructor -- safe to call from client
 * code (CareerContext.tsx runs this in the browser). `worldSquads` is
 * the real-world player-identity snapshot for this competition, already
 * resolved server-side (see gameWorld/serverSnapshot.ts, invoked via
 * app/api/game-world/squad-snapshot before this function is called for a
 * real-world-backed club). Defaults to `{}` for competitions with no
 * real-world data (e.g. Allsvenskan/IFK Tumba), which is also what any
 * caller that never fetches a snapshot gets -- the manager's own squad
 * then falls back to the legacy TUMBA_SQUAD mock, exactly as before
 * HM-DATA-0.2.
 */
export function createNewCareerState(
  saveSeed: string,
  playerClubId: string,
  worldSquads: Record<string, PlayerMock[]> = {},
  // HM-IDENTITY-0.3: same fs-free, client-safe pattern as worldSquads --
  // already resolved server-side (app/api/game-world/ai-tactical-preferences-snapshot)
  // before this function is called for a real-world-backed club.
  aiTacticalPreferences: Record<string, TeamTacticalProfile> = {},
  // HM-MATCH-RATINGS-0.1: same fs-free, client-safe pattern as worldSquads/
  // aiTacticalPreferences -- already resolved server-side
  // (app/api/game-world/gameplay-ratings-snapshot) before this function
  // is called for a real-world-backed club.
  gameplayRatings: Record<string, GameplayPlayerRating[]> = {},
  // HM-STAFF-1.0: same fs-free, client-safe pattern as worldSquads/
  // gameplayRatings -- already resolved server-side
  // (app/api/game-world/staff-snapshot) before this function is called
  // for a real-world-backed club. `null` (every mock club, or a
  // real-world club whose staff fetch failed/found nothing) is handled
  // identically by resolveClubStaffRoster -- essential-role coverage is
  // always generated regardless (Part 19/20).
  staffIdentity: RawClubStaffIdentityLike | null = null,
): CareerState {
  const playerClub = getClub(playerClubId);
  const competitionId = playerClub?.competitionId ?? FALLBACK_COMPETITION_ID;
  const clubIds = getClubsByCompetition(competitionId).map((c) => c.id);

  const generated = generateDoubleRoundRobin({
    competitionId,
    clubIds,
    seasonStartDate: GAME_CURRENT_DATE,
    daysBetweenRounds: 7,
  });

  const playerSquad: readonly PlayerMock[] = worldSquads[playerClubId] ?? TUMBA_SQUAD;

  // HM-STAFF-1.0 Part 15/19: resolved once, at creation, exactly like
  // worldSquads/gameplayRatings -- HISTORICAL/expired assignments are
  // filtered out first (same "never treat a stale assignment as current"
  // rule app/career/staff/page.tsx already applies), then essential-role
  // gaps are always filled with generated fictional staff, regardless of
  // whether any real identity data exists for this club at all.
  const currentStaffIdentity: RawClubStaffIdentityLike | null = staffIdentity
    ? { people: staffIdentity.people, assignments: selectCurrentStaffAssignments(staffIdentity.assignments, GAME_CURRENT_DATE) }
    : null;
  const staffRoster = resolveClubStaffRoster(playerClubId, currentStaffIdentity);
  const staffEmployment: Record<string, StaffEmployment> = Object.fromEntries(
    staffRoster.map((m) => [m.id, { staffId: m.id, clubId: m.clubId, roles: m.roles, status: "EMPLOYED" as const }]),
  );

  return {
    seasonId: "2026/27",
    competitionId,
    playerClubId,
    gameDate: GAME_CURRENT_DATE,
    seasonComplete: false,
    saveSeed,
    fixtures: generated.map((f) => ({
      id: f.id,
      competitionId: f.competitionId,
      round: f.round,
      date: f.date,
      homeClubId: f.homeClubId,
      awayClubId: f.awayClubId,
    })),
    results: {},
    physicalReports: {},
    playerSeasonStats: {},
    clubForm: {},
    inbox: [],
    seasonStartDate: GAME_CURRENT_DATE,
    // The first CONTINUE press should process the season's actual first
    // day, so processedThroughDate starts one day BEHIND it.
    processedThroughDate: addDays(GAME_CURRENT_DATE, -1),
    careerEvents: [],
    playerStatuses: seedPlayerStatuses(GAME_CURRENT_DATE, playerSquad),
    tasks: seedCareerTasks(GAME_CURRENT_DATE),
    worldSquads,
    tacticalProfile: defaultTeamTacticalProfile(),
    aiTacticalPreferences,
    matchPlans: {},
    gameplayRatings,
    liveMatchPlans: {},
    matchPlanChangeHistory: {},
    tactics: {},
    playerMatchDefaults: {},
    specialPlay: {},
    activeMatchSession: null,
    trainingWeeks: {},
    playerPhysicalState: {},
    playerTrainingAssignments: {},
    playerDevelopmentState: {},
    staffRoster: { [playerClubId]: staffRoster },
    staffEmployment,
  };
}
