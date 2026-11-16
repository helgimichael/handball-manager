"use client";

// Arena 231 -- ENT-12 C "First-day handover" (Arena adaptation): the club crest in its own neon, facts ticking in
// one by one (arena, forecast, board expectation -- or, for a saved career, the save's own cover facts), a rotating
// handball tip, and -- when opening took longer than three seconds -- an explicit 'Gå in på kontoret' button
// instead of an auto-jump. Presentation only: no career data, persistence or progress estimation lives here.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import ClubCrest, { CrestPlaceholderNote } from '../ClubCrest';
import { clubVisualIdentity } from '@/lib/game-data';
import { clubIdentityStyle } from '@/lib/career/activeClubIdentity';
import { fetchClubPreseasonContexts } from '@/lib/newGame/clubSelectionContext';
import './career-initialization.css';
import '../entry/entry.css';

type ClubIdentity = { id?: string; name: string; shortName: string; primaryColor: string; competitionId?: string; venue?: string; venueCapacity?: number };
export type HandoverFact = { label: string; value: string };

const TIPS: readonly { title: string; text: string }[] = [
  { title: '7 mot 6', text: 'Byt ut målvakten mot en sjunde utespelare i anfall – men ett bolltapp ger motståndaren ett öppet mål.' },
  { title: '6-0-försvar', text: 'Sex försvarare på linjen stänger kanterna och tvingar fram distansskott. Kräver långa, rörliga mittbackar.' },
  { title: 'Timeout', text: 'Varje lag har tre lagtimeouts per match, högst två per halvlek. Spara en till slutminuterna.' },
  { title: 'Passivt spel', text: 'När domaren varnar för passivt spel har anfallet högst fyra passningar kvar innan det måste bli skott.' },
  { title: 'Snabb mitt', text: 'Efter insläppt mål kan ni starta direkt från mittcirkeln – fysiken avgör om det lönar sig.' },
  { title: 'Utvisning', text: 'Två minuters utvisning ger motståndaren numerärt överläge. Disciplin i försvaret vinner jämna matcher.' },
];

