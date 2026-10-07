'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { ArchiveReplay } from '@/components/ProductionMatchView';
import { getClub } from '@/lib/game-data';
export default function MatchReplays() {
  const { career } = useCareer();
  const [selected, setSelected] = useState('');
  const archives = Object.values(career.matchArchives ?? {}).sort((a, b) => b.fixture.date.localeCompare(a.fixture.date));
  const archive = archives.find(a => a.fixture.id === selected) ?? archives[0];
  return <div className="hm-grid" style={{ gap: 12 }}><div className="hm-panel-body"><h2>Matchrepriser</h2>{career.productionMatch && <p><Link className="hm-btn hm-btn-primary" href={`/career/match-day/${career.productionMatch.fixture.id}`}>Fortsätt pågående match</Link></p>}{archive ? <select aria-label="Välj matchrepris" value={archive.fixture.id} onChange={e => setSelected(e.target.value)}>{archives.map(a => <option key={a.fixture.id} value={a.fixture.id}>{a.fixture.date} · {getClub(a.fixture.homeClubId)?.shortName} {a.result.homeGoals}–{a.result.awayGoals} {getClub(a.fixture.awayClubId)?.shortName}</option>)}</select> : <p>När du har spelat en match kan du se den igen här.</p>}</div>{archive && <ArchiveReplay key={archive.fixture.id} archive={archive} />}</div>;
}
