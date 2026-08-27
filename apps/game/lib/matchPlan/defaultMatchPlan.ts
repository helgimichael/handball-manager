// HM-TACTICS-1.0 Part L: a deterministic helper that builds a VALID
// default MatchPlan from a selected MatchSquad -- so old saves, AI
// clubs, and tests can function before a human edits anything.
// Deliberately simple and transparent: greedy first-fit using the
// squad's own recorded positions and array order. NO CA, NO random
// selection, no optimization.
import { DEFENCE_ROLES, OUTCOURT_POSITIONS, type OutcourtPositionId } from "../rating/types";
import type {
  AttackStartingUnit,
  AttackUnitSlot,
  DefenceStartingUnit,
  DefenceUnitSlot,
  DepthHierarchy,
  MatchPlan,
  MatchRole,
  MatchSquad,
  PlayerMatchUsage,
  PlayingTimeIntention,
  SubstitutionPair,
} from "./types";
import type { PlayerMatchDefault, TacticsTemplate } from "./persistentDefaults";

export interface DefaultMatchPlanResult {
  ok: boolean;
  plan: MatchPlan | null;
  errors: string[];
}

/**
 * HM-PLAYER-CALIBRATION-1.0: a generic 0-4 priority tier (0 = highest
 * priority) used ONLY to grade the fallback matchRole/playingTimeIntention
 * this module assigns when no `playerDefaults` entry exists for a player.
 * This module stays decoupled from lib/career's SquadStatusTier by
 * design (see careerSquadBridge.ts's own header on the one-way
 * career -> matchPlan dependency) -- the caller
 * (lib/career/playerMatchStrength.ts) maps SquadStatusTier to this same
 * 0-4 scale before calling buildDefaultMatchPlan.
 */
export type SquadPriorityTier = 0 | 1 | 2 | 3 | 4;

/**
 * Starters keep near-full usage regardless of tier -- being IN the
 * starting unit already reflects being the best available player for
 * that slot (squad array order is priority-sorted upstream by the
 * caller), and a squad player forced into the XI by thin depth should
 * still get to play the match, not be undermined by a low intention.
 * Only a genuine KEY_PLAYER gets the top MATCH_ROLE_WEIGHT/
 * PLAYING_TIME_MULTIPLIER tier (see matchUsagePlan.ts) -- "mycket hög
 * förväntad användning" specifically for Nyckelspelare.
 */
const STARTER_ROLE_BY_TIER: Record<SquadPriorityTier, { matchRole: MatchRole; playingTimeIntention: PlayingTimeIntention }> = {
  0: { matchRole: "KEY_PLAYER", playingTimeIntention: "VERY_HIGH" },
  1: { matchRole: "STARTER", playingTimeIntention: "HIGH" },
  2: { matchRole: "STARTER", playingTimeIntention: "HIGH" },
  3: { matchRole: "STARTER", playingTimeIntention: "HIGH" },
  4: { matchRole: "STARTER", playingTimeIntention: "HIGH" },
};

/**
 * Bench usage is where squad hierarchy actually shows up: a benched
 * Nyckelspelare (e.g. two key players competing for one slot) still gets
 * meaningful minutes, while a benched Talang gets genuinely limited/
 * development-only exposure -- "en Truppspelare ska inte regelbundet
 * spela mer än en frisk Nyckelspelare på samma position".
 */
const BENCH_ROLE_BY_TIER: Record<SquadPriorityTier, { matchRole: MatchRole; playingTimeIntention: PlayingTimeIntention }> = {
  0: { matchRole: "MAJOR_ROTATION", playingTimeIntention: "HIGH" },
  1: { matchRole: "MAJOR_ROTATION", playingTimeIntention: "NORMAL" },
  2: { matchRole: "ROTATION", playingTimeIntention: "NORMAL" },
  3: { matchRole: "ROTATION", playingTimeIntention: "LOW" },
  4: { matchRole: "DEVELOPMENT", playingTimeIntention: "LOW" },
};

