'use client';
import { matchFitnessOf } from '@/lib/players/matchFitness';
import Link from 'next/link';
import { useMemo } from 'react';
import { useWorkspaceState } from '@/components/game/WorkspaceMemory';
import { useCareer } from '@/lib/career/CareerContext';
import { getCareerClub, getCareerSquad } from '@/lib/career/careerWorld';
import { averageRating, emptyPlayerSeasonStats } from '@/lib/career/types';
import { squadEnergy } from '@/lib/career/management';
import { isSelectableForMatch } from '@/lib/career/playerStatus';
import { playerAgeAtDate } from '@/lib/development/developmentIntegration';
import { SQUAD_STATUS_TIERS, SQUAD_STATUS_TIER_LABEL_SV, type SquadStatusTier } from '@/lib/career/squadStatus';
import { formatMoney } from '@/lib/economy/currency';
import { useMoney } from '@/lib/settings/usePreferences';
import { readinessSummary, RECOVERY_OUTLOOK_LABEL, WORKLOAD_TREND_LABEL } from '@/lib/training/readinessSummary';
import { clubColorVars, PlayerCell, SquadDepth, playerAvailabilityLabel } from '@/components/game/Identity';
import ClubCrest from '@/components/ClubCrest';
import { SortableTh, applySortDirection, type SortState } from '@/components/SortableTh';
import { MoraleBadge } from "@/components/players/PlayerDynamicsPanel";
import { PageHeading, Panel, EmptyState } from '@/components/manager/Workspace';
import { currentTeamRoles, setCaptaincy } from '@/lib/career/teamRoles';
import { EnvironmentBanner } from '@/components/clubhq/EnvironmentBanner';
import { getPlayerFormHistory } from '@/lib/career/playerForm';
import { PlayerFormSparkline } from '@/components/players/PlayerFormSparkline';

type Key = 'name' | 'position' | 'age' | 'appearances' | 'starts' | 'goals' | 'shots' | 'rating' | 'energy' | 'contract' | 'wage' | 'load';
type View = 'overview' | 'performance' | 'physical' | 'contracts';

