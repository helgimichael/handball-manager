// Historical adapter retained for regression tests only. Normal matches use productionMatch.ts.
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
import { applyKnockoutDecider } from "../../competition/season";
import { isSpatialMatchFailure, playCareerFixtureSpatially } from "../spatialMatch/spatialCareerMatch";
import { computeSquadDerivedClubStrength } from "../squadDerivedClubStrength";
import { checkSeasonComplete, getPlayerFixtureOn } from "../calendar";
import { buildMatchCompletedEvent, buildPlayerInjuredEvent } from "../careerEvents";
import { getCareerClubSquad, getCareerSquad } from "../careerWorld";
import { withoutNationalDuty } from "../../nationalTeam/duty";
import { isManualLineupCareer, resolveManualMatchPlan } from "../manualLineup";
import { careerEventToInboxMessage } from "../inboxBridge";
import { computeAttackActiveWindows, computeTeamUsageTrace, computeUsageMinutesReport, resolveMatchUsageTimeline } from "../matchUsageEngine";
import { applyMatchResultBookkeeping } from "../matchResultApplication";
import { buildStaminaByPlayerId, computePlayerMatchStrengthAdjustment, resolveClubMatchPlanForFixture } from "../playerMatchStrength";
import type { MatchPhysicalReport } from "../../matchPlan/physicalModel";
import { computeTacticalMatchAdjustment, sevenVSixPolicyIntensity } from "../tacticalMatchAdjustment";
import { computeTacticalMatchPlanAdjustment } from "../tacticalPlanEffects";
import { buildFallbackAttackExposure, buildMatchRoster } from "../tumbaRoster";
import type { CareerState, ClubFormEntry, PlayerSeasonStats } from "../types";
import type { PlayerPhysicalState } from "../../training/types";
import { ENERGY_START_DEFAULT } from "../../matchPlan/physicalModel";
import { applyMatchDevelopmentStimulus, type PlayerMatchExposure } from "../../development/developmentIntegration";
import { applyMatchInjuryResolution } from "../../medical/injuryIntegration";
import { isSelectableForMatch } from "../playerStatus";
import { buildInitialMatchSquad } from "../../matchPlan/careerSquadBridge";
import { applyMoraleToRatings } from "../../players/morale";
import { recordPlayingTimeMatch } from "../../players/playingTime";
import { buildDefaultMatchPlan } from "../../matchPlan/defaultMatchPlan";

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
/** Historical regression helper only. Normal career calls playManagerFixture above. */
export function playManagerFixtureLegacy(state: CareerState): PlayManagerFixtureResult {
  if (state.managerCareer?.seekingJob) return {state,result:null};
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
  // HM-ALPHA3-M10: a manual career's carried preferred lineup is its saved plan here too (quick result).
  const savedManagerPlan = isManualLineupCareer(state) ? resolveManualMatchPlan(state, fixture.id, getCareerSquad(state).filter((p) => isSelectableForMatch(state.playerStatuses, p.id))) : state.matchPlans[fixture.id];
  let managerPlan = resolveClubMatchPlanForFixture(state.playerClubId, fixture.id, getCareerSquad(state), savedManagerPlan, state.tactics[state.playerClubId], state.playerMatchDefaults);
  // HM-INJURIES-1.0 Part 16/25: a saved MatchPlan can go stale if a
  // selected player became injured/suspended AFTER it was saved --
  // "validation must catch it before match start; do not silently allow
  // an injured player to play". Rather than performing complex slot-by-
  // slot MatchPlan surgery (rewriting starting units/substitution pairs/
  // depth hierarchy that reference the now-unavailable player), the plan
  // is REBUILT fresh from the currently-selectable squad using the exact
  // same deterministic fallback `resolveClubMatchPlanForFixture` itself
  // already uses when no saved plan exists at all -- guaranteed clean,
  // reuses 100% existing code, never a second plan-construction path.
  if (managerPlan && managerPlan.squad.players.some((p) => !isSelectableForMatch(state.playerStatuses, p.playerId))) {
    const availableSquad = getCareerSquad(state).filter((p) => isSelectableForMatch(state.playerStatuses, p.id));
    const initialSquad = buildInitialMatchSquad(availableSquad, fixture.id, state.playerClubId);
    const rebuilt = buildDefaultMatchPlan(initialSquad, state.tactics[state.playerClubId], state.playerMatchDefaults);
    managerPlan = rebuilt.ok && rebuilt.plan ? rebuilt.plan : null;
  }
  const opponentPlan = resolveClubMatchPlanForFixture(opponentClubId, fixture.id, withoutNationalDuty(state, getCareerClubSquad(state, opponentClubId)), undefined, state.tactics[opponentClubId], state.playerMatchDefaults);
  const managerIsHome = fixture.homeClubId === state.playerClubId;
  // HM-ALPHA3-M05: the manager's players with morale applied (±3 % at most); other clubs unchanged.
  const moraleRatings = (clubId: string) => applyMoraleToRatings(state, clubId, state.gameplayRatings[clubId] ?? []);
  const playerStrength = computePlayerMatchStrengthAdjustment(
    managerIsHome ? managerPlan : opponentPlan,
    moraleRatings(managerIsHome ? state.playerClubId : opponentClubId),
    managerIsHome ? opponentPlan : managerPlan,
    moraleRatings(managerIsHome ? opponentClubId : state.playerClubId),
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

  const managerRatingsById = new Map((state.gameplayRatings[state.playerClubId] ?? []).map((r) => [r.playerId, r]));
  const opponentRatingsById = new Map((state.gameplayRatings[opponentClubId] ?? []).map((r) => [r.playerId, r]));
  const roster = buildMatchRoster(getCareerSquad(state), state.playerStatuses, managerAttackExposureById, managerActiveWindowsById, managerDefenceExposureById, managerRatingsById);
  // HM-MATCH-0.2: the opponent's snapshotted squad, so the Fast Match
  // Engine attributes real player goals/events to them too instead of
  // leaving their side entirely anonymous (Spec: "do not randomly invent
  // a scorer only in the UI"). No live per-save injury/suspension
  // tracking exists for AI clubs (playerStatuses is manager-club-only),
  // so this intentionally falls back to squadStatus-only eligibility --
  // the same honest scope buildMatchRoster already documents for callers
  // that predate Career Rhythm.
  const opponentRoster = buildMatchRoster(withoutNationalDuty(state, getCareerClubSquad(state, opponentClubId)), undefined, opponentAttackExposureById, opponentActiveWindowsById, opponentDefenceExposureById, opponentRatingsById);

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
    moraleRatings(managerIsHome ? state.playerClubId : opponentClubId),
    managerIsHome ? managerUsageTrace : opponentUsageTrace,
    managerIsHome ? opponentPlan : managerPlan,
    moraleRatings(managerIsHome ? opponentClubId : state.playerClubId),
    managerIsHome ? opponentUsageTrace : managerUsageTrace,
  );

  const combinedAdjustment = {
    home: tacticalAdjustment.home + playerStrength.home + tacticalPlanAdjustment.home,
    away: tacticalAdjustment.away + playerStrength.away + tacticalPlanAdjustment.away,
  };
  // MATCH-EXPERIENCE-2.0 M14: THE MANAGER'S OWN FIXTURE IS PLAYED ON THE
  // SPATIAL ENGINE.
  //
  // This is the career path migrated in M14. The M1-M13 handball-engine plays
  // the match out on a real court with the real selected squads, and its
  // scoreline IS the career's scoreline. The result is stamped
  // `engine: "SPATIAL"` so no reader ever has to guess which engine owned it.
  //
  // EXACTLY ONE ENGINE RUNS PER FIXTURE. simulateFixture below is reached only
  // when the spatial engine genuinely CANNOT play the match -- a club with no
  // squad data in this save cannot field seven real players, and inventing
  // identities for them is precisely what this milestone forbids. Such a
  // fixture is stamped `engine: "FAST"` and is honestly not migrated. The two
  // are never both run, and never merged.
  const spatial = playCareerFixtureSpatially(state, fixture);
  const regulation: FastMatchResult = isSpatialMatchFailure(spatial)
    ? {
        ...simulateFixture(
          fixture,
          state.saveSeed,
          (clubId) => computeSquadDerivedClubStrength(clubId, getCareerClubSquad(state, clubId), state.gameplayRatings[clubId] ?? []),
          (clubId) => (clubId === state.playerClubId ? roster : clubId === opponentClubId ? opponentRoster : undefined),
          combinedAdjustment,
        ),
        engine: "FAST",
      }
    : spatial.result;
  // HM-ALPHA3-M03: overtime/shootout for a level knockout game; regulation untouched.
  const result = applyKnockoutDecider(state, fixture, regulation);

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
  let newlyInjuredPlayerIds: string[] = [];
  if (managerUsageTrace) {
    const exposureByPlayerId = new Map<string, PlayerMatchExposure>(
      managerUsageTrace.players.map((p) => [p.playerId, { attackExposure: p.attackExposure, defenceExposure: p.defenceExposure, goalkeeperExposure: p.goalkeeperExposure }]),
    );
    stateWithDevelopment = applyMatchDevelopmentStimulus(stateWithDevelopment, fixture.date, exposureByPlayerId);
    // HM-INJURIES-1.0 Part 13/36: the SAME resolved exposure fractions --
    // zero exposure structurally means zero match injury risk (Part 39 #1).
    const injuryResolution = applyMatchInjuryResolution(stateWithDevelopment, fixture.date, fixture.id, exposureByPlayerId);
    stateWithDevelopment = injuryResolution.state;
    newlyInjuredPlayerIds = injuryResolution.newlyInjuredPlayerIds;
  }

  const results: Record<string, FastMatchResult> = { ...state.results, [fixture.id]: result };
  const clubForm: Record<string, ClubFormEntry[]> = { ...state.clubForm };
  const playerSeasonStats: Record<string, PlayerSeasonStats> = { ...state.playerSeasonStats };
  // HM-PRESEASON-1.0 Part: a FRIENDLY fixture still runs this entire
  // pipeline (physical/development/injury -- untouched above) but must
  // not affect clubForm or playerSeasonStats.
  applyMatchResultBookkeeping(result, clubForm, playerSeasonStats, state.playerClubId, fixture.type !== "FRIENDLY");

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

  if (managerPlan) next = recordPlayingTimeMatch(next,fixture,new Map(computeUsageMinutesReport(managerPlan,managerUsageSeed,managerStaminaByPlayerId).map(p => [p.playerId,p.courtMinutes])), 'USAGE_TIMELINE',state);
  const completedEvent = buildMatchCompletedEvent(fixture.id, fixture.competitionId, state.gameDate);
  if (!next.careerEvents.some((e) => e.id === completedEvent.id)) {
    next = {
      ...next,
      careerEvents: [...next.careerEvents, completedEvent],
      inbox: [...next.inbox, careerEventToInboxMessage(completedEvent, next)],
    };
  }

  // HM-INJURIES-1.0 Part 29/36: a match injury is resolved as a POST-
  // MATCH artifact (Part 28's own explicit allowance) -- never a dynamic
  // in-match substitution/event. Same idempotent-append pattern as
  // completedEvent above.
  for (const playerId of newlyInjuredPlayerIds) {
    const injuryEvent = buildPlayerInjuredEvent(playerId, fixture.date);
    if (!next.careerEvents.some((e) => e.id === injuryEvent.id)) {
      next = {
        ...next,
        careerEvents: [...next.careerEvents, injuryEvent],
        inbox: [...next.inbox, careerEventToInboxMessage(injuryEvent, next)],
      };
    }
  }

  next = checkSeasonComplete(next);

  return { state: next, result };
}
