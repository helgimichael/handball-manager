import { enforceCareerCooperationEligibility } from './cooperationEligibility';
import type { CareerFixture, CareerState } from '../../career/types';
import type { SeasonTransitionRequest } from '../../career/seasonTransition';
import { prepareGameContinuity } from './gameContinuity';
import { getClub } from '../../game-data';
import { addDays } from '../../career/dateUtils';
import { KVAL_ALLSVENSKAN, KVAL_HBL } from '../rules';
import type { CompetitionTie } from '../types';
import { snapshotCompetitionTransitionInput } from './careerSnapshot';
import { careerQualificationEvidence } from './careerQualificationEvidence';
import { planCompetitionTransition } from './planner';
import { SWEDISH_2026_RULES } from './sweden2026';
import type { Dependency, QualificationStage, TransitionProposal } from './types';

const stageLabels: Readonly<Record<string,string>> = {
  'hbl-11':'Kval till Handbollsligan 1','hbl-12':'Kval till Handbollsligan 2','hbl-13':'Kval till Handbollsligan 3',
  'ha-semi-n':'Förkval till Allsvenskan: Norra 2–Södra 3','ha-semi-s':'Förkval till Allsvenskan: Södra 2–Norra 3',
  'ha-final-11':'Kval till Allsvenskan 1','ha-final-12':'Kval till Allsvenskan 2',
  'd1-n-pre':'Förkval till Division 1 Norra','d1-n-semi-9':'Kval Norra: semifinal 1','d1-n-semi-10':'Kval Norra: semifinal 2','d1-n-final':'Kval till Division 1 Norra: final',
  'd1-s-semi-v':'Kval Södra: semifinal 1','d1-s-semi-s':'Kval Södra: semifinal 2','d1-s-final-9':'Kval till Division 1 Södra 1','d1-s-final-10':'Kval till Division 1 Södra 2',
};

export const QUALIFICATION_SCHEDULING_BLOCKER_CODES = new Set(['QUALIFICATION_WINDOW_UNAVAILABLE','QUALIFICATION_CALENDAR_REQUIRED','TERMINAL_DECIDER_REQUIRED','QUALIFICATION_TIE_CONFLICT','QUALIFICATION_FIXTURE_CONFLICT','INVALID_CAREER_QUALIFICATION','LEGACY_QUALIFICATION_REVIEW_REQUIRED','QUALIFICATION_SQUAD_COVERAGE_REQUIRED','DIVISION2_POOL_INSUFFICIENT','GEOGRAPHY_REQUIRED','GEOGRAPHIC_CAPACITY_CONFLICT','POOL_GEOGRAPHY_REQUIRED']);

export type CareerQualificationProgress = { state: CareerState; proposal: TransitionProposal; blockers: readonly Dependency[] };

/** Materialize the existing planner's ready games into the existing career match pipeline.
 * One game at a time: conditional games never enter the calendar after a clinch.
 * Unknown eligibility, home priority, calendar, or external participants never become guesses.
 */
