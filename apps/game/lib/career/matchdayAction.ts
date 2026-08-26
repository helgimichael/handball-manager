// Manager-fixture matchday action (HM-GAME-0.3, Spec S13/S23).
//
// The ONLY place the manager's own fixture is simulated. Career Rhythm's
// Daily World Tick (dailyTick.ts) deliberately skips it and emits
// MATCHDAY_READY instead (Spec S11.2/S37.8) -- this function is what the
// existing match-preview screen calls once the manager chooses to
// play/simulate. It reuses the exact same Fast Match Engine call and
// bookkeeping AI fixtures use (matchResultApplication.ts) -- Career
// Rhythm does not recreate match-result logic (Spec S37.15).

import { simulateFixture, type FastMatchResult } from "@handball-manager/game-simulation";
import { getClubStrength } from "../game-data/clubStrength";
import { checkSeasonComplete, getPlayerFixtureOn } from "./calendar";
import { buildMatchCompletedEvent } from "./careerEvents";
import { getCareerClubSquad, getCareerSquad } from "./careerWorld";
import { careerEventToInboxMessage } from "./inboxBridge";
import { computeAttackActiveWindows, computeTeamUsageTrace, resolveMatchUsageTimeline } from "./matchUsageEngine";
import { applyMatchResultBookkeeping } from "./matchResultApplication";
import { buildStaminaByPlayerId, computePlayerMatchStrengthAdjustment, resolveClubMatchPlanForFixture } from "./playerMatchStrength";
import type { MatchPhysicalReport } from "../matchPlan/physicalModel";
import { computeTacticalMatchAdjustment, sevenVSixPolicyIntensity } from "./tacticalMatchAdjustment";
import { computeTacticalMatchPlanAdjustment } from "./tacticalPlanEffects";
import { buildFallbackAttackExposure, buildMatchRoster } from "./tumbaRoster";
import type { CareerState, ClubFormEntry, PlayerSeasonStats } from "./types";
import type { PlayerPhysicalState } from "../training/types";
import { ENERGY_START_DEFAULT } from "../matchPlan/physicalModel";
import { applyMatchDevelopmentStimulus, type PlayerMatchExposure } from "../development/developmentIntegration";

export interface PlayManagerFixtureResult {
  state: CareerState;
  result: FastMatchResult | null;
}

/**
 * Resolves the manager's own fixture for `state.gameDate` (the date
 * Continue stopped on with an unresolved MATCHDAY_READY). Requires an
 * actual unresolved MATCHDAY_READY event for that fixture -- not merely
 * a date match -- so this can never resolve a fixture the Daily World
 * Tick has not actually reached yet (e.g. before the very first
 * CONTINUE press, when `gameDate` still equals the un-ticked season
 * start date). No-ops (returns `result: null`, state unchanged) if that
 * precondition is not met; a safe, idempotent no-op rather than throwing.
 */
