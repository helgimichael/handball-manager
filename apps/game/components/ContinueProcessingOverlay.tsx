"use client";

// Display only: Continue has already committed these dates/events exactly once.
import { useEffect, useRef, useState } from 'react';
import { formatGameDate } from '@/lib/career/dateUtils';
import type { CareerEvent } from '@/lib/career/careerEvents';
import ClubCrest from './ClubCrest';
import { CAREER_EVENT_LABEL, type ProgressionNotice } from './game/progressionPresentation';
import './game/game-feedback.css';

export type ProcessingDay = { date: string; events: CareerEvent[] };

export default function ContinueProcessingOverlay({ days, clubName, clubShortName, season, notice, onFinished }: {
  days: readonly ProcessingDay[]; clubName: string; clubShortName: string; season: string;
  notice: ProgressionNotice; onFinished: () => void;
}) {
  const [revealed, setRevealed] = useState(1);
  const dialog = useRef<HTMLDialogElement>(null);
  const finished = useRef(false);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  useEffect(() => {
    if (revealed >= days.length) return;
    // Bounded reveal; long stretches must not become a long wait.
    const timer = setTimeout(() => setRevealed(n => n + 1), Math.min(180, 900 / Math.max(1, days.length)));
    return () => clearTimeout(timer);
  }, [revealed, days.length]);
  useEffect(() => {
    if (revealed < days.length) return;
    const timer = setTimeout(() => {
      if (finished.current) return;
      finished.current = true;
      onFinished();
    }, 500);
    return () => clearTimeout(timer);
  }, [revealed, days.length, onFinished]);
  function finish() {
    if (finished.current) return;
    finished.current = true;
    onFinished();
  }
  const date = days[Math.min(revealed, days.length) - 1]?.date;
  const allEvents = days.flatMap(day => day.events);
  const training = allEvents.filter(e => e.type === 'TRAINING_COMPLETED').length;
  const highlights = allEvents.filter(e => e.type !== 'TRAINING_COMPLETED').slice(-5);
  return <dialog ref={dialog} className="game-world-advance" aria-labelledby="world-advance-title" onCancel={event => { event.preventDefault(); finish(); }}>
    <header><ClubCrest shortName={clubShortName} primaryColor="#121d31" size={62} /><div><span className="game-overline">{clubName} · {season}</span><h2 id="world-advance-title">Världen går vidare.</h2></div><button className="hm-btn hm-btn-sm" onClick={finish}>Visa händelsen →</button></header>
    <div className="game-advance-body">
      <section className="game-advance-calendar" aria-label="Säsongens datum">
        <span className="game-overline">Från {days[0] ? formatGameDate(days[0].date) : 'idag'}</span>
        <strong role="status" aria-live="polite">{date ? formatGameDate(date) : 'Säsongen uppdaterad'}</strong>
        <div className="game-advance-days" aria-hidden="true">{days.slice(-12).map((day, index) => <span key={day.date} data-revealed={days.length - Math.min(days.length, 12) + index < revealed}>{Number(day.date.slice(-2))}</span>)}</div>
        <p>{days.length} dagar i spelvärlden{training > 0 ? ` · ${training} träningsdagar genomförda` : ''}</p>
        <div className="game-advance-events">{highlights.length ? highlights.map(event => <article key={event.id}><time>{formatGameDate(event.date)}</time><div><small>{CAREER_EVENT_LABEL[event.type]}</small><strong>{event.subject}</strong></div></article>) : <p>Inga ytterligare besked under perioden.</p>}</div>
      </section>
      <aside className="game-advance-stop" data-kind={notice.kind}><span className="game-overline">{notice.kind === 'matchday' ? 'Avkast väntar' : notice.kind === 'decision' ? 'Ditt beslut behövs' : notice.kind === 'season' ? 'Säsongsavslut' : 'Vi stannade här'}</span><h3>{notice.title}</h3><p>{notice.detail}</p><span>{notice.actionLabel}</span></aside>
    </div>
    <footer><span>Händelserna finns kvar i din karriär.</span><span>Esc · visa händelsen direkt</span></footer>
  </dialog>;
}
