import type { MatchRosterPlayer } from "@handball-manager/game-simulation";
import type { PlayerMock } from "../game-data";
import { buildInitialMatchSquad } from "../matchPlan/careerSquadBridge";
import { MATCH_SQUAD_MAX_PLAYERS } from "../matchPlan/types";
import { isSelectableForMatch, type PlayerCareerStatus } from "./playerStatus";

/**
 * HM-MATCH-1.1 Part 9: the guaranteed-legal exposure map for a side
 * whose real MatchPlan/MatchUsageTrace could not be resolved (e.g. the
 * AI opponent's squad snapshot has no valid goalkeeper or fewer than 6
 * outcourt players in `buildDefaultMatchPlan`'s greedy pick). Root
 * cause of the observed ">16 participants" bug: `buildMatchRoster`
 * previously fell back to its UNFILTERED branch (every squadStatus-
 * eligible player from the club's full raw squad, no cap at all)
 * whenever the caller had no exposure map to pass. This derives a real,
 * <=16-player map from the SAME deterministic initial-squad selection
 * the Tactics workspace itself uses for a fixture with no saved plan
 * yet -- never a second selection algorithm -- so a caller with no
 * resolved MatchPlan still gets a legally-capped, exposure-gated
 * roster instead of the entire club.
 */
export function buildFallbackAttackExposure(squad: readonly PlayerMock[], fixtureId: string, clubId: string): ReadonlyMap<string, number> {
  const initial = buildInitialMatchSquad(squad, fixtureId, clubId);
  const map = new Map<string, number>();
  for (const p of initial.players) {
    if (p.position !== "GK") map.set(p.playerId, 1);
  }
  return map;
}

/**
 * Builds the matchday roster the Fast Match Engine distributes goals
 * across for one club's squad (HM-DATA-0.2: any club's snapshotted
 * squad, not just IFK Tumba's). Scope decision for HM-GAME-0.2A
 * (documented here, not silently assumed): every non-unavailable senior player
 * (squadStatus "Förstaval" or "Rotation") is included every match --
 * there is no bench-rotation/selection model yet, so every eligible
 * player registers an appearance each fixture. "Ungdom" prospects are
 * excluded from the regular matchday squad by default (a future pass
 * can introduce occasional youth involvement); "Skadad"/"Avstängd"
 * players are always excluded.
 */
function scoringWeightFor(player: PlayerMock): number {
  // Center-back/playmaker positions distribute more than they finish
  // in real handball, so their relative scoring weight is dampened
  // slightly versus wings/backs/pivot -- a coarse position bias, not a
  // claim of a final tactical model.
  const positionMultiplier = player.position === "M6" || player.position === "M9" ? 0.75 : 1;
  return (player.currentAbility / 10) * positionMultiplier;
}

/**
 * `playerStatuses` (HM-GAME-0.3): when provided, the per-save live
 * availability slice overrides the static mock's `squadStatus` for
 * eligibility -- so a Career Rhythm recovery (Skadad -> AVAILABLE)
 * actually puts a player back in the matchday roster, and not merely in
 * a cosmetic status label. Omitted for callers that predate Career
 * Rhythm (falls back to the original squadStatus-only behaviour).
 *
 * `attackExposureById` (HM-MATCH-1.0 Part P): when supplied (the
 * manager's own MatchPlan/MatchUsage trace is known -- see
 * matchdayAction.ts), a player who isn't in the MatchPlan's MatchSquad
 * at all (no entry in EITHER exposure map -- squadStatus eligibility
 * alone would otherwise still have included them, since these maps are
 * a strict narrowing, never a widening, of that eligibility) is
 * excluded from the roster, so they are structurally unreachable by
 * `distributeGoalsToRoster` in matchEngine.ts -- preventing a live QA
 * finding ("a player not even selected into the 16-man MatchSquad still
 * appeared as a scorer") Part P calls out. `scoringWeight` is scaled by
 * `attackExposureById` alone, so a player with ZERO intended attacking
 * exposure (EMERGENCY_ONLY, or a HM-MATCH-USAGE-1.4 DEFENCE_ONLY player)
 * is structurally unreachable as a SCORER specifically (Part P's
 * "EMERGENCY_ONLY becomes top scorer" case), never merely deprioritized
 * -- while a heavily-used player gets proportionally more scoring
 * opportunity. `defenceExposureById` (HM-MATCH-USAGE-1.4 Part 21/24 #9):
 * roster INCLUSION itself is the union of attack and defence exposure --
 * a legitimate DEFENCE_ONLY player still participated in the match (and
 * needs a contribution/stats entry) even though they structurally can
 * never be drawn as a scorer; only a player with ZERO exposure in BOTH
 * phases (e.g. EMERGENCY_ONLY, or absent from the plan) is excluded
 * from the roster entirely. Omitting both maps is byte-identical to
 * before HM-MATCH-1.0.
 */
