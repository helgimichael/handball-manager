import test from 'node:test';
import assert from 'node:assert/strict';
import type { PlayerMock } from '../game-data';
import type { MatchPlan } from './types';
import {
  deriveTacticalDiff,
  assignDefenderSpecialist,
  removeDefenderSpecialist,
  clearAllExchanges,
  autoPairDiff,
} from './tacticsDiffWorkflow';

const MOCK_PLAYERS: PlayerMock[] = [
  { id: 'gk1', firstName: 'Andreas', lastName: 'Palicka', position: 'MV' } as PlayerMock,
  { id: 'v6_1', firstName: 'Hampus', lastName: 'Wanne', position: 'V6' } as PlayerMock,
  { id: 'v9_1', firstName: 'Jonathan', lastName: 'Carlsbogård', position: 'V9' } as PlayerMock,
  { id: 'm9_1', firstName: 'Jim', lastName: 'Gottfridsson', position: 'M9' } as PlayerMock,
  { id: 'h9_1', firstName: 'Albin', lastName: 'Lagergren', position: 'H9' } as PlayerMock,
  { id: 'h6_1', firstName: 'Daniel', lastName: 'Pettersson', position: 'H6' } as PlayerMock,
  { id: 'm6_1', firstName: 'Max', lastName: 'Darj', position: 'M6' } as PlayerMock,
  { id: 'def_spec_1', firstName: 'Philip', lastName: 'Stenmalm', position: 'V9' } as PlayerMock,
  { id: 'def_spec_2', firstName: 'Oscar', lastName: 'Bergendahl', position: 'M6' } as PlayerMock,
];

function createSamplePlan(): MatchPlan {
  return {
    fixtureId: 'fix-1',
    clubId: 'swe_club_redbergslids_ik',
    squad: {
      fixtureId: 'fix-1',
      clubId: 'swe_club_redbergslids_ik',
      players: MOCK_PLAYERS.map(p => ({ playerId: p.id, position: p.position === 'MV' ? 'GK' : p.position as any })),
    },
    attackStartingUnit: {
      formation: 'NORMAL',
      slots: [
        { playerId: 'gk1', position: 'GK' },
        { playerId: 'v6_1', position: 'V6' },
        { playerId: 'v9_1', position: 'V9' },
        { playerId: 'm9_1', position: 'M9' },
        { playerId: 'h9_1', position: 'H9' },
        { playerId: 'h6_1', position: 'H6' },
        { playerId: 'm6_1', position: 'M6' },
      ],
    },
    defenceStartingUnit: {
      goalkeeperId: 'gk1',
      courtSlots: [
        { courtSlot: 1, playerId: 'v6_1' },
        { courtSlot: 2, playerId: 'v9_1' },
        { courtSlot: 3, playerId: 'm9_1' },
        { courtSlot: 4, playerId: 'h9_1' },
        { courtSlot: 5, playerId: 'h6_1' },
        { courtSlot: 6, playerId: 'm6_1' },
      ],
    },
    playerUsage: [],
    substitutionPairs: [],
    depthHierarchy: [],
    attackPlan: {
      tempo: 'BALANCED',
      structureFreedom: 'BALANCED',
      pivotUsage: 'MEDIUM',
      twoVTwoEmphasis: 'MEDIUM',
      breakthroughEmphasis: 'MEDIUM',
      shootingEmphasis: 'MEDIUM',
      wingUsage: 'MEDIUM',
      ballCirculation: 'BALANCED',
      sevenVSixPolicy: { level: 'NEVER', activeFromKickoff: false },
    },
    defencePlan: {
      baseFormation: '6-0',
      defensiveDepth: 'STANDARD',
      contactIntent: 'MEDIUM',
      coverBlockingEmphasis: 'MEDIUM',
      ballOrientedPressure: 'MEDIUM',
      riskLevel: 'MEDIUM',
    },
    transitionPlan: {
      offensiveTransitionIntent: 'MEDIUM',
      defensiveRetreatIntent: 'MEDIUM',
      firstWaveAggression: 'MEDIUM',
      goalkeeperInitiation: 'MEDIUM',
      substitutionPriority: 'BALANCED',
    },
  };
}

