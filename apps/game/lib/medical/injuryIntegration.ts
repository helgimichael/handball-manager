// HM-INJURIES-1.0: the ONLY module that reads/writes CareerState for
// injuries -- mirrors lib/development/developmentIntegration.ts's own
// "pure math below, CareerState glue here" split exactly. dailyTick.ts
// calls applyTrainingDayInjuryResolution + progressDailyRehab;
// matchdayAction.ts calls applyMatchInjuryResolution.
import { getCareerPlayer, getCareerSquad } from "../career/careerWorld";
import { getCareerPlayerRating } from "../career/careerRatingNormalization";
import { playerAgeAtDate } from "../development/developmentIntegration";
import { mondayOf } from "../training/trainingSchedule";
import type { CareerState } from "../career/types";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import { computeMedicalRehabQuality } from "./medicalStaffQuality";
import { advanceRehabOneDay, isFullyRecovered } from "./rehab";
import {
  computeMatchInjuryRisk,
  computeTrainingInjuryRisk,
  pickExpectedDurationDays,
  pickInjuryType,
  pickSeverity,
  seededRoll,
  type InjuryRiskInputs,
} from "./injuryRisk";
import { INJURY_TYPE_PROFILES, emptyPlayerInjuryState, type ActiveInjury, type InjuryHistoryEntry, type InjurySource, type PlayerInjuryState } from "./types";
import { addDays } from "../career/dateUtils";
import { effectiveTrainingLoadSetting } from "./availability";

