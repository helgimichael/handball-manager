import type { HandballState } from "../domain/handball/state";
import type { DefenseRole } from "../domain/handball/player";
import {
  DEFAULT_ATTACK_FORMATION_ID,
  DEFAULT_DEFENSE_FORMATION_ID,
  fieldAttackFormationToBall,
  fieldAttackFormationToPlayers,
  fieldDefenseFormationGoalkeeper,
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

/**
 * HM-0.4A: the same canonical half-court 6v6 scenario, plus the
 * defense formation's own goalkeeper (previously discarded -- see
 * fieldFormationAdapter.ts's fieldDefenseFormationGoalkeeper). Kept as
 * a SEPARATE named scenario rather than changing
 * createHalfCourt6v6State/initialHalfCourt6v6State in place: those are
 * asserted directly against validateStandardSixVsSixState (exactly 6
 * ATTACK + 6 DEFENSE) by two existing tests
 * (scenarios/halfCourt6v6.test.ts, simulation/engine.test.ts) that
 * predate the goalkeeper and must keep passing unchanged. A state with
 * a goalkeeper has 7 DEFENSE-team players, which is correct for this
 * scenario but would fail that specific validator -- not because the
 * state is invalid, but because that validator's name and 6/6 check
 * describe a different (goalkeeper-less) roster shape. Renaming or
 * mutating that fixture would be an opportunistic change outside this
 * pass's scope.
 */
export function createHalfCourt6v6StateWithGoalkeeper(selection: FormationScenarioSelection = {}): HandballState {
  const base = createHalfCourt6v6State(selection);
  const defenseFormationId = selection.defenseFormationId ?? DEFAULT_DEFENSE_FORMATION_ID;
  const goalkeeper = fieldDefenseFormationGoalkeeper(defenseFormationId);

  if (!goalkeeper) {
    return base;
  }

  return {
    ...base,
    players: Object.freeze([...base.players, goalkeeper])
  };
}

export const initialHalfCourt6v6WithGoalkeeperState: HandballState = createHalfCourt6v6StateWithGoalkeeper();
