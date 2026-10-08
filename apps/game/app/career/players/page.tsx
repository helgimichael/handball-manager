'use client';
import { useMemo } from 'react';
import { useWorkspaceState } from '@/components/game/WorkspaceMemory';
import Link from 'next/link';
import { useCareer } from '@/lib/career/CareerContext';
import { managementPlayers } from '@/lib/career/management';
import { getClub, COMPETITIONS } from '@/lib/game-data';
import { playerAgeAtDate } from '@/lib/development/developmentIntegration';
import { getPlayerContractStatus } from '@/lib/economy/contractIntegration';
import { CONTRACT_STATUS_LABEL } from '@/lib/economy/labels';
import { getPlayerKnowledgePct } from '@/lib/knowledge/knowledgeIntegration';
import { getRecruitmentStatus } from '@/lib/career/recruitment';
import { ClubLink } from '@/components/entityLinks';
import { PageHeading, Panel, EmptyState } from '@/components/manager/Workspace';
import { SortableTh, applySortDirection, type SortState } from '@/components/SortableTh';
import { isRetiredClubId } from '@/lib/career/playerLifecycle';
import { PlayerCell, PlayerHero } from '@/components/game/Identity';
import { KnowledgeMeter, RecruitmentTag } from '@/components/game/RecruitmentPresentation';
import { getClubScouts } from '@/lib/career/scouting';

