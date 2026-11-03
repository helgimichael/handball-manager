// HM-PLAYTEST-IMPROVEMENT-02: Swedish Handball Federation (SHF) & EHF/IHF Training Compensation.
//
// Primary source: Svenska Handbollförbundets reglemente och beräkningstabeller för utbildningsersättning 2026–2027:
// https://www.svenskhandboll.se/handboll-i-sverige/tavling/overgangar/utbildningsersattning
//
// Key regulatory rules:
// 1. Age eligibility: Applies to transfers of players who have reached their 16th birthday
//    and have not yet reached their 24th birthday (i.e. aged 16-23 during the transfer season).
// 2. Training window: Evaluated for seasons between ages 12 and 21 (inclusive, up to 10 training seasons).
// 3. Category/Tier scaling: Handbollsligan (Category 1 / Elit), Allsvenskan (Category 2), Division 1/bredd (Category 3).
//    Separate rates for younger youth (12-15) vs junior/development (16-21).
// 4. International transfers (EHF / IHF): ITC Education Compensation applies up to age 23/24 across federations.
// 5. Total Acquisition Cost: Free transfers (Bosman/expired contract) do NOT mean zero total acquisition cost!
//    Acquisition cost strictly distinguishes:
//    - Negotiated transfer fee (Övergångssumma)
//    - Training compensation (Utbildningsersättning)
//    - Signing costs (Agentarvode och signeringsbonus)
//    - Wage commitments (Lönekostnad per månad / år)
//    - Total acquisition cost (Total anskaffningskostnad)
// 6. Gameplay approximation for real players without historic youth registration:
//    When youth registrations are missing from federation records, an honest, clearly-documented
//    gameplay approximation is used based on known club tenure, rather than inventing fictional data.

import { getClub, getCompetition } from "../game-data";
import type { CareerState } from "../career/types";
import { getCareerPlayer } from "../career/careerWorld";
import { playerAgeAtDate } from "../development/developmentIntegration";
import { getPlayerClubHistory } from "../economy/clubHistoryIntegration";
import type { PlayerClubHistoryEntry } from "../economy/types";

export interface TrainingClubShare {
  clubId: string;
  clubName: string;
  seasons: number;
  fromAge: number;
  toAge: number;
  amountEur: number;
  isDomestic: boolean;
  ratePerSeasonEur: number;
}

export interface TrainingCompensationResultDetailed {
  totalEur: number;
  perClub: readonly TrainingClubShare[];
  ruleSetVersion: string;
  isDomesticTransfer: boolean;
  isApproximation: boolean;
  documentationNote: string;
  playerAge: number | null;
  eligible: boolean;
}

export interface AcquisitionCostBreakdown {
  transferFeeEur: number;
  trainingCompensationEur: number;
  signingCostsEur: number;
  monthlyWageEur: number;
  annualWageEur: number;
  contractYears: number;
  totalFirstYearCommitmentEur: number;
  totalContractCommitmentEur: number;
  isFreeTransfer: boolean;
  compensationDetails?: TrainingCompensationResultDetailed;
}

/** SHF 2026-2027 Swedish Handball Federation rate tables (approximate EUR conversion at ~11 SEK/EUR) */
export const SHF_2026_2027_TABLE = {
  version: "SHF_2026_2027_v1.0",
  minAge: 16,
  maxAge: 23,
  trainingStartAge: 12,
  trainingEndAge: 21,
  // Rates per season (EUR) based on acquiring club tier and training club tier
  // Tier 1 = Handbollsligan, Tier 2 = Allsvenskan, Tier 3 = Division 1 / Breddförening
  rates: {
    // Acquiring club is Handbollsligan (Tier 1)
    toTier1: {
      youth12to15: {
        fromTier1: 1100, // ~12,000 SEK
        fromTier2: 900,  // ~10,000 SEK
        fromOther: 650,  // ~7,000 SEK
      },
      junior16to21: {
        fromTier1: 2300, // ~25,000 SEK
        fromTier2: 1650, // ~18,000 SEK
        fromOther: 1100, // ~12,000 SEK
      },
    },
    // Acquiring club is Allsvenskan (Tier 2)
    toTier2: {
      youth12to15: {
        fromTier1: 750,  // ~8,000 SEK
        fromTier2: 550,  // ~6,000 SEK
        fromOther: 370,  // ~4,000 SEK
      },
      junior16to21: {
        fromTier1: 1375, // ~15,000 SEK
        fromTier2: 920,  // ~10,000 SEK
        fromOther: 650,  // ~7,000 SEK
      },
    },
    // Acquiring club is lower tier (Tier 3 or unknown)
    toTier3: {
      youth12to15: { fromTier1: 275, fromTier2: 275, fromOther: 275 },
      junior16to21: { fromTier1: 370, fromTier2: 370, fromOther: 370 },
    },
  },
} as const;