/** Presentation only: no career data, persistence or progress estimation lives here. */
export default function CareerInitialization({ club, competition, season, existing = false, failed = false, errorMessage, onBack, facts, signed = false, ready = false, onEnter }: {
  club?: ClubIdentity;
  competition?: string;
  season?: string;
  existing?: boolean;
  failed?: boolean;
  errorMessage?: string;
  onBack?: () => void;
  /** Facts shown one by one; when absent for a new career they are read from the club's preseason context. */
  facts?: readonly HandoverFact[];
  /** The contract was just signed (ENT-03f): the crest lands as a stamp. */
  signed?: boolean;
  /** The career is open; show 'Gå in på kontoret' instead of the loading status. */
  ready?: boolean;
  onEnter?: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const enter = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (failed) heading.current?.focus(); }, [failed]);
  useEffect(() => { if (ready) enter.current?.focus(); }, [ready]);
  // HM-ALPHA3-M10: a long career can take a while to open. After a few seconds the
  // screen says so and shows the time spent -- no estimate, since none would be honest.
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (failed || ready) return;
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [failed, ready]);
  const slow = !failed && !ready && seconds >= 6;

  // New careers: the facts come from the same preseason context the club wall showed.
  const [loadedFacts, setLoadedFacts] = useState<HandoverFact[] | null>(null);
  const clubId = club?.id, competitionId = club?.competitionId;
  useEffect(() => {
    if (facts || existing || !clubId || !competitionId) return;
    let cancelled = false;
    void fetchClubPreseasonContexts(competitionId).then((list) => {
      const c = list?.find((x) => x.clubId === clubId);
      if (!cancelled && c) setLoadedFacts([{ label: 'Förhandstips', value: `${c.predicted}:a av ${c.clubsInLeague}` }, { label: 'Styrelsens förväntan', value: c.expectation }]);
    });
    return () => { cancelled = true; };
  }, [facts, existing, clubId, competitionId]);
  const arenaFact: HandoverFact[] = club?.venue ? [{ label: 'Arena', value: `${club.venue}${club.venueCapacity ? ` · ${club.venueCapacity.toLocaleString('sv-SE')} platser` : ''}` }] : [];
  const shownFacts = facts ?? [...arenaFact, ...(loadedFacts ?? [])];

  const [tip, setTip] = useState(() => (club?.name.length ?? 0) % TIPS.length);
  useEffect(() => {
    if (failed) return;
    const timer = window.setInterval(() => setTip((t) => (t + 1) % TIPS.length), 7000);
    return () => window.clearInterval(timer);
  }, [failed]);
  const style = club?.id ? clubIdentityStyle(clubVisualIdentity(club.id)).style as CSSProperties : undefined;

  return <main className="career-initialization ce-handover" aria-labelledby="career-initialization-heading" style={style} data-ready={ready}>
    <header className="career-initialization-brand"><span aria-hidden="true">HM</span><strong>HANDBALL<br />MANAGER</strong></header>
    <section className="career-initialization-scene">
      <div className="career-initialization-copy">
        <span className="career-initialization-overline">{failed ? 'Ditt nästa steg' : existing ? 'Tillbaka på kontoret' : 'Första dagen på jobbet'}</span>
        <h1 id="career-initialization-heading" ref={heading} tabIndex={-1}>{failed ? 'KUNDE INTE ÖPPNA KARRIÄREN' : ready ? (existing ? 'KONTORET ÄR ÖPPET.' : 'VÄLKOMMEN TILL KLUBBEN.') : existing ? 'ÖPPNAR DIN KARRIÄR…' : 'BYGGER DIN HANDBOLLSVÄRLD…'}</h1>
        {failed ? <div role="alert"><p>{errorMessage ?? 'Något gick fel när karriären skulle öppnas.'}</p><p>{errorMessage ? 'Återgå till dina val och försök igen.' : 'Gå till huvudmenyn för att öppna en sparad karriär eller se över dina val.'}</p></div>
          : ready ? <div className="ce-handover-ready"><p>{existing ? 'Allt ligger där du lämnade det.' : 'Laget, staben och säsongen är på plats.'}</p></div>
          : <div className="career-initialization-status" role="status" aria-live="polite" aria-atomic="true"><span className="career-initialization-activity" aria-hidden="true" /><p>{existing ? 'Laddar ditt lag och dina sparade beslut.' : 'Förbereder din nya karriär.'}</p></div>}
        {failed ? <button type="button" className="hm-btn hm-btn-primary" onClick={onBack}>{errorMessage ? 'Tillbaka och försök igen →' : 'Till huvudmenyn →'}</button>
          : ready ? <button ref={enter} type="button" className="hm-btn hm-btn-primary ce-handover-enter" onClick={onEnter}>Gå in på kontoret →</button>
          : <p className="career-initialization-note">{slow ? <>Långa karriärer tar längre tid att öppna. Spelet arbetar fortfarande – stäng inte fliken. <span className="career-initialization-elapsed">{seconds} s</span></> : 'Det här kan ta en liten stund.'}</p>}
        {!failed && <aside className="ce-tip" aria-label="Handbollstips">
          <header><span className="career-initialization-overline">Tips · {TIPS[tip]!.title}</span><span className="ce-tip-nav"><button type="button" aria-label="Föregående tips" onClick={() => setTip((t) => (t + TIPS.length - 1) % TIPS.length)}>‹</button><button type="button" aria-label="Nästa tips" onClick={() => setTip((t) => (t + 1) % TIPS.length)}>›</button></span></header>
          <p key={tip}>{TIPS[tip]!.text}</p>
        </aside>}
      </div>
      {club && <aside className="career-initialization-club" aria-label="Din valda klubb">
        <span className="ce-handover-crest" data-signed={signed}><ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} clubId={club.id} size={112} /></span>
        <CrestPlaceholderNote clubId={club.id} />
        <h2>{club.name}</h2><p>{competition}</p>{season && <span>{season}</span>}
        {!failed && shownFacts.length > 0 && <ul className="ce-handover-facts">{shownFacts.map((f, i) => <li key={f.label} style={{ ['--i' as string]: i }}><small>{f.label}</small><strong>{f.value}</strong></li>)}</ul>}
      </aside>}
    </section>
    <footer>Sju positioner. Ett lag. Din karriär.</footer>
  </main>;
}
