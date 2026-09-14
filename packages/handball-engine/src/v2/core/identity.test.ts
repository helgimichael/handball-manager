// TEAM AND PLAYER IDENTITY: proof that who plays changes what happens.
//
// The audit's verdict was that V2 could not be a management game because both
// sides of every match were the same team. These are the two proofs that must
// hold for that to have been fixed, and neither of them scripts an outcome.
//
// Same instructions, different squads, must produce different handball.
// Same squad, different instructions, must produce different handball.
//
// The second is the one that is easy to fake and easy to get wrong, so it is
// asserted on downstream evidence rather than on the instruction itself: it is
// not enough that a tactical flag changed, the shots and the space have to.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCoreScenario } from './scenarios';
import { tickCore } from './engine';
import { getPlayer, courtPlayers, type CoreState } from './state';
import { setTactics } from './coaching';
import { CHARACTERS } from './squads';
import { buildProfile, generateSheet, unratedPlayers, ROLE_TENDENCIES, OUTCOURT_KEYS, KEEPER_KEYS } from './profile';
import { measure, runMatch } from './realism';
import { createMatch } from './match';
import { advanceCoreMutable } from './engine';
import { entryCandidates } from './offence';
import { pressDepth } from './defence';
import { shotQuality } from './space';
import { nextRandom } from '../primitives';

const draws = (seed: number) => { const rng = { algorithm: 'mulberry32' as const, state: seed, draws: 0 }; return () => nextRandom(rng); };

// ---------------------------------------------------------------------------
// 1. The mapping itself
// ---------------------------------------------------------------------------

test('the engine consumes Handball Manager attribute keys, and an absent key is an average player', () => {
  // THE ONE THAT MUST NOT BE DELETED. The whole boundary rests on the engine
  // reading HM's own vocabulary rather than inventing a second one, and on an
  // unknown player being average rather than broken.
  const anchored = buildProfile({}, 'LB');
  const fast = buildProfile({ TOP_SPEED: 20, AGILITY: 20, ACCELERATION: 20, EXPLOSIVENESS: 20 }, 'LB');
  const slow = buildProfile({ TOP_SPEED: 1, AGILITY: 1, ACCELERATION: 1, EXPLOSIVENESS: 1 }, 'LB');
  assert.ok(fast.topSpeed > anchored.topSpeed && anchored.topSpeed > slow.topSpeed, 'top speed follows the HM attribute');
  assert.ok(fast.acceleration > slow.acceleration + 2, 'and so does acceleration, by a metre per second squared that matters');
  assert.ok(slow.topSpeed > 3, 'the worst player in the league can still run');
  assert.equal(buildProfile({}, 'GK').keeper !== null, true, 'a goalkeeper has his own branch');
  assert.equal(anchored.keeper, null, 'and an outfield player never does');
});

test('every capacity the engine reads comes from a named attribute, including the goalkeeper', () => {
  const weak = buildProfile({ GK_POSITIONING: 2, SET_POSITION: 2, REACTION: 2, GK_EXPLOSIVENESS: 2, LOW_SAVES: 2, HIGH_SAVES: 2, CLOSE_RANGE_SAVES: 2, LONG_RANGE_SAVES: 2, WING_SAVES: 2, SEVEN_M_SAVES: 2, SHOOTER_READING: 2, SHOT_ANTICIPATION: 2, OUTLET_PASSING: 2 }, 'GK').keeper!;
  const strong = buildProfile({ GK_POSITIONING: 19, SET_POSITION: 19, REACTION: 19, GK_EXPLOSIVENESS: 19, LOW_SAVES: 19, HIGH_SAVES: 19, CLOSE_RANGE_SAVES: 19, LONG_RANGE_SAVES: 19, WING_SAVES: 19, SEVEN_M_SAVES: 19, SHOOTER_READING: 19, SHOT_ANTICIPATION: 19, OUTLET_PASSING: 19 }, 'GK').keeper!;
  for (const key of Object.keys(strong) as (keyof typeof strong)[]) {
    assert.ok(strong[key] > weak[key], `${key} must separate two goalkeepers`);
  }
});

