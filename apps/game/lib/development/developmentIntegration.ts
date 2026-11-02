// HM-TRAINING-1.1: the CareerState-level glue -- the ONLY module that
// reads/writes CareerState for player development. dailyTick.ts calls
// applyTrainingDayDevelopmentStimulus + resolveWeeklyDevelopmentIfDue;
// matchdayAction.ts calls applyMatchDevelopmentStimulus. Everything below
// this layer (developmentStimulus.ts/developmentResolution.ts) is pure.
import { getCareerSquad } from "../career/careerWorld";
import type { CareerState } from "../career/types";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import { mondayOf } from "../training/trainingSchedule";
import { effectiveTrainingLoadSetting } from "../medical/availability";
import { PLACEMENT_RELATION_QUALITY_MULTIPLIER, computeMatchAttributeStimulus, computePlacementAttributeStimulus, computeSessionAttributeStimulus } from "./developmentStimulus";
import { applyResolvedAttributeChanges, pushDevelopmentEvent, resolveAttributeForWeek } from "./developmentResolution";
import type { DevelopableAttribute, IndividualDevelopmentFocus, PlayerDevelopmentState } from "./types";
import { academyDevelopmentFactor } from "../staff/organisation";

function emptyDevelopmentState(playerId: string): PlayerDevelopmentState {
  return { playerId, attributeStimulus: {}, attributeQualityWeightedSum: {}, attributeProgress: {}, lastDevelopmentDate: null, developmentHistory: [] };
}

/**
 * HM-STAFF-1.0 Part 11/26: `quality` is the STAFF coaching-quality
 * multiplier that produced this stimulus (1.0/neutral for match
 * exposure, which has no coach) -- accumulated as a stimulus-weighted
 * sum alongside the raw stimulus itself, so weekly resolution can
 * recover a proper weighted average even when one week's stimulus for
 * one attribute came from multiple sessions led by different coaches.
 */
function addStimulus(state: PlayerDevelopmentState, stimulus: Partial<Record<DevelopableAttribute, number>>, quality: number): PlayerDevelopmentState {
  const attributeStimulus = { ...state.attributeStimulus };
  const attributeQualityWeightedSum = { ...state.attributeQualityWeightedSum };
  for (const [attr, units] of Object.entries(stimulus)) {
    const key = attr as DevelopableAttribute;
    attributeStimulus[key] = (attributeStimulus[key] ?? 0) + (units ?? 0);
    attributeQualityWeightedSum[key] = (attributeQualityWeightedSum[key] ?? 0) + (units ?? 0) * quality;
  }
  return { ...state, attributeStimulus, attributeQualityWeightedSum };
}

function mergeStimulusIntoPlayerDevelopmentState(
  playerDevelopmentState: Record<string, PlayerDevelopmentState>,
  playerId: string,
  stimulus: Partial<Record<DevelopableAttribute, number>>,
  quality: number,
): Record<string, PlayerDevelopmentState> {
  if (Object.keys(stimulus).length === 0) return playerDevelopmentState;
  const prior = playerDevelopmentState[playerId] ?? emptyDevelopmentState(playerId);
  return { ...playerDevelopmentState, [playerId]: addStimulus(prior, stimulus, quality) };
}

/**
 * Part 5/7/8: after a training day has EXECUTED (lib/training/trainingExecution.ts
 * already ran and wrote today's TrainingSessionResult(s) for `date`),
 * accumulate every participant's own development stimulus from those
 * exact sessions -- reads the already-computed session/participant data,
 * never re-derives it. A no-op for a day that hasn't executed yet, or
 * that produced no results (REST/MATCH days).
 */
export function applyTrainingDayDevelopmentStimulus(state: CareerState, date: string): CareerState {
  const weekStart = mondayOf(date);
  const week = state.trainingWeeks[weekStart];
  const day = week?.days.find((d) => d.date === date);
  if (!day || !day.executed || !day.results || day.results.length === 0) return state;

  const squadById = new Map(getCareerSquad(state).map((p) => [p.id, p]));
  let playerDevelopmentState = state.playerDevelopmentState;

  for (const session of day.sessions) {
    const result = day.results.find((r) => r.sessionId === session.id);
    if (!result) continue;
    for (const playerId of result.participants) {
      const player = squadById.get(playerId);
      if (!player) continue;
      const isGoalkeeper = player.position === "MV";
      // HM-INJURIES-1.0 Part 27: the SAME availability-capped effective
      // load setting trainingExecution.ts itself applied for this
      // session -- an injured player's requested load is never honored
      // for development stimulus either (never a second, divergent cap).
      const loadSetting = effectiveTrainingLoadSetting(state, playerId, state.playerTrainingAssignments[playerId]?.loadSetting ?? "FULL");
      const focus = (state.playerTrainingAssignments[playerId]?.individualFocus as IndividualDevelopmentFocus | undefined) ?? null;
      const stimulus = computeSessionAttributeStimulus(session.type, session.intensity, session.duration, loadSetting, isGoalkeeper, focus, `${playerId}:${session.id}`);
      playerDevelopmentState = mergeStimulusIntoPlayerDevelopmentState(playerDevelopmentState, playerId, stimulus, result.resolvedStaffQuality);
    }
  }

  return playerDevelopmentState === state.playerDevelopmentState ? state : { ...state, playerDevelopmentState };
}

