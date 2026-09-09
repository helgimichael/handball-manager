/**
 * MATCH-EXPERIENCE-2.0 M12: the coach's interface to a live match.
 *
 * The path this module completes is:
 *
 *   MATCH STATE -> COACH OBSERVES -> TIMEOUT / INSTRUCTION / PERSONNEL CHANGE
 *     -> MATCH RESUMES -> PLAYERS MAKE DIFFERENT DECISIONS
 *
 * and every step of it runs on the SAME engine M6-M11 already play. There is no
 * manager simulation: a coach emits commands, the flow layer applies them to
 * the real state, and the next possession is decided by the same attack,
 * defence, transition, shooting and substitution code as every possession
 * before it -- reading different instructions.
 *
 * WHAT LIVES HERE AND WHAT DOES NOT. This module is decisions only: the command
 * vocabulary, a read-only view of the match, and a small automatic coach that
 * uses them. Applying a command is a state transition, so it belongs to the
 * flow layer and lives there; that also keeps this module free of any import
 * from it, and the view is described structurally for the same reason.
 *
 * THE AUTOMATIC COACH IS DELIBERATELY MODEST. It exists to exercise the system
 * across whole matches and to be readable when it does something -- four
 * thresholds and a fixed set of responses. It is not CPU manager intelligence
 * and does not pretend to be.
 */
import { describeInstructionDeltas, type CoachTeamId, type DefenceTactics, type InstructionDelta, type TeamInstructions } from "./coaching";
import type { AttackTactics } from "./organizedAttack";

// ---------------------------------------------------------------------------
// What a coach can ask for
// ---------------------------------------------------------------------------

export type CoachCommand =
  /** Stop the match. Legal only at a dead ball, in possession, and with the allowance to spare. */
  | { readonly kind: "TIMEOUT"; readonly team: CoachTeamId; readonly reason: string }
  /** Change what the team is trying to do with the ball. */
  | { readonly kind: "SET_ATTACK"; readonly team: CoachTeamId; readonly changes: Partial<AttackTactics>; readonly reason: string }
  /** Change how the 6:0 behaves. */
  | { readonly kind: "SET_DEFENCE"; readonly team: CoachTeamId; readonly changes: Partial<DefenceTactics>; readonly reason: string }
  /**
   * Ask for a substitution. This goes into M11's existing
   * REQUESTED -> EXITING -> COMPLETE lifecycle exactly as an automatic rotation
   * does; there is no second mechanism for manager changes.
   */
  | { readonly kind: "SUBSTITUTE"; readonly team: CoachTeamId; readonly outgoingPlayerId: string; readonly incomingPlayerId: string; readonly reason: string }
  /**
   * M22: play seven out, or stop.
   *
   * The smallest instruction that expresses the decision, and deliberately only
   * the decision. It carries no mechanism: taking the keeper off and putting a
   * seventh outfield player on is an ordinary M11 exchange, and stopping is the
   * same exchange the other way round. A coach saying this is asking for a
   * substitution he is entitled to ask for, which is exactly what it is in the
   * hall.
   */
  | {
      readonly kind: "SEVEN_V_SIX";
      readonly team: CoachTeamId;
      /** True to take the keeper off, false to bring him back. */
      readonly active: boolean;
      /** Who comes on for the keeper, or goes off for his return. Null lets the engine choose. */
      readonly playerId: string | null;
      readonly reason: string;
    };

/** One thing a coach actually did (or was refused), in the order it happened. */
export type InterventionRecord = {
  readonly kind: "TIMEOUT_BEGINS" | "TIMEOUT_ENDS" | "INSTRUCTION" | "SUBSTITUTION_REQUESTED" | "REFUSED";
  readonly team: CoachTeamId;
  readonly atMatchSeconds: number;
  /** What changed, in readable terms -- `tempo 0.00 -> 0.60`, or why it was refused. */
  readonly detail: string;
  readonly reason: string;
  /**
   * M15: the same change as DATA rather than as a sentence.
   *
   * `detail` above is a human-readable rendering, and a canonical event layer
   * must never read it back. These two fields carry the identical facts in a
   * form a consumer can use: which phase was re-instructed, and exactly which
   * dials moved from what to what.
   *
   * Present on INSTRUCTION records only.
   */
  readonly scope?: "ATTACK" | "DEFENCE";
  readonly deltas?: readonly InstructionDelta[];
  /** M15: on SUBSTITUTION_REQUESTED, the two players -- as ids, not as a sentence. */
  readonly outgoingPlayerId?: string;
  readonly incomingPlayerId?: string;
};

