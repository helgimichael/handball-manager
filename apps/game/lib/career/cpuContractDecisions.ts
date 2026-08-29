// HM-CPU-SQUAD-BUILDING-1.0: the first, deliberately simple CPU contract
// decision -- RENEW / WAIT / RELEASE for a player whose contract is
// genuinely approaching its end (EXPIRING_SOON/EXPIRING, per Economy
// 1.0's own lib/economy/contractLifecycle.ts thresholds). Pure scoring
// function below; CareerState glue (progressCpuContractDecisions) at the
// bottom is the ONLY place that writes playerContracts for this feature.
import type { HandballPosition, PlayerMock } from "../game-data";
import { getClubFinancialHealth } from "../economy/clubEconomyIntegration";
import { getPlayerContract, getPlayerContractStatus } from "../economy/contractIntegration";
import { daysUntilContractEnd } from "../economy/contractLifecycle";
import { computeNewContractEndDate } from "../transfers/transferExecution";
import { playerAgeAtDate } from "../development/developmentIntegration";
import { deriveDefaultSquadStatusTier, type SquadStatusTier } from "./squadStatus";
import type { FinancialPressureLevel } from "../economy/clubEconomyTypes";
import type { CareerState } from "./types";

export const CPU_CONTRACT_DECISIONS = ["RENEW", "WAIT", "RELEASE"] as const;
export type CpuContractDecision = (typeof CPU_CONTRACT_DECISIONS)[number];

export interface ContractDecisionInputs {
  tier: SquadStatusTier;
  age: number | null;
  positionDepthCount: number;
  financialPressure: FinancialPressureLevel;
}

export interface ContractDecisionResult {
  decision: CpuContractDecision;
  reason: string;
}

/**
 * Deliberately conservative (Part: "Var konservativ med KEY_PLAYER" /
 * "Ingen aggressiv squad churn"): a KEY_PLAYER is renewed unless the
 * club is in genuine financial crisis AND the player is old enough that
 * losing them is a defensible cost-saving; RELEASE only ever fires for
 * an older squad/rotation player the club has real depth behind AND is
 * under real financial pressure -- never a healthy club casually
 * dumping a rostered player. Every other case defaults to WAIT (no
 * action), matching the "ingen aggressiv churn" instruction directly.
 */
export function decideContractAction(inputs: ContractDecisionInputs): ContractDecisionResult {
  const isOld = inputs.age !== null && inputs.age >= 32;
  const hasDepth = inputs.positionDepthCount >= 2;
  const clubUnderPressure = inputs.financialPressure === "SERIOUS" || inputs.financialPressure === "CRITICAL";

  if (inputs.tier === "KEY_PLAYER") {
    if (inputs.financialPressure === "CRITICAL" && isOld) {
      return { decision: "WAIT", reason: "Nyckelspelare, men klubbens ekonomi är kritisk och spelaren är äldre -- avvaktar innan beslut." };
    }
    return { decision: "RENEW", reason: "Nyckelspelare -- klubben prioriterar att förlänga kontraktet." };
  }

  if (inputs.tier === "FIRST_CHOICE") {
    if (isOld && hasDepth) {
      return { decision: "WAIT", reason: "Äldre ordinarie spelare med god positionsdjup bakom sig -- avvaktar." };
    }
    return { decision: "RENEW", reason: "Ordinarie spelare -- klubben förlänger kontraktet." };
  }

  if (inputs.tier === "TALENT") {
    return { decision: "RENEW", reason: "Talang -- klubben vill behålla en utvecklingsspelare." };
  }

  // ROTATION / SQUAD_PLAYER
  if (isOld && hasDepth && clubUnderPressure) {
    return { decision: "RELEASE", reason: "Äldre rollspelare, god positionsdjup, och klubbens ekonomi är pressad -- släpps." };
  }
  if (hasDepth) {
    return { decision: "WAIT", reason: "Rollspelare med god positionsdjup bakom sig -- avvaktar utan att agera." };
  }
  return { decision: "WAIT", reason: "Ingen tydlig anledning att agera just nu." };
}

