/**
 * MATCH-EXPERIENCE-2.0 M14: the spatial match -> the career's own result
 * contract. M15: read from the canonical event stream.
 *
 * THE ONE RULE THIS MODULE OBEYS. Every number below is READ OFF the simulated
 * match. Nothing is drawn, nudged or filled in from a second engine: the score
 * is the score the shots produced, a scorer is the player the engine recorded
 * taking the shot, a save is a save its goalkeeper actually made.
 *
 * M15 changed WHERE it reads from, not what it says. It used to pair segments
 * with event records and re-derive which shot was a 7 metre, who committed a
 * foul and whose goalkeeper stopped what. All of that is now a typed
 * CanonicalMatchEvent, so this module is a projection of that stream and
 * nothing else -- no segment/event pairing, no re-derivation, and (as before)
 * not one line that reads a human-readable note.
 *
 * The adapter lives here, on the career side of the seam, precisely so that
 * `handball-engine` never learns what a FastMatchResult is.
 */
import type { FastMatchResult, MatchEvent, PlayerMatchContribution, TeamMatchStats } from "@handball-manager/game-simulation";
import { eventsOfType, type CanonicalMatchEvent } from "@handball-manager/handball-engine/src/simulation/canonicalEvents.ts";
import type { CareerLineup } from "./careerLineup";

type Side = "home" | "away";
type EngineTeam = "HOME" | "AWAY";

/** The engine's HOME is whichever side started in possession, which the adapter always makes the career home club. */
function sideOf(team: EngineTeam | null): Side {
  return team === "AWAY" ? "away" : "home";
}

function otherSide(side: Side): Side {
  return side === "home" ? "away" : "home";
}

/** The official minute an event belongs to. Minute 1 is the first minute of play. */
function minuteOf(event: CanonicalMatchEvent): number {
  return Math.max(1, Math.ceil(event.matchSeconds / 60));
}

// ---------------------------------------------------------------------------
// Team statistics
// ---------------------------------------------------------------------------

function buildTeamStats(events: readonly CanonicalMatchEvent[], team: EngineTeam, opponentShots: number): TeamMatchStats {
  const shots = eventsOfType(events, "SHOT");
  const own = shots.filter((s) => s.teamId === team);
  const goals = eventsOfType(events, "GOAL").filter((g) => g.teamId === team);
  const sevenMetres = own.filter((s) => s.sevenMetre);

  return {
    goals: goals.length,
    shots: own.length,
    shootingPct: own.length === 0 ? 0 : Math.round((goals.length / own.length) * 1000) / 10,
    // A save this side made is an opponent shot its goalkeeper stopped.
    saves: shots.filter((s) => s.teamId !== team && s.outcome === "SAVED").length,
    // The career contract's own convention (see game-simulation's matchEngine):
    // shots faced is the opponent's total shot count, not just those on target.
    shotsFaced: opponentShots,
    turnovers: eventsOfType(events, "TURNOVER").filter((t) => t.teamId === team).length,
    // A suspension already belongs to the offender's own side in the event.
    twoMinuteSuspensions: eventsOfType(events, "SUSPENSION").filter((s) => s.teamId === team).length,
    sevenMetreAttempts: sevenMetres.length,
    sevenMetreGoals: sevenMetres.filter((s) => s.outcome === "GOAL").length,
  };
}

// ---------------------------------------------------------------------------
// The timeline
// ---------------------------------------------------------------------------

/**
 * The career's own event timeline, mapped one-for-one from the canonical one.
 *
 * A GOAL event carries the running score the engine itself recorded, so the
 * timeline and the final score cannot drift apart -- the number of GOAL events
 * is the final score by construction, which is the invariant the existing
 * Match Report relies on.
 */
