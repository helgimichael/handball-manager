// HM-SEASON-SIM-1.0: reusable full-season / Monte Carlo competitive-
// balance audit tooling. Read-only against the real engine -- never
// modifies matchEngine.ts, playerMatchStrength.ts, tacticalMatchAdjustment.ts,
// or any other simulation module. This script only CALLS the exact same
// exported functions apps/game/lib/career/calendar.ts's simulateAiFixturesForDate
// already calls for every AI-vs-AI fixture in a real career, minus the
// "exclude the manager's own club" filter (there is no manager here --
// every club in the competition is treated symmetrically, which is what
// happens for ~86% of fixtures in any real single-club career anyway).
//
// Two simulation paths, chosen per use case:
//   - simulateFixtureFast: byte-identical to calendar.ts's own AI-vs-AI
//     logic (no roster passed in -> no player-level goal/rating data,
//     but standings-only numbers are unaffected). Used for the Monte
//     Carlo sweep, where player-level detail isn't needed and speed
//     matters (250 seasons x 182 fixtures x 2 competitions).
//   - simulateFixtureDetailed: additionally builds each side's real
//     MatchRosterPlayer[] (buildMatchRoster, matchdayAction.ts's own
//     roster-construction logic applied to BOTH clubs symmetrically),
//     so player-level goals/ratings ARE populated. Used only for the
//     two single-season detailed reports (cheap: 182 fixtures once).
//
// Run: npx tsx scripts/season-audit.ts [--seasons=250] [--out=DIR]
import fs from "node:fs";
import path from "node:path";
import { simulateFixture, computeStandings, type FastMatchResult, type StandingRow, type MatchRosterPlayer } from "@handball-manager/game-simulation";
import { getClubsByCompetition, getClub, getCompetition, GAME_CURRENT_DATE } from "../lib/game-data";
import { createNewCareerState } from "../lib/career/newCareer";
import { snapshotWorldSquads, snapshotGameplayRatings, snapshotAiTacticalPreferences } from "../lib/gameWorld/serverSnapshot";
import { computeSquadDerivedClubStrength } from "../lib/career/squadDerivedClubStrength";
import { getCareerClubSquad } from "../lib/career/careerWorld";
import { resolveClubMatchPlanForFixture, computePlayerMatchStrengthAdjustment, buildStaminaByPlayerId } from "../lib/career/playerMatchStrength";
import { computeAiVsAiTacticalAdjustment } from "../lib/career/tacticalMatchAdjustment";
import { computeTacticalMatchPlanAdjustment } from "../lib/career/tacticalPlanEffects";
import { computeTeamUsageTrace, computeAttackActiveWindows } from "../lib/career/matchUsageEngine";
import { buildMatchRoster, buildFallbackAttackExposure } from "../lib/career/tumbaRoster";
import { ensureCareerAllClubEconomies, getClubEconomySnapshot } from "../lib/economy/clubEconomyIntegration";
import { deriveDefaultSquadStatusTier, SQUAD_STATUS_TIER_LABEL_SV } from "../lib/career/squadStatus";
import type { CareerState, CareerFixture } from "../lib/career/types";
import type { MatchPlan } from "../lib/matchPlan/types";

const HANDBOLLSLIGAN_ID = "se_handbollsligan_herr";
const ALLSVENSKAN_ID = "swe-2";
const SEASON = "2026/27";

// ---------------------------------------------------------------------------
// Base state construction (real snapshots, same pipeline career creation uses).
// ---------------------------------------------------------------------------

function buildBaseState(competitionId: string, saveSeed: string): CareerState {
  const clubs = getClubsByCompetition(competitionId);
  const anyClubId = clubs[0].id;
  const worldSquads = snapshotWorldSquads(competitionId);
  const aiTacticalPreferences = snapshotAiTacticalPreferences(competitionId, SEASON, GAME_CURRENT_DATE);
  const gameplayRatings = snapshotGameplayRatings(competitionId);
  const state = createNewCareerState(saveSeed, anyClubId, worldSquads, aiTacticalPreferences, gameplayRatings);
  return ensureCareerAllClubEconomies(state);
}

function leagueFixtures(state: CareerState): CareerFixture[] {
  return state.fixtures.filter((f) => f.type === "LEAGUE");
}

// ---------------------------------------------------------------------------
// Fast path -- byte-identical to calendar.ts's simulateAiFixturesForDate body.
// ---------------------------------------------------------------------------

function simulateFixtureFast(state: CareerState, fixture: CareerFixture): FastMatchResult {
  const adjustment = computeAiVsAiTacticalAdjustment(state.saveSeed, fixture.id, fixture.homeClubId, fixture.awayClubId, state.aiTacticalPreferences);
  const homePlan = resolveClubMatchPlanForFixture(fixture.homeClubId, fixture.id, getCareerClubSquad(state, fixture.homeClubId), undefined);
  const awayPlan = resolveClubMatchPlanForFixture(fixture.awayClubId, fixture.id, getCareerClubSquad(state, fixture.awayClubId), undefined);
  const playerStrength = computePlayerMatchStrengthAdjustment(
    homePlan,
    state.gameplayRatings[fixture.homeClubId] ?? [],
    awayPlan,
    state.gameplayRatings[fixture.awayClubId] ?? [],
    `${state.saveSeed}:${fixture.id}`,
  );
  const homeUsageTrace = homePlan ? computeTeamUsageTrace(homePlan, `${state.saveSeed}:${fixture.id}:usage:${fixture.homeClubId}`) : null;
  const awayUsageTrace = awayPlan ? computeTeamUsageTrace(awayPlan, `${state.saveSeed}:${fixture.id}:usage:${fixture.awayClubId}`) : null;
  const tacticalPlanAdjustment = computeTacticalMatchPlanAdjustment(
    homePlan,
    state.gameplayRatings[fixture.homeClubId] ?? [],
    homeUsageTrace,
    awayPlan,
    state.gameplayRatings[fixture.awayClubId] ?? [],
    awayUsageTrace,
  );
  const combined = {
    home: (adjustment?.home ?? 0) + playerStrength.home + tacticalPlanAdjustment.home,
    away: (adjustment?.away ?? 0) + playerStrength.away + tacticalPlanAdjustment.away,
  };
  return simulateFixture(fixture, state.saveSeed, (clubId) => computeSquadDerivedClubStrength(clubId, getCareerClubSquad(state, clubId), state.gameplayRatings[clubId] ?? []), undefined, combined);
}

function simulateCompetitionFast(state: CareerState, fixtures: readonly CareerFixture[]): FastMatchResult[] {
  return fixtures.map((f) => simulateFixtureFast(state, f));
}

// ---------------------------------------------------------------------------
// Detailed path -- adds real MatchRosterPlayer[] rosters for BOTH sides
// (matchdayAction.ts's own roster-construction logic, applied symmetrically
// instead of only to the manager's club), so player-level goals/ratings
// are populated. Used only for the two single-season reports.
// ---------------------------------------------------------------------------

