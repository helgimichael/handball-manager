import type { CareerFixture, CareerState } from '../career/types';
import { getCareerClubSquad } from '../career/careerWorld';
import { addDays, daysBetween } from '../career/dateUtils';
import { SQUAD_STATUS_TIER_LABEL_SV, type SquadStatusTier } from '../career/squadStatus';
import type { PlayerPhaseUsage } from '../matchPlan/types';
import { ageOf, dynamicsOf, managerSquadIds, tierOf } from './dynamicsState';
import type { DevelopmentLedgerEntry, PlayingTimeMatch } from './types';

export const PLAYING_TIME_WINDOW_DAYS = 42;
export const PLAYING_TIME_MIN_MATCHES = 4;
export const PLAYING_TIME_MIN_SPAN_DAYS = 14;
/** SQUAD-ROLE-MINUTES: the rolling judgement uses at most this many of the most recent matches the player was available for. */
export const PLAYING_TIME_WINDOW_MATCHES = 10;
/** Game balancing expectations, not researched facts or contract promises. Fractions of a normal 60-minute game.
 * This is the role's REFERENCE level (what "in line with the role" looks like); whether a role GUARANTEES
 * minutes is decided by ROLE_MINUTES_PROFILE below. Never shown to the manager as a number. */
const COURT_SHARE: Record<SquadStatusTier,number> = { KEY_PLAYER:.7,FIRST_CHOICE:.55,ROTATION:.3,SQUAD_PLAYER:.15,TALENT:.15 };

/**
 * SQUAD-ROLE-MINUTES: how each role's playing time is judged. Internal only --
 * the UI shows the role name and plain-language verdicts, never these values.
 *  - guaranteed:  the role carries a per-match minutes expectation at all.
 *                 Truppspelare and Talang do not: few or zero minutes alone
 *                 never create dissatisfaction.
 *  - minMatches:  available matches needed before the rolling window is judged
 *                 (Rotation is judged over more matches than Key/First Choice).
 *  - unmetBelow:  share of the guaranteed minutes under which the window is a shortfall.
 *  - development: Talang's long-horizon check -- a whole season without real
 *                 match opportunities, not any single match.
 */
type RoleMinutesProfile = { guaranteed: boolean; minMatches: number; unmetBelow: number; development: boolean };
const ROLE_MINUTES_PROFILE: Record<SquadStatusTier, RoleMinutesProfile> = {
  KEY_PLAYER: { guaranteed:true, minMatches:4, unmetBelow:.75, development:false },
  FIRST_CHOICE: { guaranteed:true, minMatches:4, unmetBelow:.7, development:false },
  ROTATION: { guaranteed:true, minMatches:6, unmetBelow:.6, development:false },
  SQUAD_PLAYER: { guaranteed:false, minMatches:4, unmetBelow:0, development:false },
  TALENT: { guaranteed:false, minMatches:4, unmetBelow:0, development:true },
};
/** A match counts as an individual shortfall below this share of the role's minutes; a window needs at least two. */
const SHORTFALL_MATCH_SHARE = .5;
const MIN_SHORTFALL_MATCHES = 2;
/** Talang: judged only after this many available matches in the role this season... */
export const DEVELOPMENT_HORIZON_MATCHES = 10;
/** ...and only when he got onto the court in fewer than this many of them, for barely any minutes. */
const DEVELOPMENT_MIN_MATCHES_WITH_MINUTES = 2;
const DEVELOPMENT_MINUTES_PER_MATCH = 2;

export function roleGuaranteesMinutes(tier: SquadStatusTier): boolean {
  return ROLE_MINUTES_PROFILE[tier].guaranteed;
}

export function availableForPlayingTime(state: CareerState, playerId: string): boolean {
  return (state.playerStatuses[playerId]?.availability ?? 'AVAILABLE') === 'AVAILABLE' && !state.playerInjuries?.[playerId]?.activeInjury;
}

/** The role's reference court minutes for one match (stored with each sample). */
export function expectedCourtMinutes(tier: SquadStatusTier, phase: PlayerPhaseUsage, age: number | null): number {
  const share = tier === 'TALENT' ? age !== null && age < 19 ? .1 : age !== null && age > 21 ? .2 : .15 : COURT_SHARE[tier];
  const specialist = phase === 'DEFENCE_ONLY' || phase === 'ATTACK_ONLY' ? .5 : phase === 'DEFENCE_PREFERRED' || phase === 'ATTACK_PREFERRED' ? .75 : 1;
  return 60 * share * specialist;
}

