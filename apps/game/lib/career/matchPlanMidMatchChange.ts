// HM-COACHING-1.0: splices an ADOPTED live MatchPlan coaching change
// onto `state.results[fixtureId]`, mirroring tacticalMidMatchChange.ts's
// own two-segment splice EXACTLY (same prefix-preservation invariant,
// same seed-derivation convention, same tallyTeamStats/rebuildContributions
// reuse) -- the only difference is WHICH adjustment inputs feed the
// resimulated segment: this module additionally recomputes
// HM-MATCH-RATINGS-0.1's player-strength adjustment and HM-TACTICS-1.3's
// tactical-plan adjustment from the CHANGED MatchPlan, on top of the
// SAME profile-based tactical adjustment the existing mechanism already
// computes. This is mandatory (Part U): a live MatchPlan change must
// flow through the SAME engines a pre-match plan does (MatchUsage +
// Tactical Effects + Player Match Strength), never a special live-only
// formula.
//
// Part C: this module NEVER touches `state.matchPlans[fixtureId]` (the
// saved PRE-MATCH plan) -- it only ever reads/writes `state.
// liveMatchPlans[fixtureId]` (the match's own CURRENT plan, seeded from
// the pre-match plan the first time a live change is adopted) and
// `state.matchPlanChangeHistory[fixtureId]` (Part N).
import { simulateMatchSegment, seedFromString, type FastMatchResult, type MatchEvent } from "@handball-manager/game-simulation";
import { getClubStrength } from "../game-data/clubStrength";
import { tallyTeamStats } from "../liveMatch/liveMatchView";
import type { MatchPlanChange, MatchPlanChangeHistoryEntry } from "../liveMatch/matchPlanChange";
import { applyMatchPlanChange, describeMatchPlanChange } from "../liveMatch/matchPlanChange";
import { computeAttackActiveWindows, computeTeamUsageTrace } from "./matchUsageEngine";
import { computePlayerMatchStrengthAdjustment, resolveClubMatchPlanForFixture } from "./playerMatchStrength";
import { computeTacticalMatchAdjustment } from "./tacticalMatchAdjustment";
import { computeTacticalMatchPlanAdjustment } from "./tacticalPlanEffects";
import { rebuildContributions, tallyPlayerGoalsFull } from "./tacticalMidMatchChange";
import { getCareerClubSquad, getCareerSquad } from "./careerWorld";
import { buildFallbackAttackExposure, buildMatchRoster } from "./tumbaRoster";
import type { MatchPlan } from "../matchPlan/types";
import type { TeamTacticalProfile } from "./teamTacticalProfile";
import type { OpponentAdaptationEffect } from "./opponentAdaptation";
import type { CareerState } from "./types";

/**
 * Resolves the MatchPlan actually in effect for a fixture RIGHT NOW --
 * the live plan if any coaching change has already been adopted this
 * match, otherwise the pre-match plan (Part C: `currentMatchPlan =
 * preMatchPlan` at kickoff, never a second default algorithm).
 */
export function resolveCurrentMatchPlan(state: CareerState, fixtureId: string): MatchPlan | null {
  const live = state.liveMatchPlans[fixtureId];
  if (live) return live;
  const saved = state.matchPlans[fixtureId];
  if (saved) return saved;
  return resolveClubMatchPlanForFixture(state.playerClubId, fixtureId, getCareerSquad(state), undefined, state.tactics[state.playerClubId], state.playerMatchDefaults);
}

/**
 * Splices an ADOPTED live MatchPlan change onto `state.results[fixtureId]`
 * and records it in `state.liveMatchPlans`/`state.matchPlanChangeHistory`.
 * A safe no-op (returns `state` unchanged) if the fixture has no stored
 * result yet, or `adoptionMinute` is at or past 60.
 *
 * `currentProfile`/`sevenVSixActive`/`opponentAdaptation` are exactly
 * whatever the EXISTING live tactical-profile/7v6 mechanism currently
 * has in effect (the same three values `applyMidMatchTacticalChange`
 * itself takes) -- a live MatchPlan change composes with those, it
 * never resets or ignores them.
 */
