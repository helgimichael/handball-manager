'use client';
import { useEffect, useState, type ReactNode } from 'react';
import type { CoreEvent, CorePlayer, Role, TeamId } from '@handball-manager/handball-engine/src/v2/core/state';
import type { MatchCommand, ProductionMatchSession } from '@/lib/career/productionMatch';
import type { MatchControl } from '@/lib/media/discipline';
import { getClub } from '@/lib/game-data';
import { CoachingChoices, COACH_AGGRESSION_LABEL, COACH_ATTACK_LABEL, COACH_ROTATION_LABEL, COACH_SEVEN_V_SIX_LABEL, COACH_TEMPO_LABEL } from './CoachingChoices';
import { byEnergy, energyTone, initials, type MatchPhase } from '@/components/matchCenter/liveFlow';
import { EnergyBar } from '@/components/matchCenter/EnergyBar';

const ROLE_LABEL: Record<Role, string> = { LW: 'V6', LB: 'V9', CB: 'M9', RB: 'H9', RW: 'H6', P: 'M6', P2: 'M6', GK: 'MV' };
const EVENT_LABEL: Record<string, string> = { GOAL: 'Mål', SAVE_CAUGHT: 'Räddning', SAVE_PARRY: 'Räddning', WHISTLE_RESTART: 'Avblåsning', ADVANTAGE_REALIZED: 'Fördel spelad', TWO_MINUTE_SUSPENSION: 'Två minuter', DISQUALIFICATION: 'Rött kort', EXCHANGE_COMPLETED: 'Byte klart', TEAM_TIMEOUT_STARTED: 'Timeout', TACTICS_CHANGED: 'Taktiken ändras' };
type DockSection = 'timeout' | 'subs' | 'tactics';
const SECTION_LABEL: Record<DockSection, string> = { timeout: 'Timeout', subs: 'Byten', tactics: 'Taktik' };

function DockSectionFrame({ id, title, meta, open, onToggle, attention, className, children }: { id: DockSection; title: string; meta?: ReactNode; open: boolean; onToggle: () => void; attention?: boolean; className: string; children: ReactNode }) {
  return <section className={`mc-dock-section ${className}`} data-section={id} data-attention={attention || undefined}>
    <header className="mc-dock-section-head"><h3>{title}</h3>{meta}<button type="button" className="mc-dock-collapse" aria-expanded={open} aria-label={`${open ? 'Fäll ihop' : 'Visa'} ${title.toLowerCase()}`} onClick={onToggle}>{open ? '–' : '+'}</button></header>
    <div className="mc-dock-section-body" hidden={!open}>{children}</div>
  </section>;
}

/**
 * MDY-02g (A) Bench Dock -- the single home for every in-match decision: Timeout (availability first), Byten
 * (on-court players sorted by energy; tap one, then an eligible same-kind bench player, then confirm) and Taktik.
 * The same dock stays beside the timeout huddle and the half-time briefing. On a phone it is a bottom drawer with
 * tabs. Commands are the existing production-match commands; their guards are unchanged.
 */
