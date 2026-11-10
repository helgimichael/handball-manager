import { getClub } from '../../game-data';
import { clubCompetitionId } from '../../career/competitionMembership';
import type { CareerState } from '../../career/types';
import { SWEDISH_2026_RULES } from './sweden2026';

export function sportingTier(state: CareerState, clubId: string): number {
  const id=clubCompetitionId(state,clubId) ?? getClub(clubId)?.competitionId;
  const league=SWEDISH_2026_RULES.leagues.find(l=>l.id===id);
  return SWEDISH_2026_RULES.families.find(f=>f.id===league?.familyId)?.tier ?? 4;
}
/** No active restriction is inferred from names, historic registers or permanent-affiliation seeds. */
export function cooperationEligibility(state: CareerState, clubId: string, targetTier: number, on: string) {
  const reasons:string[]=[];
  for(const p of Object.values(state.clubPartnerships ?? {})) {
    const r=p.competitionRestriction;
    if(p.clubBId!==clubId || p.status!=='ACTIVE' || !r?.evidence.trim() || !['OFFICIAL_RECORD','CAREER_AGREEMENT'].includes(r.origin) || p.startDate>on || (p.endDate && p.endDate<on) || r.effectiveFrom>on || (r.effectiveUntil && r.effectiveUntil<on))continue;
    let highest=r.highestEligibleTier ?? 1;
    if(r.applyParentDivisionRule) {
      const parentTier=sportingTier(state,p.clubAId);
      if(parentTier<=2)highest=Math.max(highest,3);
      else if(parentTier===3)highest=Math.max(highest,4);
    }
    if(targetTier<highest)reasons.push(`${p.id}: highest eligible sporting tier ${highest}; ${r.origin}: ${r.evidence}`);
  }
  return {eligible:reasons.length===0,reasons};
}