/** EHF / IHF International Transfer Certificate (ITC) Education Compensation (2026 regulation) */
export const EHF_IHF_2026_TABLE = {
  version: "EHF_IHF_ITC_2026_v1.0",
  minAge: 16,
  maxAge: 23,
  trainingStartAge: 16,
  trainingEndAge: 23,
  perSeasonEur: {
    category1Nation: 3500, // Sweden, Germany, France, Denmark, Spain, Hungary
    otherNation: 2000,
  },
} as const;

function resolveClubTier(clubId: string): 1 | 2 | 3 {
  const club = getClub(clubId);
  if (!club) return 3;
  const comp = getCompetition(club.competitionId);
  if (!comp) return 3;
  if (comp.tier === 1) return 1;
  if (comp.tier === 2) return 2;
  return 3;
}

function resolveClubNation(clubId: string): string {
  if (
    clubId.startsWith("ger_") ||
    clubId.startsWith("den_") ||
    clubId.startsWith("nor_") ||
    clubId.startsWith("esp_") ||
    clubId.startsWith("hun_") ||
    clubId.startsWith("fra_")
  ) {
    return clubId.slice(0, 3).toUpperCase();
  }
  const club = getClub(clubId);
  if (!club) return clubId.startsWith("se_") ? "SWE" : "INTL";
  const comp = getCompetition(club.competitionId);
  if (comp?.nation) return comp.nation;
  return (club as { countryCode?: string }).countryCode ?? (clubId.startsWith("se_") ? "SWE" : "INTL");
}

function resolveClubName(clubId: string): string {
  const club = getClub(clubId);
  return club?.name ?? clubId;
}

/**
 * Calculates training compensation under real SHF 2026-2027 and EHF/IHF regulations.
 */
