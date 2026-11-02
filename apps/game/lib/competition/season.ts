// HM-ALPHA3-M03: the season engine -- what happens around the league.
//
// Daily (progressCompetitions, from the tick and after the manager's own
// matches):
// 1. REGULAR: once both Swedish leagues have played every round, the
//    postseason is created from the final tables: SM-slutspel (HBL 1-8),
//    kval to Handbollsligan (HBL 11-13 v Allsvenskan 4-2), kval to
//    Allsvenskan (Allsvenskan 11-12 v Division 1), plus the direct moves.
// 2. POSTSEASON: series and ties advance as games are played; a decided
//    series drops its unplayed games; the next round is drawn when both of
//    its feeding ties are decided.
// 3. COMPLETE: champion, promotion/relegation for next season, awards and
//    prize money. Season completion (calendar.checkSeasonComplete) waits
//    for this phase.
// Svenska cupen runs alongside the league from its group stage to Final4.
// Formats: rules.ts (verified rules and isolated assumptions).
import { matchWinnerClubId, resolveKnockoutDecider, type ClubStrength, type FastMatchResult } from "@handball-manager/game-simulation";
import type { CareerEvent } from "../career/careerEvents";
import { buildClubEvent } from "../career/careerEvents";
import { addDays } from "../career/dateUtils";
import { getCareerClubSquad } from "../career/careerWorld";
import { computeSquadDerivedClubStrength } from "../career/squadDerivedClubStrength";
import type { CareerFixture, CareerState, PlayerSeasonStats } from "../career/types";
import { averageRating } from "../career/types";
import { adjustClubCash } from "../economy/clubEconomyIntegration";
import { EUR_TO_SEK_REFERENCE_RATE } from "../economy/currency";
import { getClub, CLUBS } from "../game-data";
import {
  ALLSVENSKAN, ALLSVENSKAN_RULES, CUP_RULES, DIVISION_1, HANDBOLLSLIGAN, KVAL_ALLSVENSKAN, KVAL_HBL, KVAL_HBL_RULES, PLAYOFF_BONUS_EUR, SERIES_OVERTIME_ROUNDS, SM_SLUTSPEL, SM_SLUTSPEL_RULES, SVENSKA_CUPEN, type SeriesFormat,
} from "./rules";
import { competitionClubIds, competitionTable, hasLeagueCalendar, remainingLeagueFixtures } from "./tables";
import type { CompetitionTie, SeasonAward, SeasonOutcome, TieStage } from "./types";

type Emit = (event: CareerEvent) => void;

const STAGE_LABEL: Record<TieStage, string> = {
  QF: "Kvartsfinal", SF: "Semifinal", F: "SM-final", KVAL_HBL: "Kval till Handbollsligan", KVAL_ALLSV: "Kval till Allsvenskan",
  CUP_GROUP: "Gruppspel", CUP_R16: "Åttondelsfinal", CUP_QF: "Kvartsfinal", CUP_SF: "Semifinal", CUP_F: "Final", CUP_3RD: "Match om tredjepris",
};

export function seasonYear(seasonId: string): number {
  return Number(seasonId.slice(0, 4));
}

function strengthOf(state: CareerState, clubId: string): ClubStrength {
  return computeSquadDerivedClubStrength(clubId, getCareerClubSquad(state, clubId), state.gameplayRatings[clubId] ?? []);
}

