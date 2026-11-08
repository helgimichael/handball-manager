import type { CareerFixture, CareerState } from '../career/types';
import { getCareerClubSquad } from '../career/careerWorld';
import { addDays, daysBetween } from '../career/dateUtils';
import type { SquadStatusTier } from '../career/squadStatus';
import type { PlayerPhaseUsage } from '../matchPlan/types';
import { ageOf, dynamicsOf, managerSquadIds, tierOf } from './dynamicsState';
import type { PlayingTimeMatch } from './types';

export const PLAYING_TIME_WINDOW_DAYS = 42;
export const PLAYING_TIME_MIN_MATCHES = 4;
export const PLAYING_TIME_MIN_SPAN_DAYS = 14;
/** Game balancing expectations, not researched facts or contract promises. Fractions of a normal 60-minute game. */
const COURT_SHARE: Record<SquadStatusTier,number> = { KEY_PLAYER:.7,FIRST_CHOICE:.55,ROTATION:.3,SQUAD_PLAYER:.15,TALENT:.15 };

export function availableForPlayingTime(state: CareerState, playerId: string): boolean {
  return (state.playerStatuses[playerId]?.availability ?? 'AVAILABLE') === 'AVAILABLE' && !state.playerInjuries?.[playerId]?.activeInjury;
}

export function expectedCourtMinutes(tier: SquadStatusTier, phase: PlayerPhaseUsage, age: number | null): number {
  const share = tier === 'TALENT' ? age !== null && age < 19 ? .1 : age !== null && age > 21 ? .2 : .15 : COURT_SHARE[tier];
  const specialist = phase === 'DEFENCE_ONLY' || phase === 'ATTACK_ONLY' ? .5 : phase === 'DEFENCE_PREFERRED' || phase === 'ATTACK_PREFERRED' ? .75 : 1;
  return 60 * share * specialist;
}

function phaseFor(state: CareerState, fixtureId: string, playerId: string): PlayerPhaseUsage {
  const plan = state.liveMatchPlans[fixtureId] ?? state.matchPlans[fixtureId] ?? state.preferredLineup;
  if (plan?.clubId === state.playerClubId) {
    if (plan.substitutionPairs.some(p => p.defencePlayerId === playerId)) return 'DEFENCE_ONLY';
    if (plan.substitutionPairs.some(p => p.attackPlayerId === playerId)) return 'ATTACK_ONLY';
    const usage = plan.playerUsage.find(p => p.playerId === playerId);
    if (usage) return usage.phaseUsage;
  }
  return state.playerMatchDefaults[playerId]?.phaseUsage ?? 'BOTH_PHASES';
}

/** Record actual match participation and all available non-selected players at the same commit boundary.
 * Original selectionState captures availability before the match's post-match injury processing.
 * Missing historical samples never mean that a player was benched.
 */
export function recordPlayingTimeMatch(state: CareerState, fixture: CareerFixture, minutes: ReadonlyMap<string,number>, source: PlayingTimeMatch['source'], selectionState: CareerState = state, unavailableInMatch: ReadonlySet<string> = new Set()): CareerState {
  if (fixture.date < addDays(state.gameDate,-(PLAYING_TIME_WINDOW_DAYS-1)) || fixture.date > state.gameDate) return state;
  const result = state.results[fixture.id];
  if (fixture.type === 'FRIENDLY' || ![fixture.homeClubId,fixture.awayClubId].includes(state.playerClubId) || !result || result.fixtureId !== fixture.id || result.homeClubId !== fixture.homeClubId || result.awayClubId !== fixture.awayClubId) return state;
  const d = dynamicsOf(state);
  if (d.playingTime?.[fixture.id]) return state;
  if ([...minutes.values()].some(n => !Number.isFinite(n) || n < 0)) throw new Error('Invalid recorded court minutes.');
  const players: PlayingTimeMatch['players'] = {};
  for (const playerId of managerSquadIds(selectionState)) {
    const tier = tierOf(selectionState,playerId), phase = phaseFor(selectionState,fixture.id,playerId);
    const available = availableForPlayingTime(selectionState,playerId) && !unavailableInMatch.has(playerId);
    players[playerId] = { tier,phase,available,expectedMinutes:available ? expectedCourtMinutes(tier,phase,ageOf({...selectionState,gameDate:fixture.date},playerId)) : 0,courtMinutes:Math.min(60,minutes.get(playerId) ?? 0) };
  }
  const sample: PlayingTimeMatch = {fixtureId:fixture.id,seasonId:state.seasonId,clubId:state.playerClubId,date:fixture.date,source,players};
  const cutoff = addDays(state.gameDate,-(PLAYING_TIME_WINDOW_DAYS-1));
  const playingTime = Object.fromEntries(Object.entries(d.playingTime ?? {}).filter(([,m]) => m.date >= cutoff));
  return {...state,playerDynamics:{...d,playingTime:{...playingTime,[fixture.id]:sample}}};
}

