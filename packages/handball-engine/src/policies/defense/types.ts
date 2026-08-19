import type { AttackGapId } from "../../domain/geometry/attackGaps";
import type { DefensiveZonePolygon } from "../../domain/geometry/zones";
import type { MeterPoint } from "../../domain/geometry/coordinates";
import type { MoveAction } from "../../domain/handball/actions";
import type { DefenseRole } from "../../domain/handball/player";
import type { HandballState } from "../../domain/handball/state";

export type DefensiveReactionType = "ENGAGE" | "SUPPORT" | "SHIFT" | "RECOVER";

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

export type DefensiveResponsibilityKind = "PRIMARY" | "DIRECT_SUPPORT" | "SECONDARY_SUPPORT" | "FAR_SIDE" | "RECOVER";

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
  responsibilities: readonly DefensiveResponsibility[];
  reactions: readonly DefensiveReaction[];
  actions: readonly MoveAction[];
};

export type DefensivePolicy = (state: HandballState) => DefensivePolicyResult;
