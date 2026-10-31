/**
 * MATCH-EXPERIENCE-2.0 M14: the seam. A career fixture, played by the spatial
 * engine.
 *
 *   career fixture -> real squads/plans -> handball-engine M1-M13
 *     -> one spatial match -> career-compatible result
 *
 * THERE IS ONE SIMULATION. This function is the only place a migrated career
 * fixture is played, and it runs `simulateMatch` exactly once. The scoreline it
 * returns IS that match's scoreline; nothing is merged with, checked against or
 * topped up from the Fast Match Engine, which is never called on this path.
 *
 * IT IS ALSO THE ONLY PLACE MATCH 2D CALLS. The playback screen asks for the
 * same fixture from the same career state and gets the same match back --
 * because the whole thing is a pure function of (career squads, plans, seed),
 * with no wall clock anywhere in it. The visualisation is therefore not a
 * second match that happens to look similar; it is the same match, re-derived.
 */
import { seedFromString } from "@handball-manager/game-simulation";
import type { FastMatchResult } from "@handball-manager/game-simulation";
import { simulateMatch, type MatchResult } from "@handball-manager/handball-engine/src/simulation/matchRunner.ts";
import { autonomousCoach } from "@handball-manager/handball-engine/src/simulation/coach.ts";
import type { AttackingGoalSide } from "@handball-manager/handball-engine/src/domain/match/possession.ts";
import { buildCareerBench, buildCareerMatchState, resolveCareerLineup, type CareerLineup } from "./careerLineup";
import { buildSpatialRatings, type SpatialRatingEntry } from "./careerRatings";
import { instructionsFromMatchPlan } from "./careerInstructions";
import type { PlayerMock } from "../../game-data/types";
import type { GameplayPlayerRating } from "../../gameWorld/gameplayRatingSnapshot";
import type { MatchPlan } from "../../matchPlan/types";
import { toFastMatchResult } from "./spatialMatchResult";
import { buildCanonicalMatchEvents, type CanonicalMatchEvent } from "@handball-manager/handball-engine/src/simulation/canonicalEvents.ts";
import { getCareerClubSquad } from "../careerWorld";
import { isSelectableForMatch } from "../playerStatus";
import { resolveClubMatchPlanForFixture } from "../playerMatchStrength";
import { buildEmptyMatchPlan, isManualLineupCareer } from "../manualLineup";
import type { CareerFixture, CareerState } from "../types";

/** Everything one club brings to the match. */
export type SpatialMatchSide = {
  readonly clubId: string;
  readonly squad: readonly PlayerMock[];
  readonly gameplayRatings: readonly GameplayPlayerRating[];
  /** The coach's own selection and plan for this fixture, when he has one. */
  readonly plan: MatchPlan | null;
};

export type SpatialCareerMatchInput = {
  readonly fixtureId: string;
  readonly saveSeed: string;
  readonly home: SpatialMatchSide;
  readonly away: SpatialMatchSide;
  /**
   * Which goal the home side attacks first. Fixed rather than random: a
   * fixture's ends are not a source of variation, and pinning it keeps the same
   * fixture reproducible.
   */
  readonly firstHalfGoalSide?: AttackingGoalSide;
};

export type SpatialCareerMatch = {
  /** The career-facing result, ready to store in `CareerState.results`. */
  readonly result: FastMatchResult;
  /** The spatial match itself, including the trace Match 2D plays back. */
  readonly match: MatchResult;
  /**
   * M15: the canonical event stream of this match -- the typed facts it
   * produced. The career result above is derived from exactly this, and any
   * other consumer (commentary, the report, later analytics) reads the same
   * list rather than re-deriving its own.
   */
  readonly events: readonly CanonicalMatchEvent[];
  readonly seed: number;
  readonly home: CareerLineup;
  readonly away: CareerLineup;
  /** Which rating source each selected player's numbers came from. */
  readonly ratings: Readonly<Record<string, SpatialRatingEntry>>;
};

export type SpatialCareerMatchFailure = {
  readonly reason: "NO_LINEUP";
  readonly clubId: string;
};

/**
 * A stable seed for this fixture.
 *
 * Built from the save's own seed and the fixture id -- both stable career
 * identifiers that already exist -- so the same fixture in the same save always
 * plays out the same way, and two different fixtures never share a match.
 */
export function spatialMatchSeed(saveSeed: string, fixtureId: string): number {
  return seedFromString(`${saveSeed}:${fixtureId}:spatial`);
}

/**
 * Plays one career fixture on the spatial engine.
 *
 * Returns a failure rather than throwing when a side cannot field a legal seven
 * -- a career must not crash because a squad is too thin -- and the caller
 * decides what to do about it.
 */
