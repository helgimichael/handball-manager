// PLAYER IDENTITY: the engine consumes Handball Manager's own rating model.
//
// The audit found every outfield player in every match carrying the same five
// numbers, one of which was never read. The fix is NOT a second rating universe
// invented for the engine. Handball Manager already has a 1-20 attribute
// vocabulary (HM-RATINGS-0.1, `apps/game/lib/rating/types.ts`) with a name for
// every capacity this engine needs, and a goalkeeper branch kept deliberately
// separate from the outcourt one. So no new permanent attribute is defined here.
//
// The boundary is STRUCTURAL, exactly as the career rating bridge already does
// it: this module names the HM keys it reads and accepts a plain record of
// them. The engine imports nothing from the app, the app imports nothing from
// the engine, and the two agree on spelling. A key that is absent falls back to
// the league-average anchor rather than to a silent zero, because an unknown
// player is an average player and never a broken one.
//
// What the engine stores is NOT the attributes. It is the small set of
// EXECUTION CAPACITIES derived from them: metres per second, probabilities,
// durations. Deriving once, at population time, keeps the tick loop free of
// rating arithmetic and keeps the mapping in one readable place.
import type { Role } from './state';

/** HM outcourt attribute keys this engine reads. Spelling matches HM-RATINGS-0.1. */
export const OUTCOURT_KEYS = [
  'PASSING','BALL_HANDLING','SHOOTING_POWER','SHOOTING_PLACEMENT','BREAKTHROUGH','FINISHING','WING_FINISHING','PIVOT_PLAY','SCREENING',
  'GAME_READING','DECISION_MAKING','ANTICIPATION','OFF_BALL_MOVEMENT','TIMING',
  'CONTACT_ABILITY','DEFENSIVE_POSITIONING','DEFENSIVE_TIMING','LATERAL_DEFENCE','COVERING','SWITCHING_HANDOVER','BALL_WINNING','SHOT_BLOCKING',
  'ACCELERATION','TOP_SPEED','LATERAL_QUICKNESS','AGILITY','EXPLOSIVENESS','STRENGTH','CONTACT_BALANCE','JUMP_ABILITY','ENDURANCE','REPEAT_SPRINT_ABILITY','MOBILITY',
  'COMPOSURE','DISCIPLINE',
  'AWARENESS','PLAYMAKING','ADVANTAGE_RECOGNITION','TWO_V_TWO_READING','CONCENTRATION','PRESSURE_HANDLING',
] as const;
export type OutcourtKey = typeof OUTCOURT_KEYS[number];

/** HM goalkeeper attribute keys. A separate branch, never one generic number. */
export const KEEPER_KEYS = [
  'GK_POSITIONING','SET_POSITION','REACTION','GK_EXPLOSIVENESS',
  'LOW_SAVES','HIGH_SAVES','CLOSE_RANGE_SAVES','LONG_RANGE_SAVES','WING_SAVES','SEVEN_M_SAVES',
  'SHOOTER_READING','SHOT_ANTICIPATION','OUTLET_PASSING',
  'PATIENCE','DECISION_TIMING','GK_COMPOSURE','GK_CONCENTRATION','GK_PRESSURE_HANDLING',
] as const;
export type KeeperKey = typeof KEEPER_KEYS[number];

export type AttributeSheet = Partial<Record<OutcourtKey | KeeperKey, number>>;

/** HM scale is 1-20 and fixed. An absent key is a league-average player. */
export const ATTRIBUTE_MIN = 1, ATTRIBUTE_MAX = 20, ATTRIBUTE_DEFAULT = 10;
const unit = (sheet: AttributeSheet, key: OutcourtKey | KeeperKey) => {
  const raw = sheet[key];
  const value = typeof raw === 'number' && Number.isFinite(raw) ? Math.max(ATTRIBUTE_MIN, Math.min(ATTRIBUTE_MAX, raw)) : ATTRIBUTE_DEFAULT;
  return (value - ATTRIBUTE_MIN) / (ATTRIBUTE_MAX - ATTRIBUTE_MIN);
};
const mean = (sheet: AttributeSheet, ...keys: (OutcourtKey | KeeperKey)[]) => keys.reduce((n, k) => n + unit(sheet, k), 0) / keys.length;

