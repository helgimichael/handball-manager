import type { AttackGapId } from "../../domain/geometry/attackGaps";
import type { DefensiveZonePolygon } from "../../domain/geometry/zones";
import type { MeterPoint } from "../../domain/geometry/coordinates";
import type { MoveAction } from "../../domain/handball/actions";
import type { DefenseRole } from "../../domain/handball/player";
import type { HandballState } from "../../domain/handball/state";

/**
 * ENGAGE/SUPPORT/SHIFT/RECOVER are the original 6:0 reactions. M7 adds
 * PRESS (the defender in front of a held ball comes half a metre out) and
 * MARK_PIVOT (the defender responsible for the pivot sits goal-side of him).
 */
/**
 * M23: FRONT is the man who plays ahead of the line in a 5:1 -- pressuring the
 * backcourt rather than holding a place in it. A flat system never produces one.
 *
 * M24: STEP_OUT is a half-space defender of a 3:2:1 coming forward out of the
 * middle layer at a back. It is distinct from ENGAGE, which is a man leaving
 * the LINE: these two are leaving a layer that already stands in front of it.
 */
export type DefensiveReactionType = "ENGAGE" | "SUPPORT" | "SHIFT" | "RECOVER" | "PRESS" | "MARK_PIVOT" | "FRONT" | "STEP_OUT";

export type DefensiveThreatType = "ACTIVE_ATTACK_THREAT" | "POSSESSION_THREAT" | "NO_DIRECT_BALL_THREAT";

export type DefensiveThreatObservation =
  | {
      type: "ACTIVE_ATTACK_THREAT";
      ballCarrierId: string;
      attackerId: string;
      ballPosition: MeterPoint;
      carrierPosition: MeterPoint;
      activeAttackGapId: AttackGapId;
      attackTarget: MeterPoint;
      currentZone: DefensiveZonePolygon | null;
      threatPosition: MeterPoint;
    }
  | {
      type: "POSSESSION_THREAT";
      ballCarrierId: string;
      ballPosition: MeterPoint;
      carrierPosition: MeterPoint;
      currentZone: DefensiveZonePolygon | null;
      threatPosition: MeterPoint;
    }
  | {
      type: "NO_DIRECT_BALL_THREAT";
      ballPosition: MeterPoint;
    };

export type DefensiveThreat = DefensiveThreatObservation;

/** M7 adds PIVOT: the defender currently responsible for the pivot. */
export type DefensiveResponsibilityKind = "PRIMARY" | "DIRECT_SUPPORT" | "SECONDARY_SUPPORT" | "FAR_SIDE" | "RECOVER" | "PIVOT";

export type DefensiveResponsibility = {
  defenderId: string;
  role: DefenseRole;
  kind: DefensiveResponsibilityKind;
};

export type DefensiveReaction = {
  defenderId: string;
  role: DefenseRole;
  reactionType: DefensiveReactionType;
  target: MeterPoint;
};

export type DefensivePolicyResult = {
  policy: "six-zero-defense";
  implemented: boolean;
  activeThreat: DefensiveThreat | null;
  primaryDefenderId: string | null;
  supportDefenderIds: readonly string[];
  /** M7: who is responsible for the pivot right now; null when nobody can be. */
  pivotMarkerId: string | null;
  /** M7: the line's lateral slide toward the ball at this instant, in metres. */
  lineShift: number;
  /** M7: the spot on the shifted line each defender is holding -- what he recovers to and steps from. */
  lineHomes: readonly { defenderId: string; position: MeterPoint }[];
  /** M7: the collective assignment in plain language, for traces and the dev HUD. */
  summary: string;
  responsibilities: readonly DefensiveResponsibility[];
  reactions: readonly DefensiveReaction[];
  actions: readonly MoveAction[];
};

export type DefensivePolicy = (state: HandballState) => DefensivePolicyResult;
