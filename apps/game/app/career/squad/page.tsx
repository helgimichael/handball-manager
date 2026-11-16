'use client';
// Arena Nights C5.3 -- SQD-01 (A) Squad Matrix: control panel (views, search, position segments, state, density),
// a player-chip roster with sortable columns per saved view, a multi-select tray with bulk actions, Peek on row
// click, and ranked cards on phones. Data and write paths are the existing career operations.
// Saved views: SQD-01a Översikt (expandable rows), SQD-01c Fysisk status (heat-strip), SQD-01b Prestation
// (position-aware tables), SQD-01d Kontraktsrisk (countdown + renewal drawer), Utveckling; SQD-01g empty state.
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { useWorkspaceState } from '@/components/game/WorkspaceMemory';
import { useCareer } from '@/lib/career/CareerContext';
import { getCareerClub, getCareerSquad } from '@/lib/career/careerWorld';
import { isSelectableForMatch } from '@/lib/career/playerStatus';
import { SQUAD_STATUS_TIERS, SQUAD_STATUS_TIER_LABEL_SV, type SquadStatusTier } from '@/lib/career/squadStatus';
import { formatMoney } from '@/lib/economy/currency';
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE } from '@/lib/economy/labels';
import { useMoney } from '@/lib/settings/usePreferences';
import { RECOVERY_OUTLOOK_LABEL, WORKLOAD_TREND_LABEL } from '@/lib/training/readinessSummary';
import { clubColorVars, playerAvailabilityLabel } from '@/components/game/Identity';
import { DepthCourt } from '@/components/club/ClubJournal';
import { positionDepth } from '@/lib/club/clubJournal';
import { EnvironmentBanner } from '@/components/clubhq/EnvironmentBanner';
import { getPlayerFormHistory } from '@/lib/career/playerForm';
import { PlayerFormSparkline } from '@/components/players/PlayerFormSparkline';
import { matchFitnessOf } from '@/lib/players/matchFitness';
import { currentTeamRoles } from '@/lib/career/teamRoles';
import { applyTrayAction, buildMatrixRows, cardMetrics, contractCountdownPct, explainEmpty, filterSortMatrix, MATRIX_VIEWS, POSITIONS, readinessRisk, type MatrixColumn, type MatrixDensity, type MatrixRow, type MatrixView, type StateFilter, type TrayAction } from '@/lib/career/squadMatrix';
import { ExplainingEmpty, OverviewTable, PerformanceTables, ReadinessLegend, ReadinessStripTable } from '@/components/players/SquadViews';
import { RenewalDrawer } from '@/components/players/RenewalDrawer';
import { PlayerChip } from '@/components/shell/PlayerChip';
import PlayerPeek from '@/components/shell/PlayerPeek';
import type { CareerState } from '@/lib/career/types';

const LOAD_LABEL: Record<string, string> = { FULL: 'Full', REDUCED: 'Reducerad', RECOVERY_ONLY: 'Endast återhämtning', REST: 'Vila' };
const stars = (n: number | null) => n == null ? '—' : '★'.repeat(Math.round(n)) + '☆'.repeat(Math.max(0, 5 - Math.round(n)));

