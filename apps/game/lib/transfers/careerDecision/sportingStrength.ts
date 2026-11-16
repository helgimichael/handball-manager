// HM-TRANSFER-REALISM-1.0 M1: league and club sporting strength on ONE
// cross-league scale.
//
// Competition `tier` (1/2) stays the rulebook value (promotion, relegation,
// wage scale). It is no longer an attractiveness signal: Division 1 and
// Allsvenskan share tier 2, and every foreign top flight shares tier 1, so a
// tier says nothing about how good a league is.
//
// Club level   = ownLevelScore(): the mean of the club's best CA per position
//                (one starting seven), from live gameplayRatings.
// League level = a robust upper statistic (60th percentile) of its clubs'
//                levels, on the SAME CA scale for every league -- never a
//                per-league percentile normalisation. World-pool clubs only
//                hold the slice of their real squad the international pool
//                covers, so their measured level rests on few players. Each
//                league therefore blends its measurement with an existing,
//                documented prior (the international population model's own
//                per-competition baseline, the Swedish population baselines)
//                weighted by how much evidence it has: full Swedish leagues
//                are ~100 % measured, a two-player pool league leans on its
//                prior. The prior is converted onto the club-level scale with
//                an offset measured from the Swedish leagues themselves.
// Smoothing    = at each season rollover the persisted level moves half way
//                to the new measurement (state.transferMarket, optional; an
//                old save without it simply uses the live measurement).
// Prestige     = LEAGUE_PRESTIGE below: small, documented, sporting-context
//                adjustments only.
import { getClub, getClubsByCompetition, getCompetition } from "../../game-data";
import { clubCompetitionId } from "../../career/competitionMembership";
import { ownLevelScore } from "../../career/cpuCandidateEvaluation";
import { SWEDISH_WORLD_COMPETITION_IDS } from "../../career/worldCompetitions";
import { WORLD_POOL_COMPETITION_IDS } from "../../career/careerWorld";
import type { CareerState } from "../../career/types";

/**
 * Prior player-population baseline CA per competition. Swedish values are the
 * game-prior population model's own baselines (STANDARD 122 for Handbollsligan
 * and Allsvenskan, DIVISION_1 90); the international values are the
 * INTERNATIONAL_TIER_PROFILES baselines (lib/rating/gamePrior/clubContextTier.ts)
 * for each competition's documented tier. Handbollsligan vs Allsvenskan is
 * separated by measurement, which dominates for full Swedish leagues.
 */
export const LEAGUE_POPULATION_PRIOR_CA: Readonly<Record<string, number>> = {
  se_handbollsligan_herr: 122,
  "swe-2": 122,
  se_division1_norra: 90,
  se_division1_sodra: 90,
  "ger-1": 130,
  "esp-1": 122,
  "den-1": 122,
  "hun-1": 122,
  "nor-1": 112,
  "isl-1": 112,
  "int-che-1": 100,
  "int-aut-1": 100,
  "int-pol-1": 100,
  "int-por-1": 100,
  "int-ita-1": 90,
  "int-qat-1": 90,
  "int-hun-2b": 90,
  "int-fro-1": 80,
  "int-ned-1": 80,
  "int-ita-2": 80,
};

/**
 * Documented prestige adjustment (CA-scale points) for leagues whose clubs are
 * regular EHF Champions League participants -- the competition a player gains
 * by playing there, on top of the domestic level. Small by design: it orders
 * near-equal leagues, it never overrides a real level gap.
 */
export const LEAGUE_PRESTIGE: Readonly<Record<string, number>> = {
  "ger-1": 6,
  "den-1": 5,
  "esp-1": 5,
  "hun-1": 5,
};

/** Evidence (rated players) a prior is worth: two full squads. */
const PRIOR_WEIGHT_PLAYERS = 40;
/**
 * A club counts towards its LEAGUE's measurement only with at least a starting
 * seven of rated players. World-pool clubs hold only the slice of their real
 * squad the international pool covers (often one star plus a youth prospect),
 * so a league median over them is noise; their own CLUB level is still
 * measured and used.
 */
