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

export type TransferCategory = "PROFESSIONAL" | "AMATEUR" | "ADMINISTRATIVE_FEE" | "NATIONAL_TEAM";

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
  compensationEur: number;
  administrativeFeeEur: number;
  category: TransferCategory;
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

export const SHF_KPI_ADJUSTMENT_2026_2027 = 1.27;

/** SHF 2026-2027 Swedish Handball Federation rate tables with official 1.27 KPI adjustment applied */
export const SHF_2026_2027_TABLE = {
  version: "SHF_2026_2027_v1.1_KPI1.27",
  kpiAdjustment: SHF_KPI_ADJUSTMENT_2026_2027,
  minAge: 16,
  maxAge: 23,
  trainingStartAge: 12,
  trainingEndAge: 21,
  adminFeeSek: 2500,
  adminFeeEur: 220,
  // Rates per season (EUR) based on acquiring club tier and training club tier,
  // calculated from base SEK multiplied by the official KPI factor 1.27 (~11 SEK/EUR):
  rates: {
    // Acquiring club is Handbollsligan (Tier 1)
    toTier1: {
      youth12to15: {
        fromTier1: 1385, // 12,000 SEK * 1.27 = 15,240 SEK (~1,385 EUR)
        fromTier2: 1155, // 10,000 SEK * 1.27 = 12,700 SEK (~1,155 EUR)
        fromOther: 808,  // 7,000 SEK * 1.27 = 8,890 SEK (~808 EUR)
      },
      junior16to21: {
        fromTier1: 2886, // 25,000 SEK * 1.27 = 31,750 SEK (~2,886 EUR)
        fromTier2: 2078, // 18,000 SEK * 1.27 = 22,860 SEK (~2,078 EUR)
        fromOther: 1385, // 12,000 SEK * 1.27 = 15,240 SEK (~1,385 EUR)
      },
    },
    // Acquiring club is Allsvenskan (Tier 2)
    toTier2: {
      youth12to15: {
        fromTier1: 924,  // 8,000 SEK * 1.27 = 10,160 SEK (~924 EUR)
        fromTier2: 693,  // 6,000 SEK * 1.27 = 7,620 SEK (~693 EUR)
        fromOther: 462,  // 4,000 SEK * 1.27 = 5,080 SEK (~462 EUR)
      },
      junior16to21: {
        fromTier1: 1732, // 15,000 SEK * 1.27 = 19,050 SEK (~1,732 EUR)
        fromTier2: 1155, // 10,000 SEK * 1.27 = 12,700 SEK (~1,155 EUR)
        fromOther: 808,  // 7,000 SEK * 1.27 = 8,890 SEK (~808 EUR)
      },
    },
    // Acquiring club is lower tier (Tier 3 or unknown)
    toTier3: {
      youth12to15: {
        fromTier1: 346,  // 3,000 SEK * 1.27 = 3,810 SEK (~346 EUR)
        fromTier2: 346,
        fromOther: 346,
      },
      junior16to21: {
        fromTier1: 577,  // 5,000 SEK * 1.27 = 6,350 SEK (~577 EUR)
        fromTier2: 577,
        fromOther: 577,
      },
    },
  },
} as const;

/** EHF / IHF International Transfer Certificate (ITC) Education Compensation (2026/27 regulation) */
export const EHF_IHF_2026_TABLE = {
  version: "EHF_IHF_ITC_2026_2027_v1.1",
  minAge: 16,
  maxAge: 23,
  trainingStartAge: 16,
  trainingEndAge: 23,
  ihfBaseAmountChf: 3500, // IHF standard base: CHF 3,500
  // Official EHF 2026/2027 conversion rate for professional season is EUR 3,810 (not EUR 3,500)
  professionalSeasonEur: 3810,
  amateurSeasonEur: 1630, // CHF 1,500 converted at EHF 2026/27 rate = EUR 1,630
  itcAdminFeeProfessionalEur: 1500,
  itcAdminFeeAmateurEur: 500,
  perSeasonEur: {
    category1Nation: 3810, // Sweden, Germany, France, Denmark, Spain, Hungary (EUR 3,810)
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
  sellingClubId?: string,
  category: TransferCategory = "PROFESSIONAL"
): TrainingCompensationResultDetailed {
  const player = getCareerPlayer(state, playerId);
  if (!player) {
    return {
      totalEur: 0,
      compensationEur: 0,
      administrativeFeeEur: 0,
      category,
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
      compensationEur: 0,
      administrativeFeeEur: 0,
      category,
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
  let documentationNote = `Beräknad enligt Svenska Handbollförbundets reglemente 2026–2027 (KPI-justering ${SHF_KPI_ADJUSTMENT_2026_2027}).`;

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
      compensationEur: 0,
      administrativeFeeEur: 0,
      category,
      perClub: [],
      ruleSetVersion: SHF_2026_2027_TABLE.version,
      isDomesticTransfer: isDomestic,
      isApproximation,
      documentationNote,
      playerAge: age,
      eligible: false,
    };
  }

  if (pastEntries.length === 0 && currentClubId) {
    isApproximation = true;
    documentationNote = `Ungdomsregistrering före seniorålder saknas – schablonberäkning baserad på känd klubbtillhörighet (KPI-justering ${SHF_KPI_ADJUSTMENT_2026_2027}).`;
  }

  const acquiringTier = resolveClubTier(toClubId);
  const perClub: TrainingClubShare[] = [];
  let administrativeFeeEur = 0;

  if (isDomestic) {
    // SHF 2026-2027 calculation with official 1.27 KPI multiplier
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

    if (perClub.length > 0) {
      administrativeFeeEur = SHF_2026_2027_TABLE.adminFeeEur;
    }
  } else {
    // International transfer under EHF / IHF ITC rules (2026/27 official conversion rate: EUR 3,810 per pro season)
    documentationNote = `Beräknad enligt EHF/IHF ITC Education Compensation 2026/27 (${category === "AMATEUR" ? "Amatör EUR 1 630" : "Professionell EUR 3 810/säsong"}).`;
    const ratePerSeason = category === "AMATEUR"
      ? EHF_IHF_2026_TABLE.amateurSeasonEur
      : EHF_IHF_2026_TABLE.professionalSeasonEur;

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

    if (perClub.length > 0) {
      administrativeFeeEur = category === "AMATEUR"
        ? EHF_IHF_2026_TABLE.itcAdminFeeAmateurEur
        : EHF_IHF_2026_TABLE.itcAdminFeeProfessionalEur;
    }
  }

  const compensationEur = perClub.reduce((sum, c) => sum + c.amountEur, 0);
  const totalEur = compensationEur > 0 ? compensationEur + administrativeFeeEur : 0;

  return {
    totalEur,
    compensationEur,
    administrativeFeeEur,
    category,
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