export type PlayingTimeAssessment = {
  status:'UNAVAILABLE'|'WARMUP'|'UNMET'|'MET'|'EXCEEDED';
  eligibleMatches:number;
  courtMinutes:number;
  expectedMinutes:number;
  lastFixtureId?:string;
  specialist:boolean;
  explanation:string;
};

export function assessPlayingTime(state: CareerState, playerId: string, date = state.gameDate): PlayingTimeAssessment {
  const own = getCareerClubSquad(state,state.playerClubId).some(p => p.id === playerId) && state.playerContracts[playerId]?.clubId === state.playerClubId;
  const cutoff = addDays(date,-(PLAYING_TIME_WINDOW_DAYS-1));
  const samples = Object.values(dynamicsOf(state).playingTime ?? {}).filter(m => m.clubId === state.playerClubId && m.seasonId === state.seasonId && m.date >= cutoff && m.date <= date && m.players[playerId]?.available).sort((a,b) => a.date.localeCompare(b.date) || a.fixtureId.localeCompare(b.fixtureId));
  const courtMinutes = samples.reduce((s,m) => s+m.players[playerId]!.courtMinutes,0);
  const expectedMinutes = samples.reduce((s,m) => s+m.players[playerId]!.expectedMinutes,0);
  const specialist = samples.some(m => m.players[playerId]!.phase !== 'BOTH_PHASES');
  const base = {eligibleMatches:samples.length,courtMinutes,expectedMinutes,lastFixtureId:samples.at(-1)?.fixtureId,specialist};
  if (!own || !availableForPlayingTime(state,playerId)) return {...base,status:'UNAVAILABLE',explanation:'Ej fullt tillgänglig: ingen speltidsförväntan eller bestraffning nu.'};
  if (samples.length < PLAYING_TIME_MIN_MATCHES || daysBetween(samples[0]!.date,samples.at(-1)!.date) < PLAYING_TIME_MIN_SPAN_DAYS) return {...base,status:'WARMUP',explanation:'För få dokumenterade, tillgängliga matcher över tid för att bedöma speltiden.'};
  const ratio = expectedMinutes > 0 ? courtMinutes/expectedMinutes : 1;
  const status = ratio < .75 ? 'UNMET' : ratio > 1.25 ? 'EXCEEDED' : 'MET';
  return {...base,status,explanation:`${Math.round(courtMinutes)} minuter på plan i ${samples.length} tillgängliga matcher under de senaste sex veckorna; rollernas riktmärke ${Math.round(expectedMinutes)} minuter${specialist ? ', anpassat för specialistuppdrag' : ''}. Skada, avstängning och annan frånvaro räknas inte som bänkning.`};
}

/** A sale, loan or release ends the old club's actionable discussion without erasing its history. */
export function closePlayingTimeConcerns(state: CareerState, playerId: string): CareerState {
  const d = state.playerDynamics;
  if (!d) return state;
  const open = Object.values(d.concerns).filter(c => c.playerId === playerId && c.kind === 'PLAYING_TIME' && c.status === 'OPEN');
  if (!open.length && !d.morale[playerId]?.playingTimeLastFixtureId) return state;
  const ids = new Set(open.map(c => c.id)), eventIds = new Set(open.map(c => `PLAYER_DYNAMICS:concern:${c.id}`));
  const concerns = Object.fromEntries(Object.entries(d.concerns).map(([id,c]) => [id,ids.has(id) ? {...c,status:'LAPSED' as const,outcome:'Spelaren representerar inte längre klubben; speltidssamtalet avslutas.'} : c]));
  const prev = d.morale[playerId];
  const morale = prev ? {...d.morale,[playerId]:{...prev,playingTimeUnmetWeeks:0,playingTimeLastFixtureId:undefined}} : d.morale;
  return {...state,playerDynamics:{...d,concerns,morale},careerEvents:state.careerEvents.map(e => eventIds.has(e.id) ? {...e,resolved:true,requiresAction:false} : e),inbox:state.inbox.map(m => m.careerEventId && eventIds.has(m.careerEventId) ? {...m,resolved:true,actionRequired:false} : m)};
}
