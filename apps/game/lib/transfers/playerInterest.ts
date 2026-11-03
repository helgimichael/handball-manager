// HM-PLAYTEST-IMPROVEMENT-02: Realistic Player Interest Model.
//
// Separates database visibility from willingness to sign.
// In real handball, an Allsvenskan club (e.g. IFK Tumba) can browse the player market
// but top European and Handbollsligan stars will not consider signing for a second-tier club.
//
// Evaluates interest based on:
// 1. Club reputation and league tier relative to player quality (CA on 1-200 scale).
// 2. Playing time and squad role expectations.
// 3. Wage structure headroom and economic realism.
// 4. Geographic connection and club history (homecoming bonus for veterans).
// 5. Career stage (youth prospect seeking minutes vs prime star seeking titles vs veteran).
// 6. Current contract status (expiring / free agent vs settled under long-term deal).

import type { CareerState } from "../career/types";
import { getCareerPlayer, getCareerClubSquad } from "../career/careerWorld";
import { getCompetition, getClub } from "../game-data";
import { playerAgeAtDate } from "../development/developmentIntegration";
import { getPlayerContract, getPlayerContractStatus, getPlayerFairWageEurPerMonth } from "../economy/contractIntegration";
import { getPlayerClubHistory } from "../economy/clubHistoryIntegration";
import { caOf } from "../players/dynamicsState";
import { ownLevelScore } from "../career/cpuCandidateEvaluation";
import { assessPositionNeed } from "../career/cpuSquadNeeds";
import { getClubBudgets } from "../economy/clubEconomyIntegration";
import { clubCompetitionTier } from "../career/competitionMembership";
import type { SquadStatusTier } from "../career/squadStatus";

export type PlayerInterestLevel = "HIGH" | "INTERESTED" | "UNSURE" | "UNLIKELY" | "IMPOSSIBLE";

export interface PlayerInterestEvaluation {
  playerId: string;
  toClubId: string;
  interestLevel: PlayerInterestLevel;
  score?: number;
  label: string;
  tone: "positive" | "neutral" | "caution" | "negative";
  reason: string;
  willEnterNegotiations: boolean;
  minimumRequiredRole?: SquadStatusTier;
  wagePremiumMultiplier: number;
}

export type InterestFilter = "ALL" | "REALISTIC" | "PERSUADABLE";

function resolveClubTier(state: CareerState, clubId: string): 1 | 2 | 3 {
  const tier = clubCompetitionTier(state, clubId);
  if (tier === 1) return 1;
  if (tier === 2) return 2;
  const compId = getClub(clubId)?.competitionId;
  const comp = compId ? getCompetition(compId) : undefined;
  if (comp?.tier === 1) return 1;
  if (comp?.tier === 2) return 2;
  return 3;
}