export function playManagerFixture(state: CareerState): PlayManagerFixtureResult {
  const fixture = getPlayerFixtureOn(state, state.gameDate);
  if (!fixture) {
    return { state, result: null };
  }
  const matchdayEventId = `MATCHDAY_READY:${fixture.id}`;
  const pendingMatchday = state.careerEvents.find((e) => e.id === matchdayEventId && !e.resolved);
  if (!pendingMatchday) {
    return { state, result: null };
  }

  const opponentClubId = fixture.homeClubId === state.playerClubId ? fixture.awayClubId : fixture.homeClubId;

  // HM-TACTICS-0.6B: a small, bounded, pre-match tactical adjustment
  // derived from the manager's own TeamTacticalProfile -- computed once
  // per fixture, exactly like a club strength lookup, never a per-attack
  // simulation. AI-vs-AI fixtures (calendar.ts's simulateAiFixturesForDate)
  // are untouched and never call this.
  //
  // HM-IDENTITY-0.3: the AI opponent's own tactical identity now feeds
  // the SAME existing tactical-adjustment mechanism, replacing what was
  // previously a hardcoded NEUTRAL opponent assumption -- never a new
  // simulation channel, and never touching state.tacticalProfile (the
  // manager's own tactics stay entirely under manager control). This
  // module is reachable from client code ("use client" CareerContext.tsx),
  // so it reads the already-resolved, fs-free `state.aiTacticalPreferences`
  // snapshot (career/aiTacticalPreferences.ts -> gameWorld/serverSnapshot.ts,
  // fetched once at career creation) instead of calling the fs-based
  // identity loaders directly -- same boundary rule as worldSquads. A
  // club with no snapshotted entry (mock-only clubs, or a career created
  // before this milestone) falls back to `null`, which
  // computeTacticalMatchAdjustment already treats as the exact same
  // NEUTRAL opponent assumption as before this milestone.
  const opponentTacticalProfile = state.aiTacticalPreferences[opponentClubId] ?? null;

  // HM-MATCH-RATINGS-0.1: MatchPlan + canonical gameplay ratings now
  // feed a bounded, isolated player-strength adjustment (Part D-M),
  // summed with the existing tactical adjustment below rather than
  // merged into it -- the two layers stay structurally separate (Part
  // J). The manager's own saved MatchPlan is used when one exists;
  // otherwise (and for the AI opponent, always -- Part N/O) the same
  // deterministic default-plan helper the Tactics workspace itself uses
  // builds one on the fly from the currently selected squad. Never
  // throws: a squad too small to build a plan resolves to `null`, which
  // playerMatchStrength.ts treats as a neutral (zero-effect) side.
  const managerPlan = resolveClubMatchPlanForFixture(state.playerClubId, fixture.id, getCareerSquad(state), state.matchPlans[fixture.id], state.tactics[state.playerClubId], state.playerMatchDefaults);
  const opponentPlan = resolveClubMatchPlanForFixture(opponentClubId, fixture.id, getCareerClubSquad(state, opponentClubId), undefined, state.tactics[opponentClubId], state.playerMatchDefaults);
  const managerIsHome = fixture.homeClubId === state.playerClubId;
  const playerStrength = computePlayerMatchStrengthAdjustment(
    managerIsHome ? managerPlan : opponentPlan,
    state.gameplayRatings[managerIsHome ? state.playerClubId : opponentClubId] ?? [],
    managerIsHome ? opponentPlan : managerPlan,
    state.gameplayRatings[managerIsHome ? opponentClubId : state.playerClubId] ?? [],
    `${state.saveSeed}:${fixture.id}`,
  );

  // HM-MATCH-1.0 Part P: the same MatchUsage temporal-exposure trace
  // that fed the player-strength adjustment above also gates the
  // outfield roster's scorer eligibility -- a player with zero intended
  // attacking exposure this match cannot be drawn as a scorer (see
  // tumbaRoster.ts's own doc comment). Computed once here and reused
  // for both the roster and (inside playerMatchStrength.ts, via its own
  // identical, pure re-derivation) the strength adjustment -- cheap and
  // deterministic, so recomputing rather than threading one shared
  // object through is the smallest, safest change.
  // HM-MATCH-USAGE-1.4 Part 14/24 #23: ONE seed and ONE real-stamina map
  // per club, reused for every usage-engine call below (usage trace,
  // scorer-eligibility windows, physical trace) -- the engine's own
  // rotation/selection is now fatigue-PATH-dependent (who was picked in
  // window N-1 changes window N's energy, which changes window N's
  // ranking), so mismatched seeds or a missing stamina map for the same
  // (plan, club) would silently resolve a DIFFERENT on-court timeline
  // for each caller. That would violate this milestone's single-
  // source-of-truth requirement.
  const managerUsageSeed = `${state.saveSeed}:${fixture.id}:usage:${state.playerClubId}`;
  const opponentUsageSeed = `${state.saveSeed}:${fixture.id}:usage:${opponentClubId}`;
  const managerStaminaByPlayerId = buildStaminaByPlayerId(state.gameplayRatings[state.playerClubId] ?? []);
  const opponentStaminaByPlayerId = buildStaminaByPlayerId(state.gameplayRatings[opponentClubId] ?? []);
  const managerUsageTrace = managerPlan ? computeTeamUsageTrace(managerPlan, managerUsageSeed, managerStaminaByPlayerId) : null;
  const opponentUsageTrace = opponentPlan ? computeTeamUsageTrace(opponentPlan, opponentUsageSeed, opponentStaminaByPlayerId) : null;
  // HM-MATCH-1.1 Part 9: when a real MatchPlan/usage trace could not be
  // resolved for a side (e.g. the AI opponent's snapshotted squad lacks
  // a valid goalkeeper or 6 outcourt players), fall back to a guaranteed
  // <=16-player exposure map (buildFallbackAttackExposure) rather than
  // omitting the map entirely -- the previous fallback left the roster
  // completely unfiltered, which is the confirmed root cause of the
  // observed ">16 participants" bug.
  const managerAttackExposureById = managerUsageTrace
    ? new Map(managerUsageTrace.players.map((p) => [p.playerId, p.attackExposure]))
    : buildFallbackAttackExposure(getCareerSquad(state), fixture.id, state.playerClubId);
  const opponentAttackExposureById = opponentUsageTrace
    ? new Map(opponentUsageTrace.players.map((p) => [p.playerId, p.attackExposure]))
    : buildFallbackAttackExposure(getCareerClubSquad(state, opponentClubId), fixture.id, opponentClubId);
  // HM-MATCH-USAGE-1.4 Part 21/24 #9: a DEFENCE_ONLY player now
  // correctly carries ZERO attack exposure (the previous model's
  // "starting players get at least one nominal window regardless of
  // weight" quirk masked this) -- roster inclusion below uses the union
  // of attack and defence exposure, so such a player still gets a
  // participation/contribution record without ever being scorer-eligible.
  const managerDefenceExposureById = managerUsageTrace ? new Map(managerUsageTrace.players.map((p) => [p.playerId, p.defenceExposure])) : undefined;
  const opponentDefenceExposureById = opponentUsageTrace ? new Map(opponentUsageTrace.players.map((p) => [p.playerId, p.defenceExposure])) : undefined;
  // HM-MATCH-1.1 Part 10: per-window attack eligibility, so a bench
  // player's own scheduled entry window is honored by the goal-scorer
  // draw -- only available when a real plan resolved (the fallback
  // exposure map above has no window schedule to derive one from, so
  // those sides are left `undefined`, meaning "eligible in every
  // window", the same safe behavior as before this milestone).
  const managerActiveWindowsById = managerPlan ? computeAttackActiveWindows(managerPlan, managerUsageSeed, managerStaminaByPlayerId) : undefined;
  const opponentActiveWindowsById = opponentPlan ? computeAttackActiveWindows(opponentPlan, opponentUsageSeed, opponentStaminaByPlayerId) : undefined;

  const roster = buildMatchRoster(getCareerSquad(state), state.playerStatuses, managerAttackExposureById, managerActiveWindowsById, managerDefenceExposureById);
  // HM-MATCH-0.2: the opponent's snapshotted squad, so the Fast Match
  // Engine attributes real player goals/events to them too instead of
  // leaving their side entirely anonymous (Spec: "do not randomly invent
  // a scorer only in the UI"). No live per-save injury/suspension
  // tracking exists for AI clubs (playerStatuses is manager-club-only),
  // so this intentionally falls back to squadStatus-only eligibility --
  // the same honest scope buildMatchRoster already documents for callers
  // that predate Career Rhythm.
  const opponentRoster = buildMatchRoster(getCareerClubSquad(state, opponentClubId), undefined, opponentAttackExposureById, opponentActiveWindowsById, opponentDefenceExposureById);

  // HM-MATCH-RATINGS-0.1 Part K: the manager's own PRE-MATCH
  // SevenVSixPolicy (from the resolved MatchPlan above) now scales the
  // existing, approved flat 7v6 bonus/risk pair -- a simplified,
  // bounded pre-match interpretation, never an exact activation-minute
  // simulation and never touching lib/liveMatch/sevenVSixMode.ts's live
  // mechanics (tacticalMidMatchChange.ts's own mid-match call is
  // completely untouched by this addition).
  const sevenVSixPolicyLevel = managerPlan?.attackPlan.sevenVSixPolicy.level ?? "NEVER";
  const tacticalAdjustment = computeTacticalMatchAdjustment(
    state.saveSeed,
    fixture.id,
    state.playerClubId,
    fixture.homeClubId,
    state.tacticalProfile,
    sevenVSixPolicyLevel !== "NEVER",
    null,
    opponentTacticalProfile,
    sevenVSixPolicyIntensity(sevenVSixPolicyLevel),
  );

  // HM-TACTICS-1.3: MatchPlan's own AttackPlanConfig/DefencePlanConfig/
  // TransitionPlanConfig choices now feed a THIRD, separately bounded
  // adjustment -- tactical FIT (curated attribute-only fit of the
  // players actually active in each phase, per MatchUsageTrace
  // exposure) never player rating/CA a second time. Summed alongside
  // (never merged into) the tactical-profile and player-strength
  // adjustments above, same additive channel.
  const tacticalPlanAdjustment = computeTacticalMatchPlanAdjustment(
    managerIsHome ? managerPlan : opponentPlan,
    state.gameplayRatings[managerIsHome ? state.playerClubId : opponentClubId] ?? [],
    managerIsHome ? managerUsageTrace : opponentUsageTrace,
    managerIsHome ? opponentPlan : managerPlan,
    state.gameplayRatings[managerIsHome ? opponentClubId : state.playerClubId] ?? [],
    managerIsHome ? opponentUsageTrace : managerUsageTrace,
  );

  const combinedAdjustment = {
    home: tacticalAdjustment.home + playerStrength.home + tacticalPlanAdjustment.home,
    away: tacticalAdjustment.away + playerStrength.away + tacticalPlanAdjustment.away,
  };
  const result = simulateFixture(
    fixture,
    state.saveSeed,
    (clubId) => getClubStrength(clubId),
    (clubId) => (clubId === state.playerClubId ? roster : clubId === opponentClubId ? opponentRoster : undefined),
    combinedAdjustment,
  );

  // HM-PHYSICAL-1.0 Part 21, updated by HM-MATCH-USAGE-1.4 Part 14/24
  // #23/24: the SAME per-player energy trajectories playerStrength's own
  // fatigue adjustment already computed internally (playerMatchStrength.
  // ts's computeTeamPhysicalTrace) are recomputed here (cheap and
  // deterministic, same "recompute rather than thread a shared object
  // through" precedent as managerUsageTrace/opponentUsageTrace above)
  // using the EXACT SAME (seed, stamina) pair as managerUsageTrace/
  // opponentUsageTrace/managerActiveWindowsById above -- so Live Match's
  // "PÅ PLAN" (currentUnit.ts), the persisted energy trajectory, and the
  // Fast Match Engine's own scorer-eligibility windows all agree on
  // exactly which on-court timeline was resolved for this fixture, never
  // three independently-tiebroken ones. Persisted alongside the match
  // result, keyed by home/away club side rather than manager/opponent,
  // so Match Report can read it the same way it reads homeStats/awayStats.
  const homePlan = managerIsHome ? managerPlan : opponentPlan;
  const awayPlan = managerIsHome ? opponentPlan : managerPlan;
  const homeUsageSeed = managerIsHome ? managerUsageSeed : opponentUsageSeed;
  const awayUsageSeed = managerIsHome ? opponentUsageSeed : managerUsageSeed;
  const homeStaminaByPlayerId = managerIsHome ? managerStaminaByPlayerId : opponentStaminaByPlayerId;
  const awayStaminaByPlayerId = managerIsHome ? opponentStaminaByPlayerId : managerStaminaByPlayerId;
  // HM-TRAINING-1.0 Part 10/11: the manager's own squad's match
  // `startingEnergy` now comes from their PERSISTENT career physical
  // state (whatever the training week leading up to today left them
  // at) instead of always defaulting to 100 -- the other side (AI
  // opponent) has no persistent physical-state tracking at all (the
  // audit confirmed this; a genuinely new, much larger scope), so it
  // keeps the exact pre-HM-TRAINING-1.0 behavior of always starting
  // fresh. A manager-squad player with no `playerPhysicalState` entry
  // yet (e.g. this is their very first match this save) still starts
  // at the same ENERGY_START_DEFAULT as before.
  const managerStartingEnergyByPlayerId = new Map(getCareerSquad(state).map((p) => [p.id, state.playerPhysicalState[p.id]?.currentEnergy ?? ENERGY_START_DEFAULT]));
  const homeStartingEnergyByPlayerId = managerIsHome ? managerStartingEnergyByPlayerId : undefined;
  const awayStartingEnergyByPlayerId = managerIsHome ? undefined : managerStartingEnergyByPlayerId;
  const homeTimeline = homePlan ? resolveMatchUsageTimeline(homePlan, homeUsageSeed, homeStaminaByPlayerId, homeStartingEnergyByPlayerId) : null;
  const awayTimeline = awayPlan ? resolveMatchUsageTimeline(awayPlan, awayUsageSeed, awayStaminaByPlayerId, awayStartingEnergyByPlayerId) : null;
  const physicalReport: MatchPhysicalReport = {
    fixtureId: fixture.id,
    home: homeTimeline ? Object.fromEntries(homeTimeline.trajectories) : {},
    away: awayTimeline ? Object.fromEntries(awayTimeline.trajectories) : {},
    homeAttackUnitByWindow: homeTimeline?.attackUnitByWindow ?? [],
    homeDefenceUnitByWindow: homeTimeline?.defenceUnitByWindow ?? [],
    homeGoalkeeperByWindow: homeTimeline?.goalkeeperByWindow ?? [],
    awayAttackUnitByWindow: awayTimeline?.attackUnitByWindow ?? [],
    awayDefenceUnitByWindow: awayTimeline?.defenceUnitByWindow ?? [],
    awayGoalkeeperByWindow: awayTimeline?.goalkeeperByWindow ?? [],
  };
  const physicalReports: Record<string, MatchPhysicalReport> = { ...state.physicalReports, [fixture.id]: physicalReport };

  // HM-TRAINING-1.0 Part 10/11: the other half of the loop -- the
  // manager squad's own finishing energy from THIS match becomes their
  // new persistent `playerPhysicalState`, so tomorrow's training (and,
  // eventually, the next matchday's own starting energy) carries it
  // forward. Only the manager's own timeline is ever read here (see
  // homeStartingEnergyByPlayerId/awayStartingEnergyByPlayerId above --
  // the AI opponent has no persistent physical-state tracking).
  const managerTimeline = managerIsHome ? homeTimeline : awayTimeline;
  let playerPhysicalState: Record<string, PlayerPhysicalState> = state.playerPhysicalState;
  if (managerTimeline) {
    for (const [playerId, trajectory] of managerTimeline.trajectories) {
      const prior = playerPhysicalState[playerId];
      playerPhysicalState = {
        ...playerPhysicalState,
        [playerId]: { playerId, currentEnergy: trajectory.finishingEnergy, lastUpdatedDate: fixture.date, recentLoad: prior?.recentLoad ?? 0 },
      };
    }
  }

  // HM-TRAINING-1.1 Part 18/19/20/21: the manager squad's own match
  // exposure -- ALREADY computed above (managerUsageTrace) for match-
  // strength/roster purposes -- also feeds a small, bounded development
  // stimulus, using the exact same per-player attack/defence/goalkeeper
  // exposure fractions rather than a second exposure model.
  let stateWithDevelopment: CareerState = { ...state, playerPhysicalState };
  if (managerUsageTrace) {
    const exposureByPlayerId = new Map<string, PlayerMatchExposure>(
      managerUsageTrace.players.map((p) => [p.playerId, { attackExposure: p.attackExposure, defenceExposure: p.defenceExposure, goalkeeperExposure: p.goalkeeperExposure }]),
    );
    stateWithDevelopment = applyMatchDevelopmentStimulus(stateWithDevelopment, fixture.date, exposureByPlayerId);
  }

  const results: Record<string, FastMatchResult> = { ...state.results, [fixture.id]: result };
  const clubForm: Record<string, ClubFormEntry[]> = { ...state.clubForm };
  const playerSeasonStats: Record<string, PlayerSeasonStats> = { ...state.playerSeasonStats };
  applyMatchResultBookkeeping(result, clubForm, playerSeasonStats, state.playerClubId);

  const careerEvents = state.careerEvents.map((e) => (e.id === matchdayEventId ? { ...e, resolved: true, read: true } : e));
  const matchdayMessageId = `msg:${matchdayEventId}`;
  // The MATCHDAY_READY message's underlying action is genuinely done now
  // (the fixture was actually played/simulated) -- `resolved` flips
  // alongside `actionRequired`, never merely because the message was
  // read (Spec §23/§24: opening Match Preview =/= completing the match).
  const inbox = state.inbox.map((m) => (m.id === matchdayMessageId ? { ...m, read: true, actionRequired: false, resolved: true } : m));

  let next: CareerState = {
    ...stateWithDevelopment,
    results,
    physicalReports,
    playerPhysicalState,
    clubForm,
    playerSeasonStats,
    careerEvents,
    inbox,
  };

  const completedEvent = buildMatchCompletedEvent(fixture.id, fixture.competitionId, state.gameDate);
  if (!next.careerEvents.some((e) => e.id === completedEvent.id)) {
    next = {
      ...next,
      careerEvents: [...next.careerEvents, completedEvent],
      inbox: [...next.inbox, careerEventToInboxMessage(completedEvent, next)],
    };
  }

  next = checkSeasonComplete(next);

  return { state: next, result };
}
