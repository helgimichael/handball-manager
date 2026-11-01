// HM-ALPHA2-05A: pure two-stage negotiation rules -- the selling club
// haggles over the fee, then the player haggles over wage, contract
// length and squad role. No acceptance percentages: every response is a
// threshold comparison against a demand derived from existing facts
// (clubDecision.ts's own asking price, contractIntegration.ts's fair
// wage, the player's current wage/tier/role/age). The only variance is
// a small deterministic per-player offset on the wage DEMAND (same
// seededOffset precedent as playerDecision.ts), never on the decision.
// CareerState glue lives in negotiationIntegration.ts.
import { seededOffset } from "../rating/generation/deterministicVariation";
import { SQUAD_STATUS_TIERS, SQUAD_STATUS_TIER_LABEL_SV, type SquadStatusTier } from "../career/squadStatus";
import type { FinancialPressureLevel } from "../economy/clubEconomyTypes";
import type { SquadStatus } from "../game-data";
import type { NegotiationResponse } from "./types";

/** A club states its price after this many fee rounds; a third miss ends talks. */
export const MAX_CLUB_ROUNDS = 3;
/** A player gives the manager this many attempts at acceptable terms. */
export const MAX_PLAYER_ROUNDS = 3;
/** Days a selling club / player refuses a fresh approach after breaking off. */
export const NEGOTIATION_COOLDOWN_DAYS = 30;
/** HM-ALPHA2-05B: days the manager has to answer a counter (or to settle terms after a fee is agreed). */
export const RESPONSE_WINDOW_DAYS = 7;
/** HM-ALPHA2-05B: at most this many CPU clubs compete for one negotiated player. */
export const MAX_RIVALS = 2;

/**
 * HM-ALPHA2-05B: how long a club / player takes to answer -- 1-3 days,
 * a fixed per-negotiation-round value (seeded, never rerolled). Timing
 * only; it never changes WHAT the answer is.
 */
export function responseDelayDays(seedKey: string): number {
  return 2 + seededOffset(`${seedKey}:response-delay`, 1);
}

/** HM-ALPHA2-05B: when a rival club makes its move -- 3-9 days after talks open. */
export function rivalDecisionDelayDays(seedKey: string): number {
  return 6 + seededOffset(`${seedKey}:rival-delay`, 3);
}

/** Below this share of the asking price the bid is treated as an insult and talks end at once. */
const CLUB_INSULT_RATIO = 0.5;
/** At or above this share the club answers with its price; between the two it simply says no. */
const CLUB_COUNTER_RATIO = 0.75;
/** At or above this share of the demand the player states their wage; below it they just decline. */
const PLAYER_COUNTER_RATIO = 0.8;

export interface NegotiationRoundResult {
  response: NegotiationResponse;
  reason: string;
  counterFeeEur?: number;
  counterWageEurPerMonth?: number;
}

