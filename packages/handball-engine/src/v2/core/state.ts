import type { Point, TeamId, Direction } from '../model';
import { nextRandom } from '../primitives';
import type { BackcourtSupport } from './backcourt';
import type { RefereeState } from './referee';
import type { PlayerCondition } from './condition';
import type { TeamTactics } from './coaching';
import type { OffenceState } from './offence';
import type { Profile } from './profile';
export type { Point, TeamId, Direction } from '../model';

export const CORE_VERSION = '2.9.0-possession-ecology.2';
export const DT_MS = 50;
/** Scoped execution profile; not a claim that all IHF rules are implemented. */
export const CORE_RULES = {id:'IHF_INDOOR_2025' as const,maxHoldMs:3000,maxSteps:3,suspensionMs:120000,restartDistance:3,goalAreaRadius:6};
export type Role = 'LW' | 'LB' | 'CB' | 'RB' | 'RW' | 'P' | 'P2' | 'GK';
export type ActionKind = 'RUN' | 'REPOSITION' | 'RECEIVE' | 'HOLD' | 'DRIBBLE' | 'PASS' | 'FEINT' | 'DRIVE' | 'JUMP' | 'SHOOT' | 'LAND' | 'SCREEN' | 'PRESS' | 'CONTAIN' | 'HELP' | 'HANDOVER' | 'RECOVER' | 'BLOCK' | 'CONTACT' | 'SAVE' | 'EXCHANGE';
export type ActionPhase = 'PREPARING' | 'COMMITTED' | 'EXECUTING' | 'RECOVERING' | 'COMPLETED' | 'INTERRUPTED' | 'FAILED';
export type Duty = 'CARRIER' | 'WING_PIN' | 'WING_OFFER' | 'CONNECT' | 'STRETCH' | 'COMBINE' | 'CLEAR_LANE' | 'RECYCLE' | 'BALANCE' | 'PIVOT' | 'FIRST_WAVE' | 'SECOND_WAVE' | 'PRESSURE' | 'MARK' | 'HELP' | 'COVER' | 'RETREAT' | 'RECOVER' | 'GOALKEEPER' | 'COLLECT' | 'RESTART_TAKER' | 'WAIT';
export type CorePlayer = {
  condition:PlayerCondition;
  id: string; team: TeamId; kind: 'FIELD_PLAYER' | 'GOALKEEPER';
  role: Role; population: 'COURT' | 'BENCH' | 'SUSPENDED' | 'DISQUALIFIED';
  position: Point; velocity: Point; radius: number;
  /**
   * PLAYER IDENTITY: execution capacities derived from this player's Handball
   * Manager attribute sheet. Replaces the five uniform numbers every player
   * used to share. Built once by the profile adapter; never edited in a tick.
   */
  profile: Profile;
  /** Zonal defensive responsibility, owned by the defence module. */
  zone: number | null;
  duty: { kind: Duty; targetId: string | null; sinceTick: number; reason: string };
  intent: { id: string; effect: string; reason: string; targetId: string | null };
  action: CoreAction | null;
  support: BackcourtSupport | null;
  handling: { heldSinceTick: number; steps: number; stepDistance: number; dribbleUsed: boolean; bounceTick: number };
  airborne: { takeoff: Point; untilTick: number } | null;
  beatenUntilTick: number; wrongFootedUntilTick:number; screenedUntilTick: number;
  /**
   * DUEL EPISODES: who is currently doing this to him.
   *
   * A screen and a beating are EPISODES, not instants. Without these the same
   * pivot standing in the same defender's path re-screened him every time the
   * consequence expired -- a hundred and fifty-nine screens a match, most of
   * them the same handful of interactions counted over and over -- and one
   * carrier could be credited with beating the same man repeatedly while the
   * two of them never separated. An episode opens once and closes when the two
   * players actually come apart.
   */
  screenedBy: string | null; beatenBy: string | null;
  /** When the current screen engagement began, so one screen stays one screen. */
  screenedSinceTick: number;
  /** After one ends, the same man is not screened again until he has recovered. */
  screenCooldownTick: number; suspensionUntilMs: number | null; sanctions: number; warnings:number;
  nextAction: 'SHOOT' | 'LAND' | 'DRIVE' | null;
  reception:{passActionId:string;readyTick:number}|null;
  /** Optional persisted relational locomotion during an ordinary passing offer. */
  supportMotion?:Point|null;
};
export type CoreAction = {
  id: string; possessionId: string; kind: ActionKind; phase: ActionPhase;
  startedTick: number; phaseTick: number; executeTicks: number; recoveryTicks: number;
  target: Point | null; targetId: string | null; reason: string;
  resolved: boolean; contestIds: string[]; shotKind: 'BACKCOURT_JUMP' | 'STANDING' | 'BREAKTHROUGH' | 'WING' | 'PIVOT' | 'SEVEN_METRE' | 'EMPTY_GOAL' | null;
  purpose: 'PLAY' | 'DEAD_BALL_RETURN';
  contact:{technique:'BENT_ARMS'|'HOLD';approach:'FRONT'|'SIDE'|'BEHIND'}|null;
  driveStart:Record<string,number>|null;
  /** Optional persisted cue episode; old active saves have no anticipatory loading step. */
  anticipationForId?:string;
  anticipationStartedTick?:number;
};
export type CoreFlight = {
  kind: 'PASS' | 'SHOT' | 'DEFLECTION'; origin: Point; velocity: Point;
  fromId: string; receiverId: string | null; actionId: string; possessionId: string;
  releasedTick: number; height: number; goalSide: Direction; touchedIds: string[];
  /** Optional for older in-progress snapshots; absent retains the original 1.1m endpoint. */
  goalHeight?:number;
  purpose: 'PLAY' | 'DEAD_BALL_RETURN';
};
export type CoreEvent = {
  id: string; tick: number; timeMs: number; officialMs: number; type: string;
  possessionId: string; actionId: string | null; actorId: string | null;
  relatedIds: string[]; contestId: string | null; details: Record<string, string | number | boolean>;
};
export type CoreContest = {
  id: string; kind: 'DUEL' | 'CONTACT' | 'SCREEN' | 'INTERCEPTION' | 'BLOCK' | 'KEEPER';
  tick: number; attackerId: string; defenderId: string; actionId: string;
  outcome: string; margin: number; consequenceUntilTick: number;
};
export type Restart = {
  id: string; kind: 'FREE_THROW' | 'GOALKEEPER_THROW' | 'THROW_IN' | 'SEVEN_METRE' | 'CENTRE_THROW_OFF';
  owner: TeamId; location: Point; awardedTick: number;
  phase: 'AWARDED' | 'PREPARING' | 'AUTHORISED' | 'RELEASED' | 'COMPLETED';
  takerId: string | null; authorisedTick: number | null;
  collectorId: string | null; receiverId: string | null; context:'OPENING_HALF'|'POST_GOAL'|null;
  plantedFoot: Point | null;
  pausedTicks:number;
  /** How often this restart has had to be retaken; bounded, then forfeited. */
  retakes?:number;
};
export type Exchange={id:string;team:TeamId;outId:string|null;inId:string;phase:'WAIT_EXIT'|'ENTERING'|'COMPLETED'|'CANCELLED';gate:Point;requestedTick:number};
export type CoreState = {
  version: typeof CORE_VERSION; scenario: string; seed: number;
  ruleProfile: typeof CORE_RULES;
  rng: { algorithm: 'mulberry32'; state: number; draws: number };
  tick: number; timeMs: number; period: 1 | 2; officialClock: { timeMs: number; running: boolean };
  status: 'RUNNING' | 'CHECKPOINT' | 'INCOMPLETE' | 'FAILED'; reason: string | null;
  directions: Record<TeamId, Direction>; score: Record<TeamId, number>;
  possession: { id: string; team: TeamId; sinceTick: number; phase: 'ESTABLISHED' | 'TRANSITION' | 'RESTART'; completedPasses: number; lastPasserId: string | null };
  defence: { team: TeamId; system: '6:0' | '5:1'; marks: Record<string, string>; pressureId: string | null; helperId: string | null; lastHandoverTick: number;
    /** COLLECTIVE DEFENCE: the shared read that makes six defenders one line. */
    read: { engaged: number | null; shift: number; compact: number };
    handover:{defenderIds:[string,string];attackerIds:[string,string];actionIds:[string,string]}|null;
    /**
     * ADVANTAGE: the defence is a man short, and stays short until it re-forms.
     *
     * A defensive reaction used to be visible only on the tick it happened, so
     * an advantage resolved terminally: the attack played the freed man and the
     * read started again from nothing. In handball an advantage propagates --
     * the man who was left is played, HIS defender has to come out, and the
     * next man is free in turn. Holding the break open, and extending it every
     * time another defender has to react, is what lets a chain exist at all.
     */
    broken:{possessionId:string;defenderId:string;freedId:string|null;sinceTick:number;untilTick:number;reactions:number;cause:string}|null };
  players: CorePlayer[];
  ball: { mode: 'DEAD' | 'CONTROLLED' | 'HOLD' | 'DRIBBLE' | 'RELEASE' | 'PASS_FLIGHT' | 'SHOT_FLIGHT' | 'RECEPTION' | 'DEFLECTION' | 'LOOSE' | 'GOALKEEPER_CONTROL' | 'OUT'; position: Point; height: number; controllerId: string | null; live: boolean; flight: CoreFlight | null; lastTouchId: string | null };
  restart: Restart | null; contests: CoreContest[]; events: CoreEvent[]; nextId: number;
  referee:RefereeState;
  coaching:Record<TeamId,TeamTactics>;
  offence:OffenceState;
  exchanges:Exchange[];
  flow:{continuous:boolean;outcomes:number;lastOutcomeTick:number;stopAfter:number|null;sevenVTeam:TeamId|null};
  match:{phase:'PREMATCH'|'FIRST_HALF'|'HALFTIME'|'SECOND_HALF'|'FINAL_THROW'|'FULLTIME';periodLengthMs:number;periodStartMs:number;resumeTick:number;halfBreakMs:number;outcomesAtHorn:number;
    coachingPlan:{team:TeamId;outId:string;inId:string;atMs:number;requested:boolean;sevenV:boolean}[]}|null;
  checkpoint: { maxTicks: number; stopOnOutcome: boolean; initialPossessionId: string; outcome: string | null };
};
export const otherTeam = (team: TeamId): TeamId => team === 'HOME' ? 'AWAY' : 'HOME';
export function getPlayer(s: CoreState, id: string): CorePlayer { const p=s.players.find(p=>p.id===id); if(!p)throw new Error(`Unknown player ${id}`);return p; }
export function courtPlayers(s: CoreState, team?: TeamId) { return s.players.filter(p=>p.population==='COURT' && (!team || p.team===team)); }
export function uid(s: CoreState, prefix: string) { return `${prefix}-${s.nextId++}`; }
export const random = (s: CoreState) => nextRandom(s.rng);
export function record(s: CoreState, type: string, actor: CorePlayer | null = null, details: CoreEvent['details'] = {}, relatedIds: string[] = [], contestId: string | null = null, actionId = actor?.action?.id ?? null) {
  s.events.push({id:uid(s,'event'),tick:s.tick,timeMs:s.timeMs,officialMs:s.officialClock.timeMs,type,possessionId:s.possession.id,actionId,actorId:actor?.id??null,relatedIds,contestId,details});
}
export function actionAvailable(p: CorePlayer) { return !p.action || ['COMPLETED','INTERRUPTED','FAILED'].includes(p.action.phase); }