export function progressCareerQualifications(state: CareerState, date: string, request?: SeasonTransitionRequest): CareerQualificationProgress {
  const prepared = !request && !state.seasonTransitionRequest ? prepareGameContinuity(state,date) : undefined;
  state = prepared?.state ?? state;
  request = request ?? state.seasonTransitionRequest ?? prepared!.request;
  const rules = request.rules ?? SWEDISH_2026_RULES;
  const input = enforceCareerCooperationEligibility(state,snapshotCompetitionTransitionInput(state,request.evidence,rules),date);
  const proposal = planCompetitionTransition({ ...input,standings:input.standings.map(t => ({ ...t,rankingDecisions:request.evidence?.rankingDecisions?.[t.competitionId] })) });
  const blockers: Dependency[] = [...(prepared?.blockers ?? []),...proposal.dependencies,...careerQualificationEvidence(state,rules).blockers];
  const issue = (code: string, ref: string, message: string) => blockers.push({ code,ref,message,status:'BLOCKED' });
  if (request.fromSeasonId !== state.seasonId || !proposal.qualification.length || blockers.some(b => b.code === 'INVALID_CAREER_QUALIFICATION')) return { state,proposal,blockers };
  let next = state;
  const entryReady = (s: QualificationStage) => s.entrants.every(e => e.kind === 'ENTRY' ? proposal.entries.some(x => x.entryId === e.entryId && x.status === 'CONFIRMED') : proposal.qualification.some(x => x.stageId === e.stageId && x.status === 'CONFIRMED'));
  for (const q of proposal.qualification) {
    const stage = rules.stages.find(s => s.id === q.stageId)!;
    const id = `${state.seasonId}:transition:${stage.id}`;
    const existing = next.competitionTies?.[id];
    if (existing && (existing.transition?.ruleId !== rules.id || existing.transition.stageId !== stage.id || existing.highClubId !== q.participants[0] || existing.lowClubId !== q.participants[1])) { issue('QUALIFICATION_TIE_CONFLICT',id,'Existing series does not match the reviewed planner entrants.'); continue; }
    if (q.status === 'CONFIRMED') {
      if (existing && (!existing.winnerClubId || existing.winnerClubId !== q.winnerClubId)) {
        if (existing.winnerClubId) { issue('QUALIFICATION_TIE_CONFLICT',id,'A previously concluded series cannot be overwritten.'); continue; }
        const conditional = new Set(existing.fixtureIds.filter(f => !next.results[f]));
        next = { ...next,fixtures:next.fixtures.filter(f => !conditional.has(f.id)),competitionTies:{ ...next.competitionTies,[id]:{ ...existing,winnerClubId:q.winnerClubId,loserClubId:q.loserClubId,fixtureIds:existing.fixtureIds.filter(f => !conditional.has(f)) } } };
      }
      continue;
    }
    if (q.status === 'BLOCKED' || !entryReady(stage) || q.participants.some(id => !id)) continue;
    const missingSquads = q.participants.filter((clubId): clubId is string => !!clubId && getClub(clubId)?.dataSource === 'IDENTITY_ONLY' && !next.worldSquads[clubId]?.length);
    if (missingSquads.length) { issue('QUALIFICATION_SQUAD_COVERAGE_REQUIRED',stage.id,`Verified team identity has no supplied squad: ${missingSquads.join(', ')}. Do not create players or simulate a placeholder opponent.`); continue; }
    if (next.fixtures.some(f => f.type === 'QUALIFIER' && !next.competitionTies?.[f.stage?.tieId ?? '']?.transition && [f.homeClubId,f.awayClubId].some(id => q.participants.includes(id)))) { issue('LEGACY_QUALIFICATION_REVIEW_REQUIRED',stage.id,'Existing qualification fixtures without planner provenance require review; preserve their history instead of creating a second series.'); continue; }
    if (stage.terminalDecider?.kind !== 'SEVEN_METRES_AFTER_TWO_OVERTIMES') { issue('TERMINAL_DECIDER_REQUIRED',stage.id,'Match simulation requires a verified supported terminal procedure.'); continue; }
    if (existing?.fixtureIds.some(id => !next.results[id])) continue;
    const game = q.unresolvedFixtures[0];
    if (!game?.homeClubId || !game.awayClubId) continue;
    const window = stage.gameWindows?.[game.game-1];
    if (!window) { issue('QUALIFICATION_CALENDAR_REQUIRED',stage.id,'No reviewed date window exists for this game.'); continue; }
    // Daily progression has already played today's matches; never add a past fixture.
    let scheduled = window.startDate > date ? window.startDate : addDays(date,1);
    while (scheduled <= window.endDate && next.fixtures.some(f => f.date === scheduled && [f.homeClubId,f.awayClubId].some(id => id === game.homeClubId || id === game.awayClubId))) scheduled = addDays(scheduled,1);
    if (scheduled > window.endDate) { issue('QUALIFICATION_WINDOW_UNAVAILABLE',`${stage.id}:${game.game}`,`No free future date remains in ${window.startDate}..${window.endDate}; an organizer rescheduling decision is required.`); continue; }
    const reference = q.unresolvedFixtures.find(g => g.homeClubId);
    const flipped = !!reference && q.participants[stage.homeOrder![reference.game-1]!] !== reference.homeClubId;
    const format: CompetitionTie['format'] = stage.format === 'TWO_LEG' ? { kind:'TWO_LEGS' } : { kind:'SERIES',series:{ bestOf:stage.format === 'BEST_OF_5' ? 5 : 3,homePattern:stage.homeOrder!.map(side => (flipped ? 1-side : side) === 0 ? 'HIGH' : 'LOW'),days:0 } };
    const competitionId = stage.id.startsWith('hbl-') ? KVAL_HBL : stage.id.startsWith('ha-') ? KVAL_ALLSVENSKAN : 'se-kval-division1';
    const tie: CompetitionTie = existing ?? { id,seasonId:state.seasonId,competitionId,stage:stage.id.startsWith('hbl-') ? 'KVAL_HBL' : stage.id.startsWith('ha-') ? 'KVAL_ALLSV' : 'KVAL_DIV1',label:stageLabels[stage.id] ?? 'Kval',highClubId:q.participants[0]!,lowClubId:q.participants[1]!,key:stage.id,format,fixtureIds:[],transition:{ ruleId:rules.id,stageId:stage.id } };
    const fixture: CareerFixture = { id:`${id}:g${game.game}`,competitionId,round:game.game,date:scheduled,homeClubId:game.homeClubId,awayClubId:game.awayClubId,type:'QUALIFIER',stage:{ tieId:id,game:game.game,mustDecide:stage.format !== 'TWO_LEG' || game.game === 2 } };
    if (next.fixtures.some(f => f.id === fixture.id) || next.results[fixture.id]) { issue('QUALIFICATION_FIXTURE_CONFLICT',fixture.id,'A saved fixture or result already uses this identity.'); continue; }
    next = { ...next,fixtures:[...next.fixtures,fixture],competitionTies:{ ...next.competitionTies,[id]:{ ...tie,fixtureIds:[...tie.fixtureIds,fixture.id] } },seasonComplete:false,
      ...(next.seasonOutcome ? { seasonOutcome:{ ...next.seasonOutcome,phase:'POSTSEASON' } } : {}),
    };
  }
  return { state:next,proposal,blockers };
}

/** Proposals are advisory. Only attemptSeasonTransition may mutate actual membership. */
export function recordPlannedSportingOutcome(state: CareerState, proposal: TransitionProposal): CareerState {
  if (!state.seasonOutcome) return state;
  const claims = [...proposal.directPromotions,...proposal.directRelegations,...proposal.qualificationMovements,...proposal.remaining];
  const patch = {
    nextMembership:Object.fromEntries(claims.filter(c => c.toCompetitionId).map(c => [c.clubId,c.toCompetitionId!])),
    promoted:claims.filter(c => c.kind === 'PROMOTION').map(c => c.clubId).sort(),
    relegated:claims.filter(c => c.kind === 'RELEGATION').map(c => c.clubId).sort(),
  };
  if (JSON.stringify(patch.nextMembership) === JSON.stringify(state.seasonOutcome.nextMembership) && JSON.stringify(patch.promoted) === JSON.stringify(state.seasonOutcome.promoted) && JSON.stringify(patch.relegated) === JSON.stringify(state.seasonOutcome.relegated)) return state;
  return { ...state,seasonOutcome:{ ...state.seasonOutcome,...patch } };
}
