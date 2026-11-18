// HM-TRANSFER-REALISM M8A: international youth intake.
//
// THE DEFECT. World-pool clubs (Bundesliga, Herreligaen, ASOBAL, ...) are
// represented by the visible slice of their squads -- 100 players over 29 clubs
// at career start, capacity INTERNATIONAL_SQUAD_CAPACITY each. Nothing ever
// replenished that slice: Swedish youth intake runs only for Swedish clubs, so
// the international population could only shrink. A 20-season simulation
// measured ~175 international players at season 10 and 29 at season 20, and
// world-class presence in European leagues fell to zero.
//
// THE ABSTRACTION. A world-pool club does not run a modelled academy. Once a
// year (1 July, with the Swedish intake) a club with free slots may promote a
// prospect into its visible professional slice: an 18-20-year-old who has
// come through that country's youth system. The volume is small and
// self-regulating (a club at capacity takes nobody), so intake replaces what
// retirement, release and transfers remove instead of inflating the world.
//
// QUALITY FOLLOWS THE COUNTRY'S SPORTING LEVEL. Potential is drawn around the
// club's own league level as measured by sportingStrength.ts (the same
// comparable CA scale every transfer decision uses), so a Bundesliga club's
// prospects are better on average than an Austrian or Italian club's -- the
// talent distribution differs per country because the measured league levels
// differ, not because of a hand-set table. The draw is a symmetric triangular
// spread, so an exceptional prospect is possible everywhere but rare, and a
// world-class prospect (PA well above an elite league's level) is genuinely
// unusual. Current ability starts well below potential and grows through the
// world development pass like every other player's.
//
// Ownership, contract and identity go through the canonical records exactly as
// youthIntake.ts does: one owner, one contract, a unique playerId
// (`intl-youth-<club>-<year>-<i>`), deterministic draws from the save seed.
import { getCompetition, type HandballPosition, type NationCode, type PlayerMock } from "../game-data";
import { seededOffset } from "../rating/generation/deterministicVariation";
import { PA_MAX } from "../rating/types";
import { mapHandballPositionToMatchPlanPosition } from "../matchPlan/careerSquadBridge";
import { generateInitialContract } from "../economy/contractGeneration";
import type { EconomyProfileInputs } from "../economy/marketValue";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import type { PlayerContract } from "../economy/types";
import { generateYouthGameplayRating, legacyAttributesFromCA } from "./youthIntake";
import { generateInternationalYouthName } from "./internationalYouthNames";
import { worldPoolCareerClubIds } from "./careerWorld";
import { clubCompetitionId } from "./competitionMembership";
import type { CareerState } from "./types";

export const INTERNATIONAL_YOUTH_INTAKE_MMDD = "07-01";
/** Mirrors stateAdapter.ts INTERNATIONAL_SQUAD_CAPACITY (kept local to avoid a career -> transfers import cycle; asserted equal in tests). */
export const INTERNATIONAL_YOUTH_SQUAD_CAPACITY = 10;
/** Share of prospects carrying the club's own nationality; the rest come from other nationalities present in the league. */
const HOME_NATION_SHARE = 0.85;
/** Potential is centred this far below the league level: most prospects become solid professionals, not stars. */
const PA_CENTRE_BELOW_LEAGUE = 6;
/** Half-width of each of the two uniform draws whose sum gives the triangular PA spread. */
const PA_HALF_SPREAD = 14;
const INTERNATIONAL_PA_CEILING = 190;
/** Readiness gap (PA - CA) by age at promotion. */
const READINESS_GAP_BY_AGE: Record<number, number> = { 18: 46, 19: 39, 20: 32 };
const CA_FLOOR = 50;
const POSITIONS: readonly HandballPosition[] = ["MV", "V6", "H6", "V9", "M9", "H9", "M6"];
const POSITION_WEIGHTS: Record<HandballPosition, number> = { MV: 12, V6: 15, H6: 15, V9: 16, M9: 16, H9: 15, M6: 11 };

function seededIndex(seedKey: string, n: number): number {
  return Math.abs(seededOffset(seedKey, n * 7)) % n;
}
function unit(seedKey: string): number {
  return seededIndex(seedKey, 10_000) / 10_000;
}

