'use client';
// Arena Nights -- SQD-04 (A) "Head-to-head with delta bars": searchable pickers, two identity headers, rows
// with a centre-axis delta bar and the better value highlighted, swap, sort by delta and "compare vs squad
// average". External players are shown as knowledge-gated ranges only (lib/players/compareModel.ts); own
// players keep their 1-20 role attributes as before. ?left=&right= (right=avg = squad average).
import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCareer } from '@/lib/career/CareerContext';
import { managementPlayers } from '@/lib/career/management';
import { getAttributeLabel } from '@/lib/rating/attributeVocabulary';
import type { OutcourtAttribute, GoalkeeperAttribute } from '@/lib/rating/types';
import { formatMoney } from '@/lib/economy/currency';
import { useMoney } from '@/lib/settings/usePreferences';
import { ClubLink, PlayerLink } from '@/components/entityLinks';
import { getClub } from '@/lib/game-data';
import { KNOWLEDGE_TIER_LABEL_SV, knowledgeTier } from '@/lib/knowledge/types';
import PlayerActions from '@/components/manager/PlayerActions';
import { PageHeading, EmptyState } from '@/components/manager/Workspace';
import { ComparePicker } from '@/components/players/ComparePicker';
import { ageOf, buildCompareRows, buildCompareSide, buildSquadAverageSide, deltaBar, sortCompareRows, type CompareCell, type CompareRow, type CompareSide, type CompareSortMode } from '@/lib/players/compareModel';

export default function ComparePage() { return <Suspense fallback={<EmptyState>Läser jämförelse…</EmptyState>}><Comparison /></Suspense>; }

function cellText(c: CompareCell, unit?: string): string {
  if (c.value == null) return '—';
  if (c.kind === 'num') return `${c.value}${unit ? ` ${unit}` : ''}`;
  if (c.kind === 'range') return c.value.min === c.value.max ? `${c.value.min} ★` : `${c.value.min}–${c.value.max} ★`;
  return c.value.min === c.value.max ? formatMoney(c.value.min, { compact: true }) : `${formatMoney(c.value.min, { compact: true })} – ${formatMoney(c.value.max, { compact: true })}`;
}