export function evaluatePlayerInterest(
  state: CareerState,
  playerId: string,
  toClubId: string = state.playerClubId
): PlayerInterestEvaluation {
  const player = getCareerPlayer(state, playerId);
  if (!player) {
    return {
      playerId,
      toClubId,
      interestLevel: "IMPOSSIBLE",
      score: 0,
      label: "Okänd spelare",
      tone: "negative",
      reason: "Spelaren hittades inte i databasen.",
      willEnterNegotiations: false,
      wagePremiumMultiplier: 1.0,
    };
  }

  // Own club players don't negotiate inbound transfers with themselves
  if (player.clubId === toClubId) {
    return {
      playerId,
      toClubId,
      interestLevel: "HIGH",
      score: 100,
      label: "Tillhör klubben",
      tone: "positive",
      reason: "Spelaren spelar redan i din klubb.",
      willEnterNegotiations: true,
      wagePremiumMultiplier: 1.0,
    };
  }

  const age = playerAgeAtDate(player.dateOfBirth, player.birthYear, state.gameDate) ?? 24;
  const currentClubId = player.clubId;
  const fromTier = resolveClubTier(state, currentClubId);
  const toTier = resolveClubTier(state, toClubId);
  const contractStatus = getPlayerContractStatus(state, playerId);
  const contract = getPlayerContract(state, playerId);
  const ca = caOf(state, playerId);
  let toClubLevel = ownLevelScore(state, toClubId);
  if (toClubLevel === 0) {
    toClubLevel = toTier === 1 ? 120 : toTier === 2 ? 90 : 70;
  }

  // Check past history / connection with toClub
  const history = getPlayerClubHistory(state, playerId);
  const isFormerClub = history?.entries.some((e) => e.clubId === toClubId) ?? false;

  // Position needs & playing time outlook
  const squad = getCareerClubSquad(state, toClubId);
  const need = assessPositionNeed(state, toClubId, player.position, squad);

  // Wages & Economy
  const fairWage = getPlayerFairWageEurPerMonth(state, playerId) ?? 1500;
  const currentWage = contract?.wageEurPerMonth ?? fairWage;
  const toBudgets = getClubBudgets(state, toClubId);
  const maxAffordableWage = toBudgets ? (toBudgets.wageBudgetEur / 12) * 0.25 : 2000;

  // -------------------------------------------------------------------------
  // Continuous Multi-Factor Interest Scoring (0 to 100)
  // Replaces rigid single-threshold gates (no hard CA >= 160 cutoffs).
  // Combines sporting gap, league tier direction, contract status,
  // wage capacity, playing time opportunities, and veteran homecoming loyalty.
  // -------------------------------------------------------------------------
  const sportingGap = ca - toClubLevel;
  let score = 50; // Neutral baseline

  // Factor 1: Sporting ability relative to acquiring club standard
  if (sportingGap > 0) {
    const penaltyMultiplier = isFormerClub && age >= 30 ? 0.6 : 1.25;
    score -= Math.round(sportingGap * penaltyMultiplier);
  } else {
    score += Math.min(25, Math.round(Math.abs(sportingGap) * 0.75));
  }

  // Factor 2: League tier movement
  if (toTier < fromTier) {
    // Stepping up to higher league (e.g. Allsvenskan to Handbollsligan)
    score += 25;
  } else if (toTier > fromTier) {
    // Dropping down to lower league (e.g. Handbollsligan to Allsvenskan)
    score -= isFormerClub ? 8 : 36;
  }

  // Factor 3: Contract situation
  if (contractStatus === "FREE_AGENT") {
    score += 35; // Unattached players actively need employment
  } else if (contractStatus === "EXPIRING" || contractStatus === "EXPIRING_SOON") {
    score += 16;
  }

  // Factor 4: Wage affordability
  if (currentWage > 0 && maxAffordableWage > 0) {
    const affordabilityRatio = maxAffordableWage / currentWage;
    if (affordabilityRatio >= 1.5) {
      score += 12; // Club can offer substantial wage bump
    } else if (affordabilityRatio < 0.6) {
      score -= 25; // Club cannot match current wage level
    } else if (affordabilityRatio < 0.35) {
      score -= 45; // Extreme economic mismatch
    }
  }

  // Factor 5: Playing time & squad need
  if (age <= 22 && need.level === "HIGH") {
    score += 24; // Young prospect seeking regular court time
  } else if (age <= 23 && need.level === "MEDIUM") {
    score += 10;
  } else if (need.level === "LOW") {
    score -= 8;
  }

  // Factor 6: Exceptional circumstances (Homecoming & Veteran loyalty)
  if (isFormerClub) {
    if (age >= 32) {
      score += 42; // Veteran returning to boyhood club
    } else if (age >= 29) {
      score += 26;
    } else {
      score += 14;
    }
  } else if (age >= 33 && toTier === 1) {
    score += 15; // Veteran seeking final elite season
  }

  // Clamp continuous score
  score = Math.max(0, Math.min(100, score));

  // Determine interest tier based on composite score
  if (score >= 70) {
    let reason = "Ser klubben som ett attraktivt steg och är mycket positiv till en övergång.";
    if (isFormerClub) {
      reason = "Har stark koppling till klubben sedan tidigare och är mycket motiverad för en återkomst.";
    } else if (contractStatus === "FREE_AGENT") {
      reason = "Kontraktslös och aktivt på jakt efter en ny klubb med en tydlig roll.";
    } else if (toTier < fromTier) {
      reason = toTier === 1
        ? "Attraheras starkt av chansen att ta klivet upp till Handbollsligan."
        : "Attraheras starkt av chansen att ta klivet upp till Allsvenskan.";
    } else if (age <= 22 && need.level === "HIGH") {
      reason = "Söker regelbunden speltid och ser klubben som en utmärkt miljö för sitt genombrott.";
    }

    return {
      playerId,
      toClubId,
      interestLevel: "HIGH",
      score,
      label: "Mycket intresserad",
      tone: "positive",
      reason,
      willEnterNegotiations: true,
      wagePremiumMultiplier: 1.0,
    };
  }

  if (score >= 45) {
    let reason = "Öppen för en övergång och bedömer att lagets nivå och ambitioner matchar den egna profilen.";
    if (isFormerClub) {
      reason = "Har stark koppling till klubben sedan tidigare och lockas av en återkomst.";
    } else if (age <= 22) {
      reason = "Söker regelbunden speltid och lockas av en bärande roll i laget.";
    } else if (contractStatus === "EXPIRING" || contractStatus === "EXPIRING_SOON") {
      reason = "Avtalet löper ut inom kort och är intresserad av att diskutera klubbens framtidsplaner.";
    }

    return {
      playerId,
      toClubId,
      interestLevel: "INTERESTED",
      score,
      label: "Intresserad",
      tone: "positive",
      reason,
      willEnterNegotiations: true,
      wagePremiumMultiplier: 1.0,
    };
  }

  if (score >= 25) {
    let reason = "Trivs i nuvarande miljö men kan överväga en flytt vid ett kännbart lönelyft och en tydlig nyckelroll.";
    if (isFormerClub) {
      reason = "Har stark koppling till klubben sedan tidigare och kan tänka sig en återkomst om den sportsliga satsningen är rätt.";
    } else if (toTier > fromTier) {
      reason = "Kan överväga spel i en lägre serie om klubben erbjuder en odiskutabel ledarroll och ett starkt långsiktigt projekt.";
    }

    return {
      playerId,
      toClubId,
      interestLevel: "UNSURE",
      score,
      label: "Möjligen övertalbar",
      tone: "caution",
      reason,
      willEnterNegotiations: true,
      minimumRequiredRole: "FIRST_CHOICE",
      wagePremiumMultiplier: 1.25,
    };
  }

  if (score >= 12) {
    let reason = "Prioriterar spel på högre nivå, men kan lyssna om klubben lägger fram ett exceptionellt kontraktsförslag.";
    if (toTier > fromTier) {
      reason = "Prioriterar spel i högsta serien. Kräver ett exceptionellt ekonomiskt och sportsligt upplägg med garanterad startplats.";
    } else if (currentWage > maxAffordableWage * 1.3) {
      reason = "Spelarens nuvarande lönenivå ligger klart över vad klubbens lönestruktur normalt tillåter.";
    }

    return {
      playerId,
      toClubId,
      interestLevel: "UNLIKELY",
      score,
      label: "Osannolikt mål",
      tone: "caution",
      reason,
      willEnterNegotiations: true,
      minimumRequiredRole: "FIRST_CHOICE",
      wagePremiumMultiplier: 1.5,
    };
  }

  // Score < 12: Genuinely Impossible to sign
  let impossibleReason = "Spelar på internationell toppnivå i Europa. Klubben kan i dagsläget inte matcha den sportsliga nivån eller ambitionerna.";
  if (toTier > fromTier) {
    impossibleReason = "Anser att klubbens serienivå är för låg och är inte beredd att spela i Allsvenskan i nuvarande skede av karriären.";
  } else if (maxAffordableWage < currentWage * 0.4) {
    impossibleReason = "Spelarens löneanspråk och marknadsstatus ligger långt utanför vad klubben har ekonomiskt utrymme att erbjuda.";
  }

  return {
    playerId,
    toClubId,
    interestLevel: "IMPOSSIBLE",
    score,
    label: "Helt ointresserad",
    tone: "negative",
    reason: impossibleReason,
    willEnterNegotiations: false,
    wagePremiumMultiplier: 1.0,
  };
}

/**
 * Filter predicate based on manager interest filter.
 */
export function matchesInterestFilter(
  interest: PlayerInterestEvaluation,
  filter: InterestFilter
): boolean {
  if (filter === "ALL") return true;
  if (filter === "REALISTIC") {
    return interest.interestLevel === "HIGH" || interest.interestLevel === "INTERESTED";
  }
  if (filter === "PERSUADABLE") {
    return (
      interest.interestLevel === "HIGH" ||
      interest.interestLevel === "INTERESTED" ||
      interest.interestLevel === "UNSURE"
    );
  }
  return true;
}
