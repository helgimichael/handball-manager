'use client';
// Arena Nights -- Squad Matrix saved views:
//   SQD-01a (A) Översikt: curated 8-column summary with expandable rows (detail band: performance | physical).
//   SQD-01b (A) Prestation: position-aware stat tables (outcourt above goalkeepers), inline bars, per-match values.
//   SQD-01c (A) Fysisk status: readiness heat-strip with an explicit band legend and reason chips (no tooltips).
//   SQD-01g (B) Explaining empty state: why the filter is empty + the nearest real matches + reset.
// All figures come from lib/career/squadMatrix.ts (existing career data); the only write is the existing
// per-player training load setter.
import Link from 'next/link';
import { Fragment, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { MatrixRow, EmptyExplanation } from '@/lib/career/squadMatrix';
import { heatStrip, reasonChips, reasonExplanation, splitByRole } from '@/lib/career/squadMatrix';
import { PlayerChip } from '@/components/shell/PlayerChip';
import { formatMoney } from '@/lib/economy/currency';
import { RECOVERY_OUTLOOK_LABEL, WORKLOAD_TREND_LABEL } from '@/lib/training/readinessSummary';
import { MATCH_FITNESS_FULL_EFFECT } from '@/lib/players/matchFitness';
import type { PlayerTrainingLoadSetting } from '@/lib/training/types';

const profile = (id: string, tab?: string) => `/career/squad/${encodeURIComponent(id)}${tab ? `?tab=${tab}` : ''}`;
type Sort = { key: keyof MatrixRow; direction: 'asc' | 'desc' };
type OnSort = (key: keyof MatrixRow, numeric?: boolean) => void;

function SortTh({ label, k, sort, onSort, numeric, title }: { label: string; k: keyof MatrixRow; sort: Sort; onSort: OnSort; numeric?: boolean; title?: string }) {
  const active = sort.key === k;
  return <th data-numeric={numeric} title={title} aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}>
    <button className="hm-sort" onClick={() => onSort(k, numeric)}>{label}{active ? (sort.direction === 'asc' ? ' ▲' : ' ▼') : ''}</button>
  </th>;
}

/** Mini readiness strip for the overview: energy, match fitness, load -- colour first, value on hover/aria. */
export function ReadinessMini({ row }: { row: MatrixRow }) {
  const cells = heatStrip(row).slice(0, 3);
  return <span className="sq-mini-strip" role="img" aria-label={cells.map(c => `${c.label} ${c.value} (${c.band})`).join(', ')}>
    {cells.map(c => <i key={c.key} data-tone={c.tone} />)}
  </span>;
}

