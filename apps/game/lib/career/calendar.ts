import { simulateFixture, type FastMatchResult } from "@handball-manager/game-simulation";
import { computeSquadDerivedClubStrength } from "./squadDerivedClubStrength";
import { getCareerClubSquad } from "./careerWorld";
import { buildSeasonCompleteMessage } from "./inboxEvents";
import { applyMatchResultBookkeeping } from "./matchResultApplication";
import { computeTeamUsageTrace } from "./matchUsageEngine";
import { computePlayerMatchStrengthAdjustment, resolveClubMatchPlanForFixture } from "./playerMatchStrength";
import { computeAiVsAiTacticalAdjustment } from "./tacticalMatchAdjustment";
import { computeTacticalMatchPlanAdjustment } from "./tacticalPlanEffects";
import { buildFallbackAttackExposure, buildMatchRoster } from "./tumbaRoster";
import { averageRating, type CareerFixture, type CareerState, type ClubFormEntry, type PlayerSeasonStats } from "./types";
import { computeStandings } from "@handball-manager/game-simulation";
import { cpuStartingEnergies, quickSimParticipation, quickSimWorkloadRecords, writeCpuMatchCondition } from "./cpuCondition";
import { recordWorkload, startWorkloadLedger } from "../training/workloadLedger";
import { applyKnockoutDecider } from "../competition/season";

export function getUnplayedFixtures(state: CareerState): readonly CareerFixture[] {
  return state.fixtures.filter((f) => !state.results[f.id]);
}

/**
 * HM-PRESEASON-1.0 Part: "friendly/cup påverkar inte ... season
 * completion" -- the SEASON is the league competition; only LEAGUE
 * fixtures gate `checkSeasonComplete`/the final table below. A CUP or
 * FRIENDLY fixture the manager never gets around to playing must never
 * block (or, if never generated in the first place, silently satisfy)
 * season completion.
 */
function getUnplayedLeagueFixtures(state: CareerState): readonly CareerFixture[] {
  return getUnplayedFixtures(state).filter((f) => f.type === "LEAGUE");
}

/** Earliest date among fixtures without a stored result, or null once the season is complete. */
export function getNextEventDate(state: CareerState): string | null {
  const unplayed = getUnplayedFixtures(state);
  if (unplayed.length === 0) {
    return null;
  }
  return unplayed.reduce((earliest, f) => (f.date < earliest ? f.date : earliest), unplayed[0].date);
}

export function getNextPlayerFixture(state: CareerState): CareerFixture | undefined {
  return getUnplayedFixtures(state)
    .filter((f) => f.homeClubId === state.playerClubId || f.awayClubId === state.playerClubId)
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
}

export function getLastPlayedPlayerFixture(state: CareerState): { fixture: CareerFixture; result: FastMatchResult } | undefined {
  const played = state.fixtures
    .filter((f) => (f.homeClubId === state.playerClubId || f.awayClubId === state.playerClubId) && state.results[f.id])
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const fixture = played[0];
  if (!fixture) {
    return undefined;
  }
  return { fixture, result: state.results[fixture.id] };
}

// ---------------------------------------------------------------------------
// HM-GAME-0.3 Career Rhythm -- used by dailyTick.ts/matchdayAction.ts.
// (HM-GAME-0.4: this module previously also carried three pre-Career-
// Rhythm debug utilities -- simulateMatchday/advanceToNextEvent/
// simulateEntireSeason -- confirmed unreachable from any live code path
// or test, and still referencing the pre-HM-GAME-0.4 Inbox category
// model. Removed as dead code rather than patched to compile against
// the new InboxCategory type; normal play has gone through the Daily
// World Tick + Continue Controller since HM-GAME-0.3.)
// ---------------------------------------------------------------------------

/** The manager club's own unplayed fixture on `date`, if any -- the MATCHDAY_READY trigger condition (Spec S11.2). */
export function getPlayerFixtureOn(state: CareerState, date: string): CareerFixture | undefined {
  return state.fixtures.find(
    (f) => f.date === date && !state.results[f.id] && (f.homeClubId === state.playerClubId || f.awayClubId === state.playerClubId),
  );
}

/**
 * Simulates every fixture due on `date` that does NOT involve the
 * manager's own club (Spec S11.1/S12: other clubs may be processed by
 * ordinary Continue; the manager's own fixture must not be). Idempotent
 * for the same reason simulateMatchday is: already-resulted fixtures are
 * skipped.
 */
