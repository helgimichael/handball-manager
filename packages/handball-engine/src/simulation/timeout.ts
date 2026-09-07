/**
 * MATCH-EXPERIENCE-2.0 M12: team timeouts.
 *
 * A timeout is a real interruption of a live match, not a pause button. What
 * makes it real here is what it does NOT do:
 *
 *   - it does not advance the official clock, because a timeout is dead time
 *   - it does not advance the spatial clock either, so nothing is simulated
 *     through it and no suspension serves any of its two minutes during it
 *   - it does not rebuild the court: players, ball, score and RNG stream are
 *     exactly where the whistle left them
 *
 * The only thing that happens inside a timeout is coaching -- instructions and
 * personnel -- and then play restarts from the restart that was already due.
 * That is why the engine does not simulate a minute of players standing around:
 * there is nothing to simulate.
 *
 * ALLOWANCE IS CONFIGURABLE, NOT BAKED IN. How many timeouts a side gets, and
 * how many it may take in one half, are competition rules rather than physics.
 * They arrive as a value so a league, a cup and a friendly can differ without
 * anybody touching the engine.
 */

/** Stable side identity. Declared locally so this module has no dependency on the flow layer. */
export type TimeoutTeamId = "HOME" | "AWAY";

export type TimeoutRules = {
  /** Timeouts each side may take across the whole match. */
  readonly perMatch: number;
  /** ...of which at most this many in any one half. */
  readonly perHalf: number;
  /**
   * Official seconds a side must let pass between its own timeouts. Zero means
   * no restriction; it exists so a rule set can stop a coach stopping the match
   * twice in a row.
   */
  readonly minSecondsBetween: number;
};

/**
 * The current IHF allowance: three per match, no more than two in a half. Both
 * numbers are data, so a different competition is a different value rather
 * than a different engine.
 */
export const DEFAULT_TIMEOUT_RULES: TimeoutRules = Object.freeze({ perMatch: 3, perHalf: 2, minSecondsBetween: 60 });

export function resolveTimeoutRules(partial?: Partial<TimeoutRules>): TimeoutRules {
  return {
    perMatch: Math.max(0, Math.trunc(partial?.perMatch ?? DEFAULT_TIMEOUT_RULES.perMatch)),
    perHalf: Math.max(0, Math.trunc(partial?.perHalf ?? DEFAULT_TIMEOUT_RULES.perHalf)),
    minSecondsBetween: Math.max(0, partial?.minSecondsBetween ?? DEFAULT_TIMEOUT_RULES.minSecondsBetween),
  };
}

/** One timeout that was actually taken. */
export type TimeoutRecord = {
  readonly team: TimeoutTeamId;
  /** 1 or 2, derived from the official clock -- the allowance is per half as well as per match. */
  readonly half: 1 | 2;
  readonly atMatchSeconds: number;
  readonly reason: string;
};

export function timeoutsUsed(records: readonly TimeoutRecord[], team: TimeoutTeamId, half?: 1 | 2): number {
  return records.filter((r) => r.team === team && (half === undefined || r.half === half)).length;
}

export type TimeoutVerdict = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/**
 * Whether this side may stop the match right now.
 *
 * Three conditions, all of them real rules rather than engine convenience: the
 * ball must be dead, the side asking must be the side in possession (a coach
 * cannot stop the match while the other team attacks), and the allowance must
 * not be spent.
 */
export function timeoutAllowed(
  rules: TimeoutRules,
  records: readonly TimeoutRecord[],
  team: TimeoutTeamId,
  context: { readonly deadBall: boolean; readonly possessionTeam: TimeoutTeamId; readonly matchSeconds: number; readonly half: 1 | 2 },
): TimeoutVerdict {
  if (!context.deadBall) return { ok: false, reason: "the ball is live" };
  if (context.possessionTeam !== team) return { ok: false, reason: `${team} does not have the ball` };
  if (timeoutsUsed(records, team) >= rules.perMatch) return { ok: false, reason: `${team} has used all ${rules.perMatch} timeouts` };
  if (timeoutsUsed(records, team, context.half) >= rules.perHalf) {
    return { ok: false, reason: `${team} has used ${rules.perHalf} timeouts in this half` };
  }
  const last = [...records].filter((r) => r.team === team).sort((a, b) => b.atMatchSeconds - a.atMatchSeconds)[0];
  if (last && context.matchSeconds - last.atMatchSeconds < rules.minSecondsBetween) {
    return { ok: false, reason: `${team} took a timeout ${Math.round(context.matchSeconds - last.atMatchSeconds)}s ago` };
  }
  return { ok: true };
}