// ---------------------------------------------------------------- SQD-01a overview
export function OverviewTable({ rows, sort, onSort, form, role, selected, onToggle, onPeek }: {
  rows: MatrixRow[]; sort: Sort; onSort: OnSort; form: (id: string) => ReactNode; role: (r: MatrixRow) => ReactNode;
  selected: string[]; onToggle: (id: string, on: boolean) => void; onPeek: (id: string) => void;
}) {
  const [open, setOpen] = useState<string[]>([]);
  const set = (id: string, on: boolean) => setOpen(prev => on ? [...new Set([...prev, id])] : prev.filter(x => x !== id));
  const key = (id: string) => (e: KeyboardEvent<HTMLButtonElement>) => { if (e.key === 'ArrowRight') { e.preventDefault(); set(id, true); } if (e.key === 'ArrowLeft') { e.preventDefault(); set(id, false); } };
  const output = (r: MatrixRow) => r.position === 'MV' ? (r.savePct == null ? '—' : `${r.savePct}%`) : r.goals;
  return <>
    <div className="hm-matrix-table-wrap sq-overview-wrap">
      <table className="hm-table hm-roster-table hm-matrix-table sq-overview">
        <thead><tr>
          <th className="hm-matrix-select"><span className="hm-sr-only">Välj</span></th>
          <th className="sq-expand-h"><span className="hm-sr-only">Visa mer</span></th>
          <SortTh label="Spelare" k="name" sort={sort} onSort={onSort} />
          <SortTh label="Pos" k="position" sort={sort} onSort={onSort} />
          <SortTh label="Trupproll" k="role" sort={sort} onSort={onSort} />
          <SortTh label="Beredskap" k="energy" sort={sort} onSort={onSort} numeric title="Energi · matchträning · belastning 7 d mot vanan" />
          <th>Form (5M)</th>
          <SortTh label="Betyg" k="rating" sort={sort} onSort={onSort} numeric />
          <SortTh label="Mål / Räddn %" k="goals" sort={sort} onSort={onSort} numeric title="Mål för utespelare, räddningsprocent för målvakter" />
          <SortTh label="Avtal till" k="contractEnd" sort={sort} onSort={onSort} />
          <th className="hm-matrix-peek-h"><span className="hm-sr-only">Snabbtitt</span></th>
        </tr></thead>
        <tbody>{rows.map(r => {
          const isOpen = open.includes(r.id);
          return <Fragment key={r.id}>
            <tr data-highlight={selected.includes(r.id)} data-unavailable={!r.available} data-open={isOpen}>
              <td className="hm-matrix-select"><input type="checkbox" aria-label={`Välj ${r.name}`} checked={selected.includes(r.id)} onChange={e => onToggle(r.id, e.target.checked)} /></td>
              <td className="sq-expand"><button type="button" className="sq-chevron" aria-expanded={isOpen} aria-controls={`sq-band-${r.id}`} aria-label={`${isOpen ? 'Dölj' : 'Visa'} detaljer för ${r.name} (pil höger/vänster)`} onClick={() => set(r.id, !isOpen)} onKeyDown={key(r.id)}>›</button></td>
              <td className="hm-matrix-chip"><PlayerChip row={r} /></td>
              <td><span className="hm-position-code">{r.position}</span></td>
              <td>{role(r)}</td>
              <td data-numeric="true"><ReadinessMini row={r} /></td>
              <td>{form(r.id)}</td>
              <td data-numeric="true">{r.rating == null ? '—' : r.rating.toFixed(1)}</td>
              <td data-numeric="true">{output(r)}</td>
              <td>{r.contractEnd ?? '—'}</td>
              <td className="hm-matrix-peek"><button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => onPeek(r.id)} aria-label={`Snabbtitt ${r.name}`}>⋯</button></td>
            </tr>
            {isOpen && <tr className="sq-band-row" id={`sq-band-${r.id}`}><td colSpan={11}><DetailBand row={r} /></td></tr>}
          </Fragment>;
        })}</tbody>
      </table>
    </div>
    <ol className="hm-matrix-cards sq-overview-cards" aria-label="Översikt: spelarkort">
      {rows.map(r => {
        const isOpen = open.includes(r.id);
        return <li key={r.id} data-highlight={selected.includes(r.id)}>
          <label className="hm-matrix-card-select"><input type="checkbox" aria-label={`Välj ${r.name} (kort)`} checked={selected.includes(r.id)} onChange={e => onToggle(r.id, e.target.checked)} /></label>
          <PlayerChip row={r} form={form(r.id)} />
          <button type="button" className="sq-chevron" aria-expanded={isOpen} aria-label={`${isOpen ? 'Dölj' : 'Visa'} detaljer för ${r.name}`} onClick={() => set(r.id, !isOpen)}>›</button>
          <dl>
            <div><dt>Betyg</dt><dd>{r.rating == null ? '—' : r.rating.toFixed(1)}</dd></div>
            <div><dt>{r.position === 'MV' ? 'Räddn %' : 'Mål'}</dt><dd>{output(r)}</dd></div>
            <div><dt>Avtal till</dt><dd>{r.contractEnd ?? '—'}</dd></div>
          </dl>
          {isOpen && <div className="sq-card-band"><DetailBand row={r} /></div>}
        </li>;
      })}
    </ol>
  </>;
}