test('deriveTacticalDiff: returns all 6 outfielders as two-way players when no pairs exist', () => {
  const plan = createSamplePlan();
  const diff = deriveTacticalDiff(plan, MOCK_PLAYERS);

  assert.equal(diff.twoWayPlayers.length, 6);
  assert.equal(diff.attackOnlyPlayers.length, 0);
  assert.equal(diff.defenceOnlyPlayers.length, 0);
  assert.equal(diff.activePairs.length, 0);
  assert.equal(diff.isBalanced, true);
  assert.equal(diff.totalExchanges, 0);
});

test('assignDefenderSpecialist: pairs specialist with the attacker defending in that zone', () => {
  const plan = createSamplePlan();
  // By default in 6-0, M6 ('m6_1') defends in zone 3 (V3 / M3)
  const updated = assignDefenderSpecialist(plan, 3, 'def_spec_1');

  assert.equal(updated.substitutionPairs.length, 1);
  assert.equal(updated.substitutionPairs[0].attackPlayerId, 'm6_1');
  assert.equal(updated.substitutionPairs[0].defencePlayerId, 'def_spec_1');

  const diff = deriveTacticalDiff(updated, MOCK_PLAYERS);
  assert.equal(diff.twoWayPlayers.length, 5);
  assert.equal(diff.attackOnlyPlayers.length, 1);
  assert.equal(diff.attackOnlyPlayers[0].id, 'm6_1');
  assert.equal(diff.defenceOnlyPlayers.length, 1);
  assert.equal(diff.defenceOnlyPlayers[0].id, 'def_spec_1');
  assert.equal(diff.activePairs.length, 1);
  assert.equal(diff.activePairs[0].defensiveZone, 3);
  assert.equal(diff.isBalanced, true);
});

test('removeDefenderSpecialist: removes specialist and restores two-way play', () => {
  let plan = createSamplePlan();
  plan = assignDefenderSpecialist(plan, 3, 'def_spec_1');
  assert.equal(plan.substitutionPairs.length, 1);

  const cleared = removeDefenderSpecialist(plan, 3);
  assert.equal(cleared.substitutionPairs.length, 0);

  const diff = deriveTacticalDiff(cleared, MOCK_PLAYERS);
  assert.equal(diff.twoWayPlayers.length, 6);
  assert.equal(diff.attackOnlyPlayers.length, 0);
  assert.equal(diff.defenceOnlyPlayers.length, 0);
});

test('clearAllExchanges: resets multiple substitution pairs', () => {
  let plan = createSamplePlan();
  plan = assignDefenderSpecialist(plan, 3, 'def_spec_1');
  // In 6-0, V9 ('v9_1') defends in zone 4
  plan = assignDefenderSpecialist(plan, 4, 'def_spec_2');
  assert.equal(plan.substitutionPairs.length, 2);

  const resetPlan = clearAllExchanges(plan);
  assert.equal(resetPlan.substitutionPairs.length, 0);
});

test('autoPairDiff: pairs arbitrary attack-only and defence-only lists cleanly', () => {
  const plan = createSamplePlan();
  const paired = autoPairDiff(plan, ['m6_1', 'v9_1'], ['def_spec_1', 'def_spec_2']);
  assert.equal(paired.substitutionPairs.length, 2);
  assert.equal(paired.substitutionPairs[0].attackPlayerId, 'm6_1');
  assert.equal(paired.substitutionPairs[0].defencePlayerId, 'def_spec_1');
  assert.equal(paired.substitutionPairs[1].attackPlayerId, 'v9_1');
  assert.equal(paired.substitutionPairs[1].defencePlayerId, 'def_spec_2');
});
