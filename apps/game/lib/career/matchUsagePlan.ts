// HM-MATCH-1.0 Part B/C/D/E/F: MatchPlan -> MatchUsagePlan, a pure
// adapter translating the coach's PRE-MATCH intentions (MatchRole,
// PlayingTimeIntention, PhaseUsage, substitution pairs, depth
// hierarchy) into bounded, RELATIVE usage weights -- never exact
// minutes (Part B: "the system should understand 'Gustav should carry
// a very large attacking workload', not 'Gustav plays 47 minutes'").
//
// This is the SINGLE source of truth for "how much does the coach
// intend to use this player, and in which phase" -- HM-MATCH-RATINGS-
// 0.1's playerMatchStrength.ts previously computed this weighting
// itself; it and this milestone's matchUsageEngine.ts both now consume
// THIS module instead, so the weighting model is never duplicated
// (Part A: "do not create parallel concepts if equivalents already
// exist").
import type { MatchPlan, MatchRole, PlayerPhaseUsage, PlayingTimeIntention } from "../matchPlan/types";

/** Part D: MatchRole controls usage PRIORITY, never ability -- this table has no relationship to CA/attributes, and must never become a second CA modifier. */
export const MATCH_ROLE_WEIGHT: Record<MatchRole, number> = {
  KEY_PLAYER: 1.0,
  STARTER: 0.9,
  MAJOR_ROTATION: 0.7,
  ROTATION: 0.55,
  SPECIALIST: 0.65,
  DEVELOPMENT: 0.35,
  EMERGENCY: 0.15,
};

/** Part C: relative usage TARGETS, never exact minutes -- VERY_HIGH is a "core player, rarely rotated" multiplier, not "N minutes". */
export const PLAYING_TIME_MULTIPLIER: Record<PlayingTimeIntention, number> = {
  VERY_HIGH: 1.0,
  HIGH: 0.85,
  NORMAL: 0.65,
  LOW: 0.4,
  VERY_LOW: 0.2,
  EMERGENCY_ONLY: 0.08,
};

/** Part E: ATTACK_ONLY/DEFENCE_ONLY zero the other phase entirely; *_PREFERRED weight it down rather than to zero -- the runtime treats this as a normal, repeated phase-change behavior, not a rare substitution event. */
export const PHASE_USAGE_MULTIPLIER: Record<PlayerPhaseUsage, { attack: number; defence: number }> = {
  BOTH_PHASES: { attack: 1, defence: 1 },
  ATTACK_ONLY: { attack: 1, defence: 0 },
  DEFENCE_ONLY: { attack: 0, defence: 1 },
  ATTACK_PREFERRED: { attack: 1, defence: 0.5 },
  DEFENCE_PREFERRED: { attack: 0.5, defence: 1 },
};

/**
 * Part F: a SubstitutionPair's designated phase gets a priority boost
 * for that player, and their OTHER phase is dampened -- independent of
 * whatever PhaseUsage was separately chosen, so the pairing ITSELF (not
 * just an already-matching phaseUsage value) drives "A on court in
 * attack, B on court in defence, both remain active participants".
 */
const SPECIALIST_PAIR_PREFERRED_MULTIPLIER = 1.3;
const SPECIALIST_PAIR_OTHER_MULTIPLIER = 0.6;

/** Part H: depth-hierarchy priority as a small, bounded rotation multiplier ("where available") -- priority 1 gets a boost, 3+ a reduction; a player not listed in any group is unaffected. */
function depthPriorityMultiplier(plan: MatchPlan, playerId: string): number {
  for (const group of plan.depthHierarchy) {
    const entry = group.entries.find((e) => e.playerId === playerId);
    if (entry) {
      if (entry.priority <= 1) return 1.15;
      if (entry.priority === 2) return 1.0;
      return 0.85;
    }
  }
  return 1.0;
}

export type SpecialistPairSide = "ATTACK_SIDE" | "DEFENCE_SIDE";

export interface PlayerUsagePlan {
  playerId: string;
  isGoalkeeper: boolean;
  matchRole: MatchRole;
  playingTimeIntention: PlayingTimeIntention;
  phaseUsage: PlayerPhaseUsage;
  /** Relative usage weight for the attack phase -- 0 for goalkeepers (Part M/Part C of HM-MATCH-RATINGS-0.1: the goalkeeper contributes to the defensive/goalkeeping side, never attack). */
  attackUsageWeight: number;
  /** Relative usage weight for the defence phase (outfield) -- 0 for goalkeepers, who use `goalkeeperUsageWeight` instead. */
  defenceUsageWeight: number;
  /** Relative usage weight for goalkeeper minutes -- 0 for outcourt players. */
  goalkeeperUsageWeight: number;
  /** Lower = higher rotation priority (enters sooner / stays on longer, all else equal). */
  rotationPriority: number;
  startingInAttack: boolean;
  startingInDefence: boolean;
  /** The other half of this player's SubstitutionPair, if any, and which side of it they are (Part F/J: "the system should expose this in its trace"). */
  specialistPair: { partnerId: string; side: SpecialistPairSide } | null;
}

