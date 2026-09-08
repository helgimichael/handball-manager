/**
 * MATCH-EXPERIENCE-2.0 M14: the spatial match -> the career's own result
 * contract.
 *
 * THE ONE RULE THIS MODULE OBEYS. Every number below is READ OFF the simulated
 * match. Nothing is drawn, nudged or filled in from a second engine: the score
 * is the score the shots produced, a scorer is the player the engine recorded
 * taking the shot, a save is a save its goalkeeper actually made. Where the
 * career contract has a field the spatial match genuinely cannot answer yet,
 * this module says so in its own doc rather than inventing a plausible number.
 *
 * The adapter lives here, on the career side of the seam, precisely so that
 * `handball-engine` never learns what a FastMatchResult is.
 */
import type { FastMatchResult, MatchEvent, PlayerMatchContribution, TeamMatchStats } from "@handball-manager/game-simulation";
import type { MatchResult } from "@handball-manager/handball-engine/src/simulation/matchRunner.ts";
import type { CareerLineup } from "./careerLineup";

type Side = "home" | "away";

const SHOT_OUTCOMES = ["SHOT_GOAL", "SHOT_SAVED", "SHOT_MISSED"] as const;
type ShotOutcome = (typeof SHOT_OUTCOMES)[number];

function isShot(outcome: string): outcome is ShotOutcome {
  return (SHOT_OUTCOMES as readonly string[]).includes(outcome);
}

/** The engine's HOME is whichever side started in possession, which the adapter always makes the career home club. */
function sideOf(team: "HOME" | "AWAY"): Side {
  return team === "HOME" ? "home" : "away";
}

/**
 * A segment and the event it produced, paired.
 *
 * The runner pushes exactly one segment and one event per simulated segment, in
 * the same loop, so the two arrays are positionally aligned. The pairing is
 * done defensively rather than assumed, so a future change to either array
 * degrades into fewer paired events rather than mis-attributed goals.
 */
function pairSegmentsWithEvents(match: MatchResult) {
  const count = Math.min(match.segments.length, match.events.length);
  const pairs: { segment: MatchResult["segments"][number]; record: MatchResult["events"][number] }[] = [];
  for (let i = 0; i < count; i += 1) {
    const segment = match.segments[i];
    const record = match.events[i];
    if (segment.outcome !== record.outcome) continue;
    pairs.push({ segment, record });
  }
  return pairs;
}

/** A segment whose possession was decided by a 7 metre throw -- the foul that awarded it is on the segment itself. */
function sevenMetreOf(segment: MatchResult["segments"][number]): boolean {
  return segment.fouls.some((f) => f.restart === "SEVEN_METRE");
}

// ---------------------------------------------------------------------------
// Team statistics
// ---------------------------------------------------------------------------

function buildTeamStats(match: MatchResult, team: "HOME" | "AWAY", opponentShots: number): TeamMatchStats {
  const pairs = pairSegmentsWithEvents(match);
  const own = pairs.filter((p) => p.segment.team === team);
  const shots = own.filter((p) => isShot(p.segment.outcome)).length;
  const goals = match.finalScore[team];
  const turnovers = own.filter((p) => p.segment.outcome === "TURNOVER").length;
  const sevenMetres = own.filter((p) => sevenMetreOf(p.segment) && isShot(p.segment.outcome));
  // A suspension belongs to the side that committed the foul, which is the side
  // NOT in possession during that segment.
  const twoMinuteSuspensions = pairs.filter((p) => p.segment.team !== team).flatMap((p) => p.segment.fouls).filter((f) => f.suspend).length;
  // Saves this side's goalkeeper made = the opponent's shots his keeper stopped.
  const saves = pairs.filter((p) => p.segment.team !== team && p.segment.outcome === "SHOT_SAVED").length;

  return {
    goals,
    shots,
    shootingPct: shots === 0 ? 0 : Math.round((goals / shots) * 1000) / 10,
    saves,
    // The career contract's own convention (see game-simulation's matchEngine):
    // shots faced is the opponent's total shot count, not just those on target.
    shotsFaced: opponentShots,
    turnovers,
    twoMinuteSuspensions,
    sevenMetreAttempts: sevenMetres.length,
    sevenMetreGoals: sevenMetres.filter((p) => p.segment.outcome === "SHOT_GOAL").length,
  };
}

