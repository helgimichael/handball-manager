'use client';
// SQUAD-ROLE-MINUTES: "Speltidsplan" -- planned minutes per registered player
// inside the matchday preview (ritual step 2). Desktop: a compact table-like
// grid; phone: stacked cards with large steppers. Shows the role NAME only;
// the role's hidden playing-time expectation is never displayed.
import { PlayerLink } from '@/components/entityLinks';
import { PLANNED_MINUTES_MAX, type MinutesPlannerRow } from '@/lib/matchPlan/minutesPlan';

const STEP = 5;

function Stepper({ row, readOnly, onChange }: { row: MinutesPlannerRow; readOnly: boolean; onChange: (minutes: number) => void }) {
  const disabled = readOnly || !row.available;
  return <div className="mp-stepper" role="group" aria-label={`Planerade minuter för ${row.name}`}>
    <button type="button" aria-label={`Minska ${row.name}s minuter`} disabled={disabled || row.plannedMinutes <= 0} onClick={() => onChange(Math.max(0, row.plannedMinutes - STEP))}>−</button>
    <input type="number" inputMode="numeric" min={0} max={PLANNED_MINUTES_MAX} step={1} value={row.plannedMinutes} disabled={disabled} aria-label={`Minuter, ${row.name}`}
      onChange={e => { const n = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(n)) onChange(n); }} />
    <button type="button" aria-label={`Öka ${row.name}s minuter`} disabled={disabled || row.plannedMinutes >= PLANNED_MINUTES_MAX} onClick={() => onChange(Math.min(PLANNED_MINUTES_MAX, row.plannedMinutes + STEP))}>+</button>
  </div>;
}

function Group({ title, rows, readOnly, onChange, onReset }: { title: string; rows: MinutesPlannerRow[]; readOnly: boolean; onChange: (id: string, minutes: number) => void; onReset: (id: string) => void }) {
  if (!rows.length) return null;
  return <div className="mp-group">
    <h4 className="md-subhead">{title} · {rows.reduce((s, r) => s + r.plannedMinutes, 0)} min planerat</h4>
    <ul className="mp-rows">
      {rows.map(r => <li key={r.playerId} data-available={r.available} data-edited={r.edited || undefined}>
        <span className="mp-pos hm-position-code">{r.position}</span>
        <span className="mp-who">
          <PlayerLink playerId={r.playerId}>{r.name}</PlayerLink>
          <small>{r.roleLabel}{r.starter ? ' · Start' : ''}{!r.available ? ' · Ej tillgänglig' : ''}</small>
        </span>
        <span className="mp-recent" title="Faktiska minuter på plan i de senaste matcherna (nyast först)">
          {r.recentMinutes.length ? <>Senast <b>{r.recentMinutes.join(' · ')}</b></> : <i>Ingen matchhistorik</i>}
        </span>
        <Stepper row={r} readOnly={readOnly} onChange={n => onChange(r.playerId, n)} />
        {r.edited && !readOnly ? <button type="button" className="mp-reset" onClick={() => onReset(r.playerId)} aria-label={`Återställ ${r.name} till förslaget`}>Förslag</button> : <span className="mp-reset-slot" aria-hidden="true" />}
      </li>)}
    </ul>
  </div>;
}

export function MinutesPlanner({ rows, readOnly, onChange, onReset, onResetAll }: { rows: MinutesPlannerRow[]; readOnly: boolean; onChange: (playerId: string, minutes: number) => void; onReset: (playerId: string) => void; onResetAll: () => void }) {
  const edited = rows.some(r => r.edited);
  return <section className="mp-planner" aria-labelledby="mp-planner-h">
    <header>
      <h3 id="mp-planner-h" className="md-subhead">Speltidsplan</h3>
      {edited && !readOnly && <button type="button" className="hm-btn hm-btn-sm" onClick={onResetAll}>Återställ alla till förslaget</button>}
    </header>
    <p className="md-empty">Förslaget utgår från spelarnas roller och vilka som startar. Ändra fritt – 0 minuter går bra och ingen totalsumma krävs. Assistenten väger planen mot trötthet, position, matchbild och form, och byter aldrig på exakt minut. Planen ändrar inte spelarnas roller.</p>
    {readOnly && <p className="md-empty">Matchen pågår – planen är låst för den här matchen.</p>}
    <Group title="Utespelare" rows={rows.filter(r => !r.goalkeeper)} readOnly={readOnly} onChange={onChange} onReset={onReset} />
    <Group title="Målvakter" rows={rows.filter(r => r.goalkeeper)} readOnly={readOnly} onChange={onChange} onReset={onReset} />
  </section>;
}
