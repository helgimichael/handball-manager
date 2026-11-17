// HM-TRANSFER-REALISM-1.0 M2/M3: CareerState -> PCDM. The only bridge every
// transfer flow uses to ask "would this player do this?". It derives
// everything (profile, options, market context) from the live career world;
// nothing here is persisted.
import { getCareerPlayer } from "../../career/careerWorld";
import type { CareerState } from "../../career/types";
import type { SquadStatusTier } from "../../career/squadStatus";
import { SQUAD_STATUS_TIERS } from "../../career/squadStatus";
import { playerAgeAtDate } from "../../development/developmentIntegration";
import { getPlayerContract, getPlayerContractStatus, getPlayerFairWageEurPerMonth } from "../../economy/contractIntegration";
import { getClubFinancialHealth } from "../../economy/clubEconomyIntegration";
import { getPlayerClubHistory } from "../../economy/clubHistoryIntegration";
import { personalityOf } from "../../players/dynamicsState";
import { seededOffset } from "../../rating/generation/deterministicVariation";
import { FREE_AGENT_CLUB_ID, RETIRED_CLUB_ID } from "../../career/contractExpiry";
import { getClub, type PlayerMock } from "../../game-data";
import { computePlayerMarketValueEur } from "../../economy/marketValue";
import { mapHandballPositionToMatchPlanPosition } from "../../matchPlan/careerSquadBridge";
import {
  buildProfile,
  chooseBetweenOptions,
  decide,
  estimateAcceptance,
  evaluateCareerOption,
  explainDecision,
  reservationUtility,
  wageDemandFor,
  type CareerDecision,
  type ClubOption,
  type MarketContext,
  type PlayerCareerProfile,
  MARKET_MOVE_PREMIUM,
  RENEWAL_CONTINUITY_BONUS,
  roleForLevelGap,
} from "./model";
import { clubLevelOf, clubNation, environmentLevelOf, strengthTable, worldPercentileOf, worldPoolClubIds } from "./sportingStrength";

/**
 * Club-side wage discipline (CPU clubs and the abstract international clubs):
 * a club pays a player at most this multiple of the larger of his current and
 * his market wage. Above it the club lets him go rather than break its wage
 * structure; the player decides on what the club does offer.
 */
export const CLUB_WAGE_CAP_MULTIPLE = 1.3;

/**
 * A renewal raise a club will give, relative to the player's CURRENT wage. The
 * club economy is calibrated on renewals that keep wages roughly flat; a
 * player who needs more than this to stay goes to the market instead.
 */
export const CLUB_RENEWAL_RAISE_CAP = 1.1;

export function clubRenewalWageCap(state: CareerState, playerId: string): number {
  const current = getPlayerContract(state, playerId)?.wageEurPerMonth ?? 0;
  return Math.round((current * CLUB_RENEWAL_RAISE_CAP) / 10) * 10;
}

export function clubWageCap(state: CareerState, playerId: string): number {
  const profile = playerCareerProfile(state, playerId);
  return Math.round(((profile?.referenceWageEurPerMonth ?? 0) * CLUB_WAGE_CAP_MULTIPLE) / 10) * 10;
}

export interface OfferTerms {
  wageEurPerMonth: number;
  contractYears: number;
  signingBonusEur?: number;
  promisedRole?: SquadStatusTier;
}

/** The international market's capacity per world-pool club (they hold a slice of a real squad, not a full one). */
export const INTERNATIONAL_SQUAD_CAPACITY = 10;
/** A world-pool club wants a player who would at least be close to its own level... */
export const INTERNATIONAL_FIT_BELOW_CA = 14;
/** ...and who is not long past his career. */
export const INTERNATIONAL_MAX_AGE = 34;

// ---------------------------------------------------------------------------
// Memoisation: one world (ratings/squads/contracts/date identity) at a time.
// ---------------------------------------------------------------------------
let memoWorld: { ratings: unknown; squads: unknown; contracts: unknown; date: string; market: unknown } | undefined;
const profileMemo = new Map<string, PlayerCareerProfile | null>();
const marketMemo = new Map<string, MarketContext>();
const pressureMemo = new Map<string, ClubOption["pressure"]>();
const caMemo = new Map<string, { ca: number; pa: number } | null>();
let playerIndex: Map<string, PlayerMock> | undefined;
let memoEconomies: unknown;
function memoCheck(state: CareerState): void {
  if (memoWorld && memoWorld.ratings === state.gameplayRatings && memoWorld.squads === state.worldSquads && memoWorld.contracts === state.playerContracts && memoWorld.date === state.gameDate && memoWorld.market === state.transferMarket) {
    if (memoEconomies !== state.clubEconomies) {
      memoEconomies = state.clubEconomies;
      pressureMemo.clear();
      marketMemo.clear();
    }
    return;
  }
  memoWorld = { ratings: state.gameplayRatings, squads: state.worldSquads, contracts: state.playerContracts, date: state.gameDate, market: state.transferMarket };
  memoEconomies = state.clubEconomies;
  profileMemo.clear();
  marketMemo.clear();
  pressureMemo.clear();
  caMemo.clear();
  waitMemo.clear();
  playerIndex = undefined;
}

