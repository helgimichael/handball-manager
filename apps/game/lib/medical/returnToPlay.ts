// Arena Nights 231 -- MED-01 C "Return-to-play timeline" and MED-01a phase stepper. A read-only projection
// of the existing rehab rules (lib/medical/rehab.ts: daily progress = quality / expected duration; the
// RETURN_TO_PLAY phase makes a player selectable again as LIMITED; 1.0 = fully back). Nothing here changes
// an injury -- it answers "which matches does he miss?" from the same arithmetic the daily tick applies.
// Dates are projections, so a return is shown as a range: selectable (limited) -> fully fit.
import { addDays, daysBetween } from "../career/dateUtils";
import type { CareerFixture, CareerState } from "../career/types";
import { computeMedicalRehabQuality } from "./medicalStaffQuality";
import { REHAB_PHASES, REHAB_PHASE_THRESHOLDS, type ActiveInjury, type RehabPhase } from "./types";

/** Days of rehab (at this medical quality) until progress reaches `target`. 0 when already there. */
export function daysToProgress(injury: Pick<ActiveInjury, "rehabProgress" | "expectedDurationDays">, target: number, quality: number): number {
  if (injury.rehabProgress >= target) return 0;
  return Math.ceil(((target - injury.rehabProgress) * injury.expectedDurationDays) / Math.max(0.01, quality));
}

export interface PhaseStep { phase: RehabPhase; /** Projected first day in the phase (today for passed / current phases). */ from: string; state: "done" | "current" | "todo" }

export interface ReturnProjection {
  /** First day the player is selectable again (LIMITED, the RETURN_TO_PLAY phase). */
  playableFrom: string;
  /** First day fully recovered. */
  fullReturn: string;
  steps: PhaseStep[];
}

export function projectReturn(injury: ActiveInjury, today: string, quality: number): ReturnProjection {
  const current = REHAB_PHASES.indexOf(injury.currentPhase);
  return {
    playableFrom: addDays(today, daysToProgress(injury, REHAB_PHASE_THRESHOLDS.RETURN_TO_PLAY, quality)),
    fullReturn: addDays(today, daysToProgress(injury, 1, quality)),
    steps: REHAB_PHASES.map((phase, i) => ({ phase, from: i <= current ? today : addDays(today, daysToProgress(injury, REHAB_PHASE_THRESHOLDS[phase], quality)), state: i < current ? "done" : i === current ? "current" : "todo" })),
  };
}

export interface TimelineRow {
  playerId: string;
  injury: ActiveInjury;
  projection: ReturnProjection;
  /** Fixtures in the window before he is selectable. */
  misses: CareerFixture[];
  /** Fixtures where he is selectable but still limited (before full recovery). */
  limited: CareerFixture[];
}

export interface ReturnTimeline {
  today: string;
  /** Every day in the window, ISO. */
  days: string[];
  fixtures: CareerFixture[];
  rows: TimelineRow[];
  quality: number;
  next: CareerFixture | null;
  /** Injured players who miss the next match. */
  missingNext: number;
}

/** The squad's injuries against the club's upcoming fixtures, soonest return first. */
export function returnTimeline(state: CareerState, squadIds: readonly string[], horizonDays = 28): ReturnTimeline {
  const today = state.gameDate;
  const quality = computeMedicalRehabQuality(state.staffRoster[state.playerClubId] ?? []);
  const end = addDays(today, horizonDays - 1);
  const fixtures = state.fixtures
    .filter((f) => !state.results[f.id] && (f.homeClubId === state.playerClubId || f.awayClubId === state.playerClubId) && f.date >= today && f.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const rows: TimelineRow[] = [];
  for (const playerId of squadIds) {
    const injury = state.playerInjuries[playerId]?.activeInjury;
    if (!injury) continue;
    const projection = projectReturn(injury, today, quality);
    rows.push({ playerId, injury, projection, misses: fixtures.filter((f) => f.date < projection.playableFrom), limited: fixtures.filter((f) => f.date >= projection.playableFrom && f.date < projection.fullReturn) });
  }
  rows.sort((a, b) => a.projection.playableFrom.localeCompare(b.projection.playableFrom) || a.playerId.localeCompare(b.playerId));
  const next = fixtures[0] ?? null;
  return {
    today,
    days: Array.from({ length: horizonDays }, (_, i) => addDays(today, i)),
    fixtures,
    rows,
    quality,
    next,
    missingNext: next ? rows.filter((r) => r.misses.some((f) => f.id === next.id)).length : 0,
  };
}

/** Column index (0-based, clamped to the window) of a date in the timeline. */
export function dayIndex(today: string, date: string, horizonDays: number): number {
  return Math.max(0, Math.min(horizonDays, daysBetween(today, date)));
}