function simulateFixtureDetailed(state: CareerState, fixture: CareerFixture): FastMatchResult {
  const adjustment = computeAiVsAiTacticalAdjustment(state.saveSeed, fixture.id, fixture.homeClubId, fixture.awayClubId, state.aiTacticalPreferences);
  const homeSquad = getCareerClubSquad(state, fixture.homeClubId);
  const awaySquad = getCareerClubSquad(state, fixture.awayClubId);
  const homePlan = resolveClubMatchPlanForFixture(fixture.homeClubId, fixture.id, homeSquad, undefined);
  const awayPlan = resolveClubMatchPlanForFixture(fixture.awayClubId, fixture.id, awaySquad, undefined);
  const playerStrength = computePlayerMatchStrengthAdjustment(
    homePlan,
    state.gameplayRatings[fixture.homeClubId] ?? [],
    awayPlan,
    state.gameplayRatings[fixture.awayClubId] ?? [],
    `${state.saveSeed}:${fixture.id}`,
  );

  const homeStamina = buildStaminaByPlayerId(state.gameplayRatings[fixture.homeClubId] ?? []);
  const awayStamina = buildStaminaByPlayerId(state.gameplayRatings[fixture.awayClubId] ?? []);
  const homeUsageSeed = `${state.saveSeed}:${fixture.id}:usage:${fixture.homeClubId}`;
  const awayUsageSeed = `${state.saveSeed}:${fixture.id}:usage:${fixture.awayClubId}`;
  const homeUsageTrace = homePlan ? computeTeamUsageTrace(homePlan, homeUsageSeed, homeStamina) : null;
  const awayUsageTrace = awayPlan ? computeTeamUsageTrace(awayPlan, awayUsageSeed, awayStamina) : null;

  const tacticalPlanAdjustment = computeTacticalMatchPlanAdjustment(
    homePlan,
    state.gameplayRatings[fixture.homeClubId] ?? [],
    homeUsageTrace,
    awayPlan,
    state.gameplayRatings[fixture.awayClubId] ?? [],
    awayUsageTrace,
  );
  const combined = {
    home: (adjustment?.home ?? 0) + playerStrength.home + tacticalPlanAdjustment.home,
    away: (adjustment?.away ?? 0) + playerStrength.away + tacticalPlanAdjustment.away,
  };

  function buildRoster(squad: typeof homeSquad, clubId: string, plan: MatchPlan | null, usageTrace: typeof homeUsageTrace, usageSeed: string, stamina: typeof homeStamina): MatchRosterPlayer[] {
    const attackExposure = usageTrace ? new Map(usageTrace.players.map((p) => [p.playerId, p.attackExposure])) : buildFallbackAttackExposure(squad, fixture.id, clubId);
    const defenceExposure = usageTrace ? new Map(usageTrace.players.map((p) => [p.playerId, p.defenceExposure])) : undefined;
    const activeWindows = plan ? computeAttackActiveWindows(plan, usageSeed, stamina) : undefined;
    const ratingsById = new Map((state.gameplayRatings[clubId] ?? []).map((r) => [r.playerId, r]));
    return buildMatchRoster(squad, undefined, attackExposure, activeWindows, defenceExposure, ratingsById);
  }

  const homeRoster = buildRoster(homeSquad, fixture.homeClubId, homePlan, homeUsageTrace, homeUsageSeed, homeStamina);
  const awayRoster = buildRoster(awaySquad, fixture.awayClubId, awayPlan, awayUsageTrace, awayUsageSeed, awayStamina);

  return simulateFixture(
    fixture,
    state.saveSeed,
    (clubId) => computeSquadDerivedClubStrength(clubId, getCareerClubSquad(state, clubId), state.gameplayRatings[clubId] ?? []),
    (clubId) => (clubId === fixture.homeClubId ? homeRoster : awayRoster),
    combined,
  );
}

function simulateCompetitionDetailed(state: CareerState, fixtures: readonly CareerFixture[]): FastMatchResult[] {
  return fixtures.map((f) => simulateFixtureDetailed(state, f));
}

// ---------------------------------------------------------------------------
// HM-PLAYER-CALIBRATION-1.0 Part E: per-player USAGE across a whole
// season -- start rate and average exposure, so the calibrated squad
// hierarchy's actual effect on who plays is directly verifiable, not
// just asserted. Reuses resolveClubMatchPlanForFixture/
// computeTeamUsageTrace exactly as matchdayAction.ts/calendar.ts do for
// every real fixture -- no separate usage model.
// ---------------------------------------------------------------------------

interface PlayerUsageAgg {
  clubId: string;
  position: string;
  tier: string;
  starts: number;
  fixturesForClub: number;
  totalExposure: number;
}

function collectSeasonUsage(state: CareerState, fixtures: readonly CareerFixture[]): Map<string, PlayerUsageAgg> {
  const usage = new Map<string, PlayerUsageAgg>();
  const fixturesPerClub = new Map<string, number>();
  for (const fixture of fixtures) {
    fixturesPerClub.set(fixture.homeClubId, (fixturesPerClub.get(fixture.homeClubId) ?? 0) + 1);
    fixturesPerClub.set(fixture.awayClubId, (fixturesPerClub.get(fixture.awayClubId) ?? 0) + 1);
  }

  for (const fixture of fixtures) {
    for (const clubId of [fixture.homeClubId, fixture.awayClubId]) {
      const squad = getCareerClubSquad(state, clubId);
      const plan = resolveClubMatchPlanForFixture(clubId, fixture.id, squad, undefined);
      if (!plan) continue;
      const trace = computeTeamUsageTrace(plan, `${state.saveSeed}:${fixture.id}:usage:${clubId}`);
      const squadById = new Map(squad.map((p) => [p.id, p]));
      for (const p of trace.players) {
        const exposureThisMatch = p.attackExposure + p.defenceExposure + p.goalkeeperExposure;
        const started = p.startedAttack || p.startedDefence;
        const player = squadById.get(p.playerId);
        const entry = usage.get(p.playerId) ?? {
          clubId,
          position: player?.position ?? "?",
          tier: player ? SQUAD_STATUS_TIER_LABEL_SV[deriveDefaultSquadStatusTier(player)] : "?",
          starts: 0,
          fixturesForClub: fixturesPerClub.get(clubId) ?? 0,
          totalExposure: 0,
        };
        if (started) entry.starts += 1;
        entry.totalExposure += exposureThisMatch;
        usage.set(p.playerId, entry);
      }
    }
  }
  return usage;
}

// ---------------------------------------------------------------------------
// HM-SEASON-SIM-1.1 Part 4/5: multi-season PLAYER-level Monte Carlo --
// deliberately a smaller sample (nSeasons, not the full 250) than the
// team-level standings sweep above, since it needs the DETAILED path
// (real MatchRosterPlayer[] rosters, matchdayAction.ts's own
// roster-construction logic) to get player-level goals/usage at all --
// far more expensive per season than the roster-less fast path. Still a
// genuinely large sample (see the report for the exact N used), not a
// single season.
// ---------------------------------------------------------------------------

interface PlayerSeasonAgg {
  clubId: string;
  position: string;
  tier: string;
  seasons: number;
  totalStarts: number;
  totalFixtures: number;
  totalExposure: number;
  totalGoals: number;
  seasonsAsClubTopScorer: number;
  seasonsAsLeagueTopScorer: number;
}

