import type { CareerState } from './types';
import { prepareGameContinuity } from '../competition/transition/gameContinuity';
import { compactCareerHistory } from './historyCompaction';
import { CLUBS, COMPETITIONS, getClub } from '../game-data';
import { clubCompetitionId } from './competitionMembership';
import { snapshotCompetitionTransitionInput, canonicalCompetitionClubs } from '../competition/transition/careerSnapshot';
import { previewSeasonTransition, type SeasonTransitionPreview } from '../competition/transition/preview';
import { SWEDISH_2026_RULES } from '../competition/transition/sweden2026';
import { validatePlannerInput } from '../competition/transition/validation';
import type { CompetitionRules, Dependency, PlannerInput, RankingDecision } from '../competition/transition/types';
import { buildNewSeasonCalendar } from '../competition/seasonCalendar';
import { recordSeasonQuietly } from '../manager/managerCareer';
import { emptyMatchFitnessLedger, PRESEASON_MATCH_FITNESS } from '../players/matchFitness';
import { progressCareerQualifications, QUALIFICATION_SCHEDULING_BLOCKER_CODES } from '../competition/transition/careerQualifications';
import { careerQualificationEvidence } from '../competition/transition/careerQualificationEvidence';

export type SeasonTransitionEvidence = Pick<PlannerInput, 'eligibility' | 'qualificationResults' | 'qualificationFixtures' | 'externalEntrants' | 'groupAllocations'> & {
  readonly rankingDecisions?: Readonly<Record<string, readonly RankingDecision[]>>;
};
export type SeasonTransitionRequest = {
  readonly fromSeasonId: string;
  readonly rules?: CompetitionRules;
  readonly evidence?: SeasonTransitionEvidence;
  /** Neither last season's profile nor a hardcoded kickoff is sufficient. */
  readonly nextSeason?: { readonly rules: CompetitionRules; readonly kickoffDate: string; readonly evidence: string };
};
export type SeasonTransitionReceipt = {
  readonly id: string;
  readonly fromSeasonId: string;
  readonly toSeasonId: string;
  readonly ruleId: string;
  /** Exact request, rather than a collision-prone hash, validates committed retries. */
  readonly requestKey: string;
};
export type SeasonTransitionResult = {
  readonly status: 'APPLIED' | 'BLOCKED' | 'ALREADY_APPLIED';
  readonly state: CareerState;
  readonly blockers: readonly Dependency[];
  readonly preview?: SeasonTransitionPreview;
  readonly receipt?: SeasonTransitionReceipt;
};

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

