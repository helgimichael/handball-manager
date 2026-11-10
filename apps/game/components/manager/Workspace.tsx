import Link from 'next/link';
import type { ReactNode } from 'react';
import type { CareerFixture, CareerState } from '@/lib/career/types';
import { ClubLink } from '@/components/entityLinks';
import { getClub } from '@/lib/game-data';
import { careerArchiveSummaries } from '@/lib/career/matchArchiveSummary';

export function PageHeading({ title, eyebrow, description, actions }: { title: string; eyebrow?: string; description?: string; actions?: ReactNode }) {
  return <header className="hm-page-heading"><div>{eyebrow && <div className="hm-eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="hm-actions">{actions}</div>}</header>;
}
export function Panel({ title, actions, children }: { title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return <section className="hm-panel"><div className="hm-panel-header"><h2 className="hm-panel-title">{title}</h2>{actions}</div>{children}</section>;
}
export function EmptyState({ children }: { children: ReactNode }) { return <div className="hm-empty">{children}</div>; }
export function CompetitionLink({ id, children }: { id: string; children: ReactNode }) { return <Link href={`/career/competitions/${encodeURIComponent(id)}`}>{children}</Link>; }
export function matchHref(state: CareerState, fixture: CareerFixture) {
  return state.results[fixture.id] || state.matchArchives?.[fixture.id] || state.matchArchiveIds?.includes(fixture.id) ? `/career/match-report/${encodeURIComponent(fixture.id)}` : `/career/fixtures/${encodeURIComponent(fixture.id)}`;
}
export function FixtureTable({ career, fixtures }: { career: CareerState; fixtures: readonly CareerFixture[] }) {
  const summaries = careerArchiveSummaries(career);
  if (!fixtures.length) return <EmptyState>Inga matcher i denna vy.</EmptyState>;
  return <div className="hm-scroll-x"><table className="hm-table"><thead><tr><th>Datum</th><th>Hemma</th><th>Resultat / match</th><th>Borta</th><th>Omg</th></tr></thead><tbody>{fixtures.map(f => {
    const result = career.results[f.id] ?? summaries[f.id]?.result;
    return <tr key={f.id} data-highlight={f.homeClubId === career.playerClubId || f.awayClubId === career.playerClubId}><td title={f.scheduleNote ? `${f.scheduleNote} Ursprungligt datum: ${f.originalDate}.` : undefined}>{f.date}{f.kickoffTime ? ` ${f.kickoffTime}` : ""}</td><td><ClubLink clubId={f.homeClubId}>{getClub(f.homeClubId)?.shortName ?? f.homeClubId}</ClubLink></td><td><Link className="hm-result-link" href={matchHref(career, f)}>{result ? `${result.homeGoals}–${result.awayGoals}` : 'Förhandsvisa →'}</Link></td><td><ClubLink clubId={f.awayClubId}>{getClub(f.awayClubId)?.shortName ?? f.awayClubId}</ClubLink></td><td>{f.type === 'LEAGUE' ? f.round : f.type === 'CUP' ? 'Cup' : 'Träningsmatch'}</td></tr>;
  })}</tbody></table></div>;
}