type Key = 'name' | 'age' | 'knowledge' | 'contract' | 'goals';
export default function PlayerSearchPage() {
  const { career, addToShortlist, removeFromShortlist } = useCareer();
  const [query, setQuery] = useWorkspaceState('players.query', '');
  const [position, setPosition] = useWorkspaceState('players.position', 'ALL');
  const [league, setLeague] = useWorkspaceState('players.league', 'ALL');
  const [nation, setNation] = useWorkspaceState('players.nation', 'ALL');
  const [maxAge, setMaxAge] = useWorkspaceState('players.age', '');
  const [contract, setContract] = useWorkspaceState('players.contract', 'ALL');
  const [sort, setSort] = useWorkspaceState<SortState<Key>>('players.sort', { key: 'name', direction: 'asc' });
  const [page, setPage] = useWorkspaceState('players.page', 0);
  const [selectedId, setSelectedId] = useWorkspaceState<string | null>('players.selected', null);
  const players = useMemo(() => managementPlayers(career).filter(p => p.clubId !== career.playerClubId && !isRetiredClubId(p.clubId)).map(player => ({ player, age: playerAgeAtDate(player.dateOfBirth, player.birthYear, career.gameDate), contract: career.playerContracts[player.id], status: getPlayerContractStatus(career, player.id), knowledge: getPlayerKnowledgePct(career, player.id, player.clubId), goals: career.playerSeasonStats[player.id]?.goals ?? 0 })), [career]);
  const nations = useMemo(() => [...new Set(players.map(r => r.player.nationality))].sort(), [players]);
  const rows = useMemo(() => players.filter(r => {
    const p = r.player;
    return `${p.firstName} ${p.lastName} ${getClub(p.clubId)?.name ?? ''}`.toLocaleLowerCase('sv').includes(query.toLocaleLowerCase('sv')) && (position === 'ALL' || p.position === position || p.secondaryPosition === position) && (league === 'ALL' || getClub(p.clubId)?.competitionId === league) && (nation === 'ALL' || p.nationality === nation) && (!maxAge || (r.age !== null && r.age <= Number(maxAge))) && (contract === 'ALL' || (contract === 'FREE_AGENT' ? !p.clubId : r.status === 'EXPIRING' || r.status === 'EXPIRING_SOON'));
  }).sort((a, b) => applySortDirection(sort.direction, sort.key === 'name' ? a.player.lastName.localeCompare(b.player.lastName) : sort.key === 'contract' ? (a.contract?.contractEndDate ?? '').localeCompare(b.contract?.contractEndDate ?? '') : sort.key === 'age' ? (a.age ?? Infinity) - (b.age ?? Infinity) : a[sort.key] - b[sort.key])), [players, query, position, league, nation, maxAge, contract, sort]);
  const lastPage = Math.max(0, Math.ceil(rows.length / 60) - 1);
  const currentPage = Math.min(page, lastPage);
  const selected = rows.find(r => r.player.id === selectedId) ?? rows[currentPage * 60];
  const shortlistCount = Object.values(career.recruitmentTargets).filter(t => t.shortlisted).length;
  const scouts = getClubScouts(career);
  function reset() { setPage(0); }
  return <div className="game-discovery-page"><PageHeading eyebrow="Rekrytering / spelarmarknad" title="Spelarsök" description="Nästa förstärkning börjar här. Hitta rollen, följ spelaren och lär känna ditt nästa värvningsmål." actions={<Link href="/career/recruitment?view=SHORTLIST" className="hm-btn">Öppna kortlista →</Link>} />
    <div className="game-market-stage"><div><span className="hm-eyebrow">Utanför den egna truppen</span><h2>Hitta nästa pusselbit.</h2><p>Från första observation till en plats i laget.</p></div><div className="game-market-count"><strong>{players.length}</strong><span>spelare på marknaden</span></div><div className="game-market-count"><strong>{shortlistCount}</strong><span>på din kortlista</span></div><div className="game-market-count"><strong>{scouts.length}</strong><span>scouter i klubben</span></div></div>
    <div className="game-market-layout"><div className="game-market-results">
    <Panel title={`${rows.length} spelare`}><div className="hm-filter-bar">
      <label>Namn / klubb<input className="hm-input" aria-label="Sök spelarmarknaden" value={query} onChange={e => { setQuery(e.target.value); reset(); }} placeholder="Namn eller klubb" /></label>
      <label>Position<select className="hm-select" value={position} onChange={e => { setPosition(e.target.value); reset(); }}>{['ALL', 'MV', 'V6', 'V9', 'M9', 'M6', 'H9', 'H6'].map(p => <option key={p} value={p}>{p === 'ALL' ? 'Alla positioner' : p}</option>)}</select></label>
      <label>Max ålder<input className="hm-input hm-input-small" type="number" min="16" max="60" value={maxAge} onChange={e => { setMaxAge(e.target.value); reset(); }} /></label>
      <label>Nationalitet<select className="hm-select" value={nation} onChange={e => { setNation(e.target.value); reset(); }}><option value="ALL">Alla</option>{nations.map(n => <option key={n}>{n}</option>)}</select></label>
      <label>Tävling<select className="hm-select" value={league} onChange={e => { setLeague(e.target.value); reset(); }}><option value="ALL">Alla tävlingar</option>{COMPETITIONS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Avtal<select className="hm-select" value={contract} onChange={e => { setContract(e.target.value); reset(); }}><option value="ALL">Alla avtal</option><option value="EXPIRING">Utgående inom ett år</option><option value="FREE_AGENT">Fria agenter</option></select></label>
    </div><div className="hm-scroll-x game-market-table"><table className="hm-table"><thead><tr><SortableTh label="Spelare" sortKey="name" sort={sort} onSort={setSort} /><th>Klubb</th><th>Pos</th><SortableTh label="Ålder" sortKey="age" sort={sort} onSort={setSort} numeric /><SortableTh label="Kännedom" sortKey="knowledge" sort={sort} onSort={setSort} numeric /><SortableTh label="Avtal till" sortKey="contract" sort={sort} onSort={setSort} /><SortableTh label="Mål" sortKey="goals" sort={sort} onSort={setSort} numeric defaultDirection="desc" /><th>Process</th><th>Åtgärder</th></tr></thead><tbody>{rows.slice(currentPage * 60, currentPage * 60 + 60).map(r => <tr key={r.player.id} data-selected={selected?.player.id === r.player.id} data-clickable="true" onClick={() => setSelectedId(r.player.id)}><td><PlayerCell player={r.player} /></td><td>{r.player.clubId ? <ClubLink clubId={r.player.clubId} stopPropagation>{getClub(r.player.clubId)?.shortName ?? 'Okänd klubb'}</ClubLink> : 'Fri agent'}</td><td>{r.player.position}</td><td>{r.age ?? '—'}</td><td><KnowledgeMeter pct={r.knowledge} /></td><td>{r.contract?.contractEndDate ?? (r.status ? CONTRACT_STATUS_LABEL[r.status] : '—')}</td><td>{r.goals}</td><td><RecruitmentTag status={getRecruitmentStatus(career, r.player.id)} /></td><td><div className="hm-actions"><button className="hm-btn hm-btn-sm" aria-label={`Kortlista ${r.player.firstName} ${r.player.lastName}`} aria-pressed={!!career.recruitmentTargets[r.player.id]?.shortlisted} onClick={e => { e.stopPropagation(); if (career.recruitmentTargets[r.player.id]?.shortlisted) removeFromShortlist(r.player.id); else addToShortlist(r.player.id); }}>{career.recruitmentTargets[r.player.id]?.shortlisted ? 'Kortlistad' : '+ Kortlista'}</button><button className="hm-btn hm-btn-sm" aria-label={`Visa dossier för ${r.player.firstName} ${r.player.lastName}`} onClick={() => setSelectedId(r.player.id)}>Visa</button><Link href={`/career/compare?left=${encodeURIComponent(r.player.id)}`}>Jämför</Link></div></td></tr>)}</tbody></table></div>{!rows.length && <EmptyState>Inga spelare matchar filtren. Bredda sökningen.</EmptyState>}<div className="hm-filter-bar"><button className="hm-btn hm-btn-sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Föregående</button><span>Sida {currentPage + 1} av {lastPage + 1} · högst 60 rader per sida</span><button className="hm-btn hm-btn-sm" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Nästa</button></div></Panel></div>
    <aside className="game-target-dossier" aria-label="Vald spelare">{selected ? <><div className="game-dossier-heading"><span className="hm-eyebrow">Spelardossier</span><RecruitmentTag status={getRecruitmentStatus(career, selected.player.id)} /></div><PlayerHero player={selected.player} career={career} /><div className="game-dossier-body"><KnowledgeMeter pct={selected.knowledge} /><dl className="game-dossier-facts"><div><dt>Klubb</dt><dd>{selected.player.clubId ? <ClubLink clubId={selected.player.clubId}>{getClub(selected.player.clubId)?.name ?? 'Okänd klubb'}</ClubLink> : 'Fri agent'}</dd></div><div><dt>Avtal till</dt><dd>{selected.contract?.contractEndDate ?? '—'}</dd></div><div><dt>Säsongsmål</dt><dd>{selected.goals}</dd></div></dl><div className="game-discovery-actions"><Link className="hm-btn hm-btn-primary" href={`/career/squad/${encodeURIComponent(selected.player.id)}`}>Öppna spelarprofil →</Link><Link className="hm-btn" href={`/career/scouting?target=${encodeURIComponent(selected.player.id)}`}>Scouta spelare</Link><Link className="hm-btn" href={`/career/transfers?target=${encodeURIComponent(selected.player.id)}`}>Öppna bud & budget</Link></div></div></> : <EmptyState>Välj en spelare när sökningen har träffar.</EmptyState>}</aside></div></div>;
}