export function buildMatchRoster(
  squad: readonly PlayerMock[],
  playerStatuses?: Record<string, PlayerCareerStatus>,
  attackExposureById?: ReadonlyMap<string, number>,
  attackActiveWindowsById?: ReadonlyMap<string, readonly boolean[]>,
  defenceExposureById?: ReadonlyMap<string, number>,
): MatchRosterPlayer[] {
  const eligible = squad.filter((p) => {
    const baseEligible = p.squadStatus === "Förstaval" || p.squadStatus === "Rotation";
    if (!playerStatuses || !playerStatuses[p.id]) {
      return baseEligible;
    }
    if (!isSelectableForMatch(playerStatuses, p.id)) {
      // HM-INJURIES-1.0 Part 15/16: a live INJURED/SUSPENDED/RECOVERING
      // status always excludes, regardless of the static mock -- but a
      // LIMITED (return-to-play) player IS still selectable (Part 17).
      return false;
    }
    // Live AVAILABLE: recovers a stale Skadad/Avstängd mock status, but never grants eligibility to Ungdom.
    return baseEligible || p.squadStatus === "Skadad" || p.squadStatus === "Avstängd";
  });
  const outfieldEligible = eligible.filter((p) => p.position !== "MV");
  let outfield = attackExposureById ? outfieldEligible.filter((p) => (attackExposureById.get(p.id) ?? 0) > 0 || (defenceExposureById?.get(p.id) ?? 0) > 0) : outfieldEligible;

  // HM-MATCH-1.1 Part 9: a hard, unconditional cap -- belt-and-suspenders
  // alongside `buildFallbackAttackExposure` above. Even a caller that
  // omits `attackExposureById` entirely (the legacy "no MatchPlan"
  // fallback other pre-existing call sites still use) can never produce
  // a roster of more than MATCH_SQUAD_MAX_PLAYERS participants -- the
  // invariant every match report/analysis view depends on. Preference
  // order (Förstaval before Rotation, existing squad order within each)
  // keeps the cap's choice deterministic and biased toward the players
  // who would actually be selected first.
  const maxOutfield = MATCH_SQUAD_MAX_PLAYERS - 1; // one slot reserved for the goalkeeper
  if (outfield.length > maxOutfield) {
    outfield = [...outfield].sort((a, b) => (a.squadStatus === b.squadStatus ? 0 : a.squadStatus === "Förstaval" ? -1 : 1)).slice(0, maxOutfield);
  }

  // Exactly ONE goalkeeper plays per match -- the Fast Match Engine
  // attributes the team's full saves/shotsFaced tally to every roster
  // entry marked isGoalkeeper, so including more than one here would
  // double-count goalkeeper stats. Prefer the Förstaval keeper; fall
  // back to the next eligible one if unavailable.
  const goalkeepers = eligible.filter((p) => p.position === "MV");
  const startingGoalkeeper = goalkeepers.find((p) => p.squadStatus === "Förstaval") ?? goalkeepers[0];

  const outfieldRoster: MatchRosterPlayer[] = outfield.map((p) => ({
    playerId: p.id,
    isGoalkeeper: false,
    scoringWeight: scoringWeightFor(p) * (attackExposureById ? Math.max(0, Math.min(1, attackExposureById.get(p.id) ?? 1)) : 1),
    started: p.squadStatus === "Förstaval",
    activeWindows: attackActiveWindowsById?.get(p.id),
  }));

  if (!startingGoalkeeper) {
    return outfieldRoster;
  }

  return [
    { playerId: startingGoalkeeper.id, isGoalkeeper: true, scoringWeight: 0, started: true },
    ...outfieldRoster,
  ];
}