export function describeIntervention(record: InterventionRecord): string {
  return `${record.kind} (${record.team}): ${record.detail}${record.reason ? ` [${record.reason}]` : ""}`;
}

// ---------------------------------------------------------------------------
// What a coach can see
// ---------------------------------------------------------------------------

/** A squad member as the coach sees him. Structural, so no engine type is imported. */
export type CoachPlayerView = {
  readonly id: string;
  readonly kind: "FIELD_PLAYER" | "GOALKEEPER";
  /** Official second he came on. Only meaningful for men on the court. */
  readonly onCourtSince: number;
};

/**
 * Everything the coach is allowed to read. A snapshot, never the live state:
 * a controller cannot reach into the match and change it, it can only answer
 * with commands.
 */
export type CoachView = {
  readonly team: CoachTeamId;
  readonly opponent: CoachTeamId;
  readonly matchSeconds: number;
  readonly half: 1 | 2;
  readonly score: Readonly<Record<CoachTeamId, number>>;
  /** True when the ball is dead and this side may legally stop the match. */
  readonly deadBall: boolean;
  readonly possessionTeam: CoachTeamId;
  readonly timeoutsLeft: number;
  readonly timeoutsLeftThisHalf: number;
  /** Outfield players this side may have on court right now: six, less anybody suspended. */
  readonly entitlement: number;
  readonly opponentEntitlement: number;
  /** Opponent goals since this side last scored. */
  readonly concededInARow: number;
  /** This side's possessions since it last scored. */
  readonly attacksWithoutGoal: number;
  readonly instructions: TeamInstructions;
  readonly onCourt: readonly CoachPlayerView[];
  readonly bench: readonly CoachPlayerView[];
  /** True while one of this side's substitutions is still walking off. */
  readonly substitutionInProgress: boolean;
};

/**
 * A coach: given what he can see, what does he want to do?
 *
 * Pure. Called once per side at each segment boundary. A controller that reads
 * a wall clock or holds mutable state of its own would break determinism, so
 * the automatic coach below does neither.
 */
export type CoachController = (view: CoachView) => readonly CoachCommand[];

// ---------------------------------------------------------------------------
// The minimal automatic coach
// ---------------------------------------------------------------------------

export type CoachPolicy = {
  /** Unanswered opponent goals that make this coach stop the match. */
  readonly timeoutOnConcededRun: number;
  /** Own possessions without a goal that make him stop the match. */
  readonly timeoutOnAttackDrought: number;
  /** Own possessions without a goal before he starts changing the attack. */
  readonly attackDroughtThreshold: number;
  /** Unanswered opponent goals before he starts changing the defence. */
  readonly concededRunThreshold: number;
  /** How far each adjustment moves a dial, in bias units. */
  readonly adjustmentStep: number;
  /** Whether he also changes personnel when he stops the match. */
  readonly substituteAtTimeout: boolean;
};

export const DEFAULT_COACH_POLICY: CoachPolicy = Object.freeze({
  timeoutOnConcededRun: 3,
  timeoutOnAttackDrought: 6,
  attackDroughtThreshold: 3,
  concededRunThreshold: 2,
  adjustmentStep: 0.3,
  substituteAtTimeout: true,
});

/**
 * How hard to push, given how long a situation has gone on.
 *
 * One step for a problem, two for a problem that will not go away, and never
 * more -- the coach leans on a dial, he does not slam it to the stop.
 */
function severity(count: number, threshold: number, step: number): number {
  if (count < threshold) return 0;
  return Math.min(2, Math.floor(count / threshold)) * step;
}

/**
 * The freshest man on the bench and the longest-serving man on the court.
 * Deterministic: ties break on id, exactly as M11's own rotation does.
 */
function personnelSwap(view: CoachView): { outgoingPlayerId: string; incomingPlayerId: string } | null {
  const outgoing = [...view.onCourt]
    .filter((p) => p.kind === "FIELD_PLAYER")
    .sort((a, b) => a.onCourtSince - b.onCourtSince || a.id.localeCompare(b.id))[0];
  const incoming = [...view.bench].filter((p) => p.kind === "FIELD_PLAYER").sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!outgoing || !incoming) return null;
  return { outgoingPlayerId: outgoing.id, incomingPlayerId: incoming.id };
}

