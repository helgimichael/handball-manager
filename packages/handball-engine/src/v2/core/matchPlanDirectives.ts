/**
 * HM-PLAYTEST-01 WS2: the manager's handball match plan, as the engine reads it.
 *
 * Optional and additive. A side with no `plan` on its TeamTactics plays exactly
 * as before (CPU sides, every existing test and every saved match). A side with
 * one gets:
 *
 *   pairs          attack-defence exchanges: A attacks, B defends in A's
 *                  place. Requested at the change of possession through the
 *                  ordinary physical exchange (own substitution line, one at a
 *                  time, never for a suspended or unavailable player), so the
 *                  player count is never wrong and nobody teleports.
 *   units          situational lineups -- 6v5 in attack while the opponent is
 *                  a man short, 5v6 in defence while we are. Reached the same
 *                  way, one legal exchange at a time.
 *   defenceZones   who defends in which space of the 6:0 / 5:1 line.
 *   penaltyTakers  the 7-metre order, first available court player wins.
 *   sevenVSixPlayerId  the preferred seventh court player.
 *
 * No randomness is consumed here, so a plan never shifts the RNG stream.
 */
import { courtLimit, exchangeActive, requestExchange } from './population';
import { courtPlayers, otherTeam, type CorePlayer, type CoreState, type Role, type TeamId } from './state';

export type UnitSituation = 'ATTACK_6V5' | 'DEFENCE_5V6';
export type UnitEntry = { readonly playerId: string; readonly role?: Role; readonly zone?: number };
export type TeamMatchPlan = {
  readonly pairs?: readonly { readonly attackId: string; readonly defenceId: string }[];
  readonly units?: Partial<Record<UnitSituation, readonly UnitEntry[]>>;
  readonly defenceZones?: Readonly<Record<string, number>>;
  readonly penaltyTakers?: readonly string[];
  readonly sevenVSixPlayerId?: string;
};

const planOf = (s: CoreState, team: TeamId): TeamMatchPlan | undefined => s.coaching[team]?.plan;

/** Which numerical situation, if any, this side is in right now. */
export function unitSituation(s: CoreState, team: TeamId): UnitSituation | null {
  const own = courtLimit(s, team), other = courtLimit(s, otherTeam(team));
  const attacking = s.possession.team === team;
  if (attacking && own > other) return 'ATTACK_6V5';
  if (!attacking && own < other) return 'DEFENCE_5V6';
  return null;
}

/** The defensive space the plan gives this player, if it gives one. */
export function plannedDefenceZone(s: CoreState, player: CorePlayer): number | undefined {
  const plan = planOf(s, player.team);
  if (!plan) return undefined;
  const situation = unitSituation(s, player.team);
  const unitZone = situation === 'DEFENCE_5V6' ? plan.units?.DEFENCE_5V6?.find(e => e.playerId === player.id)?.zone : undefined;
  return unitZone ?? plan.defenceZones?.[player.id];
}

/** The planned 7-metre taker among the players who could take it. */
export function plannedPenaltyTaker(s: CoreState, team: TeamId, candidates: readonly CorePlayer[]): CorePlayer | undefined {
  for (const id of planOf(s, team)?.penaltyTakers ?? []) {
    const p = candidates.find(c => c.id === id && c.kind === 'FIELD_PLAYER');
    if (p) return p;
  }
  return undefined;
}

export function plannedSeventhPlayer(s: CoreState, team: TeamId, ready: (p: CorePlayer) => boolean): CorePlayer | undefined {
  const id = planOf(s, team)?.sevenVSixPlayerId;
  const p = id ? s.players.find(x => x.id === id) : undefined;
  return p && ready(p) && p.kind === 'FIELD_PLAYER' ? p : undefined;
}

/**
 * One step towards the side's planned unit for the current phase. At most one
 * exchange per call, and only when the team has none in progress.
 */
export function matchPlanBefore(s: CoreState, team: TeamId): void {
  const plan = planOf(s, team);
  if (!plan || s.flow.sevenVTeam === team || s.restart?.kind === 'SEVEN_METRE') return;
  if (s.exchanges.some(e => e.team === team && e.phase !== 'COMPLETED' && e.phase !== 'CANCELLED')) return;
  const court = courtPlayers(s, team).filter(p => p.kind === 'FIELD_PLAYER');
  const movable = (p: CorePlayer) => p.id !== s.ball.controllerId && !p.airborne && !exchangeActive(s, p.id);
  const ready = (p: CorePlayer | undefined): p is CorePlayer => !!p && p.team === team && p.population === 'BENCH' && p.kind === 'FIELD_PLAYER' &&
    !p.condition.unavailable && !p.condition.exitRequired && p.condition.attacksRemaining === 0 && p.suspensionUntilMs === null;
  const byId = (id: string) => s.players.find(p => p.id === id);

  const situation = unitSituation(s, team);
  const unit = situation ? plan.units?.[situation] : undefined;
  if (unit && unit.length) {
    const wanted = new Set(unit.map(e => e.playerId));
    for (const entry of unit) {
      const incoming = byId(entry.playerId);
      if (!ready(incoming)) continue;
      const outgoing = court.filter(p => !wanted.has(p.id) && movable(p))
        .sort((a, b) => Number(b.role === entry.role) - Number(a.role === entry.role) || a.condition.energy - b.condition.energy || a.id.localeCompare(b.id))[0];
      if (outgoing && requestExchange(s, team, outgoing.id, incoming.id, entry.role)) return;
    }
    return;
  }

  const attacking = s.possession.team === team;
  for (const pair of plan.pairs ?? []) {
    const [onId, offId] = attacking ? [pair.attackId, pair.defenceId] : [pair.defenceId, pair.attackId];
    const incoming = byId(onId), outgoing = byId(offId);
    if (!ready(incoming) || !outgoing || outgoing.population !== 'COURT' || !movable(outgoing)) continue;
    if (requestExchange(s, team, outgoing.id, incoming.id)) return;
  }
}