export function simulateAiFixturesForDate(state: CareerState, date: string): { state: CareerState; results: FastMatchResult[] } {
  const dueFixtures = state.fixtures.filter(
    (f) => f.date === date && !state.results[f.id] && f.homeClubId !== state.playerClubId && f.awayClubId !== state.playerClubId,
  );
  if (dueFixtures.length === 0) {
    return { state, results: [] };
  }

  const results: Record<string, FastMatchResult> = { ...state.results };
  const clubForm: Record<string, ClubFormEntry[]> = { ...state.clubForm };
  const playerSeasonStats: Record<string, PlayerSeasonStats> = { ...state.playerSeasonStats };
  const produced: FastMatchResult[] = [];
  let physical = state.playerPhysicalState;
  let ledger = state.workloadLedger;

  for (const fixture of dueFixtures) {
    // HM-TACTICS-0.10: both clubs' own AI-derived tactical identity
    // (HM-IDENTITY-0.3) now shapes this fixture symmetrically, through
    // the SAME approved tactical-adjustment mechanism the manager's own
    // fixture already uses -- see computeAiVsAiTacticalAdjustment's own
    // doc for the exact home/away mapping. Returns undefined (no
    // adjustment argument at all, byte-identical to pre-HM-TACTICS-0.10
    // behavior) when neither club has real identity data.
    const adjustment = computeAiVsAiTacticalAdjustment(state.saveSeed, fixture.id, fixture.homeClubId, fixture.awayClubId, state.aiTacticalPreferences);

    // HM-MATCH-RATINGS-0.1 Part O: AI-vs-AI fixtures gain the same
    // player-strength influence as the manager's own fixture, using a
    // deterministic default MatchPlan for BOTH clubs (no AI MatchPlan
    // "coaching" -- just the same default-plan helper any fixture
    // without a saved plan already gets). A club with no snapshotted
    // squad (e.g. non-Tumba Allsvenskan mocks) resolves to a neutral,
    // zero-effect side, exactly as before this milestone.
    const homePlan = resolveClubMatchPlanForFixture(fixture.homeClubId, fixture.id, getCareerClubSquad(state, fixture.homeClubId), undefined);
    const awayPlan = resolveClubMatchPlanForFixture(fixture.awayClubId, fixture.id, getCareerClubSquad(state, fixture.awayClubId), undefined);
    // HM-ALPHA2-02C: each CPU player's tracked readiness is their kickoff
    // energy in the quick simulation (untracked players: 100, as before).
    const startingEnergy = cpuStartingEnergies({ ...state, playerPhysicalState: physical }, [fixture.homeClubId, fixture.awayClubId]);
    const strengthSeed = `${state.saveSeed}:${fixture.id}`;
    const playerStrength = computePlayerMatchStrengthAdjustment(
      homePlan,
      state.gameplayRatings[fixture.homeClubId] ?? [],
      awayPlan,
      state.gameplayRatings[fixture.awayClubId] ?? [],
      strengthSeed,
      startingEnergy,
    );

    // HM-TACTICS-1.3 Part AI: AI-vs-AI fixtures use the exact same
    // tactical-effect engine as the manager's own fixture -- the same
    // deterministic default MatchPlans already resolved above, no
    // separate AI tactical-optimization logic.
    const homeUsageTrace = homePlan ? computeTeamUsageTrace(homePlan, `${state.saveSeed}:${fixture.id}:usage:${fixture.homeClubId}`) : null;
    const awayUsageTrace = awayPlan ? computeTeamUsageTrace(awayPlan, `${state.saveSeed}:${fixture.id}:usage:${fixture.awayClubId}`) : null;
    const tacticalPlanAdjustment = computeTacticalMatchPlanAdjustment(
      homePlan,
      state.gameplayRatings[fixture.homeClubId] ?? [],
      homeUsageTrace,
      awayPlan,
      state.gameplayRatings[fixture.awayClubId] ?? [],
      awayUsageTrace,
    );

    const combinedAdjustment = {
      home: (adjustment?.home ?? 0) + playerStrength.home + tacticalPlanAdjustment.home,
      away: (adjustment?.away ?? 0) + playerStrength.away + tacticalPlanAdjustment.away,
    };
    const getRoster = (clubId: string) => {
      const isHome = clubId === fixture.homeClubId;
      const plan = isHome ? homePlan : awayPlan;
      const usageTrace = isHome ? homeUsageTrace : awayUsageTrace;
      const squad = getCareerClubSquad(state, clubId);
      const attackExposureById = usageTrace
        ? new Map(usageTrace.players.map((p) => [p.playerId, p.attackExposure]))
        : buildFallbackAttackExposure(squad, fixture.id, clubId);
      const defenceExposureById = usageTrace
        ? new Map(usageTrace.players.map((p) => [p.playerId, p.defenceExposure]))
        : undefined;
      const ratingsById = new Map((state.gameplayRatings[clubId] ?? []).map((r) => [r.playerId, r]));
      return buildMatchRoster(squad, undefined, attackExposureById, undefined, defenceExposureById, ratingsById);
    };
    const getStrength = (clubId: string) =>
      computeSquadDerivedClubStrength(clubId, getCareerClubSquad(state, clubId), state.gameplayRatings[clubId] ?? []);
    // HM-ALPHA3-M03: a knockout game level after 60 minutes gets overtime/shootout (regulation untouched).
    const result = applyKnockoutDecider(state, fixture, simulateFixture(
      fixture,
      state.saveSeed,
      getStrength,
      undefined,
      combinedAdjustment,
    ), getStrength);
    const rosterResult = fixture.type !== "FRIENDLY"
      ? simulateFixture(fixture, state.saveSeed, getStrength, getRoster, combinedAdjustment)
      : result;
    results[fixture.id] = result;
    produced.push(result);
    applyMatchResultBookkeeping(
      {
        ...result,
        homePlayerContributions: rosterResult.homePlayerContributions,
        awayPlayerContributions: rosterResult.awayPlayerContributions,
      },
      clubForm,
      playerSeasonStats,
      state.playerClubId,
      fixture.type !== "FRIENDLY",
    );

    // HM-ALPHA2-02C: estimated workload + post-match readiness for every
    // CPU player the quick simulation actually used, from the same usage
    // timeline (seed, stamina, starting energy) that shaped the result.
    const participants = [
      ...quickSimParticipation(state, fixture.homeClubId, homePlan, `${strengthSeed}:home`, startingEnergy),
      ...quickSimParticipation(state, fixture.awayClubId, awayPlan, `${strengthSeed}:away`, startingEnergy),
    ];
    if (participants.length > 0) {
      ledger = recordWorkload(ledger ?? startWorkloadLedger(state, fixture.date), quickSimWorkloadRecords(fixture, participants), fixture.date);
      physical = writeCpuMatchCondition(physical, ledger, fixture.date, new Map(participants.map((p) => [p.playerId, p.endEnergy])));
    }
  }

  return { state: { ...state, results, clubForm, playerSeasonStats, playerPhysicalState: physical, ...(ledger ? { workloadLedger: ledger } : {}) }, results: produced };
}

