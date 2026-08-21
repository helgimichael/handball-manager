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
import { simulateMatchSegment, type FastMatchResult, type MatchEvent, type PlayerMatchContribution } from "@handball-manager/game-simulation";
import { createRng, seedFromString } from "@handball-manager/game-simulation";
import { getClubStrength } from "../game-data/clubStrength";
import { tallyTeamStats } from "../liveMatch/liveMatchView";
import { computeTacticalMatchAdjustment } from "./tacticalMatchAdjustment";
import { getCareerSquad } from "./careerWorld";
import { buildMatchRoster } from "./tumbaRoster";
import type { TeamTacticalProfile } from "./teamTacticalProfile";
import type { CareerState } from "./types";

/**
 * Tallies goals per player from a full (prefix + suffix) spliced event
 * list -- goals are the one stat MatchEvent attributes to a specific
 * player (see types.ts's MatchEvent.playerId doc), so this is always
 * exact, unlike shots/rating below.
 */
function tallyPlayerGoalsFull(events: readonly MatchEvent[], side: "home" | "away"): Map<string, number> {
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
function rebuildContributions(
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
  return roster.map((p) => {
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
): CareerState {
  const original = state.results[fixtureId];
  if (!original || adoptionMinute >= 60) {
    return state;
  }

  const roster = buildMatchRoster(getCareerSquad(state), state.playerStatuses);
  const managerIsHome = original.homeClubId === state.playerClubId;

  const adjustment = computeTacticalMatchAdjustment(state.saveSeed, fixtureId, state.playerClubId, original.homeClubId, newProfile);

  const segmentSeed = seedFromString(`${state.saveSeed}:${fixtureId}:midmatch:${adoptionMinute}`);
  const segment = simulateMatchSegment({
    seed: segmentSeed,
    startMinute: adoptionMinute,
    endMinute: 60,
    homeClubId: original.homeClubId,
    awayClubId: original.awayClubId,
    homeStrength: getClubStrength(original.homeClubId),
    awayStrength: getClubStrength(original.awayClubId),
    homeTacticalAdjustment: adjustment.home,
    awayTacticalAdjustment: adjustment.away,
    homeRoster: managerIsHome ? roster : undefined,
    awayRoster: managerIsHome ? undefined : roster,
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
  const homePlayerContributions = managerIsHome
    ? rebuildContributions(contributionSeed, roster, homeGoalCounts, homeGoals, homeTally.shotsFaced, homeTally.saves)
    : original.homePlayerContributions;
  const awayPlayerContributions = managerIsHome
    ? original.awayPlayerContributions
    : rebuildContributions(contributionSeed, roster, awayGoalCounts, awayGoals, awayTally.shotsFaced, awayTally.saves);

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