function physicalResilienceOf(rating: GameplayPlayerRating | undefined): number | null {
  if (!rating || rating.branch.branch !== "OUTCOURT") return null; // goalkeepers: neutral fallback (Part 13), same precedent as playerMatchStrength.ts
  const attrs = rating.branch.attributes;
  const values = [attrs.STRENGTH?.value, attrs.CONTACT_BALANCE?.value, attrs.ENDURANCE?.value, attrs.REPEAT_SPRINT_ABILITY?.value].filter((v): v is number => v !== undefined);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function injuryStateFor(state: CareerState, playerId: string): PlayerInjuryState {
  return state.playerInjuries[playerId] ?? emptyPlayerInjuryState(playerId);
}

function buildRiskInputs(state: CareerState, playerId: string, asOfDate: string, ratingsById: Map<string, GameplayPlayerRating>): InjuryRiskInputs {
  // HM-ALPHA3-M10: any player in the world (national duty exposes CPU players too), not only the manager's squad.
  const player = getCareerSquad(state).find((p) => p.id === playerId) ?? getCareerPlayer(state, playerId);
  const age = player ? playerAgeAtDate(player.dateOfBirth, player.birthYear, asOfDate) : null;
  const physical = state.playerPhysicalState[playerId];
  return {
    age,
    currentEnergy: physical?.currentEnergy ?? 100,
    recentLoad: physical?.recentLoad ?? 0,
    physicalResilience: physicalResilienceOf(ratingsById.get(playerId) ?? getCareerPlayerRating(state, playerId)),
    injuryHistory: injuryStateFor(state, playerId).injuryHistory,
    asOfDate,
  };
}

function createActiveInjury(
  playerId: string,
  mechanism: "CONTACT" | "OVERUSE",
  source: InjurySource,
  date: string,
  age: number | null,
  seedKey: string,
): ActiveInjury {
  const severity = pickSeverity(seedKey);
  const injuryType = pickInjuryType(mechanism, severity, seedKey);
  const profile = INJURY_TYPE_PROFILES[injuryType];
  const expectedDurationDays = pickExpectedDurationDays(severity, age, seedKey);
  return {
    injuryId: `injury:${playerId}:${date}:${seedKey.slice(-8)}`,
    injuryType,
    bodyArea: profile.bodyArea,
    mechanism: profile.mechanism,
    severity,
    occurredDate: date,
    source,
    expectedReturnDate: addDays(date, expectedDurationDays),
    expectedDurationDays,
    currentPhase: "ACUTE",
    rehabProgress: 0,
    recurrenceRiskMultiplier: 1.0,
    lastRehabProcessedDate: null,
  };
}

export interface InjuryResolutionResult {
  state: CareerState;
  newlyInjuredPlayerIds: string[];
}

/**
 * Part 14/35: training injury resolution -- reads TODAY's already-
 * EXECUTED TrainingSessionResult(s) (never re-derives participation), one
 * OVERUSE risk roll per participant per session. A player who already
 * has an active injury is skipped (no new injury while already injured).
 * Relies on the same system invariant dailyTick.ts's own steps already
 * rely on (processDay is only ever called once per date) for exactly-
 * once resolution -- consistent with applyTrainingDayDevelopmentStimulus's
 * own idiom, not a duplicated idempotency mechanism.
 */
export function applyTrainingDayInjuryResolution(state: CareerState, date: string): InjuryResolutionResult {
  const week = state.trainingWeeks[mondayOf(date)];
  const day = week?.days.find((d) => d.date === date);
  if (!day || !day.executed || !day.results || day.results.length === 0) return { state, newlyInjuredPlayerIds: [] };

  const ratingsById = new Map((state.gameplayRatings[state.playerClubId] ?? []).map((r) => [r.playerId, r]));
  let playerInjuries = state.playerInjuries;
  let playerStatuses = state.playerStatuses;
  const newlyInjuredPlayerIds: string[] = [];

  for (const session of day.sessions) {
    const result = day.results.find((r) => r.sessionId === session.id);
    if (!result) continue;
    for (const playerId of result.participants) {
      if (injuryStateFor(state, playerId).activeInjury) continue; // already injured -- no new injury risk this session.
      const inputs = buildRiskInputs(state, playerId, date, ratingsById);
      // Part 18: the SAME availability-capped effective load setting
      // trainingExecution.ts itself applied for this session (never a
      // second, potentially-divergent cap computation).
      const effectiveSetting = effectiveTrainingLoadSetting(state, playerId, state.playerTrainingAssignments[playerId]?.loadSetting ?? "FULL");
      const risk = computeTrainingInjuryRisk(effectiveSetting, session.type, session.intensity, inputs);
      if (risk <= 0) continue;

      const seedKey = `${state.saveSeed}:injury:training:${playerId}:${session.id}`;
      const roll = seededRoll(seedKey);
      if (roll >= risk) continue;

      const injury = createActiveInjury(playerId, "OVERUSE", "TRAINING", date, inputs.age, seedKey);
      const prior = injuryStateFor(state, playerId);
      playerInjuries = { ...playerInjuries, [playerId]: { ...prior, activeInjury: injury } };
      playerStatuses = { ...playerStatuses, [playerId]: { playerId, availability: "INJURED" } };
      newlyInjuredPlayerIds.push(playerId);
    }
  }

  if (newlyInjuredPlayerIds.length === 0) return { state, newlyInjuredPlayerIds };
  return { state: { ...state, playerInjuries, playerStatuses }, newlyInjuredPlayerIds };
}

export interface MatchExposureForInjury {
  attackExposure: number;
  defenceExposure: number;
  goalkeeperExposure: number;
}

/**
 * Part 13/36: match injury resolution -- one CONTACT roll and one
 * OVERUSE roll per squad player who had non-zero exposure this fixture,
 * using the SAME resolved MatchUsage exposure fractions already computed
 * for match-strength/development purposes (never a second exposure
 * model). Only ever called for the manager's own squad (matchdayAction.ts's
 * own established scope -- no live per-save injury tracking exists for
 * AI clubs, same precedent as playerStatuses itself).
 */
export function applyMatchInjuryResolution(
  state: CareerState,
  date: string,
  fixtureId: string,
  exposureByPlayerId: ReadonlyMap<string, MatchExposureForInjury>,
): InjuryResolutionResult {
  const ratingsById = new Map((state.gameplayRatings[state.playerClubId] ?? []).map((r) => [r.playerId, r]));
  let playerInjuries = state.playerInjuries;
  let playerStatuses = state.playerStatuses;
  const newlyInjuredPlayerIds: string[] = [];

  for (const [playerId, exposure] of exposureByPlayerId) {
    if (injuryStateFor(state, playerId).activeInjury) continue;
    const exposureFraction = Math.max(exposure.attackExposure, exposure.defenceExposure, exposure.goalkeeperExposure);
    if (exposureFraction <= 0) continue;

    const inputs = buildRiskInputs(state, playerId, date, ratingsById);
    const { contactRisk, overuseRisk } = computeMatchInjuryRisk(exposureFraction, inputs);

    const contactSeed = `${state.saveSeed}:injury:match:${fixtureId}:${playerId}:contact`;
    const overuseSeed = `${state.saveSeed}:injury:match:${fixtureId}:${playerId}:overuse`;
    const contactRoll = seededRoll(contactSeed);
    const overuseRoll = seededRoll(overuseSeed);

    let mechanism: "CONTACT" | "OVERUSE" | null = null;
    let seedKey = "";
    if (contactRoll < contactRisk) {
      mechanism = "CONTACT";
      seedKey = contactSeed;
    } else if (overuseRoll < overuseRisk) {
      mechanism = "OVERUSE";
      seedKey = overuseSeed;
    }
    if (!mechanism) continue;

    const injury = createActiveInjury(playerId, mechanism, "MATCH", date, inputs.age, seedKey);
    const prior = injuryStateFor(state, playerId);
    playerInjuries = { ...playerInjuries, [playerId]: { ...prior, activeInjury: injury } };
    playerStatuses = { ...playerStatuses, [playerId]: { playerId, availability: "INJURED" } };
    newlyInjuredPlayerIds.push(playerId);
  }

  if (newlyInjuredPlayerIds.length === 0) return { state, newlyInjuredPlayerIds };
  return { state: { ...state, playerInjuries, playerStatuses }, newlyInjuredPlayerIds };
}

/**
 * Part 19/24/25/29/30/34: advances every active injury by exactly one
 * day, self-idempotent via `lastRehabProcessedDate` (Part 30/35: reload
 * never re-progresses the same date twice) -- an explicit per-injury
 * guard, not merely relying on the outer daily-tick invariant, since
 * rehab progression is REQUIRED to be provably safe under reload (Part
 * 30's own dedicated test). Fully-recovered injuries move to history and
 * restore AVAILABLE; RETURN_TO_PLAY sets LIMITED; every earlier phase
 * keeps INJURED (Part 19: never jumps straight to full availability).
 */
export function progressDailyRehab(state: CareerState, date: string): CareerState {
  // HM-ALPHA3-M10: each player recovers with his own club's medical staff (CPU players injured on national duty).
  const qualityByClub = new Map<string, ReturnType<typeof computeMedicalRehabQuality>>();
  const medicalQualityFor = (playerId: string) => {
    const clubId = state.playerStatuses[playerId] && getCareerSquad(state).some((p) => p.id === playerId) ? state.playerClubId : (getCareerPlayer(state, playerId)?.clubId ?? state.playerClubId);
    if (!qualityByClub.has(clubId)) qualityByClub.set(clubId, computeMedicalRehabQuality(state.staffRoster[clubId] ?? state.staffRoster[state.playerClubId] ?? []));
    return qualityByClub.get(clubId)!;
  };

  let playerInjuries = state.playerInjuries;
  let playerStatuses = state.playerStatuses;
  let changed = false;

  for (const injuryState of Object.values(state.playerInjuries)) {
    const injury = injuryState.activeInjury;
    if (!injury) continue;
    if (injury.lastRehabProcessedDate === date) continue; // idempotency guard (Part 30/35)

    const advanced = advanceRehabOneDay(injury, date, medicalQualityFor(injuryState.playerId));
    changed = true;

    if (isFullyRecovered(advanced)) {
      const historyEntry: InjuryHistoryEntry = {
        injuryId: advanced.injuryId,
        injuryType: advanced.injuryType,
        bodyArea: advanced.bodyArea,
        mechanism: advanced.mechanism,
        severity: advanced.severity,
        source: advanced.source,
        occurredDate: advanced.occurredDate,
        returnDate: date,
      };
      playerInjuries = {
        ...playerInjuries,
        [injuryState.playerId]: { playerId: injuryState.playerId, activeInjury: null, injuryHistory: [...injuryState.injuryHistory, historyEntry] },
      };
      playerStatuses = { ...playerStatuses, [injuryState.playerId]: { playerId: injuryState.playerId, availability: "AVAILABLE" } };
    } else {
      playerInjuries = { ...playerInjuries, [injuryState.playerId]: { ...injuryState, activeInjury: advanced } };
      const availability = advanced.currentPhase === "RETURN_TO_PLAY" ? "LIMITED" : "INJURED";
      playerStatuses = { ...playerStatuses, [injuryState.playerId]: { playerId: injuryState.playerId, availability } };
    }
  }

  return changed ? { ...state, playerInjuries, playerStatuses } : state;
}
