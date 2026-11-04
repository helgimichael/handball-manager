// HM-PLAYTEST-01 WS2: the handball match plan is not decorative. Pairs,
// defensive spaces, situational units and the 7-metre order are all read by
// the live match and observed here in a real career fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from './newCareer';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../gameWorld/serverSnapshot';
import { buildMatchdayReadyEvent } from './careerEvents';
import { startProductionMatch, advanceProductionMatch, commandProductionMatch, finalizeProductionMatch } from './productionMatch';
import { getCareerClubSquad } from './careerWorld';
import { buildDefaultMatchPlan } from '../matchPlan/defaultMatchPlan';
import { engineTeamMatchPlan } from '../matchPlan/engineMatchPlan';
import { setCaptaincy, setPenaltyTakers, currentTeamRoles } from './teamRoles';
import { unitSituation } from '@handball-manager/handball-engine/src/v2/core/matchPlanDirectives';
import type { CoreState } from '@handball-manager/handball-engine/src/v2/core/state';
import type { CareerState } from './types';
import type { MatchPlan } from '../matchPlan/types';

const SIX = ['V6', 'V9', 'M9', 'H9', 'H6', 'M6'] as const;

function setup(fixtureId: string) {
  let state = createNewCareerState('playable-product-2026', 'swe2-tumba', snapshotWorldSquads('swe-2'), undefined, snapshotGameplayRatings('swe-2'));
  const club = Object.keys(state.worldSquads).find(id => id.toLowerCase().includes('tumba'))!;
  state = { ...state, playerClubId: club };
  const fixture = state.fixtures.find(f => f.id === fixtureId && (f.homeClubId === club || f.awayClubId === club)) ?? state.fixtures.find(f => f.homeClubId === club || f.awayClubId === club)!;
  const squad = getCareerClubSquad(state, club);
  const keepers = squad.filter(p => p.position === 'MV');
  const outfield = squad.filter(p => p.position !== 'MV');
  const used = new Set<string>();
  const pick = (pos: string) => { const p = outfield.find(x => x.position === pos && !used.has(x.id)) ?? outfield.find(x => !used.has(x.id))!; used.add(p.id); return p; };
  const six = SIX.map(pick);
  const bench = outfield.filter(p => !used.has(p.id)).slice(0, 7);
  const players = [{ playerId: keepers[0].id, position: 'GK' as const }, ...SIX.map((position, i) => ({ playerId: six[i].id, position })), ...bench.map(p => ({ playerId: p.id, position: p.position as typeof SIX[number] })), ...(keepers[1] ? [{ playerId: keepers[1].id, position: 'GK' as const }] : [])];
  const base = buildDefaultMatchPlan({ fixtureId: fixture.id, clubId: club, players }).plan!;
  // Pivot attacks, a bench specialist defends in his place; the line is rearranged.
  const pivot = six[5].id, specialist = bench[0].id;
  const plan: MatchPlan = {
    ...base,
    substitutionPairs: [{ attackPlayerId: pivot, defencePlayerId: specialist }],
    defenceAssignments: { '6-0': Object.fromEntries(six.map((p, i) => [p.id, [2, 1, 0, 5, 4, 3][i]])) },
    situationUnits: {
      ATTACK_6V5: [...six.slice(0, 5).map((p, i) => ({ playerId: p.id, position: SIX[i] })), { playerId: bench[1].id, position: 'M6' as const }],
      DEFENCE_5V6: [specialist, ...six.slice(0, 4).map(p => p.id)].map((playerId, i) => ({ playerId, zone: [2, 1, 3, 4, 0][i] })),
    },
    transitionPlan: { ...base.transitionPlan, assistantRotation: false },
  };
  let ready: CareerState = { ...state, gameDate: fixture.date, careerEvents: [buildMatchdayReadyEvent(fixture.id, fixture.date)], matchPlans: { ...state.matchPlans, [fixture.id]: plan } };
  // The planned 7-metre taker is deliberately NOT the centre back the engine would pick by default.
  ready = setPenaltyTakers(ready, [six[0].id, six[4].id]);
  return { ready, fixture, plan, six, bench, pivot, specialist, team: (fixture.homeClubId === club ? 'HOME' : 'AWAY') as 'HOME' | 'AWAY' };
}

test('engine plan only names registered matchday players', () => {
  const { plan, ready } = setup('swe-2-f5');
  const engine = engineTeamMatchPlan(plan, currentTeamRoles(ready))!;
  const squad = new Set(plan.squad.players.map(p => p.playerId));
  const ids = [...(engine.pairs ?? []).flatMap(p => [p.attackId, p.defenceId]), ...Object.keys(engine.defenceZones ?? {}), ...(engine.penaltyTakers ?? []), ...Object.values(engine.units ?? {}).flatMap(u => u!.map(e => e.playerId))];
  assert.ok(ids.length > 10);
  for (const id of ids) assert.ok(squad.has(id), id);
  const stranger = engineTeamMatchPlan({ ...plan, substitutionPairs: [{ attackPlayerId: plan.attackStartingUnit.slots[1].playerId, defencePlayerId: 'not-selected' }] }, { penaltyTakers: ['not-selected'] })!;
  assert.equal(stranger.pairs, undefined, 'a pair with an unselected player never reaches the engine');
  assert.equal(stranger.penaltyTakers, undefined);
});

