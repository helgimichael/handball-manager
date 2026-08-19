/**
 * Match sequence controller (HM-0.3).
 *
 * Observes HandballState and decides, tick by tick, which single
 * existing SIM command (PASS or ATTACK -- domain/handball/actions.ts,
 * unmodified) should be dispatched next through the existing runtime
 * pipeline (executeRuntimeCommand/runSimulationTick, unmodified). It
 * never computes or writes a coordinate, never touches a player's
 * position/velocity/intent directly, and never calls into
 * @handball-manager/match-renderer. The only thing it "decides" is
 * WHICH already-existing command to issue and WHEN, based on state it
 * only reads:
 *
 *   COMMAND -> SIM (step()) -> STATE -> next call decides the NEXT COMMAND
 *
 * This is deliberately the only file in match-integration allowed to
 * import handball-engine's action/state types for orchestration
 * purposes (simAdapter.ts imports them for the read-only render
 * mapping; this file imports them to construct commands to dispatch).
 * It still never imports match-contract or match-renderer -- a
 * sequence is a SIM-side concept, not a render concept.
 */

import type { HandballAction } from "@handball-manager/handball-engine/src/domain/handball/actions.ts";
import type { HandballState } from "@handball-manager/handball-engine/src/domain/handball/state.ts";
import type { AttackGapId } from "@handball-manager/handball-engine/src/domain/geometry/attackGaps.ts";

export type MatchSequenceDefinition = {
  /** Player expected to start possession and pass the ball. */
  passerId: string;
  /** Player expected to receive the pass and then attack. */
  receiverId: string;
  /**
   * An existing defensive gap id (domain/geometry/attackGaps.ts) the
   * receiver attacks after reception. Not invented per-sequence: it
   * must be one of SIM's five real gaps.
   */
  attackGapId: AttackGapId;
};

export type MatchSequencePhase =
  | "AWAITING_PASS"
  | "PASS_ISSUED"
  | "AWAITING_ATTACK"
  | "ATTACK_ISSUED"
  | "COMPLETE";

export type MatchSequenceState = {
  readonly definition: MatchSequenceDefinition;
  readonly phase: MatchSequencePhase;
};

export function createMatchSequence(definition: MatchSequenceDefinition): MatchSequenceState {
  return { definition, phase: "AWAITING_PASS" };
}

export type MatchSequenceAdvanceResult = {
  readonly sequence: MatchSequenceState;
  /** The single command to dispatch this tick, or null if none is due. */
  readonly command: HandballAction | null;
};

/**
 * Pure, read-only decision function: given the current sequence phase
 * and the current (unmutated) HandballState, returns the next phase and
 * at most one command to dispatch. The caller is responsible for
 * actually dispatching that command through the existing runtime
 * (executeRuntimeCommand) and for calling this function again on the
 * NEXT tick with the resulting state -- this function does not run the
 * simulation itself.
 */
export function advanceMatchSequence(sequence: MatchSequenceState, state: HandballState): MatchSequenceAdvanceResult {
  const { definition, phase } = sequence;

  switch (phase) {
    case "AWAITING_PASS": {
      if (state.ball.status === "POSSESSED" && state.ball.possessorId === definition.passerId) {
        return {
          sequence: { definition, phase: "PASS_ISSUED" },
          command: { type: "PASS", fromPlayerId: definition.passerId, toPlayerId: definition.receiverId },
        };
      }
      // Passer does not currently hold the ball -- nothing valid to
      // dispatch yet. The caller may still advance SIM's own clock;
      // this sequence simply has nothing to contribute this tick.
      return { sequence, command: null };
    }

    case "PASS_ISSUED": {
      if (state.ball.status === "POSSESSED" && state.ball.possessorId === definition.receiverId) {
        return { sequence: { definition, phase: "AWAITING_ATTACK" }, command: null };
      }
      // Ball still IN_FLIGHT (or briefly LOOSE) -- wait for SIM's own
      // step()/advanceBall to complete the reception; issue nothing.
      return { sequence, command: null };
    }

    case "AWAITING_ATTACK": {
      return {
        sequence: { definition, phase: "ATTACK_ISSUED" },
        command: { type: "ATTACK", playerId: definition.receiverId, gapId: definition.attackGapId },
      };
    }

    case "ATTACK_ISSUED": {
      const attacker = state.players.find((player) => player.id === definition.receiverId);
      // handball-engine's own advancePlayerMovement flips a completed
      // ATTACK intent straight to { type: "IDLE" } (see
      // simulation/movement.ts) -- that transition, observed here, is
      // what marks this sequence's active phase done. We do not track a
      // separate "completed" flag ourselves; we read SIM's own intent
      // state.
      if (attacker && attacker.intent.type !== "ATTACK") {
        return { sequence: { definition, phase: "COMPLETE" }, command: null };
      }
      return { sequence, command: null };
    }

    case "COMPLETE":
      return { sequence, command: null };
  }
}