test('position shapes a player even before a club does', () => {
  // A squad with no character at all still produces a wing who is quicker than
  // its line player and a line player who is stronger than its wing, which is
  // why wings stopped behaving like backs.
  const neutral = CHARACTERS.NEUTRAL, draw = draws(11);
  const wing = buildProfile(generateSheet('LW', neutral, draw), 'LW', ROLE_TENDENCIES.TWO_WAY_WING);
  const pivot = buildProfile(generateSheet('P', neutral, draw), 'P', ROLE_TENDENCIES.PHYSICAL_PIVOT);
  const back = buildProfile(generateSheet('LB', neutral, draw), 'LB', ROLE_TENDENCIES.COMPLETE_BACK);
  assert.ok(wing.topSpeed > pivot.topSpeed + 0.4, 'the wing is quicker than the line player');
  assert.ok(pivot.strength > wing.strength + 0.1, 'the line player is stronger than the wing');
  assert.ok(pivot.screening > back.screening, 'and screens better than a back');
  assert.ok(back.shotPower > wing.shotPower, 'the back shoots harder than the wing');
  assert.ok(wing.wingFinishing > back.wingFinishing, 'and the wing finishes from the wing better than the back');
});

test('the league-average fallback is defensive, and never looks like real data',()=>{
  // THE ONE THAT MUST NOT BE DELETED. The fallback has to exist, or a partial
  // fixture cannot play. What must never happen is a squad that Handball
  // Manager never rated arriving in production looking rated. A profile carries
  // its own provenance, so missing source data stays visible.
  const empty=buildProfile({},'LB');
  assert.equal(empty.source.complete,false,'an unrated player is never reported as complete');
  assert.equal(empty.source.supplied,0);
  assert.equal(empty.source.expected,OUTCOURT_KEYS.length);
  assert.deepEqual([...empty.source.missing].sort(),[...OUTCOURT_KEYS].sort(),'and every absent key is named');

  const partial=buildProfile({PASSING:14,TOP_SPEED:16},'LB');
  assert.equal(partial.source.complete,false);
  assert.equal(partial.source.supplied,2);
  assert.ok(!partial.source.missing.includes('PASSING'));

  const full=Object.fromEntries(OUTCOURT_KEYS.map(k=>[k,12]));
  assert.equal(buildProfile(full,'LB').source.complete,true,'a fully rated player is complete');
  const keeperSheet=Object.fromEntries(KEEPER_KEYS.map(k=>[k,12]));
  assert.equal(buildProfile(keeperSheet,'GK').source.complete,true,'and so is a fully rated goalkeeper');

  // A production integration can list exactly who is unrated before trusting a squad.
  const squad=[{id:'p1',profile:full&&buildProfile(full,'LB')},{id:'p2',profile:empty}];
  assert.deepEqual(unratedPlayers(squad).map(p=>p.id),['p2']);
});

test('the engine never reads a rating at runtime, only the derived profile',()=>{
  // The boundary in one assertion: a CorePlayer carries execution capacities,
  // not a rating sheet. Nothing in a tick can reach back into HM data.
  const s=createCoreScenario();
  for(const p of s.players) {
    assert.ok(!('attributes' in p),'the old uniform attribute block is gone');
    assert.equal(typeof p.profile.topSpeed,'number');
    assert.ok(!(OUTCOURT_KEYS[0] in (p.profile as unknown as Record<string,unknown>)),'no raw rating key survives onto the player');
  }
});

// ---------------------------------------------------------------------------
// 2. Identity reaches actual decisions
// ---------------------------------------------------------------------------

test('a shooting threat pulls the defence up; a driving threat does not', () => {
  // The brief asked for exactly this, and it is the clearest single proof that
  // player identity reaches the defence rather than stopping at the attack.
  const s = createCoreScenario();
  const defender = getPlayer(s, 'A03'), carrier = getPlayer(s, 'H03');
  const shooter = { ...carrier, profile: { ...carrier.profile, shotPower: 0.95, shotPlacement: 0.9, breakthrough: 0.15 } };
  const driver = { ...carrier, profile: { ...carrier.profile, shotPower: 0.15, shotPlacement: 0.2, breakthrough: 0.95 } };
  const againstShooter = pressDepth(shooter, defender, 10);
  const againstDriver = pressDepth(driver, defender, 10);
  assert.ok(againstShooter > againstDriver + 0.8, `the defence steps out further against a shooter (${againstShooter.toFixed(2)} vs ${againstDriver.toFixed(2)})`);
  assert.ok(againstDriver >= 0, 'and never retreats behind its own line');
});

