"use client";
// Arena Nights -- ANL-02a "Matcher": any played match of the club -> its report story (ANL-01). Replaces
// the "Senaste matchen" tab (ANL-05 merged into the report).
import { useState } from 'react';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { playedMatches, clubShort } from '@/lib/matchday/preMatch';
import { matchReportHref } from '@/lib/career/fixtureRoutes';
import { WindowToggle } from '@/components/analysis/Trends';
import { SceneEmpty } from '@/components/game/Secondary';

type Filter = 'ALL' | 'LEAGUE' | 'OTHER';
const TYPE_LABEL: Record<string, string> = { LEAGUE: 'Liga', CUP: 'Cup', FRIENDLY: 'Träningsmatch', PLAYOFF: 'Slutspel' };

export default function AnalysisMatchesPage() {
  const { career } = useCareer();
  const [filter, setFilter] = useState<Filter>('ALL');
  const me = career.playerClubId;
  const own = playedMatches(career).filter((m) => m.homeClubId === me || m.awayClubId === me);
  const shown = own.filter((m) => filter === 'ALL' || (filter === 'LEAGUE' ? m.type === 'LEAGUE' : m.type !== 'LEAGUE'));
  if (!own.length) return <SceneEmpty title="Inga spelade matcher ännu" actions={<><Link className="hm-btn hm-btn-sm hm-btn-primary" href="/career/match-preview">Matchförberedelse →</Link><Link className="hm-btn hm-btn-sm" href="/career/schedule">Matchprogrammet →</Link></>}>Varje spelad match får en matchrapport med berättelse, statistik och repris. Den första dyker upp här efter slutsignalen.</SceneEmpty>;
  return <div className="an-page">
    <section className="an-section" aria-labelledby="an-matches-h">
      <header><h2 id="an-matches-h">Matcher</h2><small>{own.length} spelade matcher i karriären · välj en för matchrapporten</small><WindowToggle label="Tävling" value={filter} onChange={setFilter} options={[{ id: 'ALL', label: 'Alla' }, { id: 'LEAGUE', label: 'Liga' }, { id: 'OTHER', label: 'Cup & övrigt' }]} /></header>
      {shown.length ? <ol className="an-matchlist">{shown.map((m) => {
        const diff = (m.homeGoals - m.awayGoals) * (m.homeClubId === me ? 1 : -1);
        const r = diff > 0 ? 'W' : diff < 0 ? 'L' : 'D';
        return <li key={m.fixtureId} data-r={r}><Link href={matchReportHref(m.fixtureId)}>
          <time>{m.date}</time>
          <span className="an-result" aria-label={r === 'W' ? 'Vinst' : r === 'L' ? 'Förlust' : 'Oavgjort'}>{r === 'W' ? 'V' : r === 'L' ? 'F' : 'O'}</span>
          <b>{clubShort(m.homeClubId)} <span className="an-num">{m.homeGoals}–{m.awayGoals}</span> {clubShort(m.awayClubId)}</b>
          <small>{TYPE_LABEL[m.type] ?? 'Kval'} · {m.homeClubId === me ? 'hemma' : 'borta'}</small>
          <span aria-hidden="true">→</span>
        </Link></li>;
      })}</ol> : <p className="an-empty">Inga matcher av den här typen ännu.</p>}
    </section>
  </div>;
}