/** Minutes the role actually guarantees in one match: zero for Truppspelare and Talang. */
export function guaranteedCourtMinutes(tier: SquadStatusTier, phase: PlayerPhaseUsage, age: number | null): number {
  return ROLE_MINUTES_PROFILE[tier].guaranteed ? expectedCourtMinutes(tier, phase, age) : 0;
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

/** Talang's season tally: only matches he was available for while holding the role. */
function updateDevelopmentLedger(ledger: Record<string,DevelopmentLedgerEntry> | undefined, seasonId: string, fixtureId: string, players: PlayingTimeMatch['players']): Record<string,DevelopmentLedgerEntry> | undefined {
  let next = ledger;
  for (const [playerId, p] of Object.entries(players)) {
    if (!p.available || p.tier !== 'TALENT') continue;
    const prev = next?.[playerId]?.seasonId === seasonId ? next[playerId] : undefined;
    if (prev?.lastFixtureId === fixtureId) continue;
    next = { ...next, [playerId]: { seasonId, availableMatches:(prev?.availableMatches ?? 0)+1, matchesWithMinutes:(prev?.matchesWithMinutes ?? 0)+(p.courtMinutes > 0 ? 1 : 0), courtMinutes:(prev?.courtMinutes ?? 0)+p.courtMinutes, lastFixtureId:fixtureId } };
  }
  return next;
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
  const developmentLedger = updateDevelopmentLedger(d.developmentLedger,state.seasonId,fixture.id,players);
  return {...state,playerDynamics:{...d,playingTime:{...playingTime,[fixture.id]:sample},...(developmentLedger ? {developmentLedger} : {})}};
}

export type PlayingTimeAssessment = {
  status:'UNAVAILABLE'|'WARMUP'|'UNMET'|'MET'|'EXCEEDED';
  /** What the verdict rests on: the role's rolling minutes, Talang's season-long development check, or a role without guaranteed minutes. */
  basis:'ROLE'|'DEVELOPMENT'|'NO_GUARANTEE';
  eligibleMatches:number;
  courtMinutes:number;
  /** Internal reference only -- never rendered. */
  expectedMinutes:number;
  lastFixtureId?:string;
  specialist:boolean;
  explanation:string;
};

const ABSENCE_NOTE = 'Skada, avstängning och annan frånvaro räknas inte som bänkning.';

export function assessPlayingTime(state: CareerState, playerId: string, date = state.gameDate): PlayingTimeAssessment {
  const own = getCareerClubSquad(state,state.playerClubId).some(p => p.id === playerId) && state.playerContracts[playerId]?.clubId === state.playerClubId;
  const tier = tierOf(state,playerId), profile = ROLE_MINUTES_PROFILE[tier], roleLabel = SQUAD_STATUS_TIER_LABEL_SV[tier].toLowerCase();
  const basis: PlayingTimeAssessment['basis'] = profile.guaranteed ? 'ROLE' : 'NO_GUARANTEE';
  const cutoff = addDays(date,-(PLAYING_TIME_WINDOW_DAYS-1));
  const samples = Object.values(dynamicsOf(state).playingTime ?? {}).filter(m => m.clubId === state.playerClubId && m.seasonId === state.seasonId && m.date >= cutoff && m.date <= date && m.players[playerId]?.available).sort((a,b) => a.date.localeCompare(b.date) || a.fixtureId.localeCompare(b.fixtureId)).slice(-PLAYING_TIME_WINDOW_MATCHES);
  const courtMinutes = samples.reduce((s,m) => s+m.players[playerId]!.courtMinutes,0);
  const referenceMinutes = samples.reduce((s,m) => s+m.players[playerId]!.expectedMinutes,0);
  // A sample only guarantees minutes if the role held at that match did (role edits apply prospectively).
  const guaranteed = samples.reduce((s,m) => s+(ROLE_MINUTES_PROFILE[m.players[playerId]!.tier]?.guaranteed ? m.players[playerId]!.expectedMinutes : 0),0);
  const specialist = samples.some(m => m.players[playerId]!.phase !== 'BOTH_PHASES');
  const base = {basis,eligibleMatches:samples.length,courtMinutes,expectedMinutes:profile.guaranteed ? guaranteed : 0,lastFixtureId:samples.at(-1)?.fixtureId,specialist};
  if (!own || !availableForPlayingTime(state,playerId)) return {...base,status:'UNAVAILABLE',explanation:'Ej fullt tillgänglig: ingen speltidsförväntan eller bestraffning nu.'};
  if (profile.development) {
    const ledger = dynamicsOf(state).developmentLedger?.[playerId];
    if (ledger && ledger.seasonId === state.seasonId && ledger.availableMatches >= DEVELOPMENT_HORIZON_MATCHES && ledger.matchesWithMinutes < DEVELOPMENT_MIN_MATCHES_WITH_MINUTES && ledger.courtMinutes < ledger.availableMatches*DEVELOPMENT_MINUTES_PER_MATCH)
      return {...base,basis:'DEVELOPMENT',status:'UNMET',eligibleMatches:ledger.availableMatches,courtMinutes:ledger.courtMinutes,lastFixtureId:ledger.lastFixtureId,explanation:`Har knappt fått spela den här säsongen trots att han varit tillgänglig i ${ledger.availableMatches} matcher – en talang behöver matcher för att utvecklas. ${ABSENCE_NOTE}`};
  }
  if (samples.length < profile.minMatches || daysBetween(samples[0]!.date,samples.at(-1)!.date) < PLAYING_TIME_MIN_SPAN_DAYS) return {...base,status:'WARMUP',explanation:'För få dokumenterade, tillgängliga matcher över tid för att bedöma speltiden.'};
  const played = `${Math.round(courtMinutes)} minuter på plan i ${samples.length} tillgängliga matcher`;
  const exceeded = referenceMinutes > 0 && courtMinutes > referenceMinutes*1.25;
  if (!profile.guaranteed) return {...base,status:exceeded ? 'EXCEEDED' : 'MET',explanation:exceeded
    ? `${played} – fler chanser än rollen som ${roleLabel} lovar.`
    : tier === 'TALENT' ? 'Talang: ingen fast speltid per match – utvecklingsmöjligheterna följs över säsongen.' : 'Truppspelare: rollen lovar ingen fast speltid, så få minuter väcker inget missnöje i sig.'};
  const ratio = guaranteed > 0 ? courtMinutes/guaranteed : 1;
  const shortfalls = samples.filter(m => { const p = m.players[playerId]!; return ROLE_MINUTES_PROFILE[p.tier]?.guaranteed && p.courtMinutes < p.expectedMinutes*SHORTFALL_MATCH_SHARE; }).length;
  const status = ratio < profile.unmetBelow && shortfalls >= MIN_SHORTFALL_MATCHES ? 'UNMET' : exceeded ? 'EXCEEDED' : 'MET';
  const verdict = status === 'UNMET' ? `mindre än rollen som ${roleLabel} brukar innebära` : status === 'EXCEEDED' ? `mer än rollen som ${roleLabel} brukar ge` : `i linje med rollen som ${roleLabel}`;
  return {...base,status,explanation:`${played} under de senaste veckorna – ${verdict}${specialist ? ' (specialistuppdraget är medräknat)' : ''}. ${ABSENCE_NOTE}`};
}

/** A sale, loan or release ends the old club's actionable discussion without erasing its history. */
export function closePlayingTimeConcerns(state: CareerState, playerId: string): CareerState {
  const d = state.playerDynamics;
  if (!d) return state;
  const open = Object.values(d.concerns).filter(c => c.playerId === playerId && c.kind === 'PLAYING_TIME' && c.status === 'OPEN');
  const held = d.intentions?.[playerId];
  if (!open.length && !d.morale[playerId]?.playingTimeLastFixtureId && !held?.active) return state;
  const ids = new Set(open.map(c => c.id)), eventIds = new Set(open.map(c => `PLAYER_DYNAMICS:concern:${c.id}`));
  const concerns = Object.fromEntries(Object.entries(d.concerns).map(([id,c]) => [id,ids.has(id) ? {...c,status:'LAPSED' as const,outcome:'Spelaren representerar inte längre klubben; speltidssamtalet avslutas.'} : c]));
  const prev = d.morale[playerId];
  const morale = prev ? {...d.morale,[playerId]:{...prev,playingTimeUnmetWeeks:0,playingTimeLastFixtureId:undefined}} : d.morale;
  return {...state,playerDynamics:{...d,concerns,morale,...(held?{intentions:{...d.intentions,[playerId]:{...held,active:false}}}:{})},careerEvents:state.careerEvents.map(e => eventIds.has(e.id) ? {...e,resolved:true,requiresAction:false} : e),inbox:state.inbox.map(m => m.careerEventId && eventIds.has(m.careerEventId) ? {...m,resolved:true,actionRequired:false} : m)};
}