/**
 * Sets `seasonComplete` and appends the season-complete inbox message the
 * first time every fixture (including, now, the manager's own -- see
 * matchdayAction.ts) has a stored result. Idempotent/no-op once already
 * complete or while fixtures remain.
 */
export function checkSeasonComplete(state: CareerState): CareerState {
  if (state.seasonComplete || getUnplayedLeagueFixtures(state).length > 0) {
    return state;
  }
  // HM-ALPHA3-M03: the season ends when its postseason (SM-slutspel, kval, cup) is complete -- see lib/competition/season.ts.
  if (state.seasonOutcome?.seasonId === state.seasonId && state.seasonOutcome.phase !== "COMPLETE") {
    return state;
  }
  const leagueFixtures = state.fixtures.filter((f) => f.type === "LEAGUE" && f.competitionId === state.competitionId);
  const table = computeStandings(
    [...new Set(leagueFixtures.flatMap((f) => [f.homeClubId, f.awayClubId]))],
    leagueFixtures
      .map((f) => state.results[f.id])
      .filter((r): r is FastMatchResult => r !== undefined)
      .map((r) => ({
        homeClubId: r.homeClubId,
        awayClubId: r.awayClubId,
        homeGoals: r.homeGoals,
        awayGoals: r.awayGoals,
      })),
  );
  const finalPosition = table.findIndex((row) => row.clubId === state.playerClubId) + 1;
  return {
    ...state,
    seasonComplete: true,
    inbox: [...state.inbox, buildSeasonCompleteMessage(finalPosition, state.seasonId, state.competitionId, state.gameDate)],
  };
}

export { averageRating };
