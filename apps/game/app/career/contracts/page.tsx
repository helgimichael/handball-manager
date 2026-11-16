'use client';
// Arena Nights -- SQD-05 (B) "Contract timeline (Gantt)" + SQD-05a (A) side drawer.
// Payroll vs wage budget (with projected renewals from open talks) above a Gantt of every player and salaried
// staff contract, drawn against season boundaries, transfer windows and the final-year renewal zone. Tapping a
// player's bar opens the existing renewal flow in a drawer (URL ?player=); closing clears the selection.
// Phones get a vertical list grouped by season of expiry with mini bars. Model: lib/players/contractTimeline.ts.
import { Suspense, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWorkspaceState } from '@/components/game/WorkspaceMemory';
import { useCareer } from '@/lib/career/CareerContext';
import { CONTRACT_STATUS_LABEL } from '@/lib/economy/labels';
import { useMoney } from '@/lib/settings/usePreferences';
import { PageHeading, EmptyState } from '@/components/manager/Workspace';
import { RenewalDrawer } from '@/components/players/RenewalDrawer';
import { DelegationToggle } from '@/components/staff/DelegationToggle';
import { buildContractTimeline, groupTimelineRows, sortTimelineRows, type TimelineRow, type TimelineSort } from '@/lib/players/contractTimeline';

export default function ContractsPage() { return <Suspense fallback={<EmptyState>Läser kontrakt…</EmptyState>}><Contracts /></Suspense>; }