/** Column header, sort key and numeric alignment per column. */
const COLUMNS: Record<MatrixColumn, { label: string; title?: string; sort?: keyof MatrixRow; numeric?: boolean }> = {
  position: { label: 'Pos', sort: 'position' }, age: { label: 'Ålder', sort: 'age', numeric: true }, role: { label: 'Trupproll', sort: 'role' },
  energy: { label: 'Energi', sort: 'energy', numeric: true }, fitness: { label: 'Matchträning', title: 'Matchträning: van vid matchtempo. Byggs av speltid och sjunker utan matcher.', sort: 'fitness', numeric: true },
  availability: { label: 'Tillgänglighet', sort: 'available' }, returnDate: { label: 'Återkomst', sort: 'returnDate' }, morale: { label: 'Moral', title: 'Moral 0-100: hur nöjd spelaren är just nu', sort: 'morale', numeric: true },
  load: { label: 'Belastning 7 d', sort: 'load', numeric: true }, trend: { label: 'Trend', title: 'Senaste 7 dagarna jämfört med snittet för de senaste 4 veckorna' }, recovery: { label: 'Återhämtning' },
  appearances: { label: 'M', sort: 'appearances', numeric: true }, starts: { label: 'Starter', sort: 'starts', numeric: true }, goals: { label: 'Mål', sort: 'goals', numeric: true },
  shotPct: { label: 'Skott %', sort: 'shotPct', numeric: true }, savePct: { label: 'Räddn %', sort: 'savePct', numeric: true }, rating: { label: 'Betyg', sort: 'rating', numeric: true },
  form: { label: 'Form (5M)', title: 'Formkurva för de senaste 5 matcherna' }, shots: { label: 'Skott', sort: 'shots', numeric: true }, shotsFaced: { label: 'Mötta skott', sort: 'shotsFaced', numeric: true },
  contractEnd: { label: 'Avtal till', sort: 'contractEnd' }, daysLeft: { label: 'Dagar kvar', sort: 'daysLeft', numeric: true }, wage: { label: 'Lön / månad', sort: 'wage', numeric: true },
  contractStatus: { label: 'Status', sort: 'contractStatus' }, contractAction: { label: 'Åtgärd' },
  current: { label: 'Nivå', title: 'Tränarstabens bedömning av nuvarande nivå', sort: 'current', numeric: true }, potential: { label: 'Potential', title: 'Scoutingens uppskattning — osäker', sort: 'potential', numeric: true },
  trainingLoad: { label: 'Träningsbelastning', sort: 'trainingLoad' }, focus: { label: 'Individuellt fokus' },
  readiness: { label: 'Beredskap', sort: 'energy', numeric: true }, output: { label: 'Mål / Räddn %', sort: 'goals', numeric: true },
  goalsPerMatch: { label: 'Mål/match', sort: 'goalsPerMatch', numeric: true }, savesPerMatch: { label: 'Räddn/match', sort: 'savesPerMatch', numeric: true },
};

