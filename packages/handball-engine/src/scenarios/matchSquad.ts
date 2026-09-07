/**
 * MATCH-EXPERIENCE-2.0 M11: the bench.
 *
 * Until now a match squad was exactly the fourteen players standing on the
 * court. There was no distinction between "in the squad" and "playing", so
 * there was nobody to bring on, and every piece of intelligence from M6 to M10
 * could quietly assume the same seven ids per side were present for sixty
 * minutes.
 *
 * This module supplies the rest of the squad. The bench players are REAL player
 * entities -- same shape, same movement profile, their own ids -- built
 * deterministically from the starters so that a dev or test match has somebody
 * to rotate without careers or the legacy engine being involved. They simply do
 * not appear in the spatial state until they come on.
 *
 * They are given the substitution line as their position so that a player who
 * has never played still has a coherent place in the world; the moment he is
 * brought on, that is where he enters from.
 */
import { CANONICAL_COURT_LENGTH_METERS } from "@handball-manager/match-contract";
import type { MeterPoint } from "../domain/geometry/coordinates";
import type { Player } from "../domain/handball/player";
import type { FullCourtMatchState } from "../domain/match/possession";

/** Stable side identity, matching gameFlow's. Declared locally so the squad has no dependency on the flow layer. */
export type SquadTeamId = "HOME" | "AWAY";

/** Where a substitute waits, and where he steps onto the court. */
export const SUBSTITUTION_AREA: MeterPoint = Object.freeze({ x: 0.6, y: CANONICAL_COURT_LENGTH_METERS / 2 });

/** Outfield substitutes per side in a dev/test squad. */
export const BENCH_OUTFIELD_PER_TEAM = 4;
/** Reserve goalkeepers per side. */
export const BENCH_GOALKEEPERS_PER_TEAM = 1;

/** Roles the outfield substitutes carry until they inherit one on entering. */
const BENCH_ROLE_CYCLE = ["LEFT_BACK", "CENTER_BACK", "RIGHT_BACK", "PIVOT"] as const;

function benchPlayer(archetype: Player, id: string, role: Player["role"], kind: Player["kind"]): Player {
  return {
    ...archetype,
    id,
    role,
    kind,
    position: { ...SUBSTITUTION_AREA },
    velocity: { x: 0, y: 0 },
    facing: { ...archetype.facing },
    intent: { type: "IDLE" },
  };
}

/**
 * Builds a deterministic bench for both sides of a match.
 *
 * HOME is whoever starts in possession and AWAY the other side -- the same rule
 * the flow layer uses to build its rosters, so the two agree without either
 * having to know about the other.
 */
export function buildMatchBench(match: FullCourtMatchState): Record<SquadTeamId, readonly Player[]> {
  const build = (side: "ATTACK" | "DEFENSE", prefix: string): Player[] => {
    const players = match.handball.players.filter((p) => p.team === side);
    const outfieldArchetype = players.find((p) => p.kind === "FIELD_PLAYER");
    const keeperArchetype = players.find((p) => p.kind === "GOALKEEPER") ?? outfieldArchetype;
    if (!outfieldArchetype || !keeperArchetype) return [];
    const bench: Player[] = [];
    for (let i = 0; i < BENCH_OUTFIELD_PER_TEAM; i += 1) {
      bench.push(benchPlayer(outfieldArchetype, `${prefix}-sub-${i + 1}`, BENCH_ROLE_CYCLE[i % BENCH_ROLE_CYCLE.length], "FIELD_PLAYER"));
    }
    for (let i = 0; i < BENCH_GOALKEEPERS_PER_TEAM; i += 1) {
      bench.push(benchPlayer(keeperArchetype, `${prefix}-sub-goalkeeper-${i + 1}`, "GOALKEEPER", "GOALKEEPER"));
    }
    return bench;
  };
  return { HOME: build("ATTACK", "home"), AWAY: build("DEFENSE", "away") };
}

/** Every goalkeeper in either squad, on court or on the bench. */
export function squadGoalkeeperIds(match: FullCourtMatchState, bench: Record<SquadTeamId, readonly Player[]>): string[] {
  return [
    ...match.handball.players.filter((p) => p.kind === "GOALKEEPER").map((p) => p.id),
    ...[...bench.HOME, ...bench.AWAY].filter((p) => p.kind === "GOALKEEPER").map((p) => p.id),
  ];
}
