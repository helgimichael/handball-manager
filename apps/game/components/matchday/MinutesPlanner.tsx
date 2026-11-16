'use client';
// SQUAD-ROLE-MINUTES: "Speltidsplan" -- planned minutes per registered player
// inside the matchday preview (ritual step 2), grouped by the position the
// match plan assigns, each position with its own 60-minute budget. Wide:
// one row per player; narrow (phone / half-width panel): cards with large
// steppers. Shows the role NAME only; the role's hidden playing-time
// expectation is never displayed.
import { useState } from 'react';
import { PlayerLink } from '@/components/entityLinks';
import { PLANNED_MINUTES_MAX, type MinutesPlannerRow, type MinutesTotals, type PositionBudget } from '@/lib/matchPlan/minutesPlan';

const STEP = 5;
/** Returns null when accepted, otherwise the reason it was rejected. */
export type MinutesEdit = (playerId: string, minutes: number) => string | null;

function Stepper({ row, readOnly, onEdit }: { row: MinutesPlannerRow; readOnly: boolean; onEdit: (minutes: number) => void }) {
  // Typed figures are applied on Enter / leaving the field, so "6" on the way to "60" is never validated on its own.
  const [draft, setDraft] = useState<string | null>(null);
  const disabled = readOnly || !row.available;
  const commit = () => {
    if (draft === null) return;
    const text = draft.trim();
    setDraft(null);
    if (text === '' || Number(text) === row.plannedMinutes) return;
    onEdit(Number(text));
  };
  return <div className="mp-stepper" role="group" aria-label={`Planerade minuter för ${row.name}`}>
    <button type="button" aria-label={`Minska ${row.name}s minuter`} disabled={disabled || row.plannedMinutes <= 0} onClick={() => onEdit(Math.max(0, row.plannedMinutes - STEP))}>−</button>
    <input type="number" inputMode="numeric" min={0} max={PLANNED_MINUTES_MAX} step={1} value={draft ?? row.plannedMinutes} disabled={disabled} aria-label={`Minuter, ${row.name}`}
      onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } else if (e.key === 'Escape') setDraft(null); }} />
    <button type="button" aria-label={`Öka ${row.name}s minuter`} disabled={disabled || row.plannedMinutes >= PLANNED_MINUTES_MAX} onClick={() => onEdit(Math.min(PLANNED_MINUTES_MAX, row.plannedMinutes + STEP))}>+</button>
  </div>;
}

function budgetText(b: PositionBudget): string {
  if (b.status === 'OVER') return `${b.excess} min för mycket`;
  if (b.status === 'FULL') return 'Fullt';
  return `${b.available} min kvar`;
}

function Position({ budget, rows, readOnly, rejection, onEdit, onReset }: { budget: PositionBudget; rows: MinutesPlannerRow[]; readOnly: boolean; rejection: { playerId: string; message: string } | null; onEdit: (id: string, minutes: number) => void; onReset: (id: string) => void }) {
  if (!rows.length) return null;
  const fill = Math.min(100, Math.round(budget.planned / budget.capacity * 100));
  return <div className="mp-group" data-status={budget.status}>
    <header className="mp-budget" aria-label={`${budget.code}: ${budget.planned} av ${budget.capacity} minuter planerade, ${budgetText(budget)}`}>
      <span className="mp-budget-code hm-position-code">{budget.code}</span>
      <span className="mp-budget-figure"><b>{budget.planned}</b>/{budget.capacity} min</span>
      <span className="mp-budget-bar" aria-hidden="true"><i style={{ width: `${fill}%` }} /></span>
      <span className="mp-budget-left">{budgetText(budget)}</span>
    </header>
    <ul className="mp-rows">
      {rows.map(r => <li key={r.playerId} data-available={r.available} data-edited={r.edited || undefined}>
        <span className="mp-pos hm-position-code">{r.position}</span>
        <span className="mp-who">
          <PlayerLink playerId={r.playerId}>{r.name}</PlayerLink>
          <small>{r.roleLabel}{r.starter ? ' · Start' : ''}{r.naturalPosition ? ` · ordinarie ${r.naturalPosition}` : ''}{!r.available ? ' · Ej tillgänglig' : ''}</small>
        </span>
        <span className="mp-recent" title="Faktiska minuter på plan i de senaste matcherna (nyast först)">
          {r.recentMinutes.length ? <>Senast <b>{r.recentMinutes.join(' · ')}</b></> : <i>Ingen matchhistorik</i>}
        </span>
        <Stepper row={r} readOnly={readOnly} onEdit={n => onEdit(r.playerId, n)} />
        {r.edited && !readOnly ? <button type="button" className="mp-reset" onClick={() => onReset(r.playerId)} aria-label={`Återställ ${r.name} till förslaget`}>Förslag</button> : <span className="mp-reset-slot" aria-hidden="true" />}
        {rejection?.playerId === r.playerId && <p className="mp-reject" role="alert">{rejection.message}</p>}
      </li>)}
    </ul>
  </div>;
}

export function MinutesPlanner({ rows, budgets, totals, readOnly, onEdit, onReset, onResetAll }: { rows: MinutesPlannerRow[]; budgets: PositionBudget[]; totals: MinutesTotals; readOnly: boolean; onEdit: MinutesEdit; onReset: (playerId: string) => void; onResetAll: () => void }) {
  const [rejection, setRejection] = useState<{ playerId: string; message: string } | null>(null);
  const edited = rows.some(r => r.edited);
  const over = budgets.filter(b => b.status === 'OVER');
  const edit = (playerId: string, minutes: number) => { const error = onEdit(playerId, minutes); setRejection(error ? { playerId, message: error } : null); };
  const reset = (playerId: string) => { setRejection(null); onReset(playerId); };
  return <section className="mp-planner" aria-labelledby="mp-planner-h">
    <header>
      <h3 id="mp-planner-h" className="md-subhead">Speltidsplan</h3>
      {edited && !readOnly && <button type="button" className="hm-btn hm-btn-sm" onClick={() => { setRejection(null); onResetAll(); }}>Återställ alla till förslaget</button>}
    </header>
    <p className="mp-totals" data-over={totals.outfield > totals.outfieldCapacity || totals.goalkeepers > totals.goalkeeperCapacity || undefined}>
      Utespelare <b>{totals.outfield}</b>/{totals.outfieldCapacity} min · Målvakter <b>{totals.goalkeepers}</b>/{totals.goalkeeperCapacity} min
    </p>
    {over.length > 0 && <p className="mp-warning" role="alert">
      Den sparade planen överskrider positionsbudgeten: {over.map(b => `${b.code} ${b.planned}/${b.capacity} min (+${b.excess})`).join(', ')}. Inget har ändrats automatiskt – minska minuterna. Assistenten använder inte planen för {over.length === 1 ? 'den positionen' : 'de positionerna'} förrän den ryms.
    </p>}
    <p className="md-empty">Varje position har 60 minuter att dela på. Förslaget utgår från roller och vem som startar. 0 minuter går bra och positionen behöver inte fyllas. Assistenten väger planen mot trötthet, position, matchbild och form, och byter aldrig på exakt minut. Planen ändrar inte spelarnas roller.</p>
    {readOnly && <p className="md-empty">Matchen pågår – planen är låst för den här matchen.</p>}
    {budgets.map(b => <Position key={b.position} budget={b} rows={rows.filter(r => r.budgetPosition === b.position)} readOnly={readOnly} rejection={rejection} onEdit={edit} onReset={reset} />)}
  </section>;
}
