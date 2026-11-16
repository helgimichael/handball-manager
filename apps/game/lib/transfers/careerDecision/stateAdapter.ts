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
import { getClub } from "../../game-data";
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
} from "./model";
import { clubLevelOf, clubNation, environmentLevelOf, strengthTable, worldPercentileOf, worldPoolClubIds } from "./sportingStrength";

export interface OfferTerms {
  wageEurPerMonth: number;
  contractYears: number;
  signingBonusEur?: number;
  promisedRole?: SquadStatusTier;
}

/** The international market's capacity per world-pool club (they hold a slice of a real squad, not a full one). */
export const INTERNATIONAL_SQUAD_CAPACITY = 12;
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
function memoCheck(state: CareerState): void {
  if (memoWorld && memoWorld.ratings === state.gameplayRatings && memoWorld.squads === state.worldSquads && memoWorld.contracts === state.playerContracts && memoWorld.date === state.gameDate && memoWorld.market === state.transferMarket) return;
  memoWorld = { ratings: state.gameplayRatings, squads: state.worldSquads, contracts: state.playerContracts, date: state.gameDate, market: state.transferMarket };
  profileMemo.clear();
  marketMemo.clear();
}

// ---------------------------------------------------------------------------
// Basic facts
// ---------------------------------------------------------------------------

export function playerCAInWorld(state: CareerState, playerId: string): { ca: number; pa: number } | undefined {
  const player = getCareerPlayer(state, playerId);
  if (!player) return undefined;
  const r = state.gameplayRatings[player.clubId]?.find((x) => x.playerId === playerId);
  return { ca: r?.ca ?? player.currentAbility, pa: r?.pa ?? player.potentialAbility };
}

