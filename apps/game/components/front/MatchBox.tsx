'use client';
// Arena Nights -- DSH-01b C "Match Box" (score-bug styling) with DSH-01g B "Form Strip" embedded.
// Headline + countdown -> readiness line -> opponent form -> ladder ±2 with verified zone marks.
// The opponent opens in the club Peek; readiness jumps to the court coverage card; "Förbered match" starts prep.
import Link from 'next/link';
import { useState } from 'react';
import type { LadderRow, MatchBox as MatchBoxModel } from '@/lib/career/frontPage';
import { getClub } from '@/lib/game-data';
import ClubCrest from '@/components/ClubCrest';
import FormDots from '@/components/FormDots';
import { ClubLink } from '@/components/entityLinks';
import ClubPeek from '@/components/manager/ClubPeek';

const OUTCOME: Record<string, string> = { W: 'Vinst', D: 'Oavgjort', L: 'Förlust' };

export function MatchBox({ box, ladder, clubId, competitionHref }: { box: MatchBoxModel; ladder: readonly LadderRow[]; clubId: string; competitionHref: string }) {
  const [peek, setPeek] = useState<string | null>(null);
  const { next, readiness: r, recent } = box;
  const own = getClub(clubId);
  const readinessParts = [`${r.available} spelbara`, r.doubtful ? `${r.doubtful} tveksamma` : null, r.injured ? `${r.injured} skadade` : null, r.suspended ? `${r.suspended} avstängda` : null, r.away ? `${r.away} borta` : null].filter(Boolean);
  return <section className="hm-mbox" data-matchday={next?.matchday || undefined} aria-labelledby="hm-mbox-h">
    <div className="hm-mbox-head">
      <div className="hm-mbox-kicker"><span>{next ? next.competition : 'Matchrutan'}</span>{next && <span className="hm-mbox-count" data-today={next.matchday || undefined}>{next.countdown}</span>}</div>
      {next ? <>
        <h2 id="hm-mbox-h">{next.headline}</h2>
        <p className="hm-mbox-when">{next.when}</p>
        <div className="hm-mbox-bug" aria-label={`${next.home ? own?.name : next.opponent} mot ${next.home ? next.opponent : own?.name}`}>
          {[next.home ? clubId : next.opponentId, next.home ? next.opponentId : clubId].map((id, i) => <span key={id} className="hm-mbox-side" data-own={id === clubId || undefined}>
            {i === 1 && <span className="hm-mbox-vs" aria-hidden="true">–</span>}
            <ClubCrest clubId={id} shortName={getClub(id)?.shortName ?? id} primaryColor={getClub(id)?.primaryColor ?? ''} size={40} />
            <b>{getClub(id)?.shortName ?? id}</b>
          </span>)}
        </div>
        <div className="hm-mbox-actions">
          <button type="button" className="hm-btn" onClick={() => setPeek(next.opponentId)}>Motståndaren →</button>
          <Link className="hm-btn" href="/career/tactics">Taktiktavla →</Link>
          <Link className="hm-btn hm-btn-primary hm-mbox-prep" href="/career/match-preview">Förbered match →</Link>
        </div>
      </> : <>
        <h2 id="hm-mbox-h">Inget kommande avkast</h2>
        <p className="hm-mbox-when">Inga matcher inplanerade för din klubb just nu.</p>
        <div className="hm-mbox-actions"><Link className="hm-btn" href="/career/schedule">Spelschemat →</Link></div>
      </>}
    </div>

    <div className="hm-mbox-ready">
      <a className="hm-mbox-readiness" href="#hm-court" aria-label={`Truppläget: ${readinessParts.join(', ')} av ${r.total}. Visa positionerna.`}>
        <span className="hm-mbox-label">Truppläget</span>
        <span className="hm-mbox-line">{readinessParts.map((p, i) => <span key={i} data-kind={i === 0 ? 'ok' : String(p).includes('tveksam') ? 'doubt' : 'out'}>{p}</span>)}</span>
        <small>av {r.total} i truppen · se positionerna ↓</small>
      </a>
      {next && <div className="hm-mbox-opp">
        <span className="hm-mbox-label">Motståndarens form</span>
        <div><button type="button" className="hm-mbox-opp-name" onClick={() => setPeek(next.opponentId)}>{next.opponent}</button>{next.opponentPosition && <span className="hm-mbox-chip">{next.opponentPosition}:a av {next.opponentTeams}</span>}</div>
        {next.opponentForm.length ? <FormDots results={next.opponentForm} /> : <small>Inga spelade matcher ännu</small>}
      </div>}
      <div className="hm-mbox-form">
        <span className="hm-mbox-label">Senaste fem · {own?.shortName}</span>
        {recent.length ? <ol className="hm-formstrip">{recent.map(b => <li key={b.fixtureId}><Link href={b.href} data-outcome={b.outcome} aria-label={`${OUTCOME[b.outcome]} ${b.score} ${b.home ? 'hemma' : 'borta'} mot ${b.opponent}, ${b.date}. Matchrapport.`}>
          <b>{b.score}</b><small>{b.home ? 'H' : 'B'} {b.opponent}</small>
          <span className="hm-formstrip-card" role="presentation"><ClubCrest clubId={b.opponentId} shortName={b.opponent} primaryColor={getClub(b.opponentId)?.primaryColor ?? ''} size={22} /><span>{OUTCOME[b.outcome]} · {b.label}<br />{b.date}</span></span>
        </Link></li>)}</ol> : <p className="hm-mbox-empty">Säsongens första avkast väntar. Resultaten samlas här.</p>}
        <Link className="hm-mbox-more" href="/career/schedule">Matcharkivet →</Link>
      </div>
    </div>

    <div className="hm-mbox-ladder">
      <span className="hm-mbox-label">Tabelläget ±2</span>
      {ladder.length ? <ol>{ladder.map(row => <li key={row.clubId} data-own={row.own || undefined} data-zone={row.zone?.tone} data-zone-start={row.zoneStart || undefined}>
        <span className="hm-mbox-pos">{row.position}</span>
        <span className="hm-mbox-club"><ClubLink clubId={row.clubId} showCrest={false}>{row.name}</ClubLink>{row.zoneStart && row.zone && <small className="cz-zone" data-tone={row.zone.tone}>{row.zone.label}</small>}</span>
        <span className="hm-mbox-num">{row.played} m</span>
        <span className="hm-mbox-num">{row.goalDifference > 0 ? '+' : ''}{row.goalDifference}</span>
        <strong className="hm-mbox-num">{row.points} p</strong>
      </li>)}</ol> : <p className="hm-mbox-empty">Tabellen visas när serien har startat.</p>}
      <Link className="hm-mbox-more" href={competitionHref}>Ligan, resultaten och rivalerna →</Link>
    </div>
    {next && <div className="hm-mbox-sticky"><Link className="hm-btn hm-btn-primary" href="/career/match-preview">Förbered match →</Link></div>}
    {peek && <ClubPeek clubId={peek} onClose={() => setPeek(null)} actions={<Link className="hm-btn" href="/career/match-preview">Motståndaranalys →</Link>} />}
  </section>;
}
