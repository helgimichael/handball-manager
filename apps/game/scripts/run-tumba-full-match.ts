import { createNewCareerState } from '@/lib/career/newCareer';
import { snapshotGameplayRatings, snapshotWorldSquads } from '@/lib/gameWorld/serverSnapshot';
import { snapshotAllClubsStaff } from '@/lib/gameWorld/staffIdentitySnapshot';
import { getCareerClubSquad } from '@/lib/career/careerWorld';
import { buildDefaultMatchPlan } from '@/lib/matchPlan/defaultMatchPlan';
import { buildMatchdayReadyEvent } from '@/lib/career/careerEvents';
import { startProductionMatch, advanceProductionMatch, commandProductionMatch } from '@/lib/career/productionMatch';
import { ledger } from '@handball-manager/handball-engine/src/v2/core/ledger';
import type { MatchPlan, CareerState } from '@/lib/career/types';

const competitions = ['se_handbollsligan_herr', 'swe-2', 'se_division1_norra', 'se_division1_sodra'];
const squads = Object.assign({}, ...competitions.map((c) => snapshotWorldSquads(c)));
const ratings = Object.assign({}, ...competitions.map((c) => snapshotGameplayRatings(c)));
const staff = Object.assign({}, ...competitions.map((c) => snapshotAllClubsStaff(c)));

const club = 'swe2-tumba';
let state = createNewCareerState('p04-tumba-deterministic-seed-42', club, squads, undefined, ratings, staff, '4_WEEKS');

const fixture = state.fixtures.find(f => f.homeClubId === club || f.awayClubId === club)!;
const homeClub = fixture.homeClubId;
const awayClub = fixture.awayClubId;

const squad = getCareerClubSquad(state, club);
const lindahl = squad.find(p => p.lastName.includes('Lindahl'))!;
const wettebrandt = squad.find(p => p.lastName.includes('Wettebrandt'))!;

const keepers = squad.filter(p => p.position === 'MV');
const outfield = squad.filter(p => p.position !== 'MV');

const SIX = ['V6', 'V9', 'M9', 'H9', 'H6', 'M6'] as const;
const used = new Set<string>();
used.add(lindahl.id);
used.add(wettebrandt.id);

const sixPlayers = [
  outfield.find(p => p.position === 'V6' && !used.has(p.id)) ?? outfield.find(p => !used.has(p.id))!,
  outfield.find(p => p.position === 'V9' && !used.has(p.id)) ?? outfield.find(p => !used.has(p.id))!,
  lindahl,
  outfield.find(p => p.position === 'H9' && !used.has(p.id)) ?? outfield.find(p => !used.has(p.id))!,
  outfield.find(p => p.position === 'H6' && !used.has(p.id)) ?? outfield.find(p => !used.has(p.id))!,
  outfield.find(p => p.position === 'M6' && !used.has(p.id)) ?? outfield.find(p => !used.has(p.id))!,
];
sixPlayers.forEach(p => used.add(p.id));

const benchPlayers = [wettebrandt, ...outfield.filter(p => !used.has(p.id)).slice(0, 6)];

const registeredSquad = [
  { playerId: keepers[0].id, position: 'GK' as const },
  ...sixPlayers.map((p, i) => ({ playerId: p.id, position: SIX[i] })),
  ...benchPlayers.map(p => ({ playerId: p.id, position: p.position as typeof SIX[number] })),
  ...(keepers[1] ? [{ playerId: keepers[1].id, position: 'GK' as const }] : []),
];

const base = buildDefaultMatchPlan({ fixtureId: fixture.id, clubId: club, players: registeredSquad }).plan!;

const plan: MatchPlan = {
  ...base,
  substitutionPairs: [{ attackPlayerId: lindahl.id, defencePlayerId: wettebrandt.id }],
  transitionPlan: { ...base.transitionPlan, assistantRotation: true },
};

let readyState: CareerState = {
  ...state,
  gameDate: fixture.date,
  careerEvents: [buildMatchdayReadyEvent(fixture.id, fixture.date)],
  matchPlans: { ...state.matchPlans, [fixture.id]: plan },
};

readyState = startProductionMatch(readyState, fixture.id);
let session = readyState.productionMatch!;

// Tracking player minutes by attack and defence ticks
const playerAttTicks: Record<string, number> = {};
const playerDefTicks: Record<string, number> = {};
let dualPresenceTicks = 0;
const numericalStates: Record<string, number> = {};

