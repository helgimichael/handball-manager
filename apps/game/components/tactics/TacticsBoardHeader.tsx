'use client';
// Arena Nights Phase 2 -- TRN-02 (A) readiness header + TRN-02b/02c (A) phase × manpower switcher.
// Every interactive cell switches to an existing court mode; cells without a domain lineup are plain text.
import type { BoardCourtMode, MatrixCell, ReadinessChip } from '@/lib/matchPlan/boardReadiness';

const MARK: Record<string, string> = { ok: '✓', missing: '!', standard: '–' };

export function ReadinessHeader({ chips, onMode }: { chips: ReadinessChip[]; onMode: (mode: BoardCourtMode) => void }) {
  return <div className="tb-ready" role="list" aria-label="Matchplanens status">
    {chips.map(c => {
      const body = <><span className="tb-ready-mark" aria-hidden="true">{MARK[c.state]}</span>{c.label}</>;
      const label = `${c.label}: ${c.detail}`;
      return <span key={c.id} role="listitem" className="tb-ready-chip" data-state={c.state} title={c.detail}>
        {c.mode ? <button type="button" onClick={() => onMode(c.mode!)} aria-label={label}>{body}</button>
          : c.anchor ? <a href={`#${c.anchor}`} aria-label={label}>{body}</a> : <span aria-label={label}>{body}</span>}
      </span>;
    })}
  </div>;
}

export function PhaseMatrix({ cells, active, onMode, badges }: { cells: MatrixCell[]; active: BoardCourtMode; onMode: (mode: BoardCourtMode) => void; badges: Partial<Record<BoardCourtMode, string>> }) {
  const manpower = ['6v6', '6v5', '5v6', '7v6'] as const;
  return <div className="tb-matrix" role="grid" aria-label="Fas och numerär (Specialsituationer)">
    <div role="row" className="tb-matrix-head"><span role="columnheader" aria-hidden="true" />{manpower.map(m => <span role="columnheader" key={m}>{m.replace('v', ' mot ')}</span>)}</div>
    {(['ATTACK', 'DEFENCE'] as const).map(phase => <div role="row" key={phase} className="tb-matrix-row" data-phase={phase}>
      <span role="rowheader" className="tb-matrix-phase">{phase === 'ATTACK' ? 'Anfall' : 'Försvar'}</span>
      {manpower.map(m => {
        const cell = cells.find(c => c.phase === phase && c.manpower === m)!;
        const inner = <><b>{cell.title}</b><small>{cell.mode && badges[cell.mode] ? badges[cell.mode] : cell.note}</small><i className="tb-dot" data-state={cell.state} aria-label={cell.state === 'ok' ? 'klar' : cell.state === 'missing' ? 'ofullständig' : 'standard'} /></>;
        return <span role="gridcell" key={m}>{cell.mode
          ? <button type="button" className="tb-cell" data-active={active === cell.mode} aria-pressed={active === cell.mode} onClick={() => onMode(cell.mode!)}>{inner}</button>
          : <span className="tb-cell" data-static="true">{inner}</span>}</span>;
      })}
    </div>)}
  </div>;
}
