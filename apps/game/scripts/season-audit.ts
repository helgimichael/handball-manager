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
import { getClubStrength } from "../lib/game-data/clubStrength";
import { getCareerClubSquad } from "../lib/career/careerWorld";
import { resolveClubMatchPlanForFixture, computePlayerMatchStrengthAdjustment, buildStaminaByPlayerId } from "../lib/career/playerMatchStrength";
import { computeAiVsAiTacticalAdjustment } from "../lib/career/tacticalMatchAdjustment";
import { computeTacticalMatchPlanAdjustment } from "../lib/career/tacticalPlanEffects";
import { computeTeamUsageTrace, computeAttackActiveWindows } from "../lib/career/matchUsageEngine";
import { buildMatchRoster, buildFallbackAttackExposure } from "../lib/career/tumbaRoster";
import { ensureCareerAllClubEconomies, getClubEconomySnapshot } from "../lib/economy/clubEconomyIntegration";
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
  return simulateFixture(fixture, state.saveSeed, (clubId) => getClubStrength(clubId), undefined, combined);
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
    return buildMatchRoster(squad, undefined, attackExposure, activeWindows, defenceExposure);
  }

  const homeRoster = buildRoster(homeSquad, fixture.homeClubId, homePlan, homeUsageTrace, homeUsageSeed, homeStamina);
  const awayRoster = buildRoster(awaySquad, fixture.awayClubId, awayPlan, awayUsageTrace, awayUsageSeed, awayStamina);

  return simulateFixture(
    fixture,
    state.saveSeed,
    (clubId) => getClubStrength(clubId),
    (clubId) => (clubId === fixture.homeClubId ? homeRoster : awayRoster),
    combined,
  );
}

function simulateCompetitionDetailed(state: CareerState, fixtures: readonly CareerFixture[]): FastMatchResult[] {
  return fixtures.map((f) => simulateFixtureDetailed(state, f));
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
  clubStrengthCurated: boolean;
  economyBand: string | null;
  wageBudgetEur: number | null;
  playerWagesEur: number | null;
}

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

  const cs = getClubStrength(clubId);
  const curatedClubIds = new Set(Object.keys((getClubStrengthCuratedSet())));
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
    clubStrengthCurated: curatedClubIds.has(clubId),
    economyBand: economy?.band ?? null,
    wageBudgetEur: economy?.budgets.wageBudgetEur ?? null,
    playerWagesEur: economy?.playerWageCostsEurAnnual ?? null,
  };
}

