import { getAttributeLabel } from '@/lib/rating/attributeVocabulary';
import type { PlayerDevelopmentEvent } from '@/lib/development/types';

/** Display only: keep every supplied event, including repeated changes to the same attribute. */
export function DevelopmentHistory({ events }: { events: readonly PlayerDevelopmentEvent[] }) {
  return <>{events.map((event, index) => (
    <div key={`${event.date}:${index}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--hm-text-2xs)' }}>
      <span className="hm-text-muted">{getAttributeLabel(event.attribute)} ({event.date})</span>
      <span style={{ fontWeight: 600 }}>{event.previousValue} → {event.newValue}</span>
    </div>
  ))}</>;
}
