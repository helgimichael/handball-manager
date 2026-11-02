"use client";

import { useEffect, useRef, useState } from 'react';
import ClubCrest from '../ClubCrest';
import './career-initialization.css';

type ClubIdentity = { id?: string; name: string; shortName: string; primaryColor: string };

/** Presentation only: no career data, persistence or progress estimation lives here. */
export default function CareerInitialization({ club, competition, season, existing = false, failed = false, errorMessage, onBack }: {
  club?: ClubIdentity;
  competition?: string;
  season?: string;
  existing?: boolean;
  failed?: boolean;
  errorMessage?: string;
  onBack?: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (failed) heading.current?.focus(); }, [failed]);
  // HM-ALPHA3-M10: a long career can take a while to open. After a few seconds the
  // screen says so and shows the time spent -- no estimate, since none would be honest.
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (failed) return;
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [failed]);
  const slow = !failed && seconds >= 6;

  return <main className="career-initialization" aria-labelledby="career-initialization-heading">
    <header className="career-initialization-brand"><span aria-hidden="true">HM</span><strong>HANDBALL<br />MANAGER</strong></header>
    <section className="career-initialization-scene">
      <div className="career-initialization-copy">
        <span className="career-initialization-overline">{failed ? 'Ditt nästa steg' : 'Din klubb. Din säsong.'}</span>
        <h1 id="career-initialization-heading" ref={heading} tabIndex={-1}>{failed ? 'KUNDE INTE ÖPPNA KARRIÄREN' : existing ? 'ÖPPNAR DIN KARRIÄR…' : 'BYGGER DIN HANDBOLLSVÄRLD…'}</h1>
        {failed ? <div role="alert"><p>{errorMessage ?? 'Något gick fel när karriären skulle öppnas.'}</p><p>{errorMessage ? 'Återgå till dina val och försök igen.' : 'Gå till huvudmenyn för att öppna en sparad karriär eller se över dina val.'}</p></div> : <div className="career-initialization-status" role="status" aria-live="polite" aria-atomic="true"><span className="career-initialization-activity" aria-hidden="true" /><p>{existing ? 'Laddar ditt lag och dina sparade beslut.' : 'Förbereder din nya karriär.'}</p></div>}
        {failed ? <button type="button" className="hm-btn hm-btn-primary" onClick={onBack}>{errorMessage ? 'Tillbaka och försök igen →' : 'Till huvudmenyn →'}</button> : <p className="career-initialization-note">{slow ? <>Långa karriärer tar längre tid att öppna. Spelet arbetar fortfarande – stäng inte fliken. <span className="career-initialization-elapsed">{seconds} s</span></> : 'Det här kan ta en liten stund.'}</p>}
      </div>
      {club && <aside className="career-initialization-club" aria-label="Din valda klubb">
        <ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} clubId={club.id} size={112} />
        <h2>{club.name}</h2><p>{competition}</p>{season && <span>{season}</span>}
      </aside>}
    </section>
    <footer>Sju positioner. Ett lag. Din karriär.</footer>
  </main>;
}