/**
 * How a player leans, separate from how good he is.
 *
 * Handball Manager already separates position from role: an H9 may be a
 * SHOOTING_BACK or a BREAKTHROUGH_BACK, a V6 an ELITE_FINISHER or a
 * TRANSITION_WING. Two players with the same ratings and different roles should
 * not solve the same situation the same way, so tendency is a first-class
 * multiplier on option appeal and never on option quality. A tendency changes
 * what he tries. His attributes decide whether it works.
 */
export type Tendency = {
  /** Takes the shot where another player would keep circulating. */
  readonly shoot: number;
  /** Goes at his man rather than releasing. */
  readonly drive: number;
  /** Looks for the line player. */
  readonly feed: number;
  /** Runs the width and the fast break. */
  readonly run: number;
  /** Holds a screen rather than rolling off it. */
  readonly hold: number;
};
const NEUTRAL: Tendency = Object.freeze({ shoot: 1, drive: 1, feed: 1, run: 1, hold: 1 });

/** Execution capacities the tick loop reads. Derived once, never recomputed. */
export type Profile = {
  /** Metres per second and metres per second squared, for the movement integrator. */
  readonly topSpeed: number;
  readonly acceleration: number;
  /** Seconds before a player reacts to something new. Better readers react sooner. */
  readonly reaction: number;
  /** 0..1 execution qualities. */
  readonly passing: number;
  readonly handling: number;
  readonly shotPower: number;
  readonly shotPlacement: number;
  readonly breakthrough: number;
  readonly finishing: number;
  readonly wingFinishing: number;
  readonly pivotPlay: number;
  readonly screening: number;
  readonly anticipation: number;
  readonly decision: number;
  readonly offBall: number;
  readonly contact: number;
  readonly defPositioning: number;
  readonly defTiming: number;
  readonly lateral: number;
  readonly defFootwork?: number;
  readonly covering: number;
  readonly handover: number;
  readonly ballWinning: number;
  readonly blocking: number;
  readonly strength: number;
  readonly balance: number;
  readonly endurance: number;
  /** Existing HM physical attributes; optional for pre-v1.1 active sessions. */
  readonly physical?:{readonly acceleration:number;readonly lateralQuickness:number;readonly agility:number;readonly explosiveness:number;readonly jumping:number;readonly repeatSprint:number;readonly mobility:number};
  readonly composure: number;
  readonly discipline: number;
  /** Immutable action-specific reads. Optional for existing active sessions. */
  readonly cognition?: {readonly awareness:number;readonly playmaking:number;readonly advantage:number;readonly twoOnTwo:number};
  readonly control?: {readonly concentration:number;readonly pressure:number};
  /** Null for every outfield player. A goalkeeper is never a generic number. */
  readonly keeper: KeeperProfile | null;
  readonly tendency: Tendency;
  /**
   * Which Handball Manager attributes were actually supplied, and which were
   * filled in at the league anchor.
   *
   * The fallback is defensive engine behaviour and must stay: a fixture with a
   * partial sheet should still play, and an unknown player is average rather
   * than broken. But it must never make MISSING SOURCE DATA look like real
   * data. Production integration reads `complete` before trusting a profile,
   * and `missing` names exactly what was absent, so a squad that was never
   * rated is visible rather than silently average.
   */
  readonly source: { readonly complete: boolean; readonly missing: readonly string[]; readonly supplied: number; readonly expected: number };
};

export type KeeperProfile = {
  readonly positioning: number;
  readonly setPosition: number;
  readonly reaction: number;
  readonly explosiveness: number;
  readonly low: number;
  readonly high: number;
  readonly close: number;
  readonly long: number;
  readonly wing: number;
  readonly sevenMetre: number;
  readonly reading: number;
  readonly outlet: number;
  readonly patience?: number;
  readonly timing?: number;
  readonly concentration?: number;
  readonly pressure?: number;
};

