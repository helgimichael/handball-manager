// HM-CPU-SQUAD-BUILDING-1.0: candidate discovery + ranking for a CPU
// club's own recruitment search. Reads the SAME career world every other
// system reads (worldSquads/gameplayRatings/playerContracts/clubEconomies)
// -- no separate CPU database, no fake data. Deterministic throughout
// (seededOffset jitter, never Math.random -- Part: "Ingen Math.random()...
// same career seed + same state -> same beslut").
import { positionLabel, type HandballPosition } from "../game-data";
import { getClubBudgets } from "../economy/clubEconomyIntegration";
import { getPlayerContract, getPlayerContractStatus, getPlayerMarketValueEur } from "../economy/contractIntegration";
import { assessTransferAffordability } from "../transfers/affordability";
import { competitionTierForClub } from "../transfers/transferExecution";
import { playerAgeAtDate } from "../development/developmentIntegration";
import { seededOffset } from "../rating/generation/deterministicVariation";
import { hasActivePendingTransfer } from "../transfers/transferIntegration";
import { getExternalCandidateClubs, WORLD_POOL_COMPETITION_IDS } from "./careerWorld";
import type { CareerState } from "./types";

/**
 * Part: "Starka svenska klubbar ska ibland kunna värva internationellt" --
 * a club's own top-of-squad level (Part: club-relative, not a fixed
 * absolute claim) determines how visible/attractive international (World
 * Pool) candidates are. HM-CPU-SQUAD-BUILDING-1.0B Part 10: the 1.0A
 * audit found the ORIGINAL hard cutoff here (`ownLevel < 130 -> entirely
 * invisible`) produced an artificial single-point cliff -- two clubs a
 * couple of CA points apart on either side of 130 had completely
 * different candidate pools. Replaced with a graduated, continuous
 * REACH PENALTY (see `internationalReachPenalty` below): score drops
 * smoothly the further below this reference point a club's own level
 * sits, with no single threshold flipping visibility on/off. A generous
 * outer bound (`INTERNATIONAL_REACH_HARD_FLOOR`) still exists so a
 * genuinely weak club can never realistically land a top international
 * player (Part: "Division 1-klubb ska normalt inte kunna locka
 * världsstjärnor" from the original 1.0 spec) -- but that boundary is
 * now 40 CA points wide, not one point.
 */
const INTERNATIONAL_REACH_CA_REFERENCE = 130;
const INTERNATIONAL_REACH_HARD_FLOOR = INTERNATIONAL_REACH_CA_REFERENCE - 40;
const INTERNATIONAL_REACH_PENALTY_PER_CA = 3;

/** How many of a club's own best-per-position ratings are averaged into its "own level" score -- one exact starting seven, the same shape as a real matchday XI. */
const OWN_LEVEL_POSITION_COUNT = 7;

function clubGameplayRating(state: CareerState, clubId: string, playerId: string): { ca: number; pa: number } | undefined {
  const rating = state.gameplayRatings[clubId]?.find((r) => r.playerId === playerId);
  return rating ? { ca: rating.ca, pa: rating.pa } : undefined;
}

/**
 * Part: "club level fit" -- a club's own best available CA per tracked
 * position, averaged. Reused both to gate international reach and to
 * score how large a step up/down a candidate represents.
 */
export function ownLevelScore(state: CareerState, clubId: string): number {
  const squad = state.worldSquads[clubId] ?? [];
  const bestPerPosition: number[] = [];
  const positions = new Set(squad.map((p) => p.position));
  for (const position of positions) {
    const best = squad
      .filter((p) => p.position === position)
      .map((p) => clubGameplayRating(state, clubId, p.id)?.ca ?? p.currentAbility)
      .sort((a, b) => b - a)[0];
    if (best !== undefined) bestPerPosition.push(best);
  }
  if (bestPerPosition.length === 0) return 0;
  const top = bestPerPosition.sort((a, b) => b - a).slice(0, OWN_LEVEL_POSITION_COUNT);
  return top.reduce((sum, v) => sum + v, 0) / top.length;
}

export interface CandidateScore {
  playerId: string;
  clubId: string;
  position: HandballPosition;
  ca: number;
  pa: number;
  age: number | null;
  contractStatus: ReturnType<typeof getPlayerContractStatus>;
  estimatedFeeEur: number;
  estimatedWageEurPerMonth: number;
  affordable: boolean;
  score: number;
  reason: string;
}

/**
 * Part: "CPU-klubb utan scout får fortfarande göra enkel domestic
 * recruitment, men med lägre reach/precision" -- reach: no scout means
 * the international (World Pool) pool is invisible entirely (only
 * domestic + Division 1 candidates are considered). Precision: no scout
 * widens the deterministic scoring jitter, so evaluation is noisier and
 * a CPU club can occasionally misjudge a candidate -- never a stored
 * trait, purely a wider deterministic spread on this one search.
 */
export function clubHasScout(state: CareerState, clubId: string): boolean {
  return (state.staffRoster[clubId] ?? []).some((m) => m.roles.includes("SCOUT"));
}

const SCOUTED_JITTER_MAGNITUDE = 6;
const UNSCOUTED_JITTER_MAGNITUDE = 22;

function ageScore(age: number | null): number {
  if (age === null) return 0;
  if (age >= 22 && age <= 29) return 6; // sweet spot -- established but years of resale/service left
  if (age < 22) return 3; // young, developing -- fine but less proven
  if (age <= 32) return 0; // still useful, no bonus
  return -8; // ageing signing, penalized
}

function contractSituationScore(status: ReturnType<typeof getPlayerContractStatus>): number {
  if (status === "FREE_AGENT") return 15;
  if (status === "EXPIRING") return 10;
  if (status === "EXPIRING_SOON") return 4;
  return 0;
}

