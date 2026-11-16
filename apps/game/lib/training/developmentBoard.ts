// Arena Nights TRN-01d: development leaderboard for the manager's own
// squad. Reads the stored, bounded development history (never computes
// development) and ranks players by visible attribute gains in a recent
// window, with Swedish attribute labels. Own players only: stars use the
// same staff assessment the existing own-squad views already show.
import { getCareerSquad } from "../career/careerWorld";
import { addDays } from "../career/dateUtils";
import type { CareerState } from "../career/types";
import { abilityStarsFromCA, potentialStarsFromPA } from "../development/types";
import { playerAgeAtDate } from "../development/developmentIntegration";
import type { PlayerMock } from "../game-data";
import { getAttributeLabel } from "../rating/attributeVocabulary";

export type DevelopmentStatus = "IMPROVING" | "TRAINING" | "NO_DATA";

export const DEVELOPMENT_STATUS_LABEL: Record<DevelopmentStatus, string> = { IMPROVING: "Förbättras", TRAINING: "Tränar", NO_DATA: "Ingen data" };

export interface AttributeGain {
  attribute: string;
  label: string;
  from: number;
  to: number;
  date: string;
}

export interface DevelopmentRow {
  player: PlayerMock;
  age: number | null;
  level: number | null;
  potential: number | null;
  status: DevelopmentStatus;
  /** Net change per attribute inside the window, biggest first. */
  gains: AttributeGain[];
  /** Sum of net attribute steps inside the window (can be negative). */
  totalGain: number;
  /** Latest visible change ever recorded, for players with no change in the window. */
  latest: AttributeGain | null;
  focus: string;
}

export const DEVELOPMENT_WINDOW_DAYS = 28;

export function developmentLeaderboard(state: CareerState, windowDays = DEVELOPMENT_WINDOW_DAYS): DevelopmentRow[] {
  const since = addDays(state.gameDate, -windowDays);
  const ratings = state.gameplayRatings[state.playerClubId] ?? [];
  return getCareerSquad(state)
    .map((player): DevelopmentRow => {
      const dev = state.playerDevelopmentState[player.id];
      const rating = ratings.find((r) => r.playerId === player.id);
      const history = dev?.developmentHistory ?? [];
      // History is most-recent-first; walk oldest-first to get from -> to per attribute.
      const byAttribute = new Map<string, AttributeGain>();
      for (const event of [...history].reverse()) {
        if (event.date <= since) continue;
        const prior = byAttribute.get(event.attribute);
        byAttribute.set(event.attribute, { attribute: event.attribute, label: getAttributeLabel(event.attribute), from: prior?.from ?? event.previousValue, to: event.newValue, date: event.date });
      }
      const gains = [...byAttribute.values()].filter((g) => g.to !== g.from).sort((a, b) => b.to - b.from - (a.to - a.from) || b.date.localeCompare(a.date));
      const first = history[0];
      const hasPending = dev ? Object.values(dev.attributeStimulus).some((v) => (v ?? 0) > 0) || Object.values(dev.attributeProgress).some((v) => (v ?? 0) > 0) : false;
      const status: DevelopmentStatus = first && dev?.lastDevelopmentDate ? "IMPROVING" : hasPending ? "TRAINING" : "NO_DATA";
      return {
        player,
        age: playerAgeAtDate(player.dateOfBirth, player.birthYear, state.gameDate),
        level: rating ? abilityStarsFromCA(rating.ca) : null,
        potential: rating ? potentialStarsFromPA(rating.pa) : null,
        status,
        gains,
        totalGain: gains.reduce((n, g) => n + (g.to - g.from), 0),
        latest: first ? { attribute: first.attribute, label: getAttributeLabel(first.attribute), from: first.previousValue, to: first.newValue, date: first.date } : null,
        focus: state.playerTrainingAssignments[player.id]?.individualFocus ?? "NORMAL",
      };
    })
    .sort((a, b) => b.totalGain - a.totalGain || (b.latest?.date ?? "").localeCompare(a.latest?.date ?? "") || `${a.player.lastName}${a.player.firstName}`.localeCompare(`${b.player.lastName}${b.player.firstName}`, "sv"));
}
