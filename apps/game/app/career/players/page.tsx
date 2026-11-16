'use client';
// Arena Nights -- SQD-03 (A) "Market Workbench": filter rail (presets from squad needs, saved searches,
// position / age / nation / competition / contract / knowledge) + one market table with knowledge-gated
// ability and potential bands, value range, knowledge %, age, position and contract end; sortable by band
// midpoint; + Kortlista and bulk actions on a selection. SQD-03a (B): row selection opens the shared Peek
// drawer (bottom sheet on phones) with previous / next. Phone: filter sheet + ranked cards with band bars.
// Fog of war: lib/players/marketWorkbench.ts reads only careerPlayerVisibility and resolveMarketValueRange.
import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useWorkspaceState } from '@/components/game/WorkspaceMemory';
import { useCareer } from '@/lib/career/CareerContext';
import { COMPETITIONS } from '@/lib/game-data';
import { CONTRACT_STATUS_LABEL } from '@/lib/economy/labels';
import { formatMoney } from '@/lib/economy/currency';
import { useMoney } from '@/lib/settings/usePreferences';
import { getRecruitmentStatus } from '@/lib/career/recruitment';
import { getClubScouts } from '@/lib/career/scouting';
import { ClubLink } from '@/components/entityLinks';
import { PageHeading, EmptyState } from '@/components/manager/Workspace';
import { PlayerCell } from '@/components/game/Identity';
import { RecruitmentTag } from '@/components/game/RecruitmentPresentation';
import { StarRangeBar, ValueRangeBar } from '@/components/players/RangeBar';
import { MarketPeek } from '@/components/players/MarketPeek';
import { buildMarketRows, describeMarketFilter, EMPTY_MARKET_FILTER, filterMarket, marketPresets, saveMarketSearch, sortMarket, type MarketFilter, type MarketRow, type MarketSort, type MarketSortKey, type SavedMarketSearch } from '@/lib/players/marketWorkbench';

const PAGE = 60;
const POSITIONS = ['ALL', 'MV', 'V6', 'V9', 'M9', 'M6', 'H9', 'H6'];
const COLUMNS: { key: MarketSortKey | null; label: string; numeric?: boolean; title?: string }[] = [
  { key: 'name', label: 'Spelare' }, { key: null, label: 'Pos' }, { key: 'age', label: 'Ålder', numeric: true },
  { key: 'ability', label: 'Nivå', title: 'Scoutingens bedömda intervall -- sorteras på intervallets mitt', numeric: true },
  { key: 'potential', label: 'Potential', title: 'Syns från måttlig kännedom -- sorteras på intervallets mitt', numeric: true },
  { key: 'value', label: 'Värde', title: 'Uppskattat värdeintervall -- smalnar av med kännedom', numeric: true },
  { key: 'knowledge', label: 'Kännedom', numeric: true }, { key: 'contract', label: 'Avtal till' },
];

