// HM-PLAYTEST-01 3.1: preseason planning -- friendlies (home, away or at a
// neutral venue, singly or as a programme), training camps, training trips
// abroad and friendly tournaments.
//
// Everything lands in the existing calendar and finances:
//   - friendlies and tournament games are ordinary FRIENDLY fixtures, played
//     like any other match (and so build match fitness, lib/players/matchFitness.ts);
//   - camps/trips/tournaments are dated preseason events that block other
//     bookings and competitive dates;
//   - every booking's estimated cost is charged to the club's cash as a dated
//     one-off ledger transaction, and is refused when the club cannot pay.
//
// Effects of a camp/trip are modest and real: during camp days the squad's
// match-fitness training ceiling is higher (daily practice games), and the
// group gets a small, fading morale lift when the camp ends.
import type { CareerFixture, CareerState } from "./types";
import { adjustClubCash } from "../economy/clubEconomyIntegration";
import { addMoraleShock } from "../players/morale";
import { getCareerSquad } from "./careerWorld";
import { getClub } from "../game-data";

export type FriendlyVenue = "HOME" | "AWAY" | "NEUTRAL";
export type PreseasonEventKind = "CAMP" | "TRIP" | "TOURNAMENT";

export type PreseasonEvent = {
  readonly id: string;
  readonly kind: PreseasonEventKind;
  readonly name: string;
  readonly location: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly costEur: number;
  readonly fixtureIds?: readonly string[];
};

/**
 * Estimated costs in EUR (shown in the player's currency). Order-of-magnitude
 * figures for a Swedish club at this level, labelled as estimates in the UI.
 */
export const PRESEASON_COSTS = {
  friendlyHome: 600,        // hall hire and referees
  friendlyAway: 900,        // bus travel and a meal
  friendlyNeutral: 1100,    // hall hire, referees and travel
  campPerDay: 900,          // domestic camp: lodging, food, halls
  tripPerDay: 1800,         // abroad: lodging, food, halls
  tripTravel: 3000,         // flights for the travelling squad
  tournamentEntry: 1500,
} as const;

export const CAMP_LOCATIONS = ["Hemmaplan (dagläger)", "Bosön, Lidingö", "Hindås", "Sätra Brunn", "Tylösand"] as const;
export const TRIP_LOCATIONS = ["Malaga, Spanien", "Alicante, Spanien", "Belek, Turkiet", "Køge, Danmark", "Flensburg, Tyskland"] as const;
export const MAX_CAMP_DAYS = 10;
/** During a camp the training-only match-fitness ceiling rises to this (practice games every day). */
export const CAMP_MATCH_FITNESS_CEILING = 70;

export type PlanResult = { ok: true; state: CareerState; costEur: number } | { ok: false; state: CareerState; error: string };

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}
const within = (date: string, from: string, to: string) => date >= from && date <= to;

export function preseasonEvents(state: CareerState): readonly PreseasonEvent[] {
  return state.preseasonEvents ?? [];
}

export function campOn(state: CareerState, date: string): PreseasonEvent | undefined {
  return preseasonEvents(state).find((e) => e.kind !== "TOURNAMENT" && within(date, e.startDate, e.endDate));
}

function clubHasFixture(state: CareerState, clubId: string, date: string): boolean {
  return state.fixtures.some((f) => f.date === date && (f.homeClubId === clubId || f.awayClubId === clubId));
}

function cashOf(state: CareerState): number | null {
  return state.clubEconomies?.[state.playerClubId]?.cashEur ?? null;
}

function charge(state: CareerState, costEur: number, label: string, date: string): PlanResult {
  const cash = cashOf(state);
  if (cash !== null && cash < costEur) return { ok: false, state, error: `Klubben har inte råd: kostnaden är ${Math.round(costEur)} EUR men kassan är ${Math.round(cash)} EUR.` };
  return { ok: true, state: adjustClubCash(state, state.playerClubId, -costEur, { category: "OTHER_ONE_OFF", label, date }), costEur };
}

function dateProblem(state: CareerState, date: string): string | null {
  if (!date) return "Välj ett datum.";
  if (date < state.gameDate) return "Datumet har redan passerat.";
  if (clubHasFixture(state, state.playerClubId, date)) return `Din klubb har redan en match ${date}.`;
  const event = preseasonEvents(state).find((e) => within(date, e.startDate, e.endDate) && e.kind !== "TOURNAMENT");
  if (event) return `${event.name} pågår ${event.startDate}–${event.endDate}.`;
  return null;
}

