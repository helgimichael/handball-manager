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
  const toClubLevel = ownLevelScore(state, toClubId);

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
  // Rule 1: Tier Gap & Quality Bar (The Allsvenskan vs Top Stars Rule)
  // On the 1-200 CA scale:
  // 165+: World Class European Giants (Champions League title contenders)
  // 135+: Elite Handbollsligan Stars / Internationals
  // 118+: Solid Handbollsligan starters
  // 90-117: Regular Allsvenskan starters / Handbollsligan rotation
  // -------------------------------------------------------------------------

  // Champions League / Elite tier stars (CA >= 165) approaching any Swedish club
  if (ca >= 165) {
    if (age >= 33 && isFormerClub) {
      return {
        playerId,
        toClubId,
        interestLevel: "UNSURE",
        label: "Möjligen övertalbar",
        tone: "caution",
        reason: "Stjärnspelare på hemvändarspåret – kräver klubbens absoluta maxavtal och titelambitioner.",
        willEnterNegotiations: true,
        minimumRequiredRole: "FIRST_CHOICE",
        wagePremiumMultiplier: 1.3,
      };
    }
    return {
      playerId,
      toClubId,
      interestLevel: "IMPOSSIBLE",
      label: "Helt ointresserad",
      tone: "negative",
      reason: "Spelar på internationell toppnivå i Europa. Svenska klubbar kan inte matcha sportslig nivå eller lön.",
      willEnterNegotiations: false,
      wagePremiumMultiplier: 1.0,
    };
  }

  // Elite Handbollsligan stars (CA >= 130) will NOT consider dropping to Allsvenskan (tier 2)
  if (toTier >= 2 && ca >= 130) {
    if (age >= 32 && isFormerClub) {
      return {
        playerId,
        toClubId,
        interestLevel: "UNSURE",
        label: "Möjligen övertalbar",
        tone: "caution",
        reason: "Har stark koppling till klubben sedan tidigare och kan överväga att avsluta karriären här.",
        willEnterNegotiations: true,
        minimumRequiredRole: "FIRST_CHOICE",
        wagePremiumMultiplier: 1.25,
      };
    }
    return {
      playerId,
      toClubId,
      interestLevel: "IMPOSSIBLE",
      label: "Helt ointresserad",
      tone: "negative",
      reason: "Anser att klubbens serienivå är för låg och är inte beredd att spela i Allsvenskan.",
      willEnterNegotiations: false,
      wagePremiumMultiplier: 1.0,
    };
  }

  // Solid Handbollsligan players (CA 118-129) approaching Allsvenskan
  if (toTier >= 2 && fromTier === 1 && ca >= 118) {
    // If young (<=21) and seeking playing time in Allsvenskan
    if (age <= 21 && need.level === "HIGH") {
      return {
        playerId,
        toClubId,
        interestLevel: "INTERESTED",
        label: "Intresserad",
        tone: "positive",
        reason: "Söker regelbunden speltid och lockas av en bärande roll i Allsvenskan.",
        willEnterNegotiations: true,
        minimumRequiredRole: "FIRST_CHOICE",
        wagePremiumMultiplier: 1.0,
      };
    }
    if (age >= 31 && (isFormerClub || need.level === "HIGH")) {
      return {
        playerId,
        toClubId,
        interestLevel: "UNSURE",
        label: "Möjligen övertalbar",
        tone: "caution",
        reason: "Kan lockas av ledarroll och trygghet mot slutet av karriären om villkoren är rätt.",
        willEnterNegotiations: true,
        minimumRequiredRole: "FIRST_CHOICE",
        wagePremiumMultiplier: 1.2,
      };
    }
    return {
      playerId,
      toClubId,
      interestLevel: "UNLIKELY",
      label: "Osannolikt mål",
      tone: "caution",
      reason: "Prioriterar spel i högsta serien. Kräver ett exceptionellt ekonomiskt och sportsligt upplägg.",
      willEnterNegotiations: true,
      minimumRequiredRole: "FIRST_CHOICE",
      wagePremiumMultiplier: 1.5,
    };
  }

  // -------------------------------------------------------------------------
  // Rule 2: Wage Structure Headroom
  // -------------------------------------------------------------------------
  if (currentWage > maxAffordableWage * 1.5) {
    return {
      playerId,
      toClubId,
      interestLevel: "UNLIKELY",
      label: "Ekonomiskt osannolik",
      tone: "caution",
      reason: "Spelarens nuvarande lönenivå ligger klart över vad klubbens lönestruktur normalt tillåter.",
      willEnterNegotiations: true,
      minimumRequiredRole: "FIRST_CHOICE",
      wagePremiumMultiplier: 1.4,
    };
  }

  // -------------------------------------------------------------------------
  // Rule 3: Stepping UP in Tier (Allsvenskan to Handbollsligan)
  // -------------------------------------------------------------------------
  if (toTier === 1 && fromTier >= 2) {
    return {
      playerId,
      toClubId,
      interestLevel: "HIGH",
      label: "Mycket intresserad",
      tone: "positive",
      reason: "Attraheras starkt av chansen att ta klivet upp till Handbollsligan.",
      willEnterNegotiations: true,
      wagePremiumMultiplier: 1.0,
    };
  }

  // -------------------------------------------------------------------------
  // Rule 4: Contract Situation (Free Agents & Expiring Contracts)
  // -------------------------------------------------------------------------
  if (contractStatus === "FREE_AGENT") {
    if (ca <= toClubLevel + 12) {
      return {
        playerId,
        toClubId,
        interestLevel: "HIGH",
        label: "Mycket intresserad",
        tone: "positive",
        reason: "Kontraktslös och aktivt på jakt efter en ny klubb på rätt nivå.",
        willEnterNegotiations: true,
        wagePremiumMultiplier: 1.0,
      };
    }
    return {
      playerId,
      toClubId,
      interestLevel: "INTERESTED",
      label: "Intresserad",
      tone: "positive",
      reason: "Öppen för förslag från seriösa intressenter som kan erbjuda en bra roll.",
      willEnterNegotiations: true,
      wagePremiumMultiplier: 1.0,
    };
  }

  if (contractStatus === "EXPIRING" || contractStatus === "EXPIRING_SOON") {
    if (need.level === "HIGH") {
      return {
        playerId,
        toClubId,
        interestLevel: "HIGH",
        label: "Mycket intresserad",
        tone: "positive",
        reason: "Avtalet löper ut inom kort och klubben har ett akut behov på hans position.",
        willEnterNegotiations: true,
        wagePremiumMultiplier: 1.0,
      };
    }
  }

  // -------------------------------------------------------------------------
  // Rule 5: Same Tier / Standard Level Match
  // -------------------------------------------------------------------------
  if (fromTier === toTier) {
    const levelDiff = ca - toClubLevel;
    if (levelDiff <= 6) {
      return {
        playerId,
        toClubId,
        interestLevel: "INTERESTED",
        label: "Intresserad",
        tone: "positive",
        reason: "Passar väl in i lagets nivå och rollfördelning på samma serienivå.",
        willEnterNegotiations: true,
        wagePremiumMultiplier: 1.0,
      };
    }
    if (levelDiff <= 16) {
      return {
        playerId,
        toClubId,
        interestLevel: "UNSURE",
        label: "Möjligen övertalbar",
        tone: "caution",
        reason: "Trivs i nuvarande miljö men kan lockas av en nyckelroll och ett förbättrat avtal.",
        willEnterNegotiations: true,
        minimumRequiredRole: "FIRST_CHOICE",
        wagePremiumMultiplier: 1.2,
      };
    }
    return {
      playerId,
      toClubId,
      interestLevel: "UNLIKELY",
      label: "Osannolik",
      tone: "caution",
      reason: "Håller en högre nivå än klubbens genomsnitt och siktar mot toppklubbar eller utlandet.",
      willEnterNegotiations: true,
      minimumRequiredRole: "FIRST_CHOICE",
      wagePremiumMultiplier: 1.5,
    };
  }

  // Default fallback
  return {
    playerId,
    toClubId,
    interestLevel: "INTERESTED",
    label: "Intresserad",
    tone: "positive",
    reason: "Öppen för en övergång om parterna kommer överens om personliga villkor.",
    willEnterNegotiations: true,
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
