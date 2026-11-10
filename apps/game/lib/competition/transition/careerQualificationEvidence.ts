import type { CareerState } from '../../career/types';
import type { CompetitionRules, Dependency, QualificationFixture } from './types';

/** Translate real saved career matches, never SeasonOutcome's legacy movement suggestions. */
export function careerQualificationEvidence(state: Pick<CareerState,'seasonId'|'fixtures'|'results'|'competitionTies'>, rules: CompetitionRules): { fixtures: QualificationFixture[]; blockers: Dependency[] } {
  const fixtures: QualificationFixture[] = [], blockers: Dependency[] = [];
  for (const tie of Object.values(state.competitionTies ?? {})) {
    if (!tie.transition) continue;
    const stage = rules.stages.find(s => s.id === tie.transition!.stageId);
    const fail = (ref: string) => blockers.push({ code:'INVALID_CAREER_QUALIFICATION',ref,status:'BLOCKED' as const,message:'Saved qualifier must match its current season, rule, stage, registered tie, opponents, game and official date window.' });
    if (!stage || tie.seasonId !== state.seasonId || tie.transition.ruleId !== rules.id) { fail(tie.id); continue; }
    for (const id of tie.fixtureIds) {
      const f = state.fixtures.find(f => f.id === id), result = state.results[id];
      const game = f?.stage?.game ?? 0, window = stage.gameWindows?.[game-1];
      if (!f || f.type !== 'QUALIFIER' || f.stage?.tieId !== tie.id || ![tie.highClubId,tie.lowClubId].includes(f.homeClubId) || ![tie.highClubId,tie.lowClubId].includes(f.awayClubId) || f.homeClubId === f.awayClubId || f.stage.mustDecide !== (stage.format !== 'TWO_LEG' || game === 2) || !window || f.date < window.startDate || f.date > window.endDate || (result && (result.fixtureId !== id || result.homeClubId !== f.homeClubId || result.awayClubId !== f.awayClubId))) { fail(id); continue; }
      fixtures.push({ id,stageId:stage.id,seasonId:state.seasonId,game,homeClubId:f.homeClubId,awayClubId:f.awayClubId,
        ...(result ? { result:{ homeGoals:result.homeGoals,awayGoals:result.awayGoals,origin:'CAREER_SIMULATED' as const,evidence:`Career fixture ${id}; seed ${result.seed}; ${result.engine ?? 'existing match simulation'}`,
          ...(result.decider?.method === 'SHOOTOUT' ? { decider:{ winnerClubId:result.decider.winnerClubId,evidence:`Persisted ${result.decider.method} in ${id}` } } : {}),
        } } : {}),
      });
    }
  }
  return { fixtures,blockers };
}