test('a real match follows the attack/defence pair, the defensive spaces, the situational units and the 7-metre order', () => {
  const { ready, fixture, six, pivot, specialist, team, plan } = setup('swe-2-f5');
  let state = startProductionMatch(ready, fixture.id);
  assert.ok(state.productionMatch!.core.coaching[team].plan, 'the plan reached kickoff');
  const squad = new Set(plan.squad.players.map(p => p.playerId));
  const planned = Object.fromEntries(six.map((p, i) => [p.id, [2, 1, 0, 5, 4, 3][i]]));
  planned[specialist] = planned[pivot];
  let defendingTicks = 0, zoneMatches = 0, zoneChecks = 0, specialistDefending = 0, pivotAttacking = 0, attackingTicks = 0;
  let sevens = 0, sevensByPlan = 0, unitTicks = 0, unitComplete = 0;
  const observe = (core: Readonly<CoreState>, events: readonly { type: string; actorId: string | null; details: Record<string, unknown> }[]) => {
    const own = core.players.filter(p => p.team === team);
    for (const p of own) assert.ok(squad.has(p.id), 'only registered players');
    const court = own.filter(p => p.population === 'COURT');
    const situation = unitSituation(core as CoreState, team);
    if (situation === 'ATTACK_6V5') { unitTicks++; if (plan.situationUnits!.ATTACK_6V5!.every(e => court.some(p => p.id === e.playerId))) unitComplete++; }
    if (!situation && core.ball.live && court.length === 7) {
      if (core.possession.team === team) { attackingTicks++; if (court.some(p => p.id === pivot)) pivotAttacking++; }
      else {
        defendingTicks++;
        if (court.some(p => p.id === specialist)) specialistDefending++;
        for (const d of court) if (d.kind === 'FIELD_PLAYER' && d.zone !== null && planned[d.id] !== undefined) { zoneChecks++; if (d.zone === planned[d.id]) zoneMatches++; }
      }
    }
    for (const e of events) if (e.type === 'SHOT_RELEASED' && e.details.shotKind === 'SEVEN_METRE' && own.some(p => p.id === e.actorId)) {
      sevens++;
      const primary = court.find(p => p.id === six[0].id), backup = court.find(p => p.id === six[4].id);
      if (e.actorId === six[0].id || (!primary && e.actorId === six[4].id) || (!primary && !backup)) sevensByPlan++;
    }
  };
  for (let i = 0; i < 400 && state.productionMatch?.core.status === 'RUNNING'; i++) {
    if (state.productionMatch.pausedAtHalf) state = commandProductionMatch(state, { kind: 'SECOND_HALF' });
    state = advanceProductionMatch(state, 1000, false, observe as never);
  }
  const done = finalizeProductionMatch(state);
  assert.ok(done.results[fixture.id]);
  const pairExchanges = done.matchArchives![fixture.id].events.filter(e => e.type === 'EXCHANGE_COMPLETED' && e.actorId === specialist).length;
  assert.ok(pairExchanges >= 5, `the defensive specialist came on repeatedly (${pairExchanges})`);
  assert.ok(specialistDefending / defendingTicks > 0.6, `specialist defends most of the time (${specialistDefending}/${defendingTicks})`);
  assert.ok(pivotAttacking / attackingTicks > 0.6, `the pivot attacks most of the time (${pivotAttacking}/${attackingTicks})`);
  assert.ok(zoneChecks > 1000 && zoneMatches / zoneChecks > 0.75, `planned defensive spaces held (${zoneMatches}/${zoneChecks})`);
  assert.ok(sevens > 0, 'the fixture has 7-metres for us');
  assert.equal(sevensByPlan, sevens, 'every 7-metre follows the planned order');
  if (unitTicks > 200) assert.ok(unitComplete / unitTicks > 0.4, `6v5 unit reached the court (${unitComplete}/${unitTicks})`);
});

test('captaincy persists, never doubles up, and is a modest morale effect', () => {
  const { ready, six } = setup('swe-2-f5');
  let s = setCaptaincy(ready, 'CAPTAIN', six[2].id);
  s = setCaptaincy(s, 'VICE', six[2].id);
  assert.equal(currentTeamRoles(s).captainId, undefined, 'one player cannot hold both armbands');
  assert.equal(currentTeamRoles(s).viceCaptainId, six[2].id);
  s = setCaptaincy(s, 'CAPTAIN', six[1].id);
  const roundTrip = JSON.parse(JSON.stringify(s)) as CareerState;
  assert.equal(currentTeamRoles(roundTrip).captainId, six[1].id, 'saved with the career');
  const morale = roundTrip.playerDynamics?.morale?.[six[1].id];
  assert.ok(morale && morale.shocks?.some(x => x.label === 'Utsedd till lagkapten'));
});