// Mirrors clubStrength.ts's own curated-set (Allsvenskan's 13 AI clubs + Tumba) -- used only to LABEL which clubs have a curated ClubStrength vs the flat Handbollsligan default, never to alter the value itself.
function getClubStrengthCuratedSet(): Record<string, true> {
  const allsvenskanClubs = getClubsByCompetition(ALLSVENSKAN_ID).map((c) => c.id);
  const out: Record<string, true> = {};
  for (const id of allsvenskanClubs) out[id] = true;
  return out;
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

function runMonteCarlo(baseState: CareerState, fixtures: readonly CareerFixture[], clubIds: readonly string[], nSeasons: number): Map<string, ClubSeasonOutcome[]> {
  const byClub = new Map<string, ClubSeasonOutcome[]>();
  for (const id of clubIds) byClub.set(id, []);

  for (let i = 0; i < nSeasons; i += 1) {
    const seasonState: CareerState = { ...baseState, saveSeed: `${baseState.saveSeed}:mc:${i}` };
    const results = simulateCompetitionFast(seasonState, fixtures);
    const table = standingsFor(clubIds, results);
    table.forEach((row, idx) => {
      byClub.get(row.clubId)!.push({ clubId: row.clubId, position: idx + 1, points: row.points, goalsFor: row.goalsFor, goalsAgainst: row.goalsAgainst });
    });
  }
  return byClub;
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

  // --- Strength indicators ---
  const strengths = clubIds.map((id) => computeStrengthIndicators(state, id));

  log(`\n--- PRE-SEASON STRENGTH INDICATORS ---`);
  table(
    ["CLUB", "SQUAD", "AVG-CA", "GK-CA", "BEST-CA", "CA-STDEV", "CS-OVERALL", "CS-CURATED", "ECON-BAND", "WAGE-BUDGET"],
    strengths.map((s) => [
      s.clubName,
      s.squadSize,
      s.avgOutfieldCA?.toFixed(1) ?? "-",
      s.gkCA?.toFixed(1) ?? "-",
      s.bestPlayerCA ?? "-",
      s.caStdDev?.toFixed(1) ?? "-",
      s.clubStrengthOverall,
      s.clubStrengthCurated ? "yes" : "NO (flat default)",
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
  const caByPlayerId = new Map<string, number>();
  for (const id of clubIds) for (const r of state.gameplayRatings[id] ?? []) caByPlayerId.set(r.playerId, r.ca);

  const topScorers = [...goalsByPlayer.entries()].sort((a, b) => b[1].goals - a[1].goals).slice(0, 10);
  log(`\n--- TOP 10 SCORERS (single detailed season) ---`);
  table(
    ["PLAYER", "CLUB", "GOALS", "APPS", "AVG RATING", "CA"],
    topScorers.map(([playerId, v]) => [
      playerId,
      getClub(v.clubId)?.name ?? v.clubId,
      v.goals,
      v.apps,
      (v.ratingSum / v.apps).toFixed(2),
      caByPlayerId.get(playerId) ?? "-",
    ]),
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

  const topGks = [...gkSavesByPlayer.entries()]
    .filter(([, v]) => v.shotsFaced >= 20)
    .sort((a, b) => b[1].saves / b[1].shotsFaced - a[1].saves / a[1].shotsFaced)
    .slice(0, 10);
  log(`\n--- TOP 10 GOALKEEPER SAVE% (min 20 shots faced) ---`);
  table(
    ["PLAYER", "CLUB", "SAVES", "SHOTS FACED", "SAVE%", "CA"],
    topGks.map(([playerId, v]) => [playerId, getClub(v.clubId)?.name ?? v.clubId, v.saves, v.shotsFaced, ((v.saves / v.shotsFaced) * 100).toFixed(1), caByPlayerId.get(playerId) ?? "-"]),
  );

  // CA vs performance correlation (individual players, single season)
  const playersWithCA = [...goalsByPlayer.entries()].filter(([id]) => caByPlayerId.has(id));
  const caSeries = playersWithCA.map(([id]) => caByPlayerId.get(id)!);
  const goalsSeries = playersWithCA.map(([, v]) => v.goals);
  const ratingSeries = playersWithCA.map(([, v]) => v.ratingSum / v.apps);
  log(`\nIndividual player CA vs GOALS Spearman rho (n=${playersWithCA.length}): ${spearman(caSeries, goalsSeries)?.toFixed(3) ?? "n/a"}`);
  log(`Individual player CA vs AVG RATING Spearman rho (n=${playersWithCA.length}): ${spearman(caSeries, ratingSeries)?.toFixed(3) ?? "n/a"}`);

  // --- Monte Carlo ---
  const t2 = Date.now();
  const mc = runMonteCarlo(state, fixtures, clubIds, nSeasons);
  const mcMs = Date.now() - t2;
  log(`\n--- MONTE CARLO (${nSeasons} seasons, ${mcMs}ms, ${(mcMs / nSeasons).toFixed(1)}ms/season) ---`);

  const mcSummaries = clubIds.map((id) => {
    const outcomes = mc.get(id)!;
    const positions = outcomes.map((o) => o.position);
    const points = outcomes.map((o) => o.points);
    const n = outcomes.length;
    return {
      clubId: id,
      clubName: getClub(id)?.name ?? id,
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

  table(
    ["CLUB", "AVG POS", "MED POS", "BEST", "WORST", "AVG PTS", "TITLE%", "TOP3%", "BOTTOM3%"],
    mcSummaries.map((s) => [s.clubName, s.avgPosition.toFixed(2), s.medianPosition.toFixed(1), s.best, s.worst, s.avgPoints.toFixed(1), s.titlePct.toFixed(1), s.top3Pct.toFixed(1), s.bottom3Pct.toFixed(1)]),
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

  table(
    ["CLUB", "STRENGTH RANK", "RESULTS RANK", "GAP", "AVG POS", "TITLE%", "FLAG"],
    outlierRows.map((r) => [
      r.name,
      r.sRank,
      r.rRank,
      r.gap > 0 ? `+${r.gap}` : String(r.gap),
      r.avgPos.toFixed(2),
      r.titlePct.toFixed(1),
      Math.abs(r.gap) >= 4 ? "REVIEW (>=4 rank gap)" : "",
    ]),
  );

  return { state, strengths, singleTable, mcSummaries, mcMs, nSeasons };
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