/** Picks the first squad player at each of the 6 outcourt positions (in squad array order); any positions left uncovered are filled with the next unused outcourt players, in squad order, regardless of their own recorded position -- guarantees a structurally complete 6-slot unit for any squad with >= 6 outcourt players, without inventing a fake position label match. */
function pickStartingSix(squad: MatchSquad): { playerId: string; position: OutcourtPositionId }[] | null {
  const outcourt = squad.players.filter((p) => p.position !== "GK");
  const used = new Set<string>();
  const picked: { playerId: string; position: OutcourtPositionId }[] = [];

  for (const position of OUTCOURT_POSITIONS as readonly OutcourtPositionId[]) {
    const match = outcourt.find((p) => p.position === position && !used.has(p.playerId));
    if (match) {
      picked.push({ playerId: match.playerId, position });
      used.add(match.playerId);
    }
  }

  const remainingPositions = (OUTCOURT_POSITIONS as readonly OutcourtPositionId[]).filter((position) => !picked.some((p) => p.position === position));
  const unusedPlayers = outcourt.filter((p) => !used.has(p.playerId));
  for (let i = 0; i < remainingPositions.length; i++) {
    const fill = unusedPlayers[i];
    if (!fill) return null; // not enough outcourt players to complete a 6-player unit
    picked.push({ playerId: fill.playerId, position: remainingPositions[i] });
  }

  return picked;
}

/**
 * Builds a deterministic default MatchPlan: the first goalkeeper found
 * plus a greedy 6-outcourt selection start both attack and defence
 * (a simple, transparent default -- the same 6+GK for both phases,
 * BOTH_PHASES usage for starters, until a human customizes it). Fails
 * honestly (never fabricates a plan) when the squad genuinely lacks a
 * goalkeeper or at least 6 outcourt players.
 *
 * HM-MATCH-1.1 Part 1/2: `tacticsTemplate` and `playerDefaults` are
 * OPTIONAL persistent-inheritance inputs (CareerState's own
 * `tactics`/`playerMatchDefaults`, see lib/matchPlan/persistentDefaults.ts)
 * -- when supplied, a brand-new fixture's attackPlan/defencePlan/
 * transitionPlan and each player's matchRole/playingTimeIntention/
 * phaseUsage start from the manager's own last-configured tactics and
 * per-player standing rather than the hardcoded neutral defaults below.
 * Omitting them (every pre-HM-MATCH-1.1 call site) is byte-identical to
 * before this milestone.
 *
 * HM-PLAYER-CALIBRATION-1.0: `squadPriorityTierByPlayerId` is an OPTIONAL
 * 5th input -- for any player with NO `playerDefaults` entry (true for
 * every CPU/AI club, which never gets a manager-configured
 * playerMatchDefaults), it grades the fallback matchRole/
 * playingTimeIntention by squad hierarchy (see STARTER_ROLE_BY_TIER/
 * BENCH_ROLE_BY_TIER above) instead of the flat STARTER/ROTATION
 * default. Omitting it reproduces the exact pre-HM-PLAYER-CALIBRATION-1.0
 * flat default byte-for-byte.
 */