export interface CpuContractDecisionLogEntry {
  playerId: string;
  clubId: string;
  position: HandballPosition;
  decision: CpuContractDecision;
  reason: string;
}

const RENEWAL_YEARS_BY_TIER: Partial<Record<SquadStatusTier, number>> = { KEY_PLAYER: 3, FIRST_CHOICE: 2, TALENT: 2 };
const DEFAULT_RENEWAL_YEARS = 2;
/** HM-CPU-SQUAD-BUILDING-1.0B Part 9: the 1.0A audit found ~23,800 WAIT log rows for one run -- the same stable no-op decision re-logged every single day for as long as a player sits in the EXPIRING_SOON window (up to 365 days). RENEW/RELEASE are real actions and are always logged immediately when they happen; a WAIT (no state change at all) is only logged on this periodic checkpoint instead of daily. Decision LOGIC itself is unchanged -- this only throttles how often an unchanged "no action" gets written down. */
const WAIT_LOG_REVIEW_INTERVAL_DAYS = 30;

/**
 * Part: dailyTick integration -- cheap (pure filtering + a handful of
 * lookups per player), so unlike the recruitment search this runs for
 * every CPU club every day; only players whose contract has just crossed
 * into EXPIRING_SOON/EXPIRING territory are evaluated at all (Economy
 * 1.0's own status thresholds), and RENEW/RELEASE both push the contract
 * OUT of that window (a later end date, or an immediate FREE_AGENT
 * expiry) -- so a decided player is naturally never re-evaluated the
 * next day (self-limiting, no extra "already decided" state needed).
 * Never called for `state.playerClubId` (Part: "Human-controlled club
 * får aldrig styras av detta").
 */
export function progressCpuContractDecisions(state: CareerState, date: string, cpuClubIds: readonly string[]): { state: CareerState; log: CpuContractDecisionLogEntry[] } {
  let next = state;
  const log: CpuContractDecisionLogEntry[] = [];

  for (const clubId of cpuClubIds) {
    if (clubId === state.playerClubId) continue;
    const squad = next.worldSquads[clubId] ?? [];
    for (const player of squad as readonly PlayerMock[]) {
      const status = getPlayerContractStatus(next, player.id);
      if (status !== "EXPIRING_SOON" && status !== "EXPIRING") continue;
      const contract = getPlayerContract(next, player.id);
      if (!contract) continue;

      const tier = deriveDefaultSquadStatusTier(player);
      const age = playerAgeAtDate(player.dateOfBirth, player.birthYear, date);
      const positionDepthCount = squad.filter((p) => p.id !== player.id && p.position === player.position).length;
      const financialPressure = getClubFinancialHealth(next, clubId)?.pressure ?? "NONE";

      const { decision, reason } = decideContractAction({ tier, age, positionDepthCount, financialPressure });

      if (decision === "RENEW") {
        const years = RENEWAL_YEARS_BY_TIER[tier] ?? DEFAULT_RENEWAL_YEARS;
        const newEndDate = computeNewContractEndDate(player.id, date, years);
        next = { ...next, playerContracts: { ...next.playerContracts, [player.id]: { ...contract, contractEndDate: newEndDate } } };
        log.push({ playerId: player.id, clubId, position: player.position, decision, reason });
      } else if (decision === "RELEASE") {
        next = { ...next, playerContracts: { ...next.playerContracts, [player.id]: { ...contract, contractEndDate: date } } };
        log.push({ playerId: player.id, clubId, position: player.position, decision, reason });
      } else if (daysUntilContractEnd(contract.contractEndDate, date) % WAIT_LOG_REVIEW_INTERVAL_DAYS === 0) {
        log.push({ playerId: player.id, clubId, position: player.position, decision, reason });
      }
    }
  }

  return { state: next, log };
}
