// HM-CPU-SQUAD-BUILDING-1.0: the first, deliberately simple CPU contract
// decision -- RENEW / WAIT / RELEASE for a player whose contract is
// genuinely approaching its end (EXPIRING_SOON/EXPIRING, per Economy
// 1.0's own lib/economy/contractLifecycle.ts thresholds). Pure scoring
// function below; CareerState glue (progressCpuContractDecisions) at the
// bottom is the ONLY place that writes playerContracts for this feature.
//
// HM-CPU-CONTRACT-DECISIONS-1.1: the 1.0/1.0B decision matrix produced
// 375 RENEW / 0 RELEASE across a full simulated season -- ROTATION/
// SQUAD_PLAYER tiers had literally no RENEW branch at all (Part: "ingen
// aggressiv churn"), so they only ever WAITed until the contract expired
// on its own. That was harmless before HM-PLAYER-CONTRACT-LIFECYCLE-1.0
// (expiry never actually executed), but is now a real, passive squad-
// thinning bug. `decideContractAction` is rebuilt below into a genuinely
// roster-aware decision: projected position depth AFTER this player's
// own departure (the single most important new signal -- Part 8),
// wage-vs-role discipline (Part 7), position rank within the club (Part
// 3's "redan ersatt av tydligt bättre alternativ"), and real talent
// protection (Part 5) all now feed the tree, not just tier+age+pressure.
// Kept as a PURE function of primitive inputs (same "pure math here,
// CareerState glue below" split as every economy module in this
// codebase) so it stays trivially unit-testable without constructing a
// full CareerState.
import type { HandballPosition, PlayerMock } from "../game-data";
import { getClubFinancialHealth } from "../economy/clubEconomyIntegration";
import { getPlayerContract, getPlayerContractStatus, getPlayerFairWageEurPerMonth } from "../economy/contractIntegration";
import { daysUntilContractEnd } from "../economy/contractLifecycle";
import { computeNewContractEndDate } from "../transfers/transferExecution";
import { playerAgeAtDate } from "../development/developmentIntegration";
import { deriveDefaultSquadStatusTier, type SquadStatusTier } from "./squadStatus";
import { assessPositionNeed, type NeedLevel } from "./cpuSquadNeeds";
import { getCareerPlayerRating } from "./careerRatingNormalization";
import type { FinancialPressureLevel } from "../economy/clubEconomyTypes";
import type { CareerState } from "./types";

export const CPU_CONTRACT_DECISIONS = ["RENEW", "WAIT", "RELEASE"] as const;
export type CpuContractDecision = (typeof CPU_CONTRACT_DECISIONS)[number];

/**
 * HM-CPU-CONTRACT-DECISIONS-1.1 Part 1: decision horizon -- unchanged
 * date architecture (contractLifecycle.ts's own EXPIRING_SOON/EXPIRING
 * thresholds already gate WHICH players get evaluated at all; "långt
 * kvar -> ingen action" already holds since anything further out isn't
 * evaluated here). New: within this many days of the real end date, WAIT
 * is no longer an available outcome -- the tree below must resolve to a
 * concrete RENEW or RELEASE (Part 12: "Ju närmare expiry: desto mer
 * måste klubben gå mot RENEW eller RELEASE").
 */
export const DECISION_FORCE_WITHIN_DAYS = 45;

