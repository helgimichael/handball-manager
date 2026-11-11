import data from './sweden2026Data.json';
import { previewSeasonTransition } from './preview';
import type { Evidence, PlannerInput } from './types';

/** Evidence only. Source registration IDs are never canonical clubs or sporting entrants. */
export const SWEDISH_COMPETITION_DATA = data;
export function swedishRuleEvidence(section: string): Evidence {
  const source = data.sources.thb3;
  return { url: source.url, section, seasonId: '2026/27', verifiedOn: source.verifiedOn, documentDate: source.documentDate, verification: 'VERIFIED' };
}

/** Read-only data view of the existing planner, not another transition resolver or gate. */
export function previewSwedishDataCompletion(input: PlannerInput) {
  const preview = previewSeasonTransition(input);
  const boundaryPorts = input.rules.entries.flatMap(entry => {
    if (entry.selector.kind !== 'EXTERNAL') return [];
    const slotId = entry.selector.slotId;
    const district = slotId.split('-')[1];
    const roster = data.division2Registrations.find(r => r.district === district);
    const supplied = input.externalEntrants?.find(e => e.slotId === slotId);
    return [{ slotId, suppliedCanonicalClubId: supplied?.clubId ?? null,
      sourceId: roster?.sourceId ?? null, registeredSourceTeams: roster?.registeredCount ?? 0,
      mappedSourceTeams: roster?.registrations.filter(t => t.canonicalMappingStatus === "RESOLVED_SOURCE_REGISTRATION").length ?? 0,
      // A list of registered clubs establishes neither final rank nor acceptance/licence.
      canInferEntrantFromRegistration: false as const }];
  });
  return { preview, boundaryPorts, requirements: structuredClone(data.requirements), nextSeason: structuredClone(data.nextSeason) };
}
