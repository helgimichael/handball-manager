/** Presentation-only reading of actual defensive-foul whistles; never a restart proxy. */
import type { CoreEvent, TeamId } from '@handball-manager/handball-engine/src/v2/core/state';

export type FreeThrowRead = {
    counts: Record<TeamId, number> | null;
    provenance: 'CANONICAL_WHISTLES' | 'UNAVAILABLE';
    issues: string[];
    eventIds: string[];
    duplicateEvents: number;
    duplicateFouls: number;
};
type Options = { source: 'LIVE' | 'ARCHIVE'; behaviorRevision?: string; complete?: boolean };
// These revisions all retain the explicit assessment/advantage/whistle protocol.
const supportedRevisions = new Set(['career-post-intelligence-reconciled-v1', 'career-empirical-reconciliation-v11', 'career-rotation-fatigue-v1', 'career-physical-load-v11', 'career-court-orientation-v1']);
const protocolTypes = new Set(['FOUL', 'FOUL_ASSESSED', 'WHISTLE_RESTART', 'ADVANTAGE_PENDING', 'ADVANTAGE_REALIZED', 'ADVANTAGE_RECALLED']);
export const isFreeThrowFact = (event: CoreEvent) => protocolTypes.has(event.type);

/**
 * An ordinary defensive free throw is one WHISTLE_RESTART/FREE_THROW, credited
 * to details.owner. Assessments allowed to continue, 7m, administrative free
 * restarts and a horn retake are not additional defensive-foul whistles.
 *
 * A revision marker alone is insufficient: resuming an old session updates it.
 * Unpaired legacy FOUL rows or incomplete/conflicting protocol therefore make
 * the whole count unavailable, rather than presenting a partial count as zero.
 */
export function readOrdinaryFreeThrows(events: readonly CoreEvent[], options: Options): FreeThrowRead {
    const facts = new Map<string, CoreEvent>(), issues: string[] = [];
    let duplicateEvents = 0, duplicateFouls = 0;
    for (const event of events) {
        if (!isFreeThrowFact(event)) continue;
        const previous = facts.get(event.id);
        if (previous) {
            duplicateEvents++;
            if (JSON.stringify(previous) !== JSON.stringify(event)) issues.push(`Conflicting event ${event.id}`);
        } else facts.set(event.id, event);
    }
    const rows = [...facts.values()], assessed = new Map<string, CoreEvent>(), whistles = new Map<string, CoreEvent>();
    const idOf = (event: CoreEvent) => typeof event.details.foulId === 'string' && event.details.foulId ? event.details.foulId : null;
    const resolved = new Set(rows.filter(e => e.type === 'ADVANTAGE_REALIZED' || e.type === 'WHISTLE_RESTART').map(idOf));
    for (const event of rows) {
        const foulId = idOf(event);
        if (!foulId) { issues.push(`Missing foul identity ${event.id}`); continue; }
        if (event.type === 'FOUL_ASSESSED') {
            if (!['WHISTLE_NOW', 'ADVANTAGE_PENDING', 'RECALL_PENDING_ADVANTAGE'].includes(String(event.details.decision))) issues.push(`Legacy assessment ${event.id}`);
            const previous = assessed.get(foulId);
            if (previous && (previous.actorId !== event.actorId || previous.details.decision !== event.details.decision)) issues.push(`Conflicting assessment ${foulId}`);
            assessed.set(foulId, event);
        }
        if (event.type !== 'WHISTLE_RESTART') continue;
        if (!['HOME', 'AWAY'].includes(String(event.details.owner)) || !['FREE_THROW', 'SEVEN_METRE'].includes(String(event.details.kind))) {
            issues.push(`Invalid whistle ${event.id}`); continue;
        }
        const previous = whistles.get(foulId);
        if (previous) {
            duplicateFouls++;
            if (previous.details.owner !== event.details.owner || previous.details.kind !== event.details.kind || previous.actorId !== event.actorId) issues.push(`Conflicting whistle ${foulId}`);
        } else whistles.set(foulId, event);
    }
    for (const event of rows) {
        const foulId = idOf(event);
        if (event.type === 'FOUL' && (!foulId || !assessed.has(foulId))) issues.push(`Unpaired legacy foul ${event.id}`);
        if (event.type !== 'FOUL_ASSESSED' || !foulId) continue;
        if (event.details.decision === 'WHISTLE_NOW' && !whistles.has(foulId)) issues.push(`Missing defensive whistle ${foulId}`);
        if (options.complete && event.details.decision === 'ADVANTAGE_PENDING' && !resolved.has(foulId)) issues.push(`Unresolved advantage ${foulId}`);
        if (event.details.decision === 'RECALL_PENDING_ADVANTAGE' && !rows.some(e => e.type === 'WHISTLE_RESTART' && e.tick === event.tick)) issues.push(`Missing recalled whistle ${foulId}`);
    }
    const knownRevision = supportedRevisions.has(options.behaviorRevision ?? '');
    const liveProtocol = options.source === 'LIVE' && assessed.size > 0;
    if (!knownRevision && !liveProtocol) issues.push('Legacy or unknown event provenance');
    const ordinary = [...whistles.values()].filter(e => e.details.kind === 'FREE_THROW');
    const counts: Record<TeamId, number> = { HOME: 0, AWAY: 0 };
    for (const event of ordinary) counts[event.details.owner as TeamId]++;
    return { counts: issues.length ? null : counts, provenance: issues.length ? 'UNAVAILABLE' : 'CANONICAL_WHISTLES', issues: [...new Set(issues)], eventIds: ordinary.map(e => e.id), duplicateEvents, duplicateFouls };
}