export function LiveCoachPanel({ session, team, busy, outId, inId, onOut, onIn, onSubstitute, onCommand, recent, showEvents = true, phase = 'LIVE' }: { session: ProductionMatchSession; team: TeamId; busy: boolean; outId: string; inId: string; onOut: (id: string) => void; onIn: (id: string) => void; onSubstitute: () => void; onCommand: (command: MatchCommand) => void; recent: readonly CoreEvent[]; showEvents?: boolean; phase?: MatchPhase }) {
  const core = session.core;
  const disabled = busy || !!session.error || core.status !== 'RUNNING';
  const court = core.players.filter(p => p.team === team && p.population === 'COURT');
  const outgoing = court.find(p => p.id === outId);
  const pending = core.exchanges.find(e => e.team === team && e.phase !== 'COMPLETED' && e.phase !== 'CANCELLED');
  const replacements = outgoing ? core.players.filter(p => p.team === team && p.population === 'BENCH' && !p.condition.unavailable && !p.condition.exitRequired && !(p.condition.attacksRemaining > 0) && p.kind === outgoing.kind) : [];
  const incoming = replacements.find(p => p.id === inId);
  const usedTimeout = core.referee.teamTimeouts[team].includes(core.period);
  const match = core.match;
  // The guards below are the product's timeout rules; the texts are shown as the visible reason.
  const timeoutReason = disabled ? 'Matchen är stoppad.' : core.referee.timeout ? 'Spelavbrott pågår.' : match?.phase === 'PREMATCH' ? 'Timeout blir tillgänglig efter avkast och vid eget bollinnehav.' : !match || !['FIRST_HALF', 'SECOND_HALF'].includes(match.phase) ? 'Timeout under pågående halvlek.' : usedTimeout ? 'Din timeout i halvleken är använd.' : core.referee.resumeOnWhistle ? 'Vänta på domarens signal.' : core.possession.team !== team ? 'Timeout kräver eget bollinnehav.' : core.ball.flight && !core.ball.live ? 'Vänta tills bollen är i spel.' : core.officialClock.timeMs - match.periodStartMs >= match.periodLengthMs ? 'Halvleken är slut.' : null;
  const timeoutEvent = [...core.events].reverse().find(e => e.type === 'TEAM_TIMEOUT_STARTED');
  const timeoutTeam = timeoutEvent?.details.team as TeamId | undefined;
  const timeoutOwnerId = timeoutTeam === 'HOME' ? session.fixture.homeClubId : session.fixture.awayClubId;
  const possessionClubId = core.possession.team === 'HOME' ? session.fixture.homeClubId : session.fixture.awayClubId;
  const tactics = core.coaching[team];
  const personName = (id: string | null) => session.people.find(p => p.id === id)?.name ?? 'Spelare';
  const teamTimeoutActive = core.referee.timeout?.reason === 'TEAM_TIMEOUT';
  const tired = court.filter(p => energyTone(p.condition.energy * 100) === 'low');
  const offCourt = core.players.filter(p => p.team === team && p.population !== 'COURT');

  const [collapsed, setCollapsed] = useState<Record<DockSection, boolean>>({ timeout: false, subs: false, tactics: false });
  const [drawerOpen, setDrawerOpen] = useState(false), [mobileTab, setMobileTab] = useState<DockSection>('timeout');
  const [note, setNote] = useState<{ id: number; text: string } | null>(null);
  // A player picked elsewhere ("Byt" in Spelare) opens the dock on its Byten tab.
  const [seenOut, setSeenOut] = useState(outId);
  if (seenOut !== outId) { setSeenOut(outId); if (outId) { setDrawerOpen(true); setMobileTab('subs'); setCollapsed(c => ({ ...c, subs: false })); } }
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(n => n?.id === note.id ? null : n), 8000); return () => clearTimeout(t); }, [note]);

  function tactic(patch: Extract<MatchCommand, { kind: 'TACTICS' }>['patch'], label: string) {
    onCommand({ kind: 'TACTICS', team, patch });
    const when = phase === 'WALKOUT' ? 'gäller från avkast' : phase === 'HALFTIME' ? 'gäller från andra halvlek' : core.referee.timeout || phase === 'HUDDLE' ? 'gäller när spelet återupptas' : 'gäller från nästa anfall';
    setNote({ id: Date.now(), text: `${label} · ${when}` });
  }
  const toggle = (s: DockSection) => setCollapsed(c => ({ ...c, [s]: !c[s] }));

  function playerButton(player: CorePlayer, direction: 'out' | 'in') {
    const person = session.people.find(p => p.id === player.id);
    const energy = Math.round(player.condition.energy * 100);
    const selected = player.id === (direction === 'out' ? outId : inId);
    return <button type="button" key={player.id} className="coach-live-player mc-dock-player" aria-label={`${direction === 'out' ? 'Byt ut' : 'Byt in'} ${person?.name ?? player.id}`} aria-pressed={selected} data-active={selected} data-tone={energyTone(energy)} disabled={disabled || !!pending} onClick={() => direction === 'out' ? onOut(player.id) : onIn(player.id)}><span className="coach-live-number">{person?.number ?? '—'}</span><span><strong>{person?.name ?? player.id}</strong><small>{ROLE_LABEL[player.role]}</small></span><EnergyBar energy={energy} /></button>;
  }

  const timeoutMeta = <span className="mc-dock-pips" role="img" aria-label={usedTimeout ? 'Timeout använd i halvleken' : '1 timeout kvar i halvleken'}><b data-on={!usedTimeout || undefined} /></span>;
  const tabs = (['timeout', 'subs', 'tactics'] as const);
  return <aside className="game-sideline coach-live-panel mc-dock" aria-label="Dina matchbeslut" data-phase={phase.toLowerCase()} data-drawer={drawerOpen ? 'open' : 'closed'} data-mobile-tab={mobileTab}>
    <header className="coach-live-heading mc-dock-head">
      <button type="button" className="mc-dock-handle" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(!drawerOpen)}>
        <span>Bänken</span>
        <small>{timeoutReason ? 'Timeout ej tillgänglig' : 'Timeout tillgänglig'}{tired.length ? ` · ${tired.length} trött${tired.length > 1 ? 'a' : ''}` : ''}{pending ? ' · byte pågår' : ''}</small>
        <i aria-hidden="true">{drawerOpen ? '▾' : '▴'}</i>
      </button>
      <div className="mc-dock-title"><span className="hm-eyebrow">Bänken</span><h2>Dina matchbeslut</h2></div>
      <div className="coach-live-possession"><span>Bollinnehav</span><strong>{getClub(possessionClubId)?.shortName ?? possessionClubId}</strong></div>
      <div className="mc-dock-tabs" role="tablist" aria-label="Bänkens delar">{tabs.map(s => <button key={s} type="button" role="tab" aria-selected={mobileTab === s} onClick={() => { setMobileTab(s); setDrawerOpen(true); }}>{SECTION_LABEL[s]}{s === 'subs' && tired.length > 0 && <b className="mc-dock-badge">{tired.length}</b>}</button>)}</div>
    </header>

    <DockSectionFrame id="timeout" title="Timeout" className="mc-dock-timeout-section" meta={timeoutMeta} open={!collapsed.timeout} onToggle={() => toggle('timeout')} attention={!timeoutReason}>
      <div className="coach-timeout mc-dock-timeout" data-active={teamTimeoutActive}>
        <div><strong>{teamTimeoutActive ? `Timeout · ${getClub(timeoutOwnerId)?.shortName ?? 'Laget'}` : `Halvlek ${core.period}`}</strong><span>{usedTimeout ? 'Använd i denna halvlek' : '1 timeout kvar i halvleken'}</span></div>
        <button type="button" className="hm-btn mc-dock-timeout-btn" aria-label="Timeout" disabled={!!timeoutReason} title={timeoutReason ?? 'Ta timeout vid eget bollinnehav'} onClick={() => onCommand({ kind: 'TIMEOUT', team })}>Ta timeout</button>
        <p>{timeoutReason ?? 'Tillgänglig nu · eget bollinnehav.'}</p>
      </div>
    </DockSectionFrame>

    <DockSectionFrame id="subs" title="Byten" className="coach-live-substitution" meta={<span className="mc-dock-meta">{pending ? 'Byte pågår' : tired.length ? `${tired.length} under 60 % energi` : 'Tröttast först'}</span>} open={!collapsed.subs} onToggle={() => toggle('subs')} attention={tired.length > 0 && !pending}>
      {pending ? <div className="coach-pending-exchange" role="status"><strong>{personName(pending.outId)} → {personName(pending.inId)}</strong><p>{pending.phase === 'WAIT_EXIT' ? 'Spelaren lämnar planen innan ersättaren går in.' : 'Ersättaren är på väg in.'}</p></div> : <>
        {disabled && <p className="coach-small-empty">Byten görs när matchen är igång.</p>}
        <div className="coach-live-out-list" aria-label="Spelare ut">{byEnergy(court, p => p.condition.energy).map(p => playerButton(p, 'out'))}</div>
        {outgoing && <div className="coach-live-in">
          <span className="hm-eyebrow">Ersätt {personName(outgoing.id)} · {ROLE_LABEL[outgoing.role]}</span>
          <div className="coach-live-in-list" aria-label="Spelare in">{byEnergy(replacements, p => p.condition.energy, 'desc').map(p => playerButton(p, 'in'))}</div>
          {!replacements.length && <p className="coach-small-empty">Ingen tillgänglig ersättare på bänken.</p>}
          <div className="coach-sub-confirm">{incoming ? <p>{personName(outgoing.id)} <b>→</b> {personName(incoming.id)}</p> : <p>Välj vem som går in.</p>}<button type="button" className="hm-btn hm-btn-primary" disabled={disabled || !outgoing || !incoming} onClick={onSubstitute}>Genomför byte</button></div>
        </div>}
        {!outgoing && !disabled && <p className="mc-dock-hint">Tryck på en spelare på planen för att se vem som kan gå in.</p>}
      </>}
      <details className="coach-bench-status"><summary>Bänk & tillgänglighet ({offCourt.length})</summary>{byEnergy(offCourt, p => p.condition.energy, 'desc').map(p => <p key={p.id}><strong>{personName(p.id)}</strong><span>{p.population === 'DISQUALIFIED' ? 'Rött kort' : p.population === 'SUSPENDED' ? 'Utvisad' : p.condition.unavailable || p.condition.exitRequired ? 'Ej tillgänglig' : p.condition.attacksRemaining > 0 ? 'Väntar på återinträde' : 'Bänk'}</span><EnergyBar energy={p.condition.energy * 100} /></p>)}</details>
    </DockSectionFrame>

    <DockSectionFrame id="tactics" title="Taktik" className="coach-live-tactics" open={!collapsed.tactics} onToggle={() => toggle('tactics')}>
      <CoachingChoices defence={tactics.defence} aggression={tactics.aggression ?? 'BALANCED'} tempo={tactics.tempo} attack={tactics.attackIdentity} disabled={disabled}
        onDefence={value => tactic({ defence: value }, `Försvar ${value}`)}
        onAggression={value => tactic({ aggression: value }, `Aggressivitet ${COACH_AGGRESSION_LABEL[value]}`)}
        rotation={tactics.rotationStrategy ?? 'BALANCED'} onRotation={value => tactic({ rotationStrategy: value }, `Rotation ${COACH_ROTATION_LABEL[value]}`)}
        sevenVSix={tactics.sevenVSix ?? 'OFF'} onSevenVSix={value => tactic({ sevenVSix: value }, `7 mot 6 ${COACH_SEVEN_V_SIX_LABEL[value]}`)}
        onTempo={value => tactic({ tempo: value }, `Tempo ${COACH_TEMPO_LABEL[value]}`)}
        onAttack={value => tactic({ attackIdentity: value }, `Anfall ${COACH_ATTACK_LABEL[value]}`)} />
      {note && <p className="mc-dock-note" role="status">{note.text}</p>}
      {disabled && <p className="coach-small-empty">Taktiken kan ändras när matchen är igång.</p>}
    </DockSectionFrame>

    <footer className="mc-dock-foot">
      <button type="button" role="switch" className="mc-dock-switch" aria-checked={tactics.rotation} disabled={disabled} onClick={() => onCommand({ kind: 'TACTICS', team, patch: { rotation: !tactics.rotation } })}><i aria-hidden="true" /><span>Assistentbyten</span><b>{tactics.rotation ? 'På' : 'Av'}</b></button>
      <small>{tactics.rotation ? 'Assisterande tränaren byter trötta spelare enligt rotationen.' : 'Du gör alla byten själv.'}</small>
    </footer>
    {showEvents && <section className="coach-live-events"><h3>Från planen</h3>{recent.length ? recent.map(event => <div className="coach-live-event" key={event.id}><time>{Math.floor(event.officialMs / 60000)}′</time><div><strong>{EVENT_LABEL[event.type] ?? 'Matchhändelse'}</strong><span>{event.actorId ? personName(event.actorId) : event.details.team === 'HOME' ? getClub(session.fixture.homeClubId)?.shortName : event.details.team === 'AWAY' ? getClub(session.fixture.awayClubId)?.shortName : ''}</span></div></div>) : <p className="coach-small-empty">Matchens händelser visas här från avkast.</p>}</section>}
  </aside>;
}

