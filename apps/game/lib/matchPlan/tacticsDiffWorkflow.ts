// HM-PLAYTEST-02: Unified tactical workspace and diff-based Attack-Defence substitution workflow.
import type { PlayerMock } from '../game-data';
import type { MatchPlan, SubstitutionPair } from './types';
import { defenceSystemKey, effectiveDefenceSpaces } from './engineMatchPlan';

export interface TacticalDiffPlayer {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  shirtNumber?: number;
  energy: number;
  matchFitness: number;
}

export interface ActiveExchangePair {
  attackPlayer: TacticalDiffPlayer;
  defencePlayer: TacticalDiffPlayer;
  defensiveZone: number;
  defensiveZoneLabel: string;
}

export interface TacticalDiff {
  twoWayPlayers: readonly TacticalDiffPlayer[];
  attackOnlyPlayers: readonly TacticalDiffPlayer[];
  defenceOnlyPlayers: readonly TacticalDiffPlayer[];
  activePairs: readonly ActiveExchangePair[];
  unpairedAttackers: readonly TacticalDiffPlayer[];
  unpairedDefenders: readonly TacticalDiffPlayer[];
  isBalanced: boolean;
  totalExchanges: number;
}

export const ZONE_LABELS_6_0: Record<number, string> = {
  5: 'V1 (Vänster etta)',
  4: 'V2 (Vänster tvåa)',
  3: 'V3 / M3 (Vänster trea / inner)',
  2: 'H3 / M3 (Höger trea / inner)',
  1: 'H2 (Höger tvåa)',
  0: 'H1 (Höger etta)',
};

export const ZONE_LABELS_5_1: Record<number, string> = {
  5: 'V1 (Vänster etta)',
  4: 'V2 (Vänster tvåa)',
  3: 'CH (Centerhalv bakre)',
  2: 'SPETS (Framskjuten spets)',
  1: 'H2 (Höger tvåa)',
  0: 'H1 (Höger etta)',
};

export function getZoneLabel(zone: number, systemKey: '6-0' | '5-1'): string {
  return systemKey === '5-1' ? ZONE_LABELS_5_1[zone] ?? `Zon ${zone}` : ZONE_LABELS_6_0[zone] ?? `Zon ${zone}`;
}

function toDiffPlayer(
  p: PlayerMock,
  energyFn?: (p: PlayerMock) => number,
  mfFn?: (id: string) => number
): TacticalDiffPlayer {
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    position: p.position,
    shirtNumber: p.shirtNumber ?? undefined,
    energy: energyFn ? Math.round(energyFn(p)) : 100,
    matchFitness: mfFn ? Math.round(mfFn(p.id)) : 100,
  };
}

/**
 * Derives the tactical differences between attack unit and defence unit:
 * - Two-way players (attack + defence)
 * - Attack-only players (substituted off during defence transition)
 * - Defence-only players (substituted in from the bench)
 * - Active / proposed substitution pairs and balance status
 */
