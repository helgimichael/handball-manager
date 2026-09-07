/**
 * MATCH-EXPERIENCE-2.0 M12: what a coach can actually tell his team.
 *
 * M6 already had a tactical bias on the attack, plumbed through as a set of
 * numbers in [-1, 1] that the decision layer added to its option scores. This
 * module turns that into the coaching INTERFACE: the same idea on both sides of
 * the ball, held per team, and changeable while the match is running.
 *
 * THE HARD RULE THIS MODULE EXISTS TO PROTECT. An instruction is an input to a
 * decision, never a result. "Use the pivot more" must not mean "the next pass
 * goes to the pivot"; it means the pivot option scores higher, so the SAME
 * spatial situation is read differently and can still be rejected when the
 * pivot is marked. "Defend more aggressively" must not mean "the opponent turns
 * the ball over more often"; it means defenders step further off the line,
 * which produces turnovers, or gaps behind them, depending on what the attack
 * then does. Nothing in the engine may read an instruction to choose an
 * outcome -- only to weigh an option or move a target.
 *
 * Everything here is therefore a bias, bounded to [-1, 1], with 0 meaning "no
 * opinion". A neutral instruction set is exactly the M6/M7 behaviour.
 */
import { DEFAULT_ATTACK_TACTICS, resolveAttackTactics, type AttackTactics } from "./organizedAttack";

/** Stable side identity. Declared locally so the instruction model has no dependency on the flow layer. */
export type CoachTeamId = "HOME" | "AWAY";

/**
 * Biases on the 6:0's collective behaviour. Every value is in [-1, 1] and 0 is
 * neutral, matching AttackTactics.
 *
 * These are consumed by M7 as DISTANCES AND TARGETS -- how far a defender is
 * willing to leave the line, where the line stands, how hard the neighbours
 * collapse behind a step-out, how readily the pivot is picked up. They are
 * never consulted when an outcome is resolved.
 */
export type DefenceTactics = {
  /** +1 steps out at the ball earlier and further, -1 sits on the line. */
  readonly aggression: number;
  /** +1 squeezes the line toward the middle, -1 defends the full width. */
  readonly compactness: number;
  /** +1 collapses hard behind whoever steps out, -1 holds position instead. */
  readonly helpEmphasis: number;
  /** +1 picks the pivot up sooner and follows him further, -1 lets him work. */
  readonly pivotProtection: number;
};

export const DEFAULT_DEFENCE_TACTICS: DefenceTactics = Object.freeze({
  aggression: 0,
  compactness: 0,
  helpEmphasis: 0,
  pivotProtection: 0,
});

function clampBias(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

export function resolveDefenceTactics(partial?: Partial<DefenceTactics>): DefenceTactics {
  return {
    aggression: clampBias(partial?.aggression),
    compactness: clampBias(partial?.compactness),
    helpEmphasis: clampBias(partial?.helpEmphasis),
    pivotProtection: clampBias(partial?.pivotProtection),
  };
}

/** One team's standing instructions, both phases. */
export type TeamInstructions = {
  readonly attack: AttackTactics;
  readonly defence: DefenceTactics;
};

export const DEFAULT_TEAM_INSTRUCTIONS: TeamInstructions = Object.freeze({
  attack: DEFAULT_ATTACK_TACTICS,
  defence: DEFAULT_DEFENCE_TACTICS,
});

export type MatchInstructions = Readonly<Record<CoachTeamId, TeamInstructions>>;

export function defaultMatchInstructions(): MatchInstructions {
  return { HOME: DEFAULT_TEAM_INSTRUCTIONS, AWAY: DEFAULT_TEAM_INSTRUCTIONS };
}

export function resolveTeamInstructions(partial?: {
  readonly attack?: Partial<AttackTactics>;
  readonly defence?: Partial<DefenceTactics>;
}): TeamInstructions {
  return { attack: resolveAttackTactics(partial?.attack), defence: resolveDefenceTactics(partial?.defence) };
}

// ---------------------------------------------------------------------------
// Changing instructions, and saying what changed
// ---------------------------------------------------------------------------

/** One dial the coach actually moved. */
export type InstructionDelta = {
  readonly key: string;
  readonly from: number;
  readonly to: number;
};

/**
 * Applies a partial change to a bias set and reports only the dials that
 * genuinely moved.
 *
 * The diff is what makes an intervention inspectable: a coaching change is
 * recorded as `tempo 0.00 -> 0.60`, not as an opaque "instructions updated",
 * so a trace can be read back and the match explained.
 */
function applyBiases<T extends Record<string, number>>(base: T, changes: Partial<T> | undefined, resolve: (p: Partial<T>) => T): { next: T; deltas: InstructionDelta[] } {
  if (!changes) return { next: base, deltas: [] };
  const merged = resolve({ ...base, ...changes } as Partial<T>);
  const deltas: InstructionDelta[] = [];
  for (const key of Object.keys(base) as (keyof T & string)[]) {
    if (Math.abs(merged[key] - base[key]) > 1e-9) deltas.push({ key, from: base[key], to: merged[key] });
  }
  return { next: deltas.length === 0 ? base : merged, deltas };
}

export function changeAttackTactics(base: AttackTactics, changes?: Partial<AttackTactics>): { next: AttackTactics; deltas: InstructionDelta[] } {
  return applyBiases(base, changes, resolveAttackTactics as (p: Partial<AttackTactics>) => AttackTactics);
}

export function changeDefenceTactics(base: DefenceTactics, changes?: Partial<DefenceTactics>): { next: DefenceTactics; deltas: InstructionDelta[] } {
  return applyBiases(base, changes, resolveDefenceTactics as (p: Partial<DefenceTactics>) => DefenceTactics);
}

/** `tempo 0.00 -> 0.60; pivotUsage 0.00 -> 0.50` -- for traces and the dev HUD. */
export function describeInstructionDeltas(deltas: readonly InstructionDelta[]): string {
  return deltas.map((d) => `${d.key} ${d.from.toFixed(2)} -> ${d.to.toFixed(2)}`).join("; ");
}