/** Rounds up to a clean figure a club/agent would actually say out loud. */
function roundUp(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

export function roundAskingFeeEur(askingFeeEur: number): number {
  return roundUp(askingFeeEur, 500);
}

export interface ClubFeeRoundInputs {
  askingFeeEur: number;
  offeredFeeEur: number;
  /** 1-based number of THIS round. */
  round: number;
  /** The manager's previous fee bid in this negotiation, if any. */
  previousOfferEur?: number;
  /** HM-ALPHA2-05B: the best fee an active rival club has on the table -- the club will not take less from the manager. */
  rival?: { clubName: string; feeEur: number };
}

/**
 * ACCEPT at/above the asking price; an insulting bid (<50%) ends talks;
 * a bid that does not improve on the last one is a plain REJECT; a
 * serious bid (>=75%) gets the club's price as a COUNTER. Running out of
 * rounds ends talks -- the club will not haggle forever.
 */
export function evaluateClubFeeRound(inputs: ClubFeeRoundInputs): NegotiationRoundResult {
  const rivalSetsPrice = inputs.rival !== undefined && inputs.rival.feeEur > inputs.askingFeeEur;
  const floorEur = rivalSetsPrice ? inputs.rival!.feeEur : inputs.askingFeeEur;
  const asking = roundAskingFeeEur(floorEur);
  const offered = Math.max(0, Math.round(inputs.offeredFeeEur));
  if (offered >= floorEur) {
    return { response: "ACCEPT", reason: `Klubben accepterar ${offered} €.` };
  }
  if (rivalSetsPrice && offered >= asking * CLUB_INSULT_RATIO && inputs.round < MAX_CLUB_ROUNDS) {
    return { response: "COUNTER", reason: `${inputs.rival!.clubName} har bjudit mer -- klubben vill ha minst ${asking} €.`, counterFeeEur: asking };
  }
  if (offered < asking * CLUB_INSULT_RATIO) {
    return { response: "BREAK_OFF", reason: `Budet (${offered} €) uppfattas som respektlöst -- klubben avbryter samtalen.` };
  }
  if (inputs.round >= MAX_CLUB_ROUNDS) {
    return { response: "BREAK_OFF", reason: `Klubben har tröttnat efter ${inputs.round} bud under ${asking} € och avbryter samtalen.` };
  }
  if (inputs.previousOfferEur !== undefined && offered <= inputs.previousOfferEur) {
    return { response: "REJECT", reason: "Budet är inte högre än förra gången -- klubben ser ingen rörelse.", counterFeeEur: asking };
  }
  if (offered >= asking * CLUB_COUNTER_RATIO) {
    return { response: "COUNTER", reason: `Klubben vill ha ${asking} € för att släppa spelaren.`, counterFeeEur: asking };
  }
  return { response: "REJECT", reason: "Budet ligger för långt från klubbens värdering för ett motbud." };
}

const TIER_RANK: Record<SquadStatusTier, number> = Object.fromEntries(SQUAD_STATUS_TIERS.map((t, i) => [t, i])) as Record<SquadStatusTier, number>;

export interface PlayerWageDemandInputs {
  playerId: string;
  age: number | null;
  isFreeAgent: boolean;
  currentWageEurPerMonth: number;
  /** contractIntegration.ts's own role/CA/age-driven baseline. */
  fairWageEurPerMonth: number;
  currentClubTier: 1 | 2 | undefined;
  newClubTier: 1 | 2 | undefined;
  currentSquadStatus: SquadStatus;
  currentClubPressure: FinancialPressureLevel;
  /** HM-ALPHA2-05B: the BUYING club's financial state -- a shaky club must pay a risk premium. */
  newClubPressure?: FinancialPressureLevel;
  /** The role the player believes their quality earns at the buying club. */
  expectedRole: SquadStatusTier;
  promisedRole: SquadStatusTier;
  contractYears: number;
}

export interface PlayerWageDemand {
  demandEurPerMonth: number;
  /** True when the promised role is so far below expectation that no wage compensates. */
  refusesRole: boolean;
  factors: string[];
}

/**
 * What the player asks for. Under contract they want a raise on their
 * current wage (moving is a disruption); a free agent has no leverage
 * and asks roughly market rate. Moving down a league, being promised a
 * smaller role than their quality earns, or a contract length that
 * does not suit their age all push the demand up.
 */
export function computePlayerWageDemand(inputs: PlayerWageDemandInputs): PlayerWageDemand {
  const factors: string[] = [];
  let demand = inputs.isFreeAgent ? inputs.fairWageEurPerMonth * 0.95 : Math.max(inputs.currentWageEurPerMonth * 1.1, inputs.fairWageEurPerMonth);

  const currentTier = inputs.currentClubTier ?? 2;
  const newTier = inputs.newClubTier ?? 2;
  if (newTier > currentTier) {
    demand *= 1.15;
    factors.push("Kräver kompensation för att gå till en lägre serie.");
  } else if (newTier < currentTier) {
    demand *= 0.92;
    factors.push("Lockas av en högre serie.");
  }

  const roleGap = TIER_RANK[inputs.promisedRole] - TIER_RANK[inputs.expectedRole];
  const refusesRole = roleGap >= 3;
  if (roleGap > 0) {
    demand *= 1 + 0.12 * roleGap;
    factors.push("Den utlovade rollen är mindre än spelaren anser sig förtjäna.");
  } else if (roleGap < 0) {
    demand *= Math.pow(0.97, Math.min(2, -roleGap));
    factors.push("Uppskattar en större roll än väntat.");
  }

  if (inputs.age !== null && inputs.age >= 30 && inputs.contractYears < 2) {
    demand *= 1.1;
    factors.push("Vill ha trygghet i ett längre avtal.");
  } else if (inputs.age !== null && inputs.age <= 23 && inputs.contractYears > 4) {
    demand *= 1.08;
    factors.push("Vill inte binda sig för länge i början av karriären.");
  }

  if (inputs.currentSquadStatus === "Rotation" || inputs.currentSquadStatus === "Ungdom") {
    demand *= 0.95;
    factors.push("Vill ha mer speltid än i nuvarande klubb.");
  }
  if (inputs.currentClubPressure === "SERIOUS" || inputs.currentClubPressure === "CRITICAL") {
    demand *= 0.93;
    factors.push("Nuvarande klubb har ekonomiska problem.");
  }
  if (inputs.newClubPressure === "SERIOUS" || inputs.newClubPressure === "CRITICAL") {
    demand *= 1.06;
    factors.push("Vill ha betalt för risken i en klubb med ansträngd ekonomi.");
  }

  demand *= 1 + seededOffset(`${inputs.playerId}:negotiation:wage-demand`, 5) / 100;
  return { demandEurPerMonth: roundUp(Math.max(0, demand), 10), refusesRole, factors };
}

export interface PlayerTermsRoundInputs {
  demand: PlayerWageDemand;
  offeredWageEurPerMonth: number;
  round: number;
  /**
   * HM-ALPHA2-05B: the most attractive active rival package, as its wage
   * over what the player would demand AT THAT CLUB (>1 = better than the
   * player needs there). To win, the manager must match that same margin
   * against their own demand; a tie goes to the club already in talks.
   */
  rival?: { clubName: string; packageRatio: number };
}

/** The ratio a package scores: offered wage over the player's demand for exactly those terms. */
export function packageRatio(offeredWageEurPerMonth: number, demand: PlayerWageDemand): number {
  if (demand.refusesRole || demand.demandEurPerMonth <= 0) return 0;
  return offeredWageEurPerMonth / demand.demandEurPerMonth;
}

export function evaluatePlayerTermsRound(inputs: PlayerTermsRoundInputs): NegotiationRoundResult {
  const rivalBeats = inputs.rival !== undefined && inputs.rival.packageRatio > 1;
  const demand: PlayerWageDemand = rivalBeats
    ? { ...inputs.demand, demandEurPerMonth: roundUp(inputs.demand.demandEurPerMonth * inputs.rival!.packageRatio, 10), factors: [...inputs.demand.factors, `Har ett bättre erbjudande från ${inputs.rival!.clubName}.`] }
    : inputs.demand;
  const offered = Math.max(0, Math.round(inputs.offeredWageEurPerMonth));
  if (!demand.refusesRole && offered >= demand.demandEurPerMonth) {
    return { response: "ACCEPT", reason: "Spelaren accepterar villkoren." };
  }
  if (inputs.round >= MAX_PLAYER_ROUNDS) {
    return { response: "BREAK_OFF", reason: "Spelaren har tappat intresset efter flera otillräckliga erbjudanden." };
  }
  if (demand.refusesRole) {
    return { response: "REJECT", reason: "Spelaren vägrar en så liten roll oavsett lön." };
  }
  if (offered >= demand.demandEurPerMonth * PLAYER_COUNTER_RATIO) {
    return { response: "COUNTER", reason: rivalBeats ? `Spelaren vill ha ${demand.demandEurPerMonth} €/mån för att välja er framför ${inputs.rival!.clubName}.` : `Spelaren vill ha ${demand.demandEurPerMonth} €/mån.`, counterWageEurPerMonth: demand.demandEurPerMonth };
  }
  return { response: "REJECT", reason: "Lönen ligger långt under spelarens förväntningar." };
}

/**
 * The role a player believes they would earn at the buying club, from
 * where their ability ranks in that squad: top 3 key players, top 7
 * first choice, top 12 rotation; below that a young player sees
 * themselves as a talent, an established one as squad depth.
 */
export function expectedRoleFromSquadRank(rank: number, age: number | null): SquadStatusTier {
  if (rank < 3) return "KEY_PLAYER";
  if (rank < 7) return "FIRST_CHOICE";
  if (rank < 12) return "ROTATION";
  return age !== null && age <= 21 ? "TALENT" : "SQUAD_PLAYER";
}

// ---------------------------------------------------------------------------
// HM-ALPHA2-05C: loan negotiation -- the borrowing club negotiates the wage
// share and length with the OWNING club, then a playing role with the
// player. Ownership and the contract itself are never on the table.
// ---------------------------------------------------------------------------

export interface LoanShareRoundInputs {
  /** clubDecision.ts's computeRequiredLoanWageSharePct -- null: the owner will not lend at all. */
  requiredSharePct: number | null;
  offeredSharePct: number;
  round: number;
  previousOfferPct?: number;
}

export function evaluateLoanShareRound(inputs: LoanShareRoundInputs): NegotiationRoundResult {
  if (inputs.requiredSharePct === null) {
    return { response: "BREAK_OFF", reason: "Klubben behöver spelaren själv och lånar inte ut honom." };
  }
  const offered = Math.max(0, Math.min(100, Math.round(inputs.offeredSharePct)));
  if (offered >= inputs.requiredSharePct) {
    return { response: "ACCEPT", reason: `Klubben accepterar lånet med ${offered}% av lönen betald av er.` };
  }
  if (inputs.round >= MAX_CLUB_ROUNDS) {
    return { response: "BREAK_OFF", reason: "Klubben har tröttnat på förhandlingen och avbryter samtalen." };
  }
  if (inputs.previousOfferPct !== undefined && offered <= inputs.previousOfferPct) {
    return { response: "REJECT", reason: "Lönebidraget är inte högre än förra gången." };
  }
  return { response: "COUNTER", reason: `Klubben vill att ni betalar minst ${inputs.requiredSharePct}% av lönen.` };
}

const LOAN_TIER_RANK: Record<SquadStatusTier, number> = TIER_RANK;

/**
 * A loaned player wants to PLAY: a promised role at most one step below
 * what their quality earns at the borrowing club is accepted; two steps
 * below gets a counter naming the role they want; further below is a no.
 */
export function evaluateLoanPlayerRound(inputs: { expectedRole: SquadStatusTier; promisedRole: SquadStatusTier; round: number }): NegotiationRoundResult & { wantedRole?: SquadStatusTier } {
  const gap = LOAN_TIER_RANK[inputs.promisedRole] - LOAN_TIER_RANK[inputs.expectedRole];
  if (gap <= 1) return { response: "ACCEPT", reason: "Spelaren ser fram emot speltid hos er." };
  if (inputs.round >= MAX_PLAYER_ROUNDS) return { response: "BREAK_OFF", reason: "Spelaren tror inte på speltid hos er och avböjer lånet." };
  const wantedRole = SQUAD_STATUS_TIERS[LOAN_TIER_RANK[inputs.expectedRole] + 1];
  if (gap === 2) return { response: "COUNTER", reason: `Spelaren vill ha minst rollen ${SQUAD_STATUS_TIER_LABEL_SV[wantedRole].toLowerCase()} för att komma.`, wantedRole };
  return { response: "REJECT", reason: "Spelaren vill inte lånas ut för att sitta på bänken." };
}
