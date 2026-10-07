'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useCareer } from '@/lib/career/CareerContext';
import { getCareerClub, getCareerSquad } from '@/lib/career/careerWorld';
import { averageRating, emptyPlayerSeasonStats } from '@/lib/career/types';
import { squadEnergy } from '@/lib/career/management';
import { isSelectableForMatch, resolveStatusLabel } from '@/lib/career/playerStatus';
import { playerAgeAtDate } from '@/lib/development/developmentIntegration';
import { SQUAD_STATUS_TIERS, SQUAD_STATUS_TIER_LABEL_SV, type SquadStatusTier } from '@/lib/career/squadStatus';
import { formatEur } from '@/lib/economy/currency';
import { PlayerLink } from '@/components/entityLinks';
import { SortableTh, applySortDirection, type SortState } from '@/components/SortableTh';
import { PageHeading, Panel, EmptyState } from '@/components/manager/Workspace';

type Key = 'name' | 'position' | 'age' | 'appearances' | 'starts' | 'goals' | 'shots' | 'rating' | 'energy' | 'contract' | 'wage' | 'load';
type View = 'overview' | 'performance' | 'physical' | 'contracts';
export default function SquadPage() {
  const { career, updateSquadStatus } = useCareer();
  const club = getCareerClub(career);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [view, setView] = useState<View>('overview');
  const [selected, setSelected] = useState<string[]>([]);
  const [sort, setSort] = useState<SortState<Key>>({ key: 'position', direction: 'asc' });
  const squad = getCareerSquad(career);
  const rows = useMemo(() => squad.map(p => {
    const stats = career.playerSeasonStats[p.id] ?? emptyPlayerSeasonStats(p.id);
    return { p, name: `${p.firstName} ${p.lastName}`, position: p.position, age: playerAgeAtDate(p.dateOfBirth, p.birthYear, career.gameDate), ...stats, rating: averageRating(stats), energy: squadEnergy(career, p), contract: career.playerContracts[p.id]?.contractEndDate ?? '', wage: career.playerContracts[p.id]?.wageEurPerMonth ?? 0, load: career.playerPhysicalState[p.id]?.recentLoad ?? 0 };
  }).filter(r => r.name.toLocaleLowerCase('sv').includes(query.toLocaleLowerCase('sv')) && (position === 'ALL' || r.position === position || r.p.secondaryPosition === position) && (status === 'ALL' || (status === 'AVAILABLE' ? isSelectableForMatch(career.playerStatuses, r.p.id) : status === 'TIRED' ? r.energy < 75 : !isSelectableForMatch(career.playerStatuses, r.p.id)))).sort((a, b) => {
    const av = a[sort.key] ?? 0, bv = b[sort.key] ?? 0;
    return applySortDirection(sort.direction, typeof av === 'string' && typeof bv === 'string' ? av.localeCompare(bv) : Number(av) - Number(bv));
  }), [squad, career, query, position, status, sort]);
  const column = (label: string, key: Key, numeric = true) => <SortableTh label={label} sortKey={key} sort={sort} onSort={setSort} numeric={numeric} defaultDirection={numeric ? 'desc' : 'asc'} />;
  const perf = view === 'overview' || view === 'performance';
  const physical = view === 'overview' || view === 'physical';
  const contracts = view === 'contracts';
  return <><PageHeading eyebrow={`${club.name} / ${career.seasonId}`} title="Trupp" description={`${squad.length} spelare · sätt roller, bedöm prestation och planera rotation.`} actions={<Link className="hm-btn hm-btn-primary" href="/career/tactics">Matchtrupp & startsju →</Link>} />
    <nav className="hm-tabs" aria-label="Truppvyer">{([['overview', 'Översikt'], ['performance', 'Prestation'], ['physical', 'Fysisk status'], ['contracts', 'Kontrakt']] as const).map(([id, label]) => <button key={id} aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}</nav>
    <Panel title={`${rows.length} av ${squad.length} spelare`} actions={selected.length === 2 ? <Link className="hm-btn hm-btn-sm hm-btn-primary" href={`/career/compare?left=${encodeURIComponent(selected[0])}&right=${encodeURIComponent(selected[1])}`}>Jämför valda spelare →</Link> : <span className="hm-text-muted">Välj två spelare för jämförelse</span>}>
      <div className="hm-filter-bar"><label>Sök spelare<input className="hm-input" value={query} onChange={e => setQuery(e.target.value)} /></label><label>Position<select className="hm-select" value={position} onChange={e => setPosition(e.target.value)}>{['ALL','MV','V6','V9','M9','M6','H9','H6'].map(p => <option key={p} value={p}>{p === 'ALL' ? 'Alla' : p}</option>)}</select></label><label>Tillstånd<select className="hm-select" value={status} onChange={e => setStatus(e.target.value)}><option value="ALL">Alla</option><option value="AVAILABLE">Tillgängliga</option><option value="UNAVAILABLE">Otillgängliga</option><option value="TIRED">Energi under 75%</option></select></label><button className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => { setQuery(''); setPosition('ALL'); setStatus('ALL'); }}>Rensa filter</button></div>
      <div className="hm-scroll-x"><table className="hm-table"><thead><tr><th>Välj</th><th>Nr</th>{column('Spelare','name',false)}{column('Pos','position',false)}{column('Ålder','age')}{!contracts && <th>Trupproll</th>}{perf && <>{column('M','appearances')}{column('Starter','starts')}{column('Mål','goals')}<th>Skott % / försök</th><th>Räddningar % / mötta</th>{column('Betyg','rating')}</>}{physical && <>{column('Energi','energy')}{view === 'physical' && column('Senaste belastning','load')}<th>Tillgänglighet</th><th>Återkomst</th></>}{(contracts || view === 'overview') && column('Avtal till','contract',false)}{contracts && <>{column('Lön / månad','wage')}<th>Åtgärd</th></>}</tr></thead><tbody>{rows.map(r => <tr key={r.p.id} data-highlight={selected.includes(r.p.id)}><td><input type="checkbox" aria-label={`Jämför ${r.name}`} checked={selected.includes(r.p.id)} disabled={selected.length >= 2 && !selected.includes(r.p.id)} onChange={e => setSelected(prev => e.target.checked ? [...prev, r.p.id].slice(0,2) : prev.filter(id => id !== r.p.id))} /></td><td><span className="hm-shirt-number">{r.p.shirtNumber ?? '—'}</span></td><td><PlayerLink playerId={r.p.id}>{r.name}</PlayerLink></td><td>{r.position}</td><td>{r.age ?? '—'}</td>{!contracts && <td><select className="hm-select" aria-label={`Trupproll ${r.name}`} value={career.playerSquadStatus[r.p.id] ?? 'ROTATION'} onChange={e => updateSquadStatus(r.p.id, e.target.value as SquadStatusTier)}>{SQUAD_STATUS_TIERS.map(t => <option key={t} value={t}>{SQUAD_STATUS_TIER_LABEL_SV[t]}</option>)}</select></td>}{perf && <><td>{r.appearances}</td><td>{r.starts}</td><td>{r.goals}</td><td>{r.shots ? `${Math.round(r.goals / r.shots * 100)}% / ${r.shots}` : '—'}</td><td>{r.shotsFaced ? `${Math.round(r.saves / r.shotsFaced * 100)}% / ${r.shotsFaced}` : '—'}</td><td>{r.appearances ? r.rating.toFixed(1) : '—'}</td></>}{physical && <><td>{Math.round(r.energy)}%</td>{view === 'physical' && <td>{r.load.toFixed(1)}</td>}<td><span className={`hm-badge hm-badge-${isSelectableForMatch(career.playerStatuses,r.p.id) ? 'neutral' : 'negative'}`}>{resolveStatusLabel(career.playerStatuses,r.p)}</span></td><td>{career.playerInjuries[r.p.id]?.activeInjury?.expectedReturnDate ?? career.playerStatuses[r.p.id]?.returnDate ?? '—'}</td></>}{(contracts || view === 'overview') && <td>{r.contract || '—'}</td>}{contracts && <><td>{formatEur(r.wage)}</td><td><Link href={`/career/squad/${r.p.id}`}>Förläng / profil →</Link></td></>}</tr>)}</tbody></table></div>{!rows.length && <EmptyState>Inga spelare matchar dina filter.</EmptyState>}
    </Panel><Panel title="Positionsdjup"><div className="hm-filter-bar">{['MV','V6','V9','M9','M6','H9','H6'].map(p => <button className="hm-btn hm-btn-sm" key={p} onClick={() => { setPosition(p); setStatus('ALL'); }}>{p} · {squad.filter(x => x.position === p && isSelectableForMatch(career.playerStatuses,x.id)).length} tillgängliga</button>)}</div></Panel></>;
}