export default function PlayerSearchPage() {
  useMoney();
  const { career, addToShortlist, removeFromShortlist } = useCareer();
  const [filter, setFilter] = useWorkspaceState<MarketFilter>('players.filter', EMPTY_MARKET_FILTER);
  const [sort, setSort] = useWorkspaceState<MarketSort>('players.marketSort', { key: 'ability', direction: 'desc' });
  const [saved, setSaved] = useWorkspaceState<SavedMarketSearch[]>('players.saved', []);
  const [selected, setSelected] = useWorkspaceState<string[]>('players.bulk', []);
  const [shown, setShown] = useState(PAGE);
  const [peekId, setPeekId] = useState<string | null>(null);
  const [saveName, setSaveName] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const closePeek = useCallback(() => setPeekId(null), []);

  const all = useMemo(() => buildMarketRows(career), [career]);
  const presets = useMemo(() => marketPresets(career), [career]);
  const nations = useMemo(() => [...new Set(all.map(r => r.nationality))].sort((a, b) => a.localeCompare(b, 'sv')), [all]);
  const valueScale = useMemo(() => all.reduce((m, r) => Math.max(m, r.value?.max ?? 0), 1), [all]);
  const rows = useMemo(() => sortMarket(filterMarket(all, filter), sort), [all, filter, sort]);
  const visible = rows.slice(0, shown);
  const shortlistCount = Object.values(career.recruitmentTargets).filter(t => t.shortlisted).length;
  const scouts = getClubScouts(career);
  const chosenRows = selected.map(id => all.find(r => r.id === id)).filter((r): r is MarketRow => !!r);
  const chosen = chosenRows.map(r => r.id);
  const peekIndex = peekId ? rows.findIndex(r => r.id === peekId) : -1;
  const peek = peekIndex >= 0 ? rows[peekIndex] : peekId ? all.find(r => r.id === peekId) : undefined;

  const shortlisted = (id: string) => !!career.recruitmentTargets[id]?.shortlisted;
  const toggleShortlist = (id: string) => (shortlisted(id) ? removeFromShortlist(id) : addToShortlist(id));
  const update = (patch: Partial<MarketFilter>) => { setFilter({ ...filter, ...patch }); setShown(PAGE); setActivePreset(null); };
  const onSort = (key: MarketSortKey, numeric?: boolean) => setSort(sort.key === key ? { key, direction: sort.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: numeric ? 'desc' : 'asc' });
  const toggle = (id: string, on: boolean) => setSelected(prev => on ? [...new Set([...prev, id])] : prev.filter(x => x !== id));
  const contractText = (r: MarketRow) => r.contractEnd ?? (r.contractStatus ? CONTRACT_STATUS_LABEL[r.contractStatus as keyof typeof CONTRACT_STATUS_LABEL] : r.clubId ? '—' : 'Fri agent');
  const money = (n: number) => formatMoney(n, { compact: true });
  const step = (index: number) => { const r = rows[index]; if (!r) return; setPeekId(r.id); if (index >= shown) setShown(shown + PAGE); };

  return <div className="game-discovery-page hm-market">
    <PageHeading eyebrow="Rekrytering / marknad" title="Spelarsök" description="En marknadstabell: bedömd nivå och potential som intervall, värdeintervall och hur väl du känner spelaren. Intervallen smalnar av när du scoutar." actions={<Link href="/career/recruitment?view=SHORTLIST" className="hm-btn">Öppna kortlista ({shortlistCount}) →</Link>} />
    <dl className="hm-market-counts">
      <div><dt>På marknaden</dt><dd>{all.length}</dd></div>
      <div><dt>Träffar</dt><dd>{rows.length}</dd></div>
      <div><dt>På kortlistan</dt><dd>{shortlistCount}</dd></div>
      <div><dt>Scouter i klubben</dt><dd>{scouts.length}</dd></div>
    </dl>
    <div className="hm-market-layout">
      <aside className="hm-market-rail" data-open={filtersOpen} aria-label="Filter, förval och sparade sökningar">
        <button type="button" className="hm-btn hm-market-rail-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>{filtersOpen ? 'Stäng filter' : `Filter · ${describeMarketFilter(filter)}`}</button>
        <div className="hm-market-rail-body">
          <section aria-labelledby="mk-presets-h">
            <h2 id="mk-presets-h">Utifrån truppens behov</h2>
            <ul className="hm-market-presets">{presets.map(p => <li key={p.id}><button type="button" aria-pressed={activePreset === p.id} onClick={() => { setFilter(p.filter); if (p.sort) setSort(p.sort); setShown(PAGE); setActivePreset(p.id); setFiltersOpen(false); }}><b>{p.label}</b><small>{p.reason}</small></button></li>)}</ul>
          </section>
          <section aria-labelledby="mk-saved-h">
            <h2 id="mk-saved-h">Sparade sökningar</h2>
            {saved.length === 0 ? <p className="hm-dossier-note">Inga sparade sökningar. Ställ in filtren och spara dem med ett namn nedan.</p> :
              <ul className="hm-market-saved">{saved.map(s => <li key={s.id}><button type="button" onClick={() => { setFilter(s.filter); setShown(PAGE); setActivePreset(null); setFiltersOpen(false); }}><b>{s.name}</b><small>{describeMarketFilter(s.filter)}</small></button><button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" aria-label={`Ta bort sparad sökning ${s.name}`} onClick={() => setSaved(saved.filter(x => x.id !== s.id))}>✕</button></li>)}</ul>}
            <form className="hm-market-save" onSubmit={e => { e.preventDefault(); setSaved(saveMarketSearch(saved, saveName, filter)); setSaveName(''); }}>
              <input className="hm-input" aria-label="Namn på sökningen" placeholder="Namn på sökningen" value={saveName} onChange={e => setSaveName(e.target.value)} />
              <button className="hm-btn hm-btn-sm" type="submit" disabled={!saveName.trim()}>Spara sökning</button>
              {!saveName.trim() && <small className="hm-dossier-note">Skriv ett namn för att spara.</small>}
            </form>
          </section>
          <section aria-labelledby="mk-filter-h" className="hm-market-filters">
            <h2 id="mk-filter-h">Filter</h2>
            <label>Namn / klubb<input className="hm-input" aria-label="Sök spelarmarknaden" value={filter.query} onChange={e => update({ query: e.target.value })} placeholder="Namn eller klubb" /></label>
            <label>Position<select className="hm-select" value={filter.position} onChange={e => update({ position: e.target.value })}>{POSITIONS.map(p => <option key={p} value={p}>{p === 'ALL' ? 'Alla positioner' : p}</option>)}</select></label>
            <label>Max ålder<input className="hm-input" type="number" min="16" max="60" value={filter.maxAge} onChange={e => update({ maxAge: e.target.value })} /></label>
            <label>Nationalitet<select className="hm-select" value={filter.nation} onChange={e => update({ nation: e.target.value })}><option value="ALL">Alla</option>{nations.map(n => <option key={n}>{n}</option>)}</select></label>
            <label>Tävling<select className="hm-select" value={filter.league} onChange={e => update({ league: e.target.value })}><option value="ALL">Alla tävlingar</option>{COMPETITIONS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label>Avtal<select className="hm-select" value={filter.contract} onChange={e => update({ contract: e.target.value as MarketFilter['contract'] })}><option value="ALL">Alla avtal</option><option value="EXPIRING">Utgående inom ett år</option><option value="FREE_AGENT">Fria agenter</option></select></label>
            <label>Minsta kännedom<select className="hm-select" value={filter.minKnowledge} onChange={e => update({ minKnowledge: Number(e.target.value) })}><option value={0}>Alla</option><option value={25}>Minst 25 %</option><option value={50}>Minst 50 % (potential syns)</option><option value={75}>Minst 75 % (god kännedom)</option></select></label>
            <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => update(EMPTY_MARKET_FILTER)}>Rensa filter</button>
          </section>
        </div>
      </aside>
      <section className="hm-market-main" aria-label="Marknadstabell">
        <div className="hm-market-toolbar">
          <span aria-live="polite"><strong>{rows.length}</strong> spelare · {describeMarketFilter(filter)}</span>
          <label className="hm-market-sort">Sortera<select className="hm-select" value={`${sort.key}:${sort.direction}`} onChange={e => { const [key, direction] = e.target.value.split(':') as [MarketSortKey, 'asc' | 'desc']; setSort({ key, direction }); }}>
            <option value="ability:desc">Nivå (intervallets mitt), högst först</option><option value="ability:asc">Nivå, lägst först</option><option value="potential:desc">Potential, högst först</option><option value="potential:asc">Potential, lägst först</option><option value="value:asc">Värde, lägst först</option><option value="value:desc">Värde, högst först</option><option value="knowledge:desc">Kännedom, högst först</option><option value="knowledge:asc">Kännedom, lägst först</option><option value="age:asc">Ålder, yngst först</option><option value="age:desc">Ålder, äldst först</option><option value="contract:asc">Avtal, kortast först</option><option value="contract:desc">Avtal, längst först</option><option value="name:asc">Namn A–Ö</option><option value="name:desc">Namn Ö–A</option><option value="goals:desc">Mål, flest först</option><option value="goals:asc">Mål, minst först</option>
          </select></label>
        </div>

        {chosen.length > 0 && <div className="hm-market-bulk" role="region" aria-label="Valda spelare">
          <strong>{chosen.length} {chosen.length === 1 ? 'vald' : 'valda'}</strong>
          <button type="button" className="hm-btn hm-btn-sm" onClick={() => chosen.forEach(id => { if (!shortlisted(id)) addToShortlist(id); })}>+ Kortlista alla</button>
          {chosen.length === 2 ? <Link className="hm-btn hm-btn-sm hm-btn-primary" href={`/career/compare?left=${encodeURIComponent(chosen[0]!)}&right=${encodeURIComponent(chosen[1]!)}`}>Jämför valda →</Link> : <span className="hm-dossier-note">Välj två för att jämföra.</span>}
          <button type="button" className="hm-btn hm-btn-sm hm-btn-ghost" onClick={() => setSelected([])}>Rensa val</button>
          <div className="hm-market-bulk-scout">
            {scouts.length === 0 ? <span className="hm-dossier-note">Klubben har ingen scout anställd -- bevakning kan inte startas.</span> : <>
              <span className="hm-dossier-note">Scouta valda: Scouting tar ett uppdrag per spelare, öppna dem ett i taget.</span>
              {chosenRows.map(r => <Link key={r.id} className="hm-btn hm-btn-sm" href={`/career/scouting?target=${encodeURIComponent(r.id)}`}>Scouta {r.player.lastName} →</Link>)}
            </>}
          </div>
        </div>}

        {rows.length === 0 ? <EmptyState>Inga spelare matchar filtren ({describeMarketFilter(filter)}). <button type="button" className="hm-btn hm-btn-sm" onClick={() => update(EMPTY_MARKET_FILTER)}>Rensa filtren</button></EmptyState> : <>
          <div className="hm-scroll-x hm-market-table-wrap"><table className="hm-table hm-market-table">
            <thead><tr>
              <th className="hm-market-select"><input type="checkbox" aria-label="Välj alla visade spelare" checked={visible.length > 0 && visible.every(r => chosen.includes(r.id))} onChange={e => setSelected(e.target.checked ? [...new Set([...chosen, ...visible.map(r => r.id)])] : chosen.filter(id => !visible.some(r => r.id === id)))} /></th>
              {COLUMNS.map(c => { const active = c.key && sort.key === c.key; return <th key={c.label} title={c.title} data-numeric={c.numeric} aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}>{c.key ? <button type="button" className="hm-sort" onClick={() => onSort(c.key!, c.numeric)}>{c.label}{active ? (sort.direction === 'asc' ? ' ▲' : ' ▼') : ''}</button> : c.label}</th>; })}
              <th>Process</th><th><span className="hm-sr-only">Åtgärder</span></th>
            </tr></thead>
            <tbody>{visible.map(r => <tr key={r.id} data-selected={peekId === r.id} data-clickable="true" onClick={() => setPeekId(r.id)}>
              <td className="hm-market-select" onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={`Välj ${r.name}`} checked={chosen.includes(r.id)} onChange={e => toggle(r.id, e.target.checked)} /></td>
              <td><PlayerCell player={r.player} /><small className="hm-market-club">{r.clubId ? <ClubLink clubId={r.clubId} stopPropagation>{r.clubName}</ClubLink> : 'Fri agent'}</small></td>
              <td><span className="hm-position-code">{r.position}</span></td>
              <td data-numeric="true">{r.age ?? '—'}</td>
              <td className="hm-market-band"><StarRangeBar label="Nivå" range={r.ability} /></td>
              <td className="hm-market-band"><StarRangeBar label="Potential" range={r.potential} /></td>
              <td className="hm-market-band"><ValueRangeBar label="Värde" range={r.value} scaleMax={valueScale} format={money} /></td>
              <td data-numeric="true"><span className="hm-market-know" data-tier={r.tier}>{r.knowledge} %</span></td>
              <td>{contractText(r)}</td>
              <td><RecruitmentTag status={getRecruitmentStatus(career, r.id)} /></td>
              <td onClick={e => e.stopPropagation()}><div className="hm-actions">
                <button type="button" className="hm-btn hm-btn-sm" aria-label={`Kortlista ${r.name}`} aria-pressed={shortlisted(r.id)} onClick={() => toggleShortlist(r.id)}>{shortlisted(r.id) ? 'Kortlistad' : '+ Kortlista'}</button>
                <button type="button" className="hm-btn hm-btn-sm" aria-label={`Visa dossier för ${r.name}`} onClick={() => setPeekId(r.id)}>Visa</button>
                <Link href={`/career/compare?left=${encodeURIComponent(r.id)}`}>Jämför</Link>
              </div></td>
            </tr>)}</tbody>
          </table></div>

          <ol className="hm-market-cards" aria-label="Spelare, rangordnade">
            {visible.map(r => <li key={r.id} data-selected={chosen.includes(r.id)}>
              <label className="hm-market-card-select"><input type="checkbox" aria-label={`Välj ${r.name} (kort)`} checked={chosen.includes(r.id)} onChange={e => toggle(r.id, e.target.checked)} /></label>
              <button type="button" className="hm-market-card-open" onClick={() => setPeekId(r.id)} aria-label={`Visa dossier för ${r.name} (kort)`}>
                <strong>{r.name}</strong><small>{r.position} · {r.age ?? '—'} år · {r.clubName} · kännedom {r.knowledge} %</small>
              </button>
              <div className="hm-range-stack">
                <StarRangeBar label="Nivå" range={r.ability} />
                <StarRangeBar label="Potential" range={r.potential} />
                <ValueRangeBar label="Värde" range={r.value} scaleMax={valueScale} format={money} />
              </div>
              <button type="button" className="hm-btn hm-btn-sm" aria-pressed={shortlisted(r.id)} onClick={() => toggleShortlist(r.id)}>{shortlisted(r.id) ? 'Kortlistad' : '+ Kortlista'}</button>
            </li>)}
          </ol>

          <div className="hm-market-more">
            <span>Visar {visible.length} av {rows.length}</span>
            {visible.length < rows.length && <button type="button" className="hm-btn hm-btn-sm" onClick={() => setShown(shown + PAGE)}>Visa {Math.min(PAGE, rows.length - visible.length)} till</button>}
          </div>
        </>}
      </section>
    </div>

    {peek && <MarketPeek row={peek} career={career} index={Math.max(0, peekIndex)} total={peekIndex >= 0 ? rows.length : 1} valueScale={valueScale} shortlisted={shortlisted(peek.id)}
      onShortlist={() => toggleShortlist(peek.id)} onPrev={() => step(peekIndex - 1)} onNext={() => step(peekIndex + 1)} onClose={closePeek} />}
  </div>;
}
