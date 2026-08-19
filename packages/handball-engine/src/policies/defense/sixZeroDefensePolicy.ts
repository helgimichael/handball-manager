import type { HandballState } from "../../domain/handball/state";
import { COURT_BOUNDS_METERS } from "../../domain/geometry/court";
import {
  addVectors,
  clampPointToBounds,
  distanceBetween,
  normalizeVector,
  scaleVector,
  subtractPoints,
  type MeterPoint
} from "../../domain/geometry/coordinates";
import type { DefenseRole, Player } from "../../domain/handball/player";
import type { DefensivePolicyResult, DefensiveReaction, DefensiveResponsibility, DefensiveThreat } from "./types";
import { observeDefensiveThreat } from "./threat";
import {
  SIX_ZERO_ROLE_ORDER,
  resolveSixZeroResponsibility,
  type SixZeroDefender
} from "./responsibility";

export { SIX_ZERO_GAP_RESPONSIBILITIES } from "./responsibility";

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

export function createSixZeroDefensePolicy(): SixZeroDefensePolicy {
  return {
    name: "six-zero-defense",
    describeInitialShape: () => "Six defenders aligned near the 6-meter arc with deterministic gap responsibility.",
    react: evaluateSixZeroDefense
  };
}

export function previewSixZeroDefense(state: HandballState): readonly DefensiveReaction[] {
  return evaluateSixZeroDefense(state).reactions;
}

export function evaluateSixZeroDefense(state: HandballState): DefensivePolicyResult {
  if (state.defense.formationId !== SIX_ZERO_DEFENSE_FORMATION_ID) {
    return createResult(false, null, null, [], [], []);
  }

  const defenders = state.players.filter(isDefenderInSixZeroOrder);
  const activeThreat = observeDefensiveThreat(state);
  const responsibility = resolveSixZeroResponsibility(state, defenders, activeThreat);

  if (activeThreat.type !== "ACTIVE_ATTACK_THREAT") {
    return createRecoveryResult(state, defenders, activeThreat, responsibility.responsibilities);
  }

  const primary = responsibility.primary;

  if (!primary) {
    return createResult(true, activeThreat, null, [], responsibility.responsibilities, []);
  }

  const supportRoles = new Set<DefenseRole>([...responsibility.directSupportRoles, ...responsibility.secondarySupportRoles]);
  const supportIds: string[] = [];
  const reactions = defenders.map((defender) => {
    const home = homeFor(state, defender);
    const towardThreat = targetFromHome(home.position, activeThreat.threatPosition, SIX_ZERO_DEFENSE_LIMITS.farSideShiftMaxDisplacementMeters);
    if (defender.id === primary.id) {
      return createReaction(defender, "ENGAGE", primaryTarget(home.position, activeThreat.threatPosition));
    }
    if (supportRoles.has(defender.role)) {
      supportIds.push(defender.id);
      return createReaction(defender, "SUPPORT", targetFromHome(home.position, activeThreat.threatPosition, SIX_ZERO_DEFENSE_LIMITS.supportMaxDisplacementMeters));
    }
    return createReaction(defender, "SHIFT", towardThreat);
  });

  return createResult(true, activeThreat, primary.id, supportIds, responsibility.responsibilities, reactions);
}

function createRecoveryResult(
  state: HandballState,
  defenders: readonly SixZeroDefender[],
  activeThreat: DefensiveThreat,
  responsibilities: readonly DefensiveResponsibility[]
): DefensivePolicyResult {
  const reactions = defenders
    .map((defender) => {
      const home = homeFor(state, defender);
      return distanceBetween(defender.position, home.position) > SIX_ZERO_DEFENSE_LIMITS.recoveryEpsilonMeters
        ? createReaction(defender, "RECOVER", home.position)
        : null;
    })
    .filter((reaction): reaction is DefensiveReaction => reaction !== null);

  return createResult(true, activeThreat, null, [], responsibilities, reactions);
}

function createResult(
  implemented: boolean,
  activeThreat: DefensiveThreat | null,
  primaryDefenderId: string | null,
  supportDefenderIds: readonly string[],
  responsibilities: readonly DefensiveResponsibility[],
  reactions: readonly DefensiveReaction[]
): DefensivePolicyResult {
  return Object.freeze({
    policy: "six-zero-defense",
    implemented,
    activeThreat,
    primaryDefenderId,
    supportDefenderIds: Object.freeze([...supportDefenderIds]),
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

function homeFor(state: HandballState, defender: SixZeroDefender) {
  return (
    state.defense.homePositions.find((home) => home.playerId === defender.id) ?? {
      playerId: defender.id,
      role: defender.role,
      position: defender.position
    }
  );
}

function primaryTarget(home: MeterPoint, threatTarget: MeterPoint): MeterPoint {
  const raw = {
    x: threatTarget.x,
    y: Math.max(COURT_BOUNDS_METERS.minY, threatTarget.y - SIX_ZERO_DEFENSE_LIMITS.goalSideOffsetMeters)
  };
  return targetFromHome(home, raw, SIX_ZERO_DEFENSE_LIMITS.primaryMaxDisplacementMeters);
}

function targetFromHome(home: MeterPoint, target: MeterPoint, maxDisplacement: number): MeterPoint {
  const vector = subtractPoints(target, home);
  const distance = distanceBetween(home, target);
  if (distance <= maxDisplacement) {
    return clampPointToBounds(target, COURT_BOUNDS_METERS);
  }
  return clampPointToBounds(addVectors(home, scaleVector(normalizeVector(vector), maxDisplacement)), COURT_BOUNDS_METERS);
}

function createReaction(defender: SixZeroDefender, reactionType: DefensiveReaction["reactionType"], target: MeterPoint): DefensiveReaction {
  return Object.freeze({
    defenderId: defender.id,
    role: defender.role,
    reactionType,
    target: Object.freeze({ ...target })
  });
}