/**
 * Physical mapping.
 *
 * A 1 runs at 4.4 m/s and a 20 at 7.4 m/s, which brackets the range a senior
 * squad actually shows over the short distances a handball court allows; the
 * old engine gave everybody 5.4. Acceleration spans 3.6 to 7.6 and is the
 * attribute that decides a five-metre race, which is most of them.
 */
const SPEED_FLOOR = 4.4, SPEED_RANGE = 3.0;
const ACCEL_FLOOR = 3.6, ACCEL_RANGE = 4.0;
/** Reaction spans a fifth of a second. Small, and it decides interceptions. */
const REACTION_SLOW = 0.32, REACTION_RANGE = 0.18;

export function buildProfile(sheet: AttributeSheet, role: Role, tendency: Partial<Tendency> = {}): Profile {
  const keeper = role === 'GK';
  const expected: readonly (OutcourtKey | KeeperKey)[] = keeper ? KEEPER_KEYS : OUTCOURT_KEYS;
  const missing = expected.filter(key => typeof sheet[key] !== 'number' || !Number.isFinite(sheet[key] as number));
  const read = keeper ? mean(sheet, 'SHOOTER_READING', 'SHOT_ANTICIPATION') : mean(sheet, 'GAME_READING', 'ANTICIPATION');
  return {
    // A goalkeeper covers his goal, not the court; his top speed is his own.
    topSpeed: keeper ? 3.2 + 1.6 * mean(sheet, 'GK_EXPLOSIVENESS', 'REACTION') : SPEED_FLOOR + SPEED_RANGE * mean(sheet, 'TOP_SPEED', 'TOP_SPEED', 'AGILITY'),
    acceleration: keeper ? 5 + 4 * unit(sheet, 'GK_EXPLOSIVENESS') : ACCEL_FLOOR + ACCEL_RANGE * mean(sheet, 'ACCELERATION', 'EXPLOSIVENESS'),
    reaction: REACTION_SLOW - REACTION_RANGE * (keeper ? mean(sheet,'REACTION','REACTION','SHOOTER_READING') : read),
    // Choosing a pass and mechanically delivering it are separate responsibilities.
    passing: keeper ? unit(sheet,'OUTLET_PASSING') : unit(sheet,'PASSING'),
    handling: keeper ? mean(sheet,'LOW_SAVES','HIGH_SAVES') : unit(sheet,'BALL_HANDLING'),
    shotPower: unit(sheet, 'SHOOTING_POWER'),
    shotPlacement: mean(sheet, 'SHOOTING_PLACEMENT', 'FINISHING'),
    breakthrough: mean(sheet, 'BREAKTHROUGH', 'AGILITY'),
    finishing: unit(sheet, 'FINISHING'),
    wingFinishing: unit(sheet, 'WING_FINISHING'),
    pivotPlay: unit(sheet, 'PIVOT_PLAY'),
    screening: mean(sheet, 'SCREENING', 'STRENGTH'),
    anticipation: read,
    decision: keeper ? unit(sheet,'DECISION_TIMING') : unit(sheet,'DECISION_MAKING'),
    offBall: mean(sheet, 'OFF_BALL_MOVEMENT', 'TIMING'),
    contact: mean(sheet, 'CONTACT_ABILITY', 'STRENGTH'),
    defPositioning: unit(sheet, 'DEFENSIVE_POSITIONING'),
    defTiming: mean(sheet, 'DEFENSIVE_TIMING', 'TIMING'),
    lateral: mean(sheet, 'LATERAL_DEFENCE', 'AGILITY'),
    defFootwork: unit(sheet,'LATERAL_DEFENCE'),
    covering: unit(sheet, 'COVERING'),
    handover: unit(sheet, 'SWITCHING_HANDOVER'),
    ballWinning: mean(sheet, 'BALL_WINNING', 'ANTICIPATION'),
    blocking: unit(sheet, 'SHOT_BLOCKING'),
    strength: unit(sheet, 'STRENGTH'),
    balance: unit(sheet, 'CONTACT_BALANCE'),
    endurance: unit(sheet, 'ENDURANCE'),
    ...(keeper?{}:{physical:{acceleration:unit(sheet,'ACCELERATION'),lateralQuickness:unit(sheet,'LATERAL_QUICKNESS'),agility:unit(sheet,'AGILITY'),explosiveness:unit(sheet,'EXPLOSIVENESS'),jumping:unit(sheet,'JUMP_ABILITY'),repeatSprint:unit(sheet,'REPEAT_SPRINT_ABILITY'),mobility:unit(sheet,'MOBILITY')}}),
    composure: unit(sheet, keeper ? 'GK_COMPOSURE' : 'COMPOSURE'),
    discipline: unit(sheet, 'DISCIPLINE'),
    ...(!keeper?{cognition:{awareness:unit(sheet,'AWARENESS'),playmaking:unit(sheet,'PLAYMAKING'),advantage:unit(sheet,'ADVANTAGE_RECOGNITION'),twoOnTwo:unit(sheet,'TWO_V_TWO_READING')},control:{concentration:unit(sheet,'CONCENTRATION'),pressure:unit(sheet,'PRESSURE_HANDLING')}}:{}),
    keeper: keeper ? {
      positioning: mean(sheet, 'GK_POSITIONING', 'SET_POSITION'),
      setPosition: unit(sheet, 'SET_POSITION'),
      reaction: unit(sheet, 'REACTION'),
      explosiveness: unit(sheet, 'GK_EXPLOSIVENESS'),
      low: unit(sheet, 'LOW_SAVES'),
      high: unit(sheet, 'HIGH_SAVES'),
      close: unit(sheet, 'CLOSE_RANGE_SAVES'),
      long: unit(sheet, 'LONG_RANGE_SAVES'),
      wing: unit(sheet, 'WING_SAVES'),
      sevenMetre: unit(sheet, 'SEVEN_M_SAVES'),
      reading: read,
      outlet: unit(sheet, 'OUTLET_PASSING'),
      patience: unit(sheet,'PATIENCE'),
      timing: unit(sheet,'DECISION_TIMING'),
      concentration: unit(sheet,'GK_CONCENTRATION'),
      pressure: unit(sheet,'GK_PRESSURE_HANDLING'),
    } : null,
    tendency: { ...NEUTRAL, ...tendency },
    source: { complete: missing.length === 0, missing, supplied: expected.length - missing.length, expected: expected.length },
  };
}

