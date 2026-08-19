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

export type PlayerRole = AttackRole | DefenseRole;

export type Player = {
  id: string;
  team: TeamId;
  role: PlayerRole;
  position: MeterPoint;
  facing: MeterVector;
  velocity: MeterVector;
  movementProfile: MovementProfile;
  intent: PlayerIntent;
};
