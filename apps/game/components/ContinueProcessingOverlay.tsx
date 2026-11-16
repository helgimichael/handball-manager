"use client";

// Arena 231 -- ENT-10a C "Calendar flip → floodlight build-up". Display only: Continue has already committed
// these dates/events exactly once. A calendar page flips once per processed day with that day's one-line
// highlight; the header crest is the club's own. At the end the calendar is replaced by the stop: a Floodlight
// 'Matchdag' card with both crests when the stop is a match, otherwise an event card that docks onto the Spine
// (ENT-09a). Duration scales with the days (cap 1.5 s); Esc / the button skips; reduced motion = no flip.
import { useEffect, useRef, useState } from 'react';
import { formatGameDate } from '@/lib/career/dateUtils';
import type { CareerEvent } from '@/lib/career/careerEvents';
import ClubCrest from './ClubCrest';
import { CAREER_EVENT_LABEL, type ProgressionNotice } from './game/progressionPresentation';
import './game/game-feedback.css';
import './shell/shell-231.css';

export type ProcessingDay = { date: string; events: CareerEvent[] };
type CrestClub = { id: string; name: string; shortName: string; primaryColor: string };

const WEEKDAY = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
const MONTH = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const parts = (iso: string) => { const d = new Date(`${iso}T00:00:00Z`); return { wd: WEEKDAY[d.getUTCDay()]!, day: d.getUTCDate(), month: MONTH[d.getUTCMonth()]! }; };

/** One line per day: the first non-training event, else the training count. */
export function dayHighlight(day: ProcessingDay): string {
  const e = day.events.find((x) => x.type !== 'TRAINING_COMPLETED');
  if (e) return `${CAREER_EVENT_LABEL[e.type]} · ${e.subject}`;
  return day.events.some((x) => x.type === 'TRAINING_COMPLETED') ? 'Träning genomförd' : 'Lugn dag';
}

export default function ContinueProcessingOverlay({ days, club, season, notice, match, onFinished }: {
  days: readonly ProcessingDay[]; club: CrestClub; season: string;
  notice: ProgressionNotice; match?: { home: CrestClub; away: CrestClub; label?: string } | null; onFinished: () => void;
}) {
  const [revealed, setRevealed] = useState(1);
  const dialog = useRef<HTMLDialogElement>(null);
  const finished = useRef(false);
  const reduced = useRef(typeof window !== 'undefined' && (document.documentElement.dataset.motion === 'reduced' || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches));
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  useEffect(() => {
    if (revealed >= days.length) return;
    // Bounded: the whole flip never takes more than ~1.5 s, however long the stretch.
    const timer = setTimeout(() => setRevealed(n => n + 1), reduced.current ? 0 : Math.max(60, Math.min(260, 1500 / Math.max(1, days.length))));
    return () => clearTimeout(timer);
  }, [revealed, days.length]);
  const done = revealed >= days.length;
  useEffect(() => {
    if (!done) return;
    // A match stop gets a beat longer under the lights.
    const timer = setTimeout(() => {
      if (finished.current) return;
      finished.current = true;
      onFinished();
    }, notice.kind === 'matchday' ? 1600 : 1200);
    return () => clearTimeout(timer);
  }, [done, onFinished, notice.kind]);
  function finish() {
    if (finished.current) return;
    finished.current = true;
    onFinished();
  }
  const current = days[Math.min(revealed, days.length) - 1];
  const p = current ? parts(current.date) : null;
  const allEvents = days.flatMap(day => day.events);
  const training = allEvents.filter(e => e.type === 'TRAINING_COMPLETED').length;
  const highlights = days.slice(0, revealed).filter(d => d.events.some(e => e.type !== 'TRAINING_COMPLETED')).slice(-5);
  const floodlight = done && notice.kind === 'matchday';
  return <dialog ref={dialog} className="game-world-advance hm-advance" data-stage={done ? (floodlight ? 'floodlight' : 'stop') : 'flip'} aria-labelledby="world-advance-title" onCancel={event => { event.preventDefault(); finish(); }}>
    <header><ClubCrest clubId={club.id} shortName={club.shortName} primaryColor={club.primaryColor} size={52} /><div><span className="game-overline">{club.name} · {season}</span><h2 id="world-advance-title">Världen går vidare.</h2></div><button className="hm-btn hm-btn-sm" onClick={finish}>{notice.kind === 'matchday' ? 'Förbered match →' : 'Visa händelsen →'}</button></header>
    <div className="hm-advance-body">
      {!done ? <section className="hm-advance-calendar" aria-label="Säsongens datum">
        <div className="hm-advance-page" key={current?.date} aria-hidden="true"><span>{p?.wd}</span><strong className="ce-num">{p?.day}</strong><span>{p?.month}</span></div>
        <strong className="hm-advance-date" role="status" aria-live="polite">{current ? formatGameDate(current.date) : 'Säsongen uppdaterad'}</strong>
        <p className="hm-advance-line">{current ? dayHighlight(current) : ''}</p>
        <span className="hm-advance-count ce-num">Dag {Math.min(revealed, days.length)} av {days.length}</span>
      </section> : floodlight ? <section className="game-advance-stop hm-advance-floodlight" data-kind={notice.kind}>
        <span className="game-overline">Matchdag{match?.label ? ` · ${match.label}` : ''}</span>
        {match && <div className="hm-advance-crests"><ClubCrest clubId={match.home.id} shortName={match.home.shortName} primaryColor={match.home.primaryColor} size={64} /><b>mot</b><ClubCrest clubId={match.away.id} shortName={match.away.shortName} primaryColor={match.away.primaryColor} size={64} /></div>}
        <h3>{notice.title}</h3><p>{notice.detail}</p><span>{notice.actionLabel}</span>
      </section> : <section className="game-advance-stop hm-advance-stopcard" data-kind={notice.kind}>
        <span className="game-overline">{notice.kind === 'decision' ? 'Ditt beslut behövs' : notice.kind === 'season' ? 'Säsongsavslut' : 'Vi stannade här'}</span>
        <h3>{notice.title}</h3><p>{notice.detail}</p><span>{notice.actionLabel}</span>
      </section>}
      <aside className="hm-advance-highlights" aria-label="Händelser under perioden">
        <span className="game-overline">{days.length} dagar{training > 0 ? ` · ${training} träningsdagar` : ''}</span>
        {highlights.length ? <ol>{highlights.map(d => { const e = d.events.find(x => x.type !== 'TRAINING_COMPLETED')!; return <li key={d.date}><time className="ce-num">{parts(d.date).wd} {parts(d.date).day}</time><div><small>{CAREER_EVENT_LABEL[e.type]}</small><strong>{e.subject}</strong></div></li>; })}</ol> : <p>Inga ytterligare besked under perioden.</p>}
      </aside>
    </div>
    <footer><span>Händelserna finns kvar i din karriär.</span><span>Esc · {notice.kind === 'matchday' ? 'till matchen direkt' : 'visa händelsen direkt'}</span></footer>
  </dialog>;
}
