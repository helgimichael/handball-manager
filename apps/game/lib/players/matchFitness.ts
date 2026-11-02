// HM-PLAYTEST-01 3.2: MATCH FITNESS ("matchträning") -- how prepared a
// player is for the rhythm and intensity of competitive handball. It is a
// separate dimension from:
//
//   energy        today's physical readiness/recovery (playerPhysicalState)
//   availability  injured/suspended/eligible (playerStatuses, playerInjuries)
//   form          recent performance (match ratings, clubForm)
//
// A player can be fully rested (100% energy) and still short of match
// fitness after a long injury or a summer without games. Match fitness is
// gained by actually playing (competitive > friendly), maintained a little
// by ordinary training, and lost through long periods without matches --
// faster while injured. Its match effect is deliberately modest (see
// MATCH_FITNESS_MAX_PENALTY) and applied only through the existing player
// profile, never by rewriting energy, fatigue or injury calculations.
import type { CareerState } from "../career/types";
import { getCareerSquad } from "../career/careerWorld";

export type PlayerMatchFitness = {
  /** 0-100. */
  readonly value: number;
  readonly lastMatchDate?: string;
  readonly lastUpdatedDate: string;
};

export type MatchFitnessLedger = {
  /** Value for a player of the manager's club with no entry yet (preseason start: low). */
  readonly defaultValue: number;
  readonly players: Readonly<Record<string, PlayerMatchFitness>>;
};

/** A save from before HM-PLAYTEST-01 is mid-season: nobody is suddenly short of games. */
export const LEGACY_MATCH_FITNESS = 80;
/** A summer without competitive matches. */
export const PRESEASON_MATCH_FITNESS = 55;
/** CPU clubs run their own preseason programme off-screen. */
export const CPU_ASSUMED_MATCH_FITNESS = 80;
/** Training alone keeps a healthy player ticking over up to this level, never beyond. */
export const TRAINING_MAINTENANCE_CEILING = 62;
/** Days after a match before match fitness starts to fade. */
export const FADE_GRACE_DAYS = 5;
export const DAILY_FADE = 0.6;
export const DAILY_FADE_INJURED = 1.1;
export const DAILY_TRAINING_GAIN = 0.35;
export const MATCH_FITNESS_FLOOR = 25;
/** At or above this a player is fully match-sharp: no effect at all on his gameplay. */
export const MATCH_FITNESS_FULL_EFFECT = 80;
/** At 0 match fitness a player's gameplay attributes are at most this much lower. */
export const MATCH_FITNESS_MAX_PENALTY = 0.06;

const clamp = (v: number) => Math.max(MATCH_FITNESS_FLOOR, Math.min(100, v));

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

export function emptyMatchFitnessLedger(defaultValue = PRESEASON_MATCH_FITNESS): MatchFitnessLedger {
  return { defaultValue, players: {} };
}

/** The manager-facing value, 0-100. Untracked CPU players read as the assumed level. */
export function matchFitnessOf(state: CareerState, playerId: string): number {
  const ledger = state.playerMatchFitness;
  if (!ledger) return LEGACY_MATCH_FITNESS;
  const own = ledger.players[playerId];
  if (own) return Math.round(own.value);
  const isOwn = getCareerSquad(state).some((p) => p.id === playerId);
  return isOwn ? ledger.defaultValue : Math.max(ledger.defaultValue, CPU_ASSUMED_MATCH_FITNESS);
}

/**
 * Gain from one match. Proportional to minutes on court, diminishing near
 * the top so a single 60-minute game cannot jump a rusty player to full.
 * A friendly is real game exposure, at slightly lower intensity.
 */
export function matchFitnessGain(current: number, minutes: number, competitive: boolean): number {
  const share = Math.max(0, Math.min(1, minutes / 60));
  return 24 * share * (1 - current / 115) * (competitive ? 1 : 0.85);
}

export function applyMatchExposure(
  state: CareerState,
  date: string,
  minutesByPlayer: ReadonlyMap<string, number>,
  competitive: boolean,
): CareerState {
  if (minutesByPlayer.size === 0) return state;
  const ledger = state.playerMatchFitness ?? emptyMatchFitnessLedger(LEGACY_MATCH_FITNESS);
  const players: Record<string, PlayerMatchFitness> = { ...ledger.players };
  for (const [playerId, minutes] of minutesByPlayer) {
    if (minutes <= 0) continue;
    const current = matchFitnessOf({ ...state, playerMatchFitness: ledger }, playerId);
    players[playerId] = { value: clamp(current + matchFitnessGain(current, minutes, competitive)), lastMatchDate: date, lastUpdatedDate: date };
  }
  return { ...state, playerMatchFitness: { ...ledger, players } };
}

/**
 * One calendar day for the manager's squad: injured players lose sharpness,
 * idle players fade after a grace period, and healthy players in training
 * creep up towards the training ceiling. Idempotent per date.
 */
export function applyDailyMatchFitness(state: CareerState, date: string, squadIds: readonly string[], isInjured: (playerId: string) => boolean): CareerState {
  const ledger = state.playerMatchFitness;
  if (!ledger) return state;
  const players: Record<string, PlayerMatchFitness> = { ...ledger.players };
  let changed = false;
  for (const playerId of squadIds) {
    const entry = players[playerId];
    if (entry?.lastUpdatedDate === date) continue;
    const value = entry?.value ?? ledger.defaultValue;
    const sinceMatch = entry?.lastMatchDate ? daysBetween(entry.lastMatchDate, date) : Infinity;
    let next = value;
    if (isInjured(playerId)) next -= DAILY_FADE_INJURED;
    // Above the training ceiling only games hold it up; below it, training builds towards it.
    else if (value > TRAINING_MAINTENANCE_CEILING) next = sinceMatch > FADE_GRACE_DAYS ? Math.max(TRAINING_MAINTENANCE_CEILING, value - DAILY_FADE) : value;
    else next = Math.min(TRAINING_MAINTENANCE_CEILING, value + DAILY_TRAINING_GAIN);
    players[playerId] = { ...(entry ?? {}), value: clamp(next), lastUpdatedDate: date };
    changed = true;
  }
  return changed ? { ...state, playerMatchFitness: { ...ledger, players } } : state;
}

/** Multiplier on a player's gameplay attributes at kickoff: 1 when match-sharp (>= 80), falling linearly to 1 - MAX_PENALTY at 0. */
export function matchFitnessAttributeFactor(value: number): number {
  const shortfall = Math.max(0, MATCH_FITNESS_FULL_EFFECT - Math.max(0, Math.min(100, value))) / MATCH_FITNESS_FULL_EFFECT;
  return 1 - MATCH_FITNESS_MAX_PENALTY * shortfall;
}

export type MatchFitnessBand = "SHARP" | "GOOD" | "BUILDING" | "LACKING";
export function matchFitnessBand(value: number): MatchFitnessBand {
  return value >= 85 ? "SHARP" : value >= 68 ? "GOOD" : value >= 50 ? "BUILDING" : "LACKING";
}
export const MATCH_FITNESS_BAND_LABEL: Record<MatchFitnessBand, string> = {
  SHARP: "Matchskarp",
  GOOD: "God matchträning",
  BUILDING: "Bygger matchträning",
  LACKING: "Saknar matchträning",
};
