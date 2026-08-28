import { generateDoubleRoundRobin } from "@handball-manager/game-simulation";
import { GAME_CURRENT_DATE, TUMBA_SQUAD, getClub, getClubsByCompetition } from "../game-data";
import type { PlayerMock } from "../game-data";
import { addDays } from "./dateUtils";
import { seedCareerTasks } from "./careerTasks";
import { seedPlayerStatuses } from "./playerStatus";
import { defaultTeamTacticalProfile, type TeamTacticalProfile } from "./teamTacticalProfile";
import type { CareerFixture, CareerState } from "./types";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import type { RawClubStaffIdentityLike } from "../staff/staffRosterResolution";
import { resolveCompetitionStaffRoster } from "../staff/staffCareerIntegration";
import { ensureCareerGameplayRatings } from "./careerRatingNormalization";
import { computeCareerStartDate, generateProvisionalCupRound, resolveLeagueKickoffDate, type PreseasonStartOption } from "./preseason";
import { ensureCareerPlayerContracts } from "../economy/contractIntegration";
import { ensureCareerPlayerClubHistory } from "../economy/clubHistoryIntegration";
import { ensureCareerAllClubEconomies } from "../economy/clubEconomyIntegration";
import { ensureCareerPlayerSquadStatus } from "./squadStatus";
import { ensureDivision1PlayerEconomicIdentity } from "./division1Integration";
import { seedPermanentBTeamPartnerships } from "./clubPartnerships";

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
  // HM-STAFF-1.0/HM-STAFF-CAREER-1.0: same fs-free, client-safe pattern
  // as worldSquads/gameplayRatings -- already resolved server-side
  // (app/api/game-world/staff-snapshot) before this function is called,
  // now for EVERY club in the competition (not just the manager's own),
  // so any club's staff is browsable/recruitable from career start. A
  // missing/`null` entry for a given clubId (no identity file, or a mock
  // club) is handled identically by resolveClubStaffRoster -- essential-
  // role coverage is always generated regardless for a non-real-world
  // club (Part 19/20).
  // `null` (many pre-existing test call sites that don't care about
  // staff at all) is treated identically to the `{}` default -- no club
  // has any real staff identity data.
  staffIdentityByClub: Record<string, RawClubStaffIdentityLike | null> | null = {},
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

  // HM-STAFF-1.0 Part 15/19, HM-DATA-ALLSVENSKAN-1.1B Part 4,
  // HM-STAFF-CAREER-1.0: resolved once, at creation, for EVERY club in
  // the competition -- exactly like worldSquads/gameplayRatings, now
  // extended from "manager's own club only" to the whole competition
  // (see staffCareerIntegration.ts's own doc). Essential-role gaps are
  // filled with generated fictional staff ONLY for a club whose world/
  // data model is itself GENERATED/MOCK (dataSource !== "REAL_WORLD") --
  // a real club's genuine staffing gap stays genuine (UNKNOWN STAFF !=
  // GENERATED PERSON).
  const staffContractFallbackYear = Number(careerStartDate.slice(0, 4)) + 2;
  const { staffRoster, staffEmployment } = resolveCompetitionStaffRoster(competitionId, staffIdentityByClub ?? {}, staffContractFallbackYear);

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
    staffRoster,
    staffEmployment,
    staffClubHistory: {},
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
    scoutingAssignments: {},
    scoutReports: {},
    clubPartnerships: {},
    partnershipSearches: {},
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
  // HM-DATA-DIV1-1.0: Division 1 players need a contract before Transfers
  // can treat them as a valid target (submitTransferOffer requires
  // getPlayerContract to resolve) -- see division1Integration.ts's own
  // doc for why this is NOT the same as giving Division 1 clubs a full
  // ClubEconomyBaseline (out of scope).
  const withDivision1Economy = ensureDivision1PlayerEconomicIdentity(withEconomies);
  // HM-DATA-ALLSVENSKAN-1.1B Part 3: seeds the manager's own club's
  // persistent squad-status tier from career start -- see squadStatus.ts's
  // own doc for why this is a real, honest starting default, never a
  // researched assessment.
  const withSquadStatus = ensureCareerPlayerSquadStatus(withDivision1Economy, playerClubId, playerSquad);
  // HM-CLUB-PARTNERSHIPS-1.0: the five canonical AFFILIATED_B_TEAM
  // relations exist from career start, regardless of which club the
  // manager plays -- world-state facts, not manager-specific choices.
  return seedPermanentBTeamPartnerships(withSquadStatus, careerStartDate);
}
