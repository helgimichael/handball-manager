import type { MeterPoint, MeterVector } from "../geometry/coordinates";
import type { MovementProfile, PlayerIntent } from "./movement";

export type TeamId = "ATTACK" | "DEFENSE";

export type AttackRole =
  | "LEFT_WING"
  | "LEFT_BACK"
  | "CENTER_BACK"
  | "RIGHT_BACK"
  | "RIGHT_WING"
  | "PIVOT"
  | "EXTRA_ATTACKER";

export type DefenseRole = "L1" | "L2" | "L3" | "R3" | "R2" | "R1";

export type GoalkeeperRole = "GOALKEEPER";

export type PlayerRole = AttackRole | DefenseRole | GoalkeeperRole;

/**
 * Coarse simulated-entity category, orthogonal to `role`. The existing
 * 6:0 defense policy (policies/defense/sixZeroDefensePolicy.ts) filters
 * defenders by `role` membership in its fixed six-role
 * SIX_ZERO_ROLE_ORDER list, which "GOALKEEPER" is never part of -- that
 * filter already excludes a goalkeeper correctly without referencing
 * `kind` at all. `kind` exists so the rest of the engine/adapters can
 * ask "is this a goalkeeper" directly instead of comparing `role` to a
 * string literal. Named PlayerKind to mirror
 * @handball-manager/match-contract's MatchPlayerKind (HM-0.2D), the
 * neutral render contract a goalkeeper maps onto (HM-0.4A).
 */
export type PlayerKind = "FIELD_PLAYER" | "GOALKEEPER";

export type Player = {
  id: string;
  team: TeamId;
  kind: PlayerKind;
  role: PlayerRole;
  position: MeterPoint;
  facing: MeterVector;
  velocity: MeterVector;
  movementProfile: MovementProfile;
  intent: PlayerIntent;
  /**
   * MATCH-EXPERIENCE-2.0 M11: true while this player is on his way off for a
   * substitution.
   *
   * He is still a real player on the court -- he counts, he occupies space, he
   * can still be fouled -- but he has stopped taking part in his team's shape:
   * the attack, the defence and the transition all leave him alone and he heads
   * for the substitution area instead. His replacement does not come on until he
   * gets there, which is what stops an exchange ever producing an eighth player.
   */
  leavingCourt?: boolean;
};