function monthsBetween(from: string, to: string): number {
  return Math.max(0, (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (30.4 * 86_400_000));
}

/** The club the player last played for (his current one, or the latest history entry for a free agent). */
function lastClubId(state: CareerState, playerId: string): string | undefined {
  const player = getCareerPlayer(state, playerId);
  if (player && player.clubId !== FREE_AGENT_CLUB_ID && player.clubId !== RETIRED_CLUB_ID) return player.clubId;
  const entries = getPlayerClubHistory(state, playerId)?.entries ?? [];
  return entries.length > 0 ? entries[entries.length - 1]!.clubId : undefined;
}

function playsAbroad(state: CareerState, playerId: string): boolean {
  const player = getCareerPlayer(state, playerId);
  const club = lastClubId(state, playerId);
  if (!player || !club) return false;
  const nation = clubNation(state, club);
  return nation !== undefined && nation !== player.nationality;
}

export function playerCareerProfile(state: CareerState, playerId: string): PlayerCareerProfile | undefined {
  memoCheck(state);
  if (profileMemo.has(playerId)) return profileMemo.get(playerId) ?? undefined;
  const player = getCareerPlayer(state, playerId);
  const rating = playerCAInWorld(state, playerId);
  if (!player || !rating) {
    profileMemo.set(playerId, null);
    return undefined;
  }
  const age = playerAgeAtDate(player.dateOfBirth, player.birthYear, state.gameDate) ?? 26;
  const personality = personalityOf(state, playerId);
  const contract = getPlayerContract(state, playerId);
  const currentWage = contract?.wageEurPerMonth ?? 0;
  // HM-TRANSFER-REALISM-1.0: never 0 -- a free agent's recorded wage is 0, but what money is worth to him is set by the market.
  const fair = getPlayerFairWageEurPerMonth(state, playerId) ?? 0;
  const referenceWage = Math.max(currentWage, fair, 600);
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

export function playerJitter(playerId: string): number {
  return seededOffset(`${playerId}:pcdm:decision`, 3) / 100;
}

/** Where the player's ability would rank him in `clubId`'s squad. */
export function expectedRoleAt(state: CareerState, playerId: string, clubId: string): SquadStatusTier {
  const rating = playerCAInWorld(state, playerId);
  const player = getCareerPlayer(state, playerId);
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
  const player = getCareerPlayer(state, playerId);
  const history = getPlayerClubHistory(state, playerId);
  const currentClub = getPlayerContract(state, playerId)?.clubId;
  const years = Math.max(0.5, terms.contractYears);
  return {
    clubId,
    environmentLevel: environmentLevelOf(state, clubId),
    role: plannedRole(expectedRoleAt(state, playerId, clubId), terms.promisedRole),
    wageEurPerMonth: terms.wageEurPerMonth + Math.max(0, terms.signingBonusEur ?? 0) / (12 * Math.max(1, years)),
    contractYears: years,
    pressure: getClubFinancialHealth(state, clubId)?.pressure ?? "NONE",
    isHomeCountry: !!player && clubNation(state, clubId) === player.nationality,
    isFormerClub: !!history?.entries.some((e) => e.clubId === clubId) && clubId !== currentClub,
    isCurrentClub: clubId === currentClub,
  };
}

// ---------------------------------------------------------------------------
// International market predicate (shared with lib/transfers/internationalMarket.ts)
// ---------------------------------------------------------------------------

/** Would this world-pool club want this player (and have room)? Abstract international recruitment uses exactly this. */
export function internationalClubWants(state: CareerState, clubId: string, playerId: string): boolean {
  const rating = playerCAInWorld(state, playerId);
  const player = getCareerPlayer(state, playerId);
  if (!rating || !player) return false;
  const age = playerAgeAtDate(player.dateOfBirth, player.birthYear, state.gameDate) ?? 26;
  if (age > INTERNATIONAL_MAX_AGE) return false;
  if ((state.worldSquads[clubId]?.length ?? 0) >= INTERNATIONAL_SQUAD_CAPACITY && player.clubId !== clubId) return false;
  return rating.ca >= clubLevelOf(state, clubId) - INTERNATIONAL_FIT_BELOW_CA;
}

/** The best concrete international option at the player's market wage, or undefined. */
export function bestInternationalOption(state: CareerState, playerId: string, profile: PlayerCareerProfile): ClubOption | undefined {
  const current = getPlayerContract(state, playerId)?.clubId;
  let best: { option: ClubOption; u: number } | undefined;
  for (const clubId of worldPoolClubIds(state)) {
    if (clubId === current) continue;
    if (!internationalClubWants(state, clubId, playerId)) continue;
    const option = clubOptionFor(state, playerId, clubId, { wageEurPerMonth: profile.referenceWageEurPerMonth, contractYears: 2 });
    const u = evaluateCareerOption(profile, option).utility;
    if (!best || u > best.u || (u === best.u && clubId < best.option.clubId)) best = { option, u };
  }
  return best?.option;
}

/** The environment level the market can credibly offer a player of this CA (best club that would take him, less uncertainty). */
function credibleWaitLevel(state: CareerState, ca: number): number {
  const t = strengthTable(state);
  let best = -Infinity;
  for (const [clubId, level] of Object.entries(t.clubLevel)) {
    if (level > ca + 10) continue;
    const env = environmentLevelOf(state, clubId);
    if (env > best) best = env;
  }
  if (!Number.isFinite(best)) best = ca - 10;
  return Math.min(ca - 4, best) - 6;
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
  const market: MarketContext = {
    ...(stay ? { stay } : {}),
    ...(openMarket ? { internationalAlternative: bestInternationalOption(state, playerId, profile) } : {}),
    waitLevel: credibleWaitLevel(state, profile.ca),
    monthsUnattached: isFree ? monthsBetween(contract.contractEndDate, state.gameDate) : 0,
    openMarket,
    ...(options.wantsToLeave ? { wantsToLeave: true } : {}),
  };
  marketMemo.set(key, market);
  return market;
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
  const decision = decide(profile, option, market, playerJitter(playerId), abroad);
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
  const market = marketContextFor(state, playerId, { excludeStay: terms.excludeStay });
  if (!profile || !market) return undefined;
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
  return estimateAcceptance(profile, clubOptionFor(state, playerId, clubId, terms), market, playerJitter(playerId), playsAbroad(state, playerId));
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
  const decision = decide(profile, option, market, playerJitter(playerId), playsAbroad(state, playerId));
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
  return wageDemandFor(profile, option, market, playerJitter(playerId), undefined, playsAbroad(state, playerId));
}

/** Free agent / player choosing between several concrete packages at once. */
export function playerChoosesBetween(state: CareerState, playerId: string, offers: readonly { clubId: string; terms: OfferTerms }[]): { clubId: string | null; utilities: Record<string, number> } {
  const profile = playerCareerProfile(state, playerId);
  const market = marketContextFor(state, playerId);
  if (!profile || !market) return { clubId: null, utilities: {} };
  const abroad = playsAbroad(state, playerId);
  const options = offers.map((o) => clubOptionFor(state, playerId, o.clubId, o.terms));
  const { choice, ranked } = chooseBetweenOptions(profile, options, market, playerJitter(playerId), abroad);
  return { clubId: choice?.clubId ?? null, utilities: Object.fromEntries(ranked.map((r) => [r.option.clubId, r.decision.utility])) };
}
