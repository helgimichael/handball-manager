// HM-PLAYTEST-01 1.4: an injured player reads as unavailable even when fully rested.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlayerConditionPanel } from './PlayerCondition';
import { createNewCareerState } from '../../lib/career/newCareer';
import { getCareerSquad } from '../../lib/career/careerWorld';

test('injured but rested: status, consequence, injury, rehab, return date, energy and match fitness are all separate', () => {
  const base = createNewCareerState('injury-ui-2026', 'swe2-tumba');
  const p = getCareerSquad(base)[0];
  const state = {
    ...base,
    playerStatuses: { ...base.playerStatuses, [p.id]: { playerId: p.id, availability: 'INJURED' as const, returnDate: '2026-09-20' } },
    playerPhysicalState: { ...base.playerPhysicalState, [p.id]: { playerId: p.id, currentEnergy: 98, lastUpdatedDate: base.gameDate, recentLoad: 0 } as never },
    playerInjuries: { ...base.playerInjuries, [p.id]: { playerId: p.id, injuryHistory: [], activeInjury: { injuryId: 'i1', injuryType: 'ANKLE_SPRAIN', bodyArea: 'ANKLE', mechanism: 'CONTACT', severity: 'MODERATE', occurredDate: base.gameDate, source: 'MATCH', expectedReturnDate: '2026-09-20', expectedDurationDays: 21, currentPhase: 'REHAB', rehabProgress: 0.4, recurrenceRiskMultiplier: 1, lastRehabProcessedDate: null } } },
  };
  const html = renderToStaticMarkup(createElement(PlayerConditionPanel, { career: state as never, player: p }));
  for (const text of ['Skadad', 'Kan inte tas ut till match', 'Fotledsstukning', 'Rehabilitering', '40% av beräknad tid', '2026-09-20', 'Energi', '98%', 'Matchträning', 'Utvilad men skadad']) assert.ok(html.includes(text), text);
});
