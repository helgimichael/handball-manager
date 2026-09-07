/**
 * MATCH-EXPERIENCE-2.0 M5: turning a completed deterministic match into
 * renderable frames.
 *
 * THE RENDERER IS A CONSUMER. Everything in this module is derived from the
 * engine's own recorded output. Nothing here decides a player's target, who has
 * the ball, when a pass or shot happens, what the outcome is, or what the score
 * becomes -- those all come from handball-engine and are only read back. The
 * two things this module is allowed to do are exactly the two the milestone
 * permits: interpolate between recorded spatial states for smooth movement, and
 * convert the result into the neutral MatchRenderSnapshot that FIELD already
 * knows how to draw.
 *
 * WHY FRAMES NEED MORE THAN THE TRACE'S POSITIONS. A trace entry records where
 * every player stood, but not which side he was on at that instant -- and sides
 * genuinely change during a match, because ATTACK/DEFENSE is a situational role
 * that flips on every possession change. Rather than invent that, each frame
 * resolves it from data the engine already produced: the stable HOME/AWAY
 * rosters plus the trace entry's own `possessionTeam`. Goalkeeper identity is
 * fixed for the match and read once from the starting state.
 */
import type { MatchBallRenderState, MatchPlayerRenderState, MatchRenderSnapshot } from "@handball-manager/match-contract";

/** The subset of the engine's match result this module reads. Structural, so it needs no import from the engine package. */
export type PlaybackSourceMatch = {
  readonly halftimeScore: Readonly<Record<"HOME" | "AWAY", number>>;
  readonly finalScore: Readonly<Record<"HOME" | "AWAY", number>>;
  readonly trace: readonly {
    readonly half: 1 | 2;
    readonly matchSeconds: number;
    readonly clockSeconds: number;
    readonly simulationTime: number;
    readonly possessionTeam: "HOME" | "AWAY";
    readonly attackingGoalSide: "TOP" | "BOTTOM";
    readonly score: Readonly<Record<"HOME" | "AWAY", number>>;
    readonly ballPossessorId: string | null;
    readonly ballStatus: "POSSESSED" | "IN_FLIGHT" | "LOOSE";
    readonly ballPosition: { readonly x: number; readonly y: number };
    readonly playerPositions: readonly { readonly playerId: string; readonly position: { readonly x: number; readonly y: number } }[];
    readonly note: string;
  }[];
  readonly finalState: {
    readonly rosters: Readonly<Record<"HOME" | "AWAY", readonly string[]>>;
    /**
     * M11: every goalkeeper in either squad, bench included. Present on matches
     * that have a bench, and preferred over the caller's list so a substitute
     * keeper is still drawn as a keeper after he comes on.
     */
    readonly goalkeeperIds?: readonly string[];
  };
};

/** Which players are goalkeepers, fixed for the match. */
export type PlaybackRoster = {
  readonly goalkeeperIds: readonly string[];
  readonly rosters: Readonly<Record<"HOME" | "AWAY", readonly string[]>>;
};

export type PlaybackFrame = {
  readonly half: 1 | 2;
  readonly matchSeconds: number;
  readonly clockSeconds: number;
  readonly simulationTime: number;
  readonly score: Readonly<Record<"HOME" | "AWAY", number>>;
  readonly snapshot: MatchRenderSnapshot;
  readonly note: string;
};

export const PLAYBACK_SPEEDS = [1, 2, 4, 8] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

function sideOf(playerId: string, possessionTeam: "HOME" | "AWAY", rosters: PlaybackRoster["rosters"]): MatchPlayerRenderState["side"] {
  const isPossessing = rosters[possessionTeam].includes(playerId);
  return isPossessing ? "ATTACK" : "DEFENSE";
}

/**
 * Builds every renderable frame from a completed match.
 *
 * `goalkeeperIds` comes from the starting state, because a goalkeeper stays a
 * goalkeeper for the whole match -- his SIDE changes with possession, his kind
 * never does.
 */