/**
 * Ranks every real candidate at `position` from clubs other than
 * `buyerClubId`, using only real world facts (Part: "Hitta inte på dold
 * klubbkvalitet"). Returns best-first; an empty array means no viable
 * candidate exists this cycle (a legitimate outcome -- Part: "En billigare
 * alternativ ska kunna väljas" implies some candidates are filtered out
 * as too rich for the club's budget, not that one is force-picked anyway).
 */
export function rankCandidates(state: CareerState, buyerClubId: string, position: HandballPosition, date: string): CandidateScore[] {
  const budgets = getClubBudgets(state, buyerClubId);
  if (!budgets) return []; // Part: "Ingen gratis CPU-ekonomi" -- no budget data, no recruitment.

  const ownLevel = ownLevelScore(state, buyerClubId);
  const hasScout = clubHasScout(state, buyerClubId);
  const jitterMagnitude = hasScout ? SCOUTED_JITTER_MAGNITUDE : UNSCOUTED_JITTER_MAGNITUDE;

  const candidateClubs = getExternalCandidateClubs(state).filter((c) => c.id !== buyerClubId);
  const results: CandidateScore[] = [];

  for (const club of candidateClubs) {
    const isInternational = (WORLD_POOL_COMPETITION_IDS as readonly string[]).includes(club.competitionId);
    // Part: reach -- no scout means international candidates are entirely
    // invisible (a hard gate, unchanged from 1.0); a club whose own level
    // sits more than 40 CA below the reference point is still excluded
    // outright (Part: even a smooth model needs SOME outer bound so a
    // weak club can never realistically land a top international player).
    // Between the hard floor and the reference point, reach is graduated
    // via `internationalReachPenalty` in the score below -- never a
    // single-point cliff.
    if (isInternational && (!hasScout || ownLevel < INTERNATIONAL_REACH_HARD_FLOOR)) continue;
    const internationalReachPenalty = isInternational ? Math.max(0, INTERNATIONAL_REACH_CA_REFERENCE - ownLevel) * INTERNATIONAL_REACH_PENALTY_PER_CA : 0;

    const squad = state.worldSquads[club.id] ?? [];
    for (const player of squad) {
      if (player.position !== position) continue;
      if (state.playerStatuses[player.id]?.availability === "ON_PLACEMENT") continue; // not really available to sell right now.
      if (hasActivePendingTransfer(state, player.id)) continue; // HM-CPU-SQUAD-BUILDING-1.0B Part 1: already has a pending deal elsewhere -- never a viable candidate, checked here (not only at offer time) so a doomed candidate never wastes a pursuit slot.

      const rating = clubGameplayRating(state, club.id, player.id);
      const contract = getPlayerContract(state, player.id);
      if (!rating || !contract) continue; // defensive -- every real candidate should have both by this point in career setup.

      const marketValueEur = getPlayerMarketValueEur(state, player.id) ?? 0;
      const estimatedFeeEur = marketValueEur;
      const estimatedWageEurPerMonth = Math.round(contract.wageEurPerMonth * 1.1); // Part: a modest incentive above their current wage, grounded in real data -- never invented.

      const affordability = assessTransferAffordability(state, buyerClubId, estimatedFeeEur, 0, estimatedWageEurPerMonth);
      const contractStatus = getPlayerContractStatus(state, player.id);
      const age = playerAgeAtDate(player.dateOfBirth, player.birthYear, date);
      const buyerTier = competitionTierForClub(buyerClubId);
      const candidateTier = competitionTierForClub(club.id);
      const tierGapPenalty = buyerTier !== undefined && candidateTier !== undefined && candidateTier < buyerTier ? -4 : 0; // buying DOWN a tier is fine but slightly less exciting than a lateral/upward move -- never a hard block, existing club/player decision logic already gates unrealistic moves.
      const levelGapPenalty = Math.max(0, (rating.ca - ownLevel) * 0.15); // the further above the buyer's own level, the more of a reach -- soft, continuous, never a hard cutoff (real club/player decisions already reject an unrealistic offer on their own).

      const jitter = seededOffset(`${buyerClubId}:${player.id}:${date}:cpu-candidate-jitter`, jitterMagnitude);

      let score = rating.ca * 1.0 + Math.max(0, rating.pa - rating.ca) * 0.3 + ageScore(age) + contractSituationScore(contractStatus) + tierGapPenalty - levelGapPenalty - internationalReachPenalty + jitter;
      if (!affordability.affordable) score -= 1000; // Part: "för dyr kandidat ska kunna avvisas" -- still ranked/visible for explainability, but never chosen while unaffordable ones exist.

      const reasonParts = [`${positionLabel(position)}, nivå ${Math.round(rating.ca)}`, contractStatus === "FREE_AGENT" || contractStatus === "EXPIRING" ? "kontrakt går snart ut" : null, affordability.affordable ? "råd att värva" : `för dyr (${affordability.reasons.join(" ")})`].filter(Boolean);

      results.push({
        playerId: player.id,
        clubId: club.id,
        position,
        ca: rating.ca,
        pa: rating.pa,
        age,
        contractStatus,
        estimatedFeeEur,
        estimatedWageEurPerMonth,
        affordable: affordability.affordable,
        score,
        reason: reasonParts.join(", ") + ".",
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/** The best AFFORDABLE candidate, or undefined if none exists this cycle (Part: "billigare alternativ ska kunna väljas" -- an unaffordable top pick never blocks a cheaper viable one). */
export function bestAffordableCandidate(candidates: readonly CandidateScore[]): CandidateScore | undefined {
  return candidates.find((c) => c.affordable);
}