export default function SquadPage() {
  useMoney();
  const { career, updateSquadStatus, updateCareer } = useCareer();
  const club = getCareerClub(career);
  const [query, setQuery] = useWorkspaceState('squad.query', '');
  const [position, setPosition] = useWorkspaceState('squad.position', 'ALL');
  const [status, setStatus] = useWorkspaceState('squad.status', 'ALL');
  const [view, setView] = useWorkspaceState<View>('squad.view', 'overview');
  const [formMode, setFormMode] = useWorkspaceState<'APPEARANCES' | 'FIXTURES'>('squad.formMode', 'APPEARANCES');
  const [selected, setSelected] = useWorkspaceState<string[]>('squad.selected', []);
  const [sort, setSort] = useWorkspaceState<SortState<Key>>('squad.sort', { key: 'position', direction: 'asc' });
  const squad = getCareerSquad(career);
  const roles = currentTeamRoles(career);

  const rows = useMemo(() => squad.map(p => {
    const stats = career.playerSeasonStats[p.id] ?? emptyPlayerSeasonStats(p.id);
    return { p, name: `${p.firstName} ${p.lastName}`, position: p.position, age: playerAgeAtDate(p.dateOfBirth, p.birthYear, career.gameDate), ...stats, rating: averageRating(stats), energy: squadEnergy(career, p), contract: career.playerContracts[p.id]?.contractEndDate ?? '', wage: career.playerContracts[p.id]?.wageEurPerMonth ?? 0, ...(() => { const readiness = readinessSummary(career, p.id); return { readiness, load: readiness.week.complete ? readiness.week.total : -1 }; })() };
  }).filter(r => r.name.toLocaleLowerCase('sv').includes(query.toLocaleLowerCase('sv')) && (position === 'ALL' || r.position === position || r.p.secondaryPosition === position) && (status === 'ALL' || (status === 'AVAILABLE' ? isSelectableForMatch(career.playerStatuses, r.p.id) : status === 'TIRED' ? r.energy < 75 : !isSelectableForMatch(career.playerStatuses, r.p.id)))).sort((a, b) => {
    const av = a[sort.key] ?? 0, bv = b[sort.key] ?? 0;
    return applySortDirection(sort.direction, typeof av === 'string' && typeof bv === 'string' ? av.localeCompare(bv) : Number(av) - Number(bv));
  }), [squad, career, query, position, status, sort]);

  const column = (label: string, key: Key, numeric = true) => <SortableTh label={label} sortKey={key} sort={sort} onSort={setSort} numeric={numeric} defaultDirection={numeric ? 'desc' : 'asc'} />;
  const perf = view === 'overview' || view === 'performance';
  const physical = view === 'overview' || view === 'physical';
  const contracts = view === 'contracts';
  const available = squad.filter(p => isSelectableForMatch(career.playerStatuses, p.id)).length;
  const tired = squad.filter(p => squadEnergy(career, p) < 75).length;
  const chosen = selected.flatMap(id => squad.filter(p => p.id === id));

  const avgFit = squad.length ? Math.round(squad.reduce((acc, p) => acc + matchFitnessOf(career, p.id), 0) / squad.length) : 100;
  const captainPlayer = roles.captainId ? squad.find(p => p.id === roles.captainId) : undefined;

  return <div className="hm-squad-screen" style={clubColorVars(club)}>
    <EnvironmentBanner
      environment="dressing-room"
      eyebrow={`${club.name} · Omklädningsrummet · ${career.seasonId}`}
      title="Truppen & Omklädningsrummet"
      subtitle="Din startsjua, din rotation och lagets inre hierarki. Granska form, belastning, kontrakt och utse kaptener."
      badge={`${available}/${squad.length} redo för spel`}
      actions={
        <>
          <Link className="hm-btn hm-btn-sm hm-btn-primary" href="/career/tactics">Matchtrupp & Taktiktavla →</Link>
          <Link className="hm-btn hm-btn-sm" href="/career/contracts">Kontrakt & Förlängningar →</Link>
        </>
      }
      metrics={[
        { label: "Truppstorlek", value: `${squad.length} spelare`, sub: `${available} tillgängliga`, tone: available === squad.length ? "positive" : "warning" },
        { label: "Matchträning", value: `${avgFit}%`, sub: `${tired} under 75% energi`, tone: tired === 0 ? "positive" : "warning" },
        { label: "Lagkapten", value: captainPlayer ? captainPlayer.lastName : "Ej utsedd", sub: captainPlayer ? `#${captainPlayer.shirtNumber} ${captainPlayer.position}` : "Välj i truppen", tone: "signal" },
      ]}
    />
    <SquadDepth career={career} />
    <nav className="hm-tabs" aria-label="Truppvyer">{([['overview', 'Översikt'], ['performance', 'Prestation'], ['physical', 'Fysisk status'], ['contracts', 'Kontrakt']] as const).map(([id, label]) => <button key={id} aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}</nav>
    <Panel title={`${rows.length} av ${squad.length} spelare`} actions={selected.length === 2 ? <Link className="hm-btn hm-btn-sm hm-btn-primary" href={`/career/compare?left=${encodeURIComponent(selected[0])}&right=${encodeURIComponent(selected[1])}`}>Jämför valda spelare →</Link> : <span className="hm-text-muted">Välj två spelare för jämförelse</span>}>
      <div className="hm-filter-bar"><label>Sök spelare<input className="hm-input" value={query} onChange={e => setQuery(e.target.value)} /></label><label>Position<select className="hm-select" value={position} onChange={e => setPosition(e.target.value)}>{['ALL','MV','V6','V9','M9','M6','H9','H6'].map(p => <option key={p} value={p}>{p === 'ALL' ? 'Alla' : p}</option>)}</select></label><label>Tillstånd<select className="hm-select" value={status} onChange={e => setStatus(e.target.value)}><option value="ALL">Alla</option><option value="AVAILABLE">Tillgängliga</option><option value="UNAVAILABLE">Otillgängliga</option><option value="TIRED">Energi under 75%</option></select></label><label>Formvisning<select className="hm-select" value={formMode} onChange={e => setFormMode(e.target.value as 'APPEARANCES' | 'FIXTURES')}><option value="APPEARANCES">Senaste 5 spelade</option><option value="FIXTURES">Senaste 5 matcherna (inkl. DNP)</option></select></label><button className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => { setQuery(''); setPosition('ALL'); setStatus('ALL'); }}>Rensa filter</button></div>
      {chosen.length > 0 && (
        <aside className="hm-squad-selection" aria-label="Valda spelare" aria-live="polite">
          <div><span className="hm-eyebrow">Spelardossier & jämförelse</span><strong>{chosen.length} / 2 valda</strong></div>
          {chosen.map(player => (
            <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <PlayerCell player={player} />
              <span className="hm-text-muted">{playerAvailabilityLabel(career,player.id)} · energi {Math.round(squadEnergy(career, player))}% · matchträning {Math.round(matchFitnessOf(career, player.id))}%</span>
              <button
                type="button"
                className="hm-btn hm-btn-sm"
                onClick={() => updateCareer(s => setCaptaincy(s, 'CAPTAIN', player.id))}
                disabled={roles.captainId === player.id}
              >
                {roles.captainId === player.id ? '★ Lagkapten' : 'Utsedd till kapten'}
              </button>
              <Link className="hm-btn hm-btn-sm" href={`/career/squad/${player.id}`}>Spelardossier →</Link>
            </div>
          ))}
          <button className="hm-btn hm-btn-sm" onClick={() => setSelected([])}>Rensa val</button>
        </aside>
      )}
      <div className="hm-scroll-x"><table className="hm-table hm-roster-table"><thead><tr><th>Välj</th><th>Nr</th>{column('Spelare','name',false)}{column('Pos','position',false)}{column('Ålder','age')}<th title="Moral 0-100: hur nöjd spelaren är just nu">Moral</th>{!contracts && <th>Trupproll</th>}{perf && <>{column('M','appearances')}{column('Starter','starts')}{column('Mål','goals')}<th>Skott % / försök</th><th>Räddningar % / mötta</th>{column('Betyg','rating')}<th title="Formkurva för de senaste 5 matcherna">Form (5M)</th></>}{physical && <>{column('Energi','energy')}<th title="Matchträning: van vid matchtempo. Byggs av speltid och sjunker utan matcher. Skiljer sig från energi (dagsform/vila).">Matchträning</th>{view === 'physical' && <>{column('Belastning 7 d','load')}<th title="Senaste 7 dagarna jämfört med snittet för de senaste 4 veckorna">Trend</th><th title="Hur väl spelaren återhämtar sig just nu (uthållighet, ålder, belastning, senaste match)">Återhämtning</th></>}<th>Tillgänglighet</th><th>Återkomst</th></>}{(contracts || view === 'overview') && column('Avtal till','contract',false)}{contracts && <>{column('Lön / månad','wage')}<th>Åtgärd</th></>}</tr></thead><tbody>{rows.map(r => {
        const isCaptain = roles.captainId === r.p.id;
        const isVice = roles.viceCaptainId === r.p.id;
        const penaltyIdx = roles.penaltyTakers.indexOf(r.p.id);
        return (
          <tr key={r.p.id} data-highlight={selected.includes(r.p.id)}>
            <td><input type="checkbox" aria-label={`Jämför ${r.name}`} checked={selected.includes(r.p.id)} disabled={selected.length >= 2 && !selected.includes(r.p.id)} onChange={e => setSelected(prev => e.target.checked ? [...prev, r.p.id].slice(0,2) : prev.filter(id => id !== r.p.id))} /></td>
            <td><span className="hm-shirt-number">{r.p.shirtNumber ?? '—'}</span></td>
            <td>
              <PlayerCell player={r.p}>
                {(isCaptain || isVice || penaltyIdx >= 0) && (
                  <span style={{ display: 'inline-flex', gap: 4, marginTop: 2 }}>
                    {isCaptain && <span className="hm-squad-role-pill" data-role="captain" title="Lagkapten">K</span>}
                    {isVice && <span className="hm-squad-role-pill" data-role="vice" title="Vicekapten">VK</span>}
                    {penaltyIdx >= 0 && <span className="hm-squad-role-pill" data-role="penalty" title={`7-metersskytt #${penaltyIdx + 1}`}>7m</span>}
                  </span>
                )}
              </PlayerCell>
            </td>
            <td><span className="hm-position-code">{r.position}</span></td>
            <td>{r.age ?? '—'}</td>
            <td><MoraleBadge playerId={r.p.id} /></td>
            {!contracts && <td><select className="hm-select" aria-label={`Trupproll ${r.name}`} value={career.playerSquadStatus[r.p.id] ?? 'ROTATION'} onChange={e => updateSquadStatus(r.p.id, e.target.value as SquadStatusTier)}>{SQUAD_STATUS_TIERS.map(t => <option key={t} value={t}>{SQUAD_STATUS_TIER_LABEL_SV[t]}</option>)}</select></td>}
            {perf && <><td>{r.appearances}</td><td>{r.starts}</td><td>{r.goals}</td><td>{r.shots ? `${Math.round(r.goals / r.shots * 100)}% / ${r.shots}` : '—'}</td><td>{r.shotsFaced ? `${Math.round(r.saves / r.shotsFaced * 100)}% / ${r.shotsFaced}` : '—'}</td><td>{r.appearances ? r.rating.toFixed(1) : '—'}</td><td><PlayerFormSparkline entries={getPlayerFormHistory(career, r.p.id, formMode, 5)} /></td></>}
            {physical && <><td><span className="hm-roster-energy" data-low={r.energy < 75}>{Math.round(r.energy)}%</span></td><td><span className="hm-roster-energy" data-low={matchFitnessOf(career, r.p.id) < 50}>{matchFitnessOf(career, r.p.id)}%</span></td>{view === 'physical' && <><td title={r.readiness.week.complete ? `${r.readiness.week.matches} match(er), ${Math.round(r.readiness.week.training)} från träning` : 'Hela veckan är inte registrerad ännu'}>{r.readiness.week.complete ? Math.round(r.readiness.week.total) : '—'}</td><td>{r.readiness.trend ? WORKLOAD_TREND_LABEL[r.readiness.trend] : '—'}</td><td title={r.readiness.reasons.join(' · ')} data-outlook={r.readiness.outlook}>{RECOVERY_OUTLOOK_LABEL[r.readiness.outlook]}</td></>}<td><span className={`hm-badge hm-badge-${isSelectableForMatch(career.playerStatuses,r.p.id) ? 'neutral' : 'negative'}`}>{playerAvailabilityLabel(career,r.p.id)}</span></td><td>{career.playerInjuries[r.p.id]?.activeInjury?.expectedReturnDate ?? career.playerStatuses[r.p.id]?.returnDate ?? '—'}</td></>}
            {(contracts || view === 'overview') && <td>{r.contract || '—'}</td>}
            {contracts && <><td>{formatMoney(r.wage)}</td><td><Link href={`/career/squad/${r.p.id}`}>Förläng / profil →</Link></td></>}
          </tr>
        );
      })}</tbody></table></div>{!rows.length && <EmptyState>Inga spelare matchar dina filter.</EmptyState>}
    </Panel>
    <div className="hm-position-filters" aria-label="Filtrera efter position">{['MV','V6','V9','M9','M6','H9','H6'].map(p => <button className="hm-btn hm-btn-sm" aria-pressed={position === p} key={p} onClick={() => { setPosition(p); setStatus('ALL'); }}>{p} · {squad.filter(x => x.position === p && isSelectableForMatch(career.playerStatuses,x.id)).length} tillgängliga</button>)}</div>
  </div>;
}