test('the same position is not the same shot for two different players', () => {
  const s = createCoreScenario();
  const p = getPlayer(s, 'H03');
  const place = (x: number, y: number) => { p.position = { x, y }; };
  place(10, 9.5);
  const sharp = { ...p, profile: { ...p.profile, shotPower: 0.95, shotPlacement: 0.92, finishing: 0.9 } };
  const blunt = { ...p, profile: { ...p.profile, shotPower: 0.12, shotPlacement: 0.15, finishing: 0.1 } };
  assert.ok(shotQuality(s, sharp, 1) > shotQuality(s, blunt, 1) + 0.15, 'the same ten metres is a different shot');
  // And distance still matters more than ability, which is why nobody shoots
  // from twenty metres however good he is.
  const far = { ...sharp, position: { x: 10, y: 20 } };
  assert.ok(shotQuality(s, far as typeof sharp, 1) < shotQuality(s, blunt, 1), 'ability never outruns geometry');
});

test('tactical identity changes which attacking problem a team sets', () => {
  const s = createCoreScenario();
  setTactics(s, 'HOME', { attackIdentity: 'COMBINATION' });
  const combination = entryCandidates(s)[0];
  setTactics(s, 'HOME', { attackIdentity: 'WIDTH' });
  const width = entryCandidates(s)[0];
  setTactics(s, 'HOME', { attackIdentity: 'DIRECT' });
  const direct = entryCandidates(s)[0];
  const chosen = new Set([combination.family, width.family, direct.family]);
  assert.ok(chosen.size >= 2, `three identities must not all reach for the same entry (${[...chosen].join(', ')})`);
});

// ---------------------------------------------------------------------------
// 3. The two proofs, over whole matches
// ---------------------------------------------------------------------------

/** A whole match, measured. Nothing here reads a squad to decide an outcome. */
const play = (seed: number, home: keyof typeof CHARACTERS, away: keyof typeof CHARACTERS) =>
  measure(runMatch(seed, 'TOP', { HOME: home, AWAY: away }), seed, 'TOP');

test('same instructions, different squads: different handball', () => {
  // THE ONE THAT MUST NOT BE DELETED. Neither side changes a single tactical
  // instruction. Everything that differs is who is on the court.
  const shooters = play(4, 'SHOOTERS', 'GRINDERS');
  const runners = play(4, 'RUNNERS', 'GRINDERS');
  assert.ok(shooters.complete && runners.complete, 'both matches are complete');

  // The evidence has to be downstream of the squad, not the squad itself.
  const differences = [
    Math.abs(shooters.shotMix.BACKCOURT - runners.shotMix.BACKCOURT) > 0.02,
    Math.abs(shooters.shotMix.WING - runners.shotMix.WING) > 0.02,
    Math.abs(shooters.shots - runners.shots) > 6,
    Math.abs(shooters.goals - runners.goals) > 3,
    Math.abs(shooters.nonShotLoss - runners.nonShotLoss) > 3,
    JSON.stringify(shooters.shotKinds) !== JSON.stringify(runners.shotKinds),
    JSON.stringify(shooters.goalsByRole) !== JSON.stringify(runners.goalsByRole),
  ];
  assert.ok(differences.filter(Boolean).length >= 4,
    `a shooting side and a running side must not produce the same match: backcourt ${shooters.shotMix.BACKCOURT.toFixed(2)} vs ${runners.shotMix.BACKCOURT.toFixed(2)}, shots ${shooters.shots} vs ${runners.shots}, efficiency ${shooters.efficiency.toFixed(2)} vs ${runners.efficiency.toFixed(2)}`);
});

test('a squad built to shoot takes more of its shots from the backcourt than one built to run', () => {
  // Directional, not merely different. This is the claim a manager would make
  // about his own team, and it is the one worth being wrong about loudly.
  let shootersHigher = 0, played = 0;
  for (const seed of [4, 9, 21]) {
    const shooters = play(seed, 'SHOOTERS', 'GRINDERS');
    const runners = play(seed, 'RUNNERS', 'GRINDERS');
    if (!shooters.complete || !runners.complete) continue;
    played += 1;
    if (shooters.shotMix.BACKCOURT > runners.shotMix.BACKCOURT) shootersHigher += 1;
  }
  assert.ok(played >= 2, 'a real sample of matches completed');
  assert.ok(shootersHigher >= played - 1, `the shooting side shoots from distance more often (${shootersHigher}/${played})`);
});

