import type { Point, TeamId, Direction } from '../model';
import { nextRandom } from '../primitives';
export type { Point, TeamId, Direction } from '../model';

export const CORE_VERSION = '2.4.0-wing-relationships.1';
export const DT_MS = 50;
/** Scoped execution profile; not a claim that all IHF rules are implemented. */
export const CORE_RULES = {id:'IHF_INDOOR_2025' as const,maxHoldMs:3000,maxSteps:3,suspensionMs:120000,restartDistance:3,goalAreaRadius:6};
export type Role = 'LW' | 'LB' | 'CB' | 'RB' | 'RW' | 'P' | 'P2' | 'GK';
export type ActionKind = 'RUN' | 'REPOSITION' | 'RECEIVE' | 'HOLD' | 'DRIBBLE' | 'PASS' | 'FEINT' | 'DRIVE' | 'JUMP' | 'SHOOT' | 'LAND' | 'SCREEN' | 'PRESS' | 'CONTAIN' | 'HELP' | 'HANDOVER' | 'RECOVER' | 'BLOCK' | 'CONTACT' | 'SAVE' | 'EXCHANGE';
export type ActionPhase = 'PREPARING' | 'COMMITTED' | 'EXECUTING' | 'RECOVERING' | 'COMPLETED' | 'INTERRUPTED' | 'FAILED';
export type Duty = 'CARRIER' | 'WING_PIN' | 'WING_OFFER' | 'CONNECT' | 'PIVOT' | 'FIRST_WAVE' | 'SECOND_WAVE' | 'PRESSURE' | 'MARK' | 'HELP' | 'COVER' | 'RETREAT' | 'RECOVER' | 'GOALKEEPER' | 'COLLECT' | 'RESTART_TAKER' | 'WAIT';
export type CorePlayer = {
  id: string; team: TeamId; kind: 'FIELD_PLAYER' | 'GOALKEEPER';
  role: Role; population: 'COURT' | 'BENCH' | 'SUSPENDED' | 'DISQUALIFIED';
  position: Point; velocity: Point; radius: number;
  attributes: { speed: number; acceleration: number; skill: number; defence: number; keeping: number };
  duty: { kind: Duty; targetId: string | null; sinceTick: number; reason: string };
  intent: { id: string; effect: string; reason: string; targetId: string | null };
  action: CoreAction | null;
  handling: { heldSinceTick: number; steps: number; stepDistance: number; dribbleUsed: boolean; bounceTick: number };
  airborne: { takeoff: Point; untilTick: number } | null;
  beatenUntilTick: number; wrongFootedUntilTick:number; screenedUntilTick: number; suspensionUntilMs: number | null; sanctions: number; warnings:number;
  nextAction: 'SHOOT' | 'LAND' | 'DRIVE' | null;
  reception:{passActionId:string;readyTick:number}|null;
};
export type CoreAction = {
  id: string; possessionId: string; kind: ActionKind; phase: ActionPhase;
  startedTick: number; phaseTick: number; executeTicks: number; recoveryTicks: number;
  target: Point | null; targetId: string | null; reason: string;
  resolved: boolean; contestIds: string[]; shotKind: 'BACKCOURT_JUMP' | 'STANDING' | 'BREAKTHROUGH' | 'WING' | 'PIVOT' | 'SEVEN_METRE' | 'EMPTY_GOAL' | null;
  purpose: 'PLAY' | 'DEAD_BALL_RETURN';
  contact:{technique:'BENT_ARMS'|'HOLD';approach:'FRONT'|'SIDE'|'BEHIND'}|null;
  driveStart:Record<string,number>|null;
};
export type CoreFlight = {
  kind: 'PASS' | 'SHOT' | 'DEFLECTION'; origin: Point; velocity: Point;
  fromId: string; receiverId: string | null; actionId: string; possessionId: string;
  releasedTick: number; height: number; goalSide: Direction; touchedIds: string[];
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
};
export type Exchange={id:string;team:TeamId;outId:string|null;inId:string;phase:'WAIT_EXIT'|'ENTERING'|'COMPLETED';gate:Point;requestedTick:number};
export type CoreState = {
  version: typeof CORE_VERSION; scenario: string; seed: number;
  ruleProfile: typeof CORE_RULES;
  rng: { algorithm: 'mulberry32'; state: number; draws: number };
  tick: number; timeMs: number; period: 1 | 2; officialClock: { timeMs: number; running: boolean };
  status: 'RUNNING' | 'CHECKPOINT' | 'INCOMPLETE' | 'FAILED'; reason: string | null;
  directions: Record<TeamId, Direction>; score: Record<TeamId, number>;
  possession: { id: string; team: TeamId; sinceTick: number; phase: 'ESTABLISHED' | 'TRANSITION' | 'RESTART'; completedPasses: number; lastPasserId: string | null };
  defence: { team: TeamId; system: '6:0' | '5:1'; marks: Record<string, string>; pressureId: string | null; helperId: string | null; lastHandoverTick: number;
    handover:{defenderIds:[string,string];attackerIds:[string,string];actionIds:[string,string]}|null };
  players: CorePlayer[];
  ball: { mode: 'DEAD' | 'CONTROLLED' | 'HOLD' | 'DRIBBLE' | 'RELEASE' | 'PASS_FLIGHT' | 'SHOT_FLIGHT' | 'RECEPTION' | 'DEFLECTION' | 'LOOSE' | 'GOALKEEPER_CONTROL' | 'OUT'; position: Point; height: number; controllerId: string | null; live: boolean; flight: CoreFlight | null; lastTouchId: string | null };
  restart: Restart | null; contests: CoreContest[]; events: CoreEvent[]; nextId: number;
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