function runPlayerMonteCarlo(baseState: CareerState, fixtures: readonly CareerFixture[], nSeasons: number): Map<string, PlayerSeasonAgg> {
  const agg = new Map<string, PlayerSeasonAgg>();

  for (let i = 0; i < nSeasons; i += 1) {
    const seasonState: CareerState = { ...baseState, saveSeed: `${baseState.saveSeed}:playermc:${i}` };
    const usage = collectSeasonUsage(seasonState, fixtures);
    const results = simulateCompetitionDetailed(seasonState, fixtures);

    const goalsThisSeason = new Map<string, { clubId: string; goals: number }>();
    for (const r of results) {
      for (const side of [
        { contributions: r.homePlayerContributions, clubId: r.homeClubId },
        { contributions: r.awayPlayerContributions, clubId: r.awayClubId },
      ]) {
        for (const p of side.contributions) {
          const isGk = p.saves !== undefined || p.shotsFaced !== undefined;
          if (isGk) continue;
          const entry = goalsThisSeason.get(p.playerId) ?? { clubId: side.clubId, goals: 0 };
          entry.goals += p.goals;
          goalsThisSeason.set(p.playerId, entry);
        }
      }
    }

    for (const [playerId, u] of usage) {
      const entry = agg.get(playerId) ?? {
        clubId: u.clubId,
        position: u.position,
        tier: u.tier,
        seasons: 0,
        totalStarts: 0,
        totalFixtures: 0,
        totalExposure: 0,
        totalGoals: 0,
        seasonsAsClubTopScorer: 0,
        seasonsAsLeagueTopScorer: 0,
      };
      entry.seasons += 1;
      entry.totalStarts += u.starts;
      entry.totalFixtures += u.fixturesForClub;
      entry.totalExposure += u.totalExposure;
      entry.totalGoals += goalsThisSeason.get(playerId)?.goals ?? 0;
      agg.set(playerId, entry);
    }

    // Season top scorer (league-wide) and each club's own top scorer this season.
    const seasonEntries = [...goalsThisSeason.entries()];
    if (seasonEntries.length > 0) {
      const leagueTop = seasonEntries.reduce((best, cur) => (cur[1].goals > best[1].goals ? cur : best));
      const leagueTopAgg = agg.get(leagueTop[0]);
      if (leagueTopAgg) leagueTopAgg.seasonsAsLeagueTopScorer += 1;

      const byClub = new Map<string, [string, { clubId: string; goals: number }]>();
      for (const entry of seasonEntries) {
        const existing = byClub.get(entry[1].clubId);
        if (!existing || entry[1].goals > existing[1].goals) byClub.set(entry[1].clubId, entry);
      }
      for (const [, [playerId]] of byClub) {
        const a = agg.get(playerId);
        if (a) a.seasonsAsClubTopScorer += 1;
      }
    }
  }
  return agg;
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

function standingsFor(clubIds: readonly string[], results: readonly FastMatchResult[]): StandingRow[] {
  return computeStandings(
    clubIds,
    results.map((r) => ({ homeClubId: r.homeClubId, awayClubId: r.awayClubId, homeGoals: r.homeGoals, awayGoals: r.awayGoals })),
  );
}

// ---------------------------------------------------------------------------
// Squad strength indicators (pre-season, from the actual game state used)
// ---------------------------------------------------------------------------

interface StrengthIndicators {
  clubId: string;
  clubName: string;
  squadSize: number;
  avgOutfieldCA: number | null;
  gkCA: number | null;
  bestPlayerCA: number | null;
  caStdDev: number | null;
  clubStrengthOverall: number;
  clubStrengthAttack: number;
  clubStrengthDefense: number;
  clubStrengthGoalkeeper: number;
  clubStrengthDepth: number;
  economyBand: string | null;
  wageBudgetEur: number | null;
  playerWagesEur: number | null;
}

/**
 * HM-PLAYER-CALIBRATION-1.0 Part D: every club (both leagues) now uses
 * the SAME squad-derived ClubStrength -- the old "curated vs flat
 * default" distinction this audit used to label no longer exists (there
 * is exactly one canonical strength path), so this report shows the
 * full attack/defense/goalkeeper/depth breakdown instead.
 */
function computeStrengthIndicators(state: CareerState, clubId: string): StrengthIndicators {
  const ratings = state.gameplayRatings[clubId] ?? [];
  const outfield = ratings.filter((r) => r.branch.branch !== "GOALKEEPER");
  const gks = ratings.filter((r) => r.branch.branch === "GOALKEEPER");
  const avgOutfieldCA = outfield.length > 0 ? outfield.reduce((s, r) => s + r.ca, 0) / outfield.length : null;
  const gkCA = gks.length > 0 ? gks.reduce((s, r) => s + r.ca, 0) / gks.length : null;
  const bestPlayerCA = ratings.length > 0 ? Math.max(...ratings.map((r) => r.ca)) : null;
  const caStdDev =
    outfield.length > 1
      ? Math.sqrt(outfield.reduce((s, r) => s + (r.ca - (avgOutfieldCA ?? 0)) ** 2, 0) / outfield.length)
      : null;

  const cs = computeSquadDerivedClubStrength(clubId, getCareerClubSquad(state, clubId), ratings);
  const economy = getClubEconomySnapshot(state, clubId);

  return {
    clubId,
    clubName: getClub(clubId)?.name ?? clubId,
    squadSize: ratings.length,
    avgOutfieldCA,
    gkCA,
    bestPlayerCA,
    caStdDev,
    clubStrengthOverall: cs.overall,
    clubStrengthAttack: cs.attack,
    clubStrengthDefense: cs.defense,
    clubStrengthGoalkeeper: cs.goalkeeper,
    clubStrengthDepth: cs.depth,
    economyBand: economy?.band ?? null,
    wageBudgetEur: economy?.budgets.wageBudgetEur ?? null,
    playerWagesEur: economy?.playerWageCostsEurAnnual ?? null,
  };
}

// ---------------------------------------------------------------------------
// Monte Carlo
// ---------------------------------------------------------------------------

interface ClubSeasonOutcome {
  clubId: string;
  position: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
}

/**
 * HM-SEASON-SIM-1.1: result-level distribution stats accumulated
 * incrementally across every single MATCH in the Monte Carlo sweep
 * (250 seasons x 182 fixtures = 45,500 matches per competition) --
 * incremental, not stored per-match, to keep memory bounded.
 */
interface ResultDistributionAcc {
  matches: number;
  totalGoals: number;
  homeWins: number;
  awayWins: number;
  draws: number;
  marginCounts: Map<number, number>; // |homeGoals - awayGoals| -> count
  blowouts: number; // margin >= 10
  extremeHigh: number; // combined goals >= 70
  extremeLow: number; // combined goals <= 40
  maxCombinedGoals: number;
  minCombinedGoals: number;
}

function newResultDistributionAcc(): ResultDistributionAcc {
  return { matches: 0, totalGoals: 0, homeWins: 0, awayWins: 0, draws: 0, marginCounts: new Map(), blowouts: 0, extremeHigh: 0, extremeLow: 0, maxCombinedGoals: 0, minCombinedGoals: Infinity };
}

function accumulateResult(acc: ResultDistributionAcc, homeGoals: number, awayGoals: number): void {
  acc.matches += 1;
  const combined = homeGoals + awayGoals;
  acc.totalGoals += combined;
  if (homeGoals > awayGoals) acc.homeWins += 1;
  else if (awayGoals > homeGoals) acc.awayWins += 1;
  else acc.draws += 1;
  const margin = Math.abs(homeGoals - awayGoals);
  acc.marginCounts.set(margin, (acc.marginCounts.get(margin) ?? 0) + 1);
  if (margin >= 10) acc.blowouts += 1;
  if (combined >= 70) acc.extremeHigh += 1;
  if (combined <= 40) acc.extremeLow += 1;
  acc.maxCombinedGoals = Math.max(acc.maxCombinedGoals, combined);
  acc.minCombinedGoals = Math.min(acc.minCombinedGoals, combined);
}

function runMonteCarlo(
  baseState: CareerState,
  fixtures: readonly CareerFixture[],
  clubIds: readonly string[],
  nSeasons: number,
): { byClub: Map<string, ClubSeasonOutcome[]>; distribution: ResultDistributionAcc } {
  const byClub = new Map<string, ClubSeasonOutcome[]>();
  for (const id of clubIds) byClub.set(id, []);
  const distribution = newResultDistributionAcc();

  for (let i = 0; i < nSeasons; i += 1) {
    const seasonState: CareerState = { ...baseState, saveSeed: `${baseState.saveSeed}:mc:${i}` };
    const results = simulateCompetitionFast(seasonState, fixtures);
    for (const r of results) accumulateResult(distribution, r.homeGoals, r.awayGoals);
    const table = standingsFor(clubIds, results);
    table.forEach((row, idx) => {
      byClub.get(row.clubId)!.push({ clubId: row.clubId, position: idx + 1, points: row.points, goalsFor: row.goalsFor, goalsAgainst: row.goalsAgainst });
    });
  }
  return { byClub, distribution };
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

/** Spearman rank correlation, average-rank tie handling. Returns null if either series has zero variance. */
function spearman(xs: number[], ys: number[]): number | null {
  const rank = (vals: number[]): number[] => {
    const idx = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]);
    const ranks = new Array(vals.length).fill(0);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && vals[idx[j + 1]] === vals[idx[i]]) j += 1;
      const avgRank = (i + j) / 2 + 1;
      for (let k = i; k <= j; k += 1) ranks[idx[k]] = avgRank;
      i = j + 1;
    }
    return ranks;
  };
  const rx = rank(xs);
  const ry = rank(ys);
  const n = xs.length;
  const mx = mean(rx);
  const my = mean(ry);
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i += 1) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx2 += (rx[i] - mx) ** 2;
    dy2 += (ry[i] - my) ** 2;
  }
  if (dx2 === 0 || dy2 === 0) return null;
  return num / Math.sqrt(dx2 * dy2);
}