function DetailBand({ row: r }: { row: MatrixRow }) {
  const gk = r.position === 'MV';
  const perf: [string, ReactNode][] = [
    ['Matcher / starter', `${r.appearances} / ${r.starts}`],
    gk ? ['Räddningar / mötta', `${r.saves} / ${r.shotsFaced}`] : ['Mål / skott', `${r.goals} / ${r.shots}`],
    gk ? ['Räddn %', r.savePct == null ? '—' : `${r.savePct}%`] : ['Skott %', r.shotPct == null ? '—' : `${r.shotPct}%`],
    gk ? ['Räddn / match', r.savesPerMatch ?? '—'] : ['Mål / match', r.goalsPerMatch ?? '—'],
    ['Snittbetyg', r.rating == null ? '—' : r.rating.toFixed(1)],
  ];
  const phys: [string, ReactNode][] = [
    ['Energi', `${r.energy}%`], ['Matchträning', `${r.fitness}%`], ['Moral', r.morale],
    ['Belastning 7 d', r.load ?? '—'], ['Trend', r.trend ? WORKLOAD_TREND_LABEL[r.trend as keyof typeof WORKLOAD_TREND_LABEL] : '—'],
    ['Återhämtning', RECOVERY_OUTLOOK_LABEL[r.recovery as keyof typeof RECOVERY_OUTLOOK_LABEL] ?? '—'],
    ['Återkomst', r.returnDate ?? (r.available ? 'Tillgänglig' : '—')],
    ['Ålder', r.age ?? '—'], ['Lön / månad', formatMoney(r.wage)], ['Dagar kvar', r.daysLeft ?? '—'],
  ];
  return <div className="sq-band">
    <section aria-label="Prestation"><h4>Prestation</h4><dl>{perf.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl><Link href={profile(r.id, 'matches')}>Matcher →</Link></section>
    <section aria-label="Fysik och avtal"><h4>Fysik & avtal</h4><dl>{phys.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl><span className="sq-band-links"><Link href={profile(r.id, 'development')}>Egenskaper & utveckling →</Link><Link href={profile(r.id, 'contract')}>Kontrakt →</Link></span></section>
  </div>;
}

// ---------------------------------------------------------------- SQD-01b performance
export function PerformanceTables({ rows, sort, onSort, form }: { rows: MatrixRow[]; sort: Sort; onSort: OnSort; form: (id: string) => ReactNode }) {
  const { outcourt, goalkeepers } = splitByRole(rows);
  const max = (list: MatrixRow[], k: keyof MatrixRow) => Math.max(1, ...list.map(r => Number(r[k] ?? 0)));
  const bar = (v: number | null, m: number, text: ReactNode) => <span className="sq-cellbar">{v != null && <i style={{ width: `${Math.min(100, (v / m) * 100)}%` }} />}<b>{text}</b></span>;
  const rating = (r: MatrixRow) => r.rating == null ? '—' : r.rating.toFixed(1);
  const name = (r: MatrixRow) => <td className="hm-matrix-chip"><PlayerChip row={r} /></td>;
  return <div className="sq-perf">
    <section aria-labelledby="sq-perf-out">
      <h3 id="sq-perf-out">Utespelare <small>{outcourt.length}</small></h3>
      {outcourt.length ? <div className="hm-matrix-table-wrap"><table className="hm-table hm-matrix-table sq-perf-table">
        <thead><tr><SortTh label="Spelare" k="name" sort={sort} onSort={onSort} /><SortTh label="Pos" k="position" sort={sort} onSort={onSort} /><SortTh label="M" k="appearances" sort={sort} onSort={onSort} numeric /><SortTh label="Starter" k="starts" sort={sort} onSort={onSort} numeric /><SortTh label="Mål" k="goals" sort={sort} onSort={onSort} numeric /><SortTh label="Mål/match" k="goalsPerMatch" sort={sort} onSort={onSort} numeric /><SortTh label="Skott %" k="shotPct" sort={sort} onSort={onSort} numeric /><SortTh label="Betyg" k="rating" sort={sort} onSort={onSort} numeric /><th>Form</th><th><span className="hm-sr-only">Profil</span></th></tr></thead>
        <tbody>{outcourt.map(r => { const m = (k: keyof MatrixRow) => max(outcourt, k); return <tr key={r.id} data-unavailable={!r.available}>
          {name(r)}<td><span className="hm-position-code">{r.position}</span></td>
          <td data-numeric="true">{r.appearances}</td><td data-numeric="true">{r.starts}</td>
          <td data-numeric="true">{bar(r.goals, m('goals'), r.goals)}</td>
          <td data-numeric="true">{bar(r.goalsPerMatch, m('goalsPerMatch'), r.goalsPerMatch ?? '—')}</td>
          <td data-numeric="true">{bar(r.shotPct, 100, r.shotPct == null ? '—' : `${r.shotPct}%`)}</td>
          <td data-numeric="true">{bar(r.rating, 10, rating(r))}</td>
          <td>{form(r.id)}</td>
          <td><Link href={profile(r.id, 'matches')} aria-label={`Prestation för ${r.name}`}>→</Link></td>
        </tr>; })}</tbody>
      </table></div> : <p className="hm-dossier-empty">Inga utespelare i urvalet.</p>}
    </section>
    <section aria-labelledby="sq-perf-gk">
      <h3 id="sq-perf-gk">Målvakter <small>{goalkeepers.length}</small></h3>
      {goalkeepers.length ? <div className="hm-matrix-table-wrap"><table className="hm-table hm-matrix-table sq-perf-table">
        <thead><tr><SortTh label="Spelare" k="name" sort={sort} onSort={onSort} /><SortTh label="M" k="appearances" sort={sort} onSort={onSort} numeric /><SortTh label="Räddn %" k="savePct" sort={sort} onSort={onSort} numeric /><SortTh label="Räddn/match" k="savesPerMatch" sort={sort} onSort={onSort} numeric /><SortTh label="Mötta skott" k="shotsFaced" sort={sort} onSort={onSort} numeric /><SortTh label="Betyg" k="rating" sort={sort} onSort={onSort} numeric /><th>Form</th><th><span className="hm-sr-only">Profil</span></th></tr></thead>
        <tbody>{goalkeepers.map(r => { const m = (k: keyof MatrixRow) => max(goalkeepers, k); return <tr key={r.id} data-unavailable={!r.available}>
          {name(r)}
          <td data-numeric="true">{r.appearances}</td>
          <td data-numeric="true">{bar(r.savePct, 100, r.savePct == null ? '—' : `${r.savePct}%`)}</td>
          <td data-numeric="true">{bar(r.savesPerMatch, m('savesPerMatch'), r.savesPerMatch ?? '—')}</td>
          <td data-numeric="true">{bar(r.shotsFaced, m('shotsFaced'), r.shotsFaced)}</td>
          <td data-numeric="true">{bar(r.rating, 10, rating(r))}</td>
          <td>{form(r.id)}</td>
          <td><Link href={profile(r.id, 'matches')} aria-label={`Prestation för ${r.name}`}>→</Link></td>
        </tr>; })}</tbody>
      </table></div> : <p className="hm-dossier-empty">Inga målvakter i urvalet.</p>}
    </section>
    <ol className="hm-matrix-cards" aria-label="Prestation: spelarkort">
      {[...outcourt, ...goalkeepers].map(r => <li key={r.id}>
        <span aria-hidden="true" />
        <PlayerChip row={r} form={form(r.id)} />
        <Link href={profile(r.id, 'matches')} aria-label={`Prestation för ${r.name}`}>→</Link>
        <dl>{(r.position === 'MV'
          ? [['Räddn %', r.savePct == null ? '—' : `${r.savePct}%`], ['Räddn/match', r.savesPerMatch ?? '—'], ['Betyg', rating(r)]]
          : [['Mål', r.goals], ['Skott %', r.shotPct == null ? '—' : `${r.shotPct}%`], ['Betyg', rating(r)]]).map(([k, v]) => <div key={String(k)}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </li>)}
    </ol>
  </div>;
}

// ---------------------------------------------------------------- SQD-01c readiness heat-strip
const LOAD_OPTIONS: [PlayerTrainingLoadSetting, string][] = [['FULL', 'Full'], ['REDUCED', 'Reducerad'], ['RECOVERY_ONLY', 'Endast återhämtning'], ['REST', 'Vila']];

export function ReadinessLegend() {
  return <section className="sq-legend" aria-label="Förklaring till färgbanden">
    <div><b>Energi</b><span data-tone="ok">Pigg ≥ 80</span><span data-tone="warn">Något sliten ≥ 55</span><span data-tone="bad">Trött &lt; 55</span></div>
    <div><b>Matchträning</b><span data-tone="ok">Full effekt ≥ {MATCH_FITNESS_FULL_EFFECT}</span><span data-tone="warn">Under full effekt</span><span data-tone="bad">Låg &lt; 50</span></div>
    <div><b>7 d / 28 d</b><span data-tone="ok">I nivå</span><span data-tone="warn">Över vanan &gt; 1,15×</span><span data-tone="info">Under vanan &lt; 0,85×</span></div>
    <div><b>Utsikt</b><span data-tone="ok">God</span><span data-tone="info">Normal</span><span data-tone="bad">Nedsatt</span></div>
  </section>;
}

export function ReadinessStripTable({ rows, sort, onSort, riskSort, onRiskSort, availability, onLoad }: {
  rows: MatrixRow[]; sort: Sort; onSort: OnSort; riskSort: boolean; onRiskSort: () => void;
  availability: (r: MatrixRow) => ReactNode; onLoad: (id: string, load: PlayerTrainingLoadSetting) => void;
}) {
  const [why, setWhy] = useState<string | null>(null);
  const chips = (r: MatrixRow, limit?: number) => {
    const list = reasonChips(r).slice(0, limit);
    return list.length ? <span className="sq-reasons">{list.map(c => { const k = `${r.id}:${c.text}`; return <button key={c.text} type="button" className="sq-reason" data-tone={c.tone} aria-expanded={why === k} onClick={() => setWhy(why === k ? null : k)}>{c.text}</button>; })}</span> : <span className="hm-text-muted">—</span>;
  };
  const explanation = (r: MatrixRow) => why?.startsWith(`${r.id}:`) ? <p className="sq-why" role="status">{reasonExplanation(why.slice(r.id.length + 1))}</p> : null;
  const loadSelect = (r: MatrixRow, suffix = '') => <select className="hm-select sq-load" aria-label={`Träningsbelastning ${r.name}${suffix}`} value={r.trainingLoad} onChange={e => onLoad(r.id, e.target.value as PlayerTrainingLoadSetting)}>{LOAD_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;
  return <>
    <div className="sq-strip-tools"><button type="button" className="hm-btn hm-btn-sm" aria-pressed={riskSort} onClick={onRiskSort}>{riskSort ? 'Sorterat på risk' : 'Sortera på risk'}</button><Link href="/career/training">Träningsbelastning i Träning →</Link></div>
    <div className="hm-matrix-table-wrap">
      <table className="hm-table hm-matrix-table sq-strip-table">
        <thead><tr>
          <SortTh label="Spelare" k="name" sort={sort} onSort={onSort} />
          <SortTh label="Energi" k="energy" sort={sort} onSort={onSort} numeric />
          <SortTh label="Matchträning" k="fitness" sort={sort} onSort={onSort} numeric />
          <SortTh label="7 d / 28 d" k="loadRatio" sort={sort} onSort={onSort} numeric title="Belastning senaste 7 dagarna mot veckosnittet för 28 dagar" />
          <th>Trend</th><th>Utsikt</th>
          <SortTh label="Tillgänglighet" k="available" sort={sort} onSort={onSort} />
          <SortTh label="Återkomst" k="returnDate" sort={sort} onSort={onSort} />
          <th>Orsaker</th><th>Belastning</th>
        </tr></thead>
        <tbody>{rows.map(r => <Fragment key={r.id}>
          <tr data-unavailable={!r.available}>
            <td className="hm-matrix-chip"><PlayerChip row={r} /></td>
            {heatStrip(r).map(c => <td key={c.key} className="sq-heat" data-tone={c.tone} data-key={c.key}>
              <span className="sq-heat-cell" title={c.band}><b>{c.value}</b><small>{c.band}</small>{c.key === 'fitness' && <i className="sq-fe-mark" style={{ left: `${MATCH_FITNESS_FULL_EFFECT}%` }} aria-hidden="true" />}{c.key === 'fitness' && <i className="sq-fe-fill" style={{ width: `${r.fitness}%` }} aria-hidden="true" />}</span>
            </td>)}
            <td>{availability(r)}</td>
            <td>{r.returnDate ?? '—'}</td>
            <td>{chips(r)}</td>
            <td>{loadSelect(r)}</td>
          </tr>
          {why?.startsWith(`${r.id}:`) && <tr className="sq-band-row"><td colSpan={10}>{explanation(r)}</td></tr>}
        </Fragment>)}</tbody>
      </table>
    </div>
    <ol className="hm-matrix-cards sq-strip-cards" aria-label="Fysisk status: spelarkort">
      {rows.map(r => <li key={r.id} data-unavailable={!r.available}>
        <span aria-hidden="true" />
        <PlayerChip row={r} />
        {loadSelect(r, ' (kort)')}
        <span className="sq-strip-mini" role="img" aria-label={heatStrip(r).map(c => `${c.label} ${c.value}, ${c.band}`).join('; ')}>{heatStrip(r).map(c => <i key={c.key} data-tone={c.tone}><b>{c.value}</b></i>)}</span>
        <div className="sq-strip-card-foot">{!r.available && availability(r)}{chips(r, 1)}</div>
        {explanation(r)}
      </li>)}
    </ol>
  </>;
}

// ---------------------------------------------------------------- SQD-01g explaining empty state
export function ExplainingEmpty({ explanation, onReset, onPick }: { explanation: EmptyExplanation; onReset: () => void; onPick: (id: string) => void }) {
  return <div className="sq-empty" role="status">
    <p><strong>{explanation.message}</strong></p>
    {explanation.nearest.length > 0 && <>
      <span className="hm-eyebrow">Närmaste alternativ</span>
      <ul>{explanation.nearest.map(r => <li key={r.id}><button type="button" className="sq-empty-pick" onClick={() => onPick(r.id)}><span className="hm-position-code">{r.position}</span> {r.name}<small>{r.available ? `Energi ${r.energy}%` : `Inte tillgänglig${r.returnDate ? ` · åter ${r.returnDate}` : ''}`}</small></button></li>)}</ul>
    </>}
    <button type="button" className="hm-btn hm-btn-sm hm-btn-primary" onClick={onReset}>Rensa filter</button>
  </div>;
}