/**
 * Every player whose rating data was incomplete, for a production integration
 * to refuse or to flag. Nothing in the engine calls this; it exists so that the
 * fallback can never be mistaken for evidence.
 */
export function unratedPlayers(players: readonly { id: string; profile: Profile }[]): { id: string; missing: readonly string[] }[] {
  return players.filter(p => !p.profile.source.complete).map(p => ({ id: p.id, missing: p.profile.source.missing }));
}

// ---------------------------------------------------------------------------
// Squad generation for the engine's own matches
// ---------------------------------------------------------------------------

/**
 * A club's playing character, as a manager would describe it.
 *
 * This is NOT a tactical instruction. It is what the squad is made of: who the
 * club recruited and what they are good at. A tactical instruction can be
 * changed at half time; this cannot. Two clubs with the same instructions and
 * different characters must produce different handball, and proving that is
 * what `identity.test.ts` exists for.
 */
export type SquadCharacter = {
  readonly name: string;
  /** Overall level, 1-20 on HM's own scale, before positional and role shaping. */
  readonly level: number;
  /** How far individual players spread around that level. */
  readonly spread: number;
  /** Per-family emphasis, added to the level for the keys in that family. */
  readonly emphasis: Partial<Record<'SHOOTING' | 'BREAKTHROUGH' | 'PHYSICAL' | 'DEFENCE' | 'PASSING' | 'PACE', number>>;
  /** Role preference per position, choosing which HM attack role each player carries. */
  readonly roles: Partial<Record<Role, keyof typeof ROLE_TENDENCIES>>;
};