/** Only the dials whose target differs from where they already stand. */
function movedOnly<T extends Record<string, number>>(current: T, target: Partial<T>): Partial<T> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(target)) {
    if (value !== undefined && Math.abs(value - current[key]) > 1e-9) out[key] = value;
  }
  return out as Partial<T>;
}

/**
 * A coach who reads four things and responds with three kinds of command.
 *
 * The four things are all real match state, read from the same numbers a person
 * watching would use: is the other side scoring without reply, is my own attack
 * producing nothing, and am I a man up or a man down. The responses are a
 * timeout, a small tactical adjustment, and a substitution request.
 *
 * ABSOLUTE TARGETS, NOT NUDGES. Each dial is set to what the CURRENT situation
 * asks for, not shifted from wherever it happens to be. That is what makes him
 * inspectable -- every value on the board can be explained by the state right
 * now -- and it is what makes him let go: when the drought ends, the dials come
 * back to neutral on their own instead of ratcheting to the stops and staying
 * there for the rest of the match.
 */
export function autonomousCoach(policy: Partial<CoachPolicy> = {}): CoachController {
  const settings: CoachPolicy = { ...DEFAULT_COACH_POLICY, ...policy };

  return (view) => {
    const commands: CoachCommand[] = [];
    const step = settings.adjustmentStep;
    const reasons: string[] = [];

    const manDown = view.entitlement < view.opponentEntitlement;
    const manUp = view.entitlement > view.opponentEntitlement;
    const drought = severity(view.attacksWithoutGoal, settings.attackDroughtThreshold, step);
    const leaking = severity(view.concededInARow, settings.concededRunThreshold, step);

    // Stopping the match is itself a decision, and it changes what he asks for:
    // a coach who has spent a timeout on this leans harder than one shouting
    // from the sideline.
    const stopping =
      view.deadBall &&
      view.possessionTeam === view.team &&
      view.timeoutsLeft > 0 &&
      view.timeoutsLeftThisHalf > 0 &&
      (view.concededInARow >= settings.timeoutOnConcededRun || view.attacksWithoutGoal >= settings.timeoutOnAttackDrought);
    const insist = (target: number): number => (target === 0 || !stopping ? target : Math.max(-1, Math.min(1, target + Math.sign(target) * step)));

    if (manDown) reasons.push(`a man down (${view.entitlement}v${view.opponentEntitlement})`);
    if (manUp) reasons.push(`a man up (${view.entitlement}v${view.opponentEntitlement})`);
    if (drought > 0) reasons.push(`${view.attacksWithoutGoal} attacks without a goal`);
    if (leaking > 0) reasons.push(`${view.concededInARow} conceded without reply`);

    // A man down holds the ball; a drought goes at them; a man up uses the room.
    // Where two of those apply at once, the numerical situation wins on tempo,
    // because playing 5v6 at speed is how a two-minute deficit becomes four.
    const attackTarget = {
      tempo: insist(manDown ? -step : drought),
      pivotUsage: insist(drought),
      gapAppetite: insist(manDown ? -step : manUp ? step : drought),
      width: manUp ? step : 0,
    };
    // Conceding without reply steps out at the ball and collapses behind it; a
    // man down does the opposite and defends the middle instead of chasing.
    const defenceTarget = {
      aggression: insist(manDown ? -step : leaking),
      helpEmphasis: insist(leaking),
      pivotProtection: insist(leaking),
      compactness: manDown ? step : 0,
    };

    const attack = movedOnly(view.instructions.attack, attackTarget);
    const defence = movedOnly(view.instructions.defence, defenceTarget);
    const reason = reasons.join("; ") || "settled";

    if (stopping) commands.push({ kind: "TIMEOUT", team: view.team, reason });
    if (Object.keys(attack).length > 0) commands.push({ kind: "SET_ATTACK", team: view.team, changes: attack, reason });
    if (Object.keys(defence).length > 0) commands.push({ kind: "SET_DEFENCE", team: view.team, changes: defence, reason });

    // Personnel only at a timeout, and only through M11: a fresh man for the
    // one who has been out there longest.
    if (stopping && settings.substituteAtTimeout && !view.substitutionInProgress) {
      const swap = personnelSwap(view);
      if (swap) commands.push({ kind: "SUBSTITUTE", team: view.team, ...swap, reason });
    }

    return commands;
  };
}

/** `tempo 0.00 -> 0.30; pivotUsage 0.00 -> 0.30` -- re-exported so callers need only this module. */
export { describeInstructionDeltas };
