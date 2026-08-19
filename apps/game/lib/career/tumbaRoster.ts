import type { MatchRosterPlayer } from "@handball-manager/game-simulation";
import { TUMBA_SQUAD, type PlayerMock } from "../game-data";

/**
 * Builds the matchday roster the Fast Match Engine distributes goals
 * across for IFK Tumba. Scope decision for HM-GAME-0.2A (documented
 * here, not silently assumed): every non-unavailable senior player
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

export function buildTumbaMatchRoster(): MatchRosterPlayer[] {
  const eligible = TUMBA_SQUAD.filter((p) => p.squadStatus === "Förstaval" || p.squadStatus === "Rotation");
  const outfield = eligible.filter((p) => p.position !== "MV");

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
    scoringWeight: scoringWeightFor(p),
    started: p.squadStatus === "Förstaval",
  }));

  if (!startingGoalkeeper) {
    return outfieldRoster;
  }

  return [
    { playerId: startingGoalkeeper.id, isGoalkeeper: true, scoringWeight: 0, started: true },
    ...outfieldRoster,
  ];
}
