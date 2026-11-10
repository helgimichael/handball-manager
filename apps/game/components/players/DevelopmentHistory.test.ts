import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DevelopmentHistory } from './DevelopmentHistory';
import { getAttributeLabel } from '../../lib/rating/attributeVocabulary';
import type { PlayerDevelopmentEvent } from '../../lib/development/types';

test('Olle Söderqvist history renders Swedish goalkeeper labels without changing events or hiding repeated improvements', () => {
  const keys = ['DECISION_TIMING', 'PATIENCE', 'SHOT_ANTICIPATION', 'SHOOTER_READING', 'DECISION_TIMING'] as const;
  const events = keys.map((attribute, i) => ({ attribute, date: `2027-04-${11+i}`, previousValue: 12+i, newValue: 13+i, sourceSummary: 'Training and match development stimulus' })) satisfies PlayerDevelopmentEvent[];
  const before = JSON.stringify(events);
  const html = renderToStaticMarkup(createElement(DevelopmentHistory, { events }));
  for (const key of keys) { assert.ok(!html.includes(key)); assert.ok(html.includes(getAttributeLabel(key))); }
  assert.equal((html.match(/Beslutstiming/g) ?? []).length, 2);
  for (const event of events) { assert.ok(html.includes(event.date)); assert.ok(html.includes(`${event.previousValue} → ${event.newValue}`)); }
  assert.equal(JSON.stringify(events), before);
});

test('unknown saved attribute keys have a readable fallback', () => {
  assert.equal(getAttributeLabel('FUTURE_KEEPER_SKILL'), 'Future keeper skill');
  assert.equal(getAttributeLabel(''), 'Okänd egenskap');
  assert.equal(getAttributeLabel('futureKeeperSkill'), 'Future keeper skill');
  const event = { attribute: 'FUTURE_KEEPER_SKILL', date: '2027-04-11', previousValue: 4, newValue: 5 } as unknown as PlayerDevelopmentEvent;
  const html = renderToStaticMarkup(createElement(DevelopmentHistory, { events: [event] }));
  assert.ok(html.includes('Future keeper skill')); assert.ok(!html.includes('FUTURE_KEEPER_SKILL'));
});