export function buildMatchEvents(events: readonly CanonicalMatchEvent[]): MatchEvent[] {
  const out: MatchEvent[] = [];
  for (const event of events) {
    const minute = minuteOf(event);
    switch (event.type) {
      case "SHOT": {
        const side = sideOf(event.teamId);
        // A 7 metre is recorded as its own entry as well as the shot it was,
        // exactly as the career contract describes: the SEVEN_M entry never
        // adds its own score change, the GOAL entry beside it already did.
        if (event.sevenMetre) {
          out.push({ minute, side, type: "SEVEN_M", playerId: event.playerId ?? undefined, sevenMetreOutcome: event.outcome === "GOAL" ? "GOAL" : "MISS" });
        }
        if (event.outcome === "SAVED") {
          // A save belongs to the goalkeeper who made it, so it is recorded on
          // HIS side rather than the shooter's.
          out.push({ minute, side: otherSide(side), type: "SAVE", playerId: event.goalkeeperId ?? undefined });
        } else if (event.outcome !== "GOAL") {
          out.push({ minute, side, type: "MISS", playerId: event.playerId ?? undefined });
        }
        break;
      }
      case "GOAL":
        out.push({
          minute,
          side: sideOf(event.teamId),
          type: "GOAL",
          playerId: event.playerId ?? undefined,
          homeScoreAfter: event.score.HOME,
          awayScoreAfter: event.score.AWAY,
        });
        break;
      case "TURNOVER":
        out.push({ minute, side: sideOf(event.teamId), type: "TURNOVER", playerId: event.playerId ?? undefined });
        break;
      case "SUSPENSION":
        out.push({ minute, side: sideOf(event.teamId), type: "TWO_MIN", playerId: event.playerId });
        break;
      default:
        // Passes, drives, possession changes, timeouts, instruction changes and
        // the match's own structure are all real canonical facts, but the
        // career's MatchEvent vocabulary has no place for them. They are left
        // in the canonical stream rather than squeezed into a type they are not.
        break;
    }
  }
  return out;
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

function buildContributions(
  events: readonly CanonicalMatchEvent[],
  playedIds: ReadonlySet<string>,
  lineup: CareerLineup,
  team: EngineTeam,
): PlayerMatchContribution[] {
  const starters = new Set<string>([lineup.goalkeeperId, ...Object.values(lineup.startersByRole)]);
  const goals = new Map<string, number>();
  const shots = new Map<string, number>();
  const saves = new Map<string, number>();
  const faced = new Map<string, number>();
  const bump = (map: Map<string, number>, id: string | null | undefined) => {
    if (id) map.set(id, (map.get(id) ?? 0) + 1);
  };

  for (const shot of eventsOfType(events, "SHOT")) {
    if (shot.teamId === team) {
      bump(shots, shot.playerId);
      if (shot.outcome === "GOAL") bump(goals, shot.playerId);
    } else {
      // This side's goalkeeper is the one facing the other side's shots.
      bump(faced, shot.goalkeeperId);
      if (shot.outcome === "SAVED") bump(saves, shot.goalkeeperId);
    }
  }

  const goalkeeperIds = new Set<string>([lineup.goalkeeperId, ...lineup.bench.filter((b) => b.isGoalkeeper).map((b) => b.playerId)]);
  return [...playedIds]
    .filter((id) => lineup.squadIds.includes(id))
    .sort()
    .map((playerId) => {
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
  /** The canonical event stream of the match. The only factual source used here. */
  events: readonly CanonicalMatchEvent[];
  /** Everybody the match actually put on the court, so a bench-warmer gets no record. */
  playedPlayerIds: ReadonlySet<string>;
  fixtureId: string;
  seed: number;
  homeClubId: string;
  awayClubId: string;
  home: CareerLineup;
  away: CareerLineup;
}): FastMatchResult {
  const shots = eventsOfType(input.events, "SHOT");
  const homeShots = shots.filter((s) => s.teamId === "HOME").length;
  const awayShots = shots.filter((s) => s.teamId === "AWAY").length;
  const goals = eventsOfType(input.events, "GOAL");
  return {
    fixtureId: input.fixtureId,
    engine: "SPATIAL",
    seed: input.seed,
    homeClubId: input.homeClubId,
    awayClubId: input.awayClubId,
    homeGoals: goals.filter((g) => g.teamId === "HOME").length,
    awayGoals: goals.filter((g) => g.teamId === "AWAY").length,
    homeStats: buildTeamStats(input.events, "HOME", awayShots),
    awayStats: buildTeamStats(input.events, "AWAY", homeShots),
    events: buildMatchEvents(input.events),
    homePlayerContributions: buildContributions(input.events, input.playedPlayerIds, input.home, "HOME"),
    awayPlayerContributions: buildContributions(input.events, input.playedPlayerIds, input.away, "AWAY"),
  };
}