// ---------------------------------------------------------------------------
// Report writer
// ---------------------------------------------------------------------------

const lines: string[] = [];
function log(s = "") {
  lines.push(s);
  // eslint-disable-next-line no-console
  console.log(s);
}
function table(headers: string[], rows: (string | number)[][]) {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
  const fmt = (cells: (string | number)[]) => cells.map((c, i) => String(c).padEnd(widths[i])).join("  ");
  log(fmt(headers));
  log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const r of rows) log(fmt(r));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function auditCompetition(competitionId: string, label: string, nSeasons: number) {
  log(`\n${"=".repeat(78)}`);
  log(`${label.toUpperCase()} (${competitionId})`);
  log("=".repeat(78));

  const t0 = Date.now();
  const state = buildBaseState(competitionId, `audit-${competitionId}`);
  const fixtures = leagueFixtures(state);
  const clubIds = getClubsByCompetition(competitionId).map((c) => c.id);
  log(`Clubs: ${clubIds.length}  |  League fixtures: ${fixtures.length}  |  Base state built in ${Date.now() - t0}ms`);

  const caByPlayerId = new Map<string, number>();
  for (const id of clubIds) for (const r of state.gameplayRatings[id] ?? []) caByPlayerId.set(r.playerId, r.ca);

  // --- Strength indicators ---
  const strengths = clubIds.map((id) => computeStrengthIndicators(state, id));

  log(`\n--- PRE-SEASON STRENGTH INDICATORS ---`);
  table(
    ["CLUB", "SQUAD", "AVG-CA", "GK-CA", "BEST-CA", "CA-STDEV", "CS-OVERALL", "CS-ATK", "CS-DEF", "CS-GK", "CS-DEPTH", "ECON-BAND", "WAGE-BUDGET"],
    strengths.map((s) => [
      s.clubName,
      s.squadSize,
      s.avgOutfieldCA?.toFixed(1) ?? "-",
      s.gkCA?.toFixed(1) ?? "-",
      s.bestPlayerCA ?? "-",
      s.caStdDev?.toFixed(1) ?? "-",
      s.clubStrengthOverall,
      s.clubStrengthAttack,
      s.clubStrengthDefense,
      s.clubStrengthGoalkeeper,
      s.clubStrengthDepth,
      s.economyBand ?? "-",
      s.wageBudgetEur !== null ? Math.round(s.wageBudgetEur) : "-",
    ]),
  );

  // --- Single season (detailed, real rosters) ---
  const t1 = Date.now();
  const singleResults = simulateCompetitionDetailed(state, fixtures);
  const singleTable = standingsFor(clubIds, singleResults);
  log(`\n--- SINGLE SEASON FULL TABLE (detailed, ${Date.now() - t1}ms) ---`);
  table(
    ["POS", "CLUB", "P", "W", "D", "L", "GF", "GA", "GD", "PTS", "GF/M", "GA/M"],
    singleTable.map((r, i) => [
      i + 1,
      getClub(r.clubId)?.name ?? r.clubId,
      r.played,
      r.won,
      r.drawn,
      r.lost,
      r.goalsFor,
      r.goalsAgainst,
      r.goalDifference,
      r.points,
      (r.goalsFor / r.played).toFixed(1),
      (r.goalsAgainst / r.played).toFixed(1),
    ]),
  );

  // --- HM-PLAYER-CALIBRATION-1.0 Part E: per-player usage, 4 representative clubs (strongest, weakest, and two mid-table by pre-season strength) ---
  const usageSeasonFixtures = fixtures; // separate resolution pass from the single-detailed-season simulation above -- deterministic given the same seed, so results are directly comparable
  const usage = collectSeasonUsage(state, usageSeasonFixtures);
  const byStrengthDesc = [...strengths].sort((a, b) => b.clubStrengthOverall - a.clubStrengthOverall);
  const usageSampleClubs = [
    byStrengthDesc[0],
    byStrengthDesc[Math.floor(byStrengthDesc.length / 3)],
    byStrengthDesc[Math.floor((byStrengthDesc.length * 2) / 3)],
    byStrengthDesc[byStrengthDesc.length - 1],
  ].filter((c, i, arr) => c && arr.findIndex((x) => x?.clubId === c.clubId) === i);

  log(`\n--- PLAYER USAGE (${usageSampleClubs.length} representative clubs by pre-season strength: strongest, two mid-table, weakest) ---`);
  for (const club of usageSampleClubs) {
    if (!club) continue;
    const clubUsage = [...usage.entries()].filter(([, u]) => u.clubId === club.clubId).sort((a, b) => b[1].totalExposure - a[1].totalExposure);
    log(`\n${club.clubName} (CS-OVERALL ${club.clubStrengthOverall}):`);
    table(
      ["PLAYER", "STATUS", "POSITION", "AVG EXPOSURE", "START RATE"],
      clubUsage.map(([playerId, u]) => [
        playerId,
        u.tier,
        u.position,
        u.fixturesForClub > 0 ? (u.totalExposure / u.fixturesForClub).toFixed(2) : "-",
        u.fixturesForClub > 0 ? `${((u.starts / u.fixturesForClub) * 100).toFixed(0)}%` : "-",
      ]),
    );
  }

  // --- HM-SEASON-SIM-1.1 Part 4/5: multi-season PLAYER Monte Carlo (usage hierarchy over a large sample + scoring-chart frequency) ---
  const playerMcSeasons = 30; // detailed path is far more expensive than the fast 250-season team sweep above -- see runPlayerMonteCarlo's own header
  const tPmc = Date.now();
  const playerMc = runPlayerMonteCarlo(state, fixtures, playerMcSeasons);
  const playerMcMs = Date.now() - tPmc;
  log(`\n--- MULTI-SEASON PLAYER USAGE (${playerMcSeasons} detailed seasons, ${playerMcMs}ms) -- verifying squad hierarchy holds over a large sample, not just one season ---`);

  const tierUsageAgg = new Map<string, { totalStartRate: number; totalExposure: number; playerCount: number }>();
  for (const [, a] of playerMc) {
    if (a.totalFixtures === 0) continue;
    const startRate = a.totalStarts / a.totalFixtures;
    const avgExposure = a.totalExposure / a.seasons;
    const bucket = tierUsageAgg.get(a.tier) ?? { totalStartRate: 0, totalExposure: 0, playerCount: 0 };
    bucket.totalStartRate += startRate;
    bucket.totalExposure += avgExposure;
    bucket.playerCount += 1;
    tierUsageAgg.set(a.tier, bucket);
  }
  const tierOrder = ["Nyckelspelare", "Förstaval", "Rotation", "Truppspelare", "Talang"];
  const tierUsageRows = tierOrder
    .filter((t) => tierUsageAgg.has(t))
    .map((tier) => {
      const b = tierUsageAgg.get(tier)!;
      return { tier, avgStartRate: (b.totalStartRate / b.playerCount) * 100, avgExposure: b.totalExposure / b.playerCount, playerCount: b.playerCount };
    });
  log(`\nAggregate usage by squad status tier (avg across all qualifying players, ${playerMcSeasons} seasons):`);
  table(
    ["SQUAD STATUS", "PLAYERS", "AVG START RATE", "AVG EXPOSURE/SEASON"],
    tierUsageRows.map((r) => [r.tier, r.playerCount, `${r.avgStartRate.toFixed(1)}%`, r.avgExposure.toFixed(2)]),
  );
  const hierarchyHolds = tierUsageRows.every((r, i) => i === 0 || r.avgStartRate <= tierUsageRows[i - 1].avgStartRate);
  log(
    hierarchyHolds
      ? `KEY_PLAYER > FIRST_CHOICE > ROTATION > SQUAD_PLAYER usage hierarchy HOLDS over ${playerMcSeasons} seasons (monotonically decreasing start rate by tier).`
      : `WARNING: usage hierarchy does NOT hold monotonically across tiers over ${playerMcSeasons} seasons -- see table above.`,
  );
  // Honest disclosure carried over from the 25-season focused audit, per this milestone's explicit instruction -- NOT fixed in this pass.
  const benchTiers = tierUsageRows.filter((r) => r.tier === "Rotation" || r.tier === "Truppspelare" || r.tier === "Talang");
  const benchAvgExposure = benchTiers.length > 0 ? mean(benchTiers.map((r) => r.avgExposure)) : 0;
  log(
    `Bench-tier (Rotation/Truppspelare/Talang) avg exposure/season: ${benchAvgExposure.toFixed(2)} -- ${
      benchAvgExposure < 0.5
        ? "CONFIRMED, still near-zero over the large sample (same limitation flagged in the 25-season audit: no injury/fatigue pressure forces rotation in this simulation path). NOT changed in this pass, per instruction."
        : "improved vs. the 25-season focused sample, though still worth monitoring."
    }`,
  );

  const topScoringFrequency = [...playerMc.entries()]
    .filter(([, a]) => a.seasons >= playerMcSeasons * 0.5) // only players present for at least half the sample
    .sort((a, b) => b[1].seasonsAsLeagueTopScorer - a[1].seasonsAsLeagueTopScorer || b[1].totalGoals / b[1].seasons - a[1].totalGoals / a[1].seasons)
    .slice(0, 15);
  log(`\nPlayers who most often top the LEAGUE scoring chart across ${playerMcSeasons} seasons:`);
  table(
    ["PLAYER", "CLUB", "POSITION", "STATUS", "CA", "SEASONS AS LEAGUE TOP SCORER", "AVG GOALS/SEASON"],
    topScoringFrequency.map(([playerId, a]) => [
      playerId,
      getClub(a.clubId)?.name ?? a.clubId,
      a.position,
      a.tier,
      caByPlayerId.get(playerId) ?? "-",
      `${a.seasonsAsLeagueTopScorer}/${playerMcSeasons}`,
      (a.totalGoals / a.seasons).toFixed(1),
    ]),
  );

  // --- Player hierarchy (from the detailed single-season run) ---
  const goalsByPlayer = new Map<string, { goals: number; clubId: string; ratingSum: number; apps: number }>();
  const gkSavesByPlayer = new Map<string, { saves: number; shotsFaced: number; clubId: string }>();
  for (const r of singleResults) {
    for (const side of [
      { contributions: r.homePlayerContributions, clubId: r.homeClubId },
      { contributions: r.awayPlayerContributions, clubId: r.awayClubId },
    ]) {
      for (const p of side.contributions) {
        const isGk = p.saves !== undefined || p.shotsFaced !== undefined;
        if (isGk && (p.shotsFaced ?? 0) > 0) {
          const entry = gkSavesByPlayer.get(p.playerId) ?? { saves: 0, shotsFaced: 0, clubId: side.clubId };
          entry.saves += p.saves ?? 0;
          entry.shotsFaced += p.shotsFaced ?? 0;
          gkSavesByPlayer.set(p.playerId, entry);
        } else {
          const entry = goalsByPlayer.get(p.playerId) ?? { goals: 0, clubId: side.clubId, ratingSum: 0, apps: 0 };
          entry.goals += p.goals;
          entry.ratingSum += p.rating;
          entry.apps += 1;
          goalsByPlayer.set(p.playerId, entry);
        }
      }
    }
  }
  const topScorers = [...goalsByPlayer.entries()].sort((a, b) => b[1].goals - a[1].goals).slice(0, 20);
  log(`\n--- TOP 20 SCORERS (single detailed season) ---`);
  table(
    ["PLAYER", "CLUB", "POSITION", "STATUS", "CA", "GOALS", "GOALS/60", "EXPOSURE", "AVG RATING"],
    topScorers.map(([playerId, v]) => {
      const u = usage.get(playerId);
      const exposure = u?.totalExposure ?? 0;
      return [
        playerId,
        getClub(v.clubId)?.name ?? v.clubId,
        u?.position ?? "-",
        u?.tier ?? "-",
        caByPlayerId.get(playerId) ?? "-",
        v.goals,
        exposure > 0 ? (v.goals / exposure).toFixed(2) : "-",
        exposure.toFixed(2),
        (v.ratingSum / v.apps).toFixed(2),
      ];
    }),
  );

  const perClubFixtureCount = (fixtures.length / clubIds.length) * 2; // each club plays every other club home+away
  const topRated = [...goalsByPlayer.entries()]
    .filter(([, v]) => v.apps >= Math.round(perClubFixtureCount * 0.5))
    .sort((a, b) => b[1].ratingSum / b[1].apps - a[1].ratingSum / a[1].apps)
    .slice(0, 10);
  log(`\n--- TOP 10 AVERAGE RATING (min 50% of a club's own ${perClubFixtureCount} fixtures) ---`);
  table(
    ["PLAYER", "CLUB", "AVG RATING", "GOALS", "APPS", "CA"],
    topRated.map(([playerId, v]) => [playerId, getClub(v.clubId)?.name ?? v.clubId, (v.ratingSum / v.apps).toFixed(2), v.goals, v.apps, caByPlayerId.get(playerId) ?? "-"]),
  );

  const qualifiedGks = [...gkSavesByPlayer.entries()].filter(([, v]) => v.shotsFaced >= 20);
  const topGks = [...qualifiedGks].sort((a, b) => b[1].saves / b[1].shotsFaced - a[1].saves / a[1].shotsFaced).slice(0, 15);
  log(`\n--- TOP 15 GOALKEEPER SAVE% (min 20 shots faced; SAVES/SHOTS FACED/SAVE% are the only per-goalkeeper metrics the engine actually produces -- see buildPlayerContributions in matchEngine.ts) ---`);
  table(
    ["PLAYER", "CLUB", "STATUS", "CA", "EXPOSURE", "SAVES", "SHOTS FACED", "SAVE%"],
    topGks.map(([playerId, v]) => {
      const u = usage.get(playerId);
      return [playerId, getClub(v.clubId)?.name ?? v.clubId, u?.tier ?? "-", caByPlayerId.get(playerId) ?? "-", (u?.totalExposure ?? 0).toFixed(2), v.saves, v.shotsFaced, ((v.saves / v.shotsFaced) * 100).toFixed(1)];
    }),
  );
  const gkCASeries = qualifiedGks.filter(([id]) => caByPlayerId.has(id)).map(([id]) => caByPlayerId.get(id)!);
  const gkSavePctSeries = qualifiedGks.filter(([id]) => caByPlayerId.has(id)).map(([, v]) => (v.saves / v.shotsFaced) * 100);
  log(`Goalkeeper CA vs SAVE% Spearman rho (n=${gkCASeries.length}, min 20 shots faced): ${spearman(gkCASeries, gkSavePctSeries)?.toFixed(3) ?? "n/a"} -- verifies canonical goalkeeper quality actually moves the post-match rating/save outcome, not just team-level ClubStrength.goalkeeper`);

  // CA vs performance correlation (individual players, single season)
  const playersWithCA = [...goalsByPlayer.entries()].filter(([id]) => caByPlayerId.has(id));
  const caSeries = playersWithCA.map(([id]) => caByPlayerId.get(id)!);
  const goalsSeries = playersWithCA.map(([, v]) => v.goals);
  const ratingSeries = playersWithCA.map(([, v]) => v.ratingSum / v.apps);
  log(`\nIndividual player CA vs GOALS Spearman rho (n=${playersWithCA.length}): ${spearman(caSeries, goalsSeries)?.toFixed(3) ?? "n/a"}`);
  log(`Individual player CA vs AVG RATING Spearman rho (n=${playersWithCA.length}): ${spearman(caSeries, ratingSeries)?.toFixed(3) ?? "n/a"}`);

  // --- Monte Carlo ---
  const t2 = Date.now();
  const { byClub: mc, distribution: mcDistribution } = runMonteCarlo(state, fixtures, clubIds, nSeasons);
  const mcMs = Date.now() - t2;
  log(`\n--- MONTE CARLO (${nSeasons} seasons, ${mcMs}ms, ${(mcMs / nSeasons).toFixed(1)}ms/season) ---`);

  const strengthRankById = new Map([...strengths].sort((a, b) => b.clubStrengthOverall - a.clubStrengthOverall).map((s, i) => [s.clubId, i + 1]));

  const mcSummaries = clubIds.map((id) => {
    const outcomes = mc.get(id)!;
    const positions = outcomes.map((o) => o.position);
    const points = outcomes.map((o) => o.points);
    const n = outcomes.length;
    return {
      clubId: id,
      clubName: getClub(id)?.name ?? id,
      strengthRank: strengthRankById.get(id) ?? 0,
      avgPosition: mean(positions),
      medianPosition: median(positions),
      best: Math.min(...positions),
      worst: Math.max(...positions),
      avgPoints: mean(points),
      titlePct: (positions.filter((p) => p === 1).length / n) * 100,
      top3Pct: (positions.filter((p) => p <= 3).length / n) * 100,
      bottom3Pct: (positions.filter((p) => p > clubIds.length - 3).length / n) * 100,
    };
  });
  mcSummaries.sort((a, b) => a.avgPosition - b.avgPosition);

  // No relegation zone/promotion mechanic exists anywhere in the real
  // career/season model (confirmed by audit: StandingRow has no
  // zone/tier field, no cross-competition movement logic exists) --
  // BOTTOM3% is the closest already-implemented proxy and is reported
  // instead of inventing a relegation metric that isn't real.
  table(
    ["CLUB", "STRENGTH RANK", "AVG POS", "MED POS", "BEST", "WORST", "AVG PTS", "TITLE%", "TOP3%", "BOTTOM3%"],
    mcSummaries.map((s) => [s.clubName, s.strengthRank, s.avgPosition.toFixed(2), s.medianPosition.toFixed(1), s.best, s.worst, s.avgPoints.toFixed(1), s.titlePct.toFixed(1), s.top3Pct.toFixed(1), s.bottom3Pct.toFixed(1)]),
  );

  // --- HM-PLAYER-CALIBRATION-1.0 Part E: TEAM HIERARCHY (squad strength vs Monte Carlo results) ---
  const byIdForHierarchy = new Map(strengths.map((s) => [s.clubId, s]));
  const hierarchyRows = [...mcSummaries].sort((a, b) => (byIdForHierarchy.get(b.clubId)?.clubStrengthOverall ?? 0) - (byIdForHierarchy.get(a.clubId)?.clubStrengthOverall ?? 0));
  log(`\n--- TEAM HIERARCHY (squad strength vs ${nSeasons}-season Monte Carlo results) ---`);
  table(
    ["CLUB", "SQUAD STRENGTH", "AVG POSITION", "AVG POINTS"],
    hierarchyRows.map((s) => [s.clubName, byIdForHierarchy.get(s.clubId)?.clubStrengthOverall ?? "-", s.avgPosition.toFixed(2), s.avgPoints.toFixed(1)]),
  );

  // --- Correlation: preseason strength vs MC results ---
  const byId = new Map(strengths.map((s) => [s.clubId, s]));
  const mcById = new Map(mcSummaries.map((s) => [s.clubId, s]));
  const validIds = clubIds.filter((id) => byId.get(id)?.avgOutfieldCA !== null && byId.get(id)?.avgOutfieldCA !== undefined);
  const avgCASeries = validIds.map((id) => byId.get(id)!.avgOutfieldCA!);
  const avgPosSeries = validIds.map((id) => mcById.get(id)!.avgPosition);
  const avgPtsSeries = validIds.map((id) => mcById.get(id)!.avgPoints);
  const titlePctSeries = validIds.map((id) => mcById.get(id)!.titlePct);
  const csOverallSeries = validIds.map((id) => byId.get(id)!.clubStrengthOverall);

  log(`\n--- CORRELATION: PRE-SEASON STRENGTH vs MONTE CARLO RESULTS (n=${validIds.length} clubs) ---`);
  log(`avgOutfieldCA vs avgPosition (Spearman, negative expected since lower position number = better): ${spearman(avgCASeries, avgPosSeries)?.toFixed(3) ?? "n/a"}`);
  log(`avgOutfieldCA vs avgPoints (Spearman):    ${spearman(avgCASeries, avgPtsSeries)?.toFixed(3) ?? "n/a"}`);
  log(`avgOutfieldCA vs titlePct (Spearman):     ${spearman(avgCASeries, titlePctSeries)?.toFixed(3) ?? "n/a"}`);
  log(`ClubStrength.overall vs avgPosition (Spearman): ${spearman(csOverallSeries, avgPosSeries)?.toFixed(3) ?? "n/a"}`);
  log(`ClubStrength.overall vs avgPoints (Spearman):   ${spearman(csOverallSeries, avgPtsSeries)?.toFixed(3) ?? "n/a"}`);

  // --- Outlier detection: strength rank vs results rank gap ---
  const strengthRank = [...validIds].sort((a, b) => byId.get(b)!.avgOutfieldCA! - byId.get(a)!.avgOutfieldCA!);
  const resultsRank = [...validIds].sort((a, b) => mcById.get(a)!.avgPosition - mcById.get(b)!.avgPosition);
  const strengthRankIndex = new Map(strengthRank.map((id, i) => [id, i + 1]));
  const resultsRankIndex = new Map(resultsRank.map((id, i) => [id, i + 1]));

  log(`\n--- OUTLIER CHECK: SQUAD-STRENGTH RANK vs MONTE-CARLO RESULTS RANK ---`);
  const outlierRows = validIds
    .map((id) => {
      const sRank = strengthRankIndex.get(id)!;
      const rRank = resultsRankIndex.get(id)!;
      const gap = rRank - sRank;
      const s = mcById.get(id)!;
      return { id, name: byId.get(id)!.clubName, sRank, rRank, gap, titlePct: s.titlePct, avgPos: s.avgPosition };
    })
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

  // HM-SEASON-SIM-1.1 Part 3: UPSET (one club's own result diverges from
  // an otherwise-healthy overall correlation -- individual variance,
  // expected in any competitive league) vs SYSTEMIC MODEL PROBLEM (the
  // OVERALL strength-vs-results correlation itself is weak/absent --
  // that would mean strength barely predicts anything, league-wide).
  const overallCorrelation = spearman(csOverallSeries, avgPosSeries);
  const systemicProblem = overallCorrelation !== null && Math.abs(overallCorrelation) < 0.3;
  table(
    ["CLUB", "STRENGTH RANK", "RESULTS RANK", "GAP", "AVG POS", "TITLE%", "CLASSIFICATION"],
    outlierRows.map((r) => [
      r.name,
      r.sRank,
      r.rRank,
      r.gap > 0 ? `+${r.gap}` : String(r.gap),
      r.avgPos.toFixed(2),
      r.titlePct.toFixed(1),
      Math.abs(r.gap) < 4 ? "" : systemicProblem ? "part of a SYSTEMIC pattern (see below)" : "UPSET (individual variance)",
    ]),
  );
  log(
    systemicProblem
      ? `\nSYSTEMIC MODEL PROBLEM: overall ClubStrength.overall vs avgPosition correlation is weak (rho=${overallCorrelation?.toFixed(3)}) -- strength barely predicts league outcome at all, not just for individual clubs.`
      : `\nNo systemic problem detected: overall correlation (rho=${overallCorrelation?.toFixed(3) ?? "n/a"}) is healthy; flagged rows above are individual UPSETs, expected variance in a competitive league.`,
  );

  // "svaga lag ska INTE systematiskt vinna serien" -- explicit check on the single weakest-strength club's own title probability.
  const weakestClub = mcSummaries.find((s) => strengthRankById.get(s.clubId) === clubIds.length);
  if (weakestClub) {
    const flag = weakestClub.titlePct >= 5 ? "REVIEW: weakest-strength club's title probability looks too high for a squad-quality-driven league" : "OK: weakest-strength club rarely/never wins the title";
    log(`Weakest-strength club (${weakestClub.clubName}) title probability across ${nSeasons} seasons: ${weakestClub.titlePct.toFixed(1)}% -- ${flag}`);
  }

  // --- HM-SEASON-SIM-1.1 Part 7: RESULT DISTRIBUTION (from the full nSeasons-season Monte Carlo sweep, ${mcDistribution.matches} matches) ---
  log(`\n--- RESULT DISTRIBUTION (${mcDistribution.matches} matches across ${nSeasons} Monte Carlo seasons) ---`);
  const avgGoalsPerMatch = mcDistribution.totalGoals / mcDistribution.matches;
  const avgGoalsPerTeamPerMatch = avgGoalsPerMatch / 2;
  const homeWinPct = (mcDistribution.homeWins / mcDistribution.matches) * 100;
  const awayWinPct = (mcDistribution.awayWins / mcDistribution.matches) * 100;
  const drawPct = (mcDistribution.draws / mcDistribution.matches) * 100;
  const blowoutPct = (mcDistribution.blowouts / mcDistribution.matches) * 100;
  const extremeHighPct = (mcDistribution.extremeHigh / mcDistribution.matches) * 100;
  const extremeLowPct = (mcDistribution.extremeLow / mcDistribution.matches) * 100;
  log(`Avg total goals/match: ${avgGoalsPerMatch.toFixed(1)}  (avg/team/match: ${avgGoalsPerTeamPerMatch.toFixed(1)})`);
  log(`Home win%: ${homeWinPct.toFixed(1)}  Away win%: ${awayWinPct.toFixed(1)}  Draw%: ${drawPct.toFixed(1)}`);
  log(`Blowouts (margin >= 10 goals): ${blowoutPct.toFixed(2)}%`);
  log(`Extreme-high matches (combined goals >= 70): ${extremeHighPct.toFixed(2)}%   Extreme-low (combined <= 40): ${extremeLowPct.toFixed(2)}%`);
  log(`Combined-goals range observed: ${mcDistribution.minCombinedGoals}-${mcDistribution.maxCombinedGoals}`);
  const commonMargins = [...mcDistribution.marginCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  table(
    ["MARGIN", "COUNT", "%"],
    commonMargins.map(([margin, count]) => [margin, count, ((count / mcDistribution.matches) * 100).toFixed(1)]),
  );

  const strongestClub = mcSummaries.find((s) => s.strengthRank === 1);
  return {
    state,
    strengths,
    singleTable,
    mcSummaries,
    mcMs,
    nSeasons,
    mcDistribution,
    overallCorrelation,
    weakestClubTitlePct: weakestClub?.titlePct ?? null,
    strongestClubTitlePct: strongestClub?.titlePct ?? null,
    drawPct,
    blowoutPct,
    avgGoalsPerMatch,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const seasonsArg = args.find((a) => a.startsWith("--seasons="));
  const requestedSeasons = seasonsArg ? Number(seasonsArg.split("=")[1]) : 250;
  const outArg = args.find((a) => a.startsWith("--out="));
  const outDir = outArg ? outArg.split("=")[1] : null;

  log(`HM-SEASON-SIM-1.0 full-season + Monte Carlo audit`);
  log(`Requested Monte Carlo seasons per competition: ${requestedSeasons}`);
  log(`Generated: ${new Date().toISOString()}`);

  const hlResult = await auditCompetition(HANDBOLLSLIGAN_ID, "Handbollsligan", requestedSeasons);
  const avResult = await auditCompetition(ALLSVENSKAN_ID, "Allsvenskan", requestedSeasons);

  log(`\n${"=".repeat(78)}`);
  log(`RUNTIME SUMMARY`);
  log("=".repeat(78));
  log(`Handbollsligan MC: ${hlResult.nSeasons} seasons in ${hlResult.mcMs}ms (${(hlResult.mcMs / hlResult.nSeasons).toFixed(1)}ms/season)`);
  log(`Allsvenskan MC:    ${avResult.nSeasons} seasons in ${avResult.mcMs}ms (${(avResult.mcMs / avResult.nSeasons).toFixed(1)}ms/season)`);

  // HM-SEASON-SIM-1.1 Part 8: ENGINE VERDICT, derived from the actual
  // combined results across both leagues (${hlResult.nSeasons +
  // avResult.nSeasons} total league seasons) -- never a target chosen in
  // advance, no auto-retuning triggered by this verdict.
  log(`\n${"=".repeat(78)}`);
  log(`ENGINE VERDICT (${hlResult.nSeasons + avResult.nSeasons} total league seasons)`);
  log("=".repeat(78));
  const results2 = [hlResult, avResult];
  const minCorrelation = Math.min(...results2.map((r) => Math.abs(r.overallCorrelation ?? 0)));
  const maxWeakestTitlePct = Math.max(...results2.map((r) => r.weakestClubTitlePct ?? 0));
  const minStrongestTitlePct = Math.min(...results2.map((r) => r.strongestClubTitlePct ?? 0));
  const maxDrawPct = Math.max(...results2.map((r) => r.drawPct));
  const avgGoalsAcrossBoth = mean(results2.map((r) => r.avgGoalsPerMatch));

  const tooRandomReasons: string[] = [];
  if (minCorrelation < 0.3) tooRandomReasons.push(`weak strength-vs-position correlation in at least one league (min |rho|=${minCorrelation.toFixed(3)})`);
  if (maxWeakestTitlePct >= 5) tooRandomReasons.push(`the weakest-strength club won the title in >=5% of seasons in at least one league (${maxWeakestTitlePct.toFixed(1)}%)`);

  const tooDeterministicReasons: string[] = [];
  if (minCorrelation > 0.9) tooDeterministicReasons.push(`extremely tight strength-vs-position correlation in both leagues (min |rho|=${minCorrelation.toFixed(3)})`);
  if (minStrongestTitlePct > 60) tooDeterministicReasons.push(`the strongest-strength club won the title in >60% of seasons in both leagues (min ${minStrongestTitlePct.toFixed(1)}%)`);
  if (maxDrawPct < 3) tooDeterministicReasons.push(`draw rate implausibly low in at least one league (${maxDrawPct.toFixed(1)}%)`);

  let verdict: "TOO RANDOM" | "BALANCED" | "TOO DETERMINISTIC";
  if (tooRandomReasons.length > 0) verdict = "TOO RANDOM";
  else if (tooDeterministicReasons.length > 0) verdict = "TOO DETERMINISTIC";
  else verdict = "BALANCED";

  log(`VERDICT: ${verdict}`);
  log(`Basis:`);
  log(`  - Strength-vs-position correlation: Handbollsligan rho=${hlResult.overallCorrelation?.toFixed(3) ?? "n/a"}, Allsvenskan rho=${avResult.overallCorrelation?.toFixed(3) ?? "n/a"}`);
  log(`  - Weakest-strength club title%: Handbollsligan ${hlResult.weakestClubTitlePct?.toFixed(1) ?? "n/a"}%, Allsvenskan ${avResult.weakestClubTitlePct?.toFixed(1) ?? "n/a"}%`);
  log(`  - Strongest-strength club title%: Handbollsligan ${hlResult.strongestClubTitlePct?.toFixed(1) ?? "n/a"}%, Allsvenskan ${avResult.strongestClubTitlePct?.toFixed(1) ?? "n/a"}%`);
  log(`  - Draw rate: Handbollsligan ${hlResult.drawPct.toFixed(1)}%, Allsvenskan ${avResult.drawPct.toFixed(1)}%`);
  log(`  - Avg goals/match (both leagues): ${avgGoalsAcrossBoth.toFixed(1)}`);
  if (tooRandomReasons.length > 0) log(`  TOO RANDOM reasons: ${tooRandomReasons.join("; ")}`);
  if (tooDeterministicReasons.length > 0) log(`  TOO DETERMINISTIC reasons: ${tooDeterministicReasons.join("; ")}`);

  log(`\nNEXT RECOMMENDATION: ${verdict === "BALANCED" ? "NO CHANGE" : "CALIBRATION NEEDED"}`);
  log(`No gameplay/balance code was changed as part of producing this verdict, per instruction -- this is audit output only.`);

  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "season-audit-report.txt"), lines.join("\n"), "utf-8");
    log(`\nFull report written to ${path.join(outDir, "season-audit-report.txt")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