export default function SquadPage() {
  useMoney();
  const { career, updateSquadStatus, updateCareer, setPlayerTrainingLoad } = useCareer();
  const club = getCareerClub(career);
  const [query, setQuery] = useWorkspaceState('squad.query', '');
  const [position, setPosition] = useWorkspaceState('squad.position', 'ALL');
  const [status, setStatus] = useWorkspaceState<StateFilter>('squad.status', 'ALL');
  const [view, setView] = useWorkspaceState<MatrixView>('squad.matrixView', 'OVERVIEW');
  const [density, setDensity] = useWorkspaceState<MatrixDensity>('squad.density', 'COMPACT');
  const [formMode, setFormMode] = useWorkspaceState<'APPEARANCES' | 'FIXTURES'>('squad.formMode', 'APPEARANCES');
  const [selected, setSelected] = useWorkspaceState<string[]>('squad.selected', []);
  const [sort, setSort] = useWorkspaceState<{ key: keyof MatrixRow; direction: 'asc' | 'desc' }>('squad.matrixSort', { key: 'position', direction: 'asc' });
  const [peekId, setPeekId] = useState<string | null>(null);
  const [trayNote, setTrayNote] = useState<string | null>(null);
  const [riskSort, setRiskSort] = useWorkspaceState('squad.riskSort', false);
  const [renewalId, setRenewalId] = useState<string | null>(null);
  const closeRenewal = useCallback(() => setRenewalId(null), []);
  const squad = getCareerSquad(career);
  const all = useMemo(() => buildMatrixRows(career), [career]);
  const spec = MATRIX_VIEWS.find(v => v.id === view) ?? MATRIX_VIEWS[0]!;
  const rows = useMemo(() => {
    const sorted = filterSortMatrix(all, { query, position, state: status, sortKey: sort.key, direction: sort.direction });
    return spec.id === 'READINESS' && riskSort ? [...sorted].sort((a, b) => readinessRisk(b) - readinessRisk(a) || a.name.localeCompare(b.name, 'sv')) : sorted;
  }, [all, query, position, status, sort, spec.id, riskSort]);
  const columns = density === 'DETAILED' ? [...spec.columns, ...spec.detailed.filter(c => !spec.columns.includes(c))] : spec.columns;
  const available = squad.filter(p => isSelectableForMatch(career.playerStatuses, p.id)).length;
  const tired = all.filter(r => r.energy < 75).length;
  const avgFit = squad.length ? Math.round(squad.reduce((acc, p) => acc + matchFitnessOf(career, p.id), 0) / squad.length) : 100;
  const roles = currentTeamRoles(career);
  const captainPlayer = roles.captainId ? squad.find(p => p.id === roles.captainId) : undefined;
  const chosen = selected.filter(id => all.some(r => r.id === id));
  const peek = peekId ? all.find(r => r.id === peekId) : undefined;
  const form = (id: string) => <PlayerFormSparkline entries={getPlayerFormHistory(career, id, formMode, 5)} />;

  const onSort = (key: keyof MatrixRow, numeric?: boolean) => { setRiskSort(false); setSort(sort.key === key ? { key, direction: sort.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: numeric ? 'desc' : 'asc' }); };
  // SQD-01d: the contract-risk view opens sorted by days left (most urgent first).
  const pickView = (id: MatrixView) => { setView(id); if (id === 'CONTRACT_RISK') setSort({ key: 'daysLeft', direction: 'asc' }); };
  const resetFilters = () => { setQuery(''); setPosition('ALL'); setStatus('ALL'); };
  const roleSelect = (r: MatrixRow) => <select className="hm-select" aria-label={`Trupproll ${r.name}`} value={r.role} onChange={e => updateSquadStatus(r.id, e.target.value as SquadStatusTier)}>{SQUAD_STATUS_TIERS.map(t => <option key={t} value={t}>{SQUAD_STATUS_TIER_LABEL_SV[t]}</option>)}</select>;
  const availabilityBadge = (r: MatrixRow) => <span className={`hm-badge hm-badge-${r.available ? 'neutral' : 'negative'}`}>{playerAvailabilityLabel(career, r.id)}</span>;
  const toggle = (id: string, on: boolean) => setSelected(prev => on ? [...new Set([...prev, id])] : prev.filter(x => x !== id));
  function tray(action: TrayAction, label: string) {
    const result = applyTrayAction(career, chosen, action);
    updateCareer((s: CareerState) => s === career ? result.state : applyTrayAction(s, chosen, action).state);
    const names = result.skipped.map(x => `${all.find(r => r.id === x.id)?.name ?? x.id} (${x.reason})`);
    setTrayNote(`${label}: ${chosen.length - result.skipped.length} spelare.${names.length ? ` Hoppade över ${names.join(', ')}.` : ''}`);
  }

  const cell = (c: MatrixColumn, r: MatrixRow) => {
    switch (c) {
      case 'position': return <span className="hm-position-code">{r.position}</span>;
      case 'age': return r.age ?? '—';
      case 'role': return roleSelect(r);
      case 'energy': return <span className="hm-roster-energy" data-low={r.energy < 75}>{r.energy}%</span>;
      case 'fitness': return <span className="hm-roster-energy" data-low={r.fitness < 50}>{r.fitness}%</span>;
      case 'availability': return availabilityBadge(r);
      case 'returnDate': return r.returnDate ?? '—';
      case 'morale': return <span className="pd-morale-badge" data-tone={r.moraleTone}>{r.morale}</span>;
      case 'load': return r.load ?? '—';
      case 'trend': return r.trend ? WORKLOAD_TREND_LABEL[r.trend as keyof typeof WORKLOAD_TREND_LABEL] : '—';
      case 'recovery': return RECOVERY_OUTLOOK_LABEL[r.recovery as keyof typeof RECOVERY_OUTLOOK_LABEL] ?? '—';
      case 'appearances': return r.appearances;
      case 'starts': return r.starts;
      case 'goals': return r.goals;
      case 'shotPct': return r.shotPct == null ? '—' : `${r.shotPct}%`;
      case 'savePct': return r.savePct == null ? '—' : `${r.savePct}%`;
      case 'rating': return r.rating == null ? '—' : r.rating.toFixed(1);
      case 'form': return form(r.id);
      case 'shots': return r.shots;
      case 'shotsFaced': return r.shotsFaced;
      case 'contractEnd': return r.contractEnd ?? '—';
      case 'daysLeft': {
        const pct = contractCountdownPct(r.daysLeft);
        return pct == null ? '—' : <span className="sq-countdown" data-urgent={r.daysLeft! <= 180} data-soon={r.daysLeft! <= 365}><i style={{ width: `${pct}%` }} aria-hidden="true" /><b>{r.daysLeft}</b></span>;
      }
      case 'wage': return formatMoney(r.wage);
      case 'contractStatus': {
        if (!r.contractStatus) return '—';
        const key = r.contractStatus as keyof typeof CONTRACT_STATUS_TONE;
        const tone = CONTRACT_STATUS_TONE[key] === 'positive' ? 'neutral' : CONTRACT_STATUS_TONE[key];
        return <span className={`hm-badge hm-badge-${tone}`}>{CONTRACT_STATUS_LABEL[key]}</span>;
      }
      case 'contractAction': return <span className="sq-contract-actions"><button type="button" className="hm-btn hm-btn-sm hm-btn-primary" onClick={() => setRenewalId(r.id)}>Förläng</button><Link href={`/career/squad/${encodeURIComponent(r.id)}?tab=contract`} aria-label={`Kontrakt i profilen för ${r.name}`}>Profil →</Link></span>;
      case 'current': return <span className="hm-stars" aria-label={`${r.current ?? 0} av 5`}>{stars(r.current)}</span>;
      case 'potential': return <span className="hm-stars" aria-label={`${r.potential ?? 0} av 5`}>{stars(r.potential)}</span>;
      case 'trainingLoad': return LOAD_LABEL[r.trainingLoad] ?? r.trainingLoad;
      case 'focus': return r.focus ?? '—';
      case 'readiness': return `${r.energy}% / ${r.fitness}%`;
      case 'output': return r.position === 'MV' ? (r.savePct == null ? '—' : `${r.savePct}%`) : r.goals;
      case 'goalsPerMatch': return r.goalsPerMatch ?? '—';
      case 'savesPerMatch': return r.savesPerMatch ?? '—';
    }
  };

  return <div className="hm-squad-screen hm-matrix-screen" style={clubColorVars(club)} data-density={density}>
    <EnvironmentBanner
      environment="dressing-room"
      eyebrow={`${club.name} · Omklädningsrummet · ${career.seasonId}`}
      title="Truppen & Omklädningsrummet"
      subtitle="Din startsjua, din rotation och lagets inre hierarki. Granska form, belastning, kontrakt och utse kaptener."
      badge={`${available}/${squad.length} redo för spel`}
      actions={<><Link className="hm-btn hm-btn-sm hm-btn-primary" href="/career/tactics">Matchtrupp & Taktiktavla →</Link><Link className="hm-btn hm-btn-sm" href="/career/contracts">Kontrakt & Förlängningar →</Link></>}
      metrics={[
        { label: 'Truppstorlek', value: `${squad.length} spelare`, sub: `${available} tillgängliga`, tone: available === squad.length ? 'positive' : 'warning' },
        { label: 'Matchträning', value: `${avgFit}%`, sub: `${tired} under 75% energi`, tone: tired === 0 ? 'positive' : 'warning' },
        { label: 'Lagkapten', value: captainPlayer ? captainPlayer.lastName : 'Ej utsedd', sub: captainPlayer ? `#${captainPlayer.shirtNumber} ${captainPlayer.position}` : 'Välj i truppen', tone: 'signal' },
      ]}
    />
    {/* Arena Nights Phase 3 (SQD-01f B): the depth court is the position filter -- tap a spot, tap again to clear. */}
    <section className="cj-squad-depth" aria-labelledby="cj-squad-depth-h">
      <header><h2 id="cj-squad-depth-h">Truppens balans</h2><Link href="/career/tactics">Taktiktavla →</Link></header>
      <DepthCourt depth={positionDepth(career, squad)} selected={position === 'ALL' ? null : position} onSelect={p => setPosition(p ?? 'ALL')} />
    </section>

    <section className="hm-matrix-controls" aria-label="Truppmatrisens kontrollpanel">
      <div className="hm-matrix-views" role="tablist" aria-label="Sparade vyer">
        {MATRIX_VIEWS.map(v => <button key={v.id} role="tab" aria-selected={spec.id === v.id} onClick={() => pickView(v.id)}>{v.label}</button>)}
      </div>
      <label className="hm-matrix-search">Sök spelare<input className="hm-input" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <div className="hm-matrix-positions" role="group" aria-label="Positionsfilter">
        <button aria-pressed={position === 'ALL'} onClick={() => setPosition('ALL')}>Alla</button>
        {POSITIONS.map(p => <button key={p} aria-pressed={position === p} onClick={() => setPosition(p)} title={`${squad.filter(x => x.position === p && isSelectableForMatch(career.playerStatuses, x.id)).length} tillgängliga`}>{p}</button>)}
      </div>
      <label>Position<select className="hm-select" value={position} onChange={e => setPosition(e.target.value)}>{['ALL', 'MV', 'V6', 'V9', 'M9', 'M6', 'H9', 'H6'].map(p => <option key={p} value={p}>{p === 'ALL' ? 'Alla' : p}</option>)}</select></label>
      <label>Tillstånd<select className="hm-select" value={status} onChange={e => setStatus(e.target.value as StateFilter)}><option value="ALL">Alla</option><option value="AVAILABLE">Tillgängliga</option><option value="UNAVAILABLE">Otillgängliga</option><option value="TIRED">Energi under 75%</option></select></label>
      <label>Formvisning<select className="hm-select" value={formMode} onChange={e => setFormMode(e.target.value as 'APPEARANCES' | 'FIXTURES')}><option value="APPEARANCES">Senaste 5 spelade</option><option value="FIXTURES">Senaste 5 matcherna (inkl. DNP)</option></select></label>
      <div className="hm-matrix-density" role="group" aria-label="Täthet">
        <button aria-pressed={density === 'COMPACT'} onClick={() => setDensity('COMPACT')}>Kompakt</button>
        <button aria-pressed={density === 'DETAILED'} onClick={() => setDensity('DETAILED')}>Detaljerad</button>
      </div>
      <button className="hm-btn hm-btn-sm hm-btn-ghost" onClick={resetFilters}>Rensa filter</button>
      <span className="hm-matrix-count" aria-live="polite">{rows.length} av {squad.length} spelare</span>
    </section>

    {spec.id === 'READINESS' && <ReadinessLegend />}
    {!rows.length ? <ExplainingEmpty explanation={explainEmpty(all, { query, position, state: status })} onReset={resetFilters} onPick={id => { resetFilters(); setPeekId(id); }} />
      : spec.id === 'OVERVIEW' ? <OverviewTable rows={rows} sort={sort} onSort={onSort} form={form} role={roleSelect} selected={chosen} onToggle={toggle} onPeek={setPeekId} />
      : spec.id === 'READINESS' ? <ReadinessStripTable rows={rows} sort={sort} onSort={onSort} riskSort={riskSort} onRiskSort={() => setRiskSort(!riskSort)} availability={availabilityBadge} onLoad={setPlayerTrainingLoad} />
      : spec.id === 'PERFORMANCE' ? <PerformanceTables rows={rows} sort={sort} onSort={onSort} form={form} />
      : <>
    <div className="hm-scroll-x hm-matrix-table-wrap">
      <table className="hm-table hm-roster-table hm-matrix-table">
        <thead><tr>
          <th className="hm-matrix-select"><input type="checkbox" aria-label="Välj alla synliga spelare" checked={rows.length > 0 && rows.every(r => chosen.includes(r.id))} onChange={e => setSelected(e.target.checked ? [...new Set([...chosen, ...rows.map(r => r.id)])] : chosen.filter(id => !rows.some(r => r.id === id)))} /></th>
          <th className="hm-matrix-chip-h" aria-sort={sort.key === 'name' ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}><button className="hm-sort" onClick={() => onSort('name')}>Spelare{sort.key === 'name' ? (sort.direction === 'asc' ? ' ▲' : ' ▼') : ''}</button></th>
          {columns.map(c => { const col = COLUMNS[c]; const active = col.sort && sort.key === col.sort; return <th key={c} title={col.title} data-numeric={col.numeric} aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}>{col.sort ? <button className="hm-sort" onClick={() => onSort(col.sort!, col.numeric)}>{col.label}{active ? (sort.direction === 'asc' ? ' ▲' : ' ▼') : ''}</button> : col.label}</th>; })}
          <th className="hm-matrix-peek-h"><span className="hm-sr-only">Snabbtitt</span></th>
        </tr></thead>
        <tbody>{rows.map(r => <tr key={r.id} data-highlight={chosen.includes(r.id)} data-unavailable={!r.available}>
          <td className="hm-matrix-select"><input type="checkbox" aria-label={`Välj ${r.name}`} checked={chosen.includes(r.id)} onChange={e => toggle(r.id, e.target.checked)} /></td>
          <td className="hm-matrix-chip"><PlayerChip row={r} /></td>
          {columns.map(c => <td key={c} data-numeric={COLUMNS[c].numeric} data-col={c}>{cell(c, r)}</td>)}
          <td className="hm-matrix-peek"><button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => setPeekId(r.id)} aria-label={`Snabbtitt ${r.name}`} title="Snabbtitt">⋯</button></td>
        </tr>)}</tbody>
      </table>
    </div>

    <ol className="hm-matrix-cards" aria-label={`${spec.label}: spelarkort`}>
      {rows.map(r => <li key={r.id} data-highlight={chosen.includes(r.id)}>
        <label className="hm-matrix-card-select"><input type="checkbox" aria-label={`Välj ${r.name} (kort)`} checked={chosen.includes(r.id)} onChange={e => toggle(r.id, e.target.checked)} /></label>
        <PlayerChip row={r} form={form(r.id)} />
        <dl>{cardMetrics(spec.id).map(c => <div key={c}><dt>{COLUMNS[c].label}</dt><dd>{cell(c, r)}</dd></div>)}</dl>
        <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => setPeekId(r.id)} aria-label={`Snabbtitt ${r.name} (kort)`}>⋯</button>
      </li>)}
    </ol>
    </>}

    {chosen.length > 0 && <aside className="hm-matrix-tray" aria-label="Valda spelare" aria-live="polite">
      <strong>{chosen.length} {chosen.length === 1 ? 'vald' : 'valda'}</strong>
      {chosen.length === 2 ? <Link className="hm-btn hm-btn-sm hm-btn-primary" href={`/career/compare?left=${encodeURIComponent(chosen[0]!)}&right=${encodeURIComponent(chosen[1]!)}`}>Jämför valda spelare →</Link> : <span className="hm-text-muted hm-matrix-tray-hint">Välj två för att jämföra</span>}
      <label>Sätt trupproll<select className="hm-select" value="" onChange={e => { if (e.target.value) tray({ kind: 'ROLE', tier: e.target.value as SquadStatusTier }, `Trupproll ${SQUAD_STATUS_TIER_LABEL_SV[e.target.value as SquadStatusTier]}`); }}><option value="">Välj…</option>{SQUAD_STATUS_TIERS.map(t => <option key={t} value={t}>{SQUAD_STATUS_TIER_LABEL_SV[t]}</option>)}</select></label>
      <button className="hm-btn hm-btn-sm" onClick={() => tray({ kind: 'REST' }, 'Vila i träningen')}>Vila</button>
      <button className="hm-btn hm-btn-sm" onClick={() => tray({ kind: 'FULL_LOAD' }, 'Full träningsbelastning')}>Full belastning</button>
      <button className="hm-btn hm-btn-sm" disabled={chosen.length !== 1} onClick={() => tray({ kind: 'CAPTAIN' }, 'Lagkapten')}>Kapten</button>
      <button className="hm-btn hm-btn-sm" disabled={chosen.length !== 1} onClick={() => tray({ kind: 'VICE' }, 'Vicekapten')}>Vice</button>
      <Link className="hm-btn hm-btn-sm" href="/career/tactics">7 m-skyttar →</Link>
      <button className="hm-btn hm-btn-sm" onClick={() => { if (window.confirm(`Transferlista ${chosen.length} spelare? Det påverkar deras moral.`)) tray({ kind: 'TRANSFER_LIST' }, 'Transferlistade'); }}>Transferlista</button>
      <button className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => { setSelected([]); setTrayNote(null); }}>Rensa val</button>
      {trayNote && <p role="status" className="hm-matrix-tray-note">{trayNote}</p>}
    </aside>}

    {peek && <PlayerPeek row={peek} form={form(peek.id)} onClose={() => setPeekId(null)} />}
    {renewalId && <RenewalDrawer playerId={renewalId} onClose={closeRenewal} />}
  </div>;
}
