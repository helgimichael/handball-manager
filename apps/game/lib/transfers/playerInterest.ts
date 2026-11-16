// HM-PLAYTEST-IMPROVEMENT-02 / HM-TRANSFER-REALISM-1.0: Player Interest.
//
// Separates database visibility from willingness to sign. Since
// HM-TRANSFER-REALISM-1.0 this is no longer a model of its own: the interest
// level is a PROJECTION of the shared Player Career Decision Model -- the wage
// the player would need to join this club (with the role his ability earns
// there, on a three-year deal) relative to his market wage. "IMPOSSIBLE"
// means no wage makes the move acceptable (sporting floor, a far better
// alternative). The same model answers CPU clubs, rival clubs and the
// manager, so the manager can never be refused by a player who would then
// sign for a weaker CPU club on similar terms.
import type { CareerState } from "../career/types";
import { getCareerPlayer } from "../career/careerWorld";
import { getCompetition } from "../game-data";
import { getClubBudgets } from "../economy/clubEconomyIntegration";
import type { SquadStatusTier } from "../career/squadStatus";
import { explainedWageDemand, playerCareerProfile, playerCAInWorld } from "./careerDecision/stateAdapter";
import { clubLeagueId, environmentLevelOf } from "./careerDecision/sportingStrength";

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
  /** Kept for API stability: the PCDM demand already contains every premium, so this is always 1.0. */
  wagePremiumMultiplier: number;
}

export type InterestFilter = "ALL" | "REALISTIC" | "PERSUADABLE";

const LEVEL_PRESENTATION: Record<PlayerInterestLevel, { label: string; tone: PlayerInterestEvaluation["tone"] }> = {
  HIGH: { label: "Mycket intresserad", tone: "positive" },
  INTERESTED: { label: "Intresserad", tone: "positive" },
  UNSURE: { label: "Möjligen övertalbar", tone: "caution" },
  UNLIKELY: { label: "Osannolikt mål", tone: "caution" },
  IMPOSSIBLE: { label: "Helt ointresserad", tone: "negative" },
};

/** Demand / market wage thresholds for each interest level. */
const LEVEL_BY_RATIO: readonly [number, PlayerInterestLevel][] = [
  [1.0, "HIGH"],
  [1.25, "INTERESTED"],
  [1.6, "UNSURE"],
  [2.4, "UNLIKELY"],
];

function leagueName(state: CareerState, clubId: string): string {
  const id = clubLeagueId(state, clubId);
  return (id && getCompetition(id)?.name) || "den serien";
}

export function evaluatePlayerInterest(state: CareerState, playerId: string, toClubId: string = state.playerClubId): PlayerInterestEvaluation {
  const player = getCareerPlayer(state, playerId);
  const base = { playerId, toClubId, wagePremiumMultiplier: 1.0 };
  if (!player) {
    return { ...base, interestLevel: "IMPOSSIBLE", score: 0, label: "Okänd spelare", tone: "negative", reason: "Spelaren hittades inte i databasen.", willEnterNegotiations: false };
  }
  if (player.clubId === toClubId) {
    return { ...base, interestLevel: "HIGH", score: 100, label: "Tillhör klubben", tone: "positive", reason: "Spelaren spelar redan i din klubb.", willEnterNegotiations: true };
  }

  const demand = explainedWageDemand(state, playerId, toClubId, { contractYears: 3 });
  const profile = playerCareerProfile(state, playerId);
  if (!demand || !profile) {
    return { ...base, interestLevel: "IMPOSSIBLE", score: 0, label: "Okänd spelare", tone: "negative", reason: "Spelaren hittades inte i databasen.", willEnterNegotiations: false };
  }

  const reference = profile.referenceWageEurPerMonth;
  const budgets = getClubBudgets(state, toClubId);
  const wageCeiling = budgets ? (budgets.wageBudgetEur / 12) * 0.25 : Infinity;
  const ratio = demand.refusesRole ? Infinity : demand.demandEurPerMonth / reference;
  let level: PlayerInterestLevel = "IMPOSSIBLE";
  for (const [limit, l] of LEVEL_BY_RATIO) {
    if (ratio <= limit) {
      level = l;
      break;
    }
  }
  // A demand far beyond what the club's wage structure can ever carry is not a realistic target either.
  if (level !== "IMPOSSIBLE" && demand.demandEurPerMonth > wageCeiling * 1.5) level = "UNLIKELY";

  const score = Number.isFinite(ratio) ? Math.max(0, Math.min(100, Math.round(100 - (ratio - 0.6) * 55))) : 0;
  const rating = playerCAInWorld(state, playerId);
  const stepUp = rating ? environmentLevelOf(state, toClubId) > environmentLevelOf(state, player.clubId || toClubId) + 3 : false;
  const stepDown = rating ? environmentLevelOf(state, toClubId) < environmentLevelOf(state, player.clubId || toClubId) - 6 : false;
  const league = leagueName(state, toClubId);
  const homecoming = demand.factors.some((f) => f.includes("personlig koppling"));
  const freeAgent = player.clubId === "";

  let reason: string;
  if (level === "IMPOSSIBLE") {
    if (stepDown || demand.factors.some((f) => f.includes("sportsliga nivån är för låg"))) reason = `Anser att nivån i ${league} är för låg i nuvarande skede av karriären.`;
    else if (demand.factors.includes("Har alternativ utomlands.")) reason = "Har betydligt bättre alternativ utomlands.";
    else reason = "Ser ingen anledning att byta klubb just nu.";
  } else if (homecoming) {
    reason = "Har stark koppling till klubben sedan tidigare och lockas av en återkomst.";
  } else if (level === "HIGH" || level === "INTERESTED") {
    if (stepUp) reason = `Attraheras av chansen att ta klivet till ${league}.`;
    else if (freeAgent) reason = "Kontraktslös och aktivt på jakt efter en ny klubb med en tydlig roll.";
    else if (profile.memberships.YOUNG_TALENT + profile.memberships.DEVELOPMENT > 0.5) reason = "Söker regelbunden speltid och lockas av en bärande roll i laget.";
    else reason = "Öppen för en övergång och bedömer att klubbens nivå och ambitioner matchar den egna profilen.";
  } else if (stepDown) {
    reason = `Kan överväga spel i ${league} om klubben erbjuder en tydlig ledarroll och ett kraftigt lönelyft.`;
  } else {
    reason = "Trivs i nuvarande miljö men kan överväga en flytt vid ett kännbart lönelyft och en tydlig roll.";
  }

  return {
    ...base,
    interestLevel: level,
    score,
    ...LEVEL_PRESENTATION[level],
    reason,
    willEnterNegotiations: level !== "IMPOSSIBLE",
    ...(level === "UNSURE" || level === "UNLIKELY" ? { minimumRequiredRole: demand.expectedRole } : {}),
  };
}

/**
 * Filter predicate based on manager interest filter.
 */
export function matchesInterestFilter(interest: PlayerInterestEvaluation, filter: InterestFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "REALISTIC") return interest.interestLevel === "HIGH" || interest.interestLevel === "INTERESTED";
  if (filter === "PERSUADABLE") return interest.interestLevel === "HIGH" || interest.interestLevel === "INTERESTED" || interest.interestLevel === "UNSURE";
  return true;
}