const observer = (core: Readonly<import('@handball-manager/handball-engine/src/v2/core/state').CoreState>) => {
  const court = core.players.filter(p => p.population === 'COURT');
  const homeCourt = court.filter(p => p.team === 'HOME');
  const awayCourt = court.filter(p => p.team === 'AWAY');
  const numKey = `${homeCourt.length}v${awayCourt.length}`;
  numericalStates[numKey] = (numericalStates[numKey] ?? 0) + 1;

  const lindahlOn = court.some(p => p.id === lindahl.id);
  const wetteOn = court.some(p => p.id === wettebrandt.id);
  if (lindahlOn && wetteOn) dualPresenceTicks++;

  const possTeam = core.possession.team;
  for (const p of court) {
    if (p.team === possTeam) {
      playerAttTicks[p.id] = (playerAttTicks[p.id] ?? 0) + 1;
    } else {
      playerDefTicks[p.id] = (playerDefTicks[p.id] ?? 0) + 1;
    }
  }
};

while (session.core.status === 'RUNNING') {
  if (session.pausedAtHalf) {
    readyState = commandProductionMatch(readyState, { kind: 'SECOND_HALF' });
    session = readyState.productionMatch!;
  }
  readyState = advanceProductionMatch(readyState, 1000, false, observer);
  session = readyState.productionMatch!;
}

const c = session.core;
const l = ledger(c);

console.log('=== MATCH RESULT ===');
console.log(`Fixture: ${homeClub} vs ${awayClub}`);
console.log(`Final Score: HOME ${c.score.HOME} – ${c.score.AWAY} AWAY`);
console.log(`Final Status: ${c.status}, Period: ${c.period}, Total Ticks: ${c.tick}`);

console.log('\n=== POSSESSION & ENDINGS (BOTH TEAMS) ===');
console.log(`Total Possessions: ${l.possessions}`);
console.log(`Total Attacks: ${l.attacks}`);
console.log('Endings breakdown:');
for (const [k, v] of Object.entries(l.endings)) {
  console.log(`  - ${k}: ${v}`);
}

console.log('\n=== SHOTS, GOALS & TURNOVERS (BOTH TEAMS) ===');
const homeShots = c.events.filter(e => e.type === 'SHOT_RELEASED' && e.actorId && c.players.find(p => p.id === e.actorId)?.team === 'HOME');
const awayShots = c.events.filter(e => e.type === 'SHOT_RELEASED' && e.actorId && c.players.find(p => p.id === e.actorId)?.team === 'AWAY');
const homeGoals = c.score.HOME;
const awayGoals = c.score.AWAY;
const turnovers = c.events.filter(e => ['TECHNICAL_VIOLATION', 'OFFENSIVE_FOUL', 'PASSIVE_PLAY', 'INTERCEPTION'].includes(e.type));
const homeTurnovers = turnovers.filter(e => e.actorId && c.players.find(p => p.id === e.actorId)?.team === 'HOME');
const awayTurnovers = turnovers.filter(e => e.actorId && c.players.find(p => p.id === e.actorId)?.team === 'AWAY');

console.log(`HOME: Shots: ${homeShots.length}, Goals: ${homeGoals}, Turnovers: ${homeTurnovers.length}`);
console.log(`AWAY: Shots: ${awayShots.length}, Goals: ${awayGoals}, Turnovers: ${awayTurnovers.length}`);
console.log(`Combined Shots: ${homeShots.length + awayShots.length} (target > 80, original defect: < 60)`);

console.log('\n=== SPECIALIST PAIR MINUTES (LINDAHL / WETTEBRANDT) ===');
const lindahlAttMin = ((playerAttTicks[lindahl.id] ?? 0) * 0.05 / 60).toFixed(2);
const lindahlDefMin = ((playerDefTicks[lindahl.id] ?? 0) * 0.05 / 60).toFixed(2);
const wetteAttMin = ((playerAttTicks[wettebrandt.id] ?? 0) * 0.05 / 60).toFixed(2);
const wetteDefMin = ((playerDefTicks[wettebrandt.id] ?? 0) * 0.05 / 60).toFixed(2);
const dualMin = (dualPresenceTicks * 0.05 / 60).toFixed(2);