const OLD_AGE_THRESHOLD = 31;
const VERY_OLD_AGE_THRESHOLD = 34;
/** Part 7: a wage this far above the role/CA/age-derived fair baseline is a WAIT-level concern under pressure. */
const WAGE_OVERPAY_RATIO_WAIT = 1.2;
/** Part 7: a wage this far above fair value is a RELEASE-level concern on its own. */
const WAGE_OVERPAY_RATIO_RELEASE = 1.5;
/** Part 5: real development value, not tier alone -- PA headroom (pa - ca) at or above this protects a young player even at low current CA. */
const TALENT_PA_HEADROOM_THRESHOLD = 15;
const TALENT_PROTECT_AGE = 23;
/** Part 3: the minimum genuine CA gap (in the same 90-185-ish economy-scale CA population marketValue.ts's own curve is anchored to) before another teammate at the same position counts as "clearly better", not just marginally ahead -- the season-boundary audit's own first run found positionRank>=2 alone firing on essentially EVERY KEY_PLAYER whenever a club happened to carry two similarly-elite players at one position (co-starters, rotation goalkeepers), releasing 71/71 of the season's total RELEASE volume this way. A real gap requirement fixes that without removing the signal item 3 itself asks for. */
export const CLEARLY_REPLACED_CA_GAP = 12;

function clubUnderPressure(pressure: FinancialPressureLevel): boolean {
  return pressure === "SERIOUS" || pressure === "CRITICAL";
}

export interface ContractDecisionInputs {
  tier: SquadStatusTier;
  age: number | null;
  ca: number;
  /** pa - ca, clamped >= 0 -- development headroom, Part 5. */
  paHeadroom: number;
  /** 1 = this player currently has the best CA at their own position in the club's usable squad; higher = more replaceable (Part 2/3). */
  positionRank: number;
  /** How far below the position's own best CA this player sits (0 when positionRank is 1). A real KEY_PLAYER-tier "already replaced by someone clearly better" signal requires a genuine gap here, not just any other teammate with a marginally higher number -- two similarly elite players sharing a position (co-starters, rotation goalkeepers) must never read as one having "replaced" the other. */
  caGapToPositionBest: number;
  /** This player's own CA divided by the club's own average CA across its usable squad (Part 2: "CA relativt klubben"). */
  caVsClubAvg: number;
  wageEurPerMonth: number;
  /** computePlayerSalaryEurPerMonth-derived baseline for this role/CA/age (Part 7). */
  fairWageEurPerMonth: number;
  financialPressure: FinancialPressureLevel;
  daysUntilExpiry: number;
  /** Position need assessed on the squad WITHOUT this player -- Part 8's own worked example (projected depth after departure). */
  needIfLeaves: NeedLevel;
  /** The position stays at/above saturated depth (>=4) even without this player -- genuinely redundant, Part 4/8. */
  needIfLeavesSaturated: boolean;
  /** An AGREED_AWAITING_WINDOW incoming signee already exists at this exact position -- Part 9. */
  hasAgreedReplacement: boolean;
}

export interface ContractDecisionResult {
  decision: CpuContractDecision;
  /** Multiple, ordered, human-readable reasons -- Part 13's own explainability requirement (a developer audit can print every contributing factor, not just one). */
  reasons: readonly string[];
}

/**
 * HM-CPU-CONTRACT-DECISIONS-1.1: rebuilt decision tree. Every tier now
 * has a real path to RENEW *and* to RELEASE -- never an automatic
 * outcome, never a hard single-factor cliff (Part 6: no bare
 * `age > 32 -> release`). WAIT is a genuine "still uncertain, revisit
 * later" outcome (Part 12), not the tier-4/5 default it used to be, and
 * is unavailable once `daysUntilExpiry <= DECISION_FORCE_WITHIN_DAYS`.
 */
