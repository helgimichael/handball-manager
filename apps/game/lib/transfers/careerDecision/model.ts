// HM-TRANSFER-REALISM-1.0 M2: Player Career Decision Model (PCDM) -- the pure core.
//
// The ONE place a player's willingness is computed. Every transfer flow
// (CPU bids, the manager's negotiations, rival bids, incoming offers,
// pre-contracts, renewals, free agency, the international market) builds a
// PlayerCareerProfile + ClubOption(s) + MarketContext through stateAdapter.ts
// and asks this module. Nothing here reads CareerState: every function is a
// pure, deterministic function of its arguments.
//
// Shape of a decision:
//   U(option)  = sum_i w_i * c_i(option)       each component c_i in about [-1.6, 1]
//   R          = reservation utility: the best of staying, renewing, waiting
//                and a credible international alternative
//   accept     <=> U(option) > R + margin + personal jitter
//
// The weights w come from a CONTINUOUS blend of eight career profiles (no
// age switch flips behaviour), the money component is logarithmic and
// saturating, and a soft sporting floor caps how much money may offset a big
// sporting step down -- a cap that depends on the profile and dissolves at
// the very end of a career. No player-specific rule exists anywhere.
import type { SquadStatusTier } from "../../career/squadStatus";
import type { FinancialPressureLevel } from "../../economy/clubEconomyTypes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const COMPONENTS = ["sport", "role", "money", "security", "personal", "stability", "development"] as const;
export type Component = (typeof COMPONENTS)[number];
export type Weights = Record<Component, number>;

export interface PlayerCareerProfile {
  playerId: string;
  ca: number;
  pa: number;
  age: number;
  /** Share of the world's rated players below this CA (0..1). */
  worldPercentile: number;
  ambition: number; // 1-20
  loyalty: number; // 1-20
  nationality: string;
  /** Reference monthly wage for "what is this money worth to me": never 0. */
  referenceWageEurPerMonth: number;
  /** Profile memberships (0..1) the weights were blended from -- exposed for explanation and tests. */
  memberships: Record<ProfileKind, number>;
  weights: Weights;
  /** 0..1: how hard the sporting floor bites (world-class/ambitious high, end of career 0). */
  floorStrength: number;
}

export interface ClubOption {
  clubId: string;
  /** Environment level the player would play in (club + league), CA scale. */
  environmentLevel: number;
  /** Expected (or promised) role. */
  role: SquadStatusTier;
  /** Effective monthly wage (bonus spread over the contract). */
  wageEurPerMonth: number;
  contractYears: number;
  pressure: FinancialPressureLevel;
  isHomeCountry: boolean;
  isFormerClub: boolean;
  /** The club the player is at now: staying carries his loyalty. */
  isCurrentClub: boolean;
}

export interface MarketContext {
  /** Option of staying under the current contract (absent for a free agent / an expiring contract with no renewal on the table). */
  stay?: ClubOption;
  /** The best credible international alternative the abstract international market would actually offer. */
  internationalAlternative?: ClubOption;
  /** Market level a free agent / out-of-contract player can credibly expect to find by waiting (CA scale). */
  waitLevel: number;
  /** The role he can expect at such a club (default FIRST_CHOICE). */
  waitRole?: SquadStatusTier;
  /** Months without a club (0 when under contract). */
  monthsUnattached: number;
  /** True when the player is looking for a contract (free agent or final contract months). */
  openMarket: boolean;
  /** The player has asked to leave: staying is worth less to him. */
  wantsToLeave?: boolean;
}

export interface OptionEvaluation {
  utility: number;
  components: Record<Component, number>;
  /** Weighted contributions after the sporting floor. */
  contributions: Record<Component, number>;
  floorApplied: boolean;
}

export interface Reservation {
  utility: number;
  source: "STAY" | "WAIT" | "INTERNATIONAL";
}

export interface CareerDecision {
  accept: boolean;
  utility: number;
  reservation: Reservation;
  threshold: number;
  evaluation: OptionEvaluation;
}

// ---------------------------------------------------------------------------
// Profiles: eight archetypes, blended continuously
// ---------------------------------------------------------------------------

export const PROFILE_KINDS = ["WORLD_CLASS", "ESTABLISHED_ELITE", "AMBITIOUS", "YOUNG_TALENT", "DEVELOPMENT", "ROTATION", "VETERAN", "CAREER_END"] as const;
export type ProfileKind = (typeof PROFILE_KINDS)[number];

