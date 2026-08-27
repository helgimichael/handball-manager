// HM-CONTRACTS-1.0/1.0A: the ONLY module that reads/writes CareerState
// for contract economic identity -- mirrors lib/medical/injuryIntegration.ts's
// own "pure math below, CareerState glue here" split. newCareer.ts and
// saveMigration.ts call ensureCareerPlayerContracts; every UI reader
// (Player Profile, Squad) calls getPlayerContract/getPlayerMarketValueEur.
// Club history / training compensation are deliberately handled by
// their own SIBLING integration modules (clubHistoryIntegration.ts,
// trainingCompensationIntegration.ts), never folded in here -- Part:
// "Den får INTE bakas in i marketValue eller transferFee."
import { getCareerClubSquad, getCareerPlayer } from "../career/careerWorld";
import { playerAgeAtDate } from "../development/developmentIntegration";
import type { CareerState } from "../career/types";
import { getCompetition, getClub, type PlayerMock } from "../game-data";
import { getCareerPlayerRating } from "../career/careerRatingNormalization";
import { mapHandballPositionToMatchPlanPosition } from "../matchPlan/careerSquadBridge";
import type { MatchRole } from "../matchPlan/types";
import { generateInitialContract } from "./contractGeneration";
import { computePlayerMarketValueEur, type EconomyProfileInputs } from "./marketValue";
import { getContractStatus } from "./contractLifecycle";
import type { ContractStatus, PlayerContract } from "./types";

/**
 * Part 2: the "permanent Matchroll" reuse -- CareerState.playerMatchDefaults
 * (lib/matchPlan/persistentDefaults.ts's PlayerMatchDefault, NOT the
 * fixture-scoped PlayerMatchUsage/MatchPlan.playerUsage). A player with
 * no persisted default yet (never touched via the Tactics workspace)
 * falls back to a role DERIVED from the static mock's own squadStatus --
 * an honest "best guess from what we do know", never a crash/undefined.
 */
function resolveMatchRole(state: CareerState, player: PlayerMock): MatchRole {
  const persisted = state.playerMatchDefaults[player.id]?.matchRole;
  if (persisted) return persisted;
  switch (player.squadStatus) {
    case "Förstaval":
      return "STARTER";
    case "Rotation":
      return "ROTATION";
    case "Ungdom":
      return "DEVELOPMENT";
    default:
      return "ROTATION"; // Skadad/Avstängd: unknown NORMAL standing, neutral fallback -- injury/suspension is a separate, orthogonal concept (lib/medical).
  }
}

function buildEconomyProfileInputs(state: CareerState, player: PlayerMock): EconomyProfileInputs | null {
  const rating = getCareerPlayerRating(state, player.id, player.clubId);
  if (!rating) return null; // Part 16: every roster player is guaranteed a rating by HM-RATINGS-CAREER-1.0 -- null here only for a player outside any tracked club's squad at all.
  const age = playerAgeAtDate(player.dateOfBirth, player.birthYear, state.gameDate);
  const competitionTier = getCompetition(getClub(player.clubId)?.competitionId ?? "")?.tier;
  return {
    ca: rating.ca,
    pa: rating.pa,
    age,
    position: mapHandballPositionToMatchPlanPosition(player.position),
    role: resolveMatchRole(state, player),
    competitionTier,
  };
}

/**
 * Part 4: fills ONLY missing roster-player contracts for `clubId` --
 * mirrors ensureCareerGameplayRatings's exact idempotency contract
 * (never touches an existing contract, true no-op / same reference when
 * nothing missing, safe to call on every migration).
 */
export function ensureCareerPlayerContracts(state: CareerState, clubId: string): CareerState {
  const squad = getCareerClubSquad(state, clubId);
  if (squad.length === 0) return state;

  const existing = state.playerContracts;
  const missing = squad.filter((p) => !existing[p.id]);
  if (missing.length === 0) return state;

  const fallbackYear = Number(state.gameDate.slice(0, 4)) + 1;
  const nextContracts: Record<string, PlayerContract> = { ...existing };
  for (const player of missing) {
    const economyInputs = buildEconomyProfileInputs(state, player);
    if (!economyInputs) continue; // no rating yet for this player -- leave ungenerated, same "pending, never fabricated" precedent as development stimulus.
    nextContracts[player.id] = generateInitialContract(player.id, clubId, player.contractEndSeason, fallbackYear, economyInputs);
  }
  if (Object.keys(nextContracts).length === Object.keys(existing).length) return state; // every candidate skipped (no rating yet) -- true no-op.
  return { ...state, playerContracts: nextContracts };
}

export function getPlayerContract(state: CareerState, playerId: string): PlayerContract | undefined {
  return state.playerContracts[playerId];
}

export function getPlayerContractStatus(state: CareerState, playerId: string): ContractStatus | undefined {
  const contract = getPlayerContract(state, playerId);
  if (!contract) return undefined;
  return getContractStatus(contract.contractEndDate, state.gameDate);
}

/**
 * Part: the dynamic, always-fresh market value -- recomputed from the
 * player's CURRENT rating/age/role/contract every call, never read from
 * a stored number (see marketValue.ts's own doc for why). `undefined`
 * only when the player has no contract yet (should not happen for any
 * roster player post-ensureCareerPlayerContracts) or no rating at all.
 */
export function getPlayerMarketValueEur(state: CareerState, playerId: string): number | undefined {
  const player = getCareerPlayer(state, playerId);
  const contract = getPlayerContract(state, playerId);
  if (!player || !contract) return undefined;
  const economyInputs = buildEconomyProfileInputs(state, player);
  if (!economyInputs) return undefined;
  return computePlayerMarketValueEur(economyInputs, contract.contractEndDate, state.gameDate);
}