export function decideContractAction(inputs: ContractDecisionInputs): ContractDecisionResult {
  const veryClose = inputs.daysUntilExpiry <= DECISION_FORCE_WITHIN_DAYS;
  const old = inputs.age !== null && inputs.age >= OLD_AGE_THRESHOLD;
  const veryOld = inputs.age !== null && inputs.age >= VERY_OLD_AGE_THRESHOLD;
  const overpaidForWait = inputs.wageEurPerMonth > inputs.fairWageEurPerMonth * WAGE_OVERPAY_RATIO_WAIT;
  const overpaidForRelease = inputs.wageEurPerMonth > inputs.fairWageEurPerMonth * WAGE_OVERPAY_RATIO_RELEASE;
  const underPressure = clubUnderPressure(inputs.financialPressure);
  const positionWouldBeThin = inputs.needIfLeaves === "HIGH";

  // --- KEY_PLAYER ----------------------------------------------------------
  // Part 3: normally RENEW, but not absolutely immune.
  if (inputs.tier === "KEY_PLAYER") {
    if (inputs.positionRank >= 2 && inputs.caGapToPositionBest >= CLEARLY_REPLACED_CA_GAP && !positionWouldBeThin) {
      return { decision: "RELEASE", reasons: ["Tydligt förbisprungen av en klart bättre spelare på samma position.", "Positionen klarar avgången utan att bli tunn."] };
    }
    if (veryOld && overpaidForRelease && !positionWouldBeThin) {
      return { decision: "RELEASE", reasons: ["Kraftigt åldrande nyckelspelare.", "Lönen är mycket hög relativt roll och nivå.", "Positionen klarar avgången."] };
    }
    if (underPressure && overpaidForWait) {
      if (veryClose) {
        return old
          ? { decision: "RELEASE", reasons: ["Nära kontraktsslut.", "Åldrande, dyr nyckelspelare och klubbens ekonomi är pressad."] }
          : { decision: "RENEW", reasons: ["Nära kontraktsslut.", "Fortfarande för viktig för att släppas trots lönenivån."] };
      }
      return { decision: "WAIT", reasons: ["Dyr nyckelspelare och klubbens ekonomi är pressad -- avvaktar innan beslut."] };
    }
    return { decision: "RENEW", reasons: ["Nyckelspelare som fortfarande håller nivån.", "Ekonomin klarar en förlängning."] };
  }

  // --- TALENT ----------------------------------------------------------------
  // Part 5: real development value protects, tier label alone never does.
  if (inputs.tier === "TALENT") {
    const realPotential = inputs.paHeadroom >= TALENT_PA_HEADROOM_THRESHOLD && inputs.age !== null && inputs.age <= TALENT_PROTECT_AGE;
    if (realPotential && !overpaidForWait) {
      return { decision: "RENEW", reasons: ["Ung spelare med verklig utvecklingspotential (hög PA relativt nuvarande nivå).", "Lönen är rimlig."] };
    }
    if (positionWouldBeThin) {
      return { decision: "RENEW", reasons: ["Begränsad utvecklingsprofil, men positionen behöver honom just nu."] };
    }
    if (inputs.needIfLeavesSaturated || overpaidForWait) {
      if (!veryClose) return { decision: "WAIT", reasons: ["Oklar utvecklingsprofil -- avvaktar innan beslut."] };
      return { decision: "RELEASE", reasons: ["Begränsad potential och positionen klarar sig utan honom.", "Nära kontraktsslut."] };
    }
    return veryClose
      ? { decision: "RENEW", reasons: ["Nära kontraktsslut.", "Ingen tydlig anledning att släppa en ung spelare."] }
      : { decision: "WAIT", reasons: ["Oklar utvecklingsprofil -- avvaktar."] };
  }

  // --- FIRST_CHOICE / ROTATION / SQUAD_PLAYER -------------------------------
  // Part 4: the tier this milestone rebuilds the most -- decision now
  // follows actual projected squad need, never a bare tier default.
  if (positionWouldBeThin) {
    if (inputs.hasAgreedReplacement) {
      return { decision: "RELEASE", reasons: ["Positionen skulle bli tunn, men klubben har redan en överenskommen ersättare på väg in."] };
    }
    if (underPressure && overpaidForRelease) {
      return veryClose
        ? { decision: "RELEASE", reasons: ["Nära kontraktsslut.", "Lönen är orimlig för klubbens pressade ekonomi, trots tunn position."] }
        : { decision: "WAIT", reasons: ["Positionen skulle bli tunn, men lönen är hög och ekonomin pressad -- avvaktar."] };
    }
    return { decision: "RENEW", reasons: ["Positionen skulle bli tunn om han lämnar.", "Rimlig nivå för rollen till en hanterbar lön."] };
  }

  if (inputs.needIfLeavesSaturated) {
    const cheapAndUseful = !overpaidForWait && inputs.caVsClubAvg >= 0.9 && inputs.tier !== "SQUAD_PLAYER";
    if (cheapAndUseful) {
      return { decision: "RENEW", reasons: ["Billig och användbar spelare trots god positionsdjup."] };
    }
    return {
      decision: "RELEASE",
      reasons: [
        `Positionen har god djup även utan honom (alternativ ${inputs.positionRank}).`,
        overpaidForWait ? "Dessutom dyr relativt roll och nivå." : "Ingen tydlig anledning att behålla honom.",
      ],
    };
  }

  // MEDIUM zone -- normal depth, secondary factors (wage, level relative to club) decide.
  if (overpaidForRelease || (underPressure && overpaidForWait)) {
    if (!veryClose) return { decision: "WAIT", reasons: ["Dyr relativt roll och nivå -- avvaktar innan beslut."] };
    return { decision: "RELEASE", reasons: ["Nära kontraktsslut.", "Dyr relativt roll och nivå, och positionen tål avgången."] };
  }
  if (inputs.caVsClubAvg >= 1.0 && !overpaidForWait) {
    return { decision: "RENEW", reasons: ["Håller klubbens egen nivå till en rimlig lön."] };
  }
  if (!veryClose) {
    return { decision: "WAIT", reasons: ["Varken tydlig lucka eller tydligt överflöd på positionen -- avvaktar."] };
  }
  return inputs.tier === "SQUAD_PLAYER"
    ? { decision: "RELEASE", reasons: ["Nära kontraktsslut.", "Osäkert läge och rollen är den lägst prioriterade tiern."] }
    : { decision: "RENEW", reasons: ["Nära kontraktsslut.", "Ingen tydlig anledning att släppa en ordinarie spelare."] };
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
/** HM-CPU-SQUAD-BUILDING-1.0B Part 9 / HM-CPU-CONTRACT-DECISIONS-1.1: the 1.0A audit found ~23,800 WAIT log rows for one run -- the same stable no-op decision re-logged every single day for as long as a player sits in the EXPIRING_SOON window (up to 365 days). RENEW is a real, self-limiting mutation (pushes the player out of the window) and is always logged immediately. WAIT and RELEASE are both pure no-ops on CareerState -- neither removes the player from tomorrow's evaluation on its own -- so both are throttled to this periodic checkpoint instead of daily. Decision LOGIC itself is unchanged -- this only throttles how often an unchanged verdict gets written down. */
const NO_ACTION_LOG_REVIEW_INTERVAL_DAYS = 30;

/** HM-CPU-CONTRACT-DECISIONS-1.1 Part 10: simple age modulation on top of the existing per-tier baseline -- younger key/talent players get a slightly longer commitment, older players a shorter one. Never arbitrary: bounded to [1, 4] years, and the baseline table itself is untouched. */
function renewalYears(tier: SquadStatusTier, age: number | null): number {
  let years = RENEWAL_YEARS_BY_TIER[tier] ?? DEFAULT_RENEWAL_YEARS;
  if (age !== null) {
    if (age <= 23 && (tier === "KEY_PLAYER" || tier === "TALENT")) years += 1;
    else if (age >= OLD_AGE_THRESHOLD) years -= 1;
  }
  return Math.max(1, Math.min(4, years));
}

/** Average CA across `players` from `clubId`'s own gameplayRatings -- same small helper cpuSquadNeeds.ts keeps private for its own quality-adjustment rule; duplicated here (a few lines) rather than exported, since the two use slightly different player sets (usable squad here vs. positionPlayers there) and neither needs the other's shape. */
function averageCA(state: CareerState, clubId: string, players: readonly PlayerMock[]): number | null {
  const ratings = state.gameplayRatings[clubId];
  if (!ratings || players.length === 0) return null;
  const ratingById = new Map(ratings.map((r) => [r.playerId, r.ca]));
  const cas = players.map((p) => ratingById.get(p.id)).filter((v): v is number => v !== undefined);
  if (cas.length === 0) return null;
  return cas.reduce((sum, v) => sum + v, 0) / cas.length;
}

function isUsable(state: CareerState, player: PlayerMock): boolean {
  return state.playerStatuses[player.id]?.availability !== "ON_PLACEMENT";
}

/** 1-indexed CA rank of `player` among `clubId`'s own usable players at `player.position` (1 = best), plus the real CA gap to whoever IS best (0 when this player already is). Ties broken by playerId for determinism. */
function positionStanding(state: CareerState, clubId: string, player: PlayerMock, positionPeers: readonly PlayerMock[]): { rank: number; caGapToBest: number } {
  const ratings = state.gameplayRatings[clubId];
  const caOf = (p: PlayerMock) => ratings?.find((r) => r.playerId === p.id)?.ca ?? p.currentAbility;
  const ownCA = caOf(player);
  const sorted = [...positionPeers].sort((a, b) => caOf(b) - caOf(a) || a.id.localeCompare(b.id));
  const index = sorted.findIndex((p) => p.id === player.id);
  const bestCA = sorted.length > 0 ? caOf(sorted[0]) : ownCA;
  const rank = index === -1 ? sorted.filter((p) => caOf(p) > ownCA).length + 1 : index + 1;
  return { rank, caGapToBest: Math.max(0, bestCA - ownCA) };
}

/**
 * Part: dailyTick integration -- cheap (pure filtering + a handful of
 * lookups per player), so unlike the recruitment search this runs for
 * every CPU club every day; only players whose contract has just crossed
 * into EXPIRING_SOON/EXPIRING territory are evaluated at all (Economy
 * 1.0's own status thresholds). RENEW pushes the contract OUT of that
 * window (a later end date) so a renewed player is naturally never
 * re-evaluated again. WAIT/RELEASE are both pure no-ops on CareerState
 * (Part 11: RELEASE never mutates contractEndDate, unchanged from 1.0) --
 * the SAME player is re-decided every time this runs, deterministically
 * reaching the same outcome as long as their inputs (tier/age/wage/
 * depth/pressure/expiry proximity) don't change. The actual departure,
 * once the contract genuinely reaches its own real end date, is
 * contractExpiry.ts's job, not this function's. Never called for
 * `state.playerClubId` (Part 15: "Human-controlled club får aldrig
 * styras av detta").
 */
export function progressCpuContractDecisions(state: CareerState, date: string, cpuClubIds: readonly string[]): { state: CareerState; log: CpuContractDecisionLogEntry[] } {
  let next = state;
  const log: CpuContractDecisionLogEntry[] = [];

  for (const clubId of cpuClubIds) {
    if (clubId === state.playerClubId) continue;
    const squad = (next.worldSquads[clubId] ?? []).filter((p) => isUsable(next, p));
    for (const player of squad) {
      const status = getPlayerContractStatus(next, player.id);
      if (status !== "EXPIRING_SOON" && status !== "EXPIRING") continue;
      const contract = getPlayerContract(next, player.id);
      if (!contract) continue;

      const tier = deriveDefaultSquadStatusTier(player);
      const age = playerAgeAtDate(player.dateOfBirth, player.birthYear, date);
      const rating = getCareerPlayerRating(next, player.id, clubId);
      const ca = rating?.ca ?? player.currentAbility;
      const pa = rating?.pa ?? player.potentialAbility;
      const fairWage = getPlayerFairWageEurPerMonth(next, player.id) ?? contract.wageEurPerMonth;
      const financialPressure = getClubFinancialHealth(next, clubId)?.pressure ?? "NONE";

      const positionPeers = squad.filter((p) => p.position === player.position);
      const clubAvgCA = averageCA(next, clubId, squad);
      const squadWithoutPlayer = squad.filter((p) => p.id !== player.id);
      const needIfLeaves = assessPositionNeed(next, clubId, player.position, squadWithoutPlayer);
      const standing = positionStanding(next, clubId, player, positionPeers);

      const { decision, reasons } = decideContractAction({
        tier,
        age,
        ca,
        paHeadroom: Math.max(0, pa - ca),
        positionRank: standing.rank,
        caGapToPositionBest: standing.caGapToBest,
        caVsClubAvg: clubAvgCA && clubAvgCA > 0 ? ca / clubAvgCA : 1,
        wageEurPerMonth: contract.wageEurPerMonth,
        fairWageEurPerMonth: fairWage,
        financialPressure,
        daysUntilExpiry: daysUntilContractEnd(contract.contractEndDate, date),
        needIfLeaves: needIfLeaves.level,
        needIfLeavesSaturated: needIfLeaves.saturated,
        hasAgreedReplacement: needIfLeaves.pendingIncoming > 0,
      });
      const reason = reasons.join(" ");

      if (decision === "RENEW") {
        // The one real, self-limiting mutation: a new contract that pushes
        // the player OUT of the EXPIRING_SOON/EXPIRING window, so they are
        // naturally never re-evaluated tomorrow. Always logged immediately.
        //
        // HM-CPU-SQUAD-RESILIENCE-1.0 correctness fix: computeNewContractEndDate's
        // OWN anchor (its `gameDate` param -- correct for a FRESH signing,
        // where there is no prior contract to extend) must NOT be today's
        // `date` here -- it must be the EXISTING contract's own end-date
        // year. A renewal extends FROM where the contract already ends, not
        // from today's calendar year. Passing `date` made a short (1-year)
        // renewal evaluated any time after 1 June compute a fallback year
        // that could equal -- or even predate -- the contract's own
        // already-later end date, making the "renewal" a silent no-op: the
        // 5-year world-stability re-audit caught this directly (the same
        // playerId logged as RENEW on every single day for months, because
        // contractEndDate never actually moved and the player never left
        // the EXPIRING_SOON window).
        const years = renewalYears(tier, age);
        const newEndDate = computeNewContractEndDate(player.id, contract.contractEndDate, years);
        next = { ...next, playerContracts: { ...next.playerContracts, [player.id]: { ...contract, contractEndDate: newEndDate } } };
        log.push({ playerId: player.id, clubId, position: player.position, decision, reason });
      } else if (daysUntilContractEnd(contract.contractEndDate, date) % NO_ACTION_LOG_REVIEW_INTERVAL_DAYS === 0) {
        // HM-CPU-CONTRACT-DECISIONS-1.1: RELEASE is still a pure no-op on
        // CareerState (Part 11, unchanged from 1.0 -- the player plays out
        // their real contract until contractExpiry.ts's own world rule
        // actually moves them), and WAIT is a genuine "still uncertain"
        // outcome (Part 12) -- BOTH are stable/deterministic for as long
        // as their inputs don't change, so unlike RENEW (a real, self-
        // limiting mutation) they would otherwise re-log identically every
        // single day for the rest of the EXPIRING_SOON/EXPIRING window
        // (Part 1: "Ingen daglig full decision spam" -- the exact 1.0B
        // WAIT-spam finding, which now applies to a recurring RELEASE
        // verdict too since RELEASE never removes the player from
        // evaluation on its own). Throttled to the same periodic
        // checkpoint as WAIT always used.
        log.push({ playerId: player.id, clubId, position: player.position, decision, reason });
      }
    }
  }

  return { state: next, log };
}
