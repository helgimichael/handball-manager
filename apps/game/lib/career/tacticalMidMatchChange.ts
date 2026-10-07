// HM-TACTICS-0.7: applies an ADOPTED in-match tactical instruction to an
// already-completed FastMatchResult, without regenerating the
// already-played part of the match.
//
// Safest-way audit (Spec: "first audit the safest way to apply changes
// to the remaining match progression"): Fast Match generates the whole
// match atomically before Live Match ever starts revealing it (see
// game-simulation's matchEngine.ts module doc). There is no per-attack
// loop to "steer" mid-flight, and the original match's aggregate stats
// cannot be decomposed by time (buildTeamStats only ever produces one
// number per team for the whole simulated duration). The only integrity-
// preserving option is therefore a two-segment splice:
//
//   1. Preserve the exact prefix of `original.events` with
//      `minute < adoptionMinute` byte-for-byte -- this is what Live
//      Match has already revealed to the manager, and it must never
//      change (Spec: "do not make a tactical change regenerate the
//      already-played part of the match").
//   2. Freshly simulate ONLY the remaining duration
//      [adoptionMinute, 60] with `simulateMatchSegment`, using a seed
//      distinct from the original match's seed and the NEW tactical
//      adjustment computed from the manager's amended TeamTacticalProfile.
//   3. Splice prefix + adjusted suffix, recomputing the running score and
//      re-tallying `TeamMatchStats` via the same, already-proven
//      `tallyTeamStats` reconstruction Live Match/Analysis already rely
//      on (liveMatchView.ts) -- not a new counting mechanism.
//
// This guarantees: same seed + same instruction timing = same match
// (both the prefix and the segment are pure functions of their inputs);
// changing tactics at minute X only affects future match behavior (the
// prefix is untouched); and no instruction = existing HM-TACTICS-0.6
// behavior (this module is only ever invoked once an instruction is
// ADOPTED -- see tacticalInstruction.ts).
//
// HM-TACTICS-0.8: `sevenVSixActive` (required, not optional -- every
// caller must be explicit, so forgetting it can never silently drop
// the mode mid-splice) is threaded straight into
// computeTacticalMatchAdjustment, which folds in the isolated 7v6
// bonus/risk figures on top of the existing profile-driven adjustment.
// No EMPTY_GOAL event type is introduced here: Fast Match samples each
// segment's final goal totals BEFORE building events (see
// simulateMatchSegment's own doc), so a genuinely new scoring pathway
// would either invent goals never accounted for in that pre-sampled
// total, or be a purely cosmetic relabeling of already-existing GOAL
// events with no new information -- neither is "derived consistently
// from the 7v6 risk state" in the sense the spec asks for, so it is
// reported as unavailable rather than faked (see this milestone's
// report for the full audit).
//
// HM-TACTICS-0.9: `opponentAdaptation` (also required, also nullable --
// pass null explicitly when there is nothing for the opponent to react
// to) is threaded straight through to computeTacticalMatchAdjustment
// too, so a halftime instruction, a later sideline change, or a shout
// all keep folding in whatever the opponent has already adapted to.
//
// HM-MATCH-0.2: the segment simulation and contribution rebuild now
// always resolve a roster for BOTH sides (the manager's own squad and
// the opponent's snapshotted squad), not just the manager's -- matching
// the initial simulation in matchdayAction.ts. A splice can no longer
// leave the opponent's contributions frozen at whatever (possibly empty)
// value the original simulation produced.
import { simulateMatchSegment, type FastMatchResult, type MatchEvent, type PlayerMatchContribution } from "@handball-manager/game-simulation";
import { createRng, seedFromString } from "@handball-manager/game-simulation";
import { computeSquadDerivedClubStrength } from "./squadDerivedClubStrength";
import { tallyTeamStats } from "../liveMatch/liveMatchView";
import { computeTacticalMatchAdjustment } from "./tacticalMatchAdjustment";
import { computeAttackActiveWindows, computeTeamUsageTrace } from "./matchUsageEngine";
import { resolveClubMatchPlanForFixture } from "./playerMatchStrength";
import { getCareerClubSquad, getCareerSquad } from "./careerWorld";
import { buildFallbackAttackExposure, buildMatchRoster } from "./tumbaRoster";
import type { TeamTacticalProfile } from "./teamTacticalProfile";
import type { OpponentAdaptationEffect } from "./opponentAdaptation";
import type { CareerState } from "./types";

