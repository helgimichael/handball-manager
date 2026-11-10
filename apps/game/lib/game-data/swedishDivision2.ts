import data from '../competition/transition/sweden2026Data.json';
import type { Club, Competition } from './types';

/** Existing tier field is a nominal 1|2 compatibility field (also used for Division 1).
 * Actual sporting tier 4 remains in the existing Swedish planner's boundary family.
 * These sourced district identities have no playable/simulated league profile yet. */
export const SWEDISH_DIVISION_2_COMPETITIONS: readonly Competition[] = data.division2Registrations.map(d => ({
  id: `se_division2_${d.district}`, nation: 'SWE', tier: 2,
  name: `Division 2 ${({n:'Norr',o:'Öst',m:'Mitt',v:'Väst',s:'Syd'} as Record<string,string>)[d.district]}`,
  sourceNote: `2026/27 district identity; sporting tier 4 boundary, not activated for simulation. ${data.sources[d.sourceId as keyof typeof data.sources].url}`,
}));

/** IDs are explicitly reviewed data, never name matching or invented squads. */
export const SWEDISH_DIVISION_2_CLUBS: readonly Club[] = data.division2Registrations.flatMap(d => d.registrations.flatMap(t =>
  t.canonicalMappingStatus === 'RESOLVED_SOURCE_REGISTRATION' && t.canonicalClubId ? [{
    id:t.canonicalClubId, competitionId:`se_division2_${d.district}`, name:t.name, shortName:t.name,
    playable:false, dataSource:'IDENTITY_ONLY' as const,
    sourceRegistration:{provider:'PROFIXIO' as const,teamId:t.sourceTeamId,seasonId:d.seasonId,url:t.sourceUrl},
    // Neutral crest placeholders only, not claims about official club colours.
    primaryColor:'#6b7280',secondaryColor:'#ffffff',
  }] : []));
