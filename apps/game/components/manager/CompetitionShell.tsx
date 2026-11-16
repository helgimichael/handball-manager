'use client';
// Arena Nights -- CMP-01 / CMP-01g shared competition shell: header (title, meta, switcher), URL tabs and the
// round-grouped fixture/result list (CMP-01b/c) used by leagues and the cup alike.
import type { ReactNode } from 'react';
import Link from 'next/link';
import { getClub } from '@/lib/game-data';
import type { RoundGroup } from '@/lib/competition/leagueCentre';
import { matchReportHref } from '@/lib/career/fixtureRoutes';
import { ClubLink } from '@/components/entityLinks';

const short = (id: string) => getClub(id)?.shortName ?? id;

export function CompetitionShellHeader({ eyebrow, title, switcher, meta, tabs }: { eyebrow: string; title: string; switcher: ReactNode; meta: ReactNode; tabs: ReactNode }) {
  return <>
    <header className="cc-head">
      <div><span className="cc-eyebrow">{eyebrow}</span><h1>{title}</h1><div className="cc-meta">{meta}</div></div>
      <div className="cc-head-tools">{switcher}<Link href="/career/competitions">Alla tävlingar →</Link></div>
    </header>
    {tabs}
  </>;
}
export function ShellTabs({ href, tab, tabs, label }: { href: string; tab: string; tabs: readonly (readonly [string, string])[]; label: string }) {
  return <nav className="hm-tabs cc-tabs" aria-label={label}>{tabs.map(([t, text]) => <Link key={t} aria-current={tab === t ? 'page' : undefined} href={`${href}?tab=${t}`} scroll={false}>{text}</Link>)}</nav>;
}
// ---------------------------------------------------------------- CMP-01b/c: round-grouped fixtures and results
export function RoundList({ groups, compact = false }: { groups: readonly RoundGroup[]; compact?: boolean }) {
  return <div className="cc-rounds" data-compact={compact || undefined}>{groups.map(g => <section key={g.key} className="cc-round" data-own={g.own || undefined}>
    {!compact ? <h3><span>{g.label}</span><small>{g.dates}</small></h3> : <p className="cc-muted cc-round-date">{g.dates}</p>}
    <ul>{g.rows.map(({ fixture: f, own, homePosition, awayPosition, result, halfTime }) => {
      const href = result ? matchReportHref(f.id) : `/career/fixtures/${encodeURIComponent(f.id)}`;
      return <li key={f.id} data-own={own || undefined}>
        {!compact && <span className="cc-fx-date">{f.date.slice(5)}{f.kickoffTime ? ` ${f.kickoffTime}` : ''}</span>}
        <span className="cc-fx-team" data-side="home">{homePosition && <span className="cc-chip" title="Tabellplacering">{homePosition}</span>}<ClubLink clubId={f.homeClubId} showCrest={!compact}>{short(f.homeClubId)}</ClubLink></span>
        <Link className="cc-fx-score" href={href} aria-label={result ? `${short(f.homeClubId)} ${result.homeGoals}–${result.awayGoals} ${short(f.awayClubId)}, matchrapport` : `${short(f.homeClubId)} mot ${short(f.awayClubId)}, matchsida`}>{result ? `${result.homeGoals}–${result.awayGoals}` : 'vs'}{result && halfTime && !compact && <small title="Halvtid">({halfTime})</small>}{result?.decider && <small>{result.decider.method === 'SHOOTOUT' ? 'e. str' : 'e. förl'}</small>}</Link>
        <span className="cc-fx-team" data-side="away"><ClubLink clubId={f.awayClubId} showCrest={!compact}>{short(f.awayClubId)}</ClubLink>{awayPosition && <span className="cc-chip" title="Tabellplacering">{awayPosition}</span>}</span>
        {own && !result && !compact && <Link className="cc-fx-prep" href="/career/match-preview">Förbered →</Link>}
      </li>;
    })}</ul>
  </section>)}</div>;
}