console.log(`Lindahl (Attack specialist): Attack: ${lindahlAttMin} min, Defence: ${lindahlDefMin} min`);
console.log(`Wettebrandt (Defence specialist): Attack: ${wetteAttMin} min, Defence: ${wetteDefMin} min`);
console.log(`Dual on-court coexistence: ${dualMin} min (Target: 0.00 min, original defect: ~32 min)`);

console.log('\n=== PLAYER MINUTES BY ATTACK & DEFENCE (HOME & AWAY) ===');
for (const teamId of ['HOME', 'AWAY'] as const) {
  console.log(`-- ${teamId} SQUAD --`);
  const tPlayers = c.players.filter(p => p.team === teamId);
  for (const p of tPlayers) {
    const person = session.people.find(x => x.id === p.id);
    const name = person ? `${person.name} (#${person.number})` : p.id;
    const attM = (((playerAttTicks[p.id] ?? 0) * 0.05) / 60).toFixed(2);
    const defM = (((playerDefTicks[p.id] ?? 0) * 0.05) / 60).toFixed(2);
    const totM = (p.condition.courtMs / 60000).toFixed(2);
    console.log(`  ${name.padEnd(25)} | Att: ${attM.padStart(5)}m | Def: ${defM.padStart(5)}m | Total: ${totM.padStart(5)}m`);
  }
}

console.log('\n=== EXCHANGES ===');
const completedExchanges = c.exchanges.filter(e => e.phase === 'COMPLETED');
console.log(`Total completed exchanges: ${completedExchanges.length}`);
const homeExchanges = completedExchanges.filter(e => e.team === 'HOME');
const awayExchanges = completedExchanges.filter(e => e.team === 'AWAY');
console.log(`  HOME exchanges: ${homeExchanges.length}`);
console.log(`  AWAY exchanges: ${awayExchanges.length}`);
const pairExchanges = completedExchanges.filter(e => e.inId === lindahl.id || e.inId === wettebrandt.id);
console.log(`  Lindahl/Wettebrandt exchanges: ${pairExchanges.length}`);

console.log('\n=== SUSPENSIONS & NUMERICAL STATES ===');
const suspensions = c.events.filter(e => e.type === 'TWO_MINUTE_SUSPENSION');
console.log(`Total 2-minute suspensions: ${suspensions.length}`);
for (const s of suspensions) {
  const p = c.players.find(x => x.id === s.actorId);
  const person = session.people.find(x => x.id === s.actorId);
  console.log(`  - Min ${Math.floor(s.officialMs / 60000)}: ${p?.team} #${person?.number ?? ''} ${person?.name ?? s.actorId} (${s.details.reason ?? 'Foul'})`);
}
console.log('Numerical states distribution (ticks):');
for (const [k, v] of Object.entries(numericalStates)) {
  const mins = (v * 0.05 / 60).toFixed(2);
  console.log(`  - ${k}: ${v} ticks (${mins} min)`);
}

console.log('\n=== TIMEOUT EVENTS ===');
const timeoutEvents = c.events.filter(e => e.type === 'TEAM_TIMEOUT_STARTED');
console.log(`Total timeouts called: ${timeoutEvents.length}`);
for (const t of timeoutEvents) {
  console.log(`  - Team: ${t.details.team}, Period: ${t.details.period}, Minute: ${Math.floor(t.officialMs / 60000)}`);
}

console.log('\n=== DEFECT RECURRENCE CHECK ===');
const passShots = (homeShots.length + awayShots.length) >= 80;
const passPair = parseFloat(dualMin) === 0.00;
const passLindahl = parseFloat(lindahlAttMin) > 20 && parseFloat(lindahlDefMin) < 8;
const passWette = parseFloat(wetteDefMin) > 20 && parseFloat(wetteAttMin) < 8;
console.log(`1. Shot count >= 80: ${passShots ? 'PASS' : 'FAIL'} (${homeShots.length + awayShots.length} shots)`);
console.log(`2. Specialist dual presence == 0.00m: ${passPair ? 'PASS' : 'FAIL'} (${dualMin} min)`);
console.log(`3. Lindahl predominantly attacking: ${passLindahl ? 'PASS' : 'FAIL'} (${lindahlAttMin}m att / ${lindahlDefMin}m def)`);
console.log(`4. Wettebrandt predominantly defending: ${passWette ? 'PASS' : 'FAIL'} (${wetteDefMin}m def / ${wetteAttMin}m att)`);
console.log(`OVERALL FULL-MATCH INTEGRITY: ${passShots && passPair && passLindahl && passWette ? 'PASS' : 'FAIL'}`);
