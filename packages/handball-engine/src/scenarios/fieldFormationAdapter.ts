import { CANONICAL_ATTACK_FORMATIONS, CANONICAL_DEFENSE_FORMATIONS, getCanonicalFormation } from "../canonicals/fieldHandball/formations";
import type { CanonicalFormationDefinition, CanonicalFormationObject } from "../canonicals/fieldHandball/formations";
import { ZERO_VECTOR, distanceBetween } from "../domain/geometry/coordinates";
import type { Ball } from "../domain/handball/ball";
import { DEFAULT_MOVEMENT_PROFILE } from "../domain/handball/movement";
import type { AttackRole, DefenseRole, Player, TeamId } from "../domain/handball/player";

export const DEFAULT_ATTACK_FORMATION_ID = "attack-6";
export const DEFAULT_DEFENSE_FORMATION_ID = "defence-6-0";
const FIELD_BALL_CARRY_DISTANCE_METERS = 0.8;

export type FormationScenarioSelection = {
  attackFormationId?: string;
  defenseFormationId?: string;
};

export const availableAttackFormations = CANONICAL_ATTACK_FORMATIONS;
export const availableDefenseFormations = CANONICAL_DEFENSE_FORMATIONS;

const ATTACK_ROLE_ORDER: readonly AttackRole[] = [
  "LEFT_WING",
  "LEFT_BACK",
  "CENTER_BACK",
  "RIGHT_BACK",
  "RIGHT_WING",
  "PIVOT",
  "EXTRA_ATTACKER"
];

function rotationToFacing(rotationDegrees: number) {
  const radians = (rotationDegrees * Math.PI) / 180;
  return { x: Math.sin(radians), y: -Math.cos(radians) };
}

function createPlayer(input: Pick<Player, "id" | "team" | "role" | "position" | "facing">): Player {
  return Object.freeze({
    ...input,
    velocity: ZERO_VECTOR,
    movementProfile: DEFAULT_MOVEMENT_PROFILE,
    intent: Object.freeze({ type: "IDLE" as const })
  });
}

function getObjects(formation: CanonicalFormationDefinition, type: CanonicalFormationObject["type"]): CanonicalFormationObject[] {
  return formation.objects.filter((object) => object.type === type);
}

function attackRoleForObject(object: CanonicalFormationObject, attackers: readonly CanonicalFormationObject[]): AttackRole {
  const leftAttackers = attackers.filter((candidate) => candidate.position.x < 4).sort((a, b) => a.position.y - b.position.y);
  const rightAttackers = attackers.filter((candidate) => candidate.position.x > 16).sort((a, b) => a.position.y - b.position.y);
  const centralAttackers = attackers
    .filter((candidate) => candidate.position.x >= 4 && candidate.position.x <= 16)
    .sort((a, b) => b.position.y - a.position.y);

  if (leftAttackers[0] === object) {
    return "LEFT_WING";
  }
  if (leftAttackers[1] === object) {
    return "LEFT_BACK";
  }
  if (rightAttackers[0] === object) {
    return "RIGHT_WING";
  }
  if (rightAttackers[1] === object) {
    return "RIGHT_BACK";
  }
  if (centralAttackers[0] === object) {
    return "CENTER_BACK";
  }
  if (centralAttackers[1] === object) {
    return "PIVOT";
  }
  return "EXTRA_ATTACKER";
}

function defenseRoleForIndex(index: number): DefenseRole {
  const roles: readonly DefenseRole[] = ["L1", "L2", "L3", "R3", "R2", "R1"];
  return roles[Math.min(index, roles.length - 1)];
}

export function fieldAttackFormationToPlayers(formationId: string): Player[] {
  const formation = getCanonicalFormation(formationId);
  if (!formation || formation.category !== "Attack") {
    throw new Error(`Unknown canonical attack formation: ${formationId}.`);
  }

  const attackers = getObjects(formation, "ATTACKER");
  const roleObjects = attackers
    .map((object) => ({ object, role: attackRoleForObject(object, attackers) }))
    .sort((a, b) => ATTACK_ROLE_ORDER.indexOf(a.role) - ATTACK_ROLE_ORDER.indexOf(b.role));

  return roleObjects.map(({ object, role }, index) =>
    createPlayer({
      id: `attack-${formation.id}-${index + 1}`,
      team: "ATTACK",
      role,
      position: object.position,
      facing: rotationToFacing(object.rotation)
    })
  );
}

export function fieldDefenseFormationToPlayers(formationId: string): Player[] {
  const formation = getCanonicalFormation(formationId);
  if (!formation || formation.category !== "Defence") {
    throw new Error(`Unknown canonical defense formation: ${formationId}.`);
  }

  const defenders = getObjects(formation, "DEFENDER");
  return defenders.map((object, index) =>
    createPlayer({
      id: `defense-${formation.id}-${index + 1}`,
      team: "DEFENSE" satisfies TeamId,
      role: defenseRoleForIndex(index),
      position: object.position,
      facing: rotationToFacing(object.rotation)
    })
  );
}

export function fieldAttackFormationToBall(formationId: string, attackers: readonly Player[]): Ball {
  const formation = getCanonicalFormation(formationId);
  if (!formation || formation.category !== "Attack") {
    throw new Error(`Unknown canonical attack formation: ${formationId}.`);
  }

  const ballObject = getObjects(formation, "BALL")[0];
  if (!ballObject) {
    return Object.freeze({
      position: attackers[0]?.position ?? { x: 10, y: 10 },
      possessorId: attackers[0]?.id ?? null,
      status: "POSSESSED",
      flight: null
    });
  }

  const nearestAttacker = attackers.reduce<Player | null>((best, player) => {
    if (!best) {
      return player;
    }
    return distanceBetween(player.position, ballObject.position) < distanceBetween(best.position, ballObject.position) ? player : best;
  }, null);

  const closeEnoughForPossession = nearestAttacker
    ? distanceBetween(nearestAttacker.position, ballObject.position) <= FIELD_BALL_CARRY_DISTANCE_METERS
    : false;
  return Object.freeze({
    position: closeEnoughForPossession && nearestAttacker ? nearestAttacker.position : ballObject.position,
    possessorId: closeEnoughForPossession ? nearestAttacker?.id ?? null : null,
    status: closeEnoughForPossession ? "POSSESSED" : "LOOSE",
    flight: null
  });
}
