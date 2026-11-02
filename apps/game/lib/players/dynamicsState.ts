// HM-ALPHA3-M05: shared helpers for player dynamics -- the lazily created
// state, a stable per-player personality, the manager's own squad and the
// small facts (age, starts, form) morale, talks and the market read.
import { getCareerPlayer, getCareerClubSquad } from "../career/careerWorld";
import { buildPlayerDynamicsEvent, type CareerEvent, type EventDestination, type EventPriority } from "../career/careerEvents";
import { getPlayerSquadStatus } from "../career/squadStatus";
import type { SquadStatusTier } from "../career/squadStatus";
import { matchWinnerClubId } from "@handball-manager/game-simulation";
import type { CareerState } from "../career/types";
import { playerAgeAtDate } from "../development/developmentIntegration";
import type { PlayerDynamicsState, PlayerPersonality } from "./types";

export type Emit = (event: CareerEvent) => void;

export function emptyDynamics(): PlayerDynamicsState {
  return { morale: {}, promises: {}, concerns: {}, requests: {}, listings: {}, departures: [] };
}

export function dynamicsOf(state: CareerState): PlayerDynamicsState {
  return state.playerDynamics ?? emptyDynamics();
}

export function withDynamics(state: CareerState, patch: (d: PlayerDynamicsState) => PlayerDynamicsState): CareerState {
  return { ...state, playerDynamics: patch(dynamicsOf(state)) };
}

export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/**
 * A light personality from the player's identity: stable for the whole
 * career (keyed on the player id, never on the save or the day). Age nudges
 * it -- young players are more ambitious, veterans more loyal.
 */
export function personalityOf(state: CareerState, playerId: string): PlayerPersonality {
  const player = getCareerPlayer(state, playerId);
  const age = player ? playerAgeAtDate(player.dateOfBirth, player.birthYear, state.gameDate) ?? 25 : 25;
  const trait = (name: string, ageShift: number) => Math.max(1, Math.min(20, Math.round(4 + hash(`${playerId}:${name}`) * 13 + ageShift)));
  return {
    ambition: trait("ambition", age <= 23 ? 3 : age >= 31 ? -3 : 0),
    loyalty: trait("loyalty", age >= 30 ? 3 : age <= 21 ? -1 : 0),
    professionalism: trait("professionalism", age >= 27 ? 1 : 0),
    temperament: trait("temperament", 0),
  };
}

/** Players whose contract the manager's club owns and who play for it (not loaned out). */
export function managerSquadIds(state: CareerState): string[] {
  const me = state.playerClubId;
  return getCareerClubSquad(state, me)
    .filter((p) => state.playerContracts[p.id]?.clubId === me)
    .map((p) => p.id);
}

export function ageOf(state: CareerState, playerId: string): number | null {
  const p = getCareerPlayer(state, playerId);
  return p ? playerAgeAtDate(p.dateOfBirth, p.birthYear, state.gameDate) : null;
}

export function caOf(state: CareerState, playerId: string): number {
  const p = getCareerPlayer(state, playerId);
  if (!p) return 0;
  const rating = (state.gameplayRatings[p.clubId] ?? []).find((r) => r.playerId === playerId);
  return rating?.ca ?? p.currentAbility ?? 0;
}

export function tierOf(state: CareerState, playerId: string): SquadStatusTier {
  return getPlayerSquadStatus(state, playerId) ?? "ROTATION";
}

/** Share of the club's played matches the role should start. */
export const EXPECTED_START_SHARE: Record<SquadStatusTier, number> = { KEY_PLAYER: 0.8, FIRST_CHOICE: 0.6, ROTATION: 0.35, SQUAD_PLAYER: 0.15, TALENT: 0.1 };

export function managerMatchesPlayed(state: CareerState): { date: string; points: number }[] {
  const me = state.playerClubId;
  return state.fixtures
    .filter((f) => (f.homeClubId === me || f.awayClubId === me) && state.results[f.id])
    .map((f) => {
      const winner = matchWinnerClubId(state.results[f.id]!);
      const points = winner === null ? 1 : winner === me ? 2 : 0;
      return { date: f.date, points };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function startsOf(state: CareerState, playerId: string): { starts: number; appearances: number } {
  const s = state.playerSeasonStats[playerId];
  return { starts: s?.starts ?? 0, appearances: s?.appearances ?? 0 };
}

export function playerName(state: CareerState, playerId: string): string {
  const p = getCareerPlayer(state, playerId);
  return p ? `${p.firstName} ${p.lastName}` : playerId;
}

export function dynamicsEvent(key: string, date: string, priority: EventPriority, subject: string, summary: string, playerId: string, extra: EventDestination[] = []): CareerEvent {
  return buildPlayerDynamicsEvent(key, date, priority, subject, summary, [{ route: "PLAYER_PROFILE", playerId }, ...extra], playerId);
}

export function addDaysIso(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