export interface PlayerMatchExposure {
  attackExposure: number;
  defenceExposure: number;
  goalkeeperExposure: number;
}

/**
 * Part 18/19/20/21: accumulates match-exposure development stimulus for
 * the manager's own squad after a fixture resolves -- called once per
 * played manager fixture from matchdayAction.ts, using the exact same
 * per-player exposure fractions (matchUsageEngine.ts's TeamUsageTrace)
 * already computed for match-strength/physical load, never a second
 * exposure model.
 */
export function applyMatchDevelopmentStimulus(state: CareerState, date: string, exposureByPlayerId: ReadonlyMap<string, PlayerMatchExposure>): CareerState {
  const squadById = new Map(getCareerSquad(state).map((p) => [p.id, p]));
  let playerDevelopmentState = state.playerDevelopmentState;

  for (const [playerId, exposure] of exposureByPlayerId) {
    const player = squadById.get(playerId);
    if (!player) continue;
    const isGoalkeeper = player.position === "MV";
    const stimulus = computeMatchAttributeStimulus(exposure.attackExposure, exposure.defenceExposure, exposure.goalkeeperExposure, isGoalkeeper, `${playerId}:${date}:match`);
    // Part 11: match exposure has no coach -- neutral quality, exactly
    // FUTURE_COACHING_QUALITY_MULTIPLIER's own default.
    playerDevelopmentState = mergeStimulusIntoPlayerDevelopmentState(playerDevelopmentState, playerId, stimulus, 1.0);
  }

  return playerDevelopmentState === state.playerDevelopmentState ? state : { ...state, playerDevelopmentState };
}

/**
 * HM-CLUB-PARTNERSHIPS-1.1: accumulates one day's placement-development
 * stimulus for every player on an ACTIVE B-team/development-partnership
 * placement (lib/career/playerPlacements.ts) -- called from dailyTick.ts
 * step 3, immediately after applyTrainingDayDevelopmentStimulus and
 * BEFORE resolveWeeklyDevelopmentIfDue, so it's captured by that same
 * week's Sunday resolution. Feeds the SAME playerDevelopmentState entry
 * as training/match stimulus (never a parallel CA engine) -- a placed
 * player's `gameplayRatings` entry deliberately never moves to the
 * partner club (see playerPlacements.ts's own doc), so
 * resolveWeeklyDevelopmentIfDue's existing "manager's own club's live
 * rating" lookup still finds them without any change there.
 */
export function applyPlacementDevelopmentStimulus(state: CareerState, date: string): CareerState {
  const activePlacements = Object.values(state.playerPlacements).filter((p) => p.status === "ACTIVE");
  if (activePlacements.length === 0) return state;

  const squadById = new Map(getCareerSquad(state).map((p) => [p.id, p]));
  let playerDevelopmentState = state.playerDevelopmentState;

  for (const placement of activePlacements) {
    const player = squadById.get(placement.playerId);
    if (!player) continue;
    const isGoalkeeper = player.position === "MV";
    const age = playerAgeAtDate(player.dateOfBirth, player.birthYear, date);
    const stimulus = computePlacementAttributeStimulus(placement.relationType, age, isGoalkeeper, `${placement.playerId}:${placement.id}:${date}`);
    const quality = PLACEMENT_RELATION_QUALITY_MULTIPLIER[placement.relationType];
    playerDevelopmentState = mergeStimulusIntoPlayerDevelopmentState(playerDevelopmentState, placement.playerId, stimulus, quality);
  }

  return playerDevelopmentState === state.playerDevelopmentState ? state : { ...state, playerDevelopmentState };
}

function isSunday(date: string): boolean {
  return new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
}

/**
 * Part 5/E: THE canonical player-age calculation -- every call site across
 * the app (UI pages, recruitment, transfers, development/retirement,
 * scouting, etc.) uses this, always passing the live career's `gameDate`
 * (never a hardcoded literal), so age advances correctly as a career
 * progresses. dateOfBirth is the canonical source; birthYear is only a
 * fallback when the exact date isn't known -- never fabricates a day/month.
 */
export function playerAgeAtDate(dateOfBirth: string | null, birthYear: number | null | undefined, asOfDate: string): number | null {
  if (dateOfBirth) {
    const dob = new Date(dateOfBirth);
    const today = new Date(`${asOfDate}T00:00:00Z`);
    let age = today.getUTCFullYear() - dob.getUTCFullYear();
    const monthDiff = today.getUTCMonth() - dob.getUTCMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < dob.getUTCDate())) age -= 1;
    return age;
  }
  if (birthYear) {
    return Number(asOfDate.slice(0, 4)) - birthYear;
  }
  return null;
}