/** 0 (35%), 1 (50%) or 2 (15%) prospects, never more than the free slots. */
export function internationalIntakeSize(saveSeed: string, clubId: string, year: number, freeSlots: number): number {
  if (freeSlots <= 0) return 0;
  const roll = seededIndex(`${saveSeed}:${clubId}:${year}:intl-intake-size`, 100);
  const size = roll < 35 ? 0 : roll < 85 ? 1 : 2;
  return Math.min(size, freeSlots);
}

/**
 * Position: the base youth weights, with the club's missing positions in its
 * visible slice favoured (squad balance), deterministic.
 */
function pickPosition(seedKey: string, squad: readonly PlayerMock[]): HandballPosition {
  const counts = new Map<HandballPosition, number>();
  for (const p of squad) counts.set(p.position, (counts.get(p.position) ?? 0) + 1);
  const weights = POSITIONS.map((pos) => POSITION_WEIGHTS[pos] / (1 + (counts.get(pos) ?? 0)));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = unit(`${seedKey}:intl-position`) * total;
  for (let i = 0; i < POSITIONS.length; i++) {
    roll -= weights[i];
    if (roll < 0) return POSITIONS[i];
  }
  return POSITIONS[POSITIONS.length - 1];
}

function pickNationality(state: CareerState, seedKey: string, clubId: string, homeNation: string): NationCode {
  if (unit(`${seedKey}:intl-home`) < HOME_NATION_SHARE) return homeNation as NationCode;
  const competitionId = clubCompetitionId(state, clubId);
  const others = new Set<string>();
  for (const id of worldPoolCareerClubIds(state)) {
    if (clubCompetitionId(state, id) !== competitionId) continue;
    for (const p of state.worldSquads[id] ?? []) if (p.nationality !== homeNation) others.add(p.nationality);
  }
  const list = [...others].sort();
  return (list.length > 0 ? list[seededIndex(`${seedKey}:intl-other-nation`, list.length)] : homeNation) as NationCode;
}

/** Triangular potential around the league level, independent of current ability. */
export function internationalProspectPA(seedKey: string, leagueLevel: number): number {
  const spread = (unit(`${seedKey}:intl-pa-a`) * 2 - 1) * PA_HALF_SPREAD + (unit(`${seedKey}:intl-pa-b`) * 2 - 1) * PA_HALF_SPREAD;
  return Math.round(Math.max(60, Math.min(INTERNATIONAL_PA_CEILING, PA_MAX, leagueLevel - PA_CENTRE_BELOW_LEAGUE + spread)));
}

export function internationalProspectCA(seedKey: string, pa: number, age: number): number {
  const gap = READINESS_GAP_BY_AGE[age] ?? 40;
  const jitter = Math.round((unit(`${seedKey}:intl-ca`) * 2 - 1) * 8);
  return Math.max(CA_FLOOR, Math.min(pa, pa - gap + jitter));
}

function prospectAge(seedKey: string): number {
  const roll = seededIndex(`${seedKey}:intl-age`, 100);
  return roll < 40 ? 18 : roll < 75 ? 19 : 20;
}

interface GeneratedProspect { player: PlayerMock; rating: GameplayPlayerRating; contract: PlayerContract }

