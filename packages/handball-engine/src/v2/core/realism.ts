// REALISM VERIFICATION: broad plausibility, never a historical statistic.
//
// The audit found seventy-two green tests coexisting with eighteen suspensions
// a match, because every one of them tested a mechanism and none of them asked
// whether the result was handball. This is the missing layer.
//
// It is deliberately NOT a set of targets to tune toward. A match that lands
// inside every band can still be bad handball, and a match outside one band is
// a question rather than a failure. What the bands do is make an absurdity
// impossible to ship quietly: sixty-eight interceptions, zero seven-metre
// throws and three suspensions per team per half are all outside anything the
// sport produces, and the suite should have said so.
//
// Ranges are per MATCH, both teams combined, and they are wide. They describe a
// profile, and EHF elite is one profile among several. A Handball Manager
// league with lower athleticism produces fewer fast breaks and more set attack;
// a youth competition produces more turnovers. The profile is data so that a
// competition can carry its own without touching this file.
import { createMatch, matchReport } from './match';
import { ledger, type LossClass } from './ledger';
import { advanceCoreMutable } from './engine';
import type { CoreState, Direction } from './state';
import type { CharacterId } from './squads';
import { CHARACTERS } from './squads';

export type Band = { readonly min: number; readonly max: number };
export type RealismProfile = {
  readonly id: string;
  readonly note: string;
  readonly goals: Band;
  readonly shots: Band;
  readonly efficiency: Band;
  readonly possessions: Band;
  /** Attacks lost without a shot, all causes. See LossClass in ledger.ts. */
  readonly nonShotLoss: Band;
  /** One named cause of it, worth watching on its own. */
  readonly interceptions: Band;
  readonly fouls: Band;
  readonly suspensions: Band;
  readonly sevenMetres: Band;
  readonly blocks: Band;
  /** Share of all shots taken from each origin family. */
  readonly shotMix: Readonly<Record<'BACKCOURT' | 'WING' | 'CLOSE', Band>>;
  /** Share of shots taken while the defence was not yet organised. */
  readonly transitionShare: Band;
};

/**
 * One reference profile, drawn from senior European club handball.
 *
 * Every band is wide enough to admit a high-scoring and a low-scoring match of
 * the same sport. They are stated as ranges precisely so that nobody is tempted
 * to tune an engine to a mean.
 */
export const EHF_ELITE: RealismProfile = Object.freeze({
  id: 'EHF_ELITE',
  note: 'Senior European club handball, both teams combined, per match.',
  goals: { min: 42, max: 76 },
  shots: { min: 88, max: 150 },
  efficiency: { min: 0.42, max: 0.68 },
  possessions: { min: 84, max: 140 },
  nonShotLoss: { min: 14, max: 46 },
  interceptions: { min: 4, max: 34 },
  fouls: { min: 20, max: 70 },
  suspensions: { min: 0, max: 10 },
  sevenMetres: { min: 0, max: 14 },
  blocks: { min: 2, max: 28 },
  shotMix: { BACKCOURT: { min: 0.18, max: 0.55 }, WING: { min: 0.08, max: 0.34 }, CLOSE: { min: 0.12, max: 0.55 } },
  transitionShare: { min: 0.02, max: 0.35 },
});

export const PROFILES: Record<string, RealismProfile> = { EHF_ELITE };

export type MatchMeasure = {
  readonly seed: number;
  readonly direction: Direction;
  readonly complete: boolean;
  readonly goals: number;
  readonly shots: number;
  readonly efficiency: number;
  readonly possessions: number;
  /** Per-cause breakdown, read from the ledger. The canonical names. */
  readonly losses: Readonly<Record<LossClass, number>>;
  readonly nonShotLoss: number;
  readonly fouls: number;
  readonly suspensions: number;
  readonly sevenMetres: number;
  readonly blocks: number;
  readonly shotKinds: Readonly<Record<string, number>>;
  readonly shotMix: Readonly<Record<'BACKCOURT' | 'WING' | 'CLOSE', number>>;
  readonly transitionShare: number;
  readonly foulSeverity: Readonly<Record<string, number>>;
  readonly goalsByRole: Readonly<Record<string, number>>;
  readonly actionStarts: number;
  readonly score: Readonly<Record<string, number>>;
};

const BACKCOURT = new Set(['BACKCOURT_JUMP', 'STANDING']);
const WING = new Set(['WING']);