export function calculatePlayerTrainingCompensation(
  state: CareerState,
  playerId: string,
  acquiringClubId?: string,
  sellingClubId?: string
): TrainingCompensationResultDetailed {
  const player = getCareerPlayer(state, playerId);
  if (!player) {
    return {
      totalEur: 0,
      perClub: [],
      ruleSetVersion: SHF_2026_2027_TABLE.version,
      isDomesticTransfer: true,
      isApproximation: false,
      documentationNote: "Spelaren hittades inte i spelarregistret.",
      playerAge: null,
      eligible: false,
    };
  }

  const age = playerAgeAtDate(player.dateOfBirth, player.birthYear, state.gameDate);
  const currentClubId = sellingClubId ?? player.clubId;
  const toClubId = acquiringClubId ?? state.playerClubId;

  // Age eligibility check: players aged 16 to 23 are eligible
  if (age === null || age < SHF_2026_2027_TABLE.minAge || age > SHF_2026_2027_TABLE.maxAge) {
    return {
      totalEur: 0,
      perClub: [],
      ruleSetVersion: SHF_2026_2027_TABLE.version,
      isDomesticTransfer: true,
      isApproximation: false,
      documentationNote: age !== null && age > SHF_2026_2027_TABLE.maxAge
        ? `Spelaren har fyllt ${age} år (övre åldersgräns för utbildningsersättning är ${SHF_2026_2027_TABLE.maxAge} år).`
        : "Spelaren är under minimiålder för övergångsavtal.",
      playerAge: age,
      eligible: false,
    };
  }

  const fromNation = resolveClubNation(currentClubId);
  const toNation = resolveClubNation(toClubId);
  const isDomestic = fromNation === toNation && fromNation === "SWE";

  // Reconstruct training spells:
  // 1. Prior historical clubs from playerClubHistory
  // 2. Current/departing club from arrivalAge up to current age (capped at 21)
  const history = getPlayerClubHistory(state, playerId);
  const pastEntries: PlayerClubHistoryEntry[] = history ? [...history.entries] : [];

  let isApproximation = false;
  let documentationNote = "Beräknad enligt Svenska Handbollförbundets reglemente 2026–2027.";

  const trainingSpells: { clubId: string; fromAge: number; toAge: number }[] = [];

  for (const entry of pastEntries) {
    const from = Math.max(SHF_2026_2027_TABLE.trainingStartAge, entry.fromAge);
    const to = Math.min(SHF_2026_2027_TABLE.trainingEndAge, entry.toAge);
    if (to > from) {
      trainingSpells.push({ clubId: entry.clubId, fromAge: from, toAge: to });
    }
  }

  // Current club spell
  const latestPastAge = pastEntries.length > 0
    ? Math.max(...pastEntries.map((e) => e.toAge))
    : SHF_2026_2027_TABLE.trainingStartAge;

  const currentClubFromAge = Math.max(SHF_2026_2027_TABLE.trainingStartAge, latestPastAge);
  const currentClubToAge = Math.min(SHF_2026_2027_TABLE.trainingEndAge, age);

  if (currentClubId && currentClubToAge > currentClubFromAge) {
    trainingSpells.push({
      clubId: currentClubId,
      fromAge: currentClubFromAge,
      toAge: currentClubToAge,
    });
  }

  if (pastEntries.length === 0 && (!currentClubId || currentClubToAge <= currentClubFromAge)) {
    isApproximation = true;
    documentationNote = "Ungdomsregistrering saknas i förbundsregistret – ingen ersättningsgrundande historik funnen.";
    return {
      totalEur: 0,
      perClub: [],
      ruleSetVersion: SHF_2026_2027_TABLE.version,
      isDomesticTransfer: isDomestic,
      isApproximation,
      documentationNote,
      playerAge: age,
      eligible: true,
    };
  }

  if (pastEntries.length === 0 && currentClubId) {
    isApproximation = true;
    documentationNote = "Ungdomsregistrering före seniorålder saknas – schablonberäkning baserad på känd klubbtillhörighet.";
  }

  const acquiringTier = resolveClubTier(toClubId);
  const perClub: TrainingClubShare[] = [];

  if (isDomestic) {
    // SHF 2026-2027 calculation
    const ratesForToTier = acquiringTier === 1
      ? SHF_2026_2027_TABLE.rates.toTier1
      : acquiringTier === 2
        ? SHF_2026_2027_TABLE.rates.toTier2
        : SHF_2026_2027_TABLE.rates.toTier3;

    for (const spell of trainingSpells) {
      const trainTier = resolveClubTier(spell.clubId);
      const tierKey = trainTier === 1 ? "fromTier1" : trainTier === 2 ? "fromTier2" : "fromOther";

      let amount = 0;
      let totalSeasons = 0;

      for (let y = spell.fromAge; y < spell.toAge; y++) {
        totalSeasons++;
        if (y < 16) {
          amount += ratesForToTier.youth12to15[tierKey];
        } else {
          amount += ratesForToTier.junior16to21[tierKey];
        }
      }

      if (totalSeasons > 0 && amount > 0) {
        perClub.push({
          clubId: spell.clubId,
          clubName: resolveClubName(spell.clubId),
          seasons: totalSeasons,
          fromAge: spell.fromAge,
          toAge: spell.toAge,
          amountEur: amount,
          isDomestic: true,
          ratePerSeasonEur: Math.round(amount / totalSeasons),
        });
      }
    }
  } else {
    // International transfer under EHF / IHF ITC rules
    documentationNote = "Beräknad enligt EHF/IHF International Transfer Certificate (ITC) Education Compensation.";
    const ratePerSeason = EHF_IHF_2026_TABLE.perSeasonEur.category1Nation;

    for (const spell of trainingSpells) {
      const start = Math.max(EHF_IHF_2026_TABLE.trainingStartAge, spell.fromAge);
      const end = Math.min(EHF_IHF_2026_TABLE.trainingEndAge, spell.toAge);
      const seasons = Math.max(0, end - start);

      if (seasons > 0) {
        const amount = seasons * ratePerSeason;
        perClub.push({
          clubId: spell.clubId,
          clubName: resolveClubName(spell.clubId),
          seasons,
          fromAge: start,
          toAge: end,
          amountEur: amount,
          isDomestic: false,
          ratePerSeasonEur: ratePerSeason,
        });
      }
    }
  }

  const totalEur = perClub.reduce((sum, c) => sum + c.amountEur, 0);

  return {
    totalEur,
    perClub,
    ruleSetVersion: isDomestic ? SHF_2026_2027_TABLE.version : EHF_IHF_2026_TABLE.version,
    isDomesticTransfer: isDomestic,
    isApproximation,
    documentationNote,
    playerAge: age,
    eligible: totalEur > 0,
  };
}

/**
 * Calculates complete acquisition cost breakdown, distinguishing fee, training compensation,
 * signing costs, and wage commitments.
 */
export function calculateAcquisitionCost(params: {
  transferFeeEur: number;
  trainingCompensationEur: number;
  signingCostsEur: number;
  monthlyWageEur: number;
  contractYears: number;
  compensationDetails?: TrainingCompensationResultDetailed;
}): AcquisitionCostBreakdown {
  const { transferFeeEur, trainingCompensationEur, signingCostsEur, monthlyWageEur, contractYears, compensationDetails } = params;
  const annualWageEur = monthlyWageEur * 12;
  const totalFirstYearCommitmentEur = transferFeeEur + trainingCompensationEur + signingCostsEur + annualWageEur;
  const totalContractCommitmentEur = transferFeeEur + trainingCompensationEur + signingCostsEur + (annualWageEur * Math.max(1, contractYears));

  return {
    transferFeeEur,
    trainingCompensationEur,
    signingCostsEur,
    monthlyWageEur,
    annualWageEur,
    contractYears,
    totalFirstYearCommitmentEur,
    totalContractCommitmentEur,
    isFreeTransfer: transferFeeEur === 0,
    compensationDetails,
  };
}
