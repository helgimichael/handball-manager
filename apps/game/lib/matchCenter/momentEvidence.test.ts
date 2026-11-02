// HM-PLAYTEST-01 7.2: the narrative and the pictures come from the same events.
import test from 'node:test';
import assert from 'node:assert/strict';
import { momentEvidence, snapshotsFor, MOMENT_EVIDENCE_TICKS } from './model';
import { tacticalStory } from './workspace';
import type { CoreEvent } from '@handball-manager/handball-engine/src/v2/core/state';
import type { MatchPerson, MatchFrame } from '../career/productionMatch';

const ev = (id: string, type: string, tick: number, actorId: string, relatedIds: string[] = [], extra: Partial<CoreEvent> = {}) => ({ id, type, tick, officialMs: tick * 50, possessionId: 'p1', actionId: 'a1', actorId, relatedIds, details: {}, ...extra }) as unknown as CoreEvent;
const people: MatchPerson[] = [
  { id: 'att', name: 'Anna Anfall', number: 9, team: 'HOME', role: 'CB', started: true, startEnergy: 100 },
  { id: 'def', name: 'Dora Försvar', number: 3, team: 'AWAY', role: 'CB', started: true, startEnergy: 100 },
  { id: 'gk', name: 'Gus Målvakt', number: 1, team: 'AWAY', role: 'GK', started: true, startEnergy: 100 },
] as MatchPerson[];
const frames: MatchFrame[] = Array.from({ length: 700 }, (_, t) => [t, t * 50, 1, 0, 0, 1000, 2000, 0, 1000, 2000, 1, 1100, 2100, 2, 1000, 3800]);

test('an event outside the shared window is never narrated', () => {
  const old = ev('b1', 'DEFENDER_BEATEN', 500 - MOMENT_EVIDENCE_TICKS - 30, 'att', ['def']);
  const shot = ev('s1', 'SHOT_RELEASED', 500, 'att');
  const save = ev('v1', 'SAVE_CAUGHT', 505, 'gk');
  const events = [old, shot, save];
  assert.equal(momentEvidence(save, events, () => true).beaten, undefined);
  const story = tacticalStory({ canonicalEventId: 'v1', detail: 'Räddning.' } as never, events, people, snapshotsFor('v1', events, frames, people));
  assert.doesNotMatch(story.explanation, /slår sin försvarare/);
});

test('an event the narrative cites has its own court picture', () => {
  const beaten = ev('b2', 'DEFENDER_BEATEN', 440, 'att', ['def']);
  const shot = ev('s2', 'SHOT_RELEASED', 500, 'att');
  const save = ev('v2', 'SAVE_CAUGHT', 505, 'gk');
  const events = [beaten, shot, save];
  const snaps = snapshotsFor('v2', events, frames, people);
  const story = tacticalStory({ canonicalEventId: 'v2', detail: 'Räddning.' } as never, events, people, snaps);
  assert.match(story.explanation, /Anna Anfall slår sin försvarare, Dora Försvar/);
  assert.ok(snaps.some(s => s.tick === 440), 'a snapshot at the cited moment');
  assert.equal(story.stages[snaps.findIndex(s => s.tick === 440)], 'Försvararen passeras');
});