/** Read one finished match. Counts only; no judgement is applied here. */
export function measure(s: CoreState, seed: number, direction: Direction): MatchMeasure {
  const count: Record<string, number> = {};
  for (const e of s.events) count[e.type] = (count[e.type] ?? 0) + 1;
  const shots = s.events.filter(e => e.type === 'SHOT_RELEASED');
  const shotKinds: Record<string, number> = {};
  for (const e of shots) shotKinds[String(e.details.shotKind)] = (shotKinds[String(e.details.shotKind)] ?? 0) + 1;
  const severity: Record<string, number> = {};
  for (const e of s.events.filter(e => e.type === 'FOUL')) severity[String(e.details.severity)] = (severity[String(e.details.severity)] ?? 0) + 1;
  const goalsByRole: Record<string, number> = {};
  for (const e of s.events.filter(e => e.type === 'GOAL')) {
    const role = s.players.find(p => p.id === e.actorId)?.role ?? 'UNKNOWN';
    goalsByRole[role] = (goalsByRole[role] ?? 0) + 1;
  }
  // A shot taken while the possession had not yet settled is a transition shot.
  const transitionShots = s.events.filter(e => e.type === 'SHOT_RELEASED' && String(e.details.phase ?? '') === 'TRANSITION').length;
  const total = Math.max(1, shots.length);
  const backcourt = Object.entries(shotKinds).filter(([k]) => BACKCOURT.has(k)).reduce((n, [, v]) => n + v, 0);
  const wing = Object.entries(shotKinds).filter(([k]) => WING.has(k)).reduce((n, [, v]) => n + v, 0);
  const report = matchReport(s), book = ledger(s);
  return {
    seed, direction, complete: report.complete,
    goals: count.GOAL ?? 0,
    shots: shots.length,
    efficiency: (count.GOAL ?? 0) / total,
    // An ATTACK, which is what handball means by a possession: a spell in which
    // a team actually had the ball in play. Counting possession ids counted
    // every dead-ball fragment as well, and adding the two possession events
    // together counted a restart and the reception after it as two.
    possessions: book.attacks,
    // LOSSES COME FROM THE LEDGER, by name, and are not re-derived here.
    //
    // This used to count POSSESSION_CHANGED events by a non-goalkeeper and call
    // the result "turnovers". That number (25.8) and the ledger's count of
    // attacks ending without a shot (43.8) were both reported as turnovers in
    // the same breath and are not the same quantity: a three-second violation
    // awards a restart and records no possession change at all, so the event
    // count simply cannot see it. One definition, in one place.
    losses: book.losses,
    nonShotLoss: book.nonShotLoss,
    fouls: count.FOUL ?? 0,
    suspensions: (count.TWO_MINUTE_SUSPENSION ?? 0) + (count.DISQUALIFICATION ?? 0),
    sevenMetres: shotKinds.SEVEN_METRE ?? 0,
    blocks: count.SHOT_BLOCKED ?? 0,
    shotKinds, foulSeverity: severity, goalsByRole,
    shotMix: { BACKCOURT: backcourt / total, WING: wing / total, CLOSE: (shots.length - backcourt - wing) / total },
    transitionShare: transitionShots / total,
    actionStarts: count.ACTION_STARTED ?? 0,
    score: { ...s.score },
  };
}

export function runMatch(seed: number, direction: Direction = 'TOP', squads?: Record<'HOME' | 'AWAY', CharacterId>): CoreState {
  const s = createMatch(seed, direction, undefined, undefined, squads && { HOME: CHARACTERS[squads.HOME], AWAY: CHARACTERS[squads.AWAY] });
  let guard = 0;
  while (s.status === 'RUNNING' && guard++ < 400000) advanceCoreMutable(s);
  return s;
}

export type BandReport = { readonly metric: string; readonly value: number; readonly band: Band; readonly inside: boolean };

/** Compare one sample of matches against a profile. Reports, never throws. */
export function against(sample: readonly MatchMeasure[], profile: RealismProfile = EHF_ELITE): { rows: BandReport[]; outside: BandReport[]; mean: Record<string, number> } {
  const avg = (pick: (m: MatchMeasure) => number) => sample.reduce((n, m) => n + pick(m), 0) / Math.max(1, sample.length);
  const mean = {
    goals: avg(m => m.goals), shots: avg(m => m.shots), efficiency: avg(m => m.efficiency),
    possessions: avg(m => m.possessions), nonShotLoss: avg(m => m.nonShotLoss),
    interceptions: avg(m => m.losses.INTERCEPTION), technicalTurnovers: avg(m => m.losses.TECHNICAL_TURNOVER),
    duelLosses: avg(m => m.losses.DUEL_LOSS), receptionFailures: avg(m => m.losses.RECEPTION_FAILURE),
    badPassOut: avg(m => m.losses.BAD_PASS_OUT),
    fouls: avg(m => m.fouls), suspensions: avg(m => m.suspensions), sevenMetres: avg(m => m.sevenMetres),
    blocks: avg(m => m.blocks), backcourtShare: avg(m => m.shotMix.BACKCOURT), wingShare: avg(m => m.shotMix.WING),
    closeShare: avg(m => m.shotMix.CLOSE), transitionShare: avg(m => m.transitionShare), actionStarts: avg(m => m.actionStarts),
  };
  const rows: BandReport[] = [
    { metric: 'goals', value: mean.goals, band: profile.goals, inside: false },
    { metric: 'shots', value: mean.shots, band: profile.shots, inside: false },
    { metric: 'efficiency', value: mean.efficiency, band: profile.efficiency, inside: false },
    { metric: 'possessions', value: mean.possessions, band: profile.possessions, inside: false },
    { metric: 'nonShotLoss', value: mean.nonShotLoss, band: profile.nonShotLoss, inside: false },
    { metric: 'interceptions', value: mean.interceptions, band: profile.interceptions, inside: false },
    { metric: 'fouls', value: mean.fouls, band: profile.fouls, inside: false },
    { metric: 'suspensions', value: mean.suspensions, band: profile.suspensions, inside: false },
    { metric: 'sevenMetres', value: mean.sevenMetres, band: profile.sevenMetres, inside: false },
    { metric: 'blocks', value: mean.blocks, band: profile.blocks, inside: false },
    { metric: 'backcourtShare', value: mean.backcourtShare, band: profile.shotMix.BACKCOURT, inside: false },
    { metric: 'wingShare', value: mean.wingShare, band: profile.shotMix.WING, inside: false },
    { metric: 'closeShare', value: mean.closeShare, band: profile.shotMix.CLOSE, inside: false },
    { metric: 'transitionShare', value: mean.transitionShare, band: profile.transitionShare, inside: false },
  ].map(row => ({ ...row, inside: row.value >= row.band.min && row.value <= row.band.max }));
  return { rows, outside: rows.filter(r => !r.inside), mean };
}