/**
 * HM's own attack-role vocabulary, as engine tendencies.
 *
 * Handball Manager already names these roles per position (Rating Model §8).
 * Reusing the names rather than inventing engine-only ones keeps one vocabulary
 * across the product and makes a squad sheet readable by a human.
 */
export const ROLE_TENDENCIES = {
  SHOOTING_BACK: { shoot: 1.55, drive: 0.62, feed: 0.9, run: 0.85, hold: 1 },
  BREAKTHROUGH_BACK: { shoot: 0.66, drive: 1.7, feed: 1.05, run: 1, hold: 1 },
  CREATIVE_BACK: { shoot: 0.82, drive: 0.95, feed: 1.5, run: 1, hold: 1 },
  COMPLETE_BACK: { shoot: 1.1, drive: 1.1, feed: 1.1, run: 1, hold: 1 },
  PRIMARY_PLAYMAKER: { shoot: 0.6, drive: 0.85, feed: 1.6, run: 0.9, hold: 1 },
  BREAKTHROUGH_CREATOR: { shoot: 0.75, drive: 1.6, feed: 1.25, run: 1, hold: 1 },
  SCORING_CENTRE_BACK: { shoot: 1.5, drive: 1.05, feed: 0.85, run: 0.9, hold: 1 },
  TEMPO_CONTROLLER: { shoot: 0.7, drive: 0.8, feed: 1.3, run: 1.35, hold: 1 },
  PHYSICAL_PIVOT: { shoot: 1, drive: 0.8, feed: 1, run: 0.8, hold: 1.6 },
  MOBILE_PIVOT: { shoot: 1.15, drive: 1.15, feed: 1, run: 1.2, hold: 0.75 },
  SCREENING_PIVOT: { shoot: 0.8, drive: 0.75, feed: 1, run: 0.85, hold: 1.75 },
  ELITE_FINISHER: { shoot: 1.6, drive: 0.85, feed: 0.8, run: 1.05, hold: 1 },
  TRANSITION_WING: { shoot: 1.05, drive: 0.9, feed: 0.85, run: 1.75, hold: 1 },
  CREATIVE_WING: { shoot: 0.95, drive: 1.15, feed: 1.2, run: 1.15, hold: 1 },
  TWO_WAY_WING: { shoot: 1.1, drive: 1, feed: 1, run: 1.25, hold: 1 },
  KEEPER: { shoot: 1, drive: 1, feed: 1, run: 1, hold: 1 },
} as const satisfies Record<string, Tendency>;

/** Basic positional duties used when no explicit attack role is supplied. */
export function defaultAttackRole(role:Role):keyof typeof ROLE_TENDENCIES {
  return role==='GK'?'KEEPER':role==='P'||role==='P2'?'PHYSICAL_PIVOT':role==='CB'?'PRIMARY_PLAYMAKER':role==='LW'||role==='RW'?'TWO_WAY_WING':'COMPLETE_BACK';
}

/** Which HM keys each emphasis family moves. */
const FAMILIES = {
  SHOOTING: ['SHOOTING_POWER', 'SHOOTING_PLACEMENT', 'FINISHING', 'WING_FINISHING'],
  BREAKTHROUGH: ['BREAKTHROUGH', 'AGILITY', 'BALL_HANDLING'],
  PHYSICAL: ['STRENGTH', 'CONTACT_BALANCE', 'CONTACT_ABILITY', 'SCREENING', 'PIVOT_PLAY'],
  DEFENCE: ['DEFENSIVE_POSITIONING', 'DEFENSIVE_TIMING', 'LATERAL_DEFENCE', 'COVERING', 'SWITCHING_HANDOVER', 'BALL_WINNING', 'SHOT_BLOCKING'],
  PASSING: ['PASSING', 'DECISION_MAKING', 'GAME_READING', 'PLAYMAKING' as OutcourtKey, 'ANTICIPATION'],
  PACE: ['TOP_SPEED', 'ACCELERATION', 'EXPLOSIVENESS', 'AGILITY'],
} as const satisfies Record<string, readonly (OutcourtKey | KeeperKey)[]>;