export function applyMidMatchPlanChange(
  state: CareerState,
  fixtureId: string,
  adoptionMinute: number,
  requestedMinute: number,
  change: MatchPlanChange,
  currentProfile: TeamTacticalProfile,
  sevenVSixActive: boolean,
  opponentAdaptation: OpponentAdaptationEffect | null,
): CareerState {
  const original = state.results[fixtureId];
  if (!original || adoptionMinute >= 60) {
    return state;
  }

  const basePlan = resolveCurrentMatchPlan(state, fixtureId);
  if (!basePlan) {
    return state;
  }
  const newPlan = applyMatchPlanChange(basePlan, change);

  const managerIsHome = original.homeClubId === state.playerClubId;
  const opponentClubId = managerIsHome ? original.awayClubId : original.homeClubId;
  // The opponent's own MatchPlan is never live-edited (Part P: no AI
  // coaching) -- resolved the exact same deterministic way
  // matchdayAction.ts does at kickoff, so re-deriving it here always
  // reproduces the identical plan.
  const opponentPlan = resolveClubMatchPlanForFixture(opponentClubId, fixtureId, getCareerClubSquad(state, opponentClubId), undefined, state.tactics[opponentClubId], state.playerMatchDefaults);

  const managerRatings = state.gameplayRatings[state.playerClubId] ?? [];
  const opponentRatings = state.gameplayRatings[opponentClubId] ?? [];
  const managerUsageTrace = computeTeamUsageTrace(newPlan, `${state.saveSeed}:${fixtureId}:usage:${state.playerClubId}:midmatch:${adoptionMinute}`);
  const opponentUsageTrace = opponentPlan ? computeTeamUsageTrace(opponentPlan, `${state.saveSeed}:${fixtureId}:usage:${opponentClubId}`) : null;

  // HM-MATCH-RATINGS-0.1 + HM-TACTICS-1.3, reused verbatim -- the exact
  // same two functions matchdayAction.ts calls at kickoff, just fed the
  // CHANGED plan for whichever side the manager coaches.
  const playerStrength = computePlayerMatchStrengthAdjustment(
    managerIsHome ? newPlan : opponentPlan,
    managerIsHome ? managerRatings : opponentRatings,
    managerIsHome ? opponentPlan : newPlan,
    managerIsHome ? opponentRatings : managerRatings,
    `${state.saveSeed}:${fixtureId}:midmatch:matchplan:${adoptionMinute}`,
  );
  const tacticalPlanAdjustment = computeTacticalMatchPlanAdjustment(
    managerIsHome ? newPlan : opponentPlan,
    managerIsHome ? managerRatings : opponentRatings,
    managerIsHome ? managerUsageTrace : opponentUsageTrace,
    managerIsHome ? opponentPlan : newPlan,
    managerIsHome ? opponentRatings : managerRatings,
    managerIsHome ? opponentUsageTrace : managerUsageTrace,
  );
  // The EXISTING profile/7v6 live mechanism, untouched -- same call
  // shape as tacticalMidMatchChange.ts's own (opponentProfile omitted,
  // same as that module already does).
  const tacticalAdjustment = computeTacticalMatchAdjustment(state.saveSeed, fixtureId, state.playerClubId, original.homeClubId, currentProfile, sevenVSixActive, opponentAdaptation);

  const combinedAdjustment = {
    home: tacticalAdjustment.home + playerStrength.home + tacticalPlanAdjustment.home,
    away: tacticalAdjustment.away + playerStrength.away + tacticalPlanAdjustment.away,
  };

  // Part J/P: a player-usage change must affect who can score in FUTURE
  // simulation -- the same exposure-gated roster matchdayAction.ts
  // builds at kickoff, rebuilt here for the segment from the CHANGED
  // plan (closing the gap the audit found: the pre-existing profile-
  // only splice never passed an exposure map at all).
  //
  // HM-MATCH-1.1 Part 9/10: the opponent side previously fell back to
  // `undefined` (fully unfiltered squad) whenever `opponentPlan` failed
  // to resolve -- a confirmed root cause of the observed ">16
  // participants" bug -- now falls back to a guaranteed <=16-player map
  // instead. Both sides also now carry per-window attack eligibility
  // (`computeAttackActiveWindows`), so a bench player's own scheduled
  // entry window is honored, not just their aggregate exposure.
  const managerAttackExposureById = new Map(managerUsageTrace.players.map((p) => [p.playerId, p.attackExposure]));
  const managerActiveWindowsById = computeAttackActiveWindows(newPlan);
  const roster = buildMatchRoster(getCareerSquad(state), state.playerStatuses, managerAttackExposureById, managerActiveWindowsById);
  const opponentAttackExposureById = opponentUsageTrace
    ? new Map(opponentUsageTrace.players.map((p) => [p.playerId, p.attackExposure]))
    : buildFallbackAttackExposure(getCareerClubSquad(state, opponentClubId), fixtureId, opponentClubId);
  const opponentActiveWindowsById = opponentPlan ? computeAttackActiveWindows(opponentPlan) : undefined;
  const opponentRoster = buildMatchRoster(getCareerClubSquad(state, opponentClubId), undefined, opponentAttackExposureById, opponentActiveWindowsById);

  // HM-MATCH-1.2 Part W/X: a HALFTIME-delivered change has a 0-minute
  // adoption delay (matchPlanChange.ts), so `adoptionMinute ===
  // requestedMinute` -- exactly the clock minute the manager was
  // ALREADY looking at when they confirmed it (view.revealedEvents
  // uses `minute <= clockMinute`, inclusive). Resimulating starting AT
  // that same minute would silently regenerate an event the halftime
  // workspace had just displayed as final first-half history --
  // confirmed by browser QA (a halftime ATTACK_SLOT change altered the
  // already-shown first-half 7-metre count). Every other delivery mode
  // (SIDELINE/TIMEOUT) has a positive delay, so `adoptionMinute` always
  // lands strictly after the currently-revealed clock minute and this
  // never applies to them. `+1` (never past 60) is the smallest shift
  // that keeps the already-revealed minute immutable.
  const zeroDelayAdoption = adoptionMinute === requestedMinute;
  const resimStartMinute = zeroDelayAdoption ? Math.min(60, adoptionMinute + 1) : adoptionMinute;

  // Part H: the SAME seed template tacticalMidMatchChange.ts uses,
  // keyed only by `adoptionMinute` (not by which mechanism triggered
  // the recompute) -- "same minute -> same future segment" holds
  // regardless of whether a profile change, a MatchPlan change, or both
  // landed at that exact minute.
  const segmentSeed = seedFromString(`${state.saveSeed}:${fixtureId}:midmatch:${adoptionMinute}`);
  const segment = simulateMatchSegment({
    seed: segmentSeed,
    startMinute: resimStartMinute,
    endMinute: 60,
    homeClubId: original.homeClubId,
    awayClubId: original.awayClubId,
    homeStrength: getClubStrength(original.homeClubId),
    awayStrength: getClubStrength(original.awayClubId),
    homeTacticalAdjustment: combinedAdjustment.home,
    awayTacticalAdjustment: combinedAdjustment.away,
    homeRoster: managerIsHome ? roster : opponentRoster,
    awayRoster: managerIsHome ? opponentRoster : roster,
  });

  // Part H: the already-revealed prefix is preserved byte-for-byte --
  // identical splicing logic to tacticalMidMatchChange.ts.
  const prefixEvents = original.events.filter((e) => e.minute < resimStartMinute);
  const lastPrefixGoal = [...prefixEvents].reverse().find((e) => e.type === "GOAL");
  const homeScoreCarry = lastPrefixGoal?.homeScoreAfter ?? 0;
  const awayScoreCarry = lastPrefixGoal?.awayScoreAfter ?? 0;

  const suffixEvents: MatchEvent[] = segment.events.map((e) =>
    e.type === "GOAL" ? { ...e, homeScoreAfter: (e.homeScoreAfter ?? 0) + homeScoreCarry, awayScoreAfter: (e.awayScoreAfter ?? 0) + awayScoreCarry } : e,
  );
  const allEvents = [...prefixEvents, ...suffixEvents].sort((a, b) => a.minute - b.minute);

  const homeShotsOnly = allEvents.filter((e) => e.side === "home" && (e.type === "GOAL" || e.type === "MISS" || e.type === "SAVE")).length;
  const awayShotsOnly = allEvents.filter((e) => e.side === "away" && (e.type === "GOAL" || e.type === "MISS" || e.type === "SAVE")).length;
  const homeTally = tallyTeamStats(allEvents, "home", awayShotsOnly);
  const awayTally = tallyTeamStats(allEvents, "away", homeShotsOnly);

  const homeGoals = homeScoreCarry + segment.homeGoals;
  const awayGoals = awayScoreCarry + segment.awayGoals;

  const homeGoalCounts = tallyPlayerGoalsFull(allEvents, "home");
  const awayGoalCounts = tallyPlayerGoalsFull(allEvents, "away");
  const contributionSeed = seedFromString(`${state.saveSeed}:${fixtureId}:midmatch:matchplan:${adoptionMinute}:contrib`);
  const homePlayerContributions = rebuildContributions(contributionSeed, managerIsHome ? roster : opponentRoster, homeGoalCounts, homeGoals, homeTally.shotsFaced, homeTally.saves);
  const awayPlayerContributions = rebuildContributions(contributionSeed, managerIsHome ? opponentRoster : roster, awayGoalCounts, awayGoals, awayTally.shotsFaced, awayTally.saves);

  const splicedResult: FastMatchResult = {
    ...original,
    homeGoals,
    awayGoals,
    homeStats: { ...homeTally },
    awayStats: { ...awayTally },
    events: allEvents,
    homePlayerContributions,
    awayPlayerContributions,
  };

  const historyEntry: MatchPlanChangeHistoryEntry = {
    id: `${fixtureId}:${requestedMinute}:${change.kind}`,
    category: change.category,
    label: describeMatchPlanChange(change),
    requestedMinute,
    adoptedMinute: adoptionMinute,
  };
  const existingHistory = state.matchPlanChangeHistory[fixtureId] ?? [];

  return {
    ...state,
    results: { ...state.results, [fixtureId]: splicedResult },
    liveMatchPlans: { ...state.liveMatchPlans, [fixtureId]: newPlan },
    matchPlanChangeHistory: { ...state.matchPlanChangeHistory, [fixtureId]: [...existingHistory, historyEntry] },
  };
}
