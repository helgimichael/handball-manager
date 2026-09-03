// HM-PLAYER-DEVELOPMENT-2.0 PHASE 1B: world development.
//
// Positive development used to reach only the managed club: a 20-season
// benchmark measured ZERO CPU players improving across ~26,000 player-seasons
// while decline and retirement applied world-wide. This closes that asymmetry.
//
// ONE ENGINE. This module owns eligibility, cadence and idempotency only. The
// ability model is untouched and shared with the human weekly path:
//   cpu stimulus -> resolveAttributeForWeek -> applyResolvedAttributeChanges
//                -> derived CA
// There is no CPU CA increment, no league-strength boost, no annual CA growth
// and no separate CPU attribute model. developmentResolution.ts is not
// modified by this milestone.
//
// CADENCE -- why monthly. resolveAttributeForWeek caps effective stimulus at
// 2.5 per attribute per call against a 9.0 progress threshold, so a single
// annual pass could never produce even one attribute point, and a quarterly
// one is worse than it looks: to reach the human envelope in 4 passes every
// attribute would have to sit AT the 2.5 cap, which flattens profiles and
// makes every high-headroom youngster grow identically. Twelve passes let the
// per-pass budget sit well under the cap, so per-attribute differences (and
// therefore individual profiles) survive, and progress accumulates smoothly
// instead of in annual steps. Weekly passes for ~1100 players would cost ~58x
// the human path and are not affordable.
//
// The managed club is deliberately EXCLUDED here: it keeps its richer weekly
// training/match/placement model (developmentIntegration.ts). Running both for
// the same player would double-develop them.
import { getCompetition } from "../game-data/competitions";
import { getClub } from "../game-data";
import { careerWorldClubIds } from "./worldCompetitions";
import { FREE_AGENT_CLUB_ID, isFreeAgentClubId, isRetiredClubId } from "./contractExpiry";
import { deriveDefaultSquadStatusTier } from "./squadStatus";
import { playerAgeAtDate } from "../development/developmentIntegration";
import { resolveAttributeForWeek, applyResolvedAttributeChanges, pushDevelopmentEvent, PROGRESS_THRESHOLD_PER_POINT } from "../development/developmentResolution";
import { seededOffset } from "../rating/generation/deterministicVariation";
import { computeCpuSeasonStimulus } from "../development/cpuDevelopment";
import { getPlayerAvailability } from "../medical/availability";
import type { DevelopableAttribute, PlayerDevelopmentState } from "../development/types";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import type { CareerState } from "./types";

/**
 * Monthly evaluation, on the 1st. June's pass therefore sits BEFORE the 15
 * June lifecycle pass, so a player develops before being evaluated for decline
 * and retirement in the same season rather than after.
 */
export const WORLD_DEVELOPMENT_DAY_OF_MONTH = "01";

/** e.g. "2027-M06". Null on any date that is not a development day. */
export function worldDevelopmentPeriodId(date: string): string | null {
  if (date.slice(8, 10) !== WORLD_DEVELOPMENT_DAY_OF_MONTH) return null;
  return `${date.slice(0, 4)}-M${date.slice(5, 7)}`;
}

// ---------------------------------------------------------------------------
// Opt-in trace, mirroring playerLifecycle.ts's retained retirement sink. Null
// by default -- a normal career pays one null check per evaluated player and
// nothing is ever logged.
// ---------------------------------------------------------------------------

export interface WorldDevelopmentTrace {
  periodId: string;
  playerId: string;
  clubId: string;
  competitionId: string | null;
  controller: "HUMAN" | "CPU";
  age: number | null;
  ca: number;
  pa: number;
  headroom: number;
  tier: string;
  isFreeAgent: boolean;
  isAvailable: boolean;
  /** Summed raw stimulus units this pass generated, across every attribute. */
  rawStimulusTotal: number;
  /** Attribute points actually resolved this pass. */
  attributePointsResolved: number;
  caDelta: number;
}

let worldDevelopmentTraceSink: ((trace: WorldDevelopmentTrace) => void) | null = null;

export function setWorldDevelopmentTraceSink(sink: ((trace: WorldDevelopmentTrace) => void) | null): void {
  worldDevelopmentTraceSink = sink;
}

// ---------------------------------------------------------------------------

/**
 * A player's FIRST world-development pass starts every attribute's progress at
 * a seeded fraction of one point, instead of a synchronised zero.
 *
 * Without this the whole world shares a cold start: progress needs 9.0, a
 * year supplies a little under that, so season 1 produces literally zero
 * improvements everywhere and season 2 produces a synchronised burst. That is
 * an artefact of everyone starting together, not a real developmental fact --
 * a 19-year-old already mid-way toward his next improvement when the save
 * begins is the normal case, not the exception.
 *
 * Deliberately a SMALL spread (a third of one point, so ~+1.8 CA once at most,
 * not the ~+5 a full-threshold spread would gift): the goal is to desynchronise
 * the cold start, never to hand the world free ability. Deterministic (seeded
 * on playerId + attribute), applied once per player, and it does not change the
 * steady-state rate -- only the phase.
 */
const INITIAL_PROGRESS_SPREAD = 0.35; // fraction of one point

function initialProgressFor(playerId: string, attribute: string): number {
  const pct = (seededOffset(`${playerId}:${attribute}:world-dev-phase:v1`, 50) + 50) / 100; // [0,1]
  return pct * INITIAL_PROGRESS_SPREAD * PROGRESS_THRESHOLD_PER_POINT;
}

function emptyDevelopmentState(playerId: string): PlayerDevelopmentState {
  return { playerId, attributeStimulus: {}, attributeQualityWeightedSum: {}, attributeProgress: {}, lastDevelopmentDate: null, developmentHistory: [] };
}