export function deriveTacticalDiff(
  plan: MatchPlan,
  squad: readonly PlayerMock[],
  energyFn?: (p: PlayerMock) => number,
  mfFn?: (id: string) => number
): TacticalDiff {
  const byId = new Map(squad.map(p => [p.id, p]));
  const defKey = defenceSystemKey(plan);
  const defSpaces = effectiveDefenceSpaces(plan);

  const attackOutfieldSlots = plan.attackStartingUnit.slots.filter(s => s.position !== 'GK' && s.playerId);
  const attackOutfieldIds = attackOutfieldSlots.map(s => s.playerId);
  const attackOutfieldSet = new Set(attackOutfieldIds);

  const validPairs = plan.substitutionPairs.filter(p =>
    attackOutfieldSet.has(p.attackPlayerId) &&
    p.defencePlayerId &&
    !attackOutfieldSet.has(p.defencePlayerId)
  );

  const activePairAttackerIds = new Set(validPairs.map(p => p.attackPlayerId));
  const activePairDefenderIds = new Set(validPairs.map(p => p.defencePlayerId));

  const twoWayPlayers: TacticalDiffPlayer[] = [];
  const attackOnlyPlayers: TacticalDiffPlayer[] = [];
  const defenceOnlyPlayers: TacticalDiffPlayer[] = [];

  for (const attackerId of attackOutfieldIds) {
    const p = byId.get(attackerId);
    if (!p) continue;
    const diffP = toDiffPlayer(p, energyFn, mfFn);
    if (activePairAttackerIds.has(attackerId)) {
      attackOnlyPlayers.push(diffP);
    } else {
      twoWayPlayers.push(diffP);
    }
  }

  for (const defId of activePairDefenderIds) {
    const p = byId.get(defId);
    if (p) {
      defenceOnlyPlayers.push(toDiffPlayer(p, energyFn, mfFn));
    }
  }

  const activePairs: ActiveExchangePair[] = validPairs
    .map(pair => {
      const atkP = byId.get(pair.attackPlayerId);
      const defP = byId.get(pair.defencePlayerId);
      if (!atkP || !defP) return null;
      const zone = defSpaces[pair.attackPlayerId] ?? 3;
      return {
        attackPlayer: toDiffPlayer(atkP, energyFn, mfFn),
        defencePlayer: toDiffPlayer(defP, energyFn, mfFn),
        defensiveZone: zone,
        defensiveZoneLabel: getZoneLabel(zone, defKey),
      };
    })
    .filter((x): x is ActiveExchangePair => x !== null);

  const pairedAttackIds = new Set(activePairs.map(p => p.attackPlayer.id));
  const pairedDefIds = new Set(activePairs.map(p => p.defencePlayer.id));

  const unpairedAttackers = attackOnlyPlayers.filter(p => !pairedAttackIds.has(p.id));
  const unpairedDefenders = defenceOnlyPlayers.filter(p => !pairedDefIds.has(p.id));

  const isBalanced = unpairedAttackers.length === 0 && unpairedDefenders.length === 0;

  return {
    twoWayPlayers,
    attackOnlyPlayers,
    defenceOnlyPlayers,
    activePairs,
    unpairedAttackers,
    unpairedDefenders,
    isBalanced,
    totalExchanges: activePairs.length,
  };
}

/**
 * Assigns a specialist (from the bench) to defend in the specified defensive zone.
 * Automatically identifies the starting attacker assigned to that zone, and registers
 * the substitution pair { attackPlayerId, defencePlayerId }.
 */
export function assignDefenderSpecialist(
  plan: MatchPlan,
  zone: number,
  specialistPlayerId: string
): MatchPlan {
  const defSpaces = effectiveDefenceSpaces(plan);
  const six = plan.attackStartingUnit.slots.filter(s => s.position !== 'GK' && s.playerId);
  const attackerAtZone = six.find(s => defSpaces[s.playerId] === zone)?.playerId;
  if (!attackerAtZone) return plan;

  // If specialistPlayerId is empty, remove the specialist for this attacker
  if (!specialistPlayerId) {
    return {
      ...plan,
      substitutionPairs: plan.substitutionPairs.filter(p => p.attackPlayerId !== attackerAtZone),
    };
  }

  // Remove existing occurrences of this attacker or this defender
  const remainingPairs = plan.substitutionPairs.filter(
    p => p.attackPlayerId !== attackerAtZone && p.defencePlayerId !== specialistPlayerId
  );

  return {
    ...plan,
    substitutionPairs: [
      ...remainingPairs,
      { attackPlayerId: attackerAtZone, defencePlayerId: specialistPlayerId },
    ],
  };
}

/**
 * Removes a defensive specialist from a specific zone, reverting the defence of that zone
 * to the starting attacker assigned to it.
 */
export function removeDefenderSpecialist(plan: MatchPlan, zone: number): MatchPlan {
  return assignDefenderSpecialist(plan, zone, '');
}

/**
 * Clears all attack-defence substitution pairs, restoring full two-way play for all 6 outfielders.
 */
export function clearAllExchanges(plan: MatchPlan): MatchPlan {
  return {
    ...plan,
    substitutionPairs: [],
  };
}

/**
 * Automatically creates proposed pairs between an arbitrary list of attack-only and defence-only players.
 */
export function autoPairDiff(
  plan: MatchPlan,
  attackOnlyIds: readonly string[],
  defenceOnlyIds: readonly string[]
): MatchPlan {
  const pairs: SubstitutionPair[] = [];
  const minLen = Math.min(attackOnlyIds.length, defenceOnlyIds.length);
  for (let i = 0; i < minLen; i++) {
    pairs.push({
      attackPlayerId: attackOnlyIds[i],
      defencePlayerId: defenceOnlyIds[i],
    });
  }
  return {
    ...plan,
    substitutionPairs: pairs,
  };
}