/** O(1) player lookup for the current world (getCareerPlayer scans every squad). */
function playerOf(state: CareerState, playerId: string): PlayerMock | undefined {
  memoCheck(state);
  if (!playerIndex) {
    playerIndex = new Map();
    for (const squad of Object.values(state.worldSquads)) for (const p of squad) if (!playerIndex.has(p.id)) playerIndex.set(p.id, p);
  }
  return playerIndex.get(playerId) ?? getCareerPlayer(state, playerId);
}

function pressureOf(state: CareerState, clubId: string): ClubOption["pressure"] {
  memoCheck(state);
  let p = pressureMemo.get(clubId);
  if (p === undefined) {
    p = getClubFinancialHealth(state, clubId)?.pressure ?? "NONE";
    pressureMemo.set(clubId, p);
  }
  return p;
}

// ---------------------------------------------------------------------------
// Basic facts
// ---------------------------------------------------------------------------

export function playerCAInWorld(state: CareerState, playerId: string): { ca: number; pa: number } | undefined {
  memoCheck(state);
  const cached = caMemo.get(playerId);
  if (cached !== undefined) return cached ?? undefined;
  const player = playerOf(state, playerId);
  if (!player) {
    caMemo.set(playerId, null);
    return undefined;
  }
  const r = state.gameplayRatings[player.clubId]?.find((x) => x.playerId === playerId);
  const value = { ca: r?.ca ?? player.currentAbility, pa: r?.pa ?? player.potentialAbility };
  caMemo.set(playerId, value);
  return value;
}