function countShots(match: MatchResult, team: "HOME" | "AWAY"): number {
  return pairSegmentsWithEvents(match).filter((p) => p.segment.team === team && isShot(p.segment.outcome)).length;
}

// ---------------------------------------------------------------------------
// The timeline
// ---------------------------------------------------------------------------

/**
 * The career's own event timeline, derived one-for-one from the engine's.
 *
 * A GOAL event carries the running score the engine itself recorded, so the
 * timeline and the final score cannot drift apart -- the number of GOAL events
 * is the final score by construction, which is the invariant the existing
 * Match Report relies on.
 */
export function buildMatchEvents(match: MatchResult): MatchEvent[] {
  const events: MatchEvent[] = [];
  for (const { segment, record } of pairSegmentsWithEvents(match)) {
    const minute = Math.max(1, Math.ceil(record.matchSeconds / 60));
    const side = sideOf(segment.team);
    const playerId = record.event.playerId ?? undefined;
    const sevenMetre = sevenMetreOf(segment) && isShot(segment.outcome);

    // A 7 metre is recorded as its own event as well as the ordinary shot
    // event, exactly as the career contract describes: the SEVEN_M entry never
    // adds its own score change, the GOAL entry beside it already did.
    if (sevenMetre) {
      events.push({ minute, side, type: "SEVEN_M", playerId, sevenMetreOutcome: segment.outcome === "SHOT_GOAL" ? "GOAL" : "MISS" });
    }

    switch (segment.outcome) {
      case "SHOT_GOAL":
        events.push({ minute, side, type: "GOAL", playerId, homeScoreAfter: record.scoreAfter.HOME, awayScoreAfter: record.scoreAfter.AWAY });
        break;
      case "SHOT_SAVED":
        // A save belongs to the goalkeeper who made it, so it is recorded on
        // HIS side rather than the shooter's.
        events.push({ minute, side: side === "home" ? "away" : "home", type: "SAVE", playerId: record.event.goalkeeperId ?? undefined });
        break;
      case "SHOT_MISSED":
        events.push({ minute, side, type: "MISS", playerId });
        break;
      case "TURNOVER":
        events.push({ minute, side, type: "TURNOVER", playerId });
        break;
      default:
        break;
    }

    for (const foul of segment.fouls) {
      if (!foul.suspend) continue;
      // The offender defends, so the suspension is his side's -- the one not in possession.
      events.push({ minute, side: side === "home" ? "away" : "home", type: "TWO_MIN", playerId: foul.defenderId });
    }
  }
  return events.sort((a, b) => a.minute - b.minute);
}

// ---------------------------------------------------------------------------
// Player contributions
// ---------------------------------------------------------------------------

/**
 * A 1-10 match rating.
 *
 * DELIBERATELY SIMPLE AND DELIBERATELY STATED. The spatial engine does not yet
 * model most of what a real match rating should reward -- defensive work,
 * assists, drawn fouls, minutes -- so rather than dressing a richer-looking
 * number up, this is an explicit function of the two things the match really
 * did record for him: what he produced with his shots, and (for a goalkeeper)
 * what he stopped. A player who never shot sits at the 6.0 baseline.
 */
export function matchRating(input: { goals: number; shots: number; saves: number; shotsFaced: number; isGoalkeeper: boolean }): number {
  if (input.isGoalkeeper) {
    const savePct = input.shotsFaced === 0 ? 0 : input.saves / input.shotsFaced;
    return Math.round(Math.max(1, Math.min(10, 5.5 + savePct * 5)) * 10) / 10;
  }
  const misses = Math.max(0, input.shots - input.goals);
  return Math.round(Math.max(1, Math.min(10, 6 + input.goals * 0.35 - misses * 0.12)) * 10) / 10;
}