/** MDY-02k (A) Assistant dock: when the manager is suspended the dock shows who leads the team and the current
 *  tactics read-only. No command is offered (the production match refuses them while the assistant leads). */
export function AssistantDock({ session, team, control }: { session: ProductionMatchSession; team: TeamId; control: Extract<MatchControl, { by: 'ASSISTANT' }> }) {
  const t = session.core.coaching[team], used = session.core.referee.teamTimeouts[team].includes(session.core.period);
  const rows: [string, string][] = [['Försvar', t.defence], ['Aggressivitet', COACH_AGGRESSION_LABEL[t.aggression ?? 'BALANCED']], ['Tempo', COACH_TEMPO_LABEL[t.tempo]], ['Anfall', COACH_ATTACK_LABEL[t.attackIdentity]], ['Rotation', COACH_ROTATION_LABEL[t.rotationStrategy ?? 'BALANCED']], ['7 mot 6', COACH_SEVEN_V_SIX_LABEL[t.sevenVSix ?? 'OFF']], ['Assistentbyten', t.rotation ? 'På' : 'Av'], ['Timeout', used ? 'Använd i halvleken' : '1 kvar i halvleken']];
  return <aside className="game-sideline mc-dock mday-control" data-readonly="true" role="status" aria-label="Vem leder laget">
    <header className="mc-dock-head mc-assistant-head"><span className="mc-assistant-face" aria-hidden="true">{initials(control.name)}</span><div><span className="hm-eyebrow">Bänken · skrivskyddad</span><b>{control.name} leder laget</b></div></header>
    <p>{control.reason}</p>
    <p>Assisterande tränaren gör byten och tar timeout efter matchplanen du förberedde. Du kan följa matchen men inte ge instruktioner. Kontrollen återgår när avstängningen är avtjänad.</p>
    <dl className="mc-assistant-tactics">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
  </aside>;
}
