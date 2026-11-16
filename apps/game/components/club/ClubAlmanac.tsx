'use client';
// Arena Nights -- the Club Almanac (CLB-01c C): an honours timeline (gold markers on a neon line; a season opens
// its season book) beside the club's facts, the stands' mood with its causes and rivals with head-to-head.
// National-team windows live in the calendar now; the next break is only signposted.
import Link from 'next/link';
import type { ClubAlmanac } from '@/lib/club/clubAlmanac';
import { clubShort } from '@/lib/club/clubTimeline';

export function ClubAlmanacSection({ almanac }: { almanac: ClubAlmanac }) {
  const s = almanac.supporters;
  return (
    <section className="ca-almanac" aria-labelledby="ca-h">
      <h2 id="ca-h" className="ca-h">Almanackan</h2>
      <div className="ca-grid">
        <div className="ca-main">
          <ol className="ca-timeline" aria-label="Säsong för säsong">
            {[...almanac.seasons].reverse().map((x) => (
              <li key={x.seasonId} data-current={x.current || undefined} data-honour={x.honours.some((h) => h !== 'Nedflyttning') || undefined}>
                <span className="ca-year">{x.seasonId}</span>
                <div>
                  {x.current ? <strong>Pågår nu</strong> : <Link href={`/career/history?season=${encodeURIComponent(x.seasonId)}`}>{x.position ? `${x.position}:a av ${x.teams}` : 'Ingen placering'} →</Link>}
                  {x.honours.map((h) => <span key={h} className="ca-honour" data-kind={h === 'Nedflyttning' ? 'down' : 'up'}>{h}</span>)}
                </div>
              </li>
            ))}
          </ol>
          {almanac.seasons.length === 1 && <p className="ca-note">Din första säsong. Varje avslutad säsong och titel skrivs in här.</p>}
        </div>
        <aside className="ca-side" aria-label="Klubbfakta">
          <dl className="ca-facts">
            {almanac.facts.map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}
            {almanac.colors.length > 0 && <div><dt>Klubbfärger</dt><dd className="ca-colors">{almanac.colors.map((c) => <i key={c} style={{ backgroundColor: c }} title={c} />)}</dd></div>}
            <div><dt>Meriter i din tid</dt><dd>{almanac.honoursCount || 'Inga ännu'}</dd></div>
          </dl>
          <div className="ca-fans" data-tone={s.tone}>
            <header><small>Läktaren</small><strong>{s.label} <span>{s.score > 0 ? `+${s.score}` : s.score}</span></strong></header>
            <div className="ca-fans-meter" role="meter" aria-valuemin={-50} aria-valuemax={50} aria-valuenow={s.score} aria-label="Stämningen bland supportrarna"><i style={{ left: `${(s.score + 50)}%` }} /></div>
            <ul className="ca-causes">{s.causes.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
          {almanac.rivals.length > 0 && (
            <div className="ca-rivals">
              <small>Rivaler</small>
              <ul>{almanac.rivals.map((r) => (
                <li key={r.clubId}>
                  <Link href={`/career/clubs/${encodeURIComponent(r.clubId)}`}>{clubShort(r.clubId)}</Link>
                  <span className="ca-h2h" aria-label={`Inbördes: ${r.h2h.won} vinster, ${r.h2h.drawn} oavgjorda, ${r.h2h.lost} förluster`}>{r.h2h.played ? `${r.h2h.won}–${r.h2h.drawn}–${r.h2h.lost}` : 'Inga möten'}</span>
                  <small>{r.reasons.join(' · ')}</small>
                </li>
              ))}</ul>
            </div>
          )}
          {almanac.nationalBreak && <p className="ca-note">Nästa landslagsuppehåll: {almanac.nationalBreak.title}, {almanac.nationalBreak.start}–{almanac.nationalBreak.end}. <Link href="/career/calendar">Kalendern →</Link></p>}
        </aside>
      </div>
    </section>
  );
}