/** Pure transaction: no persistence, mutation, rating selection or legacy outcome repair. */
export function attemptSeasonTransition(input: CareerState, request?: SeasonTransitionRequest): SeasonTransitionResult {
  const original = input;
  const blockers: Dependency[] = [];
  const fail = (code: string, ref: string, message: string) => blockers.push({ code, ref, message, status: 'BLOCKED' as const });
  let preview: SeasonTransitionPreview | undefined;
  const blocked = (): SeasonTransitionResult => ({ status: 'BLOCKED', state: original, blockers, ...(preview ? { preview } : {}) });
  try {
    const prepared = !request && !input.seasonTransitionRequest ? prepareGameContinuity(input) : undefined;
    input = prepared?.state ?? input;
    request = request ?? input.seasonTransitionRequest ?? prepared!.request;
    blockers.push(...(prepared?.blockers ?? []));
    const rules = request.rules ?? SWEDISH_2026_RULES;
    const requestKey = stable({ ...request, rules, evidence: request.evidence ?? {} });
    const receipt = input.lastSeasonTransition;
    if (request.fromSeasonId !== input.seasonId) {
      if (receipt?.fromSeasonId === request.fromSeasonId && receipt.toSeasonId === input.seasonId && receipt.requestKey === requestKey) return { status: 'ALREADY_APPLIED', state: input, blockers: [], receipt };
      fail('STALE_TRANSITION_REQUEST', request.fromSeasonId, 'Request does not match the current season or its committed transition receipt.');
      return blocked();
    }
    if (!request.rules && input.seasonId !== SWEDISH_2026_RULES.seasonId) { fail('OFFICIAL_SEASON_PROFILE_UNAVAILABLE',input.seasonId,'No verified Swedish rule package exists for this season. Last season is not silently inherited.'); return blocked(); }
    blockers.push(...careerQualificationEvidence(input,rules).blockers);
    if (!input.seasonComplete) fail('SEASON_NOT_COMPLETE', input.seasonId, 'The career season has not finished.');
    if (input.productionMatch || input.activeMatchSession) fail('ACTIVE_MATCH', input.seasonId, 'Finish the active match before attempting a season transition.');
    if (input.seasonHistory?.some((s) => s.seasonId === input.seasonId)) fail('SEASON_ALREADY_ARCHIVED', input.seasonId, 'A season may be archived only once.');
    if (blockers.length) return blocked();
    // Recompute against this request; persisted display blockers are not authority.
    if (input.seasonComplete) blockers.push(...progressCareerQualifications(input,input.gameDate,request).blockers.filter(b => QUALIFICATION_SCHEDULING_BLOCKER_CODES.has(b.code)));
    const evidence = request.evidence;
    const rawSnapshot = snapshotCompetitionTransitionInput(input, evidence, rules);
    const snapshot: PlannerInput = { ...rawSnapshot, standings: rawSnapshot.standings.map((table) => ({ ...table, rankingDecisions: evidence?.rankingDecisions?.[table.competitionId] })) };
    preview = previewSeasonTransition(snapshot);
    blockers.push(...preview.blockers);
    if (!preview.canGenerateNextSeason && !blockers.length) fail('TRANSITION_NOT_READY', rules.id, 'Readiness preview did not authorize season generation.');
    const modeled = new Set(rules.leagues.map((l) => l.id));
    const canonical = new Set(CLUBS.map((c) => c.id));
    for (const id of Object.keys(request.evidence?.rankingDecisions ?? {})) if (!modeled.has(id)) fail('UNKNOWN_RANKING_COMPETITION', id, 'Ranking evidence must belong to an affected competition.');
    for (const [id, competition] of Object.entries(input.competitionMembership ?? {})) {
      if (!canonical.has(id) || !COMPETITIONS.some((c) => c.id === competition)) fail('INVALID_CURRENT_MEMBERSHIP', id, 'Overrides must reference canonical clubs and competitions.');
    }
    const currentFixtureIds = new Set<string>();
    for (const fixture of input.fixtures) {
      if (currentFixtureIds.has(fixture.id)) fail('DUPLICATE_CURRENT_FIXTURE', fixture.id, 'Current fixture IDs must be globally unique.');
      currentFixtureIds.add(fixture.id);
      const result = input.results[fixture.id];
      if (result && (result.fixtureId !== fixture.id || result.homeClubId !== fixture.homeClubId || result.awayClubId !== fixture.awayClubId)) fail('CURRENT_RESULT_MISMATCH', fixture.id, 'A completed result must identify its exact fixture and opponents.');
      if (fixture.type === 'LEAGUE' && !modeled.has(fixture.competitionId)) fail('UNCOVERED_COMPETITION', fixture.competitionId, 'Every current league calendar must be covered by the atomic plan.');
      if (fixture.type !== 'FRIENDLY' && !input.results[fixture.id]) fail('UNPLAYED_COMPETITIVE_FIXTURE', fixture.id, 'Complete or explicitly resolve the current competitive calendar first.');
    }
    for (const claim of [...preview.proposal.directRelegations,...preview.proposal.qualificationMovements]) if (!claim.toCompetitionId && rules.families.some(f => f.id === claim.toFamilyId && f.boundary)) fail('BOUNDARY_DESTINATION_REQUIRED',claim.clubId,'Departing club requires a canonical district competition and verified allocation; a boundary port is not a destination.');
    const nextProfile = request.nextSeason;
    if (!nextProfile) fail('NEXT_SEASON_PROFILE_REQUIRED', rules.nextSeasonId, 'Supply a verified next-season rules package and an evidenced league kickoff date.');
    else {
      const nextRules = nextProfile.rules;
      blockers.push(...validatePlannerInput({ seasonId: nextRules.seasonId, rules: nextRules, clubs: canonicalCompetitionClubs(), standings: [] }));
      const year = Number(input.seasonId.slice(0, 4)) + 1;
      if (rules.nextSeasonId !== `${year}/${String(year + 1).slice(-2)}` || nextRules.seasonId !== rules.nextSeasonId) fail('NEXT_SEASON_MISMATCH', nextRules.seasonId, 'Only the immediately following season can be generated.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(nextProfile.kickoffDate) || !Number.isFinite(Date.parse(nextProfile.kickoffDate)) || new Date(nextProfile.kickoffDate).toISOString().slice(0, 10) !== nextProfile.kickoffDate || !nextProfile.kickoffDate.startsWith(`${year}-`) || nextProfile.kickoffDate <= input.gameDate || !nextProfile.evidence.trim()) fail('INVALID_NEXT_CALENDAR', rules.nextSeasonId, 'A valid, evidenced kickoff in the next season year, after the current game date, is required.');
      const definitions = (profile: CompetitionRules) => ({ leagues: [...profile.leagues].sort((a,b) => a.id.localeCompare(b.id)), families: [...profile.families].sort((a,b) => a.id.localeCompare(b.id)) });
      if (stable(definitions(rules)) !== stable(definitions(nextRules))) fail('UNSUPPORTED_LEAGUE_RESTRUCTURE', nextRules.id, 'Changes to affected leagues, families, sizes or formats need a separate policy.');
      for (const limitation of nextRules.limitations) fail(limitation.code, nextRules.id, limitation.message);
    }
    if (!preview.canGenerateNextSeason || blockers.length || !nextProfile) return blocked();
    const membership = { ...input.competitionMembership };
    const seen = new Set<string>();
    for (const league of preview.leagues) {
      const definition = rules.leagues.find((l) => l.id === league.competitionId)!;
      if (!COMPETITIONS.some((c) => c.id === league.competitionId) || league.confirmedNextClubIds.length !== definition.size) fail('INVALID_TARGET_SIZE', league.competitionId, 'Target competition must exist and have exactly its defined size.');
      for (const id of league.confirmedNextClubIds) {
        if (!canonical.has(id) || seen.has(id)) fail('INVALID_TARGET_CLUB', id, 'Each target member must be a unique canonical club.');
        if (getClub(id)?.dataSource === 'IDENTITY_ONLY' && !input.worldSquads[id]?.length) fail('TARGET_SQUAD_COVERAGE_REQUIRED',id,'Identity-only club requires a supplied squad before entering an active league.');
        seen.add(id);
        membership[id] = league.competitionId;
      }
    }
    for (const club of CLUBS) if (modeled.has(clubCompetitionId(input, club.id) ?? '') && !seen.has(club.id)) {
      const exit = [...preview.proposal.directRelegations,...preview.proposal.qualificationMovements].find(c => c.clubId === club.id && c.toCompetitionId && rules.boundaryLeagues?.some(b => b.id === c.toCompetitionId && b.familyId === c.toFamilyId));
      if (exit) membership[club.id] = exit.toCompetitionId!;
      else fail('BOUNDARY_DESTINATION_REQUIRED',club.id,'Departing club needs a supported canonical pool destination.');
    }
    if (!seen.has(input.playerClubId) && !rules.boundaryLeagues?.some(b => b.id === membership[input.playerClubId])) fail('MANAGER_DESTINATION_MISSING', input.playerClubId, 'The managed club needs a validated next-season league.');
    for (const league of rules.leagues) if (CLUBS.filter((c) => (membership[c.id] ?? c.competitionId) === league.id).length !== league.size) fail('INVALID_TARGET_SIZE', league.id, 'Merged world membership does not match the validated size.');
    if (blockers.length) return blocked();

    // Construct a candidate; expose it only after final fixture validation succeeds.
    const state = compactCareerHistory(recordSeasonQuietly(input), input.gameDate);
    const claims = [...preview.proposal.directPromotions, ...preview.proposal.directRelegations, ...preview.proposal.qualificationMovements, ...preview.proposal.remaining];
    const outcome = state.seasonOutcome?.seasonId === state.seasonId ? {
      ...state.seasonOutcome, nextMembership: Object.fromEntries([...seen].sort().map((id) => [id, membership[id]])),
      promoted: claims.filter((c) => c.kind === 'PROMOTION').map((c) => c.clubId).sort(),
      relegated: claims.filter((c) => c.kind === 'RELEGATION').map((c) => c.clubId).sort(),
    } : undefined;
    const tables = Object.fromEntries(rules.leagues.map((l) => {
      const rows = snapshot.standings.find((t) => t.competitionId === l.id)!.rows;
      const order = preview!.proposal.rankings.find((r) => r.competitionId === l.id)!.groups.flatMap((g) => g.clubIds);
      return [l.id, [...rows].sort((a,b) => order.indexOf(a.clubId) - order.indexOf(b.clubId))];
    }));
    const newReceipt: SeasonTransitionReceipt = { id: `${state.seasonId}->${rules.nextSeasonId}:${rules.id}`, fromSeasonId: state.seasonId, toSeasonId: rules.nextSeasonId, ruleId: rules.id, requestKey };
    const lastFixture = [...state.fixtures].filter((f) => state.matchPlans[f.id]?.squad.players.length).sort((a,b) => b.date.localeCompare(a.date))[0];
    const next = buildNewSeasonCalendar({
      ...state, seasonId: rules.nextSeasonId, competitionId: membership[state.playerClubId]!, competitionMembership: membership,
      seasonTransitionRequest: undefined,
      seasonComplete: false, results: {}, physicalReports: {}, playerSeasonStats: {}, clubForm: {}, matchPlans: {}, liveMatchPlans: {}, matchPlanChangeHistory: {},
      activeMatchSession: null, productionMatch: null, playerMatchFitness: emptyMatchFitnessLedger(PRESEASON_MATCH_FITNESS), preseasonEvents: [],
      preferredLineup: lastFixture ? state.matchPlans[lastFixture.id] : state.preferredLineup,
      leagueKickoffDate: nextProfile.kickoffDate, seasonStartDate: state.gameDate, lastSeasonTransition: newReceipt,
      seasonHistory: [...(state.seasonHistory ?? []), { seasonId: state.seasonId, competitionId: state.competitionId, table: tables[state.competitionId] ?? state.swedishContinuity?.pools?.[state.seasonId]?.districts[state.competitionId.replace('se_division2_','')]?.rows ?? [], stats: state.playerSeasonStats, tables, ties: Object.values(state.competitionTies ?? {}), fixtures:state.fixtures, results:state.results, ...(outcome ? { outcome } : {}), transition: structuredClone({ receipt: newReceipt, preview, evidence: request.evidence ?? {} }) }],
      careerEvents: state.careerEvents.map((e) => ({ ...e, resolved: true })), inbox: state.inbox.map((m) => ({ ...m, actionRequired: false, resolved: true })),
    }, nextProfile.kickoffDate, rules.leagues.map((l) => l.id));
    const fixtureIds = new Set<string>();
    const previousIds = currentFixtureIds;
    for (const fixture of next.fixtures) {
      if (fixtureIds.has(fixture.id) || previousIds.has(fixture.id) || !canonical.has(fixture.homeClubId) || !canonical.has(fixture.awayClubId) || fixture.homeClubId === fixture.awayClubId || (fixture.type !== 'LEAGUE' && fixture.type !== 'CUP') || (fixture.type === 'LEAGUE' && (membership[fixture.homeClubId] !== fixture.competitionId || membership[fixture.awayClubId] !== fixture.competitionId || fixture.date < nextProfile.kickoffDate))) fail('INVALID_GENERATED_FIXTURE', fixture.id, 'Generated fixtures need fresh unique IDs and canonical opponents; league fixtures must use validated membership and kickoff. Cup slots are validated by the existing calendar planner.');
      fixtureIds.add(fixture.id);
    }
    for (const league of rules.leagues) {
      const fixtures = next.fixtures.filter((f) => f.competitionId === league.id);
      const pairs = new Set(fixtures.map((f) => JSON.stringify([f.homeClubId, f.awayClubId])));
      const ids = preview.leagues.find((l) => l.competitionId === league.id)!.confirmedNextClubIds;
      if (fixtures.length !== league.size * (league.size - 1) || pairs.size !== fixtures.length || !ids.every((h) => ids.every((a) => h === a || pairs.has(JSON.stringify([h,a]))))) fail('INCOMPLETE_GENERATED_CALENDAR', league.id, 'Every league requires exactly one home and away fixture per opponent.');
    }
    return blockers.length ? blocked() : { status: 'APPLIED', state: next, blockers: [], preview, receipt: newReceipt };
  } catch (error) {
    fail('TRANSITION_VALIDATION_FAILED', input.seasonId, error instanceof Error ? error.message : 'Invalid transition data.');
    return blocked();
  }
}