export function simulateCareerFixtureSpatially(input: SpatialCareerMatchInput): SpatialCareerMatch | SpatialCareerMatchFailure {
  const home = resolveCareerLineup(input.home.clubId, input.home.squad, input.home.plan);
  if (!home) return { reason: "NO_LINEUP", clubId: input.home.clubId };
  const away = resolveCareerLineup(input.away.clubId, input.away.squad, input.away.plan);
  if (!away) return { reason: "NO_LINEUP", clubId: input.away.clubId };

  const firstHalfGoalSide: AttackingGoalSide = input.firstHalfGoalSide ?? "TOP";
  const initialState = buildCareerMatchState(home, away, firstHalfGoalSide);

  // Halftime genuinely resets the court and switches ends, so the runner needs
  // to be able to rebuild the line-up at the other goal. Same real players,
  // same roles -- this is why the engine takes a shape builder rather than
  // assuming its own canonical squad.
  const halfStartState = (side: AttackingGoalSide) => buildCareerMatchState(home, away, side);

  const bench = buildCareerBench(initialState, home, away);
  const ratings = {
    ...buildSpatialRatings(input.home.squad, input.home.gameplayRatings, home.squadIds),
    ...buildSpatialRatings(input.away.squad, input.away.gameplayRatings, away.squadIds),
  };
  const seed = spatialMatchSeed(input.saveSeed, input.fixtureId);

  // ONE call. This is the whole match.
  const match = simulateMatch(initialState, seed, {
    ratings,
    bench,
    halfStartState,
    setup: {
      instructions: {
        HOME: instructionsFromMatchPlan(input.home.plan),
        AWAY: instructionsFromMatchPlan(input.away.plan),
      },
    },
    coaches: { HOME: autonomousCoach(), AWAY: autonomousCoach() },
  });

  // M15: the canonical facts of the match, derived once from its typed output.
  // Nothing here influences the match -- it has already been played.
  const events = buildCanonicalMatchEvents(match);
  // Who the match actually put on the court. Read from the spatial trace, which
  // is the only place that knows a substitute came on.
  const playedPlayerIds = new Set<string>();
  for (const entry of match.trace) for (const p of entry.playerPositions) playedPlayerIds.add(p.playerId);

  return {
    match,
    events,
    seed,
    home,
    away,
    ratings,
    result: toFastMatchResult({
      events,
      playedPlayerIds,
      fixtureId: input.fixtureId,
      seed,
      homeClubId: input.home.clubId,
      awayClubId: input.away.clubId,
      home,
      away,
    }),
  };
}

export function isSpatialMatchFailure(value: SpatialCareerMatch | SpatialCareerMatchFailure): value is SpatialCareerMatchFailure {
  return "reason" in value;
}

// ---------------------------------------------------------------------------
// The one place a career fixture becomes match inputs
// ---------------------------------------------------------------------------

/**
 * The inputs for one career fixture, built from the career state alone.
 *
 * EVERY CALLER USES THIS. The matchday action plays the fixture through it, and
 * Match 2D asks for the same fixture through it to get a trace. Because it is a
 * pure function of the saved career state, both get byte-identical inputs and
 * therefore the same match -- which is how the result screen and the playback
 * are guaranteed to be showing one simulation rather than two similar ones.
 *
 * The manager's own squad is filtered to who is actually selectable, so an
 * injured or suspended player can never appear on the court; the AI side has no
 * per-save status tracking, which is the same honest scope every other career
 * path already documents for opponent clubs.
 */
export function buildSpatialMatchInput(state: CareerState, fixture: CareerFixture): SpatialCareerMatchInput {
  const sideFor = (clubId: string): SpatialMatchSide => {
    const isManagerClub = clubId === state.playerClubId;
    const full = getCareerClubSquad(state, clubId);
    const squad = isManagerClub ? full.filter((p) => isSelectableForMatch(state.playerStatuses, p.id)) : full;
    const saved = isManagerClub ? state.matchPlans[fixture.id] : undefined;
    // HM-ALPHA2-01: a MANUAL career's own side never falls back to a
    // generated default -- with nothing selected it stays empty and the
    // strict lineup validation below refuses it.
    const plan = isManagerClub && isManualLineupCareer(state)
      ? (saved ?? buildEmptyMatchPlan(fixture.id, clubId, state.tactics[clubId]))
      : resolveClubMatchPlanForFixture(clubId, fixture.id, squad, saved, state.tactics[clubId], state.playerMatchDefaults);
    // Keep invalid/stale custom plans visible to the strict lineup validator.
    // Replacing one with null would silently select a different team.
    return { clubId, squad, gameplayRatings: state.gameplayRatings[clubId] ?? [], plan };
  };
  return {
    fixtureId: fixture.id,
    saveSeed: state.saveSeed,
    home: sideFor(fixture.homeClubId),
    away: sideFor(fixture.awayClubId),
  };
}

/** The whole path for one career fixture, from saved state to a played match. */
export function playCareerFixtureSpatially(state: CareerState, fixture: CareerFixture): SpatialCareerMatch | SpatialCareerMatchFailure {
  return simulateCareerFixtureSpatially(buildSpatialMatchInput(state, fixture));
}
