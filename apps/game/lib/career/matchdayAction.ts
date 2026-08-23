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
import { computeAttackActiveWindows, computeTeamUsageTrace } from "./matchUsageEngine";
import { applyMatchResultBookkeeping } from "./matchResultApplication";
import { computePlayerMatchStrengthAdjustment, resolveClubMatchPlanForFixture } from "./playerMatchStrength";
import { computeTacticalMatchAdjustment, sevenVSixPolicyIntensity } from "./tacticalMatchAdjustment";
import { computeTacticalMatchPlanAdjustment } from "./tacticalPlanEffects";
import { buildFallbackAttackExposure, buildMatchRoster } from "./tumbaRoster";
import type { CareerState, ClubFormEntry, PlayerSeasonStats } from "./types";

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
  const managerUsageTrace = managerPlan ? computeTeamUsageTrace(managerPlan, `${state.saveSeed}:${fixture.id}:usage:${state.playerClubId}`) : null;
  const opponentUsageTrace = opponentPlan ? computeTeamUsageTrace(opponentPlan, `${state.saveSeed}:${fixture.id}:usage:${opponentClubId}`) : null;
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
  // HM-MATCH-1.1 Part 10: per-window attack eligibility, so a bench
  // player's own scheduled entry window is honored by the goal-scorer
  // draw -- only available when a real plan resolved (the fallback
  // exposure map above has no window schedule to derive one from, so
  // those sides are left `undefined`, meaning "eligible in every
  // window", the same safe behavior as before this milestone).
  const managerActiveWindowsById = managerPlan ? computeAttackActiveWindows(managerPlan) : undefined;
  const opponentActiveWindowsById = opponentPlan ? computeAttackActiveWindows(opponentPlan) : undefined;

  const roster = buildMatchRoster(getCareerSquad(state), state.playerStatuses, managerAttackExposureById, managerActiveWindowsById);
  // HM-MATCH-0.2: the opponent's snapshotted squad, so the Fast Match
  // Engine attributes real player goals/events to them too instead of
  // leaving their side entirely anonymous (Spec: "do not randomly invent
  // a scorer only in the UI"). No live per-save injury/suspension
  // tracking exists for AI clubs (playerStatuses is manager-club-only),
  // so this intentionally falls back to squadStatus-only eligibility --
  // the same honest scope buildMatchRoster already documents for callers
  // that predate Career Rhythm.
  const opponentRoster = buildMatchRoster(getCareerClubSquad(state, opponentClubId), undefined, opponentAttackExposureById, opponentActiveWindowsById);

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

  let next: CareerState = { ...state, results, clubForm, playerSeasonStats, careerEvents, inbox };

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
