'use client';
// Arena Nights -- CMP-04 A "Leaderboards by position", shared with CMP-01d (the competition centre's Statistik tab):
// seven position leader cards (each with its own yardstick) above the full ranking table.
// Phone: position tabs show one card at a time; the table scrolls inside its own container.
import { useMemo, useState } from 'react';
import { useCareer } from '@/lib/career/CareerContext';
import { positionLeaders } from '@/lib/competition/leaderboards';
import type { PlayerSeasonStats } from '@/lib/career/types';
import { PlayerLink, ClubLink } from '@/components/entityLinks';
import { getClub } from '@/lib/game-data';
import StatisticsTable from './StatisticsTable';
import { Panel } from './Workspace';

export default function CompetitionStats({ competitionId, statistics }: { competitionId: string; statistics?: Record<string, PlayerSeasonStats> }) {
  const { career } = useCareer();
  const cards = useMemo(() => positionLeaders(career, competitionId, statistics), [career, competitionId, statistics]);
  const [active, setActive] = useState(cards[0]?.position ?? 'MV');
  return <div className="cc-stats">
    <section className="cc-leaders" aria-label="Ledare per position">
      <div className="cc-leader-tabs" role="tablist" aria-label="Position">{cards.map(c => <button key={c.position} type="button" role="tab" aria-selected={active === c.position} onClick={() => setActive(c.position)}>{c.position}</button>)}</div>
      <div className="cc-leader-grid">{cards.map(c => <article key={c.position} className="cc-leader-card" data-active={active === c.position}>
        <header><span className="cc-leader-pos">{c.position}</span><span><strong>{c.title}</strong><small>{c.metricLabel}</small></span></header>
        {c.leaders.length ? <ol>{c.leaders.map((l, i) => <li key={l.player.id} data-own={l.player.clubId === career.playerClubId || undefined}><span className="cc-leader-rank">{i + 1}</span><span className="cc-leader-who"><PlayerLink playerId={l.player.id}>{l.player.firstName} {l.player.lastName}</PlayerLink><small>{l.player.clubId ? <ClubLink clubId={l.player.clubId} showCrest={false}>{getClub(l.player.clubId)?.shortName ?? l.player.clubId}</ClubLink> : 'Fri agent'} · {l.detail}</small></span><strong className="cc-leader-value">{l.value}</strong></li>)}</ol> : <p className="cc-empty-note">Ingen spelare har tillräckligt underlag ännu. Ledaren visas när matcher har registrerats.</p>}
      </article>)}</div>
    </section>
    <Panel title="Spelarranking"><StatisticsTable competitionId={competitionId} statistics={statistics} /></Panel>
  </div>;
}