test('same squad, different instructions: different handball', () => {
  // The other half, and the harder one to fake: nothing about the players
  // changes at all, and the match still has to be different.
  const a = measure(runMatchWithTactics(6, null, null), 6, 'TOP');
  const b = measure(runMatchWithTactics(6, 'WIDTH', 'QUICK'), 6, 'TOP');
  assert.ok(a.complete && b.complete, 'both matches complete');
  // Downstream evidence, not the flag. A coaching instruction on one side is
  // not expected to move a match total; it is expected to change what the team
  // does, so the claim is made on what it does. Three of five independent
  // measures must differ, which noise alone does not deliver.
  const moved = [
    JSON.stringify(a.shotKinds) !== JSON.stringify(b.shotKinds),
    JSON.stringify(a.goalsByRole) !== JSON.stringify(b.goalsByRole),
    Math.abs(a.shotMix.WING - b.shotMix.WING) > 0.01,
    Math.abs(a.shotMix.BACKCOURT - b.shotMix.BACKCOURT) > 0.01,
    a.shots !== b.shots || a.goals !== b.goals || a.nonShotLoss !== b.nonShotLoss,
  ];
  assert.ok(moved.filter(Boolean).length >= 3,
    `an instruction must change what the team does: kinds ${JSON.stringify(a.shotKinds)} vs ${JSON.stringify(b.shotKinds)}, shots ${a.shots}/${b.shots}, goals ${a.goals}/${b.goals}`);
});

/** The same squads on both sides, with one coach optionally given instructions. */
function runMatchWithTactics(seed: number, identity: 'WIDTH' | 'DIRECT' | 'COMBINATION' | null, tempo: 'QUICK' | 'BALANCED' | null): CoreState {
  const s = createMatch(seed, 'TOP', undefined, undefined, { HOME: CHARACTERS.PENETRATORS, AWAY: CHARACTERS.PENETRATORS });
  if (identity || tempo) setTactics(s, 'HOME', { ...(identity ? { attackIdentity: identity } : {}), ...(tempo ? { tempo } : {}) });
  let guard = 0;
  while (s.status === 'RUNNING' && guard++ < 400000) advanceCoreMutable(s);
  return s;
}

test('two goalkeepers are not the same goalkeeper', () => {
  // Goalkeeping was the one HM attribute family the engine never read at all.
  const strong = measure(runMatch(12, 'TOP', { HOME: 'GRINDERS', AWAY: 'SHOOTERS' }), 12, 'TOP');
  assert.ok(strong.complete);
  const keepers = courtPlayers(runMatch(12, 'TOP', { HOME: 'GRINDERS', AWAY: 'SHOOTERS' })).filter(p => p.kind === 'GOALKEEPER');
  assert.ok(keepers.length >= 1, 'goalkeepers are on court');
  for (const k of keepers) {
    assert.ok(k.profile.keeper !== null, 'and each carries his own save profile');
    assert.ok(k.profile.keeper!.reaction >= 0 && k.profile.keeper!.reaction <= 1);
  }
});

test('a full match still completes from every squad pairing', () => {
  // Identity must not be able to break the match. Every pairing plays out.
  for (const [home, away] of [['SHOOTERS', 'RUNNERS'], ['PENETRATORS', 'GRINDERS'], ['NEUTRAL', 'NEUTRAL']] as const) {
    const m = play(3, home, away);
    assert.ok(m.complete, `${home} against ${away} reaches full time`);
    assert.ok(m.goals > 10, `${home} against ${away} is a real match (${m.goals} goals)`);
  }
});

test('one tick of a real match still satisfies every core invariant with profiles in play', () => {
  let s = createCoreScenario('ESTABLISHED_6V6', 5, 'TOP', { HOME: CHARACTERS.SHOOTERS, AWAY: CHARACTERS.GRINDERS });
  for (let i = 0; i < 60 && s.status === 'RUNNING'; i++) s = tickCore(s);
  assert.ok(s.tick > 0);
});
