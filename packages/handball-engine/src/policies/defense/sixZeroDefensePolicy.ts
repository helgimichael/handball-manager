import type { HandballState } from "../../domain/handball/state";
import type { DefenseRole, Player } from "../../domain/handball/player";
import type { DefensivePolicyResult, DefensiveReaction, DefensiveResponsibility, DefensiveThreat } from "./types";
import { observeDefensiveThreat } from "./threat";
import { SIX_ZERO_ROLE_ORDER, resolveSixZeroResponsibility, type SixZeroDefender } from "./responsibility";
import {
  assignResponsibilities,
  collectiveReactions,
  describeAssignment,
  perceiveAttack,
  shiftedHomes,
  type CollectiveDefenseOptions,
} from "./collectiveDefense";

export { SIX_ZERO_GAP_RESPONSIBILITIES } from "./responsibility";
export { COLLECTIVE_DEFENSE_LIMITS, DEFENCE_TACTIC_SCALE } from "./collectiveDefense";

export type SixZeroDefensePolicy = {
  name: "six-zero-defense";
  describeInitialShape: () => string;
  react: (state: HandballState) => DefensivePolicyResult;
};

export const SIX_ZERO_DEFENSE_FORMATION_ID = "defence-6-0";

export const SIX_ZERO_DEFENSE_LIMITS = Object.freeze({
  primaryMaxDisplacementMeters: 1.2,
  supportMaxDisplacementMeters: 0.72,
  farSideShiftMaxDisplacementMeters: 0.32,
  goalSideOffsetMeters: 0.72,
  recoveryEpsilonMeters: 0.08
});

export function createSixZeroDefensePolicy(options?: CollectiveDefenseOptions): SixZeroDefensePolicy {
  return {
    name: "six-zero-defense",
    describeInitialShape: () => "Six defenders aligned near the 6-meter arc with deterministic gap responsibility.",
    react: (state) => evaluateSixZeroDefense(state, options)
  };
}

export function previewSixZeroDefense(state: HandballState): readonly DefensiveReaction[] {
  return evaluateSixZeroDefense(state).reactions;
}

/**
 * The 6:0 policy. M7: perception -> responsibility -> collective reaction.
 *
 * Responsibility for an active drive is still resolved by the existing
 * gap/adjacency resolver with its hysteresis; the collective layer
 * (collectiveDefense.ts) then decides who helps, who marks the pivot, who
 * presses, who holds width, and how far the whole line has slid toward the
 * ball. Every target is bounded relative to the line and applied as an
 * ordinary MOVE intent, so defenders run to where they decided to go.
 *
 * `options.ratings` lets a defender's defending rating scale how far he
 * steps; omitted, every defender is a neutral 10.
 */
export function evaluateSixZeroDefense(state: HandballState, options?: CollectiveDefenseOptions): DefensivePolicyResult {
  if (state.defense.formationId !== SIX_ZERO_DEFENSE_FORMATION_ID) {
    return createResult(false, null, null, [], null, 0, [], "", [], []);
  }

  const defenders = state.players.filter(isDefenderInSixZeroOrder);
  const activeThreat = observeDefensiveThreat(state);
  const responsibility = resolveSixZeroResponsibility(state, defenders, activeThreat);
  const primary = activeThreat.type === "ACTIVE_ATTACK_THREAT" ? responsibility.primary : null;

  const perception = perceiveAttack(state, activeThreat, defenders, options);
  const homes = shiftedHomes(state, defenders, perception, options);
  const assignment = assignResponsibilities(perception, defenders, primary?.id ?? null, homes, state.defense.lastReaction?.pivotMarkerId ?? null, state);
  const reactions = collectiveReactions(state, defenders, perception, assignment, homes, SIX_ZERO_DEFENSE_LIMITS, options);

  // Responsibilities: the resolver's PRIMARY/support/far-side structure for a
  // drive, RECOVER otherwise -- with the pivot marker labelled as such.
  const responsibilities: DefensiveResponsibility[] = responsibility.responsibilities.map((item) =>
    item.defenderId === assignment.pivotMarkerId && item.kind !== "PRIMARY" ? { ...item, kind: "PIVOT" } : item,
  );

  const supportIds = assignment.helperIds;
  const summary = describeAssignment(assignment, defenders);
  const lineHomes = defenders.map((d) => ({ defenderId: d.id, position: homes.get(d.id) ?? d.position }));
  return createResult(true, activeThreat, primary?.id ?? null, supportIds, assignment.pivotMarkerId, perception.lineShift, lineHomes, summary, responsibilities, reactions);
}

function createResult(
  implemented: boolean,
  activeThreat: DefensiveThreat | null,
  primaryDefenderId: string | null,
  supportDefenderIds: readonly string[],
  pivotMarkerId: string | null,
  lineShift: number,
  lineHomes: readonly { defenderId: string; position: { x: number; y: number } }[],
  summary: string,
  responsibilities: readonly DefensiveResponsibility[],
  reactions: readonly DefensiveReaction[]
): DefensivePolicyResult {
  return Object.freeze({
    policy: "six-zero-defense",
    implemented,
    activeThreat,
    primaryDefenderId,
    supportDefenderIds: Object.freeze([...supportDefenderIds]),
    pivotMarkerId,
    lineShift,
    lineHomes: Object.freeze(lineHomes.map((h) => Object.freeze({ defenderId: h.defenderId, position: Object.freeze({ ...h.position }) }))),
    summary,
    responsibilities: Object.freeze(responsibilities.map((item) => Object.freeze({ ...item }))),
    reactions: Object.freeze(reactions.map((reaction) => Object.freeze({ ...reaction, target: Object.freeze({ ...reaction.target }) }))),
    actions: Object.freeze(
      reactions.map((reaction) =>
        Object.freeze({
          type: "MOVE" as const,
          playerId: reaction.defenderId,
          target: Object.freeze({ ...reaction.target })
        })
      )
    )
  });
}

function isDefenderInSixZeroOrder(player: Player): player is SixZeroDefender {
  return player.team === "DEFENSE" && SIX_ZERO_ROLE_ORDER.includes(player.role as DefenseRole);
}