function buildContributions(match: MatchResult, lineup: CareerLineup, team: "HOME" | "AWAY"): PlayerMatchContribution[] {
  const pairs = pairSegmentsWithEvents(match);
  const starters = new Set<string>([lineup.goalkeeperId, ...Object.values(lineup.startersByRole)]);
  // Everybody the match actually put on the court, so a substitute who came on
  // gets a record and a player who never left the bench does not.
  const played = new Set<string>();
  for (const entry of match.trace) {
    for (const p of entry.playerPositions) if (lineup.squadIds.includes(p.playerId)) played.add(p.playerId);
  }

  const goals = new Map<string, number>();
  const shots = new Map<string, number>();
  const saves = new Map<string, number>();
  const faced = new Map<string, number>();
  const bump = (map: Map<string, number>, id: string | null | undefined) => {
    if (id) map.set(id, (map.get(id) ?? 0) + 1);
  };

  for (const { segment, record } of pairs) {
    if (segment.team === team && isShot(segment.outcome)) {
      bump(shots, record.event.playerId);
      if (segment.outcome === "SHOT_GOAL") bump(goals, record.event.playerId);
    }
    // The goalkeeper facing this shot is this side's when the OTHER side shot.
    if (segment.team !== team && isShot(segment.outcome)) {
      bump(faced, record.event.goalkeeperId);
      if (segment.outcome === "SHOT_SAVED") bump(saves, record.event.goalkeeperId);
    }
  }

  const goalkeeperIds = new Set<string>([lineup.goalkeeperId, ...lineup.bench.filter((b) => b.isGoalkeeper).map((b) => b.playerId)]);
  return [...played].sort().map((playerId) => {
    const isGoalkeeper = goalkeeperIds.has(playerId);
    const contribution: PlayerMatchContribution = {
      playerId,
      goals: goals.get(playerId) ?? 0,
      shots: shots.get(playerId) ?? 0,
      rating: matchRating({
        goals: goals.get(playerId) ?? 0,
        shots: shots.get(playerId) ?? 0,
        saves: saves.get(playerId) ?? 0,
        shotsFaced: faced.get(playerId) ?? 0,
        isGoalkeeper,
      }),
      started: starters.has(playerId),
    };
    return isGoalkeeper ? { ...contribution, saves: saves.get(playerId) ?? 0, shotsFaced: faced.get(playerId) ?? 0 } : contribution;
  });
}

// ---------------------------------------------------------------------------
// The result itself
// ---------------------------------------------------------------------------

/**
 * The career-facing result of a spatial match.
 *
 * `engine: "SPATIAL"` is the provenance marker: this result was produced by the
 * M1-M13 engine and no Fast Match Engine result exists for the fixture.
 */
export function toFastMatchResult(input: {
  match: MatchResult;
  fixtureId: string;
  seed: number;
  homeClubId: string;
  awayClubId: string;
  home: CareerLineup;
  away: CareerLineup;
}): FastMatchResult {
  const homeShots = countShots(input.match, "HOME");
  const awayShots = countShots(input.match, "AWAY");
  return {
    fixtureId: input.fixtureId,
    engine: "SPATIAL",
    seed: input.seed,
    homeClubId: input.homeClubId,
    awayClubId: input.awayClubId,
    homeGoals: input.match.finalScore.HOME,
    awayGoals: input.match.finalScore.AWAY,
    homeStats: buildTeamStats(input.match, "HOME", awayShots),
    awayStats: buildTeamStats(input.match, "AWAY", homeShots),
    events: buildMatchEvents(input.match),
    homePlayerContributions: buildContributions(input.match, input.home, "HOME"),
    awayPlayerContributions: buildContributions(input.match, input.away, "AWAY"),
  };
}