const W = (sport: number, role: number, money: number, security: number, personal: number, stability: number, development: number): Weights => ({ sport, role, money, security, personal, stability, development });

/** Archetype weight vectors (audit §10), each summing to 1. */
export const PROFILE_WEIGHTS: Readonly<Record<ProfileKind, Weights>> = {
  WORLD_CLASS: W(0.45, 0.1, 0.25, 0.05, 0.05, 0.1, 0),
  ESTABLISHED_ELITE: W(0.3, 0.2, 0.3, 0.05, 0.05, 0.1, 0),
  AMBITIOUS: W(0.38, 0.2, 0.25, 0.05, 0.02, 0.1, 0),
  YOUNG_TALENT: W(0.2, 0.2, 0.15, 0.05, 0.1, 0.05, 0.25),
  DEVELOPMENT: W(0.15, 0.25, 0.2, 0.1, 0.1, 0.05, 0.15),
  ROTATION: W(0.2, 0.25, 0.35, 0.1, 0.05, 0.05, 0),
  VETERAN: W(0.15, 0.15, 0.35, 0.2, 0.1, 0.05, 0),
  CAREER_END: W(0.05, 0.1, 0.35, 0.2, 0.25, 0.05, 0),
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** 0 at/below `from`, 1 at/beyond `to` (works for descending ranges too), smooth in between. */
export function smoothstep(from: number, to: number, x: number): number {
  const t = clamp01((x - from) / (to - from));
  return t * t * (3 - 2 * t);
}

export interface ProfileInputs {
  playerId: string;
  ca: number;
  pa: number;
  age: number;
  worldPercentile: number;
  ambition: number;
  loyalty: number;
  nationality: string;
  referenceWageEurPerMonth: number;
}

export function profileMemberships(i: Pick<ProfileInputs, "age" | "worldPercentile" | "ca" | "pa" | "ambition">): Record<ProfileKind, number> {
  const careerEnd = smoothstep(33, 36, i.age);
  const veteran = smoothstep(29.5, 32.5, i.age) * (1 - careerEnd);
  const young = smoothstep(24, 19.5, i.age);
  const headroom = smoothstep(4, 18, i.pa - i.ca);
  const prime = (1 - young) * (1 - veteran) * (1 - careerEnd);
  return {
    WORLD_CLASS: smoothstep(0.9, 0.98, i.worldPercentile) * (1 - careerEnd),
    ESTABLISHED_ELITE: smoothstep(0.6, 0.85, i.worldPercentile) * prime,
    AMBITIOUS: clamp01((i.ambition - 10) / 8) * prime,
    YOUNG_TALENT: young * headroom,
    DEVELOPMENT: young * (1 - headroom),
    ROTATION: (1 - smoothstep(0.45, 0.8, i.worldPercentile)) * prime,
    VETERAN: veteran,
    CAREER_END: careerEnd,
  };
}

export function blendWeights(memberships: Record<ProfileKind, number>): Weights {
  const out = W(0, 0, 0, 0, 0, 0, 0);
  // A permanent base share of the established profile keeps the blend defined and smooth everywhere.
  const parts: [number, Weights][] = [[0.35, PROFILE_WEIGHTS.ESTABLISHED_ELITE], ...PROFILE_KINDS.map((k) => [memberships[k], PROFILE_WEIGHTS[k]] as [number, Weights])];
  const total = parts.reduce((a, [m]) => a + m, 0);
  for (const [m, w] of parts) for (const c of COMPONENTS) out[c] += (m / total) * w[c];
  return out;
}

/**
 * Floor for the reference wage: a player's sense of what money is worth never
 * starts from 0 (a free agent's recorded wage), always from at least a modest
 * professional contract.
 */
export const MIN_REFERENCE_WAGE_EUR = 200; // the economy's own minimum salary (marketValue.ts SALARY_MIN_EUR_PER_MONTH)

export function buildProfile(i: ProfileInputs): PlayerCareerProfile {
  const memberships = profileMemberships(i);
  const ambitionFactor = 0.75 + 0.25 * clamp01((i.ambition - 4) / 14);
  const eliteness = Math.max(memberships.WORLD_CLASS, 0.6 * smoothstep(0.75, 0.93, i.worldPercentile));
  const floorStrength = clamp01(eliteness * ambitionFactor * (1 - memberships.CAREER_END) * (1 - 0.5 * memberships.VETERAN));
  return {
    ...i,
    referenceWageEurPerMonth: Math.max(MIN_REFERENCE_WAGE_EUR, i.referenceWageEurPerMonth),
    memberships,
    weights: blendWeights(memberships),
    floorStrength,
  };
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/** Expected share of matches started for a role. */
export const ROLE_SHARE: Readonly<Record<SquadStatusTier, number>> = { KEY_PLAYER: 0.9, FIRST_CHOICE: 0.72, ROTATION: 0.45, SQUAD_PLAYER: 0.18, TALENT: 0.4 };

/**
 * Sporting fit: environment level vs the player's own level. Increasing in the
 * environment level everywhere; a step DOWN is steeper than a step up is
 * rewarding (loss aversion), and both saturate.
 */
export function sportComponent(environmentLevel: number, ca: number): number {
  const d = environmentLevel - ca + 6;
  return d >= 0 ? 0.8 * Math.tanh(d / 30) : -1.6 * Math.tanh(-d / 55);
}

export function roleComponent(role: SquadStatusTier): number {
  return Math.max(-1, Math.min(1, 2 * (ROLE_SHARE[role] - 0.55)));
}

/** Money utility per doubling of the wage, before saturation. */
export const MONEY_SENSITIVITY = 1.2;

/** Logarithmic and saturating; increasing in the wage. 0 at the reference wage. */
export function moneyComponent(wageEurPerMonth: number, referenceWageEurPerMonth: number): number {
  const ratio = Math.max(1e-6, wageEurPerMonth) / Math.max(1, referenceWageEurPerMonth);
  return Math.tanh(MONEY_SENSITIVITY * Math.log2(ratio));
}

export function securityComponent(contractYears: number, age: number): number {
  const wantsLength = smoothstep(27, 33, age); // older players value length
  const youngRestless = smoothstep(23, 20, age) * smoothstep(3, 5, contractYears) * 0.3;
  return wantsLength * Math.tanh((contractYears - 1.5) / 1.2) + (1 - wantsLength) * 0.15 * Math.tanh(contractYears - 1) - youngRestless;
}

export function personalComponent(option: Pick<ClubOption, "isHomeCountry" | "isFormerClub" | "isCurrentClub">, profile: Pick<PlayerCareerProfile, "age" | "loyalty">, playsAbroad: boolean): number {
  let v = 0;
  if (option.isHomeCountry && playsAbroad) v += 0.6 * (0.3 + 0.7 * smoothstep(27, 34, profile.age));
  if (option.isFormerClub) v += 0.4 * (0.4 + 0.6 * smoothstep(26, 33, profile.age));
  if (option.isCurrentClub) v += 0.6 * ((profile.loyalty - 10) / 10);
  return Math.max(-1, Math.min(1, v));
}

const STABILITY: Readonly<Record<FinancialPressureLevel, number>> = { NONE: 0.2, WATCH: 0.1, PRESSURED: -0.1, SERIOUS: -0.45, CRITICAL: -0.8 };

/**
 * Development: playing time, and an environment that challenges him (training
 * every day with better players is development too). The environment term is monotone (a better environment never
 * hurts development by itself -- a stronger squad costs minutes, which the role
 * already prices).
 */
export function developmentComponent(role: SquadStatusTier, environmentLevel: number, ca: number): number {
  const minutes = roleComponent(role);
  const environment = Math.tanh((environmentLevel - ca + 5) / 25);
  return 0.5 * minutes + 0.5 * environment;
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/** Floor tolerance in CA points below the player's own level before money is capped. */
export function floorToleranceCA(profile: Pick<PlayerCareerProfile, "floorStrength">): number {
  return 50 - 34 * profile.floorStrength; // world-class ambitious ~16, average ~50
}

export function evaluateCareerOption(profile: PlayerCareerProfile, option: ClubOption, playsAbroad = false): OptionEvaluation {
  const components: Record<Component, number> = {
    sport: sportComponent(option.environmentLevel, profile.ca),
    role: roleComponent(option.role),
    money: moneyComponent(option.wageEurPerMonth, profile.referenceWageEurPerMonth),
    security: securityComponent(option.contractYears, profile.age),
    personal: personalComponent(option, profile, playsAbroad),
    stability: STABILITY[option.pressure],
    development: developmentComponent(option.role, option.environmentLevel, profile.ca),
  };
  const contributions = {} as Record<Component, number>;
  for (const c of COMPONENTS) contributions[c] = profile.weights[c] * components[c];

  // Soft sporting floor: below the tolerance, money may offset at most a fraction of the sporting loss.
  let floorApplied = false;
  const deficit = profile.ca - option.environmentLevel - floorToleranceCA(profile);
  if (deficit > 0 && profile.floorStrength > 0 && contributions.money > 0) {
    const kappa = 1 - 0.75 * profile.floorStrength * smoothstep(0, 20, deficit);
    const cap = kappa * Math.abs(Math.min(0, contributions.sport));
    if (contributions.money > cap) {
      contributions.money = cap;
      floorApplied = true;
    }
  }
  const utility = COMPONENTS.reduce((a, c) => a + contributions[c], 0);
  return { utility, components, contributions, floorApplied };
}

/**
 * A club signing a player in the open market pays a little above his
 * reference wage (the old demand model's own "+10 % for a move"): what the
 * market can offer him by waiting is priced at that level.
 */
export const MARKET_MOVE_PREMIUM = 1.1;

/**
 * HM-TRANSFER-REALISM M8D: the longest contract a club offers at a given age.
 * A three-year deal for a 36-year-old (the CPU's old fixed offer) assumes a
 * career he does not have left; the cap shortens smoothly from 31.
 */
export function contractYearsCapForAge(age: number | null): number {
  if (age === null) return 3;
  if (age <= 28) return 4;
  if (age <= 30) return 3;
  if (age <= 32) return 2;
  return 1;
}

/** The role a player of `ca` can expect at a club of `clubLevel`: his ability relative to its best seven. */
export function roleForLevelGap(ca: number, clubLevel: number): SquadStatusTier {
  const gap = ca - clubLevel;
  if (gap >= 6) return "KEY_PLAYER";
  if (gap >= -5) return "FIRST_CHOICE";
  if (gap >= -13) return "ROTATION";
  return "SQUAD_PLAYER";
}

/** Cost of waiting: uncertainty plus time without a club, rising with age. */
export function waitCost(monthsUnattached: number, age: number): number {
  return 0.1 + 0.035 * monthsUnattached * (1 + 0.6 * smoothstep(28, 34, age));
}

/**
 * What the player has without this offer. Under contract: staying. In the open
 * market: the better of waiting for a club at his credible level and the best
 * concrete international alternative.
 */
export function reservationUtility(profile: PlayerCareerProfile, market: MarketContext, playsAbroad = false): Reservation {
  const candidates: Reservation[] = [];
  if (market.stay) {
    const stay = evaluateCareerOption(profile, market.stay, playsAbroad).utility - (market.wantsToLeave ? 0.3 : 0);
    candidates.push({ utility: stay + 0.03, source: "STAY" }); // a move is a disruption
  }
  if (market.openMarket) {
    const waitOption: ClubOption = {
      clubId: "",
      environmentLevel: market.waitLevel,
      role: market.waitRole ?? "FIRST_CHOICE",
      wageEurPerMonth: profile.referenceWageEurPerMonth * MARKET_MOVE_PREMIUM,
      contractYears: 2,
      pressure: "NONE",
      isHomeCountry: false,
      isFormerClub: false,
      isCurrentClub: false,
    };
    candidates.push({ utility: evaluateCareerOption(profile, waitOption, playsAbroad).utility - waitCost(market.monthsUnattached, profile.age), source: "WAIT" });
    if (market.internationalAlternative) {
      candidates.push({ utility: evaluateCareerOption(profile, market.internationalAlternative, playsAbroad).utility - 0.04, source: "INTERNATIONAL" });
    }
  }
  if (candidates.length === 0) return { utility: -1, source: "WAIT" };
  return candidates.reduce((best, c) => (c.utility > best.utility ? c : best));
}

export const DECISION_MARGIN = 0.02;

/** Fixed per-player variation (+/-0.03), never on the inputs, always the same for the same player. */
export function personalJitter(seed: number): number {
  return seed * 0.01;
}

export function decide(profile: PlayerCareerProfile, option: ClubOption, market: MarketContext, jitter = 0, playsAbroad = false): CareerDecision {
  const evaluation = evaluateCareerOption(profile, option, playsAbroad);
  const reservation = reservationUtility(profile, market, playsAbroad);
  const threshold = reservation.utility + DECISION_MARGIN + jitter;
  return { accept: evaluation.utility > threshold, utility: evaluation.utility, reservation, threshold, evaluation };
}

/** Best option, or null when none beats the reservation (stay / wait). */
export function chooseBetweenOptions(profile: PlayerCareerProfile, options: readonly ClubOption[], market: MarketContext, jitter = 0, playsAbroad = false): { choice: ClubOption | null; ranked: { option: ClubOption; decision: CareerDecision }[] } {
  const ranked = options
    .map((option) => ({ option, decision: decide(profile, option, market, jitter, playsAbroad) }))
    .sort((a, b) => b.decision.utility - a.decision.utility || (a.option.clubId < b.option.clubId ? -1 : 1));
  const best = ranked[0];
  return { choice: best && best.decision.accept ? best.option : null, ranked };
}

/** Smooth acceptance estimate for clubs deciding whom to approach. */
export function estimateAcceptance(profile: PlayerCareerProfile, option: ClubOption, market: MarketContext, jitter = 0, playsAbroad = false): number {
  const d = decide(profile, option, market, jitter, playsAbroad);
  return 1 / (1 + Math.exp(-(d.utility - d.threshold) / 0.04));
}

export const WAGE_SEARCH_MAX_MULTIPLE = 8;

/**
 * The lowest monthly wage that makes `option` acceptable (beats the
 * reservation, and `toBeat` when a rival package is on the table). `null`
 * when no wage can do it -- the sporting floor or the role rule it out.
 */
/**
 * Staying where he is carries no relocation, a known role and known
 * teammates: a renewal is weighed against the open market with this bonus.
 */
export const RENEWAL_CONTINUITY_BONUS = 0.06;

export function wageDemandFor(profile: PlayerCareerProfile, option: Omit<ClubOption, "wageEurPerMonth">, market: MarketContext, jitter = 0, toBeat?: number, playsAbroad = false): number | null {
  const reservation = reservationUtility(profile, market, playsAbroad);
  const target = Math.max(reservation.utility, toBeat ?? -Infinity) + DECISION_MARGIN + jitter;
  const at = (wage: number) => evaluateCareerOption(profile, { ...option, wageEurPerMonth: wage }, playsAbroad).utility;
  const ref = profile.referenceWageEurPerMonth;
  let lo = ref * 0.2;
  let hi = ref * WAGE_SEARCH_MAX_MULTIPLE;
  if (at(hi) <= target) return null;
  if (at(lo) > target) return Math.ceil(lo / 10) * 10;
  for (let i = 0; i < 18; i++) {
    const mid = Math.sqrt(lo * hi);
    if (at(mid) > target) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi / 10) * 10;
}

const COMPONENT_LABEL_SV: Readonly<Record<Component, [positive: string, negative: string]>> = {
  sport: ["Den sportsliga nivån lockar.", "Den sportsliga nivån är för låg för honom."],
  role: ["Rollen i laget lockar.", "Rollen är mindre än han vill ha."],
  money: ["De ekonomiska villkoren är bra.", "De ekonomiska villkoren räcker inte."],
  security: ["Kontraktslängden ger trygghet.", "Kontraktslängden passar honom inte."],
  personal: ["Han har en personlig koppling hit.", "Han trivs där han är."],
  stability: ["Klubben är stabil.", "Klubbens ekonomi oroar honom."],
  development: ["Miljön passar hans utveckling.", "Miljön hjälper inte hans utveckling."],
};

/** Human-readable reason from the components that decided it, never revealing CA. */
export function explainDecision(decision: CareerDecision, reservationOption?: OptionEvaluation): string {
  const ev = decision.evaluation;
  const deltas = COMPONENTS.map((c) => ({ c, d: ev.contributions[c] - (reservationOption?.contributions[c] ?? 0) }));
  if (decision.accept) {
    const top = deltas.filter((x) => x.d > 0).sort((a, b) => b.d - a.d)[0];
    return top ? `Spelaren tackar ja. ${COMPONENT_LABEL_SV[top.c][0]}` : "Spelaren tackar ja.";
  }
  if (ev.floorApplied) return "Spelaren tackar nej -- den sportsliga nivån är för låg, och pengar ändrar inte det.";
  const worst = deltas.filter((x) => x.d < 0).sort((a, b) => a.d - b.d)[0];
  const alt = decision.reservation.source === "INTERNATIONAL" ? " Han har bättre alternativ utomlands." : decision.reservation.source === "WAIT" ? " Han väntar hellre på ett bättre erbjudande." : " Han stannar hellre i sin nuvarande klubb.";
  return `Spelaren tackar nej. ${worst ? COMPONENT_LABEL_SV[worst.c][1] : ""}${alt}`.replace("  ", " ");
}