function attributesRecord(rating: GameplayPlayerRating): Record<string, { value: number; origin: string }> {
  return rating.branch.attributes as unknown as Record<string, { value: number; origin: string }>;
}

/**
 * Part 14/34: resolves accumulated stimulus into possible attribute
 * changes for every squad player, once per week (Sunday, the last day of
 * the training week -- Part 3's own Monday-Sunday week), idempotent per
 * player via `lastDevelopmentDate` (Part 33 #34/#35: never re-resolves an
 * already-resolved date). A no-op on any non-Sunday date, and a no-op
 * entirely when the manager's own club has no live GameplayPlayerRating
 * snapshot (Part C/H's confirmed gap: mock clubs and pre-this-milestone
 * careers have nothing to resolve development against yet -- accumulated
 * stimulus is simply left pending, never discarded, in case a rating
 * becomes available later).
 */
export function resolveWeeklyDevelopmentIfDue(state: CareerState, date: string): CareerState {
  if (!isSunday(date)) return state;

  const clubRatings = state.gameplayRatings[state.playerClubId];
  if (!clubRatings || clubRatings.length === 0) return state;

  const squad = getCareerSquad(state);
  let playerDevelopmentState = state.playerDevelopmentState;
  const ratingsById = new Map(clubRatings.map((r) => [r.playerId, r]));
  let changedAnyRating = false;

  for (const player of squad) {
    const dev = playerDevelopmentState[player.id];
    if (!dev) continue;
    if (dev.lastDevelopmentDate === date) continue; // idempotency guard
    const rating = ratingsById.get(player.id);
    if (!rating) continue; // no live rating for this player yet -- leave stimulus pending.

    const age = playerAgeAtDate(player.dateOfBirth, player.birthYear, date);
    const energy = state.playerPhysicalState[player.id]?.currentEnergy ?? 100;
    const branch = rating.branch.branch;
    const attributes = attributesRecord(rating);

    const changes: { attribute: DevelopableAttribute; newValue: number; caDelta: number }[] = [];
    const nextStimulus = { ...dev.attributeStimulus };
    const nextQualitySum = { ...dev.attributeQualityWeightedSum };
    const nextProgress = { ...dev.attributeProgress };
    let history = dev.developmentHistory;

    for (const [attr, raw] of Object.entries(dev.attributeStimulus)) {
      if (!raw || raw <= 0) continue;
      const attrEntry = attributes[attr];
      if (!attrEntry) continue; // attribute not in this player's own branch vocabulary.
      // Part 11/26: the stimulus-weighted average staff coaching quality
      // across every session that contributed to THIS attribute this
      // week -- affects conversion efficiency only, never participation.
      const qualitySum = dev.attributeQualityWeightedSum[attr as DevelopableAttribute] ?? raw;
      // HM-ALPHA3-M04: a head of academy / development coach speeds up players aged 21 or younger (neutral without them).
      const coachingQualityMultiplier = (qualitySum / raw) * (age !== null && age <= 21 ? academyDevelopmentFactor(state, state.playerClubId) : 1);
      const result = resolveAttributeForWeek(branch, attrEntry.value, rating.ca, rating.pa, nextProgress[attr as DevelopableAttribute] ?? 0, {
        attribute: attr as DevelopableAttribute,
        rawStimulus: raw,
        age,
        currentEnergy: energy,
        coachingQualityMultiplier,
      });
      nextProgress[attr as DevelopableAttribute] = result.nextProgress;
      nextStimulus[attr as DevelopableAttribute] = 0; // weekly reset, whether or not a point was gained
      nextQualitySum[attr as DevelopableAttribute] = 0;
      if (result.event) {
        changes.push({ attribute: attr as DevelopableAttribute, newValue: result.event.newValue, caDelta: result.caDelta });
        history = pushDevelopmentEvent(history, {
          date,
          attribute: attr as DevelopableAttribute,
          previousValue: result.event.previousValue,
          newValue: result.event.newValue,
          sourceSummary: `Training and match development stimulus (coaching quality x${coachingQualityMultiplier.toFixed(2)})`,
        });
      }
    }

    if (changes.length > 0) {
      ratingsById.set(player.id, applyResolvedAttributeChanges(rating, changes));
      changedAnyRating = true;
    }

    playerDevelopmentState = {
      ...playerDevelopmentState,
      [player.id]: { ...dev, attributeStimulus: nextStimulus, attributeQualityWeightedSum: nextQualitySum, attributeProgress: nextProgress, developmentHistory: history, lastDevelopmentDate: date },
    };
  }

  const gameplayRatings = changedAnyRating ? { ...state.gameplayRatings, [state.playerClubId]: [...ratingsById.values()] } : state.gameplayRatings;
  return { ...state, playerDevelopmentState, gameplayRatings };
}