/**
 * Tallies goals per player from a full (prefix + suffix) spliced event
 * list -- goals are the one stat MatchEvent attributes to a specific
 * player (see types.ts's MatchEvent.playerId doc), so this is always
 * exact, unlike shots/rating below.
 */
/** Exported (HM-COACHING-1.0) so matchPlanMidMatchChange.ts's own splice can reuse the exact same reconstruction logic rather than duplicating it. */
export function tallyPlayerGoalsFull(events: readonly MatchEvent[], side: "home" | "away"): Map<string, number> {
  const goals = new Map<string, number>();
  for (const event of events) {
    if (event.type === "GOAL" && event.side === side && event.playerId) {
      goals.set(event.playerId, (goals.get(event.playerId) ?? 0) + 1);
    }
  }
  return goals;
}

/**
 * PROVISIONAL, documented simplification: shots/saves/rating cannot be
 * decomposed from the original (pre-splice) aggregate by time -- only
 * goals are event-attributable (see tallyPlayerGoalsFull above). Rather
 * than silently keep stale pre-splice shot/rating figures or double-
 * count them against the new segment, this rebuilds every player's
 * contribution from the final, accurate combined goal tally plus a
 * freshly seeded (still fully deterministic) shot/rating estimate,
 * mirroring game-simulation's own buildPlayerContributions formula
 * shape. Never a player attribute or handball claim -- purely a
 * presentation-consistency rebuild, scoped to this module only.
 */
/** Exported (HM-COACHING-1.0) for the same reason as tallyPlayerGoalsFull above. */
export function rebuildContributions(
  seed: number,
  roster: readonly { playerId: string; isGoalkeeper: boolean; started: boolean }[] | undefined,
  goalCounts: Map<string, number>,
  teamGoals: number,
  shotsFaced: number,
  saves: number,
): PlayerMatchContribution[] {
  if (!roster || roster.length === 0) {
    return [];
  }
  const rng = createRng(seed);
  const contributions = roster.map((p) => {
    if (p.isGoalkeeper) {
      const rating = Math.max(1, Math.min(10, 6 + (saves / Math.max(1, shotsFaced)) * 5 + (rng.nextFloat() - 0.5)));
      return { playerId: p.playerId, goals: 0, shots: 0, saves, shotsFaced, rating: Math.round(rating * 10) / 10, started: p.started };
    }
    const goals = goalCounts.get(p.playerId) ?? 0;
    const shots = goals + rng.nextInt(0, 3);
    const shareOfTeamGoals = teamGoals > 0 ? goals / teamGoals : 0;
    const rating = Math.max(1, Math.min(10, 5.5 + shareOfTeamGoals * 8 + (rng.nextFloat() - 0.5) * 1.5));
    return { playerId: p.playerId, goals, shots, rating: Math.round(rating * 10) / 10, started: p.started };
  });

  // A scorer who is not in this roster still scored.
  //
  // The roster above is rebuilt from the club's CURRENT squad, but the spliced
  // timeline keeps the prefix of a match that was played earlier, and the two
  // need not contain the same players -- a man who scored before the change can
  // be absent from the freshly selected match squad. Mapping over the roster
  // alone silently dropped his goals, so the team total counted a goal that no
  // player's line accounted for, and the totals stopped reconciling.
  //
  // Nothing is invented here. The goal is real, it is attributed in the event
  // stream to a real player id, and this only stops that attribution being
  // thrown away: he appears with the goals he actually scored, and as a man who
  // did not start, because he is not in the current selection.
  const covered = new Set(contributions.map((c) => c.playerId));
  for (const [playerId, goals] of goalCounts) {
    if (covered.has(playerId) || goals <= 0) continue;
    const shots = goals + rng.nextInt(0, 3);
    const shareOfTeamGoals = teamGoals > 0 ? goals / teamGoals : 0;
    const rating = Math.max(1, Math.min(10, 5.5 + shareOfTeamGoals * 8 + (rng.nextFloat() - 0.5) * 1.5));
    contributions.push({ playerId, goals, shots, rating: Math.round(rating * 10) / 10, started: false });
  }
  return contributions;
}