function generateProspect(state: CareerState, clubId: string, year: number, index: number, leagueLevel: number, homeNation: string, squad: readonly PlayerMock[]): GeneratedProspect {
  const playerId = `intl-youth-${clubId}-${year}-${index}`;
  const seedKey = `${state.saveSeed}:${playerId}`;
  const age = prospectAge(seedKey);
  const position = pickPosition(seedKey, squad);
  const nationality = pickNationality(state, seedKey, clubId, homeNation);
  const name = generateInternationalYouthName(seedKey, nationality);
  const pa = internationalProspectPA(seedKey, leagueLevel);
  const ca = internationalProspectCA(seedKey, pa, age);
  const month = 1 + seededIndex(`${seedKey}:intl-dob-m`, 6);
  const day = 1 + seededIndex(`${seedKey}:intl-dob-d`, 28);
  const dateOfBirth = `${year - age}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const rating = generateYouthGameplayRating(playerId, position, ca, pa);
  const contractYears = 3;
  const contractEndYear = year + contractYears;
  const contractEndSeasonHint = `${contractEndYear - 1}/${String(contractEndYear).slice(-2)}`;
  const competitionTier = getCompetition(clubCompetitionId(state, clubId) ?? "")?.tier;
  const economyInputs: EconomyProfileInputs = { ca, pa, age, position: mapHandballPositionToMatchPlanPosition(position), role: "DEVELOPMENT", competitionTier };
  const contract = generateInitialContract(playerId, clubId, contractEndSeasonHint, contractEndYear, economyInputs);
  const player: PlayerMock = {
    id: playerId, clubId, firstName: name.firstName, lastName: name.lastName, shirtNumber: null, position, nationality, dateOfBirth,
    heightCm: null, weightKg: null, foot: null, squadStatus: "Ungdom", dataSource: "MOCK", currentAbility: ca, potentialAbility: pa,
    form: 5, fitnessPct: 100, moralePct: 70, appearances: 0, goals: 0, contractEndSeason: contractEndSeasonHint, wageSekPerMonth: 0,
    attributes: legacyAttributesFromCA(ca),
  };
  return { player, rating, contract };
}

export interface InternationalYouthIntakeResult {
  state: CareerState;
  generated: Record<string, string[]>;
}

/**
 * Annual pass on INTERNATIONAL_YOUTH_INTAKE_MMDD. `leagueLevelOf` is injected by
 * the caller (internationalMarket.ts) so this module stays free of the
 * transfers -> career import direction.
 */
export function progressInternationalYouthIntake(state: CareerState, date: string, leagueLevelOfClub: (clubId: string) => number): InternationalYouthIntakeResult {
  if (date.slice(5, 10) !== INTERNATIONAL_YOUTH_INTAKE_MMDD) return { state, generated: {} };
  const year = Number(date.slice(0, 4));
  const yearKey = date.slice(0, 4);
  let next = state;
  const generated: Record<string, string[]> = {};
  for (const clubId of worldPoolCareerClubIds(state)) {
    if (next.youthIntakeClubYears[clubId] === yearKey) continue;
    const squad = next.worldSquads[clubId] ?? [];
    const size = internationalIntakeSize(next.saveSeed, clubId, year, INTERNATIONAL_YOUTH_SQUAD_CAPACITY - squad.length);
    const level = leagueLevelOfClub(clubId);
    const homeNation = getCompetition(clubCompetitionId(next, clubId) ?? "")?.nation ?? "GER";
    const players: PlayerMock[] = [];
    const ratings: GameplayPlayerRating[] = [];
    let contracts = next.playerContracts;
    let squadStatus = next.playerSquadStatus;
    let statuses = next.playerStatuses;
    for (let i = 0; i < size && Number.isFinite(level); i++) {
      const { player, rating, contract } = generateProspect(next, clubId, year, i, level, homeNation, [...squad, ...players]);
      if (next.playerContracts[player.id]) continue; // identity already exists -- never duplicate
      players.push(player);
      ratings.push(rating);
      contracts = { ...contracts, [player.id]: contract };
      squadStatus = { ...squadStatus, [player.id]: "TALENT" };
      statuses = { ...statuses, [player.id]: { playerId: player.id, availability: "AVAILABLE" } };
    }
    next = {
      ...next,
      worldSquads: players.length > 0 ? { ...next.worldSquads, [clubId]: [...squad, ...players] } : next.worldSquads,
      gameplayRatings: players.length > 0 ? { ...next.gameplayRatings, [clubId]: [...(next.gameplayRatings[clubId] ?? []), ...ratings] } : next.gameplayRatings,
      playerContracts: contracts,
      playerSquadStatus: squadStatus,
      playerStatuses: statuses,
      youthIntakeClubYears: { ...next.youthIntakeClubYears, [clubId]: yearKey },
    };
    if (players.length > 0) generated[clubId] = players.map((p) => p.id);
  }
  return { state: next, generated };
}