function hashRank(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Outcome lifecycle
// ---------------------------------------------------------------------------

export function newSeasonOutcome(state: CareerState): SeasonOutcome {
  return {
    seasonId: state.seasonId,
    phase: "REGULAR",
    bothTiersSimulated: hasLeagueCalendar(state, HANDBOLLSLIGAN) && hasLeagueCalendar(state, ALLSVENSKAN),
    regularSeasonWinners: {},
    nextMembership: {},
    promoted: [],
    relegated: [],
    awards: [],
    announced: [],
  };
}

export function ensureSeasonOutcome(state: CareerState): CareerState {
  if (state.seasonOutcome?.seasonId === state.seasonId) return state;
  return { ...state, seasonOutcome: newSeasonOutcome(state), competitionTies: {} };
}

function announce(state: CareerState, id: string, emit: Emit, build: () => CareerEvent | null): CareerState {
  const outcome = state.seasonOutcome!;
  if (outcome.announced.includes(id)) return state;
  const event = build();
  if (event) emit(event);
  return { ...state, seasonOutcome: { ...outcome, announced: [...outcome.announced, id] } };
}

// ---------------------------------------------------------------------------
// Fixtures for ties
// ---------------------------------------------------------------------------

/**
 * First date on or after `preferred` when none of `clubIds` has a fixture that day or the day before (avoids back-to-back games).
 * Never earlier than the day after the one being processed: during the tick `gameDate` is still the previous day, so the
 * earliest new fixture is gameDate + 2 -- a tie drawn late can never be scheduled in the past and left unplayed.
 */
export function freeDate(state: Pick<CareerState, "fixtures" | "gameDate">, clubIds: readonly string[], preferred: string, extra: readonly CareerFixture[] = []): string {
  const earliest = addDays(state.gameDate, 2);
  if (preferred < earliest) preferred = earliest;
  const busy = new Set<string>();
  for (const f of [...state.fixtures, ...extra]) {
    if (clubIds.includes(f.homeClubId) || clubIds.includes(f.awayClubId)) {
      busy.add(f.date);
      busy.add(addDays(f.date, 1));
    }
  }
  let date = preferred;
  for (let i = 0; i < 30 && busy.has(date); i++) date = addDays(date, 1);
  return date;
}

function fixtureType(competitionId: string): CareerFixture["type"] {
  return competitionId === SM_SLUTSPEL ? "PLAYOFF" : competitionId === SVENSKA_CUPEN ? "CUP" : "QUALIFIER";
}

function tieFixtures(state: CareerState, tie: CompetitionTie, start: string): CareerFixture[] {
  const type = fixtureType(tie.competitionId);
  const base = `${seasonYear(tie.seasonId)}-${tie.competitionId === SVENSKA_CUPEN ? "cup" : tie.competitionId === SM_SLUTSPEL ? "sm" : "kval"}-${tie.key}`;
  const out: CareerFixture[] = [];
  const pair = [tie.highClubId, tie.lowClubId];
  if (tie.format.kind === "SERIES") {
    let date = start;
    tie.format.series.homePattern.forEach((side, k) => {
      date = freeDate(state, pair, k === 0 ? start : addDays(date, tie.format.kind === "SERIES" ? tie.format.series.days : 3), out);
      const home = side === "HIGH" ? tie.highClubId : tie.lowClubId;
      out.push({ id: `${base}-g${k + 1}`, competitionId: tie.competitionId, round: k + 1, date, homeClubId: home, awayClubId: home === tie.highClubId ? tie.lowClubId : tie.highClubId, type, stage: { tieId: tie.id, game: k + 1, mustDecide: true } });
    });
  } else if (tie.format.kind === "TWO_LEGS") {
    const first = freeDate(state, pair, start, out);
    out.push({ id: `${base}-l1`, competitionId: tie.competitionId, round: 1, date: first, homeClubId: tie.lowClubId, awayClubId: tie.highClubId, type, stage: { tieId: tie.id, game: 1, mustDecide: false } });
    const second = freeDate(state, pair, addDays(first, 7), out);
    out.push({ id: `${base}-l2`, competitionId: tie.competitionId, round: 2, date: second, homeClubId: tie.highClubId, awayClubId: tie.lowClubId, type, stage: { tieId: tie.id, game: 2, mustDecide: true } });
  } else {
    const date = freeDate(state, pair, start, out);
    out.push({ id: `${base}-g1`, competitionId: tie.competitionId, round: 1, date, homeClubId: tie.highClubId, awayClubId: tie.lowClubId, type, stage: { tieId: tie.id, game: 1, mustDecide: true } });
  }
  return out;
}

function addTie(state: CareerState, tie: Omit<CompetitionTie, "fixtureIds">, start: string): CareerState {
  const full: CompetitionTie = { ...tie, fixtureIds: [] };
  const fixtures = tieFixtures(state, full, start);
  full.fixtureIds = fixtures.map((f) => f.id);
  return { ...state, fixtures: [...state.fixtures, ...fixtures], competitionTies: { ...state.competitionTies, [full.id]: full } };
}

const series = (s: SeriesFormat) => ({ kind: "SERIES" as const, series: s });

// ---------------------------------------------------------------------------
// Knockout decider (called wherever a result is written)
// ---------------------------------------------------------------------------

/** Adds overtime/shootout to a level result when the fixture's tie requires a winner. Regulation time is untouched. */
export function applyKnockoutDecider(state: CareerState, fixture: CareerFixture, result: FastMatchResult, strength?: (clubId: string) => ClubStrength): FastMatchResult {
  if (!fixture.stage?.mustDecide) return result;
  const tie = state.competitionTies?.[fixture.stage.tieId];
  const getStrength = strength ?? ((id: string) => strengthOf(state, id));
  let aggregateBefore: { home: number; away: number } | undefined;
  if (tie?.format.kind === "TWO_LEGS") {
    const firstLeg = state.results[tie.fixtureIds[0]!];
    // In the first leg the roles were reversed: this game's home side was away.
    if (firstLeg) aggregateBefore = { home: firstLeg.awayGoals, away: firstLeg.homeGoals };
  }
  return resolveKnockoutDecider({
    result,
    seedPrefix: state.saveSeed,
    homeStrength: getStrength(fixture.homeClubId),
    awayStrength: getStrength(fixture.awayClubId),
    overtimeRounds: fixture.competitionId === SVENSKA_CUPEN ? CUP_RULES.overtimeRounds : SERIES_OVERTIME_ROUNDS,
    aggregateBefore,
  });
}

// ---------------------------------------------------------------------------
// Tie state
// ---------------------------------------------------------------------------

export function tieWins(state: CareerState, tie: CompetitionTie): Record<string, number> {
  const wins: Record<string, number> = { [tie.highClubId]: 0, [tie.lowClubId]: 0 };
  for (const id of tie.fixtureIds) {
    const r = state.results[id];
    const w = r ? matchWinnerClubId(r) : null;
    if (w && w in wins) wins[w] = (wins[w] ?? 0) + 1;
  }
  return wins;
}

function decideTie(state: CareerState, tie: CompetitionTie): string | null {
  if (tie.format.kind === "SERIES") {
    const need = Math.ceil(tie.format.series.bestOf / 2);
    const wins = tieWins(state, tie);
    return wins[tie.highClubId]! >= need ? tie.highClubId : wins[tie.lowClubId]! >= need ? tie.lowClubId : null;
  }
  if (tie.format.kind === "TWO_LEGS") {
    const [a, b] = tie.fixtureIds.map((id) => state.results[id]);
    if (!a || !b) return null;
    if (b.decider) return b.decider.winnerClubId;
    const goals = (club: string) => (a.homeClubId === club ? a.homeGoals : a.awayGoals) + (b.homeClubId === club ? b.homeGoals : b.awayGoals);
    return goals(tie.highClubId) > goals(tie.lowClubId) ? tie.highClubId : tie.lowClubId;
  }
  const r = state.results[tie.fixtureIds[0]!];
  return r ? matchWinnerClubId(r) ?? tie.highClubId : null;
}

// ---------------------------------------------------------------------------
// Postseason creation
// ---------------------------------------------------------------------------

function lastLeagueDate(state: CareerState): string {
  return state.fixtures.filter((f) => f.type === "LEAGUE").reduce((max, f) => (f.date > max ? f.date : max), state.gameDate);
}

/** Division 1 clubs ranked by squad strength (assumption: Division 1 is not simulated -- rules.ts). */
export function rankDivision1(state: CareerState): string[] {
  // A Division 1 group that is actually played (the manager's club after relegation) sends its real table leader up.
  const leaders = new Set(DIVISION_1.filter((c) => hasLeagueCalendar(state, c)).map((c) => competitionTable(state, c)[0]?.clubId).filter((id): id is string => !!id));
  const ids = CLUBS.filter((c) => (DIVISION_1 as readonly string[]).includes(state.competitionMembership?.[c.id] ?? c.competitionId)).map((c) => c.id);
  return ids
    .map((id) => ({ id, s: strengthOf(state, id).overall, lot: hashRank(`${state.saveSeed}:${state.seasonId}:div1:${id}`) }))
    .sort((a, b) => Number(leaders.has(b.id)) - Number(leaders.has(a.id)) || b.s - a.s || a.lot - b.lot)
    .map((x) => x.id);
}

function startPostseason(state: CareerState, date: string, emit: Emit): CareerState {
  let next = state;
  const outcome = { ...next.seasonOutcome! };
  const start = addDays(lastLeagueDate(next) > date ? lastLeagueDate(next) : date, 5);
  const nextMembership: Record<string, string> = {};
  const promoted: string[] = [];
  const relegated: string[] = [];

  if (hasLeagueCalendar(next, HANDBOLLSLIGAN)) {
    const hbl = competitionTable(next, HANDBOLLSLIGAN).map((r) => r.clubId);
    outcome.regularSeasonWinners = { ...outcome.regularSeasonWinners, [HANDBOLLSLIGAN]: hbl[0]! };
    SM_SLUTSPEL_RULES.quarterFinals.forEach(([h, l], i) => {
      next = addTie(next, { id: `${next.seasonId}:sm:QF${i + 1}`, seasonId: next.seasonId, competitionId: SM_SLUTSPEL, stage: "QF", label: `Kvartsfinal ${i + 1}`, highClubId: hbl[h - 1]!, lowClubId: hbl[l - 1]!, format: series(SM_SLUTSPEL_RULES.series), key: `QF${i + 1}`, feeds: { tieKey: `SF${Math.floor(i / 2) + 1}`, slot: (i % 2) as 0 | 1 } }, start);
    });
    if (outcome.bothTiersSimulated) {
      const allsv = competitionTable(next, ALLSVENSKAN).map((r) => r.clubId);
      KVAL_HBL_RULES.pairs.forEach(([h, a], i) => {
        next = addTie(next, { id: `${next.seasonId}:kval-hbl:K${i + 1}`, seasonId: next.seasonId, competitionId: KVAL_HBL, stage: "KVAL_HBL", label: `Kval ${i + 1}: HBL ${h} – Allsvenskan ${a}`, highClubId: hbl[h - 1]!, lowClubId: allsv[a - 1]!, format: series(KVAL_HBL_RULES.series), key: `K${i + 1}`, stakes: { highCompetitionId: HANDBOLLSLIGAN, lowCompetitionId: ALLSVENSKAN } }, start);
      });
      for (const pos of KVAL_HBL_RULES.directRelegation) { nextMembership[hbl[pos - 1]!] = ALLSVENSKAN; relegated.push(hbl[pos - 1]!); }
    }
  }
  if (hasLeagueCalendar(next, ALLSVENSKAN)) {
    const allsv = competitionTable(next, ALLSVENSKAN).map((r) => r.clubId);
    outcome.regularSeasonWinners = { ...outcome.regularSeasonWinners, [ALLSVENSKAN]: allsv[0]! };
    if (outcome.bothTiersSimulated) {
      for (const pos of ALLSVENSKAN_RULES.directPromotion) { nextMembership[allsv[pos - 1]!] = HANDBOLLSLIGAN; promoted.push(allsv[pos - 1]!); }
    }
    const div1 = rankDivision1(next);
    if (div1.length >= 4) {
      // Group winners up directly; the next two meet Allsvenskan 11-12 (assumption: ranked by strength).
      const [up1, up2, k1, k2] = div1;
      for (const id of [up1!, up2!]) { nextMembership[id] = ALLSVENSKAN; promoted.push(id); }
      ALLSVENSKAN_RULES.relegationKval.forEach((pos, i) => {
        next = addTie(next, { id: `${next.seasonId}:kval-allsv:A${i + 1}`, seasonId: next.seasonId, competitionId: KVAL_ALLSVENSKAN, stage: "KVAL_ALLSV", label: `Kval ${i + 1}: Allsvenskan ${pos} – Division 1`, highClubId: allsv[pos - 1]!, lowClubId: (i === 0 ? k1 : k2)!, format: series(ALLSVENSKAN_RULES.kvalSeries), key: `A${i + 1}`, stakes: { highCompetitionId: ALLSVENSKAN, lowCompetitionId: getClub((i === 0 ? k1 : k2)!)!.competitionId } }, start);
      });
      for (const pos of ALLSVENSKAN_RULES.directRelegation) { const id = allsv[pos - 1]!; nextMembership[id] = getClub(div1.at(-1)!)?.competitionId ?? DIVISION_1[0]; relegated.push(id); }
    }
  }
  next = { ...next, seasonOutcome: { ...outcome, phase: "POSTSEASON", nextMembership: { ...outcome.nextMembership, ...nextMembership }, promoted: [...outcome.promoted, ...promoted], relegated: [...outcome.relegated, ...relegated] } };
  return announcePostseasonPlace(next, date, emit);
}

function announcePostseasonPlace(state: CareerState, date: string, emit: Emit): CareerState {
  const me = state.playerClubId;
  const o = state.seasonOutcome!;
  const myTie = Object.values(state.competitionTies ?? {}).find((t) => t.competitionId !== SVENSKA_CUPEN && (t.highClubId === me || t.lowClubId === me));
  const table = competitionTable(state, state.competitionId);
  const position = table.findIndex((r) => r.clubId === me) + 1;
  let next = announce(state, "regular-season-end", emit, () => buildClubEvent("SEASON_MILESTONE", `${state.seasonId}:regular-end`, date, "IMPORTANT",
    o.regularSeasonWinners[state.competitionId] === me ? "Seriesegrare!" : `Grundserien är slut -- ${position}:a plats`,
    myTie ? `${myTie.label} väntar: ${clubName(myTie.highClubId)} mot ${clubName(myTie.lowClubId)}.` : o.promoted.includes(me) ? "Klubben är klar för spel en serie upp nästa säsong." : o.relegated.includes(me) ? "Klubben flyttas ned efter säsongen." : "Säsongen är slut för laget. Följ slutspelet och kvalet under våren.",
    [{ route: "SEASON" }]));
  if (o.promoted.includes(me)) next = announce(next, "promoted-direct", emit, () => buildClubEvent("SEASON_MILESTONE", `${state.seasonId}:promoted`, date, "IMPORTANT", "Uppflyttade!", "Klubben vann serien och spelar en serie högre nästa säsong.", [{ route: "SEASON" }]));
  if (o.relegated.includes(me)) next = announce(next, "relegated-direct", emit, () => buildClubEvent("SEASON_MILESTONE", `${state.seasonId}:relegated`, date, "IMPORTANT", "Nedflyttade", "Klubben slutade sist och spelar en serie lägre nästa säsong.", [{ route: "SEASON" }]));
  return next;
}

function clubName(id: string): string {
  return getClub(id)?.shortName ?? id;
}

// ---------------------------------------------------------------------------
// Svenska cupen
// ---------------------------------------------------------------------------

const GROUP_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

/** Creates this season's cup: 32 clubs (HBL, Allsvenskan, the four strongest Division 1 clubs), eight seeded groups of four. Skipped when the group stage would start after 1 October (a season joined late). */
export function createSvenskaCupen(state: CareerState): CareerState {
  if (Object.values(state.competitionTies ?? {}).some((t) => t.competitionId === SVENSKA_CUPEN)) return state;
  const year = seasonYear(state.seasonId);
  const firstRound = state.gameDate > `${year}-08-24` ? addDays(state.gameDate, 4) : `${year}-08-26`;
  if (firstRound > `${year}-10-01`) return state;
  const strength = (id: string) => strengthOf(state, id).overall;
  const lot = (id: string) => hashRank(`${state.saveSeed}:${state.seasonId}:cup:${id}`);
  const rank = (ids: string[]) => [...ids].sort((a, b) => strength(b) - strength(a) || lot(a) - lot(b));
  const hbl = rank(competitionClubIds(state, HANDBOLLSLIGAN));
  const allsv = rank(competitionClubIds(state, ALLSVENSKAN));
  const div1 = rankDivision1(state).slice(0, 4);
  const entrants = [...hbl, ...allsv, ...div1];
  if (entrants.length < 32) return state;
  // Four pots of eight in strength order; each group draws one club per pot (seeded lot).
  const pots = [0, 1, 2, 3].map((p) => entrants.slice(p * 8, p * 8 + 8).sort((a, b) => lot(a) - lot(b)));
  let next = state;
  GROUP_LETTERS.forEach((letter, g) => {
    const clubs = pots.map((pot) => pot[g]!);
    const id = `${state.seasonId}:cup:G${letter}`;
    const tie: CompetitionTie = { id, seasonId: state.seasonId, competitionId: SVENSKA_CUPEN, stage: "CUP_GROUP", label: `Grupp ${letter}`, highClubId: clubs[0]!, lowClubId: clubs[3]!, format: { kind: "SINGLE" }, fixtureIds: [], key: `G${letter}`, group: letter, clubIds: clubs };
    const rounds = [[[0, 3], [1, 2]], [[2, 0], [3, 1]], [[0, 1], [2, 3]]] as const;
    const fixtures: CareerFixture[] = [];
    rounds.forEach((pairs, r) => {
      for (const [h, a] of pairs) {
        const date = freeDate(next, [clubs[h]!, clubs[a]!], addDays(firstRound, r * 7), fixtures);
        fixtures.push({ id: `${year}-cup-G${letter}-r${r + 1}-${h}${a}`, competitionId: SVENSKA_CUPEN, round: r + 1, date, homeClubId: clubs[h]!, awayClubId: clubs[a]!, type: "CUP", stage: { tieId: id, game: r + 1, mustDecide: false } });
      }
    });
    tie.fixtureIds = fixtures.map((f) => f.id);
    next = { ...next, fixtures: [...next.fixtures, ...fixtures], competitionTies: { ...next.competitionTies, [id]: tie } };
  });
  return next;
}

export function cupGroupTable(state: CareerState, tie: CompetitionTie) {
  const rows = new Map((tie.clubIds ?? []).map((id) => [id, { clubId: id, played: 0, points: 0, goalsFor: 0, goalsAgainst: 0 }]));
  for (const id of tie.fixtureIds) {
    const r = state.results[id];
    if (!r) continue;
    const h = rows.get(r.homeClubId)!, a = rows.get(r.awayClubId)!;
    h.played++; a.played++;
    h.goalsFor += r.homeGoals; h.goalsAgainst += r.awayGoals; a.goalsFor += r.awayGoals; a.goalsAgainst += r.homeGoals;
    if (r.homeGoals > r.awayGoals) h.points += 2; else if (r.homeGoals < r.awayGoals) a.points += 2; else { h.points++; a.points++; }
  }
  const lot = (id: string) => hashRank(`${state.saveSeed}:${tie.id}:${id}`);
  // Points, then goal difference and goals (head-to-head simplified -- see CUP_RULES assumptions), then a seeded lot.
  return [...rows.values()].sort((x, y) => y.points - x.points || (y.goalsFor - y.goalsAgainst) - (x.goalsFor - x.goalsAgainst) || y.goalsFor - x.goalsFor || lot(x.clubId) - lot(y.clubId));
}

function progressCup(state: CareerState): CareerState {
  const ties = Object.values(state.competitionTies ?? {}).filter((t) => t.competitionId === SVENSKA_CUPEN);
  if (ties.length === 0) return state;
  const year = seasonYear(state.seasonId);
  let next = state;
  const byKey = (key: string) => Object.values(next.competitionTies ?? {}).find((t) => t.competitionId === SVENSKA_CUPEN && t.key === key);
  const groups = ties.filter((t) => t.stage === "CUP_GROUP");
  const groupsDone = groups.length > 0 && groups.every((g) => g.fixtureIds.every((id) => next.results[id]));
  if (groupsDone && !byKey("R16-1")) {
    const standings = Object.fromEntries(groups.map((g) => [g.group!, cupGroupTable(next, g)]));
    // Fixed cross pairing A1-B2, B1-A2, C1-D2, ... (the real draw is not modelled -- assumption).
    for (let k = 0; k < 8; k++) {
      const [x, y] = [GROUP_LETTERS[Math.floor(k / 2) * 2]!, GROUP_LETTERS[Math.floor(k / 2) * 2 + 1]!];
      const winner = (k % 2 === 0 ? standings[x] : standings[y])![0]!.clubId;
      const runner = (k % 2 === 0 ? standings[y] : standings[x])![1]!.clubId;
      next = addTie(next, { id: `${next.seasonId}:cup:R16-${k + 1}`, seasonId: next.seasonId, competitionId: SVENSKA_CUPEN, stage: "CUP_R16", label: `Åttondelsfinal ${k + 1}`, highClubId: winner, lowClubId: runner, format: { kind: "TWO_LEGS" }, key: `R16-${k + 1}`, feeds: { tieKey: `CQF-${Math.floor(k / 2) + 1}`, slot: (k % 2) as 0 | 1 } }, `${year}-10-21`);
    }
  }
  next = advanceBracket(next, SVENSKA_CUPEN, (key) => {
    if (key.startsWith("CQF-")) return { stage: "CUP_QF", label: `Kvartsfinal ${key.slice(4)}`, format: { kind: "TWO_LEGS" }, start: `${year}-12-02`, feeds: { tieKey: `CSF-${Math.ceil(Number(key.slice(4)) / 2)}`, slot: ((Number(key.slice(4)) - 1) % 2) as 0 | 1 } };
    if (key.startsWith("CSF-")) return { stage: "CUP_SF", label: `Semifinal ${key.slice(4)} (Final4)`, format: { kind: "SINGLE" }, start: `${year + 1}-03-06`, feeds: { tieKey: "CF", slot: (Number(key.slice(4)) - 1) as 0 | 1 } };
    return { stage: "CUP_F", label: "Final (Final4)", format: { kind: "SINGLE" }, start: `${year + 1}-03-07` };
  });
  // Final4 also plays a 3rd-place match between the semifinal losers.
  const sf1 = byKeyIn(next, SVENSKA_CUPEN, "CSF-1"), sf2 = byKeyIn(next, SVENSKA_CUPEN, "CSF-2");
  if (sf1?.loserClubId && sf2?.loserClubId && !byKeyIn(next, SVENSKA_CUPEN, "C3")) {
    next = addTie(next, { id: `${next.seasonId}:cup:C3`, seasonId: next.seasonId, competitionId: SVENSKA_CUPEN, stage: "CUP_3RD", label: "Match om tredjepris", highClubId: sf1.loserClubId, lowClubId: sf2.loserClubId, format: { kind: "SINGLE" }, key: "C3" }, `${year + 1}-03-07`);
  }
  return next;
}

function byKeyIn(state: CareerState, competitionId: string, key: string): CompetitionTie | undefined {
  return Object.values(state.competitionTies ?? {}).find((t) => t.competitionId === competitionId && t.key === key);
}

type NextRound = { stage: TieStage; label: string; format: CompetitionTie["format"]; start: string; feeds?: CompetitionTie["feeds"] };

/** Creates every next-round tie whose two feeding ties are decided. The better seed (regular-season position, or tie order) is the high club. */
function advanceBracket(state: CareerState, competitionId: string, describe: (key: string) => NextRound): CareerState {
  let next = state;
  const ties = Object.values(next.competitionTies ?? {}).filter((t) => t.competitionId === competitionId);
  const targets = [...new Set(ties.map((t) => t.feeds?.tieKey).filter((k): k is string => !!k))];
  for (const key of targets) {
    if (byKeyIn(next, competitionId, key)) continue;
    const feeders = ties.filter((t) => t.feeds?.tieKey === key).sort((a, b) => a.feeds!.slot - b.feeds!.slot);
    if (feeders.length < 2 || feeders.some((t) => !t.winnerClubId)) continue;
    const [a, b] = feeders.map((t) => t.winnerClubId!);
    const seed = (club: string) => seedPosition(next, club);
    const [high, low] = seed(a!) <= seed(b!) ? [a!, b!] : [b!, a!];
    const spec = describe(key);
    const lastGame = feeders.flatMap((t) => t.fixtureIds.map((id) => next.results[id] ? next.fixtures.find((f) => f.id === id)?.date ?? "" : "")).reduce((m, d) => (d > m ? d : m), "");
    const start = lastGame && addDays(lastGame, 4) > spec.start ? addDays(lastGame, 4) : spec.start;
    next = addTie(next, { id: `${next.seasonId}:${competitionId === SM_SLUTSPEL ? "sm" : "cup"}:${key}`, seasonId: next.seasonId, competitionId, stage: spec.stage, label: spec.label, highClubId: high, lowClubId: low, format: spec.format, key, feeds: spec.feeds }, start);
  }
  return next;
}

/** Regular-season position for seeding (HBL clubs before Allsvenskan before Division 1). */
function seedPosition(state: CareerState, clubId: string): number {
  for (const [offset, competitionId] of [[0, HANDBOLLSLIGAN], [100, ALLSVENSKAN]] as const) {
    const idx = competitionTable(state, competitionId).findIndex((r) => r.clubId === clubId);
    if (idx >= 0) return offset + idx + 1;
  }
  return 1000 + (hashRank(clubId) % 100);
}

// ---------------------------------------------------------------------------
// Daily progression
// ---------------------------------------------------------------------------

/** Settles every tie that has a winner, drops the unplayed games of decided series, and draws the next playoff rounds. */
function settleTies(state: CareerState, date: string, emit: Emit): CareerState {
  let next = state;
  for (const tie of Object.values(next.competitionTies ?? {})) {
    if (tie.winnerClubId || tie.stage === "CUP_GROUP") continue;
    const winner = decideTie(next, tie);
    if (!winner) continue;
    const loser = winner === tie.highClubId ? tie.lowClubId : tie.highClubId;
    const unplayed = new Set(tie.fixtureIds.filter((id) => !next.results[id]));
    next = {
      ...next,
      fixtures: next.fixtures.filter((f) => !unplayed.has(f.id)),
      competitionTies: { ...next.competitionTies, [tie.id]: { ...tie, winnerClubId: winner, loserClubId: loser, fixtureIds: tie.fixtureIds.filter((id) => !unplayed.has(id)) } },
    };
    if (tie.stakes) {
      next = { ...next, seasonOutcome: { ...next.seasonOutcome!, nextMembership: { ...next.seasonOutcome!.nextMembership, [winner]: tie.stakes.highCompetitionId, [loser]: tie.stakes.lowCompetitionId } } };
      if (tie.stakes.lowCompetitionId !== tie.stakes.highCompetitionId) {
        const o = next.seasonOutcome!;
        if (winner === tie.lowClubId) next = { ...next, seasonOutcome: { ...o, promoted: [...o.promoted, winner], relegated: [...o.relegated, loser] } };
      }
    }
    if (winner === next.playerClubId || loser === next.playerClubId) {
      const won = winner === next.playerClubId;
      const wins = tieWins(next, tie);
      const score = tie.format.kind === "SERIES" ? ` ${wins[winner]}–${wins[loser]} i matcher` : "";
      next = announce(next, `tie:${tie.id}`, emit, () => buildClubEvent("SEASON_MILESTONE", `${tie.id}:decided`, date, "IMPORTANT",
        won ? `${tie.label} vunnen` : `Utslagna i ${tie.label.toLowerCase()}`,
        `${clubName(winner)} vann mot ${clubName(loser)}${score}.${tie.stakes && won && tie.stakes.highCompetitionId !== tie.stakes.lowCompetitionId ? " Klubben spelar i den högre serien nästa säsong." : ""}`,
        [{ route: "SEASON" }]));
    }
  }
  return next;
}

export function progressCompetitions(state: CareerState, date: string, emit: Emit = () => undefined): CareerState {
  let next = ensureSeasonOutcome(state);
  next = settleTies(next, date, emit);
  next = progressCup(next);
  next = settleTies(next, date, emit);
  const outcome = next.seasonOutcome!;
  if (outcome.phase === "REGULAR") {
    const competitions = outcome.bothTiersSimulated ? [HANDBOLLSLIGAN, ALLSVENSKAN] : [next.competitionId];
    if (competitions.every((c) => remainingLeagueFixtures(next, c) === 0) && hasLeagueCalendar(next, next.competitionId)) {
      next = startPostseason(next, date, emit);
    }
  }
  if (next.seasonOutcome!.phase === "POSTSEASON") {
    next = advanceBracket(next, SM_SLUTSPEL, (key) => key.startsWith("SF")
      ? { stage: "SF", label: `Semifinal ${key.slice(2)}`, format: series(SM_SLUTSPEL_RULES.series), start: date, feeds: { tieKey: "F", slot: (Number(key.slice(2)) - 1) as 0 | 1 } }
      : { stage: "F", label: "SM-final", format: series(SM_SLUTSPEL_RULES.series), start: date });
    next = settleTies(next, date, emit);
    const ties = Object.values(next.competitionTies ?? {});
    const smFinal = ties.find((t) => t.competitionId === SM_SLUTSPEL && t.key === "F");
    const allDecided = ties.every((t) => t.stage === "CUP_GROUP" || t.winnerClubId);
    const cupDone = !ties.some((t) => t.competitionId === SVENSKA_CUPEN) || !!ties.find((t) => t.competitionId === SVENSKA_CUPEN && t.key === "CF")?.winnerClubId;
    const hblSeason = hasLeagueCalendar(next, HANDBOLLSLIGAN);
    if (allDecided && cupDone && (!hblSeason || smFinal?.winnerClubId)) next = finalizeSeason(next, date, emit);
  }
  return next;
}

// ---------------------------------------------------------------------------
// Season end: awards, prize money, outcome
// ---------------------------------------------------------------------------

export function computeAwards(state: CareerState): SeasonAward[] {
  const awards: SeasonAward[] = [];
  for (const competitionId of [HANDBOLLSLIGAN, ALLSVENSKAN]) {
    const clubs = new Set(competitionClubIds(state, competitionId));
    if (!hasLeagueCalendar(state, competitionId)) continue;
    const players = Object.values(state.worldSquads).flat().filter((p) => clubs.has(p.clubId));
    const stats = (id: string): PlayerSeasonStats | undefined => state.playerSeasonStats[id];
    const eligible = players.filter((p) => (stats(p.id)?.appearances ?? 0) >= 10);
    const name = (p: (typeof players)[number]) => p.id;
    const top = [...players].sort((a, b) => (stats(b.id)?.goals ?? 0) - (stats(a.id)?.goals ?? 0) || a.id.localeCompare(b.id))[0];
    if (top && (stats(top.id)?.goals ?? 0) > 0) awards.push({ id: "TOP_SCORER", label: "Skyttekung", competitionId, playerId: name(top), clubId: top.clubId, value: `${stats(top.id)!.goals} mål` });
    const keepers = eligible.filter((p) => p.position === "MV" && (stats(p.id)?.shotsFaced ?? 0) >= 100);
    const savePct = (id: string) => (stats(id)!.saves / Math.max(1, stats(id)!.shotsFaced));
    const gk = [...keepers].sort((a, b) => savePct(b.id) - savePct(a.id) || a.id.localeCompare(b.id))[0];
    if (gk) awards.push({ id: "BEST_GOALKEEPER", label: "Årets målvakt", competitionId, playerId: gk.id, clubId: gk.clubId, value: `${Math.round(savePct(gk.id) * 1000) / 10} % räddningar` });
    const mvp = [...eligible].sort((a, b) => averageRating(stats(b.id)!) - averageRating(stats(a.id)!) || a.id.localeCompare(b.id))[0];
    if (mvp) awards.push({ id: "MVP", label: "Årets spelare", competitionId, playerId: mvp.id, clubId: mvp.clubId, value: `Snittbetyg ${averageRating(stats(mvp.id)!)}` });
    for (const position of ["MV", "V6", "V9", "M9", "H9", "H6", "M6"]) {
      const best = [...eligible].filter((p) => p.position === position).sort((a, b) => averageRating(stats(b.id)!) - averageRating(stats(a.id)!) || a.id.localeCompare(b.id))[0];
      if (best) awards.push({ id: "ALL_STAR", label: "All-star", competitionId, playerId: best.id, clubId: best.clubId, value: `Snittbetyg ${averageRating(stats(best.id)!)}`, position });
    }
  }
  return awards;
}

function payPrize(state: CareerState, clubId: string, eur: number, label: string, date: string): CareerState {
  return eur > 0 ? adjustClubCash(state, clubId, Math.round(eur), { category: "PRIZE_MONEY", label, date }) : state;
}

function finalizeSeason(state: CareerState, date: string, emit: Emit): CareerState {
  let next = state;
  const ties = Object.values(next.competitionTies ?? {});
  const find = (competitionId: string, key: string) => ties.find((t) => t.competitionId === competitionId && t.key === key);
  const final = find(SM_SLUTSPEL, "F");
  const cupFinal = find(SVENSKA_CUPEN, "CF");
  const cup3 = find(SVENSKA_CUPEN, "C3");
  // SM-slutspel bonuses (fictional, labelled -- rules.ts) and verified Svenska cupen bonuses (SEK -> EUR at the game rate).
  for (const t of ties.filter((x) => x.competitionId === SM_SLUTSPEL)) {
    if (t.stage === "QF" && t.loserClubId) next = payPrize(next, t.loserClubId, PLAYOFF_BONUS_EUR.quarterFinal, "SM-slutspel: kvartsfinal", date);
    if (t.stage === "SF" && t.loserClubId) next = payPrize(next, t.loserClubId, PLAYOFF_BONUS_EUR.semiFinal, "SM-slutspel: semifinal", date);
    if (t.stage === "F") {
      next = payPrize(next, t.winnerClubId!, PLAYOFF_BONUS_EUR.champion, "SM-guld", date);
      next = payPrize(next, t.loserClubId!, PLAYOFF_BONUS_EUR.final, "SM-silver", date);
    }
  }
  const sek = (n: number) => n / EUR_TO_SEK_REFERENCE_RATE;
  if (cupFinal?.winnerClubId) next = payPrize(next, cupFinal.winnerClubId, sek(CUP_RULES.prizeSek.winner), "Svenska cupen: vinnare", date);
  if (cupFinal?.loserClubId) next = payPrize(next, cupFinal.loserClubId, sek(CUP_RULES.prizeSek.runnerUp), "Svenska cupen: finalist", date);
  if (cup3?.winnerClubId) next = payPrize(next, cup3.winnerClubId, sek(CUP_RULES.prizeSek.third), "Svenska cupen: tredjepris", date);

  const awards = computeAwards(next);
  const o = next.seasonOutcome!;
  next = { ...next, seasonOutcome: { ...o, phase: "COMPLETE", champion: final?.winnerClubId, runnerUp: final?.loserClubId, cupWinner: cupFinal?.winnerClubId, awards } };
  const me = next.playerClubId;
  if (final?.winnerClubId === me) next = announce(next, "champion", emit, () => buildClubEvent("SEASON_MILESTONE", `${o.seasonId}:champion`, date, "IMPORTANT", "Svenska mästare!", `${clubName(me)} vann SM-finalen mot ${clubName(final.loserClubId!)}.`, [{ route: "SEASON" }]));
  if (cupFinal?.winnerClubId === me) next = announce(next, "cup", emit, () => buildClubEvent("SEASON_MILESTONE", `${o.seasonId}:cup`, date, "IMPORTANT", "Svenska cupen vunnen!", `${clubName(me)} vann Final4.`, [{ route: "SEASON" }]));
  const ownAwards = awards.filter((a) => a.clubId === me && a.id !== "ALL_STAR");
  if (ownAwards.length) next = announce(next, "awards", emit, () => buildClubEvent("SEASON_MILESTONE", `${o.seasonId}:awards`, date, "INFORMATION", "Utmärkelser till klubben", ownAwards.map((a) => `${a.label}: ${a.value}`).join(" · "), [{ route: "SEASON" }]));
  return next;
}

export { STAGE_LABEL };
