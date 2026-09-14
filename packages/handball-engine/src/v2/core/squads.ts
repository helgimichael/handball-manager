// TEAM IDENTITY FIXTURES: clubs the engine can tell apart, for QA only.
//
// EVERYTHING IN THIS FILE IS A DETERMINISTIC TEST FIXTURE. These are not
// Handball Manager teams, they carry no production semantics, and no career,
// league or save data may ever reference them. They exist so that a human can
// watch two visibly different sides play and so that the differentiation proofs
// have something to differentiate.
//
// Production squads arrive the other way round: Handball Manager supplies each
// player's own attribute sheet and `buildProfile` consumes it directly. When
// that path is wired, `generateSheet` and these characters are used by tests
// and by the scenario lab, and by nothing else.
//
// The audit's sharpest finding was that both sides of every match were the same
// team: identical attributes, identical instructions, forever. No amount of
// tactical depth can rescue that, because there is nothing for tactics to be
// tactics ABOUT.
//
// A character is not an instruction. Instructions are what a coach changes at
// half time; a character is what the club recruited and cannot change during a
// match. That separation is the whole point, and it is what makes the two
// differentiation proofs meaningful: same instructions with different squads
// must produce different handball, and the same squad under different
// instructions must too, for different reasons.
//
// These are engine fixtures, not real clubs and not a claim about any real
// club. When Handball Manager supplies real squads, `profileFor` takes their
// sheets directly and these disappear.
export { profileFor, generateSheet, buildProfile, ROLE_TENDENCIES, NEUTRAL_CHARACTER } from './profile';
export type { Profile, SquadCharacter, AttributeSheet, Tendency, OutcourtKey, KeeperKey } from './profile';
import type { SquadCharacter } from './profile';

/**
 * Five recognisable ways to build a handball team.
 *
 * Each is a real archetype rather than a slider setting, and each should be
 * visible on court within one possession to somebody who knows the sport.
 */
export const CHARACTERS = {
  /** The controlled fixture: every attribute at the Handball Manager anchor. */
  NEUTRAL: {
    name: 'Neutral', level: 12, spread: 0, emphasis: {}, roles: {},
  },
  /**
   * Heavy backcourt. Two backs who shoot from ten metres and a line player who
   * exists to hold the middle open for them. Tests whether defensive depth
   * responds to a shooting threat, because against this team it must.
   */
  SHOOTERS: {
    name: 'Backcourt shooters', level: 13, spread: 1.6,
    emphasis: { SHOOTING: 3.5, PHYSICAL: 1, BREAKTHROUGH: -2, PACE: -1 },
    roles: { LB: 'SHOOTING_BACK', RB: 'SHOOTING_BACK', CB: 'SCORING_CENTRE_BACK', P: 'SCREENING_PIVOT', LW: 'ELITE_FINISHER', RW: 'ELITE_FINISHER' },
  },
  /**
   * Beat your man. Quick, agile, low on raw shooting power, and dependent on a
   * playmaker who can find the man who has just broken through.
   */
  PENETRATORS: {
    name: 'Breakthrough side', level: 13, spread: 1.6,
    emphasis: { BREAKTHROUGH: 3.5, PACE: 2, SHOOTING: -2.5, PHYSICAL: -1 },
    roles: { LB: 'BREAKTHROUGH_BACK', RB: 'BREAKTHROUGH_BACK', CB: 'BREAKTHROUGH_CREATOR', P: 'MOBILE_PIVOT', LW: 'CREATIVE_WING', RW: 'CREATIVE_WING' },
  },
  /**
   * Run. Wings who finish the break and a centre back who plays with tempo.
   * Strong in transition and thinner once a defence is set.
   */
  RUNNERS: {
    name: 'Transition side', level: 12.5, spread: 1.5,
    emphasis: { PACE: 3.5, PASSING: 1, PHYSICAL: -2, SHOOTING: -1 },
    roles: { LB: 'COMPLETE_BACK', RB: 'COMPLETE_BACK', CB: 'TEMPO_CONTROLLER', P: 'MOBILE_PIVOT', LW: 'TRANSITION_WING', RW: 'TRANSITION_WING' },
  },
  /**
   * Defend and wear you down. Physical, disciplined, patient, and comfortable
   * winning a match in the twenties.
   */
  GRINDERS: {
    name: 'Defensive side', level: 12.5, spread: 1.4,
    emphasis: { DEFENCE: 3.5, PHYSICAL: 3, PACE: -1.5, SHOOTING: -1.5, BREAKTHROUGH: -1 },
    roles: { LB: 'COMPLETE_BACK', RB: 'COMPLETE_BACK', CB: 'PRIMARY_PLAYMAKER', P: 'PHYSICAL_PIVOT', LW: 'TWO_WAY_WING', RW: 'TWO_WAY_WING' },
  },
} as const satisfies Record<string, SquadCharacter>;

export type CharacterId = keyof typeof CHARACTERS;
export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[];