function monthsBetween(from: string, to: string): number {
  return Math.max(0, (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (30.4 * 86_400_000));
}

/** The club the player last played for (his current one, or the latest history entry for a free agent). */
function lastClubId(state: CareerState, playerId: string): string | undefined {
  const player = playerOf(state, playerId);
  if (player && player.clubId !== FREE_AGENT_CLUB_ID && player.clubId !== RETIRED_CLUB_ID) return player.clubId;
  const entries = getPlayerClubHistory(state, playerId)?.entries ?? [];
  return entries.length > 0 ? entries[entries.length - 1]!.clubId : undefined;
}

function playsAbroad(state: CareerState, playerId: string): boolean {
  const player = playerOf(state, playerId);
  const club = lastClubId(state, playerId);
  if (!player || !club) return false;
  const nation = clubNation(state, club);
  return nation !== undefined && nation !== player.nationality;
}

/** M8C: below this share of his market wage a contracted player counts as clearly underpaid. */
export const UNDERPAID_REFERENCE_FLOOR = 0.75;

export function playerCareerProfile(state: CareerState, playerId: string): PlayerCareerProfile | undefined {
  memoCheck(state);
  if (profileMemo.has(playerId)) return profileMemo.get(playerId) ?? undefined;
  const player = playerOf(state, playerId);
  const rating = playerCAInWorld(state, playerId);
  if (!player || !rating) {
    profileMemo.set(playerId, null);
    return undefined;
  }
  const age = playerAgeAtDate(player.dateOfBirth, player.birthYear, state.gameDate) ?? 26;
  const personality = personalityOf(state, playerId);
  const contract = getPlayerContract(state, playerId);
  const currentWage = contract?.wageEurPerMonth ?? 0;
  // HM-TRANSFER-REALISM-1.0: a contracted player measures money against what he earns. A free agent's
  // recorded wage is 0, so his reference is the market's: the formula wage, scaled to the wages the
  // world's clubs actually pay (never 0 -- the root of the audit's P1 bug).
  const marketWage = (getPlayerFairWageEurPerMonth(state, playerId) ?? 0) * marketWageFactor(state);
  // HM-TRANSFER-REALISM M8C: a player who has clearly outgrown his contract (developed on a frozen
  // wage) measures money against what the market pays a player of his level, not against his own
  // stale wage -- otherwise a 60 EUR raise on a 240 EUR contract reads as +25% and buys a CA-153
  // player into Division 1 (diagnosed in docs/audits/TRANSFER-REALISM-M8-COMPLETION-REPORT.md).
  const referenceWage = currentWage > 0 ? Math.max(currentWage, UNDERPAID_REFERENCE_FLOOR * marketWage) : marketWage;
  const profile = buildProfile({
    playerId,
    ca: rating.ca,
    pa: rating.pa,
    age,
    worldPercentile: worldPercentileOf(state, rating.ca),
    ambition: personality.ambition,
    loyalty: personality.loyalty,
    nationality: player.nationality,
    referenceWageEurPerMonth: referenceWage,
  });
  profileMemo.set(playerId, profile);
  return profile;
}

let marketFactorMemo: { contracts: unknown; value: number } | undefined;
/**
 * Median of (actual contract wage / formula fair wage) over contracted players
 * at clubs -- calibrates a free agent's market reference to real wage levels.
 */
export function marketWageFactor(state: CareerState): number {
  if (marketFactorMemo?.contracts === state.playerContracts) return marketFactorMemo.value;
  const ratios: number[] = [];
  let i = 0;
  for (const c of Object.values(state.playerContracts)) {
    if (c.wageEurPerMonth <= 0 || !getClub(c.clubId)) continue;
    if (i++ % 7 !== 0) continue; // a deterministic sample keeps this cheap
    const fair = getPlayerFairWageEurPerMonth(state, c.playerId);
    if (fair && fair > 0) ratios.push(c.wageEurPerMonth / fair);
  }
  ratios.sort((a, b) => a - b);
  const value = ratios.length > 0 ? Math.max(0.3, Math.min(1.5, ratios[Math.floor(ratios.length / 2)]!)) : 1;
  marketFactorMemo = { contracts: state.playerContracts, value };
  return value;
}

export function playerJitter(playerId: string): number {
  return seededOffset(`${playerId}:pcdm:decision`, 3) / 100;
}

/** Where the player's ability would rank him in `clubId`'s squad. */
export function expectedRoleAt(state: CareerState, playerId: string, clubId: string): SquadStatusTier {
  const rating = playerCAInWorld(state, playerId);
  const player = playerOf(state, playerId);
  const ca = rating?.ca ?? 0;
  const rank = (state.gameplayRatings[clubId] ?? []).filter((r) => r.playerId !== playerId && r.ca > ca).length;
  const age = player ? playerAgeAtDate(player.dateOfBirth, player.birthYear, state.gameDate) : null;
  if (rank < 3) return "KEY_PLAYER";
  if (rank < 7) return "FIRST_CHOICE";
  if (rank < 12) return "ROTATION";
  return age !== null && age <= 21 ? "TALENT" : "SQUAD_PLAYER";
}

/** The role the player plans with: a promise counts when it is given, for better or worse. */
function plannedRole(expected: SquadStatusTier, promised: SquadStatusTier | undefined): SquadStatusTier {
  if (!promised) return expected;
  return promised;
}

export function clubOptionFor(state: CareerState, playerId: string, clubId: string, terms: OfferTerms): ClubOption {
  const player = playerOf(state, playerId);
  const history = getPlayerClubHistory(state, playerId);
  const currentClub = getPlayerContract(state, playerId)?.clubId;
  const years = Math.max(0.5, terms.contractYears);
  return {
    clubId,
    environmentLevel: environmentLevelOf(state, clubId),
    role: plannedRole(expectedRoleAt(state, playerId, clubId), terms.promisedRole),
    wageEurPerMonth: terms.wageEurPerMonth + Math.max(0, terms.signingBonusEur ?? 0) / (12 * Math.max(1, years)),
    contractYears: years,
    pressure: pressureOf(state, clubId),
    isHomeCountry: !!player && clubNation(state, clubId) === player.nationality,
    isFormerClub: !!history?.entries.some((e) => e.clubId === clubId) && clubId !== currentClub,
    isCurrentClub: clubId === currentClub,
  };
}

// ---------------------------------------------------------------------------
// International market predicate (shared with lib/transfers/internationalMarket.ts)
// ---------------------------------------------------------------------------

/**
 * The international market only notices players of established professional
 * quality (top quarter of the world's rated players), or players coming home
 * to their own country's league. Abstract by design: world-pool clubs hold a
 * slice of their squads, so without this bar a weak foreign club would sweep
 * up any Swedish free agent.
 */
export const INTERNATIONAL_VISIBILITY_PERCENTILE = 0.75;
/** A signing must at least be close to the club's own level (a renewal keeps a looser fit). */
export const INTERNATIONAL_SIGNING_FIT_BELOW_CA = 8;

/** Would this world-pool club want this player (and have room)? Abstract international recruitment uses exactly this. */
export function internationalClubWants(state: CareerState, clubId: string, playerId: string): boolean {
  const rating = playerCAInWorld(state, playerId);
  const player = playerOf(state, playerId);
  if (!rating || !player) return false;
  const age = playerAgeAtDate(player.dateOfBirth, player.birthYear, state.gameDate) ?? 26;
  if (age > INTERNATIONAL_MAX_AGE) return false;
  const own = getPlayerContract(state, playerId)?.clubId === clubId;
  if (own) return rating.ca >= clubLevelOf(state, clubId) - INTERNATIONAL_FIT_BELOW_CA;
  if ((state.worldSquads[clubId]?.length ?? 0) >= INTERNATIONAL_SQUAD_CAPACITY) return false;
  const home = clubNation(state, clubId) === player.nationality;
  if (!home && worldPercentileOf(state, rating.ca) < INTERNATIONAL_VISIBILITY_PERCENTILE) return false;
  return rating.ca >= clubLevelOf(state, clubId) - INTERNATIONAL_SIGNING_FIT_BELOW_CA;
}

// ---------------------------------------------------------------------------
// HM-TRANSFER-REALISM M8B: international clubs buying contracted players.
// One buyer rule for every seller: the CPU purchase pass (internationalMarket.ts)
// and the bids the manager receives (players/market.ts findBuyer) both use it.
// ---------------------------------------------------------------------------

/** A paid transfer abroad is for players with their best years ahead or at hand... */
export const INTERNATIONAL_PURCHASE_MAX_AGE = 30;
/** ...that are a real sporting step up from where the player plays now... */
export const INTERNATIONAL_PURCHASE_STEP_UP = 4;
/** ...and that keep the club's visible slice balanced across positions. */
export const INTERNATIONAL_POSITION_LIMIT = 2;
/** Paid signings per world-pool club per transfer season (M8 probe: 2 let the empty start-of-career slots pull 61 Swedish players abroad in season 1). */
export const INTERNATIONAL_PURCHASES_PER_SEASON = 1;

/** Transfer season of a date: summer window and the following winter window share one season. */
export function transferSeasonKey(date: string): string {
  return date.slice(5) >= "06-01" ? date.slice(0, 4) : String(Number(date.slice(0, 4)) - 1);
}

export function internationalPurchasesThisSeason(state: CareerState, buyerClubId: string): number {
  const record = state.transferMarket?.internationalPurchases;
  return record && record.seasonKey === transferSeasonKey(state.gameDate) ? record.byClub[buyerClubId] ?? 0 : 0;
}

export function recordInternationalPurchase(state: CareerState, buyerClubId: string): CareerState {
  const seasonKey = transferSeasonKey(state.gameDate);
  const record = state.transferMarket?.internationalPurchases;
  const byClub = record && record.seasonKey === seasonKey ? { ...record.byClub } : {};
  byClub[buyerClubId] = (byClub[buyerClubId] ?? 0) + 1;
  return { ...state, transferMarket: { ...state.transferMarket, internationalPurchases: { seasonKey, byClub } } };
}

/** Would this world-pool club bid for this contracted player? Selective by design. */
export function internationalBuyerWants(state: CareerState, buyerClubId: string, playerId: string): boolean {
  const sellerClubId = getPlayerContract(state, playerId)?.clubId;
  if (!sellerClubId || sellerClubId === buyerClubId || sellerClubId === FREE_AGENT_CLUB_ID) return false;
  if (internationalPurchasesThisSeason(state, buyerClubId) >= INTERNATIONAL_PURCHASES_PER_SEASON) return false;
  if (!internationalClubWants(state, buyerClubId, playerId)) return false;
  const player = playerOf(state, playerId);
  if (!player) return false;
  const age = playerAgeAtDate(player.dateOfBirth, player.birthYear, state.gameDate) ?? 26;
  if (age > INTERNATIONAL_PURCHASE_MAX_AGE) return false;
  if (environmentLevelOf(state, buyerClubId) < environmentLevelOf(state, sellerClubId) + INTERNATIONAL_PURCHASE_STEP_UP) return false;
  const samePosition = (state.worldSquads[buyerClubId] ?? []).filter((p) => p.position === player.position).length;
  return samePosition < INTERNATIONAL_POSITION_LIMIT;
}

/**
 * What a world-pool club can pay for one player. Foreign clubs carry no
 * modelled economy, so the capacity is derived from their sporting level on
 * the game's own valuation scale: the market value of a prime-age key player a
 * little above the club's level. A weaker club therefore simply cannot afford
 * the players a stronger one can.
 */
export function internationalFeeCapacityEur(state: CareerState, buyerClubId: string): number {
  const level = Math.round(clubLevelOf(state, buyerClubId) + 10);
  const end = `${Number(state.gameDate.slice(0, 4)) + 3}${state.gameDate.slice(4)}`;
  return computePlayerMarketValueEur({ ca: level, pa: level, age: 26, position: mapHandballPositionToMatchPlanPosition("M9"), role: "KEY_PLAYER", competitionTier: 1 }, end, state.gameDate);
}

/** The best concrete international option at the player's market wage, or undefined. */
export function bestInternationalOption(state: CareerState, playerId: string, profile: PlayerCareerProfile, exclude: ReadonlySet<string> = new Set()): ClubOption | undefined {
  const current = getPlayerContract(state, playerId)?.clubId;
  let best: { option: ClubOption; u: number } | undefined;
  for (const clubId of worldPoolClubIds(state)) {
    if (clubId === current || exclude.has(clubId)) continue;
    if (!internationalClubWants(state, clubId, playerId)) continue;
    const option = clubOptionFor(state, playerId, clubId, { wageEurPerMonth: profile.referenceWageEurPerMonth * MARKET_MOVE_PREMIUM, contractYears: 2 });
    const u = evaluateCareerOption(profile, option).utility;
    if (!best || u > best.u || (u === best.u && clubId < best.option.clubId)) best = { option, u };
  }
  return best?.option;
}

/** Clubs a player can credibly join by testing the market: ones where his ability makes him a regular... */
export const WAIT_REACH_ABOVE_CA = 4;
/** ...and that are not far beneath him. */
export const WAIT_REACH_BELOW_CA = 18;
/** A good-but-typical outcome among those clubs, not the very best one. */
export const WAIT_LEVEL_QUANTILE = 0.75;
/** Uncertainty of landing it, in CA points of environment. */
export const WAIT_UNCERTAINTY_CA = 4;

const waitMemo = new Map<number, { level: number; clubLevel: number }>();
/**
 * What waiting credibly offers a player of this CA: a good-but-typical club
 * among those where he would be a regular (the 75th percentile of their
 * environments, less uncertainty), and the role his ability earns there.
 */
function credibleWait(state: CareerState, ca: number): { level: number; clubLevel: number } {
  memoCheck(state);
  const key = Math.round(ca);
  const cached = waitMemo.get(key);
  if (cached !== undefined) return cached;
  const t = strengthTable(state);
  const clubs: { env: number; level: number }[] = [];
  for (const [clubId, level] of Object.entries(t.clubLevel)) {
    if (level > key + WAIT_REACH_ABOVE_CA || level < key - WAIT_REACH_BELOW_CA) continue;
    clubs.push({ env: environmentLevelOf(state, clubId), level });
  }
  clubs.sort((x, y) => x.env - y.env);
  const pick = clubs.length > 0 ? clubs[Math.min(clubs.length - 1, Math.floor(WAIT_LEVEL_QUANTILE * (clubs.length - 1)))]! : { env: key - 10, level: key - 10 };
  const value = { level: pick.env - WAIT_UNCERTAINTY_CA, clubLevel: pick.level };
  waitMemo.set(key, value);
  return value;
}

export function marketContextFor(state: CareerState, playerId: string, options: { excludeStay?: boolean; wantsToLeave?: boolean } = {}): MarketContext | undefined {
  memoCheck(state);
  const key = `${playerId}|${options.excludeStay ? 1 : 0}|${options.wantsToLeave ? 1 : 0}`;
  const cached = marketMemo.get(key);
  if (cached) return cached;
  const profile = playerCareerProfile(state, playerId);
  const contract = getPlayerContract(state, playerId);
  if (!profile || !contract) return undefined;
  const status = getPlayerContractStatus(state, playerId);
  const isFree = status === "FREE_AGENT" || contract.clubId === FREE_AGENT_CLUB_ID;
  const openMarket = isFree || status === "EXPIRING" || status === "EXPIRING_SOON";
  let stay: ClubOption | undefined;
  if (!isFree && !options.excludeStay && getClub(contract.clubId)) {
    const remainingYears = Math.max(0.25, monthsBetween(state.gameDate, contract.contractEndDate) / 12);
    stay = clubOptionFor(state, playerId, contract.clubId, { wageEurPerMonth: contract.wageEurPerMonth, contractYears: remainingYears });
  }
  const wait = credibleWait(state, profile.ca);
  const market: MarketContext = {
    ...(stay ? { stay } : {}),
    ...(openMarket ? { internationalAlternative: bestInternationalOption(state, playerId, profile) } : {}),
    waitLevel: wait.level,
    waitRole: roleForLevelGap(profile.ca, wait.clubLevel),
    monthsUnattached: isFree ? monthsBetween(contract.contractEndDate, state.gameDate) : 0,
    openMarket,
    ...(options.wantsToLeave ? { wantsToLeave: true } : {}),
  };
  marketMemo.set(key, market);
  return market;
}

/**
 * The alternative a player weighs an offer against must be ANOTHER club: when
 * the market's best international option is one of the clubs on the table, the
 * next best one stands in for it.
 */
function excludingOffered(state: CareerState, playerId: string, profile: PlayerCareerProfile, market: MarketContext, offered: readonly string[]): MarketContext {
  if (!market.internationalAlternative || !offered.includes(market.internationalAlternative.clubId)) return market;
  const alternative = bestInternationalOption(state, playerId, profile, new Set(offered));
  const { internationalAlternative: _dropped, ...rest } = market;
  void _dropped;
  return alternative ? { ...rest, internationalAlternative: alternative } : rest;
}

// ---------------------------------------------------------------------------
// Flow-facing API
// ---------------------------------------------------------------------------

export interface PlayerDecisionOutcome {
  accept: boolean;
  reason: string;
  decision?: CareerDecision;
}

/** A concrete move to `toClubId` on `terms`: does the player say yes? */
export function playerDecisionOnMove(state: CareerState, playerId: string, toClubId: string, terms: OfferTerms, options: { wantsToLeave?: boolean } = {}): PlayerDecisionOutcome {
  const profile = playerCareerProfile(state, playerId);
  const market = marketContextFor(state, playerId, options);
  if (!profile || !market) return { accept: false, reason: "Spelaren kunde inte hittas." };
  const option = clubOptionFor(state, playerId, toClubId, terms);
  const abroad = playsAbroad(state, playerId);
  const decision = decide(profile, option, excludingOffered(state, playerId, profile, market, [toClubId]), playerJitter(playerId), abroad);
  const reservationEval = market.stay && decision.reservation.source === "STAY" ? evaluateCareerOption(profile, market.stay, abroad) : undefined;
  return { accept: decision.accept, reason: explainDecision(decision, reservationEval), decision };
}

/** Utility of a package -- used to compare rival packages on one scale. */
export function packageUtility(state: CareerState, playerId: string, clubId: string, terms: OfferTerms): number {
  const profile = playerCareerProfile(state, playerId);
  if (!profile) return -Infinity;
  return evaluateCareerOption(profile, clubOptionFor(state, playerId, clubId, terms), playsAbroad(state, playerId)).utility;
}

export interface WageDemandResult {
  /** null: no wage makes this acceptable (sporting floor, role, or a better alternative). */
  demandEurPerMonth: number | null;
  expectedRole: SquadStatusTier;
  refusesRole: boolean;
  reservationSource: "STAY" | "WAIT" | "INTERNATIONAL";
  floorBinding: boolean;
}

export function playerWageDemandAt(state: CareerState, playerId: string, clubId: string, terms: { contractYears: number; promisedRole?: SquadStatusTier; signingBonusEur?: number; toBeatUtility?: number; excludeStay?: boolean }): WageDemandResult | undefined {
  const profile = playerCareerProfile(state, playerId);
  const rawMarket = marketContextFor(state, playerId, { excludeStay: terms.excludeStay });
  if (!profile || !rawMarket) return undefined;
  const market = excludingOffered(state, playerId, profile, rawMarket, [clubId]);
  const expectedRole = expectedRoleAt(state, playerId, clubId);
  const refusesRole = !!terms.promisedRole && SQUAD_STATUS_TIERS.indexOf(terms.promisedRole) - SQUAD_STATUS_TIERS.indexOf(expectedRole) >= 3;
  const option = clubOptionFor(state, playerId, clubId, { wageEurPerMonth: 0, contractYears: terms.contractYears, promisedRole: terms.promisedRole });
  const abroad = playsAbroad(state, playerId);
  const reservation = reservationUtility(profile, market, abroad);
  // The bonus is spread over the contract; the demand is on the base wage.
  const bonusMonthly = Math.max(0, terms.signingBonusEur ?? 0) / (12 * Math.max(1, terms.contractYears));
  const raw = refusesRole ? null : wageDemandFor(profile, option, market, playerJitter(playerId), terms.toBeatUtility, abroad);
  const demand = raw === null ? null : Math.max(0, Math.ceil((raw - bonusMonthly) / 10) * 10);
  const atHigh = evaluateCareerOption(profile, { ...option, wageEurPerMonth: profile.referenceWageEurPerMonth * 8 }, abroad);
  return { demandEurPerMonth: demand, expectedRole, refusesRole, reservationSource: reservation.source, floorBinding: atHigh.floorApplied };
}

/** Club deciding whom to approach: probability the player says yes to these terms. */
export function acceptanceEstimate(state: CareerState, playerId: string, clubId: string, terms: OfferTerms): number {
  const profile = playerCareerProfile(state, playerId);
  const market = marketContextFor(state, playerId);
  if (!profile || !market) return 0;
  return estimateAcceptance(profile, clubOptionFor(state, playerId, clubId, terms), excludingOffered(state, playerId, profile, market, [clubId]), playerJitter(playerId), playsAbroad(state, playerId));
}

/**
 * Player side of a renewal: the renewal is the "stay" option, compared with
 * what the open market (waiting, the international alternative) offers him.
 */
export function playerRenewalDecision(state: CareerState, playerId: string, terms: OfferTerms): PlayerDecisionOutcome {
  const contract = getPlayerContract(state, playerId);
  const profile = playerCareerProfile(state, playerId);
  const base = marketContextFor(state, playerId, { excludeStay: true });
  if (!contract || !profile || !base) return { accept: false, reason: "Spelaren kunde inte hittas." };
  const market: MarketContext = { ...base, openMarket: true, internationalAlternative: base.internationalAlternative ?? bestInternationalOption(state, playerId, profile) };
  const option = clubOptionFor(state, playerId, contract.clubId, terms);
  const decision = decide(profile, option, market, playerJitter(playerId) - RENEWAL_CONTINUITY_BONUS, playsAbroad(state, playerId));
  return {
    accept: decision.accept,
    reason: decision.accept ? "Spelaren vill förlänga." : decision.evaluation.floorApplied || decision.evaluation.components.sport < -0.6 ? "Spelaren vill ta ett steg upp sportsligt och förlänger inte." : decision.reservation.source === "INTERNATIONAL" ? "Spelaren har bättre möjligheter utomlands." : "Villkoren räcker inte för att han ska stanna.",
    decision,
  };
}

/** The lowest wage at which the player renews (null: he will not renew at any wage). */
export function renewalWageDemand(state: CareerState, playerId: string, contractYears: number, promisedRole?: SquadStatusTier): number | null {
  const contract = getPlayerContract(state, playerId);
  const profile = playerCareerProfile(state, playerId);
  const base = marketContextFor(state, playerId, { excludeStay: true });
  if (!contract || !profile || !base) return null;
  const market: MarketContext = { ...base, openMarket: true, internationalAlternative: base.internationalAlternative ?? bestInternationalOption(state, playerId, profile) };
  const option = clubOptionFor(state, playerId, contract.clubId, { wageEurPerMonth: 0, contractYears, promisedRole });
  return wageDemandFor(profile, option, market, playerJitter(playerId) - RENEWAL_CONTINUITY_BONUS, undefined, playsAbroad(state, playerId));
}

/** Free agent / player choosing between several concrete packages at once. */
export function playerChoosesBetween(state: CareerState, playerId: string, offers: readonly { clubId: string; terms: OfferTerms }[]): { clubId: string | null; utilities: Record<string, number> } {
  const profile = playerCareerProfile(state, playerId);
  const market = marketContextFor(state, playerId);
  if (!profile || !market) return { clubId: null, utilities: {} };
  const abroad = playsAbroad(state, playerId);
  const options = offers.map((o) => clubOptionFor(state, playerId, o.clubId, o.terms));
  const { choice, ranked } = chooseBetweenOptions(profile, options, excludingOffered(state, playerId, profile, market, offers.map((o) => o.clubId)), playerJitter(playerId), abroad);
  return { clubId: choice?.clubId ?? null, utilities: Object.fromEntries(ranked.map((r) => [r.option.clubId, r.decision.utility])) };
}

// ---------------------------------------------------------------------------
// Explained demand: the negotiation room's wage demand, with its reasons.
// ---------------------------------------------------------------------------

export interface ExplainedDemand {
  demandEurPerMonth: number;
  /** True when no wage makes the move acceptable (role far too small, sporting floor, better alternatives). */
  refusesRole: boolean;
  factors: string[];
  baseEurPerMonth: number;
  breakdown: { label: string; effectPct: number }[];
  expectedRole: SquadStatusTier;
}

const FACTOR_LABEL_SV: Record<string, [raises: string, lowers: string]> = {
  sport: ["Ser klubben som ett sportsligt steg ned.", "Lockas av den sportsliga nivån."],
  role: ["Den utlovade rollen är mindre än han vill ha.", "Uppskattar rollen han erbjuds."],
  security: ["Kontraktslängden passar honom inte.", "Uppskattar tryggheten i kontraktet."],
  personal: ["Trivs där han är.", "Har en personlig koppling till klubben."],
  stability: ["Vill ha betalt för risken i en klubb med ansträngd ekonomi.", "Klubbens stabila ekonomi lockar."],
  development: ["Miljön hjälper inte hans utveckling.", "Miljön passar hans utveckling."],
};

/**
 * The player's demand for these terms at `clubId`, with a breakdown: each
 * component where this club is better or worse than his reservation (staying,
 * waiting, or abroad), converted to its approximate effect on the wage he
 * needs. One model -- the same numbers CPU clubs and rivals face.
 */
export function explainedWageDemand(state: CareerState, playerId: string, clubId: string, terms: { contractYears: number; promisedRole?: SquadStatusTier; signingBonusEur?: number; toBeatUtility?: number; rivalName?: string }): ExplainedDemand | undefined {
  const result = playerWageDemandAt(state, playerId, clubId, terms);
  const profile = playerCareerProfile(state, playerId);
  const rawMarket = marketContextFor(state, playerId);
  if (!result || !profile || !rawMarket) return undefined;
  const market = excludingOffered(state, playerId, profile, rawMarket, [clubId]);
  const abroad = playsAbroad(state, playerId);
  const base = profile.referenceWageEurPerMonth;
  const option = clubOptionFor(state, playerId, clubId, { wageEurPerMonth: base, contractYears: terms.contractYears, promisedRole: terms.promisedRole });
  const here = evaluateCareerOption(profile, option, abroad);
  const reservation = reservationUtility(profile, market, abroad);
  const refEval = reservation.source === "STAY" && market.stay ? evaluateCareerOption(profile, market.stay, abroad) : market.internationalAlternative && reservation.source === "INTERNATIONAL" ? evaluateCareerOption(profile, market.internationalAlternative, abroad) : undefined;
  const moneySlope = 0.9 * Math.max(0.05, profile.weights.money); // utility per doubling of the wage, near the reference
  const breakdown: { label: string; effectPct: number }[] = [];
  const factors: string[] = [];
  for (const key of Object.keys(FACTOR_LABEL_SV)) {
    const c = key as keyof typeof here.contributions;
    const delta = here.contributions[c] - (refEval?.contributions[c] ?? 0);
    if (Math.abs(delta) < 0.01) continue;
    const effectPct = Math.round((Math.pow(2, -delta / moneySlope) - 1) * 100);
    if (effectPct === 0) continue;
    const label = FACTOR_LABEL_SV[key]![delta < 0 ? 0 : 1];
    breakdown.push({ label, effectPct: Math.max(-60, Math.min(300, effectPct)) });
    factors.push(label);
  }
  if (reservation.source === "INTERNATIONAL") factors.push("Har alternativ utomlands.");
  if (reservation.source === "WAIT" && market.openMarket) factors.push("Kan vänta på ett bättre erbjudande.");
  if (terms.rivalName && terms.toBeatUtility !== undefined && terms.toBeatUtility > reservation.utility) factors.push(`Har ett bättre erbjudande från ${terms.rivalName}.`);
  if (result.floorBinding && result.demandEurPerMonth === null) factors.push("Den sportsliga nivån är för låg -- pengar ändrar inte det.");
  return {
    demandEurPerMonth: result.demandEurPerMonth ?? 0,
    refusesRole: result.refusesRole || result.demandEurPerMonth === null,
    factors,
    baseEurPerMonth: Math.round(base),
    breakdown,
    expectedRole: result.expectedRole,
  };
}
