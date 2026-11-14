'use client';
// Arena Nights C5.1 -- the Week Spine (ENT-07 C, DSH-01i, ENT-10, ENT-08 C clock). One component:
// collapsed in the shell on every page, expanded on Idag (day detail) -- same data model (lib/career/weekSpine).
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { CareerState } from '@/lib/career/types';
import { buildWeekSpine, type SpineDay, type SpinePinKind } from '@/lib/career/weekSpine';
import { formatGameDate } from '@/lib/career/dateUtils';

const KIND_LABEL: Record<SpinePinKind, string> = { MATCH: 'Match', RESULT: 'Resultat', ACTION: 'Att avgöra', PRESS: 'Press', BOARD: 'Styrelsen', WINDOW: 'Transferfönster', TRANSFER: 'Övergång', CONTRACT: 'Kontrakt', SCOUTING: 'Scouting', KICKOFF: 'Ligastart' };
const DAY_TYPE: Record<string, string> = { TRAINING: 'Träning', RECOVERY: 'Återhämtning', REST: 'Vila', MATCH: 'Matchdag', TRAVEL: 'Resa' };

export default function WeekSpine({ career, expanded = false }: { career: CareerState; expanded?: boolean }) {
  const spine = useMemo(() => buildWeekSpine(career), [career]);
  const [selected, setSelected] = useState<string>(career.gameDate);
  const day = spine.days.find((d) => d.date === selected) ?? spine.days.find((d) => d.isToday) ?? spine.days[0]!;
  const nm = spine.nextMatch;
  return <section className="hm-spine" data-expanded={expanded} aria-label="Veckan">
    <div className="hm-spine-clock">
      <span className="hm-spine-clock-day">{formatGameDate(career.gameDate).split(' ').slice(0, 3).join(' ')}</span>
      {nm ? <Link href={nm.href} className="hm-spine-countdown" data-matchday={nm.daysUntil === 0}>
        <b>{nm.daysUntil === 0 ? 'Matchdag' : nm.daysUntil === 1 ? '1 dag' : `${nm.daysUntil} dagar`}</b>
        <span>{nm.daysUntil === 0 ? '' : 'till '}{nm.opponent} – {nm.home ? 'hemma' : 'borta'}</span>
      </Link> : <span className="hm-spine-countdown"><span>{career.managerCareer?.seekingJob ? 'Utan klubb' : career.seasonComplete ? 'Säsongen avslutad' : 'Ingen match planerad'}</span></span>}
    </div>
    <ol className="hm-spine-days">
      {spine.days.map((d) => <SpineCell key={d.date} day={d} selected={expanded && d.date === day.date} onSelect={expanded ? () => setSelected(d.date) : undefined} />)}
    </ol>
    {spine.upNext.length > 0 && <div className="hm-spine-next" aria-label="Härnäst">
      <span className="hm-spine-next-label">Härnäst</span>
      <ol>{spine.upNext.map((u, i) => <li key={`${u.date}-${i}`}><Link href={u.href}><time dateTime={u.date}>{u.date === career.gameDate ? 'Idag' : formatGameDate(u.date).split(' ')[0]}</time> {u.label}</Link></li>)}</ol>
    </div>}
    {expanded && <div className="hm-spine-detail" aria-live="polite">
      <h3>{formatGameDate(day.date)} · {DAY_TYPE[day.dayType] ?? day.dayType}</h3>
      {day.sessions.length > 0 && <p>{day.sessions.length} träningspass: {day.sessions.join(', ')}</p>}
      {day.pins.length === 0 && day.sessions.length === 0 && <p className="hm-text-muted">Inget inplanerat.</p>}
      <ul>{day.pins.map((p) => <li key={p.id} data-kind={p.kind}><Link href={p.href}><span>{KIND_LABEL[p.kind]}</span> {p.detail}</Link></li>)}</ul>
      <div className="hm-spine-detail-actions"><Link className="hm-btn hm-btn-sm" href="/career/calendar">Hela kalendern →</Link><Link className="hm-btn hm-btn-sm hm-btn-ghost" href="/career/training">Hantera träning →</Link></div>
    </div>}
  </section>;
}

function SpineCell({ day, selected, onSelect }: { day: SpineDay; selected: boolean; onSelect?: () => void }) {
  const title = [`${day.weekday} ${day.dayOfMonth}`, DAY_TYPE[day.dayType] ?? day.dayType, ...day.pins.map((p) => p.detail), day.continueStop ? 'Fortsätt stannar här' : ''].filter(Boolean).join(' · ');
  const body = <>
    <span className="hm-spine-wd">{day.weekday}</span>
    <strong>{day.dayOfMonth}</strong>
    <span className="hm-spine-pins" aria-hidden="true">{day.pins.slice(0, 4).map((p) => <i key={p.id} data-kind={p.kind} />)}{day.sessions.length > 0 && !day.pins.some((p) => p.kind === 'MATCH' || p.kind === 'RESULT') && <i data-kind="TRAINING" />}</span>
    {day.pins[0] && <span className="hm-spine-pin-label">{day.pins[0].label}</span>}
    {day.continueStop && <span className="hm-spine-stop" aria-hidden="true">▸</span>}
  </>;
  const common = { 'data-today': day.isToday, 'data-past': day.isPast, 'data-daytype': day.dayType, 'data-stop': day.continueStop, 'data-selected': selected, title, 'aria-label': title } as const;
  return <li className="hm-spine-day" {...common}>
    {onSelect ? <button type="button" onClick={onSelect} aria-pressed={selected}>{body}</button> : <Link href="/career/calendar">{body}</Link>}
  </li>;
}
