'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { ArchiveReplay } from '@/components/ProductionMatchView';
import { getClub } from '@/lib/game-data';
import { careerArchiveSummaries } from '@/lib/career/matchArchiveSummary';
import { useMatchArchive } from '@/lib/save/useMatchArchive';
export default function MatchReplays() {
  const { career } = useCareer();
  const [selected, setSelected] = useState('');
  const summaries = careerArchiveSummaries(career);
  const ids = [...new Set([...(career.matchArchiveIds ?? []), ...Object.keys(summaries)])].sort((a, b) => (summaries[b]?.fixture.date ?? '').localeCompare(summaries[a]?.fixture.date ?? ''));
  const replay = useMatchArchive(selected);
  return <div className="hm-grid" style={{ gap: 12 }}><div className="hm-panel-body"><h2>Matchrepriser ? nyckel?gonblick</h2>
    {career.productionMatch && <p><Link className="hm-btn hm-btn-primary" href={`/career/match-day/${career.productionMatch.fixture.id}`}>Forts?tt p?g?ende match</Link></p>}
    {ids.length ? <select aria-label="V?lj matchrepris" value={selected} onChange={e => setSelected(e.target.value)}><option value="">V?lj en match att visa</option>{ids.map(id => {
      const summary = summaries[id];
      return <option key={id} value={id}>{summary ? `${summary.fixture.date} ? ${getClub(summary.fixture.homeClubId)?.shortName} ${summary.result.homeGoals}?${summary.result.awayGoals} ${getClub(summary.fixture.awayClubId)?.shortName}` : `Matcharkiv ? ${id}`}</option>;
    })}</select> : <p>N?r du har spelat en match kan du se den igen h?r.</p>}</div>
    {replay.loading && <p role="status">Laddar matchreprisen?</p>}
    {replay.error && <div role="alert"><p>{replay.error}</p><button className="hm-btn" onClick={replay.retry}>F?rs?k igen</button></div>}
    {replay.archive && <ArchiveReplay key={selected} archive={replay.archive} defaultShowExperimental />}
  </div>;
}
