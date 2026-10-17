/** Developer fixtures only. The normal engine owns all subsequent play. */
import { createContinuous } from './continuous';
import { courtPlayers, getPlayer, type CoreState, type Direction, type TeamId } from './state';
import { coordinate } from './structure';
import { decideHandball } from './intelligence';

export function manpowerScenario(seed: number, homeMissing = 0, awayMissing = 0, direction: Direction = 'TOP'): CoreState {
  const s = createContinuous('CONTINUOUS_PLAY', seed, direction, null);
  s.checkpoint.maxTicks = 6000;
  // Establish a post-administration legal two-minute window, without running
  // a preceding unrelated attack. Sanction creation itself is tested through
  // judgeFoul. No action, geometry, score or execution coefficient is changed.
  for (const [team, missing] of [['HOME', homeMissing], ['AWAY', awayMissing]] as const) {
    if (!Number.isInteger(missing) || missing < 0 || missing > 4) throw Error('Unsupported fixture reduction');
    const ids = courtPlayers(s, team).filter(p => p.kind === 'FIELD_PLAYER' && p.id !== 'H03').slice(0, missing);
    for (const p of ids) { p.population = 'SUSPENDED'; p.sanctions = 1; p.suspensionUntilMs = s.officialClock.timeMs + s.ruleProfile.suspensionMs; }
  }
  return s;
}

export function decisionEnvironment(s: CoreState, id = s.ball.controllerId) {
  if (!id) return null;
  const p = getPlayer(s, id), decision = decideHandball(s, p);
  const { perception, advantage, affordances: options } = decision;
  const field = (team: TeamId) => courtPlayers(s, team).filter(q => q.kind === 'FIELD_PLAYER');
  const own = field(p.team), defending = field(p.team === 'HOME' ? 'AWAY' : 'HOME');
  return {
    playerId: id, attackingTeam: p.team, attackers: perception.space.attackers, defenders: perception.space.defenders,
    receiverIds: perception.receivers.map(r => r.id), passingOptions: options.filter(a => a.motor === 'PASS').length,
    width: own.length ? Math.max(...own.map(a => a.position.x)) - Math.min(...own.map(a => a.position.x)) : 0,
    localAttackers: perception.space.localAttackers, localDefenders: perception.space.localDefenders,
    advantage: advantage.level, numericalAdvantage: advantage.numbers,
    shotQuality: perception.shot?.quality ?? null, openLane: perception.space.open,
    assignments: defending.map(d => ({ id: d.id, zone: d.zone, duty: d.duty.kind, targetId: d.duty.targetId })),
    affordances: options.map(a => ({ name: a.name, value: a.value, targetId: a.targetId })),
  };
}

export function coordinatedEnvironment(s: CoreState) { coordinate(s); return decisionEnvironment(s); }
