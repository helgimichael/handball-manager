import type { HandballState } from "../domain/handball/state";
import type { DefenseRole } from "../domain/handball/player";
import {
  DEFAULT_ATTACK_FORMATION_ID,
  DEFAULT_DEFENSE_FORMATION_ID,
  fieldAttackFormationToBall,
  fieldAttackFormationToPlayers,
  fieldDefenseFormationToPlayers,
  type FormationScenarioSelection
} from "./fieldFormationAdapter";

export function createHalfCourt6v6State(selection: FormationScenarioSelection = {}): HandballState {
  const attackFormationId = selection.attackFormationId ?? DEFAULT_ATTACK_FORMATION_ID;
  const defenseFormationId = selection.defenseFormationId ?? DEFAULT_DEFENSE_FORMATION_ID;
  const attackers = Object.freeze(fieldAttackFormationToPlayers(attackFormationId));
  const defenders = Object.freeze(fieldDefenseFormationToPlayers(defenseFormationId));
  const ball = fieldAttackFormationToBall(attackFormationId, attackers);

  return Object.freeze({
    simulationTime: 0,
    players: Object.freeze([...attackers, ...defenders]),
    ball,
    defense: Object.freeze({
      formationId: defenseFormationId,
      homePositions: Object.freeze(
        defenders.map((defender) =>
          Object.freeze({
            playerId: defender.id,
            role: defender.role as DefenseRole,
            position: Object.freeze({ ...defender.position })
          })
        )
      ),
      lastReaction: null
    })
  });
}

export const initialHalfCourt6v6State: HandballState = createHalfCourt6v6State();