/**
 * Splices an ADOPTED tactical instruction onto `state.results[fixtureId]`
 * and returns the updated CareerState. A safe no-op (returns `state`
 * unchanged) if the fixture has no stored result yet, or if
 * `adoptionMinute` is at or past 60 (nothing left to resimulate).
 */
export function applyMidMatchTacticalChange(
  state: CareerState,
  fixtureId: string,
  adoptionMinute: number,
  newProfile: TeamTacticalProfile,
  sevenVSixActive: boolean,
  opponentAdaptation: OpponentAdaptationEffect | null,
): CareerState {
  const original = state.results[fixtureId];
  if (original?.engine === 'V2') return state;
  if (!original || adoptionMinute >= 60) {
    return state;
  }

  const managerIsHome = original.homeClubId === state.playerClubId;
  const opponentClubId = managerIsHome ? original.awayClubId : original.homeClubId;

  // HM-MATCH-1.1 Part 9/10: this splice previously built BOTH rosters
  // with no exposure/window gating at all (a confirmed root cause of the
  // observed ">16 participants"/"bench player scores at minute 1" bugs
  // for any live change that goes through this mechanism -- sideline
  // shouts, timeout instructions, halftime talks, 7v6). Resolve the same
  // MatchPlan every other splice/kickoff path already uses (the fixture's
  // current live plan if one exists, else the saved pre-match plan, else
  // the same deterministic default every unplanned fixture gets) and
  // derive real exposure + per-window eligibility from it, exactly like
  // matchdayAction.ts/matchPlanMidMatchChange.ts.
  const managerPlan = resolveClubMatchPlanForFixture(
    state.playerClubId,
    fixtureId,
    getCareerSquad(state),
    state.liveMatchPlans[fixtureId] ?? state.matchPlans[fixtureId],
    state.tactics[state.playerClubId],
    state.playerMatchDefaults,
  );
  const opponentPlan = resolveClubMatchPlanForFixture(opponentClubId, fixtureId, getCareerClubSquad(state, opponentClubId), undefined, state.tactics[opponentClubId], state.playerMatchDefaults);
  const managerUsageTrace = managerPlan ? computeTeamUsageTrace(managerPlan, `${state.saveSeed}:${fixtureId}:usage:${state.playerClubId}:midmatch:${adoptionMinute}`) : null;
  const opponentUsageTrace = opponentPlan ? computeTeamUsageTrace(opponentPlan, `${state.saveSeed}:${fixtureId}:usage:${opponentClubId}`) : null;
  const managerAttackExposureById = managerUsageTrace
    ? new Map(managerUsageTrace.players.map((p) => [p.playerId, p.attackExposure]))
    : buildFallbackAttackExposure(getCareerSquad(state), fixtureId, state.playerClubId);
  const opponentAttackExposureById = opponentUsageTrace
    ? new Map(opponentUsageTrace.players.map((p) => [p.playerId, p.attackExposure]))
    : buildFallbackAttackExposure(getCareerClubSquad(state, opponentClubId), fixtureId, opponentClubId);
  const managerActiveWindowsById = managerPlan ? computeAttackActiveWindows(managerPlan) : undefined;
  const opponentActiveWindowsById = opponentPlan ? computeAttackActiveWindows(opponentPlan) : undefined;

  const roster = buildMatchRoster(getCareerSquad(state), state.playerStatuses, managerAttackExposureById, managerActiveWindowsById);
  // HM-MATCH-0.2: the opponent's snapshotted squad, so a mid-match splice
  // keeps attributing real opponent player goals/events too, matching
  // what the initial simulation now does (matchdayAction.ts). No live
  // per-save injury/suspension tracking exists for AI clubs, so this
  // intentionally omits the playerStatuses override, same as matchdayAction.ts.
  const opponentRoster = buildMatchRoster(getCareerClubSquad(state, opponentClubId), undefined, opponentAttackExposureById, opponentActiveWindowsById);

  const adjustment = computeTacticalMatchAdjustment(
    state.saveSeed,
    fixtureId,
    state.playerClubId,
    original.homeClubId,
    newProfile,
    sevenVSixActive,
    opponentAdaptation,
  );

  const segmentSeed = seedFromString(`${state.saveSeed}:${fixtureId}:midmatch:${adoptionMinute}`);
  const segment = simulateMatchSegment({
    seed: segmentSeed,
    startMinute: adoptionMinute,
    endMinute: 60,
    homeClubId: original.homeClubId,
    awayClubId: original.awayClubId,
    homeStrength: computeSquadDerivedClubStrength(original.homeClubId, getCareerClubSquad(state, original.homeClubId), state.gameplayRatings[original.homeClubId] ?? []),
    awayStrength: computeSquadDerivedClubStrength(original.awayClubId, getCareerClubSquad(state, original.awayClubId), state.gameplayRatings[original.awayClubId] ?? []),
    homeTacticalAdjustment: adjustment.home,
    awayTacticalAdjustment: adjustment.away,
    homeRoster: managerIsHome ? roster : opponentRoster,
    awayRoster: managerIsHome ? opponentRoster : roster,
  });

  // 1. Preserve the exact, already-revealed prefix.
  const prefixEvents = original.events.filter((e) => e.minute < adoptionMinute);
  const lastPrefixGoal = [...prefixEvents].reverse().find((e) => e.type === "GOAL");
  const homeScoreCarry = lastPrefixGoal?.homeScoreAfter ?? 0;
  const awayScoreCarry = lastPrefixGoal?.awayScoreAfter ?? 0;

  // 2. Offset the segment's LOCAL (0-0-based) running score by the carried-forward prefix score.
  const suffixEvents: MatchEvent[] = segment.events.map((e) =>
    e.type === "GOAL" ? { ...e, homeScoreAfter: (e.homeScoreAfter ?? 0) + homeScoreCarry, awayScoreAfter: (e.awayScoreAfter ?? 0) + awayScoreCarry } : e,
  );

  const allEvents = [...prefixEvents, ...suffixEvents].sort((a, b) => a.minute - b.minute);

  // 3. Re-tally final stats over the FULL spliced timeline -- the same, already-proven counting logic Live Match/Analysis use.
  const homeShotsOnly = allEvents.filter((e) => e.side === "home" && (e.type === "GOAL" || e.type === "MISS" || e.type === "SAVE")).length;
  const awayShotsOnly = allEvents.filter((e) => e.side === "away" && (e.type === "GOAL" || e.type === "MISS" || e.type === "SAVE")).length;
  const homeTally = tallyTeamStats(allEvents, "home", awayShotsOnly);
  const awayTally = tallyTeamStats(allEvents, "away", homeShotsOnly);

  const homeGoals = homeScoreCarry + segment.homeGoals;
  const awayGoals = awayScoreCarry + segment.awayGoals;

  const homeGoalCounts = tallyPlayerGoalsFull(allEvents, "home");
  const awayGoalCounts = tallyPlayerGoalsFull(allEvents, "away");
  const contributionSeed = seedFromString(`${state.saveSeed}:${fixtureId}:midmatch:${adoptionMinute}:contrib`);
  const homePlayerContributions = rebuildContributions(
    contributionSeed,
    managerIsHome ? roster : opponentRoster,
    homeGoalCounts,
    homeGoals,
    homeTally.shotsFaced,
    homeTally.saves,
  );
  const awayPlayerContributions = rebuildContributions(
    contributionSeed,
    managerIsHome ? opponentRoster : roster,
    awayGoalCounts,
    awayGoals,
    awayTally.shotsFaced,
    awayTally.saves,
  );

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

  return { ...state, results: { ...state.results, [fixtureId]: splicedResult } };
}
