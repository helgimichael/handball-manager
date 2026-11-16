// Arena Nights -- SQD-03 (A) "Market Workbench": one market table over every external player, with
// knowledge-gated ability / potential bands, a knowledge-gated value range, knowledge %, age, position and
// contract end; filters, saved searches and need-based presets derived from the real squad depth.
// Fog of war: external players are ONLY read through careerPlayerVisibility (abilityRange / potentialRange)
// and resolveMarketValueRange -- this model never exposes ca / pa or the raw attribute grid.
import type { CareerState } from "../career/types";
import type { PlayerMock } from "../game-data";
import { getClub } from "../game-data";
import { managementPlayers } from "../career/management";
import { isRetiredClubId } from "../career/playerLifecycle";
import { clubCompetitionId } from "../career/competitionMembership";
import { playerAgeAtDate } from "../development/developmentIntegration";
import { getPlayerContractStatus, getPlayerMarketValueEur } from "../economy/contractIntegration";
import { getPlayerKnowledgePct } from "../knowledge/knowledgeIntegration";
import { careerPlayerVisibility } from "../knowledge/careerVisibility";
import { resolveMarketValueRange } from "../knowledge/scoutReportVisibility";
import { knowledgeTier, type KnowledgeTier } from "../knowledge/types";
import type { StarRange } from "../knowledge/playerVisibility";
import { getCareerPlayerRating } from "../career/careerRatingNormalization";
import { positionDepth } from "../club/clubJournal";
import { rangeBarGeometry } from "./rangeBar";

export interface MarketRow {
  player: PlayerMock;
  id: string;
  name: string;
  clubId: string | null;
  clubName: string;
  position: string;
  secondaryPosition: string | null;
  nationality: string;
  competitionId: string | null;
  age: number | null;
  knowledge: number;
  tier: KnowledgeTier;
  /** Knowledge-gated star ranges (never the true value). */
  ability: StarRange | null;
  potential: StarRange | null;
  /** Knowledge-gated market value range (never the true value). */
  value: { min: number; max: number } | null;
  abilityMid: number | null;
  potentialMid: number | null;
  valueMid: number | null;
  contractEnd: string | null;
  contractStatus: string | null;
  goals: number;
}

export function buildMarketRows(state: CareerState): MarketRow[] {
  return managementPlayers(state)
    .filter((p) => p.clubId !== state.playerClubId && !isRetiredClubId(p.clubId))
    .map((p): MarketRow => {
      const knowledge = getPlayerKnowledgePct(state, p.id, p.clubId);
      const rating = getCareerPlayerRating(state, p.id, p.clubId);
      const vis = rating ? careerPlayerVisibility(state, rating, p.id, knowledge) : null;
      const trueValue = getPlayerMarketValueEur(state, p.id);
      const value = trueValue !== undefined ? resolveMarketValueRange(trueValue, knowledge, p.id) : null;
      const ability = vis?.abilityRange ?? null;
      const potential = vis?.potentialRange ?? null;
      return {
        player: p, id: p.id, name: `${p.firstName} ${p.lastName}`,
        clubId: p.clubId || null, clubName: p.clubId ? getClub(p.clubId)?.shortName ?? "Okänd klubb" : "Fri agent",
        position: p.position, secondaryPosition: p.secondaryPosition ?? null, nationality: p.nationality,
        competitionId: p.clubId ? clubCompetitionId(state, p.clubId) ?? null : null,
        age: playerAgeAtDate(p.dateOfBirth, p.birthYear, state.gameDate),
        knowledge: Math.round(knowledge), tier: knowledgeTier(knowledge),
        ability, potential, value,
        abilityMid: ability ? rangeBarGeometry(ability).mid : null,
        potentialMid: potential ? rangeBarGeometry(potential).mid : null,
        valueMid: value ? (value.min + value.max) / 2 : null,
        contractEnd: state.playerContracts[p.id]?.contractEndDate ?? null,
        contractStatus: getPlayerContractStatus(state, p.id) ?? null,
        goals: state.playerSeasonStats[p.id]?.goals ?? 0,
      };
    });
}

export type MarketContractFilter = "ALL" | "EXPIRING" | "FREE_AGENT";
export interface MarketFilter {
  query: string;
  position: string;
  league: string;
  nation: string;
  /** Empty = no limit. */
  maxAge: string;
  contract: MarketContractFilter;
  /** Minimum knowledge %, 0 = all. */
  minKnowledge: number;
}
export const EMPTY_MARKET_FILTER: MarketFilter = { query: "", position: "ALL", league: "ALL", nation: "ALL", maxAge: "", contract: "ALL", minKnowledge: 0 };

export type MarketSortKey = "name" | "age" | "knowledge" | "contract" | "goals" | "ability" | "potential" | "value";
export interface MarketSort { key: MarketSortKey; direction: "asc" | "desc" }