export function buildDefaultMatchPlan(
  squad: MatchSquad,
  tacticsTemplate?: TacticsTemplate,
  playerDefaults?: Readonly<Record<string, PlayerMatchDefault>>,
  squadPriorityTierByPlayerId?: Readonly<Record<string, SquadPriorityTier>>,
): DefaultMatchPlanResult {
  const goalkeeper = squad.players.find((p) => p.position === "GK");
  if (!goalkeeper) {
    return { ok: false, plan: null, errors: ["Cannot build a default match plan: squad has no goalkeeper."] };
  }

  const startingSix = pickStartingSix(squad);
  if (!startingSix) {
    return { ok: false, plan: null, errors: ["Cannot build a default match plan: squad has fewer than 6 outcourt players."] };
  }

  const attackSlots: AttackUnitSlot[] = [{ playerId: goalkeeper.playerId, position: "GK" }, ...startingSix.map((p) => ({ playerId: p.playerId, position: p.position as AttackUnitSlot["position"] }))];
  const attackStartingUnit: AttackStartingUnit = { formation: "NORMAL", slots: attackSlots };

  const defenceCourtSlots: DefenceUnitSlot[] = startingSix.map((p, i) => ({ playerId: p.playerId, courtSlot: i + 1, role: DEFENCE_ROLES[i % DEFENCE_ROLES.length] }));
  const defenceStartingUnit: DefenceStartingUnit = { courtSlots: defenceCourtSlots, goalkeeperId: goalkeeper.playerId };

  const starterIds = new Set([goalkeeper.playerId, ...startingSix.map((p) => p.playerId)]);
  const playerUsage: PlayerMatchUsage[] = squad.players.map((p) => {
    const persisted = playerDefaults?.[p.playerId];
    if (persisted) return { playerId: p.playerId, ...persisted };
    const isStarter = starterIds.has(p.playerId);
    const tier = squadPriorityTierByPlayerId?.[p.playerId];
    const graded = tier !== undefined ? (isStarter ? STARTER_ROLE_BY_TIER[tier] : BENCH_ROLE_BY_TIER[tier]) : null;
    return {
      playerId: p.playerId,
      matchRole: graded?.matchRole ?? (isStarter ? "STARTER" : "ROTATION"),
      playingTimeIntention: graded?.playingTimeIntention ?? (isStarter ? "HIGH" : "NORMAL"),
      phaseUsage: "BOTH_PHASES",
    };
  });

  const substitutionPairs: SubstitutionPair[] = [];

  // One depth group per outcourt position (squad order = priority order) plus a GK group -- uses existing player order, never CA.
  const depthHierarchy: DepthHierarchy = [
    ...(OUTCOURT_POSITIONS as readonly OutcourtPositionId[]).map((position) => ({
      groupKey: position,
      entries: squad.players
        .filter((p) => p.position === position)
        .map((p, i) => ({ playerId: p.playerId, priority: i + 1 })),
    })),
    {
      groupKey: "GK",
      entries: squad.players.filter((p) => p.position === "GK").map((p, i) => ({ playerId: p.playerId, priority: i + 1 })),
    },
  ].filter((group) => group.entries.length > 0);

  const plan: MatchPlan = {
    fixtureId: squad.fixtureId,
    clubId: squad.clubId,
    squad,
    attackStartingUnit,
    defenceStartingUnit,
    playerUsage,
    substitutionPairs,
    depthHierarchy,
    attackPlan: tacticsTemplate?.attackPlan ?? {
      tempo: "BALANCED",
      structureFreedom: "BALANCED",
      pivotUsage: "MEDIUM",
      twoVTwoEmphasis: "MEDIUM",
      breakthroughEmphasis: "MEDIUM",
      shootingEmphasis: "MEDIUM",
      wingUsage: "MEDIUM",
      ballCirculation: "BALANCED",
      sevenVSixPolicy: { level: "SITUATIONAL", activeFromKickoff: false },
    },
    defencePlan: tacticsTemplate?.defencePlan ?? {
      baseFormation: "6-0",
      defensiveDepth: "STANDARD",
      contactIntent: "MEDIUM",
      coverBlockingEmphasis: "MEDIUM",
      ballOrientedPressure: "MEDIUM",
      riskLevel: "MEDIUM",
    },
    transitionPlan: tacticsTemplate?.transitionPlan ?? {
      offensiveTransitionIntent: "MEDIUM",
      defensiveRetreatIntent: "MEDIUM",
      firstWaveAggression: "MEDIUM",
      goalkeeperInitiation: "MEDIUM",
      substitutionPriority: "BALANCED",
    },
  };

  return { ok: true, plan, errors: [] };
}