/**
 * One monthly world-development pass.
 *
 * Eligibility: every active career-world club plus the free-agent pool.
 * Excluded: the retired sentinel (retirement is terminal -- Phase 1A) and the
 * managed club (richer weekly model).
 *
 * Idempotency: `worldDevelopmentPeriods[playerId]` records the last period a
 * player developed in. The identity is PLAYER + PERIOD, never player + club,
 * so a player transferred mid-season neither develops twice nor vanishes from
 * development because their club changed. This mirrors playerLifecycleYears,
 * which Phase 1A verified survives reloads and reprocessed dates.
 */
export function progressWorldDevelopment(state: CareerState, date: string): CareerState {
  const periodId = worldDevelopmentPeriodId(date);
  if (!periodId) return state;

  const clubIds = [...careerWorldClubIds(state), FREE_AGENT_CLUB_ID];
  let periods = state.worldDevelopmentPeriods ?? {};
  let developmentState = state.playerDevelopmentState;
  let ratingsByClub = state.gameplayRatings;
  let changedAny = false;

  for (const clubId of clubIds) {
    if (isRetiredClubId(clubId)) continue;
    if (clubId === state.playerClubId) continue; // managed club keeps its weekly model
    const squad = state.worldSquads[clubId] ?? [];
    if (squad.length === 0) continue;
    const clubRatings = ratingsByClub[clubId];
    if (!clubRatings || clubRatings.length === 0) continue;

    const ratingsById = new Map(clubRatings.map((r) => [r.playerId, r]));
    let clubChanged = false;
    const competitionId = isFreeAgentClubId(clubId) ? null : getClub(clubId)?.competitionId ?? null;
    const competitionTier = competitionId ? getCompetition(competitionId)?.tier : undefined;

    for (const player of squad) {
      if (periods[player.id] === periodId) continue; // already developed this period
      const rating = ratingsById.get(player.id);
      if (!rating) continue; // no live rating -> nothing to develop against

      const attributes = rating.branch.attributes as unknown as Record<string, { value: number }>;
      const stimulus = computeCpuSeasonStimulus({
        playerId: player.id,
        periodId,
        branch: rating.branch.branch,
        attributes,
        tier: deriveDefaultSquadStatusTier(player),
        competitionTier,
        isFreeAgent: isFreeAgentClubId(clubId),
        isAvailable: getPlayerAvailability(state, player.id) === "AVAILABLE",
      });

      periods = { ...periods, [player.id]: periodId };

      const dev = developmentState[player.id] ?? emptyDevelopmentState(player.id);
      const firstEverPass = state.worldDevelopmentPeriods?.[player.id] === undefined;
      const nextProgress = { ...dev.attributeProgress };
      const age = playerAgeAtDate(player.dateOfBirth, player.birthYear, date);
      const changes: { attribute: DevelopableAttribute; newValue: number; caDelta: number }[] = [];
      let history = dev.developmentHistory;
      let rawTotal = 0;
      let caDelta = 0;

      for (const [attr, raw] of Object.entries(stimulus)) {
        if (!raw || raw <= 0) continue;
        const entry = attributes[attr];
        if (!entry) continue;
        rawTotal += raw;
        const priorProgress = nextProgress[attr as DevelopableAttribute]
          ?? (firstEverPass ? initialProgressFor(player.id, attr) : 0);
        const result = resolveAttributeForWeek(rating.branch.branch, entry.value, rating.ca, rating.pa, priorProgress, {
          attribute: attr as DevelopableAttribute,
          rawStimulus: raw,
          age,
          // CPU clubs have no tracked per-player energy; a fully rested
          // baseline is the honest default rather than an invented figure.
          currentEnergy: 100,
        });
        nextProgress[attr as DevelopableAttribute] = result.nextProgress;
        if (result.event) {
          changes.push({ attribute: attr as DevelopableAttribute, newValue: result.event.newValue, caDelta: result.caDelta });
          caDelta += result.caDelta;
          history = pushDevelopmentEvent(history, {
            date,
            attribute: attr as DevelopableAttribute,
            previousValue: result.event.previousValue,
            newValue: result.event.newValue,
            sourceSummary: "Club development (world)",
          });
        }
      }

      if (changes.length > 0) {
        ratingsById.set(player.id, applyResolvedAttributeChanges(rating, changes));
        clubChanged = true;
        changedAny = true;
      }
      developmentState = { ...developmentState, [player.id]: { ...dev, attributeProgress: nextProgress, developmentHistory: history } };

      if (worldDevelopmentTraceSink) {
        worldDevelopmentTraceSink({
          periodId, playerId: player.id, clubId, competitionId, controller: "CPU",
          age, ca: rating.ca, pa: rating.pa, headroom: rating.pa - rating.ca,
          tier: deriveDefaultSquadStatusTier(player), isFreeAgent: isFreeAgentClubId(clubId),
          isAvailable: getPlayerAvailability(state, player.id) === "AVAILABLE",
          rawStimulusTotal: Number(rawTotal.toFixed(3)),
          attributePointsResolved: changes.length,
          caDelta: Number(caDelta.toFixed(3)),
        });
      }
    }

    if (clubChanged) {
      ratingsByClub = { ...ratingsByClub, [clubId]: [...ratingsById.values()] as GameplayPlayerRating[] };
    }
  }

  if (periods === state.worldDevelopmentPeriods && !changedAny) return state;
  return { ...state, worldDevelopmentPeriods: periods, playerDevelopmentState: developmentState, gameplayRatings: ratingsByClub };
}