const MEASURABLE_SQUAD_MIN = 7;
const LEAGUE_QUANTILE = 0.6;
/** Share of a club's own level vs its league's level in the environment a player joins. */
export const CLUB_LEVEL_SHARE = 0.65;
export const SMOOTHING_ALPHA = 0.5;

export const ALL_MARKET_COMPETITION_IDS: readonly string[] = [...SWEDISH_WORLD_COMPETITION_IDS, ...WORLD_POOL_COMPETITION_IDS];

export interface StrengthTable {
  /** Measured or blended level per competition, CA scale, prestige excluded. */
  leagueLevel: Record<string, number>;
  /** Live club level (ownLevelScore) per club with a squad. */
  clubLevel: Record<string, number>;
  /** competitionId per club (membership-aware). */
  clubCompetition: Record<string, string>;
  /** Sorted CA of every rated player at a club -- for world percentiles. */
  sortedCA: number[];
}

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return NaN;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))]!;
}

let cacheKey: { ratings: unknown; squads: unknown; membership: unknown; persisted: unknown } | undefined;
let cacheValue: StrengthTable | undefined;

/** One computation per distinct world (ratings/squads/membership identity) -- pure and memoised. */
export function strengthTable(state: CareerState): StrengthTable {
  if (cacheKey && cacheValue && cacheKey.ratings === state.gameplayRatings && cacheKey.squads === state.worldSquads && cacheKey.membership === state.competitionMembership && cacheKey.persisted === state.transferMarket) {
    return cacheValue;
  }
  const measured = measureLeagues(state);
  const persisted = state.transferMarket?.leagueStrength?.levels;
  const leagueLevel: Record<string, number> = {};
  for (const [competitionId, level] of Object.entries(measured.leagueLevel)) {
    leagueLevel[competitionId] = persisted?.[competitionId] ?? level;
  }
  cacheValue = { ...measured, leagueLevel };
  cacheKey = { ratings: state.gameplayRatings, squads: state.worldSquads, membership: state.competitionMembership, persisted: state.transferMarket };
  return cacheValue;
}

/** Fresh measurement with no smoothing -- what a season rollover blends in. */
export function measureLeagues(state: CareerState): StrengthTable {
  const clubLevel: Record<string, number> = {};
  const clubCompetition: Record<string, string> = {};
  const byLeague = new Map<string, { levels: number[]; players: number; caSum: number }>();
  const allCA: number[] = [];

  for (const [clubId, squad] of Object.entries(state.worldSquads)) {
    if (!getClub(clubId)) continue; // free agents / retired / unknown keys
    const competitionId = clubCompetitionId(state, clubId);
    if (!competitionId) continue;
    clubCompetition[clubId] = competitionId;
    const ratings = state.gameplayRatings[clubId] ?? [];
    for (const r of ratings) allCA.push(r.ca);
    if (squad.length === 0) continue;
    const level = ownLevelScore(state, clubId);
    if (level <= 0) continue;
    clubLevel[clubId] = level;
    if (ratings.length < MEASURABLE_SQUAD_MIN) continue;
    const entry = byLeague.get(competitionId) ?? { levels: [], players: 0, caSum: 0 };
    entry.levels.push(level);
    entry.players += ratings.length;
    for (const r of ratings) entry.caSum += r.ca;
    byLeague.set(competitionId, entry);
  }

  // Offset from a population-baseline CA onto the club-level (best seven) scale,
  // measured on the Swedish leagues where both are known with full squads.
  const offsets: number[] = [];
  for (const id of SWEDISH_WORLD_COMPETITION_IDS) {
    const entry = byLeague.get(id);
    const prior = LEAGUE_POPULATION_PRIOR_CA[id];
    if (!entry || prior === undefined || entry.levels.length === 0) continue;
    const sorted = [...entry.levels].sort((a, b) => a - b);
    offsets.push(quantile(sorted, LEAGUE_QUANTILE) - prior);
  }
  const offset = offsets.length > 0 ? offsets.reduce((a, b) => a + b, 0) / offsets.length : 18;

  const leagueLevel: Record<string, number> = {};
  for (const competitionId of new Set([...byLeague.keys(), ...Object.keys(LEAGUE_POPULATION_PRIOR_CA)])) {
    const entry = byLeague.get(competitionId);
    const priorCA = LEAGUE_POPULATION_PRIOR_CA[competitionId];
    const prior = priorCA !== undefined ? priorCA + offset : undefined;
    if (!entry || entry.levels.length === 0) {
      if (prior !== undefined) leagueLevel[competitionId] = prior;
      continue;
    }
    const sorted = [...entry.levels].sort((a, b) => a - b);
    const m = quantile(sorted, LEAGUE_QUANTILE);
    leagueLevel[competitionId] = prior === undefined ? m : (entry.players * m + PRIOR_WEIGHT_PLAYERS * prior) / (entry.players + PRIOR_WEIGHT_PLAYERS);
  }

  return { leagueLevel, clubLevel, clubCompetition, sortedCA: allCA.sort((a, b) => a - b) };
}