/** A single friendly. Competitive fixtures on the same day for either club block it. */
export function planFriendly(state: CareerState, input: { date: string; opponentClubId: string; venue: FriendlyVenue; location?: string; charged?: boolean }): PlanResult {
  if (input.opponentClubId === state.playerClubId) return { ok: false, state, error: "En klubb kan inte möta sig själv." };
  const problem = dateProblem(state, input.date);
  if (problem) return { ok: false, state, error: problem };
  if (clubHasFixture(state, input.opponentClubId, input.date)) return { ok: false, state, error: `${getClub(input.opponentClubId)?.name ?? "Motståndaren"} har redan en match ${input.date}.` };
  const home = input.venue === "AWAY" ? input.opponentClubId : state.playerClubId;
  const away = input.venue === "AWAY" ? state.playerClubId : input.opponentClubId;
  const fixture: CareerFixture = {
    id: `friendly-${state.playerClubId}-${input.opponentClubId}-${input.date}`,
    competitionId: state.competitionId,
    round: 0,
    date: input.date,
    homeClubId: home,
    awayClubId: away,
    type: "FRIENDLY",
    ...(input.venue === "NEUTRAL" ? { location: input.location || "Neutral plan" } : {}),
  };
  if (state.fixtures.some((f) => f.id === fixture.id)) return { ok: false, state, error: "Matchen är redan bokad." };
  const cost = input.charged === false ? 0 : input.venue === "HOME" ? PRESEASON_COSTS.friendlyHome : input.venue === "AWAY" ? PRESEASON_COSTS.friendlyAway : PRESEASON_COSTS.friendlyNeutral;
  const withFixture = { ...state, fixtures: [...state.fixtures, fixture] };
  if (cost === 0) return { ok: true, state: withFixture, costEur: 0 };
  return charge(withFixture, cost, `Träningsmatch mot ${getClub(input.opponentClubId)?.shortName ?? input.opponentClubId}`, input.date);
}

/** Several friendlies at once, all or nothing. */
export function planFriendlyProgramme(state: CareerState, entries: readonly Parameters<typeof planFriendly>[1][]): PlanResult {
  let next = state, total = 0;
  for (const entry of entries) {
    const r = planFriendly(next, entry);
    if (!r.ok) return { ok: false, state, error: `${entry.date}: ${r.error}` };
    next = r.state;
    total += r.costEur;
  }
  return { ok: true, state: next, costEur: total };
}

export function planTrainingCamp(state: CareerState, input: { kind: "CAMP" | "TRIP"; location: string; startDate: string; days: number }): PlanResult {
  const days = Math.max(1, Math.min(MAX_CAMP_DAYS, Math.round(input.days)));
  const endDate = addDays(input.startDate, days - 1);
  for (let d = 0; d < days; d++) {
    const date = addDays(input.startDate, d);
    const problem = dateProblem(state, date);
    if (problem) return { ok: false, state, error: problem };
  }
  const cost = input.kind === "TRIP" ? PRESEASON_COSTS.tripTravel + PRESEASON_COSTS.tripPerDay * days : PRESEASON_COSTS.campPerDay * days;
  const name = input.kind === "TRIP" ? `Träningsresa till ${input.location}` : `Träningsläger: ${input.location}`;
  const event: PreseasonEvent = { id: `camp-${input.startDate}`, kind: input.kind, name, location: input.location, startDate: input.startDate, endDate, costEur: cost };
  const charged = charge({ ...state, preseasonEvents: [...preseasonEvents(state), event] }, cost, name, input.startDate);
  return charged;
}

export function planFriendlyTournament(state: CareerState, input: { name: string; location: string; startDate: string; opponentClubIds: readonly string[] }): PlanResult {
  const opponents = [...new Set(input.opponentClubIds.filter((id) => id && id !== state.playerClubId))];
  if (opponents.length < 2 || opponents.length > 3) return { ok: false, state, error: "En träningsturnering har två eller tre motståndare." };
  const programme = planFriendlyProgramme(state, opponents.map((opponentClubId, i) => ({ date: addDays(input.startDate, i), opponentClubId, venue: "NEUTRAL" as const, location: input.location, charged: false })));
  if (!programme.ok) return programme;
  const endDate = addDays(input.startDate, opponents.length - 1);
  const fixtureIds = programme.state.fixtures.slice(state.fixtures.length).map((f) => f.id);
  const cost = PRESEASON_COSTS.tournamentEntry + PRESEASON_COSTS.friendlyNeutral;
  const event: PreseasonEvent = { id: `tournament-${input.startDate}`, kind: "TOURNAMENT", name: input.name || `Träningsturnering i ${input.location}`, location: input.location, startDate: input.startDate, endDate, costEur: cost, fixtureIds };
  return charge({ ...programme.state, preseasonEvents: [...preseasonEvents(programme.state), event] }, cost, event.name, input.startDate);
}

/** One calendar day: a camp ending today lifts the squad's morale a little. Idempotent per date. */
export function applyPreseasonEventDay(state: CareerState, date: string): CareerState {
  const ending = preseasonEvents(state).filter((e) => e.kind !== "TOURNAMENT" && e.endDate === date);
  let next = state;
  for (const camp of ending) {
    for (const p of getCareerSquad(next)) {
      const already = next.playerDynamics?.morale?.[p.id]?.shocks?.some((s) => s.label === `Gemenskap från ${camp.name.toLowerCase()}`);
      if (!already) next = addMoraleShock(next, p.id, 3, `Gemenskap från ${camp.name.toLowerCase()}`, 21);
    }
  }
  return next;
}
