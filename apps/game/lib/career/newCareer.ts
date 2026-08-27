import { generateDoubleRoundRobin } from "@handball-manager/game-simulation";
import { GAME_CURRENT_DATE, TUMBA_SQUAD, getClub, getClubsByCompetition } from "../game-data";
import type { PlayerMock } from "../game-data";
import { addDays } from "./dateUtils";
import { seedCareerTasks } from "./careerTasks";
import { seedPlayerStatuses } from "./playerStatus";
import { defaultTeamTacticalProfile, type TeamTacticalProfile } from "./teamTacticalProfile";
import type { CareerFixture, CareerState } from "./types";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import { selectCurrentStaffAssignments } from "../identity/validators";
import { resolveClubStaffRoster, type RawClubStaffIdentityLike } from "../staff/staffRosterResolution";
import type { StaffEmployment } from "../staff/types";
import { ensureCareerGameplayRatings } from "./careerRatingNormalization";
import { computeCareerStartDate, generateProvisionalCupRound, resolveLeagueKickoffDate, type PreseasonStartOption } from "./preseason";
import { ensureCareerPlayerContracts } from "../economy/contractIntegration";
import { generateContractEndDate } from "../economy/contractGeneration";
import { ensureCareerPlayerClubHistory } from "../economy/clubHistoryIntegration";
import { ensureCareerAllClubEconomies } from "../economy/clubEconomyIntegration";
import { ensureCareerPlayerSquadStatus } from "./squadStatus";

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
  // HM-PRESEASON-1.0: `undefined` (every pre-existing caller/test) is
  // BYTE-IDENTICAL to this milestone not existing yet -- league fixtures
  // still seed from GAME_CURRENT_DATE, no cup round is generated, and the
  // career still starts on GAME_CURRENT_DATE. Only when the manager
  // actually makes a preseason-length choice (New Game's own Starta step)
  // does the real 2026/27 league-kickoff calendar and the provisional
  // early cup round activate (Part: "New Game" / preseason.ts).
  preseasonStart: PreseasonStartOption | undefined = undefined,
): CareerState {
  const playerClub = getClub(playerClubId);
  const competitionId = playerClub?.competitionId ?? FALLBACK_COMPETITION_ID;
  const clubIds = getClubsByCompetition(competitionId).map((c) => c.id);

  const leagueKickoffDate = preseasonStart !== undefined ? resolveLeagueKickoffDate(competitionId, GAME_CURRENT_DATE) : GAME_CURRENT_DATE;

  const generated = generateDoubleRoundRobin({
    competitionId,
    clubIds,
    seasonStartDate: leagueKickoffDate,
    daysBetweenRounds: 7,
  });
  const leagueFixtures: CareerFixture[] = generated.map((f) => ({
    id: f.id,
    competitionId: f.competitionId,
    round: f.round,
    date: f.date,
    homeClubId: f.homeClubId,
    awayClubId: f.awayClubId,
    type: "LEAGUE",
  }));

  // Part: "eventuella cupmatcher" -- only generated when the manager
  // actually chose a preseason length (see the `preseasonStart` doc
  // comment above); a cup fixture dated before the career's own start
  // (the manager started too late to experience it) is simply omitted,
  // never backdated/faked as already played (Part: "CAREER START ->
  // PRESEASON -> eventuella cupmatcher" -- "eventuella" = optional/if any).
  let cupFixtures: CareerFixture[] = [];
  if (preseasonStart !== undefined) {
    const provisionalCup = generateProvisionalCupRound(competitionId, clubIds, leagueKickoffDate);
    const provisionalCareerStart = computeCareerStartDate(leagueKickoffDate, preseasonStart);
    cupFixtures = provisionalCareerStart === null ? provisionalCup : provisionalCup.filter((f) => f.date >= provisionalCareerStart);
  }
  const allFixtures = [...leagueFixtures, ...cupFixtures];

  // Part: "vid första tävlingsmatchen" -- resolved AFTER the full fixture
  // list is known, as the earliest fixture (league OR cup) involving the
  // manager's own club. Every other option is a fixed weeks-before-kickoff
  // offset, independent of the fixture list.
  const careerStartDate =
    preseasonStart === undefined
      ? GAME_CURRENT_DATE
      : (computeCareerStartDate(leagueKickoffDate, preseasonStart) ??
        allFixtures
          .filter((f) => f.homeClubId === playerClubId || f.awayClubId === playerClubId)
          .reduce((earliest, f) => (f.date < earliest ? f.date : earliest), leagueKickoffDate));

  const playerSquad: readonly PlayerMock[] = worldSquads[playerClubId] ?? TUMBA_SQUAD;

  // HM-STAFF-1.0 Part 15/19, HM-DATA-ALLSVENSKAN-1.1B Part 4: resolved
  // once, at creation, exactly like worldSquads/gameplayRatings --
  // HISTORICAL/expired assignments are filtered out first (same "never
  // treat a stale assignment as current" rule app/career/staff/page.tsx
  // already applies). Essential-role gaps are filled with generated
  // fictional staff ONLY for a club whose world/data model is itself
  // GENERATED/MOCK (dataSource !== "REAL_WORLD") -- a real club's
  // genuine staffing gap stays genuine (UNKNOWN STAFF != GENERATED PERSON).
  const currentStaffIdentity: RawClubStaffIdentityLike | null = staffIdentity
    ? { people: staffIdentity.people, assignments: selectCurrentStaffAssignments(staffIdentity.assignments, GAME_CURRENT_DATE) }
    : null;
  const isRealWorldClub = playerClub?.dataSource === "REAL_WORLD";
  const staffRoster = resolveClubStaffRoster(playerClubId, currentStaffIdentity, isRealWorldClub);
  const staffContractFallbackYear = Number(careerStartDate.slice(0, 4)) + 2;
  const staffEmployment: Record<string, StaffEmployment> = Object.fromEntries(
    staffRoster.map((m) => [
      m.id,
      {
        staffId: m.id,
        clubId: m.clubId,
        roles: m.roles,
        employmentType: m.employmentType,
        // HM-DATA-ALLSVENSKAN-1.1B Part 1/6: same Swedish 1 June -> 31 May
        // contract-year rule as player contracts, only for SALARIED staff --
        // a VOLUNTARY/GOVERNANCE person has no employment contract at all.
        ...(m.employmentType === "SALARIED" ? { contractEndDate: generateContractEndDate(m.id, "", staffContractFallbackYear) } : {}),
      } satisfies StaffEmployment,
    ]),
  );

  const base: CareerState = {
    seasonId: "2026/27",
    competitionId,
    playerClubId,
    gameDate: careerStartDate,
    seasonComplete: false,
    saveSeed,
    fixtures: allFixtures,
    results: {},
    physicalReports: {},
    playerSeasonStats: {},
    clubForm: {},
    inbox: [],
    seasonStartDate: careerStartDate,
    // The first CONTINUE press should process the career's actual first
    // day, so processedThroughDate starts one day BEHIND it.
    processedThroughDate: addDays(careerStartDate, -1),
    careerEvents: [],
    playerStatuses: seedPlayerStatuses(careerStartDate, playerSquad),
    tasks: seedCareerTasks(careerStartDate),
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
    playerInjuries: {},
    leagueKickoffDate,
    playerContracts: {},
    playerClubHistory: {},
    clubEconomies: {},
    transferOffers: {},
    loans: {},
    playerSquadStatus: {},
    clubKnowledge: {},
    playerKnowledge: {},
  };

  // HM-RATINGS-CAREER-1.0 Part 2/4/15/16: every roster player in the
  // manager's own club gets a usable gameplay rating -- REAL_WORLD clubs
  // already have one per player (the `gameplayRatings` param above), so
  // this only ever fills gaps for a mock/generated club (Part 16: this
  // is the SAME generic mechanism for any club, not a Tumba special
  // case -- see careerRatingNormalization.ts).
  const withRatings = ensureCareerGameplayRatings(base, playerClubId);
  // HM-CONTRACTS-1.0 Part 4: contracts are generated FROM each player's
  // own gameplay rating, so this must run AFTER ensureCareerGameplayRatings
  // above, never before (a rating-less player would otherwise get no
  // contract at all, deferred to the next migration pass).
  const withContracts = ensureCareerPlayerContracts(withRatings, playerClubId);
  // HM-CONTRACTS-1.0A: club/youth history only needs a player's age
  // (playerAgeAtDate), not their rating -- order-independent from
  // contracts, but generated here alongside them for the same "every
  // roster player has a complete economic identity from career start"
  // guarantee.
  const withClubHistory = ensureCareerPlayerClubHistory(withContracts, playerClubId);
  // HM-ECONOMY-1.0: every club in this career's own simulated
  // competition gets a persistent economic baseline from career start --
  // not just the manager's own club (Part: "Alla klubbar som finns i
  // career world ska få en persistent ekonomisk baseline"). Internally
  // also ensures ratings/contracts exist for every OTHER club's squad
  // too, so their own player-wage-cost derivation has real data.
  const withEconomies = ensureCareerAllClubEconomies(withClubHistory);
  // HM-DATA-ALLSVENSKAN-1.1B Part 3: seeds the manager's own club's
  // persistent squad-status tier from career start -- see squadStatus.ts's
  // own doc for why this is a real, honest starting default, never a
  // researched assessment.
  return ensureCareerPlayerSquadStatus(withEconomies, playerClubId, playerSquad);
}