export function buildPlaybackFrames(match: PlaybackSourceMatch, roster: PlaybackRoster): PlaybackFrame[] {
  // A substitute goalkeeper is a goalkeeper. Taking the set from the match's own
  // squad rather than from the starting line-up is what keeps that true after a
  // keeper change; the caller's list remains the fallback for a match with no
  // bench at all.
  const goalkeeperIds = match.finalState.goalkeeperIds ?? roster.goalkeeperIds;
  return match.trace.map((entry, index) => {
    // Orientation is DERIVED from the player's own recorded movement toward the
    // next recorded state -- read off engine positions, never invented. A
    // stationary player keeps facing along the court rather than spinning.
    const next = match.trace[index + 1];
    const nextById = next ? new Map(next.playerPositions.map((p) => [p.playerId, p.position])) : null;
    const players: MatchPlayerRenderState[] = entry.playerPositions.map((p) => {
      const to = nextById?.get(p.playerId);
      const dx = to ? to.x - p.position.x : 0;
      const dy = to ? to.y - p.position.y : 0;
      const moving = Math.hypot(dx, dy) > 0.01;
      return {
        id: p.playerId,
        side: sideOf(p.playerId, entry.possessionTeam, roster.rosters),
        kind: goalkeeperIds.includes(p.playerId) ? "GOALKEEPER" : "FIELD_PLAYER",
        x: p.position.x,
        y: p.position.y,
        orientationDegrees: moving ? (Math.atan2(dy, dx) * 180) / Math.PI : 0,
      };
    });
    const ball: MatchBallRenderState = {
      x: entry.ballPosition.x,
      y: entry.ballPosition.y,
      status: entry.ballStatus,
      possessorPlayerId: entry.ballPossessorId,
    };
    return {
      half: entry.half,
      matchSeconds: entry.matchSeconds,
      clockSeconds: entry.clockSeconds,
      simulationTime: entry.simulationTime,
      score: entry.score,
      note: entry.note,
      snapshot: {
        simulationTime: entry.simulationTime,
        // The match view is always the FULL court -- both goals, both keepers.
        court: { view: "FULL_COURT", widthMeters: 20, lengthMeters: 40, attackingGoalSide: entry.attackingGoalSide },
        players,
        ball,
      },
    };
  });
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * The frame to draw at `matchSeconds`, interpolated between the two recorded
 * frames either side of it.
 *
 * PURELY VISUAL. Interpolation only smooths movement between states the engine
 * actually recorded; it never creates a position the simulation did not pass
 * through at the endpoints, and it never changes possession, ball status,
 * score or any event. A ball IN_FLIGHT keeps travelling because the engine
 * recorded it travelling -- it is never snapped between players.
 */
export function frameAtMatchSeconds(frames: readonly PlaybackFrame[], matchSeconds: number): PlaybackFrame | null {
  if (frames.length === 0) return null;
  if (matchSeconds <= frames[0].matchSeconds) return frames[0];
  const last = frames[frames.length - 1];
  if (matchSeconds >= last.matchSeconds) return last;

  let index = 0;
  for (let i = 1; i < frames.length; i += 1) {
    if (frames[i].matchSeconds >= matchSeconds) {
      index = i;
      break;
    }
  }
  const before = frames[index - 1];
  const after = frames[index];
  // Landing exactly on a recorded instant must return THAT frame, not the one
  // before it. Blending from `before` at t=0 would carry the previous frame's
  // discrete facts -- so a goal scored on the stroke of half time would show a
  // score one behind the engine's.
  if (Math.abs(after.matchSeconds - matchSeconds) < 1e-9) return after;
  const span = after.matchSeconds - before.matchSeconds;
  const t = span <= 1e-9 ? 0 : (matchSeconds - before.matchSeconds) / span;

  // Discrete facts (possession, status, score, note) come from the frame the
  // clock has actually reached -- only positions are blended.
  const byId = new Map(after.snapshot.players.map((p) => [p.id, p]));
  const players = before.snapshot.players.map((p) => {
    const target = byId.get(p.id);
    const to = target ?? p;
    return { ...to, x: lerp(p.x, to.x, t), y: lerp(p.y, to.y, t) };
  });

  return {
    ...before,
    snapshot: {
      ...before.snapshot,
      simulationTime: lerp(before.simulationTime, after.simulationTime, t),
      court: before.snapshot.court,
      players,
      ball: {
        ...before.snapshot.ball,
        x: lerp(before.snapshot.ball.x, after.snapshot.ball.x, t),
        y: lerp(before.snapshot.ball.y, after.snapshot.ball.y, t),
      },
    },
  };
}

/** Total match seconds the playback covers. */
export function playbackDurationSeconds(frames: readonly PlaybackFrame[]): number {
  return frames.length === 0 ? 0 : frames[frames.length - 1].matchSeconds;
}

/**
 * Advances the playback clock. Speed multiplies how fast the OFFICIAL clock is
 * consumed per real second of wall time -- it can never change which frames
 * exist, in what order, or what they contain.
 */
export function advancePlaybackClock(currentMatchSeconds: number, deltaRealSeconds: number, speed: PlaybackSpeed, durationSeconds: number): number {
  return Math.max(0, Math.min(durationSeconds, currentMatchSeconds + deltaRealSeconds * speed));
}

/** Formats an official match clock as mm:ss. */
export function formatMatchClock(matchSeconds: number): string {
  const total = Math.max(0, Math.round(matchSeconds));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