export function filterMarket(rows: readonly MarketRow[], f: MarketFilter): MarketRow[] {
  const term = f.query.trim().toLocaleLowerCase("sv");
  return rows.filter((r) =>
    (!term || `${r.name} ${r.clubName}`.toLocaleLowerCase("sv").includes(term)) &&
    (f.position === "ALL" || r.position === f.position || r.secondaryPosition === f.position) &&
    (f.league === "ALL" || r.competitionId === f.league) &&
    (f.nation === "ALL" || r.nationality === f.nation) &&
    (!f.maxAge || (r.age !== null && r.age <= Number(f.maxAge))) &&
    (f.contract === "ALL" || (f.contract === "FREE_AGENT" ? !r.clubId : r.contractStatus === "EXPIRING" || r.contractStatus === "EXPIRING_SOON")) &&
    r.knowledge >= f.minKnowledge);
}

const sortValue = (r: MarketRow, k: MarketSortKey): string | number | null =>
  k === "name" ? r.player.lastName : k === "contract" ? r.contractEnd : k === "ability" ? r.abilityMid : k === "potential" ? r.potentialMid : k === "value" ? r.valueMid : r[k];

/** Sorts by the chosen key; band columns sort by band midpoint; unknown values always last. */
export function sortMarket(rows: readonly MarketRow[], s: MarketSort): MarketRow[] {
  const dir = s.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = sortValue(a, s.key), bv = sortValue(b, s.key);
    if (av == null && bv == null) return a.name.localeCompare(b.name, "sv");
    if (av == null) return 1;
    if (bv == null) return -1;
    const c = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv, "sv") : Number(av) - Number(bv);
    return c * dir || a.name.localeCompare(b.name, "sv");
  });
}

export interface MarketPreset { id: string; label: string; reason: string; filter: MarketFilter; sort?: MarketSort }

/** Need-based presets from the real squad depth (positions with fewer than two available natural players) plus contract / age presets. */
export function marketPresets(state: CareerState): MarketPreset[] {
  const needs = positionDepth(state).filter((d) => d.tone !== "good").sort((a, b) => a.available - b.available);
  const presets: MarketPreset[] = needs.map((d) => ({
    id: `need-${d.position}`,
    label: `Behov: ${d.position}`,
    reason: `${d.available} av ${d.total} tillgängliga${d.secondary ? `, ${d.secondary} kan täcka` : ""}`,
    filter: { ...EMPTY_MARKET_FILTER, position: d.position },
    sort: { key: "ability", direction: "desc" },
  }));
  presets.push(
    { id: "expiring", label: "Utgående avtal", reason: "Avtal som löper ut inom ett år -- billigare att värva", filter: { ...EMPTY_MARKET_FILTER, contract: "EXPIRING" }, sort: { key: "ability", direction: "desc" } },
    { id: "free", label: "Fria agenter", reason: "Ingen övergångssumma", filter: { ...EMPTY_MARKET_FILTER, contract: "FREE_AGENT" }, sort: { key: "ability", direction: "desc" } },
    { id: "young", label: "Unga talanger", reason: "21 år eller yngre, sorterat på bedömd potential", filter: { ...EMPTY_MARKET_FILTER, maxAge: "21" }, sort: { key: "potential", direction: "desc" } },
    { id: "known", label: "Välkända", reason: "Minst 50 % kännedom -- säkrare bedömningar", filter: { ...EMPTY_MARKET_FILTER, minKnowledge: 50 }, sort: { key: "ability", direction: "desc" } },
  );
  return presets;
}

export interface SavedMarketSearch { id: string; name: string; filter: MarketFilter }

/** Adds (or replaces by name) a saved search; pure, returns a new list. */
export function saveMarketSearch(list: readonly SavedMarketSearch[], name: string, filter: MarketFilter): SavedMarketSearch[] {
  const clean = name.trim();
  if (!clean) return [...list];
  const id = `s-${clean.toLocaleLowerCase("sv").replace(/[^a-z0-9åäö]+/g, "-")}`;
  return [...list.filter((s) => s.id !== id), { id, name: clean, filter: { ...filter } }];
}

/** Short Swedish description of an active filter, for saved-search chips. */
export function describeMarketFilter(f: MarketFilter): string {
  const parts: string[] = [];
  if (f.query) parts.push(`"${f.query}"`);
  if (f.position !== "ALL") parts.push(f.position);
  if (f.maxAge) parts.push(`≤ ${f.maxAge} år`);
  if (f.nation !== "ALL") parts.push(f.nation);
  if (f.league !== "ALL") parts.push("en tävling");
  if (f.contract === "EXPIRING") parts.push("utgående avtal");
  if (f.contract === "FREE_AGENT") parts.push("fria agenter");
  if (f.minKnowledge) parts.push(`kännedom ≥ ${f.minKnowledge} %`);
  return parts.join(" · ") || "Alla spelare";
}