function Comparison() {
  useMoney(); // re-render every figure when the display currency changes
  const { career } = useCareer();
  const params = useSearchParams();
  const router = useRouter();
  const players = useMemo(() => managementPlayers(career), [career]);
  const left = players.find(p => p.id === params.get('left')) ?? players.find(p => p.clubId === career.playerClubId) ?? null;
  const vsAvg = params.get('right') === 'avg';
  const right = vsAvg ? null : players.find(p => p.id === params.get('right')) ?? null;
  const sortMode: CompareSortMode = params.get('sort') === 'delta' ? 'DELTA' : 'DEFAULT';

  const leftSide = useMemo(() => (left ? buildCompareSide(career, left) : null), [career, left]);
  const rightSide = useMemo<CompareSide | null>(() => (vsAvg ? buildSquadAverageSide(career, left?.position) : right ? buildCompareSide(career, right) : null), [career, right, vsAvg, left]);
  const rows = useMemo(() => sortCompareRows(buildCompareRows(leftSide, rightSide, k => getAttributeLabel(k as OutcourtAttribute | GoalkeeperAttribute)), sortMode), [leftSide, rightSide, sortMode]);

  function go(next: Record<string, string | null>) {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) { if (v) q.set(k, v); else q.delete(k); }
    router.replace(`/career/compare?${q}`);
  }
  const swap = () => { if (left && right) go({ left: right.id, right: left.id }); };
  const groups: CompareRow['group'][] = ['Bedömning', 'Prestation', 'Egenskaper'];

  const header = (side: CompareSide | null, which: 'left' | 'right') => {
    if (!side) return <div className="hm-compare-id" data-side={which}><p className="hm-dossier-note">{which === 'right' ? 'Välj spelare B -- en lagkamrat, ett rekryteringsmål eller truppsnittet.' : 'Välj spelare A.'}</p></div>;
    if (side.kind === 'SQUAD_AVG') return <div className="hm-compare-id" data-side={which} data-own="true"><span className="hm-eyebrow">Jämförelsevärde</span><strong>{side.label}</strong><small>Snitt för spelare med speltid; egenskaper från tränarstabens bedömning.</small></div>;
    const p = side.player!;
    return <div className="hm-compare-id" data-side={which} data-own={side.own}>
      <span className="hm-eyebrow">{side.own ? 'Din trupp' : KNOWLEDGE_TIER_LABEL_SV[knowledgeTier(side.knowledge)]}</span>
      <strong><PlayerLink playerId={p.id}>{p.firstName} {p.lastName}</PlayerLink></strong>
      <small><span className="hm-position-code">{p.position}</span> · {ageOf(career, p) ?? '—'} år · {p.clubId ? <ClubLink clubId={p.clubId}>{getClub(p.clubId)?.shortName ?? 'Okänd klubb'}</ClubLink> : 'Fri agent'}{side.own ? '' : ` · kännedom ${side.knowledge} %`}</small>
      <div className="hm-compare-actions"><PlayerActions player={p} /></div>
    </div>;
  };

  return <div className="hm-compare">
    <PageHeading eyebrow="Beslutsunderlag" title="Jämför spelare" description="Rad för rad med skillnaden som stapel från mitten. Bättre värde markeras. Externa spelare visas som scoutingens intervall och jämförs bara när intervallen inte överlappar." actions={<Link className="hm-btn" href="/career/players">Sök kandidat →</Link>} />
    <div className="hm-compare-pickers">
      <ComparePicker label="Spelare A" players={players} ownClubId={career.playerClubId} value={left} onPick={id => go({ left: id })} />
      <div className="hm-compare-tools">
        <button type="button" className="hm-btn hm-btn-sm" onClick={swap} disabled={!left || !right}>⇄ Byt plats</button>
        {(!left || !right) && <small className="hm-dossier-note">Byt plats kräver två spelare.</small>}
        <button type="button" className="hm-btn hm-btn-sm" aria-pressed={vsAvg} onClick={() => go({ right: vsAvg ? null : 'avg' })}>{vsAvg ? 'Sluta jämföra mot truppsnitt' : `Jämför mot truppsnitt${left ? ` (${left.position})` : ''}`}</button>
        <button type="button" className="hm-btn hm-btn-sm" aria-pressed={sortMode === 'DELTA'} onClick={() => go({ sort: sortMode === 'DELTA' ? null : 'delta' })}>{sortMode === 'DELTA' ? 'Standardordning' : 'Sortera på skillnad'}</button>
      </div>
      <ComparePicker label="Spelare B" players={players} ownClubId={career.playerClubId} value={right} onPick={id => go({ right: id })} />
    </div>

    <div className="hm-compare-heads">{header(leftSide, 'left')}{header(rightSide, 'right')}</div>

    {!leftSide || !rightSide ? <EmptyState>Välj spelare B för att jämföra med en lagkamrat eller ett rekryteringsmål -- eller jämför mot truppsnittet. <Link href="/career/players">Sök efter en kandidat →</Link></EmptyState> :
      groups.map(g => {
        const list = rows.filter(r => r.group === g);
        if (!list.length) return null;
        return <section key={g} className="hm-compare-group" aria-labelledby={`cmp-${g}`}>
          <h2 id={`cmp-${g}`}>{g}</h2>
          {g === 'Egenskaper' && (!leftSide.own || !rightSide.own) && <p className="hm-dossier-note">Egenskaper på skalan 1–20 visas bara för dina egna spelare. Externa spelare jämförs genom scoutingens bedömning ovan.</p>}
          <ol className="hm-compare-rows">{list.map(r => {
            const bar = deltaBar(r.delta, r.scale);
            return <li key={r.key}>
              <span className="hm-compare-val" data-side="left" data-better={r.better === 'left'}>{cellText(r.left, r.unit)}</span>
              <span className="hm-compare-mid">
                <span className="hm-compare-label">{r.label}</span>
                <span className="hm-compare-axis" role="img" aria-label={r.delta == null ? `${r.label}: ingen jämförbar skillnad` : `${r.label}: ${r.delta > 0 ? 'B' : 'A'} bättre med ${Math.abs(r.delta)}`}>
                  {bar.dir !== 'none' && <i data-dir={bar.dir} style={{ left: `${bar.left}%`, width: `${bar.width}%` }} />}
                </span>
                {r.delta != null && r.delta !== 0 && <small className="hm-compare-delta">{r.delta > 0 ? '+' : '−'}{Math.abs(r.delta)}{r.unit ? ` ${r.unit}` : ''}</small>}
                {r.delta == null && r.better && <small className="hm-compare-delta">{r.better === 'left' ? 'A' : 'B'} bedöms högre</small>}
              </span>
              <span className="hm-compare-val" data-side="right" data-better={r.better === 'right'}>{cellText(r.right, r.unit)}</span>
            </li>;
          })}</ol>
        </section>;
      })}
  </div>;
}