export interface MatchUsagePlan {
  fixtureId: string;
  clubId: string;
  players: readonly PlayerUsagePlan[];
}

/** Pure and deterministic: the exact same MatchPlan always produces the exact same MatchUsagePlan (Part S #13). */
export function buildMatchUsagePlan(plan: MatchPlan): MatchUsagePlan {
  const attackStartingIds = new Set(plan.attackStartingUnit.slots.filter((s) => s.position !== "GK").map((s) => s.playerId));
  const defenceStartingIds = new Set(plan.defenceStartingUnit.courtSlots.map((s) => s.playerId));
  const usageById = new Map(plan.playerUsage.map((u) => [u.playerId, u]));

  const pairSideByPlayer = new Map<string, { partnerId: string; side: SpecialistPairSide }>();
  for (const pair of plan.substitutionPairs) {
    pairSideByPlayer.set(pair.attackPlayerId, { partnerId: pair.defencePlayerId, side: "ATTACK_SIDE" });
    pairSideByPlayer.set(pair.defencePlayerId, { partnerId: pair.attackPlayerId, side: "DEFENCE_SIDE" });
  }

  const players: PlayerUsagePlan[] = plan.squad.players.map((squadPlayer) => {
    const usage = usageById.get(squadPlayer.playerId);
    const matchRole = usage?.matchRole ?? "ROTATION";
    const playingTimeIntention = usage?.playingTimeIntention ?? "NORMAL";
    const phaseUsage = usage?.phaseUsage ?? "BOTH_PHASES";
    const isGoalkeeper = squadPlayer.position === "GK";

    // HM-MATCH-USAGE-1.4 Part 16: EMERGENCY (role) or EMERGENCY_ONLY
    // (intention) is a hard override to zero usage -- not merely a very
    // low multiplicative weight (which could still round to a nonzero
    // window with a favorable partner value, e.g. EMERGENCY role +
    // VERY_HIGH intention). "Normally not used at all" this milestone;
    // a future injury/red-card system is what will someday give this
    // role real, situational exposure.
    const isEmergency = matchRole === "EMERGENCY" || playingTimeIntention === "EMERGENCY_ONLY";
    const base = isEmergency ? 0 : MATCH_ROLE_WEIGHT[matchRole] * PLAYING_TIME_MULTIPLIER[playingTimeIntention] * depthPriorityMultiplier(plan, squadPlayer.playerId);
    const phaseMult = PHASE_USAGE_MULTIPLIER[phaseUsage];
    const pair = pairSideByPlayer.get(squadPlayer.playerId) ?? null;
    const attackPairMult = pair ? (pair.side === "ATTACK_SIDE" ? SPECIALIST_PAIR_PREFERRED_MULTIPLIER : SPECIALIST_PAIR_OTHER_MULTIPLIER) : 1;
    const defencePairMult = pair ? (pair.side === "DEFENCE_SIDE" ? SPECIALIST_PAIR_PREFERRED_MULTIPLIER : SPECIALIST_PAIR_OTHER_MULTIPLIER) : 1;

    return {
      playerId: squadPlayer.playerId,
      isGoalkeeper,
      matchRole,
      playingTimeIntention,
      phaseUsage,
      attackUsageWeight: isGoalkeeper ? 0 : base * phaseMult.attack * attackPairMult,
      defenceUsageWeight: isGoalkeeper ? 0 : base * phaseMult.defence * defencePairMult,
      goalkeeperUsageWeight: isGoalkeeper ? base : 0,
      // A smaller `base` (less intended usage) means a WORSE (higher) priority number -- ties broken by matchUsageEngine.ts's own seeded hash.
      rotationPriority: 1 / Math.max(0.001, base),
      startingInAttack: attackStartingIds.has(squadPlayer.playerId),
      // Goalkeepers are never in `defenceStartingUnit.courtSlots` (that
      // set is outfield-only, see HM-TACTICS-1.0's own domain doc) --
      // their "starting" flag instead reads `defenceStartingUnit.
      // goalkeeperId` directly, so the actual selected starting keeper
      // is never silently mistaken for a non-starter.
      startingInDefence: isGoalkeeper ? plan.defenceStartingUnit.goalkeeperId === squadPlayer.playerId : defenceStartingIds.has(squadPlayer.playerId),
      specialistPair: pair,
    };
  });

  return { fixtureId: plan.fixtureId, clubId: plan.clubId, players };
}
