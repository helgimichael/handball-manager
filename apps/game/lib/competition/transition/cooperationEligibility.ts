import { getClub } from '../../game-data';
import { clubCompetitionId } from '../../career/competitionMembership';
import type { CareerState } from '../../career/types';
import type { PlannerInput } from './types';
import { SWEDISH_2026_RULES } from './sweden2026';

export const SHF_COOPERATION_SOURCE = 'https://www.svenskhandboll.se/download/18.60debfeb19fc104b5f2202ba/1785760169044/TB%202026-2027%20kap%2009%20samarbetsavtal%20sid%2035-40.pdf';

export function sportingTier(state: CareerState, clubId: string): number {
  const id = clubCompetitionId(state, clubId) ?? getClub(clubId)?.competitionId;
  const league = SWEDISH_2026_RULES.leagues.find(l => l.id === id);
  return SWEDISH_2026_RULES.families.find(f => f.id === league?.familyId)?.tier ?? 4;
}

/** Read actual career agreement state, never infer activation from a club's name or an old register.
 * AFFILIATED_B_TEAM already means a cooperation club in the production model: its ACTIVE
 * row cannot opt out of SHF eligibility merely by omitting optional custom restrictions.
 * SHF 2026/27 9:1, 9:4-7; future game seasons retain this supported rule structure.
 */
export function cooperationEligibility(state: CareerState, clubId: string, targetTier: number, on: string) {
  const reasons: string[] = [];
  const year = state.seasonId.slice(0, 4), seasonStart = `${year}-07-01`, cutoff = `${year}-12-31`;
  const sourceTier = sportingTier(state, clubId);
  for (const p of Object.values(state.clubPartnerships ?? {})) {
    if (p.clubBId !== clubId || p.startDate > on) continue;
    const r = p.competitionRestriction;
    // endDate is the saved effective end, not a new real-world termination claim.
    const ended = !!p.endDate && (p.endDate < on || (p.status !== 'ACTIVE' && p.endDate === on));
    const active = !ended && (p.status === 'ACTIVE' || (!!p.endDate && p.endDate >= on));
    const shf = p.type === 'AFFILIATED_B_TEAM' || !!r?.applyParentDivisionRule;
    // A late termination does not restore this season's upward opportunity (9:5-7).
    // This is a seasonal restriction on an ended agreement, NOT reactivation of it.
    const lateEnd = shf && on <= `${Number(year) + 1}-06-30` && ended && p.endDate! >= seasonStart && p.endDate! > cutoff && targetTier < sourceTier;
    let highest = 1;
    if (shf && (active || lateEnd)) highest = Math.max(3, sportingTier(state, p.clubAId) + 1);
    const customActive = active && r?.evidence.trim() && ['OFFICIAL_RECORD', 'CAREER_AGREEMENT'].includes(r.origin)
      && r.effectiveFrom <= on && (!r.effectiveUntil || r.effectiveUntil >= on);
    if (customActive) highest = Math.max(highest, r?.highestEligibleTier ?? 1);
    if (targetTier < highest) reasons.push(`${p.id}: highest eligible sporting tier ${highest}; ${lateEnd ? 'ended after December 31: current-season advancement remains restricted' : 'active career cooperation'}; SHF 9:1, 9:4-7 ${SHF_COOPERATION_SOURCE}${customActive ? `; ${r?.evidence}` : ''}`);
  }
  return { eligible: reasons.length === 0, reasons };
}

/** Caller-supplied/QA eligibility cannot override the same saved cooperation rules used by normal careers.
 * Missing acceptance/licensing evidence stays missing; malformed duplicate evidence stays invalid.
 */
export function enforceCareerCooperationEligibility(state: CareerState, input: PlannerInput, on = state.gameDate): PlannerInput {
  const clubIds = new Set([...input.standings.flatMap(t => t.rows.map(r => r.clubId)), ...(input.externalEntrants ?? []).map(e => e.clubId)]);
  let eligibility = [...(input.eligibility ?? [])];
  for (const clubId of clubIds) for (const family of input.rules.families) {
    const decision = cooperationEligibility(state, clubId, family.tier, on);
    if (decision.eligible) continue;
    const denied = { clubId, targetFamilyId: family.id, seasonId: state.seasonId, status: 'INELIGIBLE' as const, evidence: decision.reasons.join(' | ') };
    if (eligibility.some(e => e.clubId === clubId && e.targetFamilyId === family.id)) eligibility = eligibility.map(e => e.clubId === clubId && e.targetFamilyId === family.id ? { ...e, status: denied.status, evidence: `${e.evidence} | ${denied.evidence}` } : e);
    else eligibility.push(denied);
  }
  return { ...input, eligibility };
}
