// HM-PRESEASON-1.0: career-start timing (preseason length), the real
// Swedish 2026/27 league-kickoff calendar, a single provisional early
// cup round, season-phase derivation, and friendly-match booking. One
// module, reused by newCareer.ts (creation), saveMigration.ts (backfill),
// and the Schedule UI (booking) -- never a parallel fixture/match engine
// (Part: "Skapa inte parallella preseason-, match- eller calendar-motorer").
import { addDays, isSameOrBefore } from "./dateUtils";
import { REAL_LEAGUE_SCHEDULES } from "../game-data/realLeagueSchedules";
import type { CareerFixture, CareerState } from "./types";

// ---------------------------------------------------------------------------
// Career start timing.
// ---------------------------------------------------------------------------

export const PRESEASON_START_OPTIONS = ["8_WEEKS", "6_WEEKS", "4_WEEKS", "2_WEEKS", "FIRST_MATCH"] as const;
export type PreseasonStartOption = (typeof PRESEASON_START_OPTIONS)[number];

const WEEKS_BEFORE_KICKOFF: Record<Exclude<PreseasonStartOption, "FIRST_MATCH">, number> = {
  "8_WEEKS": 8,
  "6_WEEKS": 6,
  "4_WEEKS": 4,
  "2_WEEKS": 2,
};

/**
 * The real Swedish 2026/27 league-kickoff calendar: each competition's
 * FIRST regular-season match (not any single club's own premiere), read
 * from the imported Profixio schedule (HM-ALPHA2-01) -- Herrallsvenskan
 * 2026-09-17 (IFK Tumba's own premiere is 2026-09-20), Handbollsligan
 * 2026-09-23. Keyed by the SAME literal competitionId
 * `lib/game-data/competitions.ts` already uses for these two divisions --
 * no new competition vocabulary invented. Any competitionId not listed
 * here (a career created without an explicit `preseasonStart`, or a
 * future nation/competition this milestone doesn't model real dates for)
 * falls back to `GAME_CURRENT_DATE` in newCareer.ts, exactly matching
 * this codebase's pre-existing single-date assumption -- never a crash,
 * never an invented date.
 */
export const REAL_LEAGUE_KICKOFF_DATES: Record<string, string> = Object.fromEntries(
  Object.entries(REAL_LEAGUE_SCHEDULES).map(([competitionId, schedule]) => [competitionId, schedule.fixtures.reduce((first, f) => (f.date < first ? f.date : first), schedule.fixtures[0].date)]),
);

export function resolveLeagueKickoffDate(competitionId: string, fallback: string): string {
  return REAL_LEAGUE_KICKOFF_DATES[competitionId] ?? fallback;
}

/**
 * The manager's own preseason-length choice, resolved against the real
 * league-kickoff date. `FIRST_MATCH` returns `null` -- the caller must
 * compute it AFTER the full fixture list (league + cup) is known, as the
 * earliest fixture date involving the player's club (Part: "vid första
 * tävlingsmatchen").
 */
export function computeCareerStartDate(leagueKickoffDate: string, option: PreseasonStartOption): string | null {
  if (option === "FIRST_MATCH") return null;
  return addDays(leagueKickoffDate, -WEEKS_BEFORE_KICKOFF[option] * 7);
}

// ---------------------------------------------------------------------------
// Provisional early cup round.
// ---------------------------------------------------------------------------

/** How long before league kickoff the single provisional cup round is scheduled. */
const CUP_ROUND_WEEKS_BEFORE_KICKOFF = 3;

/**
 * Part: "cupmatcher ska inte ignoreras" -- but no real Svenska Cupen
 * fixture data exists anywhere in this codebase (confirmed by audit), and
 * authoring a full realistic bracket is out of this milestone's scope
 * (Scope stop: no complex competition generation). This generates ONE
 * provisional early cup round -- adjacent deterministic pairings within
 * the SAME competition's club list (same honest "deliberately
 * PROVISIONAL" precedent packages/game-simulation's own
 * generateDoubleRoundRobin doc comment already sets for league fixtures),
 * tagged `type: "CUP"` and the competition's own real competitionId
 * (never a phantom competition id `getClubsByCompetition` etc. wouldn't
 * recognize). A club with no pairing partner (odd club count) gets a bye
 * -- no fixture, not an error.
 */
export function generateProvisionalCupRound(competitionId: string, clubIds: readonly string[], leagueKickoffDate: string): CareerFixture[] {
  const cupDate = addDays(leagueKickoffDate, -CUP_ROUND_WEEKS_BEFORE_KICKOFF * 7);
  const fixtures: CareerFixture[] = [];
  for (let i = 0; i + 1 < clubIds.length; i += 2) {
    const home = clubIds[i];
    const away = clubIds[i + 1];
    fixtures.push({
      id: `cup-${competitionId}-r1-${i / 2}`,
      competitionId,
      round: 1,
      date: cupDate,
      homeClubId: home,
      awayClubId: away,
      type: "CUP",
    });
  }
  return fixtures;
}

// ---------------------------------------------------------------------------
// Season phase.
// ---------------------------------------------------------------------------

export type SeasonPhase = "PRESEASON" | "COMPETITIVE_SEASON";

/**
 * Part: "PRESEASON ska inte betyda 'inga tävlingsmatcher'" -- this is
 * purely a date comparison against the real league-kickoff date, never a
 * flag that gates whether cup/friendly fixtures may exist or be played.
 */
export function getSeasonPhase(state: CareerState): SeasonPhase {
  return isSameOrBefore(state.leagueKickoffDate, state.gameDate) ? "COMPETITIVE_SEASON" : "PRESEASON";
}

// ---------------------------------------------------------------------------
// Friendly booking.
// ---------------------------------------------------------------------------

export interface BookFriendlyResult {
  ok: boolean;
  state: CareerState;
  error?: string;
}

function fixtureConflictsFor(state: CareerState, clubId: string, date: string): boolean {
  return state.fixtures.some((f) => f.date === date && (f.homeClubId === clubId || f.awayClubId === clubId));
}

/**
 * Part: "Förhindra uppenbara konflikter" -- same day as an existing
 * fixture (own club OR opponent), or before career start. Deliberately
 * no complex negotiation/availability model (Scope stop). Home/away is
 * fixed as the manager's own club playing at home for simplicity -- a
 * provisional choice, not a claim about real fixture-list conventions.
 */
export function bookFriendly(state: CareerState, date: string, opponentClubId: string): BookFriendlyResult {
  if (opponentClubId === state.playerClubId) {
    return { ok: false, state, error: "En klubb kan inte boka en träningsmatch mot sig själv." };
  }
  if (!isSameOrBefore(state.gameDate, date)) {
    return { ok: false, state, error: "Datumet ligger före karriärens startdatum." };
  }
  if (fixtureConflictsFor(state, state.playerClubId, date)) {
    return { ok: false, state, error: "Din klubb har redan en match detta datum." };
  }
  if (fixtureConflictsFor(state, opponentClubId, date)) {
    return { ok: false, state, error: "Motståndaren har redan en match detta datum." };
  }

  const fixture: CareerFixture = {
    id: `friendly-${state.playerClubId}-${opponentClubId}-${date}`,
    competitionId: state.competitionId,
    round: 0,
    date,
    homeClubId: state.playerClubId,
    awayClubId: opponentClubId,
    type: "FRIENDLY",
  };
  return { ok: true, state: { ...state, fixtures: [...state.fixtures, fixture] } };
}