function Contracts() {
  const money = useMoney(); // re-render every figure when the display currency changes
  const { career } = useCareer();
  const router = useRouter();
  const params = useSearchParams();
  const [urgentOnly, setUrgentOnly] = useWorkspaceState('contracts.urgent', false);
  const [grouped, setGrouped] = useWorkspaceState('contracts.groupByPosition', false);
  const [showStaff, setShowStaff] = useWorkspaceState('contracts.showStaff', true);
  const [sort, setSort] = useWorkspaceState<TimelineSort>('contracts.sort', 'END');
  const selected = params.get('player');
  const timeline = useMemo(() => buildContractTimeline(career), [career]);
  const open = useCallback((id: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (id) next.set('player', id); else next.delete('player');
    const q = next.toString();
    router.replace(q ? `/career/contracts?${q}` : '/career/contracts', { scroll: false });
  }, [params, router]);
  const close = useCallback(() => open(null), [open]);

  const visible = sortTimelineRows(timeline.rows.filter(r => (showStaff || r.kind === 'PLAYER') && (!urgentOnly || r.daysLeft === null || r.daysLeft <= timeline.renewalZoneDays)), sort);
  const groups = grouped ? groupTimelineRows(visible, 'POSITION') : [{ key: '', rows: visible }];
  const bySeason = groupTimelineRows(sortTimelineRows(visible, 'END'), 'SEASON');
  const players = timeline.rows.filter(r => r.kind === 'PLAYER');
  const expiring = players.filter(r => r.daysLeft !== null && r.daysLeft <= 365).length;
  const urgent = players.filter(r => r.daysLeft !== null && r.daysLeft <= 180).length;
  const selectedRow = selected ? players.find(r => r.id === selected) : undefined;
  const p = timeline.payroll;
  const yearly = (eur: number) => `${money.format(eur, { compact: true })}/år`;
  const scale = Math.max(1, p.budgetAnnualEur ?? 0, p.currentAnnualEur, p.projectedAnnualEur) * 1.08;
  const pct = (n: number) => `${Math.round((Math.max(0, n) / scale) * 1000) / 10}%`;
  const projectedDelta = p.projectedAnnualEur - p.currentAnnualEur;
  const over = p.budgetAnnualEur != null && p.projectedAnnualEur > p.budgetAnnualEur;

  const rowLabel = (r: TimelineRow) => `${r.name}, ${r.group}, ${r.endDate ? `avtal till ${r.endDate}, ${r.daysLeft} dagar kvar` : 'avtal saknas'}`;
  const bar = (r: TimelineRow, mini = false) => <span className={mini ? 'hm-gantt-track hm-gantt-track-mini' : 'hm-gantt-track'} aria-hidden="true">
    {r.endDate && <i className="hm-gantt-bar" data-kind={r.kind} data-status={r.status ?? 'NONE'} style={{ width: `${Math.max(0.8, r.endPct)}%` }} />}
    {r.endDate && r.zonePct !== null && <i className="hm-gantt-zone" style={{ left: `${r.zonePct}%`, width: `${Math.max(0.8, r.endPct - r.zonePct)}%` }} />}
  </span>;
  const nameCell = (r: TimelineRow) => r.kind === 'PLAYER'
    ? <button type="button" className="hm-gantt-name" aria-label={`Öppna förlängning: ${rowLabel(r)}`} aria-pressed={selected === r.id} onClick={() => open(r.id)}><span className="hm-position-code">{r.group}</span><b>{r.name}</b></button>
    : <Link className="hm-gantt-name" href={r.href} aria-label={`Stabsmedlem: ${rowLabel(r)}`}><span className="hm-gantt-staff">Stab</span><b>{r.name}</b><small>{r.group}</small></Link>;
  const tail = (r: TimelineRow) => <span className="hm-gantt-tail">
    <strong className="hm-contract-countdown" data-urgent={r.daysLeft !== null && r.daysLeft <= 180}>{r.daysLeft ?? '—'}</strong>
    <small>{r.endDate ?? 'Saknas'}</small>
    {r.talk && <em className="hm-gantt-talk">{r.talk === 'WAITING' ? 'Svar väntar' : 'Förhandling'}</em>}
  </span>;

  return <div className="hm-contract-screen hm-contracts-gantt">
    <div className="hm-roster-heading"><PageHeading eyebrow={`Lagbygget / ${career.seasonId}`} title="Kontrakt" description="Behåll stommen. Planera för nästa säsong." actions={<Link className="hm-btn" href="/career/players">Hitta ersättare →</Link>} /><DelegationToggle area="CONTRACT_RENEWALS" compact /></div>

    <section className="hm-payroll" aria-labelledby="hm-payroll-h" data-over={over}>
      <header><h2 id="hm-payroll-h">Löner mot lönebudget</h2><span className="hm-payroll-figures">{yearly(p.currentAnnualEur)}{projectedDelta !== 0 ? ` → ${yearly(p.projectedAnnualEur)} med pågående förlängningar` : ''} · budget {p.budgetAnnualEur != null ? yearly(p.budgetAnnualEur) : 'saknas'}</span></header>
      <div className="hm-payroll-bar" role="img" aria-label={`Spelarlöner ${yearly(p.currentAnnualEur)}, prognos ${yearly(p.projectedAnnualEur)}${p.budgetAnnualEur != null ? `, lönebudget ${yearly(p.budgetAnnualEur)}` : ''}`}>
        <i className="hm-payroll-now" style={{ width: pct(Math.min(p.currentAnnualEur, p.projectedAnnualEur)) }} />
        {projectedDelta !== 0 && <i className="hm-payroll-proj" data-dir={projectedDelta > 0 ? 'up' : 'down'} style={{ left: pct(Math.min(p.currentAnnualEur, p.projectedAnnualEur)), width: pct(Math.abs(projectedDelta)) }} />}
        {p.budgetAnnualEur != null && <b className="hm-payroll-line" style={{ left: pct(p.budgetAnnualEur) }} />}
      </div>
      <dl className="hm-payroll-cells">
        <div><dt>Avtal ut inom ett år</dt><dd>{expiring}</dd></div>
        <div><dt>Högst 180 dagar kvar</dt><dd>{urgent}</dd></div>
        <div><dt>Utrymme mot budget</dt><dd data-neg={over}>{p.budgetAnnualEur != null ? `${p.budgetAnnualEur - p.projectedAnnualEur < 0 ? '−' : ''}${yearly(Math.abs(p.budgetAnnualEur - p.projectedAnnualEur))}` : '—'}</dd></div>
        <div><dt>Pågående förlängningar</dt><dd>{p.renewals.length}</dd></div>
      </dl>
      {p.renewals.length > 0 && <ul className="hm-payroll-renewals">{p.renewals.map(r => <li key={r.playerId}><button type="button" className="hm-link-button" onClick={() => open(r.playerId)}>{r.name}</button><span>{money.format(r.fromEurPerMonth)} → {money.format(r.toEurPerMonth)}/mån</span><small>{r.source === 'OFFER' ? 'ditt senaste bud' : 'hans krav'}</small></li>)}</ul>}
      <p className="hm-dossier-note">Prognosen räknar varje öppen förlängning med ditt senaste bud, annars spelarens krav. Stabens löner belastar stabsbudgeten och ingår inte här.</p>
    </section>

    <section className="hm-gantt-controls" aria-label="Visning">
      <label className="hm-gantt-check"><input type="checkbox" checked={urgentOnly} onChange={e => setUrgentOnly(e.target.checked)} /> Utgående inom ett år</label>
      <label className="hm-gantt-check"><input type="checkbox" checked={grouped} onChange={e => setGrouped(e.target.checked)} /> Gruppera per position</label>
      <label className="hm-gantt-check"><input type="checkbox" checked={showStaff} onChange={e => setShowStaff(e.target.checked)} disabled={timeline.staffIncluded === 0} /> Visa stab{timeline.staffIncluded === 0 ? ' (inga anställningsavtal med slutdatum)' : ` (${timeline.staffIncluded})`}</label>
      <label>Sortera<select className="hm-select" value={sort} onChange={e => setSort(e.target.value as TimelineSort)}><option value="END">Avtal slutar</option><option value="WAGE">Lön</option><option value="NAME">Namn</option></select></label>
      <span className="hm-gantt-legend" aria-label="Teckenförklaring"><i data-k="bar" />Avtal <i data-k="zone" />Sista året (förlängningsläge) <i data-k="window" />Transferfönster <i data-k="season" />Ny säsong</span>
    </section>

    {!visible.length ? <EmptyState>Inga kontrakt matchar filtret. Slå av ”Utgående inom ett år” för att se hela truppen.</EmptyState> : <>
      <div className="hm-gantt" role="table" aria-label={`Kontraktstidslinje ${timeline.today} – ${timeline.horizonEnd}`}>
        <div className="hm-gantt-axis" role="row">
          <span role="columnheader">Spelare / stab</span>
          <span role="columnheader" className="hm-gantt-axis-track">
            <em style={{ left: 0 }}>I dag</em>
            {timeline.seasons.map(s => <em key={s.label} style={{ left: `${s.pct}%` }}>{s.label}</em>)}
          </span>
          <span role="columnheader">Dagar kvar</span>
        </div>
        <div className="hm-gantt-body">
          <div className="hm-gantt-overlay" aria-hidden="true">
            {timeline.windows.map(w => <i key={w.label} className="hm-gantt-window" title={w.label} style={{ left: `${w.startPct}%`, width: `${Math.max(0.4, w.endPct - w.startPct)}%` }} />)}
            {timeline.seasons.map(s => <i key={s.label} className="hm-gantt-season" style={{ left: `${s.pct}%` }} />)}
          </div>
          {groups.map(g => <div key={g.key || 'all'} role="rowgroup">
            {g.key && <div className="hm-gantt-group" role="row"><span role="cell">{g.key} · {g.rows.length}</span></div>}
            {g.rows.map(r => <div key={r.id} className="hm-gantt-row" role="row" data-selected={selected === r.id} data-kind={r.kind}>
              <span role="cell">{nameCell(r)}</span>
              <span role="cell" className="hm-gantt-cell">{r.kind === 'PLAYER' ? <button type="button" className="hm-gantt-hit" tabIndex={-1} aria-hidden="true" onClick={() => open(r.id)}>{bar(r)}</button> : bar(r)}</span>
              <span role="cell">{tail(r)}</span>
            </div>)}
          </div>)}
        </div>
      </div>

      <div className="hm-gantt-list" aria-label="Kontrakt per säsong då avtalet löper ut">
        {bySeason.map(g => <section key={g.key}>
          <h3>{g.key === 'Avtal saknas' ? g.key : `Löper ut ${g.key}`} <span>{g.rows.length}</span></h3>
          <ul>{g.rows.map(r => <li key={r.id} data-selected={selected === r.id}>
            {nameCell(r)}
            {bar(r, true)}
            {tail(r)}
          </li>)}</ul>
        </section>)}
      </div>
    </>}
    <p className="hm-dossier-note">Tidslinjen går från i dag till {timeline.horizonEnd}. Sista året före avtalsslut räknas som utgående; där brukar förlängningar förhandlas. Transferfönstren följer spelets regelmodell. <Link href="/career/squad">Bedöm roller & positioner i truppen →</Link></p>

    {selected && (selectedRow
      ? <RenewalDrawer key={selected} playerId={selected} onClose={close} showContractsLink={false} />
      : <p className="hm-dossier-empty" role="status">Spelaren i länken finns inte i truppen längre. <button type="button" className="hm-link-button" onClick={close}>Rensa valet</button></p>)}
    {selectedRow && <span className="hm-sr-only" aria-live="polite">{`Förlängning öppen för ${selectedRow.name} (${selectedRow.status ? CONTRACT_STATUS_LABEL[selectedRow.status] : 'inget avtal'})`}</span>}
  </div>;
}