export function leagueLevelOf(state: CareerState, competitionId: string | undefined): number {
  if (!competitionId) return NaN;
  const t = strengthTable(state);
  return (t.leagueLevel[competitionId] ?? NaN) + (LEAGUE_PRESTIGE[competitionId] ?? 0);
}

export function clubLeagueId(state: CareerState, clubId: string): string | undefined {
  return strengthTable(state).clubCompetition[clubId] ?? clubCompetitionId(state, clubId);
}

/** A club's own level; a club with no rated squad takes its league's level. */
export function clubLevelOf(state: CareerState, clubId: string): number {
  const t = strengthTable(state);
  const own = t.clubLevel[clubId];
  if (own !== undefined) return own;
  const league = leagueLevelOf(state, clubLeagueId(state, clubId));
  return Number.isFinite(league) ? league : 100;
}

/** The sporting environment a player joins: mostly the club, partly the league around it. */
export function environmentLevelOf(state: CareerState, clubId: string): number {
  const club = clubLevelOf(state, clubId);
  const league = leagueLevelOf(state, clubLeagueId(state, clubId));
  return Number.isFinite(league) ? CLUB_LEVEL_SHARE * club + (1 - CLUB_LEVEL_SHARE) * league : club;
}

/** Share of rated players at clubs with CA strictly below `ca` (0..1). */
export function worldPercentileOf(state: CareerState, ca: number): number {
  const sorted = strengthTable(state).sortedCA;
  if (sorted.length === 0) return 0.5;
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]! < ca) lo = mid + 1;
    else hi = mid;
  }
  return lo / sorted.length;
}

export function clubNation(state: CareerState, clubId: string): string | undefined {
  const competitionId = clubLeagueId(state, clubId);
  return competitionId ? getCompetition(competitionId)?.nation : undefined;
}

/** Every world-pool club that currently exists in the career world. */
export function worldPoolClubIds(state: CareerState): string[] {
  return WORLD_POOL_COMPETITION_IDS.flatMap((id) => getClubsByCompetition(id)).map((c) => c.id).filter((id) => state.worldSquads[id] !== undefined);
}

/**
 * Season rollover: persist the smoothed league levels. Called once per new
 * season; the first call seeds with the raw measurement.
 */
export function rollLeagueStrength(state: CareerState, seasonKey: string): CareerState {
  if (state.transferMarket?.leagueStrength?.seasonKey === seasonKey) return state;
  const measured = measureLeagues(state).leagueLevel;
  const previous = state.transferMarket?.leagueStrength?.levels;
  const levels: Record<string, number> = {};
  for (const [id, level] of Object.entries(measured)) {
    const prev = previous?.[id];
    levels[id] = Math.round((prev === undefined ? level : prev + SMOOTHING_ALPHA * (level - prev)) * 10) / 10;
  }
  return { ...state, transferMarket: { ...state.transferMarket, leagueStrength: { seasonKey, levels } } };
}