/**
 * What a position needs, over and above the club level.
 *
 * A wing is quick and finishes from a bad angle. A line player is strong and
 * screens. A centre back reads and passes. This is why a squad of equal
 * players still produces different behaviour per position, and it is the
 * reason the audit's "wings behave identically to backs" finding disappears.
 */
const POSITIONAL: Partial<Record<Role, Partial<Record<OutcourtKey | KeeperKey, number>>>> = {
  LW: { TOP_SPEED: 3, ACCELERATION: 2.5, AGILITY: 2.5, WING_FINISHING: 4, FINISHING: 2, SHOOTING_POWER: -2, STRENGTH: -2, PIVOT_PLAY: -3, SCREENING: -3 },
  RW: { TOP_SPEED: 3, ACCELERATION: 2.5, AGILITY: 2.5, WING_FINISHING: 4, FINISHING: 2, SHOOTING_POWER: -2, STRENGTH: -2, PIVOT_PLAY: -3, SCREENING: -3 },
  LB: { SHOOTING_POWER: 3, SHOOTING_PLACEMENT: 2, BREAKTHROUGH: 1, STRENGTH: 1, WING_FINISHING: -3, PIVOT_PLAY: -2 },
  RB: { SHOOTING_POWER: 3, SHOOTING_PLACEMENT: 2, BREAKTHROUGH: 1, STRENGTH: 1, WING_FINISHING: -3, PIVOT_PLAY: -2 },
  CB: { PASSING: 3.5, GAME_READING: 3, DECISION_MAKING: 3, ANTICIPATION: 2, BREAKTHROUGH: 1, SHOOTING_POWER: -1, WING_FINISHING: -3 },
  P: { STRENGTH: 4, CONTACT_BALANCE: 3.5, CONTACT_ABILITY: 3, SCREENING: 4, PIVOT_PLAY: 4.5, TOP_SPEED: -2, SHOOTING_POWER: -2, WING_FINISHING: -2 },
  P2: { STRENGTH: 3, CONTACT_BALANCE: 3, SCREENING: 3.5, PIVOT_PLAY: 3.5, TOP_SPEED: -1 },
};

type Draw = () => number;

/** Deterministic, seeded, and shaped: level, spread, positional need, club emphasis. */
export function generateSheet(role: Role, character: SquadCharacter, draw: Draw): AttributeSheet {
  const sheet: AttributeSheet = {};
  const keys: readonly (OutcourtKey | KeeperKey)[] = role === 'GK' ? KEEPER_KEYS : OUTCOURT_KEYS;
  const positional = POSITIONAL[role] ?? {};
  const emphasisOf = (key: OutcourtKey | KeeperKey) => {
    let total = 0;
    for (const [family, amount] of Object.entries(character.emphasis)) {
      if ((FAMILIES[family as keyof typeof FAMILIES] as readonly string[]).includes(key)) total += amount ?? 0;
    }
    return total;
  };
  for (const key of keys) {
    // Two draws averaged: a player is rarely extreme on every attribute at once.
    const noise = (draw() + draw() - 1) * character.spread;
    const value = character.level + noise + (positional[key] ?? 0) + emphasisOf(key);
    sheet[key] = Math.max(ATTRIBUTE_MIN, Math.min(ATTRIBUTE_MAX, Math.round(value * 10) / 10));
  }
  return sheet;
}

export function profileFor(role: Role, character: SquadCharacter, draw: Draw): Profile {
  const roleName = character.roles[role] ?? defaultAttackRole(role);
  return buildProfile(generateSheet(role, character, draw), role, ROLE_TENDENCIES[roleName]);
}

/** A squad with no character at all: every key at the HM anchor. For fixtures. */
export const NEUTRAL_CHARACTER: SquadCharacter = Object.freeze({ name: 'Neutral', level: 12, spread: 0, emphasis: {}, roles: {} });
